"""
Centralized 3-Dimensional Role-Based Access Control (RBAC) Matrix & Policy Engine.

Dimensions:
1. Module Dimension (25 Hospital Modules)
2. Action Dimension (view, create, edit, delete, approve, reject, export, manage, etc.)
3. Data-Scope Dimension (OWN, ASSIGNED_PAT, ASSIGNED_WARD, DEPT, BRANCH, ORG)
"""

from apps.authentication.models import RoleEnum


class DataScope:
    OWN = 'OWN'                      # Own profile, attendance, shifts, leaves, or patient's own records
    ASSIGNED_PAT = 'ASSIGNED_PAT'    # Assigned patients, consultations, lab orders, treatment plans
    ASSIGNED_WARD = 'ASSIGNED_WARD'  # Assigned wards, beds, nursing care plans
    DEPT = 'DEPT'                    # Assigned department staff, shifts, attendance, workload, logs
    BRANCH = 'BRANCH'                # Assigned branch operational scope
    ORG = 'ORG'                      # Multi-branch enterprise scope


ROLE_DATA_SCOPES = {
    RoleEnum.SUPER_ADMIN: DataScope.ORG,
    RoleEnum.HOSPITAL_ADMIN: DataScope.ORG,
    RoleEnum.BRANCH_MANAGER: DataScope.BRANCH,
    RoleEnum.MEDICAL_DIRECTOR: DataScope.BRANCH,
    RoleEnum.DEPARTMENT_HEAD: DataScope.DEPT,
    RoleEnum.DOCTOR: DataScope.ASSIGNED_PAT,
    RoleEnum.NURSE: DataScope.ASSIGNED_WARD,
    RoleEnum.RECEPTIONIST: DataScope.BRANCH,
    RoleEnum.PHARMACIST: DataScope.BRANCH,
    RoleEnum.LAB_TECHNICIAN: DataScope.BRANCH,
    RoleEnum.RADIOLOGY_TECHNICIAN: DataScope.BRANCH,
    RoleEnum.INVENTORY_MANAGER: DataScope.BRANCH,
    RoleEnum.PROCUREMENT_OFFICER: DataScope.BRANCH,
    RoleEnum.BILLING_EXECUTIVE: DataScope.BRANCH,
    RoleEnum.CASHIER: DataScope.BRANCH,
    RoleEnum.INSURANCE_COORDINATOR: DataScope.BRANCH,
    RoleEnum.ACCOUNTANT: DataScope.BRANCH,
    RoleEnum.FINANCE_MANAGER: DataScope.BRANCH,
    RoleEnum.INVESTMENT_MANAGER: DataScope.ORG,
    RoleEnum.HR_MANAGER: DataScope.BRANCH,
    RoleEnum.AUDITOR: DataScope.ORG,
    RoleEnum.PATIENT: DataScope.OWN,
}

# Roles that have strict READ-ONLY supervisory or audit access across operational modules
STRICT_READ_ONLY_ROLES = {
    RoleEnum.BRANCH_MANAGER,
    RoleEnum.HOSPITAL_ADMIN,
    RoleEnum.AUDITOR,
}

# Roles that HR Manager is authorized to assign during onboarding / role assignment
# HR Manager CANNOT assign SUPER_ADMIN, HOSPITAL_ADMIN, or BRANCH_MANAGER
HR_ASSIGNABLE_ROLES = {
    RoleEnum.MEDICAL_DIRECTOR,
    RoleEnum.DEPARTMENT_HEAD,
    RoleEnum.DOCTOR,
    RoleEnum.NURSE,
    RoleEnum.RECEPTIONIST,
    RoleEnum.PHARMACIST,
    RoleEnum.LAB_TECHNICIAN,
    RoleEnum.RADIOLOGY_TECHNICIAN,
    RoleEnum.INVENTORY_MANAGER,
    RoleEnum.PROCUREMENT_OFFICER,
    RoleEnum.BILLING_EXECUTIVE,
    RoleEnum.CASHIER,
    RoleEnum.INSURANCE_COORDINATOR,
    RoleEnum.ACCOUNTANT,
    RoleEnum.FINANCE_MANAGER,
    RoleEnum.INVESTMENT_MANAGER,
    RoleEnum.HR_MANAGER,
    RoleEnum.AUDITOR,
}

