import uuid
import hmac
import hashlib
import json
from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile
from apps.clinical.models import (
    Appointment, InpatientAdmission,
    LabTestCatalogue, LabCategory, LabOrder, LabOrderItem,
    LabOrderStatus, LabItemStatus, LabSample, SampleStatus,
    DiagnosticReport, DiagnosticReportStatus
)
from apps.pharmacy_inventory.models import (
    Medicine, MedicineCategory, ItemType, DosageForm, MedicineBatch, BatchStatus,
    Prescription, PrescriptionItem, DispenseRecord, DispenseItem,
    Supplier, SupplierCategory,
    PurchaseRequisition, PurchaseRequisitionItem, ProcurementCategory, RequisitionStatus,
    PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus,
    GoodsReceiptNote, GoodsReceiptItem, StockMovement, MovementType
)
from apps.billing_finance.models import (
    HospitalService, ServiceCategory, TariffType,
    Invoice, InvoiceItem, InvoiceStatus, ChargeItemType,
    Payment, PaymentMethod, PaymentReceipt,
    PatientDeposit, DepositStatus, PatientRefund, RefundStatus,
    PaymentGatewayOrder, GatewayOrderStatus, PaymentWebhookLog,
    InsuranceProvider, CorporateCustomer, PatientInsuranceCoverage,
    EligibilityCheck, PreAuthorizationRequest,
    InsuranceClaim, ClaimDocument, ClaimQuery, ClaimQueryType, ClaimSettlement
)
from apps.billing_finance.gateway_views import RAZORPAY_WEBHOOK_SECRET

User = get_user_model()


