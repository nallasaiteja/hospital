import datetime
from decimal import Decimal
from django.utils import timezone
from apps.core.models import Branch, Department
from apps.authentication.models import StaffProfile, UserProfile
from apps.billing_finance.models import (
    FinancialAccount, FinancialBudget, BudgetLineItem,
    CapitalExpenditurePlan, MinimumCashThreshold,
    CashFlowForecastAssumption, BudgetApprovalStatus,
    BudgetCategoryType, BudgetPeriodType, CapexStatus,
    ThresholdSeverity
)


def seed_section19_financial_planning():
    print("Seeding Section 19: Cash Flow and Financial Planning baseline data...")

    staff = StaffProfile.objects.filter(is_active=True).first()
    branch = Branch.objects.filter(is_active=True).first()
    departments = list(Department.objects.filter(is_active=True))

    # 1. Forecast Assumptions
    assumption, _ = CashFlowForecastAssumption.objects.get_or_create(
        name="AURA Hospital Standard Treasury Horizon Model",
        defaults={
            'horizon_days': 30,
            'patient_realization_rate': Decimal('0.85'),
            'insurance_realization_rate': Decimal('0.90'),
            'include_planned_capex': True,
            'notes': "Conservative hospital cash flow forecasting with 85% patient collection and 90% TPA claim realization.",
            'is_default': True,
        }
    )
    print(f"  [OK] Cash Flow Forecast Assumption: {assumption.name}")

    # 2. Minimum Cash Thresholds
    # Hospital-Wide
    h_thresh, _ = MinimumCashThreshold.objects.get_or_create(
        is_hospital_wide=True,
        defaults={
            'threshold_amount': Decimal('2500000.00'),  # ₹25 Lakhs safety reserve
            'alert_severity': ThresholdSeverity.CRITICAL,
            'notify_roles': 'CHIEF_FINANCIAL_OFFICER,FINANCE_MANAGER',
            'is_active': True,
            'created_by': staff,
        }
    )

    # Specific Accounts
    hdfc_acc = FinancialAccount.objects.filter(account_code='FA-BNK-HDFC').first()
    if hdfc_acc:
        MinimumCashThreshold.objects.get_or_create(
            financial_account=hdfc_acc,
            defaults={
                'threshold_amount': Decimal('1500000.00'),  # ₹15 Lakhs
                'alert_severity': ThresholdSeverity.HIGH,
                'notify_roles': 'FINANCE_MANAGER,TREASURY_OFFICER',
                'is_active': True,
                'created_by': staff,
            }
        )

    cash_acc = FinancialAccount.objects.filter(account_code='FA-CSH-MAIN').first()
    if cash_acc:
        MinimumCashThreshold.objects.get_or_create(
            financial_account=cash_acc,
            defaults={
                'threshold_amount': Decimal('50000.00'),  # ₹50,000 float floor
                'alert_severity': ThresholdSeverity.MEDIUM,
                'notify_roles': 'CHIEF_CASHIER,FINANCE_MANAGER',
                'is_active': True,
                'created_by': staff,
            }
        )
    print(f"  [OK] Minimum Cash Thresholds seeded.")

    # 3. Departmental Annual Operating Budgets
    budget_configs = [
        ("Cardiology", Decimal('3500000.00'), Decimal('2250000.00'), "Cardiac cath lab & surgery operating budget"),
        ("Oncology", Decimal('4000000.00'), Decimal('2900000.00'), "Chemotherapy & radiation oncology facilities"),
        ("Orthopedics", Decimal('2500000.00'), Decimal('1840000.00'), "Joint replacement & orthopedic consumables"),
        ("Emergency", Decimal('2000000.00'), Decimal('1420000.00'), "Casualty, triage & acute emergency department"),
        ("Radiology", Decimal('1800000.00'), Decimal('1250000.00'), "Diagnostic imaging maintenance & power"),
        ("Pharmacy", Decimal('3000000.00'), Decimal('2480000.00'), "Pharmacy wholesale stock consumption"),
    ]

    for dept_name, allocated, spent, note in budget_configs:
        dept = Department.objects.filter(name__icontains=dept_name).first()
        if not dept and departments:
            dept = departments[0]

        b_code = f"BDG-2026-{dept_name[:4].upper()}"
        b, created = FinancialBudget.objects.get_or_create(
            budget_code=b_code,
            defaults={
                'fiscal_year': '2026-2027',
                'period_type': BudgetPeriodType.ANNUAL,
                'branch': branch,
                'department': dept,
                'budget_type': BudgetCategoryType.EXPENSE,
                'total_budget_amount': allocated,
                'actual_spent_amount': spent,
                'status': BudgetApprovalStatus.APPROVED,
                'notes_assumptions': note,
                'prepared_by': staff,
                'approved_by': staff,
                'approved_at': timezone.now(),
            }
        )
        if created:
            # Seed line items
            BudgetLineItem.objects.create(
                budget=b,
                category_name="Clinical Salaries & Nursing Staff",
                allocated_amount=allocated * Decimal('0.55'),
                utilized_amount=spent * Decimal('0.55'),
                notes="Consultant physician fees, duty doctors, and nursing staff"
            )
            BudgetLineItem.objects.create(
                budget=b,
                category_name="Medical Supplies & Department Consumables",
                allocated_amount=allocated * Decimal('0.30'),
                utilized_amount=spent * Decimal('0.30'),
                notes="Department specific sterile materials and disposables"
            )
            BudgetLineItem.objects.create(
                budget=b,
                category_name="Equipment Maintenance & Calibration",
                allocated_amount=allocated * Decimal('0.15'),
                utilized_amount=spent * Decimal('0.15'),
                notes="AMC/CMC contracts and preventative maintenance"
            )

    print(f"  [OK] Departmental Budgets seeded.")

    # 4. Capital Expenditure (CapEx) Plans
    today = timezone.localdate()
    cardio_dept = Department.objects.filter(name__icontains='Cardio').first() or (departments[0] if departments else None)
    radio_dept = Department.objects.filter(name__icontains='Radio').first() or (departments[0] if departments else None)
    icu_dept = Department.objects.filter(name__icontains='ICU').first() or (departments[0] if departments else None)

    capex_items = [
        ("CAPEX-2026-001", "128-Slice High Speed Cardiac CT Scanner", cardio_dept, Decimal('12000000.00'), today + datetime.timedelta(days=45), CapexStatus.APPROVED_COMMITMENT, "Replaces 10-year old scanner to double daily throughput for non-invasive angiography.", "30% advance on PO, 50% on installation, 20% warranty sign-off"),
        ("CAPEX-2026-002", "Digital Mobile C-Arm Imaging Unit", radio_dept, Decimal('4500000.00'), today + datetime.timedelta(days=60), CapexStatus.PROPOSED, "High-definition intraoperative imaging for orthopedic and spine surgical theatres.", "50% advance, 50% post-delivery"),
        ("CAPEX-2026-003", "Advanced ICU Mechanical Ventilators (Set of 4)", icu_dept, Decimal('2800000.00'), today + datetime.timedelta(days=20), CapexStatus.UNDER_REVIEW, "Upgrades critical care unit capabilities for complex ARDS respiratory cases.", "100% against Letter of Credit on delivery"),
    ]

    for code, name, dept, cost, pdate, status, just, schedule in capex_items:
        CapitalExpenditurePlan.objects.get_or_create(
            capex_code=code,
            defaults={
                'project_name': name,
                'description': name,
                'business_justification': just,
                'requesting_department': dept,
                'branch': branch,
                'estimated_cost': cost,
                'expected_purchase_date': pdate,
                'proposed_payment_schedule': schedule,
                'status': status,
                'supplier_reference': "Siemens Healthcare / Philips Medical",
                'requested_by': staff,
                'approved_by': staff if status == CapexStatus.APPROVED_COMMITMENT else None,
                'approved_at': timezone.now() if status == CapexStatus.APPROVED_COMMITMENT else None,
            }
        )

    print(f"  [OK] Capital Expenditure Plans seeded.")
    print("Section 19 baseline data seeding complete!")


if __name__ == '__main__':
    import os, django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    django.setup()
    seed_section19_financial_planning()
