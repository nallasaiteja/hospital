from rest_framework import serializers
from apps.core.models import AuditLog
from apps.authentication.models import StaffProfile, UserProfile
from .models import (
    EmployeeAttendance, LeaveRequest, SalaryStructure,
    PayrollPeriod, Payslip, HospitalSetting, EmployeeDetail,
    EmployeeDocument, HospitalShift, ShiftRosterAssignment,
    LeaveBalance, HospitalHoliday, FixedAsset, AssetDepreciationSchedule,
    EquipmentMaintenanceTask, OperatingTheatreSuite, OperationTheatreBooking,
    ICUObservationRecord, Ambulance, AmbulanceDispatch, BloodBankStock,
    HousekeepingTask, BiomedicalWasteRecord
)


# =============================================================================
# 1. EMPLOYEE & HR SERIALIZERS
# =============================================================================

class EmployeeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeDocument
        fields = '__all__'


class EmployeeDetailSerializer(serializers.ModelSerializer):
    reporting_manager_name = serializers.CharField(source='reporting_manager.user_profile.full_name', read_only=True)

    class Meta:
        model = EmployeeDetail
        fields = '__all__'


class StaffProfileFullSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user_profile.full_name', read_only=True)
    email = serializers.CharField(source='user_profile.email', read_only=True)
    phone_number = serializers.CharField(source='user_profile.phone_number', read_only=True)
    role_name = serializers.CharField(source='user_profile.role.display_name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    employee_detail = EmployeeDetailSerializer(read_only=True)
    employee_documents = EmployeeDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = StaffProfile
        fields = [
            'id', 'employee_id', 'full_name', 'email', 'phone_number', 'role_name',
            'designation', 'specialization', 'qualification', 'medical_license_number',
            'department', 'department_name', 'branch', 'branch_name', 'status',
            'is_on_duty', 'joining_date', 'employee_detail', 'employee_documents',
            'created_at', 'updated_at'
        ]


# =============================================================================
# 2. SHIFTS, ROSTERS & ATTENDANCE SERIALIZERS
# =============================================================================

class HospitalShiftSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = HospitalShift
        fields = '__all__'


class ShiftRosterAssignmentSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.user_profile.full_name', read_only=True)
    employee_id = serializers.CharField(source='staff.employee_id', read_only=True)
    shift_name = serializers.CharField(source='shift.name', read_only=True)
    shift_start = serializers.TimeField(source='shift.start_time', read_only=True)
    shift_end = serializers.TimeField(source='shift.end_time', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = ShiftRosterAssignment
        fields = '__all__'


class EmployeeAttendanceSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.user_profile.full_name', read_only=True)
    employee_id = serializers.CharField(source='staff.employee_id', read_only=True)
    designation = serializers.CharField(source='staff.designation', read_only=True)
    shift_name = serializers.CharField(source='shift.name', read_only=True)

    class Meta:
        model = EmployeeAttendance
        fields = '__all__'


# =============================================================================
# 3. LEAVE SERIALIZERS
# =============================================================================

class LeaveBalanceSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.user_profile.full_name', read_only=True)
    employee_id = serializers.CharField(source='staff.employee_id', read_only=True)
    remaining_days = serializers.DecimalField(max_digits=5, decimal_places=1, read_only=True)

    class Meta:
        model = LeaveBalance
        fields = '__all__'


class HospitalHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = HospitalHoliday
        fields = '__all__'


class LeaveRequestSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.user_profile.full_name', read_only=True)
    employee_id = serializers.CharField(source='staff.employee_id', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = '__all__'


# =============================================================================
# 4. PAYROLL SERIALIZERS
# =============================================================================

class SalaryStructureSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.user_profile.full_name', read_only=True)
    employee_id = serializers.CharField(source='staff.employee_id', read_only=True)
    gross_salary = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_deductions = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    net_salary = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SalaryStructure
        fields = '__all__'


class PayslipSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.user_profile.full_name', read_only=True)
    employee_id = serializers.CharField(source='staff.employee_id', read_only=True)
    designation = serializers.CharField(source='staff.designation', read_only=True)

    class Meta:
        model = Payslip
        fields = '__all__'


class PayrollPeriodSerializer(serializers.ModelSerializer):
    payslips = PayslipSerializer(many=True, read_only=True)
    prepared_by_name = serializers.CharField(source='prepared_by.user_profile.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = PayrollPeriod
        fields = '__all__'


# =============================================================================
# 5. ASSET & MAINTENANCE SERIALIZERS
# =============================================================================

class FixedAssetSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    custodian_name = serializers.CharField(source='custodian.user_profile.full_name', read_only=True)
    annual_depreciation = serializers.SerializerMethodField()

    class Meta:
        model = FixedAsset
        fields = '__all__'

    def get_annual_depreciation(self, obj):
        return obj.calculate_annual_depreciation()


class AssetDepreciationScheduleSerializer(serializers.ModelSerializer):
    asset_code = serializers.CharField(source='asset.asset_code', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True)

    class Meta:
        model = AssetDepreciationSchedule
        fields = '__all__'


class EquipmentMaintenanceTaskSerializer(serializers.ModelSerializer):
    asset_code = serializers.CharField(source='asset.asset_code', read_only=True)
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    certified_by_name = serializers.CharField(source='certified_by.user_profile.full_name', read_only=True)

    class Meta:
        model = EquipmentMaintenanceTask
        fields = '__all__'


# =============================================================================
# 6. OT & ICU SERIALIZERS
# =============================================================================

class OperatingTheatreSuiteSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = OperatingTheatreSuite
        fields = '__all__'


class OperationTheatreBookingSerializer(serializers.ModelSerializer):
    theatre_name = serializers.CharField(source='theatre.name', read_only=True)
    room_number = serializers.CharField(source='theatre.room_number', read_only=True)
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    lead_surgeon_name = serializers.CharField(source='lead_surgeon.user_profile.full_name', read_only=True)
    anesthetist_name = serializers.CharField(source='anesthetist.user_profile.full_name', read_only=True)
    scrub_nurse_name = serializers.CharField(source='scrub_nurse.user_profile.full_name', read_only=True)

    class Meta:
        model = OperationTheatreBooking
        fields = '__all__'


class ICUObservationRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.user_profile.full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.user_profile.full_name', read_only=True)

    class Meta:
        model = ICUObservationRecord
        fields = '__all__'


# =============================================================================
# 7. AMBULANCE SERIALIZERS
# =============================================================================

class AmbulanceSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='assigned_driver.user_profile.full_name', read_only=True)
    paramedic_name = serializers.CharField(source='assigned_paramedic.user_profile.full_name', read_only=True)
    base_branch_name = serializers.CharField(source='base_branch.name', read_only=True)

    class Meta:
        model = Ambulance
        fields = '__all__'


class AmbulanceDispatchSerializer(serializers.ModelSerializer):
    registration_number = serializers.CharField(source='ambulance.registration_number', read_only=True)
    vehicle_type = serializers.CharField(source='ambulance.vehicle_type', read_only=True)
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)

    class Meta:
        model = AmbulanceDispatch
        fields = '__all__'


# =============================================================================
# 8. BLOOD BANK SERIALIZERS
# =============================================================================

class BloodBankStockSerializer(serializers.ModelSerializer):
    is_expired = serializers.SerializerMethodField()
    reserved_for_patient_name = serializers.CharField(source='reserved_for_patient.user_profile.full_name', read_only=True)

    class Meta:
        model = BloodBankStock
        fields = '__all__'

    def get_is_expired(self, obj):
        return obj.is_expired()


# =============================================================================
# 9. HOUSEKEEPING & BIOMEDICAL WASTE SERIALIZERS
# =============================================================================

class HousekeepingTaskSerializer(serializers.ModelSerializer):
    assigned_staff_name = serializers.CharField(source='assigned_staff.user_profile.full_name', read_only=True)
    inspected_by_name = serializers.CharField(source='inspected_by.user_profile.full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = HousekeepingTask
        fields = '__all__'


class BiomedicalWasteRecordSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='generating_department.name', read_only=True)
    collected_by_name = serializers.CharField(source='collected_by.user_profile.full_name', read_only=True)
    handover_officer_name = serializers.CharField(source='handover_officer.user_profile.full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = BiomedicalWasteRecord
        fields = '__all__'


# =============================================================================
# 10. SYSTEM SETTINGS & AUDIT LOGS
# =============================================================================

class HospitalSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = HospitalSetting
        fields = '__all__'


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'
