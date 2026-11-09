from decimal import Decimal
from django.db import models
from django.utils import timezone
from rest_framework import views, viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action

from apps.authentication.permissions import IsStaffMember, resolve_user_profile
from apps.authentication.models import RoleEnum
from apps.core.models import Branch, Department
from .models import HospitalService, ServiceCategory, PricingUnit, PriceChangeHistory
from .tariff_service import CentralTariffService


class HospitalTariffViewSet(viewsets.ViewSet):
    """
    Centralized Hospital Pricing & Tariff Authority Management ViewSet.
    Allows authorized Hospital Admin to manage charges across all hospital branches centrally:
    - Appointment charges (General, Specialist, Follow-up, Online, Emergency)
    - Token charges (OPD token, Department token, Emergency token)
    - Admission charges (Patient admission, General IPD, Emergency IPD)
    - Bed & Room charges (General ward, Semi-private, Private, Deluxe, ICU, NICU/PICU)
    - Other hospital services (Nursing, Procedures, Lab, Radiology, Pharmacy, Ambulance)

    Enforces:
    - HOSPITAL_ADMIN (or superuser) edit authority
    - Read-only viewing for Branch Managers, Billing Executives, Receptionists
    - Immutable price change audit trail (PriceChangeHistory)
    - Real-time synchronization across all branches
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def _check_admin_permission(self, request):
        """Only Hospital Admin or Super Admin can create or modify prices."""
        if request.user.is_superuser:
            return True
        prof = resolve_user_profile(request)
        role_name = prof.role.name if prof and prof.role else ''
        if role_name not in [RoleEnum.HOSPITAL_ADMIN, RoleEnum.SUPER_ADMIN]:
            return False
        return True

    def list(self, request):
        """
        GET /api/v1/billing-finance/hospital-tariffs/
        Lists all hospital services with current prices, pricing units, and branch status.
        """
        category = request.query_params.get('category')
        search = request.query_params.get('search')
        branch_id = request.query_params.get('branch_id')
        is_active_param = request.query_params.get('is_active')

        is_active = None
        if is_active_param is not None:
            is_active = is_active_param.lower() == 'true'

        services = CentralTariffService.get_services(
            category=category,
            search=search,
            branch_id=branch_id,
            is_active=is_active
        )
        return Response({
            'count': len(services),
            'results': services,
            'categories': [
                {'key': choice[0], 'label': choice[1]}
                for choice in ServiceCategory.choices
            ],
            'pricing_units': [
                {'key': choice[0], 'label': choice[1]}
                for choice in PricingUnit.choices
            ],
            'last_sync_timestamp': timezone.now().isoformat(),
        })

    def retrieve(self, request, pk=None):
        """
        GET /api/v1/billing-finance/hospital-tariffs/{id}/
        Retrieves single service with history and branch overrides.
        """
        service = HospitalService.objects.select_related('department').filter(id=pk).first()
        if not service:
            return Response({'error': 'Service not found.'}, status=status.HTTP_404_NOT_FOUND)

        history = CentralTariffService.get_price_history(service_id=service.id, limit=20)
        overrides = list(service.branch_overrides.filter(is_active=True).values(
            'id', 'branch_id', 'branch__name', 'override_price', 'effective_from'
        ))

        return Response({
            'id': str(service.id),
            'service_code': service.service_code,
            'name': service.name,
            'category': service.category,
            'category_display': service.get_category_display(),
            'department_name': service.department.name if service.department else 'Central Operations',
            'standard_price': str(service.standard_price),
            'pricing_unit': service.pricing_unit,
            'pricing_unit_display': service.get_pricing_unit_display(),
            'tax_rate': str(service.tax_rate),
            'is_active': service.is_active,
            'effective_from': str(service.effective_from),
            'applies_to_all_branches': service.applies_to_all_branches,
            'branch_overrides': overrides,
            'recent_history': history,
        })

    def create(self, request):
        """
        POST /api/v1/billing-finance/hospital-tariffs/
        Adds a new hospital service to the central service catalogue.
        """
        if not self._check_admin_permission(request):
            return Response(
                {'error': 'Permission Denied: Only the authorized Hospital Admin can create new tariff services.'},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data
        name = data.get('name', '').strip()
        code = data.get('service_code', '').strip().upper()
        category = data.get('category', ServiceCategory.GENERAL_SERVICE)
        price_val = data.get('standard_price', 0)
        unit = data.get('pricing_unit', PricingUnit.ONE_TIME)
        desc = data.get('description', '').strip()
        dept_id = data.get('department_id')

        if not name or not code:
            return Response({'error': 'Service name and code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if HospitalService.objects.filter(service_code=code).exists():
            return Response({'error': f"Service code '{code}' already exists in catalogue."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            price = Decimal(str(price_val)).quantize(Decimal('0.01'))
            if price < Decimal('0.00'):
                raise ValueError()
        except Exception:
            return Response({'error': 'Standard price must be a non-negative decimal.'}, status=status.HTTP_400_BAD_REQUEST)

        dept = Department.objects.filter(id=dept_id).first() if dept_id else None
        prof = resolve_user_profile(request)
        staff = getattr(prof, 'staff_profile', None)

        service = HospitalService.objects.create(
            service_code=code,
            name=name,
            category=category,
            department=dept,
            description=desc,
            standard_price=price,
            pricing_unit=unit,
            is_active=True,
            applies_to_all_branches=True,
            effective_from=data.get('effective_from') or timezone.localdate(),
            last_updated_by=staff,
            last_updated_by_name=staff.user_profile.full_name if (staff and getattr(staff, 'user_profile', None)) else 'Hospital Admin'
        )

        # Log initial creation in PriceChangeHistory
        PriceChangeHistory.objects.create(
            service=service,
            previous_price=Decimal('0.00'),
            new_price=price,
            effective_date=service.effective_from,
            reason=data.get('reason') or "Initial Service Catalogue Creation",
            modified_by=staff,
            modified_by_name=service.last_updated_by_name,
            applicable_to_all_branches=True,
            affected_branches_summary="All Active Branches",
        )

        return Response({
            'message': f"Service '{service.name}' created with central tariff of ₹{price}.",
            'id': str(service.id),
            'service_code': service.service_code,
            'name': service.name,
            'standard_price': str(service.standard_price),
            'pricing_unit': service.pricing_unit,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='update-price')
    def update_price(self, request, pk=None):
        """
        POST /api/v1/billing-finance/hospital-tariffs/{id}/update-price/
        Updates price across all branches or specific branches, recording immutable history.
        """
        if not self._check_admin_permission(request):
            return Response(
                {'error': 'Permission Denied: Only the authorized Hospital Admin can modify hospital service prices.'},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data
        new_price = data.get('new_price')
        if new_price is None:
            return Response({'error': 'new_price is required.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = data.get('reason', '').strip()
        effective_date_str = data.get('effective_date')
        applies_to_all = data.get('applies_to_all_branches', True)
        branch_ids = data.get('branch_ids', [])

        effective_date = timezone.localdate()
        if effective_date_str:
            try:
                effective_date = timezone.datetime.strptime(effective_date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'error': 'Invalid effective_date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = CentralTariffService.update_service_price(
                service_id=pk,
                new_price=new_price,
                effective_date=effective_date,
                reason=reason,
                user=request.user,
                applies_to_all_branches=applies_to_all,
                branch_ids=branch_ids
            )
            return Response({
                'message': f"Price for '{result['name']}' updated to ₹{result['new_price']} successfully across {result['affected_branches_summary']}.",
                'data': result,
                'sync_timestamp': timezone.now().isoformat(),
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        """
        POST /api/v1/billing-finance/hospital-tariffs/{id}/toggle-status/
        Activates or deactivates a service.
        """
        if not self._check_admin_permission(request):
            return Response(
                {'error': 'Permission Denied: Only the authorized Hospital Admin can change service status.'},
                status=status.HTTP_403_FORBIDDEN
            )

        is_active = request.data.get('is_active')
        if is_active is None:
            return Response({'error': 'is_active boolean is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            res = CentralTariffService.toggle_service_status(pk, bool(is_active), user=request.user)
            return Response({
                'message': f"Service status updated to {'Active' if res['is_active'] else 'Inactive'}.",
                'data': res
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='preview-changes')
    def preview_changes(self, request):
        """
        POST /api/v1/billing-finance/hospital-tariffs/preview-changes/
        Returns comparative impact analysis (old price, new price, difference, percentage, branches)
        before Hospital Admin commits the change.
        """
        service_id = request.data.get('service_id')
        new_price = request.data.get('new_price')
        effective_date_str = request.data.get('effective_date')
        applies_to_all = request.data.get('applies_to_all_branches', True)
        branch_ids = request.data.get('branch_ids', [])

        if not service_id or new_price is None:
            return Response({'error': 'service_id and new_price are required.'}, status=status.HTTP_400_BAD_REQUEST)

        effective_date = timezone.localdate()
        if effective_date_str:
            try:
                effective_date = timezone.datetime.strptime(effective_date_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        try:
            preview = CentralTariffService.preview_price_change(
                service_id=service_id,
                new_price=new_price,
                effective_date=effective_date,
                applies_to_all=applies_to_all,
                branch_ids=branch_ids
            )
            return Response(preview)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='all-history')
    def all_history(self, request):
        """
        GET /api/v1/billing-finance/hospital-tariffs/all-history/
        Returns complete chronological audit trail of all price changes across the hospital system.
        """
        limit = int(request.query_params.get('limit', 50))
        history = CentralTariffService.get_price_history(limit=limit)
        return Response({
            'count': len(history),
            'results': history
        })

    @action(detail=True, methods=['get'], url_path='history')
    def service_history(self, request, pk=None):
        """
        GET /api/v1/billing-finance/hospital-tariffs/{id}/history/
        Returns price change history for a specific service.
        """
        history = CentralTariffService.get_price_history(service_id=pk)
        return Response({
            'count': len(history),
            'results': history
        })

    @action(detail=False, methods=['get'], url_path='active-tariff-summary')
    def active_tariff_summary(self, request):
        """
        GET /api/v1/billing-finance/hospital-tariffs/active-tariff-summary/
        Lightweight live pricing endpoint for frontends to poll or invalidate cache,
        enabling 100% dynamic synchronization across booking, token, admission, and billing screens.
        """
        branch_id = request.query_params.get('branch_id')
        services = CentralTariffService.get_services(branch_id=branch_id, is_active=True)
        summary = {
            s['service_code']: {
                'id': s['id'],
                'name': s['name'],
                'category': s['category'],
                'current_price': s['current_price'],
                'pricing_unit': s['pricing_unit'],
                'pricing_unit_display': s['pricing_unit_display'],
            }
            for s in services
        }
        return Response({
            'timestamp': timezone.now().isoformat(),
            'tariffs': summary
        })

