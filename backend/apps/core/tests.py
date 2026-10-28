import uuid
import datetime
from decimal import Decimal
import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import Hospital, Branch, Department, AuditLog
from apps.authentication.models import (
    Role,
    RoleEnum,
    UserProfile,
    StaffProfile,
    PatientProfile,
    PatientStatusEnum,
    ConsentType,
    ConsentStatus,
    PatientConsent,
    PatientDocument,
    GenderEnum,
    BloodGroupEnum,
)
from apps.clinical.models import (
    Appointment,
    AppointmentStatus,
    Ward,
    Bed,
    InpatientAdmission,
    AdmissionStatus,
)
from apps.pharmacy_inventory.models import Medicine, Prescription, PrescriptionItem
from apps.billing_finance.models import Invoice, Payment

User = get_user_model()


@pytest.mark.django_db
class TestCoreEndpoints:
    def setup_method(self):
        self.client = APIClient()

    def test_health_check_endpoint(self):
        url = reverse('health-check')
        response = self.client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        assert data['system'] == 'Hospital Management System (HMS)'

    def test_system_info_endpoint(self):
        url = reverse('core:system-info')
        response = self.client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'online'
        assert data['default_currency'] == 'INR'
        assert data['timezone'] == 'Asia/Kolkata'

    def test_branch_list_endpoint(self):
        url = reverse('core:branch-list')
        response = self.client.get(url)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_openapi_schema_endpoint(self):
        url = reverse('schema')
        response = self.client.get(url)
        assert response.status_code == 200
        assert 'openapi' in response.data or 'paths' in response.data