# Canonical 25 Backend Modules
ALL_MODULES = [
    'DASHBOARD', 'PATIENTS', 'OPD', 'EMERGENCY', 'IPD', 'DOCTORS_NURSING',
    'LAB', 'RADIOLOGY', 'PHARMACY', 'INVENTORY', 'OT_ICU', 'BILLING',
    'INSURANCE', 'FIN_ACCOUNTS', 'TRANSACTIONS', 'INVESTMENTS', 'BANKING',
    'LOANS', 'GENERAL_LEDGER', 'BUDGETING', 'PROFIT_LOSS', 'HR_PAYROLL',
    'ASSETS', 'REPORTS', 'USERS_ROLES', 'SETTINGS_AUDIT', 'PATIENT_PORTAL',
]

# 3D Role -> Module -> Allowed Actions Matrix
ROLE_MODULE_ACTIONS = {
    # A. SUPER ADMIN: Overall system administration, user/role/permission config, branch/dept config, security & system audit logs (4 sections)
    RoleEnum.SUPER_ADMIN: {
        'DASHBOARD': ['view', 'export'],
        'REPORTS': ['view', 'export'],
        'USERS_ROLES': ['view', 'create', 'edit', 'delete', 'manage', 'approve'],
        'SETTINGS_AUDIT': ['view', 'create', 'edit', 'export', 'manage'],
    },
    # B. BRANCH MANAGER / HOSPITAL ADMIN: Strict read-only branch operations monitoring across all hospital domains
    RoleEnum.BRANCH_MANAGER: {
        'DASHBOARD': ['view', 'export'],
        'PATIENTS': ['view', 'export'],
        'OPD': ['view', 'export'],
        'EMERGENCY': ['view', 'export'],
        'IPD': ['view', 'export'],
        'DOCTORS_NURSING': ['view', 'export'],
        'LAB': ['view', 'export'],
        'RADIOLOGY': ['view', 'export'],
        'PHARMACY': ['view', 'export'],
        'INVENTORY': ['view', 'export'],
        'OT_ICU': ['view', 'export'],
        'BILLING': ['view', 'export'],
        'INSURANCE': ['view', 'export'],
        'FIN_ACCOUNTS': ['view', 'export'],
        'TRANSACTIONS': ['view', 'export'],
        'INVESTMENTS': ['view', 'export'],
        'BANKING': ['view', 'export'],
        'LOANS': ['view', 'export'],
        'GENERAL_LEDGER': ['view', 'export'],
        'BUDGETING': ['view', 'export'],
        'PROFIT_LOSS': ['view', 'export'],
        'HR_PAYROLL': ['view', 'export'],
        'ASSETS': ['view', 'export'],
        'REPORTS': ['view', 'export'],
        'SETTINGS_AUDIT': ['view', 'export'],
    },
    RoleEnum.HOSPITAL_ADMIN: {
        'DASHBOARD': ['view', 'export'],
        'PATIENTS': ['view', 'export'],
        'OPD': ['view', 'export'],
        'EMERGENCY': ['view', 'export'],
        'IPD': ['view', 'export'],
        'DOCTORS_NURSING': ['view', 'export'],
        'LAB': ['view', 'export'],
        'RADIOLOGY': ['view', 'export'],
        'PHARMACY': ['view', 'export'],
        'INVENTORY': ['view', 'export'],
        'OT_ICU': ['view', 'export'],
        'BILLING': ['view', 'export'],
        'INSURANCE': ['view', 'export'],
        'FIN_ACCOUNTS': ['view', 'export'],
        'TRANSACTIONS': ['view', 'export'],
        'INVESTMENTS': ['view', 'export'],
        'BANKING': ['view', 'export'],
        'LOANS': ['view', 'export'],
        'GENERAL_LEDGER': ['view', 'export'],
        'BUDGETING': ['view', 'export'],
        'PROFIT_LOSS': ['view', 'export'],
        'HR_PAYROLL': ['view', 'export'],
        'ASSETS': ['view', 'export'],
        'REPORTS': ['view', 'export'],
        'SETTINGS_AUDIT': ['view', 'export'],
    },
    # C. MEDICAL DIRECTOR: Clinical governance, doctor availability, OPD/IPD quality, patient safety, medical protocols & clinical audit (9 sections)
    RoleEnum.MEDICAL_DIRECTOR: {
        'DASHBOARD': ['view', 'export'],
        'PATIENTS': ['view', 'edit', 'approve'],
        'OPD': ['view', 'edit', 'approve'],
        'EMERGENCY': ['view', 'edit', 'approve'],
        'IPD': ['view', 'edit', 'approve'],
        'DOCTORS_NURSING': ['view', 'edit', 'approve'],
        'OT_ICU': ['view', 'edit', 'approve'],
        'REPORTS': ['view', 'export'],
        'SETTINGS_AUDIT': ['view', 'export'],
    },
    # D. DEPARTMENT HEAD: Supervise assigned department, staff overview, attendance, shifts, workload, approvals, resources & department activity logs (9 sections)
    RoleEnum.DEPARTMENT_HEAD: {
        'DASHBOARD': ['view', 'export'],
        'PATIENTS': ['view', 'edit'],
        'OPD': ['view', 'edit', 'approve'],
        'IPD': ['view', 'create', 'edit', 'approve'],
        'DOCTORS_NURSING': ['view', 'edit', 'approve'],
        'HR_PAYROLL': ['view', 'approve', 'reject'],
        'ASSETS': ['view', 'edit'],
        'REPORTS': ['view', 'export'],
        'SETTINGS_AUDIT': ['view'],
    },
    # E. DOCTOR: Assigned patient records, medical history, consultations, diagnosis, prescriptions, clinical notes, lab/imaging orders, treatment plans & discharge summaries (9 sections)
    RoleEnum.DOCTOR: {
        'DASHBOARD': ['view'],
        'PATIENTS': ['view', 'edit'],
        'OPD': ['view', 'edit'],
        'EMERGENCY': ['view', 'create', 'edit'],
        'IPD': ['view', 'create', 'edit'],
        'DOCTORS_NURSING': ['view', 'edit'],
        'LAB': ['view', 'create'],
        'RADIOLOGY': ['view', 'create'],
        'OT_ICU': ['view', 'create', 'edit'],
    },
    # F. NURSE: Assigned patients, vitals recording, nursing notes, nursing care plans, MAR, doctor orders, assigned wards, patient monitoring & shift handover (6 sections)
    RoleEnum.NURSE: {
        'DASHBOARD': ['view'],
        'PATIENTS': ['view', 'edit'],
        'EMERGENCY': ['view', 'create', 'edit'],
        'IPD': ['view', 'edit'],
        'DOCTORS_NURSING': ['view', 'create', 'edit'],
        'OT_ICU': ['view', 'create', 'edit'],
    },
    # G. RECEPTIONIST: Patient registration, restricted patient search, appointment management, doctor availability, OPD/IPD registration & basic billing initiation (5 sections)
    RoleEnum.RECEPTIONIST: {
        'DASHBOARD': ['view'],
        'PATIENTS': ['view', 'create', 'edit'],
        'OPD': ['view', 'create', 'edit', 'print'],
        'IPD': ['view', 'create'],
        'BILLING': ['view', 'create', 'print'],
    },
    # H. PHARMACIST: Authorized prescriptions, medicine dispensing, medicine stock updates, batch/expiry tracking, low-stock alerts & pharmacy sales/issue records (2 sections)
    RoleEnum.PHARMACIST: {
        'PHARMACY': ['view', 'create', 'edit', 'dispense', 'print', 'export'],
        'REPORTS': ['view', 'export'],
    },
    # I. LAB TECHNICIAN: Assigned test orders, sample collection, test processing, result entry, report verification workflow & lab reports
    RoleEnum.LAB_TECHNICIAN: {
        'LAB': ['view', 'create', 'edit', 'verify', 'print', 'export'],
        'ASSETS': ['view', 'edit'],
        'REPORTS': ['view', 'export'],
    },
    RoleEnum.RADIOLOGY_TECHNICIAN: {
        'DASHBOARD': ['view'],
        'RADIOLOGY': ['view', 'create', 'edit', 'verify', 'print', 'export'],
        'ASSETS': ['view', 'edit'],
        'REPORTS': ['view', 'export'],
    },
    RoleEnum.INVENTORY_MANAGER: {
        'INVENTORY': ['view', 'create', 'edit', 'approve', 'export'],
        'ASSETS': ['view', 'create', 'edit'],
        'REPORTS': ['view', 'export'],
    },
    RoleEnum.PROCUREMENT_OFFICER: {
        'INVENTORY': ['view', 'create', 'edit', 'approve', 'export'],
        'ASSETS': ['view', 'create', 'edit'],
    },
    RoleEnum.BILLING_EXECUTIVE: {
        'PATIENTS': ['view'],
        'BILLING': ['view', 'create', 'edit', 'print', 'export'],
        'TRANSACTIONS': ['view', 'create'],
        'REPORTS': ['view', 'export'],
    },
    RoleEnum.CASHIER: {
        'PATIENTS': ['view'],
        'BILLING': ['view', 'create', 'edit', 'print', 'export'],
        'TRANSACTIONS': ['view', 'create'],
        'REPORTS': ['view', 'export'],
    },
    RoleEnum.INSURANCE_COORDINATOR: {
        'INSURANCE': ['view', 'create', 'edit', 'approve', 'export'],
        'REPORTS': ['view', 'export'],
    },
    # J. ACCOUNTANT: Consolidated into Finance Manager (Legacy alias)
    RoleEnum.ACCOUNTANT: {
        'DASHBOARD': ['view', 'export'],
        'FIN_ACCOUNTS': ['view', 'create', 'edit', 'approve', 'export'],
        'TRANSACTIONS': ['view', 'create', 'edit', 'approve', 'reject', 'post', 'export'],
        'BANKING': ['view', 'create', 'edit', 'approve', 'post', 'export'],
        'LOANS': ['view', 'create', 'edit', 'approve', 'export'],
        'GENERAL_LEDGER': ['view', 'create', 'edit', 'approve', 'post', 'export'],
        'BUDGETING': ['view', 'create', 'edit', 'approve', 'export'],
        'PROFIT_LOSS': ['view', 'export'],
        'HR_PAYROLL': ['view', 'approve', 'post'],
        'REPORTS': ['view', 'export'],
    },
    # K. FINANCE MANAGER: Strategic financial controller (Checker) — Executive P&L, voucher approval queue, budgets, loans & payroll release sign-off
    RoleEnum.FINANCE_MANAGER: {
        'DASHBOARD': ['view', 'export'],
        'FIN_ACCOUNTS': ['view', 'create', 'edit', 'approve', 'export'],
        'TRANSACTIONS': ['view', 'create', 'edit', 'approve', 'reject', 'post', 'export'],
        'BANKING': ['view', 'create', 'edit', 'approve', 'post', 'export'],
        'LOANS': ['view', 'create', 'edit', 'approve', 'export'],
        'GENERAL_LEDGER': ['view', 'create', 'edit', 'approve', 'post', 'export'],
        'BUDGETING': ['view', 'create', 'edit', 'approve', 'export'],
        'PROFIT_LOSS': ['view', 'export'],
        'HR_PAYROLL': ['view', 'approve', 'post'],  # Approve & disburse payroll
        'REPORTS': ['view', 'export'],
    },
    RoleEnum.INVESTMENT_MANAGER: {
        'DASHBOARD': ['view'],
        'INVESTMENTS': ['view', 'create', 'edit', 'approve', 'export'],
        'BANKING': ['view'],
        'PROFIT_LOSS': ['view', 'export'],
    },
    # K. HR MANAGER: Employee onboarding, records, department/role assignment, shift scheduling, attendance, leave requests, payroll preparation & HR activity logs (5 sections)
    RoleEnum.HR_MANAGER: {
        'DASHBOARD': ['view', 'export'],
        'HR_PAYROLL': ['view', 'create', 'edit', 'approve', 'reject', 'export', 'manage'],
        'REPORTS': ['view', 'export'],
        'USERS_ROLES': ['view', 'create', 'edit'],      # Staff account creation & approved role assignment
        'SETTINGS_AUDIT': ['view', 'export'],           # HR activity logs
    },
    # L. AUDITOR: Read-only compliance, financial & operational audit inspection + record audit findings (6 sections)
    RoleEnum.AUDITOR: {
        'DASHBOARD': ['view', 'export'],
        'GENERAL_LEDGER': ['view', 'export'],
        'PROFIT_LOSS': ['view', 'export'],
        'REPORTS': ['view', 'export'],
        'USERS_ROLES': ['view', 'export'],
        'SETTINGS_AUDIT': ['view', 'create', 'export'],  # 'create' is strictly for recording Audit Findings
    },
    # M. PATIENT: Own profile, appointments, prescriptions, lab reports, discharge summaries & bills
    RoleEnum.PATIENT: {
        'PATIENT_PORTAL': ['view', 'create', 'edit', 'print'],
    },
}

