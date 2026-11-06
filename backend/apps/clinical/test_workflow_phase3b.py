import uuid
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import UserProfile, Role, RoleEnum, StaffProfile, PatientProfile
from apps.clinical.models import (
    Appointment, AppointmentStatus,
    Ward, WardType, Bed, BedStatus,
    InpatientAdmission, AdmissionStatus, DailyProgressNote,
    DoctorNotification, DoctorNotificationType
)
from apps.billing_finance.models import (
    Invoice, InvoiceItem, InvoiceStatus, ChargeItemType,
    InsuranceProvider, PatientInsuranceCoverage, PreAuthorizationRequest, PreAuthStatus,
    InsuranceClaim, ClaimStatus, ClaimSettlement
)

User = get_user_model()


class WorkflowPhase3BIntegrationTest(TestCase):
    """
    End-to-End Workflow Integration Test for Phase 3B:
    Doctor Consultation -> Admission Request -> Bed Allocation -> Nursing Care ->
    Daily Inpatient Billing -> 4-Point Discharge Clearance -> Final Bill & Bed Turnover ->
    Insurance Pre-Auth & Claim Settlement.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Base Hospital Structure
        self.hospital = Hospital.objects.create(name="Aura Central Multi-Specialty Hospital")
        self.branch = Branch.objects.create(hospital=self.hospital, name="Main Campus", code="MC-01")
        self.dept = Department.objects.create(branch=self.branch, name="Cardiology", code="CARD")

        # 2. Roles
        self.doctor_role = Role.objects.create(name=RoleEnum.DOCTOR, description="Doctor")
        self.nurse_role = Role.objects.create(name=RoleEnum.NURSE, description="Nurse")
        self.cashier_role = Role.objects.create(name=RoleEnum.CASHIER, description="Cashier")
        self.insurance_role = Role.objects.create(name=RoleEnum.INSURANCE_COORDINATOR, description="Insurance Coordinator")
        self.patient_role = Role.objects.create(name=RoleEnum.PATIENT, description="Patient")

        # 3. Staff & Patient Users
        # Doctor
        self.doc_uid = str(uuid.uuid4())
        self.doc_auth = User.objects.create_user(username=self.doc_uid, email="doctor.ipd@aura.test")
        self.doc_user = UserProfile.objects.create(
            supabase_user_id=self.doc_uid, email="doctor.ipd@aura.test", first_name="Vikram", last_name="Seth", role=self.doctor_role
        )
        self.doc_staff = StaffProfile.objects.create(
            user_profile=self.doc_user, hospital=self.hospital, branch=self.branch, department=self.dept,
            employee_id="DOC-9002", designation="Consultant Surgeon", consultation_fee=Decimal('600.00'), status='ACTIVE'
        )

        # Nurse
        self.nurse_uid = str(uuid.uuid4())
        self.nurse_auth = User.objects.create_user(username=self.nurse_uid, email="nurse.ipd@aura.test")
        self.nurse_user = UserProfile.objects.create(
            supabase_user_id=self.nurse_uid, email="nurse.ipd@aura.test", first_name="Kavita", last_name="Nair", role=self.nurse_role
        )
        self.nurse_staff = StaffProfile.objects.create(
            user_profile=self.nurse_user, hospital=self.hospital, branch=self.branch, department=self.dept,
            employee_id="NUR-9001", designation="Ward Charge Nurse", status='ACTIVE'
        )

        # Cashier
        self.cashier_uid = str(uuid.uuid4())
        self.cashier_auth = User.objects.create_user(username=self.cashier_uid, email="cashier.ipd@aura.test")
        self.cashier_user = UserProfile.objects.create(
            supabase_user_id=self.cashier_uid, email="cashier.ipd@aura.test", first_name="Deepak", last_name="Sharma", role=self.cashier_role
        )
        self.cashier_staff = StaffProfile.objects.create(
            user_profile=self.cashier_user, hospital=self.hospital, branch=self.branch,
            employee_id="CSH-9001", designation="Senior Cashier", status='ACTIVE'
        )

        # Insurance Coordinator
        self.ins_uid = str(uuid.uuid4())
        self.ins_auth = User.objects.create_user(username=self.ins_uid, email="insurance.ipd@aura.test")
        self.ins_user = UserProfile.objects.create(
            supabase_user_id=self.ins_uid, email="insurance.ipd@aura.test", first_name="Pooja", last_name="Mehta", role=self.insurance_role
        )
        self.ins_staff = StaffProfile.objects.create(
            user_profile=self.ins_user, hospital=self.hospital, branch=self.branch,
            employee_id="INS-9001", designation="TPA Claim Executive", status='ACTIVE'
        )

        # Patient
        self.pat_uid = str(uuid.uuid4())
        self.pat_auth = User.objects.create_user(username=self.pat_uid, email="patient.ipd@aura.test")
        self.pat_user = UserProfile.objects.create(
            supabase_user_id=self.pat_uid, email="patient.ipd@aura.test", first_name="Sanjay", last_name="Dutta", role=self.patient_role
        )
        self.pat_profile = PatientProfile.objects.create(
            user_profile=self.pat_user, primary_branch=self.branch, medical_record_number="MRN-WF-2002",
            gender="MALE", date_of_birth="1978-11-20"
        )

        # 4. Ward & Bed Setup
        self.ward = Ward.objects.create(
            branch=self.branch, department=self.dept, name="Cardiac ICU Ward",
            ward_type=WardType.ICU, floor="3rd Floor", total_beds=5
        )
        self.bed = Bed.objects.create(
            ward=self.ward, bed_number="BED-301", status=BedStatus.AVAILABLE, daily_rate=Decimal('2500.00')
        )

        # 5. Insurance Provider Setup
        self.tpa = InsuranceProvider.objects.create(
            name="Star Health & Allied Insurance", code="STAR_HLTH",
            contact_person="Ramesh TPA Desk", phone="+91 9876543210", is_active=True
        )
        self.coverage = PatientInsuranceCoverage.objects.create(
            patient=self.pat_profile,
            provider=self.tpa,
            policy_number="STAR-POL-88992",
            sum_insured=Decimal('500000.00'),
            is_verified=True,
            status="ACTIVE"
        )

    def test_full_inpatient_admission_discharge_and_insurance_workflow(self):
        """
        Verify the complete inpatient admission, bed allocation, running billing,
        4-point discharge clearance, bed turnover, and insurance claims workflow.
        """
        # Step 1: Doctor conducts OPD consultation and recommends Inpatient Admission
        self.client.force_authenticate(user=self.doc_auth)
        appt = Appointment.objects.create(
            appointment_number="APT-IPD-001",
            patient=self.pat_profile,
            doctor=self.doc_staff,
            department=self.dept,
            branch=self.branch,
            appointment_date=timezone.localdate(),
            time_slot="11:00 - 11:15",
            token_number="Token #3",
            status=AppointmentStatus.IN_CONSULTATION
        )

        enc_payload = {
            "chief_complaint": "Acute anterior wall STEMI, unstable vitals",
            "diagnosis": "Acute Myocardial Infarction",
            "treatment_plan": "Emergency ICU admission, cardiac monitoring, heparin protocol",
            "recommend_admission": True,
            "admission_priority": "STAT_EMERGENCY",
            "requested_ward_type": "ICU",
            "admission_diagnosis": "Acute Myocardial Infarction - ICU Monitoring Required"
        }
        res_enc = self.client.post(f"/api/v1/clinical/appointments/{appt.id}/encounter/", enc_payload, format="json")
        self.assertEqual(res_enc.status_code, status.HTTP_200_OK)

        # Verify admission request record created in REQUESTED state
        admission = InpatientAdmission.objects.filter(patient=self.pat_profile).first()
        self.assertIsNotNone(admission)
        self.assertEqual(admission.status, AdmissionStatus.REQUESTED)
        self.assertEqual(admission.priority, "STAT_EMERGENCY")

        # Step 2: Nurse / Admission Desk allocates Bed to Patient
        self.client.force_authenticate(user=self.nurse_auth)
        res_alloc = self.client.post(f"/api/v1/clinical/admissions/{admission.id}/action/", {
            "action": "ALLOCATE_BED",
            "bed_id": str(self.bed.id)
        }, format="json")
        self.assertEqual(res_alloc.status_code, status.HTTP_200_OK)

        # Verify bed is OCCUPIED, admission is ADMITTED, and running IPD bill initialized
        self.bed.refresh_from_db()
        admission.refresh_from_db()
        self.assertEqual(self.bed.status, BedStatus.OCCUPIED)
        self.assertEqual(admission.status, AdmissionStatus.ADMITTED)
        self.assertEqual(admission.bed, self.bed)
        self.assertIsNotNone(admission.invoice)
        self.assertEqual(admission.invoice.encounter_type, "IPD")

        # Verify Doctor received INPATIENT_ALERT notification
        doc_notifs = DoctorNotification.objects.filter(
            recipient_doctor=self.doc_staff,
            notification_type=DoctorNotificationType.INPATIENT_ALERT
        )
        self.assertTrue(doc_notifs.exists())

        # Step 3: Ward Nurse records Daily Progress Note
        note = DailyProgressNote.objects.create(
            admission=admission,
            recorded_by=self.nurse_staff,
            clinical_notes="Patient conscious, chest pain reduced from 8/10 to 2/10. Hemodynamically stable post-heparinization.",
            vitals={"bp": "120/80", "hr": 74, "spo2": 98},
            treatment_plan="Continue telemetry monitoring, repeat ECG at 06:00"
        )
        self.assertIsNotNone(note.id)

        # Step 4: Verify Inpatient Running Bill
        res_bill = self.client.get(f"/api/v1/clinical/admissions/{admission.id}/running-bill/")
        self.assertEqual(res_bill.status_code, status.HTTP_200_OK)
        self.assertEqual(res_bill.data['bed_number'], "BED-301")
        self.assertEqual(res_bill.data['ward_name'], "Cardiac ICU Ward")
        self.assertGreaterEqual(Decimal(res_bill.data['running_days']), Decimal('1'))

        # Step 5: Insurance Coordinator files Pre-Authorization Request
        self.client.force_authenticate(user=self.ins_auth)
        pre_auth = PreAuthorizationRequest.objects.create(
            request_number=f"PA-{uuid.uuid4().hex[:6].upper()}",
            patient=self.pat_profile,
            coverage=self.coverage,
            admission=admission,
            estimated_amount=Decimal('50000.00'),
            requested_amount=Decimal('50000.00'),
            status=PreAuthStatus.SUBMITTED,
            requested_by=self.ins_staff
        )

        # Adjudicate pre-authorization to APPROVED
        res_pa_adj = self.client.post(f"/api/v1/billing-finance/pre-authorizations/{pre_auth.id}/adjudicate/", {
            "decision": "APPROVED",
            "approved_amount": "45000.00",
            "approval_reference": "TPA-APPR-998811"
        }, format="json")
        self.assertEqual(res_pa_adj.status_code, status.HTTP_200_OK)
        pre_auth.refresh_from_db()
        self.assertEqual(pre_auth.status, PreAuthStatus.APPROVED)
        self.assertEqual(pre_auth.approved_amount, Decimal('45000.00'))

        # Step 6: Doctor initiates Discharge Workflow
        self.client.force_authenticate(user=self.doc_auth)
        res_req_disc = self.client.post(f"/api/v1/clinical/admissions/{admission.id}/action/", {
            "action": "REQUEST_DISCHARGE",
            "discharge_condition": "Recovered & Stable",
            "discharge_summary": "Successful ICU management, vitals normal",
            "follow_up_instructions": "Review in Cardiology OPD after 1 week"
        }, format="json")
        self.assertEqual(res_req_disc.status_code, status.HTTP_200_OK)
        admission.refresh_from_db()
        self.assertEqual(admission.status, AdmissionStatus.AWAITING_DISCHARGE)

        # Step 7: 4-Point Multi-Departmental Discharge Clearances
        # Clinical & Nursing Clearances
        self.client.force_authenticate(user=self.nurse_auth)
        self.client.post(f"/api/v1/clinical/admissions/{admission.id}/action/", {
            "action": "DISCHARGE_CLEARANCE",
            "clinical_clearance": True,
            "nursing_clearance": True,
            "pharmacy_clearance": True,
            "billing_clearance": True
        }, format="json")

        admission.refresh_from_db()
        self.assertTrue(admission.clinical_clearance)
        self.assertTrue(admission.nursing_clearance)
        self.assertTrue(admission.pharmacy_clearance)
        self.assertTrue(admission.billing_clearance)

        # Step 8: Finalize Discharge -> Bed moves to CLEANING, bed charges attached to invoice
        res_fin_disc = self.client.post(f"/api/v1/clinical/admissions/{admission.id}/action/", {
            "action": "FINALIZE_DISCHARGE"
        }, format="json")
        self.assertEqual(res_fin_disc.status_code, status.HTTP_200_OK)

        admission.refresh_from_db()
        self.bed.refresh_from_db()
        self.assertEqual(admission.status, AdmissionStatus.DISCHARGED)
        self.assertEqual(self.bed.status, BedStatus.CLEANING)

        # Verify bed charge item attached to invoice
        inv = admission.invoice
        inv.refresh_from_db()
        self.assertTrue(inv.items.filter(item_type=ChargeItemType.BED_CHARGE).exists())
        self.assertGreater(inv.total_amount, Decimal('0.00'))

        # Step 9: Housekeeping completes bed cleaning -> Bed returns to AVAILABLE
        res_turnover = self.client.post(f"/api/v1/clinical/beds/{self.bed.id}/action/", {
            "action": "MARK_CLEANED"
        }, format="json")
        self.assertEqual(res_turnover.status_code, status.HTTP_200_OK)
        self.bed.refresh_from_db()
        self.assertEqual(self.bed.status, BedStatus.AVAILABLE)

        # Step 10: Insurance Coordinator files final claim and records settlement
        self.client.force_authenticate(user=self.ins_auth)
        claim = InsuranceClaim.objects.create(
            claim_number=f"CLM-{uuid.uuid4().hex[:6].upper()}",
            patient=self.pat_profile,
            invoice=inv,
            provider=self.tpa,
            coverage=self.coverage,
            pre_auth=pre_auth,
            admission=admission,
            policy_number=self.coverage.policy_number,
            claim_amount=inv.total_amount,
            status=ClaimStatus.SUBMITTED,
            assigned_staff=self.ins_staff
        )

        # Insurer approves claim
        self.client.post(f"/api/v1/billing-finance/claims/{claim.id}/adjudicate/", {
            "decision": "APPROVED",
            "approved_amount": str(inv.total_amount)
        }, format="json")
        claim.refresh_from_db()
        self.assertEqual(claim.status, ClaimStatus.APPROVED)

        # Record settlement disbursement
        initial_paid = inv.paid_amount
        settlement_payload = {
            "claim": str(claim.id),
            "settlement_reference": "SETTL-STAR-998811",
            "settlement_date": str(timezone.localdate()),
            "amount_settled": str(inv.total_amount),
            "bank_utr": "UTR-ICICI-998877",
            "disallowed_amount": "0.00",
            "reconciliation_notes": "Full cashless settlement received from Star Health"
        }
        res_set = self.client.post("/api/v1/billing-finance/claim-settlements/", settlement_payload, format="json")
        self.assertEqual(res_set.status_code, status.HTTP_201_CREATED)

        # Verify claim and patient invoice are settled
        claim.refresh_from_db()
        inv.refresh_from_db()
        self.assertEqual(claim.status, ClaimStatus.SETTLED)
        self.assertEqual(inv.paid_amount, initial_paid + Decimal(str(settlement_payload['amount_settled'])))
        self.assertEqual(inv.balance_amount, Decimal('0.00'))
        self.assertEqual(inv.status, InvoiceStatus.PAID)
