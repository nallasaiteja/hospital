import React, { useState, useEffect } from 'react';
import {
  Target,
  RefreshCw,
  Download,
  Calendar,
  Building2,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  ShieldAlert,
  Activity,
  PlusCircle,
  Edit2,
  CreditCard,
  Landmark,
  PiggyBank
} from 'lucide-react';
import api, { billingFinanceService } from '../../services/api';
import { AlertBanner } from '../../components/common/AlertBanner';
import { Modal } from '../../components/common/Modal';
import { parseApiError } from '../../utils/errorHandler';

type ActiveTab = 'dashboard' | 'forecast' | 'actuals' | 'collections' | 'obligations' | 'budgets';
type CollectionsSubTab = 'patients' | 'insurance';
type ObligationsSubTab = 'suppliers' | 'payroll_tax' | 'loans' | 'investments';
type BudgetsSubTab = 'variance' | 'capex' | 'thresholds';

export const BudgetingPage: React.FC = () => {
  // Navigation & Sub-navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [collectionsSubTab, setCollectionsSubTab] = useState<CollectionsSubTab>('patients');
  const [obligationsSubTab, setObligationsSubTab] = useState<ObligationsSubTab>('suppliers');
  const [budgetsSubTab, setBudgetsSubTab] = useState<BudgetsSubTab>('variance');

  // Filter States
  const [periodPreset, setPeriodPreset] = useState<'TODAY' | 'THIS_MONTH' | 'THIS_QUARTER' | 'FY' | 'CUSTOM'>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [horizonDays, setHorizonDays] = useState<number>(30);
  const [branches, setBranches] = useState<any[]>([]);

  // Main Data States
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [forecastData, setForecastData] = useState<any | null>(null);
  const [actualsData, setActualsData] = useState<any | null>(null);
  const [patientCollections, setPatientCollections] = useState<any | null>(null);
  const [insuranceReceipts, setInsuranceReceipts] = useState<any | null>(null);
  const [supplierSchedules, setSupplierSchedules] = useState<any | null>(null);
  const [payrollTaxSchedules, setPayrollTaxSchedules] = useState<any | null>(null);
  const [loanForecasts, setLoanForecasts] = useState<any | null>(null);
  const [investmentForecasts, setInvestmentForecasts] = useState<any | null>(null);
  const [budgetVariance, setBudgetVariance] = useState<any | null>(null);
  const [capexPlans, setCapexPlans] = useState<any[]>([]);
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  // UI / Action States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [selectedSupplierItem, setSelectedSupplierItem] = useState<any | null>(null);
  const [plannedPaymentDate, setPlannedPaymentDate] = useState('');

  const [capexModalOpen, setCapexModalOpen] = useState(false);
  const [selectedCapexItem, setSelectedCapexItem] = useState<any | null>(null);

  const [createCapexModalOpen, setCreateCapexModalOpen] = useState(false);
  const [newCapex, setNewCapex] = useState({
    project_name: '',
    estimated_cost: '',
    expected_purchase_date: '',
    business_justification: ''
  });

  const [createBudgetModalOpen, setCreateBudgetModalOpen] = useState(false);
  const [newBudget, setNewBudget] = useState({
    fiscal_year: '2026-2027',
    period_type: 'ANNUAL',
    total_budget_amount: '',
    notes_assumptions: ''
  });

  // Calculate default dates for presets
  const applyDatePreset = (preset: 'TODAY' | 'THIS_MONTH' | 'THIS_QUARTER' | 'FY') => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-indexed

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const formatDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    if (preset === 'TODAY') {
      const todayStr = formatDate(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
      setPeriodPreset('TODAY');
    } else if (preset === 'THIS_MONTH') {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      setStartDate(formatDate(start));
      setEndDate(formatDate(end));
      setPeriodPreset('THIS_MONTH');
    } else if (preset === 'THIS_QUARTER') {
      const qStartMonth = Math.floor(m / 3) * 3;
      const start = new Date(y, qStartMonth, 1);
      const end = new Date(y, qStartMonth + 3, 0);
      setStartDate(formatDate(start));
      setEndDate(formatDate(end));
      setPeriodPreset('THIS_QUARTER');
    } else if (preset === 'FY') {
      const fyStartYear = m >= 3 ? y : y - 1;
      const start = new Date(fyStartYear, 3, 1);
      const end = new Date(fyStartYear + 1, 2, 31);
      setStartDate(formatDate(start));
      setEndDate(formatDate(end));
      setPeriodPreset('FY');
    }
  };

  // Initial load
  useEffect(() => {
    applyDatePreset('THIS_MONTH');
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      const res = await api.get('/core/branches/');
      setBranches(res.data?.results || res.data || []);
    } catch (e) {
      console.warn('Branches load error:', e);
    }
  };

  // Main data loader
  const loadActiveData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        horizon_days: horizonDays
      };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (selectedBranch) params.branch_id = selectedBranch;

      // Always load dashboard metrics + alerts
      const [dash, alertRes, threshRes] = await Promise.all([
        billingFinanceService.getCashFlowDashboard(params),
        billingFinanceService.getLiquidityAlerts(params),
        billingFinanceService.getMinimumCashThresholds()
      ]);
      setDashboardData(dash);
      setAlerts(alertRes?.results || alertRes || []);
      setThresholds(threshRes?.results || threshRes || []);

      // Load specific tab data based on active tab
      if (activeTab === 'forecast') {
        const fc = await billingFinanceService.getCashFlowForecast(params);
        setForecastData(fc);
      } else if (activeTab === 'actuals') {
        const act = await billingFinanceService.getCashFlowActualBreakdown(params);
        setActualsData(act);
      } else if (activeTab === 'collections') {
        const [pat, ins] = await Promise.all([
          billingFinanceService.getExpectedPatientCollections(params),
          billingFinanceService.getExpectedInsuranceReceipts(params)
        ]);
        setPatientCollections(pat);
        setInsuranceReceipts(ins);
      } else if (activeTab === 'obligations') {
        const [supp, pay, lns, inv] = await Promise.all([
          billingFinanceService.getSupplierPaymentSchedules(params),
          billingFinanceService.getPayrollTaxSchedules(params),
          billingFinanceService.getLoanRepaymentForecasts(params),
          billingFinanceService.getInvestmentMaturityForecasts(params)
        ]);
        setSupplierSchedules(supp);
        setPayrollTaxSchedules(pay);
        setLoanForecasts(lns);
        setInvestmentForecasts(inv);
      } else if (activeTab === 'budgets') {
        const [bv, cpx] = await Promise.all([
          billingFinanceService.getBudgetVarianceReport(params),
          billingFinanceService.getCapexPlans(params)
        ]);
        setBudgetVariance(bv);
        setCapexPlans(cpx?.results || cpx || []);
      }
    } catch (err: any) {
      console.error('Error loading cash flow data:', err);
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadActiveData();
    }
  }, [activeTab, startDate, endDate, selectedBranch, horizonDays]);

  // Actions
  const handleExportCsv = async () => {
    try {
      const params: any = {
        start_date: startDate,
        end_date: endDate,
        horizon_days: horizonDays
      };
      if (selectedBranch) params.branch_id = selectedBranch;
      const csvBlob = await billingFinanceService.exportCashFlowCsv(params);
      const url = window.URL.createObjectURL(new Blob([csvBlob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cash_Flow_Financial_Report_${startDate}_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e: any) {
      setError(parseApiError(e).message);
    }
  };

  const handleUpdateSupplierDate = async () => {
    if (!selectedSupplierItem || !plannedPaymentDate) return;
    try {
      setActionLoading(true);
      await billingFinanceService.updateSupplierPlannedPaymentDate({
        schedule_id: selectedSupplierItem.schedule_id,
        planned_payment_date: plannedPaymentDate
      });
      setSuccessMsg(`Updated planned payment date for ${selectedSupplierItem.schedule_reference || selectedSupplierItem.invoice_number}`);
      setSupplierModalOpen(false);
      setSelectedSupplierItem(null);
      loadActiveData();
    } catch (e: any) {
      setError(parseApiError(e).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveCapex = async () => {
    if (!selectedCapexItem) return;
    try {
      setActionLoading(true);
      await billingFinanceService.approveCapexPlan(selectedCapexItem.capex_id || selectedCapexItem.id);
      setSuccessMsg(`Approved CapEx proposal: ${selectedCapexItem.project_name}`);
      setCapexModalOpen(false);
      setSelectedCapexItem(null);
      loadActiveData();
    } catch (e: any) {
      setError(parseApiError(e).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCapex = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await billingFinanceService.createCapexPlan({
        project_name: newCapex.project_name,
        estimated_cost: parseFloat(newCapex.estimated_cost),
        expected_purchase_date: newCapex.expected_purchase_date,
        business_justification: newCapex.business_justification,
        branch: selectedBranch || undefined
      });
      setSuccessMsg(`Created CapEx proposal: ${newCapex.project_name}`);
      setCreateCapexModalOpen(false);
      setNewCapex({
        project_name: '',
        estimated_cost: '',
        expected_purchase_date: '',
        business_justification: ''
      });
      loadActiveData();
    } catch (e: any) {
      setError(parseApiError(e).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await billingFinanceService.createFinancialBudget({
        fiscal_year: newBudget.fiscal_year,
        period_type: newBudget.period_type,
        total_budget_amount: parseFloat(newBudget.total_budget_amount),
        notes_assumptions: newBudget.notes_assumptions,
        branch: selectedBranch || undefined
      });
      setSuccessMsg(`Created budget for ${newBudget.fiscal_year}`);
      setCreateBudgetModalOpen(false);
      setNewBudget({
        fiscal_year: '2026-2027',
        period_type: 'ANNUAL',
        total_budget_amount: '',
        notes_assumptions: ''
      });
      loadActiveData();
    } catch (e: any) {
      setError(parseApiError(e).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await billingFinanceService.acknowledgeLiquidityAlert(alertId);
      setSuccessMsg('Liquidity alert acknowledged.');
      loadActiveData();
    } catch (e: any) {
      setError(parseApiError(e).message);
    }
  };

  // Helper formatters
  const fmt = (val: number | string | null | undefined) => {
    if (val === null || val === undefined || isNaN(Number(val))) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const metrics = dashboardData?.summary_metrics || {};
  const balances = dashboardData?.opening_closing_balances || {};
  const alertCount = dashboardData?.liquidity_position?.active_alerts_count || alerts.length || 0;
  const accountsBelow = dashboardData?.liquidity_position?.accounts_below_threshold || 0;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Target className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
                Cash Flow & Financial Planning
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Section 19 Treasury Engine
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Multi-specialty hospital treasury monitoring, reconciled cash & bank balances, obligations schedules, and budget variances.
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar: Date Presets, Branch, Horizon & Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Date Presets */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <button
              onClick={() => applyDatePreset('TODAY')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                periodPreset === 'TODAY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => applyDatePreset('THIS_MONTH')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                periodPreset === 'THIS_MONTH' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => applyDatePreset('THIS_QUARTER')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                periodPreset === 'THIS_QUARTER' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Quarter
            </button>
            <button
              onClick={() => applyDatePreset('FY')}
              className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                periodPreset === 'FY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              FY 26-27
            </button>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPeriodPreset('CUSTOM');
              }}
              className="bg-transparent text-slate-200 focus:outline-none text-xs"
            />
            <span className="text-slate-600">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodPreset('CUSTOM');
              }}
              className="bg-transparent text-slate-200 focus:outline-none text-xs"
            />
          </div>

          {/* Horizon Selector */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400 font-medium">Forecast:</span>
            <select
              value={horizonDays}
              onChange={(e) => setHorizonDays(Number(e.target.value))}
              className="bg-transparent text-slate-200 focus:outline-none text-xs font-semibold"
            >
              <option value={30} className="bg-slate-900 text-slate-200">30 Days</option>
              <option value={60} className="bg-slate-900 text-slate-200">60 Days</option>
              <option value={90} className="bg-slate-900 text-slate-200">90 Days</option>
              <option value={180} className="bg-slate-900 text-slate-200">180 Days</option>
            </select>
          </div>

          {/* Branch Filter */}
          {branches.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none text-xs"
              >
                <option value="" className="bg-slate-900 text-slate-200">All Hospital Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={loadActiveData}
            disabled={loading}
            className="p-2 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            Export GAAP CSV
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Top Executive Summary Cards (Reconciliation Core) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Opening Combined Balance */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              1. Combined Opening Cash & Bank
            </span>
            <div className="p-2 bg-slate-800 rounded-lg text-slate-300">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-100 mt-2">
            {fmt(balances.combined_opening_balance)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800/80">
            <span>Cash: <strong className="text-slate-300">{fmt(balances.opening_cash_balance)}</strong></span>
            <span>Bank: <strong className="text-slate-300">{fmt(balances.opening_bank_balance)}</strong></span>
          </div>
        </div>

        {/* Card 2: Actual Inflows */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              2. Actual Cash Inflows (Period)
            </span>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">
            +{fmt(balances.total_receipts)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800/80">
            <span>Cash Rcpts: <strong className="text-emerald-400">{fmt(balances.cash_receipts)}</strong></span>
            <span>Bank Rcpts: <strong className="text-emerald-400">{fmt(balances.bank_receipts)}</strong></span>
          </div>
        </div>

        {/* Card 3: Actual Outflows */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              3. Actual Cash Outflows (Period)
            </span>
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-2">
            -{fmt(balances.total_payments)}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800/80">
            <span>Cash Pmts: <strong className="text-rose-400">{fmt(balances.cash_payments)}</strong></span>
            <span>Bank Pmts: <strong className="text-rose-400">{fmt(balances.bank_payments)}</strong></span>
          </div>
        </div>

        {/* Card 4: Closing Combined Balance */}
        <div className="bg-slate-900/90 border border-indigo-900/40 rounded-xl p-4 relative overflow-hidden shadow-lg shadow-indigo-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
              4. Combined Closing Cash & Bank
            </span>
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-200 mt-2">
            {fmt(balances.combined_closing_balance)}
          </p>
          <div className="flex items-center justify-between text-xs text-indigo-300/80 mt-3 pt-2 border-t border-indigo-900/50">
            <span>Net Change: <strong className={(balances.net_cash_change || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {(balances.net_cash_change || 0) >= 0 ? '+' : ''}{fmt(balances.net_cash_change)}
            </strong></span>
            <span>Transfers: <strong className="text-slate-300">{fmt(balances.net_internal_transfers)}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-800">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'dashboard'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            1. Treasury Dashboard (17 Metrics)
          </button>

          <button
            onClick={() => setActiveTab('forecast')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'forecast'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            2. Cash Flow Forecast ({horizonDays}d Horizon)
          </button>

          <button
            onClick={() => setActiveTab('actuals')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'actuals'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            3. Direct Cash Flow Activities
          </button>

          <button
            onClick={() => setActiveTab('collections')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'collections'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            4. Inflow Schedules (Patient & Insurance)
          </button>

          <button
            onClick={() => setActiveTab('obligations')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'obligations'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            5. Obligations Calendar (Suppliers, Payroll, Debt)
          </button>

          <button
            onClick={() => setActiveTab('budgets')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'budgets'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Target className="w-4 h-4" />
            6. Budgets, CapEx & Liquidity
            {alertCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                {alertCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TREASURY DASHBOARD & 17 MANDATORY METRICS                          */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Section: Reconciled Cash & Bank Accounts Drill-down */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-indigo-400" />
                  Cash & Bank Accounts Reconciliation
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Opening balance + Receipts − Payments ± Internal transfers = Closing ledger balance.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {balances.accounts_breakdown?.length || 0} Accounts Monitored
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Account Code & Name</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3 text-right">Opening Balance</th>
                    <th className="py-3 px-3 text-right text-emerald-400">Total Receipts (+)</th>
                    <th className="py-3 px-3 text-right text-rose-400">Total Payments (−)</th>
                    <th className="py-3 px-3 text-right text-indigo-400">Transfers Net</th>
                    <th className="py-3 px-3 text-right font-bold text-slate-100">Closing Balance</th>
                    <th className="py-3 px-4 text-center">Reconciliation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(balances.accounts_breakdown || []).map((acc: any) => (
                    <tr key={acc.account_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-200">
                        <div>{acc.account_name}</div>
                        <span className="text-[11px] text-slate-500 font-mono">{acc.account_code}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {acc.account_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">{fmt(acc.opening_balance)}</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-400">+{fmt(acc.receipts)}</td>
                      <td className="py-3 px-3 text-right font-mono text-rose-400">-{fmt(acc.payments)}</td>
                      <td className="py-3 px-3 text-right font-mono text-indigo-400">
                        {acc.transfers_net >= 0 ? `+${fmt(acc.transfers_net)}` : fmt(acc.transfers_net)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-100">{fmt(acc.closing_balance)}</td>
                      <td className="py-3 px-4 text-center">
                        {acc.is_reconciled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Reconciled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            <Clock className="w-3 h-3" /> Ledger Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!balances.accounts_breakdown || balances.accounts_breakdown.length === 0) && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 text-sm">
                        No financial accounts recorded for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: 17 Mandatory Real-Time Database Metrics */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Comprehensive 17 Cash Flow & Financial Planning Metrics
              </h2>
              <span className="text-xs text-slate-400">
                Calculated strictly from database tables (Invoices, Claims, Purchase Orders, Loans, Investments, Budgets)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Metric 5 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  5. Expected Patient Collections
                </span>
                <p className="text-xl font-bold text-emerald-400 mt-1">{fmt(metrics.expected_patient_collections)}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Outstanding Invoices</span>
                  <span className="text-slate-300 font-mono">{metrics.expected_patient_collections_count || 0} bills</span>
                </div>
              </div>

              {/* Metric 6 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  6. Expected Insurance Receipts
                </span>
                <p className="text-xl font-bold text-emerald-400 mt-1">{fmt(metrics.expected_insurance_receipts)}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Pending TPA Claims</span>
                  <span className="text-slate-300 font-mono">{metrics.expected_insurance_receipts_count || 0} claims</span>
                </div>
              </div>

              {/* Metric 7 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  7. Scheduled Supplier Payments
                </span>
                <p className="text-xl font-bold text-rose-400 mt-1">{fmt(metrics.scheduled_supplier_payments)}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Payables in {horizonDays}d</span>
                  <span className="text-slate-300 font-mono">{metrics.scheduled_supplier_payments_count || 0} orders</span>
                </div>
              </div>

              {/* Metric 8 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  8. Upcoming Payroll Payments
                </span>
                <p className="text-xl font-bold text-rose-400 mt-1">{fmt(metrics.upcoming_payroll_payments)}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Doctors, Nurses, Staff</span>
                  <span className="text-slate-300 font-mono">{metrics.upcoming_payroll_count || 0} cycles</span>
                </div>
              </div>

              {/* Metric 9 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  9. Upcoming Tax & Statutory Payments
                </span>
                <p className="text-xl font-bold text-rose-400 mt-1">{fmt(metrics.upcoming_tax_statutory_payments)}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>GST, TDS, PF, ESI</span>
                  <span className="text-slate-300 font-mono">{metrics.upcoming_tax_count || 0} filings</span>
                </div>
              </div>

              {/* Metric 10 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  10. Upcoming Loan Repayments
                </span>
                <p className="text-xl font-bold text-rose-400 mt-1">{fmt(metrics.upcoming_loan_repayments)}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Equip & Term Facilities</span>
                  <span className="text-slate-300 font-mono">{metrics.upcoming_loan_installments_count || 0} EMIs</span>
                </div>
              </div>

              {/* Metric 11 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  11. Expected Investment Maturities
                </span>
                <p className="text-xl font-bold text-emerald-400 mt-1">{fmt(metrics.expected_investment_maturities)}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Fixed Deposits / Bonds</span>
                  <span className="text-slate-300 font-mono">{metrics.expected_investment_maturities_count || 0} items</span>
                </div>
              </div>

              {/* Metric 12 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  12. Total Monthly Budget
                </span>
                <p className="text-xl font-bold text-slate-100 mt-1">{fmt(metrics.total_monthly_budget)}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Fiscal Allocation</span>
                  <span className="text-indigo-400 font-medium">All Departments</span>
                </div>
              </div>

              {/* Metric 13 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  13. Actual Spending vs Budget
                </span>
                <p className="text-xl font-bold text-amber-400 mt-1">{fmt(metrics.actual_spending_against_budget)}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Utilization</span>
                  <span className="text-slate-300 font-mono">
                    {metrics.total_monthly_budget > 0
                      ? `${((metrics.actual_spending_against_budget / metrics.total_monthly_budget) * 100).toFixed(1)}%`
                      : '0%'}
                  </span>
                </div>
              </div>

              {/* Metric 14 */}
              <div className="bg-slate-900 border border-indigo-900/40 rounded-xl p-4 hover:border-indigo-700 transition-colors">
                <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider block">
                  14. Forecast Cash Balance ({horizonDays}d)
                </span>
                <p className="text-xl font-bold text-indigo-200 mt-1">{fmt(metrics.forecast_cash_balance)}</p>
                <div className="flex items-center justify-between text-[11px] text-indigo-300/80 mt-2">
                  <span>Projection Basis</span>
                  <span className="font-medium">Opening + Inflows − Outflows</span>
                </div>
              </div>

              {/* Metric 15 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  15. Upcoming Financial Obligations
                </span>
                <p className="text-xl font-bold text-rose-400 mt-1">{fmt(metrics.upcoming_financial_obligations)}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Supplier + Payroll + Loan</span>
                  <span className="text-slate-400 font-mono">{horizonDays} Days</span>
                </div>
              </div>

              {/* Metric 16 & 17 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  16 & 17. Liquidity Alerts & Breach
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className={`text-xl font-bold ${alertCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {alertCount} Alerts
                  </p>
                  <span className="text-xs text-slate-400">/ {accountsBelow} below threshold</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Safety Status</span>
                  <span className={alertCount > 0 ? 'text-rose-400 font-medium' : 'text-emerald-400 font-medium'}>
                    {alertCount > 0 ? 'Action Required' : 'Adequate Liquidity'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CASH FLOW FORECASTING & TIMELINE                                   */}
      {/* ========================================================================= */}
      {activeTab === 'forecast' && (
        <div className="space-y-6">
          {/* Forecast Header & Parameters */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  {horizonDays}-Day Rolling Cash Flow Forecast Engine
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Calculated from current available cash, scheduled invoice collections, expected insurance turnarounds, planned payables, payroll commitments, and loan installments.
                </p>
              </div>

              <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block">Forecast Closing Cash:</span>
                  <span className="text-sm font-bold text-indigo-300 font-mono">
                    {fmt(forecastData?.forecast_ending_cash || metrics.forecast_cash_balance)}
                  </span>
                </div>
                <div className="h-7 w-[1px] bg-slate-800" />
                <div>
                  <span className="text-slate-500 block">Opening Cash:</span>
                  <span className="text-sm font-bold text-slate-200 font-mono">
                    {fmt(forecastData?.opening_available_cash || balances.combined_closing_balance)}
                  </span>
                </div>
                <div className="h-7 w-[1px] bg-slate-800" />
                <div>
                  <span className="text-slate-500 block">Minimum Liquidity Line:</span>
                  <span className="text-sm font-bold text-amber-400 font-mono">
                    {fmt(forecastData?.minimum_safety_threshold || 1000000)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Projections Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                Daily Projected Inflow vs Outflow Cash Forecast Timeline
              </h3>
              <span className="text-xs text-slate-400">
                {(forecastData?.timeline || []).length} Daily Forecast Intervals
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Day</th>
                    <th className="py-3 px-3 text-right text-emerald-400">Projected Inflows (+)</th>
                    <th className="py-3 px-3 text-right text-rose-400">Scheduled Outflows (−)</th>
                    <th className="py-3 px-3 text-right">Net Flow</th>
                    <th className="py-3 px-3 text-right font-bold text-slate-100">Projected Closing Cash</th>
                    <th className="py-3 px-4 text-center">Safety Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(forecastData?.timeline || []).map((row: any, idx: number) => {
                    const isBelow = row.is_below_safety_margin;
                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-200">
                          {row.date}
                        </td>
                        <td className="py-3 px-3 text-slate-400">{row.day_name}</td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400">+{fmt(row.inflows)}</td>
                        <td className="py-3 px-3 text-right font-mono text-rose-400">-{fmt(row.outflows)}</td>
                        <td className="py-3 px-3 text-right font-mono font-medium">
                          <span className={row.net_change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {row.net_change >= 0 ? '+' : ''}{fmt(row.net_change)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-100">{fmt(row.forecast_closing_balance)}</td>
                        <td className="py-3 px-4 text-center">
                          {isBelow ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              <AlertTriangle className="w-3 h-3" /> Below Threshold
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Safe Reserve
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(!forecastData?.timeline || forecastData.timeline.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-sm">
                        No forecast timeline records available for the selected horizon.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DIRECT CASH FLOW ACTIVITIES (GAAP BREAKDOWN)                       */}
      {/* ========================================================================= */}
      {activeTab === 'actuals' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Direct Method Cash Flow Statement (GAAP Compliant)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Classified into Operating, Investing, and Financing activities from posted financial transactions. Interaccount internal transfers are separated to prevent double-counting.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Operating Activities */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">1. Operating Cash Flow</h3>
                  <span className="text-[11px] text-slate-500">Hospital healthcare operations</span>
                </div>
                <span className={`text-xs font-bold font-mono px-2 py-1 rounded ${
                  (actualsData?.operating_activities?.net_operating_cash_flow || 0) >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {fmt(actualsData?.operating_activities?.net_operating_cash_flow)}
                </span>
              </div>
              <div className="p-4 space-y-3 flex-1 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Operating Receipts (+)</span>
                  <div className="space-y-1.5 pl-2 border-l border-slate-800">
                    <div className="flex justify-between text-slate-300">
                      <span>Total Operating Collections</span>
                      <span className="font-mono text-emerald-400">+{fmt(actualsData?.operating_activities?.inflows?.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 font-semibold block mb-1">Operating Payments (−)</span>
                  <div className="space-y-1.5 pl-2 border-l border-slate-800">
                    <div className="flex justify-between text-slate-300">
                      <span>Total Operating Disbursements</span>
                      <span className="font-mono text-rose-400">-{fmt(actualsData?.operating_activities?.outflows?.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Investing Activities */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">2. Investing Cash Flow</h3>
                  <span className="text-[11px] text-slate-500">CapEx equipment & investments</span>
                </div>
                <span className={`text-xs font-bold font-mono px-2 py-1 rounded ${
                  (actualsData?.investing_activities?.net_investing_cash_flow || 0) >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {fmt(actualsData?.investing_activities?.net_investing_cash_flow)}
                </span>
              </div>
              <div className="p-4 space-y-3 flex-1 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Investing Receipts (+)</span>
                  <div className="space-y-1.5 pl-2 border-l border-slate-800">
                    <div className="flex justify-between text-slate-300">
                      <span>Investment Maturities & Sales</span>
                      <span className="font-mono text-emerald-400">+{fmt(actualsData?.investing_activities?.inflows?.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 font-semibold block mb-1">Investing Payments (−)</span>
                  <div className="space-y-1.5 pl-2 border-l border-slate-800">
                    <div className="flex justify-between text-slate-300">
                      <span>CapEx & Investment Purchases</span>
                      <span className="font-mono text-rose-400">-{fmt(actualsData?.investing_activities?.outflows?.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Financing Activities */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">3. Financing Cash Flow</h3>
                  <span className="text-[11px] text-slate-500">Borrowings, principal repayments, interest</span>
                </div>
                <span className={`text-xs font-bold font-mono px-2 py-1 rounded ${
                  (actualsData?.financing_activities?.net_financing_cash_flow || 0) >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {fmt(actualsData?.financing_activities?.net_financing_cash_flow)}
                </span>
              </div>
              <div className="p-4 space-y-3 flex-1 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Financing Receipts (+)</span>
                  <div className="space-y-1.5 pl-2 border-l border-slate-800">
                    <div className="flex justify-between text-slate-300">
                      <span>Loan Disbursements Received</span>
                      <span className="font-mono text-emerald-400">+{fmt(actualsData?.financing_activities?.inflows?.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 font-semibold block mb-1">Financing Payments (−)</span>
                  <div className="space-y-1.5 pl-2 border-l border-slate-800">
                    <div className="flex justify-between text-slate-300">
                      <span>Loan Principal & Interest Repayments</span>
                      <span className="font-mono text-rose-400">-{fmt(actualsData?.financing_activities?.outflows?.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: INFLOW SCHEDULES (PATIENTS & INSURANCE)                            */}
      {/* ========================================================================= */}
      {activeTab === 'collections' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex space-x-2">
              <button
                onClick={() => setCollectionsSubTab('patients')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  collectionsSubTab === 'patients'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Patient Invoices Schedule ({patientCollections?.schedules?.length || 0})
              </button>
              <button
                onClick={() => setCollectionsSubTab('insurance')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  collectionsSubTab === 'insurance'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Insurance & TPA Claims Schedule ({insuranceReceipts?.schedules?.length || 0})
              </button>
            </div>

            <div className="text-xs text-slate-400 font-medium">
              Total Expected Collections: <strong className="text-emerald-400 font-mono">
                {fmt((patientCollections?.total_forecast_amount || 0) + (insuranceReceipts?.total_forecast_receipt || 0))}
              </strong>
            </div>
          </div>

          {/* Sub-tab 1: Patient Invoices */}
          {collectionsSubTab === 'patients' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Outstanding Patient Invoices & Expected Turnaround
                  </h3>
                  <span className="text-xs text-slate-400">
                    Total Invoiced: {fmt(patientCollections?.total_invoiced_amount)} | Outstanding Receivables: {fmt(patientCollections?.total_outstanding_receivables)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Forecast Realization:</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {fmt(patientCollections?.total_forecast_amount)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-3">Patient Name</th>
                      <th className="py-3 px-3">Invoice Date</th>
                      <th className="py-3 px-3">Due Date</th>
                      <th className="py-3 px-3 text-right">Invoiced Amount</th>
                      <th className="py-3 px-3 text-right">Paid</th>
                      <th className="py-3 px-3 text-right font-bold text-amber-400">Outstanding</th>
                      <th className="py-3 px-3 text-right font-bold text-emerald-400">Forecast Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(patientCollections?.schedules || []).map((inv: any) => (
                      <tr key={inv.invoice_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-indigo-300">{inv.invoice_number}</td>
                        <td className="py-3 px-3 text-slate-200 font-medium">{inv.patient_name}</td>
                        <td className="py-3 px-3 text-slate-400">{inv.invoice_date}</td>
                        <td className="py-3 px-3 text-slate-400">{inv.due_date || 'On Discharge'}</td>
                        <td className="py-3 px-3 text-right font-mono">{fmt(inv.total_amount)}</td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400">{fmt(inv.paid_amount)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">{fmt(inv.outstanding_balance)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">{fmt(inv.forecast_collection)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!patientCollections?.schedules || patientCollections.schedules.length === 0) && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 text-sm">
                          No outstanding patient invoices in this forecast window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 2: Insurance Claims */}
          {collectionsSubTab === 'insurance' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Pending Insurance Claims & Expected Settlement
                  </h3>
                  <span className="text-xs text-slate-400">
                    Total Submitted: {fmt(insuranceReceipts?.total_claim_amount)} | Approved: {fmt(insuranceReceipts?.total_approved_amount)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Forecast Inflow:</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {fmt(insuranceReceipts?.total_forecast_receipt)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Claim #</th>
                      <th className="py-3 px-3">Insurer / TPA Provider</th>
                      <th className="py-3 px-3">Submission Date</th>
                      <th className="py-3 px-3">Expected Date</th>
                      <th className="py-3 px-3 text-right">Submitted</th>
                      <th className="py-3 px-3 text-right">Approved</th>
                      <th className="py-3 px-3 text-right font-bold text-amber-400">Outstanding</th>
                      <th className="py-3 px-3 text-right font-bold text-emerald-400">Forecast Amount</th>
                      <th className="py-3 px-4 text-center">Claim Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(insuranceReceipts?.schedules || []).map((claim: any) => (
                      <tr key={claim.claim_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-indigo-300">{claim.claim_number}</td>
                        <td className="py-3 px-3 text-slate-200 font-medium">{claim.provider_name}</td>
                        <td className="py-3 px-3 text-slate-400">{claim.submitted_date}</td>
                        <td className="py-3 px-3 text-slate-400">{claim.expected_receipt_date}</td>
                        <td className="py-3 px-3 text-right font-mono">{fmt(claim.claim_amount)}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">{fmt(claim.approved_amount)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">{fmt(claim.outstanding_balance)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">{fmt(claim.forecast_amount)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {claim.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!insuranceReceipts?.schedules || insuranceReceipts.schedules.length === 0) && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 text-sm">
                          No pending insurance claims in this forecast window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: OBLIGATIONS & PAYABLES CALENDAR                                    */}
      {/* ========================================================================= */}
      {activeTab === 'obligations' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div className="flex space-x-2">
              <button
                onClick={() => setObligationsSubTab('suppliers')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  obligationsSubTab === 'suppliers'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Supplier Payables ({supplierSchedules?.schedules?.length || 0})
              </button>
              <button
                onClick={() => setObligationsSubTab('payroll_tax')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  obligationsSubTab === 'payroll_tax'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Payroll & Tax Schedules ({payrollTaxSchedules?.payroll_schedules?.length || 0})
              </button>
              <button
                onClick={() => setObligationsSubTab('loans')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  obligationsSubTab === 'loans'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Loan Debt Service ({loanForecasts?.schedules?.length || 0})
              </button>
              <button
                onClick={() => setObligationsSubTab('investments')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  obligationsSubTab === 'investments'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Investment Maturities ({investmentForecasts?.schedules?.length || 0})
              </button>
            </div>

            <span className="text-xs text-slate-400">
              Total Scheduled Outflows in {horizonDays}d: <strong className="text-rose-400 font-mono">
                {fmt((supplierSchedules?.total_scheduled_amount || 0) + (loanForecasts?.total_scheduled_installments || 0))}
              </strong>
            </span>
          </div>

          {/* Sub-tab A: Supplier Payment Schedules */}
          {obligationsSubTab === 'suppliers' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Scheduled Supplier Invoices & Accounts Payable
                  </h3>
                  <span className="text-xs text-slate-400">
                    Authorized staff can set planned payment dates without prematurely deducting bank balances.
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Total Scheduled Payable:</span>
                  <span className="text-sm font-bold text-rose-400 font-mono">
                    {fmt(supplierSchedules?.total_scheduled_amount)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">PO / Inv Number</th>
                      <th className="py-3 px-3">Supplier Name</th>
                      <th className="py-3 px-3">Invoice Date</th>
                      <th className="py-3 px-3">Due Date</th>
                      <th className="py-3 px-3 text-indigo-400">Planned Payment Date</th>
                      <th className="py-3 px-3 text-right">Invoice Total</th>
                      <th className="py-3 px-3 text-right">Paid</th>
                      <th className="py-3 px-3 text-right font-bold text-rose-400">Outstanding</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(supplierSchedules?.schedules || []).map((supp: any) => (
                      <tr key={supp.schedule_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-200">{supp.invoice_number || supp.schedule_reference}</td>
                        <td className="py-3 px-3 text-slate-200 font-medium">{supp.supplier_name}</td>
                        <td className="py-3 px-3 text-slate-400">{supp.invoice_date}</td>
                        <td className="py-3 px-3 text-slate-400">{supp.due_date || 'Standard'}</td>
                        <td className="py-3 px-3 font-semibold text-indigo-300">
                          {supp.planned_payment_date || 'Unscheduled'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">{fmt(supp.invoice_amount)}</td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400">{fmt(supp.paid_amount)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-400">{fmt(supp.outstanding_payable)}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedSupplierItem(supp);
                              setPlannedPaymentDate(supp.planned_payment_date || '');
                              setSupplierModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-slate-800 text-indigo-400 rounded border border-slate-700 transition-colors"
                            title="Set Planned Date"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!supplierSchedules?.schedules || supplierSchedules.schedules.length === 0) && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 text-sm">
                          No pending supplier invoices in this forecast window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab B: Payroll & Tax Schedules */}
          {obligationsSubTab === 'payroll_tax' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Hospital Staff Payroll & Statutory Tax Obligations
                  </h3>
                  <span className="text-xs text-slate-400">
                    Approved salary cycles, GST, TDS statutory obligations.
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Upcoming Obligations:</span>
                  <span className="text-sm font-bold text-rose-400 font-mono">
                    {fmt(payrollTaxSchedules?.total_combined_obligations)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Cycle / Obligation</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Scheduled / Due Date</th>
                      <th className="py-3 px-3 text-right font-bold text-rose-400">Amount Due</th>
                      <th className="py-3 px-4 text-center">Approval Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(payrollTaxSchedules?.payroll_schedules || []).map((row: any, i: number) => (
                      <tr key={`p-${i}`} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-200">{row.obligation_type || row.month_name}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            PAYROLL
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{row.scheduled_date}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-400">{fmt(row.expected_payroll_amount)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {row.status || 'APPROVED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(payrollTaxSchedules?.tax_schedules || []).map((row: any, i: number) => (
                      <tr key={`t-${i}`} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-200">{row.tax_type}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            STATUTORY TAX
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{row.due_date}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-400">{fmt(row.amount_due)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!payrollTaxSchedules?.payroll_schedules || payrollTaxSchedules.payroll_schedules.length === 0) &&
                     (!payrollTaxSchedules?.tax_schedules || payrollTaxSchedules.tax_schedules.length === 0) && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                          No payroll or statutory tax obligations recorded in this forecast horizon.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab C: Loan Repayment Forecasts */}
          {obligationsSubTab === 'loans' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Section 16 Loan Debt Service Forecast (Principal vs Interest)
                  </h3>
                  <span className="text-xs text-slate-400">
                    Strict separation of principal repayment (Financing cash outflow) from interest expense.
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Total Scheduled Debt Service:</span>
                  <span className="text-sm font-bold text-rose-400 font-mono">
                    {fmt(loanForecasts?.total_scheduled_installments)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Lender / Facility</th>
                      <th className="py-3 px-3">Loan Account</th>
                      <th className="py-3 px-3">Next Due Date</th>
                      <th className="py-3 px-3 text-right">Principal Repayment</th>
                      <th className="py-3 px-3 text-right">Interest Expense</th>
                      <th className="py-3 px-3 text-right font-bold text-rose-400">Total Installment</th>
                      <th className="py-3 px-3 text-right font-mono">Outstanding Balance</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(loanForecasts?.schedules || []).map((loan: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-200">{loan.lender_name}</td>
                        <td className="py-3 px-3 font-mono text-indigo-300">{loan.loan_account_number}</td>
                        <td className="py-3 px-3 text-slate-400">{loan.due_date}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">{fmt(loan.principal_repayment)}</td>
                        <td className="py-3 px-3 text-right font-mono text-amber-400">{fmt(loan.interest_expense)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-400">{fmt(loan.total_scheduled_installment)}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">{fmt(loan.outstanding_loan_principal)}</td>
                        <td className="py-3 px-4 text-center font-mono text-xs text-slate-400">
                          {loan.payment_status}
                        </td>
                      </tr>
                    ))}
                    {(!loanForecasts?.schedules || loanForecasts.schedules.length === 0) && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500 text-sm">
                          No active loan debt service installments in this forecast horizon.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab D: Investment Maturity Forecasts */}
          {obligationsSubTab === 'investments' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Section 15 Investment Portfolio Maturities & Liquidity
                  </h3>
                  <span className="text-xs text-slate-400">
                    Fixed deposits, bonds, and mutual funds maturing in horizon. Matured-unsettled items tracked explicitly.
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Expected Maturity Proceeds:</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {fmt(investmentForecasts?.total_expected_proceeds)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Investment Code</th>
                      <th className="py-3 px-3">Institution / Bank</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Maturity Date</th>
                      <th className="py-3 px-3 text-right">Principal</th>
                      <th className="py-3 px-3 text-right">Expected Interest</th>
                      <th className="py-3 px-3 text-right font-bold text-emerald-400">Expected Proceeds</th>
                      <th className="py-3 px-4 text-center">Settlement Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(investmentForecasts?.schedules || []).map((inv: any) => (
                      <tr key={inv.investment_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-200">{inv.investment_code}</td>
                        <td className="py-3 px-3 text-slate-200 font-medium">{inv.institution}</td>
                        <td className="py-3 px-3 text-slate-400">{inv.category}</td>
                        <td className="py-3 px-3 text-slate-400">{inv.maturity_date || 'Unspecified'}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">{fmt(inv.principal)}</td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400">+{fmt(inv.expected_interest_component)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">{fmt(inv.expected_maturity_proceeds)}</td>
                        <td className="py-3 px-4 text-center">
                          {inv.is_matured_unsettled ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              <AlertTriangle className="w-3 h-3" /> Matured Unsettled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!investmentForecasts?.schedules || investmentForecasts.schedules.length === 0) && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500 text-sm">
                          No investments maturing in this forecast horizon.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: BUDGETS, CAPEX & LIQUIDITY ALERTS                                  */}
      {/* ========================================================================= */}
      {activeTab === 'budgets' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div className="flex space-x-2">
              <button
                onClick={() => setBudgetsSubTab('variance')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  budgetsSubTab === 'variance'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Departmental Budget vs Actual
              </button>
              <button
                onClick={() => setBudgetsSubTab('capex')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  budgetsSubTab === 'capex'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                CapEx Planning & Pipeline ({capexPlans.length})
              </button>
              <button
                onClick={() => setBudgetsSubTab('thresholds')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  budgetsSubTab === 'thresholds'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Liquidity Thresholds & Alerts ({alerts.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              {budgetsSubTab === 'variance' && (
                <button
                  onClick={() => setCreateBudgetModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Create Budget
                </button>
              )}
              {budgetsSubTab === 'capex' && (
                <button
                  onClick={() => setCreateCapexModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Propose CapEx Project
                </button>
              )}
            </div>
          </div>

          {/* Sub-tab 1: Departmental Budget vs Actual */}
          {budgetsSubTab === 'variance' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Hospital Department-Wise Budget Variance Analysis
                  </h3>
                  <span className="text-xs text-slate-400">
                    Formula: <strong className="text-slate-300 font-mono">Variance = Actual Spend − Budget</strong>. Positive variance indicates overspending.
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Total Budget:</span>
                    <span className="font-bold text-slate-100 font-mono">{fmt(budgetVariance?.summary?.total_allocated_budget)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Actual Spend:</span>
                    <span className="font-bold text-amber-400 font-mono">{fmt(budgetVariance?.summary?.total_actual_spent)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Net Variance:</span>
                    <span className={`font-bold font-mono ${
                      (budgetVariance?.summary?.total_variance || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {fmt(budgetVariance?.summary?.total_variance)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-3">Fiscal Year</th>
                      <th className="py-3 px-3">Period</th>
                      <th className="py-3 px-3 text-right font-bold text-slate-100">Approved Budget</th>
                      <th className="py-3 px-3 text-right font-bold text-amber-400">Actual Spend</th>
                      <th className="py-3 px-3 text-right">Remaining Budget</th>
                      <th className="py-3 px-3 text-right">Variance Amount</th>
                      <th className="py-3 px-3 text-center">Utilization %</th>
                      <th className="py-3 px-4 text-center">Variance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(budgetVariance?.budgets || []).map((dept: any, i: number) => {
                      return (
                        <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-200">{dept.department_name}</td>
                          <td className="py-3 px-3 text-slate-400 font-mono">{dept.fiscal_year}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                              {dept.period_type}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-100">{fmt(dept.allocated_budget)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">{fmt(dept.actual_spent)}</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">{fmt(dept.remaining_budget)}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold">
                            <span className={dept.variance > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                              {dept.variance > 0 ? `+${fmt(dept.variance)}` : fmt(dept.variance)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            <span className={`font-semibold ${(dept.utilization_pct || 0) > 100 ? 'text-rose-400' : 'text-slate-200'}`}>
                              {(dept.utilization_pct || 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {dept.is_over_budget ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                <AlertTriangle className="w-3 h-3" /> Over Budget
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Within Budget
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {(!budgetVariance?.budgets || budgetVariance.budgets.length === 0) && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 text-sm">
                          No department budgets configured for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 2: CapEx Planning & Pipeline */}
          {budgetsSubTab === 'capex' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Hospital Capital Expenditure (CapEx) Planning
                  </h3>
                  <span className="text-xs text-slate-400">
                    Rigorous workflow: Proposed → Approved Commitment → Actual Purchase. Does not create premature bank deductions.
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  Total Proposals: <strong className="text-slate-200 font-mono">{capexPlans.length}</strong>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Project / Asset Name</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3 text-right">Estimated Cost</th>
                      <th className="py-3 px-3">Target Purchase Date</th>
                      <th className="py-3 px-3">Business Justification</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Approval Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {capexPlans.map((cpx: any) => (
                      <tr key={cpx.id || cpx.capex_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-200">{cpx.project_name}</td>
                        <td className="py-3 px-3 text-slate-300">{cpx.department_name}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-100">{fmt(cpx.estimated_cost)}</td>
                        <td className="py-3 px-3 text-slate-400">{cpx.expected_purchase_date}</td>
                        <td className="py-3 px-3 text-slate-400 max-w-xs truncate" title={cpx.business_justification}>
                          {cpx.business_justification}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            cpx.status === 'APPROVED_COMMITMENT'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : cpx.status === 'PURCHASED'
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {cpx.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {cpx.status === 'PROPOSED' ? (
                            <button
                              onClick={() => {
                                setSelectedCapexItem(cpx);
                                setCapexModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium transition-colors"
                            >
                              Approve
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500">Committed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {capexPlans.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 text-sm">
                          No CapEx projects proposed yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 3: Liquidity Thresholds & Alerts */}
          {budgetsSubTab === 'thresholds' && (
            <div className="space-y-4">
              {/* Active Alerts List */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      Active Treasury Liquidity Alerts
                    </h3>
                    <span className="text-xs text-slate-400">
                      Real-time triggers for minimum balance breaches, forecast deficits, and large pending obligations.
                    </span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                    {alerts.length} Active
                  </span>
                </div>

                <div className="divide-y divide-slate-800">
                  {alerts.map((al: any) => (
                    <div key={al.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            al.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {al.severity}
                          </span>
                          <span className="text-xs font-semibold text-slate-200">{al.title}</span>
                          <span className="text-[11px] text-slate-500">• {new Date(al.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-slate-400">{al.message}</p>
                        {al.recommended_action && (
                          <p className="text-[11px] text-indigo-400 font-medium">
                            Recommended: {al.recommended_action}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {al.deficit_amount && (
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">Deficit / Breach:</span>
                            <span className="text-xs font-bold text-rose-400 font-mono">
                              {fmt(al.deficit_amount)}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => handleAcknowledgeAlert(al.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700 transition-colors"
                        >
                          Acknowledge
                        </button>
                      </div>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-sm">
                      No active liquidity alerts. Treasury safety buffers are fully intact.
                    </div>
                  )}
                </div>
              </div>

              {/* Configured Thresholds */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <PiggyBank className="w-4 h-4 text-emerald-400" />
                    Configured Minimum Cash Balance Thresholds
                  </h3>
                  <span className="text-xs text-slate-400">
                    Thresholds set for treasury accounts and consolidated hospital safety margins.
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Threshold Scope</th>
                        <th className="py-3 px-3">Scope Type</th>
                        <th className="py-3 px-3 text-right">Minimum Required Balance</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {thresholds.map((th: any) => (
                        <tr key={th.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-200">
                            {th.account_name || 'Hospital-Wide Treasury Safety Buffer'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                              {th.is_hospital_wide ? 'CONSOLIDATED TREASURY' : 'ACCOUNT SPECIFIC'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                            {fmt(th.threshold_amount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              ACTIVE ENFORCEMENT
                            </span>
                          </td>
                        </tr>
                      ))}
                      {thresholds.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500 text-sm">
                            No minimum thresholds configured.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: UPDATE SUPPLIER PLANNED PAYMENT DATE                                */}
      {/* ========================================================================= */}
      {supplierModalOpen && selectedSupplierItem && (
        <Modal
          isOpen={supplierModalOpen}
          onClose={() => setSupplierModalOpen(false)}
          title="Schedule Supplier Planned Payment Date"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-400">
              Set a planned disbursement date for treasury forecasting. This will update the cash-flow calendar without prematurely debiting bank accounts or creating a voucher.
            </p>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-semibold text-slate-200">{selectedSupplierItem.supplier_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice / Ref:</span>
                <span className="font-mono text-indigo-300">{selectedSupplierItem.invoice_number || selectedSupplierItem.schedule_reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Outstanding Payable:</span>
                <span className="font-mono font-bold text-rose-400">{fmt(selectedSupplierItem.outstanding_payable)}</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Planned Payment Date</label>
              <input
                type="date"
                value={plannedPaymentDate}
                onChange={(e) => setPlannedPaymentDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateSupplierDate}
                disabled={actionLoading || !plannedPaymentDate}
                className="px-4 py-1.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Planned Date'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: APPROVE CAPEX PROJECT                                              */}
      {/* ========================================================================= */}
      {capexModalOpen && selectedCapexItem && (
        <Modal
          isOpen={capexModalOpen}
          onClose={() => setCapexModalOpen(false)}
          title="Approve Capital Expenditure (CapEx) Commitment"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-400">
              Approving this capital expenditure commits the allocated budget into the treasury forecast. Separation of duties applies.
            </p>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Project:</span>
                <span className="font-semibold text-slate-200">{selectedCapexItem.project_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <span className="text-slate-300">{selectedCapexItem.department_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estimated Cost:</span>
                <span className="font-mono font-bold text-slate-100">{fmt(selectedCapexItem.estimated_cost)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCapexModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveCapex}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Approving...' : 'Confirm CapEx Approval'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE CAPEX PROPOSAL                                              */}
      {/* ========================================================================= */}
      {createCapexModalOpen && (
        <Modal
          isOpen={createCapexModalOpen}
          onClose={() => setCreateCapexModalOpen(false)}
          title="Propose Hospital Capital Expenditure (CapEx)"
        >
          <form onSubmit={handleCreateCapex} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Project / Equipment Name *</label>
              <input
                type="text"
                required
                value={newCapex.project_name}
                onChange={(e) => setNewCapex({ ...newCapex, project_name: e.target.value })}
                placeholder="e.g. 1.5 Tesla MRI Scanner Upgrade"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Estimated Cost (INR) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={newCapex.estimated_cost}
                onChange={(e) => setNewCapex({ ...newCapex, estimated_cost: e.target.value })}
                placeholder="5000000"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Expected Purchase Date *</label>
              <input
                type="date"
                required
                value={newCapex.expected_purchase_date}
                onChange={(e) => setNewCapex({ ...newCapex, expected_purchase_date: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Business Justification *</label>
              <textarea
                required
                value={newCapex.business_justification}
                onChange={(e) => setNewCapex({ ...newCapex, business_justification: e.target.value })}
                placeholder="Clinical necessity, anticipated ROI, patient scan turnaround reduction..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCreateCapexModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-1.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Submitting...' : 'Submit CapEx Proposal'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE DEPARTMENTAL BUDGET                                         */}
      {/* ========================================================================= */}
      {createBudgetModalOpen && (
        <Modal
          isOpen={createBudgetModalOpen}
          onClose={() => setCreateBudgetModalOpen(false)}
          title="Create Department Financial Budget"
        >
          <form onSubmit={handleCreateBudget} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Fiscal Year *</label>
                <select
                  value={newBudget.fiscal_year}
                  onChange={(e) => setNewBudget({ ...newBudget, fiscal_year: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="2026-2027">FY 2026-2027 (Apr-Mar)</option>
                  <option value="2025-2026">FY 2025-2026 (Apr-Mar)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Period Type *</label>
                <select
                  value={newBudget.period_type}
                  onChange={(e) => setNewBudget({ ...newBudget, period_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ANNUAL">Annual</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Total Budget Amount (INR) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={newBudget.total_budget_amount}
                onChange={(e) => setNewBudget({ ...newBudget, total_budget_amount: e.target.value })}
                placeholder="1500000"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Notes & Forecasting Assumptions</label>
              <textarea
                value={newBudget.notes_assumptions}
                onChange={(e) => setNewBudget({ ...newBudget, notes_assumptions: e.target.value })}
                placeholder="Department allocation basis, headcount considerations..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCreateBudgetModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-1.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Creating...' : 'Create Budget'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default BudgetingPage;
