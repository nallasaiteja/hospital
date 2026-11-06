import hmac
import hashlib
import json
import os
import uuid
import logging
import requests
from decimal import Decimal
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status

from apps.authentication.models import PatientProfile, StaffProfile
from apps.core.models import Branch, Department, Hospital
from apps.core.activity_log_service import ActivityLogService
from apps.billing_finance.models import (
    HospitalService, ServiceCategory, TariffPlan,
    Invoice, InvoiceItem, InvoiceStatus, ChargeItemType,
    Payment, PaymentMethod, PaymentReceipt,
    PaymentGatewayOrder, GatewayOrderStatus, BillingAuditEvent,
    FinancialAccount, FinancialAccountType, AccountingClassification,
    FinancialAccountTransaction, TransactionType,
    FinancialTransactionCategory, TransactionLifecycleStatus,
)
from apps.billing_finance.gateway_views import (
    RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, verify_razorpay_signature
)

logger = logging.getLogger('hospital.clinical.opd_payment')


class OPDPaymentError(Exception):
    """Structured exception for OPD payment validation and verification errors."""
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, extra: dict = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.extra = extra or {}


def resolve_consultation_fee(
    doctor: StaffProfile,
    department: Department = None,
    patient: PatientProfile = None
) -> dict:
    """
    Resolves the applicable OPD consultation fee in Indian Rupees (₹) using the hospital's
    existing fee configuration (TariffPlan overrides -> Doctor consultation_fee -> HospitalService catalogue).
    """
    dept = department or getattr(doctor, 'department', None)
    matched_service = None
    fee = None
    fee_source = 'DOCTOR_PROFILE'

    # 1. Look up active OPD Consultation service in HospitalService catalogue
    service_qs = HospitalService.objects.filter(
        category=ServiceCategory.OPD_CONSULTATION,
        is_active=True
    )
    if dept:
        matched_service = service_qs.filter(department=dept).first()
    if not matched_service:
        matched_service = service_qs.first()

    # 2. Check patient-specific active TariffPlan override if service exists
    if patient and matched_service:
        tariff_plan = TariffPlan.objects.filter(patient=patient, is_active=True).first()
        if tariff_plan:
            rate_override = tariff_plan.rates.filter(service=matched_service).first()
            if rate_override and rate_override.rate > Decimal('0.00'):
                fee = rate_override.rate
                fee_source = f"TARIFF_PLAN:{tariff_plan.code}"

    # 3. Use doctor's configured consultation_fee on StaffProfile
    if fee is None and getattr(doctor, 'consultation_fee', None) and doctor.consultation_fee > Decimal('0.00'):
        fee = Decimal(str(doctor.consultation_fee)).quantize(Decimal('0.01'))
        fee_source = 'DOCTOR_PROFILE'

    # 4. Fallback to HospitalService standard_price if doctor fee is 0/unset
    if fee is None and matched_service and matched_service.standard_price > Decimal('0.00'):
        fee = Decimal(str(matched_service.standard_price)).quantize(Decimal('0.01'))
        fee_source = f"SERVICE_CATALOGUE:{matched_service.service_code}"

    # 5. Final institutional default if neither is set
    if fee is None or fee <= Decimal('0.00'):
        fee = Decimal('500.00')
        fee_source = 'HOSPITAL_DEFAULT_TARIFF'

    return {
        'amount': fee,
        'currency': 'INR',
        'currency_symbol': '₹',
        'formatted_amount': f"₹{fee:.2f}",
        'fee_source': fee_source,
        'service': matched_service,
    }


