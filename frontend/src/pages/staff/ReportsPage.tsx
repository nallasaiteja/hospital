import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Building,
  Filter,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  TrendingUp,
  Activity,
  Bed,
  DollarSign,
  Package,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PieChart,
  FileText,
  AlertCircle,
  Stethoscope,
  FlaskConical,
  Pill,
  Truck,
  Landmark,
  CreditCard,
  Briefcase
} from 'lucide-react';
import { reportsDashboardService, DashboardFilterParams, DrillDownParams } from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { Modal } from '../../components/common/Modal';
import { parseApiError } from '../../utils/errorHandler';

type DashboardTab = 
  | 'ADMIN'
  | 'CLINICAL'
  | 'PHARMACY'
  | 'DIAGNOSTICS'
  | 'INVENTORY'
  | 'BILLING'
  | 'ACCOUNTING'
  | 'FINANCE'
  | 'INVESTMENTS';

export const ReportsPage: React.FC = () => {
  const { currentBranch, branches } = useBranch();
  const { role, userProfile } = useAuth();

  // Filters State
  const [selectedBranchId, setSelectedBranchId] = useState<string>(currentBranch?.id || '');
  const [datePreset, setDatePreset] = useState<'TODAY' | 'MONTH' | 'ALL'>('TODAY');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    if (role === 'DOCTOR' || role === 'NURSE') return 'CLINICAL';
    if (role === 'PHARMACIST') return 'PHARMACY';
    if (role === 'LAB_TECHNICIAN' || role === 'RADIOLOGY_TECHNICIAN') return 'DIAGNOSTICS';
    if (role === 'ACCOUNTANT') return 'ACCOUNTING';
    return 'ADMIN';
  });

  // Data & Loading States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [adminData, setAdminData] = useState<any>(null);
  const [financeData, setFinanceData] = useState<any>(null);
  const [clinicalData, setClinicalData] = useState<any>(null);
  const [pharmacyData, setPharmacyData] = useState<any>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);
  const [inventoryData, setInventoryData] = useState<any>(null);
  const [billingData, setBillingData] = useState<any>(null);
  const [accountingData, setAccountingData] = useState<any>(null);
  const [investmentsData, setInvestmentsData] = useState<any>(null);

  // Drill-Down Modal State
  const [isDrillDownOpen, setIsDrillDownOpen] = useState<boolean>(false);
  const [drillDownMetric, setDrillDownMetric] = useState<string>('');
  const [drillDownTitle, setDrillDownTitle] = useState<string>('');
  const [drillDownLoading, setDrillDownLoading] = useState<boolean>(false);
  const [drillDownRecords, setDrillDownRecords] = useState<any[]>([]);
  const [drillDownTotal, setDrillDownTotal] = useState<number>(0);
  const [drillDownPage, setDrillDownPage] = useState<number>(1);
  const [drillDownTotalPages, setDrillDownTotalPages] = useState<number>(1);
  const [drillDownSearch, setDrillDownSearch] = useState<string>('');

  // Set default dates on preset change
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (datePreset === 'TODAY') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (datePreset === 'MONTH') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(todayStr);
    } else if (datePreset === 'ALL') {
      setFromDate('');
      setToDate('');
    }
  }, [datePreset]);

  // Keep branch in sync
  useEffect(() => {
    if (currentBranch?.id && !selectedBranchId) {
      setSelectedBranchId(currentBranch.id);
    }
  }, [currentBranch]);

  // Role-based visible tabs calculation
  const accessibleTabs = useMemo(() => {
    const userRole = (role || '').toUpperCase();
    const isSuper = userRole === 'SUPER_ADMIN' || userRole === 'HOSPITAL_ADMIN';

    const tabs: { key: DashboardTab; label: string; icon: any }[] = [];

    if (isSuper) {
      tabs.push({ key: 'ADMIN', label: 'Executive Admin', icon: Landmark });
      tabs.push({ key: 'FINANCE', label: 'Finance & Treasury', icon: DollarSign });
      tabs.push({ key: 'CLINICAL', label: 'Clinical & IPD', icon: Stethoscope });
      tabs.push({ key: 'PHARMACY', label: 'Pharmacy Formulary', icon: Pill });
      tabs.push({ key: 'DIAGNOSTICS', label: 'Diagnostics & Lab', icon: FlaskConical });
      tabs.push({ key: 'INVENTORY', label: 'Procurement & Inventory', icon: Truck });
      tabs.push({ key: 'BILLING', label: 'Billing & Cashier', icon: CreditCard });
      tabs.push({ key: 'ACCOUNTING', label: 'General Ledger', icon: FileSpreadsheet });
      tabs.push({ key: 'INVESTMENTS', label: 'Investments', icon: Briefcase });
      return tabs;
    }

    if (userRole === 'DOCTOR' || userRole === 'NURSE') {
      tabs.push({ key: 'CLINICAL', label: 'Clinical & IPD', icon: Stethoscope });
      tabs.push({ key: 'DIAGNOSTICS', label: 'Diagnostics & Lab', icon: FlaskConical });
      tabs.push({ key: 'PHARMACY', label: 'Pharmacy Formulary', icon: Pill });
    } else if (userRole === 'PHARMACIST') {
      tabs.push({ key: 'PHARMACY', label: 'Pharmacy Formulary', icon: Pill });
      tabs.push({ key: 'INVENTORY', label: 'Inventory & Stock', icon: Truck });
    } else if (['LAB_TECHNICIAN', 'RADIOLOGIST', 'PATHOLOGIST'].includes(userRole)) {
      tabs.push({ key: 'DIAGNOSTICS', label: 'Diagnostics & Lab', icon: FlaskConical });
    } else if (userRole === 'INVENTORY_MANAGER') {
      tabs.push({ key: 'INVENTORY', label: 'Procurement & Inventory', icon: Truck });
      tabs.push({ key: 'PHARMACY', label: 'Pharmacy Formulary', icon: Pill });
    } else if (userRole === 'BILLING_EXECUTIVE') {
      tabs.push({ key: 'BILLING', label: 'Billing & Cashier', icon: CreditCard });
    } else if (userRole === 'ACCOUNTANT') {
      tabs.push({ key: 'ACCOUNTING', label: 'General Ledger', icon: FileSpreadsheet });
      tabs.push({ key: 'BILLING', label: 'Billing & Cashier', icon: CreditCard });
      tabs.push({ key: 'FINANCE', label: 'Finance & Treasury', icon: DollarSign });
    } else if (['FINANCE_CONTROLLER', 'CFO'].includes(userRole)) {
      tabs.push({ key: 'FINANCE', label: 'Finance & Treasury', icon: DollarSign });
      tabs.push({ key: 'ACCOUNTING', label: 'General Ledger', icon: FileSpreadsheet });
      tabs.push({ key: 'INVESTMENTS', label: 'Investments', icon: Briefcase });
      tabs.push({ key: 'BILLING', label: 'Billing & Cashier', icon: CreditCard });
    } else {
      // Default fallback
      tabs.push({ key: 'ADMIN', label: 'Overview', icon: Landmark });
      tabs.push({ key: 'CLINICAL', label: 'Clinical', icon: Stethoscope });
    }

    return tabs;
  }, [role]);

  // Adjust active tab if current tab is not accessible
  useEffect(() => {
    if (accessibleTabs.length > 0 && !accessibleTabs.some(t => t.key === activeTab)) {
      setActiveTab(accessibleTabs[0].key);
    }
  }, [accessibleTabs, activeTab]);

  // Load Dashboard Data for the current active tab
  const loadDashboardData = async () => {
    if (accessibleTabs.length > 0 && !accessibleTabs.some(t => t.key === activeTab)) {
      return;
    }

    setLoading(true);
    setError(null);
    const params: DashboardFilterParams = {
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      branch_id: selectedBranchId || undefined,
      department_id: departmentId || undefined,
    };

    try {
      if (activeTab === 'ADMIN') {
        const res = await reportsDashboardService.getAdminDashboard(params);
        setAdminData(res);
      } else if (activeTab === 'FINANCE') {
        const res = await reportsDashboardService.getFinanceDashboard(params);
        setFinanceData(res);
      } else if (activeTab === 'CLINICAL') {
        const res = await reportsDashboardService.getClinicalDashboard(params);
        setClinicalData(res);
      } else if (activeTab === 'PHARMACY') {
        const res = await reportsDashboardService.getPharmacyDashboard(params);
        setPharmacyData(res);
      } else if (activeTab === 'DIAGNOSTICS') {
        const res = await reportsDashboardService.getDiagnosticsDashboard(params);
        setDiagnosticsData(res);
      } else if (activeTab === 'INVENTORY') {
        const res = await reportsDashboardService.getInventoryDashboard(params);
        setInventoryData(res);
      } else if (activeTab === 'BILLING') {
        const res = await reportsDashboardService.getBillingDashboard(params);
        setBillingData(res);
      } else if (activeTab === 'ACCOUNTING') {
        const res = await reportsDashboardService.getAccountingDashboard(params);
        setAccountingData(res);
      } else if (activeTab === 'INVESTMENTS') {
        const res = await reportsDashboardService.getInvestmentsDashboard(params);
        setInvestmentsData(res);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Unable to retrieve dashboard metrics.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [activeTab, fromDate, toDate, selectedBranchId, departmentId]);

  // Handle Opening Drill-Down Modal
  const openDrillDown = async (metricKey: string, title: string) => {
    setDrillDownMetric(metricKey);
    setDrillDownTitle(title);
    setDrillDownPage(1);
    setDrillDownSearch('');
    setIsDrillDownOpen(true);
    fetchDrillDownRecords(metricKey, 1, '');
  };

  const fetchDrillDownRecords = async (metricKey: string, pageNum: number, searchVal: string) => {
    setDrillDownLoading(true);
    try {
      const params: DrillDownParams = {
        metric: metricKey,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        branch_id: selectedBranchId || undefined,
        department_id: departmentId || undefined,
        page: pageNum,
        page_size: 15,
        search: searchVal || undefined,
      };
      const res = await reportsDashboardService.getDrillDownRecords(params);
      setDrillDownRecords(res.records || []);
      setDrillDownTotal(res.total_count || 0);
      setDrillDownPage(res.page || 1);
      setDrillDownTotalPages(res.total_pages || 1);
    } catch (err) {
      console.error('Drill down error:', err);
    } finally {
      setDrillDownLoading(false);
    }
  };

  const handleExportCSV = async (metricToExport?: string) => {
    const metric = metricToExport || (activeTab === 'ADMIN' ? 'REVENUE_INVOICES' : 'OUTSTANDING_RECEIVABLES');
    try {
      await reportsDashboardService.downloadExport({
        metric,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        branch_id: selectedBranchId || undefined,
        department_id: departmentId || undefined,
      });
    } catch (err: any) {
      alert('Export failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Print-Only CSS */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-full { width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .card-print { border: 1px solid #ddd !important; background: white !important; color: black !important; box-shadow: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800">
              Section 21 Verified
            </span>
            <span className="text-xs text-slate-500">&bull; Single Source of Truth: Supabase PostgreSQL</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-cyan-400" />
            Dashboards & Centralized Reporting Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time, audited database metrics, financial reconciliation, and exportable data dossiers across all 9 hospital divisions.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh Real-time Records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm font-medium transition-colors"
            title="Print Official Hospital Dossier"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Print Dossier</span>
          </button>
          <button
            onClick={() => handleExportCSV()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-cyan-950/40 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Universal Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl no-print space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Date Range Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-1">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Period:
            </span>
            {(['TODAY', 'MONTH', 'ALL'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  datePreset === preset
                    ? 'bg-cyan-500 text-white font-semibold shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {preset === 'TODAY' ? "Today's Hospital Date" : preset === 'MONTH' ? 'Current Month' : 'All Dates'}
              </button>
            ))}
          </div>

          {/* Explicit Custom Date Inputs */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-500">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDatePreset('ALL');
                }}
                className="bg-transparent text-slate-200 outline-none text-xs"
              />
            </div>
            <span className="text-slate-600">&rarr;</span>
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-500">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDatePreset('ALL');
                }}
                className="bg-transparent text-slate-200 outline-none text-xs"
              />
            </div>
          </div>
        </div>

        {/* Branch and Department Dropdowns */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-400">Branch:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-cyan-500"
            >
              <option value="">All Hospital Branches</option>
              {branches && branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-400">Department:</span>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-cyan-500"
            >
              <option value="">All Departments</option>
              <option value="OPD">Outpatient Department (OPD)</option>
              <option value="IPD">Inpatient Department (IPD)</option>
              <option value="EMERGENCY">Emergency Medicine</option>
              <option value="ICU">Intensive Care Unit (ICU)</option>
              <option value="OT">Operation Theatre (OT)</option>
              <option value="PHARMACY">Central Pharmacy</option>
              <option value="LAB">Diagnostics & Pathology</option>
            </select>
          </div>

          <div className="ml-auto text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Hospital Timezone: <strong className="text-slate-300">Asia/Kolkata</strong>
          </div>
        </div>
      </div>

      {/* Role-Specific Dashboard Tabs */}
      <div className="no-print">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin border-b border-slate-800">
          {accessibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-lg shadow-cyan-950/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <AlertBanner
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="h-4 bg-slate-800 rounded w-1/2"></div>
              <div className="h-8 bg-slate-800 rounded w-3/4"></div>
              <div className="h-3 bg-slate-800 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 1: HOSPITAL ADMINISTRATION DASHBOARD (Executive) */}
      {!loading && activeTab === 'ADMIN' && adminData && (
        <div className="space-y-6">
          {/* Top 8 Mandatory Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Today's OPD Registrations */}
            <div
              onClick={() => openDrillDown('OPD_REGISTRATIONS', "Today's OPD Consultations & Registrations")}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-cyan-500/50 transition cursor-pointer group shadow-lg"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium text-slate-300">1. Today's OPD Registrations</span>
                <Users className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition" />
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {adminData.metrics?.today_opd_registrations ?? 0}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <span className="text-cyan-400 font-medium">Hospital TZ: {adminData.hospital_timezone}</span>
                <span className="text-slate-500 group-hover:text-cyan-400 flex items-center gap-1">
                  Drill Down &rarr;
                </span>
              </div>
            </div>

            {/* 2. Current Inpatient Census */}
            <div
              onClick={() => openDrillDown('INPATIENT_CENSUS', 'Current Active Inpatient Census (Excludes Discharged)')}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer group shadow-lg"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium text-slate-300">2. Active Inpatient Census</span>
                <Activity className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {adminData.metrics?.current_inpatient_census ?? 0}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <span className="text-emerald-400 font-medium">Excludes Discharged</span>
                <span className="text-slate-500 group-hover:text-emerald-400 flex items-center gap-1">
                  Drill Down &rarr;
                </span>
              </div>
            </div>

            {/* 3. Available Beds vs Occupied Beds */}
            <div
              onClick={() => openDrillDown('AVAILABLE_BEDS', 'Hospital Beds Breakdown')}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-blue-500/50 transition cursor-pointer group shadow-lg"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium text-slate-300">3. Available & Occupied Beds</span>
                <Bed className="w-4 h-4 text-blue-400 group-hover:scale-110 transition" />
              </div>
              <div className="text-2xl font-extrabold text-white tracking-tight flex items-baseline gap-2">
                <span className="text-blue-400">{adminData.metrics?.available_beds ?? 0}</span>
                <span className="text-slate-500 text-sm font-normal">Avail /</span>
                <span className="text-amber-400">{adminData.metrics?.occupied_beds ?? 0}</span>
                <span className="text-slate-500 text-sm font-normal">Occ</span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <span className="text-blue-400 font-medium">
                  {adminData.metrics?.bed_occupancy_rate_pct ?? 0}% Occupancy
                </span>
                <span className="text-slate-500 group-hover:text-blue-400 flex items-center gap-1">
                  View Beds &rarr;
                </span>
              </div>
            </div>

            {/* 4. Emergency Visits */}
            <div
              onClick={() => openDrillDown('EMERGENCY_VISITS', 'Emergency Department Encounters')}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-rose-500/50 transition cursor-pointer group shadow-lg"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium text-slate-300">4. Emergency Visits</span>
                <AlertTriangle className="w-4 h-4 text-rose-400 group-hover:scale-110 transition" />
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {adminData.metrics?.emergency_visits ?? 0}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <span className="text-rose-400 font-medium">Acuity Triaged</span>
                <span className="text-slate-500 group-hover:text-rose-400 flex items-center gap-1">
                  Drill Down &rarr;
                </span>
              </div>
            </div>

            {/* 5. Pending Diagnostic Reports */}
            <div
              onClick={() => openDrillDown('PENDING_DIAGNOSTICS', 'Pending Laboratory & Radiology Orders')}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer group shadow-lg"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium text-slate-300">5. Pending Lab & Diagnostic Reports</span>
                <FlaskConical className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {adminData.metrics?.pending_diagnostic_reports ?? 0}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <span className="text-amber-400 font-medium">Awaiting Specimen/Approval</span>
                <span className="text-slate-500 group-hover:text-amber-400 flex items-center gap-1">
                  View Orders &rarr;
                </span>
              </div>
            </div>

            {/* 6. Pending Patient Discharges */}
            <div
              onClick={() => openDrillDown('INPATIENT_CENSUS', 'Admissions with Pending Discharge Process')}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-purple-500/50 transition cursor-pointer group shadow-lg"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium text-slate-300">6. Pending Discharges</span>
                <CheckCircle2 className="w-4 h-4 text-purple-400 group-hover:scale-110 transition" />
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {adminData.metrics?.pending_patient_discharges ?? 0}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <span className="text-purple-400 font-medium">Clearance in Progress</span>
                <span className="text-slate-500 group-hover:text-purple-400 flex items-center gap-1">
                  View Cases &rarr;
                </span>
              </div>
            </div>

            {/* 7. Revenue & Collections */}
            <div
              onClick={() => openDrillDown('REVENUE_INVOICES', 'Invoiced Revenue & Cash Collections')}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer group shadow-lg"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium text-slate-300">7. Revenue & Collections</span>
                <DollarSign className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
              </div>
              <div className="text-xl font-extrabold text-white tracking-tight">
                ₹{(adminData.metrics?.total_revenue ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-emerald-400 mt-1 font-semibold">
                Collections: ₹{(adminData.metrics?.total_collections ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <span className="text-slate-400">Eff: {adminData.metrics?.collection_efficiency_pct ?? 0}%</span>
                <span className="text-slate-500 group-hover:text-emerald-400 flex items-center gap-1">
                  Drill Down &rarr;
                </span>
              </div>
            </div>

            {/* 8. Outstanding Receivables */}
            <div
              onClick={() => openDrillDown('OUTSTANDING_RECEIVABLES', 'Unpaid Patient & Corporate Receivables')}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-rose-500/50 transition cursor-pointer group shadow-lg"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium text-slate-300">8. Outstanding Receivables</span>
                <AlertCircle className="w-4 h-4 text-rose-400 group-hover:scale-110 transition" />
              </div>
              <div className="text-xl font-extrabold text-rose-400 tracking-tight">
                ₹{(adminData.metrics?.outstanding_receivables ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Net unpaid invoice balances
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <span className="text-rose-400 font-medium">Reconciled with AR</span>
                <span className="text-slate-500 group-hover:text-rose-400 flex items-center gap-1">
                  Drill Down &rarr;
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Administrative Breakdown Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bed Occupancy Gauge & Ward Status */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bed className="w-4 h-4 text-cyan-400" />
                  Inpatient Bed Capacity & Occupancy Meter
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  {adminData.metrics?.bed_occupancy_rate_pct ?? 0}% Utilized
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
                <div
                  className="bg-cyan-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(adminData.metrics?.bed_occupancy_rate_pct || 0, 100)}%` }}
                ></div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-400 block text-[11px]">Total Beds</span>
                  <span className="text-base font-bold text-white">{adminData.metrics?.total_hospital_beds ?? 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-400 block text-[11px]">Occupied</span>
                  <span className="text-base font-bold text-amber-400">{adminData.metrics?.occupied_beds ?? 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-400 block text-[11px]">Available</span>
                  <span className="text-base font-bold text-emerald-400">{adminData.metrics?.available_beds ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Emergency Department Triage Breakdown */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Emergency Encounters by Triage Acuity
                </h3>
                <span className="text-xs text-slate-400">
                  Total Visits: <strong className="text-white">{adminData.metrics?.emergency_visits ?? 0}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-center">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Red &bull; Resus</span>
                  <span className="text-lg font-bold text-white mt-1 block">
                    {adminData.emergency_triage_breakdown?.RED ?? 0}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-900/60 text-center">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Orange &bull; Emergent</span>
                  <span className="text-lg font-bold text-white mt-1 block">
                    {adminData.emergency_triage_breakdown?.ORANGE ?? 0}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-yellow-950/40 border border-yellow-900/60 text-center">
                  <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider block">Yellow &bull; Urgent</span>
                  <span className="text-lg font-bold text-white mt-1 block">
                    {adminData.emergency_triage_breakdown?.YELLOW ?? 0}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-center">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Green / Blue</span>
                  <span className="text-lg font-bold text-white mt-1 block">
                    {(adminData.emergency_triage_breakdown?.GREEN ?? 0) + (adminData.emergency_triage_breakdown?.BLUE ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCE & TREASURY DASHBOARD */}
      {!loading && activeTab === 'FINANCE' && financeData && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800 text-xs text-cyan-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Reconciled with General Ledger, Chart of Accounts, Bank Accounts, and Active Hospital Loans.
            </span>
            <span className="text-[11px] text-slate-400">As of: {financeData.as_of_date}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Bank and Cash Balances */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Bank & Cash Balances</span>
                <Landmark className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">
                ₹{(financeData.financial_metrics?.total_bank_cash_balance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {financeData.financial_metrics?.active_bank_accounts_count ?? 0} Active Institutional Accounts
              </p>
            </div>

            {/* Patient & Insurance Receivables */}
            <div
              onClick={() => openDrillDown('OUTSTANDING_RECEIVABLES', 'Patient and Insurance Receivables')}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg hover:border-cyan-500/50 cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Patient & Insurance Receivables</span>
                <DollarSign className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">
                ₹{(financeData.financial_metrics?.total_receivables ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Patient: ₹{(financeData.financial_metrics?.patient_receivables ?? 0).toLocaleString('en-IN')} | Ins: ₹{(financeData.financial_metrics?.insurance_claims_pending ?? 0).toLocaleString('en-IN')}
              </p>
            </div>

            {/* Supplier Payables */}
            <div
              onClick={() => openDrillDown('SUPPLIER_PAYABLES', 'Supplier and Vendor Payables')}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg hover:border-amber-500/50 cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Supplier Payables</span>
                <Truck className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-extrabold text-amber-400">
                ₹{(financeData.financial_metrics?.total_supplier_payables ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {financeData.financial_metrics?.pending_supplier_invoices_count ?? 0} Pending Vendor Invoices
              </p>
            </div>

            {/* Monthly Operating Profit */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Operating Profit (P&L)</span>
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
              <div className={`text-2xl font-extrabold ${financeData.financial_metrics?.operating_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{(financeData.financial_metrics?.operating_profit ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Margin: {financeData.financial_metrics?.net_profit_margin_pct ?? 0}%
              </p>
            </div>

            {/* Net Cash Flow */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Net Cash Flow</span>
                <Activity className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">
                ₹{(financeData.financial_metrics?.net_cash_flow ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Collections minus Cash Disbursements
              </p>
            </div>

            {/* Investment Portfolio Value */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Investment Portfolio Value</span>
                <Briefcase className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-extrabold text-white">
                ₹{(financeData.financial_metrics?.investment_portfolio_value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-emerald-400 mt-2">
                Income Earned: ₹{(financeData.financial_metrics?.investment_income_earned ?? 0).toLocaleString('en-IN')}
              </p>
            </div>

            {/* Outstanding Loan Balances */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Outstanding Loan Balances</span>
                <AlertCircle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-extrabold text-rose-400">
                ₹{(financeData.financial_metrics?.outstanding_loan_balances ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Section 16 Institutional Debt
              </p>
            </div>

            {/* Upcoming Obligations & Unreconciled Transactions */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Upcoming 30-Day Obligations</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-extrabold text-amber-400">
                ₹{(financeData.financial_metrics?.upcoming_financial_obligations_30d ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Unreconciled Bank Records: <strong className="text-white">{financeData.financial_metrics?.unreconciled_bank_transactions_count ?? 0}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLINICAL DEPARTMENTS DASHBOARD */}
      {!loading && activeTab === 'CLINICAL' && clinicalData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Active Inpatient Census</span>
              <div className="text-3xl font-bold text-white mt-1">{clinicalData.clinical_metrics?.active_inpatients ?? 0}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Total Consultations (Filtered)</span>
              <div className="text-3xl font-bold text-cyan-400 mt-1">{clinicalData.clinical_metrics?.total_consultations_in_period ?? 0}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Emergency Visits</span>
              <div className="text-3xl font-bold text-rose-400 mt-1">{clinicalData.clinical_metrics?.emergency_cases ?? 0}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Discharges Processed</span>
              <div className="text-3xl font-bold text-emerald-400 mt-1">{clinicalData.clinical_metrics?.discharges_in_period ?? 0}</div>
            </div>
          </div>

          {/* Clinician Leaderboard */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Clinician Workload & Consultation Distribution
            </h3>
            {clinicalData.doctor_workload && clinicalData.doctor_workload.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Physician</th>
                      <th className="py-2.5 px-3">Specialization</th>
                      <th className="py-2.5 px-3 text-right">Consultations Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {clinicalData.doctor_workload.map((doc: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-medium text-white">{doc.name}</td>
                        <td className="py-2.5 px-3">{doc.specialization || 'General Medicine'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-cyan-400">{doc.consultations_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">No physician appointments recorded in the selected period.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PHARMACY DASHBOARD */}
      {!loading && activeTab === 'PHARMACY' && pharmacyData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Total Registered Formulations</span>
              <div className="text-3xl font-bold text-white mt-1">{pharmacyData.pharmacy_metrics?.total_medicines_count ?? 0}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Formulary Stock Valuation</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                ₹{(pharmacyData.pharmacy_metrics?.total_stock_valuation ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Low Stock Batches</span>
              <div className="text-3xl font-bold text-amber-400 mt-1">{pharmacyData.pharmacy_metrics?.low_stock_batches_count ?? 0}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Near-Expiry Batches (&lt;90d)</span>
              <div className="text-3xl font-bold text-rose-400 mt-1">{pharmacyData.pharmacy_metrics?.near_expiry_batches_count ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DIAGNOSTICS & LAB DASHBOARD */}
      {!loading && activeTab === 'DIAGNOSTICS' && diagnosticsData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Total Diagnostic Tests Ordered</span>
              <div className="text-3xl font-bold text-white mt-1">{diagnosticsData.diagnostic_metrics?.total_diagnostic_orders ?? 0}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Completed Diagnostic Reports</span>
              <div className="text-3xl font-bold text-emerald-400 mt-1">{diagnosticsData.diagnostic_metrics?.completed_reports ?? 0}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Pending Laboratory Reports</span>
              <div className="text-3xl font-bold text-amber-400 mt-1">{diagnosticsData.diagnostic_metrics?.pending_reports ?? 0}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Critical Panic Values</span>
              <div className="text-3xl font-bold text-rose-400 mt-1">{diagnosticsData.diagnostic_metrics?.critical_panic_results_count ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: INVENTORY & PROCUREMENT DASHBOARD */}
      {!loading && activeTab === 'INVENTORY' && inventoryData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Registered Institutional Vendors</span>
              <div className="text-3xl font-bold text-white mt-1">{inventoryData.inventory_metrics?.total_suppliers ?? 0}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Active Purchase Orders</span>
              <div className="text-3xl font-bold text-cyan-400 mt-1">{inventoryData.inventory_metrics?.active_purchase_orders ?? 0}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Goods Receipt Notes (GRN)</span>
              <div className="text-3xl font-bold text-emerald-400 mt-1">{inventoryData.inventory_metrics?.completed_grns ?? 0}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Total Outstanding Payables</span>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                ₹{(inventoryData.inventory_metrics?.outstanding_payables ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: BILLING & CASHIER DASHBOARD */}
      {!loading && activeTab === 'BILLING' && billingData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Total Billed Revenue</span>
              <div className="text-2xl font-bold text-white mt-1">
                ₹{(billingData.billing_metrics?.total_billed_amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Total Cashier Collections</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                ₹{(billingData.billing_metrics?.total_collections ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Patient Advance Deposits</span>
              <div className="text-2xl font-bold text-cyan-400 mt-1">
                ₹{(billingData.billing_metrics?.patient_advance_deposits ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Collection Efficiency</span>
              <div className="text-3xl font-bold text-blue-400 mt-1">
                {billingData.billing_metrics?.collection_efficiency_pct ?? 0}%
              </div>
            </div>
          </div>

          {/* Payment Method Distribution */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Collections by Settlement Channel
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400 block">Cash</span>
                <span className="text-base font-bold text-emerald-400 mt-1 block">
                  ₹{(billingData.collections_by_payment_method?.CASH ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400 block">UPI / QR Code</span>
                <span className="text-base font-bold text-cyan-400 mt-1 block">
                  ₹{(billingData.collections_by_payment_method?.UPI ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400 block">Debit / Credit Card</span>
                <span className="text-base font-bold text-blue-400 mt-1 block">
                  ₹{(billingData.collections_by_payment_method?.CARD ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400 block">Bank Transfer / NEFT</span>
                <span className="text-base font-bold text-purple-400 mt-1 block">
                  ₹{(billingData.collections_by_payment_method?.BANK_TRANSFER ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: ACCOUNTING & GENERAL LEDGER */}
      {!loading && activeTab === 'ACCOUNTING' && accountingData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Posted Journal Vouchers</span>
              <div className="text-3xl font-bold text-white mt-1">{accountingData.accounting_metrics?.posted_journal_entries ?? 0}</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Total GL Debits</span>
              <div className="text-2xl font-bold text-white mt-1">
                ₹{(accountingData.accounting_metrics?.total_gl_debits ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Total GL Credits</span>
              <div className="text-2xl font-bold text-white mt-1">
                ₹{(accountingData.accounting_metrics?.total_gl_credits ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Trial Balance Verification</span>
              <div className="mt-2">
                {accountingData.accounting_metrics?.is_trial_balance_in_balance ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Debits = Credits (Balanced)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800">
                    <Clock className="w-3.5 h-3.5" /> No Posted Entries Yet
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: INVESTMENTS MANAGEMENT */}
      {!loading && activeTab === 'INVESTMENTS' && investmentsData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Total Portfolio Valuation</span>
              <div className="text-2xl font-bold text-white mt-1">
                ₹{(investmentsData.investment_metrics?.portfolio_current_valuation ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Principal Invested</span>
              <div className="text-2xl font-bold text-cyan-400 mt-1">
                ₹{(investmentsData.investment_metrics?.principal_invested ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Total Interest / Dividends Received</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                ₹{(investmentsData.investment_metrics?.total_interest_received ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Unrealized Capital Gains</span>
              <div className="text-2xl font-bold text-blue-400 mt-1">
                ₹{(investmentsData.investment_metrics?.unrealized_gain_loss ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE DRILL-DOWN MODAL */}
      <Modal
        isOpen={isDrillDownOpen}
        onClose={() => setIsDrillDownOpen(false)}
        title={drillDownTitle}
        subtitle={`Audit Trail & Detailed Database Records • Total Persisted Records: ${drillDownTotal}`}
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportCSV(drillDownMetric)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV Records
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={drillDownPage <= 1 || drillDownLoading}
                onClick={() => {
                  const p = drillDownPage - 1;
                  setDrillDownPage(p);
                  fetchDrillDownRecords(drillDownMetric, p, drillDownSearch);
                }}
                className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-400">
                Page {drillDownPage} of {drillDownTotalPages}
              </span>
              <button
                disabled={drillDownPage >= drillDownTotalPages || drillDownLoading}
                onClick={() => {
                  const p = drillDownPage + 1;
                  setDrillDownPage(p);
                  fetchDrillDownRecords(drillDownMetric, p, drillDownSearch);
                }}
                className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search records by name, ID, or reference..."
              value={drillDownSearch}
              onChange={(e) => {
                setDrillDownSearch(e.target.value);
                setDrillDownPage(1);
                fetchDrillDownRecords(drillDownMetric, 1, e.target.value);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-cyan-500"
            />
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto max-h-[50vh] border border-slate-800 rounded-xl">
            {drillDownLoading ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                Querying Supabase database...
              </div>
            ) : drillDownRecords.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No database records match the selected filter criteria.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800">
                  <tr>
                    {Object.keys(drillDownRecords[0]).map((col) => (
                      <th key={col} className="py-2.5 px-3 whitespace-nowrap">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {drillDownRecords.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/50">
                      {Object.entries(row).map(([k, val]: any, j) => (
                        <td key={j} className="py-2.5 px-3 whitespace-nowrap">
                          {typeof val === 'number' && k.includes('amount') ? (
                            <span className="font-semibold text-white">₹{val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          ) : typeof val === 'string' && ['COMPLETED', 'ACTIVE', 'PAID', 'AVAILABLE'].includes(val) ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">{val}</span>
                          ) : typeof val === 'string' && ['PENDING', 'OCCUPIED', 'RED'].includes(val) ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">{val}</span>
                          ) : (
                            String(val ?? '—')
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ReportsPage;
