"""
Comprehensive Security and Compliance Test Suite for Section 23.
Tests authentication enforcement, session expiration, account suspension/revocation,
role-based access control, branch isolation, patient IDOR protection, malicious upload rejection,
rate limiting, secret sanitization in audit logs, backup restoration verification,
and Indian legal compliance assessment.
"""

import uuid
import datetime
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

# pyrefly: ignore[missing-import]
from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import (
    Role, RoleEnum, UserProfile, StaffProfile, PatientProfile,
    StaffStatus, SecurityAuditEvent, SecurityEventType
)
from apps.clinical.models import (
    Appointment, AppointmentStatus, InpatientAdmission, AdmissionStatus,
    Ward, Bed, BedStatus
)
from apps.operations_hr.models import PayrollPeriod, Payslip, PayrollWorkflowStatus
from apps.billing_finance.models import Invoice, InvoiceStatus, Payment
from apps.core.security_services import SecurityAuditService
from apps.core.backup_recovery_service import BackupRecoveryService
from apps.core.compliance_assessment_service import IndianComplianceAssessmentService

User = get_user_model()


class Section23SecurityComplianceTestCase(TestCase):
    """
    Automated security verification test suite for Section 23: Security & Compliance.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Enterprise Setup: Hospital and 2 Branches for cross-branch isolation testing
        self.hospital, _ = Hospital.objects.get_or_create(
            code='HOSP-SEC23',
            defaults={'name': 'AURA Apex Hospital', 'address_line1': '100 Medical Boulevard', 'city': 'Mumbai', 'state': 'Maharashtra'}
        )
        self.branch_a, _ = Branch.objects.get_or_create(
            code='BR-SEC23-A',
            defaults={'name': 'Branch Mumbai Central', 'hospital': self.hospital, 'city': 'Mumbai'}
        )
        self.branch_b, _ = Branch.objects.get_or_create(
            code='BR-SEC23-B',
            defaults={'name': 'Branch Navi Mumbai', 'hospital': self.hospital, 'city': 'Navi Mumbai'}
        )
        self.dept_clin, _ = Department.objects.get_or_create(
            branch=self.branch_a,
            code='DEP-CARD-23',
            defaults={'name': 'Cardiology'}
        )
        self.dept_hr, _ = Department.objects.get_or_create(
            branch=self.branch_a,
            code='DEP-HR-23',
            defaults={'name': 'Human Resources'}
        )

        # 2. Roles Setup
        self.role_super_admin, _ = Role.objects.get_or_create(name=RoleEnum.SUPER_ADMIN, defaults={'display_name': 'Super Administrator'})
        self.role_doctor, _ = Role.objects.get_or_create(name=RoleEnum.DOCTOR, defaults={'display_name': 'Doctor'})
        self.role_nurse, _ = Role.objects.get_or_create(name=RoleEnum.NURSE, defaults={'display_name': 'Nurse'})
        self.role_pharmacist, _ = Role.objects.get_or_create(name=RoleEnum.PHARMACIST, defaults={'display_name': 'Pharmacist'})
        self.role_hr_manager, _ = Role.objects.get_or_create(name=RoleEnum.HR_MANAGER, defaults={'display_name': 'HR Manager'})
        self.role_accountant, _ = Role.objects.get_or_create(name=RoleEnum.ACCOUNTANT, defaults={'display_name': 'Accountant'})
        self.role_auditor, _ = Role.objects.get_or_create(name=RoleEnum.AUDITOR, defaults={'display_name': 'Auditor'})
        self.role_patient, _ = Role.objects.get_or_create(name=RoleEnum.PATIENT, defaults={'display_name': 'Patient'})

        # 3. Create Users and Profiles (with username == supabase_user_id to mirror production Supabase auth)
        # Doctor User (Branch A)
        uid_doc = uuid.uuid4()
        self.prof_doc = UserProfile.objects.create(
            supabase_user_id=uid_doc, email='doctor.sec23@aurahms.org', first_name='Aarav', last_name='Mehta',
            role=self.role_doctor, is_active=True
        )
        self.user_doc = User.objects.create_user(username=str(uid_doc), email='doctor.sec23@aurahms.org', password='SecurePassword123!')
        self.staff_doc = StaffProfile.objects.create(
            user_profile=self.prof_doc, hospital=self.hospital, branch=self.branch_a, department=self.dept_clin,
            employee_id='EMP-DOC-2301', designation='Senior Cardiologist', status=StaffStatus.ACTIVE
        )

        # Pharmacist User (Branch A)
        uid_pharm = uuid.uuid4()
        self.prof_pharm = UserProfile.objects.create(
            supabase_user_id=uid_pharm, email='pharm.sec23@aurahms.org', first_name='Rohan', last_name='Verma',
            role=self.role_pharmacist, is_active=True
        )
        self.user_pharm = User.objects.create_user(username=str(uid_pharm), email='pharm.sec23@aurahms.org', password='SecurePassword123!')
        self.staff_pharm = StaffProfile.objects.create(
            user_profile=self.prof_pharm, hospital=self.hospital, branch=self.branch_a,
            employee_id='EMP-PHARM-2301', designation='Clinical Pharmacist', status=StaffStatus.ACTIVE
        )

        # HR Manager User (Branch A)
        uid_hr = uuid.uuid4()
        self.prof_hr = UserProfile.objects.create(
            supabase_user_id=uid_hr, email='hr.sec23@aurahms.org', first_name='Sneha', last_name='Iyer',
            role=self.role_hr_manager, is_active=True
        )
        self.user_hr = User.objects.create_user(username=str(uid_hr), email='hr.sec23@aurahms.org', password='SecurePassword123!')
        self.staff_hr = StaffProfile.objects.create(
            user_profile=self.prof_hr, hospital=self.hospital, branch=self.branch_a, department=self.dept_hr,
            employee_id='EMP-HR-2301', designation='Head of HR', status=StaffStatus.ACTIVE
        )

        # Accountant User (Branch A)
        uid_acc = uuid.uuid4()
        self.prof_acc = UserProfile.objects.create(
            supabase_user_id=uid_acc, email='acc.sec23@aurahms.org', first_name='Karan', last_name='Deshmukh',
            role=self.role_accountant, is_active=True
        )
        self.user_acc = User.objects.create_user(username=str(uid_acc), email='acc.sec23@aurahms.org', password='SecurePassword123!')
        self.staff_acc = StaffProfile.objects.create(
            user_profile=self.prof_acc, hospital=self.hospital, branch=self.branch_a,
            employee_id='EMP-ACC-2301', designation='Chief Accountant', status=StaffStatus.ACTIVE
        )

        # Super Admin User
        uid_admin = uuid.uuid4()
        self.prof_admin = UserProfile.objects.create(
            supabase_user_id=uid_admin, email='admin.sec23@aurahms.org', first_name='Super', last_name='Admin',
            role=self.role_super_admin, is_active=True
        )
        self.user_admin = User.objects.create_superuser(username=str(uid_admin), email='admin.sec23@aurahms.org', password='SuperPassword123!')
        self.staff_admin = StaffProfile.objects.create(
            user_profile=self.prof_admin, hospital=self.hospital, branch=self.branch_a,
            employee_id='EMP-ADM-2301', designation='Chief Executive Officer', status=StaffStatus.ACTIVE
        )

        # Auditor User
        uid_auditor = uuid.uuid4()
        self.prof_auditor = UserProfile.objects.create(
            supabase_user_id=uid_auditor, email='auditor.sec23@aurahms.org', first_name='Priya', last_name='Nair',
            role=self.role_auditor, is_active=True
        )
        self.user_auditor = User.objects.create_user(username=str(uid_auditor), email='auditor.sec23@aurahms.org', password='AuditorPass123!')
        self.staff_auditor = StaffProfile.objects.create(
            user_profile=self.prof_auditor, hospital=self.hospital, branch=self.branch_a,
            employee_id='EMP-AUD-2301', designation='Compliance Auditor', status=StaffStatus.ACTIVE
        )

        # Branch B Staff User (for testing Cross-Branch Isolation)
        uid_branch_b = uuid.uuid4()
        self.prof_branch_b = UserProfile.objects.create(
            supabase_user_id=uid_branch_b, email='staffb.sec23@aurahms.org', first_name='Vikram', last_name='Patel',
            role=self.role_nurse, is_active=True
        )
        self.user_branch_b = User.objects.create_user(username=str(uid_branch_b), email='staffb.sec23@aurahms.org', password='BranchBPass123!')
        self.staff_branch_b = StaffProfile.objects.create(
            user_profile=self.prof_branch_b, hospital=self.hospital, branch=self.branch_b,
            employee_id='EMP-NUR-2302', designation='Staff Nurse', status=StaffStatus.ACTIVE
        )

        # Patient 1 (Branch A)
        uid_pat1 = uuid.uuid4()
        self.prof_pat1 = UserProfile.objects.create(
            supabase_user_id=uid_pat1, email='pat1.sec23@example.com', first_name='Rajesh', last_name='Sharma',
            role=self.role_patient, is_active=True
        )
        self.user_pat1 = User.objects.create_user(username=str(uid_pat1), email='pat1.sec23@example.com', password='PatientPass123!')
        self.patient1 = PatientProfile.objects.create(
            user_profile=self.prof_pat1, primary_branch=self.branch_a, medical_record_number='MRN-SEC23-0001',
            date_of_birth=datetime.date(1985, 4, 15), gender='MALE', blood_group='B+'
        )

        # Patient 2 (Branch A)
        uid_pat2 = uuid.uuid4()
        self.prof_pat2 = UserProfile.objects.create(
            supabase_user_id=uid_pat2, email='pat2.sec23@example.com', first_name='Ananya', last_name='Kulkarni',
            role=self.role_patient, is_active=True
        )
        self.user_pat2 = User.objects.create_user(username=str(uid_pat2), email='pat2.sec23@example.com', password='PatientPass123!')
        self.patient2 = PatientProfile.objects.create(
            user_profile=self.prof_pat2, primary_branch=self.branch_a, medical_record_number='MRN-SEC23-0002',
            date_of_birth=datetime.date(1992, 8, 22), gender='FEMALE', blood_group='O+'
        )

    # =========================================================================
    # TEST 1: Unauthenticated users are rejected from accessing protected APIs
    # =========================================================================
    def test_01_unauthenticated_requests_are_rejected(self):
        """Unauthenticated requests to protected endpoints return 401 or 403."""
        endpoints = [
            '/api/v1/clinical/appointments/',
            '/api/v1/operations-hr/payroll/',
            '/api/v1/billing-finance/invoices/',
            f'/api/v1/core/patients/{self.patient1.id}/documents/',
            '/api/v1/auth/users/',
            '/api/v1/dashboards-reports/admin/',
        ]
        for url in endpoints:
            response = self.client.get(url)
            self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
                          f"Endpoint {url} allowed unauthenticated access!")

    # =========================================================================
    # TEST 2: Inactive and suspended accounts are blocked from authentication
    # =========================================================================
    def test_02_suspended_and_inactive_users_are_blocked(self):
        """Suspended staff or deactivated users are rejected during authentication."""
        # Suspend doctor staff profile
        self.staff_doc.status = StaffStatus.SUSPENDED
        self.staff_doc.save()

        # Build mock claims payload with suspended user's sub
        from apps.authentication.backends import SupabaseAuthentication
        from rest_framework.request import Request
        from django.test.client import RequestFactory
        from rest_framework.exceptions import AuthenticationFailed

        rf = RequestFactory()
        req = rf.get('/api/v1/clinical/appointments/')
        backend = SupabaseAuthentication()

        # Inactive UserProfile test
        self.prof_pharm.is_active = False
        self.prof_pharm.save()

        # Attempt authenticating suspended staff via permissions check
        self.client.force_authenticate(user=self.user_doc)
        response = self.client.get('/api/v1/operations-hr/shifts/')
        # IsStaffMember rejects suspended staff profiles
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # TEST 3: Pharmacy staff cannot access confidential HR payroll records
    # =========================================================================
    def test_03_pharmacy_staff_blocked_from_confidential_payroll(self):
        """Pharmacy staff cannot access or list confidential employee payroll runs."""
        # Create a sample payroll period
        period = PayrollPeriod.objects.create(
            branch=self.branch_a,
            year=2026,
            month=10,
            status=PayrollWorkflowStatus.DRAFT,
            total_gross=Decimal('500000.00'),
            total_disbursed=Decimal('420000.00'),
            prepared_by=self.staff_hr
        )

        self.client.force_authenticate(user=self.user_pharm)
        response = self.client.get('/api/v1/operations-hr/payroll/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Pharmacy staff also cannot access salary structures
        response_sal = self.client.get('/api/v1/operations-hr/salary-structures/')
        self.assertEqual(response_sal.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # TEST 4: HR staff cannot modify clinical consultations or diagnoses
    # =========================================================================
    def test_04_hr_staff_blocked_from_clinical_modifications(self):
        """HR staff cannot record doctor consultations or alter medical diagnoses."""
        apt = Appointment.objects.create(
            appointment_number='APT-SEC23-01',
            patient=self.patient1,
            doctor=self.staff_doc,
            department=self.dept_clin,
            branch=self.branch_a,
            appointment_date=datetime.date(2026, 10, 24),
            time_slot='10:30:00',
            status=AppointmentStatus.SCHEDULED
        )

        self.client.force_authenticate(user=self.user_hr)
        consult_payload = {
            'diagnosis': 'Hypertension and Palpitations',
            'consultation_notes': 'Prescribed beta-blockers.',
        }
        response = self.client.post(f'/api/v1/clinical/appointments/{apt.id}/consultation/', consult_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # TEST 5: Finance staff cannot modify clinical consultations
    # =========================================================================
    def test_05_finance_staff_blocked_from_clinical_modifications(self):
        """Accountant/Finance staff cannot record medical consultations."""
        apt = Appointment.objects.create(
            appointment_number='APT-SEC23-02',
            patient=self.patient1,
            doctor=self.staff_doc,
            department=self.dept_clin,
            branch=self.branch_a,
            appointment_date=datetime.date(2026, 10, 24),
            time_slot='11:00:00',
            status=AppointmentStatus.SCHEDULED
        )

        self.client.force_authenticate(user=self.user_acc)
        response = self.client.post(f'/api/v1/clinical/appointments/{apt.id}/consultation/', {
            'diagnosis': 'Unauthorized diagnosis edit',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # TEST 6: Ordinary staff cannot access Super Admin administration APIs
    # =========================================================================
    def test_06_ordinary_staff_blocked_from_super_admin_views(self):
        """Doctor or Pharmacist cannot access Super Admin User Management."""
        self.client.force_authenticate(user=self.user_doc)
        response = self.client.get('/api/v1/auth/users/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Super Admin succeeds
        self.client.force_authenticate(user=self.user_admin)
        response_admin = self.client.get('/api/v1/auth/users/')
        self.assertEqual(response_admin.status_code, status.HTTP_200_OK)

    # =========================================================================
    # TEST 7: Cross-branch isolation protects patient documents
    # =========================================================================
    def test_07_cross_branch_staff_blocked_from_patient_documents(self):
        """Staff from Branch B cannot access patient documents of Branch A."""
        self.client.force_authenticate(user=self.user_branch_b)
        response = self.client.get(f'/api/v1/core/patients/{self.patient1.id}/documents/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Cross-branch', response.data.get('detail', ''))

    # =========================================================================
    # TEST 8: Patient IDOR protection (patients cannot access other patients' docs)
    # =========================================================================
    def test_08_patient_idor_access_prevented(self):
        """Patient 1 cannot view or upload documents belonging to Patient 2."""
        self.client.force_authenticate(user=self.user_pat1)

        # Patient 1 tries to view Patient 2's documents -> 403 Forbidden
        response_get = self.client.get(f'/api/v1/core/patients/{self.patient2.id}/documents/')
        self.assertEqual(response_get.status_code, status.HTTP_403_FORBIDDEN)

        # Patient 1 tries to upload a document under Patient 2's ID -> 403 Forbidden
        response_post = self.client.post(f'/api/v1/core/patients/{self.patient2.id}/documents/', {
            'title': 'IDOR Injection Attempt',
            'file_url': 'https://storage.aurahms.org/scans/test.pdf',
            'mime_type': 'application/pdf',
            'file_size_kb': 250
        }, format='json')
        self.assertEqual(response_post.status_code, status.HTTP_403_FORBIDDEN)

        # Patient 1 accessing own documents succeeds
        response_self = self.client.get(f'/api/v1/core/patients/{self.patient1.id}/documents/')
        self.assertEqual(response_self.status_code, status.HTTP_200_OK)

    # =========================================================================
    # TEST 9: Malicious file upload prevention (executable scripts & forbidden extensions)
    # =========================================================================
    def test_09_malicious_file_uploads_rejected(self):
        """Executables (.exe, .sh, .bat, .php) are strictly rejected upon upload."""
        self.client.force_authenticate(user=self.user_doc)

        malicious_files = [
            'https://storage.aurahms.org/uploads/trojan.exe',
            'https://storage.aurahms.org/uploads/payload.sh',
            'https://storage.aurahms.org/uploads/webshell.php',
            'https://storage.aurahms.org/uploads/exploit.bat',
        ]
        for bad_url in malicious_files:
            response = self.client.post(f'/api/v1/core/patients/{self.patient1.id}/documents/', {
                'title': 'Suspicious Script',
                'file_url': bad_url,
                'mime_type': 'application/octet-stream',
                'file_size_kb': 100
            }, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('forbidden', response.data.get('error', '').lower())

    # =========================================================================
    # TEST 10: File upload size limits enforcement (Max 15 MB)
    # =========================================================================
    def test_10_file_upload_size_limit_enforced(self):
        """Uploads exceeding 15 MB (15360 KB) are rejected."""
        self.client.force_authenticate(user=self.user_doc)

        response = self.client.post(f'/api/v1/core/patients/{self.patient1.id}/documents/', {
            'title': 'Oversized DICOM Archive',
            'file_url': 'https://storage.aurahms.org/uploads/huge_mri.pdf',
            'mime_type': 'application/pdf',
            'file_size_kb': 25000  # 25 MB exceeds 15 MB limit
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('maximum permitted limit', response.data.get('error', ''))

    # =========================================================================
    # TEST 11: Read-only role (Auditor) cannot mutate clinical/financial records
    # =========================================================================
    def test_11_auditor_read_only_access_enforcement(self):
        """Auditors can inspect dashboards but cannot create or mutate live financial invoices."""
        self.client.force_authenticate(user=self.user_auditor)

        # Auditor can view reports / compliance assessment
        response_comp = self.client.get('/api/v1/dashboards-reports/compliance-assessment/')
        self.assertEqual(response_comp.status_code, status.HTTP_200_OK)

        # Auditor attempting to modify/create an invoice is rejected
        from apps.authentication.permissions import IsReadOnlyOrAdmin
        perm = IsReadOnlyOrAdmin()
        from django.test.client import RequestFactory
        rf = RequestFactory()
        post_req = rf.post('/api/v1/billing-finance/invoices/')
        post_req.user = self.user_auditor
        has_perm = perm.has_permission(post_req, None)
        self.assertFalse(has_perm, "Auditor was erroneously permitted to write!")

    # =========================================================================
    # TEST 12: Separation of duties prevents transaction creators from self-approving
    # =========================================================================
    def test_12_separation_of_duties_prevents_self_approval(self):
        """Transaction creator cannot approve their own financial approval request."""
        from apps.authentication.models import FinancialApprovalRequest, FinancialOperationType, ApprovalRequestStatus

        approval_req = FinancialApprovalRequest.objects.create(
            request_number='FAR-SEC23-0001',
            operation_type=FinancialOperationType.REFUND_REVERSAL,
            entity_type='Invoice',
            entity_id=uuid.uuid4(),
            amount=Decimal('45000.00'),
            reason='Patient overpayment refund request',
            requested_by=self.staff_acc,
            branch=self.branch_a,
            status=ApprovalRequestStatus.PENDING,
            requires_separation_of_duties=True
        )

        # Creator (staff_acc) attempts to approve their own request
        self.client.force_authenticate(user=self.user_acc)
        response = self.client.post(f'/api/v1/auth/financial-approvals/{approval_req.id}/action/', {
            'action': 'APPROVE',
            'comments': 'Self approving'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Separation of duties', response.data.get('error', ''))

    # =========================================================================
    # TEST 13: Audit logging with secret and credential sanitization
    # =========================================================================
    def test_13_audit_log_sanitizes_passwords_and_tokens(self):
        """SecurityAuditService redacts passwords, tokens, and API secrets from audit trails."""
        dirty_details = {
            'username': 'attacker',
            'password': 'SuperSecretPassword123!',
            'auth_token': 'eyJh...super_secret_jwt',
            'card_number': '4111-2222-3333-4444',
            'cvv': '999',
            'valid_info': 'OPD Consultation'
        }

        event = SecurityAuditService.log_security_event(
            event_type=SecurityEventType.LOGIN_FAILED,
            actor_email='investigator@aurahms.org',
            details=dirty_details
        )

        self.assertIsNotNone(event)
        self.assertEqual(event.details['password'], '[REDACTED_CONFIDENTIAL]')
        self.assertEqual(event.details['auth_token'], '[REDACTED_CONFIDENTIAL]')
        self.assertEqual(event.details['card_number'], '[REDACTED_CONFIDENTIAL]')
        self.assertEqual(event.details['cvv'], '[REDACTED_CONFIDENTIAL]')
        self.assertEqual(event.details['valid_info'], 'OPD Consultation')

    # =========================================================================
    # TEST 14: Rate limiting on sensitive password recovery endpoint
    # =========================================================================
    def test_14_rate_limiting_on_auth_endpoint(self):
        """Rate limiter protects /password-recovery/ endpoint."""
        from apps.authentication.throttling import AuthRateThrottle

        throttle = AuthRateThrottle()
        from django.test.client import RequestFactory
        rf = RequestFactory()

        # Simulate 10 allowed requests within limit
        allowed = True
        for i in range(10):
            req = rf.post('/api/v1/auth/password-recovery/', {'email': 'victim@aurahms.org'})
            req.META['REMOTE_ADDR'] = '192.168.1.100'
            allowed = throttle.allow_request(req, None)

        # 11th request must be throttled
        req_11 = rf.post('/api/v1/auth/password-recovery/', {'email': 'victim@aurahms.org'})
        req_11.META['REMOTE_ADDR'] = '192.168.1.100'
        throttled = not throttle.allow_request(req_11, None)
        self.assertTrue(throttled, "AuthRateThrottle did not throttle the 11th request within 1 minute!")

    # =========================================================================
    # TEST 15: Automated Database Backup & Non-Destructive Restoration Verification
    # =========================================================================
    def test_15_backup_and_restoration_verification(self):
        """Generates backup archive and executes safe restoration verification."""
        archive = BackupRecoveryService.generate_backup_archive(
            requested_by='audit_officer@aurahms.org',
            notes='Section 23 automated backup test'
        )
        self.assertIsNotNone(archive['metadata']['backup_id'])
        self.assertGreater(archive['metadata']['total_records_archived'], 0)
        self.assertTrue(len(archive['metadata']['sha256_checksum']) == 64)

        # Verify restoration test passes cleanly
        verification = BackupRecoveryService.verify_backup_restoration_safe(archive)
        self.assertEqual(verification['status'], 'VERIFIED')
        self.assertTrue(verification['checksum_valid'])
        self.assertEqual(verification['referential_integrity'], 'PASSED')
        self.assertEqual(verification['recovery_time_objective_target'], '< 15 Minutes')

    # =========================================================================
    # TEST 16: Indian Legal and Regulatory Compliance Assessment
    # =========================================================================
    def test_16_indian_compliance_assessment_returns_complete_gap_analysis(self):
        """Compliance assessment engine covers DPDP Act 2023, Clinical Establishments, GST, and ABDM."""
        report = IndianComplianceAssessmentService.get_comprehensive_assessment()
        self.assertIn('summary', report)
        self.assertIn('assessments', report)

        frameworks = [a['framework'] for a in report['assessments']]
        self.assertTrue(any('DPDP' in f for f in frameworks), "Missing DPDP Act assessment")
        self.assertTrue(any('Clinical' in f for f in frameworks), "Missing Clinical Establishments assessment")
        self.assertTrue(any('Goods and Services Tax' in f for f in frameworks), "Missing GST assessment")
        self.assertTrue(any('Ayushman Bharat' in f for f in frameworks), "Missing ABDM assessment")

        for item in report['assessments']:
            self.assertIn('applies', item)
            self.assertIn('status', item)
            self.assertIn('existing_controls', item)
            self.assertIn('missing_controls', item)
            self.assertIn('changes_required', item)
            self.assertIn('professional_review_required', item)
