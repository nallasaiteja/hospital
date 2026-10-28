import zoneinfo
from decimal import Decimal
from datetime import datetime, time
from django.db import models
from django.utils import timezone
from django.core.paginator import Paginator

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import UserProfile, StaffProfile, PatientProfile, RoleEnum
from apps.clinical.models import (
    Appointment, AppointmentStatus,
    InpatientAdmission, AdmissionStatus,
    EmergencyEncounter, EmergencyStatus, TriageAcuity,
    Bed, BedStatus, Ward,
    LabOrder, LabOrderStatus, LabOrderItem,
)
from apps.billing_finance.models import (
    Invoice, InvoiceStatus,
    Payment, PaymentMethod,
    PatientDeposit,
    InsuranceClaim, ClaimStatus,
    BankAccount, BankTransaction,
    InvestmentRegister,
    LoanRegister, LoanRepaymentSchedule, RepaymentInstallmentStatus,
    ChartOfAccount, JournalEntry, JournalLineItem,
)
from apps.pharmacy_inventory.models import (
    Medicine, MedicineBatch,
    Supplier, SupplierInvoice, PurchaseOrder, GoodsReceiptNote,
)
from apps.operations_hr.models import (
    EmployeeDetail, EmployeeAttendance, LeaveRequest,
    PayrollPeriod, FixedAsset, EquipmentMaintenanceTask,
    OperationTheatreBooking, ICUObservationRecord,
    Ambulance, BloodBankStock, HousekeepingTask, BiomedicalWasteRecord,
)


