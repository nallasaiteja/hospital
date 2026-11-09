import { UserRole } from '../types';

export type DataScopeType = 'OWN' | 'ASSIGNED_PAT' | 'ASSIGNED_WARD' | 'DEPT' | 'BRANCH' | 'ORG';

export type RBACModule =
  | 'DASHBOARD'
  | 'PATIENTS'
  | 'OPD'
  | 'EMERGENCY'
  | 'IPD'
  | 'DOCTORS_NURSING'
  | 'LAB'
  | 'RADIOLOGY'
  | 'PHARMACY'
  | 'INVENTORY'
  | 'OT_ICU'
  | 'BILLING'
  | 'INSURANCE'
  | 'FIN_ACCOUNTS'
  | 'TRANSACTIONS'
  | 'INVESTMENTS'
  | 'BANKING'
  | 'LOANS'
  | 'GENERAL_LEDGER'
  | 'BUDGETING'
  | 'PROFIT_LOSS'
  | 'HR_PAYROLL'
  | 'ASSETS'
  | 'PATIENT_PORTAL'
  | 'REPORTS'
  | 'USERS_ROLES'
  | 'SETTINGS_AUDIT';

export type RBACAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'export'
  | 'manage'
  | 'dispense'
  | 'verify'
  | 'post'
  | 'print';

export const ROLE_DATA_SCOPES: Record<UserRole, DataScopeType> = {
  SUPER_ADMIN: 'ORG',
  HOSPITAL_ADMIN: 'ORG',
  BRANCH_MANAGER: 'BRANCH',
  MEDICAL_DIRECTOR: 'BRANCH',
  DEPARTMENT_HEAD: 'DEPT',
  DOCTOR: 'ASSIGNED_PAT',
  NURSE: 'ASSIGNED_WARD',
  RECEPTIONIST: 'BRANCH',
  PHARMACIST: 'BRANCH',
  LAB_TECHNICIAN: 'BRANCH',
  RADIOLOGY_TECHNICIAN: 'BRANCH',
  INVENTORY_MANAGER: 'BRANCH',
  PROCUREMENT_OFFICER: 'BRANCH',
  BILLING_EXECUTIVE: 'BRANCH',
  CASHIER: 'BRANCH',
  INSURANCE_COORDINATOR: 'BRANCH',
  ACCOUNTANT: 'BRANCH',
  FINANCE_MANAGER: 'BRANCH',
  INVESTMENT_MANAGER: 'ORG',
  HR_MANAGER: 'BRANCH',
  AUDITOR: 'ORG',
  PATIENT: 'OWN',
};

export const STRICT_READ_ONLY_ROLES: UserRole[] = [
  'BRANCH_MANAGER',
];

export const HR_ASSIGNABLE_ROLES: UserRole[] = [
  'MEDICAL_DIRECTOR',
  'DEPARTMENT_HEAD',
  'DOCTOR',
  'NURSE',
  'RECEPTIONIST',
  'PHARMACIST',
  'LAB_TECHNICIAN',
  'RADIOLOGY_TECHNICIAN',
  'INVENTORY_MANAGER',
  'PROCUREMENT_OFFICER',
  'BILLING_EXECUTIVE',
  'INSURANCE_COORDINATOR',
  'FINANCE_MANAGER',
  'INVESTMENT_MANAGER',
  'HR_MANAGER',
];