def create_opd_online_payment_order(
    request,
    patient: PatientProfile,
    doctor: StaffProfile,
    department: Department = None,
    booking_type: str = 'APPOINTMENT',
    idempotency_key: str = None,
    receptionist_staff: StaffProfile = None,
) -> dict:
    """
    Generates a server-validated Razorpay order for an OPD Appointment or Walk-in Token
    BEFORE the appointment or token is confirmed.
    """
    fee_info = resolve_consultation_fee(doctor=doctor, department=department, patient=patient)
    amount = fee_info['amount']
    amount_in_paise = int(amount * 100)
    idemp_key = idempotency_key or f"opd_order_{uuid.uuid4().hex}"

    existing_order = PaymentGatewayOrder.objects.filter(idempotency_key=idemp_key).first()
    if existing_order:
        if existing_order.status == GatewayOrderStatus.PAID:
            raise OPDPaymentError(
                "Duplicate payment order: this online payment order has already been paid and processed.",
                status_code=status.HTTP_409_CONFLICT
            )
        active_key_id = getattr(settings, 'RAZORPAY_KEY_ID', os.getenv('RAZORPAY_KEY_ID', RAZORPAY_KEY_ID))
        return {
            'order_id': existing_order.gateway_order_id,
            'razorpay_order_id': existing_order.gateway_order_id,
            'amount': str(existing_order.amount),
            'formatted_amount': f"₹{existing_order.amount:.2f}",
            'amount_in_paise': int(existing_order.amount * 100),
            'currency': 'INR',
            'currency_symbol': '₹',
            'status': existing_order.status,
            'key_id': active_key_id,
            'is_sandbox': not bool(os.getenv('RAZORPAY_LIVE_KEY_ID')) or active_key_id.startswith('rzp_test_'),
            'patient_id': str(patient.id),
            'patient_name': patient.user_profile.full_name,
            'doctor_id': str(doctor.id),
            'doctor_name': doctor.user_profile.full_name,
            'fee_source': fee_info['fee_source'],
        }

    active_key_id = getattr(settings, 'RAZORPAY_KEY_ID', os.getenv('RAZORPAY_KEY_ID', RAZORPAY_KEY_ID))
    active_key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', os.getenv('RAZORPAY_KEY_SECRET', RAZORPAY_KEY_SECRET))
    is_sandbox = not bool(os.getenv('RAZORPAY_LIVE_KEY_ID')) or active_key_id.startswith('rzp_test_')
    gateway_order_id = None
    is_live_gateway = False

    if active_key_id and active_key_secret and not active_key_id.startswith('rzp_test_mock'):
        try:
            receipt_str = f"opd_{booking_type[:4].lower()}_{uuid.uuid4().hex[:8]}"
            resp = requests.post(
                'https://api.razorpay.com/v1/orders',
                auth=(active_key_id, active_key_secret),
                json={
                    'amount': amount_in_paise,
                    'currency': 'INR',
                    'receipt': receipt_str[:40],
                    'notes': {
                        'booking_type': booking_type,
                        'patient_id': str(patient.id),
                        'doctor_id': str(doctor.id),
                    }
                },
                timeout=10
            )
            if resp.status_code in (200, 201):
                order_data = resp.json()
                gateway_order_id = order_data.get('id')
                is_live_gateway = True
        except Exception as exc:
            logger.warning("Razorpay live order creation fallback to local order: %s", exc)

    if not gateway_order_id:
        gateway_order_id = f"order_{uuid.uuid4().hex[:14]}"

    notes_payload = {
        'booking_type': booking_type,
        'doctor_id': str(doctor.id),
        'doctor_name': doctor.user_profile.full_name,
        'patient_id': str(patient.id),
        'patient_mrn': patient.medical_record_number,
        'fee_source': fee_info['fee_source'],
    }

    order = PaymentGatewayOrder.objects.create(
        gateway_order_id=gateway_order_id,
        gateway_name='RAZORPAY',
        patient=patient,
        amount=amount,
        currency='INR',
        status=GatewayOrderStatus.INITIATED,
        idempotency_key=idemp_key,
        notes=json.dumps(notes_payload)
    )

    BillingAuditEvent.objects.create(
        action='OPD_GATEWAY_ORDER_INITIATED',
        entity_name='PaymentGatewayOrder',
        entity_id=str(order.id),
        performed_by=receptionist_staff,
        details={
            'gateway_order_id': gateway_order_id,
            'amount': str(amount),
            'currency': 'INR',
            'booking_type': booking_type,
            'patient_mrn': patient.medical_record_number,
            'doctor_name': doctor.user_profile.full_name,
        },
        ip_address=request.META.get('REMOTE_ADDR', '')[:45] if request else ''
    )

    return {
        'order_id': gateway_order_id,
        'razorpay_order_id': gateway_order_id,
        'amount': str(amount),
        'formatted_amount': f"₹{amount:.2f}",
        'amount_in_paise': amount_in_paise,
        'amount_paise': amount_in_paise,
        'currency': 'INR',
        'currency_symbol': '₹',
        'status': order.status,
        'key_id': active_key_id,
        'is_sandbox': is_sandbox,
        'is_live_gateway': is_live_gateway,
        'patient_id': str(patient.id),
        'patient_name': patient.user_profile.full_name,
        'patient_email': patient.user_profile.email,
        'patient_phone': patient.user_profile.phone_number,
        'doctor_id': str(doctor.id),
        'doctor_name': doctor.user_profile.full_name,
        'fee_source': fee_info['fee_source'],
    }


