import datetime
from decimal import Decimal
from django.utils import timezone

from apps.core.models import Branch, Department, Hospital
from apps.authentication.models import UserProfile, StaffProfile, PatientProfile, Role, RoleEnum
from apps.billing_finance.models import ChartOfAccount
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


def seed_section20():
    print("=== SEEDING SECTION 20: HR, PAYROLL, ASSETS & OPERATIONS ===")
    
    branch = Branch.objects.first()
    if not branch:
        print("ERROR: No branch found.")
        return

    # 1. Departments
    hr_dept, _ = Department.objects.get_or_create(branch=branch, name='Human Resources', defaults={'code': 'HR'})
    ot_dept, _ = Department.objects.get_or_create(branch=branch, name='Operation Theatre Services', defaults={'code': 'OT'})
    icu_dept, _ = Department.objects.get_or_create(branch=branch, name='Intensive Care Unit (ICU)', defaults={'code': 'ICU'})
    biomed_dept, _ = Department.objects.get_or_create(branch=branch, name='Biomedical Engineering & Assets', defaults={'code': 'BME'})
    housekeeping_dept, _ = Department.objects.get_or_create(branch=branch, name='Facility & Housekeeping', defaults={'code': 'FHK'})

    # 2. Staff Profiles & Salary Structures
    staff_list = list(StaffProfile.objects.filter(branch=branch, status='ACTIVE')[:10])
    if len(staff_list) < 4:
        print("Creating additional staff profiles for Section 20...")
        import uuid
        hospital = Hospital.objects.first()
        roles = {
            'HR Manager': ('hr.manager@hospital.com', 'Radha', 'Krishnan', RoleEnum.HR_MANAGER, 'HR Manager', hr_dept),
            'Lead Surgeon': ('surgeon.drsharma@hospital.com', 'Alok', 'Sharma', RoleEnum.DOCTOR, 'Chief Cardio Surgeon', ot_dept),
            'Anesthetist': ('anesthesia.drpriya@hospital.com', 'Priya', 'Varma', RoleEnum.DOCTOR, 'Senior Anesthesiologist', ot_dept),
            'ICU Head Nurse': ('nurse.mary@hospital.com', 'Mary', 'Joseph', RoleEnum.NURSE, 'ICU Charge Nurse', icu_dept),
            'Biomedical Engineer': ('biomed.karthik@hospital.com', 'Karthik', 'Raja', RoleEnum.HOSPITAL_ADMIN, 'Lead Biomedical Engineer', biomed_dept),
            'Ambulance Driver': ('driver.ramu@hospital.com', 'Ramu', 'Govind', RoleEnum.RECEPTIONIST, 'Senior Emergency Driver', icu_dept),
        }
        for title, (email, fn, ln, role_enum, designation, d_dept) in roles.items():
            role = Role.objects.filter(name=role_enum).first() or Role.objects.first()
            user, _ = UserProfile.objects.get_or_create(
                email=email,
                defaults={
                    'supabase_user_id': uuid.uuid4(),
                    'first_name': fn,
                    'last_name': ln,
                    'phone_number': '+91 98765 43210',
                    'role': role,
                    'is_verified': True,
                }
            )

            sp, _ = StaffProfile.objects.get_or_create(
                user_profile=user,
                defaults={
                    'hospital': hospital or Hospital.objects.first(),
                    'branch': branch,
                    'department': d_dept,
                    'designation': designation,
                    'employee_id': f"EMP-{abs(hash(email))%9000 + 1000}",
                    'status': 'ACTIVE',
                    'is_on_duty': True,
                    'joining_date': datetime.date(2023, 4, 1)
                }
            )
            if sp not in staff_list:
                staff_list.append(sp)

    print(f"Total active staff for HR: {len(staff_list)}")

    # Ensure all staff have EmployeeDetail and SalaryStructure
    for staff in staff_list:
        EmployeeDetail.objects.get_or_create(
            staff=staff,
            defaults={
                'pan_number': f"ABCDE{staff.id.hex[:4].upper()}Z",
                'aadhaar_number': f"9988 7766 {staff.id.hex[:4]}",
                'bank_account_number': f"HDFC0001{staff.id.hex[:6]}",
                'bank_name': 'HDFC Bank Ltd',
                'bank_ifsc_code': 'HDFC0000123',
                'emergency_contact_name': 'Emergency Contact',
                'emergency_contact_phone': '+91 98765 00000',
                'emergency_contact_relation': 'Spouse / Parent',
                'blood_group': 'O+',
                'employment_type': EmploymentType.FULL_TIME,
                'separation_status': SeparationStatus.ACTIVE
            }
        )

        SalaryStructure.objects.get_or_create(
            staff=staff,
            defaults={
                'basic_salary': Decimal('60000.00'),
                'house_rent_allowance': Decimal('24000.00'),
                'special_allowance': Decimal('12000.00'),
                'medical_allowance': Decimal('2500.00'),
                'conveyance_allowance': Decimal('3000.00'),
                'provident_fund_deduction': Decimal('7200.00'),
                'professional_tax': Decimal('200.00'),
                'income_tax_tds': Decimal('4500.00'),
                'esi_deduction': Decimal('0.00'),
            }
        )

        # Leave Balances for 2026-2027
        for l_type, days in [('PRIVILEGE', 18), ('SICK', 12), ('CASUAL', 10), ('MATERNITY', 0)]:
            LeaveBalance.objects.get_or_create(
                staff=staff,
                leave_type=l_type,
                fiscal_year='2026-2027',
                defaults={
                    'allocated_days': Decimal(str(days)),
                    'accrued_days': Decimal(str(days)),
                    'used_days': Decimal('1.0'),
                }
            )

    # 3. Hospital Shifts
    shifts_data = [
        ('General Day Shift', 'GS', datetime.time(9, 0), datetime.time(18, 0), False, 60),
        ('Morning Clinical Shift', 'MS', datetime.time(7, 0), datetime.time(15, 30), False, 45),
        ('Evening Nursing Shift', 'ES', datetime.time(14, 30), datetime.time(22, 30), False, 45),
        ('Emergency Night ICU Shift', 'NS', datetime.time(22, 0), datetime.time(7, 30), True, 60),
    ]
    created_shifts = []
    for name, code, st, et, overnight, brk in shifts_data:
        shift, _ = HospitalShift.objects.get_or_create(
            branch=branch,
            shift_code=code,
            defaults={
                'name': name,
                'start_time': st,
                'end_time': et,
                'is_overnight': overnight,
                'break_duration_minutes': brk,
                'min_staffing_required': 4
            }
        )
        created_shifts.append(shift)

    # 4. Today's Attendance & Rosters
    today = timezone.localdate()
    for idx, staff in enumerate(staff_list):
        sh = created_shifts[idx % len(created_shifts)]
        
        # Roster Assignment
        ShiftRosterAssignment.objects.get_or_create(
            staff=staff,
            shift=sh,
            roster_date=today,
            defaults={
                'branch': branch,
                'department': staff.department,
                'status': 'CONFIRMED'
            }
        )

        # Attendance Record
        EmployeeAttendance.objects.get_or_create(
            staff=staff,
            date=today,
            defaults={
                'shift': sh,
                'clock_in': datetime.time(8, 55),
                'clock_out': datetime.time(18, 5),
                'total_hours_worked': Decimal('9.00'),
                'status': AttendanceStatus.PRESENT,
                'approval_status': 'APPROVED',
                'remarks': 'Punctual check-in'
            }
        )

    # 5. Fixed Assets & Medical Equipment
    assets_data = [
        ('Siemens Magnetom 3T MRI Scanner', 'MED-EQ-001', 'MEDICAL_EQUIPMENT', Decimal('85000000.00'), Decimal('5000000.00'), 10, 'Radiology Ground Floor Bay 1'),
        ('GE Revolution 128-Slice CT Scanner', 'MED-EQ-002', 'MEDICAL_EQUIPMENT', Decimal('42000000.00'), Decimal('2000000.00'), 8, 'Radiology Ground Floor Bay 2'),
        ('Hamilton-C6 Intensive Care Ventilator', 'MED-EQ-003', 'MEDICAL_EQUIPMENT', Decimal('2800000.00'), Decimal('100000.00'), 7, 'ICU Pod 4'),
        ('Olympus EVIS X1 Video Endoscopy System', 'MED-EQ-004', 'SURGICAL_DEVICE', Decimal('6500000.00'), Decimal('300000.00'), 6, 'Endoscopy Suite Room 3'),
        ('Force FX Electrosurgical Generator', 'MED-EQ-005', 'SURGICAL_DEVICE', Decimal('1200000.00'), Decimal('50000.00'), 5, 'OT Suite 1'),
        ('Tata Winger High-Roof ALS ICU Ambulance', 'VEH-AMB-001', 'VEHICLE', Decimal('3800000.00'), Decimal('300000.00'), 8, 'Ambulance Bay A1'),
    ]
    created_assets = []
    for name, code, cat, cost, res, life, loc in assets_data:
        asset, _ = FixedAsset.objects.get_or_create(
            asset_code=code,
            defaults={
                'name': name,
                'category': cat,
                'branch': branch,
                'department': ot_dept if 'SURGICAL' in cat else (icu_dept if 'Ventilator' in name else biomed_dept),
                'purchase_date': datetime.date(2023, 1, 15),
                'purchase_cost': cost,
                'residual_value': res,
                'useful_life_years': life,
                'current_carrying_value': cost,
                'accumulated_depreciation': Decimal('0.00'),
                'physical_location': loc,
                'status': 'OPERATIONAL',
                'supplier_name': name.split()[0] + ' Healthcare Ltd',
                'warranty_expiry_date': datetime.date(2027, 1, 15)
            }
        )
        created_assets.append(asset)

        # Maintenance Task
        EquipmentMaintenanceTask.objects.get_or_create(
            asset=asset,
            scheduled_date=today + datetime.timedelta(days=14),
            defaults={
                'maintenance_type': 'PREVENTIVE',
                'priority': 'MEDIUM',
                'technician_vendor': f"{asset.name.split()[0]} Healthcare Care",
                'clinical_safety_certified': True,
                'findings': 'Preventive maintenance check and output verification.',
                'action_taken': 'Calibration checked and aligned.',
                'operational_status_after': 'OPERATIONAL',
                'next_service_due': today + datetime.timedelta(days=104)
            }
        )

    # 6. Operation Theatre Suites & Bookings
    ot1, _ = OperatingTheatreSuite.objects.get_or_create(
        branch=branch,
        room_number='OT-301',
        defaults={
            'name': 'Cardiac & Neuro Cleanroom Theatre 1',
            'suite_type': 'MAJOR_OT',
            'is_operational': True,
            'equipment_summary': 'Laminar Flow, HEPA filtration, C-Arm Fluoroscopy, Heart-Lung Machine'
        }
    )
    ot2, _ = OperatingTheatreSuite.objects.get_or_create(
        branch=branch,
        room_number='OT-302',
        defaults={
            'name': 'Orthopaedic & Trauma Theatre 2',
            'suite_type': 'MAJOR_OT',
            'is_operational': True,
            'equipment_summary': 'Lead-lined radiation protection, Arthroscopy Tower, Ortho Traction Table'
        }
    )

    # Sample Patient for OT & ICU
    patient = PatientProfile.objects.first()
    if not patient:
        p_user, _ = UserProfile.objects.get_or_create(
            email='patient.test@hospital.com',
            defaults={'full_name': 'Ananya Sharma', 'phone_number': '+91 99000 11223'}
        )
        patient, _ = PatientProfile.objects.get_or_create(
            user_profile=p_user,
            defaults={'uhid': 'UHID-2026-0001', 'gender': 'FEMALE', 'date_of_birth': datetime.date(1990, 5, 20)}
        )

    surgeon = staff_list[0]
    anesthetist = staff_list[1] if len(staff_list) > 1 else surgeon

    OperationTheatreBooking.objects.get_or_create(
        booking_code='OT-2026-DEMO-01',
        defaults={
            'theatre': ot1,
            'patient': patient,
            'procedure_name': 'Coronary Artery Bypass Graft (CABG)',
            'scheduled_date': today + datetime.timedelta(days=1),
            'start_time': datetime.time(9, 0),
            'end_time': datetime.time(13, 30),
            'lead_surgeon': surgeon,
            'anesthetist': anesthetist,
            'anesthesia_type': 'GENERAL_ANESTHESIA',
            'pre_op_checklist_completed': True,
            'status': 'SCHEDULED',
            'clinical_notes': 'Pre-op echocardiography completed. 4 units PRBC cross-matched and reserved.'
        }
    )

    # 7. ICU Continuous Observation
    ICUObservationRecord.objects.get_or_create(
        patient=patient,
        bed_identifier='ICU-Bed-04',
        observation_time=timezone.now(),
        defaults={
            'recorded_by': staff_list[0],
            'bp_systolic': 124,
            'bp_diastolic': 78,
            'heart_rate': 76,
            'respiratory_rate': 16,
            'spo2_percentage': Decimal('98.5'),
            'temperature_celsius': Decimal('36.8'),
            'gcs_score': 15,
            'ventilator_mode': 'CPAP / Pressure Support',
            'fio2_percentage': Decimal('35.0'),
            'urine_output_ml': Decimal('65.0'),
            'escalation_status': 'STABLE',
            'clinical_notes': 'Hemodynamics stable on minimal support. Weaning protocol in progress.'
        }
    )

    # 8. Ambulance Fleet & Dispatch
    amb_als, _ = Ambulance.objects.get_or_create(
        registration_number='KA-01-EQ-9011',
        defaults={
            'vehicle_type': AmbulanceType.ALS,
            'status': AmbulanceStatus.AVAILABLE,
            'base_branch': branch,
            'assigned_driver': staff_list[-1],
            'assigned_paramedic': staff_list[1] if len(staff_list) > 1 else None,
            'fuel_level_pct': 92,
            'odo_reading_km': 14850,
            'equipment_checklist': {'defibrillator': True, 'ventilator': True, 'oxygen_cylinders': 4}
        }
    )
    amb_bls, _ = Ambulance.objects.get_or_create(
        registration_number='KA-01-EQ-9012',
        defaults={
            'vehicle_type': AmbulanceType.BLS,
            'status': AmbulanceStatus.AVAILABLE,
            'base_branch': branch,
            'fuel_level_pct': 85,
            'odo_reading_km': 22400,
            'equipment_checklist': {'first_aid_kit': True, 'stretcher': True, 'oxygen_kit': True}
        }
    )

    # 9. Blood Bank Stock Units
    blood_samples = [
        ('BB-BAG-2026-A1', 'A+', 'PRBC', 350, today + datetime.timedelta(days=28)),
        ('BB-BAG-2026-A2', 'A+', 'FFP', 250, today + datetime.timedelta(days=120)),
        ('BB-BAG-2026-B1', 'B+', 'PRBC', 350, today + datetime.timedelta(days=32)),
        ('BB-BAG-2026-B2', 'B+', 'PLATELETS', 150, today + datetime.timedelta(days=5)),
        ('BB-BAG-2026-O1', 'O+', 'PRBC', 350, today + datetime.timedelta(days=25)),
        ('BB-BAG-2026-O2', 'O-', 'PRBC', 350, today + datetime.timedelta(days=20)),
        ('BB-BAG-2026-AB1', 'AB+', 'FFP', 200, today + datetime.timedelta(days=90)),
        ('BB-BAG-2026-EXP', 'A-', 'PRBC', 350, today - datetime.timedelta(days=2)), # Expired bag for test verification
    ]
    for barcode, grp, comp, vol, exp in blood_samples:
        is_exp = exp < today
        BloodBankStock.objects.get_or_create(
            bag_barcode=barcode,
            defaults={
                'blood_group': grp,
                'component_type': comp,
                'volume_ml': vol,
                'collection_date': today - datetime.timedelta(days=10),
                'expiry_date': exp,
                'storage_unit': 'Blood-Bank-Cold-Room-1',
                'screening_status': 'PASSED',
                'status': BloodBagStatus.EXPIRED if is_exp else BloodBagStatus.AVAILABLE
            }
        )

    # 10. Housekeeping Tasks
    hk_tasks = [
        ('HK-2026-001', '3rd Floor', 'Cardiac OT Suite 1', HousekeepingTaskType.TERMINAL_DISINFECTION, 'HIGH', HousekeepingTaskStatus.COMPLETED),
        ('HK-2026-002', '2nd Floor', 'ICU Pod 4 Bay B', HousekeepingTaskType.SANITIZATION, 'CRITICAL', HousekeepingTaskStatus.IN_PROGRESS),
        ('HK-2026-003', 'Ground Floor', 'Emergency Trauma Resuscitation Bay', HousekeepingTaskType.ROUTINE_CLEANING, 'MEDIUM', HousekeepingTaskStatus.PENDING),
    ]
    for code, fl, room, t_type, prio, st in hk_tasks:
        HousekeepingTask.objects.get_or_create(
            task_code=code,
            defaults={
                'branch': branch,
                'floor': fl,
                'room_area': room,
                'task_type': t_type,
                'priority': prio,
                'status': st,
                'assigned_staff': staff_list[0],
                'scheduled_time': timezone.now() - datetime.timedelta(hours=2),
                'inspection_notes': 'Area sterilized per NABH guidelines.' if st == HousekeepingTaskStatus.COMPLETED else ''
            }
        )

    # 11. Biomedical Waste Records
    waste_records = [
        ('BMW-2026-Y01', ot_dept, WasteCategory.YELLOW, Decimal('14.50'), 'Central Biohazard Room Bay 1', WasteStatus.COLLECTED),
        ('BMW-2026-R01', icu_dept, WasteCategory.RED, Decimal('22.80'), 'Central Biohazard Room Bay 2', WasteStatus.IN_STORAGE),
        ('BMW-2026-W01', ot_dept, WasteCategory.WHITE, Decimal('4.20'), 'Puncture Proof Sharps Locker', WasteStatus.COLLECTED),
        ('BMW-2026-B01', biomed_dept, WasteCategory.BLUE, Decimal('8.60'), 'Glassware Cardboard Vault', WasteStatus.HANDED_OVER),
    ]
    for m_code, dept, cat, wt, loc, st in waste_records:
        BiomedicalWasteRecord.objects.get_or_create(
            manifest_code=m_code,
            defaults={
                'branch': branch,
                'generating_department': dept,
                'waste_category': cat,
                'weight_kg': wt,
                'storage_area': loc,
                'collected_by': staff_list[0],
                'status': st,
                'disposal_agency_name': 'State Bio-Clean Eco Solutions Pvt Ltd',
                'vehicle_number': 'KA-04-TR-4421' if st == WasteStatus.HANDED_OVER else '',
                'agency_receipt_number': 'CBMWTF-REC-8921' if st == WasteStatus.HANDED_OVER else ''
            }
        )

    print("=== SECTION 20 DATA SEEDED SUCCESSFULLY! ===")
