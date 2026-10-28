from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from rest_framework import status, views, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied

from apps.authentication.permissions import IsStaffMember, IsSuperAdmin, IsHRPayrollStaff, resolve_user_profile
from apps.core.models import Branch, Hospital, Department, AuditLog
from apps.authentication.models import StaffProfile, PatientProfile, UserProfile, RoleEnum
from apps.authentication.utils import get_staff_profile
from apps.clinical.models import Appointment, EmergencyEncounter, Bed, InpatientAdmission
from apps.pharmacy_inventory.models import Medicine, MedicineBatch
from apps.billing_finance.models import Invoice, Payment

from .models import (
    EmployeeDetail, EmployeeDocument, HospitalShift, ShiftRosterAssignment,
    EmployeeAttendance, AttendanceStatus, LeaveRequest, LeaveStatus, LeaveType,
    LeaveBalance, HospitalHoliday, SalaryStructure, PayrollPeriod, Payslip,
    PayrollWorkflowStatus, FixedAsset, AssetDepreciationSchedule,
    EquipmentMaintenanceTask, OperatingTheatreSuite, OperationTheatreBooking,
    ICUObservationRecord, Ambulance, AmbulanceDispatch, AmbulanceStatus,
    BloodBankStock, BloodBagStatus, HousekeepingTask, HousekeepingTaskStatus,
    BiomedicalWasteRecord, WasteStatus, HospitalSetting
)
from .serializers import (
    StaffProfileFullSerializer, EmployeeDetailSerializer, EmployeeDocumentSerializer,
    HospitalShiftSerializer, ShiftRosterAssignmentSerializer,
    EmployeeAttendanceSerializer, LeaveRequestSerializer, LeaveBalanceSerializer,
    HospitalHolidaySerializer, SalaryStructureSerializer, PayrollPeriodSerializer,
    PayslipSerializer, FixedAssetSerializer, AssetDepreciationScheduleSerializer,
    EquipmentMaintenanceTaskSerializer, OperatingTheatreSuiteSerializer,
    OperationTheatreBookingSerializer, ICUObservationRecordSerializer,
    AmbulanceSerializer, AmbulanceDispatchSerializer, BloodBankStockSerializer,
    HousekeepingTaskSerializer, BiomedicalWasteRecordSerializer,
    HospitalSettingSerializer, AuditLogSerializer
)
from .hr_operations_service import HROperationsService


# =============================================================================
# 1. EMPLOYEE & HR MANAGEMENT VIEWSETS
# =============================================================================

