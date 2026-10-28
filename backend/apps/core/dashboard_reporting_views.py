import csv
import io
from django.http import HttpResponse
from rest_framework import views, status, permissions
from rest_framework.response import Response

from apps.authentication.models import RoleEnum
from apps.authentication.utils import get_user_profile, get_staff_profile
from .dashboard_reporting_service import DashboardReportingService


class BaseDashboardView(views.APIView):
    """
    Base view with RBAC role validation and query parameter extraction.
    """
    permission_classes = [permissions.IsAuthenticated]
    allowed_roles = []

    def get_user_role(self, request):
        if request.user.is_superuser:
            return 'SUPER_ADMIN'
        user_prof = get_user_profile(request.user)
        if not user_prof or not user_prof.role:
            return None
        return user_prof.role.name

    def check_role_access(self, request):
        role = self.get_user_role(request)
        if not role:
            return False, "User profile or role not found."
        if role == RoleEnum.PATIENT:
            return False, "Access restricted to authorized hospital staff members."
        if role in ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER']:
            return True, None
        if self.allowed_roles and role not in self.allowed_roles:
            return False, f"Access denied: Role '{role}' is not authorized to access this dashboard."
        return True, None

    def get_filter_params(self, request):
        return {
            'branch_id': request.query_params.get('branch_id'),
            'department_id': request.query_params.get('department_id'),
            'from_date': request.query_params.get('from_date'),
            'to_date': request.query_params.get('to_date')
        }


class HospitalAdminDashboardView(BaseDashboardView):
    allowed_roles = [
        RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER,
        RoleEnum.MEDICAL_DIRECTOR, RoleEnum.FINANCE_MANAGER, RoleEnum.AUDITOR
    ]

    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        filters = self.get_filter_params(request)
        data = DashboardReportingService.get_admin_dashboard(**filters)
        return Response(data)


class FinanceDashboardView(BaseDashboardView):
    allowed_roles = [
        RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER,
        RoleEnum.FINANCE_MANAGER, RoleEnum.ACCOUNTANT, RoleEnum.AUDITOR
    ]

    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        filters = self.get_filter_params(request)
        data = DashboardReportingService.get_finance_dashboard(
            branch_id=filters['branch_id'],
            from_date=filters['from_date'],
            to_date=filters['to_date']
        )
        return Response(data)


class ClinicalDashboardView(BaseDashboardView):
    allowed_roles = [
        RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER,
        RoleEnum.MEDICAL_DIRECTOR, RoleEnum.DOCTOR, RoleEnum.NURSE, RoleEnum.DEPARTMENT_HEAD
    ]

    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        filters = self.get_filter_params(request)
        data = DashboardReportingService.get_clinical_dashboard(**filters)
        return Response(data)


class PharmacyDashboardView(BaseDashboardView):
    allowed_roles = [
        RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER,
        RoleEnum.PHARMACIST, RoleEnum.INVENTORY_MANAGER, RoleEnum.FINANCE_MANAGER
    ]

    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        filters = self.get_filter_params(request)
        data = DashboardReportingService.get_pharmacy_dashboard(
            branch_id=filters['branch_id'],
            from_date=filters['from_date'],
            to_date=filters['to_date']
        )
        return Response(data)


class DiagnosticsDashboardView(BaseDashboardView):
    allowed_roles = [
        RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER,
        RoleEnum.LAB_TECHNICIAN, RoleEnum.RADIOLOGY_TECHNICIAN, RoleEnum.DOCTOR, RoleEnum.MEDICAL_DIRECTOR
    ]

    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        filters = self.get_filter_params(request)
        data = DashboardReportingService.get_diagnostics_dashboard(
            branch_id=filters['branch_id'],
            from_date=filters['from_date'],
            to_date=filters['to_date']
        )
        return Response(data)


class InventoryDashboardView(BaseDashboardView):
    allowed_roles = [
        RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER,
        RoleEnum.PROCUREMENT_OFFICER, RoleEnum.INVENTORY_MANAGER, RoleEnum.FINANCE_MANAGER
    ]

    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        filters = self.get_filter_params(request)
        data = DashboardReportingService.get_inventory_dashboard(
            branch_id=filters['branch_id'],
            from_date=filters['from_date'],
            to_date=filters['to_date']
        )
        return Response(data)


class BillingDashboardView(BaseDashboardView):
    allowed_roles = [
        RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER,
        RoleEnum.BILLING_EXECUTIVE, RoleEnum.CASHIER, RoleEnum.ACCOUNTANT, RoleEnum.FINANCE_MANAGER
    ]

    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        filters = self.get_filter_params(request)
        data = DashboardReportingService.get_billing_dashboard(
            branch_id=filters['branch_id'],
            from_date=filters['from_date'],
            to_date=filters['to_date']
        )
        return Response(data)


class AccountingDashboardView(BaseDashboardView):
    allowed_roles = [
        RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER,
        RoleEnum.ACCOUNTANT, RoleEnum.FINANCE_MANAGER, RoleEnum.AUDITOR
    ]

    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        filters = self.get_filter_params(request)
        data = DashboardReportingService.get_accounting_dashboard(
            branch_id=filters['branch_id'],
            from_date=filters['from_date'],
            to_date=filters['to_date']
        )
        return Response(data)


