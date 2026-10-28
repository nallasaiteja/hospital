import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.core.models import BaseUUIDModel, Hospital, Branch, Department
from apps.authentication.models import StaffProfile, PatientProfile, RoleEnum


# =============================================================================
# 1. EMPLOYEE & HR MANAGEMENT MODELS
# =============================================================================

class EmploymentType(models.TextChoices):
    FULL_TIME = 'FULL_TIME', 'Full-Time Regular'
    PART_TIME = 'PART_TIME', 'Part-Time'
    CONTRACT = 'CONTRACT', 'Contractual'
    VISITING = 'VISITING', 'Visiting Consultant'
    INTERN = 'INTERN', 'Clinical Intern / Trainee'


class SeparationStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active Employment'
    NOTICE_PERIOD = 'NOTICE_PERIOD', 'Serving Notice Period'
    RESIGNED = 'RESIGNED', 'Resigned'
    TERMINATED = 'TERMINATED', 'Terminated'
    RETIRED = 'RETIRED', 'Retired'


class EmployeeDetail(BaseUUIDModel):
    """
    Extended Employee Profile for HR governance, emergency contacts, statutory identity,
    and separation tracking, linked 1-to-1 with StaffProfile.
    """
    staff = models.OneToOneField(StaffProfile, on_delete=models.CASCADE, related_name='employee_detail')
    employment_type = models.CharField(max_length=30, choices=EmploymentType.choices, default=EmploymentType.FULL_TIME)
    reporting_manager = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinates')
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, default='NOT_SPECIFIED')
    marital_status = models.CharField(max_length=20, default='SINGLE')
    blood_group = models.CharField(max_length=10, blank=True)
    
    # Emergency Contact
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=30, blank=True)
    emergency_contact_relation = models.CharField(max_length=50, blank=True)
    
    # Confidential / Statutory Details (restricted)
    pan_number = models.CharField(max_length=20, blank=True)
    aadhaar_number = models.CharField(max_length=30, blank=True)
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_ifsc_code = models.CharField(max_length=20, blank=True)
    
    # Separation
    separation_status = models.CharField(max_length=30, choices=SeparationStatus.choices, default=SeparationStatus.ACTIVE)
    separation_date = models.DateField(null=True, blank=True)
    separation_reason = models.TextField(blank=True)
    photo_url = models.URLField(max_length=500, blank=True)

    class Meta:
        db_table = 'hms_employee_details'
        ordering = ['staff__employee_id']

    def __str__(self):
        return f"HR Details: {self.staff.employee_id} - {self.staff.user_profile.full_name}"


class EmployeeDocument(BaseUUIDModel):
    """
    Employment contracts, educational certificates, medical licenses, and verification proofs.
    """
    DOCUMENT_TYPES = [
        ('RESUME', 'Curriculum Vitae / Resume'),
        ('OFFER_LETTER', 'Signed Offer / Appointment Letter'),
        ('ID_PROOF', 'Government Identity Proof'),
        ('DEGREE_CERTIFICATE', 'Academic Degree / Diploma'),
        ('MEDICAL_LICENSE', 'State Medical Council Registration'),
        ('RELIEVING_LETTER', 'Previous Employer Relieving Letter'),
        ('CONFIDENTIALITY', 'Non-Disclosure / Ethics Agreement'),
        ('OTHER', 'Other Documentation'),
    ]
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='employee_documents')
    document_type = models.CharField(max_length=40, choices=DOCUMENT_TYPES)
    title = models.CharField(max_length=200)
    file_url = models.URLField(max_length=500)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_employee_documents'
        ordering = ['-uploaded_at']


# =============================================================================
# 2. SHIFTS, ROSTERS & ATTENDANCE MODELS
# =============================================================================

class HospitalShift(BaseUUIDModel):
    """
    24/7 Hospital Operational Shifts with overnight support, break durations, and staffing requirements.
    """
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='hospital_shifts')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='hospital_shifts')
    shift_code = models.CharField(max_length=30, db_index=True)
    name = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_overnight = models.BooleanField(default=False)
    break_duration_minutes = models.PositiveIntegerField(default=45)
    min_staffing_required = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = 'hms_hospital_shifts'
        unique_together = ('branch', 'shift_code')
        ordering = ['start_time']

    def __str__(self):
        return f"{self.name} ({self.start_time} - {self.end_time})"


