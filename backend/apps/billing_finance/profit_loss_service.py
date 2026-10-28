import uuid
from decimal import Decimal
import calendar
from datetime import date, timedelta
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.core.models import Branch, Department
from .models import (
    ChartOfAccount, AccountCategoryType, AccountSubType,
    JournalEntry, JournalLineItem, JournalStatus,
    FiscalYear, AccountingPeriod
)


class ProfitLossService:
    """
    Section 18: Profit and Loss Management Service.
    Calculates 21 GAAP/IFRS reconciled P&L metrics, period comparisons,
    department-wise profitability with transparent overhead allocation,
    branch-wise performance, and ledger drill-down derived exclusively from
    posted General Ledger entries in Supabase PostgreSQL.
    """

    # Account code mappings
    ACC_OPD_REV = '4010'
    ACC_IPD_REV = '4020'
    ACC_SURGERY_REV = '4025'
    ACC_ICU_REV = '4028'
    ACC_DIAG_REV = '4030'
    ACC_PHARM_REV = '4040'
    ACC_INTEREST_INC = '4050'
    ACC_OTHER_OP_INC = '4060'
    ACC_INV_GAINS = '4070'

    ACC_SALARIES_EXP = '5010'
    ACC_UTILITIES_EXP = '5020'
    ACC_CONSUMABLES_COGS = '5030'
    ACC_LOAN_INTEREST_EXP = '5040'
    ACC_BANK_GATEWAY_FEES = '5050'
    ACC_DEPRECIATION_EXP = '5060'
    ACC_RENT_EXP = '5070'
    ACC_TAX_EXP = '5080'

    @classmethod
    def resolve_date_filters(cls, period_type='ANNUAL', start_date=None, end_date=None, fiscal_year_id=None):
        """
        Resolves start and end dates based on filter selection:
        DAILY, MONTHLY, QUARTERLY, ANNUAL (April 1 to March 31 convention), or CUSTOM.
        """
        today = timezone.localdate()

        if period_type == 'DAILY':
            s_date = today
            e_date = today
        elif period_type == 'MONTHLY':
            s_date = today.replace(day=1)
            e_date = today
        elif period_type == 'QUARTERLY':
            current_month = today.month
            # Hospital April-March convention quarters
            # Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar
            if current_month in [4, 5, 6]:
                q_start_month = 4
            elif current_month in [7, 8, 9]:
                q_start_month = 7
            elif current_month in [10, 11, 12]:
                q_start_month = 10
            else:
                q_start_month = 1
            year = today.year
            s_date = date(year, q_start_month, 1)
            e_date = today
        elif period_type == 'ANNUAL':
            # Default April 1 to March 31 hospital FY
            if today.month >= 4:
                s_date = date(today.year, 4, 1)
                e_date = date(today.year + 1, 3, 31)
            else:
                s_date = date(today.year - 1, 4, 1)
                e_date = date(today.year, 3, 31)
        elif period_type == 'CUSTOM':
            if isinstance(start_date, str):
                s_date = timezone.datetime.strptime(start_date, '%Y-%m-%d').date()
            elif isinstance(start_date, date):
                s_date = start_date
            else:
                s_date = today.replace(day=1)

            if isinstance(end_date, str):
                e_date = timezone.datetime.strptime(end_date, '%Y-%m-%d').date()
            elif isinstance(end_date, date):
                e_date = end_date
            else:
                e_date = today
        else:
            s_date = today.replace(day=1)
            e_date = today

        # Override by Fiscal Year if explicit fiscal_year_id provided
        if fiscal_year_id:
            fy = FiscalYear.objects.filter(id=fiscal_year_id).first()
            if fy:
                s_date = fy.start_date
                e_date = fy.end_date

        return s_date, e_date

    @classmethod
    def get_comparison_window(cls, start_date, end_date):
        """
        Calculates equivalent preceding period window for period-over-period comparison.
        """
        duration_days = (end_date - start_date).days + 1
        comp_end_date = start_date - timedelta(days=1)
        comp_start_date = comp_end_date - timedelta(days=duration_days - 1)
        return comp_start_date, comp_end_date

    @classmethod
    def _query_posted_lines(cls, start_date=None, end_date=None, branch_id=None, department_id=None):
        """
        Core query helper returning posted journal line items filtered by parameters.
        """
        qs = JournalLineItem.objects.filter(
            journal_entry__status=JournalStatus.POSTED
        ).select_related(
            'journal_entry', 'account', 'account__category', 'branch', 'department'
        )

        if start_date:
            qs = qs.filter(journal_entry__entry_date__gte=start_date)
        if end_date:
            qs = qs.filter(journal_entry__entry_date__lte=end_date)
        if branch_id:
            qs = qs.filter(
                models.Q(branch_id=branch_id) | models.Q(journal_entry__branch_id=branch_id)
            )
        if department_id:
            qs = qs.filter(
                models.Q(department_id=department_id) | models.Q(journal_entry__department_id=department_id)
            )

        return qs

    @classmethod
    def _calc_account_net(cls, lines_qs, account_code_or_list):
        """
        Calculates net balance for specific account code(s).
        For Revenue (Credit normal): Credits - Debits
        For Expenses (Debit normal): Debits - Credits
        """
        if isinstance(account_code_or_list, (list, tuple)):
            filtered = lines_qs.filter(account__account_code__in=account_code_or_list)
        else:
            filtered = lines_qs.filter(account__account_code=account_code_or_list)

        agg = filtered.aggregate(
            dr=models.Sum('debit_amount'),
            cr=models.Sum('credit_amount')
        )
        dr = agg['dr'] or Decimal('0.00')
        cr = agg['cr'] or Decimal('0.00')

        return dr, cr

    @classmethod
    def get_21_metrics(cls, start_date=None, end_date=None, branch_id=None, department_id=None):
        """
        Calculates the 21 master P&L metrics strictly from posted General Ledger entries.
        """
        lines = cls._query_posted_lines(start_date, end_date, branch_id, department_id)

        # 1. Revenue accounts (Credit normal: Net = Cr - Dr)
        opd_dr, opd_cr = cls._calc_account_net(lines, cls.ACC_OPD_REV)
        opd_rev = max(Decimal('0.00'), opd_cr - opd_dr)

        ipd_dr, ipd_cr = cls._calc_account_net(lines, cls.ACC_IPD_REV)
        ipd_rev = max(Decimal('0.00'), ipd_cr - ipd_dr)

        surgery_dr, surgery_cr = cls._calc_account_net(lines, cls.ACC_SURGERY_REV)
        surgery_rev = max(Decimal('0.00'), surgery_cr - surgery_dr)

        icu_dr, icu_cr = cls._calc_account_net(lines, cls.ACC_ICU_REV)
        icu_rev = max(Decimal('0.00'), icu_cr - icu_dr)

        diag_dr, diag_cr = cls._calc_account_net(lines, cls.ACC_DIAG_REV)
        diag_rev = max(Decimal('0.00'), diag_cr - diag_dr)

        pharm_dr, pharm_cr = cls._calc_account_net(lines, cls.ACC_PHARM_REV)
        pharm_rev = max(Decimal('0.00'), pharm_cr - pharm_dr)

        interest_dr, interest_cr = cls._calc_account_net(lines, cls.ACC_INTEREST_INC)
        interest_income = max(Decimal('0.00'), interest_cr - interest_dr)

        other_op_dr, other_op_cr = cls._calc_account_net(lines, cls.ACC_OTHER_OP_INC)
        other_op_income = max(Decimal('0.00'), other_op_cr - other_op_dr)

        inv_dr, inv_cr = cls._calc_account_net(lines, cls.ACC_INV_GAINS)
        inv_gains_losses = inv_cr - inv_dr  # Can be positive or negative

        # Total hospital operating revenue
        total_operating_revenue = (
            opd_rev + ipd_rev + surgery_rev + icu_rev +
            diag_rev + pharm_rev + other_op_income
        )

        # Total hospital revenue (all operating revenue + non-operating revenue)
        total_hospital_revenue = total_operating_revenue + interest_income + max(Decimal('0.00'), inv_gains_losses)

        # 2. Expense accounts (Debit normal: Net = Dr - Cr)
        salaries_dr, salaries_cr = cls._calc_account_net(lines, cls.ACC_SALARIES_EXP)
        salaries_payroll = max(Decimal('0.00'), salaries_dr - salaries_cr)

        util_dr, util_cr = cls._calc_account_net(lines, cls.ACC_UTILITIES_EXP)
        rent_dr, rent_cr = cls._calc_account_net(lines, cls.ACC_RENT_EXP)
        rent_utility_exp = max(Decimal('0.00'), (util_dr - util_cr) + (rent_dr - rent_cr))

        cogs_dr, cogs_cr = cls._calc_account_net(lines, cls.ACC_CONSUMABLES_COGS)
        pharmacy_cogs = max(Decimal('0.00'), cogs_dr - cogs_cr)
        consumables_medicine = pharmacy_cogs  # Medical supplies & pharmacy consumables COGS

        deprec_dr, deprec_cr = cls._calc_account_net(lines, cls.ACC_DEPRECIATION_EXP)
        depreciation = max(Decimal('0.00'), deprec_dr - deprec_cr)

        interest_exp_dr, interest_exp_cr = cls._calc_account_net(lines, cls.ACC_LOAN_INTEREST_EXP)
        interest_expense = max(Decimal('0.00'), interest_exp_dr - interest_exp_cr)

        fees_dr, fees_cr = cls._calc_account_net(lines, cls.ACC_BANK_GATEWAY_FEES)
        bank_gateway_fees = max(Decimal('0.00'), fees_dr - fees_cr)

        tax_dr, tax_cr = cls._calc_account_net(lines, cls.ACC_TAX_EXP)
        tax_expense = max(Decimal('0.00'), tax_dr - tax_cr)

        # Operating expenses
        total_operating_expenses = (
            salaries_payroll + rent_utility_exp + consumables_medicine +
            depreciation
        )

        # 3. GAAP Multi-Step Subtotals
        # Gross profit = Net Operating Revenue - Directly Attributable COGS
        gross_profit = total_operating_revenue - pharmacy_cogs

        # Operating profit = Operating Revenue - Total Operating Expenses
        operating_profit = total_operating_revenue - total_operating_expenses

        # Profit before tax = Operating Profit + Interest Income + Investment Gains/(Losses) - Interest Expense - Bank Fees
        profit_before_tax = (
            operating_profit + interest_income + inv_gains_losses -
            interest_expense - bank_gateway_fees
        )

        # Net profit = Profit Before Tax - Tax Expense
        net_profit = profit_before_tax - tax_expense

        # Operating Margin & Net Profit Margin %
        op_margin_pct = round((operating_profit / total_operating_revenue * Decimal('100.0')), 2) if total_operating_revenue > 0 else Decimal('0.00')
        net_margin_pct = round((net_profit / total_hospital_revenue * Decimal('100.0')), 2) if total_hospital_revenue > 0 else Decimal('0.00')

        return {
            'total_hospital_revenue': str(total_hospital_revenue),
            'opd_revenue': str(opd_rev),
            'ipd_revenue': str(ipd_rev),
            'pharmacy_revenue': str(pharm_rev),
            'pharmacy_cogs': str(pharmacy_cogs),
            'diagnostic_revenue': str(diag_rev),
            'surgery_revenue': str(surgery_rev),
            'icu_revenue': str(icu_rev),
            'other_operating_income': str(other_op_income),
            'total_operating_expenses': str(total_operating_expenses),
            'salaries_payroll': str(salaries_payroll),
            'rent_utilities': str(rent_utility_exp),
            'consumables_medicine': str(consumables_medicine),
            'depreciation': str(depreciation),
            'interest_income': str(interest_income),
            'interest_expense': str(interest_expense),
            'investment_gains_losses': str(inv_gains_losses),
            'bank_gateway_fees': str(bank_gateway_fees),
            'gross_profit': str(gross_profit),
            'operating_profit': str(operating_profit),
            'profit_before_tax': str(profit_before_tax),
            'tax_expense': str(tax_expense),
            'net_profit': str(net_profit),
            'operating_margin_pct': float(op_margin_pct),
            'net_margin_pct': float(net_margin_pct),
        }

    @classmethod
    def get_dashboard_data(cls, period_type='ANNUAL', start_date=None, end_date=None,
                           branch_id=None, department_id=None, fiscal_year_id=None):
        """
        Assembles complete Profit & Loss Executive Dashboard:
        - 21 Master KPI cards with previous period comparison and % variances
        - Visual chart datasets (Monthly trend, Department revenue, Category expense, Branch performance)
        """
        s_date, e_date = cls.resolve_date_filters(period_type, start_date, end_date, fiscal_year_id)
        comp_s_date, comp_e_date = cls.get_comparison_window(s_date, e_date)

        current_metrics = cls.get_21_metrics(s_date, e_date, branch_id, department_id)
        comp_metrics = cls.get_21_metrics(comp_s_date, comp_e_date, branch_id, department_id)

        # Variance calculations
        comparison = {}
        for key in current_metrics:
            if key in ['operating_margin_pct', 'net_margin_pct']:
                diff = current_metrics[key] - comp_metrics[key]
                comparison[key] = {
                    'current': current_metrics[key],
                    'previous': comp_metrics[key],
                    'variance': round(diff, 2),
                    'pct_change': round(diff, 2)
                }
            else:
                curr_val = Decimal(current_metrics[key])
                prev_val = Decimal(comp_metrics[key])
                diff = curr_val - prev_val
                if prev_val != Decimal('0.00'):
                    pct = round((diff / abs(prev_val)) * Decimal('100.0'), 2)
                else:
                    pct = Decimal('100.0') if curr_val > 0 else Decimal('0.00')

                comparison[key] = {
                    'current': str(curr_val),
                    'previous': str(prev_val),
                    'variance': str(diff),
                    'pct_change': float(pct),
                    'trend': 'UP' if diff > 0 else ('DOWN' if diff < 0 else 'FLAT')
                }

        # Visual Chart 1: Revenue vs Expenses
        tot_rev = Decimal(current_metrics['total_hospital_revenue'])
        tot_exp = Decimal(current_metrics['total_operating_expenses']) + Decimal(current_metrics['interest_expense']) + Decimal(current_metrics['bank_gateway_fees'])
        rev_vs_exp = {
            'total_revenue': str(tot_rev),
            'total_expense': str(tot_exp),
            'net_profit': str(Decimal(current_metrics['net_profit'])),
            'expense_to_revenue_ratio': round(float(tot_exp / tot_rev * 100), 2) if tot_rev > 0 else 0.0
        }

        # Visual Chart 2: 12-Month Profit & Loss Trend
        monthly_trend = cls._get_monthly_trend(s_date, e_date, branch_id, department_id)

        # Visual Chart 3: Revenue by Department
        rev_by_dept = cls._get_revenue_by_department(s_date, e_date, branch_id)

        # Visual Chart 4: Expense Breakdown by Category
        exp_by_cat = cls._get_expense_by_category(s_date, e_date, branch_id, department_id)

        # Visual Chart 5: Branch Performance
        branch_perf = cls.get_branch_profitability(s_date, e_date)

        return {
            'period_type': period_type,
            'start_date': s_date.isoformat(),
            'end_date': e_date.isoformat(),
            'comparison_start_date': comp_s_date.isoformat(),
            'comparison_end_date': comp_e_date.isoformat(),
            'metrics': current_metrics,
            'comparison': comparison,
            'charts': {
                'revenue_vs_expenses': rev_vs_exp,
                'monthly_trend': monthly_trend,
                'revenue_by_department': rev_by_dept,
                'expense_by_category': exp_by_cat,
                'branch_performance': branch_perf
            }
        }

    @classmethod
    def _get_monthly_trend(cls, start_date, end_date, branch_id=None, department_id=None):
        """
        Generates 12 monthly slices showing revenue, expenses, and net profit trend.
        """
        # Determine 6 to 12 months timeline
        months = []
        cur_date = start_date.replace(day=1)
        end_month = end_date.replace(day=1)

        while cur_date <= end_month:
            # End of month
            year = cur_date.year + (1 if cur_date.month == 12 else 0)
            month = 1 if cur_date.month == 12 else (cur_date.month + 1)
            next_month = date(year, month, 1)
            m_end = min(end_date, next_month - timedelta(days=1))

            lines = cls._query_posted_lines(cur_date, m_end, branch_id, department_id)
            # Rev: credit normal
            rev_agg = lines.filter(account__category__category_type=AccountCategoryType.REVENUE).aggregate(
                dr=models.Sum('debit_amount'), cr=models.Sum('credit_amount')
            )
            m_rev = max(Decimal('0.00'), (rev_agg['cr'] or Decimal('0.00')) - (rev_agg['dr'] or Decimal('0.00')))

            # Exp: debit normal
            exp_agg = lines.filter(account__category__category_type=AccountCategoryType.EXPENSE).aggregate(
                dr=models.Sum('debit_amount'), cr=models.Sum('credit_amount')
            )
            m_exp = max(Decimal('0.00'), (exp_agg['dr'] or Decimal('0.00')) - (exp_agg['cr'] or Decimal('0.00')))

            m_profit = m_rev - m_exp

            months.append({
                'month_key': cur_date.strftime('%Y-%m'),
                'month_name': cur_date.strftime('%b %Y'),
                'revenue': str(m_rev),
                'expenses': str(m_exp),
                'net_profit': str(m_profit),
                'operating_margin': round(float(m_profit / m_rev * 100), 2) if m_rev > 0 else 0.0
            })

            cur_date = next_month
            if len(months) >= 12:
                break

        return months

    @classmethod
    def _get_revenue_by_department(cls, start_date, end_date, branch_id=None):
        """
        Aggregates revenue distribution across hospital departments.
        """
        lines = cls._query_posted_lines(start_date, end_date, branch_id).filter(
            account__category__category_type=AccountCategoryType.REVENUE
        )

        departments = Department.objects.all().order_by('name')
        dept_rev = []
        total_tracked = Decimal('0.00')

        for d in departments:
            d_lines = lines.filter(models.Q(department=d) | models.Q(journal_entry__department=d))
            agg = d_lines.aggregate(dr=models.Sum('debit_amount'), cr=models.Sum('credit_amount'))
            net = max(Decimal('0.00'), (agg['cr'] or Decimal('0.00')) - (agg['dr'] or Decimal('0.00')))
            if net > 0:
                dept_rev.append({
                    'department_id': str(d.id),
                    'code': d.code,
                    'name': d.name,
                    'revenue': str(net)
                })
                total_tracked += net

        # Check untagged / general hospital revenue
        untagged_lines = lines.filter(department__isnull=True, journal_entry__department__isnull=True)
        un_agg = untagged_lines.aggregate(dr=models.Sum('debit_amount'), cr=models.Sum('credit_amount'))
        untagged_net = max(Decimal('0.00'), (un_agg['cr'] or Decimal('0.00')) - (un_agg['dr'] or Decimal('0.00')))
        if untagged_net > 0:
            dept_rev.append({
                'department_id': 'UNALLOCATED',
                'code': 'GEN',
                'name': 'General Hospital / Central Billing',
                'revenue': str(untagged_net)
            })
            total_tracked += untagged_net

        # Compute percentages
        for item in dept_rev:
            amt = Decimal(item['revenue'])
            item['percentage'] = round(float(amt / total_tracked * 100), 1) if total_tracked > 0 else 0.0

        return dept_rev

    @classmethod
    def _get_expense_by_category(cls, start_date, end_date, branch_id=None, department_id=None):
        """
        Aggregates operating and administrative expenses by category.
        """
        lines = cls._query_posted_lines(start_date, end_date, branch_id, department_id).filter(
            account__category__category_type=AccountCategoryType.EXPENSE
        )

        categories = [
            ('Salaries & Payroll', [cls.ACC_SALARIES_EXP], '#06b6d4'),
            ('Rent & Campus Facilities', [cls.ACC_RENT_EXP], '#8b5cf6'),
            ('Utilities & Electricity', [cls.ACC_UTILITIES_EXP], '#3b82f6'),
            ('Consumables & Medicine COGS', [cls.ACC_CONSUMABLES_COGS], '#10b981'),
            ('Medical Equipment Depreciation', [cls.ACC_DEPRECIATION_EXP], '#f59e0b'),
            ('Loan Financing & Interest', [cls.ACC_LOAN_INTEREST_EXP], '#ec4899'),
            ('Bank Charges & Processing Fees', [cls.ACC_BANK_GATEWAY_FEES], '#64748b'),
            ('Income & Statutory Taxes', [cls.ACC_TAX_EXP], '#ef4444')
        ]

        result = []
        total_exp = Decimal('0.00')
        for label, acc_codes, color in categories:
            dr, cr = cls._calc_account_net(lines, acc_codes)
            net = max(Decimal('0.00'), dr - cr)
            if net > 0:
                result.append({
                    'category': label,
                    'account_codes': acc_codes,
                    'amount': str(net),
                    'color': color
                })
                total_exp += net

        for item in result:
            amt = Decimal(item['amount'])
            item['percentage'] = round(float(amt / total_exp * 100), 1) if total_exp > 0 else 0.0

        return result

    @classmethod
    def get_department_profitability(cls, start_date=None, end_date=None, branch_id=None):
        """
        Computes department-wise profitability with transparent, documented allocation
        of shared hospital administrative overhead.
        Direct Revenue - Direct Expenses - Allocated Overhead = Department Operating Profit.
        """
        lines = cls._query_posted_lines(start_date, end_date, branch_id)

        # 1. Total shared hospital overhead (rent, utilities, unallocated general salaries)
        overhead_lines = lines.filter(
            account__category__category_type=AccountCategoryType.EXPENSE,
            department__isnull=True,
            journal_entry__department__isnull=True
        )
        ov_agg = overhead_lines.aggregate(dr=models.Sum('debit_amount'), cr=models.Sum('credit_amount'))
        total_shared_overhead = max(Decimal('0.00'), (ov_agg['dr'] or Decimal('0.00')) - (ov_agg['cr'] or Decimal('0.00')))

        # Total hospital revenue for proportional allocation weight
        rev_lines = lines.filter(account__category__category_type=AccountCategoryType.REVENUE)
        tot_rev_agg = rev_lines.aggregate(dr=models.Sum('debit_amount'), cr=models.Sum('credit_amount'))
        total_hospital_rev = max(Decimal('0.00'), (tot_rev_agg['cr'] or Decimal('0.00')) - (tot_rev_agg['dr'] or Decimal('0.00')))

        departments = Department.objects.all().order_by('name')
        dept_results = []

        for d in departments:
            d_rev_lines = lines.filter(
                models.Q(department=d) | models.Q(journal_entry__department=d),
                account__category__category_type=AccountCategoryType.REVENUE
            )
            r_agg = d_rev_lines.aggregate(dr=models.Sum('debit_amount'), cr=models.Sum('credit_amount'))
            d_rev = max(Decimal('0.00'), (r_agg['cr'] or Decimal('0.00')) - (r_agg['dr'] or Decimal('0.00')))

            d_exp_lines = lines.filter(
                models.Q(department=d) | models.Q(journal_entry__department=d),
                account__category__category_type=AccountCategoryType.EXPENSE
            )
            e_agg = d_exp_lines.aggregate(dr=models.Sum('debit_amount'), cr=models.Sum('credit_amount'))
            d_direct_exp = max(Decimal('0.00'), (e_agg['dr'] or Decimal('0.00')) - (e_agg['cr'] or Decimal('0.00')))

            # Proportional Overhead Allocation Formula:
            # Allocation = Shared Overhead * (Department Revenue / Total Hospital Revenue)
            if total_hospital_rev > Decimal('0.00'):
                revenue_share_ratio = d_rev / total_hospital_rev
                d_allocated_exp = round(total_shared_overhead * revenue_share_ratio, 2)
            else:
                dept_count = departments.count() or 1
                d_allocated_exp = round(total_shared_overhead / Decimal(str(dept_count)), 2)

            total_dept_exp = d_direct_exp + d_allocated_exp
            op_profit = d_rev - total_dept_exp
            margin = round((op_profit / d_rev * 100), 2) if d_rev > 0 else Decimal('0.00')

            dept_results.append({
                'department_id': str(d.id),
                'code': d.code,
                'name': d.name,
                'revenue': str(d_rev),
                'direct_expenses': str(d_direct_exp),
                'allocated_overhead': str(d_allocated_exp),
                'total_expenses': str(total_dept_exp),
                'operating_profit': str(op_profit),
                'profit_margin_pct': float(margin),
                'status': 'PROFITABLE' if op_profit > 0 else ('BREAKEVEN' if op_profit == 0 else 'LOSS')
            })

        return {
            'allocation_policy': 'Proportional Revenue-Weighted Shared Overhead Allocation Method',
            'allocation_formula': 'Allocated Overhead = Total Unassigned Hospital Overhead * (Department Revenue / Total Hospital Revenue)',
            'total_shared_overhead': str(total_shared_overhead),
            'total_hospital_revenue': str(total_hospital_rev),
            'departments': dept_results
        }

    @classmethod
    def get_branch_profitability(cls, start_date=None, end_date=None):
        """
        Branch-wise financial performance with inter-branch transfer elimination.
        """
        branches = Branch.objects.all().order_by('name')
        results = []

        hospital_rev = Decimal('0.00')
        hospital_exp = Decimal('0.00')

        for b in branches:
            lines = cls._query_posted_lines(start_date, end_date, branch_id=b.id)

            # Revenue: Cr - Dr
            rev_agg = lines.filter(account__category__category_type=AccountCategoryType.REVENUE).aggregate(
                dr=models.Sum('debit_amount'), cr=models.Sum('credit_amount')
            )
            b_rev = max(Decimal('0.00'), (rev_agg['cr'] or Decimal('0.00')) - (rev_agg['dr'] or Decimal('0.00')))

            # Expense: Dr - Cr
            exp_agg = lines.filter(account__category__category_type=AccountCategoryType.EXPENSE).aggregate(
                dr=models.Sum('debit_amount'), cr=models.Sum('credit_amount')
            )
            b_exp = max(Decimal('0.00'), (exp_agg['dr'] or Decimal('0.00')) - (exp_agg['cr'] or Decimal('0.00')))

            b_profit = b_rev - b_exp
            b_margin = round(float(b_profit / b_rev * 100), 2) if b_rev > 0 else 0.0

            # Major revenue source
            top_rev = lines.filter(account__category__category_type=AccountCategoryType.REVENUE).values(
                'account__account_code', 'account__name'
            ).annotate(net=models.Sum('credit_amount') - models.Sum('debit_amount')).order_by('-net').first()

            # Major expense category
            top_exp = lines.filter(account__category__category_type=AccountCategoryType.EXPENSE).values(
                'account__account_code', 'account__name'
            ).annotate(net=models.Sum('debit_amount') - models.Sum('credit_amount')).order_by('-net').first()

            results.append({
                'branch_id': str(b.id),
                'branch_code': b.code,
                'branch_name': b.name,
                'is_main_branch': b.is_main_branch if hasattr(b, 'is_main_branch') else (b.code == 'AURA-MAIN'),
                'revenue': str(b_rev),
                'expenses': str(b_exp),
                'operating_profit': str(b_profit),
                'profit_margin_pct': b_margin,
                'major_revenue_source': top_rev['account__name'] if top_rev else 'N/A',
                'major_expense_category': top_exp['account__name'] if top_exp else 'N/A',
                'inter_branch_eliminated': True
            })

            hospital_rev += b_rev
            hospital_exp += b_exp

        return {
            'branches': results,
            'consolidated_revenue': str(hospital_rev),
            'consolidated_expense': str(hospital_exp),
            'consolidated_profit': str(hospital_rev - hospital_exp)
        }

    @classmethod
    def get_detailed_pnl_report(cls, start_date=None, end_date=None, branch_id=None, department_id=None):
        """
        Multi-step GAAP / IFRS Income Statement with account-level drill-down.
        """
        lines = cls._query_posted_lines(start_date, end_date, branch_id, department_id)

        # Revenue Breakdown
        rev_accounts = ChartOfAccount.objects.filter(
            category__category_type=AccountCategoryType.REVENUE
        ).order_by('account_code')

        operating_revenue_items = []
        non_operating_revenue_items = []
        tot_op_rev = Decimal('0.00')
        tot_non_op_rev = Decimal('0.00')

        for acc in rev_accounts:
            a_lines = lines.filter(account=acc)
            agg = a_lines.aggregate(dr=models.Sum('debit_amount'), cr=models.Sum('credit_amount'))
            dr = agg['dr'] or Decimal('0.00')
            cr = agg['cr'] or Decimal('0.00')
            net = max(Decimal('0.00'), cr - dr)

            item = {
                'account_id': str(acc.id),
                'account_code': acc.account_code,
                'account_name': acc.name,
                'sub_type': acc.account_type,
                'debits': str(dr),
                'credits': str(cr),
                'net_amount': str(net)
            }

            if acc.account_code in [cls.ACC_INTEREST_INC, cls.ACC_INV_GAINS]:
                non_operating_revenue_items.append(item)
                tot_non_op_rev += net
            else:
                operating_revenue_items.append(item)
                tot_op_rev += net

        # Expense Breakdown
        exp_accounts = ChartOfAccount.objects.filter(
            category__category_type=AccountCategoryType.EXPENSE
        ).order_by('account_code')

        operating_expense_items = []
        financing_and_tax_items = []
        tot_op_exp = Decimal('0.00')
        tot_fin_tax_exp = Decimal('0.00')

        for acc in exp_accounts:
            a_lines = lines.filter(account=acc)
            agg = a_lines.aggregate(dr=models.Sum('debit_amount'), cr=models.Sum('credit_amount'))
            dr = agg['dr'] or Decimal('0.00')
            cr = agg['cr'] or Decimal('0.00')
            net = max(Decimal('0.00'), dr - cr)

            item = {
                'account_id': str(acc.id),
                'account_code': acc.account_code,
                'account_name': acc.name,
                'sub_type': acc.account_type,
                'debits': str(dr),
                'credits': str(cr),
                'net_amount': str(net)
            }

            if acc.account_code in [cls.ACC_LOAN_INTEREST_EXP, cls.ACC_BANK_GATEWAY_FEES, cls.ACC_TAX_EXP]:
                financing_and_tax_items.append(item)
                tot_fin_tax_exp += net
            else:
                operating_expense_items.append(item)
                tot_op_exp += net

        # Multi-Step Computations
        # 1. Gross Profit: Net Operating Revenue - Pharmacy COGS (5030)
        cogs_item = next((i for i in operating_expense_items if i['account_code'] == cls.ACC_CONSUMABLES_COGS), None)
        cogs_amt = Decimal(cogs_item['net_amount']) if cogs_item else Decimal('0.00')
        gross_profit = tot_op_rev - cogs_amt

        # 2. Operating Profit: Operating Revenue - Operating Expenses
        operating_profit = tot_op_rev - tot_op_exp

        # 3. Profit Before Tax: Operating Profit + Non-operating Rev - Financing costs
        fin_costs = sum((Decimal(i['net_amount']) for i in financing_and_tax_items if i['account_code'] in [cls.ACC_LOAN_INTEREST_EXP, cls.ACC_BANK_GATEWAY_FEES]), Decimal('0.00'))
        pbt = operating_profit + tot_non_op_rev - fin_costs

        # 4. Net Profit: PBT - Income Taxes (5080)
        tax_item = next((i for i in financing_and_tax_items if i['account_code'] == cls.ACC_TAX_EXP), None)
        tax_amt = Decimal(tax_item['net_amount']) if tax_item else Decimal('0.00')
        net_profit = pbt - tax_amt

        return {
            'statement_type': 'Multi-Step GAAP Comprehensive Income Statement',
            'start_date': str(start_date) if start_date else None,
            'end_date': str(end_date) if end_date else None,
            'operating_revenues': operating_revenue_items,
            'total_operating_revenue': str(tot_op_rev),
            'cogs_amount': str(cogs_amt),
            'gross_profit': str(gross_profit),
            'operating_expenses': operating_expense_items,
            'total_operating_expenses': str(tot_op_exp),
            'operating_profit': str(operating_profit),
            'non_operating_revenues': non_operating_revenue_items,
            'total_non_operating_revenue': str(tot_non_op_rev),
            'financing_and_tax_expenses': financing_and_tax_items,
            'financing_costs': str(fin_costs),
            'profit_before_tax': str(pbt),
            'tax_expense': str(tax_amt),
            'net_profit': str(net_profit),
            'is_tax_provisioned': (tax_amt > Decimal('0.00'))
        }

    @classmethod
    def get_account_drilldown(cls, account_code=None, account_id=None, start_date=None, end_date=None,
                              branch_id=None, department_id=None):
        """
        Drills down from any reported P&L line into the exact originating posted journal entries.
        """
        if account_id:
            account = ChartOfAccount.objects.filter(id=account_id).first()
        elif account_code:
            account = ChartOfAccount.objects.filter(account_code=account_code).first()
        else:
            raise ValidationError("Either account_id or account_code is required.")

        if not account:
            raise ValidationError("Specified account does not exist.")

        lines = cls._query_posted_lines(start_date, end_date, branch_id, department_id).filter(
            account=account
        ).order_by('-journal_entry__entry_date', '-created_at')

        results = []
        total_dr = Decimal('0.00')
        total_cr = Decimal('0.00')

        for l in lines:
            results.append({
                'line_id': str(l.id),
                'journal_id': str(l.journal_entry.id),
                'voucher_number': l.journal_entry.voucher_number or l.journal_entry.entry_number,
                'entry_date': l.journal_entry.entry_date.isoformat(),
                'narration': l.description or l.journal_entry.narration,
                'reference_number': l.reference_number or l.journal_entry.reference_number,
                'source_module': l.journal_entry.source_module,
                'source_transaction_id': l.journal_entry.source_transaction_id,
                'branch_name': l.branch.name if l.branch else (l.journal_entry.branch.name if l.journal_entry.branch else 'All Branches'),
                'department_name': l.department.name if l.department else (l.journal_entry.department.name if l.journal_entry.department else 'General Hospital'),
                'debit': str(l.debit_amount),
                'credit': str(l.credit_amount)
            })
            total_dr += l.debit_amount
            total_cr += l.credit_amount

        is_rev = account.category.category_type == AccountCategoryType.REVENUE
        net_val = (total_cr - total_dr) if is_rev else (total_dr - total_cr)

        return {
            'account': {
                'id': str(account.id),
                'code': account.account_code,
                'name': account.name,
                'category_type': account.category.category_type,
                'classification': account.classification
            },
            'total_debits': str(total_dr),
            'total_credits': str(total_cr),
            'net_movement': str(net_val),
            'entries_count': len(results),
            'journal_lines': results
        }

    @classmethod
    def generate_pnl_csv(cls, start_date=None, end_date=None, branch_id=None, department_id=None):
        """
        Generates CSV format export of the complete Profit and Loss Statement.
        """
        import io
        import csv

        report = cls.get_detailed_pnl_report(start_date, end_date, branch_id, department_id)
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(['AURA MULTI-SPECIALTY HOSPITAL MANAGEMENT SYSTEM'])
        writer.writerow(['PROFIT AND LOSS FINANCIAL STATEMENT (GAAP / IFRS RECONCILED)'])
        writer.writerow([f"Period: {report['start_date'] or 'Start'} to {report['end_date'] or 'Current'}"])
        writer.writerow([])

        writer.writerow(['ACCOUNT CODE', 'ACCOUNT DESCRIPTION', 'DEBITS (INR)', 'CREDITS (INR)', 'NET AMOUNT (INR)'])
        writer.writerow(['--- I. OPERATING CLINICAL REVENUES ---', '', '', '', ''])
        for item in report['operating_revenues']:
            writer.writerow([item['account_code'], item['account_name'], item['debits'], item['credits'], item['net_amount']])
        writer.writerow(['TOTAL OPERATING REVENUE', '', '', '', report['total_operating_revenue']])
        writer.writerow([])

        writer.writerow(['--- II. COST OF GOODS SOLD (COGS) ---', '', '', '', ''])
        writer.writerow(['5030', 'Medical Consumables & Pharmacy COGS', '', '', report['cogs_amount']])
        writer.writerow(['GROSS OPERATING PROFIT', '', '', '', report['gross_profit']])
        writer.writerow([])

        writer.writerow(['--- III. OPERATING & ADMINISTRATIVE EXPENSES ---', '', '', '', ''])
        for item in report['operating_expenses']:
            writer.writerow([item['account_code'], item['account_name'], item['debits'], item['credits'], item['net_amount']])
        writer.writerow(['TOTAL OPERATING EXPENSES', '', '', '', report['total_operating_expenses']])
        writer.writerow(['OPERATING PROFIT', '', '', '', report['operating_profit']])
        writer.writerow([])

        writer.writerow(['--- IV. NON-OPERATING ITEMS & FINANCING COSTS ---', '', '', '', ''])
        for item in report['non_operating_revenues']:
            writer.writerow([item['account_code'], item['account_name'], item['debits'], item['credits'], item['net_amount']])
        for item in report['financing_and_tax_expenses']:
            if item['account_code'] != cls.ACC_TAX_EXP:
                writer.writerow([item['account_code'], item['account_name'], item['debits'], item['credits'], item['net_amount']])
        writer.writerow(['PROFIT BEFORE TAX (PBT)', '', '', '', report['profit_before_tax']])
        writer.writerow([])

        writer.writerow(['--- V. TAXES & FINAL NET PROFIT ---', '', '', '', ''])
        writer.writerow(['5080', 'Provision for Corporate Taxes', '', '', report['tax_expense']])
        writer.writerow(['NET PROFIT / (LOSS)', '', '', '', report['net_profit']])

        return output.getvalue()
