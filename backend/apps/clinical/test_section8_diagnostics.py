import uuid
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile
from apps.billing_finance.models import Invoice, InvoiceItem, ChargeItemType
from apps.clinical.models import (
    Appointment, InpatientAdmission, EmergencyEncounter,
    LabTestCatalogue, LabCategory, LabOrder, LabOrderItem,
    LabOrderStatus, LabItemStatus, LabSample, SampleStatus,
    ExternalDiagnosticProvider, DiagnosticEncounterType,
    ModalityEnum, RadiologyOrder, RadiologyStatus,
    DiagnosticReport, DiagnosticReportStatus, CriticalAlertNotification,
    DiagnosticEquipment, EquipmentTransmissionLog
)

User = get_user_model()


class TestSection8LaboratoryDiagnostics(TestCase):
    """
    Comprehensive functional, security, and integration test suite for
    Section 8: Laboratory and Diagnostic Management.
    """

    def setUp(self):
        self.client = APIClient()

        # Core Enterprise Hierarchy
        self.hospital = Hospital.objects.create(
            name='Apollo Memorial Hospital',
            code=f"HOSP-{uuid.uuid4().hex[:4].upper()}"
        )
        self.branch = Branch.objects.create(
            hospital=self.hospital,
            name='Central Medical Campus',
            code=f"BR-{uuid.uuid4().hex[:4].upper()}"
        )
        self.lab_dept = Department.objects.create(
            branch=self.branch,
            name='Pathology & Clinical Biochemistry',
            code=f"DEP-LAB-{uuid.uuid4().hex[:4].upper()}"
        )
        self.rad_dept = Department.objects.create(
            branch=self.branch,
            name='Diagnostic Radiology & Imaging',
            code=f"DEP-RAD-{uuid.uuid4().hex[:4].upper()}"
        )

        # Roles
        self.doctor_role, _ = Role.objects.get_or_create(name=RoleEnum.DOCTOR, defaults={'display_name': 'Doctor'})
        self.lab_tech_role, _ = Role.objects.get_or_create(name=RoleEnum.LAB_TECHNICIAN, defaults={'display_name': 'Lab Technician'})
        self.patient_role, _ = Role.objects.get_or_create(name=RoleEnum.PATIENT, defaults={'display_name': 'Patient'})
        self.admin_role, _ = Role.objects.get_or_create(name=RoleEnum.HOSPITAL_ADMIN, defaults={'display_name': 'Hospital Admin'})

        # Doctor Profile
        self.doc_sub = uuid.uuid4()
        self.doc_auth = User.objects.create_user(username=str(self.doc_sub), email='dr.sharma@hospital.local')
        self.doc_user = UserProfile.objects.create(
            supabase_user_id=self.doc_sub,
            email='dr.sharma@hospital.local',
            first_name='Vikram',
            last_name='Sharma',
            role=self.doctor_role
        )
        self.doctor = StaffProfile.objects.create(
            user_profile=self.doc_user,
            hospital=self.hospital,
            branch=self.branch,
            department=self.lab_dept,
            employee_id=f"EMP-DOC-{uuid.uuid4().hex[:4].upper()}",
            designation='Consultant Pathologist & Clinical Lead',
            status='ACTIVE'
        )

        # Pathologist 2 (for Separation of Duties test)
        self.doc2_sub = uuid.uuid4()
        self.doc2_auth = User.objects.create_user(username=str(self.doc2_sub), email='dr.verma@hospital.local')
        self.doc2_user = UserProfile.objects.create(
            supabase_user_id=self.doc2_sub,
            email='dr.verma@hospital.local',
            first_name='Anjali',
            last_name='Verma',
            role=self.doctor_role
        )
        self.doctor2 = StaffProfile.objects.create(
            user_profile=self.doc2_user,
            hospital=self.hospital,
            branch=self.branch,
            department=self.lab_dept,
            employee_id=f"EMP-DOC2-{uuid.uuid4().hex[:4].upper()}",
            designation='Senior Consulting Pathologist',
            status='ACTIVE'
        )

        # Lab Technician
        self.tech_sub = uuid.uuid4()
        self.tech_auth = User.objects.create_user(username=str(self.tech_sub), email='tech.rajesh@hospital.local')
        self.tech_user = UserProfile.objects.create(
            supabase_user_id=self.tech_sub,
            email='tech.rajesh@hospital.local',
            first_name='Rajesh',
            last_name='Kumar',
            role=self.lab_tech_role
        )
        self.lab_tech = StaffProfile.objects.create(
            user_profile=self.tech_user,
            hospital=self.hospital,
            branch=self.branch,
            department=self.lab_dept,
            employee_id=f"EMP-TECH-{uuid.uuid4().hex[:4].upper()}",
            designation='Senior Phlebotomist & Lab Technologist',
            status='ACTIVE'
        )

        # Patient 1
        self.pat1_sub = uuid.uuid4()
        self.pat1_auth = User.objects.create_user(username=str(self.pat1_sub), email='patient.meera@gmail.com')
        self.pat1_user = UserProfile.objects.create(
            supabase_user_id=self.pat1_sub,
            email='patient.meera@gmail.com',
            first_name='Meera',
            last_name='Nair',
            role=self.patient_role
        )
        self.patient1 = PatientProfile.objects.create(
            user_profile=self.pat1_user,
            primary_branch=self.branch,
            medical_record_number=f"MRN-{uuid.uuid4().hex[:6].upper()}",
            gender='FEMALE',
            date_of_birth='1988-04-12'
        )

        # Patient 2 (Security Isolation check)
        self.pat2_sub = uuid.uuid4()
        self.pat2_auth = User.objects.create_user(username=str(self.pat2_sub), email='patient.rahul@gmail.com')
        self.pat2_user = UserProfile.objects.create(
            supabase_user_id=self.pat2_sub,
            email='patient.rahul@gmail.com',
            first_name='Rahul',
            last_name='Mehta',
            role=self.patient_role
        )
        self.patient2 = PatientProfile.objects.create(
            user_profile=self.pat2_user,
            primary_branch=self.branch,
            medical_record_number=f"MRN-{uuid.uuid4().hex[:6].upper()}",
            gender='MALE'
        )

        # External Laboratory Provider
        self.external_provider = ExternalDiagnosticProvider.objects.create(
            name='Dr Lal PathLabs Reference Central',
            code='LAL-DELHI-01',
            contact_person='Dr. S. K. Gupta',
            phone='+91-11-49887766',
            email='reference@lalpathlabs.com',
            accreditation='NABL / CAP Certified Reference Laboratory',
            standard_tat_hours=48,
            is_active=True
        )

        # Diagnostic Test Catalogue Items
        self.cbc_test = LabTestCatalogue.objects.create(
            code='CBC_001',
            name='Complete Blood Count (CBC) with Differential',
            category=LabCategory.HEMATOLOGY,
            department=self.lab_dept,
            sample_type='Whole Blood (EDTA)',
            specimen_container='Lavender Top (EDTA 3mL)',
            standard_rate=Decimal('450.00'),
            turnaround_hours=3,
            reference_range='Hb: 12.0 - 16.0 g/dL, WBC: 4,000 - 11,000 /uL',
            unit_of_measurement='g/dL',
            normal_min=Decimal('12.000'),
            normal_max=Decimal('16.000'),
            critical_low=Decimal('7.000'),
            critical_high=Decimal('20.000')
        )

        self.potassium_test = LabTestCatalogue.objects.create(
            code='POT_001',
            name='Serum Potassium (K+)',
            category=LabCategory.BIOCHEMISTRY,
            department=self.lab_dept,
            sample_type='Serum',
            specimen_container='Gold Top (SST Gel Separator)',
            standard_rate=Decimal('250.00'),
            turnaround_hours=2,
            reference_range='3.5 - 5.1 mEq/L',
            unit_of_measurement='mEq/L',
            normal_min=Decimal('3.500'),
            normal_max=Decimal('5.100'),
            critical_low=Decimal('2.800'),
            critical_high=Decimal('6.200')
        )

        self.outsourced_biopsy = LabTestCatalogue.objects.create(
            code='HISTO_001',
            name='Histopathology / Specialized Biopsy Immunohistochemistry',
            category=LabCategory.PATHOLOGY,
            department=self.lab_dept,
            sample_type='Tissue Biopsy in 10% Formalin',
            specimen_container='Sterile Specimen Container',
            standard_rate=Decimal('2800.00'),
            turnaround_hours=72,
            reference_range='Histological tissue examination',
            is_outsourced=True,
            external_provider=self.external_provider,
            outsourced_cost=Decimal('1400.00')
        )

    # -------------------------------------------------------------------------
    # TEST 1: Dashboard Operational Metrics
    # -------------------------------------------------------------------------
    def test_01_laboratory_dashboard_stats(self):
        """Verify real-time database-backed dashboard metrics."""
        self.client.force_authenticate(user=self.doc_auth)
        res = self.client.get('/api/v1/clinical/lab/dashboard-stats/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('orders_received_today', res.data)
        self.assertIn('awaiting_collection', res.data)
        self.assertIn('critical_unacknowledged', res.data)
        self.assertIn('category_counts', res.data)

    # -------------------------------------------------------------------------
    # TEST 2: Test Catalogue CRUD & Price Invariance
    # -------------------------------------------------------------------------
    def test_02_test_catalogue_management_and_price_invariance(self):
        """Verify catalogue creation, price changes, and historical order price invariance."""
        self.client.force_authenticate(user=self.doc_auth)

        # Create new test
        create_res = self.client.post('/api/v1/clinical/lab/catalogue/', {
            'code': 'TROP_I',
            'name': 'High-Sensitivity Troponin I (Cardiac Biomarker)',
            'category': LabCategory.BIOCHEMISTRY,
            'standard_rate': '950.00',
            'turnaround_hours': 1,
            'unit_of_measurement': 'ng/L',
            'normal_max': '14.000',
            'critical_high': '50.000'
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        trop_id = create_res.data['id']

        # Place order capturing standard rate ₹950
        order_res = self.client.post('/api/v1/clinical/lab/orders/create/', {
            'patient_id': str(self.patient1.id),
            'test_ids': [trop_id],
            'priority': 'STAT'
        }, format='json')
        self.assertEqual(order_res.status_code, status.HTTP_201_CREATED)
        order_id = order_res.data['id']
        first_item = order_res.data['items'][0]
        self.assertEqual(Decimal(first_item['captured_price']), Decimal('950.00'))

        # Update catalogue price to ₹1200
        patch_res = self.client.patch(f"/api/v1/clinical/lab/catalogue/{trop_id}/", {
            'standard_rate': '1200.00'
        }, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)

        # Verify historical order item captured price is unchanged (still ₹950)
        reloaded_item = LabOrderItem.objects.get(id=first_item['id'])
        self.assertEqual(reloaded_item.captured_price, Decimal('950.00'))

    # -------------------------------------------------------------------------
    # TEST 3: Investigation Orders & Duplicate Prevention
    # -------------------------------------------------------------------------
    def test_03_investigation_orders_and_duplicate_prevention(self):
        """Verify order creation from clinical encounters and 24-hour duplicate protection."""
        self.client.force_authenticate(user=self.doc_auth)

        # Place initial order
        res1 = self.client.post('/api/v1/clinical/lab/orders/create/', {
            'patient_id': str(self.patient1.id),
            'test_ids': [str(self.cbc_test.id)],
            'priority': 'ROUTINE',
            'clinical_notes': 'Routine annual health checkup'
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        order_number = res1.data['order_number']
        self.assertTrue(order_number.startswith('LAB-'))

        # Attempt duplicate order without override -> Expect 409 Conflict
        res2 = self.client.post('/api/v1/clinical/lab/orders/create/', {
            'patient_id': str(self.patient1.id),
            'test_ids': [str(self.cbc_test.id)],
            'priority': 'ROUTINE'
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(res2.data.get('duplicate_warning'))

        # Override with allow_duplicate=True -> Expect 201 Created
        res3 = self.client.post('/api/v1/clinical/lab/orders/create/', {
            'patient_id': str(self.patient1.id),
            'test_ids': [str(self.cbc_test.id)],
            'priority': 'ROUTINE',
            'allow_duplicate': True
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_201_CREATED)

    # -------------------------------------------------------------------------
    # TEST 4: Billing Synchronization (No Double Billing)
    # -------------------------------------------------------------------------
    def test_04_billing_synchronization(self):
        """Verify diagnostic charges are automatically reflected on patient invoice."""
        self.client.force_authenticate(user=self.doc_auth)

        res = self.client.post('/api/v1/clinical/lab/orders/create/', {
            'patient_id': str(self.patient1.id),
            'test_ids': [str(self.cbc_test.id), str(self.potassium_test.id)],
            'priority': 'URGENT'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order = LabOrder.objects.get(id=res.data['id'])

        # Verify linked invoice exists and includes lab charge items
        self.assertIsNotNone(order.invoice)
        lab_items = order.invoice.items.filter(item_type=ChargeItemType.LAB_TEST)
        self.assertEqual(lab_items.count(), 2)
        expected_total = self.cbc_test.standard_rate + self.potassium_test.standard_rate
        self.assertEqual(order.invoice.total_amount, expected_total)

    # -------------------------------------------------------------------------
    # TEST 5: Sample Collection, Barcode Tracking & Lookup
    # -------------------------------------------------------------------------
    def test_05_sample_collection_and_barcode_lookup(self):
        """Verify sample accessioning, unique barcode generation, and lookup fallback."""
        self.client.force_authenticate(user=self.tech_auth)

        # Create order
        order = LabOrder.objects.create(
            order_number=f"LAB-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient1,
            doctor=self.doctor,
            branch=self.branch,
            priority='ROUTINE'
        )
        item = LabOrderItem.objects.create(lab_order=order, test=self.cbc_test)

        # Collect sample
        collect_res = self.client.post(f"/api/v1/clinical/lab/orders/{order.id}/collect-sample/", {
            'specimen_type': 'Whole Blood (EDTA)',
            'container_type': 'Lavender Top 3mL',
            'collection_site': 'Right median cubital vein'
        })
        self.assertEqual(collect_res.status_code, status.HTTP_201_CREATED)
        barcode = collect_res.data['sample']['sample_barcode']
        self.assertTrue(barcode.startswith('SMP-'))

        # Verify barcode lookup
        lookup_res = self.client.get(f"/api/v1/clinical/lab/barcode/{barcode}/")
        self.assertEqual(lookup_res.status_code, status.HTTP_200_OK)
        self.assertTrue(lookup_res.data['found'])
        self.assertEqual(lookup_res.data['sample']['sample_barcode'], barcode)

    # -------------------------------------------------------------------------
    # TEST 6: Sample Rejection and Linked Recollection
    # -------------------------------------------------------------------------
    def test_06_sample_rejection_and_recollection(self):
        """Verify sample rejection (e.g. hemolyzed) and linked recollection history."""
        self.client.force_authenticate(user=self.tech_auth)

        order = LabOrder.objects.create(
            order_number=f"LAB-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient1,
            doctor=self.doctor,
            branch=self.branch,
            status=LabOrderStatus.ORDERED
        )
        sample = LabSample.objects.create(
            sample_barcode=f"SMP-{uuid.uuid4().hex[:6].upper()}",
            lab_order=order,
            patient=self.patient1,
            specimen_type='Serum',
            status=SampleStatus.COLLECTED
        )

        # Reject sample
        reject_res = self.client.post(f"/api/v1/clinical/lab/samples/{sample.id}/action/", {
            'action': 'REJECT',
            'reason': 'Grossly hemolyzed specimen, unsuitable for potassium measurement.'
        })
        self.assertEqual(reject_res.status_code, status.HTTP_200_OK)
        sample.refresh_from_db()
        self.assertEqual(sample.status, SampleStatus.REJECTED)

        # Recollect sample
        recollect_res = self.client.post(f"/api/v1/clinical/lab/samples/{sample.id}/action/", {
            'action': 'RECOLLECTION'
        })
        self.assertEqual(recollect_res.status_code, status.HTTP_200_OK)
        new_sample = LabSample.objects.get(id=recollect_res.data['sample']['id'])
        self.assertTrue(new_sample.is_recollection)
        self.assertEqual(new_sample.recollected_from_sample, sample)

    # -------------------------------------------------------------------------
    # TEST 7: Result Entry, Automated Abnormal & Critical Panic Value Alerts
    # -------------------------------------------------------------------------
    def test_07_result_entry_and_critical_panic_alert(self):
        """Verify normal/abnormal auto-flagging and critical panic alert generation."""
        self.client.force_authenticate(user=self.tech_auth)

        order = LabOrder.objects.create(
            order_number=f"LAB-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient1,
            doctor=self.doctor,
            branch=self.branch
        )
        item = LabOrderItem.objects.create(
            lab_order=order,
            test=self.potassium_test,  # Critical Low < 2.8, Normal 3.5 - 5.1
            captured_price=self.potassium_test.standard_rate
        )

        # Enter a critical panic value: Potassium = 2.1 mEq/L
        entry_res = self.client.post(f"/api/v1/clinical/lab/items/{item.id}/enter-result/", {
            'result_value': '2.1',
            'result_notes': 'Confirmed on repeat dilution analyzer test'
        })
        self.assertEqual(entry_res.status_code, status.HTTP_200_OK)
        self.assertTrue(entry_res.data['is_critical_alert_triggered'])

        item.refresh_from_db()
        self.assertTrue(item.is_critical)
        self.assertEqual(item.abnormal_flag, 'CRITICAL_LOW')

        # Verify CriticalAlertNotification created
        alert = CriticalAlertNotification.objects.filter(order_item=item).first()
        self.assertIsNotNone(alert)
        self.assertEqual(alert.critical_value, '2.1 mEq/L')
        self.assertFalse(alert.is_acknowledged)

        # Doctor acknowledges critical alert
        self.client.force_authenticate(user=self.doc_auth)
        ack_res = self.client.post(f"/api/v1/clinical/lab/critical-alerts/{alert.id}/acknowledge/", {
            'acknowledgement_notes': 'Patient telephoned immediately. Emergency IV potassium infusion initiated.'
        })
        self.assertEqual(ack_res.status_code, status.HTTP_200_OK)
        alert.refresh_from_db()
        self.assertTrue(alert.is_acknowledged)

    # -------------------------------------------------------------------------
    # TEST 8: Report Approval with Separation of Duties
    # -------------------------------------------------------------------------
    def test_08_report_approval_and_separation_of_duties(self):
        """Verify report approval workflow and enforcement of separation of duties."""
        order = LabOrder.objects.create(
            order_number=f"LAB-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient1,
            doctor=self.doctor,
            branch=self.branch,
            status=LabOrderStatus.IN_PROCESS
        )
        item = LabOrderItem.objects.create(
            lab_order=order,
            test=self.cbc_test,
            result_value='14.2',
            entered_by=self.doctor  # Doctor 1 entered the result
        )

        # Doctor 1 tries to approve their own work with separation of duties enforced
        self.client.force_authenticate(user=self.doc_auth)
        self_approve_res = self.client.post(f"/api/v1/clinical/lab/orders/{order.id}/approve/", {
            'enforce_separation_of_duties': True
        })
        self.assertEqual(self_approve_res.status_code, status.HTTP_403_FORBIDDEN)

        # Doctor 2 (independent pathologist) reviews and approves
        self.client.force_authenticate(user=self.doc2_auth)
        doc2_approve_res = self.client.post(f"/api/v1/clinical/lab/orders/{order.id}/approve/", {
            'summary_findings': 'Normal hematology profile.'
        })
        self.assertEqual(doc2_approve_res.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, LabOrderStatus.APPROVED)

    # -------------------------------------------------------------------------
    # TEST 9: Report Release and Controlled Amendments
    # -------------------------------------------------------------------------
    def test_09_report_release_and_amendments(self):
        """Verify digital signature release and version-controlled amendments."""
        self.client.force_authenticate(user=self.doc_auth)

        order = LabOrder.objects.create(
            order_number=f"LAB-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient1,
            doctor=self.doctor,
            branch=self.branch,
            status=LabOrderStatus.APPROVED
        )
        item = LabOrderItem.objects.create(
            lab_order=order,
            test=self.cbc_test,
            result_value='12.5',
            status=LabItemStatus.APPROVED
        )

        # Release report
        rel_res = self.client.post(f"/api/v1/clinical/lab/orders/{order.id}/release/")
        self.assertEqual(rel_res.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, LabOrderStatus.RELEASED)
        report = DiagnosticReport.objects.get(lab_order=order, version=1)
        self.assertTrue(report.is_released)
        self.assertTrue(len(report.digital_signature_hash) > 10)

        # Amend released report (e.g. clerical correction: Hb was 13.5 g/dL)
        amend_res = self.client.post(f"/api/v1/clinical/lab/orders/{order.id}/amend/", {
            'amendment_reason': 'Clerical transcription adjustment after secondary manual review.',
            'item_updates': [{'item_id': str(item.id), 'new_value': '13.5'}]
        }, format='json')
        self.assertEqual(amend_res.status_code, status.HTTP_200_OK)

        # Verify amended report version 2 created and past value preserved
        amended_rep = DiagnosticReport.objects.get(lab_order=order, version=2)
        self.assertEqual(amended_rep.version, 2)
        self.assertEqual(amended_rep.original_report, report)
        item.refresh_from_db()
        self.assertEqual(item.result_value, '13.5')
        self.assertEqual(item.previous_result_value, '12.5')

    # -------------------------------------------------------------------------
    # TEST 10: Radiology RIS Scheduling, Procedure, and Diagnostic Reporting
    # -------------------------------------------------------------------------
    def test_10_radiology_workflow_and_reporting(self):
        """Verify imaging study requisition, scheduling, completion, and radiologist report."""
        self.client.force_authenticate(user=self.doc_auth)

        # Request CT Brain
        rad_res = self.client.post('/api/v1/clinical/radiology/orders/', {
            'patient_id': str(self.patient1.id),
            'doctor_id': str(self.doctor.id),
            'branch_id': str(self.branch.id),
            'modality': 'CT_SCAN',
            'study_name': 'NCCT Brain Plain',
            'clinical_indication': 'Acute severe headache with transient diplopia',
            'priority': 'URGENT'
        }, format='json')
        self.assertEqual(rad_res.status_code, status.HTTP_201_CREATED)
        rad_id = rad_res.data['id']
        rad_order = RadiologyOrder.objects.get(id=rad_id)
        self.assertEqual(rad_order.status, RadiologyStatus.REQUESTED)

        # Schedule procedure
        sched_res = self.client.post(f"/api/v1/clinical/radiology/orders/{rad_id}/schedule/", {
            'scheduled_date': str(timezone.now().date()),
            'scheduled_time': '11:30:00',
            'suite_room': 'CT Suite 2'
        }, format='json')
        self.assertEqual(sched_res.status_code, status.HTTP_200_OK)

        # Technician completes procedure
        comp_res = self.client.post(f"/api/v1/clinical/radiology/orders/{rad_id}/complete/", {
            'pacs_study_uid': '1.2.840.10008.5.1.4.1.1.2.999888'
        }, format='json')
        self.assertEqual(comp_res.status_code, status.HTTP_200_OK)

        # Radiologist approves and releases report
        report_res = self.client.post(f"/api/v1/clinical/radiology/orders/{rad_id}/report/", {
            'action': 'APPROVE',
            'technique': 'Non-contrast 5mm axial helical CT sections of the brain',
            'findings': 'Normal brain parenchyma. No acute intracranial hemorrhage or territorial infarct.',
            'impression': 'Normal non-contrast CT study of the brain with no acute pathology.',
            'key_recommendations': 'Clinical correlation and outpatient neurology follow-up.'
        }, format='json')
        self.assertEqual(report_res.status_code, status.HTTP_200_OK)
        rad_order.refresh_from_db()
        self.assertEqual(rad_order.status, RadiologyStatus.RELEASED)
        self.assertTrue(rad_order.is_released)

    # -------------------------------------------------------------------------
    # TEST 11: Security & Patient Portal Isolation
    # -------------------------------------------------------------------------
    def test_11_patient_report_security_isolation(self):
        """Verify patient can ONLY access their own released report, never drafts or other patients."""
        # Create released report for Patient 1
        order1 = LabOrder.objects.create(
            order_number=f"LAB-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient1,
            doctor=self.doctor,
            branch=self.branch,
            status=LabOrderStatus.RELEASED
        )
        report1 = DiagnosticReport.objects.create(
            report_number=f"REP-{uuid.uuid4().hex[:6].upper()}",
            report_type='LABORATORY',
            lab_order=order1,
            patient=self.patient1,
            branch=self.branch,
            is_released=True,
            status=DiagnosticReportStatus.RELEASED
        )

        # Create unreleased draft report for Patient 1
        order_draft = LabOrder.objects.create(
            order_number=f"LAB-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient1,
            doctor=self.doctor,
            branch=self.branch,
            status=LabOrderStatus.IN_PROCESS
        )
        draft_report = DiagnosticReport.objects.create(
            report_number=f"REP-DRAFT-{uuid.uuid4().hex[:6].upper()}",
            report_type='LABORATORY',
            lab_order=order_draft,
            patient=self.patient1,
            branch=self.branch,
            is_released=False,
            status=DiagnosticReportStatus.DRAFT
        )

        # Authenticate as Patient 1 -> Can view own released report
        self.client.force_authenticate(user=self.pat1_auth)
        res_ok = self.client.get(f"/api/v1/clinical/lab/reports/{report1.id}/detail/")
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)

        # Patient 1 tries to access unreleased draft report -> Expect 403 Forbidden
        res_draft = self.client.get(f"/api/v1/clinical/lab/reports/{draft_report.id}/detail/")
        self.assertEqual(res_draft.status_code, status.HTTP_403_FORBIDDEN)

        # Authenticate as Patient 2 -> Tries to access Patient 1's report -> Expect 403 Forbidden
        self.client.force_authenticate(user=self.pat2_auth)
        res_forbidden = self.client.get(f"/api/v1/clinical/lab/reports/{report1.id}/detail/")
        self.assertEqual(res_forbidden.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # TEST 12: Diagnostic Equipment Ingestion & Simulator
    # -------------------------------------------------------------------------
    def test_12_equipment_integration_and_simulator(self):
        """Verify automated laboratory equipment result ingestion and simulator."""
        self.client.force_authenticate(user=self.tech_auth)

        # Create equipment node
        analyzer = DiagnosticEquipment.objects.create(
            name='Sysmex XN-550 Automated Hematology Analyzer',
            model_number='XN-550',
            serial_number=f"SYS-{uuid.uuid4().hex[:6].upper()}",
            category='HEMATOLOGY',
            branch=self.branch,
            department=self.lab_dept,
            protocol_type='HL7_V2'
        )

        order = LabOrder.objects.create(
            order_number=f"LAB-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient1,
            doctor=self.doctor,
            branch=self.branch
        )
        sample = LabSample.objects.create(
            sample_barcode=f"SMP-{uuid.uuid4().hex[:6].upper()}",
            lab_order=order,
            patient=self.patient1,
            specimen_type='Whole Blood',
            status=SampleStatus.COLLECTED
        )
        item = LabOrderItem.objects.create(
            lab_order=order,
            test=self.cbc_test,
            sample=sample
        )

        # Ingest equipment payload
        ingest_res = self.client.post('/api/v1/clinical/lab/equipment/ingest/', {
            'sample_barcode': sample.sample_barcode,
            'analyzer_serial_number': analyzer.serial_number,
            'results': {'CBC_001': '14.8'}
        }, format='json')
        self.assertEqual(ingest_res.status_code, status.HTTP_200_OK)
        item.refresh_from_db()
        self.assertEqual(item.result_value, '14.8')
        self.assertEqual(item.status, LabItemStatus.ENTERED)

        # Verify transmission log
        log_entry = EquipmentTransmissionLog.objects.filter(sample_barcode=sample.sample_barcode).first()
        self.assertIsNotNone(log_entry)
        self.assertEqual(log_entry.status, 'SUCCESS')

    # -------------------------------------------------------------------------
    # TEST 13: Outsourced Test Tracking and Expenses
    # -------------------------------------------------------------------------
    def test_13_outsourced_test_tracking_and_expenses(self):
        """Verify outsourced dispatch, courier tracking, and separate hospital expense recording."""
        self.client.force_authenticate(user=self.doc_auth)

        # Order outsourced biopsy
        order_res = self.client.post('/api/v1/clinical/lab/orders/create/', {
            'patient_id': str(self.patient1.id),
            'test_ids': [str(self.outsourced_biopsy.id)],
            'priority': 'ROUTINE'
        }, format='json')
        self.assertEqual(order_res.status_code, status.HTTP_201_CREATED)
        order_id = order_res.data['id']
        order = LabOrder.objects.get(id=order_id)
        self.assertTrue(order.is_outsourced)

        # Dispatch sample to external lab
        disp_res = self.client.post(f"/api/v1/clinical/lab/outsourced/{order.id}/dispatch/", {
            'external_reference_number': 'BLUEDART-AIR-789012',
            'expected_tat_days': 3
        }, format='json')
        self.assertEqual(disp_res.status_code, status.HTTP_200_OK)

        # Receive external results and record hospital cost (₹1400)
        rec_res = self.client.post(f"/api/v1/clinical/lab/outsourced/{order.id}/receive-results/", {
            'external_cost': '1400.00',
            'external_report_url': 'https://storage.hospital.local/reports/external-biopsy-101.pdf',
            'result_value': 'Benign hyperplastic lymphoid follicle. No evidence of malignancy.'
        }, format='json')
        self.assertEqual(rec_res.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.external_cost, Decimal('1400.00'))
        self.assertEqual(order.status, LabOrderStatus.AWAITING_APPROVAL)

    # -------------------------------------------------------------------------
    # TEST 14: Test-Wise Revenue and Expense Financial Reports
    # -------------------------------------------------------------------------
    def test_14_test_wise_revenue_and_expense_reports(self):
        """Verify diagnostic financial reporting computes billed revenue, expenses, and margins."""
        self.client.force_authenticate(user=self.doc_auth)

        res = self.client.get('/api/v1/clinical/lab/financial-reports/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('grand_billed_revenue', res.data)
        self.assertIn('grand_diagnostic_expenses', res.data)
        self.assertIn('grand_net_contribution', res.data)
        self.assertIn('test_breakdown', res.data)

    # -------------------------------------------------------------------------
    # TEST 15: HL7 v2.5.1 and FHIR R4 Interoperability
    # -------------------------------------------------------------------------
    def test_15_hl7_and_fhir_interoperability(self):
        """Verify HL7 v2.5.1 ORU^R01 packet and FHIR R4 DiagnosticReport resources."""
        self.client.force_authenticate(user=self.doc_auth)

        order = LabOrder.objects.create(
            order_number=f"LAB-{uuid.uuid4().hex[:6].upper()}",
            patient=self.patient1,
            doctor=self.doctor,
            branch=self.branch
        )
        LabOrderItem.objects.create(lab_order=order, test=self.cbc_test, result_value='13.8')

        # Test HL7 format
        hl7_res = self.client.get(f"/api/v1/clinical/lab/orders/{order.id}/interoperability/?format=hl7")
        print("DEBUG RES:", hl7_res.status_code, hl7_res.content)
        self.assertEqual(hl7_res.status_code, status.HTTP_200_OK)
        self.assertEqual(hl7_res.data['format'], 'HL7_V2.5.1')
        self.assertIn('MSH|^~\\&|HMS_LIS', hl7_res.data['hl7_message'])
        self.assertIn('OBR|1|', hl7_res.data['hl7_message'])

        # Test FHIR format
        fhir_res = self.client.get(f"/api/v1/clinical/lab/orders/{order.id}/interoperability/?format=fhir")
        self.assertEqual(fhir_res.status_code, status.HTTP_200_OK)
        self.assertEqual(fhir_res.data['format'], 'FHIR_R4')
        self.assertEqual(fhir_res.data['resource']['resourceType'], 'DiagnosticReport')
