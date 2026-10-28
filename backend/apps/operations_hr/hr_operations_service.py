import datetime
import calendar
from decimal import Decimal
from django.db import transaction, models
from django.db.models import Sum, Q, Count
from django.utils import timezone
from apps.core.models import Branch, Department, AuditLog
from apps.authentication.models import StaffProfile, UserProfile, PatientProfile, Role, RoleEnum
from apps.operations_hr.models import (
    EmployeeDetail, EmployeeDocument, HospitalShift, ShiftRosterAssignment,
    EmployeeAttendance, AttendanceStatus, LeaveRequest, LeaveStatus, LeaveType,
    LeaveBalance, HospitalHoliday, SalaryStructure, PayrollPeriod, Payslip,
    PayrollWorkflowStatus, FixedAsset, AssetDepreciationSchedule,
    EquipmentMaintenanceTask, OperatingTheatreSuite, OperationTheatreBooking,
    ICUObservationRecord, Ambulance, AmbulanceDispatch, AmbulanceStatus,
    BloodBankStock, BloodBagStatus, HousekeepingTask, HousekeepingTaskStatus,
    BiomedicalWasteRecord, WasteStatus, EmploymentType, SeparationStatus
)


class HROperationsService:
    """
    Centralized Business Logic Engine for Section 20: HR, Payroll, Assets and Operations.
    Coordinates all employee lifecycles, attendance calculation, shift roster scheduling,
    payroll runs with Section 17 GL posting, fixed asset straight-line depreciation,
    OT booking conflict prevention, ICU observations, ambulance fleet dispatch,
    blood bank inventory, housekeeping, and biomedical waste manifests.
    """

    # =========================================================================
    # 1. DASHBOARDS & REAL-TIME ANALYTICS
    # =========================================================================

    @classmethod
    def get_hr_dashboard(cls, branch_id=None):
        """
        Real-time HR executive metrics from database records.
        """
        today = timezone.localdate()
        staff_qs = StaffProfile.objects.select_related('user_profile', 'department', 'branch')
        if branch_id:
            staff_qs = staff_qs.filter(branch_id=branch_id)

        total_active_employees = staff_qs.filter(status='ACTIVE').count()
        
        # Department breakdown
        dept_counts = staff_qs.filter(status='ACTIVE').values('department__name').annotate(
            count=Count('id')
        ).order_by('-count')
        departments_breakdown = [
            {'department': d['department__name'] or 'Unassigned', 'count': d['count']}
            for d in dept_counts
        ]

        # Today's Attendance
        att_qs = EmployeeAttendance.objects.filter(date=today)
        if branch_id:
            att_qs = att_qs.filter(staff__branch_id=branch_id)
        
        present_count = att_qs.filter(status=AttendanceStatus.PRESENT).count()
        absent_count = att_qs.filter(status=AttendanceStatus.ABSENT).count()
        late_count = att_qs.filter(Q(status=AttendanceStatus.LATE) | Q(late_minutes__gt=0)).count()
        on_leave_count = att_qs.filter(status=AttendanceStatus.ON_LEAVE).count()

        # Pending Leave Approvals
        pending_leaves_qs = LeaveRequest.objects.filter(status=LeaveStatus.PENDING)
        if branch_id:
            pending_leaves_qs = pending_leaves_qs.filter(staff__branch_id=branch_id)
        pending_leaves_count = pending_leaves_qs.count()

        # Latest Payroll Run
        payroll_qs = PayrollPeriod.objects.all().order_by('-year', '-month')
        if branch_id:
            payroll_qs = payroll_qs.filter(branch_id=branch_id)
        latest_payroll = payroll_qs.first()

        payroll_summary = None
        if latest_payroll:
            payroll_summary = {
                'id': str(latest_payroll.id),
                'period': f"{latest_payroll.month:02d}/{latest_payroll.year}",
                'status': latest_payroll.status,
                'total_gross': latest_payroll.total_gross,
                'total_disbursed': latest_payroll.total_disbursed,
                'is_processed': latest_payroll.is_processed,
            }

        return {
            'total_active_employees': total_active_employees,
            'departments_breakdown': departments_breakdown,
            'today_attendance': {
                'date': today.isoformat(),
                'present': present_count,
                'absent': absent_count,
                'late': late_count,
                'on_leave': on_leave_count,
            },
            'pending_leaves_count': pending_leaves_count,
            'latest_payroll': payroll_summary,
        }

    @classmethod
    def get_asset_dashboard(cls, branch_id=None):
        """
        Fixed Assets, Biomedical Equipment, Calibration and Maintenance Status.
        """
        today = timezone.localdate()
        asset_qs = FixedAsset.objects.all()
        if branch_id:
            asset_qs = asset_qs.filter(branch_id=branch_id)

        total_assets = asset_qs.count()
        total_valuation = asset_qs.aggregate(s=Sum('current_carrying_value'))['s'] or Decimal('0.00')
        total_purchase_cost = asset_qs.aggregate(s=Sum('purchase_cost'))['s'] or Decimal('0.00')
        total_accumulated_depreciation = asset_qs.aggregate(s=Sum('accumulated_depreciation'))['s'] or Decimal('0.00')

        # Categories
        cat_counts = asset_qs.values('category').annotate(
            count=Count('id'), total_val=Sum('current_carrying_value')
        ).order_by('-count')

        # Maintenance Status
        maint_qs = EquipmentMaintenanceTask.objects.all()
        if branch_id:
            maint_qs = maint_qs.filter(asset__branch_id=branch_id)

        awaiting_maintenance = maint_qs.filter(completion_date__isnull=True).count()
        overdue_maintenance = maint_qs.filter(
            completion_date__isnull=True,
            scheduled_date__lt=today
        ).count()

        # Expiring warranties within 60 days
        sixty_days_ahead = today + datetime.timedelta(days=60)
        expiring_warranties = asset_qs.filter(
            warranty_expiry_date__gte=today,
            warranty_expiry_date__lte=sixty_days_ahead
        ).count()

        return {
            'total_assets_registered': total_assets,
            'total_carrying_valuation': total_valuation,
            'total_original_cost': total_purchase_cost,
            'total_accumulated_depreciation': total_accumulated_depreciation,
            'categories': list(cat_counts),
            'awaiting_maintenance_count': awaiting_maintenance,
            'overdue_maintenance_count': overdue_maintenance,
            'expiring_warranties_count': expiring_warranties,
        }

    @classmethod
    def get_operations_dashboard(cls, branch_id=None):
        """
        Hospital Operations: OT bookings, ICU observations, Ambulances, Housekeeping, Waste, Blood Bank.
        """
        today = timezone.localdate()

        # OT Surgeries Today
        ot_qs = OperationTheatreBooking.objects.filter(scheduled_date=today)
        if branch_id:
            ot_qs = ot_qs.filter(theatre__branch_id=branch_id)
        ot_count = ot_qs.count()

        # Ambulance Status
        amb_qs = Ambulance.objects.all()
        if branch_id:
            amb_qs = amb_qs.filter(base_branch_id=branch_id)
        total_ambulances = amb_qs.count()
        available_ambulances = amb_qs.filter(status=AmbulanceStatus.AVAILABLE).count()
        on_trip_ambulances = amb_qs.filter(status__in=[AmbulanceStatus.DISPATCHED, AmbulanceStatus.ON_TRIP]).count()

        # Housekeeping
        hk_qs = HousekeepingTask.objects.all()
        if branch_id:
            hk_qs = hk_qs.filter(branch_id=branch_id)
        pending_hk = hk_qs.filter(status__in=[HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.IN_PROGRESS]).count()
        overdue_hk = hk_qs.filter(status=HousekeepingTaskStatus.OVERDUE).count()

        # Biomedical Waste Pending Handover
        waste_qs = BiomedicalWasteRecord.objects.filter(status__in=[WasteStatus.COLLECTED, WasteStatus.IN_STORAGE])
        if branch_id:
            waste_qs = waste_qs.filter(branch_id=branch_id)
        pending_waste_kg = waste_qs.aggregate(s=Sum('weight_kg'))['s'] or Decimal('0.00')

        # Blood Bank Inventory
        blood_qs = BloodBankStock.objects.filter(status=BloodBagStatus.AVAILABLE, expiry_date__gte=today)
        total_blood_units = blood_qs.count()
        blood_by_group = list(blood_qs.values('blood_group').annotate(count=Count('id')).order_by('blood_group'))

        return {
            'today_ot_surgeries_count': ot_count,
            'ambulances': {
                'total': total_ambulances,
                'available': available_ambulances,
                'on_trip': on_trip_ambulances,
            },
            'housekeeping': {
                'pending_tasks': pending_hk,
                'overdue_tasks': overdue_hk,
            },
            'biomedical_waste': {
                'pending_collection_kg': pending_waste_kg,
            },
            'blood_bank': {
                'total_available_units': total_blood_units,
                'by_group': blood_by_group,
            }
        }

    # =========================================================================
    # 2. EMPLOYEE MANAGEMENT
    # =========================================================================

    @classmethod
    @transaction.atomic
    def onboard_employee(cls, data, creator=None):
        """
        Creates user, staff profile, employee detail, and initial leave balance.
        Generates unique employee ID.
        """
        branch_id = data.get('branch_id')
        branch = Branch.objects.get(id=branch_id) if branch_id else Branch.objects.first()
        dept_id = data.get('department_id')
        department = Department.objects.filter(id=dept_id).first() if dept_id else None

        role_name = data.get('role_name', RoleEnum.DOCTOR)
        role = Role.objects.get(name=role_name)

        # Generate Employee ID: EMP-XXXX
        total_staff = StaffProfile.objects.count() + 1
        emp_id = data.get('employee_id') or f"EMP-{total_staff:04d}"

        # Create or fetch UserProfile
        email = data.get('email', f"{emp_id.lower()}@aurahospital.com")
        user_profile, _ = UserProfile.objects.get_or_create(
            email=email,
            defaults={
                'supabase_user_id': uuid.uuid4(),
                'first_name': data.get('first_name', 'First'),
                'last_name': data.get('last_name', 'Last'),
                'phone_number': data.get('phone_number', ''),
                'role': role,
                'is_verified': True,
            }
        )

        staff = StaffProfile.objects.create(
            user_profile=user_profile,
            hospital=branch.hospital,
            branch=branch,
            department=department,
            employee_id=emp_id,
            designation=data.get('designation', 'Staff'),
            specialization=data.get('specialization', ''),
            qualification=data.get('qualification', ''),
            joining_date=data.get('joining_date', timezone.localdate()),
            status='ACTIVE',
            is_on_duty=True
        )

        # Create EmployeeDetail
        EmployeeDetail.objects.create(
            staff=staff,
            employment_type=data.get('employment_type', EmploymentType.FULL_TIME),
            gender=data.get('gender', 'MALE'),
            emergency_contact_name=data.get('emergency_contact_name', ''),
            emergency_contact_phone=data.get('emergency_contact_phone', ''),
            emergency_contact_relation=data.get('emergency_contact_relation', ''),
            pan_number=data.get('pan_number', ''),
            aadhaar_number=data.get('aadhaar_number', ''),
            bank_name=data.get('bank_name', 'HDFC Bank'),
            bank_account_number=data.get('bank_account_number', ''),
            bank_ifsc_code=data.get('bank_ifsc_code', '')
        )

        # Create Default Salary Structure
        basic = Decimal(str(data.get('basic_salary', '40000.00')))
        hra = Decimal(str(data.get('house_rent_allowance', '15000.00')))
        spl = Decimal(str(data.get('special_allowance', '5000.00')))
        SalaryStructure.objects.create(
            staff=staff,
            basic_salary=basic,
            house_rent_allowance=hra,
            special_allowance=spl,
            provident_fund_deduction=Decimal('1800.00'),
            professional_tax=Decimal('200.00'),
            income_tax_tds=Decimal('1500.00')
        )

        # Initialize Annual Leave Balances
        for l_type, l_days in [(LeaveType.CASUAL, 12.0), (LeaveType.SICK, 10.0), (LeaveType.PRIVILEGE, 15.0)]:
            LeaveBalance.objects.get_or_create(
                staff=staff,
                fiscal_year="2026-2027",
                leave_type=l_type,
                defaults={'allocated_days': Decimal(str(l_days)), 'accrued_days': Decimal(str(l_days)), 'used_days': Decimal('0.0')}
            )

        return staff

    # =========================================================================
    # 3. ATTENDANCE & SHIFT MANAGEMENT
    # =========================================================================

    @classmethod
    def record_attendance_clock(cls, staff_id, clock_type='CLOCK_IN', timestamp=None, remarks='', shift_id=None):
        """
        Records or updates attendance, calculates worked hours and late arrival.
        """
        today = timezone.localdate()
        now_time = (timestamp or timezone.now()).time()

        shift = HospitalShift.objects.filter(id=shift_id).first() if shift_id else None

        att, created = EmployeeAttendance.objects.get_or_create(
            staff_id=staff_id,
            date=today,
            defaults={'clock_in': now_time, 'shift': shift, 'status': AttendanceStatus.PRESENT, 'remarks': remarks}
        )

        if not created:
            if clock_type == 'CLOCK_OUT':
                att.clock_out = now_time
                if att.clock_in:
                    # Calculate duration
                    t_in = datetime.datetime.combine(today, att.clock_in)
                    t_out = datetime.datetime.combine(today, now_time)
                    if t_out < t_in: # Overnight shift
                        t_out += datetime.timedelta(days=1)
                    duration_hours = Decimal(str(round((t_out - t_in).total_seconds() / 3600.0, 2)))
                    att.total_hours_worked = duration_hours
                    
                    # Standard shift: 8 hours; excess is overtime
                    if duration_hours > Decimal('8.00'):
                        att.overtime_hours = duration_hours - Decimal('8.00')
                    elif duration_hours < Decimal('4.00'):
                        att.status = AttendanceStatus.HALF_DAY
                att.remarks = f"{att.remarks}; {remarks}".strip('; ')
                att.save()
            else:
                att.clock_in = now_time
                att.save()

        return att

    # =========================================================================
    # 4. LEAVE WORKFLOWS
    # =========================================================================

    @classmethod
    @transaction.atomic
    def process_leave_application(cls, staff_id, leave_type, start_date, end_date, reason):
        """
        Validates leave balance and non-overlapping requests, creates LeaveRequest.
        """
        s_date = datetime.date.fromisoformat(str(start_date))
        e_date = datetime.date.fromisoformat(str(end_date))
        if e_date < s_date:
            raise ValueError("End date cannot be earlier than start date.")

        # Check overlapping existing approved or pending leaves
        overlap = LeaveRequest.objects.filter(
            staff_id=staff_id,
            status__in=[LeaveStatus.PENDING, LeaveStatus.APPROVED],
            start_date__lte=e_date,
            end_date__gte=s_date
        ).exists()
        if overlap:
            raise ValueError("An overlapping leave request already exists for this period.")

        days = (e_date - s_date).days + 1

        # Check balance
        bal = LeaveBalance.objects.filter(
            staff_id=staff_id,
            fiscal_year="2026-2027",
            leave_type=leave_type
        ).first()

        if bal and bal.remaining_days < Decimal(str(days)):
            raise ValueError(f"Insufficient leave balance. Requested: {days} days, Available: {bal.remaining_days} days.")

        req = LeaveRequest.objects.create(
            staff_id=staff_id,
            leave_type=leave_type,
            start_date=s_date,
            end_date=e_date,
            total_days=days,
            reason=reason,
            status=LeaveStatus.PENDING
        )
        return req

    @classmethod
    @transaction.atomic
    def approve_or_reject_leave(cls, leave_id, status_action=None, approver_staff=None, comments='', approver_user=None, decision=None):
        """
        Approves or rejects a leave request, updating LeaveBalance on approval.
        """
        if decision:
            status_action = decision
        if not status_action:
            status_action = LeaveStatus.APPROVED

        if approver_user and not approver_staff:
            approver_staff = StaffProfile.objects.filter(user_profile=approver_user).first()

        req = LeaveRequest.objects.get(id=leave_id)
        if approver_staff and req.staff_id == approver_staff.id:
            raise ValueError("Separation of duties: You cannot approve your own leave request.")

        req.status = status_action
        req.approved_by = approver_staff
        req.approver_comments = comments
        req.save()

        if status_action == LeaveStatus.APPROVED:
            bal = LeaveBalance.objects.filter(
                staff_id=req.staff_id,
                fiscal_year="2026-2027",
                leave_type=req.leave_type
            ).first()
            if bal:
                bal.used_days += Decimal(str(req.total_days))
                bal.save()

        return req

    # =========================================================================
    # 5. PAYROLL RUNS & GENERAL LEDGER INTEGRATION
    # =========================================================================

    @classmethod
    @transaction.atomic
    def generate_monthly_payroll_run(cls, month=None, year=None, branch_id=None, preparer_staff=None, branch=None, created_by_user=None):
        """
        Calculates payslips for all active staff, creating a DRAFT PayrollPeriod.
        Prevents duplicate payroll runs for the same branch and period.
        """
        if branch is None:
            branch = Branch.objects.get(id=branch_id) if branch_id else Branch.objects.first()

        if created_by_user and not preparer_staff:
            preparer_staff = StaffProfile.objects.filter(user_profile=created_by_user).first()

        month = int(month or timezone.localdate().month)
        year = int(year or timezone.localdate().year)

        period, created = PayrollPeriod.objects.get_or_create(
            branch=branch,
            month=month,
            year=year,
            defaults={
                'status': PayrollWorkflowStatus.DRAFT,
                'prepared_by': preparer_staff,
                'is_processed': False,
            }
        )

        if not created and period.status in [PayrollWorkflowStatus.APPROVED, PayrollWorkflowStatus.POSTED_GL, PayrollWorkflowStatus.PAID]:
            raise ValueError(f"Payroll for {month:02d}/{year} is already {period.status} and cannot be regenerated.")

        period.status = PayrollWorkflowStatus.DRAFT
        period.prepared_by = preparer_staff
        period.processed_at = timezone.now()

        active_staff = StaffProfile.objects.filter(branch=branch, status='ACTIVE').select_related('salary_structure', 'user_profile')
        
        total_gross = Decimal('0.00')
        total_ded = Decimal('0.00')
        total_net = Decimal('0.00')

        count = 1
        for staff in active_staff:
            basic = Decimal('40000.00')
            hra = Decimal('15000.00')
            spl = Decimal('5000.00')
            pf = Decimal('1800.00')
            pt = Decimal('200.00')
            tds = Decimal('1500.00')
            esi = Decimal('0.00')

            if hasattr(staff, 'salary_structure'):
                s = staff.salary_structure
                basic = s.basic_salary
                hra = s.house_rent_allowance
                spl = s.special_allowance
                pf = s.provident_fund_deduction
                pt = s.professional_tax
                tds = s.income_tax_tds
                esi = s.esi_deduction

            # Calculate overtime pay from attendance
            ot_hours = EmployeeAttendance.objects.filter(
                staff=staff,
                date__year=year,
                date__month=month
            ).aggregate(s=Sum('overtime_hours'))['s'] or Decimal('0.00')
            hourly_rate = round(basic / Decimal('200.00'), 2)
            ot_pay = round(ot_hours * hourly_rate * Decimal('1.5'), 2)

            gross = basic + hra + spl + ot_pay
            deductions = pf + pt + tds + esi
            net = gross - deductions

            allowances_dict = {
                'basic': str(basic),
                'hra': str(hra),
                'special': str(spl),
                'overtime': str(ot_pay),
            }
            deductions_dict = {
                'provident_fund': str(pf),
                'professional_tax': str(pt),
                'income_tax_tds': str(tds),
                'esi': str(esi),
            }

            slip_num = f"PAY-{year}-{month:02d}-{staff.employee_id}"

            Payslip.objects.update_or_create(
                payroll_period=period,
                staff=staff,
                defaults={
                    'payslip_number': slip_num,
                    'basic_pay': basic,
                    'overtime_pay': ot_pay,
                    'bonus_incentive': Decimal('0.00'),
                    'gross_pay': gross,
                    'deductions': deductions,
                    'net_pay': net,
                    'allowances_breakdown': allowances_dict,
                    'deductions_breakdown': deductions_dict,
                    'payment_status': 'UNPAID',
                    'payment_date': timezone.localdate(),
                }
            )

            total_gross += gross
            total_ded += deductions
            total_net += net
            count += 1

        period.total_gross = total_gross
        period.total_deductions = total_ded
        period.total_disbursed = total_net
        period.is_processed = True
        period.save()

        return period

    @classmethod
    @transaction.atomic
    def approve_payroll_period(cls, payroll_id, approver_staff=None):
        """
        Approves a payroll run enforcing separation of duties.
        """
        period = PayrollPeriod.objects.get(id=payroll_id)
        if approver_staff and period.prepared_by and period.prepared_by.id == approver_staff.id:
            raise ValueError("Separation of duties violation: You cannot approve a payroll run you prepared.")

        period.status = PayrollWorkflowStatus.APPROVED
        period.approved_by = approver_staff
        period.approved_at = timezone.now()
        period.save()
        return period

    @classmethod
    @transaction.atomic
    def post_payroll_to_gl(cls, payroll_id, user=None):
        """
        Integrates with Section 17 Double-Entry General Ledger:
        Creates a balanced Journal Voucher:
        - Debit Account 5010 (Staff Salaries & Nursing Payroll Expense): total_gross
        - Credit Account 2040 (Taxes & Statutory GST Liabilities Payable): total_deductions
        - Credit Account 2010 / 2020 (Accrued Salaries Payable): total_disbursed (net)
        """
        from apps.billing_finance.models import ChartOfAccount, JournalEntry, JournalLineItem, FinancialAccount

        period = PayrollPeriod.objects.get(id=payroll_id)
        if period.status not in [PayrollWorkflowStatus.APPROVED, PayrollWorkflowStatus.POSTED_GL]:
            raise ValueError("Payroll must be approved before posting to the General Ledger.")

        if period.journal_entry_id:
            return period  # Already posted

        # Retrieve accounts
        salary_exp = ChartOfAccount.objects.filter(account_code='5010').first()
        statutory_liab = ChartOfAccount.objects.filter(account_code='2040').first()
        salary_payable = ChartOfAccount.objects.filter(account_code='2010').first()

        if not salary_exp or not salary_payable:
            # Fallback
            salary_exp = ChartOfAccount.objects.filter(classification='EXPENSES').first()
            salary_payable = ChartOfAccount.objects.filter(classification='LIABILITIES').first()

        today = timezone.localdate()
        entry_number = f"JV-PAYROLL-{period.year}-{period.month:02d}"

        jv, _ = JournalEntry.objects.get_or_create(
            entry_number=entry_number,
            defaults={
                'entry_date': today,
                'narration': f"Consolidated staff payroll expense and statutory liabilities for {period.month:02d}/{period.year} - {period.branch.name}",
                'status': 'POSTED',
                'branch': period.branch,
                'posted_at': timezone.now(),
            }
        )

        # Clear old lines if any
        jv.lines.all().delete()

        # Line 1: Debit Gross Salary Expense
        JournalLineItem.objects.create(
            journal_entry=jv,
            account=salary_exp,
            entry_type='DEBIT',
            amount=period.total_gross,
            debit_amount=period.total_gross,
            credit_amount=Decimal('0.00'),
            description=f"Gross salary provision for {period.month:02d}/{period.year}"
        )

        # Line 2: Credit Statutory Deductions (TDS, PF, PT, ESI)
        if period.total_deductions > Decimal('0.00'):
            JournalLineItem.objects.create(
                journal_entry=jv,
                account=statutory_liab or salary_payable,
                entry_type='CREDIT',
                amount=period.total_deductions,
                debit_amount=Decimal('0.00'),
                credit_amount=period.total_deductions,
                description="Statutory tax & provident fund deductions withheld"
            )

        # Line 3: Credit Net Salary Payable
        JournalLineItem.objects.create(
            journal_entry=jv,
            account=salary_payable,
            entry_type='CREDIT',
            amount=period.total_disbursed,
            debit_amount=Decimal('0.00'),
            credit_amount=period.total_disbursed,
            description="Net salary payable to staff"
        )

        jv.total_debit = period.total_gross
        jv.total_credit = period.total_gross
        jv.save()

        period.journal_entry_id = jv.id
        period.status = PayrollWorkflowStatus.POSTED_GL
        period.posted_at = timezone.now()
        period.save()

        return period

    @classmethod
    @transaction.atomic
    def disburse_payroll_payment(cls, payroll_id, disbursing_account_id=None, payment_ref='NEFT-BULK-001', user=None):
        """
        Disburses payroll: updates payslips to PAID, creates cash outflow transaction.
        """
        period = PayrollPeriod.objects.get(id=payroll_id)
        period.status = PayrollWorkflowStatus.PAID
        period.paid_at = timezone.now()
        period.payment_reference = payment_ref
        if disbursing_account_id:
            period.disbursing_account_id = disbursing_account_id
        period.save()

        # Mark all payslips as PAID
        period.payslips.all().update(
            payment_status='PAID',
            payment_date=timezone.localdate(),
            payment_reference=payment_ref
        )
        return period

    # =========================================================================
    # 6. FIXED ASSETS & STRAIGHT-LINE DEPRECIATION
    # =========================================================================

    @classmethod
    @transaction.atomic
    def calculate_and_post_depreciation(cls, asset_id, fiscal_year="2026-2027", user=None):
        """
        Calculates straight-line depreciation:
        Annual depreciation = (Purchase Cost - Residual Value) / Useful Life
        Updates asset carrying value and posts double-entry GL voucher.
        """
        from apps.billing_finance.models import ChartOfAccount, JournalEntry, JournalLineItem

        asset = FixedAsset.objects.get(id=asset_id)
        
        # Prevent duplicate depreciation for the same fiscal year
        existing = AssetDepreciationSchedule.objects.filter(asset=asset, fiscal_year=fiscal_year).first()
        if existing:
            return existing

        dep_amount = asset.calculate_annual_depreciation()
        if dep_amount <= Decimal('0.00'):
            return None

        before = asset.current_carrying_value
        after = max(asset.residual_value, before - dep_amount)
        actual_dep = before - after

        # Update asset carrying values
        asset.accumulated_depreciation += actual_dep
        asset.current_carrying_value = after
        asset.save()

        # Post to General Ledger (Account 5060 Depreciation Expense, Account 1520 Accumulated Depreciation)
        dep_exp_acc = ChartOfAccount.objects.filter(account_code='5060').first()
        acc_dep_acc = ChartOfAccount.objects.filter(account_code='1520').first()

        jv_id = None
        if dep_exp_acc and acc_dep_acc:
            today = timezone.localdate()
            jv_number = f"JV-DEP-{asset.asset_code}-{fiscal_year}"
            jv, _ = JournalEntry.objects.get_or_create(
                entry_number=jv_number,
                defaults={
                    'entry_date': today,
                    'narration': f"Annual straight-line depreciation for {asset.name} ({asset.asset_code}) for {fiscal_year}",
                    'status': 'POSTED',
                    'branch': asset.branch,
                    'posted_at': timezone.now()
                }
            )
            jv.lines.all().delete()
            JournalLineItem.objects.create(
                journal_entry=jv,
                account=dep_exp_acc,
                entry_type='DEBIT',
                amount=actual_dep,
                debit_amount=actual_dep,
                credit_amount=Decimal('0.00'),
                description=f"Depreciation expense on {asset.name}"
            )
            JournalLineItem.objects.create(
                journal_entry=jv,
                account=acc_dep_acc,
                entry_type='CREDIT',
                amount=actual_dep,
                debit_amount=Decimal('0.00'),
                credit_amount=actual_dep,
                description=f"Accumulated depreciation on {asset.name}"
            )
            jv.total_debit = actual_dep
            jv.total_credit = actual_dep
            jv.save()
            jv_id = jv.id

        sched = AssetDepreciationSchedule.objects.create(
            asset=asset,
            fiscal_year=fiscal_year,
            financial_period='ANNUAL',
            depreciation_amount=actual_dep,
            carrying_value_before=before,
            carrying_value_after=after,
            is_posted_gl=bool(jv_id),
            journal_entry_id=jv_id,
            posted_at=timezone.now() if jv_id else None
        )
        return sched

    # =========================================================================
    # 7. OPERATION THEATRE (OT) CONFLICT PREVENTION
    # =========================================================================

    @classmethod
    @transaction.atomic
    def book_operation_theatre(cls, theatre_id, patient_id, lead_surgeon_id, procedure_name, date_str, start_time_str, end_time_str, **kwargs):
        """
        Validates schedule conflicts (theatre availability & surgeon availability) and books OT.
        """
        theatre = OperatingTheatreSuite.objects.get(id=theatre_id)
        patient = PatientProfile.objects.get(id=patient_id)
        surgeon = StaffProfile.objects.get(id=lead_surgeon_id)

        s_date = datetime.date.fromisoformat(str(date_str))
        s_time = datetime.time.fromisoformat(str(start_time_str))
        e_time = datetime.time.fromisoformat(str(end_time_str))

        if e_time <= s_time:
            raise ValueError("Surgery end time must be after start time.")

        # 1. Check Operating Theatre availability (no overlap on same date)
        theatre_conflict = OperationTheatreBooking.objects.filter(
            theatre=theatre,
            scheduled_date=s_date,
            status__in=['SCHEDULED', 'IN_PROGRESS'],
            start_time__lt=e_time,
            end_time__gt=s_time
        ).exists()
        if theatre_conflict:
            raise ValueError(f"Operating Theatre {theatre.name} is already booked during this time interval.")

        # 2. Check Surgeon availability (surgeon cannot be in two theatres simultaneously)
        surgeon_conflict = OperationTheatreBooking.objects.filter(
            lead_surgeon=surgeon,
            scheduled_date=s_date,
            status__in=['SCHEDULED', 'IN_PROGRESS'],
            start_time__lt=e_time,
            end_time__gt=s_time
        ).exists()
        if surgeon_conflict:
            raise ValueError(f"Surgeon {surgeon.user_profile.full_name} is already scheduled for another surgery at this time.")

        count = OperationTheatreBooking.objects.count() + 1
        code = f"OT-{s_date.year}-{count:04d}"

        booking = OperationTheatreBooking.objects.create(
            booking_code=code,
            theatre=theatre,
            patient=patient,
            procedure_name=procedure_name,
            scheduled_date=s_date,
            start_time=s_time,
            end_time=e_time,
            lead_surgeon=surgeon,
            anesthetist_id=kwargs.get('anesthetist_id'),
            scrub_nurse_id=kwargs.get('scrub_nurse_id'),
            anesthesia_type=kwargs.get('anesthesia_type', 'GENERAL_ANESTHESIA'),
            pre_op_checklist_completed=kwargs.get('pre_op_checklist_completed', False),
            status='SCHEDULED',
            clinical_notes=kwargs.get('clinical_notes', '')
        )
        return booking

    # =========================================================================
    # 8. AMBULANCE FLEET & DISPATCH
    # =========================================================================

    @classmethod
    @transaction.atomic
    def dispatch_ambulance(cls, ambulance_id, pickup_location, patient_id=None, patient_name_unregistered='', destination='Hospital ER', user=None):
        """
        Dispatches ambulance, verifying availability and preventing conflicting active trips.
        """
        amb = Ambulance.objects.get(id=ambulance_id)
        if amb.status != AmbulanceStatus.AVAILABLE:
            raise ValueError(f"Ambulance {amb.registration_number} is not available (current status: {amb.status}).")

        count = AmbulanceDispatch.objects.count() + 1
        disp_num = f"AMB-DISP-{timezone.localdate().year}-{count:04d}"

        dispatch = AmbulanceDispatch.objects.create(
            dispatch_number=disp_num,
            ambulance=amb,
            patient_id=patient_id,
            patient_name_unregistered=patient_name_unregistered,
            pickup_location=pickup_location,
            destination=destination,
            dispatch_time=timezone.now(),
            trip_status='DISPATCHED'
        )

        amb.status = AmbulanceStatus.DISPATCHED
        amb.save()
        return dispatch

    @classmethod
    @transaction.atomic
    def complete_ambulance_trip(cls, dispatch_id, distance_km=Decimal('15.0'), fuel_liters=Decimal('2.5'), notes=''):
        """
        Completes an ambulance trip and releases the vehicle back to AVAILABLE.
        """
        disp = AmbulanceDispatch.objects.get(id=dispatch_id)
        disp.trip_status = 'COMPLETED'
        disp.return_time = timezone.now()
        disp.distance_km = Decimal(str(distance_km))
        disp.fuel_consumed_liters = Decimal(str(fuel_liters))
        disp.notes = notes
        disp.save()

        amb = disp.ambulance
        amb.status = AmbulanceStatus.AVAILABLE
        amb.odo_reading_km += int(disp.distance_km)
        amb.save()
        return disp

    # =========================================================================
    # 9. BLOOD BANK INVENTORY & CLINICAL ISSUANCE
    # =========================================================================

    @classmethod
    @transaction.atomic
    def issue_blood_unit(cls, bag_id, department_name='Emergency OT', issued_by_staff=None):
        """
        Issues a blood bag to ward/OT. Strictly enforces that expired or unverified units cannot be issued.
        """
        bag = BloodBankStock.objects.get(id=bag_id)
        if bag.is_expired():
            bag.status = BloodBagStatus.EXPIRED
            bag.save()
            raise ValueError(f"Blood unit {bag.bag_barcode} expired on {bag.expiry_date} and cannot be issued.")

        if bag.screening_status != 'PASSED':
            raise ValueError(f"Blood unit {bag.bag_barcode} screening status is {bag.screening_status}. Only PASSED units can be issued.")

        if bag.status == BloodBagStatus.ISSUED:
            raise ValueError(f"Blood unit {bag.bag_barcode} has already been issued.")

        bag.status = BloodBagStatus.ISSUED
        bag.issued_to_dept = department_name
        bag.issued_at = timezone.now()
        bag.issued_by = issued_by_staff
        bag.save()
        return bag

    # =========================================================================
    # 10. BIOMEDICAL WASTE & HOUSEKEEPING
    # =========================================================================

    @classmethod
    @transaction.atomic
    def handover_biomedical_waste(cls, record_id, agency_name, vehicle_no, receipt_no, officer=None):
        """
        Hands over waste manifest to accredited disposal agency.
        """
        waste = BiomedicalWasteRecord.objects.get(id=record_id)
        waste.disposal_agency_name = agency_name
        waste.vehicle_number = vehicle_no
        waste.agency_receipt_number = receipt_no
        waste.handover_time = timezone.now()
        waste.handover_officer = officer
        waste.status = WasteStatus.HANDED_OVER
        waste.save()
        return waste
