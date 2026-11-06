import uuid
import datetime
from django.db import transaction
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema, OpenApiResponse

from apps.core.models import Branch, Department, AuditLog
from apps.authentication.models import (
    Role,
    RoleEnum,
    UserProfile,
    StaffProfile,
    PatientProfile,
    StaffStatus,
)
from apps.authentication.permissions import IsStaffMember, IsSuperAdmin, HasRole, resolve_user_profile
from apps.authentication.rbac_matrix import (
    ROLE_MODULE_ACTIONS,
    STRICT_READ_ONLY_ROLES,
    HR_ASSIGNABLE_ROLES,
    get_role_data_scope,
)
from apps.core.activity_log_service import ActivityLogService
from apps.authentication.serializers import (
    UserProfileSerializer,
    StaffProfileSerializer,
    PatientProfileSerializer,
    PatientProfileInitSerializer,
    StaffProvisioningSerializer,
    RoleSerializer,
)


class CurrentUserView(APIView):
    """
    Returns the authenticated user's profile, role, assigned permissions,
    and attached staff or patient profile.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get Current User Profile & Permissions",
        responses={200: OpenApiResponse(description="User session details")},
    )
    def get(self, request):
        claims = getattr(request, 'supabase_claims', {})
        sub = claims.get('sub') or request.user.username

        try:
            user_profile = UserProfile.objects.select_related(
                'role'
            ).prefetch_related('role__permissions').get(supabase_user_id=sub)
        except UserProfile.DoesNotExist:
            return Response({
                'is_initialized': False,
                'email': request.user.email or claims.get('email', ''),
                'supabase_user_id': sub,
                'claims': claims,
                'message': 'Profile has not been initialized in HMS. Complete profile initialization.',
            }, status=status.HTTP_200_OK)

        role_name = user_profile.role.name
        data = {
            'is_initialized': True,
            'user': UserProfileSerializer(user_profile).data,
            'role': role_name,
            'permissions': [p.code for p in user_profile.role.permissions.all()],
            'module_permissions': ROLE_MODULE_ACTIONS.get(role_name, {}),
            'data_scope': get_role_data_scope(role_name),
            'is_read_only': role_name in STRICT_READ_ONLY_ROLES,
            'claims': claims,
        }

        # Attach Staff or Patient profile if available
        if hasattr(user_profile, 'staff_profile'):
            data['staff_profile'] = StaffProfileSerializer(user_profile.staff_profile).data
        elif hasattr(user_profile, 'patient_profile'):
            data['patient_profile'] = PatientProfileSerializer(user_profile.patient_profile).data

        return Response(data, status=status.HTTP_200_OK)


class PatientProfileInitView(APIView):
    """
    Initializes a patient profile for an authenticated Supabase user.
    Strictly forces role to PATIENT server-side, preventing privilege escalation.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Initialize Patient Profile",
        request=PatientProfileInitSerializer,
        responses={201: PatientProfileSerializer},
    )
    @transaction.atomic
    def post(self, request):
        serializer = PatientProfileInitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        claims = getattr(request, 'supabase_claims', {})
        supabase_uid = claims.get('sub') or request.user.username
        email = request.user.email or claims.get('email', f"patient_{uuid.uuid4().hex[:6]}@example.com")

        # Resolve PATIENT role
        patient_role, _ = Role.objects.get_or_create(
            name=RoleEnum.PATIENT,
            defaults={'display_name': 'Patient', 'description': 'Patient self-service portal'}
        )

        # Resolve primary branch
        branch_id = validated_data.get('primary_branch_id')
        if branch_id:
            try:
                branch = Branch.objects.get(id=branch_id, is_active=True)
            except Branch.DoesNotExist:
                return Response(
                    {'primary_branch_id': ['Branch not found or inactive.']},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            branch = Branch.objects.filter(is_main_branch=True, is_active=True).first()
            if not branch:
                branch = Branch.objects.filter(is_active=True).first()

        if not branch:
            return Response(
                {'error': 'No active hospital branch available for registration.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Extract user profile attributes
        first_name = validated_data.get('first_name') or claims.get('user_metadata', {}).get('first_name', '')
        last_name = validated_data.get('last_name') or claims.get('user_metadata', {}).get('last_name', '')
        phone_number = validated_data.get('phone_number') or claims.get('user_metadata', {}).get('phone_number', '')

        user_profile, created = UserProfile.objects.update_or_create(
            supabase_user_id=supabase_uid,
            defaults={
                'email': email,
                'first_name': first_name or 'Patient',
                'last_name': last_name or '',
                'phone_number': phone_number,
                'role': patient_role,
                'is_verified': True,
                'is_active': True,
            }
        )

        # Generate unique MRN if patient profile does not exist
        if not hasattr(user_profile, 'patient_profile'):
            year = datetime.date.today().year
            count = PatientProfile.objects.count() + 1
            mrn = f"MRN-{year}-{count:05d}"
            while PatientProfile.objects.filter(medical_record_number=mrn).exists():
                count += 1
                mrn = f"MRN-{year}-{count:05d}"

            patient_profile = PatientProfile.objects.create(
                user_profile=user_profile,
                primary_branch=branch,
                medical_record_number=mrn,
                date_of_birth=validated_data.get('date_of_birth'),
                gender=validated_data.get('gender'),
                blood_group=validated_data.get('blood_group', ''),
                emergency_contact_name=validated_data.get('emergency_contact_name', ''),
                emergency_contact_phone=validated_data.get('emergency_contact_phone', ''),
                emergency_contact_relation=validated_data.get('emergency_contact_relation', ''),
                allergies=validated_data.get('allergies', []),
                chronic_conditions=validated_data.get('chronic_conditions', []),
                insurance_provider=validated_data.get('insurance_provider', ''),
                insurance_policy_number=validated_data.get('insurance_policy_number', ''),
            )

            # Record audit event
            AuditLog.objects.create(
                actor_user_id=user_profile.supabase_user_id,
                actor_email=user_profile.email,
                action='PATIENT_SELF_REGISTERED',
                entity_type='PatientProfile',
                entity_id=str(patient_profile.id),
                branch=branch,
                new_values={'mrn': mrn, 'branch': branch.name},
            )
        else:
            patient_profile = user_profile.patient_profile

        return Response(
            PatientProfileSerializer(patient_profile).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class StaffProvisioningView(APIView):
    """
    Administrator-only endpoint for provisioning staff accounts.
    Strictly forbids public staff signup. Enforces branch assignment and role control server-side.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Provision Staff Member (Admin Only)",
        request=StaffProvisioningSerializer,
        responses={201: StaffProfileSerializer},
    )
    @transaction.atomic
    def post(self, request):
        # 1. Authorization check: Strictly Super Admin or HR Manager ONLY.
        # Branch Manager / Hospital Admin are strictly forbidden from creating staff accounts.
        requester_profile = resolve_user_profile(request)
        is_authorized = request.user.is_superuser or (
            requester_profile and requester_profile.role and requester_profile.role.name in [RoleEnum.SUPER_ADMIN, RoleEnum.HR_MANAGER]
        )

        if not is_authorized:
            ActivityLogService.record(
                action='STAFF_PROVISION_DENIED',
                entity_type='StaffProfile',
                module='USERS_ROLES',
                request=request,
                user_profile=requester_profile,
                status='DENIED',
                description='Unauthorized attempt to provision staff account. Only Super Admin or HR Manager can provision staff.',
            )
            return Response(
                {'detail': 'Only Super Administrators or HR Managers can provision staff accounts. Branch Managers have read-only monitoring access.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 2. Validate input payload
        serializer = StaffProvisioningSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        email = data['email'].lower().strip()
        role_name = data['role']
        branch_id = data['branch_id']
        dept_id = data.get('department_id')

        # Enforce HR Manager role assignment restrictions & branch scoping
        if not request.user.is_superuser and requester_profile and requester_profile.role.name == RoleEnum.HR_MANAGER:
            if role_name not in HR_ASSIGNABLE_ROLES:
                ActivityLogService.record(
                    action='PRIVILEGE_ESCALATION_DENIED',
                    entity_type='StaffProfile',
                    module='USERS_ROLES',
                    request=request,
                    user_profile=requester_profile,
                    status='DENIED',
                    description=f"HR Manager attempted to assign restricted administrative role '{role_name}'.",
                )
                return Response(
                    {'detail': f"HR Managers can only assign approved operational roles and cannot assign '{role_name}'."},
                    status=status.HTTP_403_FORBIDDEN
                )
            hr_staff = getattr(requester_profile, 'staff_profile', None)
            if hr_staff and hr_staff.branch_id and str(branch_id) != str(hr_staff.branch_id):
                return Response(
                    {'detail': 'HR Managers can only provision staff within their assigned hospital branch.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Check if staff with this email already exists
        if UserProfile.objects.filter(email=email).exists():
            return Response(
                {'email': ['A user with this email address already exists.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        branch = Branch.objects.get(id=branch_id)
        department = Department.objects.get(id=dept_id) if dept_id else None
        role = Role.objects.get(name=role_name)

        # 3. Provision Identity in Supabase Auth (or generate deterministic test UUID)
        supabase_uid = None
        supabase_secret = getattr(settings, 'SUPABASE_SECRET_KEY', None)
        supabase_url = getattr(settings, 'SUPABASE_URL', None)

        if supabase_secret and supabase_url and not supabase_url.startswith('https://placeholder'):
            try:
                from supabase import create_client
                supabase_client = create_client(supabase_url, supabase_secret)
                # Invite user via Supabase admin auth
                invite_res = supabase_client.auth.admin.invite_user_by_email(email)
                if invite_res and hasattr(invite_res, 'user') and invite_res.user:
                    supabase_uid = uuid.UUID(invite_res.user.id)
            except Exception as e:
                # If Supabase API errors or SMTP is not set up, generate local UUID
                supabase_uid = uuid.uuid4()
        else:
            supabase_uid = uuid.uuid4()

        if not supabase_uid:
            supabase_uid = uuid.uuid4()

        # 4. Create UserProfile
        user_profile = UserProfile.objects.create(
            supabase_user_id=supabase_uid,
            email=email,
            first_name=data['first_name'],
            last_name=data['last_name'],
            phone_number=data.get('phone_number', ''),
            role=role,
            is_verified=True,
            is_active=True,
        )

        # 5. Generate employee ID: e.g. EMP-DOC-0042
        prefix = 'DOC' if role.name == RoleEnum.DOCTOR else 'NUR' if role.name == RoleEnum.NURSE else 'STF'
        year = datetime.date.today().year
        count = StaffProfile.objects.count() + 1
        employee_id = f"EMP-{prefix}-{year}-{count:04d}"
        while StaffProfile.objects.filter(employee_id=employee_id).exists():
            count += 1
            employee_id = f"EMP-{prefix}-{year}-{count:04d}"

        # 6. Create StaffProfile
        staff_profile = StaffProfile.objects.create(
            user_profile=user_profile,
            hospital=branch.hospital,
            branch=branch,
            department=department,
            employee_id=employee_id,
            designation=data['designation'],
            specialization=data.get('specialization', ''),
            medical_license_number=data.get('medical_license_number', ''),
            qualification=data.get('qualification', ''),
            consultation_fee=data.get('consultation_fee', 0.00),
            status=StaffStatus.ACTIVE,
            is_on_duty=True,
            joining_date=datetime.date.today(),
        )

        # 7. Record Audit Event via ActivityLogService
        ActivityLogService.record(
            action='STAFF_PROVISIONED',
            entity_type='StaffProfile',
            entity_id=str(staff_profile.id),
            module='USERS_ROLES',
            request=request,
            user_profile=requester_profile,
            branch=branch,
            new_values={
                'employee_id': employee_id,
                'email': email,
                'role': role.name,
                'branch': branch.name,
                'department': department.name if department else None,
            },
            description=f"Provisioned staff account {employee_id} ({email}) as {role.display_name} in {branch.name}.",
        )

        return Response(
            StaffProfileSerializer(staff_profile).data,
            status=status.HTTP_201_CREATED
        )


class StaffDirectoryView(APIView):
    """
    Returns active clinical staff directory (e.g. Doctors, Surgeons)
    filterable by branch and department.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List Active Hospital Staff Directory",
        responses={200: StaffProfileSerializer(many=True)},
    )
    def get(self, request):
        qs = StaffProfile.objects.filter(
            status=StaffStatus.ACTIVE,
            user_profile__is_active=True
        ).select_related(
            'user_profile', 'user_profile__role', 'branch', 'department'
        )

        branch_id = request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        department_id = request.query_params.get('department_id')
        if department_id:
            qs = qs.filter(department_id=department_id)

        role = request.query_params.get('role')
        if role:
            qs = qs.filter(user_profile__role__name=role)

        serializer = StaffProfileSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RoleListView(APIView):
    """
    Lists system roles for administration assignment.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = Role.objects.filter(is_active=True).prefetch_related('permissions')
        return Response(RoleSerializer(roles, many=True).data, status=status.HTTP_200_OK)


class UserPreferencesView(APIView):
    """
    Retrieves and updates individual user preferences, including preferred language.
    Available to ALL authenticated users (staff, doctors, nurses, admins, patients).
    """
    permission_classes = [IsAuthenticated]

    SUPPORTED_LANGUAGES = ['en', 'te', 'hi', 'ta', 'kn']

    def get_user_profile(self, request):
        claims = getattr(request, 'supabase_claims', {})
        sub = claims.get('sub') or request.user.username
        try:
            return UserProfile.objects.get(supabase_user_id=sub)
        except (UserProfile.DoesNotExist, ValueError):
            email = getattr(request.user, 'email', '') or claims.get('email', '')
            if email:
                return UserProfile.objects.filter(email=email).first()
            return None

    def get(self, request):
        profile = self.get_user_profile(request)
        if not profile:
            return Response({
                'status': 'error',
                'error': 'UserProfile not found for current session.',
                'preferred_language': 'en',
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'status': 'success',
            'preferred_language': profile.preferred_language or 'en',
            'supported_languages': self.SUPPORTED_LANGUAGES,
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        profile = self.get_user_profile(request)
        if not profile:
            return Response({
                'status': 'error',
                'error': 'UserProfile not found for current session.',
            }, status=status.HTTP_404_NOT_FOUND)

        lang = request.data.get('preferred_language') or request.data.get('language')
        if not lang or not isinstance(lang, str):
            return Response({
                'status': 'error',
                'error': 'preferred_language field is required.',
            }, status=status.HTTP_400_BAD_REQUEST)

        clean_lang = lang.lower().strip()
        if clean_lang not in self.SUPPORTED_LANGUAGES:
            return Response({
                'status': 'error',
                'error': f"Unsupported language '{lang}'. Supported codes: {', '.join(self.SUPPORTED_LANGUAGES)}",
            }, status=status.HTTP_400_BAD_REQUEST)

        profile.preferred_language = clean_lang
        profile.save(update_fields=['preferred_language', 'updated_at'])

        return Response({
            'status': 'success',
            'preferred_language': profile.preferred_language,
            'message': 'Language preference saved successfully.',
        }, status=status.HTTP_200_OK)

    def post(self, request):
        return self.patch(request)
