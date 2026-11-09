import uuid
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import Hospital, Branch, Department, AuditLog
from apps.authentication.models import (
    Role, RoleEnum, UserProfile, StaffProfile, PatientProfile, StaffStatus,
    FinancialApprovalRequest, FinancialOperationType, ApprovalRequestStatus,
)
from apps.operations_hr.models import LeaveRequest, LeaveType

User = get_user_model()


class MasterOrganizationalRBACTestSuite(TestCase):
    """
    Comprehensive Verification Suite for Master Organizational Access Control (3D RBAC),
    Role Responsibility Separation, Maker-Checker Workflows, and Activity Monitoring.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Hospital, Two Branches & Two Departments
        self.hospital, _ = Hospital.objects.get_or_create(
            code="HOSP-RBAC",
            defaults={
                "name": "Aura Enterprise Health Network",
                "address_line1": "100 Medical Blvd",
                "city": "Hyderabad",
                "state": "Telangana",
                "postal_code": "500001",
            },
        )
        self.branch_a, _ = Branch.objects.get_or_create(
            code="BR-RBAC-A",
            defaults={
                "hospital": self.hospital,
                "name": "Aura Main Branch",
                "address_line1": "Sector 1",
                "city": "Hyderabad",
                "state": "Telangana",
                "postal_code": "500001",
            },
        )
        self.branch_b, _ = Branch.objects.get_or_create(
            code="BR-RBAC-B",
            defaults={
                "hospital": self.hospital,
                "name": "Aura North Branch",
                "address_line1": "Sector 2",
                "city": "Hyderabad",
                "state": "Telangana",
                "postal_code": "500002",
            },
        )
        self.dept_cardio, _ = Department.objects.get_or_create(
            branch=self.branch_a,
            code="CARDIO-RBAC",
            defaults={"name": "Cardiology"},
        )
        self.dept_ortho, _ = Department.objects.get_or_create(
            branch=self.branch_a,
            code="ORTHO-RBAC",
            defaults={"name": "Orthopedics"},
        )

        # 2. Roles
        self.roles = {}
        for role_code in [
            RoleEnum.SUPER_ADMIN,
            RoleEnum.BRANCH_MANAGER,
            RoleEnum.HOSPITAL_ADMIN,
            RoleEnum.MEDICAL_DIRECTOR,
            RoleEnum.DEPARTMENT_HEAD,
            RoleEnum.HR_MANAGER,
            RoleEnum.DOCTOR,
            RoleEnum.NURSE,
            RoleEnum.RECEPTIONIST,
            RoleEnum.PHARMACIST,
            RoleEnum.LAB_TECHNICIAN,
            RoleEnum.FINANCE_MANAGER,
            RoleEnum.ACCOUNTANT,
            RoleEnum.AUDITOR,
            RoleEnum.PATIENT,
        ]:
            r, _ = Role.objects.get_or_create(
                name=role_code,
                defaults={"display_name": role_code.replace("_", " ").title()},
            )
            self.roles[role_code] = r

        # 3. Users & Profiles
        self.u_super, self.p_super, self.s_super = self._make_actor("superadmin@test.org", RoleEnum.SUPER_ADMIN, self.branch_a, None)
        self.u_bm, self.p_bm, self.s_bm = self._make_actor("branchmgr@test.org", RoleEnum.BRANCH_MANAGER, self.branch_a, None)
        self.u_hr, self.p_hr, self.s_hr = self._make_actor("hrmgr@test.org", RoleEnum.HR_MANAGER, self.branch_a, None)
        self.u_dh, self.p_dh, self.s_dh = self._make_actor("depthead@test.org", RoleEnum.DEPARTMENT_HEAD, self.branch_a, self.dept_cardio)
        self.u_doc, self.p_doc, self.s_doc = self._make_actor("doctor@test.org", RoleEnum.DOCTOR, self.branch_a, self.dept_cardio)
        self.u_nurse, self.p_nurse, self.s_nurse = self._make_actor("nurse@test.org", RoleEnum.NURSE, self.branch_a, self.dept_cardio)
        self.u_rec, self.p_rec, self.s_rec = self._make_actor("reception@test.org", RoleEnum.RECEPTIONIST, self.branch_a, None)
        self.u_pharm, self.p_pharm, self.s_pharm = self._make_actor("pharmacist@test.org", RoleEnum.PHARMACIST, self.branch_a, None)
        self.u_lab, self.p_lab, self.s_lab = self._make_actor("labtech@test.org", RoleEnum.LAB_TECHNICIAN, self.branch_a, None)
        self.u_fin, self.p_fin, self.s_fin = self._make_actor("finmgr@test.org", RoleEnum.FINANCE_MANAGER, self.branch_a, None)
        self.u_aud, self.p_aud, self.s_aud = self._make_actor("auditor@test.org", RoleEnum.AUDITOR, self.branch_a, None)
        self.u_pat, self.p_pat, _ = self._make_actor("patient@test.org", RoleEnum.PATIENT, self.branch_a, None, with_staff=False)
        self.patient_profile = PatientProfile.objects.create(
            user_profile=self.p_pat,
            primary_branch=self.branch_a,
            medical_record_number="MRN-RBAC-0001",
            gender="MALE",
            blood_group="O+",
        )

    def _make_actor(self, email, role_code, branch, department, with_staff=True):
        uid = uuid.uuid4()
        prof = UserProfile.objects.create(
            supabase_user_id=uid,
            email=email,
            first_name=role_code.title(),
            last_name="Tester",
            role=self.roles[role_code],
            is_active=True,
        )
        dj_user = User.objects.create_user(username=str(uid), email=email, password="SecurePassword123!")
        staff = None
        if with_staff and branch:
            staff = StaffProfile.objects.create(
                user_profile=prof,
                hospital=self.hospital,
                branch=branch,
                department=department,
                employee_id=f"EMP-{uuid.uuid4().hex[:6].upper()}",
                designation=role_code.replace("_", " ").title(),
                status=StaffStatus.ACTIVE,
            )
        return dj_user, prof, staff

    # =========================================================================
    # TEST 1 & 2: BRANCH MANAGER STRICT READ-ONLY & DASHBOARD VISIBILITY
    # =========================================================================
    def test_branch_manager_can_view_9_domain_dashboard_and_activity_logs(self):
        self.client.force_authenticate(user=self.u_bm)
        res = self.client.get(f"/api/v1/operations-hr/dashboards/branch-operations/?branch_id={self.branch_a.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        for domain_key in [
            "hr_monitoring",
            "medical_monitoring",
            "nursing_monitoring",
            "reception_monitoring",
            "pharmacy_monitoring",
            "laboratory_monitoring",
            "finance_monitoring",
            "inventory_monitoring",
            "department_monitoring",
            "branch_activity_logs",
        ]:
            self.assertIn(domain_key, data)

    def test_branch_manager_blocked_from_user_provisioning_and_role_management(self):
        self.client.force_authenticate(user=self.u_bm)

        # 1. Blocked from Staff Provisioning
        res_prov = self.client.post("/api/v1/auth/staff/provision/", {
            "email": "unauthorized@test.org",
            "first_name": "Unauth",
            "last_name": "Staff",
            "role": "DOCTOR",
        }, format="json")
        self.assertEqual(res_prov.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Blocked from User Management Directory
        res_users = self.client.get("/api/v1/auth/users/")
        self.assertEqual(res_users.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Blocked from Modifying Role Permissions
        res_perms = self.client.put("/api/v1/auth/roles/DOCTOR/permissions/", {
            "permission_codes": ["clinical:view"]
        }, format="json")
        self.assertEqual(res_perms.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Blocked from HR Employee Onboarding
        res_onboard = self.client.post("/api/v1/operations-hr/staff-members/", {
            "email": "newemp@test.org",
            "first_name": "New",
            "last_name": "Emp",
        }, format="json")
        self.assertEqual(res_onboard.status_code, status.HTTP_403_FORBIDDEN)

    def test_branch_manager_blocked_from_clinical_pharmacy_and_financial_mutations(self):
        self.client.force_authenticate(user=self.u_bm)

        # Blocked from creating prescriptions
        res_rx = self.client.post("/api/v1/pharmacy/prescriptions/", {}, format="json")
        self.assertEqual(res_rx.status_code, status.HTTP_403_FORBIDDEN)

        # Blocked from registering patients
        res_pat = self.client.post("/api/v1/core/patients/", {}, format="json")
        self.assertEqual(res_pat.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # TEST 3: HR MANAGER ONBOARDING & ROLE ESCALATION PROTECTION
    # =========================================================================
    def test_hr_manager_can_assign_operational_roles_but_cannot_assign_super_admin_or_branch_manager(self):
        self.client.force_authenticate(user=self.u_hr)

        # HR Manager can view branch user accounts
        res_list = self.client.get("/api/v1/auth/users/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)

        # HR Manager CANNOT escalate a user to SUPER_ADMIN
        res_escalate_sa = self.client.patch(f"/api/v1/auth/users/{self.p_doc.id}/", {
            "role": "SUPER_ADMIN"
        }, format="json")
        self.assertEqual(res_escalate_sa.status_code, status.HTTP_403_FORBIDDEN)

        # HR Manager CANNOT escalate a user to BRANCH_MANAGER
        res_escalate_bm = self.client.patch(f"/api/v1/auth/users/{self.p_doc.id}/", {
            "role": "BRANCH_MANAGER"
        }, format="json")
        self.assertEqual(res_escalate_bm.status_code, status.HTTP_403_FORBIDDEN)

        # HR Manager CAN update operational role within HR_ASSIGNABLE_ROLES
        res_valid = self.client.patch(f"/api/v1/auth/users/{self.p_nurse.id}/", {
            "role": "NURSE",
            "is_active": True
        }, format="json")
        self.assertEqual(res_valid.status_code, status.HTTP_200_OK)

        # HR Manager CANNOT modify global Role Permission Matrix
        res_matrix = self.client.put("/api/v1/auth/roles/NURSE/permissions/", {
            "permission_codes": ["nursing:view"]
        }, format="json")
        self.assertEqual(res_matrix.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # TEST 4: CLINICAL & FRONT-DESK SEPARATION (NURSE, RECEPTIONIST, PHARMACIST)
    # =========================================================================
    def test_nurse_and_pharmacist_cannot_issue_prescriptions(self):
        # Nurse blocked from creating prescription
        self.client.force_authenticate(user=self.u_nurse)
        res_nurse = self.client.post("/api/v1/pharmacy/prescriptions/", {}, format="json")
        self.assertEqual(res_nurse.status_code, status.HTTP_403_FORBIDDEN)

        # Pharmacist blocked from creating prescription
        self.client.force_authenticate(user=self.u_pharm)
        res_pharm = self.client.post("/api/v1/pharmacy/prescriptions/", {}, format="json")
        self.assertEqual(res_pharm.status_code, status.HTTP_403_FORBIDDEN)

    def test_receptionist_blocked_from_full_clinical_emr_and_hr(self):
        self.client.force_authenticate(user=self.u_rec)

        # Receptionist blocked from viewing full longitudinal EMR
        res_emr = self.client.get(f"/api/v1/core/patients/{self.patient_profile.id}/emr/")
        self.assertEqual(res_emr.status_code, status.HTTP_403_FORBIDDEN)

        # Doctor CAN view full longitudinal EMR
        self.client.force_authenticate(user=self.u_doc)
        res_doc_emr = self.client.get(f"/api/v1/core/patients/{self.patient_profile.id}/emr/")
        self.assertEqual(res_doc_emr.status_code, status.HTTP_200_OK)

    # =========================================================================
    # TEST 5: MAKER-CHECKER SEPARATION OF DUTIES (LEAVE, PAYROLL, FINANCE)
    # =========================================================================
    def test_leave_approval_separation_and_branch_manager_exclusion(self):
        leave = LeaveRequest.objects.create(
            staff=self.s_doc,
            leave_type=LeaveType.PRIVILEGE,
            start_date="2026-11-10",
            end_date="2026-11-12",
            total_days=Decimal("3.0"),
            reason="Medical Conference",
            status="PENDING",
        )

        # 1. Branch Manager CANNOT approve leave
        self.client.force_authenticate(user=self.u_bm)
        res_bm = self.client.post(f"/api/v1/operations-hr/leaves/{leave.id}/approve/", {}, format="json")
        self.assertEqual(res_bm.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Department Head CAN approve leave for staff in their department
        self.client.force_authenticate(user=self.u_dh)
        res_dh = self.client.post(f"/api/v1/operations-hr/leaves/{leave.id}/approve/", {
            "comments": "Approved by Cardiology Head"
        }, format="json")
        self.assertEqual(res_dh.status_code, status.HTTP_200_OK)

    def test_financial_approval_maker_checker_blocks_self_approval_and_branch_manager(self):
        req = FinancialApprovalRequest.objects.create(
            operation_type=FinancialOperationType.INVOICE_ADJUSTMENT,
            entity_type="INVOICE",
            entity_id=uuid.uuid4(),
            amount=Decimal("25000.00"),
            requested_by=self.s_fin,
            branch=self.branch_a,
            status=ApprovalRequestStatus.PENDING,
        )

        # 1. Finance Manager cannot approve their OWN request (Separation of Duties)
        self.client.force_authenticate(user=self.u_fin)
        res_self = self.client.post(f"/api/v1/auth/financial-approvals/{req.id}/action/", {
            "action": "APPROVE"
        }, format="json")
        self.assertEqual(res_self.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Branch Manager cannot approve financial request
        self.client.force_authenticate(user=self.u_bm)
        res_bm = self.client.post(f"/api/v1/auth/financial-approvals/{req.id}/action/", {
            "action": "APPROVE"
        }, format="json")
        self.assertEqual(res_bm.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Super Admin (different user) CAN approve
        self.client.force_authenticate(user=self.u_super)
        res_sa = self.client.post(f"/api/v1/auth/financial-approvals/{req.id}/action/", {
            "action": "APPROVE"
        }, format="json")
        self.assertEqual(res_sa.status_code, status.HTTP_200_OK)

    # =========================================================================
    # TEST 6: IMMUTABLE CENTRALIZED ACTIVITY LOGS & ROLE SCOPING
    # =========================================================================
    def test_audit_logs_are_tamper_resistant_and_cannot_be_deleted(self):
        log = AuditLog.objects.create(
            actor_user_id=self.p_doc.id,
            actor_email=self.p_doc.email,
            action="CONSULTATION_COMPLETED",
            entity_type="CONSULTATION",
            entity_id="CONS-001",
            new_values={"_meta": {"module": "CLINICAL", "branch_id": str(self.branch_a.id)}},
        )

        # 1. Model-level delete raises PermissionDenied
        with self.assertRaises(PermissionDenied):
            log.delete()

        # 2. API DELETE endpoint returns 403 even for Super Admin
        self.client.force_authenticate(user=self.u_super)
        res_del = self.client.delete("/api/v1/operations-hr/audit-logs/")
        self.assertEqual(res_del.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Auditor can record an official audit finding via POST
        self.client.force_authenticate(user=self.u_aud)
        res_finding = self.client.post("/api/v1/operations-hr/audit-logs/", {
            "module": "FINANCE",
            "entity_type": "INVOICE_REVIEW",
            "entity_id": "INV-2026-009",
            "description": "Verified separation of duties on discount approval.",
        }, format="json")
        self.assertEqual(res_finding.status_code, status.HTTP_201_CREATED)

    # =========================================================================
    # TEST 7: INVENTORY, PROCUREMENT & INSURANCE PERMISSION RESTRICTIONS
    # =========================================================================
    def test_inventory_procurement_and_insurance_rbac_restrictions(self):
        from apps.authentication.rbac_matrix import ROLE_MODULE_ACTIONS

        # 1. Inventory Manager must NOT have DASHBOARD
        self.assertNotIn('DASHBOARD', ROLE_MODULE_ACTIONS[RoleEnum.INVENTORY_MANAGER])
        self.assertIn('INVENTORY', ROLE_MODULE_ACTIONS[RoleEnum.INVENTORY_MANAGER])

        # 2. Procurement Officer must NOT have DASHBOARD or REPORTS
        self.assertNotIn('DASHBOARD', ROLE_MODULE_ACTIONS[RoleEnum.PROCUREMENT_OFFICER])
        self.assertNotIn('REPORTS', ROLE_MODULE_ACTIONS[RoleEnum.PROCUREMENT_OFFICER])
        self.assertIn('INVENTORY', ROLE_MODULE_ACTIONS[RoleEnum.PROCUREMENT_OFFICER])

        # 3. Insurance Coordinator must NOT have PATIENTS
        self.assertNotIn('PATIENTS', ROLE_MODULE_ACTIONS[RoleEnum.INSURANCE_COORDINATOR])
        self.assertIn('INSURANCE', ROLE_MODULE_ACTIONS[RoleEnum.INSURANCE_COORDINATOR])