export const ROLE_MODULE_ACTIONS: Record<UserRole, Partial<Record<RBACModule, RBACAction[]>>> = {
  // A. SUPER ADMIN: Overall system administration, user/role/permission config, branch/dept config, security & system audit logs (4 sections)
  SUPER_ADMIN: {
    DASHBOARD: ['view', 'export'],
    REPORTS: ['view', 'export'],
    USERS_ROLES: ['view', 'create', 'edit', 'delete', 'manage', 'approve'],
    SETTINGS_AUDIT: ['view', 'create', 'edit', 'export', 'manage'],
  },
  // B. BRANCH MANAGER / HOSPITAL ADMIN: Strict read-only branch operations monitoring across all hospital domains
  BRANCH_MANAGER: {
    DASHBOARD: ['view', 'export'],
    PATIENTS: ['view', 'export'],
    OPD: ['view', 'export'],
    EMERGENCY: ['view', 'export'],
    IPD: ['view', 'export'],
    DOCTORS_NURSING: ['view', 'export'],
    LAB: ['view', 'export'],
    RADIOLOGY: ['view', 'export'],
    PHARMACY: ['view', 'export'],
    INVENTORY: ['view', 'export'],
    OT_ICU: ['view', 'export'],
    BILLING: ['view', 'export'],
    INSURANCE: ['view', 'export'],
    FIN_ACCOUNTS: ['view', 'export'],
    TRANSACTIONS: ['view', 'export'],
    INVESTMENTS: ['view', 'export'],
    BANKING: ['view', 'export'],
    LOANS: ['view', 'export'],
    GENERAL_LEDGER: ['view', 'export'],
    BUDGETING: ['view', 'export'],
    PROFIT_LOSS: ['view', 'export'],
    HR_PAYROLL: ['view', 'export'],
    ASSETS: ['view', 'export'],
    REPORTS: ['view', 'export'],
    SETTINGS_AUDIT: ['view', 'export'],
  },
  HOSPITAL_ADMIN: {
    DASHBOARD: ['view', 'export'],
    PATIENTS: ['view', 'export'],
    OPD: ['view', 'export'],
    EMERGENCY: ['view', 'export'],
    IPD: ['view', 'export'],
    DOCTORS_NURSING: ['view', 'export'],
    LAB: ['view', 'export'],
    RADIOLOGY: ['view', 'export'],
    PHARMACY: ['view', 'export'],
    INVENTORY: ['view', 'export'],
    OT_ICU: ['view', 'export'],
    BILLING: ['view', 'export'],
    INSURANCE: ['view', 'export'],
    FIN_ACCOUNTS: ['view', 'export'],
    TRANSACTIONS: ['view', 'export'],
    INVESTMENTS: ['view', 'export'],
    BANKING: ['view', 'export'],
    LOANS: ['view', 'export'],
    GENERAL_LEDGER: ['view', 'export'],
    BUDGETING: ['view', 'export'],
    PROFIT_LOSS: ['view', 'export'],
    HR_PAYROLL: ['view', 'export'],
    ASSETS: ['view', 'export'],
    REPORTS: ['view', 'export'],
    SETTINGS_AUDIT: ['view', 'export'],
  },
  // C. MEDICAL DIRECTOR (Dr. Bhaskar Chatterjee): Clinical Practice Suite (Doctor Workspace & Voice Translation ONLY)
  MEDICAL_DIRECTOR: {
    PATIENTS: ['view', 'edit'],
    OPD: ['view', 'edit'],
    EMERGENCY: ['view', 'create', 'edit'],
    IPD: ['view', 'create', 'edit'],
    LAB: ['view', 'create'],
    RADIOLOGY: ['view', 'create'],
    OT_ICU: ['view', 'create', 'edit'],
  },
  // D. DEPARTMENT HEAD: Supervise assigned department, staff overview, attendance, shifts, workload, approvals, resources & department activity logs (9 sections)
  DEPARTMENT_HEAD: {
    DASHBOARD: ['view', 'export'],
    PATIENTS: ['view', 'edit'],
    OPD: ['view', 'edit', 'approve'],
    IPD: ['view', 'create', 'edit', 'approve'],
    DOCTORS_NURSING: ['view', 'edit', 'approve'],
    HR_PAYROLL: ['view', 'approve', 'reject'],
    ASSETS: ['view', 'edit'],
    REPORTS: ['view', 'export'],
    SETTINGS_AUDIT: ['view'],
  },
  // E. DOCTOR: Assigned patient records, medical history, consultations, diagnosis, prescriptions, clinical notes, lab/imaging orders, treatment plans & discharge summaries (9 sections)
  DOCTOR: {
    DASHBOARD: ['view'],
    PATIENTS: ['view', 'edit'],
    OPD: ['view', 'edit'],
    EMERGENCY: ['view', 'create', 'edit'],
    IPD: ['view', 'create', 'edit'],
    DOCTORS_NURSING: ['view', 'edit'],
    LAB: ['view', 'create'],
    RADIOLOGY: ['view', 'create'],
    OT_ICU: ['view', 'create', 'edit'],
  },
  // F. NURSE: Assigned patients, vitals recording, nursing notes, nursing care plans, MAR, doctor orders, assigned wards, patient monitoring & shift handover (6 sections)
  NURSE: {
    DASHBOARD: ['view'],
    PATIENTS: ['view', 'edit'],
    EMERGENCY: ['view', 'create', 'edit'],
    IPD: ['view', 'edit'],
    DOCTORS_NURSING: ['view', 'create', 'edit'],
    OT_ICU: ['view', 'create', 'edit'],
  },
  // G. RECEPTIONIST: Patient registration, restricted patient search, appointment management, doctor availability, OPD/IPD registration & basic billing initiation (5 sections)
  RECEPTIONIST: {
    DASHBOARD: ['view'],
    PATIENTS: ['view', 'create', 'edit'],
    OPD: ['view', 'create', 'edit', 'print'],
    IPD: ['view', 'create'],
    BILLING: ['view', 'create', 'print'],
  },
  // H. PHARMACIST: Authorized prescriptions, medicine dispensing, medicine stock updates, batch/expiry tracking, low-stock alerts & pharmacy sales/issue records (2 sections)
  PHARMACIST: {
    PHARMACY: ['view', 'create', 'edit', 'dispense', 'print', 'export'],
    REPORTS: ['view', 'export'],
  },
  // I. LAB TECHNICIAN: Assigned test orders, sample collection, test processing, result entry, report verification workflow & lab reports
  LAB_TECHNICIAN: {
    LAB: ['view', 'create', 'edit', 'verify', 'print', 'export'],
    ASSETS: ['view', 'edit'],
    REPORTS: ['view', 'export'],
  },
  RADIOLOGY_TECHNICIAN: {
    DASHBOARD: ['view'],
    RADIOLOGY: ['view', 'create', 'edit', 'verify', 'print', 'export'],
    ASSETS: ['view', 'edit'],
    REPORTS: ['view', 'export'],
  },
  INVENTORY_MANAGER: {
    INVENTORY: ['view', 'create', 'edit', 'approve', 'export'],
    ASSETS: ['view', 'create', 'edit'],
    REPORTS: ['view', 'export'],
  },
  PROCUREMENT_OFFICER: {
    INVENTORY: ['view', 'create', 'edit', 'approve', 'export'],
    ASSETS: ['view', 'create', 'edit'],
  },
  BILLING_EXECUTIVE: {
    PATIENTS: ['view'],
    BILLING: ['view', 'create', 'edit', 'print', 'export'],
    TRANSACTIONS: ['view', 'create'],
    REPORTS: ['view', 'export'],
  },
  CASHIER: {
    PATIENTS: ['view'],
    BILLING: ['view', 'create', 'edit', 'print', 'export'],
    TRANSACTIONS: ['view', 'create'],
    REPORTS: ['view', 'export'],
  },
  INSURANCE_COORDINATOR: {
    INSURANCE: ['view', 'create', 'edit', 'approve', 'export'],
    REPORTS: ['view', 'export'],
  },
  // J. ACCOUNTANT: Consolidated into Finance Manager (Legacy alias)
  ACCOUNTANT: {
    DASHBOARD: ['view', 'export'],
    FIN_ACCOUNTS: ['view', 'create', 'edit', 'approve', 'export'],
    TRANSACTIONS: ['view', 'create', 'edit', 'approve', 'reject', 'post', 'export'],
    BANKING: ['view', 'create', 'edit', 'approve', 'post', 'export'],
    LOANS: ['view', 'create', 'edit', 'approve', 'export'],
    GENERAL_LEDGER: ['view', 'create', 'edit', 'approve', 'post', 'export'],
    BUDGETING: ['view', 'create', 'edit', 'approve', 'export'],
    PROFIT_LOSS: ['view', 'export'],
    HR_PAYROLL: ['view', 'approve', 'post'],
    REPORTS: ['view', 'export'],
  },
  // K. FINANCE MANAGER: Strategic financial controller (Checker) — Executive P&L, voucher approval queue, budgets, loans & payroll release sign-off
  FINANCE_MANAGER: {
    DASHBOARD: ['view', 'export'],
    FIN_ACCOUNTS: ['view', 'create', 'edit', 'approve', 'export'],
    TRANSACTIONS: ['view', 'create', 'edit', 'approve', 'reject', 'post', 'export'],
    BANKING: ['view', 'create', 'edit', 'approve', 'post', 'export'],
    LOANS: ['view', 'create', 'edit', 'approve', 'export'],
    GENERAL_LEDGER: ['view', 'create', 'edit', 'approve', 'post', 'export'],
    BUDGETING: ['view', 'create', 'edit', 'approve', 'export'],
    PROFIT_LOSS: ['view', 'export'],
    HR_PAYROLL: ['view', 'approve', 'post'],
    REPORTS: ['view', 'export'],
  },
  INVESTMENT_MANAGER: {
    DASHBOARD: ['view'],
    INVESTMENTS: ['view', 'create', 'edit', 'approve', 'export'],
    BANKING: ['view'],
    PROFIT_LOSS: ['view', 'export'],
  },
  // K. HR MANAGER: Employee onboarding, records, department/role assignment, shift scheduling, attendance, leave requests, payroll preparation & HR activity logs (5 sections)
  HR_MANAGER: {
    DASHBOARD: ['view', 'export'],
    HR_PAYROLL: ['view', 'create', 'edit', 'approve', 'reject', 'export', 'manage'],
    REPORTS: ['view', 'export'],
    USERS_ROLES: ['view', 'create', 'edit'],
    SETTINGS_AUDIT: ['view', 'export'],
  },
  // L. AUDITOR: Read-only compliance, financial & operational audit inspection + record audit findings (6 sections)
  AUDITOR: {
    DASHBOARD: ['view', 'export'],
    GENERAL_LEDGER: ['view', 'export'],
    PROFIT_LOSS: ['view', 'export'],
    REPORTS: ['view', 'export'],
    USERS_ROLES: ['view', 'export'],
    SETTINGS_AUDIT: ['view', 'create', 'export'],
  },
  // M. PATIENT: Own profile, appointments, prescriptions, lab reports, discharge summaries & bills
  PATIENT: {
    PATIENT_PORTAL: ['view', 'create', 'edit', 'print'],
  },
};

