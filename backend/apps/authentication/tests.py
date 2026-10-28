import uuid
from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.core.models import Hospital, Branch, Department, AuditLog
from apps.authentication.models import (
    Role,
    RoleEnum,
    Permission,
    UserProfile,
    StaffProfile,
    PatientProfile,
    GenderEnum,
    BloodGroupEnum,
    StaffStatus,
)
from apps.authentication.permissions import IsStaffMember, IsSuperAdmin, IsPatientOwner

User = get_user_model()


class TestStage3AuthenticationAndProvisioning(TestCase):
    """
    Automated integration and permission tests for Stage 3:
    - Patient Registration & Profile Initialization
    - Staff Provisioning (Admin-Only)
    - Privilege Escalation Prevention
    - Patient Isolation
    - DRF Custom Permission Classes
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Base Facility Setup
        self.hospital = Hospital.objects.create(
            name='AURA Test Hospital',
            code=f'HOSP-{uuid.uuid4().hex[:6]}',
            address_line1='100 Medical Blvd',
            city='Mumbai',
            state='Maharashtra',
            postal_code='400051',
        )
        self.branch = Branch.objects.create(
            hospital=self.hospital,
            name='AURA Test Main Branch',
            code=f'BR-{uuid.uuid4().hex[:6]}',
            address_line1='100 Medical Blvd',
            city='Mumbai',
            state='Maharashtra',
            postal_code='400051',
            is_main_branch=True,
        )
        self.department = Department.objects.create(
            branch=self.branch,
            name='Cardiology',
            code='CARD',
        )

        # 2. Roles Setup
        self.super_admin_role, _ = Role.objects.get_or_create(
            name=RoleEnum.SUPER_ADMIN,
            defaults={'display_name': 'Super Admin'}
        )
        self.doctor_role, _ = Role.objects.get_or_create(
            name=RoleEnum.DOCTOR,
            defaults={'display_name': 'Doctor'}
        )
        self.patient_role, _ = Role.objects.get_or_create(
            name=RoleEnum.PATIENT,
            defaults={'display_name': 'Patient'}
        )

        # 3. Super Admin User
        self.admin_supabase_id = uuid.uuid4()
        self.admin_django_user = User.objects.create_user(
            username=str(self.admin_supabase_id),
            email='admin@aurahms.org'
        )
        self.admin_profile = UserProfile.objects.create(
            supabase_user_id=self.admin_supabase_id,
            email='admin@aurahms.org',
            first_name='Admin',
            last_name='User',
            role=self.super_admin_role,
        )

        # 4. Patient User A
        self.patient_a_supabase_id = uuid.uuid4()
        self.patient_a_django_user = User.objects.create_user(
            username=str(self.patient_a_supabase_id),
            email='patient.a@example.com'
        )
        self.patient_a_profile = UserProfile.objects.create(
            supabase_user_id=self.patient_a_supabase_id,
            email='patient.a@example.com',
            first_name='Patient',
            last_name='Alpha',
            role=self.patient_role,
        )
        self.patient_a_record = PatientProfile.objects.create(
            user_profile=self.patient_a_profile,
            primary_branch=self.branch,
            medical_record_number='MRN-2026-00001',
            gender=GenderEnum.MALE,
            blood_group=BloodGroupEnum.O_POS,
        )

        # 5. Patient User B
        self.patient_b_supabase_id = uuid.uuid4()
        self.patient_b_django_user = User.objects.create_user(
            username=str(self.patient_b_supabase_id),
            email='patient.b@example.com'
        )
        self.patient_b_profile = UserProfile.objects.create(
            supabase_user_id=self.patient_b_supabase_id,
            email='patient.b@example.com',
            first_name='Patient',
            last_name='Beta',
            role=self.patient_role,
        )
        self.patient_b_record = PatientProfile.objects.create(
            user_profile=self.patient_b_profile,
            primary_branch=self.branch,
            medical_record_number='MRN-2026-00002',
            gender=GenderEnum.FEMALE,
            blood_group=BloodGroupEnum.A_POS,
        )

    def test_patient_profile_initialization_and_mrn_generation(self):
        new_patient_sub = uuid.uuid4()
        new_django_user = User.objects.create_user(
            username=str(new_patient_sub),
            email='aditi.sharma@test.org'
        )
        self.client.force_authenticate(user=new_django_user)

        url = reverse('authentication:patient-profile-init')
        payload = {
            'first_name': 'Aditi',
            'last_name': 'Sharma',
            'phone_number': '+91 98765 43210',
            'gender': GenderEnum.FEMALE,
            'blood_group': BloodGroupEnum.B_POS,
            'emergency_contact_name': 'Sunil Sharma',
            'emergency_contact_phone': '+91 98765 00000',
            'allergies': ['Aspirin'],
            'primary_branch_id': str(self.branch.id),
        }

        response = self.client.post(url, payload, format='json')
        assert response.status_code == 201
        data = response.json()
        assert data['medical_record_number'].startswith('MRN-')
        assert data['gender'] == GenderEnum.FEMALE
        assert data['blood_group'] == BloodGroupEnum.B_POS
        assert 'Aspirin' in data['allergies']

        # Verify created UserProfile has role = PATIENT strictly
        created_profile = UserProfile.objects.get(supabase_user_id=new_patient_sub)
        assert created_profile.role.name == RoleEnum.PATIENT

        # Verify audit log was recorded
        assert AuditLog.objects.filter(
            actor_user_id=new_patient_sub,
            action='PATIENT_SELF_REGISTERED'
        ).exists()

    def test_privilege_escalation_prevention_on_registration(self):
        """
        Public self-registration must NEVER grant staff roles, even if supplied.
        """
        attacker_sub = uuid.uuid4()
        attacker_user = User.objects.create_user(
            username=str(attacker_sub),
            email='attacker@test.org'
        )
        self.client.force_authenticate(user=attacker_user)

        url = reverse('authentication:patient-profile-init')
        payload = {
            'first_name': 'Malicious',
            'last_name': 'Actor',
            'role': 'SUPER_ADMIN',  # Attempting privilege escalation
            'gender': GenderEnum.MALE,
            'primary_branch_id': str(self.branch.id),
        }

        response = self.client.post(url, payload, format='json')
        assert response.status_code == 201

        # The role must still strictly be PATIENT
        user_profile = UserProfile.objects.get(supabase_user_id=attacker_sub)
        assert user_profile.role.name == RoleEnum.PATIENT
        assert user_profile.role.name != RoleEnum.SUPER_ADMIN

    def test_staff_provisioning_by_super_admin(self):
        self.client.force_authenticate(user=self.admin_django_user)

        url = reverse('authentication:staff-provision')
        payload = {
            'email': 'dr.verma@aurahms.org',
            'first_name': 'Rajesh',
            'last_name': 'Verma',
            'phone_number': '+91 98200 44556',
            'role': RoleEnum.DOCTOR,
            'branch_id': str(self.branch.id),
            'department_id': str(self.department.id),
            'designation': 'Senior Consultant Cardiologist',
            'specialization': 'Electrophysiology',
            'medical_license_number': 'MCI-19482',
            'consultation_fee': '1200.00',
        }

        response = self.client.post(url, payload, format='json')
        assert response.status_code == 201
        data = response.json()
        assert data['employee_id'].startswith('EMP-DOC-')
        assert data['designation'] == 'Senior Consultant Cardiologist'
        assert data['consultation_fee'] == '1200.00'

        # Verify staff profile exists in DB
        staff = StaffProfile.objects.get(employee_id=data['employee_id'])
        assert staff.user_profile.role.name == RoleEnum.DOCTOR
        assert staff.branch == self.branch
        assert staff.department == self.department

    def test_non_admin_cannot_provision_staff(self):
        """
        Patients and non-admin users must be rejected with 403 Forbidden.
        """
        self.client.force_authenticate(user=self.patient_a_django_user)

        url = reverse('authentication:staff-provision')
        payload = {
            'email': 'fake.staff@aurahms.org',
            'first_name': 'Fake',
            'last_name': 'Staff',
            'role': RoleEnum.DOCTOR,
            'branch_id': str(self.branch.id),
            'designation': 'Doctor',
        }

        response = self.client.post(url, payload, format='json')
        assert response.status_code == 403

    def test_current_user_me_endpoint(self):
        self.client.force_authenticate(user=self.patient_a_django_user)
        url = reverse('authentication:current-user')

        response = self.client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data['is_initialized'] is True
        assert data['role'] == RoleEnum.PATIENT
        assert data['user']['email'] == 'patient.a@example.com'
        assert 'patient_profile' in data
        assert data['patient_profile']['medical_record_number'] == 'MRN-2026-00001'

    def test_patient_data_isolation_permission(self):
        """
        Validates IsPatientOwner permission:
        Patient A is allowed on Patient A's record, but denied on Patient B's record.
        """
        permission = IsPatientOwner()

        class MockRequest:
            def __init__(self, user, username):
                self.user = user
                self.user.username = username
                self.is_authenticated = True

        req_a = MockRequest(self.patient_a_django_user, str(self.patient_a_supabase_id))
        req_b = MockRequest(self.patient_b_django_user, str(self.patient_b_supabase_id))

        # Patient A checking Patient A record -> Allowed
        assert permission.has_object_permission(req_a, None, self.patient_a_record) is True

        # Patient A checking Patient B record -> Denied
        assert permission.has_object_permission(req_a, None, self.patient_b_record) is False

        # Patient B checking Patient B record -> Allowed
        assert permission.has_object_permission(req_b, None, self.patient_b_record) is True

    def test_all_21_pdf_roles_exist_and_queryable(self):
        """
        PDF explicitly mandates all 21 specific roles.
        """
        from django.core.management import call_command
        call_command('seed_section4_rbac')

        expected_roles = [
            'SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MEDICAL_DIRECTOR', 'DOCTOR',
            'NURSE', 'RECEPTIONIST', 'BILLING_EXECUTIVE', 'LAB_TECHNICIAN',
            'RADIOLOGY_TECHNICIAN', 'PHARMACIST', 'INVENTORY_MANAGER',
            'PROCUREMENT_OFFICER', 'ACCOUNTANT', 'FINANCE_MANAGER',
            'INVESTMENT_MANAGER', 'CASHIER', 'INSURANCE_COORDINATOR',
            'HR_MANAGER', 'DEPARTMENT_HEAD', 'AUDITOR', 'PATIENT'
        ]
        self.client.force_authenticate(user=self.admin_django_user)
        res = self.client.get('/api/v1/auth/roles/')
        assert res.status_code == 200
        roles_data = res.json()
        role_names = [r['name'] for r in roles_data]

        for expected in expected_roles:
            assert expected in role_names, f"Expected role {expected} missing from role list!"

    def test_user_administration_list_and_update_role(self):
        """
        Super admin can view users and reassign role.
        """
        self.client.force_authenticate(user=self.admin_django_user)
        res = self.client.get('/api/v1/auth/users/')
        assert res.status_code == 200

        # Update patient_a's role to DOCTOR
        url = f"/api/v1/auth/users/{self.patient_a_profile.id}/"
        res2 = self.client.patch(url, {'role_name': 'DOCTOR'}, format='json')
        assert res2.status_code == 200

        self.patient_a_profile.refresh_from_db()
        assert self.patient_a_profile.role.name == 'DOCTOR'

    def test_prevent_deactivating_last_super_admin(self):
        """
        Security rule: System must prevent accidental deactivation of the last Super Administrator.
        """
        self.client.force_authenticate(user=self.admin_django_user)
        url = f"/api/v1/auth/users/{self.admin_profile.id}/"
        res = self.client.patch(url, {'is_active': False}, format='json')
        assert res.status_code == 400
        assert 'last active Super Administrator' in res.json()['error']

    def test_financial_approval_separation_of_duties_enforcement(self):
        """
        PDF mandate: Separation of duties prevents transaction creators from approving their own financial operations.
        """
        from apps.authentication.models import FinancialApprovalRequest, ApprovalRequestStatus

        # Create staff profile for doctor
        staff_doc = StaffProfile.objects.create(
            user_profile=self.admin_profile,
            hospital=self.hospital,
            branch=self.branch,
            department=self.department,
            employee_id='EMP-ADM-001',
            designation='Admin Staff',
            status='ACTIVE'
        )

        req = FinancialApprovalRequest.objects.create(
            request_number=f"FAR-{uuid.uuid4().hex[:6].upper()}",
            operation_type='REFUND_REVERSAL',
            entity_type='Payment',
            entity_id=uuid.uuid4(),
            amount=Decimal('15000.00'),
            reason='Patient admission cancelled post fee deposit',
            requested_by=staff_doc,
            requires_separation_of_duties=True,
            status=ApprovalRequestStatus.PENDING
        )

        # Creator attempts to approve self
        self.client.force_authenticate(user=self.admin_django_user)
        url = f"/api/v1/auth/financial-approvals/{req.id}/action/"
        res = self.client.post(url, {'action': 'APPROVE', 'comments': 'Self approval attempt'}, format='json')
        assert res.status_code == 403
        assert 'Separation of duties violation' in res.json()['error']

        # Now approve with another authorized reviewer
        fin_uid = uuid.uuid4()
        reviewer_user = User.objects.create_user(username=str(fin_uid), email='fin.mgr@aurahms.org')
        fin_role, _ = Role.objects.get_or_create(name='FINANCE_MANAGER', defaults={'display_name': 'Finance Manager'})
        fin_prof = UserProfile.objects.create(
            supabase_user_id=fin_uid,
            email='fin.mgr@aurahms.org',
            first_name='Finance',
            last_name='Head',
            role=fin_role
        )
        fin_staff = StaffProfile.objects.create(
            user_profile=fin_prof,
            hospital=self.hospital,
            branch=self.branch,
            department=self.department,
            employee_id='EMP-FIN-001',
            designation='Finance Manager',
            status='ACTIVE'
        )

        self.client.force_authenticate(user=reviewer_user)
        res2 = self.client.post(url, {'action': 'APPROVE', 'comments': 'Verified bank statement reversal'}, format='json')
        assert res2.status_code == 200

        req.refresh_from_db()
        assert req.status == ApprovalRequestStatus.APPROVED
        assert req.reviewed_by == fin_staff
        assert req.status == ApprovalRequestStatus.APPROVED
        assert req.reviewed_by == fin_staff

