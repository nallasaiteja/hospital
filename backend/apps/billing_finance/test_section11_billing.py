import uuid
import hmac
import hashlib
import json
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile
from apps.clinical.models import Ward, Bed, InpatientAdmission, LabTestCatalogue, LabOrder
from apps.pharmacy_inventory.models import Medicine, DosageForm, MedicineCategory, DispenseRecord
from apps.billing_finance.models import (
    HospitalService, ServiceCategory, TariffType, TariffPlan, TariffRate,
    HospitalPackage, PackageComponent, PatientPackageSubscription,
    PackageSubscriptionStatus, PackageUsageLog,
    Invoice, InvoiceItem, InvoiceStatus, ChargeItemType,
    Payment, PaymentMethod, PaymentReceipt,
    DiscountRequest, DiscountType, DiscountStatus,
    PatientDeposit, DepositAllocation, DepositStatus,
    PatientCreditNote, CreditNoteStatus,
    PatientRefund, RefundStatus,
    CashierShift, CashierShiftStatus,
    PaymentGatewayOrder, GatewayOrderStatus, PaymentWebhookLog,
    GatewaySettlement, BillingAuditEvent
)
from apps.billing_finance.gateway_views import RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET

User = get_user_model()


class Section11BillingAndPaymentTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Organization & Core
        self.hospital = Hospital.objects.create(name='Apex Super Specialty Hospital', code=f"HOSP-{uuid.uuid4().hex[:4].upper()}")
        self.branch = Branch.objects.create(hospital=self.hospital, name='South City Campus', code=f"BR-{uuid.uuid4().hex[:4].upper()}")
        self.dept_cardio = Department.objects.create(branch=self.branch, name='Cardiology', code=f"CARD-{uuid.uuid4().hex[:4].upper()}")
        self.dept_finance = Department.objects.create(branch=self.branch, name='Billing & Finance', code=f"FIN-{uuid.uuid4().hex[:4].upper()}")

        # 2. Roles
        self.role_billing, _ = Role.objects.get_or_create(name=RoleEnum.ACCOUNTANT, defaults={'display_name': 'Billing Officer'})
        self.role_admin, _ = Role.objects.get_or_create(name=RoleEnum.HOSPITAL_ADMIN, defaults={'display_name': 'Hospital Administrator'})
        self.role_patient, _ = Role.objects.get_or_create(name=RoleEnum.PATIENT, defaults={'display_name': 'Patient'})

        # 3. Staff Users
        cashier_id = uuid.uuid4()
        self.cashier_user = User.objects.create_user(username=str(cashier_id), email='cashier@hospital.com')
        self.cashier_up = UserProfile.objects.create(
            supabase_user_id=cashier_id, email='cashier@hospital.com',
            first_name='Ramesh', last_name='Patel', role=self.role_billing
        )
        self.cashier = StaffProfile.objects.create(
            user_profile=self.cashier_up, hospital=self.hospital, branch=self.branch,
            department=self.dept_finance, employee_id=f"EMP-{uuid.uuid4().hex[:6].upper()}", designation='Lead Cashier', status='ACTIVE'
        )

        mgr_id = uuid.uuid4()
        self.finance_mgr_user = User.objects.create_user(username=str(mgr_id), email='manager@hospital.com')
        self.finance_mgr_up = UserProfile.objects.create(
            supabase_user_id=mgr_id, email='manager@hospital.com',
            first_name='Anjali', last_name='Deshmukh', role=self.role_admin
        )
        self.finance_manager = StaffProfile.objects.create(
            user_profile=self.finance_mgr_up, hospital=self.hospital, branch=self.branch,
            department=self.dept_finance, employee_id=f"MGR-{uuid.uuid4().hex[:6].upper()}", designation='Finance Manager', status='ACTIVE'
        )

        # 4. Patient User
        patient_id = uuid.uuid4()
        self.patient_user = User.objects.create_user(username=str(patient_id), email='patient.anil@gmail.com')
        self.patient_up = UserProfile.objects.create(
            supabase_user_id=patient_id, email='patient.anil@gmail.com',
            first_name='Anil', last_name='Kapoor', role=self.role_patient
        )
        self.patient = PatientProfile.objects.create(
            user_profile=self.patient_up, primary_branch=self.branch,
            medical_record_number=f"MRN-{uuid.uuid4().hex[:8].upper()}", gender='MALE'
        )

        # Authenticate client as cashier
        self.client.force_authenticate(user=self.cashier_user)

    def test_01_service_catalogue_crud_and_categories(self):
        """Verify service catalogue covers all hospital streams with active statuses and tax rates."""
        categories = [
            (ServiceCategory.OPD_CONSULTATION, 'Consultation - Senior Cardiologist', '1000.00'),
            (ServiceCategory.IPD_ROOM_BED, 'Deluxe Private Room Daily Tariff', '3500.00'),
            (ServiceCategory.DIAGNOSTIC_LAB, 'Complete Metabolic Panel (CMP)', '1200.00'),
            (ServiceCategory.RADIOLOGY_IMAGING, 'Digital Chest X-Ray PA View', '800.00'),
            (ServiceCategory.PHARMACY, 'Emergency IV Antibiotic Administration', '450.00'),
            (ServiceCategory.SURGERY_PROCEDURE, 'Coronary Angioplasty (Single Vessel)', '75000.00'),
            (ServiceCategory.ICU_CARE, 'ICU Level 3 Ventilator Support per Day', '12000.00'),
            (ServiceCategory.EMERGENCY, 'ER Resuscitation & Trauma Triage', '2500.00')
        ]

        for cat, name, price in categories:
            res = self.client.post('/api/v1/billing-finance/services/', {
                'service_code': f"SVC-{uuid.uuid4().hex[:6].upper()}",
                'name': name,
                'category': cat,
                'standard_price': price,
                'tax_rate': '0.00',
                'is_active': True
            }, format='json')
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            self.assertEqual(res.data['category'], cat)
            self.assertEqual(Decimal(str(res.data['standard_price'])), Decimal(price))

    def test_02_tariff_selection_and_service_pricing_override(self):
        """Verify standard rate is overridden when a custom tariff plan applies to a patient."""
        service = HospitalService.objects.create(
            service_code='SRV-CONS-CARD', name='Cardiology Specialist Consultation',
            category=ServiceCategory.OPD_CONSULTATION, standard_price=Decimal('1000.00')
        )
        tariff = TariffPlan.objects.create(
            code='CONCESSION-SR-CITIZEN', name='Senior Citizen Concession Tariff',
            tariff_type=TariffType.PATIENT_SPECIFIC, patient=self.patient, priority=1
        )
        TariffRate.objects.create(tariff_plan=tariff, service=service, rate=Decimal('600.00'))

        # Create Bill without explicit unit price; tariff rate of 600.00 must apply
        res = self.client.post('/api/v1/billing-finance/invoices/', {
            'patient_id': str(self.patient.id),
            'encounter_type': 'OPD',
            'items': [{'service_id': str(service.id), 'quantity': 1}]
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(str(res.data['subtotal'])), Decimal('600.00'))
        self.assertEqual(Decimal(str(res.data['total_amount'])), Decimal('600.00'))

    def test_03_package_billing_and_prevention_of_duplicate_charges(self):
        """Verify package bundling, consumption tracking, and 0-rated package line items."""
        svc_usg = HospitalService.objects.create(
            service_code='SVC-USG-OBS', name='Obstetric Ultrasound Scan',
            category=ServiceCategory.RADIOLOGY_IMAGING, standard_price=Decimal('1500.00')
        )
        package = HospitalPackage.objects.create(
            package_code='PKG-MATERNITY-01', name='Antenatal Care Package',
            total_price=Decimal('15000.00'), validity_days=90
        )
        PackageComponent.objects.create(package=package, service=svc_usg, quantity_included=2)

        # 1. Subscribe Patient to Package
        sub_res = self.client.post('/api/v1/billing-finance/package-subscriptions/', {
            'patient_id': str(self.patient.id),
            'package_id': str(package.id)
        }, format='json')
        self.assertEqual(sub_res.status_code, status.HTTP_201_CREATED)
        sub_id = sub_res.data['id']

        # 2. Bill for 1st scan under package -> covered (price 0)
        inv1_res = self.client.post('/api/v1/billing-finance/invoices/', {
            'patient_id': str(self.patient.id),
            'package_subscription_id': sub_id,
            'items': [{'service_id': str(svc_usg.id), 'quantity': 1}]
        }, format='json')
        self.assertEqual(inv1_res.status_code, status.HTTP_201_CREATED)
        item1 = inv1_res.data['items'][0]
        self.assertTrue(item1['is_package_covered'])
        self.assertEqual(Decimal(str(inv1_res.data['total_amount'])), Decimal('0.00'))

        # 3. Bill for 2nd scan under package -> covered (price 0)
        inv2_res = self.client.post('/api/v1/billing-finance/invoices/', {
            'patient_id': str(self.patient.id),
            'package_subscription_id': sub_id,
            'items': [{'service_id': str(svc_usg.id), 'quantity': 1}]
        }, format='json')
        self.assertEqual(inv2_res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(inv2_res.data['items'][0]['is_package_covered'])

        # 4. 3rd scan exceeds package allowance (included=2) -> must be billed at standard price
        inv3_res = self.client.post('/api/v1/billing-finance/invoices/', {
            'patient_id': str(self.patient.id),
            'package_subscription_id': sub_id,
            'items': [{'service_id': str(svc_usg.id), 'quantity': 1}]
        }, format='json')
        self.assertEqual(inv3_res.status_code, status.HTTP_201_CREATED)
        self.assertFalse(inv3_res.data['items'][0]['is_package_covered'])
        self.assertEqual(Decimal(str(inv3_res.data['total_amount'])), Decimal('1500.00'))

    def test_04_discount_request_approval_limits_and_separation_of_duties(self):
        """Verify discount authorization requires approval and prevents requester self-approval."""
        inv = Invoice.objects.create(
            invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}", patient=self.patient,
            branch=self.branch, subtotal=Decimal('5000.00'), total_amount=Decimal('5000.00'),
            balance_amount=Decimal('5000.00')
        )

        # 1. Cashier requests 20% discount (₹1000)
        req_res = self.client.post('/api/v1/billing-finance/discounts/', {
            'invoice_id': str(inv.id),
            'discount_type': 'PERCENTAGE',
            'discount_value': '20.00',
            'reason': 'Financial hardship concession'
        }, format='json')
        self.assertEqual(req_res.status_code, status.HTTP_201_CREATED)
        disc_id = req_res.data['id']
        self.assertEqual(Decimal(str(req_res.data['calculated_amount'])), Decimal('1000.00'))

        # 2. Separation of duties: Cashier attempts to approve their own request -> 403 Forbidden
        app_fail = self.client.post(f'/api/v1/billing-finance/discounts/{disc_id}/approve/')
        self.assertEqual(app_fail.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Finance Manager approves discount -> 200 OK and invoice updated
        self.client.force_authenticate(user=self.finance_mgr_user)
        app_ok = self.client.post(f'/api/v1/billing-finance/discounts/{disc_id}/approve/')
        self.assertEqual(app_ok.status_code, status.HTTP_200_OK)

        inv.refresh_from_db()
        self.assertEqual(inv.discount_amount, Decimal('1000.00'))
        self.assertEqual(inv.total_amount, Decimal('4000.00'))
        self.assertEqual(inv.balance_amount, Decimal('4000.00'))

    def test_05_deposit_creation_allocation_and_remaining_balance(self):
        """Verify patient advance deposits, allocation to bills, and balance exhaustion."""
        self.client.force_authenticate(user=self.cashier_user)

        # 1. Collect Advance Deposit of ₹10,000
        dep_res = self.client.post('/api/v1/billing-finance/deposits/', {
            'patient_id': str(self.patient.id),
            'amount': '10000.00',
            'payment_method': 'CASH',
            'notes': 'IPD Admission Advance'
        }, format='json')
        self.assertEqual(dep_res.status_code, status.HTTP_201_CREATED)
        dep_id = dep_res.data['id']
        self.assertEqual(Decimal(str(dep_res.data['available_balance'])), Decimal('10000.00'))

        # 2. Create Bill of ₹6,000
        inv = Invoice.objects.create(
            invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}", patient=self.patient,
            branch=self.branch, subtotal=Decimal('6000.00'), total_amount=Decimal('6000.00'),
            balance_amount=Decimal('6000.00')
        )

        # 3. Allocate ₹6,000 to Bill
        alloc_res = self.client.post(f'/api/v1/billing-finance/deposits/{dep_id}/allocate-to-bill/', {
            'invoice_id': str(inv.id),
            'amount': '6000.00'
        }, format='json')
        self.assertEqual(alloc_res.status_code, status.HTTP_200_OK)

        inv.refresh_from_db()
        self.assertEqual(inv.deposit_applied_amount, Decimal('6000.00'))
        self.assertEqual(inv.balance_amount, Decimal('0.00'))
        self.assertEqual(inv.status, InvoiceStatus.PAID)

        deposit = PatientDeposit.objects.get(id=dep_id)
        self.assertEqual(deposit.available_balance, Decimal('4000.00'))
        self.assertEqual(deposit.status, DepositStatus.PARTIALLY_UTILIZED)

        # 4. Attempt to allocate more than available balance (₹5,000 > ₹4,000) -> 400 Bad Request
        inv2 = Invoice.objects.create(
            invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}", patient=self.patient,
            branch=self.branch, subtotal=Decimal('8000.00'), total_amount=Decimal('8000.00'),
            balance_amount=Decimal('8000.00')
        )
        alloc_fail = self.client.post(f'/api/v1/billing-finance/deposits/{dep_id}/allocate-to-bill/', {
            'invoice_id': str(inv2.id),
            'amount': '5000.00'
        }, format='json')
        self.assertEqual(alloc_fail.status_code, status.HTTP_400_BAD_REQUEST)

    def test_06_inpatient_interim_and_final_billing_without_duplicate_charges(self):
        """Verify IPD billing aggregates room charges, lab orders, and pharmacy dispenses without duplicating charges."""
        ward = Ward.objects.create(branch=self.branch, name='Cardio Ward A', floor='2nd Floor')
        bed = Bed.objects.create(ward=ward, bed_number='101-A', daily_rate=Decimal('2000.00'))
        admission = InpatientAdmission.objects.create(
            admission_number=f"ADM-{uuid.uuid4().hex[:6].upper()}", patient=self.patient,
            bed=bed, admitting_doctor=self.cashier, branch=self.branch, initial_diagnosis='Acute Coronary Syndrome'
        )

        # 1. Unbilled Lab Order linked to admission
        lab_cat = LabTestCatalogue.objects.create(code='LAB-TROP-I', name='Troponin I Quantitative', standard_rate=Decimal('1200.00'))
        lab_order = LabOrder.objects.create(
            order_number=f"LAB-{uuid.uuid4().hex[:6].upper()}", patient=self.patient,
            doctor=self.cashier, branch=self.branch, admission=admission
        )

        # 2. Unbilled Pharmacy Dispensation
        disp = DispenseRecord.objects.create(
            dispense_number=f"DSP-{uuid.uuid4().hex[:6].upper()}", patient=self.patient,
            pharmacist=self.cashier, branch=self.branch, total_amount=Decimal('850.00'),
            is_ipd_issue=True
        )

        # 3. Generate Inpatient Final Discharge Bill
        res = self.client.post('/api/v1/billing-finance/invoices/generate-inpatient-bill/', {
            'admission_id': str(admission.id),
            'is_final': True
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['is_final'])
        self.assertEqual(len(res.data['items']), 3)  # Bed charges + Lab + Pharmacy

        lab_order.refresh_from_db()
        disp.refresh_from_db()
        self.assertIsNotNone(lab_order.invoice)
        self.assertIsNotNone(disp.invoice)

        # 4. Generating another bill must NOT duplicate the already billed lab or pharmacy charges
        res2 = self.client.post('/api/v1/billing-finance/invoices/generate-inpatient-bill/', {
            'admission_id': str(admission.id),
            'is_final': True
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        # Lab and pharmacy are already linked to previous invoice, so they must not be billed again
        self.assertEqual(len(res2.data['items']), 0)

    def test_07_full_and_partial_payments_and_receipt_generation(self):
        """Verify partial payments update balances, transitions status to PAID, and generates receipts."""
        inv = Invoice.objects.create(
            invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}", patient=self.patient,
            branch=self.branch, subtotal=Decimal('2000.00'), total_amount=Decimal('2000.00'),
            balance_amount=Decimal('2000.00')
        )

        # 1. Partial payment of ₹800 via UPI
        pay1 = self.client.post('/api/v1/billing-finance/payments/record/', {
            'invoice_id': str(inv.id),
            'amount': '800.00',
            'payment_method': 'UPI',
            'transaction_reference': 'UPI-REF-001'
        }, format='json')
        self.assertEqual(pay1.status_code, status.HTTP_201_CREATED)

        inv.refresh_from_db()
        self.assertEqual(inv.paid_amount, Decimal('800.00'))
        self.assertEqual(inv.balance_amount, Decimal('1200.00'))
        self.assertEqual(inv.status, InvoiceStatus.PARTIALLY_PAID)

        # Check receipt was generated
        receipts = PaymentReceipt.objects.filter(invoice=inv)
        self.assertEqual(receipts.count(), 1)
        self.assertEqual(receipts.first().amount_paid, Decimal('800.00'))

        # 2. Final settlement of ₹1200 via Card
        pay2 = self.client.post('/api/v1/billing-finance/payments/record/', {
            'invoice_id': str(inv.id),
            'amount': '1200.00',
            'payment_method': 'CREDIT_CARD',
            'transaction_reference': 'POS-SLIP-456'
        }, format='json')
        self.assertEqual(pay2.status_code, status.HTTP_201_CREATED)

        inv.refresh_from_db()
        self.assertEqual(inv.paid_amount, Decimal('2000.00'))
        self.assertEqual(inv.balance_amount, Decimal('0.00'))
        self.assertEqual(inv.status, InvoiceStatus.PAID)
        self.assertEqual(PaymentReceipt.objects.filter(invoice=inv).count(), 2)

    def test_08_credit_notes_and_refund_limits(self):
        """Verify credit notes reduce bill balance, and refunds cannot exceed actual eligible amounts."""
        inv = Invoice.objects.create(
            invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}", patient=self.patient,
            branch=self.branch, subtotal=Decimal('3000.00'), total_amount=Decimal('3000.00'),
            balance_amount=Decimal('3000.00')
        )

        # 1. Issue Credit note for ₹500
        cn_res = self.client.post('/api/v1/billing-finance/credit-notes/', {
            'invoice_id': str(inv.id),
            'amount': '500.00',
            'reason': 'Cancelled procedure waiver'
        }, format='json')
        self.assertEqual(cn_res.status_code, status.HTTP_201_CREATED)

        inv.refresh_from_db()
        self.assertEqual(inv.credit_note_amount, Decimal('500.00'))
        self.assertEqual(inv.balance_amount, Decimal('2500.00'))

        # 2. Pay ₹1000 on the invoice
        self.client.post('/api/v1/billing-finance/payments/record/', {
            'invoice_id': str(inv.id), 'amount': '1000.00', 'payment_method': 'CASH'
        }, format='json')
        inv.refresh_from_db()
        self.assertEqual(inv.paid_amount, Decimal('1000.00'))

        # 3. Attempt refund of ₹1500 (exceeds ₹1000 paid) -> 400 Bad Request
        ref_fail = self.client.post('/api/v1/billing-finance/refunds/', {
            'invoice_id': str(inv.id),
            'refund_amount': '1500.00',
            'refund_method': 'CASH'
        }, format='json')
        self.assertEqual(ref_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Process valid refund of ₹400
        ref_ok = self.client.post('/api/v1/billing-finance/refunds/', {
            'invoice_id': str(inv.id),
            'refund_amount': '400.00',
            'refund_method': 'CASH',
            'reason': 'Partial fee refund'
        }, format='json')
        self.assertEqual(ref_ok.status_code, status.HTTP_201_CREATED)
        inv.refresh_from_db()
        self.assertEqual(inv.refunded_amount, Decimal('400.00'))

    def test_09_cashier_shift_opening_closing_and_variance_reconciliation(self):
        """Verify cashier shift records collections across payment methods, compares cash counted vs expected, and flags variances."""
        # 1. Open shift with ₹1,000 opening cash
        open_res = self.client.post('/api/v1/billing-finance/cashier-shifts/open-shift/', {
            'opening_cash': '1000.00'
        }, format='json')
        self.assertEqual(open_res.status_code, status.HTTP_201_CREATED)
        shift_id = open_res.data['id']
        self.assertEqual(open_res.data['status'], CashierShiftStatus.OPEN)

        # 2. Collect cash payment of ₹2,500
        inv = Invoice.objects.create(
            invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}", patient=self.patient,
            branch=self.branch, subtotal=Decimal('3000.00'), total_amount=Decimal('3000.00'), balance_amount=Decimal('3000.00')
        )
        self.client.post('/api/v1/billing-finance/payments/record/', {
            'invoice_id': str(inv.id), 'amount': '2500.00', 'payment_method': 'CASH'
        }, format='json')

        # 3. Close shift with exactly ₹3,500 cash counted (1000 opening + 2500 collected) -> RECONCILED (variance 0)
        close_ok = self.client.post(f'/api/v1/billing-finance/cashier-shifts/{shift_id}/close-shift/', {
            'closing_cash_counted': '3500.00'
        }, format='json')
        self.assertEqual(close_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(close_ok.data['status'], CashierShiftStatus.RECONCILED)
        self.assertEqual(Decimal(str(close_ok.data['cash_variance'])), Decimal('0.00'))

    def test_10_razorpay_gateway_order_creation_with_server_calculated_amount(self):
        """Verify payment gateway order creates server-validated order and returns key and amount in paise."""
        inv = Invoice.objects.create(
            invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}", patient=self.patient,
            branch=self.branch, subtotal=Decimal('4500.00'), total_amount=Decimal('4500.00'), balance_amount=Decimal('4500.00')
        )

        res = self.client.post('/api/v1/billing-finance/gateway/create-order/', {
            'invoice_id': str(inv.id),
            'idempotency_key': f"idemp_{uuid.uuid4().hex[:8]}"
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('order_id', res.data)
        self.assertEqual(res.data['amount_in_paise'], 450000)
        self.assertEqual(res.data['currency'], 'INR')

    def test_11_razorpay_cryptographic_signature_verification_and_tamper_rejection(self):
        """Verify HMAC-SHA256 signature verification rejects forged signatures and accepts valid signed payments."""
        inv = Invoice.objects.create(
            invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}", patient=self.patient,
            branch=self.branch, subtotal=Decimal('1500.00'), total_amount=Decimal('1500.00'), balance_amount=Decimal('1500.00')
        )

        order_res = self.client.post('/api/v1/billing-finance/gateway/create-order/', {
            'invoice_id': str(inv.id)
        }, format='json')
        order_id = order_res.data['order_id']
        pay_id = f"pay_{uuid.uuid4().hex[:14]}"

        # 1. Attempt verification with fake/forged signature -> 400 Bad Request
        fail_res = self.client.post('/api/v1/billing-finance/gateway/verify/', {
            'razorpay_order_id': order_id,
            'razorpay_payment_id': pay_id,
            'razorpay_signature': 'forged_fake_signature_abc123'
        }, format='json')
        self.assertEqual(fail_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Compute authentic HMAC-SHA256 signature
        msg = f"{order_id}|{pay_id}".encode('utf-8')
        valid_sig = hmac.new(RAZORPAY_KEY_SECRET.encode('utf-8'), msg, hashlib.sha256).hexdigest()

        ok_res = self.client.post('/api/v1/billing-finance/gateway/verify/', {
            'razorpay_order_id': order_id,
            'razorpay_payment_id': pay_id,
            'razorpay_signature': valid_sig
        }, format='json')
        self.assertEqual(ok_res.status_code, status.HTTP_200_OK)
        self.assertTrue(ok_res.data['success'])

        inv.refresh_from_db()
        self.assertEqual(inv.balance_amount, Decimal('0.00'))
        self.assertEqual(inv.status, InvoiceStatus.PAID)

    def test_12_webhook_raw_body_signature_and_duplicate_idempotency(self):
        """Verify signed webhook processing, raw signature check, and duplicate event deduplication."""
        inv = Invoice.objects.create(
            invoice_number=f"INV-{uuid.uuid4().hex[:6].upper()}", patient=self.patient,
            branch=self.branch, subtotal=Decimal('2500.00'), total_amount=Decimal('2500.00'), balance_amount=Decimal('2500.00')
        )
        gw_order = PaymentGatewayOrder.objects.create(
            gateway_order_id=f"order_{uuid.uuid4().hex[:12]}", patient=self.patient,
            invoice=inv, amount=Decimal('2500.00'), idempotency_key=f"idemp_{uuid.uuid4().hex[:8]}"
        )

        event_id = f"evt_{uuid.uuid4().hex[:10]}"
        payload = {
            'event': 'payment.captured',
            'event_id': event_id,
            'payload': {
                'payment': {
                    'entity': {
                        'id': f"pay_{uuid.uuid4().hex[:12]}",
                        'order_id': gw_order.gateway_order_id,
                        'amount': 250000,
                        'currency': 'INR'
                    }
                }
            }
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        sig = hmac.new(RAZORPAY_WEBHOOK_SECRET.encode('utf-8'), body_bytes, hashlib.sha256).hexdigest()

        # Unauthenticated webhook request (webhooks originate from Razorpay servers)
        self.client.force_authenticate(user=None)
        res1 = self.client.post(
            '/api/v1/billing-finance/gateway/webhook/',
            data=body_bytes,
            content_type='application/json',
            HTTP_X_RAZORPAY_SIGNATURE=sig
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        inv.refresh_from_db()
        self.assertEqual(inv.balance_amount, Decimal('0.00'))
        self.assertEqual(inv.status, InvoiceStatus.PAID)

        # Replayed / duplicate webhook with same event_id must be handled idempotently
        res2 = self.client.post(
            '/api/v1/billing-finance/gateway/webhook/',
            data=body_bytes,
            content_type='application/json',
            HTTP_X_RAZORPAY_SIGNATURE=sig
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertIn('idempotent', res2.data['message'].lower())

    def test_13_billing_dashboard_stats_aggregation(self):
        """Verify real-time aggregation of billing totals, collections, and department breakdowns."""
        res = self.client.get('/api/v1/billing-finance/dashboard-stats/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('total_billed', res.data)
        self.assertIn('total_collected', res.data)
        self.assertIn('total_outstanding', res.data)
        self.assertIn('revenue_by_category', res.data)