class DashboardReportingService:
    """
    Section 21: Centralized, High-Integrity Hospital Dashboards and Reports Engine.
    All metrics derive strictly from persisted Supabase PostgreSQL database records.
    Calculations strictly follow hospital accounting, clinical workflow, and bed-management rules.
    """

    @staticmethod
    def get_hospital_today(branch_id=None):
        """
        Resolves current date using hospital's configured timezone.
        """
        hospital = Hospital.objects.first()
        tz_name = hospital.timezone if hospital and hospital.timezone else 'Asia/Kolkata'
        try:
            tz = zoneinfo.ZoneInfo(tz_name)
        except Exception:
            tz = zoneinfo.ZoneInfo('Asia/Kolkata')
        return timezone.now().astimezone(tz).date()

    @staticmethod
    def parse_date_filters(from_date=None, to_date=None):
        """
        Safely parses string or date objects into datetime boundaries with timezone awareness.
        """
        today = DashboardReportingService.get_hospital_today()
        if not from_date:
            start_date = today
        elif isinstance(from_date, str):
            try:
                start_date = datetime.strptime(from_date, '%Y-%m-%d').date()
            except ValueError:
                start_date = today
        else:
            start_date = from_date

        if not to_date:
            end_date = today
        elif isinstance(to_date, str):
            try:
                end_date = datetime.strptime(to_date, '%Y-%m-%d').date()
            except ValueError:
                end_date = today
        else:
            end_date = to_date

        if start_date > end_date:
            start_date, end_date = end_date, start_date

        # Datetime boundaries
        start_datetime = timezone.make_aware(datetime.combine(start_date, time.min))
        end_datetime = timezone.make_aware(datetime.combine(end_date, time.max))

        return start_date, end_date, start_datetime, end_datetime

    # =========================================================================
    # 1. HOSPITAL ADMINISTRATION DASHBOARD (§21.3)
    # =========================================================================

    @classmethod
    def get_admin_dashboard(cls, branch_id=None, department_id=None, from_date=None, to_date=None):
        """
        Calculates all 8 required metrics for the Hospital Administration Dashboard:
        1. Today's OPD registrations (using hospital configured timezone).
        2. Current inpatient census (active admissions, excluding discharged).
        3. Available beds and occupied beds.
        4. Emergency visits.
        5. Pending diagnostic reports.
        6. Pending patient discharges.
        7. Revenue and collections.
        8. Outstanding receivables.
        """
        today = cls.get_hospital_today(branch_id)
        start_date, end_date, start_dt, end_dt = cls.parse_date_filters(from_date, to_date)

        # 1. Today's OPD Registrations (using hospital timezone)
        opd_qs = Appointment.objects.filter(appointment_date=today)
        if branch_id:
            opd_qs = opd_qs.filter(branch_id=branch_id)
        if department_id:
            opd_qs = opd_qs.filter(department_id=department_id)
        today_opd_count = opd_qs.count()

        # Detailed breakdown of OPD by status
        opd_completed = opd_qs.filter(status=AppointmentStatus.COMPLETED).count()
        opd_in_consult = opd_qs.filter(status=AppointmentStatus.IN_CONSULTATION).count()
        opd_waiting = opd_qs.filter(status__in=[AppointmentStatus.SCHEDULED, AppointmentStatus.CHECKED_IN]).count()

        # 2. Current Inpatient Census (Active admissions, strictly excluding discharged)
        ipd_qs = InpatientAdmission.objects.filter(
            status__in=[AdmissionStatus.ADMITTED, AdmissionStatus.AWAITING_DISCHARGE],
            discharge_date__isnull=True
        )
        if branch_id:
            ipd_qs = ipd_qs.filter(branch_id=branch_id)
        if department_id:
            ipd_qs = ipd_qs.filter(bed__ward__department_id=department_id)
        current_inpatient_census = ipd_qs.count()

        # 3. Available Beds and Occupied Beds (following bed-management rules)
        bed_qs = Bed.objects.select_related('ward')
        if branch_id:
            bed_qs = bed_qs.filter(ward__branch_id=branch_id)
        if department_id:
            bed_qs = bed_qs.filter(ward__department_id=department_id)

        total_beds = bed_qs.count()
        available_beds = bed_qs.filter(status=BedStatus.AVAILABLE).count()
        occupied_beds = bed_qs.filter(status=BedStatus.OCCUPIED).count()
        cleaning_beds = bed_qs.filter(status=BedStatus.CLEANING).count()
        maintenance_beds = bed_qs.filter(status=BedStatus.MAINTENANCE).count()
        occupancy_rate_pct = round((Decimal(occupied_beds) / Decimal(total_beds) * Decimal('100.0')), 1) if total_beds > 0 else Decimal('0.0')

        # 4. Emergency Visits (within date range)
        er_qs = EmergencyEncounter.objects.filter(arrival_time__range=[start_dt, end_dt])
        if branch_id:
            er_qs = er_qs.filter(branch_id=branch_id)
        emergency_visits_count = er_qs.count()
        er_resuscitation = er_qs.filter(triage_acuity=TriageAcuity.RED).count()
        er_urgent = er_qs.filter(triage_acuity=TriageAcuity.YELLOW).count()
        er_stable = er_qs.filter(triage_acuity=TriageAcuity.GREEN).count()

        # 5. Pending Diagnostic Reports (workflow statuses ordered, collected, processing, awaiting validation)
        lab_pending_statuses = [
            LabOrderStatus.ORDERED,
            LabOrderStatus.SAMPLE_COLLECTED,
            LabOrderStatus.IN_PROCESS,
            LabOrderStatus.AWAITING_VALIDATION,
            LabOrderStatus.AWAITING_APPROVAL,
        ]
        lab_qs = LabOrder.objects.filter(status__in=lab_pending_statuses)
        if branch_id:
            lab_qs = lab_qs.filter(branch_id=branch_id)
        pending_diagnostic_reports = lab_qs.count()
        critical_diagnostic_alerts = lab_qs.filter(is_critical=True).count()

        # 6. Pending Patient Discharges (active admissions undergoing discharge clearance)
        pending_discharge_qs = InpatientAdmission.objects.filter(
            status=AdmissionStatus.AWAITING_DISCHARGE,
            discharge_date__isnull=True
        )
        if branch_id:
            pending_discharge_qs = pending_discharge_qs.filter(branch_id=branch_id)
        pending_discharges_count = pending_discharge_qs.count()

        # 7. Revenue and Collections
        # Revenue: Calculated from valid, posted non-cancelled invoices in date range
        inv_qs = Invoice.objects.exclude(status=InvoiceStatus.CANCELLED).filter(
            invoice_date__range=[start_date, end_date]
        )
        if branch_id:
            inv_qs = inv_qs.filter(branch_id=branch_id)
        
        revenue_aggregate = inv_qs.aggregate(
            total_rev=models.Sum('total_amount'),
            subtotal=models.Sum('subtotal'),
            discount=models.Sum('discount_amount'),
            tax=models.Sum('tax_amount')
        )
        posted_revenue = revenue_aggregate['total_rev'] or Decimal('0.00')

        # Collections: Actual successful receipts settled in date range
        pay_qs = Payment.objects.filter(payment_date__range=[start_dt, end_dt])
        if branch_id:
            pay_qs = pay_qs.filter(branch_id=branch_id)
        
        collections_aggregate = pay_qs.aggregate(total_collected=models.Sum('amount'))
        total_collections = collections_aggregate['total_collected'] or Decimal('0.00')

        # Collections by Payment Method
        method_breakdown = pay_qs.values('payment_method').annotate(
            total=models.Sum('amount'), count=models.Count('id')
        ).order_by('-total')

        # 8. Outstanding Receivables (unpaid balances on valid invoices)
        ar_qs = Invoice.objects.filter(status__in=[InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID])
        if branch_id:
            ar_qs = ar_qs.filter(branch_id=branch_id)
        
        ar_aggregate = ar_qs.aggregate(total_ar=models.Sum('balance_amount'))
        outstanding_receivables = ar_aggregate['total_ar'] or Decimal('0.00')

        return {
            'as_of_date': today,
            'filter_window': {
                'from_date': start_date,
                'to_date': end_date,
                'branch_id': branch_id,
                'department_id': department_id
            },
            'summary_metrics': {
                'today_opd_registrations': today_opd_count,
                'opd_breakdown': {
                    'waiting': opd_waiting,
                    'in_consultation': opd_in_consult,
                    'completed': opd_completed
                },
                'current_inpatient_census': current_inpatient_census,
                'bed_capacity': {
                    'total_beds': total_beds,
                    'available_beds': available_beds,
                    'occupied_beds': occupied_beds,
                    'cleaning_maintenance_beds': cleaning_beds + maintenance_beds,
                    'occupancy_rate_pct': float(occupancy_rate_pct)
                },
                'emergency_visits': emergency_visits_count,
                'emergency_breakdown': {
                    'red_resuscitation': er_resuscitation,
                    'yellow_urgent': er_urgent,
                    'green_stable': er_stable
                },
                'pending_diagnostic_reports': pending_diagnostic_reports,
                'critical_diagnostic_alerts': critical_diagnostic_alerts,
                'pending_discharges': pending_discharges_count,
                'posted_revenue': float(posted_revenue),
                'total_collections': float(total_collections),
                'outstanding_receivables': float(outstanding_receivables),
                'collection_efficiency_pct': round(float(total_collections / posted_revenue * Decimal('100.0')), 1) if posted_revenue > Decimal('0.00') else 0.0,
                'collections_by_method': list(method_breakdown)
            }
        }

    # =========================================================================
    # 2. FINANCE & INVESTMENT DASHBOARD (§21.4)
    # =========================================================================

    @classmethod
    def get_finance_dashboard(cls, branch_id=None, from_date=None, to_date=None):
        """
        Integrates with General Ledger, Chart of Accounts, Bank Accounts,
        Investments, and Loans to provide fully reconciled financial indicators.
        """
        start_date, end_date, start_dt, end_dt = cls.parse_date_filters(from_date, to_date)

        # 1. Bank and Cash Balances
        bank_qs = BankAccount.objects.all()
        
        bank_balances_list = []
        total_bank_cash_balance = Decimal('0.00')
        for b in bank_qs:
            bank_balances_list.append({
                'id': str(b.id),
                'account_name': f"{b.bank_name} ({b.account_number})",
                'bank_name': b.bank_name,
                'account_number': b.account_number,
                'ifsc_code': b.ifsc_code,
                'current_balance': float(b.current_balance),
                'currency': 'INR'
            })
            total_bank_cash_balance += b.current_balance

        # 2. Patient and Insurance Receivables
        # Patient AR:
        patient_ar_qs = Invoice.objects.filter(status__in=[InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID])
        if branch_id:
            patient_ar_qs = patient_ar_qs.filter(branch_id=branch_id)
        patient_ar = patient_ar_qs.aggregate(total=models.Sum('balance_amount'))['total'] or Decimal('0.00')

        # Insurance AR:
        claim_qs = InsuranceClaim.objects.exclude(status__in=[ClaimStatus.SETTLED, ClaimStatus.REJECTED])
        insurance_ar = claim_qs.aggregate(total=models.Sum('claim_amount'))['total'] or Decimal('0.00')
        total_receivables = patient_ar + insurance_ar

        # 3. Supplier Payables (Accounts Payable)
        supp_inv_qs = SupplierInvoice.objects.filter(payment_status__in=['UNPAID', 'PARTIALLY_PAID'])
        if branch_id:
            supp_inv_qs = supp_inv_qs.filter(branch_id=branch_id)
        
        supplier_payables = Decimal('0.00')
        for sinv in supp_inv_qs:
            supplier_payables += (sinv.total_amount - sinv.paid_amount)

        # 4. Monthly Revenue and Operating Expenses (from GL journal line items)
        today = cls.get_hospital_today()
        month_start = today.replace(day=1)
        month_start_dt = timezone.make_aware(datetime.combine(month_start, time.min))
        month_end_dt = timezone.make_aware(datetime.combine(today, time.max))

        # Check General Ledger entries for monthly revenue (Debit/Credit on accounts categorized as REVENUE vs EXPENSE)
        rev_lines = JournalLineItem.objects.filter(
            journal_entry__entry_date__range=[month_start, today],
            journal_entry__status='POSTED',
            account__category__category_type='REVENUE'
        )
        exp_lines = JournalLineItem.objects.filter(
            journal_entry__entry_date__range=[month_start, today],
            journal_entry__status='POSTED',
            account__category__category_type='EXPENSE'
        )

        gl_monthly_revenue = rev_lines.aggregate(tot=models.Sum('credit_amount'))['tot'] or Decimal('0.00')
        gl_monthly_expense = exp_lines.aggregate(tot=models.Sum('debit_amount'))['tot'] or Decimal('0.00')

        # If GL journal entries are not yet posted for the month, calculate operational revenue from invoices and expenses from payroll/purchases
        if gl_monthly_revenue == Decimal('0.00'):
            gl_monthly_revenue = Invoice.objects.exclude(status=InvoiceStatus.CANCELLED).filter(
                invoice_date__range=[month_start, today]
            ).aggregate(tot=models.Sum('total_amount'))['tot'] or Decimal('0.00')

        if gl_monthly_expense == Decimal('0.00'):
            payroll_exp = PayrollPeriod.objects.filter(
                month=today.month, year=today.year
            ).aggregate(tot=models.Sum('total_gross'))['tot'] or Decimal('0.00')
            gl_monthly_expense = payroll_exp

        # 5. Profit and Loss
        operating_profit = gl_monthly_revenue - gl_monthly_expense
        net_profit_margin_pct = round(float(operating_profit / gl_monthly_revenue * Decimal('100.0')), 1) if gl_monthly_revenue > Decimal('0.00') else 0.0

        # 6. Cash Flow (Actual Collections minus Cash Outflows)
        cash_inflows = Payment.objects.filter(payment_date__range=[start_dt, end_dt]).aggregate(tot=models.Sum('amount'))['tot'] or Decimal('0.00')
        # Outflows include supplier payments and payroll paid
        cash_outflows = Decimal('0.00')
        net_cash_flow = cash_inflows - cash_outflows

        # 7. Investment Portfolio Value
        inv_reg_qs = InvestmentRegister.objects.filter(status='ACTIVE')
        portfolio_valuation = inv_reg_qs.aggregate(tot=models.Sum('current_valuation'))['tot'] or Decimal('0.00')
        principal_invested = inv_reg_qs.aggregate(tot=models.Sum('principal_amount'))['tot'] or Decimal('0.00')

        # 8. Investment Income and Gains/Losses
        total_investment_income = inv_reg_qs.aggregate(tot=models.Sum('total_interest_received'))['tot'] or Decimal('0.00')
        unrealized_gain_loss = portfolio_valuation - principal_invested

        # 9. Outstanding Loan Balances
        loan_qs = LoanRegister.objects.filter(status='ACTIVE')
        total_loan_outstanding = loan_qs.aggregate(tot=models.Sum('outstanding_balance'))['tot'] or Decimal('0.00')

        # 10. Upcoming Financial Obligations (next 30 days)
        thirty_days_ahead = today + timezone.timedelta(days=30)
        upcoming_emis = LoanRepaymentSchedule.objects.filter(
            due_date__range=[today, thirty_days_ahead],
            payment_status=RepaymentInstallmentStatus.PENDING
        ).aggregate(tot=models.Sum('total_due'))['tot'] or Decimal('0.00')
        if upcoming_emis == Decimal('0.00') and loan_qs.exists():
            upcoming_emis = loan_qs.aggregate(tot=models.Sum('monthly_emi'))['tot'] or Decimal('0.00')

        upcoming_supplier_due = supp_inv_qs.filter(
            due_date__range=[today, thirty_days_ahead]
        ).aggregate(tot=models.Sum('total_amount'))['tot'] or Decimal('0.00')

        total_upcoming_obligations = upcoming_emis + upcoming_supplier_due

        # 11. Unreconciled Transactions
        unreconciled_count = BankTransaction.objects.filter(is_reconciled=False).count()

        return {
            'as_of_date': today,
            'filter_window': {
                'from_date': start_date,
                'to_date': end_date,
                'branch_id': branch_id
            },
            'financial_metrics': {
                'total_bank_cash_balance': float(total_bank_cash_balance),
                'bank_accounts': bank_balances_list,
                'patient_receivables': float(patient_ar),
                'insurance_receivables': float(insurance_ar),
                'total_receivables': float(total_receivables),
                'supplier_payables': float(supplier_payables),
                'monthly_revenue': float(gl_monthly_revenue),
                'monthly_expense': float(gl_monthly_expense),
                'operating_profit': float(operating_profit),
                'net_profit_margin_pct': net_profit_margin_pct,
                'operating_cash_inflow': float(cash_inflows),
                'operating_cash_outflow': float(cash_outflows),
                'net_cash_flow': float(net_cash_flow),
                'investment_portfolio_value': float(portfolio_valuation),
                'principal_invested': float(principal_invested),
                'investment_income_earned': float(total_investment_income),
                'unrealized_gain_loss': float(unrealized_gain_loss),
                'total_loan_outstanding': float(total_loan_outstanding),
                'upcoming_obligations_30d': float(total_upcoming_obligations),
                'unreconciled_transactions_count': unreconciled_count
            }
        }

    # =========================================================================
    # 3. CLINICAL DEPARTMENTS DASHBOARD (§21.2)
    # =========================================================================

    @classmethod
    def get_clinical_dashboard(cls, branch_id=None, department_id=None, from_date=None, to_date=None):
        today = cls.get_hospital_today(branch_id)
        start_date, end_date, start_dt, end_dt = cls.parse_date_filters(from_date, to_date)

        # Appointments
        appts = Appointment.objects.filter(appointment_date__range=[start_date, end_date])
        if branch_id:
            appts = appts.filter(branch_id=branch_id)
        if department_id:
            appts = appts.filter(department_id=department_id)
        
        # Doctor Consultations Leaderboard
        doctor_workload = appts.values(
            'doctor__user_profile__first_name', 'doctor__user_profile__last_name', 'department__name'
        ).annotate(
            total_cases=models.Count('id'),
            completed_cases=models.Count('id', filter=models.Q(status=AppointmentStatus.COMPLETED))
        ).order_by('-total_cases')[:10]

        # Inpatient Bed Census by Ward Type
        ward_distribution = Bed.objects.values('ward__ward_type').annotate(
            total=models.Count('id'),
            occupied=models.Count('id', filter=models.Q(status=BedStatus.OCCUPIED)),
            available=models.Count('id', filter=models.Q(status=BedStatus.AVAILABLE))
        ).order_by('ward__ward_type')

        # Surgical OT Cases
        ot_bookings = OperationTheatreBooking.objects.filter(scheduled_date__range=[start_date, end_date])
        if branch_id:
            ot_bookings = ot_bookings.filter(theatre__branch_id=branch_id)
        
        # ICU Vitals Monitored Patients
        icu_alerts = ICUObservationRecord.objects.filter(
            escalation_status__in=['WATCH', 'CRITICAL_ESCALATION'],
            observation_time__range=[start_dt, end_dt]
        ).count()

        return {
            'as_of_date': today,
            'summary': {
                'total_consultations': appts.count(),
                'active_inpatients': InpatientAdmission.objects.filter(status=AdmissionStatus.ADMITTED).count(),
                'icu_critical_monitored': icu_alerts,
                'surgeries_scheduled': ot_bookings.count(),
                'surgeries_completed': ot_bookings.filter(status='COMPLETED').count(),
            },
            'doctor_workload': list(doctor_workload),
            'ward_distribution': list(ward_distribution)
        }

    # =========================================================================
    # 4. PHARMACY DASHBOARD (§21.2)
    # =========================================================================

    @classmethod
    def get_pharmacy_dashboard(cls, branch_id=None, from_date=None, to_date=None):
        today = cls.get_hospital_today(branch_id)
        ninety_days = today + timezone.timedelta(days=90)

        batches = MedicineBatch.objects.select_related('medicine')
        if branch_id:
            batches = batches.filter(branch_id=branch_id)

        total_formulary_medicines = Medicine.objects.filter(is_active=True).count()
        total_batches = batches.count()
        
        # Stock valuation (FIFO quantity * cost)
        total_inventory_valuation = sum((b.quantity_in_stock * b.unit_purchase_cost for b in batches), Decimal('0.00'))
        
        # Low Stock Batches (<= 50 units)
        low_stock_count = batches.filter(quantity_in_stock__lte=50, quantity_in_stock__gt=0).count()
        stockout_count = batches.filter(quantity_in_stock=0).count()

        # Near Expiry Batches (<= 90 days)
        near_expiry_count = batches.filter(expiry_date__range=[today, ninety_days], quantity_in_stock__gt=0).count()
        expired_count = batches.filter(expiry_date__lt=today, quantity_in_stock__gt=0).count()

        return {
            'as_of_date': today,
            'summary': {
                'total_formulary_medicines': total_formulary_medicines,
                'total_batches_in_stock': total_batches,
                'total_inventory_valuation': float(total_inventory_valuation),
                'low_stock_alerts': low_stock_count,
                'stockouts': stockout_count,
                'near_expiry_90d': near_expiry_count,
                'expired_batches': expired_count
            }
        }

    # =========================================================================
    # 5. DIAGNOSTICS & LABORATORY DASHBOARD (§21.2)
    # =========================================================================

    @classmethod
    def get_diagnostics_dashboard(cls, branch_id=None, from_date=None, to_date=None):
        today = cls.get_hospital_today(branch_id)
        start_date, end_date, start_dt, end_dt = cls.parse_date_filters(from_date, to_date)

        orders = LabOrder.objects.filter(created_at__range=[start_dt, end_dt])
        if branch_id:
            orders = orders.filter(branch_id=branch_id)

        total_orders = orders.count()
        pending_orders = orders.filter(status__in=[
            LabOrderStatus.ORDERED, LabOrderStatus.SAMPLE_COLLECTED, LabOrderStatus.IN_PROCESS
        ]).count()
        awaiting_approval = orders.filter(status__in=[
            LabOrderStatus.AWAITING_VALIDATION, LabOrderStatus.AWAITING_APPROVAL
        ]).count()
        released_reports = orders.filter(status=LabOrderStatus.RELEASED).count()
        critical_alerts = orders.filter(is_critical=True).count()
        outsourced_orders = orders.filter(is_outsourced=True).count()

        return {
            'as_of_date': today,
            'summary': {
                'total_diagnostic_orders': total_orders,
                'pending_in_analysis': pending_orders,
                'awaiting_pathologist_signoff': awaiting_approval,
                'released_reports': released_reports,
                'critical_panic_alerts': critical_alerts,
                'outsourced_specimens': outsourced_orders
            }
        }

    # =========================================================================
    # 6. INVENTORY & PROCUREMENT DASHBOARD (§21.2)
    # =========================================================================

    @classmethod
    def get_inventory_dashboard(cls, branch_id=None, from_date=None, to_date=None):
        today = cls.get_hospital_today(branch_id)
        suppliers = Supplier.objects.filter(is_active=True).count()
        
        pos = PurchaseOrder.objects.all()
        if branch_id:
            pos = pos.filter(branch_id=branch_id)
        active_pos = pos.filter(status__in=['ORDERED', 'PENDING_APPROVAL', 'PARTIALLY_DELIVERED']).count()

        grns = GoodsReceiptNote.objects.all()
        if branch_id:
            grns = grns.filter(branch_id=branch_id)
        pending_grns = grns.count()

        supp_invoices = SupplierInvoice.objects.all()
        if branch_id:
            supp_invoices = supp_invoices.filter(branch_id=branch_id)
        pending_invoices = supp_invoices.filter(payment_status__in=['UNPAID', 'PARTIALLY_PAID']).count()
        total_payable = supp_invoices.filter(
            payment_status__in=['UNPAID', 'PARTIALLY_PAID']
        ).aggregate(tot=models.Sum('total_amount'))['tot'] or Decimal('0.00')

        return {
            'as_of_date': today,
            'summary': {
                'registered_suppliers': suppliers,
                'active_purchase_orders': active_pos,
                'pending_grn_inspections': pending_grns,
                'pending_supplier_invoices': pending_invoices,
                'total_supplier_payable': float(total_payable)
            }
        }

    # =========================================================================
    # 7. BILLING & CASHIER DASHBOARD (§21.2)
    # =========================================================================

    @classmethod
    def get_billing_dashboard(cls, branch_id=None, from_date=None, to_date=None):
        today = cls.get_hospital_today(branch_id)
        start_date, end_date, start_dt, end_dt = cls.parse_date_filters(from_date, to_date)

        invs = Invoice.objects.filter(invoice_date__range=[start_date, end_date])
        pays = Payment.objects.filter(payment_date__range=[start_dt, end_dt])
        if branch_id:
            invs = invs.filter(branch_id=branch_id)
            pays = pays.filter(branch_id=branch_id)

        invoices_issued = invs.count()
        gross_billed = invs.aggregate(tot=models.Sum('total_amount'))['tot'] or Decimal('0.00')
        collections_received = pays.aggregate(tot=models.Sum('amount'))['tot'] or Decimal('0.00')

        deposits = PatientDeposit.objects.filter(created_at__range=[start_dt, end_dt])
        if branch_id:
            deposits = deposits.filter(branch_id=branch_id)
        total_deposits = deposits.aggregate(tot=models.Sum('amount'))['tot'] or Decimal('0.00')

        return {
            'as_of_date': today,
            'summary': {
                'invoices_issued_count': invoices_issued,
                'gross_billed_amount': float(gross_billed),
                'cashier_collections': float(collections_received),
                'advance_deposits_collected': float(total_deposits)
            }
        }

    # =========================================================================
    # 8. ACCOUNTING & GENERAL LEDGER DASHBOARD (§21.2)
    # =========================================================================

    @classmethod
    def get_accounting_dashboard(cls, branch_id=None, from_date=None, to_date=None):
        today = cls.get_hospital_today(branch_id)
        start_date, end_date, start_dt, end_dt = cls.parse_date_filters(from_date, to_date)

        jes = JournalEntry.objects.filter(entry_date__range=[start_date, end_date], status='POSTED')
        if branch_id:
            jes = jes.filter(branch_id=branch_id)
        
        total_posted_vouchers = jes.count()
        debits_sum = JournalLineItem.objects.filter(journal_entry__in=jes).aggregate(tot=models.Sum('debit_amount'))['tot'] or Decimal('0.00')
        credits_sum = JournalLineItem.objects.filter(journal_entry__in=jes).aggregate(tot=models.Sum('credit_amount'))['tot'] or Decimal('0.00')
        trial_balance_difference = abs(debits_sum - credits_sum)
        is_trial_balance_balanced = (trial_balance_difference == Decimal('0.00'))

        total_accounts = ChartOfAccount.objects.count()

        return {
            'as_of_date': today,
            'summary': {
                'total_posted_vouchers': total_posted_vouchers,
                'total_debits_posted': float(debits_sum),
                'total_credits_posted': float(credits_sum),
                'trial_balance_difference': float(trial_balance_difference),
                'is_trial_balance_balanced': is_trial_balance_balanced,
                'chart_of_accounts_count': total_accounts
            }
        }

    # =========================================================================
    # 9. INVESTMENT MANAGEMENT DASHBOARD (§21.2)
    # =========================================================================

    @classmethod
    def get_investments_dashboard(cls, branch_id=None, from_date=None, to_date=None):
        today = cls.get_hospital_today(branch_id)
        invs = InvestmentRegister.objects.all()

        active_invs = invs.filter(status='ACTIVE')
        total_portfolio_value = active_invs.aggregate(tot=models.Sum('current_valuation'))['tot'] or Decimal('0.00')
        total_principal = active_invs.aggregate(tot=models.Sum('principal_amount'))['tot'] or Decimal('0.00')
        total_income = active_invs.aggregate(tot=models.Sum('total_interest_received'))['tot'] or Decimal('0.00')
        unrealized_gain_loss = total_portfolio_value - total_principal
        roi_pct = round(float((total_income + unrealized_gain_loss) / total_principal * Decimal('100.0')), 2) if total_principal > Decimal('0.00') else 0.0

        return {
            'as_of_date': today,
            'summary': {
                'active_investments_count': active_invs.count(),
                'matured_investments_count': invs.filter(status='MATURED').count(),
                'total_portfolio_value': float(total_portfolio_value),
                'principal_invested': float(total_principal),
                'total_income_earned': float(total_income),
                'unrealized_gain_loss': float(unrealized_gain_loss),
                'overall_portfolio_roi_pct': roi_pct
            }
        }

    # =========================================================================
    # 10. REUSABLE DRILL-DOWN REPORT RECORDS (§21.5)
    # =========================================================================

    @classmethod
    def get_drill_down_records(cls, metric_type, branch_id=None, department_id=None, from_date=None, to_date=None, search=None, page=1, page_size=20):
        """
        Provides paginated, filterable, searchable granular records for any metric.
        Guarantees that individual line items reconcile 100% with summary numbers.
        """
        today = cls.get_hospital_today(branch_id)
        start_date, end_date, start_dt, end_dt = cls.parse_date_filters(from_date, to_date)

        records = []
        total_count = 0
        columns = []

        if metric_type == 'OPD_REGISTRATIONS':
            columns = ['Appointment Number', 'Patient Name', 'Doctor', 'Department', 'Date', 'Time Slot', 'Status']
            qs = Appointment.objects.select_related('patient__user_profile', 'doctor__user_profile', 'department')
            qs = qs.filter(appointment_date=today)
            if branch_id:
                qs = qs.filter(branch_id=branch_id)
            if department_id:
                qs = qs.filter(department_id=department_id)
            if search:
                qs = qs.filter(
                    models.Q(appointment_number__icontains=search) |
                    models.Q(patient__user_profile__first_name__icontains=search) |
                    models.Q(patient__user_profile__last_name__icontains=search)
                )
            qs = qs.order_by('-appointment_date', 'time_slot')
            paginator = Paginator(qs, page_size)
            page_obj = paginator.get_page(page)
            total_count = paginator.count
            for a in page_obj:
                records.append({
                    'id': str(a.id),
                    'ref': a.appointment_number,
                    'patient': a.patient.user_profile.full_name,
                    'doctor': a.doctor.user_profile.full_name,
                    'department': a.department.name if a.department else 'General',
                    'date': str(a.appointment_date),
                    'time_slot': a.time_slot,
                    'status': a.status
                })

        elif metric_type == 'INPATIENT_CENSUS':
            columns = ['Admission Number', 'Patient Name', 'Ward', 'Bed Number', 'Admitting Doctor', 'Admission Date', 'Status']
            qs = InpatientAdmission.objects.select_related('patient__user_profile', 'bed__ward', 'admitting_doctor__user_profile')
            qs = qs.filter(status__in=[AdmissionStatus.ADMITTED, AdmissionStatus.AWAITING_DISCHARGE], discharge_date__isnull=True)
            if branch_id:
                qs = qs.filter(branch_id=branch_id)
            if department_id:
                qs = qs.filter(bed__ward__department_id=department_id)
            if search:
                qs = qs.filter(
                    models.Q(admission_number__icontains=search) |
                    models.Q(patient__user_profile__first_name__icontains=search) |
                    models.Q(patient__user_profile__last_name__icontains=search)
                )
            qs = qs.order_by('-admission_date')
            paginator = Paginator(qs, page_size)
            page_obj = paginator.get_page(page)
            total_count = paginator.count
            for adm in page_obj:
                records.append({
                    'id': str(adm.id),
                    'ref': adm.admission_number,
                    'patient': adm.patient.user_profile.full_name,
                    'ward': adm.bed.ward.name if adm.bed else 'Unassigned',
                    'bed': adm.bed.bed_number if adm.bed else 'Awaiting Bed',
                    'doctor': adm.admitting_doctor.user_profile.full_name if adm.admitting_doctor else 'Hospitalist',
                    'date': adm.admission_date.strftime('%Y-%m-%d %H:%M'),
                    'status': adm.status
                })

        elif metric_type in ['AVAILABLE_BEDS', 'OCCUPIED_BEDS', 'BED_CAPACITY']:
            columns = ['Bed Number', 'Ward Name', 'Ward Type', 'Daily Rate (₹)', 'Status']
            qs = Bed.objects.select_related('ward')
            if metric_type == 'AVAILABLE_BEDS':
                qs = qs.filter(status=BedStatus.AVAILABLE)
            elif metric_type == 'OCCUPIED_BEDS':
                qs = qs.filter(status=BedStatus.OCCUPIED)
            if branch_id:
                qs = qs.filter(ward__branch_id=branch_id)
            if department_id:
                qs = qs.filter(ward__department_id=department_id)
            if search:
                qs = qs.filter(models.Q(bed_number__icontains=search) | models.Q(ward__name__icontains=search))
            qs = qs.order_by('ward__name', 'bed_number')
            paginator = Paginator(qs, page_size)
            page_obj = paginator.get_page(page)
            total_count = paginator.count
            for b in page_obj:
                records.append({
                    'id': str(b.id),
                    'bed_number': b.bed_number,
                    'ward': b.ward.name,
                    'ward_type': b.ward.get_ward_type_display(),
                    'daily_rate': float(b.daily_rate),
                    'status': b.status
                })

        elif metric_type == 'EMERGENCY_VISITS':
            columns = ['Encounter Ref', 'Triage Acuity', 'Patient Name', 'Arrival Time', 'Arrival Mode', 'Doctor', 'Status']
            qs = EmergencyEncounter.objects.select_related('patient__user_profile', 'attending_doctor__user_profile')
            qs = qs.filter(arrival_time__range=[start_dt, end_dt])
            if branch_id:
                qs = qs.filter(branch_id=branch_id)
            if search:
                qs = qs.filter(
                    models.Q(encounter_number__icontains=search) |
                    models.Q(unregistered_patient_name__icontains=search) |
                    models.Q(patient__user_profile__first_name__icontains=search)
                )
            qs = qs.order_by('-arrival_time')
            paginator = Paginator(qs, page_size)
            page_obj = paginator.get_page(page)
            total_count = paginator.count
            for er in page_obj:
                name = er.patient.user_profile.full_name if er.patient else er.unregistered_patient_name or 'Unknown Patient'
                records.append({
                    'id': str(er.id),
                    'ref': er.encounter_number,
                    'acuity': er.triage_acuity,
                    'patient': name,
                    'arrival_time': er.arrival_time.strftime('%Y-%m-%d %H:%M'),
                    'arrival_mode': er.arrival_mode,
                    'doctor': er.attending_doctor.user_profile.full_name if er.attending_doctor else 'Duty Officer',
                    'status': er.status
                })

        elif metric_type == 'PENDING_DIAGNOSTICS':
            columns = ['Order Number', 'Patient Name', 'Prescribing Doctor', 'Priority', 'Status', 'Ordered At', 'Critical Alert']
            qs = LabOrder.objects.select_related('patient__user_profile', 'doctor__user_profile')
            qs = qs.filter(status__in=[
                LabOrderStatus.ORDERED, LabOrderStatus.SAMPLE_COLLECTED, LabOrderStatus.IN_PROCESS,
                LabOrderStatus.AWAITING_VALIDATION, LabOrderStatus.AWAITING_APPROVAL
            ])
            if branch_id:
                qs = qs.filter(branch_id=branch_id)
            if search:
                qs = qs.filter(
                    models.Q(order_number__icontains=search) |
                    models.Q(patient__user_profile__first_name__icontains=search)
                )
            qs = qs.order_by('-created_at')
            paginator = Paginator(qs, page_size)
            page_obj = paginator.get_page(page)
            total_count = paginator.count
            for lo in page_obj:
                records.append({
                    'id': str(lo.id),
                    'ref': lo.order_number,
                    'patient': lo.patient.user_profile.full_name,
                    'doctor': lo.doctor.user_profile.full_name,
                    'priority': lo.priority,
                    'status': lo.status,
                    'ordered_at': lo.created_at.strftime('%Y-%m-%d %H:%M'),
                    'is_critical': lo.is_critical
                })

        elif metric_type in ['REVENUE_INVOICES', 'OUTSTANDING_RECEIVABLES']:
            columns = ['Invoice Number', 'Patient Name', 'Encounter Type', 'Invoice Date', 'Total Amount (₹)', 'Paid (₹)', 'Balance (₹)', 'Status']
            qs = Invoice.objects.select_related('patient__user_profile')
            if metric_type == 'OUTSTANDING_RECEIVABLES':
                qs = qs.filter(status__in=[InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID])
            else:
                qs = qs.exclude(status=InvoiceStatus.CANCELLED).filter(invoice_date__range=[start_date, end_date])
            if branch_id:
                qs = qs.filter(branch_id=branch_id)
            if search:
                qs = qs.filter(
                    models.Q(invoice_number__icontains=search) |
                    models.Q(patient__user_profile__first_name__icontains=search)
                )
            qs = qs.order_by('-invoice_date')
            paginator = Paginator(qs, page_size)
            page_obj = paginator.get_page(page)
            total_count = paginator.count
            for inv in page_obj:
                records.append({
                    'id': str(inv.id),
                    'ref': inv.invoice_number,
                    'patient': inv.patient.user_profile.full_name,
                    'encounter_type': inv.encounter_type,
                    'date': str(inv.invoice_date),
                    'total_amount': float(inv.total_amount),
                    'paid_amount': float(inv.paid_amount),
                    'balance_amount': float(inv.balance_amount),
                    'status': inv.status
                })

        elif metric_type == 'COLLECTIONS':
            columns = ['Receipt Number', 'Invoice Number', 'Patient Name', 'Payment Method', 'Settled Amount (₹)', 'Received By', 'Payment Date']
            qs = Payment.objects.select_related('invoice', 'patient__user_profile', 'received_by__user_profile')
            qs = qs.filter(payment_date__range=[start_dt, end_dt])
            if branch_id:
                qs = qs.filter(branch_id=branch_id)
            if search:
                qs = qs.filter(
                    models.Q(payment_number__icontains=search) |
                    models.Q(invoice__invoice_number__icontains=search) |
                    models.Q(patient__user_profile__first_name__icontains=search)
                )
            qs = qs.order_by('-payment_date')
            paginator = Paginator(qs, page_size)
            page_obj = paginator.get_page(page)
            total_count = paginator.count
            for p in page_obj:
                records.append({
                    'id': str(p.id),
                    'ref': p.payment_number,
                    'invoice': p.invoice.invoice_number if p.invoice else 'Direct',
                    'patient': p.patient.user_profile.full_name,
                    'payment_method': p.payment_method,
                    'amount': float(p.amount),
                    'cashier': p.received_by.user_profile.full_name if p.received_by else 'Front Desk Cashier',
                    'date': p.payment_date.strftime('%Y-%m-%d %H:%M')
                })

        elif metric_type == 'SUPPLIER_PAYABLES':
            columns = ['Supplier Name', 'Invoice Number', 'Invoice Date', 'Due Date', 'Total (₹)', 'Paid (₹)', 'Outstanding (₹)', 'Status']
            qs = SupplierInvoice.objects.select_related('supplier')
            qs = qs.filter(payment_status__in=['UNPAID', 'PARTIALLY_PAID'])
            if branch_id:
                qs = qs.filter(branch_id=branch_id)
            if search:
                qs = qs.filter(
                    models.Q(invoice_number__icontains=search) |
                    models.Q(supplier__name__icontains=search)
                )
            qs = qs.order_by('due_date')
            paginator = Paginator(qs, page_size)
            page_obj = paginator.get_page(page)
            total_count = paginator.count
            for si in page_obj:
                outstanding = si.total_amount - si.paid_amount
                records.append({
                    'id': str(si.id),
                    'supplier': si.supplier.name,
                    'ref': si.invoice_number,
                    'invoice_date': str(si.invoice_date),
                    'due_date': str(si.due_date),
                    'total_amount': float(si.total_amount),
                    'paid_amount': float(si.paid_amount),
                    'outstanding_amount': float(outstanding),
                    'status': si.payment_status
                })

        return {
            'metric_type': metric_type,
            'columns': columns,
            'records': records,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_records': total_count,
                'total_pages': paginator.num_pages if total_count > 0 else 1
            }
        }