class ShiftRosterAssignment(BaseUUIDModel):
    """
    Employee shift schedule assignments with conflict prevention and swap tracking.
    """
    ASSIGNMENT_STATUS = [
        ('SCHEDULED', 'Scheduled'),
        ('CONFIRMED', 'Confirmed by Staff'),
        ('COMPLETED', 'Completed'),
        ('SWAP_REQUESTED', 'Swap Requested'),
        ('SWAPPED', 'Reassigned / Swapped'),
        ('ABSENT', 'Absent'),
        ('CANCELLED', 'Cancelled'),
    ]
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='roster_assignments')
    shift = models.ForeignKey(HospitalShift, on_delete=models.PROTECT, related_name='assignments')
    roster_date = models.DateField(db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='shift_assignments')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='shift_assignments')
    status = models.CharField(max_length=25, choices=ASSIGNMENT_STATUS, default='SCHEDULED')
    swap_with = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='requested_swaps')
    swap_approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_roster_swaps')
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_shift_roster_assignments'
        unique_together = ('staff', 'roster_date', 'shift')
        ordering = ['-roster_date', 'shift__start_time']

    def __str__(self):
        return f"{self.staff.employee_id} - {self.shift.name} ({self.roster_date})"


class AttendanceStatus(models.TextChoices):
    PRESENT = 'PRESENT', 'Present on Duty'
    ABSENT = 'ABSENT', 'Absent'
    HALF_DAY = 'HALF_DAY', 'Half Day'
    ON_LEAVE = 'ON_LEAVE', 'Approved Leave'
    WEEKLY_OFF = 'WEEKLY_OFF', 'Weekly Off'
    HOLIDAY = 'HOLIDAY', 'Hospital Holiday'
    LATE = 'LATE', 'Late Arrival'


class EmployeeAttendance(BaseUUIDModel):
    """
    Daily Staff Clock-In, Clock-Out, Working Hours Calculation, and Overtime Tracking.
    """
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField(db_index=True)
    shift = models.ForeignKey(HospitalShift, on_delete=models.SET_NULL, null=True, blank=True, related_name='attendance_records')
    clock_in = models.TimeField(null=True, blank=True)
    clock_out = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=AttendanceStatus.choices, default=AttendanceStatus.PRESENT)
    total_hours_worked = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    late_minutes = models.PositiveIntegerField(default=0)
    early_departure_minutes = models.PositiveIntegerField(default=0)
    overtime_hours = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    approval_status = models.CharField(max_length=20, default='APPROVED')
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_attendance')
    remarks = models.CharField(max_length=200, blank=True)
    correction_reason = models.TextField(blank=True)
    corrected_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='corrected_attendance')

    class Meta:
        db_table = 'hms_employee_attendance'
        unique_together = ('staff', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.staff.user_profile.full_name} ({self.date}) - {self.status}"


# =============================================================================
# 3. LEAVE MANAGEMENT MODELS
# =============================================================================

class LeaveType(models.TextChoices):
    CASUAL = 'CASUAL', 'Casual Leave'
    SICK = 'SICK', 'Medical / Sick Leave'
    PRIVILEGE = 'PRIVILEGE', 'Earned / Privilege Leave'
    MATERNITY = 'MATERNITY', 'Maternity / Paternity Leave'
    UNPAID = 'UNPAID', 'Leave Without Pay (LWP)'


class LeaveStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    CANCELLED = 'CANCELLED', 'Cancelled by Employee'


class LeaveRequest(BaseUUIDModel):
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=20, choices=LeaveType.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    total_days = models.PositiveIntegerField(default=1)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=LeaveStatus.choices, default=LeaveStatus.PENDING)
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_leaves')
    approver_comments = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_leave_requests'
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.staff.employee_id} - {self.leave_type} ({self.start_date} to {self.end_date}) [{self.status}]"


class LeaveBalance(BaseUUIDModel):
    """
    Annual Leave Quotas, Accruals, and Remaining Balances per staff member.
    """
    staff = models.ForeignKey(StaffProfile, on_delete=models.CASCADE, related_name='leave_balances')
    fiscal_year = models.CharField(max_length=20, default='2026-2027')
    leave_type = models.CharField(max_length=20, choices=LeaveType.choices)
    allocated_days = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal('12.0'))
    accrued_days = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal('12.0'))
    used_days = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal('0.0'))

    class Meta:
        db_table = 'hms_leave_balances'
        unique_together = ('staff', 'fiscal_year', 'leave_type')

    @property
    def remaining_days(self):
        return max(Decimal('0.0'), self.allocated_days - self.used_days)


