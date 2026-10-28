import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  DollarSign,
  Plus,
  Eye,
  Check,
  X,
  FileText,
  Download,
  UploadCloud,
  ShieldCheck,
  Calculator,
  AlertCircle,
  Clock,
  Landmark,
  Coins,
  BarChart3,
  ExternalLink,
  ChevronRight,
  ArrowUpRight,
  Layers
} from 'lucide-react';
import { billingFinanceService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { parseApiError } from '../../utils/errorHandler';

interface InvestmentIncomeRecord {
  id: string;
  income_type: 'INTEREST' | 'DIVIDEND' | 'CAPITAL_RETURN';
  income_type_display: string;
  amount_received: string;
  receipt_date: string;
  receiving_financial_account?: string;
  receiving_account_name?: string;
  bank_reference?: string;
  tds_withheld?: string;
  notes?: string;
  created_at: string;
}

interface InvestmentValuationHistory {
  id: string;
  valuation_date: string;
  recorded_valuation: string;
  recorded_nav?: string;
  valuation_source: string;
  unrealized_gain_loss: string;
  notes?: string;
  recorded_by_name?: string;
  created_at: string;
}

interface InvestmentDocument {
  id: string;
  document_type: string;
  document_type_display: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  uploaded_by_name?: string;
  uploaded_at: string;
}

interface InvestmentAuditLog {
  id: string;
  action: string;
  action_display: string;
  actor_name: string;
  actor_role: string;
  from_status: string;
  to_status: string;
  remarks: string;
  timestamp: string;
}

interface Investment {
  id: string;
  investment_id: string;
  investment_name: string;
  category: string;
  category_display: string;
  issuing_institution: string;
  reference_number: string;
  folio_number: string;
  financial_account?: string;
  financial_account_name?: string;
  purchase_date: string;
  maturity_date?: string;
  principal_amount: string;
  units?: string;
  purchase_nav?: string;
  purchase_price_per_unit?: string;
  acquisition_fees: string;
  total_carrying_cost: string;
  interest_rate?: string;
  interest_calculation_method: string;
  compounding_frequency: string;
  compounding_frequency_display: string;
  expected_maturity_amount?: string;
  expected_interest_amount?: string;
  actual_maturity_proceeds?: string;
  latest_valuation: string;
  latest_nav?: string;
  latest_valuation_date?: string;
  latest_valuation_source?: string;
  total_income_received: string;
  interest_income_received: string;
  dividend_income_received: string;
  realized_gain_loss: string;
  unrealized_gain_loss: string;
  lifecycle_status: string;
  lifecycle_status_display: string;
  is_maturing_soon: boolean;
  days_to_maturity?: number | null;
  is_matured: boolean;
  notes?: string;
  created_by_name?: string;
  approved_by_name?: string;
  approval_date?: string;
  approval_notes?: string;
  created_at: string;
  updated_at: string;
  income_records?: InvestmentIncomeRecord[];
  valuation_history?: InvestmentValuationHistory[];
  documents?: InvestmentDocument[];
}

interface CategoryAllocation {
  category: string;
  category_display: string;
  count: number;
  principal: string;
  valuation: string;
  percentage: number;
}

interface InvestmentDashboardStats {
  total_invested_principal: string;
  current_portfolio_valuation: string;
  total_income_received: string;
  interest_income_received: string;
  dividend_income_received: string;
  realized_gain_loss: string;
  unrealized_gain_loss: string;
  maturing_soon_count: number;
  matured_awaiting_settlement_count: number;
  pending_approval_count: number;
  active_count: number;
  category_allocation: CategoryAllocation[];
  unreconciled_transaction_count: number;
}

interface MaturityCalendarData {
  summary: {
    maturing_soon_count: number;
    matured_awaiting_settlement_count: number;
    pending_approval_count: number;
    missing_valuation_count: number;
  };
  maturing_soon: Investment[];
  matured_awaiting_settlement: Investment[];
  pending_approval: Investment[];
  missing_valuation: Investment[];
}

export const InvestmentsPage: React.FC = () => {
  const { user } = useAuth();

  // Primary data states
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [stats, setStats] = useState<InvestmentDashboardStats | null>(null);
  const [calendar, setCalendar] = useState<MaturityCalendarData | null>(null);
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'ALL' | 'FIXED_DEPOSIT' | 'GOVERNMENT_SECURITIES' | 'MUTUAL_FUNDS' | 'SHARES_EQUITIES' | 'MONEY_MARKET' | 'APPROVAL_QUEUE' | 'CALENDAR'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showValuationModal, setShowValuationModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  // Selected item & detail drawer tabs
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [auditLogs, setAuditLogs] = useState<InvestmentAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'OVERVIEW' | 'VALUATIONS' | 'INCOME' | 'DOCUMENTS' | 'AUDIT'>('OVERVIEW');

  // Form states
  const [newForm, setNewForm] = useState({
    investment_name: '',
    category: 'FIXED_DEPOSIT',
    issuing_institution: '',
    reference_number: '',
    folio_number: '',
    financial_account: '',
    purchase_date: new Date().toISOString().split('T')[0],
    maturity_date: '',
    principal_amount: '',
    units: '',
    purchase_nav: '',
    purchase_price_per_unit: '',
    acquisition_fees: '0',
    interest_rate: '',
    compounding_frequency: 'ANNUALLY',
    notes: '',
  });

  const [yieldPreview, setYieldPreview] = useState<{
    expected_maturity_amount: string;
    total_expected_interest: string;
    tenure_days: number;
    calculation_method: string;
  } | null>(null);
  const [calculatingYield, setCalculatingYield] = useState(false);

  const [incomeForm, setIncomeForm] = useState({
    income_type: 'INTEREST',
    amount_received: '',
    tds_withheld: '0',
    receipt_date: new Date().toISOString().split('T')[0],
    receiving_financial_account: '',
    bank_reference: '',
    notes: '',
  });

  const [valuationForm, setValuationForm] = useState({
    valuation_date: new Date().toISOString().split('T')[0],
    recorded_valuation: '',
    recorded_nav: '',
    valuation_source: 'BANK_STATEMENT',
    notes: '',
  });

  const [redeemForm, setRedeemForm] = useState({
    redemption_date: new Date().toISOString().split('T')[0],
    gross_proceeds: '',
    exit_load_fees: '0',
    tds_withheld: '0',
    settlement_financial_account: '',
    bank_reference: '',
    notes: '',
  });

  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [purchaseAccount, setPurchaseAccount] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('DEPOSIT_CERTIFICATE');
  const [actionLoading, setActionLoading] = useState(false);

  // Load Initial Data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [invData, statsData, calData, accountsData] = await Promise.all([
        billingFinanceService.getInvestments(),
        billingFinanceService.getInvestmentDashboardStats(),
        billingFinanceService.getInvestmentMaturityCalendar(),
        billingFinanceService.getFinancialAccounts().catch(() => []),
      ]);
      setInvestments(Array.isArray(invData) ? invData : invData?.results || []);
      setStats(statsData);
      setCalendar(calData);
      setFinancialAccounts(Array.isArray(accountsData) ? accountsData : accountsData?.results || []);
    } catch (err: any) {
      console.error('Error loading investment portfolio:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to load hospital investment portfolio from Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format INR Currency
  const formatINR = (val: string | number | undefined | null) => {
    if (val === undefined || val === null || val === '') return '₹0.00';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Status Badge Helper
  const getStatusBadge = (status: string, display?: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="neutral">Draft</Badge>;
      case 'PENDING_APPROVAL':
        return <Badge variant="warning" pulse>Pending Approval</Badge>;
      case 'APPROVED':
        return <Badge variant="info">Approved</Badge>;
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'MATURED':
        return <Badge variant="accent">Matured</Badge>;
      case 'REDEEMED':
        return <Badge variant="teal">Redeemed / Sold</Badge>;
      case 'CLOSED':
        return <Badge variant="neutral">Closed</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      case 'CANCELLED':
        return <Badge variant="neutral">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{display || status}</Badge>;
    }
  };

  // Category Badge Helper
  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'FIXED_DEPOSIT':
        return <Badge variant="info" size="sm">Fixed Deposit</Badge>;
      case 'GOVERNMENT_SECURITIES':
        return <Badge variant="teal" size="sm">Govt Securities / Bonds</Badge>;
      case 'MUTUAL_FUNDS':
        return <Badge variant="accent" size="sm">Mutual Fund</Badge>;
      case 'SHARES_EQUITIES':
        return <Badge variant="primary" size="sm">Shares / Equities</Badge>;
      case 'MONEY_MARKET':
        return <Badge variant="cyan" size="sm">Money Market</Badge>;
      default:
        return <Badge variant="neutral" size="sm">Other</Badge>;
    }
  };

  // Filtered Investments
  const filteredInvestments = useMemo(() => {
    return investments.filter((item) => {
      // Tab filter
      if (activeTab === 'APPROVAL_QUEUE') {
        if (item.lifecycle_status !== 'PENDING_APPROVAL') return false;
      } else if (activeTab !== 'ALL' && activeTab !== 'CALENDAR') {
        if (item.category !== activeTab) return false;
      }

      // Explicit Category filter
      if (categoryFilter && item.category !== categoryFilter) return false;

      // Status filter
      if (statusFilter && item.lifecycle_status !== statusFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = item.investment_name?.toLowerCase().includes(q);
        const matchesId = item.investment_id?.toLowerCase().includes(q);
        const matchesInst = item.issuing_institution?.toLowerCase().includes(q);
        const matchesRef = item.reference_number?.toLowerCase().includes(q);
        const matchesFolio = item.folio_number?.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesInst && !matchesRef && !matchesFolio) {
          return false;
        }
      }

      return true;
    });
  }, [investments, activeTab, categoryFilter, statusFilter, searchTerm]);

  // Open Detailed Drawer / Modal & fetch audit logs
  const handleOpenDetail = async (inv: Investment, tab: 'OVERVIEW' | 'VALUATIONS' | 'INCOME' | 'DOCUMENTS' | 'AUDIT' = 'OVERVIEW') => {
    setSelectedInvestment(inv);
    setDetailTab(tab);
    setShowDetailModal(true);
    try {
      setAuditLoading(true);
      const logs = await billingFinanceService.getInvestmentAuditTrail(inv.id);
      setAuditLogs(logs || []);
    } catch (e) {
      console.warn('Could not load audit trail:', e);
    } finally {
      setAuditLoading(false);
    }
  };

  // Calculate yield for FD Preview
  const handleCalculateYield = async () => {
    if (!newForm.principal_amount || !newForm.interest_rate || !newForm.purchase_date || !newForm.maturity_date) {
      setError('Please provide Principal, Interest Rate, Deposit Date, and Maturity Date to calculate yield preview.');
      return;
    }
    try {
      setCalculatingYield(true);
      setError(null);
      const res = await billingFinanceService.calculateInvestmentYield({
        principal: newForm.principal_amount,
        interest_rate: newForm.interest_rate,
        compounding_frequency: newForm.compounding_frequency,
        start_date: newForm.purchase_date,
        maturity_date: newForm.maturity_date,
      });
      setYieldPreview(res);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setCalculatingYield(false);
    }
  };

  // Submit New Investment
  const handleCreateInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError(null);
      const payload: any = {
        name: newForm.investment_name,
        investment_name: newForm.investment_name,
        category: newForm.category,
        institution_name: newForm.issuing_institution,
        issuing_institution: newForm.issuing_institution,
        reference_number: newForm.reference_number || undefined,
        folio_number: newForm.folio_number || undefined,
        purchase_date: newForm.purchase_date,
        maturity_date: newForm.maturity_date || undefined,
        principal_amount: newForm.principal_amount,
        units: newForm.units ? newForm.units : undefined,
        purchase_price_per_unit: newForm.purchase_price_per_unit || newForm.purchase_nav || undefined,
        purchase_fees: newForm.acquisition_fees || '0',
        acquisition_fees: newForm.acquisition_fees || '0',
        interest_rate_pct: newForm.interest_rate ? newForm.interest_rate : undefined,
        interest_rate: newForm.interest_rate ? newForm.interest_rate : undefined,
        compounding_frequency: newForm.compounding_frequency,
        source_financial_account: newForm.financial_account || undefined,
        financial_account: newForm.financial_account || undefined,
        notes: newForm.notes || '',
        lifecycle_status: 'DRAFT',
      };
      await billingFinanceService.createInvestment(payload);
      setSuccessMsg('Investment record successfully created in Draft state.');
      setShowNewModal(false);
      setYieldPreview(null);
      setNewForm({
        investment_name: '',
        category: 'FIXED_DEPOSIT',
        issuing_institution: '',
        reference_number: '',
        folio_number: '',
        financial_account: '',
        purchase_date: new Date().toISOString().split('T')[0],
        maturity_date: '',
        principal_amount: '',
        units: '',
        purchase_nav: '',
        purchase_price_per_unit: '',
        acquisition_fees: '0',
        interest_rate: '',
        compounding_frequency: 'ANNUALLY',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to create investment record.');
    } finally {
      setActionLoading(false);
    }
  };

  // Workflow: Submit for Approval
  const handleSubmitForApproval = async (inv: Investment) => {
    try {
      setActionLoading(true);
      setError(null);
      await billingFinanceService.submitInvestmentForApproval(inv.id);
      setSuccessMsg(`Investment ${inv.investment_id} submitted for management approval.`);
      await loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Workflow: Approve
  const handleApprove = async () => {
    if (!selectedInvestment) return;
    try {
      setActionLoading(true);
      setError(null);
      await billingFinanceService.approveInvestment(selectedInvestment.id, { notes: approvalNotes });
      setSuccessMsg(`Investment ${selectedInvestment.investment_id} approved.`);
      setShowApproveModal(false);
      setApprovalNotes('');
      await loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Workflow: Reject
  const handleReject = async () => {
    if (!selectedInvestment || !rejectReason.trim()) {
      setError('Please provide a valid rejection reason.');
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      await billingFinanceService.rejectInvestment(selectedInvestment.id, { reason: rejectReason });
      setSuccessMsg(`Investment ${selectedInvestment.investment_id} rejected.`);
      setShowRejectModal(false);
      setRejectReason('');
      await loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Workflow: Purchase / Place Funds
  const handlePurchase = async () => {
    if (!selectedInvestment) return;
    try {
      setActionLoading(true);
      setError(null);
      await billingFinanceService.purchaseInvestment(selectedInvestment.id, {
        financial_account: purchaseAccount || undefined,
      });
      setSuccessMsg(`Investment ${selectedInvestment.investment_id} placed/purchased. Funds debited from source account and posted to Section 14.`);
      setShowPurchaseModal(false);
      await loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Workflow: Record Income
  const handleRecordIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestment) return;
    try {
      setActionLoading(true);
      setError(null);
      await billingFinanceService.recordInvestmentIncome(selectedInvestment.id, incomeForm);
      setSuccessMsg(`Income receipt of ${formatINR(incomeForm.amount_received)} recorded and credited to treasury account.`);
      setShowIncomeModal(false);
      setIncomeForm({
        income_type: 'INTEREST',
        amount_received: '',
        tds_withheld: '0',
        receipt_date: new Date().toISOString().split('T')[0],
        receiving_financial_account: '',
        bank_reference: '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Workflow: Record Valuation
  const handleRecordValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestment) return;
    try {
      setActionLoading(true);
      setError(null);
      await billingFinanceService.recordInvestmentValuation(selectedInvestment.id, valuationForm);
      setSuccessMsg(`Portfolio valuation updated to ${formatINR(valuationForm.recorded_valuation)}.`);
      setShowValuationModal(false);
      setValuationForm({
        valuation_date: new Date().toISOString().split('T')[0],
        recorded_valuation: '',
        recorded_nav: '',
        valuation_source: 'BANK_STATEMENT',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Workflow: Redeem / Settle
  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestment) return;
    try {
      setActionLoading(true);
      setError(null);
      await billingFinanceService.redeemInvestment(selectedInvestment.id, redeemForm);
      setSuccessMsg(`Investment ${selectedInvestment.investment_id} successfully redeemed/settled.`);
      setShowRedeemModal(false);
      setRedeemForm({
        redemption_date: new Date().toISOString().split('T')[0],
        gross_proceeds: '',
        exit_load_fees: '0',
        tds_withheld: '0',
        settlement_financial_account: '',
        bank_reference: '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Workflow: Upload Supporting Document
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestment || !docFile) {
      setError('Please select a file to upload.');
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      const fd = new FormData();
      fd.append('file', docFile);
      fd.append('document_type', docType);
      await billingFinanceService.uploadInvestmentDocument(selectedInvestment.id, fd);
      setSuccessMsg('Supporting document attached to investment record.');
      setShowDocModal(false);
      setDocFile(null);
      await loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      setError(null);
      const blob = await billingFinanceService.exportInvestmentsCsv({
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Hospital_Investment_Register_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setError('Failed to export investment register CSV.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Investment Portfolio Management</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Section 15 — Real-time hospital treasury portfolio, yield calculations, fixed deposits & ledger integration
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Register
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Investment
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <AlertBanner
          type="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}
      {successMsg && (
        <AlertBanner
          type="success"
          message={successMsg}
          onDismiss={() => setSuccessMsg(null)}
        />
      )}

      {/* Metric Cards Ribbon (Real database records) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Total Invested Principal */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:border-indigo-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Invested Principal</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">
            {formatINR(stats?.total_invested_principal)}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span>Carrying Cost Basis</span>
          </div>
        </div>

        {/* Card 2: Current Portfolio Valuation */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Current Valuation</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-emerald-600">
            {formatINR(stats?.current_portfolio_valuation)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Latest Recorded MTM
          </div>
        </div>

        {/* Card 3: Total Income Received */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:border-blue-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Income</span>
            <Coins className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-blue-600">
            {formatINR(stats?.total_income_received)}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>Int: {formatINR(stats?.interest_income_received)}</span>
            <span>Div: {formatINR(stats?.dividend_income_received)}</span>
          </div>
        </div>

        {/* Card 4: Realized & Unrealized Gains */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:border-amber-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Unrealized G/L</span>
            <BarChart3 className="w-4 h-4 text-amber-500" />
          </div>
          <div className={`text-xl font-bold ${parseFloat(stats?.unrealized_gain_loss || '0') >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatINR(stats?.unrealized_gain_loss)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Realized: <span className="font-semibold">{formatINR(stats?.realized_gain_loss)}</span>
          </div>
        </div>

        {/* Card 5: Maturing Soon & Awaiting Settlement */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:border-purple-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Maturing (≤30d)</span>
            <Calendar className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-purple-700">
            {stats?.maturing_soon_count || 0}
          </div>
          <div className="text-xs text-amber-600 font-medium mt-1">
            {stats?.matured_awaiting_settlement_count || 0} awaiting settlement
          </div>
        </div>

        {/* Card 6: Approval Queue & Unreconciled */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:border-rose-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Pending Approval</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600">
            {stats?.pending_approval_count || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Unreconciled Txns: {stats?.unreconciled_transaction_count || 0}
          </div>
        </div>
      </div>

      {/* Portfolio Allocation Summary Bar */}
      {stats?.category_allocation && stats.category_allocation.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-semibold text-slate-900">Portfolio Category Allocation</span>
            </div>
            <span className="text-xs text-slate-500">
              Active Investments: {stats.active_count}
            </span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 gap-0.5">
            {stats.category_allocation.map((cat, idx) => {
              const colors = ['bg-indigo-500', 'bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-slate-400'];
              return (
                <div
                  key={cat.category}
                  className={`${colors[idx % colors.length]} transition-all duration-500`}
                  style={{ width: `${Math.max(cat.percentage, 2)}%` }}
                  title={`${cat.category_display}: ${formatINR(cat.principal)} (${cat.percentage}%)`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
            {stats.category_allocation.map((cat, idx) => {
              const dotColors = ['bg-indigo-500', 'bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-slate-400'];
              return (
                <div key={cat.category} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotColors[idx % dotColors.length]}`} />
                  <span className="font-medium text-slate-800">{cat.category_display}:</span>
                  <span>{formatINR(cat.principal)}</span>
                  <span className="text-slate-400">({cat.percentage}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'ALL'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          All Investments ({investments.length})
        </button>
        <button
          onClick={() => setActiveTab('FIXED_DEPOSIT')}
          className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'FIXED_DEPOSIT'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Fixed Deposits ({investments.filter(i => i.category === 'FIXED_DEPOSIT').length})
        </button>
        <button
          onClick={() => setActiveTab('GOVERNMENT_SECURITIES')}
          className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'GOVERNMENT_SECURITIES'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Govt Securities & Bonds
        </button>
        <button
          onClick={() => setActiveTab('MUTUAL_FUNDS')}
          className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
            activeTab === 'MUTUAL_FUNDS'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Mutual Funds & Equities
        </button>
        <button
          onClick={() => setActiveTab('APPROVAL_QUEUE')}
          className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'APPROVAL_QUEUE'
              ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-600 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span>Approval Queue</span>
          {stats?.pending_approval_count ? (
            <span className="px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full font-bold">
              {stats.pending_approval_count}
            </span>
          ) : null}
        </button>
        <button
          onClick={() => setActiveTab('CALENDAR')}
          className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'CALENDAR'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Maturity Calendar & Alerts</span>
          {stats?.maturing_soon_count ? (
            <span className="px-1.5 py-0.5 text-xs bg-purple-500 text-white rounded-full font-bold">
              {stats.maturing_soon_count}
            </span>
          ) : null}
        </button>
      </div>

      {/* Main View: Calendar Tab vs Register Table */}
      {activeTab === 'CALENDAR' ? (
        /* Section 7: Maturity Calendar & Alerts View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-200">
              <div className="flex items-center justify-between text-purple-700 mb-1">
                <span className="text-xs font-bold uppercase">Maturing Within 30 Days</span>
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-purple-900">
                {calendar?.summary?.maturing_soon_count || 0}
              </div>
              <p className="text-xs text-purple-600 mt-1">Requires renewal or redemption instructions</p>
            </div>

            <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-xs font-bold uppercase">Awaiting Settlement</span>
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-amber-900">
                {calendar?.summary?.matured_awaiting_settlement_count || 0}
              </div>
              <p className="text-xs text-amber-600 mt-1">Matured deposits awaiting bank funds receipt</p>
            </div>

            <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between text-blue-700 mb-1">
                <span className="text-xs font-bold uppercase">Pending Approval</span>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {calendar?.summary?.pending_approval_count || 0}
              </div>
              <p className="text-xs text-blue-600 mt-1">Requires management sign-off</p>
            </div>

            <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200">
              <div className="flex items-center justify-between text-rose-700 mb-1">
                <span className="text-xs font-bold uppercase">Missing Valuation (&gt;90d)</span>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-rose-900">
                {calendar?.summary?.missing_valuation_count || 0}
              </div>
              <p className="text-xs text-rose-600 mt-1">Market-linked assets needing NAV update</p>
            </div>
          </div>

          {/* Maturing Soon List */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-slate-900">Upcoming Maturities (Next 30 Days)</h3>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {calendar?.maturing_soon?.length || 0} deposits found
              </span>
            </div>
            {calendar?.maturing_soon && calendar.maturing_soon.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {calendar.maturing_soon.map((inv) => (
                  <div key={inv.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{inv.investment_name}</span>
                        {getCategoryBadge(inv.category)}
                        <span className="text-xs font-mono text-slate-500">{inv.investment_id}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-4">
                        <span>Institution: <b className="text-slate-700">{inv.issuing_institution}</b></span>
                        <span>Principal: <b className="text-slate-900">{formatINR(inv.principal_amount)}</b></span>
                        <span>Rate: <b className="text-slate-900">{inv.interest_rate}%</b></span>
                        <span>Maturity Date: <b className="text-purple-700">{inv.maturity_date}</b></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        Matures in {inv.days_to_maturity} days
                      </span>
                      <button
                        onClick={() => handleOpenDetail(inv)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        View Terms
                      </button>
                      {inv.lifecycle_status === 'ACTIVE' && (
                        <button
                          onClick={() => {
                            setSelectedInvestment(inv);
                            setShowRedeemModal(true);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                        >
                          Redeem / Settle
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No active investments are maturing within the next 30 days.
              </div>
            )}
          </div>

          {/* Matured Awaiting Settlement */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 bg-amber-50/50 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-slate-900">Matured Investments Awaiting Bank Settlement</h3>
              </div>
              <span className="text-xs font-medium text-amber-700">
                {calendar?.matured_awaiting_settlement?.length || 0} pending
              </span>
            </div>
            {calendar?.matured_awaiting_settlement && calendar.matured_awaiting_settlement.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {calendar.matured_awaiting_settlement.map((inv) => (
                  <div key={inv.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{inv.investment_name}</span>
                        {getStatusBadge(inv.lifecycle_status)}
                        <span className="text-xs font-mono text-slate-500">{inv.investment_id}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-4">
                        <span>Institution: <b className="text-slate-700">{inv.issuing_institution}</b></span>
                        <span>Carrying Cost: <b className="text-slate-900">{formatINR(inv.principal_amount)}</b></span>
                        <span>Matured On: <b className="text-amber-700">{inv.maturity_date}</b></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedInvestment(inv);
                          setShowRedeemModal(true);
                        }}
                        className="px-3.5 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
                      >
                        Record Bank Settlement
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No matured investments are currently awaiting bank settlement.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Section 3 & 4: Investment Register Table */
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by ID, instrument name, bank, folio or certificate number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Categories</option>
                <option value="FIXED_DEPOSIT">Fixed Deposits</option>
                <option value="GOVERNMENT_SECURITIES">Govt Securities / Bonds</option>
                <option value="MUTUAL_FUNDS">Mutual Funds</option>
                <option value="SHARES_EQUITIES">Shares / Equities</option>
                <option value="MONEY_MARKET">Money Market</option>
                <option value="OTHER">Other Permitted</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="ACTIVE">Active</option>
                <option value="MATURED">Matured</option>
                <option value="REDEEMED">Redeemed / Sold</option>
                <option value="CLOSED">Closed</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* Investment Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5">Investment / ID</th>
                    <th className="px-4 py-3.5">Category</th>
                    <th className="px-4 py-3.5">Institution & Ref</th>
                    <th className="px-4 py-3.5 text-right">Principal</th>
                    <th className="px-4 py-3.5 text-right">Valuation & MTM</th>
                    <th className="px-4 py-3.5">Yield / Rate</th>
                    <th className="px-4 py-3.5">Maturity Date</th>
                    <th className="px-4 py-3.5 text-right">Income Recd</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        Fetching verified investment records from Supabase PostgreSQL...
                      </td>
                    </tr>
                  ) : filteredInvestments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                        <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        No investment records match your current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredInvestments.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {inv.investment_name}
                          </div>
                          <span className="text-xs font-mono text-slate-400">{inv.investment_id}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          {getCategoryBadge(inv.category)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-800">{inv.issuing_institution}</div>
                          <div className="text-xs text-slate-400">
                            {inv.reference_number || inv.folio_number || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="font-semibold text-slate-900">{formatINR(inv.principal_amount)}</div>
                          {parseFloat(inv.acquisition_fees || '0') > 0 && (
                            <div className="text-[11px] text-slate-400">+ Fees: {formatINR(inv.acquisition_fees)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="font-semibold text-emerald-600">{formatINR(inv.latest_valuation)}</div>
                          <div className={`text-[11px] font-medium ${parseFloat(inv.unrealized_gain_loss || '0') >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {parseFloat(inv.unrealized_gain_loss || '0') >= 0 ? '+' : ''}{formatINR(inv.unrealized_gain_loss)}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {inv.interest_rate ? (
                            <div>
                              <span className="font-semibold text-slate-800">{inv.interest_rate}%</span>
                              <div className="text-[11px] text-slate-400 capitalize">
                                {inv.compounding_frequency.toLowerCase()}
                              </div>
                            </div>
                          ) : inv.latest_nav ? (
                            <div>
                              <span className="text-xs font-mono text-slate-700">NAV: ₹{inv.latest_nav}</span>
                              <div className="text-[11px] text-slate-400">{inv.units} units</div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {inv.maturity_date ? (
                            <div>
                              <div className="font-medium text-slate-700">{inv.maturity_date}</div>
                              {inv.is_maturing_soon && (
                                <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-700">
                                  {inv.days_to_maturity}d left
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Open-ended</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="font-semibold text-blue-600">
                            {formatINR(inv.total_income_received)}
                          </div>
                          {parseFloat(inv.interest_income_received || '0') > 0 && (
                            <div className="text-[11px] text-slate-400">Int: {formatINR(inv.interest_income_received)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {getStatusBadge(inv.lifecycle_status, inv.lifecycle_status_display)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* View Detail */}
                            <button
                              onClick={() => handleOpenDetail(inv)}
                              title="View Details & Audit Trail"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Submit for Approval (if DRAFT) */}
                            {inv.lifecycle_status === 'DRAFT' && (
                              <button
                                onClick={() => handleSubmitForApproval(inv)}
                                title="Submit for Approval"
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Approve / Reject (if PENDING_APPROVAL) */}
                            {inv.lifecycle_status === 'PENDING_APPROVAL' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedInvestment(inv);
                                    setShowApproveModal(true);
                                  }}
                                  title="Approve Investment"
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedInvestment(inv);
                                    setShowRejectModal(true);
                                  }}
                                  title="Reject Investment"
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {/* Purchase / Place Funds (if APPROVED) */}
                            {inv.lifecycle_status === 'APPROVED' && (
                              <button
                                onClick={() => {
                                  setSelectedInvestment(inv);
                                  setShowPurchaseModal(true);
                                }}
                                title="Place Funds / Purchase (Section 14 Outflow)"
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-medium text-xs flex items-center gap-0.5"
                              >
                                <ArrowUpRight className="w-4 h-4" />
                              </button>
                            )}

                            {/* Record Income (if ACTIVE) */}
                            {inv.lifecycle_status === 'ACTIVE' && (
                              <button
                                onClick={() => {
                                  setSelectedInvestment(inv);
                                  setShowIncomeModal(true);
                                }}
                                title="Record Interest/Dividend Receipt"
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Coins className="w-4 h-4" />
                              </button>
                            )}

                            {/* Record Valuation */}
                            {['ACTIVE', 'APPROVED'].includes(inv.lifecycle_status) && (
                              <button
                                onClick={() => {
                                  setSelectedInvestment(inv);
                                  setShowValuationModal(true);
                                }}
                                title="Update Latest Valuation"
                                className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                              >
                                <TrendingUp className="w-4 h-4" />
                              </button>
                            )}

                            {/* Redeem / Settle */}
                            {['ACTIVE', 'MATURED'].includes(inv.lifecycle_status) && (
                              <button
                                onClick={() => {
                                  setSelectedInvestment(inv);
                                  setShowRedeemModal(true);
                                }}
                                title="Redeem / Settle Proceeds"
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: New Investment Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Create New Investment Record"
        subtitle="Section 15 — Enter instrument parameters, linked financial accounts and yield terms"
        size="xl"
      >
        <form onSubmit={handleCreateInvestment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Category *
              </label>
              <select
                value={newForm.category}
                onChange={(e) => {
                  setNewForm({ ...newForm, category: e.target.value });
                  setYieldPreview(null);
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              >
                <option value="FIXED_DEPOSIT">Fixed Deposit</option>
                <option value="GOVERNMENT_SECURITIES">Government Securities / Bonds</option>
                <option value="MUTUAL_FUNDS">Mutual Funds</option>
                <option value="SHARES_EQUITIES">Shares / Equities</option>
                <option value="MONEY_MARKET">Money-Market Instruments</option>
                <option value="OTHER">Other Permitted</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Investment Name *
              </label>
              <input
                type="text"
                placeholder="e.g. SBI 3-Year Special Term Deposit / HDFC Liquid Fund"
                value={newForm.investment_name}
                onChange={(e) => setNewForm({ ...newForm, investment_name: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Issuing Institution / Bank *
              </label>
              <input
                type="text"
                placeholder="e.g. State Bank of India / RBI"
                value={newForm.issuing_institution}
                onChange={(e) => setNewForm({ ...newForm, issuing_institution: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Reference / FD Receipt No
              </label>
              <input
                type="text"
                placeholder="e.g. FDR-2026-992144"
                value={newForm.reference_number}
                onChange={(e) => setNewForm({ ...newForm, reference_number: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Folio / Demat Account No
              </label>
              <input
                type="text"
                placeholder="e.g. FOL-882910-MF"
                value={newForm.folio_number}
                onChange={(e) => setNewForm({ ...newForm, folio_number: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Source Treasury Bank (Section 13)
              </label>
              <select
                value={newForm.financial_account}
                onChange={(e) => setNewForm({ ...newForm, financial_account: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="">Select Linked Financial Account</option>
                {financialAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_code} - {acc.account_name} ({formatINR(acc.current_balance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Purchase / Placement Date *
              </label>
              <input
                type="date"
                value={newForm.purchase_date}
                onChange={(e) => setNewForm({ ...newForm, purchase_date: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Maturity Date {newForm.category === 'FIXED_DEPOSIT' ? '*' : '(Optional)'}
              </label>
              <input
                type="date"
                value={newForm.maturity_date}
                onChange={(e) => setNewForm({ ...newForm, maturity_date: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                required={newForm.category === 'FIXED_DEPOSIT'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Principal Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 500000"
                value={newForm.principal_amount}
                onChange={(e) => setNewForm({ ...newForm, principal_amount: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
                required
              />
            </div>

            {/* Securities specific fields */}
            {['MUTUAL_FUNDS', 'SHARES_EQUITIES'].includes(newForm.category) && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Units / Quantity
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 1000.50"
                    value={newForm.units}
                    onChange={(e) => setNewForm({ ...newForm, units: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Purchase NAV / Price Per Unit
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 45.20"
                    value={newForm.purchase_nav}
                    onChange={(e) => setNewForm({ ...newForm, purchase_nav: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Acquisition Fees / Brokerage (₹)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 250"
                value={newForm.acquisition_fees}
                onChange={(e) => setNewForm({ ...newForm, acquisition_fees: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* FD specific fields */}
            {newForm.category === 'FIXED_DEPOSIT' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Interest Rate (% p.a.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 7.25"
                    value={newForm.interest_rate}
                    onChange={(e) => setNewForm({ ...newForm, interest_rate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Compounding Frequency *
                  </label>
                  <select
                    value={newForm.compounding_frequency}
                    onChange={(e) => setNewForm({ ...newForm, compounding_frequency: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="SIMPLE">Simple Interest (No Compounding)</option>
                    <option value="MONTHLY">Monthly Compounding</option>
                    <option value="QUARTERLY">Quarterly Compounding (Indian Standard)</option>
                    <option value="HALF_YEARLY">Half-Yearly Compounding</option>
                    <option value="ANNUALLY">Annual Compounding</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Section 5: Dedicated Fixed Deposit Yield Calculator Preview */}
          {newForm.category === 'FIXED_DEPOSIT' && (
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                    FD Expected Yield Preview (Mathematical Calculation)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCalculateYield}
                  disabled={calculatingYield}
                  className="px-3 py-1 text-xs font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  {calculatingYield ? 'Calculating...' : 'Calculate Yield'}
                </button>
              </div>

              {yieldPreview && (
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-indigo-100 text-xs">
                  <div>
                    <span className="text-slate-500 block">Expected Maturity Value:</span>
                    <span className="text-sm font-bold text-indigo-900">{formatINR(yieldPreview.expected_maturity_amount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Expected Total Interest:</span>
                    <span className="text-sm font-bold text-emerald-700">{formatINR(yieldPreview.total_expected_interest)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Tenure (Days):</span>
                    <span className="text-sm font-semibold text-slate-800">{yieldPreview.tenure_days} days</span>
                  </div>
                  <div className="col-span-3 text-[11px] text-slate-500 italic">
                    Note: {yieldPreview.calculation_method}. Estimated amount is for projection and never treated as confirmed bank payout until verified bank settlement receipt.
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Notes & Investment Rationale
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Hospital liquidity reserve placement approved in Finance Committee meeting..."
              value={newForm.notes}
              onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
            >
              {actionLoading ? 'Creating...' : 'Save Draft Investment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Record Income Modal */}
      <Modal
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
        title={`Record Investment Income — ${selectedInvestment?.investment_id}`}
        subtitle={`Instrument: ${selectedInvestment?.investment_name} (${selectedInvestment?.issuing_institution})`}
        size="md"
      >
        <form onSubmit={handleRecordIncome} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Income Type *
              </label>
              <select
                value={incomeForm.income_type}
                onChange={(e) => setIncomeForm({ ...incomeForm, income_type: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                <option value="INTEREST">Interest Income</option>
                <option value="DIVIDEND">Dividend Income</option>
                <option value="CAPITAL_RETURN">Capital Return</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Receipt Date *
              </label>
              <input
                type="date"
                value={incomeForm.receipt_date}
                onChange={(e) => setIncomeForm({ ...incomeForm, receipt_date: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Amount Received (Net) (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 18250"
                value={incomeForm.amount_received}
                onChange={(e) => setIncomeForm({ ...incomeForm, amount_received: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                TDS / Withholding Tax (₹)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 1825"
                value={incomeForm.tds_withheld}
                onChange={(e) => setIncomeForm({ ...incomeForm, tds_withheld: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Receiving Bank Account (Section 13)
              </label>
              <select
                value={incomeForm.receiving_financial_account}
                onChange={(e) => setIncomeForm({ ...incomeForm, receiving_financial_account: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                <option value="">Select Receiving Bank Account</option>
                {financialAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_code} - {acc.account_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Bank Reference / UTR Number
              </label>
              <input
                type="text"
                placeholder="e.g. UTR-AXIS-202610-883921"
                value={incomeForm.bank_reference}
                onChange={(e) => setIncomeForm({ ...incomeForm, bank_reference: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Q2 FY26 Interest credited"
                value={incomeForm.notes}
                onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowIncomeModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
            >
              {actionLoading ? 'Posting...' : 'Post Income Receipt'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Record Valuation Modal */}
      <Modal
        isOpen={showValuationModal}
        onClose={() => setShowValuationModal(false)}
        title={`Record Valuation Update — ${selectedInvestment?.investment_id}`}
        subtitle="Section 6 — Manually recorded mark-to-market valuation with audit source tracking"
        size="md"
      >
        <form onSubmit={handleRecordValuation} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Valuation Date *
              </label>
              <input
                type="date"
                value={valuationForm.valuation_date}
                onChange={(e) => setValuationForm({ ...valuationForm, valuation_date: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Total Recorded Valuation (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 525000"
                value={valuationForm.recorded_valuation}
                onChange={(e) => setValuationForm({ ...valuationForm, recorded_valuation: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-semibold"
                required
              />
            </div>

            {['MUTUAL_FUNDS', 'SHARES_EQUITIES'].includes(selectedInvestment?.category || '') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Latest NAV / Share Price (₹)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 48.75"
                  value={valuationForm.recorded_nav}
                  onChange={(e) => setValuationForm({ ...valuationForm, recorded_nav: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Valuation Source *
              </label>
              <select
                value={valuationForm.valuation_source}
                onChange={(e) => setValuationForm({ ...valuationForm, valuation_source: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                <option value="BANK_STATEMENT">Verified Bank Statement / FD Advice</option>
                <option value="FUND_FACTSHEET">Fund House / AMC Monthly Factsheet</option>
                <option value="NSDL_CDSL_STATEMENT">NSDL / CDSL Demat Holding Statement</option>
                <option value="AUDIT_CONFIRMATION">Auditor External Confirmation</option>
                <option value="MANUAL_INPUT">Hospital Internal Treasury Valuation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Remarks
              </label>
              <input
                type="text"
                placeholder="e.g. Q3 Quarter-end portfolio revaluation"
                value={valuationForm.notes}
                onChange={(e) => setValuationForm({ ...valuationForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>

            {selectedInvestment && (
              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Current Carrying Cost:</span>
                  <b>{formatINR(selectedInvestment.principal_amount)}</b>
                </div>
                {valuationForm.recorded_valuation && (
                  <div className="flex justify-between font-semibold pt-1 border-t border-slate-200">
                    <span>Unrealized Gain / Loss:</span>
                    <span className={parseFloat(valuationForm.recorded_valuation) - parseFloat(selectedInvestment.principal_amount) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {formatINR(parseFloat(valuationForm.recorded_valuation) - parseFloat(selectedInvestment.principal_amount))}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowValuationModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm"
            >
              {actionLoading ? 'Saving...' : 'Update Valuation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: Redemption / Settle Modal */}
      <Modal
        isOpen={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
        title={`Redeem / Settle Investment — ${selectedInvestment?.investment_id}`}
        subtitle={`Carrying Cost: ${formatINR(selectedInvestment?.principal_amount)}`}
        size="md"
      >
        <form onSubmit={handleRedeem} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Redemption Date *
              </label>
              <input
                type="date"
                value={redeemForm.redemption_date}
                onChange={(e) => setRedeemForm({ ...redeemForm, redemption_date: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Gross Proceeds (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 545000"
                value={redeemForm.gross_proceeds}
                onChange={(e) => setRedeemForm({ ...redeemForm, gross_proceeds: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Exit Load / Bank Penalties (₹)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 0"
                value={redeemForm.exit_load_fees}
                onChange={(e) => setRedeemForm({ ...redeemForm, exit_load_fees: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                TDS / Withholding Tax (₹)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 4500"
                value={redeemForm.tds_withheld}
                onChange={(e) => setRedeemForm({ ...redeemForm, tds_withheld: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Settlement Bank Account (Section 13)
              </label>
              <select
                value={redeemForm.settlement_financial_account}
                onChange={(e) => setRedeemForm({ ...redeemForm, settlement_financial_account: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                <option value="">Select Settlement Bank Account</option>
                {financialAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_code} - {acc.account_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Bank UTR / Settlement Reference
              </label>
              <input
                type="text"
                placeholder="e.g. UTR-SETTLE-202610-10923"
                value={redeemForm.bank_reference}
                onChange={(e) => setRedeemForm({ ...redeemForm, bank_reference: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Settlement Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Full maturity proceeds received in Axis Treasury"
                value={redeemForm.notes}
                onChange={(e) => setRedeemForm({ ...redeemForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {selectedInvestment && redeemForm.gross_proceeds && (
            <div className="p-3 bg-purple-50 rounded-lg text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Net Cash Inflow:</span>
                <b>
                  {formatINR(
                    parseFloat(redeemForm.gross_proceeds || '0') -
                      parseFloat(redeemForm.exit_load_fees || '0') -
                      parseFloat(redeemForm.tds_withheld || '0')
                  )}
                </b>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t border-purple-200">
                <span>Estimated Realized Gain / Loss:</span>
                <span className={parseFloat(redeemForm.gross_proceeds) - parseFloat(selectedInvestment.principal_amount) >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {formatINR(parseFloat(redeemForm.gross_proceeds) - parseFloat(selectedInvestment.principal_amount))}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowRedeemModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm"
            >
              {actionLoading ? 'Processing...' : 'Confirm Redemption & Post to Ledger'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: Approve Modal (Separation of duties enforced) */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title={`Approve Investment — ${selectedInvestment?.investment_id}`}
        subtitle="Separation of duties: The approving officer must be independent of the creator"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Investment Details Under Review</span>
            </div>
            <div>Name: <b>{selectedInvestment?.investment_name}</b></div>
            <div>Category: <b>{selectedInvestment?.category_display}</b></div>
            <div>Principal Amount: <b>{formatINR(selectedInvestment?.principal_amount)}</b></div>
            <div>Created By: <b>{selectedInvestment?.created_by_name || 'System Staff'}</b></div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Approval Remarks / Board Resolution Ref
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Approved per hospital treasury investment limit policy..."
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowApproveModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={actionLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
            >
              {actionLoading ? 'Approving...' : 'Confirm Approval'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 6: Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title={`Reject Investment — ${selectedInvestment?.investment_id}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Rejection Reason *
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Yield rate does not meet hospital investment policy threshold..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={actionLoading || !rejectReason.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
            >
              {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 7: Purchase / Placement Funds Workflow */}
      <Modal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        title={`Place / Purchase Funds — ${selectedInvestment?.investment_id}`}
        subtitle="This action will credit the source bank account and record a POSTED financial transaction in Section 14"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-indigo-50 rounded-xl text-xs space-y-1">
            <div className="font-semibold text-indigo-900">Placement Summary:</div>
            <div>Principal: <b>{formatINR(selectedInvestment?.principal_amount)}</b></div>
            <div>Institution: <b>{selectedInvestment?.issuing_institution}</b></div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Debit From Source Bank Account *
            </label>
            <select
              value={purchaseAccount}
              onChange={(e) => setPurchaseAccount(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="">Use previously linked account ({selectedInvestment?.financial_account_name || 'None'})</option>
              {financialAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_code} - {acc.account_name} ({formatINR(acc.current_balance)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowPurchaseModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePurchase}
              disabled={actionLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm"
            >
              {actionLoading ? 'Executing...' : 'Post Placement & Activate'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 8: Detailed Investment View & Audit Trail Drawer */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`Investment Details — ${selectedInvestment?.investment_id}`}
        subtitle={`${selectedInvestment?.investment_name} (${selectedInvestment?.category_display})`}
        size="xl"
      >
        <div className="space-y-4">
          {/* Tabs inside modal */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
            <button
              onClick={() => setDetailTab('OVERVIEW')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                detailTab === 'OVERVIEW' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Overview & Terms
            </button>
            <button
              onClick={() => setDetailTab('VALUATIONS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                detailTab === 'VALUATIONS' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Valuation History ({selectedInvestment?.valuation_history?.length || 0})
            </button>
            <button
              onClick={() => setDetailTab('INCOME')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                detailTab === 'INCOME' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Income Receipts ({selectedInvestment?.income_records?.length || 0})
            </button>
            <button
              onClick={() => setDetailTab('DOCUMENTS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                detailTab === 'DOCUMENTS' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Documents ({selectedInvestment?.documents?.length || 0})
            </button>
            <button
              onClick={() => setDetailTab('AUDIT')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                detailTab === 'AUDIT' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Audit Trail ({auditLogs.length})
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {detailTab === 'OVERVIEW' && selectedInvestment && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block uppercase">Principal Amount:</span>
                  <span className="text-sm font-bold text-slate-900">{formatINR(selectedInvestment.principal_amount)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase">Latest Valuation:</span>
                  <span className="text-sm font-bold text-emerald-600">{formatINR(selectedInvestment.latest_valuation)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase">Income Received:</span>
                  <span className="text-sm font-bold text-blue-600">{formatINR(selectedInvestment.total_income_received)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase">Current Status:</span>
                  <div className="mt-0.5">{getStatusBadge(selectedInvestment.lifecycle_status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block">Issuing Institution:</span>
                  <span className="font-semibold text-slate-800">{selectedInvestment.issuing_institution}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Reference / FD Receipt:</span>
                  <span className="font-mono text-slate-800">{selectedInvestment.reference_number || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Folio Number:</span>
                  <span className="font-mono text-slate-800">{selectedInvestment.folio_number || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Linked Bank Account:</span>
                  <span className="font-semibold text-slate-800">{selectedInvestment.financial_account_name || 'None'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Purchase Date:</span>
                  <span className="font-semibold text-slate-800">{selectedInvestment.purchase_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Maturity Date:</span>
                  <span className="font-semibold text-slate-800">{selectedInvestment.maturity_date || 'Open-ended'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Interest Rate:</span>
                  <span className="font-semibold text-slate-800">{selectedInvestment.interest_rate ? `${selectedInvestment.interest_rate}% p.a.` : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Compounding:</span>
                  <span className="font-semibold text-slate-800">{selectedInvestment.compounding_frequency_display}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Expected Maturity:</span>
                  <span className="font-semibold text-slate-800">{formatINR(selectedInvestment.expected_maturity_amount)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Created By:</span>
                  <span className="text-slate-700">{selectedInvestment.created_by_name || 'Staff'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Approved By:</span>
                  <span className="text-slate-700">{selectedInvestment.approved_by_name || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Acquisition Fees:</span>
                  <span className="text-slate-700">{formatINR(selectedInvestment.acquisition_fees)}</span>
                </div>
              </div>

              {selectedInvestment.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold uppercase mb-1">Notes / Rationale:</span>
                  <p className="text-slate-700">{selectedInvestment.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VALUATION HISTORY */}
          {detailTab === 'VALUATIONS' && selectedInvestment && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Valuation Records</span>
                <button
                  onClick={() => setShowValuationModal(true)}
                  className="px-3 py-1 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                >
                  + Add Valuation
                </button>
              </div>
              {selectedInvestment.valuation_history && selectedInvestment.valuation_history.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2 text-right">Valuation</th>
                        <th className="px-3 py-2 text-right">Unrealized G/L</th>
                        <th className="px-3 py-2">Source</th>
                        <th className="px-3 py-2">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvestment.valuation_history.map((vh) => (
                        <tr key={vh.id}>
                          <td className="px-3 py-2">{vh.valuation_date}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatINR(vh.recorded_valuation)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${parseFloat(vh.unrealized_gain_loss || '0') >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatINR(vh.unrealized_gain_loss)}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{vh.valuation_source}</td>
                          <td className="px-3 py-2 text-slate-500">{vh.recorded_by_name || 'Staff'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">No valuation history records logged yet.</div>
              )}
            </div>
          )}

          {/* TAB 3: INCOME RECEIPTS */}
          {detailTab === 'INCOME' && selectedInvestment && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Income Ledger</span>
                <button
                  onClick={() => setShowIncomeModal(true)}
                  className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  + Record Receipt
                </button>
              </div>
              {selectedInvestment.income_records && selectedInvestment.income_records.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2 text-right">Net Amount</th>
                        <th className="px-3 py-2 text-right">TDS Withheld</th>
                        <th className="px-3 py-2">Receiving Account</th>
                        <th className="px-3 py-2">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvestment.income_records.map((inc) => (
                        <tr key={inc.id}>
                          <td className="px-3 py-2">{inc.receipt_date}</td>
                          <td className="px-3 py-2 font-medium">{inc.income_type_display}</td>
                          <td className="px-3 py-2 text-right font-bold text-blue-600">{formatINR(inc.amount_received)}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{formatINR(inc.tds_withheld)}</td>
                          <td className="px-3 py-2 text-slate-600">{inc.receiving_account_name || '—'}</td>
                          <td className="px-3 py-2 font-mono text-slate-500">{inc.bank_reference || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">No interest or dividend receipts recorded yet.</div>
              )}
            </div>
          )}

          {/* TAB 4: SUPPORTING DOCUMENTS */}
          {detailTab === 'DOCUMENTS' && selectedInvestment && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Attached Certificates & Statements</span>
                <button
                  onClick={() => setShowDocModal(true)}
                  className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-1"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload Document</span>
                </button>
              </div>
              {selectedInvestment.documents && selectedInvestment.documents.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedInvestment.documents.map((doc) => (
                    <div key={doc.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        <div>
                          <div className="font-semibold text-slate-800">{doc.file_name}</div>
                          <div className="text-[11px] text-slate-400">{doc.document_type_display} • {doc.uploaded_at?.split('T')[0]}</div>
                        </div>
                      </div>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View</span>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">No deposit certificates or statements uploaded yet.</div>
              )}
            </div>
          )}

          {/* TAB 5: AUDIT TRAIL */}
          {detailTab === 'AUDIT' && (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-700">Immutable Audit Trail (Section 10)</span>
              {auditLoading ? (
                <div className="p-8 text-center text-slate-400 text-xs">Loading audit trail...</div>
              ) : auditLogs.length > 0 ? (
                <div className="space-y-2 border-l-2 border-indigo-200 pl-4 ml-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="relative pb-3 text-xs">
                      <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{log.action_display}</span>
                        <span className="text-[11px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="text-slate-600 mt-0.5">
                        Actor: <b>{log.actor_name}</b> ({log.actor_role})
                      </div>
                      {log.from_status && log.to_status && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Status Transition: <span className="font-mono">{log.from_status}</span> → <span className="font-mono font-bold text-indigo-700">{log.to_status}</span>
                        </div>
                      )}
                      {log.remarks && (
                        <div className="p-2 bg-slate-50 rounded text-slate-700 mt-1 italic">
                          "{log.remarks}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">No audit events recorded for this investment.</div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-200">
            <button
              onClick={() => setShowDetailModal(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 9: Upload Document Modal */}
      <Modal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        title="Upload Supporting Document"
        subtitle={`Attach certificate or bank advice for ${selectedInvestment?.investment_id}`}
        size="md"
      >
        <form onSubmit={handleUploadDocument} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Document Type *
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="DEPOSIT_CERTIFICATE">Fixed Deposit Certificate / Advice</option>
              <option value="BANK_STATEMENT">Bank Treasury Statement</option>
              <option value="HOLDING_STATEMENT">Demat / NSDL Holding Statement</option>
              <option value="APPROVAL_NOTE">Board / Committee Approval Note</option>
              <option value="REDEMPTION_ADVICE">Redemption / Settlement Advice</option>
              <option value="OTHER">Other Financial Document</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Select File (PDF, PNG, JPG) *
            </label>
            <input
              type="file"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowDocModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading || !docFile}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm"
            >
              {actionLoading ? 'Uploading...' : 'Upload & Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default InvestmentsPage;
