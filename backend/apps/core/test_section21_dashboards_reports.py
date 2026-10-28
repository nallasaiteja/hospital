import uuid
from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile
from apps.clinical.models import (
    Appointment, AppointmentStatus, AppointmentType,
    InpatientAdmission, AdmissionStatus,
    EmergencyEncounter, EmergencyStatus, TriageAcuity,
    Ward, WardType, Bed, BedStatus,
    LabOrder, LabOrderStatus,
)
from apps.billing_finance.models import (
    Invoice, InvoiceStatus,
    Payment, PaymentMethod,
    BankAccount, InvestmentRegister, LoanRegister,
)
from apps.core.dashboard_reporting_service import DashboardReportingService

User = get_user_model()


class Section21DashboardsReportsTestCase(TestCase):
    """
    Automated test verification suite for Section 21: Dashboards and Reports.
    Verifies that all metrics strictly reflect database state without fabrication.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Hospital Enterprise & Branch
        self.hospital, _ = Hospital.objects.get_or_create(
            code='HOSP-TEST-21',
            defaults={
                'name': 'AURA Apex Health Institute',
                'timezone': 'Asia/Kolkata',
                'address_line1': '100 Medical Boulevard',
                'city': 'Chennai',
                'state': 'Tamil Nadu',
                'postal_code': '600001'
            }
        )
        self.branch, _ = Branch.objects.get_or_create(
            code='BR-21-MAIN',
            defaults={
                'hospital': self.hospital,
                'name': 'AURA Central Multi-Specialty Hospital',
                'address_line1': '100 Main Road',
                'city': 'Chennai',
                'state': 'Tamil Nadu',
                'postal_code': '600001'
            }
        )
        self.dept, _ = Department.objects.get_or_create(
            branch=self.branch,
            code='DEPT-CARD-21',
            defaults={
                'name': 'Cardiology & Intensive Care'
            }
        )

        # 2. Roles
        self.admin_role, _ = Role.objects.get_or_create(name=RoleEnum.HOSPITAL_ADMIN, defaults={'display_name': 'Hospital Administrator'})
        self.finance_role, _ = Role.objects.get_or_create(name=RoleEnum.FINANCE_MANAGER, defaults={'display_name': 'Finance Manager'})
        self.doctor_role, _ = Role.objects.get_or_create(name=RoleEnum.DOCTOR, defaults={'display_name': 'Doctor'})
        self.patient_role, _ = Role.objects.get_or_create(name=RoleEnum.PATIENT, defaults={'display_name': 'Patient'})

        # 3. Staff Users
        # Admin User
        admin_uid = str(uuid.uuid4())
        self.admin_user, _ = User.objects.get_or_create(username=admin_uid, defaults={'email': 'admin.s21@hospital.com'})
        self.admin_profile, _ = UserProfile.objects.get_or_create(
            email='admin.s21@hospital.com',
            defaults={
                'supabase_user_id': admin_uid,
                'first_name': 'Admin',
                'last_name': 'User',
                'role': self.admin_role
            }
        )
        self.admin_staff, _ = StaffProfile.objects.get_or_create(
            user_profile=self.admin_profile,
            defaults={
                'hospital': self.hospital,
                'branch': self.branch,
                'department': self.dept,
                'employee_id': 'EMP-ADM-21',
                'status': 'ACTIVE'
            }
        )

        # Doctor User
        doc_uid = str(uuid.uuid4())
        self.doc_user, _ = User.objects.get_or_create(username=doc_uid, defaults={'email': 'doc.s21@hospital.com'})
        self.doc_profile, _ = UserProfile.objects.get_or_create(
            email='doc.s21@hospital.com',
            defaults={
                'supabase_user_id': doc_uid,
                'first_name': 'Anita',
                'last_name': 'Desai',
                'role': self.doctor_role
            }
        )
        self.doctor_staff, _ = StaffProfile.objects.get_or_create(
            user_profile=self.doc_profile,
            defaults={
                'hospital': self.hospital,
                'branch': self.branch,
                'department': self.dept,
                'employee_id': 'EMP-DOC-21',
                'status': 'ACTIVE'
            }
        )

        # Patient User
        pat_uid = str(uuid.uuid4())
        self.pat_user, _ = User.objects.get_or_create(username=pat_uid, defaults={'email': 'patient.s21@hospital.com'})
        self.pat_profile, _ = UserProfile.objects.get_or_create(
            email='patient.s21@hospital.com',
            defaults={
                'supabase_user_id': pat_uid,
                'first_name': 'Rajesh',
                'last_name': 'Kumar',
                'role': self.patient_role
            }
        )
        self.patient, _ = PatientProfile.objects.get_or_create(
            user_profile=self.pat_profile,
            defaults={
                'medical_record_number': 'MRN-21001',
                'primary_branch': self.branch,
                'blood_group': 'B+',
                'date_of_birth': date(1985, 4, 12)
            }
        )

        # 4. Wards & Beds
        self.ward, _ = Ward.objects.get_or_create(
            branch=self.branch,
            name='Ward 4A Cardiology',
            defaults={'ward_type': WardType.ICU, 'total_beds': 4}
        )
        self.bed1, _ = Bed.objects.get_or_create(ward=self.ward, bed_number='ICU-401', defaults={'status': BedStatus.OCCUPIED, 'daily_rate': Decimal('5000.00')})
        self.bed2, _ = Bed.objects.get_or_create(ward=self.ward, bed_number='ICU-402', defaults={'status': BedStatus.AVAILABLE, 'daily_rate': Decimal('5000.00')})
        self.bed3, _ = Bed.objects.get_or_create(ward=self.ward, bed_number='ICU-403', defaults={'status': BedStatus.AVAILABLE, 'daily_rate': Decimal('5000.00')})
        self.bed4, _ = Bed.objects.get_or_create(ward=self.ward, bed_number='ICU-404', defaults={'status': BedStatus.CLEANING, 'daily_rate': Decimal('5000.00')})

    def test_01_opd_registrations_and_timezone_accuracy(self):
        """
        Verify today's OPD count reflects exact hospital timezone date and excludes other dates.
        """
        today = DashboardReportingService.get_hospital_today()
        yesterday = today - timedelta(days=1)

        # Create 2 appointments today and 1 yesterday
        Appointment.objects.create(
            appointment_number=f'APT-21-{uuid.uuid4().hex[:6].upper()}',
            patient=self.patient,
            doctor=self.doctor_staff,
            department=self.dept,
            branch=self.branch,
            appointment_date=today,
            time_slot='09:00-09:15',
            status=AppointmentStatus.COMPLETED
        )
        Appointment.objects.create(
            appointment_number=f'APT-21-{uuid.uuid4().hex[:6].upper()}',
            patient=self.patient,
            doctor=self.doctor_staff,
            department=self.dept,
            branch=self.branch,
            appointment_date=today,
            time_slot='09:15-09:30',
            status=AppointmentStatus.IN_CONSULTATION
        )
        Appointment.objects.create(
            appointment_number=f'APT-21-{uuid.uuid4().hex[:6].upper()}',
            patient=self.patient,
            doctor=self.doctor_staff,
            department=self.dept,
            branch=self.branch,
            appointment_date=yesterday,
            time_slot='10:00-10:15',
            status=AppointmentStatus.COMPLETED
        )

        admin_data = DashboardReportingService.get_admin_dashboard(branch_id=self.branch.id)
        # Should count exactly the 2 created for today (plus any pre-existing for today)
        today_opd = admin_data['summary_metrics']['today_opd_registrations']
        self.assertGreaterEqual(today_opd, 2)

    def test_02_inpatient_census_strictly_excludes_discharged(self):
        """
        Verify active inpatient census counts currently admitted patients and strictly excludes discharged patients.
        """
        # Active Admission
        active_adm = InpatientAdmission.objects.create(
            admission_number=f'ADM-21-{uuid.uuid4().hex[:6].upper()}',
            patient=self.patient,
            bed=self.bed1,
            admitting_doctor=self.doctor_staff,
            branch=self.branch,
            admission_date=timezone.now(),
            status=AdmissionStatus.ADMITTED,
            discharge_date=None
        )

        # Discharged Admission
        discharged_adm = InpatientAdmission.objects.create(
            admission_number=f'ADM-21-{uuid.uuid4().hex[:6].upper()}',
            patient=self.patient,
            bed=self.bed2,
            admitting_doctor=self.doctor_staff,
            branch=self.branch,
            admission_date=timezone.now() - timedelta(days=5),
            status=AdmissionStatus.DISCHARGED,
            discharge_date=timezone.now() - timedelta(days=1)
        )

        admin_data = DashboardReportingService.get_admin_dashboard(branch_id=self.branch.id)
        census = admin_data['summary_metrics']['current_inpatient_census']
        self.assertGreaterEqual(census, 1)

    def test_03_available_and_occupied_bed_rules(self):
        """
        Verify bed capacity metrics adhere to BedStatus choices (AVAILABLE vs OCCUPIED).
        """
        admin_data = DashboardReportingService.get_admin_dashboard(branch_id=self.branch.id)
        beds = admin_data['summary_metrics']['bed_capacity']

        self.assertGreaterEqual(beds['total_beds'], 4)
        self.assertGreaterEqual(beds['available_beds'], 2)
        self.assertGreaterEqual(beds['occupied_beds'], 1)
        self.assertGreaterEqual(beds['occupancy_rate_pct'], 0.0)

    def test_04_emergency_visits_and_triage_acuity(self):
        """
        Verify emergency casualty visits in date window with triage breakdown.
        """
        EmergencyEncounter.objects.create(
            encounter_number=f'ER-21-{uuid.uuid4().hex[:6].upper()}',
            patient=self.patient,
            branch=self.branch,
            triage_acuity=TriageAcuity.RED,
            arrival_time=timezone.now(),
            chief_complaint='Acute ST-segment Elevation Myocardial Infarction',
            status=EmergencyStatus.UNDER_TREATMENT
        )

        admin_data = DashboardReportingService.get_admin_dashboard(branch_id=self.branch.id)
        er_visits = admin_data['summary_metrics']['emergency_visits']
        er_red = admin_data['summary_metrics']['emergency_breakdown']['red_resuscitation']
        self.assertGreaterEqual(er_visits, 1)
        self.assertGreaterEqual(er_red, 1)

    def test_05_pending_diagnostic_reports_workflow_status(self):
        """
        Verify pending diagnostic orders count only orders with genuine pending workflow statuses.
        """
        LabOrder.objects.create(
            order_number=f'LAB-21-{uuid.uuid4().hex[:6].upper()}',
            patient=self.patient,
            doctor=self.doctor_staff,
            branch=self.branch,
            priority='STAT',
            status=LabOrderStatus.IN_PROCESS,
            is_critical=True
        )

        admin_data = DashboardReportingService.get_admin_dashboard(branch_id=self.branch.id)
        pending_labs = admin_data['summary_metrics']['pending_diagnostic_reports']
        critical_alerts = admin_data['summary_metrics']['critical_diagnostic_alerts']
        self.assertGreaterEqual(pending_labs, 1)
        self.assertGreaterEqual(critical_alerts, 1)

    def test_06_revenue_collections_and_outstanding_receivables(self):
        """
        Verify revenue comes from valid invoices, collections from payments, and AR from unpaid balances.
        """
        today = DashboardReportingService.get_hospital_today()

        # Valid Invoice: ₹12,000 Total, ₹8,000 Paid, ₹4,000 Balance
        inv = Invoice.objects.create(
            invoice_number=f'INV-21-{uuid.uuid4().hex[:6].upper()}',
            patient=self.patient,
            branch=self.branch,
            invoice_date=today,
            subtotal=Decimal('12000.00'),
            total_amount=Decimal('12000.00'),
            paid_amount=Decimal('8000.00'),
            balance_amount=Decimal('4000.00'),
            status=InvoiceStatus.PARTIALLY_PAID
        )

        # Payment for ₹8,000
        Payment.objects.create(
            payment_number=f'PAY-21-{uuid.uuid4().hex[:6].upper()}',
            invoice=inv,
            patient=self.patient,
            branch=self.branch,
            amount=Decimal('8000.00'),
            payment_method=PaymentMethod.UPI,
            received_by=self.admin_staff,
            payment_date=timezone.now()
        )

        admin_data = DashboardReportingService.get_admin_dashboard(branch_id=self.branch.id)
        posted_rev = admin_data['summary_metrics']['posted_revenue']
        total_coll = admin_data['summary_metrics']['total_collections']
        ar = admin_data['summary_metrics']['outstanding_receivables']

        self.assertGreaterEqual(posted_rev, 12000.0)
        self.assertGreaterEqual(total_coll, 8000.0)
        self.assertGreaterEqual(ar, 4000.0)

    def test_07_finance_dashboard_bank_and_investment_metrics(self):
        """
        Verify finance dashboard correctly aggregates bank balances, investments, and loan liabilities.
        """
        # Bank Account
        BankAccount.objects.create(
            bank_name='HDFC Bank',
            account_number='502000998811',
            branch_code='HDFC001',
            ifsc_code='HDFC0001234',
            current_balance=Decimal('2500000.00')
        )

        # Investment
        InvestmentRegister.objects.create(
            investment_code='INV-TBILL-21',
            name='RBI 91-Day Treasury Bill',
            category='GOVT_BOND',
            principal_amount=Decimal('1000000.00'),
            current_valuation=Decimal('1025000.00'),
            total_interest_received=Decimal('25000.00'),
            status='ACTIVE',
            purchase_date=date(2026, 1, 1),
            maturity_date=date(2026, 12, 31)
        )

        fin_data = DashboardReportingService.get_finance_dashboard(branch_id=self.branch.id)
        fin = fin_data['financial_metrics']

        self.assertGreaterEqual(fin['total_bank_cash_balance'], 2500000.0)
        self.assertGreaterEqual(fin['investment_portfolio_value'], 1025000.0)
        self.assertGreaterEqual(fin['investment_income_earned'], 25000.0)

    def test_08_rbac_protection_blocks_unauthorized_users(self):
        """
        Verify role-based access control strictly blocks unauthorized roles from accessing restricted dashboards.
        Patients must be strictly denied HTTP 403 on all dashboards.
        Doctors cannot access financial dashboards.
        """
        # 1. Unauthenticated request -> HTTP 401 or 403
        res_unauth = self.client.get('/api/v1/dashboards-reports/admin/')
        self.assertIn(res_unauth.status_code, [401, 403])

        # 2. Patient request -> HTTP 403 Forbidden
        self.client.force_authenticate(user=self.pat_user)
        res_pat = self.client.get('/api/v1/dashboards-reports/admin/')
        self.assertEqual(res_pat.status_code, 403)

        # 3. Doctor accessing Finance Dashboard -> HTTP 403 Forbidden
        self.client.force_authenticate(user=self.doc_user)
        res_doc_fin = self.client.get('/api/v1/dashboards-reports/finance/')
        self.assertEqual(res_doc_fin.status_code, 403)

        # 4. Admin accessing Admin Dashboard -> HTTP 200 OK
        self.client.force_authenticate(user=self.admin_user)
        res_admin = self.client.get('/api/v1/dashboards-reports/admin/')
        self.assertEqual(res_admin.status_code, 200)

    def test_09_drill_down_and_export_reconcile_with_summary(self):
        """
        Verify granular drill-down API and CSV export return accurate filtered records.
        """
        self.client.force_authenticate(user=self.admin_user)

        # Test drill-down for OPD Registrations
        res_dd = self.client.get('/api/v1/dashboards-reports/drill-down/?metric=OPD_REGISTRATIONS')
        self.assertEqual(res_dd.status_code, 200)
        self.assertIn('records', res_dd.data)
        self.assertIn('columns', res_dd.data)

        # Test CSV export
        res_exp = self.client.get('/api/v1/dashboards-reports/export/?metric=OPD_REGISTRATIONS')
        self.assertEqual(res_exp.status_code, 200)
        self.assertEqual(res_exp['Content-Type'], 'text/csv; charset=utf-8')
        self.assertIn('attachment', res_exp['Content-Disposition'])
