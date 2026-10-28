import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Search,
  Filter,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  Calendar,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Clock,
  AlertCircle,
  XCircle,
  FileText,
  Download,
  Plus,
  Eye,
  Check,
  X,
  RotateCcw,
  UploadCloud,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Tag,
  DollarSign,
  Send,
  Ban,
  FileCheck,
  Hash,
  AlertTriangle,
  ExternalLink,
  Layers
} from 'lucide-react';
import { billingFinanceService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { parseApiError } from '../../utils/errorHandler';

interface FinancialTransaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  accounting_date: string;
  transaction_type: 'DEBIT' | 'CREDIT' | 'TRANSFER';
  transaction_type_display: string;
  category: string;
  category_display: string;
  description: string;
  account: string;
  account_code: string;
  account_name: string;
  account_type: string;
  account_classification: string;
  destination_financial_account?: string;
  destination_account_code?: string;
  destination_account_name?: string;
  counterparty: string;
  amount: string;
  debit_amount: string;
  credit_amount: string;
  payment_method: string;
  reference_number: string;
  posting_status: string;
  lifecycle_status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'RECONCILED' | 'REJECTED' | 'CANCELLED' | 'REVERSED';
  lifecycle_status_display: string;
  reconciliation_status: string;
  reversal_transaction_number?: string;
  paired_transfer_number?: string;
  reversal_reason?: string;
  rejection_reason?: string;
  notes?: string;
  created_by_name?: string;
  submitted_by_name?: string;
  approved_by_name?: string;
  rejected_by_name?: string;
  posted_by_name?: string;
  reversed_by_name?: string;
  created_at: string;
  audit_logs?: any[];
}

interface FinancialAccountOption {
  id: string;
  account_code: string;
  name: string;
  account_type: string;
  classification: string;
  current_balance: string;
  is_active: boolean;
}

interface DashboardMetrics {
  total_transactions: number;
  total_credits: string;
  total_debits: string;
  net_flow: string;
  transactions_awaiting_approval: number;
  approved_posted_transactions: number;
  reconciled_transactions: number;
  failed_rejected_transactions: number;
  pending_refunds_reversals: number;
  transactions_awaiting_reconciliation: number;
}

const CATEGORY_OPTIONS = [
  { value: 'PATIENT_RECEIPT_ADVANCE', label: '1. Patient Receipts & Advances' },
  { value: 'OPD_IPD_COLLECTION', label: '2. OPD & IPD Collections' },
  { value: 'PHARMACY_DIAGNOSTIC_COLLECTION', label: '3. Pharmacy & Diagnostic Collections' },
  { value: 'INSURANCE_CORPORATE_COLLECTION', label: '4. Insurance & Corporate Collections' },
  { value: 'SUPPLIER_VENDOR_PAYMENT', label: '5. Supplier & Vendor Payments' },
  { value: 'PAYROLL_PAYMENT', label: '6. Payroll Payments' },
  { value: 'OPERATING_EXPENSE', label: '7. Rent, Utilities & Operating Expenses' },
  { value: 'STATUTORY_TAX_PAYMENT', label: '8. Taxes & Statutory Payments' },
  { value: 'BANK_TRANSFER_INTERACCOUNT', label: '9. Bank-to-Bank Transfers' },
  { value: 'GATEWAY_SETTLEMENT_FEE', label: '10. Payment Gateway Settlements & Fees' },
  { value: 'UPI_CARD_SETTLEMENT', label: '11. UPI & Card Settlements' },
  { value: 'PATIENT_REFUND_REVERSAL', label: '12. Patient Refunds & Transaction Reversals' },
  { value: 'FIXED_DEPOSIT_TRANSACTION', label: '13. Fixed Deposit Placements, Maturities & Interest' },
  { value: 'INVESTMENT_TRANSACTION', label: '14. Investment Purchases, Sales & Income' },
  { value: 'LOAN_DISBURSEMENT_REPAYMENT', label: '15. Loan Disbursements & Repayments' },
  { value: 'CAPITAL_EXPENDITURE', label: '16. Capital Expenditure' },
  { value: 'OTHER_INCOME_EXPENSE', label: '17. Other Income & Expenses' },
];

