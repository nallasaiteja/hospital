import os
import hmac
import hashlib
import json
import uuid
from decimal import Decimal
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.authentication.models import PatientProfile, StaffProfile
from apps.authentication.utils import get_staff_profile, get_patient_profile
from .models import (
    Invoice, InvoiceStatus, PatientDeposit, Payment, PaymentMethod,
    PaymentReceipt, PaymentGatewayOrder, GatewayOrderStatus,
    PaymentWebhookLog, GatewaySettlement, BillingAuditEvent
)
from .serializers import (
    PaymentGatewayOrderSerializer, PaymentWebhookLogSerializer,
    GatewaySettlementSerializer
)


RAZORPAY_KEY_ID = getattr(settings, 'RAZORPAY_KEY_ID', os.getenv('RAZORPAY_KEY_ID', 'rzp_test_mock_key_12345'))
RAZORPAY_KEY_SECRET = getattr(settings, 'RAZORPAY_KEY_SECRET', os.getenv('RAZORPAY_KEY_SECRET', 'mock_secret_key_67890'))
RAZORPAY_WEBHOOK_SECRET = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', os.getenv('RAZORPAY_WEBHOOK_SECRET', 'mock_webhook_secret_999'))


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str, secret: str = RAZORPAY_KEY_SECRET) -> bool:
    """
    Cryptographic verification of Razorpay payment signature via HMAC-SHA256.
    """
    if not signature or not order_id or not payment_id:
        return False
    msg = f"{order_id}|{payment_id}".encode('utf-8')
    generated_sig = hmac.new(secret.encode('utf-8'), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(generated_sig, signature)


def verify_razorpay_webhook_signature(raw_body: bytes, signature: str, secret: str = RAZORPAY_WEBHOOK_SECRET) -> bool:
    """
    Cryptographic verification of raw webhook payload signature via HMAC-SHA256.
    """
    if not signature:
        return False
    generated_sig = hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(generated_sig, signature)


class RazorpayCreateOrderView(views.APIView):
    """
    Server-side Razorpay order generation with validated database amounts and idempotency protection.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        data = request.data
        invoice_id = data.get('invoice_id')
        deposit_id = data.get('deposit_id')
        idempotency_key = data.get('idempotency_key') or f"idemp_{uuid.uuid4().hex}"

        # Check existing order with same idempotency key
        existing_order = PaymentGatewayOrder.objects.filter(idempotency_key=idempotency_key).first()
        if existing_order:
            return Response(PaymentGatewayOrderSerializer(existing_order).data, status=status.HTTP_200_OK)

        invoice = None
        deposit = None
        patient = None
        amount = Decimal('0.00')

        if invoice_id:
            invoice = Invoice.objects.select_for_update().filter(id=invoice_id).first()
            if not invoice:
                return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)
            if invoice.balance_amount <= Decimal('0.00'):
                return Response({'error': 'Invoice is already fully paid.'}, status=status.HTTP_400_BAD_REQUEST)
            patient = invoice.patient
            # Server calculates amount, optionally allowing partial payment
            req_amount = data.get('amount')
            if req_amount:
                amount = min(Decimal(str(req_amount)), invoice.balance_amount)
            else:
                amount = invoice.balance_amount

        elif deposit_id:
            deposit = PatientDeposit.objects.filter(id=deposit_id).first()
            if not deposit:
                return Response({'error': 'Deposit not found.'}, status=status.HTTP_404_NOT_FOUND)
            patient = deposit.patient
            amount = deposit.amount
        else:
            return Response({'error': 'Either invoice_id or deposit_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= Decimal('0.00'):
            return Response({'error': 'Payment amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        # Generate unique order id for gateway
        gateway_order_id = f"order_{uuid.uuid4().hex[:14]}"
        amount_in_paise = int(amount * 100)

        is_sandbox = not bool(os.getenv('RAZORPAY_LIVE_KEY_ID'))

        order = PaymentGatewayOrder.objects.create(
            gateway_order_id=gateway_order_id,
            gateway_name='RAZORPAY',
            invoice=invoice,
            deposit=deposit,
            patient=patient,
            amount=amount,
            currency='INR',
            status=GatewayOrderStatus.INITIATED,
            idempotency_key=idempotency_key,
            notes=f"Order for {'Invoice ' + invoice.invoice_number if invoice else 'Deposit ' + deposit.receipt_number}"
        )

        return Response({
            'order_id': gateway_order_id,
            'amount': str(amount),
            'amount_in_paise': amount_in_paise,
            'currency': 'INR',
            'key_id': RAZORPAY_KEY_ID,
            'is_sandbox': is_sandbox,
            'patient_name': patient.user_profile.full_name,
            'patient_email': patient.user_profile.email,
            'invoice_number': invoice.invoice_number if invoice else None,
            'gateway_order': PaymentGatewayOrderSerializer(order).data
        }, status=status.HTTP_201_CREATED)


class RazorpayVerifyPaymentView(views.APIView):
    """
    Authoritative verification of checkout response with HMAC-SHA256 signature checking.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        data = request.data
        gateway_order_id = data.get('razorpay_order_id')
        gateway_payment_id = data.get('razorpay_payment_id')
        signature = data.get('razorpay_signature')

        if not gateway_order_id or not gateway_payment_id:
            return Response({'error': 'razorpay_order_id and razorpay_payment_id are required.'}, status=status.HTTP_400_BAD_REQUEST)

        order = PaymentGatewayOrder.objects.select_for_update().filter(gateway_order_id=gateway_order_id).first()
        if not order:
            return Response({'error': 'Gateway order record not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Idempotency check: if already settled, return receipt directly
        if order.status == GatewayOrderStatus.PAID:
            existing_payment = Payment.objects.filter(transaction_reference=gateway_payment_id).first()
            return Response({
                'message': 'Payment was already verified and settled.',
                'payment_number': existing_payment.payment_number if existing_payment else None,
                'status': 'PAID'
            }, status=status.HTTP_200_OK)

        # Cryptographic verification
        # In sandbox test mode, accept simulated signature if secret matches mock test
        is_valid = verify_razorpay_signature(gateway_order_id, gateway_payment_id, signature)
        if not is_valid:
            # Check test sandbox mock signature
            test_sig = hmac.new(RAZORPAY_KEY_SECRET.encode('utf-8'), f"{gateway_order_id}|{gateway_payment_id}".encode('utf-8'), hashlib.sha256).hexdigest()
            if signature != test_sig:
                order.status = GatewayOrderStatus.FAILED
                order.save()
                return Response({'error': 'Invalid cryptographic signature! Payment verification rejected.'}, status=status.HTTP_400_BAD_REQUEST)

        order.status = GatewayOrderStatus.PAID
        order.gateway_payment_id = gateway_payment_id
        order.signature = signature or ''
        order.save()

        # Update invoice & issue receipt
        invoice = order.invoice
        if invoice:
            invoice = Invoice.objects.select_for_update().get(id=invoice.id)
            pay_num = f"PAY-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            staff = get_staff_profile(request.user) or StaffProfile.objects.first()

            payment = Payment.objects.create(
                payment_number=pay_num,
                invoice=invoice,
                patient=invoice.patient,
                branch=invoice.branch,
                amount=order.amount,
                payment_method=PaymentMethod.ONLINE_GATEWAY,
                transaction_reference=gateway_payment_id,
                received_by=staff
            )

            invoice.paid_amount += order.amount
            invoice.recalculate_totals()

            rec_num = f"REC-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            receipt = PaymentReceipt.objects.create(
                receipt_number=rec_num,
                invoice=invoice,
                payment=payment,
                patient=invoice.patient,
                amount_paid=order.amount,
                balance_after_payment=invoice.balance_amount,
                cashier=staff,
                payment_method=PaymentMethod.ONLINE_GATEWAY
            )

            return Response({
                'success': True,
                'message': f"Payment of ₹{order.amount} verified and settled successfully.",
                'receipt_number': rec_num,
                'payment_number': pay_num,
                'invoice_balance': str(invoice.balance_amount),
                'invoice_status': invoice.status
            }, status=status.HTTP_200_OK)

        return Response({'success': True, 'message': 'Payment order confirmed.', 'status': 'PAID'}, status=status.HTTP_200_OK)


class RazorpayWebhookView(views.APIView):
    """
    Secure Webhook endpoint processing signed asynchronous payment events from Razorpay.
    """
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        signature = request.headers.get('X-Razorpay-Signature', '')
        raw_body = request.body

        # Verify cryptographic signature
        is_verified = verify_razorpay_webhook_signature(raw_body, signature)
        if not is_verified and not getattr(settings, 'DEBUG', False):
            return Response({'error': 'Invalid webhook signature.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = json.loads(raw_body.decode('utf-8'))
        except Exception as e:
            return Response({'error': f'Invalid JSON payload: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        event_id = payload.get('event_id') or payload.get('id') or f"evt_{uuid.uuid4().hex[:10]}"
        event_type = payload.get('event', 'unknown')

        # Idempotency check: duplicate event protection
        if PaymentWebhookLog.objects.filter(event_id=event_id).exists():
            return Response({'message': 'Webhook event already processed (idempotent).'}, status=status.HTTP_200_OK)

        webhook_log = PaymentWebhookLog.objects.create(
            gateway_name='RAZORPAY',
            event_id=event_id,
            event_type=event_type,
            payload=payload,
            signature=signature,
            is_verified=is_verified
        )

        # Process payment events
        if event_type == 'payment.captured':
            payment_entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
            order_id = payment_entity.get('order_id')
            payment_id = payment_entity.get('id')
            amount_paise = payment_entity.get('amount', 0)
            amount = Decimal(str(amount_paise)) / Decimal('100.00')

            order = PaymentGatewayOrder.objects.select_for_update().filter(gateway_order_id=order_id).first()
            if order and order.status != GatewayOrderStatus.PAID:
                order.status = GatewayOrderStatus.PAID
                order.gateway_payment_id = payment_id
                order.save()

                invoice = order.invoice
                if invoice:
                    invoice = Invoice.objects.select_for_update().get(id=invoice.id)
                    pay_num = f"PAY-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                    staff = StaffProfile.objects.first()

                    payment = Payment.objects.create(
                        payment_number=pay_num,
                        invoice=invoice,
                        patient=invoice.patient,
                        branch=invoice.branch,
                        amount=amount,
                        payment_method=PaymentMethod.ONLINE_GATEWAY,
                        transaction_reference=payment_id,
                        received_by=staff
                    )

                    invoice.paid_amount += amount
                    invoice.recalculate_totals()

                    rec_num = f"REC-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                    PaymentReceipt.objects.create(
                        receipt_number=rec_num,
                        invoice=invoice,
                        payment=payment,
                        patient=invoice.patient,
                        amount_paid=amount,
                        balance_after_payment=invoice.balance_amount,
                        cashier=staff,
                        payment_method=PaymentMethod.ONLINE_GATEWAY
                    )

        elif event_type == 'payment.failed':
            payment_entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
            order_id = payment_entity.get('order_id')
            order = PaymentGatewayOrder.objects.filter(gateway_order_id=order_id).first()
            if order:
                order.status = GatewayOrderStatus.FAILED
                order.save()

        return Response({'status': 'Webhook processed successfully.', 'event': event_type}, status=status.HTTP_200_OK)


class GatewaySettlementViewSet(viewsets.ModelViewSet):
    """
    Gateway Settlement Reconciliation & Fee Accounting (Gross vs Fees vs Net Payout).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = GatewaySettlementSerializer

    def get_queryset(self):
        return GatewaySettlement.objects.all().order_by('-settlement_date')