class EndToEndSystemAuditTests(TestCase):
    """
    Comprehensive End-to-End System Audit Test Suite for Hospital Management System
    covering realistic hospital workflows:
    1. Patient registration and data persistence
    2. Laboratory order, sample status, results entry, and report approval
    3. Pharmacy stock, batch numbers, expiry dates, and expired stock dispensing block
    4. Procurement: Purchase Requisition -> PO -> GRN -> Inventory update
    5. Patient billing, payment recording, and balance calculation
    6. Payment gateway callbacks: success, failure/invalid signature, duplicate idempotency
    7. Insurance policy, eligibility check, pre-auth, claim, query, and settlement
    8. Patient co-payment, insurance contribution, deductions, and receivables
    9. Role-based access control (RBAC) on financial, clinical, and claim actions
    10. Data persistence across database sessions
    """

    def setUp(self):
        self.client = APIClient()

        # Core Organization
        self.hospital = Hospital.objects.create(
            name="Apollo Memorial Hospital",
            code=f"HOSP-{uuid.uuid4().hex[:4].upper()}"
        )
        self.branch = Branch.objects.create(
            hospital=self.hospital,
            name="Main Super-Specialty Campus",
            code=f"BR-{uuid.uuid4().hex[:4].upper()}"
        )
        self.dept_cardio = Department.objects.create(
            branch=self.branch,
            name="Cardiology",
            code="CARD"
        )
        self.dept_pharm = Department.objects.create(
            branch=self.branch,
            name="Central Pharmacy",
            code="PHARM"
        )
        self.dept_proc = Department.objects.create(
            branch=self.branch,
            name="Procurement & Materials",
            code="PROC"
        )
        self.dept_lab = Department.objects.create(
            branch=self.branch,
            name="Pathology & Laboratory Medicine",
            code="LAB"
        )
        self.dept_finance = Department.objects.create(
            branch=self.branch,
            name="Billing & Accounts",
            code="FIN"
        )

        # Roles
        self.role_admin, _ = Role.objects.get_or_create(name=RoleEnum.HOSPITAL_ADMIN, defaults={'display_name': 'Hospital Administrator'})
        self.role_doctor, _ = Role.objects.get_or_create(name=RoleEnum.DOCTOR, defaults={'display_name': 'Doctor'})
        self.role_lab_tech, _ = Role.objects.get_or_create(name=RoleEnum.LAB_TECHNICIAN, defaults={'display_name': 'Lab Technician'})
        self.role_pharmacist, _ = Role.objects.get_or_create(name=RoleEnum.PHARMACIST, defaults={'display_name': 'Pharmacist'})
        self.role_billing, _ = Role.objects.get_or_create(name=RoleEnum.ACCOUNTANT, defaults={'display_name': 'Billing Officer'})
        self.role_insurance, _ = Role.objects.get_or_create(name=RoleEnum.INSURANCE_COORDINATOR, defaults={'display_name': 'Insurance Coordinator'})
        self.role_patient, _ = Role.objects.get_or_create(name=RoleEnum.PATIENT, defaults={'display_name': 'Patient'})

        # Users and Profiles
        self.admin_user, self.admin_profile, self.admin_staff = self._create_user(
            "admin@hospital.org", "Admin", "User", self.role_admin, self.dept_finance, "ADMIN-01"
        )
        self.doctor_user, self.doctor_profile, self.doctor_staff = self._create_user(
            "doctor@hospital.org", "Dr. Rajesh", "Sharma", self.role_doctor, self.dept_cardio, "DOC-01"
        )
        self.lab_tech_user, self.lab_tech_profile, self.lab_tech_staff = self._create_user(
            "labtech@hospital.org", "Sunil", "Verma", self.role_lab_tech, self.dept_lab, "TECH-01"
        )
        self.pharmacist_user, self.pharmacist_profile, self.pharmacist_staff = self._create_user(
            "pharmacist@hospital.org", "Priya", "Menon", self.role_pharmacist, self.dept_pharm, "PHARM-01"
        )
        self.billing_user, self.billing_profile, self.billing_staff = self._create_user(
            "billing@hospital.org", "Kavita", "Rao", self.role_billing, self.dept_finance, "BILL-01"
        )
        self.insurance_user, self.insurance_profile, self.insurance_staff = self._create_user(
            "insurance@hospital.org", "Anand", "Kumar", self.role_insurance, self.dept_finance, "INS-01"
        )

        # Patient User
        self.patient_uuid = uuid.uuid4()
        self.patient_user = User.objects.create_user(
            username=str(self.patient_uuid),
            email="patient.audit@test.com",
            password="PatientPassword123!"
        )
        self.patient_user_profile = UserProfile.objects.create(
            supabase_user_id=self.patient_uuid,
            email="patient.audit@test.com",
            first_name="Rohan",
            last_name="Kapoor",
            role=self.role_patient,
            phone_number="+919876543210"
        )
        self.patient_profile = PatientProfile.objects.create(
            user_profile=self.patient_user_profile,
            primary_branch=self.branch,
            medical_record_number=f"MRN-AUDIT-{uuid.uuid4().hex[:6].upper()}",
            date_of_birth=date(1990, 5, 15),
            gender="MALE",
            blood_group="B+",
            emergency_contact_name="Neha Kapoor",
            emergency_contact_phone="+919876543211",
            address="42 Green Park",
            city="New Delhi",
            state="Delhi",
            postal_code="110016"
        )

    def _create_user(self, email, first_name, last_name, role, department, emp_id):
        user_id = uuid.uuid4()
        user = User.objects.create_user(username=str(user_id), email=email, password="AuditPassword123!")
        u_profile = UserProfile.objects.create(
            supabase_user_id=user_id,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=role
        )
        s_profile = StaffProfile.objects.create(
            user_profile=u_profile,
            hospital=self.hospital,
            branch=self.branch,
            department=department,
            employee_id=f"{emp_id}-{uuid.uuid4().hex[:4].upper()}",
            designation=role.display_name,
            status="ACTIVE"
        )
        return user, u_profile, s_profile

    # =========================================================================
    # SCENARIO 1: Patient Registration and Data Persistence
    # =========================================================================
    def test_scenario_01_patient_registration_and_persistence(self):
        """Verify patient registration, demographic attributes, and database persistence."""
        new_uid = uuid.uuid4()
        user = User.objects.create_user(username=str(new_uid), email="anita.verma@test.com")
        up = UserProfile.objects.create(
            supabase_user_id=new_uid,
            email="anita.verma@test.com",
            first_name="Anita",
            last_name="Verma",
            role=self.role_patient,
            phone_number="+919123456789"
        )
        mrn = f"MRN-{uuid.uuid4().hex[:6].upper()}"
        patient = PatientProfile.objects.create(
            user_profile=up,
            primary_branch=self.branch,
            medical_record_number=mrn,
            date_of_birth=date(1985, 8, 20),
            gender="FEMALE",
            blood_group="O+",
            emergency_contact_name="Sanjay Verma",
            emergency_contact_phone="+919123456780",
            address="78 Lotus Boulevard",
            city="Noida",
            state="Uttar Pradesh",
            postal_code="201304"
        )

        # Retrieve and verify database persistence
        retrieved = PatientProfile.objects.get(medical_record_number=mrn)
        self.assertEqual(retrieved.user_profile.first_name, "Anita")
        self.assertEqual(retrieved.user_profile.last_name, "Verma")
        self.assertEqual(retrieved.blood_group, "O+")
        self.assertEqual(retrieved.city, "Noida")
        self.assertEqual(retrieved.primary_branch.hospital.id, self.hospital.id)

    # =========================================================================
    # SCENARIO 2: Lab Order, Sample Status, Results & Doctor Approval
    # =========================================================================
    def test_scenario_02_laboratory_workflow_and_approval(self):
        """Verify lab order lifecycle, sample collection, results, and approval."""
        test_item = LabTestCatalogue.objects.create(
            code="LP-001",
            name="Lipid Profile",
            category=LabCategory.BIOCHEMISTRY,
            department=self.dept_lab,
            sample_type="SERUM",
            standard_rate=Decimal("1200.00"),
            is_active=True
        )

        order = LabOrder.objects.create(
            order_number=f"LAB-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient_profile,
            doctor=self.doctor_staff,
            branch=self.branch,
            status=LabOrderStatus.ORDERED,
            priority="ROUTINE"
        )
        sample = LabSample.objects.create(
            sample_barcode=f"SMP-{uuid.uuid4().hex[:8].upper()}",
            lab_order=order,
            patient=self.patient_profile,
            specimen_type="SERUM",
            status=SampleStatus.COLLECTED,
            collected_by=self.lab_tech_staff
        )
        item = LabOrderItem.objects.create(
            lab_order=order,
            test=test_item,
            sample=sample,
            captured_price=test_item.standard_rate,
            status=LabItemStatus.PENDING
        )

        # Technician marks sample received and enters diagnostic report
        sample.status = SampleStatus.RECEIVED_IN_LAB
        sample.save()
        self.assertEqual(sample.status, SampleStatus.RECEIVED_IN_LAB)

        # Report created in DRAFT
        report = DiagnosticReport.objects.create(
            report_number=f"RPT-{uuid.uuid4().hex[:6].upper()}",
            report_type='LABORATORY',
            lab_order=order,
            patient=self.patient_profile,
            branch=self.branch,
            prepared_by=self.lab_tech_staff,
            status=DiagnosticReportStatus.DRAFT,
            summary_findings="Total Cholesterol: 240 mg/dL (Elevated)",
            clinical_comments="Hyperlipidemia detected."
        )

        # Doctor reviews and finalizes the report
        self.client.force_authenticate(user=self.doctor_user)
        report.status = DiagnosticReportStatus.APPROVED
        report.approved_by = self.doctor_staff
        report.approved_at = timezone.now()
        report.save()

        # Verify final persistence and status
        persisted_report = DiagnosticReport.objects.get(id=report.id)
        self.assertEqual(persisted_report.status, DiagnosticReportStatus.APPROVED)
        self.assertEqual(persisted_report.approved_by.id, self.doctor_staff.id)

    # =========================================================================
    # SCENARIO 3: Pharmacy Stock, Expiry Date & Dispensing Guard
    # =========================================================================
    def test_scenario_03_pharmacy_stock_and_expired_batch_guard(self):
        """Verify that expired medicine batches cannot be dispensed."""
        supplier = Supplier.objects.create(
            code=f"SUP-{uuid.uuid4().hex[:6].upper()}",
            name='Pharma Corp',
            category=SupplierCategory.PHARMACEUTICALS,
            contact_person='Mr. Roy',
            phone='9988776655',
            email='roy@pharma.test',
            is_active=True
        )
        medicine = Medicine.objects.create(
            code=f"MED-{uuid.uuid4().hex[:5].upper()}",
            brand_name="Amoxicillin 500mg",
            generic_name="Amoxicillin",
            category=MedicineCategory.ANTIBIOTICS,
            dosage_form=DosageForm.TABLET,
            strength="500mg",
            purchase_cost=Decimal("15.00"),
            selling_price=Decimal("25.00")
        )

        # 1. Expired batch
        expired_batch = MedicineBatch.objects.create(
            medicine=medicine,
            branch=self.branch,
            supplier=supplier,
            batch_number="BATCH-EXP-001",
            expiry_date=date.today() - timedelta(days=1),  # Expired yesterday
            quantity_in_stock=50,
            unit_purchase_cost=Decimal("15.00"),
            unit_selling_price=Decimal("25.00"),
            status=BatchStatus.AVAILABLE
        )

        # 2. Active fresh batch
        active_batch = MedicineBatch.objects.create(
            medicine=medicine,
            branch=self.branch,
            supplier=supplier,
            batch_number="BATCH-ACT-002",
            expiry_date=date.today() + timedelta(days=365),  # 1 year valid
            quantity_in_stock=50,
            unit_purchase_cost=Decimal("15.00"),
            unit_selling_price=Decimal("25.00"),
            status=BatchStatus.AVAILABLE
        )

        # Attempt dispensing expired batch: must fail with Clinical Safety Violation
        self.client.force_authenticate(user=self.pharmacist_user)
        dispense_payload_expired = {
            "patient_id": str(self.patient_profile.id),
            "items": [
                {
                    "batch_id": str(expired_batch.id),
                    "quantity": 10
                }
            ]
        }
        resp = self.client.post("/api/v1/pharmacy/dispense/", dispense_payload_expired, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Clinical Safety Violation", resp.data["error"])

        # Dispense valid batch: must succeed and decrement quantity
        dispense_payload_valid = {
            "patient_id": str(self.patient_profile.id),
            "items": [
                {
                    "batch_id": str(active_batch.id),
                    "quantity": 20
                }
            ]
        }
        resp_valid = self.client.post("/api/v1/pharmacy/dispense/", dispense_payload_valid, format='json')
        self.assertEqual(resp_valid.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp_valid.data["success"])

        active_batch.refresh_from_db()
        self.assertEqual(active_batch.quantity_in_stock, 30)

    # =========================================================================
    # SCENARIO 4: Procurement Workflow (Requisition -> PO -> GRN -> Stock)
    # =========================================================================
    def test_scenario_04_procurement_requisition_to_grn(self):
        """Verify procurement lifecycle: Requisition -> PO -> Goods Receipt -> Stock update."""
        self.client.force_authenticate(user=self.admin_user)

        supplier = Supplier.objects.create(
            name="MedSupply Global Pvt Ltd",
            code=f"SUP-{uuid.uuid4().hex[:4].upper()}",
            category=SupplierCategory.PHARMACEUTICALS,
            contact_person="Ramesh Gupta",
            email="ramesh@medsupply.com",
            phone="9876500000",
            gst_or_tax_id="GSTIN123456"
        )

        paracetamol = Medicine.objects.create(
            code=f"MED-{uuid.uuid4().hex[:5].upper()}",
            brand_name="Paracetamol 650mg",
            generic_name="Paracetamol",
            category=MedicineCategory.ANALGESICS,
            dosage_form=DosageForm.TABLET,
            strength="650mg",
            purchase_cost=Decimal("2.00"),
            selling_price=Decimal("5.00")
        )

        # 1. Purchase Requisition
        req = PurchaseRequisition.objects.create(
            requisition_number=f"REQ-{uuid.uuid4().hex[:6].upper()}",
            branch=self.branch,
            requesting_department=self.dept_proc,
            requested_by=self.admin_staff,
            procurement_category=ProcurementCategory.MEDICINES,
            status=RequisitionStatus.APPROVED
        )
        req_item = PurchaseRequisitionItem.objects.create(
            requisition=req,
            medicine=paracetamol,
            quantity_requested=500,
            estimated_cost=Decimal("2.00")
        )

        # 2. Purchase Order
        po = PurchaseOrder.objects.create(
            branch=self.branch,
            supplier=supplier,
            po_number=f"PO-{uuid.uuid4().hex[:6].upper()}",
            ordered_by=self.admin_staff,
            status=PurchaseOrderStatus.ISSUED,
            total_amount=Decimal("1000.00")
        )
        po_item = PurchaseOrderItem.objects.create(
            purchase_order=po,
            medicine=paracetamol,
            item_name=paracetamol.brand_name,
            quantity=500,
            unit_cost=Decimal("2.00"),
            subtotal=Decimal("1000.00")
        )

        # 3. Goods Receipt Note (GRN) via API
        grn_payload = {
            "purchase_order_id": str(po.id),
            "delivery_challan_number": "DC-2026-9988",
            "items": [
                {
                    "po_item_id": str(po_item.id),
                    "medicine_id": str(paracetamol.id),
                    "batch_number": "BATCH-PARA-2026",
                    "expiry_date": str(date.today() + timedelta(days=700)),
                    "quantity_received": 500,
                    "quantity_accepted": 500,
                    "quantity_rejected": 0,
                    "purchase_cost": "2.00",
                    "selling_price": "5.00"
                }
            ]
        }
        resp = self.client.post("/api/v1/pharmacy/grns/", grn_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        # Verify MedicineBatch created and stock increased
        new_batch = MedicineBatch.objects.get(batch_number="BATCH-PARA-2026", medicine=paracetamol)
        self.assertEqual(new_batch.quantity_in_stock, 500)

    # =========================================================================
    # SCENARIO 5: Patient Billing, Payment Recording & Balance Tracking
    # =========================================================================
    def test_scenario_05_billing_payment_and_balance_calculation(self):
        """Verify invoice generation, line items, payment recording, and balance reconciliation."""
        self.client.force_authenticate(user=self.billing_user)

        invoice = Invoice.objects.create(
            branch=self.branch,
            patient=self.patient_profile,
            invoice_number=f"INV-AUDIT-{uuid.uuid4().hex[:6].upper()}",
            status=InvoiceStatus.ISSUED,
            subtotal=Decimal("5000.00"),
            total_amount=Decimal("4500.00"),
            discount_amount=Decimal("500.00"),
            tax_amount=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
            balance_amount=Decimal("4500.00")
        )
        InvoiceItem.objects.create(
            invoice=invoice,
            item_type=ChargeItemType.GENERAL_SERVICE,
            description="Echocardiography Examination",
            quantity=1,
            unit_price=Decimal("5000.00"),
            subtotal=Decimal("5000.00")
        )

        # Record partial payment of 2000
        pay_payload_1 = {
            "invoice_id": str(invoice.id),
            "amount": "2000.00",
            "payment_method": "UPI"
        }
        resp1 = self.client.post("/api/v1/billing-finance/payments/record/", pay_payload_1, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)

        invoice.refresh_from_db()
        self.assertEqual(invoice.paid_amount, Decimal("2000.00"))
        self.assertEqual(invoice.balance_amount, Decimal("2500.00"))
        self.assertEqual(invoice.status, InvoiceStatus.PARTIALLY_PAID)

        # Record remaining payment of 2500
        pay_payload_2 = {
            "invoice_id": str(invoice.id),
            "amount": "2500.00",
            "payment_method": "CASH"
        }
        resp2 = self.client.post("/api/v1/billing-finance/payments/record/", pay_payload_2, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)

        invoice.refresh_from_db()
        self.assertEqual(invoice.paid_amount, Decimal("4500.00"))
        self.assertEqual(invoice.balance_amount, Decimal("0.00"))
        self.assertEqual(invoice.status, InvoiceStatus.PAID)

    # =========================================================================
    # SCENARIO 6: Payment Gateway Callbacks (Success, Invalid Sig, Idempotency)
    # =========================================================================
    def test_scenario_06_payment_gateway_callbacks_and_idempotency(self):
        """Verify webhook signature validation, success processing, and duplicate idempotency."""
        invoice = Invoice.objects.create(
            branch=self.branch,
            patient=self.patient_profile,
            invoice_number=f"INV-GW-{uuid.uuid4().hex[:6].upper()}",
            status=InvoiceStatus.ISSUED,
            subtotal=Decimal("3000.00"),
            total_amount=Decimal("3000.00"),
            paid_amount=Decimal("0.00"),
            balance_amount=Decimal("3000.00")
        )
        gw_order = PaymentGatewayOrder.objects.create(
            gateway_order_id=f"order_{uuid.uuid4().hex[:12]}",
            patient=self.patient_profile,
            invoice=invoice,
            amount=Decimal('3000.00'),
            idempotency_key=f"idemp_{uuid.uuid4().hex[:8]}"
        )

        # 1. Invalid signature callback: must be rejected with 400
        body_invalid = json.dumps({"event": "payment.captured", "payload": {}})
        self.client.force_authenticate(user=None)
        resp_invalid = self.client.post(
            "/api/v1/billing-finance/gateway/webhook/",
            data=body_invalid,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE="bogus_tampered_signature"
        )
        self.assertEqual(resp_invalid.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Valid signature callback
        event_id = f"evt_{uuid.uuid4().hex[:10]}"
        payment_id = f"pay_{uuid.uuid4().hex[:12]}"
        webhook_data = {
            "event": "payment.captured",
            "event_id": event_id,
            "payload": {
                "payment": {
                    "entity": {
                        "id": payment_id,
                        "order_id": gw_order.gateway_order_id,
                        "amount": 300000,  # 3000 INR in paise
                        "currency": "INR",
                        "status": "captured"
                    }
                }
            }
        }
        body_bytes = json.dumps(webhook_data).encode('utf-8')
        valid_sig = hmac.new(
            RAZORPAY_WEBHOOK_SECRET.encode('utf-8'),
            body_bytes,
            hashlib.sha256
        ).hexdigest()

        resp_valid = self.client.post(
            "/api/v1/billing-finance/gateway/webhook/",
            data=body_bytes,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=valid_sig
        )
        self.assertEqual(resp_valid.status_code, status.HTTP_200_OK)

        invoice.refresh_from_db()
        self.assertEqual(invoice.balance_amount, Decimal("0.00"))
        self.assertEqual(invoice.status, InvoiceStatus.PAID)

        # 3. Duplicate Webhook Callback (Idempotency): must not double-credit invoice
        resp_duplicate = self.client.post(
            "/api/v1/billing-finance/gateway/webhook/",
            data=body_bytes,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=valid_sig
        )
        self.assertEqual(resp_duplicate.status_code, status.HTTP_200_OK)
        self.assertIn("idempotent", resp_duplicate.data["message"].lower())

    # =========================================================================
    # SCENARIO 7: Insurance Pre-Auth, Claim, Query, and Settlement
    # =========================================================================
    def test_scenario_07_insurance_lifecycle_and_settlement(self):
        """Verify full insurance lifecycle: Provider -> Coverage -> Eligibility -> Pre-auth -> Claim -> Query -> Settlement."""
        self.client.force_authenticate(user=self.insurance_user)

        provider = InsuranceProvider.objects.create(
            name="Star Health Insurance",
            code=f"STAR-{uuid.uuid4().hex[:4].upper()}",
            org_type="INSURER",
            contact_person="Ravi Nambiar",
            email="claims@starhealth.com",
            phone="18004252255"
        )

        coverage = PatientInsuranceCoverage.objects.create(
            patient=self.patient_profile,
            provider=provider,
            policy_number="POL-SH-990011",
            member_id="MEM-SH-001",
            insured_person_name="Rohan Kapoor",
            relation_to_patient="SELF",
            sum_insured=Decimal("500000.00"),
            copay_percentage=Decimal("10.00"),
            deductible_amount=Decimal("2000.00"),
            valid_from=date.today() - timedelta(days=60),
            valid_to=date.today() + timedelta(days=300),
            is_verified=True
        )

        # Eligibility check
        el_resp = self.client.post("/api/v1/billing-finance/eligibility-checks/", {
            "patient": str(self.patient_profile.id),
            "coverage": str(coverage.id),
            "verification_method": "PORTAL",
            "reference_number": "EL-VERIF-2026",
            "coverage_limit_confirmed": "500000.00"
        }, format='json')
        self.assertEqual(el_resp.status_code, status.HTTP_201_CREATED)

        # Pre-Authorization
        pre_auth = PreAuthorizationRequest.objects.create(
            request_number=f"REQ-PA-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient_profile,
            coverage=coverage,
            requested_by=self.insurance_staff,
            treatment_category="Cardiology Interventional",
            estimated_amount=Decimal("150000.00"),
            requested_amount=Decimal("150000.00"),
            status="SUBMITTED"
        )

        # Pre-Auth Adjudication (Approved for 120,000)
        adj_resp = self.client.post(f"/api/v1/billing-finance/pre-authorizations/{pre_auth.id}/adjudicate/", {
            "decision": "APPROVED",
            "approved_amount": "120000.00",
            "approval_reference": "AUTH-STAR-9922",
            "notes": "Approved up to 1,20,000 INR"
        }, format='json')
        self.assertEqual(adj_resp.status_code, status.HTTP_200_OK)
        pre_auth.refresh_from_db()
        self.assertEqual(pre_auth.status, "APPROVED")
        self.assertEqual(pre_auth.approved_amount, Decimal("120000.00"))

        # Cashless Claim
        invoice = Invoice.objects.create(
            branch=self.branch,
            patient=self.patient_profile,
            invoice_number=f"INV-CLAIM-{uuid.uuid4().hex[:6].upper()}",
            status=InvoiceStatus.ISSUED,
            subtotal=Decimal("150000.00"),
            total_amount=Decimal("150000.00"),
            paid_amount=Decimal("0.00"),
            balance_amount=Decimal("150000.00")
        )
        claim = InsuranceClaim.objects.create(
            claim_type="CASHLESS",
            claim_number=f"CLM-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient_profile,
            provider=provider,
            coverage=coverage,
            pre_auth=pre_auth,
            invoice=invoice,
            claim_amount=Decimal("150000.00"),
            status="SUBMITTED",
            submission_method="PORTAL",
            submission_reference="PORTAL-REF-8877",
            assigned_staff=self.insurance_staff
        )

        # Query received and responded
        query = ClaimQuery.objects.create(
            claim=claim,
            query_number=f"QRY-{uuid.uuid4().hex[:6].upper()}",
            query_type=ClaimQueryType.BILLING_QUERY,
            query_text="Provide detailed catheterization lab notes.",
            deadline_date=date.today() + timedelta(days=3)
        )
        resp_q = self.client.post(f"/api/v1/billing-finance/claim-queries/{query.id}/respond/", {
            "response_text": "Cath lab report and angiogram CD attached."
        }, format='json')
        self.assertEqual(resp_q.status_code, status.HTTP_200_OK)
        claim.refresh_from_db()
        self.assertEqual(claim.status, "RESUBMITTED")

        # Claim Adjudication: Insurer approves 120,000; Patient Co-pay: 12,000; Disallowed: 16,000
        adj_claim = self.client.post(f"/api/v1/billing-finance/claims/{claim.id}/adjudicate/", {
            "decision": "APPROVED",
            "approved_amount": "120000.00",
            "disallowed_amount": "16000.00",
            "patient_copay_amount": "12000.00"
        }, format='json')
        self.assertEqual(adj_claim.status_code, status.HTTP_200_OK)

        # Claim Settlement via Bank UTR
        settle_resp = self.client.post("/api/v1/billing-finance/claim-settlements/", {
            "claim": str(claim.id),
            "settlement_reference": "STL-REF-STAR-9900",
            "settlement_date": str(date.today()),
            "bank_utr": "UTR-HDFC-9988776655",
            "amount_settled": "120000.00",
            "disallowed_amount": "16000.00",
            "tds_deducted": "0.00",
            "reconciliation_status": "MATCHED",
            "reconciliation_notes": "Settlement matched bank statement."
        }, format='json')
        self.assertEqual(settle_resp.status_code, status.HTTP_201_CREATED)

        claim.refresh_from_db()
        self.assertEqual(claim.status, "SETTLED")
        self.assertEqual(claim.settled_amount, Decimal("120000.00"))

    # =========================================================================
    # SCENARIO 8: Patient Co-payment & Receivables Separation
    # =========================================================================
    def test_scenario_08_patient_copayment_and_receivables_integrity(self):
        """Verify patient responsibility is separated from insurer receivables without double counting."""
        self.client.force_authenticate(user=self.insurance_user)

        provider = InsuranceProvider.objects.create(
            name="Max Bupa Health",
            code=f"MAX-{uuid.uuid4().hex[:4].upper()}",
            org_type="INSURER"
        )
        coverage = PatientInsuranceCoverage.objects.create(
            patient=self.patient_profile,
            provider=provider,
            policy_number="POL-MAX-5544",
            member_id="MEM-MAX-01",
            insured_person_name="Rohan Kapoor",
            relation_to_patient="SELF",
            sum_insured=Decimal("300000.00"),
            copay_percentage=Decimal("15.00"),
            deductible_amount=Decimal("5000.00")
        )
        invoice = Invoice.objects.create(
            branch=self.branch,
            patient=self.patient_profile,
            invoice_number=f"INV-COPAY-{uuid.uuid4().hex[:6].upper()}",
            status=InvoiceStatus.ISSUED,
            subtotal=Decimal("100000.00"),
            total_amount=Decimal("100000.00"),
            paid_amount=Decimal("0.00"),
            balance_amount=Decimal("100000.00")
        )
        claim = InsuranceClaim.objects.create(
            claim_type="CASHLESS",
            claim_number=f"CLM-COPAY-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient_profile,
            provider=provider,
            coverage=coverage,
            invoice=invoice,
            claim_amount=Decimal("100000.00"),
            status="SUBMITTED",
            assigned_staff=self.insurance_staff
        )

        # Adjudication: Insurer approves 80,000. Patient Co-pay: 15,000, Disallowed: 5,000.
        self.client.post(f"/api/v1/billing-finance/claims/{claim.id}/adjudicate/", {
            "decision": "APPROVED",
            "approved_amount": "80000.00",
            "disallowed_amount": "5000.00",
            "patient_copay_amount": "15000.00"
        }, format='json')

        claim.refresh_from_db()
        self.assertEqual(claim.approved_amount, Decimal("80000.00"))
        self.assertEqual(claim.patient_copay_amount, Decimal("15000.00"))

        # Outstanding Insurer Receivable calculation: approved (80,000) - settled (0) = 80,000
        outstanding_receivable = claim.approved_amount - claim.settled_amount
        self.assertEqual(outstanding_receivable, Decimal("80000.00"))

    # =========================================================================
    # SCENARIO 9: RBAC Enforcement & Unauthorized API Rejection
    # =========================================================================
    def test_scenario_09_rbac_unauthorized_rejection(self):
        """Verify that patient/unauthorized accounts are blocked with 403 Forbidden on sensitive actions."""
        # Authenticate as patient
        self.client.force_authenticate(user=self.patient_user)

        # 1. Patient cannot toggle insurance provider status
        provider = InsuranceProvider.objects.create(name="Religare Health", code="REL-01")
        resp1 = self.client.post(f"/api/v1/billing-finance/insurance-providers/{provider.id}/toggle-active/")
        self.assertEqual(resp1.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Patient cannot adjudicate claims
        invoice_rbac = Invoice.objects.create(
            branch=self.branch,
            patient=self.patient_profile,
            invoice_number=f"INV-RBAC-{uuid.uuid4().hex[:6].upper()}",
            status=InvoiceStatus.ISSUED,
            subtotal=Decimal("10000.00"),
            total_amount=Decimal("10000.00"),
            paid_amount=Decimal("0.00"),
            balance_amount=Decimal("10000.00")
        )
        claim = InsuranceClaim.objects.create(
            claim_number=f"CLM-RBAC-{uuid.uuid4().hex[:4].upper()}",
            patient=self.patient_profile,
            provider=provider,
            invoice=invoice_rbac,
            claim_amount=Decimal("10000.00"),
            status="SUBMITTED"
        )
        resp2 = self.client.post(f"/api/v1/billing-finance/claims/{claim.id}/adjudicate/", {
            "decision": "APPROVED",
            "approved_amount": "10000.00"
        }, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Patient cannot adjust corporate credit limits
        corp = CorporateCustomer.objects.create(
            name="TechCorp India",
            code="TECH-01",
            credit_limit=Decimal("500000.00")
        )
        resp3 = self.client.post(f"/api/v1/billing-finance/corporate-customers/{corp.id}/adjust-credit-limit/", {
            "credit_limit": "1000000.00"
        }, format='json')
        self.assertEqual(resp3.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # SCENARIO 10: Data Persistence and Integrity Across Re-Queries
    # =========================================================================
    def test_scenario_10_database_persistence_across_sessions(self):
        """Verify database persistence integrity across distinct queries and model relations."""
        # Create corporate customer with agreement and credit limit
        corp = CorporateCustomer.objects.create(
            name="Reliance Industries Healthcare Tie-up",
            code=f"RIL-{uuid.uuid4().hex[:4].upper()}",
            contact_person="Alok Ambani",
            email="health@ril.com",
            phone="02222880000",
            billing_address="Maker Chambers IV, Nariman Point, Mumbai",
            contract_reference="AGR-RIL-2026",
            credit_limit=Decimal("2500000.00"),
            credit_terms_days=45,
            is_active=True
        )

        # Clear local cache/re-fetch from DB
        fetched_corp = CorporateCustomer.objects.get(id=corp.id)
        self.assertEqual(fetched_corp.name, "Reliance Industries Healthcare Tie-up")
        self.assertEqual(fetched_corp.credit_limit, Decimal("2500000.00"))
        self.assertEqual(fetched_corp.credit_terms_days, 45)
        self.assertEqual(fetched_corp.contract_reference, "AGR-RIL-2026")
        self.assertTrue(fetched_corp.is_active)