export const TransactionsPage: React.FC = () => {
  const { userProfile } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState<'ALL' | 'APPROVAL_QUEUE' | 'TRANSFERS' | 'REVERSALS'>('ALL');
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccountOption[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isNewTxOpen, setIsNewTxOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<FinancialTransaction | null>(null);
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // New Transaction Form State
  const [txForm, setTxForm] = useState({
    account_id: '',
    destination_account_id: '',
    transaction_type: 'DEBIT' as 'DEBIT' | 'CREDIT' | 'TRANSFER',
    category: 'PATIENT_RECEIPT_ADVANCE',
    amount: '',
    description: '',
    counterparty: '',
    payment_method: 'BANK_TRANSFER',
    reference_number: '',
    transaction_date: new Date().toISOString().split('T')[0],
    accounting_date: new Date().toISOString().split('T')[0],
    notes: '',
    is_draft: false,
    auto_post: true
  });

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (accountFilter) params.account_id = accountFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.transaction_type = typeFilter;
      if (searchTerm) params.search = searchTerm;

      const [txData, metricsData, accData] = await Promise.all([
        billingFinanceService.getFinancialTransactions(params),
        billingFinanceService.getFinancialTransactionDashboardStats(),
        billingFinanceService.getFinancialAccounts()
      ]);

      const txList = Array.isArray(txData) ? txData : (txData?.results || []);
      setTransactions(txList);
      setMetrics(metricsData);
      setAccounts(Array.isArray(accData) ? accData : (accData?.results || []));
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, accountFilter, categoryFilter, statusFilter, typeFilter]);

  // Tab Filtering
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (activeTab === 'APPROVAL_QUEUE') {
        return tx.lifecycle_status === 'PENDING_APPROVAL';
      }
      if (activeTab === 'TRANSFERS') {
        return tx.transaction_type === 'TRANSFER' || tx.category === 'BANK_TRANSFER_INTERACCOUNT';
      }
      if (activeTab === 'REVERSALS') {
        return tx.lifecycle_status === 'REVERSED' || tx.reversal_transaction_number || tx.category === 'PATIENT_REFUND_REVERSAL';
      }
      return true;
    });
  }, [transactions, activeTab]);

  // Handle Create Transaction
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      if (!txForm.account_id) {
        throw new Error('Please select a source financial account.');
      }
      if (!txForm.amount || parseFloat(txForm.amount) <= 0) {
        throw new Error('Please enter a valid monetary amount.');
      }
      if (txForm.transaction_type === 'TRANSFER' && !txForm.destination_account_id) {
        throw new Error('Please select a destination account for the inter-account transfer.');
      }
      if (txForm.transaction_type === 'TRANSFER' && txForm.account_id === txForm.destination_account_id) {
        throw new Error('Source and destination accounts must be distinct for transfers.');
      }

      await billingFinanceService.createFinancialTransaction(txForm);

      setSuccessMsg('Financial transaction created and recorded successfully.');
      setIsNewTxOpen(false);
      setTxForm({
        account_id: '',
        destination_account_id: '',
        transaction_type: 'DEBIT',
        category: 'PATIENT_RECEIPT_ADVANCE',
        amount: '',
        description: '',
        counterparty: '',
        payment_method: 'BANK_TRANSFER',
        reference_number: '',
        transaction_date: new Date().toISOString().split('T')[0],
        accounting_date: new Date().toISOString().split('T')[0],
        notes: '',
        is_draft: false,
        auto_post: true
      });
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to create financial transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // View Details & Audit Trail
  const handleOpenDetail = async (tx: FinancialTransaction) => {
    setSelectedTx(tx);
    setIsDetailOpen(true);
    try {
      const logs = await billingFinanceService.getFinancialTransactionAuditTrail(tx.id);
      setAuditLogs(logs || []);
    } catch {
      setAuditLogs([]);
    }
  };

  // Approve
  const handleApprove = async (txId: string) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await billingFinanceService.approveFinancialTransaction(txId, { auto_post: true });
      setSuccessMsg('Transaction approved and posted to the general ledger.');
      loadData();
      if (isDetailOpen && selectedTx?.id === txId) {
        const updated = await billingFinanceService.getFinancialTransactionDetail(txId);
        setSelectedTx(updated);
      }
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reject
  const handleReject = async () => {
    if (!selectedTx || !actionReason.trim()) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await billingFinanceService.rejectFinancialTransaction(selectedTx.id, { reason: actionReason });
      setSuccessMsg('Transaction rejected.');
      setIsRejectModalOpen(false);
      setActionReason('');
      loadData();
      if (isDetailOpen) {
        const updated = await billingFinanceService.getFinancialTransactionDetail(selectedTx.id);
        setSelectedTx(updated);
      }
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reverse
  const handleReverse = async () => {
    if (!selectedTx || !actionReason.trim()) return;
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await billingFinanceService.reverseFinancialTransaction(selectedTx.id, { reason: actionReason });
      setSuccessMsg(res.message || 'Transaction successfully reversed with offsetting entry.');
      setIsReversalModalOpen(false);
      setActionReason('');
      loadData();
      if (isDetailOpen) {
        const updated = await billingFinanceService.getFinancialTransactionDetail(selectedTx.id);
        setSelectedTx(updated);
      }
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (accountFilter) params.account_id = accountFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.transaction_type = typeFilter;
      if (searchTerm) params.search = searchTerm;

      const blob = await billingFinanceService.exportFinancialTransactionsCsv(params);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `financial_transactions_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      setError('Failed to download transaction export CSV.');
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'POSTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Posted</span>;
      case 'PENDING_APPROVAL':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3 h-3" /> Pending Review</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"><ShieldCheck className="w-3 h-3" /> Approved</span>;
      case 'DRAFT':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20"><FileText className="w-3 h-3" /> Draft</span>;
      case 'REVERSED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20"><RotateCcw className="w-3 h-3" /> Reversed</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3 h-3" /> Rejected</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300 border border-slate-600"><Ban className="w-3 h-3" /> Cancelled</span>;
      case 'RECONCILED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20"><FileCheck className="w-3 h-3" /> Reconciled</span>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Financial Transaction Management</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Section 14: Double-entry cashbook, approval workflows, transfers, reversals, and audit logs
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-medium"
            title="Refresh transactions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-medium"
            title="Export filtered records to CSV"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsNewTxOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-white font-semibold text-xs transition flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Transaction</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && <AlertBanner message={error} variant="error" onClose={() => setError(null)} />}
      {successMsg && <AlertBanner message={successMsg} variant="success" onClose={() => setSuccessMsg(null)} />}

      {/* Metrics Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Records</span>
            <Receipt className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-xl font-bold text-white mt-2 font-mono">
            {metrics?.total_transactions ?? '—'}
          </p>
          <span className="text-[11px] text-slate-500">All non-cancelled txns</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Posted Debits</span>
            <ArrowDownLeft className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-xl font-bold text-rose-400 mt-2 font-mono">
            ₹{metrics?.total_debits ? Number(metrics.total_debits).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0.00'}
          </p>
          <span className="text-[11px] text-slate-500">Expenses & Outflows</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Posted Credits</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400 mt-2 font-mono">
            ₹{metrics?.total_credits ? Number(metrics.total_credits).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0.00'}
          </p>
          <span className="text-[11px] text-slate-500">Collections & Inflows</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Approval Queue</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-amber-400 mt-2 font-mono">
            {metrics?.transactions_awaiting_approval ?? 0}
          </p>
          <span className="text-[11px] text-slate-500">Awaiting Manager Review</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Posted Ledger</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xl font-bold text-cyan-400 mt-2 font-mono">
            {metrics?.approved_posted_transactions ?? 0}
          </p>
          <span className="text-[11px] text-slate-500">Active GL transactions</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Pending Recon</span>
            <FileCheck className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-xl font-bold text-teal-400 mt-2 font-mono">
            {metrics?.transactions_awaiting_reconciliation ?? 0}
          </p>
          <span className="text-[11px] text-slate-500">Awaiting bank match</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto custom-scrollbar whitespace-nowrap">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`py-2 px-3.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
            activeTab === 'ALL'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>All Transactions ({transactions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('APPROVAL_QUEUE')}
          className={`py-2 px-3.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
            activeTab === 'APPROVAL_QUEUE'
              ? 'bg-amber-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Approval Queue ({metrics?.transactions_awaiting_approval ?? 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('TRANSFERS')}
          className={`py-2 px-3.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
            activeTab === 'TRANSFERS'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Inter-Account Transfers</span>
        </button>

        <button
          onClick={() => setActiveTab('REVERSALS')}
          className={`py-2 px-3.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
            activeTab === 'REVERSALS'
              ? 'bg-purple-600 text-white font-semibold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reversals & Refunds</span>
        </button>
      </div>

      {/* Filter Ribbon */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Search */}
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search txn#, UTR, counterparty, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Account Filter */}
        <div>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
          >
            <option value="">All Accounts</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.account_code} - {acc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
          >
            <option value="">All 17 Categories</option>
            {CATEGORY_OPTIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="POSTED">Posted</option>
            <option value="REVERSED">Reversed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="RECONCILED">Reconciled</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* End Date */}
        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Transaction #</th>
                <th className="py-3.5 px-4 font-semibold">Date</th>
                <th className="py-3.5 px-4 font-semibold">Account</th>
                <th className="py-3.5 px-4 font-semibold">Category & Description</th>
                <th className="py-3.5 px-4 font-semibold">Counterparty / Ref</th>
                <th className="py-3.5 px-4 font-semibold text-right">Debit (Dr)</th>
                <th className="py-3.5 px-4 font-semibold text-right">Credit (Cr)</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                    <Receipt className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-medium text-slate-400">No financial transactions found</p>
                    <p className="text-xs text-slate-500 mt-1">Try clearing your filters or create a new transaction above.</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    {/* Tx Number */}
                    <td className="py-3 px-4 font-semibold text-indigo-400 flex items-center gap-1.5">
                      <Hash className="w-3 h-3 text-slate-500" />
                      <span>{tx.transaction_number}</span>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-slate-400 font-sans text-xs">
                      {tx.transaction_date}
                    </td>

                    {/* Account */}
                    <td className="py-3 px-4 font-sans text-xs">
                      <div className="font-semibold text-white flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-500" />
                        <span>{tx.account_code}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 truncate block max-w-[140px]">{tx.account_name}</span>
                    </td>

                    {/* Category & Description */}
                    <td className="py-3 px-4 font-sans">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-indigo-300 font-medium mb-0.5">
                        {tx.category_display || tx.category}
                      </span>
                      <p className="text-xs text-slate-200 line-clamp-1 max-w-[220px]" title={tx.description}>
                        {tx.description}
                      </p>
                    </td>

                    {/* Counterparty / Ref */}
                    <td className="py-3 px-4 font-sans text-xs">
                      <span className="text-white block font-medium truncate max-w-[130px]">{tx.counterparty || '—'}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{tx.reference_number || '—'}</span>
                    </td>

                    {/* Debit */}
                    <td className="py-3 px-4 text-right font-mono text-xs">
                      {parseFloat(tx.debit_amount) > 0 ? (
                        <span className="text-rose-400 font-semibold">
                          ₹{Number(tx.debit_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Credit */}
                    <td className="py-3 px-4 text-right font-mono text-xs">
                      {parseFloat(tx.credit_amount) > 0 ? (
                        <span className="text-emerald-400 font-semibold">
                          ₹{Number(tx.credit_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center font-sans">
                      {renderStatusBadge(tx.lifecycle_status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(tx)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="View Details & Audit Trail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Approval actions for PENDING_APPROVAL */}
                        {tx.lifecycle_status === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              onClick={() => handleApprove(tx.id)}
                              disabled={isSubmitting}
                              className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition"
                              title="Approve & Post"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setSelectedTx(tx); setIsRejectModalOpen(true); }}
                              disabled={isSubmitting}
                              className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition"
                              title="Reject with reason"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {/* Reversal action for POSTED */}
                        {tx.lifecycle_status === 'POSTED' && (
                          <button
                            onClick={() => { setSelectedTx(tx); setIsReversalModalOpen(true); }}
                            className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition"
                            title="Reverse Transaction"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
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

      {/* NEW TRANSACTION MODAL */}
      <Modal
        isOpen={isNewTxOpen}
        onClose={() => setIsNewTxOpen(false)}
        title="Post New Financial Transaction"
      >
        <form onSubmit={handleCreateTransaction} className="space-y-4">
          {/* Mode Selector */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setTxForm({ ...txForm, transaction_type: 'DEBIT' })}
              className={`py-2 rounded-lg font-semibold transition ${
                txForm.transaction_type === 'DEBIT' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Debit (Outflow / Expense)
            </button>
            <button
              type="button"
              onClick={() => setTxForm({ ...txForm, transaction_type: 'CREDIT' })}
              className={`py-2 rounded-lg font-semibold transition ${
                txForm.transaction_type === 'CREDIT' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Credit (Inflow / Receipt)
            </button>
            <button
              type="button"
              onClick={() => setTxForm({ ...txForm, transaction_type: 'TRANSFER', category: 'BANK_TRANSFER_INTERACCOUNT' })}
              className={`py-2 rounded-lg font-semibold transition ${
                txForm.transaction_type === 'TRANSFER' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Inter-Account Transfer
            </button>
          </div>

          {/* Accounts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {txForm.transaction_type === 'TRANSFER' ? 'Source Account (Debited/Transfer From)' : 'Target Financial Account *'}
              </label>
              <select
                required
                value={txForm.account_id}
                onChange={(e) => setTxForm({ ...txForm, account_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select Account</option>
                {accounts.filter(a => a.is_active).map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_code} - {acc.name} (Bal: ₹{Number(acc.current_balance).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>

            {txForm.transaction_type === 'TRANSFER' ? (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Destination Account (Transfer To) *
                </label>
                <select
                  required
                  value={txForm.destination_account_id}
                  onChange={(e) => setTxForm({ ...txForm, destination_account_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select Destination Account</option>
                  {accounts.filter(a => a.is_active && a.id !== txForm.account_id).map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Transaction Category *
                </label>
                <select
                  required
                  value={txForm.category}
                  onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Amount and Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Transaction Amount (INR) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 font-mono">₹</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={txForm.amount}
                  onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Payment Method
              </label>
              <select
                value={txForm.payment_method}
                onChange={(e) => setTxForm({ ...txForm, payment_method: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="CASH">Cash Counter</option>
                <option value="UPI">UPI Payment</option>
                <option value="CARD">Debit / Credit Card</option>
                <option value="CHEQUE">Cheque / Demand Draft</option>
                <option value="GATEWAY">Payment Gateway Settlement</option>
              </select>
            </div>
          </div>

          {/* Reference and Counterparty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                External Reference / UTR / Cheque #
              </label>
              <input
                type="text"
                placeholder="UTR-2026-990011"
                value={txForm.reference_number}
                onChange={(e) => setTxForm({ ...txForm, reference_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Counterparty / Related Entity
              </label>
              <input
                type="text"
                placeholder="Vendor Name, Patient, or Insurer"
                value={txForm.counterparty}
                onChange={(e) => setTxForm({ ...txForm, counterparty: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description / Narration *
            </label>
            <input
              type="text"
              required
              placeholder="Detailed reason for this transaction..."
              value={txForm.description}
              onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action Choice: Post Directly vs Save as Draft */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <span className="text-slate-400">Save as Draft (no balance impact until approved)</span>
            <input
              type="checkbox"
              checked={txForm.is_draft}
              onChange={(e) => setTxForm({ ...txForm, is_draft: e.target.checked, auto_post: !e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsNewTxOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition flex items-center gap-2"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{txForm.is_draft ? 'Save Draft Transaction' : 'Post Transaction'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* DETAIL & AUDIT MODAL */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Transaction Details: ${selectedTx?.transaction_number || ''}`}
      >
        {selectedTx && (
          <div className="space-y-4 text-xs">
            {/* Header pill */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Status & Amount</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {renderStatusBadge(selectedTx.lifecycle_status)}
                  <span className="text-base font-bold text-white font-mono">
                    ₹{Number(selectedTx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[10px] uppercase">Account</span>
                <span className="font-semibold text-indigo-400">{selectedTx.account_code}</span>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px]">Category</span>
                <span className="text-slate-200 font-medium">{selectedTx.category_display || selectedTx.category}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Type</span>
                <span className="text-slate-200 font-medium">{selectedTx.transaction_type_display || selectedTx.transaction_type}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Counterparty</span>
                <span className="text-slate-200">{selectedTx.counterparty || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Payment Method</span>
                <span className="text-slate-200">{selectedTx.payment_method}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block text-[10px]">Description</span>
                <p className="text-slate-200 mt-0.5">{selectedTx.description}</p>
              </div>
            </div>

            {/* Reversal Linkage if available */}
            {selectedTx.reversal_transaction_number && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300">
                <div className="flex items-center gap-2 font-semibold">
                  <RotateCcw className="w-4 h-4" />
                  <span>Offsetting Reversal Recorded</span>
                </div>
                <p className="mt-1 text-[11px]">
                  Offsetting transaction: <span className="font-mono text-white">{selectedTx.reversal_transaction_number}</span>
                </p>
                {selectedTx.reversal_reason && <p className="mt-0.5 text-[11px]">Reason: {selectedTx.reversal_reason}</p>}
              </div>
            )}

            {/* Paired Transfer Linkage if available */}
            {selectedTx.paired_transfer_number && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300">
                <div className="flex items-center gap-2 font-semibold">
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Paired Dual-Leg Transfer</span>
                </div>
                <p className="mt-1 text-[11px]">
                  Linked paired transaction: <span className="font-mono text-white">{selectedTx.paired_transfer_number}</span>
                </p>
              </div>
            )}

            {/* Audit Trail */}
            <div>
              <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Lifecycle Audit Trail</span>
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {auditLogs.length === 0 ? (
                  <p className="text-slate-500 text-[11px]">No audit entries recorded yet.</p>
                ) : (
                  auditLogs.map((log: any) => (
                    <div key={log.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-indigo-400">{log.action}</span>
                        <span className="text-slate-500 font-mono text-[10px]">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-300 mt-0.5">{log.comments || 'Status transition'}</p>
                      <span className="text-[10px] text-slate-500 block mt-0.5">By: {log.performed_by_name || 'System'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* REVERSAL MODAL */}
      <Modal
        isOpen={isReversalModalOpen}
        onClose={() => setIsReversalModalOpen(false)}
        title="Confirm Transaction Reversal"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-300">
            Reversing transaction <span className="font-mono font-bold text-white">{selectedTx?.transaction_number}</span> will mark the original as REVERSED and generate an offsetting double-entry ledger record.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Mandatory Reversal Reason *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Billed in error, bank dispute resolved, cheque dishonoured..."
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsReversalModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || !actionReason.trim()}
              onClick={handleReverse}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition"
            >
              Confirm Reversal
            </button>
          </div>
        </div>
      </Modal>

      {/* REJECT MODAL */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Transaction"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-300">
            Please enter the reason for rejecting transaction <span className="font-mono font-bold text-white">{selectedTx?.transaction_number}</span>.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Rejection Reason *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Supporting GST invoice missing, incorrect department code..."
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || !actionReason.trim()}
              onClick={handleReject}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold transition"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