export const ROUTE_TO_MODULE_MAP: { pattern: RegExp; module: RBACModule; label: string }[] = [
  { pattern: /^\/staff\/branch-manager(\/.*)?$/, module: 'DASHBOARD', label: 'Branch Manager Hub' },
  { pattern: /^\/staff\/department-head(\/.*)?$/, module: 'DASHBOARD', label: 'Department Head Operations Hub' },
  { pattern: /^\/staff\/hr-management(\/.*)?$/, module: 'HR_PAYROLL', label: 'HR Management Command Center' },
  { pattern: /^\/staff\/doctor-workspace(\/.*)?$/, module: 'DOCTORS_NURSING', label: 'Doctor Clinical Workspace' },
  { pattern: /^\/staff\/nurse-workspace(\/.*)?$/, module: 'DOCTORS_NURSING', label: 'Nurse Clinical Workspace' },
  { pattern: /^\/staff\/dashboard\/?$/, module: 'DASHBOARD', label: '1. Dashboard' },
  { pattern: /^\/staff\/patients(\/.*)?$/, module: 'PATIENTS', label: '2. Patient Management & EMR' },
  { pattern: /^\/staff\/(appointments|consultations)\/?$/, module: 'OPD', label: '3. OPD & Appointments' },
  { pattern: /^\/staff\/emergency\/?$/, module: 'EMERGENCY', label: '4. Emergency & Casualty' },
  { pattern: /^\/staff\/admissions\/?$/, module: 'IPD', label: '5. IPD & Admissions' },
  { pattern: /^\/staff\/doctors-nursing\/?$/, module: 'DOCTORS_NURSING', label: '6. Doctors & Nursing' },
  { pattern: /^\/staff\/laboratory\/?$/, module: 'LAB', label: '7. Laboratory & Diagnostics' },
  { pattern: /^\/staff\/radiology\/?$/, module: 'RADIOLOGY', label: '8. Radiology & Imaging' },
  { pattern: /^\/staff\/pharmacy\/?$/, module: 'PHARMACY', label: '9. Pharmacy Formulary' },
  { pattern: /^\/staff\/inventory\/?$/, module: 'INVENTORY', label: '10. Inventory & Procurement' },
  { pattern: /^\/staff\/surgery-icu\/?$/, module: 'OT_ICU', label: '11. OT & ICU Surgical Suite' },
  { pattern: /^\/staff\/billing\/?$/, module: 'BILLING', label: '12. Billing & Cashier' },
  { pattern: /^\/staff\/insurance\/?$/, module: 'INSURANCE', label: '13. Insurance & TPA Claims' },
  { pattern: /^\/staff\/financial-accounts\/?$/, module: 'FIN_ACCOUNTS', label: '14. Financial Accounts' },
  { pattern: /^\/staff\/transactions\/?$/, module: 'TRANSACTIONS', label: '15. Financial Transactions' },
  { pattern: /^\/staff\/investments\/?$/, module: 'INVESTMENTS', label: '16. Investment Registers' },
  { pattern: /^\/staff\/banking\/?$/, module: 'BANKING', label: '17. Banking & Reconciliation' },
  { pattern: /^\/staff\/loans\/?$/, module: 'LOANS', label: '18. Loans & Liabilities' },
  { pattern: /^\/staff\/(general-ledger|finance)\/?$/, module: 'GENERAL_LEDGER', label: '19. Accounting & General Ledger' },
  { pattern: /^\/staff\/(budgeting|cash-flow)\/?$/, module: 'BUDGETING', label: '20. Budgeting & Cash Flow' },
  { pattern: /^\/staff\/profit-loss\/?$/, module: 'PROFIT_LOSS', label: '21. Profit & Loss Statement' },
  { pattern: /^\/staff\/hr-payroll\/?$/, module: 'HR_PAYROLL', label: '22. HR & Staff Payroll' },
  { pattern: /^\/staff\/assets\/?$/, module: 'ASSETS', label: '23. Equipment & Assets' },
  { pattern: /^\/staff\/patient-portal\/?$/, module: 'PATIENT_PORTAL', label: '24. Patient Portal Gateway' },
  { pattern: /^\/staff\/reports\/?$/, module: 'REPORTS', label: '25. Reports & Analytics' },
  { pattern: /^\/staff\/(users-roles|staff-management)\/?$/, module: 'USERS_ROLES', label: '26. Users, Roles & RBAC' },
  { pattern: /^\/staff\/(settings-audit|audit)\/?$/, module: 'SETTINGS_AUDIT', label: '27. Settings & Audit Trail' },
];