# Mapping of entity_type / action keywords to high-level audit categories for scoped log visibility
AUDIT_LOG_CATEGORY_MAP = {
    'HR': [
        'STAFF', 'EMPLOYEE', 'SHIFT', 'ROSTER', 'ATTENDANCE', 'LEAVE', 'PAYROLL', 'PAYSLIP', 'SALARY', 'ONBOARD'
    ],
    'CLINICAL': [
        'PATIENT', 'APPOINTMENT', 'CONSULTATION', 'OPD', 'IPD', 'ADMISSION', 'DISCHARGE', 'BED', 'WARD',
        'EMERGENCY', 'TRIAGE', 'VITALS', 'NURSING', 'LAB', 'SAMPLE', 'RADIOLOGY', 'PRESCRIPTION', 'DISPENSE',
        'SURGERY', 'OT', 'ICU', 'CONSENT', 'MEDICAL_HISTORY'
    ],
    'FINANCE': [
        'INVOICE', 'BILL', 'PAYMENT', 'RECEIPT', 'REFUND', 'INSURANCE', 'CLAIM', 'ACCOUNT', 'TRANSACTION',
        'JOURNAL', 'LEDGER', 'BANK', 'RECONCIL', 'INVESTMENT', 'LOAN', 'BUDGET', 'FINANCIAL', 'DEPRECIATION'
    ],
    'SECURITY': [
        'USER', 'ROLE', 'PERMISSION', 'LOGIN', 'LOGOUT', 'PASSWORD', 'MFA', 'SECURITY', 'SETTING', 'BACKUP'
    ],
}


def has_module_action_permission(role_name: str, module: str, action: str = 'view') -> bool:
    """
    Returns True if `role_name` is permitted to perform `action` in `module`.
    """
    if not role_name:
        return False
    role_perms = ROLE_MODULE_ACTIONS.get(role_name, {})
    allowed_actions = role_perms.get(module, [])
    return action in allowed_actions or 'manage' in allowed_actions


def get_role_data_scope(role_name: str) -> str:
    """
    Returns the primary organizational data scope for `role_name`.
    """
    return ROLE_DATA_SCOPES.get(role_name, DataScope.OWN)

