import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  RefreshCw,
  Printer,
  Download,
  Calendar,
  Building2,
  Stethoscope,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  PieChart,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Search,
  Activity,
  Layers,
  ShieldCheck,
  Scale
} from 'lucide-react';
import api, { billingFinanceService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { Modal } from '../../components/common/Modal';
import { parseApiError } from '../../utils/errorHandler';

type PeriodType = 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CUSTOM';
type ActiveTab = 'dashboard' | 'statement' | 'departments' | 'branches' | 'drilldown';

interface MetricComparison {
  current: string | number;
  previous: string | number;
  variance: string | number;
  pct_change: number;
  trend?: 'UP' | 'DOWN' | 'FLAT';
}

export const ProfitLossPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [periodType, setPeriodType] = useState<PeriodType>('ANNUAL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);

  // State payloads
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [statementData, setStatementData] = useState<any | null>(null);
  const [departmentData, setDepartmentData] = useState<any | null>(null);
  const [branchData, setBranchData] = useState<any | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drilldown modal state
  const [drilldownModalOpen, setDrilldownModalOpen] = useState(false);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState<any | null>(null);

  // Expanded statement sections
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    operating_rev: true,
    cogs: true,
    operating_exp: true,
    non_op: true,
    taxes: true
  });

  const toggleSection = (sec: string) => {
    setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Load initial branches
  useEffect(() => {
    api.get('/core/branches/').then((res: any) => {
      setBranches(res.data?.results || res.data || []);
    }).catch(e => setError(parseApiError(e).message));
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = { period_type: periodType };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (selectedBranch) params.branch_id = selectedBranch;
      if (selectedDept) params.department_id = selectedDept;

      const [dash, stmt, depts, brs] = await Promise.all([
        billingFinanceService.getProfitLossDashboard(params),
        billingFinanceService.getProfitLossDetailedReport(params),
        billingFinanceService.getDepartmentProfitability(params),
        billingFinanceService.getBranchProfitability(params)
      ]);

      setDashboardData(dash);
      setStatementData(stmt);
      setDepartmentData(depts);
      setBranchData(brs);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [periodType, selectedBranch, selectedDept]);

  const handleCustomDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (periodType === 'CUSTOM' && startDate && endDate) {
      loadAllData();
    }
  };

  const handleExportCSV = async () => {
    try {
      const params: any = { period_type: periodType };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (selectedBranch) params.branch_id = selectedBranch;
      if (selectedDept) params.department_id = selectedDept;

      const res = await billingFinanceService.exportProfitLossCSV(params);
      const url = window.URL.createObjectURL(new Blob([res.data || res]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `profit_loss_report_${startDate || 'FY'}_to_${endDate || 'today'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError('Failed to export CSV report.');
    }
  };

  const openDrilldown = async (accountCode?: string, accountId?: string) => {
    try {
      setDrilldownLoading(true);
      setDrilldownModalOpen(true);
      const params: any = {};
      if (accountCode) params.account_code = accountCode;
      if (accountId) params.account_id = accountId;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (selectedBranch) params.branch_id = selectedBranch;

      const res = await billingFinanceService.getProfitLossDrilldown(params);
      setDrilldownData(res);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const formatCurrency = (val: string | number | undefined) => {
    const num = parseFloat(String(val || '0'));
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(num);
  };

  const renderTrendBadge = (comp?: MetricComparison) => {
    if (!comp) return null;
    const isPositive = comp.pct_change >= 0;
    const isFlat = comp.pct_change === 0;

    if (isFlat) {
      return (
        <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
          0.0% vs prev
        </span>
      );
    }

    return (
      <span
        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 ${
          isPositive
            ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/50'
            : 'text-rose-400 bg-rose-950/60 border border-rose-800/50'
        }`}
      >
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(comp.pct_change)}% vs prev
      </span>
    );
  };

  const metrics = dashboardData?.metrics || {};
  const comparison = dashboardData?.comparison || {};
  const charts = dashboardData?.charts || {};

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Section 18 GAAP / IFRS Reconciled
            </span>
            <span className="text-xs text-slate-400">Hospital Fiscal Year (April 1 – March 31)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-emerald-400" />
            Hospital Profit & Loss (P&L) Management
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time operating income, clinical department revenues, healthcare expenses, and bottom-line surplus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="p-2 border border-slate-800 hover:bg-slate-800/80 rounded-xl text-slate-300 transition-colors disabled:opacity-50"
            title="Recalculate P&L from General Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-800 hover:bg-slate-800/80 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Printer className="w-4 h-4" />
            Print P&L Statement
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}

      {/* Global Filter Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Preset Periods */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
          {(['DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM'] as PeriodType[]).map(pt => (
            <button
              key={pt}
              onClick={() => setPeriodType(pt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodType === pt
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {pt === 'DAILY' && 'Today'}
              {pt === 'MONTHLY' && 'This Month'}
              {pt === 'QUARTERLY' && 'This Quarter'}
              {pt === 'ANNUAL' && 'Financial Year (FY 26-27)'}
              {pt === 'CUSTOM' && 'Custom Dates'}
            </button>
          ))}
        </div>

        {/* Custom Date Form */}
        {periodType === 'CUSTOM' && (
          <form onSubmit={handleCustomDateSubmit} className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <span className="text-xs text-slate-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-xl transition"
            >
              Apply
            </button>
          </form>
        )}

        {/* Branch & Department Filters */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="pl-8 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
            >
              <option value="">All Hospital Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>

          <div className="text-xs text-slate-400 font-mono">
            {dashboardData?.start_date} <span className="text-slate-600">→</span> {dashboardData?.end_date}
          </div>
        </div>
      </div>

      {/* Primary Section Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          id="tab-btn-dashboard"
          data-tab="dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'dashboard'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Executive P&L Dashboard
        </button>

        <button
          id="tab-btn-statement"
          data-tab="statement"
          onClick={() => setActiveTab('statement')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'statement'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          Multi-Step GAAP Statement
        </button>

        <button
          id="tab-btn-departments"
          data-tab="departments"
          onClick={() => setActiveTab('departments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'departments'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          Department Profitability
        </button>

        <button
          id="tab-btn-branches"
          data-tab="branches"
          onClick={() => setActiveTab('branches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'branches'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Branch Performance
        </button>
      </div>

      {/* TAB 1: EXECUTIVE DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top Level Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Hospital Revenue</span>
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-bold text-white mb-2">
                {formatCurrency(metrics.total_hospital_revenue)}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Net Recognized Income</span>
                {renderTrendBadge(comparison.total_hospital_revenue)}
              </div>
            </div>

            {/* Total Operating Expenses */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Operating Expenses</span>
                <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <ArrowDownRight className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl font-bold text-rose-300 mb-2">
                {formatCurrency(metrics.total_operating_expenses)}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Payroll, Rent, Supplies</span>
                {renderTrendBadge(comparison.total_operating_expenses)}
              </div>
            </div>

            {/* Operating Profit */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Operating Profit (EBITDA)</span>
                <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Scale className="w-4 h-4" />
                </span>
              </div>
              <p className={`text-2xl font-bold mb-2 ${parseFloat(metrics.operating_profit || '0') >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                {formatCurrency(metrics.operating_profit)}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Margin: {metrics.operating_margin_pct}%</span>
                {renderTrendBadge(comparison.operating_profit)}
              </div>
            </div>

            {/* Net Profit */}
            <div className="bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Bottom Line Net Profit</span>
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <p className={`text-2xl font-bold mb-2 ${parseFloat(metrics.net_profit || '0') >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(metrics.net_profit)}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-300/80">Net Margin: {metrics.net_margin_pct}%</span>
                {renderTrendBadge(comparison.net_profit)}
              </div>
            </div>
          </div>

          {/* Section: 21 Metrics Master Grid */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  Master Healthcare Revenue & Cost Classification Matrix (21 Metrics)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any metric card to inspect its underlying posted General Ledger entries.
                </p>
              </div>
              <Badge variant="cyan">General Ledger Reconciled</Badge>
            </div>

            {/* 1. Clinical Revenue Streams */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                I. Clinical & Operating Revenue Streams
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { label: 'OPD Consultations', code: '4010', value: metrics.opd_revenue, comp: comparison.opd_revenue },
                  { label: 'IPD Ward & Beds', code: '4020', value: metrics.ipd_revenue, comp: comparison.ipd_revenue },
                  { label: 'Surgery & OT', code: '4025', value: metrics.surgery_revenue, comp: comparison.surgery_revenue },
                  { label: 'Critical Care ICU', code: '4028', value: metrics.icu_revenue, comp: comparison.icu_revenue },
                  { label: 'Diagnostic Lab', code: '4030', value: metrics.diagnostic_revenue, comp: comparison.diagnostic_revenue },
                  { label: 'Pharmacy Formulary', code: '4040', value: metrics.pharmacy_revenue, comp: comparison.pharmacy_revenue },
                  { label: 'Other Operating Inc.', code: '4060', value: metrics.other_operating_income, comp: comparison.other_operating_income }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => openDrilldown(item.code)}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-cyan-500/50 cursor-pointer transition group"
                  >
                    <span className="text-[11px] text-slate-400 group-hover:text-cyan-400 transition block truncate">
                      {item.label}
                    </span>
                    <p className="text-base font-bold text-slate-100 mt-1">
                      {formatCurrency(item.value)}
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono mt-1 block">Account {item.code}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Direct Costs & Gross Profit */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                II. Cost of Goods Sold & Gross Operating Profit
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => openDrilldown('5030')}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-amber-500/50 cursor-pointer transition"
                >
                  <span className="text-xs text-slate-400">Pharmacy & Medical COGS (5030)</span>
                  <p className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(metrics.pharmacy_cogs)}</p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Direct inventory consumption</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <span className="text-xs text-slate-400">Gross Operating Profit</span>
                  <p className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(metrics.gross_profit)}</p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Net Revenue minus Direct COGS</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <span className="text-xs text-slate-400">Consumables & Medicine Costs</span>
                  <p className="text-lg font-bold text-slate-200 mt-1">{formatCurrency(metrics.consumables_medicine)}</p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Clinical materials utilized</span>
                </div>
              </div>
            </div>

            {/* 3. Operating Expenses */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                III. Healthcare Operating & Administrative Expenses
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  onClick={() => openDrilldown('5010')}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500 cursor-pointer transition"
                >
                  <span className="text-xs text-slate-400">Salaries & Nursing Payroll</span>
                  <p className="text-base font-bold text-rose-300 mt-1">{formatCurrency(metrics.salaries_payroll)}</p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">Account 5010</span>
                </div>

                <div
                  onClick={() => openDrilldown('5070')}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500 cursor-pointer transition"
                >
                  <span className="text-xs text-slate-400">Rent & Campus Facilities</span>
                  <p className="text-base font-bold text-rose-300 mt-1">{formatCurrency(metrics.rent_utilities)}</p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">Accounts 5020 & 5070</span>
                </div>

                <div
                  onClick={() => openDrilldown('5060')}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500 cursor-pointer transition"
                >
                  <span className="text-xs text-slate-400">Equipment Depreciation</span>
                  <p className="text-base font-bold text-rose-300 mt-1">{formatCurrency(metrics.depreciation)}</p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">Account 5060</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-xs text-slate-400">Total Operating Expenses</span>
                  <p className="text-base font-bold text-rose-400 mt-1">{formatCurrency(metrics.total_operating_expenses)}</p>
                  <span className="text-[10px] text-slate-500 mt-1 block">Sum of clinical operating costs</span>
                </div>
              </div>
            </div>

            {/* 4. Financing & Non-Operating */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-400" />
                IV. Non-Operating Income, Financing & Banking Fees
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  onClick={() => openDrilldown('4050')}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500 cursor-pointer transition"
                >
                  <span className="text-xs text-slate-400">Interest & Dividend Income</span>
                  <p className="text-base font-bold text-emerald-400 mt-1">{formatCurrency(metrics.interest_income)}</p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">Account 4050</span>
                </div>

                <div
                  onClick={() => openDrilldown('4070')}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500 cursor-pointer transition"
                >
                  <span className="text-xs text-slate-400">Investment Gains / (Losses)</span>
                  <p className="text-base font-bold text-cyan-400 mt-1">{formatCurrency(metrics.investment_gains_losses)}</p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">Account 4070</span>
                </div>

                <div
                  onClick={() => openDrilldown('5040')}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500 cursor-pointer transition"
                >
                  <span className="text-xs text-slate-400">Loan Financing & Interest</span>
                  <p className="text-base font-bold text-rose-300 mt-1">{formatCurrency(metrics.interest_expense)}</p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">Account 5040</span>
                </div>

                <div
                  onClick={() => openDrilldown('5050')}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500 cursor-pointer transition"
                >
                  <span className="text-xs text-slate-400">Bank & Gateway Fees</span>
                  <p className="text-base font-bold text-rose-300 mt-1">{formatCurrency(metrics.bank_gateway_fees)}</p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">Account 5050</span>
                </div>
              </div>
            </div>

            {/* 5. Subtotals & Net Profit */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                V. Statutory Corporate Tax & Final Net Surplus
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-xs text-slate-400">Profit Before Tax (PBT)</span>
                  <p className="text-lg font-bold text-cyan-400 mt-1">{formatCurrency(metrics.profit_before_tax)}</p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Operating Profit + Non-operating net</span>
                </div>

                <div
                  onClick={() => openDrilldown('5080')}
                  className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500 cursor-pointer transition"
                >
                  <span className="text-xs text-slate-400">Provision for Corporate Tax (5080)</span>
                  <p className="text-lg font-bold text-slate-300 mt-1">{formatCurrency(metrics.tax_expense)}</p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Statutory income tax provision</span>
                </div>

                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                  <span className="text-xs font-bold text-emerald-400 uppercase">Final Net Profit / (Loss)</span>
                  <p className="text-xl font-bold text-emerald-300 mt-1">{formatCurrency(metrics.net_profit)}</p>
                  <span className="text-[11px] text-emerald-400/80 mt-0.5 block">Transferred to Retained Earnings</span>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: 12-Month Monthly Trend */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    Monthly Profit & Loss Trend (12 Months)
                  </h3>
                  <p className="text-xs text-slate-400">Revenue (green) vs Expenses (red) with monthly net profit</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Revenue
                  </span>
                  <span className="flex items-center gap-1 text-rose-400">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500" /> Expense
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {(charts.monthly_trend || []).length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">No monthly journal postings in selected range.</div>
                ) : (
                  (charts.monthly_trend || []).map((m: any, i: number) => {
                    const rev = parseFloat(m.revenue);
                    const exp = parseFloat(m.expenses);
                    const maxVal = Math.max(...(charts.monthly_trend || []).map((x: any) => Math.max(parseFloat(x.revenue), parseFloat(x.expenses), 1)));
                    const revPct = Math.round((rev / maxVal) * 100);
                    const expPct = Math.round((exp / maxVal) * 100);

                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300 w-20">{m.month_name}</span>
                          <span className="text-[11px] font-mono text-slate-400">
                            Rev: ₹{rev.toLocaleString()} | Exp: ₹{exp.toLocaleString()}
                          </span>
                          <span className={`text-[11px] font-bold font-mono ${parseFloat(m.net_profit) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {parseFloat(m.net_profit) >= 0 ? '+' : ''}₹{parseFloat(m.net_profit).toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full flex gap-1 overflow-hidden">
                          <div style={{ width: `${revPct}%` }} className="h-full bg-emerald-500 rounded-full transition-all" />
                          <div style={{ width: `${expPct}%` }} className="h-full bg-rose-500 rounded-full transition-all" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Chart 2: Revenue Distribution by Department */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-emerald-400" />
                    Clinical Revenue Distribution by Department
                  </h3>
                  <p className="text-xs text-slate-400">Proportional share of clinical and operating receipts</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {(charts.revenue_by_department || []).length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">No departmental revenue recorded for this period.</div>
                ) : (
                  (charts.revenue_by_department || []).map((dept: any, i: number) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300">{dept.name}</span>
                        <span className="text-emerald-400 font-mono font-bold">
                          {formatCurrency(dept.revenue)} ({dept.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${dept.percentage}%` }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DETAILED GAAP MULTI-STEP STATEMENT */}
      {activeTab === 'statement' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Comprehensive Multi-Step Income Statement
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Detailed account-level breakdown compliant with Healthcare Accounting Standards.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Period: {statementData?.start_date || 'Start'} to {statementData?.end_date || 'Current'}
            </div>
          </div>

          <div className="space-y-4">
            {/* 1. Operating Revenue Section */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
              <button
                onClick={() => toggleSection('operating_rev')}
                className="w-full px-4 py-3 bg-slate-900 flex items-center justify-between text-left hover:bg-slate-850 transition"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.operating_rev ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                  <span className="text-xs font-bold text-white uppercase tracking-wider">I. Operating Clinical Revenues</span>
                </div>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {formatCurrency(statementData?.total_operating_revenue)}
                </span>
              </button>

              {expandedSections.operating_rev && (
                <div className="p-4 space-y-2">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800/80 pb-2">
                        <th className="pb-2 font-semibold">Account Code</th>
                        <th className="pb-2 font-semibold">Account Description</th>
                        <th className="pb-2 font-semibold text-right">Debits</th>
                        <th className="pb-2 font-semibold text-right">Credits</th>
                        <th className="pb-2 font-semibold text-right">Net Revenue</th>
                        <th className="pb-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {(statementData?.operating_revenues || []).map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-900/50">
                          <td className="py-2.5 font-mono text-cyan-400">{item.account_code}</td>
                          <td className="py-2.5 text-slate-200">{item.account_name}</td>
                          <td className="py-2.5 font-mono text-slate-400 text-right">₹{parseFloat(item.debits).toLocaleString()}</td>
                          <td className="py-2.5 font-mono text-slate-400 text-right">₹{parseFloat(item.credits).toLocaleString()}</td>
                          <td className="py-2.5 font-mono font-bold text-emerald-400 text-right">{formatCurrency(item.net_amount)}</td>
                          <td className="py-2.5 text-center">
                            <button
                              onClick={() => openDrilldown(item.account_code)}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                            >
                              Drill-Down
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. COGS & Gross Profit */}
            <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">II. Cost of Goods Sold (COGS)</span>
                <span className="text-xs text-slate-400">Account 5030 - Medical Consumables & Formulary COGS</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Deduction: {formatCurrency(statementData?.cogs_amount)}</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  Gross Profit: {formatCurrency(statementData?.gross_profit)}
                </span>
              </div>
            </div>

            {/* 3. Operating Expenses Section */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
              <button
                onClick={() => toggleSection('operating_exp')}
                className="w-full px-4 py-3 bg-slate-900 flex items-center justify-between text-left hover:bg-slate-850 transition"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.operating_exp ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                  <span className="text-xs font-bold text-white uppercase tracking-wider">III. Operating & Healthcare Expenses</span>
                </div>
                <span className="text-sm font-bold text-rose-400 font-mono">
                  {formatCurrency(statementData?.total_operating_expenses)}
                </span>
              </button>

              {expandedSections.operating_exp && (
                <div className="p-4 space-y-2">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800/80 pb-2">
                        <th className="pb-2 font-semibold">Account Code</th>
                        <th className="pb-2 font-semibold">Account Description</th>
                        <th className="pb-2 font-semibold text-right">Debits</th>
                        <th className="pb-2 font-semibold text-right">Credits</th>
                        <th className="pb-2 font-semibold text-right">Net Expense</th>
                        <th className="pb-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {(statementData?.operating_expenses || []).map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-900/50">
                          <td className="py-2.5 font-mono text-cyan-400">{item.account_code}</td>
                          <td className="py-2.5 text-slate-200">{item.account_name}</td>
                          <td className="py-2.5 font-mono text-slate-400 text-right">₹{parseFloat(item.debits).toLocaleString()}</td>
                          <td className="py-2.5 font-mono text-slate-400 text-right">₹{parseFloat(item.credits).toLocaleString()}</td>
                          <td className="py-2.5 font-mono font-bold text-rose-300 text-right">{formatCurrency(item.net_amount)}</td>
                          <td className="py-2.5 text-center">
                            <button
                              onClick={() => openDrilldown(item.account_code)}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                            >
                              Drill-Down
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Operating Profit Subtotal */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">Operating Profit (Operating Income - Operating Expenses)</span>
                <span className="text-xs text-slate-400">Core clinical operational performance prior to financing and taxes</span>
              </div>
              <span className={`text-base font-bold font-mono ${parseFloat(statementData?.operating_profit || '0') >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                {formatCurrency(statementData?.operating_profit)}
              </span>
            </div>

            {/* 4. Non-Operating & Financing Items */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
              <button
                onClick={() => toggleSection('non_op')}
                className="w-full px-4 py-3 bg-slate-900 flex items-center justify-between text-left hover:bg-slate-850 transition"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.non_op ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                  <span className="text-xs font-bold text-white uppercase tracking-wider">IV. Non-Operating Items & Financing Costs</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-emerald-400">Inc: {formatCurrency(statementData?.total_non_operating_revenue)}</span>
                  <span className="text-rose-400">Financing: {formatCurrency(statementData?.financing_costs)}</span>
                </div>
              </button>

              {expandedSections.non_op && (
                <div className="p-4 space-y-4">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Non-Operating Income</span>
                    <table className="w-full text-left text-xs">
                      <tbody>
                        {(statementData?.non_operating_revenues || []).map((item: any, i: number) => (
                          <tr key={i} className="border-b border-slate-850/60">
                            <td className="py-1.5 font-mono text-cyan-400">{item.account_code}</td>
                            <td className="py-1.5 text-slate-200">{item.account_name}</td>
                            <td className="py-1.5 font-mono text-emerald-400 text-right">{formatCurrency(item.net_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Financing & Banking Costs</span>
                    <table className="w-full text-left text-xs">
                      <tbody>
                        {(statementData?.financing_and_tax_expenses || []).filter((x: any) => x.account_code !== '5080').map((item: any, i: number) => (
                          <tr key={i} className="border-b border-slate-850/60">
                            <td className="py-1.5 font-mono text-cyan-400">{item.account_code}</td>
                            <td className="py-1.5 text-slate-200">{item.account_name}</td>
                            <td className="py-1.5 font-mono text-rose-300 text-right">{formatCurrency(item.net_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Profit Before Tax Subtotal */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">Profit Before Tax (PBT)</span>
                <span className="text-xs text-slate-400">Total hospital earnings before income tax expense</span>
              </div>
              <span className={`text-base font-bold font-mono ${parseFloat(statementData?.profit_before_tax || '0') >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                {formatCurrency(statementData?.profit_before_tax)}
              </span>
            </div>

            {/* Final Net Profit */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider block">V. Bottom Line Net Profit / (Loss)</span>
                <span className="text-xs text-slate-400">After Provision for Corporate Taxes (Account 5080: {formatCurrency(statementData?.tax_expense)})</span>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-bold font-mono ${parseFloat(statementData?.net_profit || '0') >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(statementData?.net_profit)}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Reconciled with General Ledger Retained Surplus</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEPARTMENT PROFITABILITY */}
      {activeTab === 'departments' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-emerald-400" />
                Department-Wise Financial Performance & Profitability
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Direct departmental revenues, direct costs, and transparent shared overhead allocations.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Shared Overhead: {formatCurrency(departmentData?.total_shared_overhead)}
            </div>
          </div>

          {/* Allocation Policy Alert */}
          <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <span className="font-bold text-cyan-400 block">{departmentData?.allocation_policy}</span>
              <p className="text-slate-400 leading-relaxed font-mono">
                {departmentData?.allocation_formula}
              </p>
              <p className="text-[11px] text-slate-500">
                Direct departmental expenses are charged directly. Common campus overhead (rent, electricity, unassigned administration) is distributed proportionally by departmental revenue contribution.
              </p>
            </div>
          </div>

          {/* Department Performance Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800 pb-3">
                  <th className="pb-3 font-semibold">Department</th>
                  <th className="pb-3 font-semibold text-right">Direct Revenue</th>
                  <th className="pb-3 font-semibold text-right">Direct Costs</th>
                  <th className="pb-3 font-semibold text-right">Allocated Overhead</th>
                  <th className="pb-3 font-semibold text-right">Total Expenses</th>
                  <th className="pb-3 font-semibold text-right">Operating Profit / (Loss)</th>
                  <th className="pb-3 font-semibold text-right">Margin %</th>
                  <th className="pb-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {(departmentData?.departments || []).map((d: any, idx: number) => {
                  const profit = parseFloat(d.operating_profit);
                  const isProfitable = profit > 0;
                  const isZero = profit === 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-3">
                        <div className="font-bold text-white">{d.name}</div>
                        <span className="text-[10px] text-slate-500 font-mono">{d.code}</span>
                      </td>
                      <td className="py-3 font-mono font-semibold text-emerald-400 text-right">
                        {formatCurrency(d.revenue)}
                      </td>
                      <td className="py-3 font-mono text-slate-300 text-right">
                        {formatCurrency(d.direct_expenses)}
                      </td>
                      <td className="py-3 font-mono text-amber-400/90 text-right">
                        {formatCurrency(d.allocated_overhead)}
                      </td>
                      <td className="py-3 font-mono text-rose-300 text-right">
                        {formatCurrency(d.total_expenses)}
                      </td>
                      <td className={`py-3 font-mono font-bold text-right ${isProfitable ? 'text-emerald-400' : (isZero ? 'text-slate-400' : 'text-rose-400')}`}>
                        {formatCurrency(d.operating_profit)}
                      </td>
                      <td className="py-3 font-mono text-slate-300 text-right">
                        {d.profit_margin_pct}%
                      </td>
                      <td className="py-3 text-center">
                        <Badge variant={isProfitable ? 'success' : (isZero ? 'neutral' : 'danger')}>
                          {d.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: BRANCH PERFORMANCE */}
      {activeTab === 'branches' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                Multi-Branch Financial Performance & Consolidation
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Branch-wise revenues, expenditures, and margins with inter-branch transfers eliminated.
              </p>
            </div>
            <Badge variant="cyan">Inter-Branch Contra Eliminated</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(branchData?.branches || []).map((br: any, idx: number) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{br.branch_name}</h3>
                    <span className="text-[10px] text-slate-500 font-mono">Code: {br.branch_code}</span>
                  </div>
                  {br.is_main_branch && <Badge variant="accent">Central Campus</Badge>}
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Revenue</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">{formatCurrency(br.revenue)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Expenses</span>
                    <span className="text-xs font-bold text-rose-400 font-mono">{formatCurrency(br.expenses)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Operating Margin</span>
                    <span className="text-xs font-bold text-cyan-400 font-mono">{br.profit_margin_pct}%</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Major Revenue Source:</span>
                    <span className="text-slate-200 font-semibold">{br.major_revenue_source}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Major Cost Driver:</span>
                    <span className="text-slate-200 font-semibold">{br.major_expense_category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drilldown Modal */}
      {drilldownModalOpen && (
        <Modal
          isOpen={drilldownModalOpen}
          onClose={() => setDrilldownModalOpen(false)}
          title={`Ledger Drill-Down: ${drilldownData?.account?.name || 'Account Entries'} (${drilldownData?.account?.code || ''})`}
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Classification: <span className="text-cyan-400 font-semibold">{drilldownData?.account?.classification}</span>
              </span>
              <span className="text-slate-400 font-mono">
                Net Period Movement: <span className="text-emerald-400 font-bold">{formatCurrency(drilldownData?.net_movement)}</span>
              </span>
            </div>

            {drilldownLoading ? (
              <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading journal lines from Supabase...</div>
            ) : (drilldownData?.journal_lines || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No posted journal lines found for this account in the selected period.</div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 pb-2">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Voucher #</th>
                      <th className="pb-2">Narration</th>
                      <th className="pb-2">Source</th>
                      <th className="pb-2 text-right">Debit</th>
                      <th className="pb-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {(drilldownData?.journal_lines || []).map((l: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-900/50">
                        <td className="py-2 text-slate-400 whitespace-nowrap">{l.entry_date}</td>
                        <td className="py-2 font-mono text-cyan-400 whitespace-nowrap">{l.voucher_number}</td>
                        <td className="py-2 text-slate-200 max-w-xs truncate">{l.narration}</td>
                        <td className="py-2 text-slate-400 text-[11px]">{l.source_module}</td>
                        <td className="py-2 font-mono text-slate-300 text-right">₹{parseFloat(l.debit).toLocaleString()}</td>
                        <td className="py-2 font-mono text-slate-300 text-right">₹{parseFloat(l.credit).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