class HospitalHoliday(BaseUUIDModel):
    """
    Hospital official annual calendar holidays.
    """
    name = models.CharField(max_length=120)
    date = models.DateField(db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, null=True, blank=True, related_name='holidays')
    is_mandatory = models.BooleanField(default=True)

    class Meta:
        db_table = 'hms_hospital_holidays'
        ordering = ['date']

    def __str__(self):
        return f"{self.name} ({self.date})"


# =============================================================================
# 4. PAYROLL & GENERAL LEDGER INTEGRATION MODELS
# =============================================================================

class SalaryStructure(BaseUUIDModel):
    """
    Staff Compensation Bands, Allowances, and Statutory Deductions.
    Formula: Gross = Basic + HRA + Special + Medical + Conveyance
             Net = Gross - PF - PT - TDS - ESI
    """
    staff = models.OneToOneField(StaffProfile, on_delete=models.CASCADE, related_name='salary_structure')
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    house_rent_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    special_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    conveyance_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    medical_allowance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    
    # Deductions
    provident_fund_deduction = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    professional_tax = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('200.00'))
    income_tax_tds = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    esi_deduction = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'hms_salary_structures'

    @property
    def gross_salary(self):
        return (
            self.basic_salary +
            self.house_rent_allowance +
            self.special_allowance +
            self.conveyance_allowance +
            self.medical_allowance
        )

    @property
    def total_deductions(self):
        return (
            self.provident_fund_deduction +
            self.professional_tax +
            self.income_tax_tds +
            self.esi_deduction
        )

    @property
    def net_salary(self):
        return self.gross_salary - self.total_deductions


class PayrollWorkflowStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft Prepared'
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Executive Approval'
    APPROVED = 'APPROVED', 'Approved by Finance / HR'
    POSTED_GL = 'POSTED_GL', 'Posted to General Ledger'
    PAID = 'PAID', 'Fully Disbursed / Paid'
    CANCELLED = 'CANCELLED', 'Cancelled / Rejected'


class PayrollPeriod(BaseUUIDModel):
    """
    Monthly Hospital Payroll Cycle with full audit lifecycle, separation of duties,
    and automatic double-entry General Ledger posting.
    """
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='payroll_runs')
    month = models.PositiveIntegerField()  # 1-12
    year = models.PositiveIntegerField()   # e.g. 2026
    status = models.CharField(max_length=30, choices=PayrollWorkflowStatus.choices, default=PayrollWorkflowStatus.DRAFT)
    
    total_gross = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_deductions = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_disbursed = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    
    # Audit & Approval Workflow
    prepared_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='prepared_payrolls')
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_payrolls')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    
    # General Ledger & Treasury Linking
    is_processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True)
    
    # References to billing_finance
    journal_entry_id = models.UUIDField(null=True, blank=True)
    disbursing_account_id = models.UUIDField(null=True, blank=True)
    financial_transaction_id = models.UUIDField(null=True, blank=True)

    class Meta:
        db_table = 'hms_payroll_periods'
        unique_together = ('branch', 'month', 'year')
        ordering = ['-year', '-month']

    @property
    def workflow_status(self):
        return self.status

    def __str__(self):
        return f"Payroll {self.month:02d}/{self.year} - {self.branch.name} [{self.status}]"


class Payslip(BaseUUIDModel):
    """
    Individual Monthly Staff Payslips with earning/deduction line breakdowns.
    """
    payroll_period = models.ForeignKey(PayrollPeriod, on_delete=models.CASCADE, related_name='payslips')
    staff = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='payslips')
    payslip_number = models.CharField(max_length=60, default='', db_index=True)
    
    basic_pay = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    overtime_pay = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    bonus_incentive = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    gross_pay = models.DecimalField(max_digits=12, decimal_places=2)
    deductions = models.DecimalField(max_digits=12, decimal_places=2)
    net_pay = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Detailed line breakdown for PDF payslip rendering
    allowances_breakdown = models.JSONField(default=dict, blank=True)
    deductions_breakdown = models.JSONField(default=dict, blank=True)
    
    payment_status = models.CharField(max_length=20, default='UNPAID')  # UNPAID, PAID, HOLD
    payment_date = models.DateField(default=timezone.now)
    payment_method = models.CharField(max_length=50, default='NEFT_BANK_TRANSFER')
    payment_reference = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'hms_payslips'
        unique_together = ('payroll_period', 'staff')
        ordering = ['-payroll_period__year', '-payroll_period__month']

    def __str__(self):
        return f"Payslip [{self.payslip_number}] - {self.staff.user_profile.full_name} ({self.net_pay})"