def authorize_sandbox_opd_payment(
    request,
    razorpay_order_id: str,
    simulate_failure: bool = False,
    receptionist_staff: StaffProfile = None,
) -> dict:
    """
    Server-side Razorpay sandbox authorization helper.
    Generates an authentic HMAC-SHA256 signature using RAZORPAY_KEY_SECRET or records a failed
    payment attempt so the receptionist can retry.
    """
    if not razorpay_order_id:
        raise OPDPaymentError("razorpay_order_id is required.", status.HTTP_400_BAD_REQUEST)

    order = PaymentGatewayOrder.objects.select_for_update().filter(gateway_order_id=razorpay_order_id).first()
    if not order:
        raise OPDPaymentError("Payment gateway order not found.", status.HTTP_404_NOT_FOUND)

    if order.status == GatewayOrderStatus.PAID:
        raise OPDPaymentError(
            "This payment order has already been paid and settled.",
            status.HTTP_409_CONFLICT
        )

    if simulate_failure:
        order.status = GatewayOrderStatus.FAILED
        order.save(update_fields=['status', 'updated_at'])
        BillingAuditEvent.objects.create(
            action='OPD_GATEWAY_PAYMENT_FAILED',
            entity_name='PaymentGatewayOrder',
            entity_id=str(order.id),
            performed_by=receptionist_staff,
            details={
                'gateway_order_id': razorpay_order_id,
                'amount': str(order.amount),
                'reason': 'Gateway payment declined / failed during authorization',
            },
            ip_address=request.META.get('REMOTE_ADDR', '')[:45] if request else ''
        )
        raise OPDPaymentError(
            "Online payment failed or was declined by the gateway. Appointment/token was not generated. You may retry payment.",
            status_code=status.HTTP_400_BAD_REQUEST,
            extra={'payment_status': 'FAILED', 'can_retry': True, 'razorpay_order_id': razorpay_order_id}
        )

    active_key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', os.getenv('RAZORPAY_KEY_SECRET', RAZORPAY_KEY_SECRET))
    payment_id = f"pay_{uuid.uuid4().hex[:14]}"
    signature = hmac.new(
        active_key_secret.encode('utf-8'),
        f"{razorpay_order_id}|{payment_id}".encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    order.status = GatewayOrderStatus.ATTEMPTED
    order.save(update_fields=['status', 'updated_at'])

    return {
        'razorpay_order_id': razorpay_order_id,
        'razorpay_payment_id': payment_id,
        'razorpay_signature': signature,
        'amount': str(order.amount),
        'formatted_amount': f"₹{order.amount:.2f}",
        'currency': 'INR',
        'status': 'AUTHORIZED_PENDING_VERIFICATION',
    }


def validate_opd_payment_payload(
    data: dict,
    patient: PatientProfile,
    doctor: StaffProfile,
    department: Department = None,
    receptionist_staff: StaffProfile = None,
    request=None,
) -> dict:
    """
    Validates mandatory payment fields BEFORE any appointment or token is created.
    Strictly enforces:
      - Exactly two allowed methods: CASH or ONLINE
      - Rejects missing payment, PENDING, FAILED, CANCELLED, or UNSUCCESSFUL statuses
      - For CASH: requires cash_received_confirmed == True
      - For ONLINE: requires server-side HMAC-SHA256 verification of (razorpay_order_id, razorpay_payment_id, razorpay_signature)
        against a valid PaymentGatewayOrder matching patient and consultation fee
      - Prevents duplicate payments via transaction_reference and idempotency_key
    """
    payment_method_raw = str(data.get('payment_method') or '').strip().upper()
    payment_status_raw = str(data.get('payment_status') or '').strip().upper()
    idempotency_key = str(data.get('idempotency_key') or '').strip()

    # 1. Reject explicitly non-successful payment statuses immediately
    if payment_status_raw in ('PENDING', 'FAILED', 'CANCELLED', 'UNSUCCESSFUL', 'DECLINED', 'EXPIRED'):
        raise OPDPaymentError(
            f"Appointment confirmation and token generation are blocked because payment status is '{payment_status_raw}'. "
            f"Payment must be completed and verified first.",
            status_code=status.HTTP_400_BAD_REQUEST,
            extra={'payment_status': payment_status_raw, 'can_retry': True}
        )

    # 2. Require payment_method to be CASH or ONLINE
    if not payment_method_raw:
        raise OPDPaymentError(
            "Mandatory payment required: 'payment_method' ('CASH' or 'ONLINE') must be provided to book an appointment or issue a token.",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    if payment_method_raw not in ('CASH', 'ONLINE', 'ONLINE_GATEWAY'):
        raise OPDPaymentError(
            f"Invalid payment method '{payment_method_raw}'. Exactly two payment methods are supported: 'CASH' and 'ONLINE'.",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    # 3. Resolve authoritative hospital consultation fee
    fee_info = resolve_consultation_fee(doctor=doctor, department=department, patient=patient)
    expected_fee = fee_info['amount']

    # Optional amount check if client sent amount
    if data.get('amount') is not None and str(data.get('amount')).strip() != '':
        try:
            client_amount = Decimal(str(data.get('amount'))).quantize(Decimal('0.01'))
            if client_amount != expected_fee:
                raise OPDPaymentError(
                    f"Payment amount mismatch: submitted ₹{client_amount:.2f} does not match the configured consultation fee of ₹{expected_fee:.2f}.",
                    status_code=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError, ArithmeticError):
            raise OPDPaymentError("Invalid payment amount format.", status_code=status.HTTP_400_BAD_REQUEST)

    # 4. Idempotency / duplicate payment check
    if idempotency_key:
        if Payment.objects.filter(transaction_reference=idempotency_key).exists():
            raise OPDPaymentError(
                "Duplicate payment detected: a transaction with this idempotency key has already been processed.",
                status_code=status.HTTP_409_CONFLICT
            )

    # 5. Method-specific verification
    if payment_method_raw == 'CASH':
        cash_confirmed_raw = data.get('cash_received_confirmed')
        is_cash_confirmed = (
            cash_confirmed_raw is True
            or str(cash_confirmed_raw).strip().lower() in ('true', '1', 'yes')
        )
        if not is_cash_confirmed:
            raise OPDPaymentError(
                "Cash payment confirmation required: Receptionist must confirm that cash (₹"
                f"{expected_fee:.2f}) has been received ('cash_received_confirmed': true) before booking or issuing a token.",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        custom_ref = str(data.get('transaction_reference') or '').strip()
        if custom_ref and Payment.objects.filter(transaction_reference=custom_ref).exists():
            raise OPDPaymentError(
                f"Duplicate cash payment reference '{custom_ref}' detected.",
                status_code=status.HTTP_409_CONFLICT
            )
        tx_ref = custom_ref or idempotency_key or f"CASH-{timezone.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
        return {
            'payment_method_display': 'CASH',
            'payment_method_db': PaymentMethod.CASH,
            'amount': expected_fee,
            'fee_info': fee_info,
            'transaction_reference': tx_ref,
            'gateway_order': None,
            'razorpay_payment_id': '',
            'razorpay_signature': '',
        }

    # ONLINE (Razorpay) verification
    razorpay_order_id = str(data.get('razorpay_order_id') or data.get('order_id') or '').strip()
    razorpay_payment_id = str(data.get('razorpay_payment_id') or data.get('payment_id') or '').strip()
    razorpay_signature = str(data.get('razorpay_signature') or data.get('signature') or '').strip()

    if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
        raise OPDPaymentError(
            "Online payment verification failed: 'razorpay_order_id', 'razorpay_payment_id', and 'razorpay_signature' "
            "are mandatory. Payment cannot be marked successful based solely on frontend status.",
            status_code=status.HTTP_400_BAD_REQUEST,
            extra={'can_retry': True}
        )

    # Check if payment ID was already used
    if Payment.objects.filter(transaction_reference=razorpay_payment_id).exists():
        raise OPDPaymentError(
            f"Duplicate online payment detected: transaction '{razorpay_payment_id}' has already been recorded.",
            status_code=status.HTTP_409_CONFLICT
        )

    gw_order = PaymentGatewayOrder.objects.select_for_update().filter(gateway_order_id=razorpay_order_id).first()
    if not gw_order:
        raise OPDPaymentError(
            f"Online payment order '{razorpay_order_id}' was not found on the server. Unverified frontend orders are rejected.",
            status_code=status.HTTP_400_BAD_REQUEST,
            extra={'can_retry': True}
        )

    if gw_order.status == GatewayOrderStatus.PAID:
        raise OPDPaymentError(
            f"Duplicate payment detected: gateway order '{razorpay_order_id}' has already been settled.",
            status_code=status.HTTP_409_CONFLICT
        )

    if gw_order.patient_id != patient.id:
        raise OPDPaymentError(
            "Online payment order patient mismatch: this payment order was created for a different patient.",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    if gw_order.amount != expected_fee:
        raise OPDPaymentError(
            f"Online payment order amount (₹{gw_order.amount:.2f}) does not match the consultation fee (₹{expected_fee:.2f}).",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    active_key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', os.getenv('RAZORPAY_KEY_SECRET', RAZORPAY_KEY_SECRET))
    is_valid_sig = verify_razorpay_signature(
        order_id=razorpay_order_id,
        payment_id=razorpay_payment_id,
        signature=razorpay_signature,
        secret=active_key_secret
    )
    if not is_valid_sig:
        gw_order.status = GatewayOrderStatus.FAILED
        gw_order.save(update_fields=['status', 'updated_at'])
        BillingAuditEvent.objects.create(
            action='OPD_GATEWAY_SIGNATURE_REJECTED',
            entity_name='PaymentGatewayOrder',
            entity_id=str(gw_order.id),
            performed_by=receptionist_staff,
            details={
                'gateway_order_id': razorpay_order_id,
                'gateway_payment_id': razorpay_payment_id,
                'patient_mrn': patient.medical_record_number,
                'reason': 'Cryptographic HMAC-SHA256 signature verification failed',
            },
            ip_address=request.META.get('REMOTE_ADDR', '')[:45] if request else ''
        )
        raise OPDPaymentError(
            "Online payment verification failed: invalid cryptographic gateway signature. "
            "Appointment/token was NOT created. You may retry the payment.",
            status_code=status.HTTP_400_BAD_REQUEST,
            extra={'payment_status': 'FAILED', 'can_retry': True, 'razorpay_order_id': razorpay_order_id}
        )

    return {
        'payment_method_display': 'ONLINE',
        'payment_method_db': PaymentMethod.ONLINE_GATEWAY,
        'amount': expected_fee,
        'fee_info': fee_info,
        'transaction_reference': razorpay_payment_id,
        'gateway_order': gw_order,
        'razorpay_payment_id': razorpay_payment_id,
        'razorpay_signature': razorpay_signature,
    }


def _record_financial_account_and_gl_entries(
    payment: Payment,
    invoice: Invoice,
    appointment,
    receptionist_staff: StaffProfile,
    branch: Branch,
    department: Department = None,
):
    """
    Ensures the payment is reflected across Financial Accounts, Financial Transactions,
    and General Ledger reports.
    """
    try:
        is_cash = payment.payment_method == PaymentMethod.CASH
        acc_type = FinancialAccountType.CASH if is_cash else FinancialAccountType.GATEWAY_CLEARING
        default_code = f"ACC-{'CASH' if is_cash else 'GW'}-{branch.code if branch else 'MAIN'}"
        default_name = (
            f"{branch.name if branch else 'Main'} OPD Cash Counter"
            if is_cash
            else f"{branch.name if branch else 'Main'} Online Gateway Clearing"
        )

        fin_account = FinancialAccount.objects.filter(
            account_type=acc_type,
            branch=branch,
            is_active=True
        ).first()
        if not fin_account:
            fin_account, _ = FinancialAccount.objects.get_or_create(
                account_code=default_code[:50],
                defaults={
                    'name': default_name[:150],
                    'account_type': acc_type,
                    'classification': AccountingClassification.ASSET,
                    'institution_name': 'Hospital Front Desk Treasury' if is_cash else 'Razorpay Payment Gateway',
                    'branch': branch,
                    'department': department,
                    'currency': 'INR',
                    'opening_balance': Decimal('0.00'),
                    'current_balance': Decimal('0.00'),
                    'is_active': True,
                    'created_by': receptionist_staff,
                }
            )

        tx_num = f"FTX-OPD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        FinancialAccountTransaction.objects.create(
            account=fin_account,
            transaction_number=tx_num,
            transaction_date=timezone.localdate(),
            accounting_date=timezone.localdate(),
            transaction_type=TransactionType.CREDIT,
            category=FinancialTransactionCategory.OPD_IPD_COLLECTION,
            description=(
                f"OPD Consultation Fee ({payment.get_payment_method_display()}) - "
                f"{appointment.patient.user_profile.full_name} ({appointment.appointment_number} / {appointment.token_number})"
            )[:255],
            counterparty=appointment.patient.user_profile.full_name[:150],
            amount=payment.amount,
            debit_amount=payment.amount,
            credit_amount=Decimal('0.00'),
            payment_method=payment.payment_method,
            reference_number=payment.transaction_reference,
            posting_status='POSTED',
            lifecycle_status=TransactionLifecycleStatus.POSTED,
            branch=branch,
            department=department,
            payment=payment,
            created_by=receptionist_staff,
            approved_by=receptionist_staff,
            approved_at=timezone.now(),
            posted_by=receptionist_staff,
            posted_at=timezone.now(),
        )
        fin_account.current_balance = (fin_account.current_balance or Decimal('0.00')) + payment.amount
        fin_account.save(update_fields=['current_balance', 'updated_at'])
    except Exception as exc:
        logger.warning("Non-fatal error recording FinancialAccountTransaction for OPD payment: %s", exc)

    try:
        from apps.billing_finance.general_ledger_service import GeneralLedgerService
        GeneralLedgerService.auto_post_module_event(
            event_type='PATIENT_PAYMENT',
            payload={
                'source_id': str(payment.id),
                'source_module': 'OPD_PAYMENT',
                'amount': payment.amount,
                'payment_method': payment.payment_method,
                'reference': payment.payment_number,
                'narration': (
                    f"OPD Consultation Fee received ({payment.payment_number}) for "
                    f"{appointment.appointment_number} ({appointment.token_number})"
                ),
                'branch_id': branch.id if branch else None,
                'department_id': department.id if department else None,
                'date': timezone.localdate(),
            },
            staff_profile=receptionist_staff
        )
    except Exception as exc:
        logger.warning("Non-fatal error posting OPD payment to General Ledger: %s", exc)


def settle_opd_appointment_and_payment(
    appointment,
    validated_payment: dict,
    receptionist_staff: StaffProfile,
    request=None,
) -> dict:
    """
    Atomically generates the paid Invoice, InvoiceItem, Payment, PaymentReceipt,
    updates PaymentGatewayOrder (if online), updates FinancialAccounts/GL,
    and returns the complete printable receipt payload.
    Must be called inside `with transaction.atomic():`.
    """
    patient = appointment.patient
    doctor = appointment.doctor
    branch = appointment.branch or doctor.branch or patient.primary_branch or Branch.objects.first()
    department = appointment.department or doctor.department
    hospital = (branch.hospital if branch and getattr(branch, 'hospital', None) else None) or Hospital.objects.first()

    fee = validated_payment['amount']
    fee_info = validated_payment['fee_info']
    payment_method_db = validated_payment['payment_method_db']
    payment_method_display = validated_payment['payment_method_display']
    tx_ref = validated_payment['transaction_reference']
    gw_order = validated_payment.get('gateway_order')

    today_str = timezone.now().strftime('%Y%m%d')
    now_ts = timezone.now()

    # 1. Create PAID Invoice & Consultation Line Item
    inv_number = f"INV-OPD-{today_str}-{uuid.uuid4().hex[:6].upper()}"
    invoice = Invoice.objects.create(
        invoice_number=inv_number,
        patient=patient,
        branch=branch,
        encounter_type='OPD',
        appointment=appointment,
        invoice_date=now_ts.date(),
        subtotal=fee,
        total_amount=fee,
        paid_amount=fee,
        balance_amount=Decimal('0.00'),
        status=InvoiceStatus.PAID,
        notes=(
            f"Paid OPD Consultation ({payment_method_display}) with Dr. {doctor.user_profile.full_name} "
            f"[{appointment.appointment_number} / {appointment.token_number}]"
        )
    )

    InvoiceItem.objects.create(
        invoice=invoice,
        service=fee_info.get('service'),
        item_type=ChargeItemType.CONSULTATION,
        description=f"OPD Consultation Fee - Dr. {doctor.user_profile.full_name} ({doctor.specialization or 'Consultant'})",
        source_reference=f"APPOINTMENT:{appointment.id}",
        quantity=1,
        unit_price=fee,
        subtotal=fee,
        line_total=fee,
    )

    appointment.invoice = invoice
    appointment.save(update_fields=['invoice', 'updated_at'])

    # 2. Create Payment record linked to Receptionist
    pay_number = f"PAY-OPD-{today_str}-{uuid.uuid4().hex[:6].upper()}"
    payment = Payment.objects.create(
        payment_number=pay_number,
        invoice=invoice,
        patient=patient,
        branch=branch,
        amount=fee,
        payment_method=payment_method_db,
        transaction_reference=tx_ref,
        received_by=receptionist_staff,
        payment_date=now_ts,
    )

    # 3. Create Official PaymentReceipt
    rec_number = f"REC-OPD-{today_str}-{uuid.uuid4().hex[:6].upper()}"
    receipt = PaymentReceipt.objects.create(
        receipt_number=rec_number,
        invoice=invoice,
        payment=payment,
        patient=patient,
        amount_paid=fee,
        balance_after_payment=Decimal('0.00'),
        cashier=receptionist_staff,
        payment_method=payment_method_db,
        payment_date=now_ts,
    )

    # 4. Update Gateway Order if Online payment
    if gw_order:
        gw_order.invoice = invoice
        gw_order.status = GatewayOrderStatus.PAID
        gw_order.gateway_payment_id = validated_payment.get('razorpay_payment_id', tx_ref)
        gw_order.signature = validated_payment.get('razorpay_signature', '')
        gw_order.save(update_fields=['invoice', 'status', 'gateway_payment_id', 'signature', 'updated_at'])

    # 5. Update Financial Accounts & General Ledger
    _record_financial_account_and_gl_entries(
        payment=payment,
        invoice=invoice,
        appointment=appointment,
        receptionist_staff=receptionist_staff,
        branch=branch,
        department=department,
    )

    # 6. Immutable Billing & Activity Audit Trails
    ip_addr = request.META.get('REMOTE_ADDR', '')[:45] if request else ''
    BillingAuditEvent.objects.create(
        action='OPD_CONSULTATION_PAYMENT_COLLECTED',
        entity_name='PaymentReceipt',
        entity_id=str(receipt.id),
        performed_by=receptionist_staff,
        details={
            'receipt_number': rec_number,
            'payment_number': pay_number,
            'invoice_number': inv_number,
            'appointment_number': appointment.appointment_number,
            'token_number': appointment.token_number,
            'appointment_type': appointment.appointment_type,
            'payment_method': payment_method_display,
            'payment_method_db': payment_method_db,
            'amount': str(fee),
            'currency': 'INR',
            'transaction_reference': tx_ref,
            'patient_mrn': patient.medical_record_number,
            'patient_name': patient.user_profile.full_name,
            'doctor_name': doctor.user_profile.full_name,
            'receptionist_name': receptionist_staff.user_profile.full_name,
            'receptionist_employee_id': receptionist_staff.employee_id,
        },
        ip_address=ip_addr,
    )

    if request:
        ActivityLogService.record(
            action='OPD_PAYMENT_AND_BOOKING_COMPLETED',
            entity_type='Appointment',
            entity_id=str(appointment.id),
            module='OPD',
            request=request,
            branch=branch,
            new_values={
                'appointment_number': appointment.appointment_number,
                'token_number': appointment.token_number,
                'invoice_number': inv_number,
                'receipt_number': rec_number,
                'payment_number': pay_number,
                'payment_method': payment_method_display,
                'amount_inr': f"₹{fee:.2f}",
                'transaction_reference': tx_ref,
                'patient_id': str(patient.id),
                'department': department.name if department else '',
                'processed_by': receptionist_staff.user_profile.full_name,
            },
            description=(
                f"Receptionist {receptionist_staff.user_profile.full_name} collected ₹{fee:.2f} via {payment_method_display} "
                f"(Receipt {rec_number}) and confirmed {appointment.appointment_number} ({appointment.token_number})."
            )
        )

    receipt_payload = {
        'receipt_id': str(receipt.id),
        'receipt_number': rec_number,
        'payment_id': str(payment.id),
        'payment_number': pay_number,
        'invoice_id': str(invoice.id),
        'invoice_number': inv_number,
        'invoice_status': invoice.status,
        'appointment_id': str(appointment.id),
        'appointment_number': appointment.appointment_number,
        'appointment_type': appointment.appointment_type,
        'token_number': appointment.token_number,
        'appointment_date': str(appointment.appointment_date),
        'time_slot': appointment.time_slot,
        'check_in_time': now_ts.strftime('%H:%M:%S'),
        'date': str(appointment.appointment_date),
        'payment_date': now_ts.isoformat(),
        'payment_date_display': now_ts.strftime('%d %b %Y, %I:%M %p'),
        # Hospital & Branch details
        'hospital_name': hospital.name if hospital else 'Aura Multi-Specialty Hospital',
        'hospital_code': hospital.code if hospital else 'HOSP-HQ',
        'hospital_address': (
            f"{branch.address_line1}, {branch.city}, {branch.state} {branch.postal_code}".strip(', ')
            if branch and getattr(branch, 'address_line1', '')
            else (
                f"{hospital.address_line1}, {hospital.city}, {hospital.state} {hospital.postal_code}".strip(', ')
                if hospital and getattr(hospital, 'address_line1', '')
                else 'Main Hospital Campus, Healthcare District'
            )
        ),
        'hospital_phone': (
            branch.phone if branch and getattr(branch, 'phone', '')
            else (getattr(hospital, 'contact_phone', '') or '+91 40 2345 6789')
        ),
        'hospital_email': (
            branch.email if branch and getattr(branch, 'email', '')
            else (getattr(hospital, 'contact_email', '') or 'billing@aurahospital.org')
        ),
        'branch_id': str(branch.id) if branch else None,
        'branch_name': branch.name if branch else 'Main Branch',
        # Patient details
        'patient_id': str(patient.id),
        'patient_name': patient.user_profile.full_name,
        'patient_mrn': patient.medical_record_number,
        'patient_phone': patient.user_profile.phone_number or '',
        'patient_gender': patient.gender or '',
        'patient_blood_group': patient.blood_group or '',
        # Doctor & Department details
        'doctor_id': str(doctor.id),
        'doctor_name': doctor.user_profile.full_name,
        'specialization': doctor.specialization or 'General Medicine',
        'department_name': department.name if department else 'General OPD',
        # Payment & Fee details in Indian Rupees (₹)
        'consultation_fee': f"{fee:.2f}",
        'amount_paid': f"{fee:.2f}",
        'balance_amount': '0.00',
        'currency': 'INR',
        'currency_symbol': '₹',
        'formatted_amount': f"₹{fee:.2f}",
        'fee_source': fee_info.get('fee_source', 'DOCTOR_PROFILE'),
        'payment_method': payment_method_display,
        'payment_method_code': payment_method_db,
        'payment_status': 'PAID',
        'transaction_reference': tx_ref,
        # Receptionist / Cashier details
        'processed_by_id': str(receptionist_staff.id),
        'processed_by_name': receptionist_staff.user_profile.full_name,
        'processed_by_employee_id': receptionist_staff.employee_id,
    }

    return {
        'invoice': invoice,
        'payment': payment,
        'receipt': receipt,
        'receipt_payload': receipt_payload,
    }
