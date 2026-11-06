import uuid
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile
from apps.clinical.models import Appointment, AppointmentStatus
from apps.billing_finance.models import (
    Invoice, InvoiceStatus, Payment, PaymentReceipt,
    PaymentGatewayOrder, GatewayOrderStatus, FinancialAccountTransaction
)

User = get_user_model()


class TestMandatoryPaymentAndReceptionistRBAC(TestCase):
    """
    Comprehensive Test Suite verifying:
    1. Mandatory Payment (Cash & Online Razorpay) during Appointment Booking & Walk-in Token Issuing.
    2. Strict Receptionist-Only Access Control (HTTP 403 Forbidden for Doctor and all other roles).
    3. Receipt generation, duplicate prevention, failed payment blocking, retry flow, and financial ledger updates.
    """

    def setUp(self):
        self.client = APIClient()

        self.hospital = Hospital.objects.create(
            name='AURA Multi-Specialty Hospital',
            code=f"HOSP-{uuid.uuid4().hex[:4].upper()}",
            contact_phone='+91 40 2345 6789',
            contact_email='billing@aurahospital.org',
            address_line1='Road No. 12, Banjara Hills',
            city='Hyderabad',
            state='Telangana',
            postal_code='500034',
        )
        self.branch = Branch.objects.create(
            hospital=self.hospital,
            name='Banjara Hills Main Campus',
            code=f"BR-{uuid.uuid4().hex[:4].upper()}",
            address_line1='Road No. 12, Banjara Hills',
            city='Hyderabad',
            state='Telangana',
            postal_code='500034',
        )
        self.dept = Department.objects.create(
            branch=self.branch,
            name='Cardiology',
            code=f"DEP-{uuid.uuid4().hex[:4].upper()}",
        )

        # Create Users for all Roles
        self.users_by_role = {}
        self.staff_by_role = {}

        staff_roles = [
            RoleEnum.RECEPTIONIST,
            RoleEnum.DOCTOR,
            RoleEnum.SUPER_ADMIN,
            RoleEnum.BRANCH_MANAGER,
            RoleEnum.HOSPITAL_ADMIN,
            RoleEnum.MEDICAL_DIRECTOR,
            RoleEnum.DEPARTMENT_HEAD,
            RoleEnum.NURSE,
            RoleEnum.PHARMACIST,
            RoleEnum.LAB_TECHNICIAN,
            RoleEnum.RADIOLOGY_TECHNICIAN,
            RoleEnum.ACCOUNTANT,
            RoleEnum.FINANCE_MANAGER,
            RoleEnum.HR_MANAGER,
            RoleEnum.AUDITOR,
        ]

        for r_enum in staff_roles:
            role_obj, _ = Role.objects.get_or_create(
                name=r_enum,
                defaults={'display_name': r_enum.replace('_', ' ').title()},
            )
            supa_id = uuid.uuid4()
            email = f"{r_enum.lower()}@aurahospital.local"
            dj_user = User.objects.create_user(username=str(supa_id), email=email)
            up = UserProfile.objects.create(
                supabase_user_id=supa_id,
                email=email,
                first_name=r_enum.title(),
                last_name='Staff',
                role=role_obj,
                is_active=True,
            )
            sp = StaffProfile.objects.create(
                user_profile=up,
                hospital=self.hospital,
                branch=self.branch,
                department=self.dept,
                employee_id=f"EMP-{uuid.uuid4().hex[:6].upper()}",
                designation=r_enum.replace('_', ' ').title(),
                consultation_fee=Decimal('750.00') if r_enum == RoleEnum.DOCTOR else Decimal('0.00'),
                status='ACTIVE',
            )
            self.users_by_role[r_enum] = dj_user
            self.staff_by_role[r_enum] = sp

        self.doctor = self.staff_by_role[RoleEnum.DOCTOR]
        self.receptionist_user = self.users_by_role[RoleEnum.RECEPTIONIST]
        self.doctor_user = self.users_by_role[RoleEnum.DOCTOR]

        # Create Patient user & PatientProfile
        patient_role, _ = Role.objects.get_or_create(
            name=RoleEnum.PATIENT,
            defaults={'display_name': 'Patient'},
        )
        pat_supa_id = uuid.uuid4()
        self.patient_user = User.objects.create_user(
            username=str(pat_supa_id),
            email='patient.test@gmail.com',
        )
        self.patient_up = UserProfile.objects.create(
            supabase_user_id=pat_supa_id,
            email='patient.test@gmail.com',
            first_name='Saiteja',
            last_name='Nalla',
            phone_number='+91 9876543210',
            role=patient_role,
            is_active=True,
        )
        self.patient = PatientProfile.objects.create(
            user_profile=self.patient_up,
            primary_branch=self.branch,
            medical_record_number=f"MRN-{uuid.uuid4().hex[:8].upper()}",
            gender='MALE',
        )
        self.users_by_role[RoleEnum.PATIENT] = self.patient_user

    # =========================================================================
    # 1. PAYMENT WORKFLOW TESTS
    # =========================================================================

    def test_01_cash_payment_followed_by_successful_appointment_booking(self):
        """Test 1: Cash payment confirmed by Receptionist books scheduled appointment and generates receipt."""
        self.client.force_authenticate(user=self.receptionist_user)

        # Preview consultation fee first
        fee_res = self.client.get(f'/api/v1/clinical/opd/consultation-fee/?doctor_id={self.doctor.id}&patient_id={self.patient.id}')
        self.assertEqual(fee_res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(fee_res.data['consultation_fee']), Decimal('750.00'))
        self.assertEqual(fee_res.data['formatted_amount'], '₹750.00')

        payload = {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'department_id': str(self.dept.id),
            'appointment_date': '2026-12-01',
            'time_slot': '10:00 AM',
            'reason_for_visit': 'Cardiac consultation',
            'payment_method': 'CASH',
            'cash_received_confirmed': True,
        }

        res = self.client.post('/api/v1/clinical/appointments/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], AppointmentStatus.SCHEDULED)
        self.assertEqual(res.data['invoice_status'], InvoiceStatus.PAID)
        self.assertEqual(res.data['payment_method'], 'CASH')
        self.assertIsNotNone(res.data['receipt_number'])
        self.assertEqual(res.data['receipt']['formatted_amount'], '₹750.00')

        # Verify DB records
        appt = Appointment.objects.get(id=res.data['id'])
        self.assertIsNotNone(appt.invoice)
        self.assertEqual(appt.invoice.status, InvoiceStatus.PAID)
        self.assertEqual(appt.invoice.paid_amount, Decimal('750.00'))
        self.assertEqual(appt.invoice.balance_amount, Decimal('0.00'))
        self.assertTrue(Payment.objects.filter(invoice=appt.invoice, payment_method='CASH').exists())
        self.assertTrue(PaymentReceipt.objects.filter(payment__invoice=appt.invoice).exists())
        self.assertTrue(FinancialAccountTransaction.objects.filter(payment__invoice=appt.invoice).exists())

    def test_02_online_payment_followed_by_successful_appointment_booking(self):
        """Test 2: Online (Razorpay) order creation + HMAC signature verification books scheduled appointment."""
        self.client.force_authenticate(user=self.receptionist_user)

        # Step A: Create Razorpay Order
        order_res = self.client.post('/api/v1/clinical/opd/payment-order/', {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'booking_type': 'APPOINTMENT',
        }, format='json')
        self.assertEqual(order_res.status_code, status.HTTP_201_CREATED)
        rzp_order_id = order_res.data['razorpay_order_id']
        self.assertEqual(order_res.data['amount_paise'], 75000)

        # Step B: Authorize Sandbox Checkout to get server-verified signature
        auth_res = self.client.post('/api/v1/clinical/opd/payment-order/authorize-sandbox/', {
            'razorpay_order_id': rzp_order_id,
        }, format='json')
        self.assertEqual(auth_res.status_code, status.HTTP_200_OK)

        # Step C: Book Appointment with verified gateway credentials
        payload = {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'appointment_date': '2026-12-02',
            'time_slot': '10:30 AM',
            'reason_for_visit': 'Online paid consultation',
            'payment_method': 'ONLINE',
            'razorpay_order_id': auth_res.data['razorpay_order_id'],
            'razorpay_payment_id': auth_res.data['razorpay_payment_id'],
            'razorpay_signature': auth_res.data['razorpay_signature'],
        }
        res = self.client.post('/api/v1/clinical/appointments/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['invoice_status'], InvoiceStatus.PAID)
        self.assertEqual(res.data['payment_method'], 'ONLINE')
        self.assertEqual(res.data['transaction_reference'], auth_res.data['razorpay_payment_id'])

        # Gateway order must be marked PAID and linked to invoice & gateway_payment_id
        gw_order = PaymentGatewayOrder.objects.get(gateway_order_id=rzp_order_id)
        self.assertEqual(gw_order.status, GatewayOrderStatus.PAID)
        self.assertIsNotNone(gw_order.gateway_payment_id)
        self.assertIsNotNone(gw_order.invoice)

    def test_03_cash_payment_followed_by_successful_token_issuing(self):
        """Test 3: Cash payment confirmed by Receptionist issues walk-in token and receipt."""
        self.client.force_authenticate(user=self.receptionist_user)

        payload = {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'chief_complaint': 'Walk-in chest pain evaluation',
            'payment_method': 'CASH',
            'cash_received_confirmed': True,
        }
        res = self.client.post('/api/v1/clinical/opd/walk-in/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['appointment']['status'], AppointmentStatus.CHECKED_IN)
        self.assertIn('Token #', res.data['token_receipt']['token_number'])
        self.assertEqual(res.data['token_receipt']['payment_status'], 'PAID')
        self.assertEqual(res.data['token_receipt']['payment_method'], 'CASH')
        self.assertEqual(res.data['token_receipt']['formatted_amount'], '₹750.00')

    def test_04_online_payment_followed_by_successful_token_issuing(self):
        """Test 4: Online payment verified by server issues walk-in token and receipt."""
        self.client.force_authenticate(user=self.receptionist_user)

        order_res = self.client.post('/api/v1/clinical/opd/payment-order/', {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'booking_type': 'WALK_IN',
        }, format='json')
        self.assertEqual(order_res.status_code, status.HTTP_201_CREATED)

        auth_res = self.client.post('/api/v1/clinical/opd/payment-order/authorize-sandbox/', {
            'razorpay_order_id': order_res.data['razorpay_order_id'],
        }, format='json')
        self.assertEqual(auth_res.status_code, status.HTTP_200_OK)

        payload = {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'chief_complaint': 'Online walk-in fever check',
            'payment_method': 'ONLINE',
            'razorpay_order_id': auth_res.data['razorpay_order_id'],
            'razorpay_payment_id': auth_res.data['razorpay_payment_id'],
            'razorpay_signature': auth_res.data['razorpay_signature'],
        }
        res = self.client.post('/api/v1/clinical/opd/walk-in/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['token_receipt']['payment_method'], 'ONLINE')
        self.assertEqual(res.data['token_receipt']['payment_status'], 'PAID')

    def test_05_failed_or_forged_online_payment_blocks_booking_and_token(self):
        """Test 5: Failed online payment or forged frontend signature blocks appointment and token creation."""
        self.client.force_authenticate(user=self.receptionist_user)

        order_res = self.client.post('/api/v1/clinical/opd/payment-order/', {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'booking_type': 'APPOINTMENT',
        }, format='json')
        rzp_order_id = order_res.data['razorpay_order_id']

        # Attempt with forged signature (frontend spoofing success without gateway HMAC verification)
        forged_payload = {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'appointment_date': '2026-12-05',
            'time_slot': '11:00 AM',
            'reason_for_visit': 'Forged payment attempt',
            'payment_method': 'ONLINE',
            'razorpay_order_id': rzp_order_id,
            'razorpay_payment_id': 'pay_FAKE123456',
            'razorpay_signature': 'invalid_forged_hmac_signature',
        }
        res_forged = self.client.post('/api/v1/clinical/appointments/', forged_payload, format='json')
        self.assertEqual(res_forged.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Appointment.objects.filter(appointment_date='2026-12-05').exists())

        # Also block walk-in token with forged online payment
        res_walkin_forged = self.client.post('/api/v1/clinical/opd/walk-in/', forged_payload, format='json')
        self.assertEqual(res_walkin_forged.status_code, status.HTTP_400_BAD_REQUEST)

    def test_06_missing_or_unconfirmed_cash_payment_blocks_booking_and_token(self):
        """Test 6: Missing payment method or unconfirmed cash payment blocks appointment and token generation."""
        self.client.force_authenticate(user=self.receptionist_user)

        # Missing payment_method
        no_payment_payload = {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'appointment_date': '2026-12-06',
            'time_slot': '09:30 AM',
        }
        res1 = self.client.post('/api/v1/clinical/appointments/', no_payment_payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # Cash selected but cash_received_confirmed=False
        unconfirmed_cash_payload = {
            **no_payment_payload,
            'payment_method': 'CASH',
            'cash_received_confirmed': False,
        }
        res2 = self.client.post('/api/v1/clinical/appointments/', unconfirmed_cash_payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # Same check for walk-in token endpoint
        res3 = self.client.post('/api/v1/clinical/opd/walk-in/', unconfirmed_cash_payload, format='json')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

    def test_07_retry_after_failed_online_payment_succeeds(self):
        """Test 7: After a failed online payment, Receptionist can retry payment and complete booking."""
        self.client.force_authenticate(user=self.receptionist_user)

        # 1st attempt: create order and simulate gateway failure
        order1 = self.client.post('/api/v1/clinical/opd/payment-order/', {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
        }, format='json')
        fail_res = self.client.post('/api/v1/clinical/opd/payment-order/authorize-sandbox/', {
            'razorpay_order_id': order1.data['razorpay_order_id'],
            'simulate_failure': True,
        }, format='json')
        self.assertEqual(fail_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 2nd attempt (Retry): create new order, authorize successfully, and book appointment
        order2 = self.client.post('/api/v1/clinical/opd/payment-order/', {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
        }, format='json')
        auth2 = self.client.post('/api/v1/clinical/opd/payment-order/authorize-sandbox/', {
            'razorpay_order_id': order2.data['razorpay_order_id'],
        }, format='json')
        self.assertEqual(auth2.status_code, status.HTTP_200_OK)

        book_res = self.client.post('/api/v1/clinical/appointments/', {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'appointment_date': '2026-12-07',
            'time_slot': '11:30 AM',
            'payment_method': 'ONLINE',
            'razorpay_order_id': auth2.data['razorpay_order_id'],
            'razorpay_payment_id': auth2.data['razorpay_payment_id'],
            'razorpay_signature': auth2.data['razorpay_signature'],
        }, format='json')
        self.assertEqual(book_res.status_code, status.HTTP_201_CREATED)

    def test_08_duplicate_payment_and_duplicate_token_prevention(self):
        """Test 8: Reusing an already-settled payment reference or issuing duplicate walk-in token is blocked."""
        self.client.force_authenticate(user=self.receptionist_user)

        # Issue first walk-in token with a specific transaction reference
        tx_ref = f"CASH-UNIQUE-{uuid.uuid4().hex[:8].upper()}"
        walkin_payload = {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'chief_complaint': 'Initial walk-in visit',
            'payment_method': 'CASH',
            'cash_received_confirmed': True,
            'transaction_reference': tx_ref,
        }
        res1 = self.client.post('/api/v1/clinical/opd/walk-in/', walkin_payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Attempting to issue a second active walk-in token for the same patient & doctor today is blocked (409 Conflict)
        res_dup_token = self.client.post('/api/v1/clinical/opd/walk-in/', {
            **walkin_payload,
            'transaction_reference': f"CASH-UNIQUE-{uuid.uuid4().hex[:8].upper()}",
        }, format='json')
        self.assertEqual(res_dup_token.status_code, status.HTTP_409_CONFLICT)

        # Attempting to reuse the same transaction_reference for another appointment is blocked (409 Conflict)
        res_dup_pay = self.client.post('/api/v1/clinical/appointments/', {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'appointment_date': '2026-12-09',
            'time_slot': '03:00 PM',
            'payment_method': 'CASH',
            'cash_received_confirmed': True,
            'transaction_reference': tx_ref,
        }, format='json')
        self.assertEqual(res_dup_pay.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('Duplicate', str(res_dup_pay.data))

    def test_09_receipt_retrieval_endpoint(self):
        """Test 9: Printable/Downloadable receipt endpoint returns full patient, hospital, payment, and token details."""
        self.client.force_authenticate(user=self.receptionist_user)
        res = self.client.post('/api/v1/clinical/opd/walk-in/', {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'chief_complaint': 'Receipt verification visit',
            'payment_method': 'CASH',
            'cash_received_confirmed': True,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        appt_id = res.data['appointment']['id']

        rec_res = self.client.get(f'/api/v1/clinical/appointments/{appt_id}/receipt/')
        self.assertEqual(rec_res.status_code, status.HTTP_200_OK)
        self.assertEqual(rec_res.data['hospital_name'], 'AURA Multi-Specialty Hospital')
        self.assertEqual(rec_res.data['patient_name'], 'Saiteja Nalla')
        self.assertEqual(rec_res.data['formatted_amount'], '₹750.00')
        self.assertIn('REC-OPD-', rec_res.data['receipt_number'])
        self.assertIn('INV-OPD-', rec_res.data['invoice_number'])
        self.assertIn('Token #', rec_res.data['token_number'])

    # =========================================================================
    # 2. STRICT RECEPTIONIST-ONLY RBAC TESTS
    # =========================================================================

    def test_10_doctor_cannot_book_appointments_or_issue_tokens(self):
        """Test 10: Doctor role is strictly rejected with HTTP 403 Forbidden on booking, walk-in token, and payment order endpoints."""
        self.client.force_authenticate(user=self.doctor_user)

        book_res = self.client.post('/api/v1/clinical/appointments/', {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'appointment_date': '2026-12-10',
            'time_slot': '10:00 AM',
            'payment_method': 'CASH',
            'cash_received_confirmed': True,
        }, format='json')
        self.assertEqual(book_res.status_code, status.HTTP_403_FORBIDDEN)

        walkin_res = self.client.post('/api/v1/clinical/opd/walk-in/', {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'chief_complaint': 'Unauthorized doctor token test',
            'payment_method': 'CASH',
            'cash_received_confirmed': True,
        }, format='json')
        self.assertEqual(walkin_res.status_code, status.HTTP_403_FORBIDDEN)

        order_res = self.client.post('/api/v1/clinical/opd/payment-order/', {
            'patient_id': str(self.patient.id),
            'doctor_id': str(self.doctor.id),
        }, format='json')
        self.assertEqual(order_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_11_all_other_roles_rejected_with_403_forbidden(self):
        """Test 11: Every role other than RECEPTIONIST is rejected with HTTP 403 Forbidden when attempting to book appointments or issue tokens."""
        unauthorized_roles = [
            RoleEnum.SUPER_ADMIN,
            RoleEnum.BRANCH_MANAGER,
            RoleEnum.HOSPITAL_ADMIN,
            RoleEnum.MEDICAL_DIRECTOR,
            RoleEnum.DEPARTMENT_HEAD,
            RoleEnum.DOCTOR,
            RoleEnum.NURSE,
            RoleEnum.PHARMACIST,
            RoleEnum.LAB_TECHNICIAN,
            RoleEnum.RADIOLOGY_TECHNICIAN,
            RoleEnum.ACCOUNTANT,
            RoleEnum.FINANCE_MANAGER,
            RoleEnum.HR_MANAGER,
            RoleEnum.AUDITOR,
            RoleEnum.PATIENT,
        ]

        for role_name in unauthorized_roles:
            user = self.users_by_role[role_name]
            self.client.force_authenticate(user=user)

            res_book = self.client.post('/api/v1/clinical/appointments/', {
                'patient_id': str(self.patient.id),
                'doctor_id': str(self.doctor.id),
                'branch_id': str(self.branch.id),
                'appointment_date': '2026-12-12',
                'time_slot': '10:00 AM',
                'payment_method': 'CASH',
                'cash_received_confirmed': True,
            }, format='json')
            self.assertEqual(
                res_book.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Role {role_name} should be forbidden from booking appointments, got {res_book.status_code}",
            )

            res_token = self.client.post('/api/v1/clinical/opd/walk-in/', {
                'patient_id': str(self.patient.id),
                'doctor_id': str(self.doctor.id),
                'branch_id': str(self.branch.id),
                'chief_complaint': 'Role test',
                'payment_method': 'CASH',
                'cash_received_confirmed': True,
            }, format='json')
            self.assertEqual(
                res_token.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Role {role_name} should be forbidden from issuing walk-in tokens, got {res_token.status_code}",
            )