class InvestmentDashboardView(BaseDashboardView):
    allowed_roles = [
        RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER,
        RoleEnum.INVESTMENT_MANAGER, RoleEnum.FINANCE_MANAGER, RoleEnum.AUDITOR
    ]

    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        filters = self.get_filter_params(request)
        data = DashboardReportingService.get_investments_dashboard(
            branch_id=filters['branch_id'],
            from_date=filters['from_date'],
            to_date=filters['to_date']
        )
        return Response(data)


class DrillDownListView(BaseDashboardView):
    """
    Granular transaction-level drill-down records for any clicked metric.
    """
    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        metric_type = request.query_params.get('metric')
        if not metric_type:
            return Response({'error': 'Parameter "metric" is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Financial metrics require financial permissions
        role = self.get_user_role(request)
        if metric_type in ['REVENUE_INVOICES', 'COLLECTIONS', 'OUTSTANDING_RECEIVABLES', 'SUPPLIER_PAYABLES']:
            allowed = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT', 'BILLING_EXECUTIVE', 'CASHIER', 'AUDITOR']
            if role not in allowed:
                return Response({'error': f'Role {role} is not permitted to view financial drill-down details.'}, status=status.HTTP_403_FORBIDDEN)

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        search = request.query_params.get('search')
        filters = self.get_filter_params(request)

        data = DashboardReportingService.get_drill_down_records(
            metric_type=metric_type,
            branch_id=filters['branch_id'],
            department_id=filters['department_id'],
            from_date=filters['from_date'],
            to_date=filters['to_date'],
            search=search,
            page=page,
            page_size=page_size
        )
        return Response(data)


class DashboardExportView(BaseDashboardView):
    """
    Exports filtered database records as a CSV attachment.
    """
    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        metric_type = request.query_params.get('metric', 'OPD_REGISTRATIONS')
        filters = self.get_filter_params(request)
        search = request.query_params.get('search')

        # Retrieve all records for export (page_size = 5000)
        data = DashboardReportingService.get_drill_down_records(
            metric_type=metric_type,
            branch_id=filters['branch_id'],
            department_id=filters['department_id'],
            from_date=filters['from_date'],
            to_date=filters['to_date'],
            search=search,
            page=1,
            page_size=5000
        )

        columns = data.get('columns', [])
        records = data.get('records', [])

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(columns)

        for rec in records:
            # Map values based on column definitions
            row = []
            for col in columns:
                clean_key = col.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('₹', '').replace('/', '_').strip('_')
                val = rec.get(clean_key)
                if val is None:
                    # Search alternative keys
                    for k in rec.keys():
                        if k in clean_key or clean_key in k:
                            val = rec[k]
                            break
                row.append(str(val) if val is not None else '')
            writer.writerow(row)

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="Hospital_Report_{metric_type}_{DashboardReportingService.get_hospital_today()}.csv"'
        return response


class DatabaseDesignAuditView(BaseDashboardView):
    """
    Section 22: Returns comprehensive database normalization, schema integrity,
    and constraint verification audit metrics.
    """
    allowed_roles = [RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.AUDITOR]

    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        from apps.core.database_transaction_services import DatabaseIntegrityAuditService
        audit_data = DatabaseIntegrityAuditService.verify_normalization_and_integrity()
        return Response(audit_data)


class DatabaseBackupVerificationView(BaseDashboardView):
    """
    Section 23: Triggers automated backup snapshot generation and runs
    safe, isolated restoration verification with cryptographic checksums.
    """
    allowed_roles = [RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.AUDITOR]

    def post(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        from apps.core.backup_recovery_service import BackupRecoveryService
        requester_email = request.user.email or 'admin@aurahms.org'
        notes = request.data.get('notes', 'Compliance backup and verification test')

        # Generate backup
        archive = BackupRecoveryService.generate_backup_archive(
            requested_by=requester_email,
            notes=notes
        )

        # Run non-destructive restoration verification test
        verification_report = BackupRecoveryService.verify_backup_restoration_safe(
            backup_archive=archive,
            verified_by=requester_email
        )

        return Response({
            'backup_archive': archive['metadata'],
            'restoration_verification': verification_report
        }, status=status.HTTP_200_OK)


class IndianComplianceAssessmentView(BaseDashboardView):
    """
    Section 23: Evaluates Indian healthcare, privacy, tax, and ABDM compliance status
    (DPDP Act 2023, Clinical Establishments Act, GST SAC 9993, and ABDM M1-M3).
    """
    allowed_roles = [RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.AUDITOR, RoleEnum.MEDICAL_DIRECTOR]

    def get(self, request):
        has_access, err = self.check_role_access(request)
        if not has_access:
            return Response({'error': err}, status=status.HTTP_403_FORBIDDEN)

        from apps.core.compliance_assessment_service import IndianComplianceAssessmentService
        report = IndianComplianceAssessmentService.get_comprehensive_assessment()
        return Response(report, status=status.HTTP_200_OK)
