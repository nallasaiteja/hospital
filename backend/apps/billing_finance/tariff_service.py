import uuid
from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone
from django.core.exceptions import PermissionDenied, ValidationError

from apps.core.models import Branch, Department
from apps.authentication.models import RoleEnum, StaffProfile
from apps.authentication.utils import get_staff_profile
from apps.billing_finance.models import (
    HospitalService, ServiceCategory, PricingUnit,
    PriceChangeHistory, BranchTariffOverride, BillingAuditEvent
)


class CentralTariffService:
    """
    Centralized Hospital Pricing & Tariff Authority Service.
    Single authoritative engine managing all branch tariffs, price changes,
    audit history, and cross-branch synchronization.
    """

    DEFAULT_SERVICES_SPEC = [
        # A. Appointment Charges
        {
            'service_code': 'SRV-APPT-GEN',
            'name': 'General OPD Consultation Fee',
            'category': ServiceCategory.OPD_CONSULTATION,
            'standard_price': Decimal('500.00'),
            'pricing_unit': PricingUnit.PER_VISIT,
            'description': 'Standard outpatient doctor consultation and clinical examination fee.',
        },
        {
            'service_code': 'SRV-APPT-SPEC',
            'name': 'Specialist & Super-Specialist Consultation Fee',
            'category': ServiceCategory.OPD_CONSULTATION,
            'standard_price': Decimal('800.00'),
            'pricing_unit': PricingUnit.PER_VISIT,
            'description': 'Senior specialist, surgical consultant, and super-specialist consultation fee.',
        },
        {
            'service_code': 'SRV-APPT-FLUP',
            'name': 'Follow-Up Consultation Fee (Within 7 Days)',
            'category': ServiceCategory.OPD_CONSULTATION,
            'standard_price': Decimal('250.00'),
            'pricing_unit': PricingUnit.PER_VISIT,
            'description': 'Routine post-consultation review, report analysis, and medication titration.',
        },
        {
            'service_code': 'SRV-APPT-ONL',
            'name': 'Online Teleconsultation Fee',
            'category': ServiceCategory.OPD_CONSULTATION,
            'standard_price': Decimal('600.00'),
            'pricing_unit': PricingUnit.PER_VISIT,
            'description': 'Digital video teleconsultation via encrypted hospital telemedicine gateway.',
        },
        {
            'service_code': 'SRV-APPT-EMG',
            'name': 'Emergency Doctor Consultation Fee',
            'category': ServiceCategory.OPD_CONSULTATION,
            'standard_price': Decimal('1200.00'),
            'pricing_unit': PricingUnit.PER_VISIT,
            'description': 'Immediate emergency physician consultation, triage evaluation, and acute resuscitation.',
        },

        # B. Token Charges
        {
            'service_code': 'SRV-TOKN-REG',
            'name': 'OPD Token Registration Fee',
            'category': ServiceCategory.TOKEN_REGISTRATION,
            'standard_price': Decimal('100.00'),
            'pricing_unit': PricingUnit.ONE_TIME,
            'description': 'Front desk walk-in queue token registration and hospital card accessioning.',
        },
        {
            'service_code': 'SRV-TOKN-DEPT',
            'name': 'Department-Specific Priority Token Fee',
            'category': ServiceCategory.TOKEN_REGISTRATION,
            'standard_price': Decimal('150.00'),
            'pricing_unit': PricingUnit.ONE_TIME,
            'description': 'Fast-track priority queue token for high-volume diagnostic and clinical wings.',
        },
        {
            'service_code': 'SRV-TOKN-DOC',
            'name': 'Senior Consultant Fast-Track Token Fee',
            'category': ServiceCategory.TOKEN_REGISTRATION,
            'standard_price': Decimal('200.00'),
            'pricing_unit': PricingUnit.ONE_TIME,
            'description': 'Direct OPD token slot assignment for senior surgical and clinical heads.',
        },
        {
            'service_code': 'SRV-TOKN-EMG',
            'name': 'Emergency Casualty Triage Token Fee',
            'category': ServiceCategory.TOKEN_REGISTRATION,
            'standard_price': Decimal('250.00'),
            'pricing_unit': PricingUnit.ONE_TIME,
            'description': 'Immediate red/yellow category emergency room intake token.',
        },

        # C. Admission Charges
        {
            'service_code': 'SRV-ADM-REG',
            'name': 'Patient Inpatient Registration / Admission Fee',
            'category': ServiceCategory.ADMISSION_CHARGES,
            'standard_price': Decimal('1000.00'),
            'pricing_unit': PricingUnit.ONE_TIME,
            'description': 'Initial IPD medical records documentation, admission kit, and ID wristbanding.',
        },
        {
            'service_code': 'SRV-ADM-GEN',
            'name': 'General Inpatient Admission Processing Fee',
            'category': ServiceCategory.ADMISSION_CHARGES,
            'standard_price': Decimal('1500.00'),
            'pricing_unit': PricingUnit.ONE_TIME,
            'description': 'Routine elective ward admission processing and bed assignment overhead.',
        },
        {
            'service_code': 'SRV-ADM-EMG',
            'name': 'Emergency Casualty IPD Admission Charge',
            'category': ServiceCategory.ADMISSION_CHARGES,
            'standard_price': Decimal('2500.00'),
            'pricing_unit': PricingUnit.ONE_TIME,
            'description': 'Acute emergency room to inpatient step-up transfer and immediate stabilization charge.',
        },

        # D. Bed & Room Charges
        {
            'service_code': 'SRV-BED-GEN',
            'name': 'General Ward Bed Charge',
            'category': ServiceCategory.IPD_ROOM_BED,
            'standard_price': Decimal('1500.00'),
            'pricing_unit': PricingUnit.PER_DAY,
            'description': 'Shared multi-bed inpatient ward including basic telemetry, meals, and linen.',
        },
        {
            'service_code': 'SRV-BED-SEMI',
            'name': 'Semi-Private Room Bed Charge',
            'category': ServiceCategory.IPD_ROOM_BED,
            'standard_price': Decimal('2500.00'),
            'pricing_unit': PricingUnit.PER_DAY,
            'description': 'Twin-sharing room with motorized hospital bed, patient attendant couch, and attached bath.',
        },
        {
            'service_code': 'SRV-BED-PVT',
            'name': 'Single Private Room Charge',
            'category': ServiceCategory.IPD_ROOM_BED,
            'standard_price': Decimal('3500.00'),
            'pricing_unit': PricingUnit.PER_DAY,
            'description': 'Individual private room with climate control, entertainment suite, and dedicated attendant sofa.',
        },
        {
            'service_code': 'SRV-BED-DLX',
            'name': 'Executive Deluxe Suite Room Charge',
            'category': ServiceCategory.IPD_ROOM_BED,
            'standard_price': Decimal('5000.00'),
            'pricing_unit': PricingUnit.PER_DAY,
            'description': 'Premium hospital suite featuring patient lounge, pantry, and continuous nurse call telemetry.',
        },
        {
            'service_code': 'SRV-BED-ICU',
            'name': 'Intensive Care Unit (ICU) Bed Charge',
            'category': ServiceCategory.ICU_CARE,
            'standard_price': Decimal('7500.00'),
            'pricing_unit': PricingUnit.PER_DAY,
            'description': 'Multi-channel hemodynamic telemetry, invasive line monitoring, and 1:1 intensivist oversight.',
        },
        {
            'service_code': 'SRV-BED-NICU',
            'name': 'NICU / PICU Pediatric Intensive Care Bed Charge',
            'category': ServiceCategory.ICU_CARE,
            'standard_price': Decimal('6500.00'),
            'pricing_unit': PricingUnit.PER_DAY,
            'description': 'Neonatal and pediatric intensive incubator care, phototherapy, and warmers.',
        },

        # E. Other Hospital Services
        {
            'service_code': 'SRV-NURS-ROUT',
            'name': 'Routine Inpatient Nursing Care Charge',
            'category': ServiceCategory.NURSING,
            'standard_price': Decimal('500.00'),
            'pricing_unit': PricingUnit.PER_DAY,
            'description': 'Three-shift round-the-clock vital checks, IV fluid administration, and hygiene assistance.',
        },
        {
            'service_code': 'SRV-NURS-ICU',
            'name': 'Intensive Critical Nursing Care Charge',
            'category': ServiceCategory.NURSING,
            'standard_price': Decimal('1500.00'),
            'pricing_unit': PricingUnit.PER_DAY,
            'description': 'Continuous arterial line, ventilator suctioning, and vasoactive drug infusion management.',
        },
        {
            'service_code': 'SRV-PROC-DRESS',
            'name': 'Surgical Wound Dressing & Aseptic Care',
            'category': ServiceCategory.SURGERY_PROCEDURE,
            'standard_price': Decimal('400.00'),
            'pricing_unit': PricingUnit.ONE_TIME,
            'description': 'Sterile minor procedure room dressing change and surgical wound assessment.',
        },
        {
            'service_code': 'SRV-PROC-CATHT',
            'name': 'Catheterization & Invasive Line Insertion',
            'category': ServiceCategory.SURGERY_PROCEDURE,
            'standard_price': Decimal('850.00'),
            'pricing_unit': PricingUnit.ONE_TIME,
            'description': 'Sterile Foley catheter insertion, nasogastric intubation, or central venous line prep.',
        },
        {
            'service_code': 'SRV-LAB-CBC',
            'name': 'Complete Blood Count (CBC) with ESR',
            'category': ServiceCategory.DIAGNOSTIC_LAB,
            'standard_price': Decimal('350.00'),
            'pricing_unit': PricingUnit.PER_TEST,
            'description': 'Automated 5-part hematology analyzer count with differential and erythrocyte sedimentation.',
        },
        {
            'service_code': 'SRV-LAB-LFT',
            'name': 'Comprehensive Liver Function Test (LFT)',
            'category': ServiceCategory.DIAGNOSTIC_LAB,
            'standard_price': Decimal('750.00'),
            'pricing_unit': PricingUnit.PER_TEST,
            'description': 'Bilirubin (Total/Direct), SGOT, SGPT, Alkaline Phosphatase, Total Protein, and Albumin.',
        },
        {
            'service_code': 'SRV-RAD-XRAY',
            'name': 'Digital Chest X-Ray (PA View)',
            'category': ServiceCategory.RADIOLOGY_IMAGING,
            'standard_price': Decimal('600.00'),
            'pricing_unit': PricingUnit.PER_TEST,
            'description': 'High-resolution digital radiography chest examination with radiologist verification.',
        },
        {
            'service_code': 'SRV-RAD-USG',
            'name': 'Ultrasound Examination - Whole Abdomen & Pelvis',
            'category': ServiceCategory.RADIOLOGY_IMAGING,
            'standard_price': Decimal('1500.00'),
            'pricing_unit': PricingUnit.PER_TEST,
            'description': 'Color Doppler abdominal ultrasonography performed by consultant radiologist.',
        },
        {
            'service_code': 'SRV-PHARM-DISP',
            'name': 'Pharmacy Inpatient Dispensing & Reconciliation Charge',
            'category': ServiceCategory.PHARMACY,
            'standard_price': Decimal('50.00'),
            'pricing_unit': PricingUnit.ONE_TIME,
            'description': 'Pharmacist clinical review, unit-dose repackaging, and bedside delivery administration.',
        },
        {
            'service_code': 'SRV-AMB-BLS',
            'name': 'Basic Life Support (BLS) Ambulance Transfer',
            'category': ServiceCategory.AMBULANCE,
            'standard_price': Decimal('2000.00'),
            'pricing_unit': PricingUnit.PER_UNIT,
            'description': 'Hospital ambulance transit with oxygen, EMT paramedic, and stretcher immobilization (Within city).',
        },
        {
            'service_code': 'SRV-AMB-ALS',
            'name': 'Advanced Cardiac Life Support (ACLS) Ambulance Transfer',
            'category': ServiceCategory.AMBULANCE,
            'standard_price': Decimal('4500.00'),
            'pricing_unit': PricingUnit.PER_UNIT,
            'description': 'ICU-on-wheels ambulance with transport ventilator, multipara monitor, and defibrillator.',
        },
    ]

    @classmethod
    def seed_default_catalogue_if_empty(cls):
        """
        Populates standard hospital services if not present, ensuring every authorized
        charge category exists in Supabase PostgreSQL without hardcoding in the frontend.
        """
        for spec in cls.DEFAULT_SERVICES_SPEC:
            HospitalService.objects.get_or_create(
                service_code=spec['service_code'],
                defaults={
                    'name': spec['name'],
                    'category': spec['category'],
                    'standard_price': spec['standard_price'],
                    'pricing_unit': spec.get('pricing_unit', PricingUnit.ONE_TIME),
                    'description': spec.get('description', ''),
                    'is_active': True,
                    'applies_to_all_branches': True,
                }
            )

    @classmethod
    def get_services(cls, category=None, search=None, branch_id=None, is_active=None):
        """
        Retrieves hospital services with branch-specific resolved prices,
        pricing units, active statuses, and last updated metadata.
        """
        cls.seed_default_catalogue_if_empty()

        qs = HospitalService.objects.select_related('department', 'last_updated_by__user_profile')
        if category and category != 'ALL':
            qs = qs.filter(category=category)
        if is_active is not None:
            qs = qs.filter(is_active=is_active)
        if search:
            qs = qs.filter(
                models.Q(name__icontains=search) |
                models.Q(service_code__icontains=search) |
                models.Q(description__icontains=search)
            )

        active_branches_count = Branch.objects.filter(is_active=True).count() or 1
        today = timezone.localdate()

        results = []
        for s in qs:
            # Check branch override
            override = None
            if branch_id:
                override = s.branch_overrides.filter(
                    branch_id=branch_id,
                    is_active=True,
                    effective_from__lte=today
                ).filter(
                    models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today)
                ).first()

            current_price = override.override_price if override else s.standard_price
            is_overridden = bool(override)

            results.append({
                'id': str(s.id),
                'service_code': s.service_code,
                'name': s.name,
                'category': s.category,
                'category_display': s.get_category_display(),
                'department_id': str(s.department_id) if s.department_id else None,
                'department_name': s.department.name if s.department else 'Central Hospital Operations',
                'description': s.description,
                'standard_price': str(s.standard_price),
                'current_price': str(current_price),
                'is_branch_override': is_overridden,
                'pricing_unit': s.pricing_unit,
                'pricing_unit_display': s.get_pricing_unit_display(),
                'tax_rate': str(s.tax_rate),
                'is_active': s.is_active,
                'effective_from': str(s.effective_from),
                'applies_to_all_branches': s.applies_to_all_branches,
                'applicable_branches_count': active_branches_count if s.applies_to_all_branches else s.applicable_branches.count(),
                'applicable_branches_summary': 'All Active Branches' if s.applies_to_all_branches else f"{s.applicable_branches.count()} Branches",
                'last_updated_by': s.last_updated_by_name or (s.last_updated_by.user_profile.full_name if s.last_updated_by and getattr(s.last_updated_by, 'user_profile', None) else 'Hospital Administrator'),
                'last_updated_at': str(s.updated_at.strftime('%Y-%m-%d %H:%M')),
            })

        return results

    @classmethod
    def resolve_service_price(cls, service_code_or_id, branch_id=None, as_of_date=None) -> dict:
        """
        Dynamically resolves the applicable price in Indian Rupees (₹) for a given hospital service.
        Central pricing automatically applies across all branches unless an explicit override exists.
        """
        target_date = as_of_date or timezone.localdate()

        service = None
        try:
            service = HospitalService.objects.filter(id=service_code_or_id).first()
        except (ValueError, ValidationError):
            service = None

        if not service:
            service = HospitalService.objects.filter(service_code=service_code_or_id).first()

        if not service:
            # Fallback for unknown service
            return {
                'service_id': None,
                'service_code': str(service_code_or_id),
                'service_name': 'Hospital Service',
                'amount': Decimal('0.00'),
                'formatted_amount': '₹0.00',
                'pricing_unit': 'ONE_TIME',
                'pricing_unit_display': 'One-Time Charge',
                'is_override': False,
            }

        # Check for branch override
        override = None
        if branch_id:
            override = service.branch_overrides.filter(
                branch_id=branch_id,
                is_active=True,
                effective_from__lte=target_date
            ).filter(
                models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=target_date)
            ).first()

        resolved_price = override.override_price if override else service.standard_price

        return {
            'service_id': str(service.id),
            'service_code': service.service_code,
            'service_name': service.name,
            'category': service.category,
            'amount': resolved_price,
            'formatted_amount': f"₹{resolved_price:.2f}",
            'pricing_unit': service.pricing_unit,
            'pricing_unit_display': service.get_pricing_unit_display(),
            'tax_rate': service.tax_rate,
            'is_override': bool(override),
            'is_active': service.is_active,
        }

    @classmethod
    @transaction.atomic
    def update_service_price(
        cls,
        service_id,
        new_price,
        effective_date=None,
        reason='',
        user=None,
        applies_to_all_branches=True,
        branch_ids=None
    ) -> dict:
        """
        Updates the price for a hospital service across all branches or specific branches.
        Enforces:
        1. Role permission: HOSPITAL_ADMIN (or superuser) only.
        2. Immutable PriceChangeHistory creation. Never silently overwrites history.
        3. Synchronization across all branches and database models (e.g. Bed rates, Doctor fees).
        4. Existing admissions, appointments, and finalized invoices remain unchanged.
        """
        service = HospitalService.objects.select_for_update().filter(id=service_id).first()
        if not service:
            raise ValidationError(f"Service with id '{service_id}' does not exist.")

        new_rate = Decimal(str(new_price)).quantize(Decimal('0.01'))
        if new_rate < Decimal('0.00'):
            raise ValidationError("Price cannot be negative.")

        previous_price = service.standard_price
        target_effective_date = effective_date or timezone.localdate()

        staff = get_staff_profile(user) if user and not user.is_anonymous else None
        modifier_name = staff.user_profile.full_name if (staff and getattr(staff, 'user_profile', None)) else (user.email if user else 'Hospital Admin')

        # Check permissions: HOSPITAL_ADMIN, SUPER_ADMIN
        if user and not user.is_superuser:
            from apps.authentication.permissions import resolve_user_profile
            prof = getattr(user, 'profile', None) or resolve_user_profile(user)
            role_name = prof.role.name if prof and prof.role else ''
            if role_name not in [RoleEnum.HOSPITAL_ADMIN, RoleEnum.SUPER_ADMIN]:
                raise PermissionDenied("Only the authorized Hospital Admin can configure and modify hospital service tariffs.")

        branches_summary = "All Active Branches" if applies_to_all_branches else f"{len(branch_ids or [])} Selected Branches"

        # 1. Record Immutable Price Change History
        history = PriceChangeHistory.objects.create(
            service=service,
            previous_price=previous_price,
            new_price=new_rate,
            effective_date=target_effective_date,
            reason=reason or "Hospital Central Tariff Revision",
            modified_by=staff,
            modified_by_name=modifier_name,
            applicable_to_all_branches=applies_to_all_branches,
            affected_branches_summary=branches_summary,
        )

        if not applies_to_all_branches and branch_ids:
            selected_branches = Branch.objects.filter(id__in=branch_ids)
            history.applicable_branches.set(selected_branches)

            # Create or update BranchTariffOverrides
            for b in selected_branches:
                BranchTariffOverride.objects.update_or_create(
                    service=service,
                    branch=b,
                    defaults={
                        'override_price': new_rate,
                        'effective_from': target_effective_date,
                        'is_active': True,
                        'authorized_by': staff,
                    }
                )
        else:
            # Applies to all branches centrally
            service.standard_price = new_rate
            service.effective_from = target_effective_date
            service.applies_to_all_branches = True
            service.last_updated_by = staff
            service.last_updated_by_name = modifier_name
            service.save(update_fields=[
                'standard_price', 'effective_from', 'applies_to_all_branches',
                'last_updated_by', 'last_updated_by_name', 'updated_at'
            ])

            # Synchronize Bed daily rates across all active branches if Bed/Room service
            cls._synchronize_bed_rates(service, new_rate)

            # Synchronize Doctor consultation fees if General OPD consultation
            cls._synchronize_consultation_fees(service, new_rate)

        # Record BillingAuditEvent
        BillingAuditEvent.objects.create(
            action='PRICE_CHANGED',
            entity_name='HospitalService',
            entity_id=str(service.id),
            performed_by=staff,
            details={
                'service_code': service.service_code,
                'name': service.name,
                'previous_price': str(previous_price),
                'new_price': str(new_rate),
                'effective_date': str(target_effective_date),
                'reason': reason,
                'applies_to_all_branches': applies_to_all_branches,
                'affected_branches': branches_summary,
            }
        )

        return {
            'id': str(service.id),
            'service_code': service.service_code,
            'name': service.name,
            'previous_price': str(previous_price),
            'new_price': str(new_rate),
            'effective_date': str(target_effective_date),
            'reason': reason,
            'affected_branches_summary': branches_summary,
            'modified_by': modifier_name,
            'timestamp': str(history.created_at.strftime('%Y-%m-%d %H:%M')),
        }

    @classmethod
    def _synchronize_bed_rates(cls, service, new_rate):
        """
        Synchronizes Bed daily rates across all wards and branches matching this category,
        ensuring new patient admissions immediately receive the updated rate.
        Existing admissions retain their captured rate.
        """
        from apps.clinical.models import Bed

        category = service.category
        code = service.service_code

        if category in [ServiceCategory.IPD_ROOM_BED, ServiceCategory.ICU_CARE]:
            if 'GEN' in code or 'GENERAL' in service.name.upper():
                Bed.objects.filter(ward__ward_type='GENERAL').update(daily_rate=new_rate)
            elif 'SEMI' in code or 'SEMI' in service.name.upper():
                Bed.objects.filter(ward__ward_type='SEMI_PRIVATE').update(daily_rate=new_rate)
            elif 'PVT' in code or 'PRIVATE' in service.name.upper():
                Bed.objects.filter(ward__ward_type='PRIVATE').update(daily_rate=new_rate)
            elif 'DLX' in code or 'DELUXE' in service.name.upper():
                Bed.objects.filter(ward__ward_type='DELUXE').update(daily_rate=new_rate)
            elif 'ICU' in code or 'INTENSIVE' in service.name.upper():
                Bed.objects.filter(ward__ward_type='ICU').update(daily_rate=new_rate)
            elif 'NICU' in code or 'PICU' in service.name.upper():
                Bed.objects.filter(ward__ward_type__in=['NICU', 'PICU']).update(daily_rate=new_rate)

    @classmethod
    def _synchronize_consultation_fees(cls, service, new_rate):
        """
        When the central general OPD consultation fee is updated, syncs the baseline fee
        for doctors who don't have specialist overrides, keeping OPD bookings consistent.
        """
        if service.service_code == 'SRV-APPT-GEN':
            StaffProfile.objects.filter(
                user_profile__role__name=RoleEnum.DOCTOR,
                consultation_fee__lte=Decimal('500.00')
            ).update(consultation_fee=new_rate)

    @classmethod
    def toggle_service_status(cls, service_id, is_active, user=None):
        """
        Activates or deactivates a hospital service.
        """
        service = HospitalService.objects.filter(id=service_id).first()
        if not service:
            raise ValidationError("Service not found.")

        staff = get_staff_profile(user) if user and not user.is_anonymous else None

        # Check permissions
        if user and not user.is_superuser:
            from apps.authentication.permissions import resolve_user_profile
            prof = getattr(user, 'profile', None) or resolve_user_profile(user)
            role_name = prof.role.name if prof and prof.role else ''
            if role_name not in [RoleEnum.HOSPITAL_ADMIN, RoleEnum.SUPER_ADMIN]:
                raise PermissionDenied("Only the authorized Hospital Admin can change service active statuses.")

        service.is_active = is_active
        service.last_updated_by = staff
        service.last_updated_by_name = staff.user_profile.full_name if (staff and getattr(staff, 'user_profile', None)) else 'Hospital Admin'
        service.save(update_fields=['is_active', 'last_updated_by', 'last_updated_by_name', 'updated_at'])

        BillingAuditEvent.objects.create(
            action='SERVICE_STATUS_TOGGLED',
            entity_name='HospitalService',
            entity_id=str(service.id),
            performed_by=staff,
            details={'is_active': is_active, 'service_code': service.service_code}
        )

        return {'id': str(service.id), 'is_active': service.is_active}

    @classmethod
    def get_price_history(cls, service_id=None, limit=50):
        """
        Returns chronological immutable audit history of all price changes.
        """
        qs = PriceChangeHistory.objects.select_related('service', 'modified_by__user_profile').order_by('-created_at')
        if service_id:
            qs = qs.filter(service_id=service_id)

        history_records = []
        for h in qs[:limit]:
            history_records.append({
                'id': str(h.id),
                'service_id': str(h.service_id),
                'service_code': h.service.service_code,
                'service_name': h.service.name,
                'category': h.service.category,
                'category_display': h.service.get_category_display(),
                'previous_price': str(h.previous_price),
                'new_price': str(h.new_price),
                'difference': str(h.new_price - h.previous_price),
                'effective_date': str(h.effective_date),
                'reason': h.reason,
                'modified_by': h.modified_by_name or (h.modified_by.user_profile.full_name if (h.modified_by and getattr(h.modified_by, 'user_profile', None)) else 'Hospital Admin'),
                'timestamp': str(h.created_at.strftime('%Y-%m-%d %H:%M')),
                'applicable_to_all_branches': h.applicable_to_all_branches,
                'affected_branches_summary': h.affected_branches_summary,
            })

        return history_records

    @classmethod
    def preview_price_change(cls, service_id, new_price, effective_date=None, applies_to_all=True, branch_ids=None):
        """
        Calculates a preview of the price change before the Hospital Admin commits:
        shows previous price, new price, difference, effective date, affected branches.
        """
        service = HospitalService.objects.filter(id=service_id).first()
        if not service:
            raise ValidationError("Service not found.")

        new_rate = Decimal(str(new_price)).quantize(Decimal('0.01'))
        prev_rate = service.standard_price
        diff = new_rate - prev_rate
        pct_change = round((float(diff) / float(prev_rate) * 100), 2) if prev_rate > 0 else 100.0

        all_branches = list(Branch.objects.filter(is_active=True).values('id', 'name', 'code'))
        if applies_to_all:
            affected_branches = all_branches
        else:
            affected_branches = [b for b in all_branches if str(b['id']) in (branch_ids or [])]

        return {
            'service_id': str(service.id),
            'service_code': service.service_code,
            'service_name': service.name,
            'category': service.category,
            'category_display': service.get_category_display(),
            'pricing_unit': service.pricing_unit,
            'pricing_unit_display': service.get_pricing_unit_display(),
            'previous_price': str(prev_rate),
            'current_price': str(prev_rate),
            'new_price': str(new_rate),
            'difference': str(diff),
            'percentage_change': f"{pct_change:+0.1f}%",
            'effective_date': str(effective_date or timezone.localdate()),
            'applies_to_all_branches': applies_to_all,
            'total_branches_count': len(all_branches),
            'affected_branches': [{'id': str(b['id']), 'name': b['name'], 'code': b['code']} for b in affected_branches],
            'affected_branches_count': len(affected_branches),
        }
