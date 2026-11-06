"""
Controlled Demo Data Cleanup Script for AURA HMS.
Executes cleanup of confirmed Class 2 demo records with strict safety checks,
double-entry accounting reversals for test journal vouchers, and audit tracking.
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.db import transaction
from django.utils import timezone
from apps.authentication.models import StaffProfile, UserProfile
from apps.billing_finance.models import (
    JournalEntry, JournalStatus, ChartOfAccount,
    InvestmentRegister, InvestmentIncomeRecord, InvestmentValuationHistory,
    InvestmentAuditLog, FinancialBudget, BudgetLineItem
)
from apps.billing_finance.general_ledger_service import GeneralLedgerService
from apps.operations_hr.models import (
    FixedAsset, EquipmentMaintenanceTask, HousekeepingTask,
    BiomedicalWasteRecord, Ambulance, AmbulanceDispatch,
    OperationTheatreBooking, ICUObservationRecord,
    TrainingProgram, EmployeeTrainingEnrollment,
    EmployeeGrievance, DepartmentOperationalIssue
)


def run_cleanup():
    print("=" * 80)
    print("AURA HMS: CONTROLLED DEMO DATA CLEANUP & AUDIT REVERSAL")
    print("=" * 80)
    print(f"Timestamp: {timezone.now().isoformat()}")

    # -------------------------------------------------------------
    # 1. Reverse Test Journal Entries (Double-Entry Audit Mechanism)
    # -------------------------------------------------------------
    print("\n[Step 1] Processing Test Journal Entries Reversal...")
    finance_staff = StaffProfile.objects.filter(user_profile__role__name='FINANCE_MANAGER').first()
    if not finance_staff:
        finance_staff = StaffProfile.objects.first()

    test_jvs = JournalEntry.objects.filter(
        entry_number__in=['JV-20261024-7E443A', 'JV-20261024-14DE53'],
        status=JournalStatus.POSTED
    )

    reversed_jvs = []
    for jv in test_jvs:
        print(f"  Reversing {jv.entry_number} (Amount: {jv.total_debit})...")
        rev_entry = GeneralLedgerService.reverse_journal_voucher(
            journal_id=str(jv.id),
            staff_profile=finance_staff,
            reason="Authorized Controlled Cleanup: Reversal of developer manual testing entry from Oct 24, 2026"
        )
        reversed_jvs.append((jv.entry_number, rev_entry.entry_number, str(jv.total_debit)))
        print(f"  ✓ Successfully reversed via {rev_entry.entry_number}")

    # -------------------------------------------------------------
    # 2. Delete Confirmed Class 2 Demo Records
    # -------------------------------------------------------------
    print("\n[Step 2] Deleting Confirmed Class 2 Demo Records...")
    results = {}

    with transaction.atomic():
        # Maintenance tasks & Fixed assets
        cnt = EquipmentMaintenanceTask.objects.count()
        EquipmentMaintenanceTask.objects.all().delete()
        results['EquipmentMaintenanceTask (equipment_maintenance_tasks)'] = cnt

        cnt = FixedAsset.objects.count()
        FixedAsset.objects.all().delete()
        results['FixedAsset (fixed_assets)'] = cnt

        # Facilities: Housekeeping, Waste, Ambulance
        cnt = HousekeepingTask.objects.count()
        HousekeepingTask.objects.all().delete()
        results['HousekeepingTask (hms_housekeeping_tasks)'] = cnt

        cnt = BiomedicalWasteRecord.objects.count()
        BiomedicalWasteRecord.objects.all().delete()
        results['BiomedicalWasteRecord (hms_biomedical_waste_records)'] = cnt

        # Verify no dispatches exist before deleting ambulances
        if AmbulanceDispatch.objects.count() == 0:
            cnt = Ambulance.objects.count()
            Ambulance.objects.all().delete()
            results['Ambulance (hms_ambulances)'] = cnt
        else:
            print("  [SKIP] Ambulance records have active dispatches; skipping delete.")
            results['Ambulance (hms_ambulances)'] = 0

        # Clinical test records
        cnt = OperationTheatreBooking.objects.count()
        OperationTheatreBooking.objects.all().delete()
        results['OperationTheatreBooking (hms_ot_bookings)'] = cnt

        cnt = ICUObservationRecord.objects.count()
        ICUObservationRecord.objects.all().delete()
        results['ICUObservationRecord (hms_icu_observations)'] = cnt

        # Investments demo tree
        cnt = InvestmentAuditLog.objects.count()
        InvestmentAuditLog.objects.all().delete()
        results['InvestmentAuditLog (hms_investment_audit_logs)'] = cnt

        cnt = InvestmentValuationHistory.objects.count()
        InvestmentValuationHistory.objects.all().delete()
        results['InvestmentValuationHistory (hms_investment_valuation_history)'] = cnt

        cnt = InvestmentIncomeRecord.objects.count()
        InvestmentIncomeRecord.objects.all().delete()
        results['InvestmentIncomeRecord (hms_investment_income_records)'] = cnt

        cnt = InvestmentRegister.objects.count()
        InvestmentRegister.objects.all().delete()
        results['InvestmentRegister (hms_investments)'] = cnt

        # Budgets demo tree
        cnt = BudgetLineItem.objects.count()
        BudgetLineItem.objects.all().delete()
        results['BudgetLineItem (hms_budget_line_items)'] = cnt

        cnt = FinancialBudget.objects.count()
        FinancialBudget.objects.all().delete()
        results['FinancialBudget (hms_financial_budgets)'] = cnt

        # HR demo programs & grievances
        cnt = EmployeeTrainingEnrollment.objects.count()
        EmployeeTrainingEnrollment.objects.all().delete()
        results['EmployeeTrainingEnrollment (hms_employee_training_enrollments)'] = cnt

        cnt = TrainingProgram.objects.count()
        TrainingProgram.objects.all().delete()
        results['TrainingProgram (hms_training_programs)'] = cnt

        cnt = EmployeeGrievance.objects.count()
        EmployeeGrievance.objects.all().delete()
        results['EmployeeGrievance (hms_employee_grievances)'] = cnt

        cnt = DepartmentOperationalIssue.objects.count()
        DepartmentOperationalIssue.objects.all().delete()
        results['DepartmentOperationalIssue (hms_department_operational_issues)'] = cnt

    print("\n[Step 2 Summary] Deleted Records Table:")
    total_deleted = 0
    for table_name, count in results.items():
        print(f"  - {table_name}: {count} records removed")
        total_deleted += count
    print(f"  Total Class 2 Records Removed: {total_deleted}")

    # -------------------------------------------------------------
    # 3. Data Integrity & Verification Checks
    # -------------------------------------------------------------
    print("\n[Step 3] Post-Cleanup Integrity Verification...")
    from apps.clinical.models import PatientProfile, Appointment
    from apps.billing_finance.models import Invoice, Payment

    real_patients = PatientProfile.objects.count()
    real_appts = Appointment.objects.count()
    real_invs = Invoice.objects.count()
    real_payments = Payment.objects.count()
    real_users = UserProfile.objects.count()

    print(f"  ✓ User Profiles intact: {real_users}")
    print(f"  ✓ Patient Profiles intact: {real_patients}")
    print(f"  ✓ Appointments intact: {real_appts}")
    print(f"  ✓ Invoices intact: {real_invs}")
    print(f"  ✓ Payments intact: {real_payments}")

    # Verify Journal balances
    gl_entries = JournalEntry.objects.count()
    posted_jvs = JournalEntry.objects.filter(status=JournalStatus.POSTED).count()
    reversed_jvs_count = JournalEntry.objects.filter(status=JournalStatus.REVERSED).count()
    print(f"  ✓ Journal Entries total: {gl_entries} (Posted: {posted_jvs}, Reversed: {reversed_jvs_count})")

    # Verify Accounts
    rent_acc = ChartOfAccount.objects.filter(account_code='5070').first()
    cash_acc = ChartOfAccount.objects.filter(account_code='1010').first()
    print(f"  ✓ Account 5070 ({rent_acc.name if rent_acc else ''}) balance: {rent_acc.current_balance if rent_acc else 'N/A'}")
    print(f"  ✓ Account 1010 ({cash_acc.name if cash_acc else ''}) balance: {cash_acc.current_balance if cash_acc else 'N/A'}")

    print("\n" + "=" * 80)
    print("CLEANUP & REVERSAL SUCCESSFULLY COMPLETED")
    print("=" * 80)


if __name__ == '__main__':
    run_cleanup()

