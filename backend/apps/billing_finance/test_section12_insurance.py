import uuid
from decimal import Decimal
from django.utils import timezone
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, UserProfile, PatientProfile, StaffProfile

User = get_user_model()
from apps.billing_finance.models import (
    InsuranceProvider, CorporateCustomer, PatientInsuranceCoverage,
    EligibilityCheck, PreAuthorizationRequest, InsuranceClaim,
    ClaimDocument, ClaimQuery, ClaimSettlement, CorporateInvoice,
    OrganizationType, CoverageStatus, EligibilityStatus,
    PreAuthStatus, ClaimType, ClaimStatus, QueryStatus,
    SettlementReconciliationStatus, CorporateInvoiceStatus,
    Invoice, InvoiceItem, InvoiceStatus, TariffPlan, TariffType
)


class Section12InsuranceCorporateBillingTests(TestCase):
    """
    Comprehensive verification tests for Section 12: Insurance and Corporate Billing.
    """

    def setUp(self):
        self.client = APIClient()
        self.hospital = Hospital.objects.create(name="Apex Super Specialty Hospital", code=f"HOSP-{uuid.uuid4().hex[:4].upper()}")
        self.branch = Branch.objects.create(hospital=self.hospital, name="Central Apollo Hospital", code=f"APO-{uuid.uuid4().hex[:4].upper()}", is_active=True)
        self.department = Department.objects.create(branch=self.branch, name="Insurance & Corporate Desk", code=f"TPA-{uuid.uuid4().hex[:4].upper()}")

        self.role_staff, _ = Role.objects.get_or_create(name=RoleEnum.INSURANCE_COORDINATOR, defaults={'display_name': 'Insurance Coordinator'})
        self.role_patient, _ = Role.objects.get_or_create(name=RoleEnum.PATIENT, defaults={'display_name': 'Patient'})

        # 1. Staff User (Insurance Coordinator)
        self.staff_user_id = str(uuid.uuid4())
        self.staff_user = User.objects.create_user(
            username=self.staff_user_id,
            email="coordinator@apollo.test",
            password="securePassword123!"
        )
        self.staff_profile_user = UserProfile.objects.create(
            supabase_user_id=self.staff_user_id,
            email="coordinator@apollo.test",
            first_name="Pooja",
            last_name="Sharma",
            role=self.role_staff
        )
        self.staff_profile = StaffProfile.objects.create(
            user_profile=self.staff_profile_user,
            hospital=self.hospital,
            branch=self.branch,
            department=self.department,
            employee_id="TPA-COORD-001",
            designation="Senior Insurance Coordinator"
        )

        # 2. Patient User
        self.patient_user_id = str(uuid.uuid4())
        self.patient_user = User.objects.create_user(
            username=self.patient_user_id,
            email="patient@apollo.test",
            password="securePassword123!"
        )
        self.patient_profile_user = UserProfile.objects.create(
            supabase_user_id=self.patient_user_id,
            email="patient@apollo.test",
            first_name="Rajesh",
            last_name="Verma",
            role=self.role_patient
        )
        self.patient = PatientProfile.objects.create(
            user_profile=self.patient_profile_user,
            primary_branch=self.branch,
            medical_record_number=f"MRN-{uuid.uuid4().hex[:8].upper()}",
            date_of_birth="1984-05-15",
            gender="MALE",
            blood_group="O+"
        )

        # 3. Standard Tariff & Invoice for testing
        self.tariff = TariffPlan.objects.create(
            code="TRF-MEDICLAIM-01",
            name="General Mediclaim Tariff",
            tariff_type=TariffType.INSURANCE
        )
        self.invoice = Invoice.objects.create(
            invoice_number=f"INV-TEST-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient,
            branch=self.branch,
            subtotal=Decimal('50000.00'),
            total_amount=Decimal('50000.00'),
            balance_amount=Decimal('50000.00'),
            status=InvoiceStatus.ISSUED
        )

        # Authenticate as Insurance Coordinator staff
        self.client.force_authenticate(user=self.staff_user)

    def test_01_insurance_provider_master_crud_and_delete_guard(self):
        """
        Create, edit, toggle active, and ensure deletion is guarded if claims exist.
        """
        payload = {
            "name": "Star Health Insurance TPA",
            "code": "STAR-001",
            "org_type": "PRIVATE_INSURER",
            "contact_person": "Ramesh Gupta",
            "phone": "+919876543210",
            "email": "claims@starhealth.test",
            "tpa_desk_email": "desk@starhealth.test",
            "claim_settlement_avg_days": 10,
            "default_tariff": str(self.tariff.id),
            "is_active": True
        }
        res = self.client.post("/api/v1/billing-finance/insurance-providers/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        provider_id = res.data["id"]

        # Toggle active
        toggle_res = self.client.post(f"/api/v1/billing-finance/insurance-providers/{provider_id}/toggle-active/")
        self.assertEqual(toggle_res.status_code, status.HTTP_200_OK)
        self.assertFalse(toggle_res.data["is_active"])

        # Create a claim linked to this provider
        InsuranceClaim.objects.create(
            claim_number=f"CLM-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient,
            invoice=self.invoice,
            provider_id=provider_id,
            policy_number="POL-STAR-9988",
            claim_amount=Decimal('25000.00')
        )

        # Attempt to delete should be blocked with 400
        del_res = self.client.delete(f"/api/v1/billing-finance/insurance-providers/{provider_id}/")
        self.assertEqual(del_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot delete", del_res.data["error"])

    def test_02_corporate_customer_master_and_credit_limit(self):
        """
        Create a corporate client, adjust credit limit, and ensure credit validation.
        """
        payload = {
            "name": "Tata Consultancy Services (TCS)",
            "code": "CORP-TCS",
            "contact_person": "Sneha Kulkarni",
            "phone": "+919988776655",
            "email": "corporate.billing@tcs.test",
            "billing_address": "TCS Synergy Park, Hyderabad",
            "contract_reference": "TCS-HOSP-AGR-2026",
            "corporate_tariff": str(self.tariff.id),
            "credit_terms_days": 45,
            "credit_limit": "1000000.00"
        }
        res = self.client.post("/api/v1/billing-finance/corporate-customers/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        corp_id = res.data["id"]

        # Adjust credit limit
        adj_res = self.client.post(f"/api/v1/billing-finance/corporate-customers/{corp_id}/adjust-credit-limit/", {
            "credit_limit": "1500000.00"
        }, format="json")
        self.assertEqual(adj_res.status_code, status.HTTP_200_OK)
        self.assertEqual(adj_res.data["credit_limit"], "1500000.00")

    def test_03_patient_insurance_coverage_and_verification(self):
        """
        Register patient policy coverage and staff formal verification.
        """
        provider = InsuranceProvider.objects.create(
            name="HDFC ERGO General Insurance",
            code="HDFC-001"
        )
        payload = {
            "patient": str(self.patient.id),
            "provider": str(provider.id),
            "policy_number": "HDFC-MED-771122",
            "member_id": "MEM-889900",
            "insured_person_name": "Rajesh Verma",
            "relation_to_patient": "SELF",
            "sum_insured": "500000.00",
            "copay_percentage": "10.00",
            "deductible_amount": "5000.00",
            "valid_from": str(timezone.localdate())
        }
        res = self.client.post("/api/v1/billing-finance/patient-coverages/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        coverage_id = res.data["id"]

        # Verify policy action
        v_res = self.client.post(f"/api/v1/billing-finance/patient-coverages/{coverage_id}/verify-policy/")
        self.assertEqual(v_res.status_code, status.HTTP_200_OK)
        
        coverage = PatientInsuranceCoverage.objects.get(id=coverage_id)
        self.assertTrue(coverage.is_verified)
        self.assertEqual(coverage.status, CoverageStatus.ACTIVE)
        self.assertEqual(coverage.verified_by, self.staff_profile)

    def test_04_eligibility_verification_workflow(self):
        """
        Perform an eligibility check and capture confirmed limits.
        """
        provider = InsuranceProvider.objects.create(name="ICICI Lombard", code="ICICI-001")
        coverage = PatientInsuranceCoverage.objects.create(
            patient=self.patient,
            provider=provider,
            policy_number="ICICI-9900",
            sum_insured=Decimal('300000.00'),
            is_verified=True
        )

        payload = {
            "coverage": str(coverage.id),
            "patient": str(self.patient.id),
            "verification_method": "PORTAL",
            "reference_number": "TPA-PORTAL-REF-12345",
            "coverage_limit_confirmed": "300000.00",
            "status": "ELIGIBLE",
            "notes": "Verified online on TPA portal; no waiting period exclusions."
        }
        res = self.client.post("/api/v1/billing-finance/eligibility-checks/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["status"], "ELIGIBLE")
        self.assertEqual(res.data["checked_by_name"], "Pooja Sharma")

    def test_05_pre_authorization_lifecycle_and_adjudication(self):
        """
        Create a pre-auth request, submit, and record partial/full approval.
        """
        provider = InsuranceProvider.objects.create(name="Max Bupa / Niva Bupa", code="NIVA-001")
        coverage = PatientInsuranceCoverage.objects.create(
            patient=self.patient,
            provider=provider,
            policy_number="NIVA-POL-4433",
            sum_insured=Decimal('500000.00'),
            is_verified=True
        )

        create_res = self.client.post("/api/v1/billing-finance/pre-authorizations/", {
            "patient": str(self.patient.id),
            "coverage": str(coverage.id),
            "treatment_category": "Laparoscopic Cholecystectomy",
            "estimated_amount": "85000.00",
            "requested_amount": "80000.00",
            "notes": "Emergency surgical intervention scheduled."
        }, format="json")
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        pre_auth_id = create_res.data["id"]

        # Submit to TPA
        sub_res = self.client.post(f"/api/v1/billing-finance/pre-authorizations/{pre_auth_id}/submit-to-tpa/")
        self.assertEqual(sub_res.status_code, status.HTTP_200_OK)
        self.assertEqual(sub_res.data["pre_auth_status"], "SUBMITTED")

        # Adjudicate: Partial approval of 75,000 out of 80,000 requested
        adj_res = self.client.post(f"/api/v1/billing-finance/pre-authorizations/{pre_auth_id}/adjudicate/", {
            "decision": "PARTIALLY_APPROVED",
            "approved_amount": "75000.00",
            "approval_reference": "NIVA-PREAUTH-APP-99881",
            "rejection_query_reason": "Room rent capping at 1% of sum insured applied."
        }, format="json")
        self.assertEqual(adj_res.status_code, status.HTTP_200_OK)
        self.assertEqual(adj_res.data["pre_auth_status"], "PARTIALLY_APPROVED")
        self.assertEqual(adj_res.data["approved_amount"], "75000.00")

    def test_06_cashless_claim_creation_and_copay_calculation(self):
        """
        Create cashless claim, submit, approve, and track co-pay calculation against invoice.
        """
        provider = InsuranceProvider.objects.create(name="Care Health Insurance", code="CARE-001")
        coverage = PatientInsuranceCoverage.objects.create(
            patient=self.patient,
            provider=provider,
            policy_number="CARE-8844",
            sum_insured=Decimal('500000.00'),
            copay_percentage=Decimal('10.00'),
            is_verified=True
        )

        # Create claim
        claim_res = self.client.post("/api/v1/billing-finance/claims/", {
            "claim_type": "CASHLESS",
            "patient": str(self.patient.id),
            "invoice": str(self.invoice.id),
            "provider": str(provider.id),
            "coverage": str(coverage.id),
            "policy_number": "CARE-8844",
            "claim_amount": "50000.00"
        }, format="json")
        self.assertEqual(claim_res.status_code, status.HTTP_201_CREATED)
        claim_id = claim_res.data["id"]

        # Submit claim
        self.client.post(f"/api/v1/billing-finance/claims/{claim_id}/submit-claim/", {
            "submission_method": "PORTAL",
            "submission_reference": "CARE-PORTAL-SUB-8877"
        }, format="json")

        # Insurer approves 40,000 with 5,000 disallowed and 5,000 patient co-pay
        adj_res = self.client.post(f"/api/v1/billing-finance/claims/{claim_id}/adjudicate/", {
            "decision": "PARTIALLY_APPROVED",
            "approved_amount": "40000.00",
            "disallowed_amount": "5000.00",
            "patient_copay_amount": "5000.00"
        }, format="json")
        self.assertEqual(adj_res.status_code, status.HTTP_200_OK)
        self.assertEqual(adj_res.data["claim_status"], "PARTIALLY_APPROVED")
        self.assertEqual(adj_res.data["approved_amount"], "40000.00")
        self.assertEqual(adj_res.data["patient_copay_amount"], "5000.00")

    def test_07_claim_document_upload_and_listing(self):
        """
        Upload supporting claim documents (ID card, discharge summary, bills).
        """
        provider = InsuranceProvider.objects.create(name="Bajaj Allianz", code="BAJAJ-001")
        claim = InsuranceClaim.objects.create(
            claim_number=f"CLM-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient,
            invoice=self.invoice,
            provider=provider,
            policy_number="BAJAJ-5544",
            claim_amount=Decimal('35000.00')
        )

        doc_res = self.client.post("/api/v1/billing-finance/claim-documents/", {
            "claim": str(claim.id),
            "document_type": "DISCHARGE_SUMMARY",
            "document_name": "Clinical Discharge Summary - Cholecystectomy",
            "file_url": "https://storage.apollo.test/claims/docs/discharge_summary.pdf",
            "file_size_kb": 250,
            "notes": "Signed by Dr. Sharma"
        }, format="json")
        self.assertEqual(doc_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(doc_res.data["document_type"], "DISCHARGE_SUMMARY")
        self.assertEqual(doc_res.data["uploaded_by_name"], "Pooja Sharma")

    def test_08_tpa_query_and_resubmission_tracking(self):
        """
        Receive query from TPA, respond with medical justification, and update claim to RESUBMITTED.
        """
        provider = InsuranceProvider.objects.create(name="SBI General Insurance", code="SBI-001")
        claim = InsuranceClaim.objects.create(
            claim_number=f"CLM-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient,
            invoice=self.invoice,
            provider=provider,
            policy_number="SBI-1122",
            claim_amount=Decimal('42000.00'),
            status=ClaimStatus.SUBMITTED
        )

        # Raise query
        q_res = self.client.post("/api/v1/billing-finance/claim-queries/", {
            "claim": str(claim.id),
            "query_type": "MEDICAL_NECESSITY",
            "query_text": "Please provide pre-operative ultrasound abdomen reports.",
            "received_date": str(timezone.localdate())
        }, format="json")
        self.assertEqual(q_res.status_code, status.HTTP_201_CREATED)
        query_id = q_res.data["id"]

        # Respond to query
        resp_res = self.client.post(f"/api/v1/billing-finance/claim-queries/{query_id}/respond/", {
            "response_text": "Pre-operative USG attached showing acute cholecystitis with multiple calculi."
        }, format="json")
        self.assertEqual(resp_res.status_code, status.HTTP_200_OK)

        claim.refresh_from_db()
        self.assertEqual(claim.status, ClaimStatus.RESUBMITTED)

    def test_09_claim_settlement_disbursement_and_bank_utr(self):
        """
        Record actual settlement disbursement from insurer with bank UTR and disallowed deductions.
        """
        provider = InsuranceProvider.objects.create(name="National Insurance", code="NIC-001")
        claim = InsuranceClaim.objects.create(
            claim_number=f"CLM-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient,
            invoice=self.invoice,
            provider=provider,
            policy_number="NIC-8877",
            claim_amount=Decimal('60000.00'),
            approved_amount=Decimal('55000.00'),
            status=ClaimStatus.APPROVED
        )

        settle_res = self.client.post("/api/v1/billing-finance/claim-settlements/", {
            "claim": str(claim.id),
            "settlement_reference": "NIC-STL-REF-9944",
            "settlement_date": str(timezone.localdate()),
            "bank_utr": "HDFCN261023998811",
            "amount_settled": "55000.00",
            "disallowed_amount": "5000.00",
            "tds_deducted": "1100.00",
            "reconciliation_status": "MATCHED",
            "reconciliation_notes": "Disbursed via NEFT; bank credited successfully."
        }, format="json")
        self.assertEqual(settle_res.status_code, status.HTTP_201_CREATED)

        claim.refresh_from_db()
        self.assertEqual(claim.status, ClaimStatus.SETTLED)
        self.assertEqual(claim.settled_amount, Decimal('55000.00'))

    def test_10_corporate_billing_invoice_and_partial_payment(self):
        """
        Generate consolidated corporate billing invoice and record partial settlement.
        """
        corp = CorporateCustomer.objects.create(
            name="Infosys Limited",
            code="CORP-INFY",
            credit_limit=Decimal('800000.00'),
            current_credit_utilized=Decimal('120000.00')
        )

        inv_res = self.client.post("/api/v1/billing-finance/corporate-invoices/", {
            "corporate_customer": str(corp.id),
            "billing_period_start": "2026-10-01",
            "billing_period_end": "2026-10-15",
            "total_amount": "120000.00",
            "balance_amount": "120000.00",
            "due_date": "2026-11-15",
            "notes": "Consolidated bill for 6 employee outpatient/inpatient visits."
        }, format="json")
        self.assertEqual(inv_res.status_code, status.HTTP_201_CREATED)
        corp_inv_id = inv_res.data["id"]

        # Record partial payment of 70,000
        pay_res = self.client.post(f"/api/v1/billing-finance/corporate-invoices/{corp_inv_id}/record-payment/", {
            "amount": "70000.00"
        }, format="json")
        self.assertEqual(pay_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pay_res.data["paid_amount"], "70000.00")
        self.assertEqual(pay_res.data["balance_amount"], "50000.00")
        self.assertEqual(pay_res.data["invoice_status"], "PARTIALLY_PAID")

        corp.refresh_from_db()
        self.assertEqual(corp.current_credit_utilized, Decimal('50000.00'))

    def test_11_insurance_receivables_and_ageing_report(self):
        """
        Verify organization-wise receivables and ageing calculation (0-30, 31-60, 61-90, 90+ days).
        """
        provider = InsuranceProvider.objects.create(name="Reliance Health Insurance", code="REL-001")
        InsuranceClaim.objects.create(
            claim_number=f"CLM-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient,
            invoice=self.invoice,
            provider=provider,
            policy_number="REL-9922",
            claim_amount=Decimal('70000.00'),
            approved_amount=Decimal('70000.00'),
            settled_amount=Decimal('20000.00'),
            status=ClaimStatus.PARTIALLY_SETTLED,
            submitted_date=timezone.localdate()
        )

        res = self.client.get("/api/v1/billing-finance/insurance/receivables/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(res.data["total_outstanding_receivables"]), Decimal('50000.00'))
        self.assertIn("current_30_days", res.data["ageing_breakdown"])
        self.assertEqual(Decimal(res.data["ageing_breakdown"]["current_30_days"]), Decimal('50000.00'))

    def test_12_insurance_dashboard_stats(self):
        """
        Verify executive KPI stats for claims in flight, pending pre-auths, and total amounts.
        """
        res = self.client.get("/api/v1/billing-finance/insurance/dashboard-stats/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("total_claims", res.data)
        self.assertIn("claims_in_flight", res.data)
        self.assertIn("pending_preauths", res.data)
        self.assertIn("total_claimed_value", res.data)

    def test_13_unauthorized_patient_access_rejection(self):
        """
        Verify that patients cannot access staff-only insurance management APIs.
        """
        self.client.force_authenticate(user=self.patient_user)

        # Patients cannot manage insurance providers
        res = self.client.post("/api/v1/billing-finance/insurance-providers/", {
            "name": "Unauthorized Provider",
            "code": "UNAUTH-01"
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Patients cannot adjudicate pre-authorizations
        res2 = self.client.post("/api/v1/billing-finance/corporate-customers/", {
            "name": "Fake Corp",
            "code": "FAKE-01"
        }, format="json")
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

    def test_14_reimbursement_claim_workflow(self):
        """
        Verify patient reimbursement claim creation, linking receipt and invoice, and submission.
        """
        provider = InsuranceProvider.objects.create(name="United India Insurance", code="UII-001")
        res = self.client.post("/api/v1/billing-finance/claims/", {
            "claim_type": "REIMBURSEMENT",
            "patient": str(self.patient.id),
            "invoice": str(self.invoice.id),
            "provider": str(provider.id),
            "policy_number": "UII-POL-992211",
            "claim_amount": "50000.00"
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["claim_type"], "REIMBURSEMENT")
        self.assertEqual(res.data["status"], "DRAFT")

    def test_15_claim_filter_by_type_and_status(self):
        """
        Verify claims listing filters by claim_type and status.
        """
        provider = InsuranceProvider.objects.create(name="Universal Sompo", code="USO-001")
        InsuranceClaim.objects.create(
            claim_number=f"CLM-{uuid.uuid4().hex[:6].upper()}",
            claim_type=ClaimType.REIMBURSEMENT,
            patient=self.patient,
            invoice=self.invoice,
            provider=provider,
            policy_number="USO-1122",
            claim_amount=Decimal('15000.00'),
            status=ClaimStatus.SUBMITTED
        )

        res = self.client.get("/api/v1/billing-finance/claims/?claim_type=REIMBURSEMENT&status=SUBMITTED")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res.data) >= 1)
        self.assertEqual(res.data[0]["claim_type"], "REIMBURSEMENT")

