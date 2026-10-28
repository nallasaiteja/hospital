import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, Q, Count
from rest_framework import status, views, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.core.models import Branch, Department
from apps.authentication.models import PatientProfile, StaffProfile
from apps.authentication.utils import get_staff_profile, get_patient_profile
from apps.authentication.permissions import IsStaffMember

from .models import (
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
    BillingAuditEvent
)
from .serializers import (
    HospitalServiceSerializer, TariffPlanSerializer, TariffRateSerializer,
    HospitalPackageSerializer, PackageComponentSerializer,
    PatientPackageSubscriptionSerializer, PackageUsageLogSerializer,
    InvoiceSerializer, InvoiceItemSerializer, PaymentSerializer,
    PaymentReceiptSerializer, DiscountRequestSerializer,
    PatientDepositSerializer, DepositAllocationSerializer,
    PatientCreditNoteSerializer, PatientRefundSerializer,
    CashierShiftSerializer, BillingAuditEventSerializer
)


def log_billing_audit(action_name, entity_name, entity_id, staff=None, details=None, ip=''):
    BillingAuditEvent.objects.create(
        action=action_name,
        entity_name=entity_name,
        entity_id=str(entity_id),
        performed_by=staff,
        details=details or {},
        ip_address=ip
    )


class HospitalServiceViewSet(viewsets.ModelViewSet):
    """
    Centralized Service Catalogue & Master Tariffs.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = HospitalServiceSerializer

    def get_queryset(self):
        qs = HospitalService.objects.select_related('department').all()
        category = self.request.query_params.get('category')
        is_active = self.request.query_params.get('is_active')
        search = self.request.query_params.get('search')
        if category:
            qs = qs.filter(category=category)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(service_code__icontains=search))
        return qs

    def perform_create(self, serializer):
        service = serializer.save()
        staff = get_staff_profile(self.request.user)
        log_billing_audit('SERVICE_CREATED', 'HospitalService', service.id, staff, {
            'code': service.service_code, 'name': service.name, 'price': str(service.standard_price)
        })

    def perform_update(self, serializer):
        service = serializer.save()
        staff = get_staff_profile(self.request.user)
        log_billing_audit('SERVICE_UPDATED', 'HospitalService', service.id, staff, {
            'code': service.service_code, 'price': str(service.standard_price), 'is_active': service.is_active
        })


class TariffPlanViewSet(viewsets.ModelViewSet):
    """
    Tariff Plans (Standard, Insurance, Patient-Specific, Corporate).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TariffPlanSerializer

    def get_queryset(self):
        qs = TariffPlan.objects.prefetch_related('rates__service').select_related('insurance_provider', 'patient__user_profile')
        tariff_type = self.request.query_params.get('tariff_type')
        if tariff_type:
            qs = qs.filter(tariff_type=tariff_type)
        return qs

    @action(detail=True, methods=['post'], url_path='set-rate')
    def set_rate(self, request, pk=None):
        plan = self.get_object()
        service_id = request.data.get('service_id')
        rate = request.data.get('rate')
        if not service_id or rate is None:
            return Response({'error': 'service_id and rate are required.'}, status=status.HTTP_400_BAD_REQUEST)
        service = HospitalService.objects.filter(id=service_id).first()
        if not service:
            return Response({'error': 'Service not found.'}, status=status.HTTP_404_NOT_FOUND)

        tariff_rate, created = TariffRate.objects.update_or_create(
            tariff_plan=plan,
            service=service,
            defaults={'rate': Decimal(str(rate))}
        )
        staff = get_staff_profile(request.user)
        log_billing_audit('TARIFF_RATE_SET', 'TariffRate', tariff_rate.id, staff, {
            'plan': plan.code, 'service': service.service_code, 'rate': str(rate)
        })
        return Response(TariffRateSerializer(tariff_rate).data, status=status.HTTP_200_OK)


