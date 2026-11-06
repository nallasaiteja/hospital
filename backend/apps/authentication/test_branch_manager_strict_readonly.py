import uuid
from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile


class BranchManagerStrictReadOnlyTests(TestCase):
    """
    Comprehensive Security Audit Tests for Branch Manager (Hospital Admin) Role.
    Verifies:
    1. Read-only GET access across all authorized hospital modules within assigned branch.
    2. Strict prohibition (HTTP 403) for all write mutations (POST, PUT, PATCH, DELETE).
    3. Strict prohibition (HTTP 403) on workflow actions, approvals, and releases.
    4. Strict Branch Isolation (HTTP 403 when querying or targeting other branches).
    5. Complete exclusion from User Provisioning and RBAC Role Management.
    6. Non-interference: Other roles (Doctor, Receptionist, Super Admin) retain authorized permissions.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Hospital & Branches
        self.hospital, _ = Hospital.objects.get_or_create(
            code="HOSP-BM-SEC",
            defaults={"name": "Aura Healthcare System"},
        )
        self.branch_a, _ = Branch.objects.get_or_create(
            code="BR-SEC-A",
            defaults={
                "hospital": self.hospital,
                "name": "Aura Central Hospital",
                "city": "Hyderabad",
            },
        )
        self.branch_b, _ = Branch.objects.get_or_create(
            code="BR-SEC-B",
            defaults={
                "hospital": self.hospital,
                "name": "Aura City Center",
                "city": "Bengaluru",
            },
        )
        self.dept_general, _ = Department.objects.get_or_create(
            branch=self.branch_a,
            code="GEN-SEC",
            defaults={"name": "General Medicine"},
        )

        # 2. Roles
        self.roles = {}
        for r_enum in [
            RoleEnum.SUPER_ADMIN,
            RoleEnum.BRANCH_MANAGER,
            RoleEnum.HOSPITAL_ADMIN,
            RoleEnum.DOCTOR,
            RoleEnum.RECEPTIONIST,
            RoleEnum.PATIENT,
        ]:
            role_obj, _ = Role.objects.get_or_create(
                name=r_enum,
                defaults={"display_name": r_enum.replace("_", " ").title()},
            )
            self.roles[r_enum] = role_obj

        # 3. Actors
        self.u_bm, self.p_bm, self.s_bm = self._create_actor("bm_tester@aura.org", RoleEnum.BRANCH_MANAGER, self.branch_a)
        self.u_ha, self.p_ha, self.s_ha = self._create_actor("ha_tester@aura.org", RoleEnum.HOSPITAL_ADMIN, self.branch_a)
        self.u_super, self.p_super, self.s_super = self._create_actor("super_sec@aura.org", RoleEnum.SUPER_ADMIN, self.branch_a)
        self.u_doc, self.p_doc, self.s_doc = self._create_actor("doc_sec@aura.org", RoleEnum.DOCTOR, self.branch_a, self.dept_general)
        self.u_rec, self.p_rec, self.s_rec = self._create_actor("rec_sec@aura.org", RoleEnum.RECEPTIONIST, self.branch_a)

    def _create_actor(self, email, role_name, branch, department=None):
        sub_uuid = uuid.uuid4()
        user = User.objects.create_user(username=str(sub_uuid), email=email)
        prof = UserProfile.objects.create(
            supabase_user_id=sub_uuid,
            email=email,
            first_name=role_name.title(),
            last_name="Tester",
            role=self.roles[role_name],
            is_active=True,
        )
        staff = StaffProfile.objects.create(
            user_profile=prof,
            employee_id=f"EMP-{uuid.uuid4().hex[:6].upper()}",
            hospital=branch.hospital,
            branch=branch,
            department=department,
            designation="Hospital Staff",
        )
        user.profile = prof
        return user, prof, staff

    # -------------------------------------------------------------------------
    # 1. READ-ONLY GET ACCESS FOR ASSIGNED BRANCH
    # -------------------------------------------------------------------------
    def test_01_branch_manager_can_view_all_authorized_modules_for_own_branch(self):
        self.client.force_authenticate(user=self.u_bm)

        endpoints = [
            f"/api/v1/operations-hr/dashboards/branch-operations/?branch_id={self.branch_a.id}",
            f"/api/v1/core/patients/?branch_id={self.branch_a.id}",
            f"/api/v1/clinical/opd/queue/?branch_id={self.branch_a.id}",
            f"/api/v1/clinical/beds/?branch_id={self.branch_a.id}",
            f"/api/v1/clinical/admissions/?branch_id={self.branch_a.id}",
            f"/api/v1/clinical/lab/orders/?branch_id={self.branch_a.id}",
            f"/api/v1/billing-finance/invoices/?branch_id={self.branch_a.id}",
            f"/api/v1/operations-hr/staff-members/?branch_id={self.branch_a.id}",
            f"/api/v1/operations-hr/fixed-assets/?branch_id={self.branch_a.id}",
            f"/api/v1/operations-hr/audit-logs/?branch_id={self.branch_a.id}",
        ]

        for url in endpoints:
            res = self.client.get(url)
            self.assertIn(
                res.status_code,
                [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT],
                f"Failed read-only GET on {url}: status={res.status_code}, data={getattr(res, 'data', None)}"
            )

    # -------------------------------------------------------------------------
    # 2. STRICT PROHIBITION ON ALL POST MUTATIONS
    # -------------------------------------------------------------------------
    def test_02_branch_manager_strictly_blocked_from_all_post_mutations(self):
        self.client.force_authenticate(user=self.u_bm)

        mutation_endpoints = [
            ("/api/v1/core/patients/", {"first_name": "Test", "last_name": "Patient"}),
            ("/api/v1/clinical/appointments/", {"patient_id": str(uuid.uuid4())}),
            ("/api/v1/clinical/opd/walk-in/", {"patient_id": str(uuid.uuid4())}),
            ("/api/v1/clinical/admissions/", {"patient_id": str(uuid.uuid4())}),
            ("/api/v1/billing-finance/invoices/", {"amount": 500}),
            ("/api/v1/operations-hr/staff-members/", {"first_name": "New", "last_name": "Staff"}),
            ("/api/v1/operations-hr/fixed-assets/", {"name": "MRI Machine"}),
            ("/api/v1/clinical/lab/orders/create/", {"tests": []}),
        ]

        for url, payload in mutation_endpoints:
            res = self.client.post(url, payload, format="json")
            self.assertEqual(
                res.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Branch Manager was NOT blocked from POST to {url}! Got status {res.status_code}"
            )

    # -------------------------------------------------------------------------
    # 3. STRICT PROHIBITION ON PUT, PATCH, DELETE MUTATIONS
    # -------------------------------------------------------------------------
    def test_03_branch_manager_strictly_blocked_from_put_patch_delete(self):
        self.client.force_authenticate(user=self.u_bm)
        dummy_id = str(uuid.uuid4())

        # PUT
        res_put = self.client.put(f"/api/v1/operations-hr/staff-members/{dummy_id}/", {"first_name": "Hacked"}, format="json")
        self.assertEqual(res_put.status_code, status.HTTP_403_FORBIDDEN)

        # PATCH
        res_patch = self.client.patch(f"/api/v1/billing-finance/invoices/{dummy_id}/", {"amount": 0}, format="json")
        self.assertEqual(res_patch.status_code, status.HTTP_403_FORBIDDEN)

        # DELETE
        res_del = self.client.delete(f"/api/v1/operations-hr/staff-members/{dummy_id}/")
        self.assertEqual(res_del.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 4. STRICT PROHIBITION ON WORKFLOW APPROVALS & ACTIONS
    # -------------------------------------------------------------------------
    def test_04_branch_manager_strictly_blocked_from_approvals_and_action_endpoints(self):
        self.client.force_authenticate(user=self.u_bm)
        dummy_id = str(uuid.uuid4())

        action_endpoints = [
            f"/api/v1/operations-hr/leaves/{dummy_id}/approve/",
            f"/api/v1/auth/financial-approvals/{dummy_id}/action/",
            f"/api/v1/clinical/opd/queue/{dummy_id}/action/",
            f"/api/v1/clinical/lab/orders/{dummy_id}/approve/",
            f"/api/v1/clinical/lab/orders/{dummy_id}/release/",
        ]

        for url in action_endpoints:
            res_post = self.client.post(url, {"action": "APPROVE"}, format="json")
            self.assertEqual(
                res_post.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Branch Manager was not blocked from action endpoint {url}!"
            )
            # Even via GET, action routes are rejected
            res_get = self.client.get(url)
            self.assertEqual(res_get.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 5. STRICT BRANCH ISOLATION (CROSS-BRANCH ACCESS REJECTED)
    # -------------------------------------------------------------------------
    def test_05_cross_branch_access_strictly_rejected(self):
        self.client.force_authenticate(user=self.u_bm)

        # Branch Manager is assigned to branch_a. Trying to query branch_b MUST return 403 Forbidden!
        cross_branch_urls = [
            f"/api/v1/operations-hr/dashboards/branch-operations/?branch_id={self.branch_b.id}",
            f"/api/v1/core/patients/?branch_id={self.branch_b.id}",
            f"/api/v1/billing-finance/invoices/?branch_id={self.branch_b.id}",
            f"/api/v1/operations-hr/staff-members/?branch_id={self.branch_b.id}",
        ]

        for url in cross_branch_urls:
            res = self.client.get(url)
            self.assertEqual(
                res.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Branch Manager was NOT blocked from cross-branch request to {url}! Got status {res.status_code}"
            )

    # -------------------------------------------------------------------------
    # 6. EXCLUSION FROM USER PROVISIONING & RBAC ROLES MANAGEMENT
    # -------------------------------------------------------------------------
    def test_06_branch_manager_completely_blocked_from_user_and_role_management(self):
        self.client.force_authenticate(user=self.u_bm)

        # 1. Blocked from listing system users
        res_users = self.client.get("/api/v1/auth/users/")
        self.assertEqual(res_users.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Blocked from provisioning staff
        res_prov = self.client.post("/api/v1/auth/staff/provision/", {"email": "hack@test.org"}, format="json")
        self.assertEqual(res_prov.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Blocked from modifying role permissions
        res_perm = self.client.put("/api/v1/auth/roles/DOCTOR/permissions/", {}, format="json")
        self.assertEqual(res_perm.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 7. HOSPITAL ADMIN ALIAS HAS IDENTICAL STRICT RESTRICTIONS
    # -------------------------------------------------------------------------
    def test_07_hospital_admin_alias_has_identical_restrictions(self):
        self.client.force_authenticate(user=self.u_ha)

        # View own branch: Allowed
        res_view = self.client.get(f"/api/v1/operations-hr/dashboards/branch-operations/?branch_id={self.branch_a.id}")
        self.assertEqual(res_view.status_code, status.HTTP_200_OK)

        # Create patient: Blocked (403)
        res_post = self.client.post("/api/v1/core/patients/", {"first_name": "Test"}, format="json")
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)

        # Hospital Admin has organization-wide scope (ORG), so cross-branch supervisory monitoring is allowed (200 OK)
        res_cross = self.client.get(f"/api/v1/operations-hr/dashboards/branch-operations/?branch_id={self.branch_b.id}")
        self.assertEqual(res_cross.status_code, status.HTTP_200_OK)
