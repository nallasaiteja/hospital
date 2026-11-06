import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Users,
  Bed,
  Stethoscope,
  Pill,
  DollarSign,
  ShieldCheck,
  Building2,
  LogOut,
  Bell,
  ChevronDown,
  Menu,
  X,
  FileText,
  Clock,
  Layers,
  ShoppingBag,
  History,
  Scissors,
  Receipt,
  FileSpreadsheet,
  TrendingUp,
  Landmark,
  Scale,
  Target,
  Wrench,
  BarChart3,
  ShieldAlert,
  Settings,
  UserCheck,
  ExternalLink,
  Flame,
  Radio,
  Languages,
  Calendar,
  Award,
  GraduationCap,
  UserMinus,
  AlertOctagon,
  CheckSquare,
  FileCheck,
  Briefcase,
  Tag,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { Badge } from '../components/common/Badge';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { canAccessRoute, ROLE_DATA_SCOPES, STRICT_READ_ONLY_ROLES } from '../config/rbacMatrix';
import clsx from 'clsx';

interface NavGroup {
  title: string;
  translationKey: string;
  items: {
    label: string;
    translationKey: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    roles?: string[];
    isExternal?: boolean;
  }[];
}

export const StaffLayout: React.FC = () => {
  const { t } = useTranslation();
  const { userProfile, staffProfile, role, logout, updateDutyStatus } = useAuth();
  const { branches, currentBranch, switchBranch } = useBranch();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isOnDuty, setIsOnDuty] = useState(staffProfile?.is_on_duty ?? true);
  const [isTogglingDuty, setIsTogglingDuty] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Synchronize on-duty status from live staffProfile in AuthContext
  useEffect(() => {
    if (staffProfile) {
      setIsOnDuty(staffProfile.is_on_duty);
    }
  }, [staffProfile?.is_on_duty]);

  // Synchronize duty status changes across windows and tabs
  useEffect(() => {
    const handleDutyChange = (e: any) => {
      if (e.detail?.staff_profile?.is_on_duty !== undefined) {
        setIsOnDuty(e.detail.staff_profile.is_on_duty);
      }
    };
    window.addEventListener('hms_staff_duty_changed', handleDutyChange);
    return () => window.removeEventListener('hms_staff_duty_changed', handleDutyChange);
  }, []);

  const handleToggleDuty = async () => {
    if (isTogglingDuty || !staffProfile) return;
    setIsTogglingDuty(true);
    const nextStatus = !isOnDuty;
    try {
      const updatedStatus = await updateDutyStatus(nextStatus);
      setIsOnDuty(updatedStatus);
    } catch (err: any) {
      console.error('Failed to toggle staff duty status:', err);
    } finally {
      setIsTogglingDuty(false);
    }
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileDrawerOpen(false);
    setShowBranchMenu(false);
    setShowNotifications(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  // Lock background scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileDrawerOpen]);

  // Role-based automatic route protection
  useEffect(() => {
    if (!role) return;
    if (role === 'DOCTOR') {
      if (!location.pathname.startsWith('/staff/doctor-workspace') && !location.pathname.startsWith('/staff/voice-translation') && !location.pathname.startsWith('/staff/lounge-tv')) {
        navigate('/staff/doctor-workspace', { replace: true });
      }
    } else if (role === 'SUPER_ADMIN') {
      if (location.pathname === '/staff/dashboard' || location.pathname === '/staff') {
        navigate('/staff/branch-manager', { replace: true });
      }
    } else if (role === 'HOSPITAL_ADMIN') {
      if (location.pathname === '/staff/dashboard' || location.pathname === '/staff') {
        navigate('/staff/reports?tab=FINANCE', { replace: true });
      }
    } else if (role === 'INVENTORY_MANAGER' || role === 'PROCUREMENT_OFFICER') {
      if (location.pathname === '/staff/dashboard' || location.pathname === '/staff' || location.pathname === '/staff/') {
        navigate('/staff/inventory', { replace: true });
      }
    } else if (role === 'INSURANCE_COORDINATOR') {
      if (location.pathname.startsWith('/staff/patients') || location.pathname === '/staff/dashboard' || location.pathname === '/staff' || location.pathname === '/staff/') {
        navigate('/staff/insurance', { replace: true });
      }
    }
  }, [role, location.pathname, navigate]);

  // All 27 Hospital Management Modules organized into 4 logical groups with strict RBAC scoping
  const navGroups: NavGroup[] = [
    {
      title: 'Core Operations',
      translationKey: 'navigation.coreOperations',
      items: [
        { label: '1. Dashboard', translationKey: 'navigation.dashboard', path: '/staff/dashboard', icon: Activity },
        { label: 'Branch Manager', translationKey: 'navigation.branchManager', path: '/staff/branch-manager', icon: Building2, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN'] },
        { label: '2. Patient Management', translationKey: 'navigation.patients', path: '/staff/patients', icon: Users, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'NURSE', 'RECEPTIONIST'] },
        { label: '3. OPD & Appointments', translationKey: 'navigation.appointments', path: '/staff/appointments', icon: Stethoscope, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'NURSE', 'RECEPTIONIST'] },
        { label: '4. Emergency & Casualty', translationKey: 'navigation.emergency', path: '/staff/emergency', icon: Flame, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'NURSE'] },
        { label: '5. IPD & Admissions', translationKey: 'navigation.admissions', path: '/staff/admissions', icon: Bed, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'NURSE', 'RECEPTIONIST'] },
        { label: 'Voice Translation', translationKey: 'navigation.voiceTranslation', path: '/staff/voice-translation', icon: Languages },
      ],
    },
    {
      title: 'Clinical & Diagnostics',
      translationKey: 'navigation.clinicalDiagnostics',
      items: [
        { label: 'Doctor Clinical Workspace', translationKey: 'navigation.doctorWorkspace', path: '/staff/doctor-workspace', icon: Stethoscope, roles: ['SUPER_ADMIN', 'DOCTOR', 'MEDICAL_DIRECTOR', 'DEPARTMENT_HEAD'] },
        { label: '6. Doctors & Nursing', translationKey: 'navigation.doctorsNursing', path: '/staff/doctors-nursing', icon: UserCheck, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'NURSE', 'MEDICAL_DIRECTOR'] },
        { label: '7. Laboratory & Diagnostics', translationKey: 'navigation.laboratory', path: '/staff/laboratory', icon: Layers, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'LAB_TECHNICIAN', 'PATHOLOGIST'] },
        { label: '8. Radiology & Imaging', translationKey: 'navigation.radiology', path: '/staff/radiology', icon: Radio, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'RADIOLOGY_TECHNICIAN', 'RADIOLOGIST'] },
        { label: '9. Pharmacy Formulary', translationKey: 'navigation.pharmacy', path: '/staff/pharmacy', icon: Pill, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'PHARMACIST'] },
        { label: '10. Inventory & Procurement', translationKey: 'navigation.inventory', path: '/staff/inventory', icon: ShoppingBag, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'INVENTORY_MANAGER', 'PROCUREMENT_OFFICER'] },
        { label: '11. OT & ICU Surgical Suite', translationKey: 'navigation.surgeryIcu', path: '/staff/surgery-icu', icon: Scissors, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'NURSE'] },
      ],
    },
    {
      title: 'Financial Management',
      translationKey: 'navigation.financialManagement',
      items: [
        { label: '12. Billing & Cashier', translationKey: 'navigation.billing', path: '/staff/billing', icon: DollarSign, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'BILLING_EXECUTIVE'] },
        { label: '13. Insurance & TPA Claims', translationKey: 'navigation.insurance', path: '/staff/insurance', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'INSURANCE_COORDINATOR', 'BILLING_EXECUTIVE'] },
        { label: '14. Financial Accounts', translationKey: 'navigation.financialAccounts', path: '/staff/financial-accounts', icon: Landmark, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER'] },
        { label: '15. Financial Transactions', translationKey: 'navigation.transactions', path: '/staff/transactions', icon: Receipt, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER'] },
        { label: '16. Investment Registers', translationKey: 'navigation.investments', path: '/staff/investments', icon: TrendingUp, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'INVESTMENT_MANAGER'] },
        { label: '17. Banking & Reconciliation', translationKey: 'navigation.banking', path: '/staff/banking', icon: Building2, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER'] },
        { label: '18. Loans & Liabilities', translationKey: 'navigation.loans', path: '/staff/loans', icon: Landmark, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER'] },
        { label: '19. Accounting & General Ledger', translationKey: 'navigation.generalLedger', path: '/staff/general-ledger', icon: Scale, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER'] },
        { label: '20. Budgeting & Cash Flow', translationKey: 'navigation.budgeting', path: '/staff/budgeting', icon: Target, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER'] },
        { label: '21. Profit & Loss Statement', translationKey: 'navigation.profitLoss', path: '/staff/profit-loss', icon: FileText, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER'] },
      ],
    },
    {
      title: 'Governance & Administration',
      translationKey: 'navigation.governanceAdmin',
      items: [
        { label: '22. HR & Staff Payroll', translationKey: 'navigation.hrPayroll', path: '/staff/hr-payroll', icon: Clock, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'HR_MANAGER', 'FINANCE_MANAGER'] },
        { label: '23. Equipment & Assets', translationKey: 'navigation.assets', path: '/staff/assets', icon: Wrench, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'NURSE'] },
        { label: '24. Patient Portal Gateway', translationKey: 'navigation.patientPortal', path: '/staff/patient-portal', icon: ExternalLink, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'NURSE', 'RECEPTIONIST'] },
        { label: '25. Reports & Analytics', translationKey: 'navigation.reports', path: '/staff/reports', icon: BarChart3, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'MEDICAL_DIRECTOR', 'FINANCE_MANAGER', 'NURSE', 'PHARMACIST', 'LAB_TECHNICIAN'] },
        { label: '26. Users, Roles & RBAC', translationKey: 'navigation.usersRoles', path: '/staff/users-roles', icon: ShieldAlert, roles: ['SUPER_ADMIN'] },
        { label: '27. Settings & Audit Trail', translationKey: 'navigation.settingsAudit', path: '/staff/settings-audit', icon: Settings, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER'] },
      ],
    },
  ];

  // Dedicated 14-Section Navigation Group strictly for Branch Manager role
  const branchManagerNavGroup: NavGroup = {
    title: 'Branch Operations',
    translationKey: 'navigation.branchManager',
    items: [
      { label: '1. Dashboard Overview', translationKey: 'navigation.dashboardOverview', path: '/staff/branch-manager?tab=overview', icon: Activity },
      { label: '2. Patient Management', translationKey: 'navigation.patientManagement', path: '/staff/branch-manager?tab=patients', icon: Users },
      { label: '3. Department Management', translationKey: 'navigation.departmentManagement', path: '/staff/branch-manager?tab=departments', icon: Building2 },
      { label: '4. Staff Management', translationKey: 'navigation.staffManagement', path: '/staff/branch-manager?tab=staff', icon: UserCheck },
      { label: '5. Bed Management', translationKey: 'navigation.bedManagement', path: '/staff/branch-manager?tab=beds', icon: Bed },
      { label: '6. Financial Management', translationKey: 'navigation.financialManagement', path: '/staff/branch-manager?tab=finances', icon: DollarSign },
      { label: '7. Pharmacy and Inventory', translationKey: 'navigation.pharmacyInventory', path: '/staff/branch-manager?tab=pharmacy_inventory', icon: Pill },
      { label: '8. Laboratory and Diagnostics', translationKey: 'navigation.laboratoryDiagnostics', path: '/staff/branch-manager?tab=diagnostics', icon: Layers },
      { label: '9. Complaints Management', translationKey: 'navigation.complaintsManagement', path: '/staff/branch-manager?tab=complaints', icon: ShieldAlert },
      { label: '10. Maintenance Management', translationKey: 'navigation.maintenanceManagement', path: '/staff/branch-manager?tab=maintenance', icon: Wrench },
      { label: '11. Insurance and Corporate Billing', translationKey: 'navigation.insuranceBilling', path: '/staff/branch-manager?tab=insurance', icon: ShieldCheck },
      { label: '12. Reports and Analytics', translationKey: 'navigation.reportsAnalytics', path: '/staff/branch-manager?tab=reports', icon: BarChart3 },
      { label: '13. Audit and Compliance', translationKey: 'navigation.auditCompliance', path: '/staff/branch-manager?tab=audit_compliance', icon: Scale },
      { label: '14. Notifications', translationKey: 'navigation.notifications', path: '/staff/branch-manager?tab=notifications', icon: Bell },
    ],
  };

  // Dedicated Navigation Group strictly for Department Head role with clean, professional names
  const departmentHeadNavGroup: NavGroup = {
    title: 'Department Operations',
    translationKey: 'navigation.departmentHeadOperations',
    items: [
      { label: 'Overview', translationKey: 'navigation.dashboardOverview', path: '/staff/department-head?tab=overview', icon: Activity },
      { label: 'Department Profile', translationKey: 'navigation.deptProfile', path: '/staff/department-head?tab=dept_overview', icon: Building2 },
      { label: 'Staff Directory', translationKey: 'navigation.deptStaff', path: '/staff/department-head?tab=staff', icon: Users },
      { label: 'Shift & Duty Rosters', translationKey: 'navigation.shiftRoster', path: '/staff/department-head?tab=roster', icon: Clock },
      { label: 'Attendance Monitoring', translationKey: 'navigation.attendanceMonitoring', path: '/staff/department-head?tab=attendance', icon: UserCheck },
      { label: 'Leave Coverage', translationKey: 'navigation.leaveRecommendations', path: '/staff/department-head?tab=leaves', icon: Calendar },
      { label: 'Staffing Requisitions', translationKey: 'navigation.staffRequirements', path: '/staff/department-head?tab=staff_requests', icon: Briefcase },
      { label: 'Workload Telemetry', translationKey: 'navigation.workloadManagement', path: '/staff/department-head?tab=workload', icon: Layers },
      { label: 'Biomedical Equipment', translationKey: 'navigation.resourceMonitoring', path: '/staff/department-head?tab=resources', icon: Wrench },
      { label: 'Department Performance', translationKey: 'navigation.departmentPerformance', path: '/staff/department-head?tab=performance', icon: TrendingUp },
      { label: 'Operational Issues', translationKey: 'navigation.operationalIssues', path: '/staff/department-head?tab=issues', icon: AlertOctagon },
      { label: 'Reports & Analytics', translationKey: 'navigation.departmentReports', path: '/staff/department-head?tab=reports', icon: FileText },
      { label: 'Alerts & Notices', translationKey: 'navigation.deptAlerts', path: '/staff/department-head?tab=notifications', icon: Bell },
    ],
  };

  // Dedicated Doctor Navigation Group: Doctor Clinical Workspace and Voice Translation ONLY
  const doctorNavGroup: NavGroup = {
    title: 'Clinical Practice',
    translationKey: 'navigation.doctorClinicalSuite',
    items: [
      {
        label: 'Doctor Clinical Workspace',
        translationKey: 'navigation.doctorWorkspace',
        path: '/staff/doctor-workspace',
        icon: Stethoscope,
      },
      {
        label: 'Voice Translation',
        translationKey: 'navigation.voiceTranslation',
        path: '/staff/voice-translation',
        icon: Languages,
      },
    ],
  };

  // Single Doctor Workspace navigation item if Department Head is also a Doctor
  const doctorWorkspaceNavGroup: NavGroup = {
    title: 'Clinical Practice',
    translationKey: 'navigation.clinicalPractice',
    items: [
      { label: 'Doctor Clinical Workspace', translationKey: 'navigation.doctorWorkspace', path: '/staff/doctor-workspace', icon: Stethoscope },
    ],
  };

  // Dedicated Navigation Group strictly for HR Manager role with clean, professional names
  const hrManagerNavGroup: NavGroup = {
    title: 'Human Resources',
    translationKey: 'navigation.hrManagement',
    items: [
      { label: 'Overview', translationKey: 'navigation.hrOverview', path: '/staff/hr-management?tab=overview', icon: Activity },
      { label: 'Employee Directory', translationKey: 'navigation.employeeDirectory', path: '/staff/hr-management?tab=employees', icon: Users },
      { label: 'Recruitment & Hiring', translationKey: 'navigation.recruitmentHiring', path: '/staff/hr-management?tab=recruitment', icon: Briefcase },
      { label: 'Onboarding', translationKey: 'navigation.onboarding', path: '/staff/hr-management?tab=onboarding', icon: CheckSquare },
      { label: 'Attendance', translationKey: 'navigation.attendance', path: '/staff/hr-management?tab=attendance', icon: Clock },
      { label: 'Leave Management', translationKey: 'navigation.leaveManagement', path: '/staff/hr-management?tab=leaves', icon: Calendar },
      { label: 'Payroll & Salary', translationKey: 'navigation.payrollSalary', path: '/staff/hr-management?tab=payroll', icon: DollarSign },
      { label: 'Performance Appraisals', translationKey: 'navigation.performanceAppraisals', path: '/staff/hr-management?tab=appraisals', icon: Award },
      { label: 'Training & Development', translationKey: 'navigation.trainingDevelopment', path: '/staff/hr-management?tab=training', icon: GraduationCap },
      { label: 'Grievance Redressal', translationKey: 'navigation.grievanceRedressal', path: '/staff/hr-management?tab=grievances', icon: AlertOctagon },
      { label: 'Credentials & Compliance', translationKey: 'navigation.credentialsCompliance', path: '/staff/hr-management?tab=documents', icon: FileCheck },
      { label: 'Exit & Offboarding', translationKey: 'navigation.exitOffboarding', path: '/staff/hr-management?tab=exits', icon: UserMinus },
      { label: 'Reports & Analytics', translationKey: 'navigation.reportsAnalytics', path: '/staff/hr-management?tab=reports', icon: FileText },
      { label: 'Notifications', translationKey: 'navigation.notifications', path: '/staff/hr-management?tab=notifications', icon: Bell },
    ],
  };

  // Unified Financial Leadership & Operational Accounting Navigation for Finance Manager (Consolidated Role)
  const financeManagerNavGroups: NavGroup[] = [
    {
      title: 'Financial Health & General Ledger',
      translationKey: 'navigation.financialHealthGeneralLedger',
      items: [
        { label: 'Executive Financial Summary (P&L)', translationKey: 'navigation.profitLoss', path: '/staff/profit-loss', icon: FileText },
        { label: 'General Ledger & Journal Entries', translationKey: 'navigation.generalLedger', path: '/staff/general-ledger', icon: Scale },
        { label: 'Chart of Accounts Register', translationKey: 'navigation.financialAccounts', path: '/staff/financial-accounts', icon: Layers },
        { label: 'Budgets & Cash Flow Planning', translationKey: 'navigation.budgeting', path: '/staff/budgeting', icon: Target },
        { label: 'MCA Audit & Statutory Reports', translationKey: 'navigation.reports', path: '/staff/reports', icon: BarChart3 },
      ],
    },
    {
      title: 'Treasury & Liabilities',
      translationKey: 'navigation.treasuryLiabilities',
      items: [
        { label: 'Bank Accounts & Reconciliation', translationKey: 'navigation.banking', path: '/staff/banking', icon: Building2 },
        { label: 'Debt & Term Liabilities', translationKey: 'navigation.loans', path: '/staff/loans', icon: Landmark },
      ],
    },
    {
      title: 'Payroll Controls',
      translationKey: 'navigation.payrollControls',
      items: [
        { label: 'Monthly Payroll Disbursement', translationKey: 'navigation.hrPayroll', path: '/staff/hr-payroll', icon: Clock },
      ],
    },
  ];

  // Dedicated Navigation for Insurance / Cashless Desk
  const insuranceCoordinatorNavGroup: NavGroup = {
    title: 'Cashless & TPA Claims Desk',
    translationKey: 'navigation.cashlessTpaDesk',
    items: [
      { label: 'Cashless & TPA Claims Desk', translationKey: 'navigation.insurance', path: '/staff/insurance', icon: ShieldCheck },
      { label: 'TPA Claims & Settlement Reports', translationKey: 'navigation.reports', path: '/staff/reports', icon: BarChart3 },
    ],
  };

  // Dedicated Navigation for Inventory Manager
  const inventoryManagerNavGroup: NavGroup = {
    title: 'Materials & Inventory Operations',
    translationKey: 'navigation.inventoryOperations',
    items: [
      { label: 'Inventory & Stock Control', translationKey: 'navigation.inventory', path: '/staff/inventory', icon: ShoppingBag },
      { label: 'Hospital Assets & Equipment', translationKey: 'navigation.assets', path: '/staff/assets', icon: Wrench },
      { label: 'Stock & Materials Reports', translationKey: 'navigation.reports', path: '/staff/reports', icon: BarChart3 },
    ],
  };

  // Dedicated Navigation for Procurement & Vendor Operations
  const procurementOfficerNavGroup: NavGroup = {
    title: 'Procurement & Vendor Operations',
    translationKey: 'navigation.procurementOperations',
    items: [
      { label: 'Purchase Orders & Vendor Sourcing', translationKey: 'navigation.inventory', path: '/staff/inventory', icon: ShoppingBag },
      { label: 'Asset Procurement & Capital Goods', translationKey: 'navigation.assets', path: '/staff/assets', icon: Wrench },
      { label: 'Procurement & PO Reports', translationKey: 'navigation.reports', path: '/staff/reports', icon: BarChart3 },
    ],
  };

  // Unified Navigation for Billing & Cashier Executive (Single Consolidated Account)
  const billingCashierNavGroup: NavGroup = {
    title: 'Billing & Cash Desk Operations',
    translationKey: 'navigation.billingCashierDesk',
    items: [
      { label: 'Patient Invoicing & Discharge Billing', translationKey: 'navigation.billingInvoices', path: '/staff/billing?tab=invoices', icon: FileText },
      { label: 'Payment Collection & Receipts', translationKey: 'navigation.cashierReceipts', path: '/staff/billing?tab=receipts', icon: Receipt },
      { label: 'Advance Deposits & Refunds', translationKey: 'navigation.cashierDeposits', path: '/staff/billing?tab=deposits', icon: Wallet },
      { label: 'Daily Cash Drawer & Shifts', translationKey: 'navigation.cashierShifts', path: '/staff/billing?tab=cashier_shifts', icon: Clock },
      { label: 'Tariff Plans & Service Catalogue', translationKey: 'navigation.billingTariffs', path: '/staff/billing?tab=tariffs', icon: Tag },
      { label: 'Patient Directory Lookup', translationKey: 'navigation.patients', path: '/staff/patients', icon: Users },
      { label: 'Daily Collection & Billing Reports', translationKey: 'navigation.reports', path: '/staff/reports', icon: BarChart3 },
    ],
  };

  // Dedicated Ultra-Clean 2-Section Navigation strictly for Super Admin (Admin of all hospital branches)
  const superAdminNavGroup: NavGroup = {
    title: 'Enterprise Administration',
    translationKey: 'navigation.enterpriseAdmin',
    items: [
      {
        label: 'Hospital Branches & Operations',
        translationKey: 'navigation.branchManager',
        path: '/staff/branch-manager',
        icon: Building2,
      },
      {
        label: 'System Access & Security Governance',
        translationKey: 'navigation.usersRoles',
        path: '/staff/users-roles',
        icon: ShieldAlert,
      },
    ],
  };

  // Dedicated Multi-Branch Navigation strictly for Hospital Administrator (Finances & Staff Details in detail)
  const hospitalAdminNavGroup: NavGroup = {
    title: 'Hospital Administration',
    translationKey: 'navigation.hospitalAdminNetwork',
    items: [
      {
        label: 'Financial Reports & Analytics',
        translationKey: 'navigation.reportsFinance',
        path: '/staff/reports?tab=FINANCE',
        icon: DollarSign,
      },
      {
        label: 'Staff Details & Directory',
        translationKey: 'navigation.staffManagement',
        path: '/staff/branch-manager?tab=staff',
        icon: Users,
      },
    ],
  };

  // Strict role-specific navigation isolation
  let visibleNavGroups: NavGroup[] = [];

  if (role === 'SUPER_ADMIN') {
    visibleNavGroups = [superAdminNavGroup];
  } else if (role === 'HOSPITAL_ADMIN') {
    visibleNavGroups = [hospitalAdminNavGroup];
  } else if (role === 'BRANCH_MANAGER') {
    visibleNavGroups = [branchManagerNavGroup];
  } else if (role === 'DOCTOR') {
    visibleNavGroups = [doctorNavGroup];
  } else if (role === 'DEPARTMENT_HEAD') {
    const isDoctorHead = Boolean(
      staffProfile?.medical_license_number ||
      staffProfile?.specialization ||
      staffProfile?.designation?.toLowerCase().includes('doctor') ||
      staffProfile?.designation?.toLowerCase().includes('physician') ||
      staffProfile?.designation?.toLowerCase().includes('surgeon') ||
      staffProfile?.designation?.toLowerCase().includes('consultant')
    );
    visibleNavGroups = isDoctorHead
      ? [departmentHeadNavGroup, doctorWorkspaceNavGroup]
      : [departmentHeadNavGroup];
  } else if (role === 'HR_MANAGER') {
    visibleNavGroups = [hrManagerNavGroup];
  } else if (role === 'FINANCE_MANAGER' || role === 'ACCOUNTANT') {
    visibleNavGroups = financeManagerNavGroups;
  } else if (role === 'INVENTORY_MANAGER') {
    visibleNavGroups = [inventoryManagerNavGroup];
  } else if (role === 'PROCUREMENT_OFFICER') {
    visibleNavGroups = [procurementOfficerNavGroup];
  } else if (role === 'INSURANCE_COORDINATOR') {
    visibleNavGroups = [insuranceCoordinatorNavGroup];
  } else if (role === 'BILLING_EXECUTIVE' || role === 'CASHIER') {
    visibleNavGroups = [billingCashierNavGroup];
  } else if (role === 'AUDITOR') {
    visibleNavGroups = [
      {
        title: 'Statutory Audit & Compliance',
        translationKey: 'navigation.statutoryAudit',
        items: [
          { label: 'MCA Audit Trail & Compliance Logs', translationKey: 'navigation.settingsAudit', path: '/staff/settings-audit', icon: Settings },
          { label: 'Statutory Audit Reports', translationKey: 'navigation.reports', path: '/staff/reports', icon: BarChart3 },
        ],
      }
    ];
  } else {
    visibleNavGroups = navGroups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!role) return false;
        if (item.roles && !item.roles.includes(role)) return false;
        return canAccessRoute(role, item.path);
      })
    })).filter(group => group.items.length > 0);
  }

  const totalAuthorizedSections = visibleNavGroups.reduce((sum, g) => sum + g.items.length, 0);
  const isMultiBranchRole = role ? ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'INVESTMENT_MANAGER'].includes(role) : false;
  const isReadOnlySupervisory = role ? STRICT_READ_ONLY_ROLES.includes(role) : false;
  const dataScope = role ? ROLE_DATA_SCOPES[role] || 'OWN' : 'OWN';

  const handleSignOut = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative">
      {/* Mobile Backdrop Overlay */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200"
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Drawer on mobile, Collapsible on desktop) */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col',
          // Mobile state: off-canvas drawer
          isMobileDrawerOpen ? 'translate-x-0 w-72 max-w-[85vw]' : '-translate-x-full lg:translate-x-0',
          // Desktop state: collapsible sidebar
          isSidebarOpen ? 'lg:w-64' : 'lg:w-20'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
          <Link
            to={
              role === 'SUPER_ADMIN' || role === 'BRANCH_MANAGER'
                ? '/staff/branch-manager'
                : role === 'HOSPITAL_ADMIN'
                ? '/staff/reports?tab=FINANCE'
                : role === 'DOCTOR'
                ? '/staff/doctor-workspace'
                : role === 'DEPARTMENT_HEAD'
                ? '/staff/department-head'
                : role === 'HR_MANAGER'
                ? '/staff/hr-management'
                : role === 'FINANCE_MANAGER' || role === 'ACCOUNTANT'
                ? '/staff/profit-loss'
                : role === 'INSURANCE_COORDINATOR'
                ? '/staff/insurance'
                : role === 'BILLING_EXECUTIVE' || role === 'CASHIER'
                ? '/staff/billing?tab=invoices'
                : role === 'AUDITOR'
                ? '/staff/settings-audit'
                : role === 'LAB_TECHNICIAN'
                ? '/staff/laboratory'
                : role === 'PHARMACIST'
                ? '/staff/pharmacy'
                : role === 'INVENTORY_MANAGER' || role === 'PROCUREMENT_OFFICER'
                ? '/staff/inventory'
                : '/staff/dashboard'
            }
            onClick={() => setIsMobileDrawerOpen(false)}
            className="flex items-center gap-3 overflow-hidden"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-500 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow-lg shadow-cyan-500/20">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            {(isSidebarOpen || isMobileDrawerOpen) && (
              <div className="leading-tight">
                <span className="font-extrabold tracking-tight text-white block">AURA HMS</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-cyan-400">
                  Hospital Suite
                </span>
              </div>
            )}
          </Link>

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsMobileDrawerOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition lg:hidden"
            title="Close Menu"
            aria-label="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition hidden lg:block"
            title="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Role & Section Assignment Badge */}
        {(isSidebarOpen || isMobileDrawerOpen) && role && (
          <div className="mx-3 mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-cyan-500/25 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 truncate">
                {role === 'BILLING_EXECUTIVE' || role === 'CASHIER'
                  ? 'Billing & Cashier Executive'
                  : role === 'ACCOUNTANT'
                  ? 'Finance Manager'
                  : role.replace(/_/g, ' ')}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 text-[9px] font-mono font-bold shrink-0">
                {dataScope} SCOPE
              </span>
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
              <span>Assigned Sections: <strong className="text-white">{totalAuthorizedSections}</strong></span>
              <span className={isReadOnlySupervisory ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                {isReadOnlySupervisory ? 'Read-Only' : 'Authorized'}
              </span>
            </div>
          </div>
        )}

        {/* Navigation Groups */}
        <div className="flex-1 py-3 px-3 overflow-y-auto space-y-5 custom-scrollbar">
          {visibleNavGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {(isSidebarOpen || isMobileDrawerOpen) && (
                <div className="px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  {group.translationKey ? t(group.translationKey) : group.title}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const currentFull = location.pathname + location.search;
                const isActive = item.path.includes('?')
                  ? (currentFull === item.path || (location.pathname === '/staff/branch-manager' && item.path.endsWith('?tab=overview') && !location.search))
                  : (location.pathname === item.path || (item.path !== '/staff/dashboard' && location.pathname.startsWith(item.path + '/')));
                const displayLabel = item.translationKey ? t(item.translationKey) : item.label;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group relative',
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/10 text-cyan-400 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    )}
                  >
                    <Icon
                      className={clsx(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'
                      )}
                    />
                    {(isSidebarOpen || isMobileDrawerOpen) && (
                      <span className="truncate">{displayLabel}</span>
                    )}

                    {/* Tooltip when collapsed on desktop */}
                    {!isSidebarOpen && !isMobileDrawerOpen && (
                      <div className="absolute left-full ml-2 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition z-50 shadow-xl hidden lg:block">
                        {displayLabel}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Clinician Duty Status Badge */}
        {(isSidebarOpen || isMobileDrawerOpen) && (
          <div className="p-3 border-t border-slate-800 bg-slate-950/40 m-3 rounded-xl border shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-400">{t('common.clinicalShift', 'Clinical Shift')}</span>
              <button
                onClick={handleToggleDuty}
                disabled={isTogglingDuty || !staffProfile}
                title={isOnDuty ? 'Click to set clinical shift to Off Duty' : 'Click to set clinical shift to On Duty'}
                className={clsx(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition flex items-center gap-1.5',
                  isOnDuty
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20',
                  (isTogglingDuty || !staffProfile) && 'opacity-60 cursor-not-allowed'
                )}
              >
                <span className={clsx('w-1.5 h-1.5 rounded-full', isOnDuty ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400')} />
                {isTogglingDuty ? '...' : (isOnDuty ? t('auth.onDuty', 'On Duty') : t('auth.offDuty', 'Off Duty'))}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              {t('common.staff', 'Staff')}: {staffProfile?.employee_id || 'DOC-9901'}
            </p>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div
        className={clsx(
          'flex-1 flex flex-col min-w-0 transition-all duration-300 w-full',
          'pl-0', // default mobile
          isSidebarOpen ? 'lg:pl-64' : 'lg:pl-20' // desktop offset
        )}
      >
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6 shrink-0">
          {/* Left: Mobile Drawer Trigger + Branch Switcher */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-2 -ml-1 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 lg:hidden flex items-center justify-center shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Branch Switcher / Locked Branch Badge */}
            <div className="relative">
              <button
                onClick={() => isMultiBranchRole && setShowBranchMenu(!showBranchMenu)}
                className={clsx(
                  'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 transition max-w-[190px] sm:max-w-xs',
                  isMultiBranchRole ? 'hover:border-cyan-500/40 cursor-pointer' : 'cursor-default opacity-90'
                )}
                title={isMultiBranchRole ? 'Switch Hospital Branch' : `Assigned Branch (${dataScope} Scope)`}
              >
                <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="font-semibold text-white truncate text-xs">
                  {currentBranch?.name || staffProfile?.branch_name || 'AURA Central Multi-Specialty'}
                </span>
                {isMultiBranchRole ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono shrink-0">
                    {dataScope}
                  </span>
                )}
              </button>

              {isMultiBranchRole && showBranchMenu && (
                <div className="absolute top-full left-0 mt-2 w-72 max-w-[90vw] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    {t('common.switchBranch')}
                  </div>
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => {
                        switchBranch(b.id);
                        setShowBranchMenu(false);
                      }}
                      className={clsx(
                        'w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition',
                        b.id === currentBranch?.id
                          ? 'bg-cyan-500/10 text-cyan-400 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      )}
                    >
                      <div className="truncate mr-2">
                        <div className="text-white text-xs font-medium truncate">{b.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{b.city}, {b.state}</div>
                      </div>
                      {b.is_main_branch && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono shrink-0">
                          {t('common.hq')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Shift Indicator (Tablet and Desktop) */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-300 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{t('common.clinicalShift', 'Shift')}: <strong>{t('common.liveClinicalRoster', 'Live Clinical Roster')}</strong></span>
            </div>
          </div>

          {/* Right: Language Selector, Notifications & Clinician Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Global Language Selector */}
            <LanguageSelector variant="compact" />

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition relative"
                title={t('common.notifications', 'Notifications')}
                aria-label={t('common.notifications', 'Notifications')}
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 max-w-[90vw] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-3 z-50">
                  <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white">{t('common.liveClinicalAlerts', 'Live Clinical Alerts')}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      notifications.length > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {notifications.length} {notifications.length === 1 ? t('common.alert', 'Alert') : t('common.alerts', 'Alerts')}
                    </span>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="py-6 px-4 text-center">
                      <Bell className="w-6 h-6 mx-auto mb-2 text-slate-500/40" />
                      <p className="text-xs font-medium text-slate-300">{t('common.noAlerts', 'No Active Alerts')}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{t('common.alertsNormal', 'All department logs and critical orders are normal.')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs hover:border-slate-700 transition"
                        >
                          <div className="flex items-center justify-between font-semibold text-white mb-0.5">
                            <span>{n.title}</span>
                            <span className="text-[10px] text-slate-500 font-normal">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug">{n.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 sm:pl-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 transition border border-slate-700/60"
              >
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                  {userProfile?.first_name ? userProfile.first_name[0] : 'S'}
                </div>
                <div className="text-left hidden sm:block max-w-[120px] md:max-w-[160px] truncate">
                  <div className="text-xs font-semibold text-white leading-tight truncate">
                    {userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name}` : t('auth.staffMember', 'Staff Member')}
                  </div>
                  <div className="text-[10px] text-cyan-400 font-medium leading-tight truncate">
                    {role || t('auth.staffSpecialist', 'Staff Specialist')}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {showUserMenu && (
                <div className="absolute top-full right-0 mt-2 w-56 sm:w-64 max-w-[90vw] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <p className="text-xs font-bold text-white truncate">
                      {userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name}` : t('auth.staffMember', 'Staff Member')}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{userProfile?.email}</p>
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20">
                      {t('auth.role', 'Role')}: {role || 'Staff'}
                    </span>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t('auth.signOut', 'Sign Out')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Breadcrumbs */}
        <div className="px-3 sm:px-6 pt-3 flex items-center gap-2 text-xs text-slate-500 shrink-0 overflow-x-auto whitespace-nowrap custom-scrollbar">
          <Link
            to={
              role === 'SUPER_ADMIN' || role === 'BRANCH_MANAGER'
                ? '/staff/branch-manager'
                : role === 'HOSPITAL_ADMIN'
                ? '/staff/reports?tab=FINANCE'
                : role === 'DOCTOR'
                ? '/staff/doctor-workspace'
                : role === 'DEPARTMENT_HEAD'
                ? '/staff/department-head'
                : role === 'HR_MANAGER'
                ? '/staff/hr-management'
                : role === 'FINANCE_MANAGER' || role === 'ACCOUNTANT'
                ? '/staff/profit-loss'
                : role === 'INSURANCE_COORDINATOR'
                ? '/staff/insurance'
                : role === 'BILLING_EXECUTIVE' || role === 'CASHIER'
                ? '/staff/billing?tab=invoices'
                : role === 'AUDITOR'
                ? '/staff/settings-audit'
                : role === 'LAB_TECHNICIAN'
                ? '/staff/laboratory'
                : role === 'PHARMACIST'
                ? '/staff/pharmacy'
                : role === 'INVENTORY_MANAGER' || role === 'PROCUREMENT_OFFICER'
                ? '/staff/inventory'
                : '/staff/dashboard'
            }
            className="hover:text-slate-300 transition shrink-0"
          >
            {t('brand.name', 'AURA Multi-Specialty HMS')}
          </Link>
          <span>/</span>
          <span className="text-slate-300 font-medium capitalize truncate">
            {(() => {
              const allItems = [...visibleNavGroups.flatMap((g) => g.items), ...navGroups.flatMap((g) => g.items)];
              const currentNav = allItems.find((i) => i.path === location.pathname);
              return currentNav?.translationKey
                ? t(currentNav.translationKey)
                : location.pathname.split('/').pop()?.replace('-', ' ') || t('navigation.dashboard', 'Dashboard');
            })()}
          </span>
        </div>

        {/* Read-Only Supervisory / Audit Mode Banner */}
        {isReadOnlySupervisory && role !== 'HOSPITAL_ADMIN' && role !== 'SUPER_ADMIN' && (
          <div className="mx-3 sm:mx-6 mt-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>{role === 'AUDITOR' ? 'Compliance Audit Mode (Read-Only):' : 'Branch Supervisory Monitoring Mode (Read-Only):'}</strong>{' '}
                {role === 'AUDITOR'
                  ? 'You have cross-departmental read-only inspection access and can record official audit findings in Settings & Audit Trail.'
                  : 'You have full operational visibility across your assigned branch. Creating, editing, deleting, or approving departmental records is restricted to authorized operational owners.'}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
              Scope: {dataScope} • Read-Only
            </span>
          </div>
        )}

        {/* Page Canvas */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 pb-12 overflow-x-hidden w-full max-w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
