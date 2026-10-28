import React, { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
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
  TrendingDown,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  ArrowRight,
  Shield,
  CreditCard,
  Briefcase,
  BarChart3
} from 'lucide-react';
import { billingFinanceService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { parseApiError } from '../../utils/errorHandler';

interface LoanRepaymentSchedule {
  id: string;
  installment_number: number;
  due_date: string;
  opening_principal: string;
  principal_due: string;
  interest_due: string;
  fee_amount: string;
  total_due: string;
  closing_principal: string;
  paid_amount: string;
  paid_principal: string;
  paid_interest: string;
  paid_fee: string;
  payment_date?: string;
  payment_status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  payment_status_display?: string;
}

interface LoanRepaymentRecord {
  id: string;
  repayment_number: string;
  repayment_date: string;
  total_amount: string;
  principal_amount: string;
  interest_amount: string;
  fee_or_penalty: string;
  payment_method: string;
  reference_number: string;
  servicing_account_name?: string;
  servicing_account_code?: string;
  transaction_number?: string;
  is_early_payoff: boolean;
  notes?: string;
  created_at: string;
}

interface LoanDocument {
  id: string;
  title: string;
  document_type: string;
  document_type_display?: string;
  file_url?: string;
  file_size?: number;
  uploaded_by_name?: string;
  uploaded_at: string;
}

interface LoanAuditLog {
  id: string;
  action: string;
  actor_name: string;
  actor_role: string;
  previous_status: string;
  new_status: string;
  notes: string;
  created_at: string;
}

interface Loan {
  id: string;
  loan_account_number: string;
  lender_name: string;
  loan_type: string;
  loan_type_display?: string;
  principal_amount: string;
  sanctioned_amount?: string;
  disbursed_amount: string;
  disbursement_date?: string;
  interest_rate_pct: string;
  tenure_months: number;
  repayment_frequency: string;
  repayment_frequency_display?: string;
  monthly_emi: string;
  total_repaid: string;
  total_principal_repaid: string;
  total_interest_paid: string;
  total_fees_paid: string;
  outstanding_balance: string;
  start_date: string;
  maturity_date?: string;
  status: string;
  lifecycle_status: string;
  lifecycle_status_display?: string;
  is_secured: boolean;
  collateral_details?: string;
  collateral_value?: string;
  purpose?: string;
  servicing_financial_account?: string;
  servicing_account_name?: string;
  liability_financial_account?: string;
  liability_account_name?: string;
  branch_name?: string;
  department_name?: string;
  created_by_name?: string;
  approved_by_name?: string;
  repayment_schedules?: LoanRepaymentSchedule[];
  repayment_records?: LoanRepaymentRecord[];
  documents?: LoanDocument[];
  audit_logs?: LoanAuditLog[];
}

interface LiabilityPaymentRecord {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: string;
  payment_method: string;
  reference_number: string;
  servicing_account_name?: string;
  transaction_number?: string;
  notes?: string;
  created_at: string;
}

interface LiabilityDocument {
  id: string;
  title: string;
  document_type: string;
  document_type_display?: string;
  file_url?: string;
  uploaded_by_name?: string;
  uploaded_at: string;
}

interface LiabilityAuditLog {
  id: string;
  action: string;
  actor_name: string;
  actor_role: string;
  previous_status: string;
  new_status: string;
  notes: string;
  created_at: string;
}

interface Liability {
  id: string;
  liability_number: string;
  title: string;
  category: string;
  category_display?: string;
  tenure_type: string;
  tenure_type_display?: string;
  creditor_name: string;
  creditor_reference?: string;
  original_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  incurred_date: string;
  due_date: string;
  payment_status: string;
  payment_status_display?: string;
  priority: string;
  priority_display?: string;
  branch_name?: string;
  supplier_name?: string;
  supplier_invoice_number?: string;
  payments?: LiabilityPaymentRecord[];
  documents?: LiabilityDocument[];
  audit_logs?: LiabilityAuditLog[];
}

export const LoansPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'loans' | 'liabilities' | 'schedules' | 'reports'>('dashboard');

  // Core Data
  const [loans, setLoans] = useState<Loan[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [financialAccounts, setFinancialAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [loanStatusFilter, setLoanStatusFilter] = useState('ALL');
  const [loanTypeFilter, setLoanTypeFilter] = useState('ALL');
  const [liabilityCategoryFilter, setLiabilityCategoryFilter] = useState('ALL');
  const [liabilityStatusFilter, setLiabilityStatusFilter] = useState('ALL');
  const [liabilityTenureFilter, setLiabilityTenureFilter] = useState('ALL');

  // Modals state
  const [isCreateLoanOpen, setIsCreateLoanOpen] = useState(false);
  const [isCreateLiabilityOpen, setIsCreateLiabilityOpen] = useState(false);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [isPayLiabilityModalOpen, setIsPayLiabilityModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedLiability, setSelectedLiability] = useState<Liability | null>(null);
  const [modalActionLoading, setModalActionLoading] = useState(false);

  // Forms
  const [loanForm, setLoanForm] = useState({
    loan_account_number: '',
    lender_name: '',
    loan_type: 'TERM_LOAN',
    principal_amount: '',
    interest_rate_pct: '9.50',
    tenure_months: '36',
    repayment_frequency: 'MONTHLY',
    start_date: new Date().toISOString().split('T')[0],
    servicing_financial_account: '',
    purpose: '',
    is_secured: true,
    collateral_details: '',
    collateral_value: '0.00',
    lifecycle_status: 'PENDING_APPROVAL'
  });

  const [liabilityForm, setLiabilityForm] = useState({
    title: '',
    category: 'SUPPLIER_PAYABLE',
    tenure_type: 'SHORT_TERM',
    creditor_name: '',
    creditor_reference: '',
    original_amount: '',
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'MEDIUM',
    notes: ''
  });

  const [disburseForm, setDisburseForm] = useState({
    amount: '',
    servicing_account_id: '',
    reference_number: '',
    payment_method: 'RTGS_NEFT'
  });

  const [repayForm, setRepayForm] = useState({
    amount: '',
    principal_amount: '',
    interest_amount: '',
    fee_or_penalty: '0.00',
    servicing_account_id: '',
    reference_number: '',
    payment_method: 'ACH_DEBIT',
    notes: ''
  });

  const [liabilityPayForm, setLiabilityPayForm] = useState({
    amount: '',
    servicing_account_id: '',
    reference_number: '',
    payment_method: 'BANK_TRANSFER',
    notes: ''
  });

  // Load Initial Data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [loansData, liabsData, dashData, accountsData] = await Promise.all([
        billingFinanceService.getLoans(),
        billingFinanceService.getLiabilities(),
        billingFinanceService.getLoanLiabilityDashboard(),
        billingFinanceService.getFinancialAccounts().catch(() => [])
      ]);
      setLoans(Array.isArray(loansData) ? loansData : loansData?.results || []);
      setLiabilities(Array.isArray(liabsData) ? liabsData : liabsData?.results || []);
      setDashboardStats(dashData);
      setFinancialAccounts(Array.isArray(accountsData) ? accountsData : accountsData?.results || []);
    } catch (err: any) {
      console.error('Error loading loan & liability management data:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to load debt and liability registers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Live EMI Calculator for Create Loan Modal
  const liveEmi = useMemo(() => {
    const p = parseFloat(loanForm.principal_amount || '0');
    const r = parseFloat(loanForm.interest_rate_pct || '0');
    const n = parseInt(loanForm.tenure_months || '0', 10);
    if (p <= 0 || n <= 0) return 0;
    if (r <= 0) return p / n;
    const monthlyRate = r / 100 / 12;
    const powTerm = Math.pow(1 + monthlyRate, n);
    const emi = (p * monthlyRate * powTerm) / (powTerm - 1);
    return Math.round(emi);
  }, [loanForm.principal_amount, loanForm.interest_rate_pct, loanForm.tenure_months]);

  // Handlers
  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalActionLoading(true);
      setError(null);
      await billingFinanceService.createLoan({
        ...loanForm,
        principal_amount: loanForm.principal_amount,
        interest_rate_pct: loanForm.interest_rate_pct,
        tenure_months: parseInt(loanForm.tenure_months, 10),
        monthly_emi: liveEmi.toString()
      });
      setSuccessMsg('Loan facility registered successfully.');
      setIsCreateLoanOpen(false);
      setLoanForm({
        loan_account_number: '',
        lender_name: '',
        loan_type: 'TERM_LOAN',
        principal_amount: '',
        interest_rate_pct: '9.50',
        tenure_months: '36',
        repayment_frequency: 'MONTHLY',
        start_date: new Date().toISOString().split('T')[0],
        servicing_financial_account: '',
        purpose: '',
        is_secured: true,
        collateral_details: '',
        collateral_value: '0.00',
        lifecycle_status: 'PENDING_APPROVAL'
      });
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setModalActionLoading(false);
    }
  };

  const handleCreateLiability = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalActionLoading(true);
      setError(null);
      await billingFinanceService.createLiability(liabilityForm);
      setSuccessMsg('Liability recorded successfully.');
      setIsCreateLiabilityOpen(false);
      setLiabilityForm({
        title: '',
        category: 'SUPPLIER_PAYABLE',
        tenure_type: 'SHORT_TERM',
        creditor_name: '',
        creditor_reference: '',
        original_amount: '',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'MEDIUM',
        notes: ''
      });
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setModalActionLoading(false);
    }
  };

  const handleApproveLoan = async (loanId: string) => {
    try {
      setLoading(true);
      setError(null);
      await billingFinanceService.approveLoan(loanId);
      setSuccessMsg('Loan application approved by Finance Manager.');
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisburseLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    try {
      setModalActionLoading(true);
      setError(null);
      await billingFinanceService.disburseLoan(selectedLoan.id, disburseForm);
      setSuccessMsg(`Loan ₹${disburseForm.amount} disbursed to bank account successfully.`);
      setIsDisburseModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setModalActionLoading(false);
    }
  };

  const handleRecordRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    try {
      setModalActionLoading(true);
      setError(null);
      await billingFinanceService.recordLoanRepayment(selectedLoan.id, repayForm);
      setSuccessMsg(`Repayment of ₹${repayForm.amount} processed successfully.`);
      setIsRepayModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setModalActionLoading(false);
    }
  };

  const handleRecordLiabilityPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLiability) return;
    try {
      setModalActionLoading(true);
      setError(null);
      await billingFinanceService.recordLiabilityPayment(selectedLiability.id, liabilityPayForm);
      setSuccessMsg(`Liability payment of ₹${liabilityPayForm.amount} recorded.`);
      setIsPayLiabilityModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setModalActionLoading(false);
    }
  };

  const handleSyncSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await billingFinanceService.syncSupplierInvoices();
      setSuccessMsg(res.message || 'Supplier invoices synced.');
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async (type: 'loans' | 'liabilities') => {
    try {
      const blob = type === 'loans'
        ? await billingFinanceService.exportLoansCsv()
        : await billingFinanceService.exportLiabilitiesCsv();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hms_${type}_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setError('Export failed.');
    }
  };

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return loans.filter((l) => {
      const matchSearch =
        l.loan_account_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.lender_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.purpose?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = loanStatusFilter === 'ALL' || l.lifecycle_status === loanStatusFilter || l.status === loanStatusFilter;
      const matchType = loanTypeFilter === 'ALL' || l.loan_type === loanTypeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [loans, searchTerm, loanStatusFilter, loanTypeFilter]);

  // Filtered Liabilities
  const filteredLiabilities = useMemo(() => {
    return liabilities.filter((l) => {
      const matchSearch =
        l.liability_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.creditor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.creditor_reference?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = liabilityCategoryFilter === 'ALL' || l.category === liabilityCategoryFilter;
      const matchStatus = liabilityStatusFilter === 'ALL' || l.payment_status === liabilityStatusFilter;
      const matchTenure = liabilityTenureFilter === 'ALL' || l.tenure_type === liabilityTenureFilter;
      return matchSearch && matchCat && matchStatus && matchTenure;
    });
  }, [liabilities, searchTerm, liabilityCategoryFilter, liabilityStatusFilter, liabilityTenureFilter]);

  // All schedules flattened
  const allSchedules = useMemo(() => {
    const list: any[] = [];
    loans.forEach((loan) => {
      (loan.repayment_schedules || []).forEach((sched) => {
        list.push({
          ...sched,
          loan_id: loan.id,
          loan_number: loan.loan_account_number,
          lender_name: loan.lender_name,
        });
      });
    });
    return list.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [loans]);

  // Status badge styling
  const renderStatusBadge = (statusStr: string) => {
    switch (statusStr?.toUpperCase()) {
      case 'ACTIVE':
        return <Badge variant="success">Active / Current</Badge>;
      case 'APPROVED':
        return <Badge variant="info">Sanctioned</Badge>;
      case 'PENDING':
      case 'PENDING_APPROVAL':
        return <Badge variant="warning">Under Review</Badge>;
      case 'DRAFT':
        return <Badge variant="neutral">Draft Facility</Badge>;
      case 'PAID':
      case 'CLOSED':
        return <Badge variant="neutral">Settled & Closed</Badge>;
      case 'OVERDUE':
        return <Badge variant="danger">Overdue</Badge>;
      default:
        return <Badge variant="neutral">{statusStr}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 text-rose-400">
              <Landmark className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Section 16: Loan & Liability Management
              </h1>
              <p className="text-xs text-slate-400">
                Institutional debt facilities, equipment financing, monthly EMI schedules, supplier payables, and dual-entry ledger reconciliation.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsCreateLoanOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-md shadow-rose-900/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Loan Facility
          </button>

          <button
            onClick={() => setIsCreateLiabilityOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-md shadow-amber-900/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Liability
          </button>

          <button
            onClick={handleSyncSuppliers}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
            title="Sync unpaid PO/GRN supplier invoices from Section 10"
          >
            <Receipt className="w-3.5 h-3.5 text-cyan-400" />
            Sync Section 10 Payables
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 text-sm overflow-x-auto pb-1">
        {[
          { key: 'dashboard', label: '1. Executive Dashboard & KPIs', icon: BarChart3 },
          { key: 'loans', label: `2. Loan Facilities (${loans.length})`, icon: Landmark },
          { key: 'liabilities', label: `3. Hospital Liabilities (${liabilities.length})`, icon: Receipt },
          { key: 'schedules', label: '4. EMI & Repayment Amortization', icon: Calendar },
          { key: 'reports', label: '5. Audit Trail & CSV Export', icon: FileSpreadsheet },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-rose-500 text-rose-400 bg-rose-500/10 rounded-t-lg'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: EXECUTIVE DASHBOARD & KPIS
          ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Overdue Alert Banner if any */}
          {dashboardStats && (dashboardStats.overdue_installments_count > 0 || dashboardStats.overdue_liabilities_count > 0) && (
            <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-semibold text-rose-300">Action Required: Overdue Financial Obligations Detected!</span>
                <p className="text-slate-300 text-xs mt-1">
                  The hospital has <strong className="text-rose-400">{dashboardStats.overdue_installments_count} overdue loan installments</strong> totaling ₹{parseFloat(dashboardStats.overdue_installments_amount || '0').toLocaleString('en-IN')} and <strong className="text-rose-400">{dashboardStats.overdue_liabilities_count} overdue vendor payables</strong> totaling ₹{parseFloat(dashboardStats.overdue_liabilities_amount || '0').toLocaleString('en-IN')}. Please disburse payments to maintain institution credit rating.
                </p>
              </div>
            </div>
          )}

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Outstanding Debt</span>
                <Landmark className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-black text-rose-400 mt-2">
                ₹{parseFloat(dashboardStats?.total_loan_outstanding || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-800/60">
                <span>Sanctioned: ₹{parseFloat(dashboardStats?.total_loan_sanctioned || '0').toLocaleString('en-IN')}</span>
                <span className="text-slate-400 font-mono">{dashboardStats?.active_loans_count || 0} active loans</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Recorded Liabilities</span>
                <Receipt className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-400 mt-2">
                ₹{parseFloat(dashboardStats?.total_liabilities_outstanding || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-800/60">
                <span>Short-Term: ₹{parseFloat(dashboardStats?.short_term_liabilities || '0').toLocaleString('en-IN')}</span>
                <span>Long-Term: ₹{parseFloat(dashboardStats?.long_term_liabilities || '0').toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly Debt Service (EMI)</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-2xl font-black text-slate-100 mt-2">
                ₹{parseFloat(dashboardStats?.total_monthly_emi || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-800/60">
                <span>Principal Repaid: ₹{parseFloat(dashboardStats?.total_principal_repaid || '0').toLocaleString('en-IN')}</span>
                <span>Interest: ₹{parseFloat(dashboardStats?.total_interest_paid || '0').toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Upcoming Due (30 Days)</span>
                <Calendar className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 mt-2">
                ₹{(
                  parseFloat(dashboardStats?.upcoming_installments_30_days_amount || '0') +
                  parseFloat(dashboardStats?.upcoming_liabilities_30_days_amount || '0')
                ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-800/60">
                <span>{dashboardStats?.upcoming_installments_count || 0} loan EMIs</span>
                <span>{dashboardStats?.upcoming_liabilities_count || 0} liability bills</span>
              </div>
            </div>
          </div>

          {/* Breakdown Charts & Horizons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Liability Category Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-amber-400" />
                  Liability Breakdown by Category
                </h3>
                <span className="text-xs text-slate-400">Section 16 Obligations</span>
              </div>
              <div className="space-y-3">
                {(dashboardStats?.category_breakdown || []).map((cat: any) => {
                  const total = parseFloat(dashboardStats?.total_liabilities_outstanding || '1');
                  const amt = parseFloat(cat.amount || '0');
                  const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : '0';
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">{cat.label} ({cat.count})</span>
                        <span className="font-mono text-slate-100 font-semibold">
                          ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(2, parseFloat(pct)))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Monthly Debt Service Trend */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  Debt Service History (Last 6 Months)
                </h3>
                <span className="text-xs text-slate-400">Principal vs Interest</span>
              </div>
              <div className="space-y-3">
                {(dashboardStats?.debt_service_trend || []).map((t: any) => (
                  <div key={t.month} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
                    <div>
                      <span className="font-semibold text-slate-200 block">{t.month}</span>
                      <span className="text-[11px] text-slate-400">
                        Principal: ₹{parseFloat(t.principal_repaid).toLocaleString('en-IN')} | Interest: ₹{parseFloat(t.interest_paid).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-100 block">
                        ₹{parseFloat(t.total_debt_service).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-500">Total Outflow</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: LOAN FACILITIES
          ========================================================================= */}
      {activeTab === 'loans' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search lender, account #, purpose..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={loanStatusFilter}
                onChange={(e) => setLoanStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="APPROVED">Approved / Sanctioned</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="DRAFT">Draft</option>
                <option value="OVERDUE">Overdue</option>
                <option value="CLOSED">Closed / Paid Off</option>
              </select>

              <select
                value={loanTypeFilter}
                onChange={(e) => setLoanTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="ALL">All Loan Types</option>
                <option value="TERM_LOAN">Term Loan</option>
                <option value="EQUIPMENT_FINANCING">Equipment Financing</option>
                <option value="WORKING_CAPITAL">Working Capital</option>
                <option value="MORTGAGE">Mortgage</option>
                <option value="CREDIT_LINE">Credit Line</option>
                <option value="UNSECURED_LOAN">Unsecured</option>
              </select>

              <button
                onClick={() => handleExportCsv('loans')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
          </div>

          {/* Loans Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Loan Account #</th>
                    <th className="px-4 py-3">Lender & Type</th>
                    <th className="px-4 py-3 text-right">Sanctioned</th>
                    <th className="px-4 py-3 text-right">Disbursed</th>
                    <th className="px-4 py-3 text-right">Rate & Tenure</th>
                    <th className="px-4 py-3 text-right">Monthly EMI</th>
                    <th className="px-4 py-3 text-right">Current Principal</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                          Loading institutional debt registers...
                        </div>
                      </td>
                    </tr>
                  ) : filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        No hospital loan facilities match your query.
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-rose-400 block">{loan.loan_account_number}</span>
                          <span className="text-[10px] text-slate-400">Start: {loan.start_date}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-100 block">{loan.lender_name}</span>
                          <span className="text-[10px] text-slate-400">{loan.loan_type_display || loan.loan_type}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-200">
                          ₹{parseFloat(loan.sanctioned_amount || loan.principal_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-300">
                          ₹{parseFloat(loan.disbursed_amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-amber-400 block">{parseFloat(loan.interest_rate_pct).toFixed(2)}% p.a.</span>
                          <span className="text-[10px] text-slate-400">{loan.tenure_months} months</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-100">
                          ₹{parseFloat(loan.monthly_emi || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-rose-400">
                          ₹{parseFloat(loan.outstanding_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {renderStatusBadge(loan.lifecycle_status || loan.status)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedLoan(loan);
                                setIsDetailsModalOpen(true);
                              }}
                              className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100"
                              title="View Details & Schedules"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {loan.lifecycle_status === 'PENDING_APPROVAL' && (
                              <button
                                onClick={() => handleApproveLoan(loan.id)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold"
                                title="Approve Loan Facility"
                              >
                                Approve
                              </button>
                            )}

                            {loan.lifecycle_status === 'APPROVED' && (
                              <button
                                onClick={() => {
                                  setSelectedLoan(loan);
                                  setDisburseForm({
                                    amount: loan.principal_amount,
                                    servicing_account_id: loan.servicing_financial_account || (financialAccounts[0]?.id || ''),
                                    reference_number: '',
                                    payment_method: 'RTGS_NEFT'
                                  });
                                  setIsDisburseModalOpen(true);
                                }}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold"
                                title="Disburse Funds"
                              >
                                Disburse
                              </button>
                            )}

                            {(loan.lifecycle_status === 'ACTIVE' || loan.lifecycle_status === 'OVERDUE') && (
                              <button
                                onClick={() => {
                                  setSelectedLoan(loan);
                                  setRepayForm({
                                    amount: loan.monthly_emi,
                                    principal_amount: '',
                                    interest_amount: '',
                                    fee_or_penalty: '0.00',
                                    servicing_account_id: loan.servicing_financial_account || (financialAccounts[0]?.id || ''),
                                    reference_number: '',
                                    payment_method: 'ACH_DEBIT',
                                    notes: ''
                                  });
                                  setIsRepayModalOpen(true);
                                }}
                                className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-semibold"
                                title="Record EMI Repayment"
                              >
                                Pay EMI
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

      {/* =========================================================================
          TAB 3: HOSPITAL LIABILITIES
          ========================================================================= */}
      {activeTab === 'liabilities' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search creditor, bill reference, invoice #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={liabilityCategoryFilter}
                onChange={(e) => setLiabilityCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Categories</option>
                <option value="SUPPLIER_PAYABLE">Supplier Payables</option>
                <option value="EQUIPMENT_PAYABLE">Equipment Financing</option>
                <option value="OPERATING_EXPENSE">Operating Expenses</option>
                <option value="ACCRUED_EXPENSE">Accrued Expenses</option>
                <option value="STATUTORY_TAX_PAYABLE">Taxes & Statutory</option>
              </select>

              <select
                value={liabilityTenureFilter}
                onChange={(e) => setLiabilityTenureFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Tenures</option>
                <option value="SHORT_TERM">Short-Term (&lt;= 12m)</option>
                <option value="LONG_TERM">Long-Term (&gt; 12m)</option>
              </select>

              <select
                value={liabilityStatusFilter}
                onChange={(e) => setLiabilityStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid / Settled</option>
                <option value="OVERDUE">Overdue</option>
              </select>

              <button
                onClick={() => handleExportCsv('liabilities')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
          </div>

          {/* Liabilities Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Liability #</th>
                    <th className="px-4 py-3">Title & Creditor</th>
                    <th className="px-4 py-3">Category & Tenure</th>
                    <th className="px-4 py-3 text-right">Original Amount</th>
                    <th className="px-4 py-3 text-right">Paid Amount</th>
                    <th className="px-4 py-3 text-right">Outstanding</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                          Loading hospital payables and obligations...
                        </div>
                      </td>
                    </tr>
                  ) : filteredLiabilities.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        No financial liabilities recorded.
                      </td>
                    </tr>
                  ) : (
                    filteredLiabilities.map((liab) => (
                      <tr key={liab.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-amber-400">
                          {liab.liability_number}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-100 block">{liab.title}</span>
                          <span className="text-[10px] text-slate-400">{liab.creditor_name} {liab.creditor_reference && `(#${liab.creditor_reference})`}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-200 block">{liab.category_display || liab.category}</span>
                          <span className="text-[10px] text-slate-400">{liab.tenure_type_display || liab.tenure_type}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-200">
                          ₹{parseFloat(liab.original_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-400">
                          ₹{parseFloat(liab.paid_amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-400">
                          ₹{parseFloat(liab.outstanding_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {liab.due_date}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {renderStatusBadge(liab.payment_status)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {liab.payment_status !== 'PAID' && (
                            <button
                              onClick={() => {
                                setSelectedLiability(liab);
                                setLiabilityPayForm({
                                  amount: liab.outstanding_amount,
                                  servicing_account_id: financialAccounts[0]?.id || '',
                                  reference_number: '',
                                  payment_method: 'BANK_TRANSFER',
                                  notes: ''
                                });
                                setIsPayLiabilityModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-semibold"
                            >
                              Pay Now
                            </button>
                          )}
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

      {/* =========================================================================
          TAB 4: EMI & REPAYMENT AMORTIZATION SCHEDULES
          ========================================================================= */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                Hospital-Wide Debt Amortization & Repayment Calendar
              </h3>
              <p className="text-xs text-slate-400">
                All upcoming and past due loan installments chronologically arranged with principal and interest breakdowns.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Installment #</th>
                    <th className="px-4 py-3">Loan Account</th>
                    <th className="px-4 py-3">Lender</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3 text-right">Principal Due</th>
                    <th className="px-4 py-3 text-right">Interest Due</th>
                    <th className="px-4 py-3 text-right">Total Installment</th>
                    <th className="px-4 py-3 text-right">Paid Amount</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        No active amortization schedules generated yet. Disburse or approve active loans to generate.
                      </td>
                    </tr>
                  ) : (
                    allSchedules.map((s, idx) => (
                      <tr key={`${s.loan_id}-${s.installment_number}-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-slate-400">
                          #{s.installment_number}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-rose-400">
                          {s.loan_number}
                        </td>
                        <td className="px-4 py-3 text-slate-200">
                          {s.lender_name}
                        </td>
                        <td className="px-4 py-3 text-slate-300 font-medium">
                          {s.due_date}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-200">
                          ₹{parseFloat(s.principal_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-amber-400">
                          ₹{parseFloat(s.interest_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-100">
                          ₹{parseFloat(s.total_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                          ₹{parseFloat(s.paid_amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {renderStatusBadge(s.payment_status)}
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

      {/* =========================================================================
          TAB 5: AUDIT TRAIL & CSV EXPORT
          ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                Financial Audit Trail & Compliance Reports
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Export complete audit schedules for statutory reporting, Comptroller reconciliation, and institutional banking compliance.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleExportCsv('loans')}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Loans CSV
              </button>
              <button
                onClick={() => handleExportCsv('liabilities')}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shadow transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Liabilities CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
          ========================================================================= */}

      {/* CREATE LOAN MODAL */}
      {isCreateLoanOpen && (
        <Modal
          isOpen={isCreateLoanOpen}
          onClose={() => setIsCreateLoanOpen(false)}
          title="Register Hospital Loan Facility"
          size="lg"
        >
          <form onSubmit={handleCreateLoan} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Lender Institution *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank, SBI, NABARD"
                  value={loanForm.lender_name}
                  onChange={(e) => setLoanForm({ ...loanForm, lender_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Loan Account # (or Auto-Gen)</label>
                <input
                  type="text"
                  placeholder="Optional custom reference"
                  value={loanForm.loan_account_number}
                  onChange={(e) => setLoanForm({ ...loanForm, loan_account_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Loan Type *</label>
                <select
                  value={loanForm.loan_type}
                  onChange={(e) => setLoanForm({ ...loanForm, loan_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="TERM_LOAN">Term Loan</option>
                  <option value="EQUIPMENT_FINANCING">Medical Equipment Financing</option>
                  <option value="WORKING_CAPITAL">Working Capital Facility</option>
                  <option value="MORTGAGE">Mortgage / Building Loan</option>
                  <option value="CREDIT_LINE">Credit Line</option>
                  <option value="VEHICLE_LOAN">Ambulance & Vehicle Loan</option>
                  <option value="UNSECURED_LOAN">Unsecured Commercial Debt</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Principal Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  placeholder="e.g. 5000000"
                  value={loanForm.principal_amount}
                  onChange={(e) => setLoanForm({ ...loanForm, principal_amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Annual Interest Rate (%) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder="e.g. 9.50"
                  value={loanForm.interest_rate_pct}
                  onChange={(e) => setLoanForm({ ...loanForm, interest_rate_pct: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Tenure (Months) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 36"
                  value={loanForm.tenure_months}
                  onChange={(e) => setLoanForm({ ...loanForm, tenure_months: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Start Date *</label>
                <input
                  type="date"
                  required
                  value={loanForm.start_date}
                  onChange={(e) => setLoanForm({ ...loanForm, start_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Servicing Bank Account *</label>
                <select
                  required
                  value={loanForm.servicing_financial_account}
                  onChange={(e) => setLoanForm({ ...loanForm, servicing_financial_account: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="">Select Hospital Bank Account</option>
                  {financialAccounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.account_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live EMI Preview Card */}
            <div className="bg-slate-950 border border-rose-500/30 rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-rose-400" />
                <span className="text-slate-300 font-medium">Calculated Monthly EMI:</span>
              </div>
              <span className="text-base font-bold font-mono text-rose-400">
                ₹{liveEmi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Purpose of Loan</label>
              <textarea
                rows={2}
                placeholder="e.g. Purchase of Siemens SOMATOM CT Scanner"
                value={loanForm.purpose}
                onChange={(e) => setLoanForm({ ...loanForm, purpose: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateLoanOpen(false)}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalActionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-2"
              >
                {modalActionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Register Facility
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE LIABILITY MODAL */}
      {isCreateLiabilityOpen && (
        <Modal
          isOpen={isCreateLiabilityOpen}
          onClose={() => setIsCreateLiabilityOpen(false)}
          title="Record Hospital Liability / Payable"
          size="md"
        >
          <form onSubmit={handleCreateLiability} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Title / Obligation Description *</label>
              <input
                type="text"
                required
                placeholder="e.g. Diagnostic Reagent Supply Q3"
                value={liabilityForm.title}
                onChange={(e) => setLiabilityForm({ ...liabilityForm, title: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category *</label>
                <select
                  value={liabilityForm.category}
                  onChange={(e) => setLiabilityForm({ ...liabilityForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="SUPPLIER_PAYABLE">Supplier / Vendor Payable</option>
                  <option value="EQUIPMENT_PAYABLE">Equipment Financing</option>
                  <option value="OPERATING_EXPENSE">Operating Expense</option>
                  <option value="ACCRUED_EXPENSE">Accrued Expense / Salaries</option>
                  <option value="STATUTORY_TAX_PAYABLE">Statutory Tax Duty</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Creditor / Vendor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medtronic India Pvt Ltd"
                  value={liabilityForm.creditor_name}
                  onChange={(e) => setLiabilityForm({ ...liabilityForm, creditor_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Original Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  placeholder="e.g. 150000"
                  value={liabilityForm.original_amount}
                  onChange={(e) => setLiabilityForm({ ...liabilityForm, original_amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Due Date *</label>
                <input
                  type="date"
                  required
                  value={liabilityForm.due_date}
                  onChange={(e) => setLiabilityForm({ ...liabilityForm, due_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Creditor Invoice / Bill Ref</label>
              <input
                type="text"
                placeholder="e.g. INV-2026-9901"
                value={liabilityForm.creditor_reference}
                onChange={(e) => setLiabilityForm({ ...liabilityForm, creditor_reference: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateLiabilityOpen(false)}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalActionLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-2"
              >
                {modalActionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Record Liability
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* DISBURSE LOAN MODAL */}
      {isDisburseModalOpen && selectedLoan && (
        <Modal
          isOpen={isDisburseModalOpen}
          onClose={() => setIsDisburseModalOpen(false)}
          title={`Disburse Loan: ${selectedLoan.loan_account_number}`}
          size="sm"
        >
          <form onSubmit={handleDisburseLoan} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Disbursed Amount (₹) *</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={disburseForm.amount}
                onChange={(e) => setDisburseForm({ ...disburseForm, amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Receiving Bank Account *</label>
              <select
                required
                value={disburseForm.servicing_account_id}
                onChange={(e) => setDisburseForm({ ...disburseForm, servicing_account_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">Select Bank Account</option>
                {financialAccounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.account_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Disbursement Bank UTR / Ref *</label>
              <input
                type="text"
                required
                placeholder="e.g. UTR-HDFC-998811"
                value={disburseForm.reference_number}
                onChange={(e) => setDisburseForm({ ...disburseForm, reference_number: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDisburseModalOpen(false)}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalActionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-2"
              >
                {modalActionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Disbursement
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* RECORD LOAN REPAYMENT MODAL */}
      {isRepayModalOpen && selectedLoan && (
        <Modal
          isOpen={isRepayModalOpen}
          onClose={() => setIsRepayModalOpen(false)}
          title={`Record Repayment: ${selectedLoan.loan_account_number}`}
          size="sm"
        >
          <form onSubmit={handleRecordRepayment} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Total Payment Amount (₹) *</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={repayForm.amount}
                onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Principal Component (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Optional auto-alloc"
                  value={repayForm.principal_amount}
                  onChange={(e) => setRepayForm({ ...repayForm, principal_amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Interest Component (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Optional auto-alloc"
                  value={repayForm.interest_amount}
                  onChange={(e) => setRepayForm({ ...repayForm, interest_amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Servicing Bank Account *</label>
              <select
                required
                value={repayForm.servicing_account_id}
                onChange={(e) => setRepayForm({ ...repayForm, servicing_account_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">Select Servicing Account</option>
                {financialAccounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.account_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Bank Payment Reference / UTR *</label>
              <input
                type="text"
                required
                placeholder="e.g. ACH-DEBIT-9988"
                value={repayForm.reference_number}
                onChange={(e) => setRepayForm({ ...repayForm, reference_number: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsRepayModalOpen(false)}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalActionLoading}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-2"
              >
                {modalActionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Post Repayment
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* RECORD LIABILITY PAYMENT MODAL */}
      {isPayLiabilityModalOpen && selectedLiability && (
        <Modal
          isOpen={isPayLiabilityModalOpen}
          onClose={() => setIsPayLiabilityModalOpen(false)}
          title={`Settle Payable: ${selectedLiability.liability_number}`}
          size="sm"
        >
          <form onSubmit={handleRecordLiabilityPayment} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Payment Amount (₹) *</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                max={selectedLiability.outstanding_amount}
                value={liabilityPayForm.amount}
                onChange={(e) => setLiabilityPayForm({ ...liabilityPayForm, amount: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Outstanding Balance: ₹{parseFloat(selectedLiability.outstanding_amount).toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Servicing Bank Account *</label>
              <select
                required
                value={liabilityPayForm.servicing_account_id}
                onChange={(e) => setLiabilityPayForm({ ...liabilityPayForm, servicing_account_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Select Servicing Account</option>
                {financialAccounts.map((acc: any) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.account_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Bank Payment Reference / UTR *</label>
              <input
                type="text"
                required
                placeholder="e.g. NEFT-VENDOR-9911"
                value={liabilityPayForm.reference_number}
                onChange={(e) => setLiabilityPayForm({ ...liabilityPayForm, reference_number: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsPayLiabilityModalOpen(false)}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalActionLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-2"
              >
                {modalActionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Payment
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* LOAN DETAILS & AMORTIZATION MODAL */}
      {isDetailsModalOpen && selectedLoan && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`Loan Facility: ${selectedLoan.loan_account_number}`}
          size="xl"
        >
          <div className="space-y-6">
            {/* Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Lender</span>
                <span className="font-semibold text-slate-100">{selectedLoan.lender_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Loan Type</span>
                <span className="font-semibold text-slate-100">{selectedLoan.loan_type_display || selectedLoan.loan_type}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Principal Borrowed</span>
                <span className="font-mono font-semibold text-rose-400">
                  ₹{parseFloat(selectedLoan.principal_amount).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Outstanding Principal</span>
                <span className="font-mono font-bold text-rose-400">
                  ₹{parseFloat(selectedLoan.outstanding_balance).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Interest Rate</span>
                <span className="font-bold text-amber-400">{parseFloat(selectedLoan.interest_rate_pct).toFixed(2)}% p.a.</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Monthly EMI</span>
                <span className="font-mono text-slate-100 font-semibold">₹{parseFloat(selectedLoan.monthly_emi).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Tenure</span>
                <span className="text-slate-200">{selectedLoan.tenure_months} Months</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Status</span>
                <span className="block mt-0.5">{renderStatusBadge(selectedLoan.lifecycle_status)}</span>
              </div>
            </div>

            {/* Amortization Schedule Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-rose-400" />
                Amortization Installment Schedule
              </h4>
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 sticky top-0 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Due Date</th>
                      <th className="px-3 py-2 text-right">Principal</th>
                      <th className="px-3 py-2 text-right">Interest</th>
                      <th className="px-3 py-2 text-right">Installment</th>
                      <th className="px-3 py-2 text-right">Closing Balance</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {(selectedLoan.repayment_schedules || []).map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/20">
                        <td className="px-3 py-2 font-mono text-slate-400">#{s.installment_number}</td>
                        <td className="px-3 py-2 text-slate-300">{s.due_date}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-200">₹{parseFloat(s.principal_due).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-right font-mono text-amber-400">₹{parseFloat(s.interest_due).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-100">₹{parseFloat(s.total_due).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400">₹{parseFloat(s.closing_principal).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-center">{renderStatusBadge(s.payment_status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Repayment History Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-cyan-400" />
                Repayment Transaction History
              </h4>
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 sticky top-0 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Repayment #</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2 text-right">Total Paid</th>
                      <th className="px-3 py-2 text-right">Principal</th>
                      <th className="px-3 py-2 text-right">Interest</th>
                      <th className="px-3 py-2">Bank Reference / Txn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {(selectedLoan.repayment_records || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                          No repayments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      selectedLoan.repayment_records?.map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-mono text-cyan-400">{r.repayment_number}</td>
                          <td className="px-3 py-2 text-slate-300">{r.repayment_date}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">₹{parseFloat(r.total_amount).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-200">₹{parseFloat(r.principal_amount).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-right font-mono text-amber-400">₹{parseFloat(r.interest_amount).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 font-mono text-slate-400">{r.reference_number || r.transaction_number || 'N/A'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
