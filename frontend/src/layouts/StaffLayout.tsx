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
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { Badge } from '../components/common/Badge';
import clsx from 'clsx';

interface NavGroup {
  title: string;
  items: {
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    roles?: string[];
    isExternal?: boolean;
  }[];
}

export const StaffLayout: React.FC = () => {
  const { userProfile, staffProfile, role, logout } = useAuth();
  const { branches, currentBranch, switchBranch } = useBranch();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);

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

  // All 27 Hospital Management Modules organized into 4 logical groups with strict RBAC scoping
  const navGroups: NavGroup[] = [
    {
      title: 'Core Operations',
      items: [
        { label: '1. Dashboard', path: '/staff/dashboard', icon: Activity },
        { label: '2. Patient Management', path: '/staff/patients', icon: Users, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] },
        { label: '3. OPD & Appointments', path: '/staff/appointments', icon: Stethoscope, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] },
        { label: '4. Emergency & Casualty', path: '/staff/emergency', icon: Flame, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'NURSE'] },
        { label: '5. IPD & Admissions', path: '/staff/admissions', icon: Bed, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] },
      ],
    },
    {
      title: 'Clinical & Diagnostics',
      items: [
        { label: '6. Doctors & Nursing', path: '/staff/doctors-nursing', icon: UserCheck, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'NURSE', 'MEDICAL_DIRECTOR'] },
        { label: '7. Laboratory & Diagnostics', path: '/staff/laboratory', icon: Layers, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'LAB_TECHNICIAN', 'PATHOLOGIST'] },
        { label: '8. Radiology & Imaging', path: '/staff/radiology', icon: Radio, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'RADIOLOGY_TECHNICIAN', 'RADIOLOGIST'] },
        { label: '9. Pharmacy Formulary', path: '/staff/pharmacy', icon: Pill, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'PHARMACIST'] },
        { label: '10. Inventory & Procurement', path: '/staff/inventory', icon: ShoppingBag, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'PHARMACIST', 'INVENTORY_MANAGER', 'PROCUREMENT_OFFICER'] },
        { label: '11. OT & ICU Surgical Suite', path: '/staff/surgery-icu', icon: Scissors, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'NURSE'] },
      ],
    },
    {
      title: 'Financial Management',
      items: [
        { label: '12. Billing & Cashier', path: '/staff/billing', icon: DollarSign, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT', 'CASHIER', 'BILLING_EXECUTIVE'] },
        { label: '13. Insurance & TPA Claims', path: '/staff/insurance', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'INSURANCE_COORDINATOR', 'BILLING_EXECUTIVE'] },
        { label: '14. Financial Accounts', path: '/staff/financial-accounts', icon: Landmark, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT'] },
        { label: '15. Financial Transactions', path: '/staff/transactions', icon: Receipt, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT'] },
        { label: '16. Investment Registers', path: '/staff/investments', icon: TrendingUp, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'INVESTMENT_MANAGER'] },
        { label: '17. Banking & Reconciliation', path: '/staff/banking', icon: Building2, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT'] },
        { label: '18. Loans & Liabilities', path: '/staff/loans', icon: Landmark, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT'] },
        { label: '19. Accounting & General Ledger', path: '/staff/general-ledger', icon: Scale, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT'] },
        { label: '20. Budgeting & Cash Flow', path: '/staff/budgeting', icon: Target, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT'] },
        { label: '21. Profit & Loss Statement', path: '/staff/profit-loss', icon: FileText, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AUDITOR'] },
      ],
    },
    {
      title: 'Governance & Administration',
      items: [
        { label: '22. HR & Staff Payroll', path: '/staff/hr-payroll', icon: Clock, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'HR_MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT'] },
        { label: '23. Equipment & Assets', path: '/staff/assets', icon: Wrench, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'NURSE'] },
        { label: '24. Patient Portal Gateway', path: '/staff/patient-portal', icon: ExternalLink, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'NURSE', 'RECEPTIONIST'] },
        { label: '25. Reports & Analytics', path: '/staff/reports', icon: BarChart3, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'MEDICAL_DIRECTOR', 'FINANCE_MANAGER', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECHNICIAN', 'ACCOUNTANT'] },
        { label: '26. Users, Roles & RBAC', path: '/staff/users-roles', icon: ShieldAlert, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER'] },
        { label: '27. Settings & Audit Trail', path: '/staff/settings-audit', icon: Settings, roles: ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'AUDITOR'] },
      ],
    },
  ];

  // Filter navigation items by role
  const visibleNavGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (!item.roles || item.roles.length === 0) return true;
      if (!role || role === 'SUPER_ADMIN' || role === 'HOSPITAL_ADMIN') return true;
      return item.roles.includes(role);
    })
  })).filter(group => group.items.length > 0);

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
            to="/staff/dashboard"
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

        {/* Navigation Groups */}
        <div className="flex-1 py-3 px-3 overflow-y-auto space-y-5 custom-scrollbar">
          {visibleNavGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {(isSidebarOpen || isMobileDrawerOpen) && (
                <div className="px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || (item.path !== '/staff/dashboard' && location.pathname.startsWith(item.path + '/'));

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
                      <span className="truncate">{item.label}</span>
                    )}

                    {/* Tooltip when collapsed on desktop */}
                    {!isSidebarOpen && !isMobileDrawerOpen && (
                      <div className="absolute left-full ml-2 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition z-50 shadow-xl hidden lg:block">
                        {item.label}
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
              <span className="text-[11px] font-semibold text-slate-400">Clinical Shift</span>
              <button
                onClick={() => setIsOnDuty(!isOnDuty)}
                className={clsx(
                  'px-2 py-0.5 rounded-full text-[10px] font-semibold transition',
                  isOnDuty
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                )}
              >
                {isOnDuty ? 'On Duty' : 'Off Duty'}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Staff: {staffProfile?.employee_id || 'DOC-9901'}
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

            {/* Branch Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowBranchMenu(!showBranchMenu)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 hover:border-cyan-500/40 transition max-w-[170px] sm:max-w-xs"
              >
                <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="font-semibold text-white truncate text-xs">
                  {currentBranch?.name || 'AURA Central Multi-Specialty'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {showBranchMenu && (
                <div className="absolute top-full left-0 mt-2 w-72 max-w-[90vw] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Switch Hospital Branch
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
                          HQ
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
              <span>Shift: <strong>Live Clinical Roster</strong></span>
            </div>
          </div>

          {/* Right: Notifications & Clinician Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition relative"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 max-w-[90vw] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-3 z-50">
                  <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white">Live Clinical Alerts</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      notifications.length > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {notifications.length} {notifications.length === 1 ? 'Alert' : 'Alerts'}
                    </span>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="py-6 px-4 text-center">
                      <Bell className="w-6 h-6 mx-auto mb-2 text-slate-500/40" />
                      <p className="text-xs font-medium text-slate-300">No Active Alerts</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">All department logs and critical orders are normal.</p>
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
                    {userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name}` : 'Staff Member'}
                  </div>
                  <div className="text-[10px] text-cyan-400 font-medium leading-tight truncate">
                    {role || 'Staff Specialist'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {showUserMenu && (
                <div className="absolute top-full right-0 mt-2 w-56 sm:w-64 max-w-[90vw] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-slate-800 mb-1">
                    <p className="text-xs font-bold text-white truncate">
                      {userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name}` : 'Staff Member'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{userProfile?.email}</p>
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20">
                      Role: {role || 'Staff'}
                    </span>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Breadcrumbs */}
        <div className="px-3 sm:px-6 pt-3 flex items-center gap-2 text-xs text-slate-500 shrink-0 overflow-x-auto whitespace-nowrap custom-scrollbar">
          <Link to="/staff/dashboard" className="hover:text-slate-300 transition shrink-0">HMS Multi-Specialty</Link>
          <span>/</span>
          <span className="text-slate-300 font-medium capitalize truncate">
            {location.pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
          </span>
        </div>

        {/* Page Canvas */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 pb-12 overflow-x-hidden w-full max-w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
