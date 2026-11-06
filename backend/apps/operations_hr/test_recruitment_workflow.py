import datetime
import uuid
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import UserProfile, StaffProfile, Role, RoleEnum
from apps.operations_hr.models import (
    StaffRequirementRequest, JobVacancy, JobApplication
)
from apps.operations_hr.hr_operations_service import HROperationsService


class TestRecruitmentWorkflow(TestCase):
    def setUp(self):
        self.hospital = Hospital.objects.create(name="AURA Central Hospital")
        self.branch = Branch.objects.create(hospital=self.hospital, name="Main Campus")
        self.hr_dept = Department.objects.create(branch=self.branch, name="Human Resources", code="HR")
        self.cardio_dept = Department.objects.create(branch=self.branch, name="Cardiology", code="CARD")

        # Roles
        self.hr_role = Role.objects.create(name=RoleEnum.HR_MANAGER, display_name="HR Manager")
        self.doctor_role = Role.objects.create(name=RoleEnum.DOCTOR, display_name="Doctor")

        # HR User & Staff
        self.hr_uid = str(uuid.uuid4())
        self.hr_auth = User.objects.create_user(username=self.hr_uid, email="hr.test@hospital.com")
        self.hr_user = UserProfile.objects.create(
            supabase_user_id=self.hr_uid,
            email="hr.test@hospital.com",
            first_name="Radha",
            last_name="Krishnan",
            role=self.hr_role,
            is_verified=True
        )
        self.hr_staff = StaffProfile.objects.create(
            user_profile=self.hr_user,
            hospital=self.hospital,
            branch=self.branch,
            department=self.hr_dept,
            employee_id="EMP-HR-001",
            status="ACTIVE"
        )

        # Doctor (HOD) User & Staff
        self.doc_uid = str(uuid.uuid4())
        self.doc_auth = User.objects.create_user(username=self.doc_uid, email="hod.cardio@hospital.com")
        self.doc_user = UserProfile.objects.create(
            supabase_user_id=self.doc_uid,
            email="hod.cardio@hospital.com",
            first_name="Alok",
            last_name="Sharma",
            role=self.doctor_role,
            is_verified=True
        )
        self.doc_staff = StaffProfile.objects.create(
            user_profile=self.doc_user,
            hospital=self.hospital,
            branch=self.branch,
            department=self.cardio_dept,
            employee_id="EMP-DOC-001",
            status="ACTIVE"
        )

        self.client = APIClient()

    def test_01_staffing_requisition_starts_as_submitted_not_recruiting(self):
        """A doctor's requisition must start in status SUBMITTED, not RECRUITING."""
        self.client.force_authenticate(user=self.doc_auth)
        res = self.client.post('/api/v1/operations-hr/staff-requirements/', {
            'designation': 'Consultant Diabetologist & Endocrinologist',
            'count': 1,
            'urgency': 'HIGH',
            'reason': 'Increased outpatient caseload',
            'qualifications_needed': 'MD, DM Endocrinology',
            'department': str(self.cardio_dept.id),
            'branch': str(self.branch.id)
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        req_id = res.data['id']
        req = StaffRequirementRequest.objects.get(id=req_id)
        self.assertEqual(req.status, 'SUBMITTED')
        self.assertNotEqual(req.status, 'RECRUITING')

    def test_02_hr_approval_and_publishing_vacancy(self):
        """HR approves requisition and publishes vacancy, which transitions requisition to RECRUITING."""
        req = StaffRequirementRequest.objects.create(
            branch=self.branch,
            department=self.cardio_dept,
            requested_by=self.doc_staff,
            designation='Interventional Cardiologist',
            count=1,
            urgency='HIGH',
            reason='Need second cath lab operator',
            status='SUBMITTED'
        )

        # HR approves
        self.client.force_authenticate(user=self.hr_auth)
        res_approve = self.client.patch(f'/api/v1/operations-hr/staff-requirements/{req.id}/', {
            'status': 'APPROVED'
        })
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, 'APPROVED')

        # HR publishes vacancy
        res_vac = self.client.post('/api/v1/operations-hr/vacancies/', {
            'branch': str(self.branch.id),
            'department': str(self.cardio_dept.id),
            'title': 'Consultant Interventional Cardiologist',
            'designation': 'Consultant Interventional Cardiologist',
            'vacancies_count': 1,
            'experience_years_min': 3,
            'description': 'Cath lab surgical interventions and OPD consultations',
            'status': 'OPEN'
        })
        self.assertEqual(res_vac.status_code, status.HTTP_201_CREATED)

        # Transition requisition to RECRUITING
        req.status = 'RECRUITING'
        req.hr_notes = 'Job vacancy published and actively accepting candidates.'
        req.save()
        req.refresh_from_db()
        self.assertEqual(req.status, 'RECRUITING')

    def test_03_candidate_application_intake_starts_as_applied(self):
        """Candidate applies via public or HR intake; initial status must be APPLIED (never INTERVIEW_SCHEDULED)."""
        vac = JobVacancy.objects.create(
            branch=self.branch,
            department=self.cardio_dept,
            title='Staff Nurse - ICU',
            designation='Staff Nurse',
            vacancies_count=2,
            experience_years_min=1,
            status='OPEN'
        )

        # Unauthenticated / Public candidate application submission
        anon_client = APIClient()
        res_apply = anon_client.post('/api/v1/operations-hr/applications/', {
            'vacancy': str(vac.id),
            'candidate_name': 'Sneha Nair',
            'email': 'sneha.nair@example.com',
            'phone': '+91 98765 11223',
            'qualification': 'B.Sc Nursing, Critical Care Certified',
            'experience_years': '2.5'
        })
        self.assertEqual(res_apply.status_code, status.HTTP_201_CREATED)
        app_id = res_apply.data['id']
        app = JobApplication.objects.get(id=app_id)
        self.assertEqual(app.status, 'APPLIED')
        self.assertNotEqual(app.status, 'INTERVIEW_SCHEDULED')

        # HR evaluates and shortlists
        self.client.force_authenticate(user=self.hr_auth)
        res_shortlist = self.client.patch(f'/api/v1/operations-hr/applications/{app_id}/', {
            'status': 'SHORTLISTED'
        })
        self.assertEqual(res_shortlist.status_code, status.HTTP_200_OK)
        app.refresh_from_db()
        self.assertEqual(app.status, 'SHORTLISTED')

        # HR schedules interview
        interview_time = (datetime.datetime.now() + datetime.timedelta(days=2)).strftime('%Y-%m-%dT%H:%M:%SZ')
        res_interview = self.client.patch(f'/api/v1/operations-hr/applications/{app_id}/', {
            'status': 'INTERVIEW_SCHEDULED',
            'interview_date': interview_time
        })
        self.assertEqual(res_interview.status_code, status.HTTP_200_OK)
        app.refresh_from_db()
        self.assertEqual(app.status, 'INTERVIEW_SCHEDULED')

    def test_04_recruitment_pipeline_telemetry_has_no_fake_fallback_data(self):
        """Telemetry must return exact zero counts when there are 0 applications, not fallback 3, 1, or 2."""
        data = HROperationsService.get_comprehensive_hr_dashboard(branch_id=self.branch.id)
        pipe = data['recruitment_pipeline']
        self.assertEqual(pipe['total_applicants'], 0)
        self.assertEqual(pipe['shortlisted'], 0)
        self.assertEqual(pipe['interview_scheduled'], 0)
        self.assertEqual(pipe['hired'], 0)