class StaffManagementViewSet(viewsets.ModelViewSet):
    """
    CRUD, search, filtering, and onboarding for hospital employees.
    """
    serializer_class = StaffProfileFullSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = StaffProfile.objects.select_related(
            'user_profile', 'department', 'branch', 'employee_detail', 'salary_structure'
        ).prefetch_related('employee_documents').order_by('-created_at')

        branch_id = self.request.query_params.get('branch_id')
        dept_id = self.request.query_params.get('department_id')
        status_filter = self.request.query_params.get('status')
        search = self.request.query_params.get('search')

        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(
                models.Q(employee_id__icontains=search) |
                models.Q(user_profile__full_name__icontains=search) |
                models.Q(user_profile__email__icontains=search) |
                models.Q(designation__icontains=search)
            )
        return qs

    def create(self, request, *args, **kwargs):
        """
        Onboard a new employee with user profile, staff profile, detail, and initial salary structure.
        """
        try:
            profile = HROperationsService.onboard_employee(
                data=request.data,
                actor_user=request.user
            )
            return Response(StaffProfileFullSerializer(profile).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='separate')
    def separate_employee(self, request, pk=None):
        """
        Record employee resignation/termination/retirement with handover details.
        """
        staff = self.get_object()
        data = request.data
        try:
            detail, _ = EmployeeDetail.objects.get_or_create(staff=staff)
            detail.separation_status = data.get('separation_status', 'RESIGNED')
            detail.resignation_date = data.get('resignation_date', timezone.localdate())
            detail.last_working_date = data.get('last_working_date', timezone.localdate())
            detail.exit_interview_notes = data.get('exit_interview_notes', '')
            detail.clearance_status = data.get('clearance_status', 'PENDING')
            detail.save()

            staff.status = 'INACTIVE'
            staff.is_on_duty = False
            staff.save()

            return Response({'message': f'Employee {staff.employee_id} separation recorded successfully.'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='upload-document')
    def upload_document(self, request, pk=None):
        staff = self.get_object()
        data = request.data
        doc = EmployeeDocument.objects.create(
            staff=staff,
            document_type=data.get('document_type', 'RESUME'),
            title=data.get('title', 'Document'),
            document_url=data.get('document_url', ''),
            file_name=data.get('file_name', ''),
            file_size_bytes=data.get('file_size_bytes', 0),
            mime_type=data.get('mime_type', 'application/pdf'),
            is_verified=data.get('is_verified', False),
            verified_by=get_staff_profile(request.user) if data.get('is_verified') else None
        )
        return Response(EmployeeDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


# =============================================================================
# 2. SHIFTS, ROSTERS & ATTENDANCE VIEWSETS
# =============================================================================

class HospitalShiftViewSet(viewsets.ModelViewSet):
    serializer_class = HospitalShiftSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]
    queryset = HospitalShift.objects.select_related('branch', 'department').all().order_by('name')

    def get_queryset(self):
        qs = super().get_queryset()
        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs


class ShiftRosterAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = ShiftRosterAssignmentSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = ShiftRosterAssignment.objects.select_related(
            'staff__user_profile', 'shift', 'branch', 'department'
        ).order_by('-roster_date')
        branch_id = self.request.query_params.get('branch_id')
        dept_id = self.request.query_params.get('department_id')
        staff_id = self.request.query_params.get('staff_id')
        date_str = self.request.query_params.get('date') or self.request.query_params.get('roster_date')
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')

        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        if staff_id:
            qs = qs.filter(staff_id=staff_id)
        if date_str:
            qs = qs.filter(roster_date=date_str)
        if from_date and to_date:
            qs = qs.filter(roster_date__range=[from_date, to_date])
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        staff_id = data.get('staff') or data.get('staff_id')
        date = data.get('roster_date') or data.get('date')
        shift_id = data.get('shift') or data.get('shift_id')

        # Conflict prevention: prevent double shift assignment for same employee on same date unless explicitly permitted
        existing = ShiftRosterAssignment.objects.filter(staff_id=staff_id, roster_date=date).first()
        if existing and str(existing.shift_id) == str(shift_id):
            return Response({'error': f'Employee is already assigned to this shift on {date}.'}, status=status.HTTP_400_BAD_REQUEST)

        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='swap-request')
    def swap_request(self, request, pk=None):
        assignment = self.get_object()
        swap_with_id = request.data.get('swap_with_staff_id')
        notes = request.data.get('notes', '')
        assignment.swap_with_staff_id = swap_with_id
        assignment.swap_notes = notes
        assignment.is_swap_requested = True
        assignment.save()
        return Response({'message': 'Shift swap requested successfully.', 'assignment_id': assignment.id})

    @action(detail=True, methods=['post'], url_path='approve-swap')
    def approve_swap(self, request, pk=None):
        assignment = self.get_object()
        if not assignment.is_swap_requested or not assignment.swap_with_staff:
            return Response({'error': 'No pending swap request found.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            old_staff = assignment.staff
            new_staff = assignment.swap_with_staff
            assignment.staff = new_staff
            assignment.is_swap_requested = False
            assignment.swap_notes += f' [Approved by {request.user.email} on {timezone.now()}]'
            assignment.save()

        return Response({'message': f'Shift reassigned to {new_staff.user_profile.full_name}.'})


class EmployeeAttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeAttendanceSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = EmployeeAttendance.objects.select_related(
            'staff__user_profile', 'shift'
        ).order_by('-date', '-clock_in')
        date = self.request.query_params.get('date')
        staff_id = self.request.query_params.get('staff_id')
        branch_id = self.request.query_params.get('branch_id')

        if date:
            qs = qs.filter(date=date)
        if staff_id:
            qs = qs.filter(staff_id=staff_id)
        if branch_id:
            qs = qs.filter(staff__branch_id=branch_id)
        return qs

    @action(detail=False, methods=['post'], url_path='clock')
    def clock(self, request):
        """
        Record clock-in or clock-out for an employee, automatically computing working hours.
        """
        staff_id = request.data.get('staff_id')
        if not staff_id:
            staff = get_staff_profile(request.user)
            staff_id = staff.id if staff else None
        
        if not staff_id:
            return Response({'error': 'Staff ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        action_type = request.data.get('action', 'CLOCK_IN')
        shift_id = request.data.get('shift_id')
        remarks = request.data.get('remarks', '')

        try:
            att = HROperationsService.record_attendance_clock(
                staff_id=staff_id,
                action=action_type,
                shift_id=shift_id,
                remarks=remarks,
                actor_user=request.user
            )
            return Response(EmployeeAttendanceSerializer(att).data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='correct')
    def correct_attendance(self, request, pk=None):
        """
        HR supervisor manual correction of attendance records with mandatory audit trail reason.
        """
        att = self.get_object()
        data = request.data
        reason = data.get('correction_reason')
        if not reason:
            return Response({'error': 'A specific correction reason is mandatory.'}, status=status.HTTP_400_BAD_REQUEST)

        att.correction_reason = reason
        att.corrected_by = get_staff_profile(request.user)
        att.correction_timestamp = timezone.now()

        if 'status' in data:
            att.status = data['status']
        if 'clock_in' in data:
            att.clock_in = data['clock_in']
        if 'clock_out' in data:
            att.clock_out = data['clock_out']
        if 'total_hours' in data:
            att.total_hours = Decimal(str(data['total_hours']))
        if 'overtime_hours' in data:
            att.overtime_hours = Decimal(str(data['overtime_hours']))

        att.save()
        return Response(EmployeeAttendanceSerializer(att).data)


# =============================================================================
# 3. LEAVE MANAGEMENT VIEWSETS
# =============================================================================

class LeaveBalanceViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveBalanceSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = LeaveBalance.objects.select_related('staff__user_profile').all()
        staff_id = self.request.query_params.get('staff_id')
        year = self.request.query_params.get('fiscal_year', timezone.localdate().year)
        if staff_id:
            qs = qs.filter(staff_id=staff_id)
        if year:
            qs = qs.filter(fiscal_year=year)
        return qs


class HospitalHolidayViewSet(viewsets.ModelViewSet):
    serializer_class = HospitalHolidaySerializer
    permission_classes = [IsAuthenticated, IsStaffMember]
    queryset = HospitalHoliday.objects.all().order_by('date')


class LeaveRequestViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = LeaveRequest.objects.select_related(
            'staff__user_profile', 'approved_by__user_profile'
        ).order_by('-created_at')
        branch_id = self.request.query_params.get('branch_id')
        staff_id = self.request.query_params.get('staff_id')
        status_filter = self.request.query_params.get('status')

        if branch_id:
            qs = qs.filter(staff__branch_id=branch_id)
        if staff_id:
            qs = qs.filter(staff_id=staff_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def create(self, request, *args, **kwargs):
        staff_id = request.data.get('staff_id') or request.data.get('staff')
        if not staff_id:
            staff = get_staff_profile(request.user)
            staff_id = staff.id if staff else None

        if not staff_id:
            return Response({'error': 'Staff profile is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            req = HROperationsService.process_leave_application(
                staff_id=staff_id,
                leave_type=request.data.get('leave_type'),
                start_date=request.data.get('start_date'),
                end_date=request.data.get('end_date'),
                reason=request.data.get('reason', ''),
                supporting_document_url=request.data.get('supporting_document_url', ''),
                actor_user=request.user
            )
            return Response(LeaveRequestSerializer(req).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve_leave(self, request, pk=None):
        comments = request.data.get('comments', 'Approved by supervisor')
        try:
            req = HROperationsService.approve_or_reject_leave(
                leave_id=pk,
                approver_user=request.user,
                decision='APPROVED',
                comments=comments
            )
            return Response(LeaveRequestSerializer(req).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject_leave(self, request, pk=None):
        comments = request.data.get('comments', 'Rejected')
        try:
            req = HROperationsService.approve_or_reject_leave(
                leave_id=pk,
                approver_user=request.user,
                decision='REJECTED',
                comments=comments
            )
            return Response(LeaveRequestSerializer(req).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ApproveLeaveView(views.APIView):
    """
    Backwards-compatible endpoint for existing PATCH /leaves/<id>/approve/
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def patch(self, request, pk):
        decision = request.data.get('status', 'APPROVED')
        comments = request.data.get('rejection_reason') or request.data.get('comments', 'Processed')
        try:
            req = HROperationsService.approve_or_reject_leave(
                leave_id=pk,
                approver_user=request.user,
                decision=decision,
                comments=comments
            )
            return Response(LeaveRequestSerializer(req).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# 4. PAYROLL & SALARY APPROVALS VIEWSETS
# =============================================================================

class SalaryStructureViewSet(viewsets.ModelViewSet):
    serializer_class = SalaryStructureSerializer
    permission_classes = [IsAuthenticated, IsStaffMember, IsHRPayrollStaff]
    queryset = SalaryStructure.objects.select_related('staff__user_profile').all()

    def get_queryset(self):
        qs = super().get_queryset()
        staff_id = self.request.query_params.get('staff_id')
        if staff_id:
            qs = qs.filter(staff_id=staff_id)
        return qs


class PayrollPeriodViewSet(viewsets.ModelViewSet):
    serializer_class = PayrollPeriodSerializer
    permission_classes = [IsAuthenticated, IsStaffMember, IsHRPayrollStaff]

    def get_queryset(self):
        return PayrollPeriod.objects.select_related(
            'branch', 'prepared_by__user_profile', 'approved_by__user_profile'
        ).prefetch_related('payslips__staff__user_profile').order_by('-year', '-month')

    def create(self, request, *args, **kwargs):
        """
        Generate a monthly payroll run in DRAFT status.
        """
        branch_id = request.data.get('branch_id')
        branch = Branch.objects.filter(id=branch_id).first() if branch_id else Branch.objects.first()
        if not branch:
            return Response({'error': 'Valid branch is required.'}, status=status.HTTP_400_BAD_REQUEST)

        month = int(request.data.get('month', timezone.localdate().month))
        year = int(request.data.get('year', timezone.localdate().year))

        try:
            period = HROperationsService.generate_monthly_payroll_run(
                branch=branch,
                month=month,
                year=year,
                created_by_user=request.user
            )
            return Response(PayrollPeriodSerializer(period).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='submit-approval')
    def submit_for_approval(self, request, pk=None):
        period = self.get_object()
        if period.workflow_status != PayrollWorkflowStatus.DRAFT:
            return Response({'error': f'Cannot submit payroll in status {period.workflow_status}.'}, status=status.HTTP_400_BAD_REQUEST)
        period.workflow_status = PayrollWorkflowStatus.PENDING_APPROVAL
        period.save()
        return Response({'message': 'Payroll submitted for executive approval.', 'status': period.workflow_status})

    @action(detail=True, methods=['post'], url_path='approve')
    def approve_payroll(self, request, pk=None):
        """
        Approve payroll enforcing separation of duties (preparer cannot approve).
        """
        try:
            period = HROperationsService.approve_payroll_period(
                period_id=pk,
                approver_user=request.user
            )
            return Response(PayrollPeriodSerializer(period).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='post-gl')
    def post_to_gl(self, request, pk=None):
        """
        Post approved payroll into Section 17 Double-Entry General Ledger.
        """
        try:
            result = HROperationsService.post_payroll_to_gl(
                period_id=pk,
                user=request.user
            )
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='disburse')
    def disburse(self, request, pk=None):
        """
        Record salary disbursement through financial transactions & mark payslips as PAID.
        """
        mode = request.data.get('payment_mode', 'BANK_TRANSFER')
        ref = request.data.get('reference_number', '')
        try:
            period = HROperationsService.disburse_payroll_payment(
                period_id=pk,
                payment_mode=mode,
                reference_number=ref,
                user=request.user
            )
            return Response(PayrollPeriodSerializer(period).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PayslipViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PayslipSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        user = self.request.user
        qs = Payslip.objects.select_related(
            'payroll_period', 'staff__user_profile', 'staff__department', 'staff__branch'
        ).order_by('-payroll_period__year', '-payroll_period__month')

        prof = resolve_user_profile(self.request)
        is_hr = prof and prof.role and prof.role.name in [
            RoleEnum.HR_MANAGER, RoleEnum.ACCOUNTANT, RoleEnum.FINANCE_MANAGER,
            RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER
        ]
        if not is_hr and not user.is_superuser:
            # Self-access only for non-HR staff members
            if prof and hasattr(prof, 'staff_profile'):
                qs = qs.filter(staff=prof.staff_profile)
            else:
                return qs.none()

        period_id = self.request.query_params.get('payroll_period_id')
        staff_id = self.request.query_params.get('staff_id')
        if period_id:
            qs = qs.filter(payroll_period_id=period_id)
        if staff_id and is_hr:
            qs = qs.filter(staff_id=staff_id)
        return qs


# =============================================================================
# 5. FIXED ASSET REGISTER & DEPRECIATION VIEWSETS
# =============================================================================

class FixedAssetViewSet(viewsets.ModelViewSet):
    serializer_class = FixedAssetSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = FixedAsset.objects.select_related(
            'branch', 'department', 'custodian__user_profile'
        ).prefetch_related('depreciation_schedules', 'maintenance_tasks').order_by('-purchase_date')
        category = self.request.query_params.get('category')
        dept_id = self.request.query_params.get('department_id')
        status_filter = self.request.query_params.get('status')

        if category:
            qs = qs.filter(category=category)
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        if not serializer.validated_data.get('branch'):
            serializer.validated_data['branch'] = Branch.objects.first()
        serializer.save()

    @action(detail=True, methods=['post'], url_path='depreciate')
    def calculate_depreciation(self, request, pk=None):
        """
        Calculate straight-line depreciation and post journal entry to Section 17 GL.
        """
        year = int(request.data.get('fiscal_year', timezone.localdate().year))
        period_name = request.data.get('period_name', f'FY{year}-Annual')
        try:
            schedule = HROperationsService.calculate_and_post_depreciation(
                asset_id=pk,
                fiscal_year=year,
                fiscal_period_name=period_name,
                user=request.user
            )
            return Response(AssetDepreciationScheduleSerializer(schedule).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AssetDepreciationScheduleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AssetDepreciationScheduleSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = AssetDepreciationSchedule.objects.select_related('asset').order_by('-fiscal_year')
        asset_id = self.request.query_params.get('asset_id')
        if asset_id:
            qs = qs.filter(asset_id=asset_id)
        return qs


# =============================================================================
# 6. MEDICAL EQUIPMENT MAINTENANCE VIEWSETS
# =============================================================================

class EquipmentMaintenanceTaskViewSet(viewsets.ModelViewSet):
    serializer_class = EquipmentMaintenanceTaskSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = EquipmentMaintenanceTask.objects.select_related(
            'asset', 'certified_by__user_profile'
        ).order_by('-scheduled_date')
        asset_id = self.request.query_params.get('asset_id')
        status_filter = self.request.query_params.get('status')
        overdue = self.request.query_params.get('overdue')

        if asset_id:
            qs = qs.filter(asset_id=asset_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if overdue == 'true':
            qs = qs.filter(status='SCHEDULED', scheduled_date__lt=timezone.localdate())
        return qs

    @action(detail=True, methods=['post'], url_path='certify-complete')
    def complete_and_certify(self, request, pk=None):
        """
        Record maintenance completion, costs, and clinical safety certification.
        """
        task = self.get_object()
        data = request.data
        task.status = 'COMPLETED'
        task.completed_date = timezone.localdate()
        task.action_taken = data.get('action_taken', '')
        task.findings = data.get('findings', '')
        task.total_cost = Decimal(str(data.get('total_cost', '0.00')))
        task.clinical_safety_certified = data.get('clinical_safety_certified', True)
        task.certification_notes = data.get('certification_notes', 'Safe for clinical use.')
        task.certified_by = get_staff_profile(request.user)
        task.save()

        # Update parent asset status
        if task.clinical_safety_certified and task.asset:
            task.asset.status = 'OPERATIONAL'
            if task.next_service_due:
                task.asset.next_maintenance_due = task.next_service_due
            task.asset.save()

        return Response(EquipmentMaintenanceTaskSerializer(task).data)


# =============================================================================
# 7. OPERATION THEATRE (OT) SCHEDULING VIEWSETS
# =============================================================================

class OperatingTheatreSuiteViewSet(viewsets.ModelViewSet):
    serializer_class = OperatingTheatreSuiteSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]
    queryset = OperatingTheatreSuite.objects.select_related('branch').all().order_by('name')


class OperationTheatreBookingViewSet(viewsets.ModelViewSet):
    serializer_class = OperationTheatreBookingSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = OperationTheatreBooking.objects.select_related(
            'theatre', 'patient__user_profile', 'lead_surgeon__user_profile',
            'anesthetist__user_profile', 'scrub_nurse__user_profile'
        ).order_by('-scheduled_date', 'start_time')
        theatre_id = self.request.query_params.get('theatre_id')
        date = self.request.query_params.get('date')
        status_filter = self.request.query_params.get('status')

        if theatre_id:
            qs = qs.filter(theatre_id=theatre_id)
        if date:
            qs = qs.filter(scheduled_date=date)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def create(self, request, *args, **kwargs):
        """
        Book OT with conflict prevention for both the room and lead surgeon.
        """
        try:
            booking = HROperationsService.book_operation_theatre(
                theatre_id=request.data.get('theatre'),
                patient_id=request.data.get('patient'),
                lead_surgeon_id=request.data.get('lead_surgeon'),
                procedure_name=request.data.get('procedure_name'),
                date_str=request.data.get('scheduled_date'),
                start_time_str=request.data.get('start_time'),
                end_time_str=request.data.get('end_time'),
                anesthetist_id=request.data.get('anesthetist'),
                scrub_nurse_id=request.data.get('scrub_nurse'),
                anesthesia_type=request.data.get('anesthesia_type', 'GENERAL_ANESTHESIA'),
                clinical_notes=request.data.get('clinical_notes', '')
            )
            return Response(OperationTheatreBookingSerializer(booking).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_surgery(self, request, pk=None):
        booking = self.get_object()
        booking.status = 'COMPLETED'
        booking.clinical_notes += f" [Completed at {timezone.now()}]"
        booking.save()
        return Response(OperationTheatreBookingSerializer(booking).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_booking(self, request, pk=None):
        booking = self.get_object()
        booking.status = 'CANCELLED'
        booking.cancellation_reason = request.data.get('cancellation_reason', 'Cancelled by clinical team')
        booking.save()
        return Response(OperationTheatreBookingSerializer(booking).data)


# =============================================================================
# 8. ICU MONITORING WORKFLOW VIEWSETS
# =============================================================================

class ICUObservationRecordViewSet(viewsets.ModelViewSet):
    serializer_class = ICUObservationRecordSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = ICUObservationRecord.objects.select_related(
            'patient__user_profile', 'recorded_by__user_profile', 'reviewed_by__user_profile'
        ).order_by('-observation_time')
        patient_id = self.request.query_params.get('patient_id')
        bed_ident = self.request.query_params.get('bed_identifier')
        escalation = self.request.query_params.get('escalation_status')

        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        if bed_ident:
            qs = qs.filter(bed_identifier__icontains=bed_ident)
        if escalation:
            qs = qs.filter(escalation_status=escalation)
        return qs

    def perform_create(self, serializer):
        staff = get_staff_profile(self.request.user)
        serializer.save(recorded_by=staff)


# =============================================================================
# 9. AMBULANCE FLEET & DISPATCH VIEWSETS
# =============================================================================

class AmbulanceViewSet(viewsets.ModelViewSet):
    serializer_class = AmbulanceSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]
    queryset = Ambulance.objects.select_related(
        'base_branch', 'assigned_driver__user_profile', 'assigned_paramedic__user_profile'
    ).all().order_by('registration_number')

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AmbulanceDispatchViewSet(viewsets.ModelViewSet):
    serializer_class = AmbulanceDispatchSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        return AmbulanceDispatch.objects.select_related(
            'ambulance', 'patient__user_profile'
        ).order_by('-request_time')

    def create(self, request, *args, **kwargs):
        """
        Dispatch ambulance with real availability check and conflict prevention.
        """
        try:
            dispatch = HROperationsService.dispatch_ambulance(
                ambulance_id=request.data.get('ambulance'),
                pickup_location=request.data.get('pickup_location'),
                destination=request.data.get('destination', 'Hospital Emergency Department'),
                patient_id=request.data.get('patient'),
                patient_name_unregistered=request.data.get('patient_name_unregistered', ''),
                user=request.user
            )
            return Response(AmbulanceDispatchSerializer(dispatch).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_trip(self, request, pk=None):
        """
        Mark dispatch complete, record distance & fuel, and restore vehicle status to AVAILABLE.
        """
        try:
            dispatch = HROperationsService.complete_ambulance_trip(
                dispatch_id=pk,
                distance_km=Decimal(str(request.data.get('distance_km', '15.0'))),
                fuel_liters=Decimal(str(request.data.get('fuel_consumed_liters', '2.5'))),
                notes=request.data.get('notes', 'Trip completed successfully.')
            )
            return Response(AmbulanceDispatchSerializer(dispatch).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# 10. BLOOD BANK INTEGRATION VIEWSETS
# =============================================================================

class BloodBankStockViewSet(viewsets.ModelViewSet):
    serializer_class = BloodBankStockSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = BloodBankStock.objects.select_related(
            'reserved_for_patient__user_profile', 'issued_by__user_profile'
        ).order_by('expiry_date')
        group = self.request.query_params.get('blood_group')
        comp = self.request.query_params.get('component_type')
        status_filter = self.request.query_params.get('status')

        if group:
            qs = qs.filter(blood_group=group)
        if comp:
            qs = qs.filter(component_type=comp)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['post'], url_path='issue')
    def issue_unit(self, request, pk=None):
        """
        Issue blood bag with strict expiry & screening validation.
        """
        dept = request.data.get('department_name', 'Emergency Ward / OT')
        staff = get_staff_profile(request.user)

        try:
            stock = HROperationsService.issue_blood_unit(
                bag_id=pk,
                department_name=dept,
                issued_by_staff=staff
            )
            return Response(BloodBankStockSerializer(stock).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# 11. HOUSEKEEPING MANAGEMENT VIEWSETS
# =============================================================================

class HousekeepingTaskViewSet(viewsets.ModelViewSet):
    serializer_class = HousekeepingTaskSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = HousekeepingTask.objects.select_related(
            'assigned_staff__user_profile', 'inspected_by__user_profile', 'branch'
        ).order_by('-scheduled_time')
        status_filter = self.request.query_params.get('status')
        area = self.request.query_params.get('room_area')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if area:
            qs = qs.filter(room_area__icontains=area)
        return qs

    @action(detail=True, methods=['post'], url_path='start')
    def start_cleaning(self, request, pk=None):
        task = self.get_object()
        task.status = HousekeepingTaskStatus.IN_PROGRESS
        task.started_at = timezone.now()
        task.save()
        return Response(HousekeepingTaskSerializer(task).data)

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_cleaning(self, request, pk=None):
        task = self.get_object()
        task.status = HousekeepingTaskStatus.COMPLETED
        task.completed_at = timezone.now()
        task.checklist_items = request.data.get('checklist_items', {})
        task.save()
        return Response(HousekeepingTaskSerializer(task).data)

    @action(detail=True, methods=['post'], url_path='inspect')
    def inspect_task(self, request, pk=None):
        task = self.get_object()
        task.status = HousekeepingTaskStatus.INSPECTED
        task.inspection_notes = request.data.get('inspection_notes', 'Inspected and certified clean.')
        task.inspected_by = get_staff_profile(request.user)
        task.save()
        return Response(HousekeepingTaskSerializer(task).data)


# =============================================================================
# 12. BIOMEDICAL WASTE TRACKING VIEWSETS
# =============================================================================

class BiomedicalWasteRecordViewSet(viewsets.ModelViewSet):
    serializer_class = BiomedicalWasteRecordSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = BiomedicalWasteRecord.objects.select_related(
            'generating_department', 'collected_by__user_profile', 'handover_officer__user_profile', 'branch'
        ).order_by('-collection_time')
        category = self.request.query_params.get('waste_category')
        status_filter = self.request.query_params.get('status')
        if category:
            qs = qs.filter(waste_category=category)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['post'], url_path='handover')
    def handover_manifest(self, request, pk=None):
        """
        Record handover of segregated waste bag to authorized CBMWTF operator.
        """
        data = request.data
        agency = data.get('agency_name', 'State Bio-Clean Eco Solutions')
        vehicle = data.get('vehicle_number', '')
        receipt = data.get('receipt_number', '')
        officer = get_staff_profile(request.user)

        try:
            record = HROperationsService.handover_biomedical_waste(
                record_id=pk,
                agency_name=agency,
                vehicle_no=vehicle,
                receipt_no=receipt,
                officer=officer
            )
            return Response(BiomedicalWasteRecordSerializer(record).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# 13. ROLE-SPECIFIC REAL-TIME DASHBOARDS
# =============================================================================

class HRDashboardView(views.APIView):
    """
    GET /api/v1/operations-hr/dashboards/hr/
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        branch_id = request.query_params.get('branch_id')
        data = HROperationsService.get_hr_dashboard(branch_id=branch_id)
        return Response(data)


class AssetDashboardView(views.APIView):
    """
    GET /api/v1/operations-hr/dashboards/assets/
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        branch_id = request.query_params.get('branch_id')
        data = HROperationsService.get_asset_dashboard(branch_id=branch_id)
        return Response(data)


class OperationsDashboardView(views.APIView):
    """
    GET /api/v1/operations-hr/dashboards/operations/
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        branch_id = request.query_params.get('branch_id')
        data = HROperationsService.get_operations_dashboard(branch_id=branch_id)
        return Response(data)


# =============================================================================
# 14. LEGACY SETTINGS & OVERVIEW (BACKWARDS COMPATIBILITY)
# =============================================================================

class HospitalSettingViewSet(viewsets.ModelViewSet):
    serializer_class = HospitalSettingSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]
    queryset = HospitalSetting.objects.all()


class OperationsAnalyticsOverview(views.APIView):
    """
    Legacy real-time overview across clinical, financial, and inventory domains.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        branch_id = request.query_params.get('branch_id')
        today = timezone.now().date()

        total_patients = PatientProfile.objects.count()
        today_appointments = Appointment.objects.filter(appointment_date=today)
        if branch_id:
            today_appointments = today_appointments.filter(branch_id=branch_id)
        today_appointments_count = today_appointments.count()

        beds_qs = Bed.objects.all()
        if branch_id:
            beds_qs = beds_qs.filter(ward__branch_id=branch_id)
        total_beds = beds_qs.count()
        occupied_beds = beds_qs.filter(status='OCCUPIED').count()
        occupancy_rate = round((occupied_beds / total_beds * 100), 1) if total_beds > 0 else 0

        emergency_qs = EmergencyEncounter.objects.filter(arrival_time__date=today)
        if branch_id:
            emergency_qs = emergency_qs.filter(branch_id=branch_id)
        today_er_count = emergency_qs.count()

        invoices_qs = Invoice.objects.all()
        payments_qs = Payment.objects.all()
        if branch_id:
            invoices_qs = invoices_qs.filter(branch_id=branch_id)
            payments_qs = payments_qs.filter(branch_id=branch_id)

        total_billed = sum((inv.total_amount for inv in invoices_qs), Decimal('0.00'))
        total_collected = sum((pay.amount for pay in payments_qs), Decimal('0.00'))
        outstanding_ar = total_billed - total_collected

        low_stock_medicines = MedicineBatch.objects.filter(quantity_in_stock__lte=50).count()
        staff_on_duty = StaffProfile.objects.filter(is_on_duty=True).count()

        return Response({
            'timestamp': timezone.now(),
            'clinical': {
                'total_registered_patients': total_patients,
                'today_appointments_count': today_appointments_count,
                'inpatient_total_beds': total_beds,
                'inpatient_occupied_beds': occupied_beds,
                'inpatient_occupancy_rate_pct': occupancy_rate,
                'today_emergency_cases': today_er_count,
            },
            'financial': {
                'total_billed_revenue': total_billed,
                'total_collected_amount': total_collected,
                'outstanding_receivable': outstanding_ar,
                'collection_efficiency_pct': round((total_collected / total_billed * 100), 1) if total_billed > 0 else 100,
            },
            'operational': {
                'staff_on_duty': staff_on_duty,
                'low_stock_alerts_count': low_stock_medicines,
            }
        })


class AuditLogListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = AuditLog.objects.select_related('branch').order_by('-created_at')[:100]
        return Response(AuditLogSerializer(qs, many=True).data)
