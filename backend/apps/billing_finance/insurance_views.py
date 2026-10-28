import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, Q, Count, F
from rest_framework import status, views, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.authentication.models import PatientProfile, StaffProfile
from apps.authentication.utils import get_staff_profile, get_patient_profile
from apps.authentication.permissions import IsStaffMember

from .models import (
    InsuranceProvider, CorporateCustomer, PatientInsuranceCoverage,
    EligibilityCheck, PreAuthorizationRequest, InsuranceClaim,
    ClaimDocument, ClaimQuery, ClaimSettlement, CorporateInvoice,
    OrganizationType, CoverageStatus, EligibilityStatus,
    PreAuthStatus, ClaimType, ClaimStatus, QueryStatus,
    SettlementReconciliationStatus, CorporateInvoiceStatus,
    Invoice, InvoiceStatus, BillingAuditEvent
)
from .serializers import (
    InsuranceProviderSerializer, CorporateCustomerSerializer,
    PatientInsuranceCoverageSerializer, EligibilityCheckSerializer,
    PreAuthorizationRequestSerializer, ClaimDocumentSerializer,
    ClaimQuerySerializer, ClaimSettlementSerializer,
    InsuranceClaimSerializer, CorporateInvoiceSerializer
)


class InsuranceProviderViewSet(viewsets.ModelViewSet):
    """
    CRUD for empanelled Third-Party Administrators (TPAs) and Private/Government Insurers.
    """
    queryset = InsuranceProvider.objects.all().select_related('default_tariff')
    serializer_class = InsuranceProviderSerializer
    permission_classes = [IsStaffMember]

    def destroy(self, request, *args, **kwargs):
        provider = self.get_object()
        if provider.claims.exists():
            return Response(
                {"error": f"Cannot delete provider '{provider.name}' because it has {provider.claims.count()} active or settled claims. Deactivate instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        provider = self.get_object()
        provider.is_active = not provider.is_active
        provider.save(update_fields=['is_active'])
        return Response({"status": "SUCCESS", "is_active": provider.is_active})


class CorporateCustomerViewSet(viewsets.ModelViewSet):
    """
    CRUD for corporate institutional partners with credit billing arrangements.
    """
    queryset = CorporateCustomer.objects.all().select_related('corporate_tariff')
    serializer_class = CorporateCustomerSerializer
    permission_classes = [IsStaffMember]

    def destroy(self, request, *args, **kwargs):
        corp = self.get_object()
        if corp.claims.exists() or corp.invoices.exists():
            return Response(
                {"error": f"Cannot delete corporate customer '{corp.name}' because it is linked to claims or invoices. Deactivate instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='adjust-credit-limit')
    def adjust_credit_limit(self, request, pk=None):
        corp = self.get_object()
        new_limit = request.data.get('credit_limit')
        if new_limit is None:
            return Response({"error": "credit_limit is required."}, status=status.HTTP_400_BAD_REQUEST)
        corp.credit_limit = Decimal(str(new_limit))
        corp.save(update_fields=['credit_limit'])
        return Response({"status": "SUCCESS", "credit_limit": str(corp.credit_limit)})


class PatientInsuranceCoverageViewSet(viewsets.ModelViewSet):
    """
    Patient-level insurance policy and corporate beneficiary registries.
    """
    queryset = PatientInsuranceCoverage.objects.all().select_related('patient__user_profile', 'provider', 'corporate_customer', 'verified_by__user_profile')
    serializer_class = PatientInsuranceCoverageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        staff = get_staff_profile(user)
        if staff:
            qs = self.queryset
            patient_id = self.request.query_params.get('patient_id')
            if patient_id:
                qs = qs.filter(patient_id=patient_id)
            return qs
        patient = get_patient_profile(user)
        if patient:
            return self.queryset.filter(patient=patient)
        return self.queryset.none()

    @action(detail=True, methods=['post'], url_path='verify-policy')
    def verify_policy(self, request, pk=None):
        coverage = self.get_object()
        staff = get_staff_profile(request.user)
        if not staff:
            return Response({"error": "Only staff members can formally verify coverage."}, status=status.HTTP_403_FORBIDDEN)
        
        coverage.is_verified = True
        coverage.verified_by = staff
        coverage.verification_date = timezone.localdate()
        coverage.status = CoverageStatus.ACTIVE
        coverage.save(update_fields=['is_verified', 'verified_by', 'verification_date', 'status'])
        return Response({"status": "SUCCESS", "message": "Policy successfully marked as verified."})


class EligibilityCheckViewSet(viewsets.ModelViewSet):
    """
    Formal eligibility verification checks against TPA desk, portals, or APIs.
    """
    queryset = EligibilityCheck.objects.all().select_related('coverage__provider', 'patient__user_profile', 'checked_by__user_profile')
    serializer_class = EligibilityCheckSerializer
    permission_classes = [IsStaffMember]

    def perform_create(self, serializer):
        staff = get_staff_profile(self.request.user)
        serializer.save(checked_by=staff)


class PreAuthorizationRequestViewSet(viewsets.ModelViewSet):
    """
    Pre-authorization requests for inpatient care, surgeries, and diagnostics.
    """
    queryset = PreAuthorizationRequest.objects.all().select_related(
        'patient__user_profile', 'coverage__provider', 'admission', 'invoice',
        'requested_by__user_profile', 'processed_by__user_profile'
    )
    serializer_class = PreAuthorizationRequestSerializer
    permission_classes = [IsStaffMember]

    def perform_create(self, serializer):
        staff = get_staff_profile(self.request.user)
        req_num = f"PREAUTH-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        serializer.save(
            request_number=req_num,
            requested_by=staff
        )

    @action(detail=True, methods=['post'], url_path='submit-to-tpa')
    def submit_to_tpa(self, request, pk=None):
        pre_auth = self.get_object()
        pre_auth.status = PreAuthStatus.SUBMITTED
        pre_auth.request_date = timezone.localdate()
        pre_auth.save(update_fields=['status', 'request_date'])
        return Response({"status": "SUCCESS", "pre_auth_status": pre_auth.status})

    @action(detail=True, methods=['post'], url_path='adjudicate')
    def adjudicate(self, request, pk=None):
        """
        Record authorized pre-authorization decision: APPROVE, PARTIALLY_APPROVE, QUERY, REJECT.
        """
        pre_auth = self.get_object()
        staff = get_staff_profile(request.user)
        decision = request.data.get('decision')  # 'APPROVED', 'PARTIALLY_APPROVED', 'QUERY_RECEIVED', 'REJECTED'
        approved_amount = Decimal(str(request.data.get('approved_amount', '0.00')))
        approval_ref = request.data.get('approval_reference', '')
        reason = request.data.get('rejection_query_reason', '')
        valid_until = request.data.get('validity_until')

        if decision == 'APPROVED':
            pre_auth.status = PreAuthStatus.APPROVED
            pre_auth.approved_amount = approved_amount or pre_auth.requested_amount
        elif decision == 'PARTIALLY_APPROVED':
            pre_auth.status = PreAuthStatus.PARTIALLY_APPROVED
            pre_auth.approved_amount = approved_amount
        elif decision == 'QUERY_RECEIVED':
            pre_auth.status = PreAuthStatus.QUERY_RECEIVED
            pre_auth.rejection_query_reason = reason
        elif decision == 'REJECTED':
            pre_auth.status = PreAuthStatus.REJECTED
            pre_auth.approved_amount = Decimal('0.00')
            pre_auth.rejection_query_reason = reason
        else:
            return Response({"error": f"Invalid decision '{decision}'."}, status=status.HTTP_400_BAD_REQUEST)

        pre_auth.approval_reference = approval_ref
        pre_auth.approval_date = timezone.localdate()
        pre_auth.processed_by = staff
        if valid_until:
            pre_auth.validity_until = valid_until
        pre_auth.save()

        return Response({
            "status": "SUCCESS",
            "pre_auth_status": pre_auth.status,
            "approved_amount": str(pre_auth.approved_amount)
        })


class InsuranceClaimViewSet(viewsets.ModelViewSet):
    """
    Comprehensive Cashless, Reimbursement, and Corporate claim tracking with co-pay and settlement workflows.
    """
    queryset = InsuranceClaim.objects.all().select_related(
        'patient__user_profile', 'invoice', 'provider', 'corporate_customer',
        'coverage', 'pre_auth', 'assigned_staff__user_profile'
    ).prefetch_related('documents', 'queries', 'settlements')
    serializer_class = InsuranceClaimSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        staff = get_staff_profile(user)
        if staff:
            qs = self.queryset
            claim_type = self.request.query_params.get('claim_type')
            status_param = self.request.query_params.get('status')
            if claim_type:
                qs = qs.filter(claim_type=claim_type)
            if status_param and status_param != 'ALL':
                qs = qs.filter(status=status_param)
            return qs
        patient = get_patient_profile(user)
        if patient:
            return self.queryset.filter(patient=patient)
        return self.queryset.none()

    def perform_create(self, serializer):
        claim_num = f"CLM-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        staff = get_staff_profile(self.request.user)
        serializer.save(
            claim_number=claim_num,
            assigned_staff=staff
        )

    @action(detail=True, methods=['post'], url_path='submit-claim', permission_classes=[IsStaffMember])
    def submit_claim(self, request, pk=None):
        staff = get_staff_profile(request.user)
        if not staff:
            return Response({"error": "Only authorized billing and insurance staff can submit claims."}, status=status.HTTP_403_FORBIDDEN)
        claim = self.get_object()
        method = request.data.get('submission_method', 'PORTAL')
        ref = request.data.get('submission_reference', '')
        
        claim.status = ClaimStatus.SUBMITTED
        claim.submission_method = method
        claim.submission_reference = ref
        claim.submitted_date = timezone.localdate()
        claim.save(update_fields=['status', 'submission_method', 'submission_reference', 'submitted_date'])
        return Response({"status": "SUCCESS", "claim_status": claim.status})

    @action(detail=True, methods=['post'], url_path='adjudicate', permission_classes=[IsStaffMember])
    def adjudicate(self, request, pk=None):
        """
        Record insurer claim approval, partial approval, or rejection, and calculate patient co-pay.
        """
        staff = get_staff_profile(request.user)
        if not staff:
            return Response({"error": "Only authorized staff can adjudicate claims."}, status=status.HTTP_403_FORBIDDEN)
        claim = self.get_object()
        decision = request.data.get('decision')  # 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'
        approved_amount = Decimal(str(request.data.get('approved_amount', '0.00')))
        disallowed_amount = Decimal(str(request.data.get('disallowed_amount', '0.00')))
        copay_amount = Decimal(str(request.data.get('patient_copay_amount', '0.00')))
        reason = request.data.get('rejection_reason', '')

        with transaction.atomic():
            if decision == 'APPROVED':
                claim.status = ClaimStatus.APPROVED
                claim.approved_amount = approved_amount or claim.claim_amount
                claim.disallowed_amount = disallowed_amount
            elif decision == 'PARTIALLY_APPROVED':
                claim.status = ClaimStatus.PARTIALLY_APPROVED
                claim.approved_amount = approved_amount
                claim.disallowed_amount = disallowed_amount
            elif decision == 'REJECTED':
                claim.status = ClaimStatus.REJECTED
                claim.approved_amount = Decimal('0.00')
                claim.disallowed_amount = claim.claim_amount
                claim.rejection_reason = reason
            else:
                return Response({"error": f"Invalid decision '{decision}'."}, status=status.HTTP_400_BAD_REQUEST)

            claim.patient_copay_amount = copay_amount
            claim.save()

            # If linked to an invoice and cashless, update patient balance appropriately
            if claim.invoice:
                # Invoice total remains the authoritative hospital fee
                # Balance due from patient is: total - approved_amount - any other payments/deposits
                invoice = claim.invoice
                invoice.recalculate_totals()

        return Response({
            "status": "SUCCESS",
            "claim_status": claim.status,
            "approved_amount": str(claim.approved_amount),
            "patient_copay_amount": str(claim.patient_copay_amount)
        })


class ClaimDocumentViewSet(viewsets.ModelViewSet):
    """
    Document management for insurance claims dossiers.
    """
    queryset = ClaimDocument.objects.all().select_related('claim', 'uploaded_by__user_profile')
    serializer_class = ClaimDocumentSerializer
    permission_classes = [IsStaffMember]

    def perform_create(self, serializer):
        staff = get_staff_profile(self.request.user)
        serializer.save(uploaded_by=staff)


class ClaimQueryViewSet(viewsets.ModelViewSet):
    """
    TPA query logging and formal response submissions.
    """
    queryset = ClaimQuery.objects.all().select_related('claim', 'responded_by__user_profile')
    serializer_class = ClaimQuerySerializer
    permission_classes = [IsStaffMember]

    def perform_create(self, serializer):
        q_num = f"QRY-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        serializer.save(query_number=q_num)

    @action(detail=True, methods=['post'], url_path='respond')
    def respond(self, request, pk=None):
        query = self.get_object()
        resp_text = request.data.get('response_text')
        if not resp_text:
            return Response({"error": "response_text is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        staff = get_staff_profile(request.user)
        query.response_text = resp_text
        query.responded_by = staff
        query.responded_at = timezone.now()
        query.status = QueryStatus.ANSWERED
        query.save()

        # Update parent claim to RESUBMITTED
        claim = query.claim
        claim.status = ClaimStatus.RESUBMITTED
        claim.save(update_fields=['status'])

        return Response({"status": "SUCCESS", "message": "Query answered and claim status updated to RESUBMITTED."})


class ClaimSettlementViewSet(viewsets.ModelViewSet):
    """
    Settlement disbursement tracking and bank reconciliation for insurance claims.
    """
    queryset = ClaimSettlement.objects.all().select_related('claim', 'settled_by__user_profile')
    serializer_class = ClaimSettlementSerializer
    permission_classes = [IsStaffMember]

    def perform_create(self, serializer):
        staff = get_staff_profile(self.request.user)
        set_num = f"STL-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        with transaction.atomic():
            settlement = serializer.save(
                settlement_number=set_num,
                settled_by=staff
            )
            claim = settlement.claim
            claim.settled_amount += settlement.amount_settled
            claim.settlement_date = settlement.settlement_date
            if claim.settled_amount >= claim.approved_amount and claim.approved_amount > Decimal('0.00'):
                claim.status = ClaimStatus.SETTLED
            else:
                claim.status = ClaimStatus.PARTIALLY_SETTLED
            claim.save()


class CorporateInvoiceViewSet(viewsets.ModelViewSet):
    """
    Consolidated corporate billing invoices.
    """
    queryset = CorporateInvoice.objects.all().select_related('corporate_customer', 'created_by__user_profile')
    serializer_class = CorporateInvoiceSerializer
    permission_classes = [IsStaffMember]

    def perform_create(self, serializer):
        staff = get_staff_profile(self.request.user)
        inv_num = f"CORP-INV-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        serializer.save(
            invoice_number=inv_num,
            created_by=staff
        )

    @action(detail=True, methods=['post'], url_path='record-payment')
    def record_payment(self, request, pk=None):
        corp_inv = self.get_object()
        amount = Decimal(str(request.data.get('amount', '0.00')))
        if amount <= Decimal('0.00'):
            return Response({"error": "Payment amount must be greater than 0."}, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            corp_inv.paid_amount += amount
            corp_inv.balance_amount = max(Decimal('0.00'), corp_inv.total_amount - corp_inv.paid_amount)
            if corp_inv.balance_amount == Decimal('0.00'):
                corp_inv.status = CorporateInvoiceStatus.PAID
            else:
                corp_inv.status = CorporateInvoiceStatus.PARTIALLY_PAID
            corp_inv.save()

            # Reduce corporate utilized credit
            corp = corp_inv.corporate_customer
            corp.current_credit_utilized = max(Decimal('0.00'), corp.current_credit_utilized - amount)
            corp.save(update_fields=['current_credit_utilized'])

        return Response({
            "status": "SUCCESS",
            "paid_amount": str(corp_inv.paid_amount),
            "balance_amount": str(corp_inv.balance_amount),
            "invoice_status": corp_inv.status
        })


class InsuranceReceivablesView(views.APIView):
    """
    Outstanding insurer and corporate receivables with age analysis (0-30, 31-60, 61-90, 90+ days).
    """
    permission_classes = [IsStaffMember]

    def get(self, request):
        today = timezone.localdate()
        
        # Outstanding claims (approved but not settled or partially settled)
        unsettled_claims = InsuranceClaim.objects.filter(
            status__in=[ClaimStatus.APPROVED, ClaimStatus.PARTIALLY_SETTLED, ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW]
        ).select_related('provider', 'corporate_customer')

        receivables_by_provider = {}
        ageing = {
            "current_30_days": Decimal('0.00'),
            "days_31_to_60": Decimal('0.00'),
            "days_61_to_90": Decimal('0.00'),
            "over_90_days": Decimal('0.00'),
        }

        total_outstanding = Decimal('0.00')

        for claim in unsettled_claims:
            target_amount = claim.approved_amount if claim.approved_amount > Decimal('0.00') else claim.claim_amount
            outstanding = target_amount - claim.settled_amount
            if outstanding <= Decimal('0.00'):
                continue
            
            total_outstanding += outstanding
            org_name = claim.provider.name if claim.provider else (claim.corporate_customer.name if claim.corporate_customer else "Unknown")
            
            if org_name not in receivables_by_provider:
                receivables_by_provider[org_name] = {
                    "organization_name": org_name,
                    "claim_count": 0,
                    "outstanding_amount": Decimal('0.00')
                }
            receivables_by_provider[org_name]["claim_count"] += 1
            receivables_by_provider[org_name]["outstanding_amount"] += outstanding

            # Ageing calculation based on submitted_date
            age_days = (today - claim.submitted_date).days
            if age_days <= 30:
                ageing["current_30_days"] += outstanding
            elif age_days <= 60:
                ageing["days_31_to_60"] += outstanding
            elif age_days <= 90:
                ageing["days_61_to_90"] += outstanding
            else:
                ageing["over_90_days"] += outstanding

        # Convert Decimals to string for JSON serialization
        provider_list = [
            {
                "organization_name": v["organization_name"],
                "claim_count": v["claim_count"],
                "outstanding_amount": str(v["outstanding_amount"])
            }
            for v in receivables_by_provider.values()
        ]

        return Response({
            "total_outstanding_receivables": str(total_outstanding),
            "ageing_breakdown": {k: str(v) for k, v in ageing.items()},
            "organization_receivables": provider_list
        })


class InsuranceDashboardStatsView(views.APIView):
    """
    Consolidated executive KPI summary for Insurance & Corporate Billing.
    """
    permission_classes = [IsStaffMember]

    def get(self, request):
        today = timezone.localdate()

        total_claims = InsuranceClaim.objects.count()
        claims_in_flight = InsuranceClaim.objects.filter(
            status__in=[ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW, ClaimStatus.QUERY_RECEIVED, ClaimStatus.RESUBMITTED]
        ).count()
        pending_preauths = PreAuthorizationRequest.objects.filter(
            status__in=[PreAuthStatus.DRAFT, PreAuthStatus.SUBMITTED, PreAuthStatus.UNDER_REVIEW, PreAuthStatus.QUERY_RECEIVED]
        ).count()
        active_queries = ClaimQuery.objects.filter(status=QueryStatus.PENDING).count()

        total_claimed_val = InsuranceClaim.objects.aggregate(s=Sum('claim_amount'))['s'] or Decimal('0.00')
        total_approved_val = InsuranceClaim.objects.aggregate(s=Sum('approved_amount'))['s'] or Decimal('0.00')
        total_settled_val = InsuranceClaim.objects.aggregate(s=Sum('settled_amount'))['s'] or Decimal('0.00')

        return Response({
            "total_claims": total_claims,
            "claims_in_flight": claims_in_flight,
            "pending_preauths": pending_preauths,
            "active_queries": active_queries,
            "total_claimed_value": str(total_claimed_val),
            "total_approved_value": str(total_approved_val),
            "total_settled_value": str(total_settled_val),
            "cashless_count": InsuranceClaim.objects.filter(claim_type=ClaimType.CASHLESS).count(),
            "reimbursement_count": InsuranceClaim.objects.filter(claim_type=ClaimType.REIMBURSEMENT).count(),
            "corporate_count": InsuranceClaim.objects.filter(claim_type=ClaimType.CORPORATE).count(),
        })
