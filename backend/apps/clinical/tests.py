import uuid
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile
from apps.clinical.models import (
    Ward, WardType, Bed, BedStatus, Appointment, AppointmentStatus,
    InpatientAdmission, AdmissionStatus, PatientTransfer,
    EmergencyEncounter, TriageAcuity, EmergencyStatus,
    DoctorSchedule, DoctorLeave, LabTestCatalogue, LabOrder
)
from apps.pharmacy_inventory.models import Medicine, Prescription
from apps.billing_finance.models import Invoice

User = get_user_model()


class TestClinicalOperations(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.hospital = Hospital.objects.create(
            name='Test Hospital HQ',
            code=f"HOSP-{uuid.uuid4().hex[:4].upper()}"
        )
        self.branch = Branch.objects.create(
            hospital=self.hospital,
            name='Main City Branch',
            code=f"BR-{uuid.uuid4().hex[:4].upper()}"
        )
        self.dept = Department.objects.create(
            branch=self.branch,
            name='Cardiology',
            code=f"DEP-{uuid.uuid4().hex[:4].upper()}"
        )

        self.doctor_role, _ = Role.objects.get_or_create(
            name=RoleEnum.DOCTOR,
            defaults={'display_name': 'Doctor'}
        )
        self.patient_role, _ = Role.objects.get_or_create(
            name=RoleEnum.PATIENT,
            defaults={'display_name': 'Patient'}
        )

        # Doctor profile & Django auth user
        self.doc_supabase_id = uuid.uuid4()
        self.doc_django_user = User.objects.create_user(
            username=str(self.doc_supabase_id),
            email='doctor@hospital.local'
        )
        self.doc_user = UserProfile.objects.create(
            supabase_user_id=self.doc_supabase_id,
            email='doctor@hospital.local',
            first_name='Rohan',
            last_name='Nambiar',
            role=self.doctor_role
        )
        self.doctor = StaffProfile.objects.create(
            user_profile=self.doc_user,
            hospital=self.hospital,
            branch=self.branch,
            department=self.dept,
            employee_id=f"EMP-{uuid.uuid4().hex[:6].upper()}",
            designation='Consultant Cardiologist',
            consultation_fee=Decimal('800.00'),
            status='ACTIVE'
        )

        # Patient profile
        self.pat_supabase_id = uuid.uuid4()
        self.pat_django_user = User.objects.create_user(
            username=str(self.pat_supabase_id),
            email='patient@gmail.com'
        )
        self.pat_user = UserProfile.objects.create(
            supabase_user_id=self.pat_supabase_id,
            email='patient@gmail.com',
            first_name='Ananya',
            last_name='Deshmukh',
            role=self.patient_role
        )
        self.patient = PatientProfile.objects.create(
            user_profile=self.pat_user,
            primary_branch=self.branch,
            medical_record_number=f"MRN-{uuid.uuid4().hex[:8].upper()}",
            gender='FEMALE'
        )

        # Ward and Bed
        self.ward = Ward.objects.create(
            branch=self.branch,
            department=self.dept,
            name='Cardio Care Ward A',
            ward_type=WardType.ICU,
            total_beds=4
        )
        self.bed = Bed.objects.create(
            ward=self.ward,
            bed_number='ICU-01',
            status=BedStatus.AVAILABLE,
            daily_rate=Decimal('5000.00')
        )

    def test_appointment_booking_and_slot_collision_prevention(self):
        """Verify appointment booking and conflict prevention on duplicate doctor time slot."""
        self.client.force_authenticate(user=self.doc_django_user)

        payload = {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'department_id': str(self.dept.id),
            'appointment_date': '2026-11-15',
            'time_slot': '10:00 AM',
            'reason_for_visit': 'Routine hypertension follow-up'
        }

        # First booking succeeds
        res1 = self.client.post('/api/v1/clinical/appointments/', payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        self.assertIn('APT-', res1.data['appointment_number'])
        self.assertEqual(res1.data['token_number'], 'Token #1')

        # Second booking with identical doctor, date, and slot must be REJECTED (409 Conflict)
        res2 = self.client.post('/api/v1/clinical/appointments/', payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('already has an appointment scheduled', res2.data['error'])

    def test_inpatient_bed_allocation_and_discharge_lifecycle(self):
        """Verify bed status changes from AVAILABLE -> OCCUPIED on admission, and back to AVAILABLE on discharge."""
        self.client.force_authenticate(user=self.doc_django_user)

        # 1. Admit patient
        admit_payload = {
            'patient_id': str(self.patient.id),
            'bed_id': str(self.bed.id),
            'admitting_doctor_id': str(self.doctor.id),
            'initial_diagnosis': 'Acute Coronary Syndrome'
        }
        res_adm = self.client.post('/api/v1/clinical/admissions/', admit_payload, format='json')
        self.assertEqual(res_adm.status_code, status.HTTP_201_CREATED)
        admission_id = res_adm.data['id']

        # Verify bed is now marked OCCUPIED
        self.bed.refresh_from_db()
        self.assertEqual(self.bed.status, BedStatus.OCCUPIED)

        # Attempting to admit another patient to the same bed must FAIL (409 Conflict)
        res_conflict = self.client.post('/api/v1/clinical/admissions/', admit_payload, format='json')
        self.assertEqual(res_conflict.status_code, status.HTTP_409_CONFLICT)

        # 2. Discharge patient
        discharge_payload = {
            'discharge_condition': 'Hemodynamically stable',
            'discharge_summary': 'Successful cardiac stenting, vitals normal'
        }
        res_disc = self.client.post(f'/api/v1/clinical/admissions/{admission_id}/discharge/', discharge_payload, format='json')
        self.assertEqual(res_disc.status_code, status.HTTP_200_OK)

        # Verify bed is returned to AVAILABLE
        self.bed.refresh_from_db()
        self.assertEqual(self.bed.status, BedStatus.AVAILABLE)

    def test_doctor_availability_slots_and_leave_blocking(self):
        """Verify dynamic slot generation from schedule and slot suppression during doctor leave."""
        from datetime import time, date
        self.client.force_authenticate(user=self.doc_django_user)

        # 1. Create a schedule for Monday (e.g. 2026-11-16 is a Monday)
        DoctorSchedule.objects.create(
            doctor=self.doctor,
            day_of_week='MON',
            start_time=time(9, 0),
            end_time=time(10, 0),
            slot_duration_minutes=20,
            is_available=True
        )

        res = self.client.get(f'/api/v1/clinical/doctors/{self.doctor.id}/available-slots/?date=2026-11-16')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['is_on_leave'], False)
        # 09:00 - 10:00 with 20min duration gives 3 slots: 09:00-09:20, 09:20-09:40, 09:40-10:00
        self.assertEqual(len(res.data['slots']), 3)

        # 2. Add an approved leave covering that date
        leave = DoctorLeave.objects.create(
            doctor=self.doctor,
            start_date=date(2026, 11, 15),
            end_date=date(2026, 11, 17),
            reason='Attending Annual Cardiology Summit',
            is_approved=True
        )

        res_leave = self.client.get(f'/api/v1/clinical/doctors/{self.doctor.id}/available-slots/?date=2026-11-16')
        self.assertEqual(res_leave.status_code, status.HTTP_200_OK)
        self.assertEqual(res_leave.data['is_on_leave'], True)
        self.assertEqual(len(res_leave.data['slots']), 0)
        self.assertIn('Cardiology Summit', res_leave.data['leave_reason'])

    def test_opd_walk_in_registration_and_token_generation(self):
        """Verify walk-in patient registration generates atomic token and consultation invoice."""
        self.client.force_authenticate(user=self.doc_django_user)

        payload = {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'department_id': str(self.dept.id),
            'branch_id': str(self.branch.id),
            'chief_complaint': 'Acute chest tightness and dizziness',
            'vitals': {'bp': '138/88', 'pulse': 82, 'spo2': 98}
        }

        res = self.client.post('/api/v1/clinical/opd/walk-in/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('Token #', res.data['token_receipt']['token_number'])
        self.assertEqual(res.data['appointment']['status'], 'CHECKED_IN')
        self.assertEqual(res.data['appointment']['appointment_type'], 'WALK_IN')
        self.assertIsNotNone(res.data['token_receipt']['invoice_number'])

        # Verify in database
        appt = Appointment.objects.get(id=res.data['appointment']['id'])
        self.assertIsNotNone(appt.checked_in_at)
        self.assertIsNotNone(appt.invoice)
        self.assertEqual(appt.invoice.total_amount, self.doctor.consultation_fee)

    def test_opd_queue_and_status_transitions(self):
        """Verify patient queue view, wait time calculation, and status progression."""
        from django.utils import timezone
        self.client.force_authenticate(user=self.doc_django_user)

        # Create a checked-in appointment
        appt = Appointment.objects.create(
            appointment_number=f"APT-TEST-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient,
            doctor=self.doctor,
            department=self.dept,
            branch=self.branch,
            appointment_date=timezone.now().date(),
            time_slot='11:00 AM',
            token_number='Token #99',
            status=AppointmentStatus.CHECKED_IN,
            checked_in_at=timezone.now()
        )

        # Fetch queue
        res_q = self.client.get(f'/api/v1/clinical/opd/queue/?date={timezone.now().date()}&doctor_id={self.doctor.id}')
        self.assertEqual(res_q.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item['id'] == str(appt.id) for item in res_q.data))

        # Advance status: START_CONSULTATION
        res_start = self.client.post(f'/api/v1/clinical/opd/queue/{appt.id}/action/', {'action': 'START_CONSULTATION'}, format='json')
        self.assertEqual(res_start.status_code, status.HTTP_200_OK)
        self.assertEqual(res_start.data['status'], AppointmentStatus.IN_CONSULTATION)

        # Advance status: COMPLETE
        res_comp = self.client.post(f'/api/v1/clinical/opd/queue/{appt.id}/action/', {'action': 'COMPLETE'}, format='json')
        self.assertEqual(res_comp.status_code, status.HTTP_200_OK)
        self.assertEqual(res_comp.data['status'], AppointmentStatus.COMPLETED)

    def test_consultation_finalization_with_prescription_and_followup(self):
        """Verify consultation completion creates real Prescription, LabOrder, and Follow-up Appointment."""
        from django.utils import timezone
        self.client.force_authenticate(user=self.doc_django_user)

        # Create medicine in catalogue
        med = Medicine.objects.create(
            code=f"MED-{uuid.uuid4().hex[:4].upper()}",
            generic_name='Amlodipine Besylate',
            brand_name='Norvasc 5mg',
            category='CARDIOVASCULAR',
            dosage_form='TABLET',
            strength='5mg'
        )

        # Create test in catalogue
        test = LabTestCatalogue.objects.create(
            code=f"TEST-{uuid.uuid4().hex[:4].upper()}",
            name='Serum Lipid Profile',
            category='BIOCHEMISTRY',
            standard_rate=Decimal('650.00')
        )

        # Initial appointment
        appt = Appointment.objects.create(
            appointment_number=f"APT-CONS-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient,
            doctor=self.doctor,
            department=self.dept,
            branch=self.branch,
            appointment_date=timezone.now().date(),
            time_slot='02:00 PM',
            token_number='Token #101',
            status=AppointmentStatus.IN_CONSULTATION
        )

        final_payload = {
            'chief_complaint': 'Persistent headache and elevated blood pressure',
            'examination_findings': 'BP 146/92 mmHg, S1/S2 heard, no murmurs',
            'diagnosis': 'Stage 1 Essential Hypertension (ICD-10: I10)',
            'treatment_plan': 'Start calcium channel blocker, low sodium diet',
            'vitals': {'bp': '146/92', 'pulse': 76, 'spo2': 99},
            'prescriptions': [
                {
                    'medicine_id': str(med.id),
                    'dosage': '1 Tablet',
                    'frequency': '1-0-0 (Morning)',
                    'duration_days': 30,
                    'total_quantity': 30,
                    'instructions': 'Take after breakfast'
                }
            ],
            'lab_test_ids': [str(test.id)],
            'follow_up_date': str(timezone.now().date() + timezone.timedelta(days=14)),
            'book_follow_up': True,
            'follow_up_time_slot': '11:00 AM'
        }

        res = self.client.post(f'/api/v1/clinical/appointments/{appt.id}/finalize-consultation/', final_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['appointment']['status'], 'COMPLETED')
        self.assertIn('Norvasc', res.data['appointment']['prescription_summary'])

        # Verify Prescription and LabOrder exist in DB
        self.assertTrue(Prescription.objects.filter(patient=self.patient, doctor=self.doctor).exists())
        self.assertTrue(LabOrder.objects.filter(patient=self.patient, doctor=self.doctor).exists())

        # Verify Follow-up Appointment created
        follow_up_appt = Appointment.objects.filter(
            patient=self.patient,
            booking_source='FOLLOW_UP'
        ).first()
        self.assertIsNotNone(follow_up_appt)
        self.assertEqual(follow_up_appt.status, AppointmentStatus.SCHEDULED)

    def test_opd_reports_aggregation(self):
        """Verify doctor-wise and department-wise reporting returns real calculated totals."""
        from django.utils import timezone
        self.client.force_authenticate(user=self.doc_django_user)

        res = self.client.get('/api/v1/clinical/opd/reports/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('summary', res.data)
        self.assertIn('doctor_reports', res.data)
        self.assertIn('department_reports', res.data)

    def test_emergency_casualty_registration_and_ipd_request(self):
        """Verify emergency patient registration with Triage Acuity 1 Red and admission request creation."""
        self.client.force_authenticate(user=self.doc_django_user)

        payload = {
            'patient_id': str(self.patient.id),
            'branch_id': str(self.branch.id),
            'triage_acuity': 'RED',
            'arrival_mode': 'AMBULANCE',
            'chief_complaint': 'Acute myocardial infarction with cardiogenic shock',
            'vitals_on_arrival': {'bp': '80/50', 'pulse': 130, 'spo2': 88},
            'attending_doctor_id': str(self.doctor.id)
        }

        # 1. Register and triage emergency patient
        res_er = self.client.post('/api/v1/clinical/emergency/', payload, format='json')
        self.assertEqual(res_er.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_er.data['triage_acuity'], 'RED')
        self.assertIn('ER-', res_er.data['encounter_number'])
        er_id = res_er.data['id']

        # 2. Update treatment
        res_treat = self.client.post(f'/api/v1/clinical/emergency/{er_id}/action/', {
            'action': 'UPDATE_TREATMENT',
            'treatment_given': 'IV Heparin bolus, Aspirin 300mg, O2 @ 6L/min started immediately.'
        }, format='json')
        self.assertEqual(res_treat.status_code, status.HTTP_200_OK)
        self.assertEqual(res_treat.data['status'], 'UNDER_TREATMENT')

        # 3. Request immediate IPD Admission (STAT_EMERGENCY)
        res_adm_req = self.client.post(f'/api/v1/clinical/emergency/{er_id}/action/', {
            'action': 'REQUEST_IPD_ADMISSION',
            'requested_ward_type': 'ICU'
        }, format='json')
        self.assertEqual(res_adm_req.status_code, status.HTTP_200_OK)
        self.assertIn('requested successfully from Emergency', res_adm_req.data['message'])
        self.assertEqual(res_adm_req.data['admission']['priority'], 'STAT_EMERGENCY')
        self.assertEqual(res_adm_req.data['admission']['status'], 'REQUESTED')
        self.assertEqual(res_adm_req.data['encounter']['status'], 'TRANSFERRED_TO_IPD')

    def test_emergency_patient_reconciliation(self):
        """Verify an unidentified casualty patient can be safely reconciled with a registered patient record."""
        self.client.force_authenticate(user=self.doc_django_user)

        # Create unidentified victim
        res_unreg = self.client.post('/api/v1/clinical/emergency/', {
            'unregistered_patient_name': 'John Doe (Trauma Victim #4)',
            'branch_id': str(self.branch.id),
            'triage_acuity': 'YELLOW',
            'arrival_mode': 'POLICE',
            'chief_complaint': 'Unconscious post-RTA'
        }, format='json')
        self.assertEqual(res_unreg.status_code, status.HTTP_201_CREATED)
        er_id = res_unreg.data['id']

        # Reconcile with verified patient
        res_rec = self.client.post(f'/api/v1/clinical/emergency/{er_id}/action/', {
            'action': 'RECONCILE_PATIENT',
            'patient_id': str(self.patient.id)
        }, format='json')
        self.assertEqual(res_rec.status_code, status.HTTP_200_OK)
        self.assertEqual(str(res_rec.data['patient']), str(self.patient.id))
        self.assertEqual(res_rec.data['patient_mrn'], self.patient.medical_record_number)

    def test_inpatient_admission_request_approval_and_bed_allocation(self):
        """Verify multi-step admission lifecycle: Request -> Approval -> Atomic Bed Allocation -> Collision Prevention."""
        self.client.force_authenticate(user=self.doc_django_user)

        # 1. Create admission request without allocating a bed
        req_payload = {
            'patient_id': str(self.patient.id),
            'admitting_doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'admission_source': 'OPD',
            'priority': 'URGENT',
            'requested_ward_type': 'ICU',
            'initial_diagnosis': 'Unstable Angina Pectoris'
        }
        res_req = self.client.post('/api/v1/clinical/admissions/', req_payload, format='json')
        self.assertEqual(res_req.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_req.data['status'], 'REQUESTED')
        self.assertIsNone(res_req.data['bed'])
        adm_id = res_req.data['id']

        # 2. Approve Admission Request
        res_appr = self.client.post(f'/api/v1/clinical/admissions/{adm_id}/action/', {'action': 'APPROVE'}, format='json')
        self.assertEqual(res_appr.status_code, status.HTTP_200_OK)
        self.assertEqual(res_appr.data['status'], 'APPROVED')

        # 3. Allocate Bed
        res_alloc = self.client.post(f'/api/v1/clinical/admissions/{adm_id}/action/', {
            'action': 'ALLOCATE_BED',
            'bed_id': str(self.bed.id)
        }, format='json')
        self.assertEqual(res_alloc.status_code, status.HTTP_200_OK)
        self.assertEqual(res_alloc.data['status'], 'ADMITTED')
        self.assertEqual(res_alloc.data['bed_number'], self.bed.bed_number)

        # Verify bed is marked OCCUPIED
        self.bed.refresh_from_db()
        self.assertEqual(self.bed.status, BedStatus.OCCUPIED)

        # 4. Attempting to allocate the same OCCUPIED bed to another admission must be rejected (409 Conflict)
        res_second_req = self.client.post('/api/v1/clinical/admissions/', req_payload, format='json')
        second_adm_id = res_second_req.data['id']
        res_collision = self.client.post(f'/api/v1/clinical/admissions/{second_adm_id}/action/', {
            'action': 'ALLOCATE_BED',
            'bed_id': str(self.bed.id)
        }, format='json')
        self.assertEqual(res_collision.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('is not available', res_collision.data['error'])

    def test_inpatient_bed_transfer_atomic_lifecycle(self):
        """Verify transferring patient to a new bed releases old bed to CLEANING and marks new bed OCCUPIED."""
        self.client.force_authenticate(user=self.doc_django_user)

        # Create Bed 2
        bed2 = Bed.objects.create(
            ward=self.ward,
            bed_number='ICU-02',
            status=BedStatus.AVAILABLE,
            daily_rate=Decimal('6000.00')
        )

        # Admit patient to Bed 1
        admission = InpatientAdmission.objects.create(
            admission_number=f"IPD-TRF-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient,
            bed=self.bed,
            admitting_doctor=self.doctor,
            branch=self.branch,
            initial_diagnosis='Cardiac Arrest Recovery',
            status=AdmissionStatus.ADMITTED
        )
        self.bed.status = BedStatus.OCCUPIED
        self.bed.save()

        # Perform Transfer to Bed 2
        transfer_payload = {
            'admission_id': str(admission.id),
            'to_bed_id': str(bed2.id),
            'transfer_reason': 'Step-down to specialized isolation telemetry unit',
            'clinical_handover_notes': 'Arterial line removed, vitals stable on room air'
        }
        res_trf = self.client.post('/api/v1/clinical/transfers/', transfer_payload, format='json')
        self.assertEqual(res_trf.status_code, status.HTTP_201_CREATED)

        # Verify old bed is released to CLEANING
        self.bed.refresh_from_db()
        self.assertEqual(self.bed.status, BedStatus.CLEANING)

        # Verify new bed is now OCCUPIED
        bed2.refresh_from_db()
        self.assertEqual(bed2.status, BedStatus.OCCUPIED)

        # Verify admission points to new bed
        admission.refresh_from_db()
        self.assertEqual(admission.bed.id, bed2.id)

        # Verify transfer history record
        self.assertTrue(PatientTransfer.objects.filter(admission=admission, to_bed=bed2).exists())

    def test_bed_turnover_actions(self):
        """Verify bed status changes from CLEANING -> AVAILABLE via BedTurnoverActionView."""
        self.client.force_authenticate(user=self.doc_django_user)

        self.bed.status = BedStatus.CLEANING
        self.bed.save()

        res = self.client.post(f'/api/v1/clinical/beds/{self.bed.id}/action/', {'action': 'MARK_CLEANED'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'AVAILABLE')

        self.bed.refresh_from_db()
        self.assertEqual(self.bed.status, BedStatus.AVAILABLE)

    def test_inpatient_running_bill_and_deposit(self):
        """Verify running bill calculation and recording advance deposits."""
        self.client.force_authenticate(user=self.doc_django_user)

        admission = InpatientAdmission.objects.create(
            admission_number=f"IPD-BILL-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient,
            bed=self.bed,
            admitting_doctor=self.doctor,
            branch=self.branch,
            initial_diagnosis='Severe Sepsis',
            status=AdmissionStatus.ADMITTED,
            admission_deposit=Decimal('5000.00')
        )

        # Fetch running bill
        res_bill = self.client.get(f'/api/v1/clinical/admissions/{admission.id}/running-bill/')
        self.assertEqual(res_bill.status_code, status.HTTP_200_OK)
        self.assertEqual(res_bill.data['admission_deposit_paid'], '5000.00')
        self.assertGreaterEqual(float(res_bill.data['estimated_bed_charges']), float(self.bed.daily_rate))

        # Record advance deposit
        res_dep = self.client.post(f'/api/v1/clinical/admissions/{admission.id}/running-bill/', {'amount': '10000.00'}, format='json')
        self.assertEqual(res_dep.status_code, status.HTTP_200_OK)
        self.assertEqual(res_dep.data['total_deposit'], '15000.00')

    def test_inpatient_discharge_clearances_and_bed_release(self):
        """Verify 4-point discharge clearance check and bed release to CLEANING."""
        self.client.force_authenticate(user=self.doc_django_user)

        admission = InpatientAdmission.objects.create(
            admission_number=f"IPD-DISC-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient,
            bed=self.bed,
            admitting_doctor=self.doctor,
            branch=self.branch,
            initial_diagnosis='Pneumonia',
            status=AdmissionStatus.ADMITTED
        )
        self.bed.status = BedStatus.OCCUPIED
        self.bed.save()

        # 1. Request Discharge -> AWAITING_DISCHARGE
        res_req = self.client.post(f'/api/v1/clinical/admissions/{admission.id}/action/', {
            'action': 'REQUEST_DISCHARGE',
            'discharge_condition': 'Afebrile, chest clear',
            'discharge_summary': 'Successfully treated with 5 days IV Ceftriaxone',
            'follow_up_instructions': 'Review in OPD after 10 days'
        }, format='json')
        self.assertEqual(res_req.status_code, status.HTTP_200_OK)
        self.assertEqual(res_req.data['status'], 'AWAITING_DISCHARGE')

        # 2. Attempting to finalize discharge without clearances must be REJECTED
        res_fail = self.client.post(f'/api/v1/clinical/admissions/{admission.id}/action/', {'action': 'FINALIZE_DISCHARGE'}, format='json')
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Pending clearances', res_fail.data['error'])

        # 3. Grant 4 clearances
        res_clr = self.client.post(f'/api/v1/clinical/admissions/{admission.id}/action/', {
            'action': 'DISCHARGE_CLEARANCE',
            'clinical_clearance': True,
            'nursing_clearance': True,
            'pharmacy_clearance': True,
            'billing_clearance': True
        }, format='json')
        self.assertEqual(res_clr.status_code, status.HTTP_200_OK)

        # 4. Finalize Discharge
        res_fin = self.client.post(f'/api/v1/clinical/admissions/{admission.id}/action/', {'action': 'FINALIZE_DISCHARGE'}, format='json')
        self.assertEqual(res_fin.status_code, status.HTTP_200_OK)
        self.assertEqual(res_fin.data['status'], 'DISCHARGED')

        # Verify bed is released to CLEANING
        self.bed.refresh_from_db()
        self.assertEqual(self.bed.status, BedStatus.CLEANING)

    def test_emergency_and_ipd_dashboard_stats_and_reports(self):
        """Verify real-time IPD dashboard stats and reports aggregation."""
        self.client.force_authenticate(user=self.doc_django_user)

        res_stats = self.client.get('/api/v1/clinical/ipd/dashboard-stats/')
        self.assertEqual(res_stats.status_code, status.HTTP_200_OK)
        self.assertIn('emergency_visits_today', res_stats.data)
        self.assertIn('current_inpatient_census', res_stats.data)
        self.assertIn('total_beds', res_stats.data)

        res_rep = self.client.get('/api/v1/clinical/ipd/reports/')
        self.assertEqual(res_rep.status_code, status.HTTP_200_OK)
        self.assertIn('ward_occupancy', res_rep.data)
        self.assertIn('readmissions', res_rep.data)


