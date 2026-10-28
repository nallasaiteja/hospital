import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.authentication.permissions import IsStaffMember
from apps.core.models import Branch
from apps.authentication.models import PatientProfile, StaffProfile
from apps.authentication.utils import get_staff_profile, get_patient_profile
from .models import (
    Invoice, InvoiceItem, InvoiceStatus, Payment, PaymentMethod,
    InsuranceProvider, InsuranceClaim, ClaimStatus,
    ChartOfAccount, JournalEntry, JournalLineItem,
    BankAccount, BankTransaction, InvestmentRegister,
    LoanRegister, BudgetPlan
)
from .serializers import (
    InvoiceSerializer, PaymentSerializer, InsuranceProviderSerializer,
    InsuranceClaimSerializer, ChartOfAccountSerializer,
    JournalEntrySerializer, BankAccountSerializer,
    BankTransactionSerializer, InvestmentRegisterSerializer,
    LoanRegisterSerializer, BudgetPlanSerializer
)


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    Patient Invoices with itemized line charges (consultations, beds, lab, pharmacy, procedures).
    """
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Invoice.objects.prefetch_related('items', 'payments').select_related('patient__user_profile', 'branch')
        patient = get_patient_profile(user)
        if patient:
            return qs.filter(patient=patient)
        branch_id = self.request.query_params.get('branch_id')
        status_filter = self.request.query_params.get('status')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        patient = PatientProfile.objects.filter(id=data['patient_id']).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        branch_id = data.get('branch_id')
        branch = Branch.objects.filter(id=branch_id).first() or patient.primary_branch

        inv_num = f"INV-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        invoice = Invoice.objects.create(
            invoice_number=inv_num,
            patient=patient,
            branch=branch,
            invoice_date=data.get('invoice_date', timezone.now().date()),
            discount_amount=Decimal(str(data.get('discount_amount', '0.00'))),
            tax_amount=Decimal(str(data.get('tax_amount', '0.00'))),
            notes=data.get('notes', '')
        )

        subtotal = Decimal('0.00')
        for item in data.get('items', []):
            qty = int(item.get('quantity', 1))
            unit_price = Decimal(str(item['unit_price']))
            item_subtotal = unit_price * Decimal(str(qty))
            subtotal += item_subtotal

            InvoiceItem.objects.create(
                invoice=invoice,
                item_type=item.get('item_type', 'CONSULTATION'),
                description=item['description'],
                quantity=qty,
                unit_price=unit_price,
                subtotal=item_subtotal
            )

        invoice.subtotal = subtotal
        invoice.total_amount = (subtotal - invoice.discount_amount) + invoice.tax_amount
        invoice.balance_amount = invoice.total_amount
        invoice.status = InvoiceStatus.ISSUED
        invoice.save()

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


class RecordPaymentView(views.APIView):
    """
    Cashier/Receptionist payment collection with real-time balance reconciliation.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request):
        data = request.data
        invoice = Invoice.objects.select_for_update().filter(id=data['invoice_id']).first()
        if not invoice:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        amount = Decimal(str(data['amount']))
        if amount <= Decimal('0.00'):
            return Response({'error': 'Payment amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount > invoice.balance_amount:
            return Response({'error': f"Payment amount (₹{amount}) cannot exceed outstanding balance (₹{invoice.balance_amount})."}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)

        pay_num = f"PAY-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        payment = Payment.objects.create(
            payment_number=pay_num,
            invoice=invoice,
            patient=invoice.patient,
            branch=invoice.branch,
            amount=amount,
            payment_method=data.get('payment_method', PaymentMethod.UPI),
            transaction_reference=data.get('transaction_reference', ''),
            received_by=staff
        )

        invoice.paid_amount += amount
        invoice.recalculate_totals()

        # Generate official payment receipt
        from .models import PaymentReceipt
        rec_num = f"REC-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        PaymentReceipt.objects.create(
            receipt_number=rec_num,
            invoice=invoice,
            payment=payment,
            patient=invoice.patient,
            amount_paid=amount,
            balance_after_payment=invoice.balance_amount,
            cashier=staff or StaffProfile.objects.first(),
            payment_method=payment.payment_method
        )

        # Auto-post to General Ledger
        try:
            from .general_ledger_service import GeneralLedgerService
            GeneralLedgerService.auto_post_module_event(
                event_type='PATIENT_CASH_COLLECTION',
                payload={
                    'source_id': str(payment.id),
                    'source_module': 'BILLING_PAYMENT',
                    'amount': payment.amount,
                    'payment_method': payment.payment_method,
                    'reference': payment.payment_number,
                    'narration': f"Patient payment receipt for bill {invoice.invoice_number}",
                    'branch_id': invoice.branch_id if invoice.branch else None,
                    'date': timezone.localdate(),
                },
                staff_profile=staff
            )
        except Exception:
            pass

        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class InsuranceClaimViewSet(viewsets.ModelViewSet):
    """
    TPA Cashless Pre-authorizations and Claims Tracking.
    """
    serializer_class = InsuranceClaimSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = InsuranceClaim.objects.select_related('patient__user_profile', 'provider', 'invoice')
        if hasattr(user, 'profile') and hasattr(user.profile, 'patient_profile'):
            return qs.filter(patient=user.profile.patient_profile)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        claim_number = f"CLM-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        claim = InsuranceClaim.objects.create(
            claim_number=claim_number,
            patient_id=data['patient_id'],
            invoice_id=data['invoice_id'],
            provider_id=data['provider_id'],
            policy_number=data['policy_number'],
            pre_auth_number=data.get('pre_auth_number', ''),
            claim_amount=Decimal(str(data['claim_amount'])),
            status=ClaimStatus.SUBMITTED
        )
        return Response(InsuranceClaimSerializer(claim).data, status=status.HTTP_201_CREATED)


class InsuranceProviderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InsuranceProviderSerializer
    permission_classes = [IsAuthenticated]
    queryset = InsuranceProvider.objects.all()


class ChartOfAccountViewSet(viewsets.ModelViewSet):
    serializer_class = ChartOfAccountSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        return ChartOfAccount.objects.select_related('category', 'branch')


class JournalEntryViewSet(viewsets.ModelViewSet):
    """
    Double-Entry General Ledger Journals.
    Strictly enforces: sum(Debit) == sum(Credit) before posting!
    """
    serializer_class = JournalEntrySerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = JournalEntry.objects.prefetch_related('lines__account').select_related('branch', 'posted_by__user_profile')
        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        branch_id = data.get('branch_id')
        branch = Branch.objects.filter(id=branch_id).first() or Branch.objects.first()

        lines_data = data.get('lines', [])  # list of {account_id, entry_type: DEBIT|CREDIT, amount}
        if len(lines_data) < 2:
            return Response({'error': 'A journal entry must contain at least two line items (Debit and Credit).'}, status=status.HTTP_400_BAD_REQUEST)

        total_debit = Decimal('0.00')
        total_credit = Decimal('0.00')

        for l in lines_data:
            amt = Decimal(str(l['amount']))
            if l['entry_type'] == 'DEBIT':
                total_debit += amt
            elif l['entry_type'] == 'CREDIT':
                total_credit += amt
            else:
                return Response({'error': f"Invalid entry type: {l['entry_type']}"}, status=status.HTTP_400_BAD_REQUEST)

        if total_debit != total_credit:
            return Response({
                'error': f"Double-entry violation! Total Debit (₹{total_debit}) must equal Total Credit (₹{total_credit}). Variance: ₹{abs(total_debit - total_credit)}"
            }, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)

        entry_num = f"JV-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        journal = JournalEntry.objects.create(
            entry_number=entry_num,
            branch=branch,
            entry_date=data.get('entry_date', timezone.now().date()),
            narration=data.get('narration', 'General Ledger Posting'),
            is_posted=True,
            posted_by=staff,
            posted_at=timezone.now()
        )

        for l in lines_data:
            acc = ChartOfAccount.objects.select_for_update().filter(id=l['account_id']).first()
            if not acc:
                return Response({'error': f"Account not found: {l['account_id']}"}, status=status.HTTP_404_NOT_FOUND)

            amt = Decimal(str(l['amount']))
            JournalLineItem.objects.create(
                journal_entry=journal,
                account=acc,
                entry_type=l['entry_type'],
                amount=amt
            )

            # Update account running balance according to accounting equation
            if l['entry_type'] == 'DEBIT':
                if acc.category.category_type in ['ASSET', 'EXPENSE']:
                    acc.current_balance += amt
                else:
                    acc.current_balance -= amt
            else:  # CREDIT
                if acc.category.category_type in ['LIABILITY', 'EQUITY', 'REVENUE']:
                    acc.current_balance += amt
                else:
                    acc.current_balance -= amt
            acc.save()

        return Response(JournalEntrySerializer(journal).data, status=status.HTTP_201_CREATED)