# =============================================================================
# 5. FIXED ASSET REGISTER & DEPRECIATION MODELS
# =============================================================================

class AssetCategoryEnum(models.TextChoices):
    MEDICAL_EQUIPMENT = 'MEDICAL_EQUIPMENT', 'Biomedical & Diagnostic Machinery'
    SURGICAL = 'SURGICAL', 'OT & Surgical Equipment'
    IT_HARDWARE = 'IT_HARDWARE', 'IT, Computers & Servers'
    FURNITURE = 'FURNITURE', 'Hospital Beds & Furniture'
    VEHICLE = 'VEHICLE', 'Ambulances & Transport Fleet'
    FACILITY = 'FACILITY', 'HVAC, Generators & Plant Infrastructure'


class DepreciationMethod(models.TextChoices):
    STRAIGHT_LINE = 'STRAIGHT_LINE', 'Straight-Line Depreciation (SLM)'
    WRITTEN_DOWN_VALUE = 'WRITTEN_DOWN_VALUE', 'Written Down Value (WDV)'
    NONE = 'NONE', 'Non-Depreciating Asset'


class FixedAsset(BaseUUIDModel):
    """
    Hospital Capital Assets Register with warranty, custodian, carrying value,
    and depreciation schedules.
    """
    asset_code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=30, choices=AssetCategoryEnum.choices)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='fixed_assets')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='fixed_assets')
    physical_location = models.CharField(max_length=150, blank=True)
    custodian = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='custodian_assets')
    
    # Financial Purchase Values
    purchase_date = models.DateField()
    purchase_cost = models.DecimalField(max_digits=14, decimal_places=2)
    supplier_name = models.CharField(max_length=150, blank=True)
    invoice_reference = models.CharField(max_length=100, blank=True)
    
    # Depreciation Settings
    useful_life_years = models.PositiveIntegerField(default=7)
    depreciation_method = models.CharField(max_length=30, choices=DepreciationMethod.choices, default=DepreciationMethod.STRAIGHT_LINE)
    residual_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    accumulated_depreciation = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    current_carrying_value = models.DecimalField(max_digits=14, decimal_places=2)
    
    # Operational & Warranty
    serial_number = models.CharField(max_length=100, blank=True)
    warranty_expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, default='OPERATIONAL')  # OPERATIONAL, MAINTENANCE, DECOMMISSIONED, DISPOSED
    
    # Disposal
    disposal_date = models.DateField(null=True, blank=True)
    disposal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    disposal_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_fixed_assets'
        ordering = ['asset_code']

    def calculate_annual_depreciation(self):
        if self.depreciation_method == DepreciationMethod.STRAIGHT_LINE and self.useful_life_years > 0:
            depreciable_base = max(Decimal('0.00'), self.purchase_cost - self.residual_value)
            return round(depreciable_base / Decimal(str(self.useful_life_years)), 2)
        return Decimal('0.00')

    def __str__(self):
        return f"[{self.asset_code}] {self.name} - ₹{self.current_carrying_value}"


class AssetDepreciationSchedule(BaseUUIDModel):
    """
    Periodic Depreciation Logs linked with General Ledger vouchers.
    Debit Account 5060 (Depreciation Expense), Credit Account 1080 (Accumulated Depreciation).
    """
    asset = models.ForeignKey(FixedAsset, on_delete=models.CASCADE, related_name='depreciation_schedules')
    fiscal_year = models.CharField(max_length=20, default='2026-2027')
    financial_period = models.CharField(max_length=50, default='ANNUAL')
    depreciation_amount = models.DecimalField(max_digits=12, decimal_places=2)
    carrying_value_before = models.DecimalField(max_digits=14, decimal_places=2)
    carrying_value_after = models.DecimalField(max_digits=14, decimal_places=2)
    is_posted_gl = models.BooleanField(default=False)
    journal_entry_id = models.UUIDField(null=True, blank=True)
    posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_asset_depreciation_schedules'
        ordering = ['-created_at']