export function canPerformModuleAction(
  role: UserRole | null | undefined,
  module: RBACModule,
  action: RBACAction = 'view'
): boolean {
  if (!role) return false;
  const roleMatrix = ROLE_MODULE_ACTIONS[role];
  if (!roleMatrix) return false;
  const allowedActions = roleMatrix[module] || [];
  return allowedActions.includes(action) || allowedActions.includes('manage');
}

export function resolveRouteModule(pathname: string): { module: RBACModule; label: string } | null {
  for (const item of ROUTE_TO_MODULE_MAP) {
    if (item.pattern.test(pathname)) {
      return { module: item.module, label: item.label };
    }
  }
  return null;
}

export function canAccessRoute(role: UserRole | null | undefined, pathname: string): boolean {
  if (!role) return false;
  if (role === 'DOCTOR' || role === 'MEDICAL_DIRECTOR') {
    return (
      pathname.startsWith('/staff/doctor-workspace') ||
      pathname.startsWith('/staff/voice-translation') ||
      pathname.startsWith('/staff/lounge-tv')
    );
  }
  if (pathname.startsWith('/staff/branch-manager')) {
    return ['BRANCH_MANAGER', 'HOSPITAL_ADMIN', 'SUPER_ADMIN'].includes(role);
  }
  if (pathname === '/staff/dashboard' || pathname === '/staff/dashboard/') {
    if (
      role === 'LAB_TECHNICIAN' ||
      role === 'RADIOLOGY_TECHNICIAN' ||
      role === 'PHARMACIST' ||
      role === 'INSURANCE_COORDINATOR' ||
      role === 'CASHIER' ||
      role === 'BILLING_EXECUTIVE' ||
      role === 'INVENTORY_MANAGER' ||
      role === 'PROCUREMENT_OFFICER' ||
      role === 'INVESTMENT_MANAGER'
    ) return false;
  }
  if (pathname.startsWith('/staff/patients')) {
    if (role === 'INSURANCE_COORDINATOR') return false;
  }
  if (pathname.startsWith('/staff/billing')) {
    if (role === 'FINANCE_MANAGER' || role === 'INSURANCE_COORDINATOR') return false;
  }
  if (pathname.startsWith('/staff/insurance')) {
    if (role === 'FINANCE_MANAGER' || role === 'ACCOUNTANT') return false;
  }
  if (pathname.startsWith('/staff/investments')) {
    if (role === 'FINANCE_MANAGER' || role === 'ACCOUNTANT') return false;
  }
  if (pathname.startsWith('/staff/reports')) {
    if (role === 'PROCUREMENT_OFFICER') return false;
  }
  if (pathname.startsWith('/staff/department-head')) {
    return ['DEPARTMENT_HEAD', 'SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER'].includes(role);
  }
  if (pathname.startsWith('/staff/hr-management')) {
    return ['HR_MANAGER', 'SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER'].includes(role);
  }
  if (pathname.startsWith('/staff/doctor-workspace')) {
    return ['DOCTOR', 'DEPARTMENT_HEAD', 'SUPER_ADMIN'].includes(role);
  }
  if (pathname.startsWith('/staff/nurse-workspace')) {
    return ['NURSE', 'SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'MEDICAL_DIRECTOR'].includes(role);
  }
  if (pathname.startsWith('/staff/voice-translation')) {
    return ['DOCTOR', 'NURSE', 'RECEPTIONIST', 'DEPARTMENT_HEAD'].includes(role);
  }
  const matched = resolveRouteModule(pathname);
  if (!matched) return true;
  return canPerformModuleAction(role, matched.module, 'view');
}

