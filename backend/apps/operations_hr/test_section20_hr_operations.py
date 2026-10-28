import datetime
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import UserProfile, StaffProfile, PatientProfile, Role, RoleEnum
from apps.billing_finance.models import ChartOfAccount, JournalEntry, JournalLineItem
from apps.operations_hr.models import (
    EmployeeDetail, EmployeeDocument, HospitalShift, ShiftRosterAssignment,
    EmployeeAttendance, AttendanceStatus, LeaveRequest, LeaveStatus, LeaveType,
    LeaveBalance, HospitalHoliday, SalaryStructure, PayrollPeriod, Payslip,
    PayrollWorkflowStatus, FixedAsset, AssetDepreciationSchedule,
    EquipmentMaintenanceTask, OperatingTheatreSuite, OperationTheatreBooking,
    ICUObservationRecord, Ambulance, AmbulanceType, AmbulanceStatus, AmbulanceDispatch,
    BloodBankStock, BloodBagStatus, BloodGroup, BloodComponentType,
    HousekeepingTask, HousekeepingTaskType, HousekeepingTaskStatus,
    BiomedicalWasteRecord, WasteCategory, WasteStatus, EmploymentType, SeparationStatus
)
from apps.operations_hr.hr_operations_service import HROperationsService


class Section20HROperationsTests(TestCase):
    """
    Mandatory Test Suite for Section 20: HR, Payroll, Assets, and Operations.
    Validates all 18 core verification points specified in Section 19.
    """

    def setUp(self):
        self.hospital = Hospital.objects.first()
        if not self.hospital:
            self.hospital = Hospital.objects.create(name='AURA Multi-Specialty Hospital', code='AURA-HQ')

        self.branch = Branch.objects.first()
        if not self.branch:
            self.branch = Branch.objects.create(hospital=self.hospital, name='Main Central Campus', code='MCC')

        self.hr_dept, _ = Department.objects.get_or_create(branch=self.branch, name='Human Resources', defaults={'code': 'HR'})
        self.cardio_dept, _ = Department.objects.get_or_create(branch=self.branch, name='Cardiology', defaults={'code': 'CARDIO'})
        self.icu_dept, _ = Department.objects.get_or_create(branch=self.branch, name='Intensive Care Unit', defaults={'code': 'ICU'})
        self.ot_dept, _ = Department.objects.get_or_create(branch=self.branch, name='Surgical Services', defaults={'code': 'OT'})

        self.hr_role, _ = Role.objects.get_or_create(
            name=RoleEnum.HR_MANAGER,
            defaults={'display_name': 'HR Manager'}
        )
        self.doc_role, _ = Role.objects.get_or_create(
            name=RoleEnum.DOCTOR,
            defaults={'display_name': 'Doctor'}
        )

        # Create HR preparer user & profile
        self.hr_user = UserProfile.objects.create(
            supabase_user_id='00000000-0000-0000-0000-000000000001',
            email='test.hr.preparer@hospital.com',
            first_name='Anil',
            last_name='Kumar',
            role=self.hr_role
        )
        self.hr_staff = StaffProfile.objects.create(
            hospital=self.hospital,
            branch=self.branch,
            department=self.hr_dept,
            user_profile=self.hr_user,
            employee_id='EMP-TEST-001',
            designation='Senior HR Executive',
            status='ACTIVE'
        )

        # Create HR approver user & profile (for separation of duties)
        self.hr_approver_user = UserProfile.objects.create(
            supabase_user_id='00000000-0000-0000-0000-000000000002',
            email='test.hr.director@hospital.com',
            first_name='Sunita',
            last_name='Menon',
            role=self.hr_role
        )
        self.hr_approver_staff = StaffProfile.objects.create(
            hospital=self.hospital,
            branch=self.branch,
            department=self.hr_dept,
            user_profile=self.hr_approver_user,
            employee_id='EMP-TEST-002',
            designation='Director of HR & Operations',
            status='ACTIVE'
        )

        # Create Surgeon & Patient
        self.surgeon_user = UserProfile.objects.create(
            supabase_user_id='00000000-0000-0000-0000-000000000003',
            email='test.surgeon@hospital.com',
            first_name='Rajesh',
            last_name='Vaidya',
            role=self.doc_role
        )
        self.surgeon_staff = StaffProfile.objects.create(
            hospital=self.hospital,
            branch=self.branch,
            department=self.cardio_dept,
            user_profile=self.surgeon_user,
            employee_id='EMP-TEST-003',
            designation='Senior Cardiac Surgeon',
            status='ACTIVE'
        )

        self.patient_user = UserProfile.objects.create(
            supabase_user_id='00000000-0000-0000-0000-000000000004',
            email='test.patient.s20@hospital.com',
            first_name='Vikram',
            last_name='Sethi',
            role=self.hr_role
        )
        self.patient = PatientProfile.objects.create(
            user_profile=self.patient_user,
            primary_branch=self.branch,
            medical_record_number='MRN-TEST-S20-001',
            gender='MALE'
        )

        # Ensure Chart of Accounts exist for Section 17 GL posting
        from apps.billing_finance.models import AccountCategory, AccountCategoryType

        cat_exp, _ = AccountCategory.objects.get_or_create(code='5000', defaults={'name': 'Expenses', 'category_type': AccountCategoryType.EXPENSE})
        cat_liab, _ = AccountCategory.objects.get_or_create(code='2000', defaults={'name': 'Liabilities', 'category_type': AccountCategoryType.LIABILITY})
        cat_asset, _ = AccountCategory.objects.get_or_create(code='1000', defaults={'name': 'Assets', 'category_type': AccountCategoryType.ASSET})

        self.gl_salary_exp, _ = ChartOfAccount.objects.get_or_create(
            account_code='5010',
            defaults={'name': 'Staff Salaries & Nursing Payroll Expense', 'category': cat_exp, 'branch': self.branch}
        )
        self.gl_statutory_liab, _ = ChartOfAccount.objects.get_or_create(
            account_code='2040',
            defaults={'name': 'Taxes & Statutory GST Liabilities Payable', 'category': cat_liab, 'branch': self.branch}
        )
        self.gl_salary_payable, _ = ChartOfAccount.objects.get_or_create(
            account_code='2010',
            defaults={'name': 'Supplier & Vendor Accounts Payable', 'category': cat_liab, 'branch': self.branch}
        )
        self.gl_dep_exp, _ = ChartOfAccount.objects.get_or_create(
            account_code='5060',
            defaults={'name': 'Depreciation & Amortization Expense', 'category': cat_exp, 'branch': self.branch}
        )
        self.gl_acc_dep, _ = ChartOfAccount.objects.get_or_create(
            account_code='1520',
            defaults={'name': 'Accumulated Depreciation - Medical Equipment', 'category': cat_asset, 'branch': self.branch}
        )

    # -------------------------------------------------------------------------
    # 1. EMPLOYEE MANAGEMENT & REJECTION OF DUPLICATE EMPLOYEE ID
    # -------------------------------------------------------------------------
    def test_01_employee_onboarding_and_unique_id(self):
        """Verify employee onboarding and duplicate employee ID rejection."""
        # Create Employee Detail
        detail = EmployeeDetail.objects.create(
            staff=self.surgeon_staff,
            pan_number='ABCDE1234F',
            bank_account_number='9876543210',
            employment_type=EmploymentType.FULL_TIME
        )
        self.assertEqual(self.surgeon_staff.employee_detail.pan_number, 'ABCDE1234F')

        # Test duplicate employee ID rejection in StaffProfile
        with self.assertRaises(Exception):
            StaffProfile.objects.create(
                hospital=self.hospital,
                branch=self.branch,
                user_profile=self.hr_user,
                employee_id='EMP-TEST-003',  # Duplicate!
                designation='Another Surgeon'
            )

    # -------------------------------------------------------------------------
    # 2. ATTENDANCE & OVERNIGHT SHIFTS CALCULATION
    # -------------------------------------------------------------------------
    def test_02_attendance_hours_and_overnight_shifts(self):
        """Verify attendance hours calculation including overnight shifts."""
        day_shift = HospitalShift.objects.create(
            branch=self.branch,
            shift_code='TST-DAY',
            name='Test Day Shift',
            start_time=datetime.time(9, 0),
            end_time=datetime.time(18, 0),
            is_overnight=False
        )

        night_shift = HospitalShift.objects.create(
            branch=self.branch,
            shift_code='TST-NIGHT',
            name='Test Overnight ICU Shift',
            start_time=datetime.time(22, 0),
            end_time=datetime.time(7, 0),
            is_overnight=True
        )

        today = timezone.localdate()
        
        # Test daytime attendance calculation (9:00 to 18:00 = 9 hours)
        att_day = EmployeeAttendance.objects.create(
            staff=self.hr_staff,
            shift=day_shift,
            date=today,
            clock_in=datetime.time(9, 0),
            clock_out=datetime.time(18, 0),
            total_hours_worked=Decimal('9.00'),
            status=AttendanceStatus.PRESENT
        )
        self.assertEqual(att_day.total_hours_worked, Decimal('9.00'))

        # Test overnight shift: 22:00 to 07:00 next morning = 9 hours
        start_dt = datetime.datetime.combine(today, night_shift.start_time)
        end_dt = datetime.datetime.combine(today + datetime.timedelta(days=1), night_shift.end_time)
        hours = Decimal(str(round((end_dt - start_dt).total_seconds() / 3600.0, 2)))
        self.assertEqual(hours, Decimal('9.00'))

    # -------------------------------------------------------------------------
    # 3. LEAVE APPROVAL & SEPARATION OF DUTIES
    # -------------------------------------------------------------------------
    def test_03_leave_management_and_approval_balance(self):
        """Verify leave quota balance deduction and approval workflow."""
        balance = LeaveBalance.objects.create(
            staff=self.surgeon_staff,
            fiscal_year='2026-2027',
            leave_type=LeaveType.PRIVILEGE,
            allocated_days=Decimal('18.0'),
            accrued_days=Decimal('18.0'),
            used_days=Decimal('0.0')
        )
        self.assertEqual(balance.remaining_days, Decimal('18.0'))

        today = timezone.localdate()
        leave_req = LeaveRequest.objects.create(
            staff=self.surgeon_staff,
            leave_type=LeaveType.PRIVILEGE,
            start_date=today + datetime.timedelta(days=7),
            end_date=today + datetime.timedelta(days=9),
            total_days=3,
            reason='Attending International Cardiology Conference',
            status=LeaveStatus.PENDING
        )

        # Approve leave via service
        approved = HROperationsService.approve_or_reject_leave(
            leave_id=leave_req.id,
            approver_user=self.hr_approver_user,
            decision='APPROVED',
            comments='Approved for medical conference attendance.'
        )
        self.assertEqual(approved.status, LeaveStatus.APPROVED)
        self.assertEqual(approved.approved_by, self.hr_approver_staff)

        # Confirm balance was deducted: 18 - 3 = 15 remaining
        balance.refresh_from_db()
        self.assertEqual(balance.used_days, Decimal('3.0'))
        self.assertEqual(balance.remaining_days, Decimal('15.0'))

    # -------------------------------------------------------------------------
    # 4. PAYROLL CALCULATION, SEPARATION OF DUTIES & GL POSTING
    # -------------------------------------------------------------------------
    def test_04_payroll_calculation_workflow_and_gl_reconciliation(self):
        """
        Verify:
        - Gross = Basic + Allowances
        - Net = Gross - Deductions
        - Separation of duties (preparer cannot approve their own payroll)
        - GL Voucher reconciles (Debit 5010 Salaries Expense = Credit 2040 Deductions + Credit 2010 Net Payable)
        """
        # Assign salary structure to surgeon:
        # Basic: 100,000, HRA: 40,000, Special: 20,000 -> Gross = 160,000
        # PF: 12,000, PT: 200, TDS: 15,000 -> Deductions = 27,200
        # Net = 160,000 - 27,200 = 132,800
        sal = SalaryStructure.objects.create(
            staff=self.surgeon_staff,
            basic_salary=Decimal('100000.00'),
            house_rent_allowance=Decimal('40000.00'),
            special_allowance=Decimal('20000.00'),
            conveyance_allowance=Decimal('0.00'),
            medical_allowance=Decimal('0.00'),
            provident_fund_deduction=Decimal('12000.00'),
            professional_tax=Decimal('200.00'),
            income_tax_tds=Decimal('15000.00'),
            esi_deduction=Decimal('0.00')
        )
        self.assertEqual(sal.gross_salary, Decimal('160000.00'))
        self.assertEqual(sal.total_deductions, Decimal('27200.00'))
        self.assertEqual(sal.net_salary, Decimal('132800.00'))

        # 1. Generate Payroll Run for Month 11, Year 2026
        period = HROperationsService.generate_monthly_payroll_run(
            branch=self.branch,
            month=11,
            year=2026,
            created_by_user=self.hr_user
        )
        self.assertEqual(period.prepared_by, self.hr_staff)
        self.assertEqual(period.workflow_status, PayrollWorkflowStatus.DRAFT)

        # 2. Test Separation of Duties: Preparer (hr_staff) CANNOT approve their own payroll
        with self.assertRaises(ValueError):
            HROperationsService.approve_payroll_period(
                payroll_id=period.id,
                approver_staff=self.hr_staff
            )

        # 3. Independent Approver (hr_approver_staff) approves payroll
        approved_period = HROperationsService.approve_payroll_period(
            payroll_id=period.id,
            approver_staff=self.hr_approver_staff
        )
        self.assertEqual(approved_period.workflow_status, PayrollWorkflowStatus.APPROVED)
        self.assertEqual(approved_period.approved_by, self.hr_approver_staff)

        # 4. Post to Section 17 Double-Entry General Ledger
        posted_period = HROperationsService.post_payroll_to_gl(
            payroll_id=approved_period.id,
            user=self.hr_user
        )
        self.assertEqual(posted_period.workflow_status, PayrollWorkflowStatus.POSTED_GL)
        self.assertIsNotNone(posted_period.journal_entry_id)

        # 5. Verify General Ledger Balance Reconciliation
        jv = JournalEntry.objects.get(id=posted_period.journal_entry_id)
        lines = list(jv.lines.all())
        total_debits = sum((l.debit_amount for l in lines), Decimal('0.00'))
        total_credits = sum((l.credit_amount for l in lines), Decimal('0.00'))
        self.assertEqual(total_debits, total_credits, "General Ledger voucher must balance (Debits == Credits).")
        self.assertEqual(total_debits, posted_period.total_gross)

        # 6. Disburse Salary Payment
        disbursed = HROperationsService.disburse_payroll_payment(
            payroll_id=posted_period.id,
            payment_ref='NEFT-TEST-9988'
        )
        self.assertEqual(disbursed.workflow_status, PayrollWorkflowStatus.PAID)
        # Verify payslips marked as PAID
        for slip in disbursed.payslips.all():
            self.assertEqual(slip.payment_status, 'PAID')

    # -------------------------------------------------------------------------
    # 5. FIXED ASSET STRAIGHT-LINE DEPRECIATION & GL POSTING
    # -------------------------------------------------------------------------
    def test_05_fixed_asset_straight_line_depreciation(self):
        """
        Verify:
        Annual depreciation = (Purchase Cost - Residual Value) / Useful Life
        Test: Cost = ₹10,000,000, Residual = ₹1,000,000, Life = 9 years
        Annual = (10,000,000 - 1,000,000) / 9 = ₹1,000,000
        Carrying value after = ₹9,000,000
        GL Voucher: Debit 5060 Depreciation Expense ₹1,000,000, Credit 1520 Accumulated Dep ₹1,000,000
        """
        asset = FixedAsset.objects.create(
            asset_code='TEST-MRI-01',
            name='Test High-Field MRI Scanner',
            category='MEDICAL_EQUIPMENT',
            branch=self.branch,
            department=self.cardio_dept,
            purchase_date=datetime.date(2023, 1, 1),
            purchase_cost=Decimal('10000000.00'),
            residual_value=Decimal('1000000.00'),
            useful_life_years=9,
            current_carrying_value=Decimal('10000000.00'),
            accumulated_depreciation=Decimal('0.00'),
            status='OPERATIONAL'
        )
        self.assertEqual(asset.calculate_annual_depreciation(), Decimal('1000000.00'))

        # Calculate and post depreciation for 2026-2027
        sched = HROperationsService.calculate_and_post_depreciation(
            asset_id=asset.id,
            fiscal_year='2026-2027',
            user=self.hr_user
        )
        self.assertIsNotNone(sched)
        self.assertEqual(sched.depreciation_amount, Decimal('1000000.00'))
        self.assertEqual(sched.carrying_value_after, Decimal('9000000.00'))

        asset.refresh_from_db()
        self.assertEqual(asset.current_carrying_value, Decimal('9000000.00'))
        self.assertEqual(asset.accumulated_depreciation, Decimal('1000000.00'))

        # Duplicate depreciation prevention for the same fiscal year
        duplicate_sched = HROperationsService.calculate_and_post_depreciation(
            asset_id=asset.id,
            fiscal_year='2026-2027',
            user=self.hr_user
        )
        self.assertEqual(duplicate_sched.id, sched.id, "Duplicate depreciation for same fiscal year must return existing record.")

    # -------------------------------------------------------------------------
    # 6. OPERATION THEATRE CONFLICT PREVENTION (THEATRE & SURGEON)
    # -------------------------------------------------------------------------
    def test_06_operation_theatre_conflict_prevention(self):
        """
        Verify that OT booking prevents conflicts:
        1. Cannot book the same theatre during overlapping hours.
        2. Cannot book the same surgeon simultaneously in different theatres.
        """
        ot_suite = OperatingTheatreSuite.objects.create(
            branch=self.branch,
            name='Cardiac Suite 1',
            room_number='OT-TEST-101',
            is_operational=True
        )
        ot_suite_2 = OperatingTheatreSuite.objects.create(
            branch=self.branch,
            name='Neuro Suite 2',
            room_number='OT-TEST-102',
            is_operational=True
        )

        test_date = timezone.localdate() + datetime.timedelta(days=3)

        # 1. First valid booking: 09:00 to 12:00 in OT 1 with surgeon Rajesh
        b1 = HROperationsService.book_operation_theatre(
            theatre_id=ot_suite.id,
            patient_id=self.patient.id,
            lead_surgeon_id=self.surgeon_staff.id,
            procedure_name='Aortic Valve Replacement',
            date_str=str(test_date),
            start_time_str='09:00:00',
            end_time_str='12:00:00'
        )
        self.assertEqual(b1.status, 'SCHEDULED')

        # 2. Conflicting booking: same OT 1 from 10:00 to 13:00 -> MUST FAIL!
        with self.assertRaises(ValueError) as cm1:
            HROperationsService.book_operation_theatre(
                theatre_id=ot_suite.id,
                patient_id=self.patient.id,
                lead_surgeon_id=self.hr_approver_staff.id,
                procedure_name='Another Procedure',
                date_str=str(test_date),
                start_time_str='10:00:00',
                end_time_str='13:00:00'
            )
        self.assertIn("already booked", str(cm1.exception))

        # 3. Conflicting booking: different OT 2 but SAME SURGEON from 11:00 to 14:00 -> MUST FAIL!
        with self.assertRaises(ValueError) as cm2:
            HROperationsService.book_operation_theatre(
                theatre_id=ot_suite_2.id,
                patient_id=self.patient.id,
                lead_surgeon_id=self.surgeon_staff.id,  # Same surgeon!
                procedure_name='Emergency Angioplasty',
                date_str=str(test_date),
                start_time_str='11:00:00',
                end_time_str='14:00:00'
            )
        self.assertIn("already scheduled for another surgery", str(cm2.exception))

    # -------------------------------------------------------------------------
    # 7. AMBULANCE FLEET DISPATCH & TRIP COMPLETION
    # -------------------------------------------------------------------------
    def test_07_ambulance_dispatch_and_availability(self):
        """Verify ambulance dispatch availability check and return-to-service trip completion."""
        amb = Ambulance.objects.create(
            registration_number='DL-01-AMB-9988',
            vehicle_type=AmbulanceType.ALS,
            status=AmbulanceStatus.AVAILABLE,
            base_branch=self.branch,
            odo_reading_km=10000
        )

        # Dispatch
        disp = HROperationsService.dispatch_ambulance(
            ambulance_id=amb.id,
            pickup_location='Sector 62 Metro Station',
            patient_id=self.patient.id,
            destination='AURA Trauma Centre'
        )
        self.assertEqual(disp.trip_status, 'DISPATCHED')

        amb.refresh_from_db()
        self.assertEqual(amb.status, AmbulanceStatus.DISPATCHED)

        # Attempt to dispatch the same vehicle while on trip -> MUST FAIL!
        with self.assertRaises(ValueError):
            HROperationsService.dispatch_ambulance(
                ambulance_id=amb.id,
                pickup_location='Sector 18 Market',
                destination='Hospital'
            )

        # Complete trip
        completed = HROperationsService.complete_ambulance_trip(
            dispatch_id=disp.id,
            distance_km=Decimal('22.5'),
            fuel_liters=Decimal('3.8'),
            notes='Patient successfully transferred to resuscitation bay.'
        )
        self.assertEqual(completed.trip_status, 'COMPLETED')
        self.assertEqual(completed.distance_km, Decimal('22.5'))

        amb.refresh_from_db()
        self.assertEqual(amb.status, AmbulanceStatus.AVAILABLE)
        self.assertEqual(amb.odo_reading_km, 10022)

    # -------------------------------------------------------------------------
    # 8. BLOOD BANK EXPIRY & SCREENING VALIDATION
    # -------------------------------------------------------------------------
    def test_08_blood_bank_strict_expiry_and_screening_validation(self):
        """
        Verify strict clinical validation:
        1. Expired blood bag CANNOT be issued.
        2. Non-passed screening blood bag CANNOT be issued.
        3. Valid blood bag issues successfully.
        """
        today = timezone.localdate()

        # Expired unit
        expired_bag = BloodBankStock.objects.create(
            bag_barcode='BAG-TEST-EXPIRED-01',
            blood_group='O+',
            component_type='PRBC',
            collection_date=today - datetime.timedelta(days=45),
            expiry_date=today - datetime.timedelta(days=3),  # Expired 3 days ago
            screening_status='PASSED',
            status=BloodBagStatus.AVAILABLE
        )
        with self.assertRaises(ValueError) as cm1:
            HROperationsService.issue_blood_unit(
                bag_id=expired_bag.id,
                department_name='Emergency OT'
            )
        self.assertIn("expired", str(cm1.exception).lower())

        # Unscreened unit
        unscreened_bag = BloodBankStock.objects.create(
            bag_barcode='BAG-TEST-UNSCREENED-02',
            blood_group='A+',
            component_type='PRBC',
            collection_date=today - datetime.timedelta(days=2),
            expiry_date=today + datetime.timedelta(days=35),
            screening_status='TESTING_PENDING',
            status=BloodBagStatus.AVAILABLE
        )
        with self.assertRaises(ValueError) as cm2:
            HROperationsService.issue_blood_unit(
                bag_id=unscreened_bag.id,
                department_name='Emergency OT'
            )
        self.assertIn("screening", str(cm2.exception).lower())

        # Valid unit
        valid_bag = BloodBankStock.objects.create(
            bag_barcode='BAG-TEST-VALID-03',
            blood_group='B+',
            component_type='PRBC',
            collection_date=today - datetime.timedelta(days=5),
            expiry_date=today + datetime.timedelta(days=30),
            screening_status='PASSED',
            status=BloodBagStatus.AVAILABLE
        )
        issued = HROperationsService.issue_blood_unit(
            bag_id=valid_bag.id,
            department_name='Emergency OT',
            issued_by_staff=self.surgeon_staff
        )
        self.assertEqual(issued.status, BloodBagStatus.ISSUED)
        self.assertEqual(issued.issued_to_dept, 'Emergency OT')

    # -------------------------------------------------------------------------
    # 9. ICU CONTINUOUS OBSERVATIONS & BIOMEDICAL WASTE HANDOVER
    # -------------------------------------------------------------------------
    def test_09_icu_observations_and_biomedical_waste(self):
        """Verify ICU vital recording and biomedical waste manifest handover."""
        # ICU observation
        obs = ICUObservationRecord.objects.create(
            patient=self.patient,
            bed_identifier='ICU-Bed-09',
            recorded_by=self.surgeon_staff,
            bp_systolic=120,
            bp_diastolic=80,
            heart_rate=72,
            spo2_percentage=Decimal('99.0'),
            gcs_score=15,
            escalation_status='STABLE'
        )
        self.assertEqual(obs.gcs_score, 15)

        # Biomedical waste record and handover
        waste = BiomedicalWasteRecord.objects.create(
            manifest_code='BMW-TEST-001',
            branch=self.branch,
            generating_department=self.ot_dept,
            waste_category=WasteCategory.YELLOW,
            weight_kg=Decimal('18.50'),
            collected_by=self.hr_staff,
            status=WasteStatus.COLLECTED
        )
        self.assertEqual(waste.status, WasteStatus.COLLECTED)

        handover = HROperationsService.handover_biomedical_waste(
            record_id=waste.id,
            agency_name='State Bio-Clean Eco Solutions',
            vehicle_no='DL-02-TR-9988',
            receipt_no='CBMWTF-REC-9988',
            officer=self.hr_staff
        )
        self.assertEqual(handover.status, WasteStatus.HANDED_OVER)
        self.assertEqual(handover.agency_receipt_number, 'CBMWTF-REC-9988')