class HospitalPackageViewSet(viewsets.ModelViewSet):
    """
    Hospital Care Packages (Maternity, Knee Replacement, Executive Health Checkup).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = HospitalPackageSerializer

    def get_queryset(self):
        return HospitalPackage.objects.prefetch_related('components__service').select_related('department')

    @action(detail=True, methods=['post'], url_path='add-component')
    def add_component(self, request, pk=None):
        package = self.get_object()
        service_id = request.data.get('service_id')
        qty = int(request.data.get('quantity_included', 1))
        service = HospitalService.objects.filter(id=service_id).first()
        if not service:
            return Response({'error': 'Service not found.'}, status=status.HTTP_404_NOT_FOUND)

        comp, created = PackageComponent.objects.update_or_create(
            package=package,
            service=service,
            defaults={'quantity_included': qty}
        )
        return Response(PackageComponentSerializer(comp).data, status=status.HTTP_200_OK)


class PackageSubscriptionViewSet(viewsets.ModelViewSet):
    """
    Patient assignment of packages and tracking of consumed bundle components.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PatientPackageSubscriptionSerializer

    def get_queryset(self):
        qs = PatientPackageSubscription.objects.prefetch_related('usage_logs__service').select_related('patient__user_profile', 'package', 'branch')
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        patient = PatientProfile.objects.filter(id=data['patient_id']).first()
        package = HospitalPackage.objects.filter(id=data['package_id']).first()
        if not patient or not package:
            return Response({'error': 'Valid patient and package are required.'}, status=status.HTTP_400_BAD_REQUEST)

        branch = patient.primary_branch or Branch.objects.first()
        sub_num = f"PKG-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        expires_at = timezone.now() + timezone.timedelta(days=package.validity_days)

        subscription = PatientPackageSubscription.objects.create(
            subscription_number=sub_num,
            patient=patient,
            package=package,
            branch=branch,
            admission_id=data.get('admission_id'),
            appointment_id=data.get('appointment_id'),
            expires_at=expires_at,
            status=PackageSubscriptionStatus.ACTIVE
        )
        staff = get_staff_profile(request.user)
        log_billing_audit('PACKAGE_SUBSCRIBED', 'PatientPackageSubscription', subscription.id, staff, {
            'patient': patient.user_profile.full_name, 'package': package.name, 'price': str(package.total_price)
        })
        return Response(PatientPackageSubscriptionSerializer(subscription).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='consume-service')
    def consume_service(self, request, pk=None):
        sub = self.get_object()
        if sub.status != PackageSubscriptionStatus.ACTIVE:
            return Response({'error': f"Package subscription is {sub.status}. Cannot consume services."}, status=status.HTTP_400_BAD_REQUEST)

        service_id = request.data.get('service_id')
        qty = int(request.data.get('quantity', 1))
        service = HospitalService.objects.filter(id=service_id).first()
        if not service:
            return Response({'error': 'Service not found.'}, status=status.HTTP_404_NOT_FOUND)

        comp = sub.package.components.filter(service=service).first()
        if not comp:
            return Response({'error': f"Service '{service.name}' is NOT covered under package '{sub.package.name}'."}, status=status.HTTP_400_BAD_REQUEST)

        consumed_so_far = sub.usage_logs.filter(service=service).aggregate(total=Sum('quantity_consumed'))['total'] or 0
        if consumed_so_far + qty > comp.quantity_included:
            return Response({
                'error': f"Allowable package limit exceeded! Included: {comp.quantity_included}, Already Consumed: {consumed_so_far}, Requested: {qty}"
            }, status=status.HTTP_400_BAD_REQUEST)

        usage = PackageUsageLog.objects.create(
            subscription=sub,
            service=service,
            quantity_consumed=qty,
            notes=request.data.get('notes', '')
        )

        total_included = sum(c.quantity_included for c in sub.package.components.all())
        total_consumed = sub.usage_logs.aggregate(total=Sum('quantity_consumed'))['total'] or 0
        if total_consumed >= total_included:
            sub.status = PackageSubscriptionStatus.EXHAUSTED
            sub.save()

        return Response(PackageUsageLogSerializer(usage).data, status=status.HTTP_201_CREATED)