class EquipmentMaintenanceTask(BaseUUIDModel):
    """
    Biomedical Equipment Maintenance, Breakdowns, Calibrations, and Clinical Safety Clearances.
    """
    MAINTENANCE_TYPES = [
        ('PREVENTIVE', 'Periodic Preventive Maintenance (PPM)'),
        ('BREAKDOWN', 'Corrective / Breakdown Repair'),
        ('CALIBRATION', 'Precision Clinical Calibration'),
        ('SAFETY_INSPECTION', 'Electrical & Radiation Safety Audit'),
    ]
    PRIORITIES = [
        ('LOW', 'Low - Planned Routine'),
        ('MEDIUM', 'Medium - Upcoming Window'),
        ('HIGH', 'High - Degrading Performance'),
        ('CRITICAL', 'Critical - Machine Out of Service'),
    ]
    asset = models.ForeignKey(FixedAsset, on_delete=models.CASCADE, related_name='maintenance_tasks')
    maintenance_type = models.CharField(max_length=30, choices=MAINTENANCE_TYPES, default='PREVENTIVE')
    priority = models.CharField(max_length=20, choices=PRIORITIES, default='MEDIUM')
    scheduled_date = models.DateField()
    completion_date = models.DateField(null=True, blank=True)
    technician_vendor = models.CharField(max_length=150)
    service_provider = models.CharField(max_length=150, blank=True)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    findings = models.TextField(blank=True)
    action_taken = models.TextField(blank=True)
    clinical_safety_certified = models.BooleanField(default=False)
    certified_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='certified_equipment')
    operational_status_after = models.CharField(max_length=30, default='OPERATIONAL')
    next_service_due = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'hms_equipment_maintenance_tasks'
        ordering = ['-scheduled_date']


# =============================================================================
# 6. OPERATION THEATRE (OT) & ICU WORKFLOW MODELS
# =============================================================================

class OperatingTheatreSuite(BaseUUIDModel):
    """
    Hospital Surgical Operating Rooms / Theatres.
    """
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='ot_suites')
    name = models.CharField(max_length=100)
    room_number = models.CharField(max_length=30)
    suite_type = models.CharField(max_length=50, default='MAJOR_OT')  # MAJOR_OT, MINOR_OT, CARDIAC_CATH, OPHTHALMIC
    is_operational = models.BooleanField(default=True)
    equipment_summary = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_ot_suites'
        unique_together = ('branch', 'room_number')

    def __str__(self):
        return f"{self.name} (Room {self.room_number}) - {self.branch.name}"


class OperationTheatreBooking(BaseUUIDModel):
    """
    Operation Theatre Procedure Bookings with conflict prevention and team staffing.
    """
    BOOKING_STATUS = [
        ('SCHEDULED', 'Scheduled'),
        ('IN_PROGRESS', 'Procedure in Progress'),
        ('RECOVERY', 'Post-Op Recovery / PACU'),
        ('COMPLETED', 'Surgery Completed'),
        ('CANCELLED', 'Cancelled'),
        ('RESCHEDULED', 'Rescheduled'),
    ]
    booking_code = models.CharField(max_length=50, unique=True, db_index=True)
    theatre = models.ForeignKey(OperatingTheatreSuite, on_delete=models.PROTECT, related_name='bookings')
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='ot_bookings')
    procedure_name = models.CharField(max_length=200)
    scheduled_date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    # Surgical Team
    lead_surgeon = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='led_ot_surgeries')
    anesthetist = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='anesthesia_ot_surgeries')
    scrub_nurse = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='nursed_ot_surgeries')
    
    anesthesia_type = models.CharField(max_length=50, default='GENERAL_ANESTHESIA')
    pre_op_checklist_completed = models.BooleanField(default=False)
    status = models.CharField(max_length=25, choices=BOOKING_STATUS, default='SCHEDULED')
    cancellation_reason = models.TextField(blank=True)
    clinical_notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_ot_bookings'
        ordering = ['-scheduled_date', 'start_time']

    def __str__(self):
        return f"[{self.booking_code}] {self.procedure_name} - {self.theatre.name} ({self.scheduled_date})"


