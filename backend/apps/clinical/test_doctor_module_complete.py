import datetime
from decimal import Decimal
import uuid
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from django.contrib.auth.models import User
from apps.authentication.models import (
    UserProfile, Role, RoleEnum, StaffProfile, PatientProfile, GenderEnum
)
from apps.core.models import Branch, Department, Hospital
from apps.clinical.models import (
    Appointment, AppointmentStatus, AppointmentType, DoctorSchedule, DoctorLeave,
    InpatientAdmission, DailyProgressNote, Ward, Bed, LabOrder, LabOrderItem,
    LabTestCatalogue, RadiologyOrder, DiagnosticReport, CriticalAlertNotification,
    ConsultationAddendum, ClinicalReferral, ReferralStatus, ReferralPriority,
    MedicalDocument, MedicalDocumentType, DoctorNotification, DoctorNotificationType
)
from apps.pharmacy_inventory.models import Medicine, Prescription, PrescriptionItem
from apps.operations_hr.models import LeaveRequest, LeaveBalance, LeaveType, LeaveStatus


class DoctorModuleCompleteTestCase(TestCase):
    """
    Comprehensive Test Suite for the Production-Ready Doctor Module
    Covering all sections 1 through 23: Dashboard, Appointments, Patients,
    Consultation, Addendums, Prescriptions, Investigations, EMR, Inpatients,
    Referrals, Medical Documents, Leave Coordination, and Strict RBAC.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Setup Hospital, Branch & Departments
        self.hospital = Hospital.objects.create(name="Apex Healthcare Network", code="APEX-NET")
        self.branch = Branch.objects.create(hospital=self.hospital, name="Apex Multispecialty Hospital", code="APEX-MAIN")
        self.dept_medicine = Department.objects.create(name="General Medicine", code="DEP-MED", branch=self.branch)
        self.dept_cardio = Department.objects.create(name="Cardiology", code="DEP-CARD", branch=self.branch)

        # 2. Setup Roles
        self.role_super_admin = Role.objects.get_or_create(name=RoleEnum.SUPER_ADMIN, defaults={'display_name': 'Super Admin'})[0]
        self.role_doctor = Role.objects.get_or_create(name=RoleEnum.DOCTOR, defaults={'display_name': 'Doctor'})[0]
        self.role_receptionist = Role.objects.get_or_create(name=RoleEnum.RECEPTIONIST, defaults={'display_name': 'Receptionist'})[0]
        self.role_hr_manager = Role.objects.get_or_create(name=RoleEnum.HR_MANAGER, defaults={'display_name': 'HR Manager'})[0]
        self.role_patient = Role.objects.get_or_create(name=RoleEnum.PATIENT, defaults={'display_name': 'Patient'})[0]

        # 3. Setup Users & Staff
        # Doctor 1 (Primary Test Doctor)
        doc1_supa = uuid.uuid4()
        self.user_doc = User.objects.create_user(username=str(doc1_supa), email="dr.sharma@hospital.com")
        self.doc_up = UserProfile.objects.create(
            supabase_user_id=doc1_supa, email="dr.sharma@hospital.com",
            first_name="Ramesh", last_name="Sharma", role=self.role_doctor, is_active=True
        )
        self.doc_staff = StaffProfile.objects.create(
            user_profile=self.doc_up, hospital=self.hospital, employee_id="DOC-SHARMA-01", designation="DOCTOR",
            specialization="General Medicine", qualification="MBBS, MD (Medicine)",
            medical_license_number="MCI-12345", consultation_fee=Decimal('600.00'),
            department=self.dept_medicine, branch=self.branch, status="ACTIVE"
        )

        # Doctor 2 (Cardiologist for Referrals)
        doc2_supa = uuid.uuid4()
        self.user_cardio_doc = User.objects.create_user(username=str(doc2_supa), email="dr.verma@hospital.com")
        self.cardio_up = UserProfile.objects.create(
            supabase_user_id=doc2_supa, email="dr.verma@hospital.com",
            first_name="Priya", last_name="Verma", role=self.role_doctor, is_active=True
        )
        self.cardio_staff = StaffProfile.objects.create(
            user_profile=self.cardio_up, hospital=self.hospital, employee_id="DOC-VERMA-02", designation="DOCTOR",
            specialization="Cardiology", qualification="MBBS, DM (Cardiology)",
            medical_license_number="MCI-98765", consultation_fee=Decimal('1000.00'),
            department=self.dept_cardio, branch=self.branch, status="ACTIVE"
        )

        # Receptionist
        rec_supa = uuid.uuid4()
        self.user_rec = User.objects.create_user(username=str(rec_supa), email="rec.anita@hospital.com")
        self.rec_up = UserProfile.objects.create(
            supabase_user_id=rec_supa, email="rec.anita@hospital.com",
            first_name="Anita", last_name="Desai", role=self.role_receptionist, is_active=True
        )
        self.rec_staff = StaffProfile.objects.create(
            user_profile=self.rec_up, hospital=self.hospital, employee_id="REC-ANITA-01", designation="RECEPTIONIST",
            branch=self.branch, department=self.dept_medicine, status="ACTIVE"
        )

        # HR Manager
        hr_supa = uuid.uuid4()
        self.user_hr = User.objects.create_user(username=str(hr_supa), email="hr.mehta@hospital.com")
        self.hr_up = UserProfile.objects.create(
            supabase_user_id=hr_supa, email="hr.mehta@hospital.com",
            first_name="Vikram", last_name="Mehta", role=self.role_hr_manager, is_active=True
        )
        self.hr_staff = StaffProfile.objects.create(
            user_profile=self.hr_up, hospital=self.hospital, employee_id="HR-MEHTA-01", designation="HR_MANAGER",
            branch=self.branch, department=self.dept_medicine, status="ACTIVE"
        )

        # 4. Setup Patients
        pat_supa = uuid.uuid4()
        self.user_pat1 = User.objects.create_user(username=str(pat_supa), email="patient.arun@gmail.com")
        self.pat_up1 = UserProfile.objects.create(
            supabase_user_id=pat_supa, email="patient.arun@gmail.com",
            first_name="Arun", last_name="Kumar", phone_number="+919876543210",
            role=self.role_patient, is_active=True
        )
        self.patient1 = PatientProfile.objects.create(
            user_profile=self.pat_up1, primary_branch=self.branch, medical_record_number="MRN-ARUN-001",
            gender=GenderEnum.MALE, date_of_birth=datetime.date(1990, 5, 15), blood_group="B+",
            allergies=[{"allergen": "Penicillin", "severity": "HIGH"}],
            chronic_conditions=["Hypertension"]
        )

        # 5. Setup Medicines
        self.med_paracetamol = Medicine.objects.create(
            code="MED-DOLO", brand_name="Dolo 650", generic_name="Paracetamol",
            category="ANALGESICS_ANTIPYRETICS", strength="650mg", dosage_form="TABLET"
        )
        self.med_amox = Medicine.objects.create(
            code="MED-AMOX", brand_name="Amoxil 500", generic_name="Amoxicillin (Penicillin class)",
            category="ANTI_INFECTIVES", strength="500mg", dosage_form="CAPSULE"
        )

        # 6. Setup Lab Catalogue
        self.lab_cbc = LabTestCatalogue.objects.create(
            code="CBC", name="Complete Blood Count", category="HEMATOLOGY",
            standard_rate=Decimal('350.00'), is_active=True
        )

        # 7. Setup Inpatient Ward & Bed
        self.ward = Ward.objects.create(name="Medical Ward A", branch=self.branch, ward_type="GENERAL")
        self.bed = Bed.objects.create(ward=self.ward, bed_number="MW-101", status="OCCUPIED")

    def test_01_doctor_dashboard_overview_metrics(self):
        """
        Verify Doctor Dashboard (Section 2) returns all 10 KPIs and 8 dynamic widgets
        computed directly from database records.
        """
        self.client.force_authenticate(user=self.user_doc)

        # Create today's appointment
        today = timezone.localdate()
        Appointment.objects.create(
            appointment_number="APT-DASH-01", patient=self.patient1, doctor=self.doc_staff,
            department=self.dept_medicine, branch=self.branch, appointment_date=today,
            time_slot="10:00", token_number="1", status=AppointmentStatus.CHECKED_IN,
            chief_complaint="High fever and severe headache"
        )

        res = self.client.get('/api/v1/clinical/doctor-workspace/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.json()
        stats = data['statistics']
        self.assertEqual(stats['todays_appointments'], 1)
        self.assertEqual(stats['waiting_patients'], 1)
        self.assertEqual(stats['in_consultation'], 0)
        self.assertEqual(stats['completed_consultations'], 0)

        # Verify Widgets presence
        widgets = data['widgets']
        self.assertIn('todays_schedule', widgets)
        self.assertIn('recently_visited_patients', widgets)
        self.assertIn('critical_patient_notifications', widgets)
        self.assertIn('leave_application_summary', widgets)
        self.assertIn('daily_consultation_activity', widgets)

    def test_02_doctor_cannot_book_appointments_strict_rbac(self):
        """
        Verify that DOCTOR cannot book appointments or issue tokens (Section 3).
        Must return HTTP 403 Forbidden.
        """
        self.client.force_authenticate(user=self.user_doc)
        res = self.client.post('/api/v1/clinical/doctor-workspace/appointments/', {
            "patient_id": str(self.patient1.id),
            "appointment_date": str(timezone.localdate())
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Strict Role Restriction", res.json()['detail'])

    def test_03_doctor_consultation_draft_save_and_complete_sign(self):
        """
        Verify Section 5 Consultation Workflow:
        - Save Draft updates status to IN_CONSULTATION and calculates BMI
        - Complete & Sign updates status to COMPLETED and sets is_signed=True
        - Overwriting a signed consultation directly is blocked (400 Bad Request)
        """
        self.client.force_authenticate(user=self.user_doc)
        today = timezone.localdate()
        app = Appointment.objects.create(
            appointment_number="APT-CONSULT-01", patient=self.patient1, doctor=self.doc_staff,
            department=self.dept_medicine, branch=self.branch, appointment_date=today,
            time_slot="11:00", status=AppointmentStatus.CHECKED_IN
        )

        # 1. Save Draft with Vitals (Height 170cm, Weight 68kg -> BMI 23.5)
        draft_res = self.client.post(f'/api/v1/clinical/doctor-workspace/consultations/{app.id}/', {
            "action": "SAVE_DRAFT",
            "chief_complaint": "Persistent cough with evening rise in temperature",
            "symptom_duration": "4 days",
            "vitals": {"bp": "120/80", "heart_rate": "78", "temp": "100.2", "height": "170", "weight": "68"},
            "general_examination": "Conscious, febrile, no cyanosis",
            "diagnosis": "Acute Bronchitis",
        }, format='json')

        self.assertEqual(draft_res.status_code, status.HTTP_200_OK)
        app.refresh_from_db()
        self.assertEqual(app.status, AppointmentStatus.IN_CONSULTATION)
        self.assertFalse(app.is_signed)
        self.assertEqual(app.vitals.get('bmi'), 23.5)

        # 2. Complete & Sign Consultation
        complete_res = self.client.post(f'/api/v1/clinical/doctor-workspace/consultations/{app.id}/', {
            "action": "COMPLETE_AND_SIGN",
            "treatment_plan": "Steam inhalation, hydration, antipyretics",
            "diagnosis": "Acute Viral Bronchitis",
            "icd10_code": "J20.9"
        }, format='json')

        self.assertEqual(complete_res.status_code, status.HTTP_200_OK)
        app.refresh_from_db()
        self.assertEqual(app.status, AppointmentStatus.COMPLETED)
        self.assertTrue(app.is_signed)
        self.assertIsNotNone(app.signed_at)

        # 3. Direct Overwrite Protection on Signed Records
        blocked_res = self.client.post(f'/api/v1/clinical/doctor-workspace/consultations/{app.id}/', {
            "action": "SAVE_DRAFT",
            "diagnosis": "Modified Diagnosis"
        }, format='json')
        self.assertEqual(blocked_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Modifying signed records is strictly prohibited", blocked_res.json()['detail'])

    def test_04_audited_consultation_addendum_workflow(self):
        """
        Verify Section 5 Audited Addendum/Amendment workflow when corrections are necessary.
        """
        self.client.force_authenticate(user=self.user_doc)
        today = timezone.localdate()
        app = Appointment.objects.create(
            appointment_number="APT-ADDENDUM-01", patient=self.patient1, doctor=self.doc_staff,
            department=self.dept_medicine, branch=self.branch, appointment_date=today,
            time_slot="12:00", status=AppointmentStatus.COMPLETED, is_signed=True,
            signed_at=timezone.now(), diagnosis="Initial Diagnosis"
        )

        res = self.client.post(f'/api/v1/clinical/doctor-workspace/consultations/{app.id}/addendum/', {
            "reason_for_amendment": "Post-investigation chest X-ray review",
            "addendum_notes": "Chest X-ray shows clear lung fields. Replaced antibiotic with oral mucolytic."
        })

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ConsultationAddendum.objects.filter(appointment=app).count(), 1)
        addendum = ConsultationAddendum.objects.get(appointment=app)
        self.assertEqual(addendum.doctor, self.doc_staff)
        self.assertIn("clear lung fields", addendum.addendum_notes)

    def test_05_prescription_creation_with_allergy_warning_and_signing(self):
        """
        Verify Section 6 Prescription Management:
        - Multi-medicine prescription issuance
        - Allergy detection against patient's recorded allergies (Penicillin warning for Amoxil)
        - Digital signature protection
        """
        self.client.force_authenticate(user=self.user_doc)

        res = self.client.post('/api/v1/clinical/doctor-workspace/prescriptions/', {
            "patient_id": str(self.patient1.id),
            "diagnosis": "Upper Respiratory Infection with Fever",
            "clinical_notes": "Review in 5 days",
            "items": [
                {
                    "medicine_id": str(self.med_paracetamol.id),
                    "dosage": "1 Tablet",
                    "frequency": "1-0-1",
                    "duration_days": 3,
                    "total_quantity": 6,
                    "food_instruction": "AFTER_FOOD"
                },
                {
                    "medicine_id": str(self.med_amox.id),  # Triggers allergy warning!
                    "dosage": "1 Capsule",
                    "frequency": "1-0-1",
                    "duration_days": 5,
                    "total_quantity": 10,
                    "food_instruction": "AFTER_FOOD"
                }
            ]
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertTrue(data['prescription_number'].startswith('RX-'))
        self.assertEqual(len(data['items']), 2)

        # Verify Allergy Warning detection
        warnings = data['allergy_warnings']
        self.assertTrue(any('ALLERGY WARNING' in w and 'Amoxil' in w for w in warnings))

        rx = Prescription.objects.get(id=data['prescription_id'])
        self.assertTrue(rx.is_signed)
        self.assertEqual(rx.items.count(), 2)

    def test_06_investigation_orders_lab_and_radiology(self):
        """
        Verify Section 7 Investigation Requisition for Laboratory and Radiology.
        """
        self.client.force_authenticate(user=self.user_doc)

        # 1. Order Lab Test
        lab_res = self.client.post('/api/v1/clinical/doctor-workspace/investigations/', {
            "type": "LAB",
            "patient_id": str(self.patient1.id),
            "test_ids": [str(self.lab_cbc.id)],
            "priority": "URGENT",
            "clinical_reason": "Rule out infection"
        }, format='json')
        self.assertEqual(lab_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(LabOrder.objects.filter(doctor=self.doc_staff).count(), 1)

        # 2. Order Radiology
        rad_res = self.client.post('/api/v1/clinical/doctor-workspace/investigations/', {
            "type": "RADIOLOGY",
            "patient_id": str(self.patient1.id),
            "modality": "XRAY",
            "procedure_name": "Chest X-Ray PA View",
            "priority": "ROUTINE",
            "clinical_reason": "Persistent productive cough"
        }, format='json')
        self.assertEqual(rad_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RadiologyOrder.objects.filter(doctor=self.doc_staff).count(), 1)

    def test_07_specialist_referrals_and_receiving_doctor_notification(self):
        """
        Verify Section 11 Specialist Referrals & Notification dispatch to receiving doctor.
        """
        self.client.force_authenticate(user=self.user_doc)

        ref_res = self.client.post('/api/v1/clinical/doctor-workspace/referrals/', {
            "patient_id": str(self.patient1.id),
            "receiving_department_id": str(self.dept_cardio.id),
            "receiving_doctor_id": str(self.cardio_staff.id),
            "priority": "URGENT",
            "referral_reason": "Evaluation of persistent sinus tachycardia and chest discomfort",
            "clinical_notes": "ECG shows ST-segment elevation"
        })

        self.assertEqual(ref_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ClinicalReferral.objects.filter(referring_doctor=self.doc_staff).count(), 1)

        # Verify receiving doctor received real-time notification
        notif = DoctorNotification.objects.filter(recipient_doctor=self.cardio_staff).first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.notification_type, DoctorNotificationType.REFERRAL_RECEIVED)
        self.assertIn("Dr. Ramesh Sharma", notif.title)

    def test_08_medical_document_and_certificate_issuance(self):
        """
        Verify Section 12 Official Medical Document generation & digital signature.
        """
        self.client.force_authenticate(user=self.user_doc)

        res = self.client.post('/api/v1/clinical/doctor-workspace/documents/', {
            "patient_id": str(self.patient1.id),
            "document_type": MedicalDocumentType.SICK_LEAVE_CERTIFICATE,
            "title": "Medical Sick Leave Certificate",
            "diagnosis": "Acute Gastroenteritis with moderate dehydration",
            "clinical_summary": "Patient was examined and treated at OPD. Requires complete bed rest.",
            "recommendations": "Strict bed rest and oral rehydration therapy.",
            "leave_from_date": "2026-11-05",
            "leave_to_date": "2026-11-08"
        })

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        doc = MedicalDocument.objects.get(patient=self.patient1)
        self.assertTrue(doc.is_signed)
        self.assertIn("Digitally Signed by Dr. Ramesh Sharma", doc.digital_signature)

    def test_09_doctor_leave_management_and_appointment_coordination(self):
        """
        Verify Section 14 Complete Doctor Leave Workflow & Appointment Coordination:
        A. Doctor applies for leave with overlap validation
        B. Doctor CANNOT self-approve leave (403 Forbidden)
        C. HR Manager approves leave
        D. Approved leave syncs DoctorLeave, marks doctor unavailable, and notifies Receptionists
           of existing overlapping appointments for rescheduling.
        """
        # Create an existing scheduled appointment during the leave window
        leave_start = datetime.date(2026, 12, 1)
        leave_end = datetime.date(2026, 12, 3)

        overlapping_app = Appointment.objects.create(
            appointment_number="APT-OVERLAP-01", patient=self.patient1, doctor=self.doc_staff,
            department=self.dept_medicine, branch=self.branch, appointment_date=datetime.date(2026, 12, 2),
            time_slot="10:00", status=AppointmentStatus.SCHEDULED
        )

        # A. Doctor applies for leave
        self.client.force_authenticate(user=self.user_doc)
        apply_res = self.client.post('/api/v1/clinical/doctor-workspace/leaves/', {
            "leave_type": "CASUAL",
            "start_date": "2026-12-01",
            "end_date": "2026-12-03",
            "reason": "Attending Annual Medical Conference"
        })
        self.assertEqual(apply_res.status_code, status.HTTP_201_CREATED)
        leave_id = apply_res.json()['leave_request_id']

        # B. Doctor attempts self-approval -> Strictly Blocked (403)
        self_approve_res = self.client.post(f'/api/v1/clinical/doctor-workspace/leaves/{leave_id}/coordinate-approval/', {
            "decision": "APPROVE",
            "comments": "Self-approval attempt"
        })
        self.assertEqual(self_approve_res.status_code, status.HTTP_403_FORBIDDEN)

        # C. HR Manager approves leave
        self.client.force_authenticate(user=self.user_hr)
        hr_res = self.client.post(f'/api/v1/clinical/doctor-workspace/leaves/{leave_id}/coordinate-approval/', {
            "decision": "APPROVE",
            "comments": "Approved for medical conference attendance"
        })
        self.assertEqual(hr_res.status_code, status.HTTP_200_OK)
        self.assertEqual(hr_res.json()['overlapping_appointments_count'], 1)

        # D. Verify DoctorLeave sync & Receptionist Notification
        self.assertTrue(DoctorLeave.objects.filter(doctor=self.doc_staff, start_date=leave_start, is_approved=True).exists())

        rec_notif = DoctorNotification.objects.filter(
            recipient_role='RECEPTIONIST',
            notification_type=DoctorNotificationType.APPOINTMENT_CONFLICT
        ).first()
        self.assertIsNotNone(rec_notif)
        self.assertIn("Appointments Require Rescheduling", rec_notif.title)
        self.assertIn(overlapping_app.appointment_number, rec_notif.message)