class TrialBalanceView(views.APIView):
    """
    Trial balance verifying equality of hospital-wide debit and credit balances.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        accounts = ChartOfAccount.objects.select_related('category').all()
        result = []
        total_debits = Decimal('0.00')
        total_credits = Decimal('0.00')

        for acc in accounts:
            bal = acc.current_balance
            c_type = acc.category.category_type
            if c_type in ['ASSET', 'EXPENSE']:
                debit_bal = bal if bal >= 0 else Decimal('0.00')
                credit_bal = abs(bal) if bal < 0 else Decimal('0.00')
            else:
                credit_bal = bal if bal >= 0 else Decimal('0.00')
                debit_bal = abs(bal) if bal < 0 else Decimal('0.00')

            total_debits += debit_bal
            total_credits += credit_bal

            result.append({
                'account_code': acc.account_code,
                'name': acc.name,
                'category': acc.category.name,
                'category_type': c_type,
                'debit': debit_bal,
                'credit': credit_bal,
            })

        return Response({
            'accounts': result,
            'total_debits': total_debits,
            'total_credits': total_credits,
            'is_balanced': total_debits == total_credits,
        })


class ProfitAndLossView(views.APIView):
    """
    Real-time Profit & Loss statement derived from hospital operating revenues and expenses.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        rev_accounts = ChartOfAccount.objects.filter(category__category_type='REVENUE')
        exp_accounts = ChartOfAccount.objects.filter(category__category_type='EXPENSE')

        total_revenue = sum((a.current_balance for a in rev_accounts), Decimal('0.00'))
        total_expense = sum((a.current_balance for a in exp_accounts), Decimal('0.00'))
        net_surplus = total_revenue - total_expense

        return Response({
            'fiscal_year': '2026-2027',
            'revenues': [
                {'code': a.account_code, 'name': a.name, 'amount': a.current_balance}
                for a in rev_accounts
            ],
            'total_revenue': total_revenue,
            'expenses': [
                {'code': a.account_code, 'name': a.name, 'amount': a.current_balance}
                for a in exp_accounts
            ],
            'total_expense': total_expense,
            'net_surplus_or_profit': net_surplus,
            'operating_margin_pct': round((net_surplus / total_revenue * 100), 2) if total_revenue > 0 else 0,
        })


class BankAccountViewSet(viewsets.ModelViewSet):
    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]
    queryset = BankAccount.objects.prefetch_related('transactions').all()


class ReconcileBankTransactionView(views.APIView):
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request, pk):
        tx = BankTransaction.objects.filter(id=pk).first()
        if not tx:
            return Response({'error': 'Bank transaction not found.'}, status=status.HTTP_404_NOT_FOUND)
        tx.is_reconciled = True
        tx.save()
        return Response({'success': True, 'message': 'Transaction matched and reconciled.'})


class InvestmentViewSet(viewsets.ModelViewSet):
    serializer_class = InvestmentRegisterSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]
    queryset = InvestmentRegister.objects.all()


class LoanViewSet(viewsets.ModelViewSet):
    serializer_class = LoanRegisterSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]
    queryset = LoanRegister.objects.all()


class BudgetPlanViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetPlanSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]
    queryset = BudgetPlan.objects.select_related('branch', 'department').all()