@pytest.mark.django_db
class TestPatientManagementAndEMR:
    def setup_method(self):
        self.client = APIClient()

        # 1. Base Setup
        self.hospital = Hospital.objects.create(
            name='AURA Test Hospital',
            code=f"HOSP-{uuid.uuid4().hex[:4].upper()}"
        )
        self.branch = Branch.objects.create(
            hospital=self.hospital,
            name='Central Medical Branch',
            code=f"BR-{uuid.uuid4().hex[:4].upper()}"
        )
        self.dept = Department.objects.create(
            branch=self.branch,
            name='General Medicine',
            code=f"DEP-{uuid.uuid4().hex[:4].upper()}"
        )

        # 2. Roles
        self.admin_role, _ = Role.objects.get_or_create(
            name=RoleEnum.SUPER_ADMIN,
            defaults={'display_name': 'Super Admin'}
        )
        self.doctor_role, _ = Role.objects.get_or_create(
            name=RoleEnum.DOCTOR,
            defaults={'display_name': 'Doctor'}
        )
        self.receptionist_role, _ = Role.objects.get_or_create(
            name=RoleEnum.RECEPTIONIST,
            defaults={'display_name': 'Receptionist'}
        )
        self.patient_role, _ = Role.objects.get_or_create(
            name=RoleEnum.PATIENT,
            defaults={'display_name': 'Patient'}
        )

        # 3. Staff User
        self.staff_uid = uuid.uuid4()
        self.staff_django_user = User.objects.create_user(
            username=str(self.staff_uid),
            email='receptionist@hospital.test'
        )
        self.staff_user_profile = UserProfile.objects.create(
            supabase_user_id=self.staff_uid,
            email='receptionist@hospital.test',
            first_name='Sunita',
            last_name='Sharma',
            role=self.receptionist_role,
        )
        self.staff_profile = StaffProfile.objects.create(
            user_profile=self.staff_user_profile,
            hospital=self.hospital,
            branch=self.branch,
            department=self.dept,
            employee_id=f"EMP-STF-{uuid.uuid4().hex[:4].upper()}",
            designation='Front Desk Officer',
        )

        # 4. Doctor User
        self.doc_uid = uuid.uuid4()
        self.doc_django_user = User.objects.create_user(
            username=str(self.doc_uid),
            email='doctor@hospital.test'
        )
        self.doc_user_profile = UserProfile.objects.create(
            supabase_user_id=self.doc_uid,
            email='doctor@hospital.test',
            first_name='Ananya',
            last_name='Deshmukh',
            role=self.doctor_role,
        )
        self.doc_profile = StaffProfile.objects.create(
            user_profile=self.doc_user_profile,
            hospital=self.hospital,
            branch=self.branch,
            department=self.dept,
            employee_id=f"EMP-DOC-{uuid.uuid4().hex[:4].upper()}",
            designation='Consultant Physician',
        )

        # 5. Patient A
        self.patient_a_uid = uuid.uuid4()
        self.patient_a_django_user = User.objects.create_user(
            username=str(self.patient_a_uid),
            email='patient.a@hospital.test'
        )
        self.patient_a_user_profile = UserProfile.objects.create(
            supabase_user_id=self.patient_a_uid,
            email='patient.a@hospital.test',
            first_name='Aarav',
            last_name='Patel',
            phone_number='9876543210',
            role=self.patient_role,
        )
        self.patient_a = PatientProfile.objects.create(
            user_profile=self.patient_a_user_profile,
            primary_branch=self.branch,
            medical_record_number=f"MRN-2026-{uuid.uuid4().hex[:5].upper()}",
            date_of_birth=datetime.date(1990, 5, 15),
            gender=GenderEnum.MALE,
            blood_group=BloodGroupEnum.O_POS,
            address='Flat 402, Lotus Heights',
            city='Mumbai',
            state='Maharashtra',
            postal_code='400053',
            emergency_contact_name='Pooja Patel',
            emergency_contact_phone='9876543219',
            emergency_contact_relation='Spouse',
            allergies=['Penicillin', 'Sulfa drugs'],
            chronic_conditions=['Hypertension'],
        )

        # 6. Patient B
        self.patient_b_uid = uuid.uuid4()
        self.patient_b_django_user = User.objects.create_user(
            username=str(self.patient_b_uid),
            email='patient.b@hospital.test'
        )
        self.patient_b_user_profile = UserProfile.objects.create(
            supabase_user_id=self.patient_b_uid,
            email='patient.b@hospital.test',
            first_name='Priya',
            last_name='Nair',
            phone_number='9876543210',  # Same phone to trigger duplicate detection test
            role=self.patient_role,
        )
        self.patient_b = PatientProfile.objects.create(
            user_profile=self.patient_b_user_profile,
            primary_branch=self.branch,
            medical_record_number=f"MRN-2026-{uuid.uuid4().hex[:5].upper()}",
            date_of_birth=datetime.date(1995, 8, 22),
            gender=GenderEnum.FEMALE,
            blood_group=BloodGroupEnum.B_POS,
            allergies=['Aspirin'],
            chronic_conditions=['Asthma'],
        )

    def test_patient_dashboard_stats(self):
        """Dashboard stats must calculate from real database records."""
        self.client.force_authenticate(user=self.staff_django_user)
        url = reverse('core:patient-dashboard-stats')
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['total_registered'] >= 2
        assert data['active_patients'] >= 2
        assert 'registered_today' in data
        assert 'upcoming_appointments' in data
        assert 'potential_duplicates_count' in data
        # Both Patient A & B have phone '9876543210' -> duplicate count >= 1
        assert data['potential_duplicates_count'] >= 1

    def test_patient_registration_successful(self):
        """Staff can register a new patient; MRN is auto-generated server-side."""
        self.client.force_authenticate(user=self.staff_django_user)
        url = reverse('core:patient-management')
        payload = {
            'first_name': 'Kavita',
            'last_name': 'Rao',
            'email': 'kavita.rao@example.com',
            'phone_number': '9123456780',
            'primary_branch_id': str(self.branch.id),
            'date_of_birth': '1988-11-12',
            'gender': 'FEMALE',
            'blood_group': 'A+',
            'address': '22 Marine Drive',
            'city': 'Mumbai',
            'state': 'Maharashtra',
            'postal_code': '400020',
            'emergency_contact_name': 'Ramesh Rao',
            'emergency_contact_phone': '9123456789',
            'emergency_contact_relation': 'Father',
            'allergies': ['Ibuprofen'],
            'chronic_conditions': ['Hypothyroidism'],
            'initial_consent_type': 'GENERAL_TREATMENT',
            'initial_consent_notes': 'Patient signed general care waiver.',
        }
        response = self.client.post(url, payload, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert 'medical_record_number' in data
        assert data['medical_record_number'].startswith('MRN-')
        assert data['user_profile']['first_name'] == 'Kavita'
        assert data['user_profile']['last_name'] == 'Rao'
        assert data['blood_group'] == 'A+'
        assert data['consents_count'] == 1

        # Check Audit log was created
        assert AuditLog.objects.filter(entity_type='PatientProfile', action='PATIENT_REGISTERED').exists()

    def test_patient_registration_validation_missing_branch(self):
        """Missing required fields (branch) must return 400 Bad Request."""
        self.client.force_authenticate(user=self.staff_django_user)
        url = reverse('core:patient-management')
        payload = {
            'first_name': 'Incomplete',
            'last_name': 'Patient',
            # Missing primary_branch_id
        }
        response = self.client.post(url, payload, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_patient_search_and_filter(self):
        """Search by MRN, Name, Phone returns accurate results."""
        self.client.force_authenticate(user=self.staff_django_user)
        url = reverse('core:patient-management')

        # Search by Name
        res_name = self.client.get(url, {'search': 'Aarav'})
        assert res_name.status_code == status.HTTP_200_OK
        results = res_name.json()['results']
        assert len(results) == 1
        assert results[0]['user_profile']['first_name'] == 'Aarav'

        # Filter by Gender
        res_gender = self.client.get(url, {'gender': 'FEMALE'})
        assert res_gender.status_code == status.HTTP_200_OK
        assert any(p['user_profile']['first_name'] == 'Priya' for p in res_gender.json()['results'])

    def test_patient_full_emr_aggregation(self):
        """Full EMR aggregates appointments, prescriptions, admissions, and lab records."""
        # Create an appointment for Patient A
        appt = Appointment.objects.create(
            appointment_number=f"APT-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient_a,
            doctor=self.doc_profile,
            department=self.dept,
            branch=self.branch,
            appointment_date=datetime.date.today(),
            time_slot='10:00 - 10:15',
            status=AppointmentStatus.COMPLETED,
            consultation_notes='Patient presented with mild headache.',
            diagnosis='Tension Headache',
            vitals={'bp': '120/80', 'pulse': 72},
        )

        self.client.force_authenticate(user=self.staff_django_user)
        url = reverse('core:patient-emr', kwargs={'pk': str(self.patient_a.id)})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 'overview' in data
        assert 'demographics' in data
        assert 'medical_history' in data
        assert 'allergies' in data
        assert 'appointments' in data
        assert 'consultations' in data
        assert 'prescriptions' in data
        assert 'admissions' in data
        assert 'lab_reports' in data
        assert 'billing_history' in data

        # Check the appointment appears in EMR
        assert len(data['appointments']) == 1
        assert data['appointments'][0]['appointment_number'] == appt.appointment_number
        assert len(data['consultations']) == 1
        assert data['consultations'][0]['diagnosis'] == 'Tension Headache'

    def test_patient_portal_isolation_unauthorized_access(self):
        """A Patient user MUST NOT be able to access another patient's EMR record."""
        # Authenticate as Patient B
        self.client.force_authenticate(user=self.patient_b_django_user)

        # Attempt to access Patient A's EMR
        url_other = reverse('core:patient-emr', kwargs={'pk': str(self.patient_a.id)})
        response_other = self.client.get(url_other)
        assert response_other.status_code == status.HTTP_403_FORBIDDEN

        # Patient B can access their own EMR
        url_self = reverse('core:patient-emr', kwargs={'pk': str(self.patient_b.id)})
        response_self = self.client.get(url_self)
        assert response_self.status_code == status.HTTP_200_OK

    def test_medical_history_and_allergy_update(self):
        """Clinical users can update allergies and medical conditions with audit trail."""
        self.client.force_authenticate(user=self.doc_django_user)
        url = reverse('core:patient-medical-history', kwargs={'pk': str(self.patient_a.id)})
        payload = {
            'allergies': ['Penicillin', 'Sulfa drugs', 'Latex'],
            'chronic_conditions': ['Hypertension', 'Hyperlipidemia'],
            'past_medical_history': ['Pneumonia in 2018'],
            'past_surgical_history': ['Appendectomy in 2015'],
        }
        response = self.client.post(url, payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 'Latex' in data['allergies']
        assert 'Hyperlipidemia' in data['chronic_conditions']

        # Refresh from DB
        self.patient_a.refresh_from_db()
        assert 'Latex' in self.patient_a.allergies
        assert 'Hyperlipidemia' in self.patient_a.chronic_conditions

    def test_consent_record_and_revoke(self):
        """Can record consent and revoke with reason."""
        self.client.force_authenticate(user=self.staff_django_user)
        url = reverse('core:patient-consents', kwargs={'pk': str(self.patient_a.id)})
        post_res = self.client.post(url, {
            'consent_type': 'TELEMEDICINE',
            'notes': 'Audio-video consent captured during intake',
        }, format='json')
        assert post_res.status_code == status.HTTP_201_CREATED
        consent_id = post_res.json()['id']

        # Revoke consent
        revoke_url = reverse('core:patient-consent-revoke', kwargs={
            'pk': str(self.patient_a.id),
            'consent_id': consent_id,
        })
        revoke_res = self.client.post(revoke_url, {
            'reason': 'Patient requested termination of telemedicine sessions',
        }, format='json')
        assert revoke_res.status_code == status.HTTP_200_OK
        assert revoke_res.json()['status'] == 'REVOKED'

    def test_duplicate_detection(self):
        """Detect duplicate candidates based on shared phone number."""
        self.client.force_authenticate(user=self.staff_django_user)
        url = reverse('core:patient-duplicates')
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['total_candidate_groups'] >= 1
        group = data['duplicate_groups'][0]
        assert 'Identical Contact Phone: 9876543210' in group['reason']
        assert len(group['patients']) == 2

    def test_patient_record_merge_transactional_integrity(self):
        """
        Merging patient B into patient A reassigns linked records to A,
        marks B as MERGED with merged_into=A, and combines allergies.
        """
        # Create an appointment for Patient B
        appt_b = Appointment.objects.create(
            appointment_number=f"APT-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient_b,
            doctor=self.doc_profile,
            department=self.dept,
            branch=self.branch,
            appointment_date=datetime.date.today() + datetime.timedelta(days=2),
            time_slot='11:00 - 11:15',
            status=AppointmentStatus.SCHEDULED,
        )

        self.client.force_authenticate(user=self.staff_django_user)
        url = reverse('core:patient-merge')
        payload = {
            'source_patient_id': str(self.patient_b.id),
            'target_patient_id': str(self.patient_a.id),
            'reason': 'Duplicate intake created with identical phone number.',
        }
        response = self.client.post(url, payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['surviving_mrn'] == self.patient_a.medical_record_number
        assert data['reassigned_records']['appointments'] >= 1

        # Verify in DB: Appointment B now points to Patient A
        appt_b.refresh_from_db()
        assert appt_b.patient_id == self.patient_a.id

        # Verify source patient is marked MERGED
        self.patient_b.refresh_from_db()
        assert self.patient_b.status == PatientStatusEnum.MERGED
        assert self.patient_b.merged_into_id == self.patient_a.id

        # Verify allergies were unioned
        self.patient_a.refresh_from_db()
        assert 'Aspirin' in self.patient_a.allergies
        assert 'Penicillin' in self.patient_a.allergies