class CentralBillingViewSet(viewsets.ModelViewSet):
    """
    Centralized Patient Invoicing Engine covering OPD, IPD, Lab, Pharmacy, Surgeries, ICU, and Emergency.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Invoice.objects.prefetch_related(
            'items__service', 'payments__received_by__user_profile', 'issued_receipts',
            'discount_requests', 'deposit_allocations__deposit', 'patient_credit_notes', 'patient_refunds'
        ).select_related('patient__user_profile', 'branch', 'tariff_plan', 'package_subscription__package')

        patient = get_patient_profile(user)
        if patient:
            return qs.filter(patient=patient)

        branch_id = self.request.query_params.get('branch_id')
        encounter_type = self.request.query_params.get('encounter_type')
        status_filter = self.request.query_params.get('status')
        patient_id = self.request.query_params.get('patient_id')
        search = self.request.query_params.get('search')

        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if encounter_type:
            qs = qs.filter(encounter_type=encounter_type)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        if search:
            qs = qs.filter(
                Q(invoice_number__icontains=search) |
                Q(patient__user_profile__first_name__icontains=search) |
                Q(patient__user_profile__last_name__icontains=search) |
                Q(patient__medical_record_number__icontains=search)
            )
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        patient = PatientProfile.objects.filter(id=data['patient_id']).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        branch = Branch.objects.filter(id=data.get('branch_id')).first() or patient.primary_branch or Branch.objects.first()
        encounter_type = data.get('encounter_type', 'GENERAL')

        # Tariff plan resolution
        tariff_plan = None
        if data.get('tariff_plan_id'):
            tariff_plan = TariffPlan.objects.filter(id=data['tariff_plan_id']).first()
        if not tariff_plan:
            # Check patient-specific custom tariff
            tariff_plan = TariffPlan.objects.filter(patient=patient, is_active=True).first()

        # Check active package subscription
        package_sub = None
        if data.get('package_subscription_id'):
            package_sub = PatientPackageSubscription.objects.filter(id=data['package_subscription_id'], status=PackageSubscriptionStatus.ACTIVE).first()

        inv_num = f"INV-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        invoice = Invoice.objects.create(
            invoice_number=inv_num,
            patient=patient,
            branch=branch,
            encounter_type=encounter_type,
            appointment_id=data.get('appointment_id'),
            admission_id=data.get('admission_id'),
            emergency_encounter_id=data.get('emergency_encounter_id'),
            tariff_plan=tariff_plan,
            package_subscription=package_sub,
            is_interim=data.get('is_interim', False),
            is_final=data.get('is_final', False),
            invoice_date=data.get('invoice_date', timezone.now().date()),
            due_date=data.get('due_date'),
            discount_amount=Decimal(str(data.get('discount_amount', '0.00'))),
            tax_amount=Decimal(str(data.get('tax_amount', '0.00'))),
            notes=data.get('notes', '')
        )

        # Process line items with tariff override and duplicate check
        items_data = data.get('items', [])
        subtotal = Decimal('0.00')
        tax_total = Decimal('0.00')

        for item in items_data:
            service_id = item.get('service_id')
            service = HospitalService.objects.filter(id=service_id).first() if service_id else None
            source_ref = item.get('source_reference', '')

            # Check duplicate billing for source reference (e.g. LAB_ORDER:123, DISPENSE:456)
            if source_ref:
                existing_item = InvoiceItem.objects.filter(
                    source_reference=source_ref,
                    invoice__status__in=[InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID]
                ).first()
                if existing_item:
                    transaction.set_rollback(True)
                    return Response({
                        'error': f"Duplicate billing detected! Source charge '{source_ref}' has already been billed on Invoice {existing_item.invoice.invoice_number}."
                    }, status=status.HTTP_400_BAD_REQUEST)

            qty = int(item.get('quantity', 1))
            unit_price = Decimal(str(item.get('unit_price', service.standard_price if service else '0.00')))

            # Check tariff override
            if tariff_plan and service:
                rate_override = tariff_plan.rates.filter(service=service).first()
                if rate_override:
                    unit_price = rate_override.rate

            # Check package coverage
            is_covered = False
            if package_sub and service:
                comp = package_sub.package.components.filter(service=service).first()
                if comp:
                    consumed = package_sub.usage_logs.filter(service=service).aggregate(total=Sum('quantity_consumed'))['total'] or 0
                    if consumed + qty <= comp.quantity_included:
                        is_covered = True
                        PackageUsageLog.objects.create(
                            subscription=package_sub,
                            service=service,
                            quantity_consumed=qty,
                            notes=f"Auto-applied to Invoice {invoice.invoice_number}"
                        )

            tax_rate = Decimal(str(item.get('tax_rate', service.tax_rate if service else '0.00')))
            discount_pct = Decimal(str(item.get('discount_percent', '0.00')))

            inv_item = InvoiceItem.objects.create(
                invoice=invoice,
                service=service,
                item_type=item.get('item_type', service.category if service else ChargeItemType.GENERAL_SERVICE),
                description=item.get('description', service.name if service else 'Hospital Service'),
                source_reference=source_ref,
                is_package_covered=is_covered,
                quantity=qty,
                unit_price=unit_price,
                discount_percent=discount_pct,
                tax_rate=tax_rate
            )
            subtotal += inv_item.subtotal
            tax_total += inv_item.tax_amount

        invoice.subtotal = subtotal
        if tax_total > Decimal('0.00'):
            invoice.tax_amount = tax_total
        invoice.total_amount = max(Decimal('0.00'), (subtotal - invoice.discount_amount) + invoice.tax_amount)
        invoice.balance_amount = invoice.total_amount
        invoice.status = InvoiceStatus.ISSUED
        invoice.save()

        staff = get_staff_profile(request.user)
        log_billing_audit('INVOICE_GENERATED', 'Invoice', invoice.id, staff, {
            'invoice_number': invoice.invoice_number, 'patient': patient.user_profile.full_name,
            'total_amount': str(invoice.total_amount), 'encounter_type': encounter_type
        })

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='generate-inpatient-bill')
    @transaction.atomic
    def generate_inpatient_bill(self, request):
        """
        Interim or Final Inpatient (IPD) discharge bill aggregator with duplicate-prevention across all clinical streams.
        """
        admission_id = request.data.get('admission_id')
        from apps.clinical.models import InpatientAdmission, LabOrder
        from apps.pharmacy_inventory.models import DispenseRecord

        admission = InpatientAdmission.objects.filter(id=admission_id).first()
        if not admission:
            return Response({'error': 'Valid Inpatient Admission is required.'}, status=status.HTTP_404_NOT_FOUND)

        is_final = request.data.get('is_final', False)
        patient = admission.patient
        branch = admission.branch

        inv_num = f"IPD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        invoice = Invoice.objects.create(
            invoice_number=inv_num,
            patient=patient,
            branch=branch,
            encounter_type='IPD',
            admission=admission,
            is_interim=not is_final,
            is_final=is_final,
            invoice_date=timezone.now().date(),
            notes=f"{'Final Discharge Settlement' if is_final else 'Interim Running Bill'} for Admission {admission.admission_number}"
        )

        subtotal = Decimal('0.00')

        # 1. Room / Bed Charges
        if admission.bed:
            days = max(1, (timezone.now().date() - admission.admission_date.date()).days)
            daily_rate = admission.bed.daily_rate
            bed_ref = f"BED_STAY:{admission.id}:{days}_DAYS"
            # Check if this bed stay was already billed
            if not InvoiceItem.objects.filter(source_reference=bed_ref, invoice__status__in=[InvoiceStatus.ISSUED, InvoiceStatus.PAID]).exists():
                item = InvoiceItem.objects.create(
                    invoice=invoice,
                    item_type=ChargeItemType.BED_CHARGE,
                    description=f"Inpatient Bed Charges ({admission.bed.ward.name} - Bed {admission.bed.bed_number}) for {days} days",
                    source_reference=bed_ref,
                    quantity=days,
                    unit_price=daily_rate
                )
                subtotal += item.subtotal

        # 2. Diagnostic Lab Orders under admission
        unbilled_labs = LabOrder.objects.filter(admission=admission, invoice__isnull=True)
        for lab in unbilled_labs:
            lab_ref = f"LAB_ORDER:{lab.id}"
            test_price = Decimal('750.00')
            item = InvoiceItem.objects.create(
                invoice=invoice,
                item_type=ChargeItemType.LAB_TEST,
                description=f"Diagnostic Lab Investigation #{lab.order_number}",
                source_reference=lab_ref,
                quantity=1,
                unit_price=test_price
            )
            subtotal += item.subtotal
            lab.invoice = invoice
            lab.save()

        # 3. Pharmacy Dispense records under admission
        unbilled_dispenses = DispenseRecord.objects.filter(
            Q(prescription__admission=admission) | Q(is_ipd_issue=True, patient=patient),
            invoice__isnull=True
        )
        for disp in unbilled_dispenses:
            disp_ref = f"PHARMACY_DISPENSE:{disp.id}"
            item = InvoiceItem.objects.create(
                invoice=invoice,
                item_type=ChargeItemType.PHARMACY,
                description=f"Inpatient Medication Dispensation #{disp.dispense_number}",
                source_reference=disp_ref,
                quantity=1,
                unit_price=disp.total_amount
            )
            subtotal += item.subtotal
            disp.invoice = invoice
            disp.save()

        invoice.subtotal = subtotal
        invoice.total_amount = subtotal
        invoice.balance_amount = subtotal
        invoice.save()

        # 4. Auto-apply any advance deposit linked to admission
        advance_deposit = PatientDeposit.objects.filter(
            patient=patient, admission=admission, available_balance__gt=Decimal('0.00')
        ).first()
        if advance_deposit:
            alloc_amt = min(advance_deposit.available_balance, invoice.balance_amount)
            if alloc_amt > Decimal('0.00'):
                staff = get_staff_profile(request.user)
                DepositAllocation.objects.create(
                    deposit=advance_deposit,
                    invoice=invoice,
                    allocated_amount=alloc_amt,
                    allocated_by=staff or StaffProfile.objects.first()
                )
                advance_deposit.available_balance -= alloc_amt
                if advance_deposit.available_balance == Decimal('0.00'):
                    advance_deposit.status = DepositStatus.FULLY_UTILIZED
                else:
                    advance_deposit.status = DepositStatus.PARTIALLY_UTILIZED
                advance_deposit.save()

                invoice.deposit_applied_amount += alloc_amt
                invoice.recalculate_totals()

        staff = get_staff_profile(request.user)
        log_billing_audit('INPATIENT_BILL_GENERATED', 'Invoice', invoice.id, staff, {
            'admission': admission.admission_number, 'is_final': is_final, 'total': str(invoice.total_amount)
        })

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


class DiscountRequestViewSet(viewsets.ModelViewSet):
    """
    Discount authorizations with approval limits and separation of duties.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = DiscountRequestSerializer

    def get_queryset(self):
        return DiscountRequest.objects.select_related('invoice', 'requested_by__user_profile', 'approved_by__user_profile')

    def create(self, request, *args, **kwargs):
        data = request.data
        invoice = Invoice.objects.filter(id=data['invoice_id']).first()
        if not invoice:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        disc_type = data.get('discount_type', DiscountType.FIXED_AMOUNT)
        val = Decimal(str(data['discount_value']))
        if disc_type == DiscountType.PERCENTAGE:
            calc_amt = (invoice.subtotal * val) / Decimal('100.00')
        else:
            calc_amt = val

        if calc_amt > invoice.subtotal:
            return Response({'error': 'Discount cannot exceed bill subtotal.'}, status=status.HTTP_400_BAD_REQUEST)

        req_num = f"DISC-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        staff = get_staff_profile(request.user)

        disc_req = DiscountRequest.objects.create(
            request_number=req_num,
            invoice=invoice,
            discount_type=disc_type,
            discount_value=val,
            calculated_amount=calc_amt,
            reason=data.get('reason', 'Administrative concession'),
            requested_by=staff or StaffProfile.objects.first(),
            status=DiscountStatus.PENDING
        )
        log_billing_audit('DISCOUNT_REQUESTED', 'DiscountRequest', disc_req.id, staff, {
            'invoice': invoice.invoice_number, 'amount': str(calc_amt)
        })
        return Response(DiscountRequestSerializer(disc_req).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='approve')
    @transaction.atomic
    def approve(self, request, pk=None):
        disc = self.get_object()
        if disc.status != DiscountStatus.PENDING:
            return Response({'error': f"Discount request is already {disc.status}."}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        # Separation of duties: requester cannot approve their own discount
        if staff and disc.requested_by == staff:
            return Response({'error': 'Separation of duties violation: You cannot approve your own discount request.'}, status=status.HTTP_403_FORBIDDEN)

        disc.status = DiscountStatus.APPROVED
        disc.approved_by = staff
        disc.approved_at = timezone.now()
        disc.save()

        # Apply to invoice
        invoice = disc.invoice
        invoice.discount_amount = disc.calculated_amount
        invoice.approved_discount_reason = disc.reason
        invoice.discount_approved_by = staff
        invoice.discount_approved_at = timezone.now()
        invoice.recalculate_totals()

        log_billing_audit('DISCOUNT_APPROVED', 'DiscountRequest', disc.id, staff, {
            'invoice': invoice.invoice_number, 'discount_amount': str(disc.calculated_amount)
        })
        return Response({'message': 'Discount approved and applied to invoice.', 'invoice': InvoiceSerializer(invoice).data})

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        disc = self.get_object()
        staff = get_staff_profile(request.user)
        disc.status = DiscountStatus.REJECTED
        disc.approved_by = staff
        disc.approved_at = timezone.now()
        disc.rejection_reason = request.data.get('reason', 'Administrative decision')
        disc.save()
        return Response({'message': 'Discount request rejected.', 'status': disc.status})


class PatientDepositViewSet(viewsets.ModelViewSet):
    """
    Inpatient advance deposits and procedure security payments.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PatientDepositSerializer

    def get_queryset(self):
        qs = PatientDeposit.objects.prefetch_related('allocations__invoice').select_related('patient__user_profile', 'received_by__user_profile', 'admission')
        patient_id = self.request.query_params.get('patient_id')
        status_filter = self.request.query_params.get('status')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        patient = PatientProfile.objects.filter(id=data['patient_id']).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        amount = Decimal(str(data['amount']))
        if amount <= Decimal('0.00'):
            return Response({'error': 'Deposit amount must be positive.'}, status=status.HTTP_400_BAD_REQUEST)

        branch = patient.primary_branch or Branch.objects.first()
        staff = get_staff_profile(request.user)
        rec_num = f"DEP-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        deposit = PatientDeposit.objects.create(
            receipt_number=rec_num,
            patient=patient,
            branch=branch,
            admission_id=data.get('admission_id'),
            amount=amount,
            available_balance=amount,
            payment_method=data.get('payment_method', PaymentMethod.CASH),
            transaction_reference=data.get('transaction_reference', ''),
            received_by=staff or StaffProfile.objects.first(),
            notes=data.get('notes', '')
        )
        log_billing_audit('DEPOSIT_COLLECTED', 'PatientDeposit', deposit.id, staff, {
            'patient': patient.user_profile.full_name, 'amount': str(amount), 'receipt': rec_num
        })

        try:
            from .general_ledger_service import GeneralLedgerService
            GeneralLedgerService.auto_post_module_event(
                event_type='PATIENT_ADVANCE',
                payload={
                    'source_id': str(deposit.id),
                    'source_module': 'PATIENT_DEPOSIT',
                    'amount': deposit.amount,
                    'payment_method': deposit.payment_method,
                    'reference': deposit.receipt_number,
                    'narration': f"Patient admission deposit {deposit.receipt_number}",
                    'branch_id': branch.id if branch else None,
                    'date': timezone.localdate(),
                },
                staff_profile=staff
            )
        except Exception:
            pass

        return Response(PatientDepositSerializer(deposit).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='allocate-to-bill')
    @transaction.atomic
    def allocate_to_bill(self, request, pk=None):
        deposit = self.get_object()
        invoice_id = request.data.get('invoice_id')
        invoice = Invoice.objects.select_for_update().filter(id=invoice_id).first()
        if not invoice:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        if deposit.patient != invoice.patient:
            return Response({'error': 'Deposit patient does not match bill patient.'}, status=status.HTTP_400_BAD_REQUEST)

        if deposit.available_balance <= Decimal('0.00'):
            return Response({'error': 'Deposit has no available balance to allocate.'}, status=status.HTTP_400_BAD_REQUEST)

        if invoice.balance_amount <= Decimal('0.00'):
            return Response({'error': 'Invoice has no outstanding balance.'}, status=status.HTTP_400_BAD_REQUEST)

        alloc_amount = Decimal(str(request.data.get('amount', min(deposit.available_balance, invoice.balance_amount))))
        if alloc_amount > deposit.available_balance:
            return Response({'error': f"Cannot allocate ₹{alloc_amount}. Available deposit is only ₹{deposit.available_balance}."}, status=status.HTTP_400_BAD_REQUEST)
        if alloc_amount > invoice.balance_amount:
            return Response({'error': f"Cannot allocate ₹{alloc_amount}. Invoice balance is only ₹{invoice.balance_amount}."}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        DepositAllocation.objects.create(
            deposit=deposit,
            invoice=invoice,
            allocated_amount=alloc_amount,
            allocated_by=staff or StaffProfile.objects.first()
        )

        deposit.available_balance -= alloc_amount
        if deposit.available_balance == Decimal('0.00'):
            deposit.status = DepositStatus.FULLY_UTILIZED
        else:
            deposit.status = DepositStatus.PARTIALLY_UTILIZED
        deposit.save()

        invoice.deposit_applied_amount += alloc_amount
        invoice.recalculate_totals()

        log_billing_audit('DEPOSIT_ALLOCATED', 'DepositAllocation', deposit.id, staff, {
            'allocated_amount': str(alloc_amount), 'invoice': invoice.invoice_number
        })

        return Response({
            'message': f"Allocated ₹{alloc_amount} to {invoice.invoice_number}.",
            'deposit_remaining_balance': str(deposit.available_balance),
            'invoice_outstanding_balance': str(invoice.balance_amount)
        })


class PaymentReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Official Payment Receipts issued to patients.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PaymentReceiptSerializer

    def get_queryset(self):
        user = self.request.user
        qs = PaymentReceipt.objects.select_related('invoice', 'patient__user_profile', 'cashier__user_profile')
        patient = get_patient_profile(user)
        if patient:
            return qs.filter(patient=patient)
        return qs


class PatientCreditNoteViewSet(viewsets.ModelViewSet):
    """
    Patient Credit Notes for bill adjustments and reversals.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PatientCreditNoteSerializer

    def get_queryset(self):
        return PatientCreditNote.objects.select_related('invoice', 'patient__user_profile', 'approved_by__user_profile')

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        invoice = Invoice.objects.select_for_update().filter(id=data['invoice_id']).first()
        if not invoice:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        amount = Decimal(str(data['amount']))
        if amount <= Decimal('0.00') or amount > invoice.total_amount:
            return Response({'error': f"Credit note amount (₹{amount}) cannot exceed invoice total (₹{invoice.total_amount})."}, status=status.HTTP_400_BAD_REQUEST)

        cn_num = f"CN-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        staff = get_staff_profile(request.user)

        credit_note = PatientCreditNote.objects.create(
            credit_note_number=cn_num,
            invoice=invoice,
            patient=invoice.patient,
            amount=amount,
            reason=data.get('reason', 'Billing adjustment / correction'),
            approved_by=staff or StaffProfile.objects.first()
        )

        invoice.credit_note_amount += amount
        invoice.recalculate_totals()

        log_billing_audit('CREDIT_NOTE_ISSUED', 'PatientCreditNote', credit_note.id, staff, {
            'credit_note_number': cn_num, 'amount': str(amount), 'invoice': invoice.invoice_number
        })

        return Response(PatientCreditNoteSerializer(credit_note).data, status=status.HTTP_201_CREATED)


class PatientRefundViewSet(viewsets.ModelViewSet):
    """
    Patient Refund Processing with maximum refundable amount validation.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PatientRefundSerializer

    def get_queryset(self):
        return PatientRefund.objects.select_related('invoice', 'patient__user_profile', 'processed_by__user_profile')

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        invoice_id = data.get('invoice_id')
        deposit_id = data.get('deposit_id')
        refund_amount = Decimal(str(data['refund_amount']))

        if refund_amount <= Decimal('0.00'):
            return Response({'error': 'Refund amount must be positive.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        ref_num = f"REF-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        if invoice_id:
            invoice = Invoice.objects.select_for_update().filter(id=invoice_id).first()
            if not invoice:
                return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Max refundable amount = paid_amount - previously refunded
            max_refundable = max(Decimal('0.00'), invoice.paid_amount - invoice.refunded_amount)
            if refund_amount > max_refundable:
                return Response({'error': f"Refund amount (₹{refund_amount}) exceeds eligible refundable amount (₹{max_refundable})."}, status=status.HTTP_400_BAD_REQUEST)

            refund = PatientRefund.objects.create(
                refund_number=ref_num,
                invoice=invoice,
                patient=invoice.patient,
                refund_amount=refund_amount,
                refund_method=data.get('refund_method', PaymentMethod.CASH),
                reason=data.get('reason', 'Excess payment refund'),
                status=RefundStatus.PROCESSED,
                processed_by=staff or StaffProfile.objects.first()
            )
            invoice.refunded_amount += refund_amount
            invoice.recalculate_totals()
            return Response(PatientRefundSerializer(refund).data, status=status.HTTP_201_CREATED)

        elif deposit_id:
            deposit = PatientDeposit.objects.select_for_update().filter(id=deposit_id).first()
            if not deposit:
                return Response({'error': 'Deposit not found.'}, status=status.HTTP_404_NOT_FOUND)
            if refund_amount > deposit.available_balance:
                return Response({'error': f"Refund amount (₹{refund_amount}) exceeds available deposit balance (₹{deposit.available_balance})."}, status=status.HTTP_400_BAD_REQUEST)

            refund = PatientRefund.objects.create(
                refund_number=ref_num,
                deposit=deposit,
                patient=deposit.patient,
                refund_amount=refund_amount,
                refund_method=data.get('refund_method', PaymentMethod.CASH),
                reason=data.get('reason', 'Deposit balance refund at discharge'),
                status=RefundStatus.PROCESSED,
                processed_by=staff or StaffProfile.objects.first()
            )
            deposit.available_balance -= refund_amount
            if deposit.available_balance == Decimal('0.00'):
                deposit.status = DepositStatus.REFUNDED
            deposit.save()

            try:
                from .general_ledger_service import GeneralLedgerService
                GeneralLedgerService.auto_post_module_event(
                    event_type='PATIENT_REFUND',
                    payload={
                        'source_id': str(refund.id),
                        'source_module': 'PATIENT_REFUND',
                        'amount': refund.refund_amount,
                        'payment_method': refund.refund_method,
                        'reference': refund.refund_number,
                        'narration': f"Patient deposit refund {refund.refund_number}",
                        'branch_id': deposit.branch_id if deposit.branch else None,
                        'date': timezone.localdate(),
                    },
                    staff_profile=staff
                )
            except Exception:
                pass

            return Response(PatientRefundSerializer(refund).data, status=status.HTTP_201_CREATED)

        return Response({'error': 'Either invoice_id or deposit_id must be provided.'}, status=status.HTTP_400_BAD_REQUEST)


class CashierShiftViewSet(viewsets.ModelViewSet):
    """
    Cashier Shift Management, physical cash counting, and method-wise variance reconciliation.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]
    serializer_class = CashierShiftSerializer

    def get_queryset(self):
        return CashierShift.objects.select_related('cashier__user_profile', 'branch', 'verified_by__user_profile')

    @action(detail=False, methods=['post'], url_path='open-shift')
    def open_shift(self, request):
        staff = get_staff_profile(request.user)
        branch = getattr(staff, 'branch', None) or Branch.objects.first()

        # Check if cashier already has an open shift
        existing = CashierShift.objects.filter(cashier=staff, status=CashierShiftStatus.OPEN).first()
        if existing:
            return Response({'error': 'You already have an active open shift.', 'shift': CashierShiftSerializer(existing).data}, status=status.HTTP_400_BAD_REQUEST)

        opening_cash = Decimal(str(request.data.get('opening_cash', '0.00')))
        shift_num = f"SHIFT-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        shift = CashierShift.objects.create(
            shift_number=shift_num,
            cashier=staff,
            branch=branch,
            opening_cash=opening_cash,
            expected_cash=opening_cash,
            status=CashierShiftStatus.OPEN
        )
        log_billing_audit('CASHIER_SHIFT_OPENED', 'CashierShift', shift.id, staff, {'opening_cash': str(opening_cash)})
        return Response(CashierShiftSerializer(shift).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='close-shift')
    @transaction.atomic
    def close_shift(self, request, pk=None):
        shift = self.get_object()
        if shift.status != CashierShiftStatus.OPEN:
            return Response({'error': f"Shift is already {shift.status}."}, status=status.HTTP_400_BAD_REQUEST)

        # Aggregate collections made during shift
        payments = Payment.objects.filter(received_by=shift.cashier, payment_date__gte=shift.opened_at)
        cash_coll = payments.filter(payment_method=PaymentMethod.CASH).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        upi_coll = payments.filter(payment_method=PaymentMethod.UPI).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        card_coll = payments.filter(payment_method__in=[PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD]).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        bank_coll = payments.filter(payment_method__in=[PaymentMethod.NET_BANKING, PaymentMethod.BANK_TRANSFER]).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        gw_coll = payments.filter(payment_method=PaymentMethod.ONLINE_GATEWAY).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # Deposits in cash
        cash_deposits = PatientDeposit.objects.filter(
            received_by=shift.cashier, payment_method=PaymentMethod.CASH, created_at__gte=shift.opened_at
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # Refunds paid in cash
        cash_refunds = PatientRefund.objects.filter(
            processed_by=shift.cashier, refund_method=PaymentMethod.CASH, created_at__gte=shift.opened_at
        ).aggregate(total=Sum('refund_amount'))['total'] or Decimal('0.00')

        shift.total_cash_collected = cash_coll + cash_deposits
        shift.total_upi_collected = upi_coll
        shift.total_card_collected = card_coll
        shift.total_bank_collected = bank_coll
        shift.total_gateway_collected = gw_coll
        shift.total_refunds = cash_refunds

        counted_cash = Decimal(str(request.data.get('closing_cash_counted', '0.00')))
        shift.closing_cash_counted = counted_cash

        expected_cash = (shift.opening_cash + shift.total_cash_collected) - cash_refunds
        shift.expected_cash = expected_cash
        shift.cash_variance = counted_cash - expected_cash
        shift.closed_at = timezone.now()

        if shift.cash_variance == Decimal('0.00'):
            shift.status = CashierShiftStatus.RECONCILED
        else:
            shift.status = CashierShiftStatus.DISCREPANCY

        shift.reconciliation_notes = request.data.get('reconciliation_notes', '')
        shift.save()

        staff = get_staff_profile(request.user)
        log_billing_audit('CASHIER_SHIFT_CLOSED', 'CashierShift', shift.id, staff, {
            'expected_cash': str(expected_cash), 'counted_cash': str(counted_cash), 'variance': str(shift.cash_variance)
        })

        return Response(CashierShiftSerializer(shift).data, status=status.HTTP_200_OK)


class BillingDashboardStatsView(views.APIView):
    """
    Executive & Cashier Real-Time Billing Summaries, Revenue by Service Category, and Outstanding Aging.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        invoices = Invoice.objects.all()

        total_billed = invoices.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        total_collected = Payment.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        total_outstanding = invoices.aggregate(total=Sum('balance_amount'))['total'] or Decimal('0.00')
        total_deposits_avail = PatientDeposit.objects.filter(status__in=[DepositStatus.AVAILABLE, DepositStatus.PARTIALLY_UTILIZED]).aggregate(total=Sum('available_balance'))['total'] or Decimal('0.00')

        # Departmental / Service Revenue Breakdown
        items = InvoiceItem.objects.all()
        opd_rev = items.filter(item_type=ChargeItemType.CONSULTATION).aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')
        ipd_rev = items.filter(item_type=ChargeItemType.BED_CHARGE).aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')
        lab_rev = items.filter(item_type=ChargeItemType.LAB_TEST).aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')
        rad_rev = items.filter(item_type=ChargeItemType.RADIOLOGY).aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')
        pharma_rev = items.filter(item_type=ChargeItemType.PHARMACY).aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')
        surgery_rev = items.filter(item_type=ChargeItemType.SURGERY).aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')
        icu_rev = items.filter(item_type=ChargeItemType.ICU_CARE).aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')
        er_rev = items.filter(item_type=ChargeItemType.EMERGENCY).aggregate(total=Sum('subtotal'))['total'] or Decimal('0.00')

        # Payment Methods Distribution
        pay_methods = Payment.objects.values('payment_method').annotate(total=Sum('amount'), count=Count('id')).order_by('-total')

        return Response({
            'total_billed': str(total_billed),
            'total_collected': str(total_collected),
            'total_outstanding': str(total_outstanding),
            'total_deposits_available': str(total_deposits_avail),
            'revenue_by_category': {
                'OPD': str(opd_rev),
                'IPD_BEDS': str(ipd_rev),
                'DIAGNOSTIC_LAB': str(lab_rev),
                'RADIOLOGY': str(rad_rev),
                'PHARMACY': str(pharma_rev),
                'SURGERIES': str(surgery_rev),
                'ICU': str(icu_rev),
                'EMERGENCY': str(er_rev)
            },
            'payment_methods_breakdown': pay_methods
        })