class ICUObservationRecord(BaseUUIDModel):
    """
    Continuous ICU Vital Signs & Clinical Observations Recording.
    """
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='icu_observations')
    bed_identifier = models.CharField(max_length=50)  # e.g. "ICU-Bed-04"
    observation_time = models.DateTimeField(default=timezone.now, db_index=True)
    recorded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='recorded_icu_observations')
    
    # Hemodynamic Vitals
    bp_systolic = models.PositiveIntegerField(null=True, blank=True)
    bp_diastolic = models.PositiveIntegerField(null=True, blank=True)
    heart_rate = models.PositiveIntegerField(null=True, blank=True)
    respiratory_rate = models.PositiveIntegerField(null=True, blank=True)
    spo2_percentage = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    temperature_celsius = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    
    # Neurological & Respiratory Support
    gcs_score = models.PositiveIntegerField(null=True, blank=True)  # Glasgow Coma Scale 3-15
    ventilator_mode = models.CharField(max_length=50, blank=True)   # SIMV, CPAP, BiPAP, Invasive
    fio2_percentage = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    urine_output_ml = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    
    clinical_notes = models.TextField(blank=True)
    escalation_status = models.CharField(max_length=30, default='STABLE')  # STABLE, WATCH, CRITICAL_ESCALATION
    escalation_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_icu_observations')

    class Meta:
        db_table = 'hms_icu_observations'
        ordering = ['-observation_time']


# =============================================================================
# 7. AMBULANCE FLEET & DISPATCH MANAGEMENT MODELS
# =============================================================================

class AmbulanceType(models.TextChoices):
    ALS = 'ADVANCED_LIFE_SUPPORT', 'Advanced Life Support (ALS ICU Ambulance)'
    BLS = 'BASIC_LIFE_SUPPORT', 'Basic Life Support (BLS)'
    PATIENT_TRANSPORT = 'PATIENT_TRANSPORT', 'Non-Emergency Patient Transport'


class AmbulanceStatus(models.TextChoices):
    AVAILABLE = 'AVAILABLE', 'Available at Base'
    ASSIGNED = 'ASSIGNED', 'Assigned to Request'
    DISPATCHED = 'DISPATCHED', 'Dispatched / En Route'
    ON_TRIP = 'ON_TRIP', 'Patient Onboard'
    MAINTENANCE = 'MAINTENANCE', 'Under Fleet Maintenance'
    UNAVAILABLE = 'UNAVAILABLE', 'Unavailable / Off-Duty'


class Ambulance(BaseUUIDModel):
    """
    Hospital Emergency Ambulance Fleet Registers.
    """
    registration_number = models.CharField(max_length=30, unique=True, db_index=True)
    vehicle_type = models.CharField(max_length=40, choices=AmbulanceType.choices, default=AmbulanceType.ALS)
    status = models.CharField(max_length=30, choices=AmbulanceStatus.choices, default=AmbulanceStatus.AVAILABLE)
    base_branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='ambulances')
    assigned_driver = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='driven_ambulances')
    assigned_paramedic = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='crewed_ambulances')
    fuel_level_pct = models.PositiveIntegerField(default=100)
    odo_reading_km = models.PositiveIntegerField(default=12000)
    last_maintenance_date = models.DateField(null=True, blank=True)
    equipment_checklist = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'hms_ambulances'
        ordering = ['registration_number']

    def __str__(self):
        return f"{self.registration_number} ({self.get_vehicle_type_display()}) - {self.status}"


class AmbulanceDispatch(BaseUUIDModel):
    """
    Emergency Dispatch Requests, Trip Tracking, Mileage, and Transfer Records.
    """
    TRIP_STATUS = [
        ('DISPATCHED', 'Dispatched'),
        ('EN_ROUTE_PICKUP', 'En Route to Pickup'),
        ('PATIENT_ONBOARD', 'Patient Picked Up'),
        ('ARRIVED_HOSPITAL', 'Arrived at Hospital ER'),
        ('COMPLETED', 'Trip Completed'),
        ('CANCELLED', 'Cancelled'),
    ]
    dispatch_number = models.CharField(max_length=50, unique=True, db_index=True)
    ambulance = models.ForeignKey(Ambulance, on_delete=models.PROTECT, related_name='dispatches')
    patient = models.ForeignKey(PatientProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='ambulance_trips')
    patient_name_unregistered = models.CharField(max_length=150, blank=True)
    pickup_location = models.CharField(max_length=255)
    destination = models.CharField(max_length=255, default='Main Emergency Trauma Centre')
    request_time = models.DateTimeField(default=timezone.now)
    dispatch_time = models.DateTimeField(null=True, blank=True)
    pickup_arrival_time = models.DateTimeField(null=True, blank=True)
    return_time = models.DateTimeField(null=True, blank=True)
    trip_status = models.CharField(max_length=30, choices=TRIP_STATUS, default='DISPATCHED')
    distance_km = models.DecimalField(max_digits=6, decimal_places=1, default=Decimal('0.0'))
    fuel_consumed_liters = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal('0.0'))
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_ambulance_dispatches'
        ordering = ['-request_time']


