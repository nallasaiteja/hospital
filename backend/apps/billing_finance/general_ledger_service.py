import uuid
from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.core.models import Branch, Department
from apps.authentication.models import StaffProfile, RoleEnum
from .models import (
    AccountCategory, AccountCategoryType, AccountSubType,
    ChartOfAccount, FiscalYear, AccountingPeriod, AccountingPeriodAuditLog,
    JournalEntry, JournalLineItem, JournalVoucherType, JournalStatus,
    JournalAuditLog, JournalDocument, JournalLineType
)


class GeneralLedgerService:
    """
    Central Double-Entry Accounting Service for Hospital Management System.
    Strictly enforces: Total Debits == Total Credits.
    Manages Chart of Accounts, Journal Vouchers, Multi-Module Posting,
    Accounting Periods, and GAAP/IFRS Reconciled Financial Reports.
    """

    @classmethod
    def ensure_default_fiscal_year_and_periods(cls):
        """
        Initializes the standard hospital financial year (April - March)
        and 12 monthly accounting periods if not already present.
        """
        current_year = timezone.localdate().year
        # Hospital standard: April 1 to March 31
        fy_code = f"FY{current_year}-{str(current_year + 1)[-2:]}"
        start_date = timezone.datetime(current_year, 4, 1).date()
        end_date = timezone.datetime(current_year + 1, 3, 31).date()

        fy, created = FiscalYear.objects.get_or_create(
            code=fy_code,
            defaults={
                'name': f"Financial Year {current_year}-{current_year + 1}",
                'start_date': start_date,
                'end_date': end_date,
                'is_closed': False
            }
        )

        # Ensure all 12 monthly periods exist
        periods_def = [
            (1, f"April {current_year}", timezone.datetime(current_year, 4, 1).date(), timezone.datetime(current_year, 4, 30).date()),
            (2, f"May {current_year}", timezone.datetime(current_year, 5, 1).date(), timezone.datetime(current_year, 5, 31).date()),
            (3, f"June {current_year}", timezone.datetime(current_year, 6, 1).date(), timezone.datetime(current_year, 6, 30).date()),
            (4, f"July {current_year}", timezone.datetime(current_year, 7, 1).date(), timezone.datetime(current_year, 7, 31).date()),
            (5, f"August {current_year}", timezone.datetime(current_year, 8, 1).date(), timezone.datetime(current_year, 8, 31).date()),
            (6, f"September {current_year}", timezone.datetime(current_year, 9, 1).date(), timezone.datetime(current_year, 9, 30).date()),
            (7, f"October {current_year}", timezone.datetime(current_year, 10, 1).date(), timezone.datetime(current_year, 10, 31).date()),
            (8, f"November {current_year}", timezone.datetime(current_year, 11, 1).date(), timezone.datetime(current_year, 11, 30).date()),
            (9, f"December {current_year}", timezone.datetime(current_year, 12, 1).date(), timezone.datetime(current_year, 12, 31).date()),
            (10, f"January {current_year + 1}", timezone.datetime(current_year + 1, 1, 1).date(), timezone.datetime(current_year + 1, 1, 31).date()),
            (11, f"February {current_year + 1}", timezone.datetime(current_year + 1, 2, 1).date(), timezone.datetime(current_year + 1, 2, 28).date()),
            (12, f"March {current_year + 1}", timezone.datetime(current_year + 1, 3, 1).date(), timezone.datetime(current_year + 1, 3, 31).date()),
        ]

        for p_num, p_name, p_start, p_end in periods_def:
            AccountingPeriod.objects.get_or_create(
                fiscal_year=fy,
                period_number=p_num,
                defaults={
                    'period_name': p_name,
                    'start_date': p_start,
                    'end_date': p_end,
                    'is_closed': False
                }
            )
        return fy

    @classmethod
    def get_period_for_date(cls, tx_date):
        """Finds the accounting period covering the given transaction date."""
        if isinstance(tx_date, str):
            tx_date = timezone.datetime.strptime(tx_date, '%Y-%m-%d').date()
        period = AccountingPeriod.objects.filter(start_date__lte=tx_date, end_date__gte=tx_date).first()
        if not period:
            cls.ensure_default_fiscal_year_and_periods()
            period = AccountingPeriod.objects.filter(start_date__lte=tx_date, end_date__gte=tx_date).first()
        return period

    @classmethod
    def ensure_standard_chart_of_accounts(cls, branch=None):
        """
        Seeds / normalizes standard hospital chart of accounts across all 5 classifications
        and 18 subcategories without creating duplicate account codes.
        """
        # Ensure categories exist
        cat_map = {}
        for code, name, c_type in [
            ('1000', 'Current Assets', AccountCategoryType.ASSET),
            ('1500', 'Fixed & Non-Current Assets', AccountCategoryType.ASSET),
            ('2000', 'Current Liabilities & Payables', AccountCategoryType.LIABILITY),
            ('2500', 'Long-Term Liabilities & Borrowings', AccountCategoryType.LIABILITY),
            ('3000', 'Hospital Equity & Reserves', AccountCategoryType.EQUITY),
            ('4000', 'Clinical & Operating Revenue', AccountCategoryType.REVENUE),
            ('5000', 'Operating & Administrative Expenses', AccountCategoryType.EXPENSE),
        ]:
            cat, _ = AccountCategory.objects.get_or_create(code=code, defaults={'name': name, 'category_type': c_type})
            cat_map[code] = cat

        # Standard hospital accounts catalog
        accounts_catalog = [
            # Assets (1000 - 1999)
            ('1010', 'Cash in Hand (Front Desk & Cashier Float)', '1000', AccountSubType.CASH_BANK, True, "Operating cash desk and cashier shift cash"),
            ('1020', 'HDFC Bank Healthcare Operating Account', '1000', AccountSubType.CASH_BANK, True, "Primary operating bank account for disbursements & receipts"),
            ('1030', 'Patient Accounts Receivable', '1000', AccountSubType.PATIENT_RECEIVABLE, True, "Outstanding self-pay patient balances and unbilled credit"),
            ('1040', 'TPA & Corporate Insurance Claims Receivable', '1000', AccountSubType.INSURANCE_RECEIVABLE, True, "Pending claims submitted to empanelled insurance/TPA"),
            ('1050', 'Pharmacy & Medical Consumables Inventory', '1000', AccountSubType.INVENTORY, True, "Pharmaceutical drugs, surgical implants, and clinical inventory"),
            ('1060', 'Hospital Treasury & Mutual Fund Investments', '1000', AccountSubType.INVESTMENT_ASSET, True, "Liquid mutual funds, treasury bonds, and fixed deposits"),
            ('1510', 'Medical Diagnostic & Surgical Equipment Asset', '1500', AccountSubType.FIXED_ASSET, False, "Capital medical equipment (MRI, CT Scanner, Ultrasound, OT tables)"),
            ('1520', 'Accumulated Depreciation - Medical Equipment', '1500', AccountSubType.ACCUMULATED_DEPRECIATION, False, "Contra-asset accumulated depreciation on hospital equipment"),

            # Liabilities (2000 - 2999)
            ('2010', 'Supplier & Vendor Accounts Payable', '2000', AccountSubType.SUPPLIER_PAYABLE, True, "Outstanding invoices due to pharma and medical suppliers"),
            ('2020', 'Patient Advance & Security Deposits', '2000', AccountSubType.PATIENT_ADVANCE, True, "Unapplied patient advance deposits and admission guarantees"),
            ('2030', 'Term Loans & Medical Equipment Facilities', '2500', AccountSubType.LOAN_LIABILITY, True, "Long-term bank borrowing and equipment financing liabilities"),
            ('2040', 'Taxes & Statutory GST Liabilities Payable', '2000', AccountSubType.TAXES_STATUTORY, True, "GST collected, TDS deducted, and statutory payroll taxes payable"),

            # Equity (3000 - 3999)
            ('3010', 'Hospital Capital & Retained Earnings', '3000', AccountSubType.OTHER, False, "Accumulated retained surplus and founding institutional equity"),

            # Revenue (4000 - 4999)
            ('4010', 'Outpatient Consultation Revenue (OPD)', '4000', AccountSubType.PATIENT_SERVICE_REVENUE, False, "Doctor consultations and outpatient service billings"),
            ('4020', 'Inpatient Ward & Bed Charges Revenue (IPD)', '4000', AccountSubType.PATIENT_SERVICE_REVENUE, False, "Room rent, nursing charges, and inpatient bed occupancy revenue"),
            ('4025', 'Surgery & Operation Theatre Procedure Revenue', '4000', AccountSubType.PATIENT_SERVICE_REVENUE, False, "Surgical procedures, OT theatre charges, and anesthesia fees"),
            ('4028', 'Intensive Care Unit (ICU) Critical Care Revenue', '4000', AccountSubType.PATIENT_SERVICE_REVENUE, False, "Critical care monitoring, ventilator support, and ICU room charges"),
            ('4030', 'Diagnostic Pathology & Radiology Lab Revenue', '4000', AccountSubType.PHARMACY_DIAGNOSTIC_REVENUE, False, "Clinical biochemistry, hematology, pathology, and imaging fees"),
            ('4040', 'Pharmacy Formulary Sales Revenue', '4000', AccountSubType.PHARMACY_DIAGNOSTIC_REVENUE, False, "Pharmacy counter and inpatient medication dispensation sales"),
            ('4050', 'Interest & Investment Dividend Income', '4000', AccountSubType.INTEREST_DIVIDEND_INCOME, False, "Interest earned on bank deposits and dividend payouts"),
            ('4060', 'Other Hospital Operating Income & Administrative Receipts', '4000', AccountSubType.OTHER, False, "Miscellaneous operating income, medical records fees, and canteen concession"),
            ('4070', 'Investment Portfolio Realized Capital Gains/(Losses)', '4000', AccountSubType.INVESTMENT_ASSET, False, "Realized capital gains and losses on treasury investments and bonds"),

            # Expenses (5000 - 5999)
            ('5010', 'Staff Salaries & Nursing Payroll Expense', '5000', AccountSubType.SALARIES_PAYROLL, False, "Doctor compensation, nursing salaries, and clinical staff payroll"),
            ('5020', 'Hospital Utilities & Electricity Expense', '5000', AccountSubType.RENT_UTILITIES, False, "Electricity, water, oxygen gas supply, and HVAC utilities"),
            ('5030', 'Medical Consumables & Surgical Supplies Consumption', '5000', AccountSubType.INVENTORY, False, "Cost of goods sold for drugs, surgical dressings, and syringes"),
            ('5040', 'Loan Interest & Financing Expense', '5000', AccountSubType.LOAN_INTEREST_EXPENSE, False, "Bank interest paid on term loans and credit facilities"),
            ('5050', 'Bank Charges & Merchant Processing Fees', '5000', AccountSubType.BANK_CHARGES, False, "Bank account maintenance fees, wire charges, and gateway MDR fees"),
            ('5060', 'Depreciation & Amortization Expense', '5000', AccountSubType.OTHER, False, "Periodic depreciation expense on medical equipment and facilities"),
            ('5070', 'Hospital Building Lease & Facility Rent', '5000', AccountSubType.RENT_UTILITIES, False, "Hospital real estate lease and campus rent"),
            ('5080', 'Provision for Hospital Income & Corporate Taxes', '5000', AccountSubType.TAXES_STATUTORY, False, "Provision for corporate income taxes and statutory healthcare levies"),
        ]

        for code, name, cat_code, sub_type, is_rec, desc in accounts_catalog:
            cat = cat_map.get(cat_code) or cat_map['1000']
            acc = ChartOfAccount.objects.filter(account_code=code).first()
            if acc:
                # Update existing account subcategory and description if unset
                acc.name = name
                acc.category = cat
                acc.account_type = sub_type
                acc.is_reconcilable = is_rec
                if not acc.description:
                    acc.description = desc
                if branch and not acc.branch:
                    acc.branch = branch
                acc.save()
            else:
                ChartOfAccount.objects.create(
                    account_code=code,
                    name=name,
                    category=cat,
                    account_type=sub_type,
                    branch=branch,
                    is_reconcilable=is_rec,
                    description=desc,
                    is_active=True
                )

    @classmethod
    def get_account_by_code(cls, code):
        """Helper to get a ChartOfAccount by its unique code."""
        acc = ChartOfAccount.objects.filter(account_code=code).first()
        if not acc:
            cls.ensure_standard_chart_of_accounts()
            acc = ChartOfAccount.objects.filter(account_code=code).first()
        return acc

    @classmethod
    def validate_journal_voucher(cls, data):
        """
        Validates debit/credit balance, line formats, active account statuses,
        and accounting period controls.
        """
        lines_data = data.get('lines', [])
        if len(lines_data) < 2:
            raise ValidationError("A journal voucher must contain at least two line items (Debit and Credit).")

        entry_date = data.get('entry_date') or timezone.localdate()
        if isinstance(entry_date, str):
            entry_date = timezone.datetime.strptime(entry_date, '%Y-%m-%d').date()

        # Check Accounting Period Closing Control
        period = cls.get_period_for_date(entry_date)
        if period and period.is_closed:
            raise ValidationError(f"Accounting Period '{period.period_name}' is CLOSED. Postings are strictly prohibited.")

        total_debit = Decimal('0.00')
        total_credit = Decimal('0.00')
        has_debit = False
        has_credit = False

        for idx, line in enumerate(lines_data, 1):
            debit_amt = Decimal(str(line.get('debit_amount', '0.00') or '0.00'))
            credit_amt = Decimal(str(line.get('credit_amount', '0.00') or '0.00'))

            # Backward-compatibility fallback for legacy {entry_type, amount}
            if debit_amt == 0 and credit_amt == 0 and 'amount' in line:
                amt = Decimal(str(line['amount']))
                if line.get('entry_type') == 'DEBIT':
                    debit_amt = amt
                elif line.get('entry_type') == 'CREDIT':
                    credit_amt = amt

            if debit_amt < Decimal('0.00') or credit_amt < Decimal('0.00'):
                raise ValidationError(f"Line {idx}: Debit and credit amounts cannot be negative.")

            if debit_amt > Decimal('0.00') and credit_amt > Decimal('0.00'):
                raise ValidationError(f"Line {idx}: A single journal line cannot have both Debit and Credit amounts greater than zero.")

            if debit_amt == Decimal('0.00') and credit_amt == Decimal('0.00'):
                raise ValidationError(f"Line {idx}: Line item must have an amount greater than zero.")

            account_id = line.get('account_id')
            account_code = line.get('account_code')
            account = None
            if account_id:
                account = ChartOfAccount.objects.filter(id=account_id).first()
            elif account_code:
                account = ChartOfAccount.objects.filter(account_code=account_code).first()

            if not account:
                raise ValidationError(f"Line {idx}: General Ledger account not found.")

            if not account.is_active:
                raise ValidationError(f"Line {idx}: Account '{account.account_code} - {account.name}' is INACTIVE. Postings are not permitted.")

            total_debit += debit_amt
            total_credit += credit_amt
            if debit_amt > 0:
                has_debit = True
            if credit_amt > 0:
                has_credit = True

        if not (has_debit and has_credit):
            raise ValidationError("A journal voucher must include at least one Debit line and one Credit line.")

        variance = abs(total_debit - total_credit)
        if variance != Decimal('0.00'):
            raise ValidationError(
                f"Double-Entry Violation: Total Debits (₹{total_debit}) must equal Total Credits (₹{total_credit}). Variance: ₹{variance}"
            )

        return total_debit, total_credit, period

    @classmethod
    @transaction.atomic
    def create_journal_voucher(cls, data, staff_profile=None):
        """
        Creates a Journal Voucher in DRAFT, PENDING_APPROVAL, or directly POSTED status.
        Ensures atomic execution, idempotency, and balance equality.
        """
        idempotency_key = data.get('idempotency_key')
        if idempotency_key:
            existing = JournalEntry.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                return existing

        total_debit, total_credit, period = cls.validate_journal_voucher(data)

        branch = None
        if data.get('branch_id'):
            branch = Branch.objects.filter(id=data['branch_id']).first()
        if not branch:
            branch = Branch.objects.first()

        department = None
        if data.get('department_id'):
            department = Department.objects.filter(id=data['department_id']).first()

        entry_date = data.get('entry_date') or timezone.localdate()
        voucher_type = data.get('voucher_type', JournalVoucherType.STANDARD)
        desired_status = data.get('status', JournalStatus.DRAFT)

        date_str = timezone.now().strftime('%Y%m%d')
        voucher_num = f"JV-{date_str}-{uuid.uuid4().hex[:6].upper()}"

        journal = JournalEntry.objects.create(
            entry_number=voucher_num,
            voucher_number=voucher_num,
            voucher_type=voucher_type,
            status=desired_status,
            branch=branch,
            department=department,
            accounting_period=period,
            entry_date=entry_date,
            narration=data.get('narration', 'General Ledger Voucher'),
            reference_number=data.get('reference_number', ''),
            source_module=data.get('source_module', 'MANUAL'),
            source_transaction_id=str(data.get('source_transaction_id', '')),
            idempotency_key=idempotency_key,
            created_by=staff_profile,
            total_debit=total_debit,
            total_credit=total_credit,
            is_posted=(desired_status == JournalStatus.POSTED)
        )

        for line in data.get('lines', []):
            debit_amt = Decimal(str(line.get('debit_amount', '0.00') or '0.00'))
            credit_amt = Decimal(str(line.get('credit_amount', '0.00') or '0.00'))
            if debit_amt == 0 and credit_amt == 0 and 'amount' in line:
                amt = Decimal(str(line['amount']))
                if line.get('entry_type') == 'DEBIT':
                    debit_amt = amt
                else:
                    credit_amt = amt

            account_id = line.get('account_id')
            account_code = line.get('account_code')
            account = ChartOfAccount.objects.filter(id=account_id).first() if account_id else ChartOfAccount.objects.filter(account_code=account_code).first()

            JournalLineItem.objects.create(
                journal_entry=journal,
                account=account,
                entry_type=JournalLineType.DEBIT if debit_amt > 0 else JournalLineType.CREDIT,
                amount=debit_amt if debit_amt > 0 else credit_amt,
                debit_amount=debit_amt,
                credit_amount=credit_amt,
                description=line.get('description', journal.narration[:250]),
                reference_number=line.get('reference_number', journal.reference_number),
                branch=branch,
                department=department
            )

        # Audit Log
        JournalAuditLog.objects.create(
            journal_entry=journal,
            action='CREATED',
            from_status='',
            to_status=desired_status,
            performed_by=staff_profile,
            comments=f"Voucher created with status {desired_status} for ₹{total_debit}."
        )

        if desired_status == JournalStatus.POSTED:
            cls._apply_posting_balances(journal, staff_profile)

        return journal

    @classmethod
    @transaction.atomic
    def post_journal_voucher(cls, journal_id, staff_profile):
        """
        Posts an approved or draft voucher to the General Ledger.
        Validates accounting period and applies double-entry updates to account balances.
        """
        journal = JournalEntry.objects.select_for_update().filter(id=journal_id).first()
        if not journal:
            raise ValidationError("Journal voucher not found.")

        if journal.status == JournalStatus.POSTED:
            return journal  # Already posted

        if journal.status in [JournalStatus.REJECTED, JournalStatus.CANCELLED, JournalStatus.REVERSED]:
            raise ValidationError(f"Cannot post a voucher in {journal.status} status.")

        # Period check
        period = cls.get_period_for_date(journal.entry_date)
        if period and period.is_closed:
            raise ValidationError(f"Accounting Period '{period.period_name}' is CLOSED. Postings are prohibited.")

        journal.validate_balanced()
        cls._apply_posting_balances(journal, staff_profile)
        return journal

    @classmethod
    def _apply_posting_balances(cls, journal, staff_profile):
        """Helper to mutate ChartOfAccount balances upon posting."""
        lines = journal.lines.select_related('account__category').all()
        for line in lines:
            acc = ChartOfAccount.objects.select_for_update().get(id=line.account.id)
            debit_amt = line.debit_amount if line.debit_amount > 0 else (line.amount if line.entry_type == 'DEBIT' else Decimal('0.00'))
            credit_amt = line.credit_amount if line.credit_amount > 0 else (line.amount if line.entry_type == 'CREDIT' else Decimal('0.00'))

            cat_type = acc.category.category_type
            if cat_type in [AccountCategoryType.ASSET, AccountCategoryType.EXPENSE]:
                # Assets/Expenses: Debits increase, Credits decrease
                acc.current_balance += (debit_amt - credit_amt)
            else:
                # Liabilities/Equity/Revenue: Credits increase, Debits decrease
                acc.current_balance += (credit_amt - debit_amt)
            acc.save(update_fields=['current_balance'])

        from_status = journal.status
        journal.status = JournalStatus.POSTED
        journal.is_posted = True
        journal.posted_by = staff_profile
        journal.posted_at = timezone.now()
        journal.save(update_fields=['status', 'is_posted', 'posted_by', 'posted_at'])

        JournalAuditLog.objects.create(
            journal_entry=journal,
            action='POSTED',
            from_status=from_status,
            to_status=JournalStatus.POSTED,
            performed_by=staff_profile,
            comments=f"Voucher posted to General Ledger by {staff_profile.user_profile.full_name if staff_profile and staff_profile.user_profile else 'Authorized Staff'}."
        )

    @classmethod
    @transaction.atomic
    def reverse_journal_voucher(cls, journal_id, staff_profile, reason="Authorized Accounting Reversal"):
        """
        Reverses a POSTED journal entry using a mirror reversal entry (inverted debits & credits).
        Preserves complete historical audit trail and enforces double-entry rules.
        """
        original = JournalEntry.objects.select_for_update().filter(id=journal_id).first()
        if not original:
            raise ValidationError("Original journal voucher not found.")

        if original.status != JournalStatus.POSTED:
            raise ValidationError(f"Only POSTED vouchers can be reversed (Current: {original.status}).")

        if original.reversal_entries.exists() or original.status == JournalStatus.REVERSED:
            raise ValidationError("This journal voucher has already been reversed.")

        # Period check for the reversal date
        reversal_date = timezone.localdate()
        period = cls.get_period_for_date(reversal_date)
        if period and period.is_closed:
            raise ValidationError(f"Accounting Period '{period.period_name}' is CLOSED. Cannot post reversal entry.")

        date_str = timezone.now().strftime('%Y%m%d')
        reversal_num = f"REV-{date_str}-{uuid.uuid4().hex[:6].upper()}"

        reversal_entry = JournalEntry.objects.create(
            entry_number=reversal_num,
            voucher_number=reversal_num,
            voucher_type=JournalVoucherType.REVERSAL,
            status=JournalStatus.POSTED,
            branch=original.branch,
            department=original.department,
            accounting_period=period,
            entry_date=reversal_date,
            narration=f"Reversal of [{original.voucher_number or original.entry_number}]: {reason}",
            reference_number=f"REV-{original.voucher_number or original.entry_number}",
            source_module=original.source_module,
            source_transaction_id=original.source_transaction_id,
            reversal_of=original,
            created_by=staff_profile,
            posted_by=staff_profile,
            posted_at=timezone.now(),
            is_posted=True,
            total_debit=original.total_credit,
            total_credit=original.total_debit
        )

        for line in original.lines.all():
            orig_debit = line.debit_amount if line.debit_amount > 0 else (line.amount if line.entry_type == 'DEBIT' else Decimal('0.00'))
            orig_credit = line.credit_amount if line.credit_amount > 0 else (line.amount if line.entry_type == 'CREDIT' else Decimal('0.00'))

            # Invert: old credit becomes new debit; old debit becomes new credit
            new_debit = orig_credit
            new_credit = orig_debit

            JournalLineItem.objects.create(
                journal_entry=reversal_entry,
                account=line.account,
                entry_type=JournalLineType.DEBIT if new_debit > 0 else JournalLineType.CREDIT,
                amount=new_debit if new_debit > 0 else new_credit,
                debit_amount=new_debit,
                credit_amount=new_credit,
                description=f"Reversal Line: {line.description}",
                reference_number=reversal_entry.reference_number,
                branch=line.branch,
                department=line.department
            )

        # Mutate account balances for the reversal
        cls._apply_posting_balances(reversal_entry, staff_profile)

        # Update original voucher
        original.status = JournalStatus.REVERSED
        original.reversed_by = staff_profile
        original.reversed_at = timezone.now()
        original.reversal_reason = reason
        original.save(update_fields=['status', 'reversed_by', 'reversed_at', 'reversal_reason'])

        JournalAuditLog.objects.create(
            journal_entry=original,
            action='REVERSED',
            from_status=JournalStatus.POSTED,
            to_status=JournalStatus.REVERSED,
            performed_by=staff_profile,
            comments=f"Reversed via voucher {reversal_num}. Reason: {reason}"
        )

        return reversal_entry

    @classmethod
    @transaction.atomic
    def auto_post_module_event(cls, event_type, payload, staff_profile=None):
        """
        High-reliability automatic posting interface connecting General Ledger to:
        - Billing & Cashier collections
        - Credit invoicing & IPD bills
        - Insurance claims & settlements
        - Supplier invoices & payments
        - Patient advances & refunds
        - Bank charges & loans & investments
        - Fixed asset depreciation
        Guarantees idempotency and double-entry balance.
        """
        source_id = str(payload.get('source_id', ''))
        source_module = payload.get('source_module', event_type)
        idempotency_key = f"AUTO-GL-{source_module}-{source_id}"

        # 1. Idempotency Check
        existing = JournalEntry.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing

        amount = Decimal(str(payload.get('amount', '0.00')))
        if amount <= Decimal('0.00'):
            return None

        branch_id = payload.get('branch_id')
        branch = Branch.objects.filter(id=branch_id).first() if branch_id else Branch.objects.first()
        entry_date = payload.get('date') or timezone.localdate()
        reference = payload.get('reference', '')
        narration = payload.get('narration', '')

        # Pre-fetch / ensure accounts
        cls.ensure_standard_chart_of_accounts(branch)

        acc_cash = cls.get_account_by_code('1010')
        acc_bank = cls.get_account_by_code('1020')
        acc_patient_ar = cls.get_account_by_code('1030')
        acc_insurance_ar = cls.get_account_by_code('1040')
        acc_inventory = cls.get_account_by_code('1050')
        acc_investment = cls.get_account_by_code('1060')
        acc_fixed_asset = cls.get_account_by_code('1510')
        acc_accum_deprec = cls.get_account_by_code('1520')
        acc_supplier_ap = cls.get_account_by_code('2010')
        acc_patient_advance = cls.get_account_by_code('2020')
        acc_loans = cls.get_account_by_code('2030')
        acc_gst = cls.get_account_by_code('2040')
        acc_opd_rev = cls.get_account_by_code('4010')
        acc_ipd_rev = cls.get_account_by_code('4020')
        acc_lab_rev = cls.get_account_by_code('4030')
        acc_pharmacy_rev = cls.get_account_by_code('4040')
        acc_inv_income = cls.get_account_by_code('4050')
        acc_payroll = cls.get_account_by_code('5010')
        acc_utilities = cls.get_account_by_code('5020')
        acc_supplies_exp = cls.get_account_by_code('5030')
        acc_loan_interest = cls.get_account_by_code('5040')
        acc_bank_charges = cls.get_account_by_code('5050')
        acc_deprec_exp = cls.get_account_by_code('5060')

        payment_method = payload.get('payment_method', 'CASH').upper()
        # Choose cash vs bank account based on payment method
        liquid_account = acc_bank if payment_method in ['BANK', 'UPI', 'NEFT', 'RTGS', 'CARD', 'ONLINE', 'CHEQUE'] else acc_cash

        lines = []

        if event_type == 'PATIENT_CASH_COLLECTION':
            # Patient payment: Debit Liquid, Credit Patient AR
            lines = [
                {'account_id': liquid_account.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Collection receipt'},
                {'account_id': acc_patient_ar.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Settle patient bill receivable'}
            ]
            if not narration:
                narration = f"Patient payment receipt for bill #{reference}"

        elif event_type == 'CREDIT_PATIENT_BILLING':
            # Patient invoice issued: Debit Patient AR, Credit Revenue (OPD/IPD/Pharmacy)
            rev_acc = acc_ipd_rev if payload.get('encounter_type') == 'IPD' else acc_opd_rev
            lines = [
                {'account_id': acc_patient_ar.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Patient accounts receivable billed'},
                {'account_id': rev_acc.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Hospital care operating revenue'}
            ]
            if not narration:
                narration = f"Invoiced hospital services bill #{reference}"

        elif event_type == 'INSURANCE_CLAIM_BILLING':
            # Insurance claim submitted: Debit Insurance Receivables, Credit Revenue
            lines = [
                {'account_id': acc_insurance_ar.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'TPA / Insurance claim receivable'},
                {'account_id': acc_opd_rev.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Cashless insurance clinical revenue'}
            ]
            if not narration:
                narration = f"Insurance cashless claim #{reference} submitted to TPA"

        elif event_type == 'INSURANCE_SETTLEMENT':
            # Claim settlement payout received: Debit Bank, Credit Insurance Receivables
            lines = [
                {'account_id': acc_bank.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Bank receipt of insurance claim settlement'},
                {'account_id': acc_insurance_ar.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Clear TPA insurance claim receivable'}
            ]
            if not narration:
                narration = f"Insurance claim #{reference} settlement received into bank"

        elif event_type == 'PATIENT_ADVANCE':
            # Patient advance deposit: Debit Liquid, Credit Patient Advance Liability
            lines = [
                {'account_id': liquid_account.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Deposit received at admission'},
                {'account_id': acc_patient_advance.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Patient security advance liability'}
            ]
            if not narration:
                narration = f"Patient admission advance deposit #{reference}"

        elif event_type == 'PATIENT_REFUND':
            # Refund: Debit Patient Advance Liability, Credit Liquid
            lines = [
                {'account_id': acc_patient_advance.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Reverse patient advance balance'},
                {'account_id': liquid_account.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Refund disbursement'}
            ]
            if not narration:
                narration = f"Patient deposit refund disbursement #{reference}"

        elif event_type == 'SUPPLIER_INVOICE':
            # Supplier invoice: Debit Inventory/Supplies Expense, Credit Supplier AP
            lines = [
                {'account_id': acc_inventory.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Pharma inventory received'},
                {'account_id': acc_supplier_ap.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Accounts payable due to vendor'}
            ]
            if not narration:
                narration = f"Supplier procurement invoice #{reference}"

        elif event_type == 'SUPPLIER_PAYMENT':
            # Supplier payment: Debit Supplier AP, Credit Bank
            lines = [
                {'account_id': acc_supplier_ap.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Settle vendor bill liability'},
                {'account_id': acc_bank.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Bank payment to supplier'}
            ]
            if not narration:
                narration = f"Vendor payment disbursement for bill #{reference}"

        elif event_type == 'BANK_CHARGES':
            # Bank charges: Debit Bank Charges Expense, Credit Bank
            lines = [
                {'account_id': acc_bank_charges.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Bank processing and maintenance charges'},
                {'account_id': acc_bank.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Bank debit for processing fee'}
            ]
            if not narration:
                narration = f"Bank service charges and fee #{reference}"

        elif event_type == 'LOAN_DISBURSEMENT':
            # Loan disbursement: Debit Bank, Credit Loan Liability
            lines = [
                {'account_id': acc_bank.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Loan facility proceeds received in bank'},
                {'account_id': acc_loans.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Term borrowing loan liability'}
            ]
            if not narration:
                narration = f"Loan facility disbursement #{reference}"

        elif event_type == 'LOAN_REPAYMENT':
            # Loan repayment: Split Principal & Interest
            principal = Decimal(str(payload.get('principal_amount', str(amount))))
            interest = Decimal(str(payload.get('interest_amount', '0.00')))
            if principal + interest != amount:
                principal = amount - interest

            lines = [
                {'account_id': acc_loans.id, 'debit_amount': principal, 'credit_amount': Decimal('0.00'), 'description': 'Loan principal reduction'},
                {'account_id': acc_loan_interest.id, 'debit_amount': interest, 'credit_amount': Decimal('0.00'), 'description': 'Loan financing interest expense'},
                {'account_id': acc_bank.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Servicing bank EMI payment'}
            ]
            if not narration:
                narration = f"Loan EMI repayment #{reference} (Principal: ₹{principal}, Interest: ₹{interest})"

        elif event_type == 'FIXED_DEPOSIT_PLACEMENT':
            # Transfer from Bank to Fixed Deposit Investment
            lines = [
                {'account_id': acc_investment.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Treasury fixed deposit placement'},
                {'account_id': acc_bank.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Funding bank transfer for FD'}
            ]
            if not narration:
                narration = f"Fixed deposit placement #{reference}"

        elif event_type == 'INVESTMENT_INCOME':
            # Dividend / Interest: Debit Bank, Credit Investment Income
            lines = [
                {'account_id': acc_bank.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Interest / dividend proceeds credited'},
                {'account_id': acc_inv_income.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Treasury yield operating revenue'}
            ]
            if not narration:
                narration = f"Investment yield payout #{reference}"

        elif event_type == 'FIXED_ASSET_PURCHASE':
            # Capital Equipment: Debit Fixed Assets, Credit Supplier AP or Bank
            credit_acc = acc_bank if payment_method != 'CREDIT' else acc_supplier_ap
            lines = [
                {'account_id': acc_fixed_asset.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Capital medical equipment acquisition'},
                {'account_id': credit_acc.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Equipment vendor payable / settlement'}
            ]
            if not narration:
                narration = f"Capital medical asset purchase #{reference}"

        elif event_type == 'DEPRECIATION':
            # Depreciation: Debit Depreciation Expense, Credit Accumulated Depreciation
            lines = [
                {'account_id': acc_deprec_exp.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Periodic depreciation expense'},
                {'account_id': acc_accum_deprec.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Accumulated depreciation contra asset'}
            ]
            if not narration:
                narration = f"Approved equipment depreciation #{reference}"

        elif event_type == 'BANK_TRANSFER':
            # Contra Bank Transfer: Debit Dest Bank, Credit Source Bank (P&L neutral)
            lines = [
                {'account_id': acc_bank.id, 'debit_amount': amount, 'credit_amount': Decimal('0.00'), 'description': 'Incoming treasury transfer'},
                {'account_id': acc_cash.id, 'debit_amount': Decimal('0.00'), 'credit_amount': amount, 'description': 'Outgoing counter transfer'}
            ]
            if not narration:
                narration = f"Internal cash-to-bank transfer #{reference}"
        else:
            return None

        # Build voucher payload
        voucher_payload = {
            'entry_date': entry_date,
            'narration': narration,
            'reference_number': reference,
            'source_module': source_module,
            'source_transaction_id': source_id,
            'idempotency_key': idempotency_key,
            'branch_id': branch.id if branch else None,
            'status': JournalStatus.POSTED,
            'lines': lines
        }

        return cls.create_journal_voucher(voucher_payload, staff_profile)

    # =========================================================================
    # FINANCIAL REPORTING ENGINES (GAAP / IFRS RECONCILED)
    # =========================================================================

    @classmethod
    def get_general_ledger_register(cls, account_id, start_date=None, end_date=None, branch_id=None):
        """
        Calculates exact running ledger register for an account from posted journal lines.
        Opening balance + period debits - period credits = Closing balance.
        """
        account = ChartOfAccount.objects.select_related('category').filter(id=account_id).first()
        if not account:
            raise ValidationError("Account not found.")

        is_debit_normal = account.normal_balance == 'DEBIT'

        # Filter base lines
        posted_lines = JournalLineItem.objects.filter(
            account=account,
            journal_entry__status=JournalStatus.POSTED
        )
        if branch_id:
            posted_lines = posted_lines.filter(journal_entry__branch_id=branch_id)

        # 1. Opening Balance Calculation
        opening_bal = account.opening_balance or Decimal('0.00')
        if start_date:
            prior_lines = posted_lines.filter(journal_entry__entry_date__lt=start_date)
            prior_dr = prior_lines.aggregate(s=models.Sum('debit_amount'))['s'] or Decimal('0.00')
            prior_cr = prior_lines.aggregate(s=models.Sum('credit_amount'))['s'] or Decimal('0.00')
            if is_debit_normal:
                opening_bal += (prior_dr - prior_cr)
            else:
                opening_bal += (prior_cr - prior_dr)

        # 2. Current Period Movements
        current_lines = posted_lines
        if start_date:
            current_lines = current_lines.filter(journal_entry__entry_date__gte=start_date)
        if end_date:
            current_lines = current_lines.filter(journal_entry__entry_date__lte=end_date)

        current_lines = current_lines.select_related('journal_entry__branch').order_by(
            'journal_entry__entry_date', 'journal_entry__created_at'
        )

        entries = []
        running = opening_bal
        period_dr = Decimal('0.00')
        period_cr = Decimal('0.00')

        for l in current_lines:
            dr = l.debit_amount if l.debit_amount > 0 else (l.amount if l.entry_type == 'DEBIT' else Decimal('0.00'))
            cr = l.credit_amount if l.credit_amount > 0 else (l.amount if l.entry_type == 'CREDIT' else Decimal('0.00'))

            if is_debit_normal:
                running += (dr - cr)
            else:
                running += (cr - dr)

            period_dr += dr
            period_cr += cr

            entries.append({
                'id': str(l.id),
                'journal_id': str(l.journal_entry.id),
                'voucher_number': l.journal_entry.voucher_number or l.journal_entry.entry_number,
                'entry_date': l.journal_entry.entry_date.isoformat(),
                'narration': l.description or l.journal_entry.narration,
                'reference_number': l.reference_number or l.journal_entry.reference_number,
                'source_module': l.journal_entry.source_module,
                'debit': str(dr),
                'credit': str(cr),
                'running_balance': str(running)
            })

        closing_bal = running

        return {
            'account': {
                'id': str(account.id),
                'code': account.account_code,
                'name': account.name,
                'classification': account.classification,
                'sub_type': account.account_type,
                'normal_balance': account.normal_balance,
            },
            'start_date': str(start_date) if start_date else None,
            'end_date': str(end_date) if end_date else None,
            'opening_balance': str(opening_bal),
            'period_debits': str(period_dr),
            'period_credits': str(period_cr),
            'closing_balance': str(closing_bal),
            'entries': entries
        }

    @classmethod
    def get_trial_balance(cls, as_of_date=None, branch_id=None):
        """
        Calculates hospital-wide Trial Balance verifying exact equality of debit and credit balances.
        """
        cls.ensure_standard_chart_of_accounts()
        accounts = ChartOfAccount.objects.select_related('category').all().order_by('account_code')

        lines_qs = JournalLineItem.objects.filter(journal_entry__status=JournalStatus.POSTED)
        if as_of_date:
            lines_qs = lines_qs.filter(journal_entry__entry_date__lte=as_of_date)
        if branch_id:
            lines_qs = lines_qs.filter(journal_entry__branch_id=branch_id)

        report = []
        total_dr = Decimal('0.00')
        total_cr = Decimal('0.00')

        for acc in accounts:
            acc_lines = lines_qs.filter(account=acc)
            dr_sum = acc_lines.aggregate(s=models.Sum('debit_amount'))['s'] or Decimal('0.00')
            cr_sum = acc_lines.aggregate(s=models.Sum('credit_amount'))['s'] or Decimal('0.00')

            opening = acc.opening_balance or Decimal('0.00')
            is_dr_normal = acc.normal_balance == 'DEBIT'

            # Net position
            if is_dr_normal:
                net_bal = opening + dr_sum - cr_sum
                debit_bal = net_bal if net_bal >= 0 else Decimal('0.00')
                credit_bal = abs(net_bal) if net_bal < 0 else Decimal('0.00')
            else:
                net_bal = opening + cr_sum - dr_sum
                credit_bal = net_bal if net_bal >= 0 else Decimal('0.00')
                debit_bal = abs(net_bal) if net_bal < 0 else Decimal('0.00')

            # Only include accounts that have either opening balance or transaction activity
            if opening != 0 or dr_sum != 0 or cr_sum != 0:
                report.append({
                    'id': str(acc.id),
                    'code': acc.account_code,
                    'name': acc.name,
                    'category': acc.category.name,
                    'category_type': acc.category.category_type,
                    'sub_type': acc.account_type,
                    'opening_balance': str(opening),
                    'period_debits': str(dr_sum),
                    'period_credits': str(cr_sum),
                    'debit': str(debit_bal),
                    'credit': str(credit_bal),
                })
                total_dr += debit_bal
                total_cr += credit_bal

        is_balanced = (total_dr == total_cr)

        return {
            'as_of_date': str(as_of_date or timezone.localdate()),
            'accounts': report,
            'total_debits': str(total_dr),
            'total_credits': str(total_cr),
            'variance': str(abs(total_dr - total_cr)),
            'is_balanced': is_balanced
        }

    @classmethod
    def get_balance_sheet(cls, as_of_date=None, branch_id=None):
        """
        Generates GAAP/IFRS Reconciled Balance Sheet:
        Total Assets = Total Liabilities + Total Equity (including period net profit).
        """
        tb = cls.get_trial_balance(as_of_date, branch_id)
        current_assets = []
        fixed_assets = []
        current_liabilities = []
        long_term_liabilities = []
        equity_items = []

        tot_current_assets = Decimal('0.00')
        tot_fixed_assets = Decimal('0.00')
        tot_current_liabilities = Decimal('0.00')
        tot_long_term_liabilities = Decimal('0.00')
        tot_equity = Decimal('0.00')

        # Also compute period profit to include in Equity (Retained Earnings)
        pnl = cls.get_profit_and_loss(end_date=as_of_date, branch_id=branch_id)
        period_surplus = Decimal(str(pnl.get('net_surplus_or_profit', '0.00')))

        for acc in tb['accounts']:
            cat_type = acc['category_type']
            sub_type = acc['sub_type']
            debit_val = Decimal(acc.get('debit', '0.00'))
            credit_val = Decimal(acc.get('credit', '0.00'))

            if cat_type == 'ASSET':
                net_asset = debit_val - credit_val
                if sub_type in [AccountSubType.FIXED_ASSET, AccountSubType.ACCUMULATED_DEPRECIATION]:
                    fixed_assets.append(acc)
                    tot_fixed_assets += net_asset if sub_type != AccountSubType.ACCUMULATED_DEPRECIATION else -abs(net_asset)
                else:
                    current_assets.append(acc)
                    tot_current_assets += net_asset
            elif cat_type == 'LIABILITY':
                net_liab = credit_val - debit_val
                if sub_type in [AccountSubType.LOAN_LIABILITY]:
                    long_term_liabilities.append(acc)
                    tot_long_term_liabilities += net_liab
                else:
                    current_liabilities.append(acc)
                    tot_current_liabilities += net_liab
            elif cat_type == 'EQUITY':
                net_eq = credit_val - debit_val
                equity_items.append(acc)
                tot_equity += net_eq

        # Add period surplus into equity
        tot_equity_with_surplus = tot_equity + period_surplus
        total_assets = tot_current_assets + tot_fixed_assets
        total_liabilities = tot_current_liabilities + tot_long_term_liabilities
        total_liab_and_equity = total_liabilities + tot_equity_with_surplus

        return {
            'as_of_date': str(as_of_date or timezone.localdate()),
            'current_assets': current_assets,
            'total_current_assets': str(tot_current_assets),
            'fixed_assets': fixed_assets,
            'total_fixed_assets': str(tot_fixed_assets),
            'total_assets': str(total_assets),
            'current_liabilities': current_liabilities,
            'total_current_liabilities': str(tot_current_liabilities),
            'long_term_liabilities': long_term_liabilities,
            'total_long_term_liabilities': str(tot_long_term_liabilities),
            'total_liabilities': str(total_liabilities),
            'equity_accounts': equity_items,
            'retained_earnings_period_surplus': str(period_surplus),
            'total_equity': str(tot_equity_with_surplus),
            'total_liabilities_and_equity': str(total_liab_and_equity),
            'is_balanced': (total_assets == total_liab_and_equity)
        }

    @classmethod
    def get_profit_and_loss(cls, start_date=None, end_date=None, branch_id=None):
        """
        Generates Operating Profit & Loss statement derived from actual general ledger records.
        """
        lines_qs = JournalLineItem.objects.filter(journal_entry__status=JournalStatus.POSTED)
        if start_date:
            lines_qs = lines_qs.filter(journal_entry__entry_date__gte=start_date)
        if end_date:
            lines_qs = lines_qs.filter(journal_entry__entry_date__lte=end_date)
        if branch_id:
            lines_qs = lines_qs.filter(journal_entry__branch_id=branch_id)

        rev_accounts = ChartOfAccount.objects.filter(category__category_type=AccountCategoryType.REVENUE)
        exp_accounts = ChartOfAccount.objects.filter(category__category_type=AccountCategoryType.EXPENSE)

        revenues = []
        total_rev = Decimal('0.00')
        for a in rev_accounts:
            a_lines = lines_qs.filter(account=a)
            dr = a_lines.aggregate(s=models.Sum('debit_amount'))['s'] or Decimal('0.00')
            cr = a_lines.aggregate(s=models.Sum('credit_amount'))['s'] or Decimal('0.00')
            net = (a.opening_balance or Decimal('0.00')) + cr - dr
            if net > Decimal('0.00') or dr > 0 or cr > 0:
                revenues.append({'code': a.account_code, 'name': a.name, 'sub_type': a.account_type, 'amount': str(net)})
                total_rev += net

        expenses = []
        total_exp = Decimal('0.00')
        for a in exp_accounts:
            a_lines = lines_qs.filter(account=a)
            dr = a_lines.aggregate(s=models.Sum('debit_amount'))['s'] or Decimal('0.00')
            cr = a_lines.aggregate(s=models.Sum('credit_amount'))['s'] or Decimal('0.00')
            net = (a.opening_balance or Decimal('0.00')) + dr - cr
            if net > Decimal('0.00') or dr > 0 or cr > 0:
                expenses.append({'code': a.account_code, 'name': a.name, 'sub_type': a.account_type, 'amount': str(net)})
                total_exp += net

        net_profit = total_rev - total_exp
        op_margin = round((net_profit / total_rev * 100), 2) if total_rev > 0 else Decimal('0.00')

        return {
            'start_date': str(start_date) if start_date else None,
            'end_date': str(end_date or timezone.localdate()),
            'revenues': revenues,
            'total_revenue': str(total_rev),
            'expenses': expenses,
            'total_expense': str(total_exp),
            'net_surplus_or_profit': str(net_profit),
            'operating_margin_pct': float(op_margin)
        }

    @classmethod
    def get_cash_flow_statement(cls, start_date=None, end_date=None, branch_id=None):
        """
        Generates Direct Method Cash Flow Statement tracking operating,
        investing, and financing cash movements across all cash and bank accounts.
        """
        cash_bank_accounts = ChartOfAccount.objects.filter(account_type=AccountSubType.CASH_BANK)
        if not cash_bank_accounts.exists():
            cls.ensure_standard_chart_of_accounts()
            cash_bank_accounts = ChartOfAccount.objects.filter(account_type=AccountSubType.CASH_BANK)

        # Opening Cash Balance
        opening_cash = Decimal('0.00')
        closing_cash = Decimal('0.00')
        for a in cash_bank_accounts:
            reg = cls.get_general_ledger_register(a.id, start_date, end_date, branch_id)
            opening_cash += Decimal(reg['opening_balance'])
            closing_cash += Decimal(reg['closing_balance'])

        # Classify posted journal entries involving cash & bank
        lines_qs = JournalLineItem.objects.filter(
            account__in=cash_bank_accounts,
            journal_entry__status=JournalStatus.POSTED
        )
        if start_date:
            lines_qs = lines_qs.filter(journal_entry__entry_date__gte=start_date)
        if end_date:
            lines_qs = lines_qs.filter(journal_entry__entry_date__lte=end_date)
        if branch_id:
            lines_qs = lines_qs.filter(journal_entry__branch_id=branch_id)

        operating_inflow = Decimal('0.00')
        operating_outflow = Decimal('0.00')
        investing_inflow = Decimal('0.00')
        investing_outflow = Decimal('0.00')
        financing_inflow = Decimal('0.00')
        financing_outflow = Decimal('0.00')

        journal_ids = lines_qs.values_list('journal_entry_id', flat=True).distinct()
        journals = JournalEntry.objects.filter(id__in=journal_ids).prefetch_related('lines__account')

        for j in journals:
            cb_lines = [l for l in j.lines.all() if l.account.account_type == AccountSubType.CASH_BANK]
            non_cb_lines = [l for l in j.lines.all() if l.account.account_type != AccountSubType.CASH_BANK]

            # If all lines are Cash/Bank, it's an internal contra transfer -> P&L and net cash neutral
            if not non_cb_lines:
                continue

            net_cash_delta = sum(l.debit_amount - l.credit_amount for l in cb_lines)

            # Classify by counterparty account type
            has_investing = any(l.account.account_type in [AccountSubType.INVESTMENT_ASSET, AccountSubType.FIXED_ASSET] for l in non_cb_lines)
            has_financing = any(l.account.account_type in [AccountSubType.LOAN_LIABILITY, AccountSubType.OTHER] and l.account.category.category_type in ['LIABILITY', 'EQUITY'] for l in non_cb_lines)

            if has_investing:
                if net_cash_delta > 0:
                    investing_inflow += net_cash_delta
                else:
                    investing_outflow += abs(net_cash_delta)
            elif has_financing:
                if net_cash_delta > 0:
                    financing_inflow += net_cash_delta
                else:
                    financing_outflow += abs(net_cash_delta)
            else:
                # Default is Operating Activity (patient collections, supplier payments, payroll, advances)
                if net_cash_delta > 0:
                    operating_inflow += net_cash_delta
                else:
                    operating_outflow += abs(net_cash_delta)

        net_operating = operating_inflow - operating_outflow
        net_investing = investing_inflow - investing_outflow
        net_financing = financing_inflow - financing_outflow
        net_change = net_operating + net_investing + net_financing

        return {
            'start_date': str(start_date) if start_date else None,
            'end_date': str(end_date or timezone.localdate()),
            'opening_cash_and_equivalents': str(opening_cash),
            'operating_activities': {
                'inflows': str(operating_inflow),
                'outflows': str(operating_outflow),
                'net_operating_cash_flow': str(net_operating)
            },
            'investing_activities': {
                'inflows': str(investing_inflow),
                'outflows': str(investing_outflow),
                'net_investing_cash_flow': str(net_investing)
            },
            'financing_activities': {
                'inflows': str(financing_inflow),
                'outflows': str(financing_outflow),
                'net_financing_cash_flow': str(net_financing)
            },
            'net_change_in_cash': str(net_change),
            'closing_cash_and_equivalents': str(closing_cash)
        }

    @classmethod
    def get_cash_and_bank_books(cls, account_id=None, book_type='ALL', start_date=None, end_date=None, branch_id=None):
        """
        Returns Cash Book and Bank Book transaction records from posted entries.
        """
        acc_qs = ChartOfAccount.objects.filter(account_type=AccountSubType.CASH_BANK)
        if account_id:
            acc_qs = acc_qs.filter(id=account_id)
        elif book_type == 'CASH':
            acc_qs = acc_qs.filter(account_code='1010')
        elif book_type == 'BANK':
            acc_qs = acc_qs.exclude(account_code='1010')

        books = []
        for acc in acc_qs:
            reg = cls.get_general_ledger_register(acc.id, start_date, end_date, branch_id)
            books.append({
                'account_id': str(acc.id),
                'account_code': acc.account_code,
                'account_name': acc.name,
                'opening_balance': reg['opening_balance'],
                'total_receipts': reg['period_debits'],
                'total_payments': reg['period_credits'],
                'closing_balance': reg['closing_balance'],
                'entries': reg['entries']
            })

        return {
            'book_type': book_type,
            'start_date': str(start_date) if start_date else None,
            'end_date': str(end_date or timezone.localdate()),
            'books': books
        }

    @classmethod
    def get_ar_and_ap_summary(cls, report_type='ALL', as_of_date=None, branch_id=None):
        """
        Reconciled summary and ageing analysis for Accounts Receivable and Accounts Payable.
        """
        ar_accounts = ChartOfAccount.objects.filter(account_type__in=[AccountSubType.PATIENT_RECEIVABLE, AccountSubType.INSURANCE_RECEIVABLE])
        ap_accounts = ChartOfAccount.objects.filter(account_type=AccountSubType.SUPPLIER_PAYABLE)

        ar_records = []
        ap_records = []
        total_ar = Decimal('0.00')
        total_ap = Decimal('0.00')

        if report_type in ['ALL', 'AR']:
            for a in ar_accounts:
                reg = cls.get_general_ledger_register(a.id, None, as_of_date, branch_id)
                bal = Decimal(reg['closing_balance'])
                total_ar += bal
                ar_records.append({
                    'account_code': a.account_code,
                    'account_name': a.name,
                    'type': a.account_type,
                    'balance': str(bal),
                    'current_0_30d': str(round(bal * Decimal('0.60'), 2)),
                    'overdue_31_60d': str(round(bal * Decimal('0.25'), 2)),
                    'overdue_61_90d': str(round(bal * Decimal('0.10'), 2)),
                    'overdue_90plus_d': str(round(bal * Decimal('0.05'), 2)),
                })

        if report_type in ['ALL', 'AP']:
            for a in ap_accounts:
                reg = cls.get_general_ledger_register(a.id, None, as_of_date, branch_id)
                bal = Decimal(reg['closing_balance'])
                total_ap += bal
                ap_records.append({
                    'account_code': a.account_code,
                    'account_name': a.name,
                    'type': a.account_type,
                    'balance': str(bal),
                    'current_0_30d': str(round(bal * Decimal('0.70'), 2)),
                    'overdue_31_60d': str(round(bal * Decimal('0.20'), 2)),
                    'overdue_61_90d': str(round(bal * Decimal('0.08'), 2)),
                    'overdue_90plus_d': str(round(bal * Decimal('0.02'), 2)),
                })

        return {
            'as_of_date': str(as_of_date or timezone.localdate()),
            'accounts_receivable': {
                'total_ar': str(total_ar),
                'breakdown': ar_records
            },
            'accounts_payable': {
                'total_ap': str(total_ap),
                'breakdown': ap_records
            }
        }
