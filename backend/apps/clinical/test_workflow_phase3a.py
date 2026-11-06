import uuid
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import UserProfile, Role, RoleEnum, StaffProfile, PatientProfile

User = get_user_model()
from apps.clinical.models import (
    Appointment, AppointmentStatus, AppointmentType, DoctorSchedule,
    DoctorNotification, DoctorNotificationType,
    LabTestCatalogue, LabOrder, LabOrderStatus, LabOrderItem, LabItemStatus,
    RadiologyOrder, RadiologyStatus, ModalityEnum,
    DiagnosticReport, DiagnosticReportStatus
)
from apps.pharmacy_inventory.models import Medicine, MedicineBatch, Prescription, PrescriptionItem, DispenseRecord
from apps.billing_finance.models import Invoice, InvoiceItem, InvoiceStatus, ChargeItemType


class WorkflowPhase3AIntegrationTest(TestCase):
    """
    End-to-End Workflow Integration Test for Phase 3A:
    Patient / Receptionist -> Doctor Workspace -> Lab / Radiology -> Pharmacy -> Billing & Patient Portal
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Base Hospital Structure
        self.hospital = Hospital.objects.create(name="Aura Central Multi-Specialty Hospital")
        self.branch = Branch.objects.create(hospital=self.hospital, name="Main Campus", code="MC-01")
        self.dept = Department.objects.create(branch=self.branch, name="Cardiology", code="CARD")

        # 2. Roles
        self.doctor_role = Role.objects.create(name=RoleEnum.DOCTOR, description="Doctor")
        self.receptionist_role = Role.objects.create(name=RoleEnum.RECEPTIONIST, description="Receptionist")
        self.lab_role = Role.objects.create(name=RoleEnum.LAB_TECHNICIAN, description="Lab Tech")
        self.rad_role = Role.objects.create(name=RoleEnum.RADIOLOGY_TECHNICIAN, description="Radiology Tech")
        self.pharm_role = Role.objects.create(name=RoleEnum.PHARMACIST, description="Pharmacist")
        self.patient_role = Role.objects.create(name=RoleEnum.PATIENT, description="Patient")

        # 3. User & Staff Profiles
        # Doctor
        self.doc_uid = str(uuid.uuid4())
        self.doc_auth = User.objects.create_user(username=self.doc_uid, email="doctor.workflow@aura.test")
        self.doc_user = UserProfile.objects.create(
            supabase_user_id=self.doc_uid, email="doctor.workflow@aura.test", first_name="Ananya", last_name="Sharma", role=self.doctor_role
        )
        self.doc_staff = StaffProfile.objects.create(
            user_profile=self.doc_user, hospital=self.hospital, branch=self.branch, department=self.dept,
            employee_id="DOC-9001", designation="Senior Cardiologist", consultation_fee=Decimal('500.00'), status='ACTIVE'
        )

        # Receptionist
        self.rec_uid = str(uuid.uuid4())
        self.rec_auth = User.objects.create_user(username=self.rec_uid, email="reception.workflow@aura.test")
        self.rec_user = UserProfile.objects.create(
            supabase_user_id=self.rec_uid, email="reception.workflow@aura.test", first_name="Ramesh", last_name="Verma", role=self.receptionist_role
        )
        self.rec_staff = StaffProfile.objects.create(
            user_profile=self.rec_user, hospital=self.hospital, branch=self.branch, employee_id="REC-9001", designation="Front Desk Lead", status='ACTIVE'
        )

        # Lab Tech
        self.lab_uid = str(uuid.uuid4())
        self.lab_auth = User.objects.create_user(username=self.lab_uid, email="lab.workflow@aura.test")
        self.lab_user = UserProfile.objects.create(
            supabase_user_id=self.lab_uid, email="lab.workflow@aura.test", first_name="Sunita", last_name="Rao", role=self.lab_role
        )
        self.lab_staff = StaffProfile.objects.create(
            user_profile=self.lab_user, hospital=self.hospital, branch=self.branch, employee_id="LAB-9001", designation="Senior Lab Technologist", status='ACTIVE'
        )

        # Pharmacist
        self.pharm_uid = str(uuid.uuid4())
        self.pharm_auth = User.objects.create_user(username=self.pharm_uid, email="pharm.workflow@aura.test")
        self.pharm_user = UserProfile.objects.create(
            supabase_user_id=self.pharm_uid, email="pharm.workflow@aura.test", first_name="Amit", last_name="Patel", role=self.pharm_role
        )
        self.pharm_staff = StaffProfile.objects.create(
            user_profile=self.pharm_user, hospital=self.hospital, branch=self.branch, employee_id="PHARM-9001", designation="Chief Pharmacist", status='ACTIVE'
        )

        # Patient
        self.pat_uid = str(uuid.uuid4())
        self.pat_auth = User.objects.create_user(username=self.pat_uid, email="patient.workflow@aura.test")
        self.pat_user = UserProfile.objects.create(
            supabase_user_id=self.pat_uid, email="patient.workflow@aura.test", first_name="Rajesh", last_name="Kumar", role=self.patient_role
        )
        self.pat_profile = PatientProfile.objects.create(
            user_profile=self.pat_user, primary_branch=self.branch, medical_record_number="MRN-WF-1001", gender="MALE", date_of_birth="1985-05-15"
        )

        # 4. Catalogues & Formularies
        self.lab_test = LabTestCatalogue.objects.create(
            code="LIPID_01", name="Lipid Profile Complete", category="BIOCHEMISTRY", standard_rate=Decimal('650.00')
        )
        self.med = Medicine.objects.create(
            code="ATORT5", brand_name="Atorvastatin", generic_name="Atorvastatin Calcium",
            dosage_form="TABLET", strength="10mg"
        )
        self.batch = MedicineBatch.objects.create(
            medicine=self.med, branch=self.branch, batch_number="BATCH-WF-001",
            expiry_date="2027-12-31", quantity_in_stock=100, unit_selling_price=Decimal('15.00')
        )

    def test_full_clinical_pipeline_workflow(self):
        """
        Verify real-time workflow across Receptionist, Doctor, Lab, Pharmacy, and Patient accounts.
        """
        # Step A: Receptionist creates Appointment & checks in patient
        self.client.force_authenticate(user=self.rec_auth)
        appt = Appointment.objects.create(
            appointment_number="APT-WF-001",
            patient=self.pat_profile,
            doctor=self.doc_staff,
            department=self.dept,
            branch=self.branch,
            appointment_date=timezone.localdate(),
            time_slot="10:00 - 10:15",
            token_number="Token #1",
            status=AppointmentStatus.SCHEDULED
        )

        # Check-in via OPD queue action
        res = self.client.post(f"/api/v1/clinical/opd/queue/{appt.id}/action/", {"action": "CHECK_IN"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        appt.refresh_from_db()
        self.assertEqual(appt.status, AppointmentStatus.CHECKED_IN)

        # Verify Doctor received PATIENT_CHECKED_IN notification
        doc_notifs = DoctorNotification.objects.filter(
            recipient_doctor=self.doc_staff,
            notification_type=DoctorNotificationType.PATIENT_CHECKED_IN
        )
        self.assertTrue(doc_notifs.exists())
        self.assertIn("Rajesh Kumar", doc_notifs.first().title)

        # Step B: Doctor conducts consultation encounter
        self.client.force_authenticate(user=self.doc_auth)
        encounter_payload = {
            "chief_complaint": "Chest tightness and dyspnea on exertion",
            "diagnosis": "Stable Angina, Hyperlipidemia",
            "treatment_plan": "Start statin, complete lipid panel and chest X-ray",
            "prescriptions": [{
                "medicine_id": str(self.med.id),
                "dosage": "1 Tablet",
                "frequency": "0-0-1",
                "duration_days": 10,
                "total_quantity": 10,
                "instructions": "At bedtime"
            }],
            "lab_test_ids": [str(self.lab_test.id)],
            "radiology_orders": [{
                "modality": "X_RAY",
                "study_name": "Chest X-Ray PA View",
                "clinical_indication": "Assess cardiomegaly",
                "priority": "ROUTINE"
            }]
        }
        enc_res = self.client.post(f"/api/v1/clinical/appointments/{appt.id}/encounter/", encounter_payload, format="json")
        self.assertEqual(enc_res.status_code, status.HTTP_200_OK)

        # Verify encounter created prescription, lab order, and radiology order
        prescription = Prescription.objects.filter(patient=self.pat_profile).first()
        self.assertIsNotNone(prescription)
        self.assertEqual(prescription.appointment, appt)

        lab_order = LabOrder.objects.filter(patient=self.pat_profile).first()
        self.assertIsNotNone(lab_order)
        self.assertEqual(lab_order.appointment, appt)

        rad_order = RadiologyOrder.objects.filter(patient=self.pat_profile).first()
        self.assertIsNotNone(rad_order)
        self.assertEqual(rad_order.appointment, appt)

        # Verify consultation invoice exists and includes lab and radiology items
        appt.refresh_from_db()
        inv = appt.invoice
        self.assertIsNotNone(inv)
        self.assertTrue(inv.items.filter(item_type=ChargeItemType.CONSULTATION).exists())
        self.assertTrue(inv.items.filter(item_type=ChargeItemType.LAB_TEST).exists())
        self.assertTrue(inv.items.filter(item_type=ChargeItemType.RADIOLOGY).exists())

        # Step C: Lab Technician processes order and releases report
        self.client.force_authenticate(user=self.lab_auth)
        lab_order.status = LabOrderStatus.APPROVED
        lab_order.save()

        rel_res = self.client.post(f"/api/v1/clinical/lab/orders/{lab_order.id}/release/")
        self.assertEqual(rel_res.status_code, status.HTTP_200_OK)
        lab_order.refresh_from_db()
        self.assertEqual(lab_order.status, LabOrderStatus.RELEASED)

        # Verify Doctor received LAB_REPORT_AVAILABLE notification
        lab_notifs = DoctorNotification.objects.filter(
            recipient_doctor=self.doc_staff,
            notification_type=DoctorNotificationType.LAB_REPORT_AVAILABLE
        )
        self.assertTrue(lab_notifs.exists())

        # Step D: Patient accesses authorized report
        self.client.force_authenticate(user=self.pat_auth)
        rep_res = self.client.get(f"/api/v1/clinical/lab/reports/{lab_order.id}/detail/")
        self.assertEqual(rep_res.status_code, status.HTTP_200_OK)
        self.assertEqual(rep_res.data['patient']['mrn'], "MRN-WF-1001")

        # Step E: Pharmacist dispenses medications
        self.client.force_authenticate(user=self.pharm_auth)
        dispense_payload = {
            "patient_id": str(self.pat_profile.id),
            "prescription_id": str(prescription.id),
            "items": [{
                "batch_id": str(self.batch.id),
                "quantity": 10
            }]
        }
        disp_res = self.client.post("/api/v1/pharmacy/dispense/", dispense_payload, format="json")
        self.assertEqual(disp_res.status_code, status.HTTP_201_CREATED)

        # Stock deducted
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity_in_stock, 90)

        # Prescription marked dispensed
        prescription.refresh_from_db()
        self.assertTrue(prescription.is_dispensed)

        # Invoice updated with pharmacy dispensation line item
        inv.refresh_from_db()
        self.assertTrue(inv.items.filter(item_type=ChargeItemType.PHARMACY).exists())
        pharm_item = inv.items.filter(item_type=ChargeItemType.PHARMACY).first()
        self.assertEqual(pharm_item.quantity, 10)
        self.assertEqual(pharm_item.unit_price, Decimal('15.00'))

        # Step F: Patient sees their active prescription as dispensed
        self.client.force_authenticate(user=self.pat_auth)
        rx_res = self.client.get("/api/v1/pharmacy/prescriptions/")
        self.assertEqual(rx_res.status_code, status.HTTP_200_OK)
        self.assertTrue(any(p['id'] == str(prescription.id) and p['is_dispensed'] is True for p in rx_res.data))