# =============================================================================
# 8. BLOOD BANK INVENTORY & TRACEABILITY MODELS
# =============================================================================

class BloodGroup(models.TextChoices):
    A_POS = 'A+', 'A Positive (A+)'
    A_NEG = 'A-', 'A Negative (A-)'
    B_POS = 'B+', 'B Positive (B+)'
    B_NEG = 'B-', 'B Negative (B-)'
    AB_POS = 'AB+', 'AB Positive (AB+)'
    AB_NEG = 'AB-', 'AB Negative (AB-)'
    O_POS = 'O+', 'O Positive (O+)'
    O_NEG = 'O-', 'O Negative (O-)'


class BloodComponentType(models.TextChoices):
    WHOLE_BLOOD = 'WHOLE_BLOOD', 'Whole Blood'
    PRBC = 'PRBC', 'Packed Red Blood Cells (PRBC)'
    FFP = 'FFP', 'Fresh Frozen Plasma (FFP)'
    PLATELETS = 'PLATELETS', 'Random Donor Platelets (RDP)'
    SDP = 'SDP', 'Single Donor Platelets (SDP)'
    CRYOPRECIPITATE = 'CRYOPRECIPITATE', 'Cryoprecipitate'


class BloodBagStatus(models.TextChoices):
    AVAILABLE = 'AVAILABLE', 'Available for Issue'
    RESERVED = 'RESERVED', 'Cross-Matched & Reserved'
    ISSUED = 'ISSUED', 'Transfused / Issued to Ward'
    EXPIRED = 'EXPIRED', 'Expired / Disposed'
    QUARANTINED = 'QUARANTINED', 'Quarantined / Testing'


class BloodBankStock(BaseUUIDModel):
    """
    Blood Bank Units, Component Segregation, Serological Screening, and Cross-Match Records.
    Strict enforcement: Expired or unverified units can never be reserved or issued.
    """
    bag_barcode = models.CharField(max_length=50, unique=True, db_index=True)
    blood_group = models.CharField(max_length=10, choices=BloodGroup.choices)
    component_type = models.CharField(max_length=30, choices=BloodComponentType.choices, default=BloodComponentType.PRBC)
    volume_ml = models.PositiveIntegerField(default=350)
    collection_date = models.DateField()
    expiry_date = models.DateField(db_index=True)
    storage_unit = models.CharField(max_length=60, default='Blood-Bank-Fridge-1')
    screening_status = models.CharField(max_length=30, default='PASSED')  # PASSED, TESTING_PENDING, REJECTED
    status = models.CharField(max_length=30, choices=BloodBagStatus.choices, default=BloodBagStatus.AVAILABLE)
    
    # Reservation and Clinical Issuance
    reserved_for_patient = models.ForeignKey(PatientProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='reserved_blood_units')
    issued_to_dept = models.CharField(max_length=100, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    issued_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='issued_blood_units')

    class Meta:
        db_table = 'hms_blood_bank_stock'
        ordering = ['expiry_date']

    def is_expired(self):
        return timezone.localdate() > self.expiry_date

    def __str__(self):
        return f"[{self.bag_barcode}] {self.blood_group} {self.component_type} (Exp: {self.expiry_date})"


# =============================================================================
# 9. HOUSEKEEPING & SANITIZATION MODELS
# =============================================================================

class HousekeepingTaskType(models.TextChoices):
    ROUTINE_CLEANING = 'ROUTINE_CLEANING', 'Daily Routine Ward Cleaning'
    TERMINAL_DISINFECTION = 'TERMINAL_DISINFECTION', 'Terminal Post-Discharge Disinfection'
    BIOHAZARD_SPILL = 'BIOHAZARD_SPILL', 'Biohazard Chemical / Blood Spill'
    LINEN_CHANGE = 'LINEN_CHANGE', 'Bed Linen Replacement'
    SANITIZATION = 'SANITIZATION', 'ICU / OT Intensive Sanitization'


class HousekeepingTaskStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Assignment'
    IN_PROGRESS = 'IN_PROGRESS', 'Cleaning in Progress'
    COMPLETED = 'COMPLETED', 'Completed by Staff'
    INSPECTED = 'INSPECTED', 'Inspected & Verified'
    OVERDUE = 'OVERDUE', 'Overdue Task'


class HousekeepingTask(BaseUUIDModel):
    """
    Facility Sanitation, Ward Cleanliness Tasks, and Supervisor Quality Audits.
    """
    task_code = models.CharField(max_length=50, unique=True, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='housekeeping_tasks')
    floor = models.CharField(max_length=50, default='2nd Floor')
    room_area = models.CharField(max_length=100)  # e.g. "ICU Bay 4", "OT Room 1", "Emergency Triage"
    task_type = models.CharField(max_length=40, choices=HousekeepingTaskType.choices, default=HousekeepingTaskType.ROUTINE_CLEANING)
    priority = models.CharField(max_length=20, default='MEDIUM')  # LOW, MEDIUM, HIGH, CRITICAL
    assigned_staff = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_housekeeping_tasks')
    scheduled_time = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=HousekeepingTaskStatus.choices, default=HousekeepingTaskStatus.PENDING)
    inspection_notes = models.TextField(blank=True)
    inspected_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='inspected_housekeeping_tasks')
    checklist_items = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'hms_housekeeping_tasks'
        ordering = ['-scheduled_time']

    def __str__(self):
        return f"[{self.task_code}] {self.room_area} ({self.task_type}) - {self.status}"


# =============================================================================
# 10. BIOMEDICAL WASTE TRACKING MODELS
# =============================================================================

class WasteCategory(models.TextChoices):
    YELLOW = 'YELLOW_ANATOMICAL', 'Yellow - Anatomical / Soiled / Expired Medicines'
    RED = 'RED_CONTAMINATED_PLASTIC', 'Red - Contaminated Recyclable Plastics'
    WHITE = 'WHITE_SHARPS', 'White (Translucent) - Needles & Scalpel Sharps'
    BLUE = 'BLUE_GLASSWARE', 'Blue - Broken Glassware & Cytotoxic Vials'


class WasteStatus(models.TextChoices):
    COLLECTED = 'COLLECTED', 'Collected from Department'
    IN_STORAGE = 'IN_STORAGE', 'Stored in Central Waste Room'
    HANDED_OVER = 'HANDED_OVER', 'Handed Over to Authorized CBMWTF Agency'
    DISPOSED = 'DISPOSED', 'Disposal Confirmed'


class BiomedicalWasteRecord(BaseUUIDModel):
    """
    Hospital Biomedical Waste Segregation, Weighing, Storage, and Manifest Handover Tracking.
    """
    manifest_code = models.CharField(max_length=50, unique=True, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='biomedical_waste_records')
    generating_department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name='waste_records')
    waste_category = models.CharField(max_length=40, choices=WasteCategory.choices)
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2)
    container_barcode = models.CharField(max_length=60, blank=True)
    collection_time = models.DateTimeField(default=timezone.now)
    collected_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='collected_waste_records')
    storage_area = models.CharField(max_length=100, default='Central Biohazard Storage')
    
    # Handover to Common Bio-Medical Waste Treatment Facility (CBMWTF)
    disposal_agency_name = models.CharField(max_length=150, default='State Bio-Clean Eco Solutions')
    vehicle_number = models.CharField(max_length=30, blank=True)
    handover_time = models.DateTimeField(null=True, blank=True)
    handover_officer = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='handed_over_waste_records')
    agency_receipt_number = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=30, choices=WasteStatus.choices, default=WasteStatus.COLLECTED)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_biomedical_waste_records'
        ordering = ['-collection_time']

    def __str__(self):
        return f"[{self.manifest_code}] {self.waste_category} ({self.weight_kg} kg) - {self.status}"


# =============================================================================
# 11. SYSTEM SETTINGS (PRESERVED)
# =============================================================================

class HospitalSetting(BaseUUIDModel):
    """
    Dynamic Hospital System Configurations, Numbering Sequences, and Operating Hours.
    """
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name='settings')
    setting_key = models.CharField(max_length=100, db_index=True)
    setting_value = models.TextField()
    description = models.CharField(max_length=250, blank=True)

    class Meta:
        db_table = 'hms_system_settings'
        unique_together = ('hospital', 'setting_key')

    def __str__(self):
        return f"{self.setting_key}: {self.setting_value}"
