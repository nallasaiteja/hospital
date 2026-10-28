import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  ChevronDown,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Filter,
  Download,
  Lock,
  Unlock,
  Eye,
  Undo2,
  X,
  AlertCircle,
  Building2,
  Landmark,
  ShieldCheck,
  Clock,
  Printer,
  ChevronRight,
  TrendingUp,
  Receipt,
  UserCheck
} from 'lucide-react';
import { billingFinanceService } from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

// Types
interface ChartAccount {
  id: string;
  account_code: string;
  name: string;
  category_name: string;
  category_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  account_type: string;
  sub_type_display?: string;
  normal_balance: 'DEBIT' | 'CREDIT';
  current_balance: string;
  opening_balance: string;
  is_active: boolean;
  is_reconcilable: boolean;
  description: string;
  branch_name?: string;
}

interface JournalLine {
  id?: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  debit_amount: string;
  credit_amount: string;
  description?: string;
  entry_type?: 'DEBIT' | 'CREDIT';
  amount?: string;
}

interface JournalVoucher {
  id: string;
  entry_number: string;
  voucher_number?: string;
  voucher_type: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'REJECTED' | 'CANCELLED' | 'REVERSED';
  entry_date: string;
  narration: string;
  reference_number?: string;
  source_module?: string;
  total_debit: string;
  total_credit: string;
  is_posted: boolean;
  created_by_name?: string;
  approved_by_name?: string;
  posted_by_name?: string;
  reversed_by_name?: string;
  reversal_reason?: string;
  rejection_reason?: string;
  lines: JournalLine[];
  audit_logs?: any[];
  documents?: any[];
}

interface AccountingPeriod {
  id: string;
  period_number: number;
  period_name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  closed_at?: string;
  closed_by_name?: string;
  reopened_at?: string;
  reopened_by_name?: string;
  reopen_reason?: string;
  fiscal_year_code?: string;
}

type TabType =
  | 'JOURNALS'
  | 'COA'
  | 'CREATE_VOUCHER'
  | 'APPROVAL_QUEUE'
  | 'LEDGER_STATEMENT'
  | 'CASH_BANK'
  | 'AR_AP'
  | 'FINANCIAL_REPORTS'
  | 'PERIODS';

type ReportSubTab = 'TRIAL_BALANCE' | 'BALANCE_SHEET' | 'PROFIT_LOSS' | 'CASH_FLOW';

export const GeneralLedgerPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('JOURNALS');
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('TRIAL_BALANCE');

  // Master States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data States
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [journals, setJournals] = useState<JournalVoucher[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [trialBalance, setTrialBalance] = useState<any | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<any | null>(null);
  const [profitLoss, setProfitLoss] = useState<any | null>(null);
  const [cashFlow, setCashFlow] = useState<any | null>(null);
  const [cashBankBooks, setCashBankBooks] = useState<any | null>(null);
  const [arApSummary, setArApSummary] = useState<any | null>(null);

  // Filters
  const [journalStatusFilter, setJournalStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [coaFilterCategory, setCoaFilterCategory] = useState('ALL');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');

  // Selected Account for Ledger Statement
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string>('');
  const [ledgerStatement, setLedgerStatement] = useState<any | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Selected Voucher for Detail Modal
  const [selectedVoucher, setSelectedVoucher] = useState<JournalVoucher | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Reversal Modal
  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [actionVoucherId, setActionVoucherId] = useState<string | null>(null);

  // Rejection Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Period Closing/Reopening Modal
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<AccountingPeriod | null>(null);
  const [periodActionReason, setPeriodActionReason] = useState('');

  // Create Account Modal
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    account_code: '',
    name: '',
    category_type: 'ASSET',
    account_type: 'OTHER',
    opening_balance: '0.00',
    description: '',
    is_reconcilable: false
  });

  // Create Voucher Form
  const [voucherForm, setVoucherForm] = useState({
    voucher_type: 'STANDARD',
    entry_date: new Date().toISOString().split('T')[0],
    narration: '',
    reference_number: '',
    lines: [
      { account_id: '', debit_amount: '', credit_amount: '', description: '' },
      { account_id: '', debit_amount: '', credit_amount: '', description: '' }
    ]
  });
  const [submittingVoucher, setSubmittingVoucher] = useState(false);

  // Load Initial Master Data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [accData, jData, pData] = await Promise.all([
        billingFinanceService.getChartOfAccounts({ branch_id: currentBranch?.id }),
        billingFinanceService.getJournalEntries({ branch_id: currentBranch?.id }),
        billingFinanceService.getAccountingPeriods()
      ]);

      setAccounts(accData || []);
      setJournals(jData || []);
      setPeriods(pData || []);

      if (accData && accData.length > 0 && !selectedLedgerAccountId) {
        setSelectedLedgerAccountId(accData[0].id);
      }
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranch]);

  // Load Financial Reports on Demand
  const loadReports = async () => {
    try {
      setLoading(true);
      const params = {
        branch_id: currentBranch?.id,
        as_of_date: dateFilterEnd || undefined,
        start_date: dateFilterStart || undefined,
        end_date: dateFilterEnd || undefined
      };

      if (reportSubTab === 'TRIAL_BALANCE') {
        const tb = await billingFinanceService.getTrialBalance(params);
        setTrialBalance(tb);
      } else if (reportSubTab === 'BALANCE_SHEET') {
        const bs = await billingFinanceService.getBalanceSheet(params);
        setBalanceSheet(bs);
      } else if (reportSubTab === 'PROFIT_LOSS') {
        const pnl = await billingFinanceService.getProfitAndLoss(params);
        setProfitLoss(pnl);
      } else if (reportSubTab === 'CASH_FLOW') {
        const cf = await billingFinanceService.getCashFlow(params);
        setCashFlow(cf);
      }
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'FINANCIAL_REPORTS') {
      loadReports();
    } else if (activeTab === 'CASH_BANK') {
      billingFinanceService.getCashBankBooks({
        branch_id: currentBranch?.id,
        start_date: dateFilterStart || undefined,
        end_date: dateFilterEnd || undefined
      }).then(setCashBankBooks).catch(e => setError(parseApiError(e).message));
    } else if (activeTab === 'AR_AP') {
      billingFinanceService.getReceivablesPayablesLedger({
        branch_id: currentBranch?.id,
        as_of_date: dateFilterEnd || undefined
      }).then(setArApSummary).catch(e => setError(parseApiError(e).message));
    }
  }, [activeTab, reportSubTab, dateFilterStart, dateFilterEnd, currentBranch]);

  // Load specific ledger statement
  const loadLedgerStatement = async (accId: string) => {
    if (!accId) return;
    try {
      setLoadingLedger(true);
      const res = await billingFinanceService.getGeneralLedger({
        account_id: accId,
        start_date: dateFilterStart || undefined,
        end_date: dateFilterEnd || undefined,
        branch_id: currentBranch?.id
      });
      setLedgerStatement(res);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'LEDGER_STATEMENT' && selectedLedgerAccountId) {
      loadLedgerStatement(selectedLedgerAccountId);
    }
  }, [selectedLedgerAccountId, activeTab, dateFilterStart, dateFilterEnd, currentBranch]);

  // Live Running Totals for Voucher Creation
  const voucherTotals = useMemo(() => {
    let debits = 0;
    let credits = 0;
    voucherForm.lines.forEach(l => {
      debits += parseFloat(l.debit_amount) || 0;
      credits += parseFloat(l.credit_amount) || 0;
    });
    const variance = Math.abs(debits - credits);
    const isBalanced = debits > 0 && credits > 0 && variance < 0.001;
    return { debits, credits, variance, isBalanced };
  }, [voucherForm.lines]);

  // Form Handlers
  const handleAddVoucherLine = () => {
    setVoucherForm({
      ...voucherForm,
      lines: [...voucherForm.lines, { account_id: '', debit_amount: '', credit_amount: '', description: '' }]
    });
  };

  const handleRemoveVoucherLine = (index: number) => {
    if (voucherForm.lines.length <= 2) return;
    const updated = voucherForm.lines.filter((_, idx) => idx !== index);
    setVoucherForm({ ...voucherForm, lines: updated });
  };

  const handleVoucherLineChange = (index: number, field: string, value: string) => {
    const updated = [...voucherForm.lines];
    if (field === 'debit_amount' && value && parseFloat(value) > 0) {
      updated[index] = { ...updated[index], debit_amount: value, credit_amount: '' };
    } else if (field === 'credit_amount' && value && parseFloat(value) > 0) {
      updated[index] = { ...updated[index], credit_amount: value, debit_amount: '' };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setVoucherForm({ ...voucherForm, lines: updated });
  };

  const handleSubmitVoucher = async (desiredStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED') => {
    try {
      setSubmittingVoucher(true);
      setError(null);
      setSuccessMsg(null);

      if (!voucherTotals.isBalanced && desiredStatus !== 'DRAFT') {
        setError(`Journal voucher is out of balance by ₹${voucherTotals.variance.toFixed(2)}. Debits must equal Credits.`);
        setSubmittingVoucher(false);
        return;
      }

      const payload = {
        voucher_type: voucherForm.voucher_type,
        entry_date: voucherForm.entry_date,
        narration: voucherForm.narration || 'General Ledger Voucher',
        reference_number: voucherForm.reference_number,
        branch_id: currentBranch?.id,
        status: desiredStatus,
        lines: voucherForm.lines.map(l => ({
          account_id: l.account_id,
          debit_amount: l.debit_amount || '0.00',
          credit_amount: l.credit_amount || '0.00',
          description: l.description || voucherForm.narration
        }))
      };

      await billingFinanceService.createJournalEntry(payload);
      setSuccessMsg(`Voucher successfully saved with status: ${desiredStatus}`);
      // Reset form
      setVoucherForm({
        voucher_type: 'STANDARD',
        entry_date: new Date().toISOString().split('T')[0],
        narration: '',
        reference_number: '',
        lines: [
          { account_id: '', debit_amount: '', credit_amount: '', description: '' },
          { account_id: '', debit_amount: '', credit_amount: '', description: '' }
        ]
      });
      loadData();
      setActiveTab('JOURNALS');
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setSubmittingVoucher(false);
    }
  };

  // Workflow Actions
  const handleApproveVoucher = async (id: string, autoPost: boolean = true) => {
    try {
      setLoading(true);
      await billingFinanceService.approveJournalEntry(id, { auto_post: autoPost, comments: 'Authorized approval' });
      setSuccessMsg('Voucher approved and posted to General Ledger.');
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectVoucher = async () => {
    if (!actionVoucherId || !rejectReason.trim()) return;
    try {
      setLoading(true);
      await billingFinanceService.rejectJournalEntry(actionVoucherId, { reason: rejectReason });
      setSuccessMsg('Voucher rejected.');
      setIsRejectModalOpen(false);
      setRejectReason('');
      setActionVoucherId(null);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReverseVoucher = async () => {
    if (!actionVoucherId || !reversalReason.trim()) return;
    try {
      setLoading(true);
      await billingFinanceService.reverseJournalVoucher(actionVoucherId, { reason: reversalReason });
      setSuccessMsg('Voucher reversed successfully via offsetting entry.');
      setIsReversalModalOpen(false);
      setReversalReason('');
      setActionVoucherId(null);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccountStatus = async (acc: ChartAccount) => {
    try {
      setLoading(true);
      await billingFinanceService.toggleChartOfAccountStatus(acc.id);
      setSuccessMsg(`Account ${acc.account_code} status updated.`);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    try {
      setLoading(true);
      setError(null);
      await billingFinanceService.createChartOfAccount({
        account_code: newAccountForm.account_code,
        name: newAccountForm.name,
        category_type: newAccountForm.category_type,
        account_type: newAccountForm.account_type,
        opening_balance: newAccountForm.opening_balance,
        description: newAccountForm.description,
        is_reconcilable: newAccountForm.is_reconcilable,
        branch: currentBranch?.id
      });
      setSuccessMsg(`Account ${newAccountForm.account_code} created.`);
      setIsCreateAccountModalOpen(false);
      setNewAccountForm({
        account_code: '',
        name: '',
        category_type: 'ASSET',
        account_type: 'OTHER',
        opening_balance: '0.00',
        description: '',
        is_reconcilable: false
      });
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodAction = async () => {
    if (!selectedPeriod) return;
    try {
      setLoading(true);
      if (selectedPeriod.is_closed) {
        if (!periodActionReason.trim()) {
          setError('A reason is required to reopen an accounting period.');
          setLoading(false);
          return;
        }
        await billingFinanceService.reopenAccountingPeriod(selectedPeriod.id, { reason: periodActionReason });
        setSuccessMsg(`Period '${selectedPeriod.period_name}' reopened.`);
      } else {
        await billingFinanceService.closeAccountingPeriod(selectedPeriod.id, { comments: periodActionReason });
        setSuccessMsg(`Period '${selectedPeriod.period_name}' closed.`);
      }
      setIsPeriodModalOpen(false);
      setSelectedPeriod(null);
      setPeriodActionReason('');
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  // Filtered Journals
  const filteredJournals = useMemo(() => {
    return journals.filter(j => {
      if (journalStatusFilter !== 'ALL' && j.status !== journalStatusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesVoucher = (j.voucher_number || j.entry_number || '').toLowerCase().includes(q);
        const matchesNarration = (j.narration || '').toLowerCase().includes(q);
        const matchesRef = (j.reference_number || '').toLowerCase().includes(q);
        if (!matchesVoucher && !matchesNarration && !matchesRef) return false;
      }
      return true;
    });
  }, [journals, journalStatusFilter, searchQuery]);

  // Approval Queue (Pending only)
  const approvalQueue = useMemo(() => {
    return journals.filter(j => j.status === 'PENDING_APPROVAL');
  }, [journals]);

  // Filtered COA
  const filteredCOA = useMemo(() => {
    return accounts.filter(a => {
      if (coaFilterCategory !== 'ALL' && a.category_type !== coaFilterCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesCode = a.account_code.toLowerCase().includes(q);
        const matchesName = a.name.toLowerCase().includes(q);
        if (!matchesCode && !matchesName) return false;
      }
      return true;
    });
  }, [accounts, coaFilterCategory, searchQuery]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-cyan-500/20">
            <Scale className="w-7 h-7 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white tracking-tight">General Ledger & Double-Entry Accounting</h1>
              <Badge variant="cyan">Section 17</Badge>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Multi-Branch Hospital Double-Entry Ledger, Journal Vouchers, GAAP Reconciled Financial Statements & Period Controls
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setVoucherForm({
                voucher_type: 'STANDARD',
                entry_date: new Date().toISOString().split('T')[0],
                narration: '',
                reference_number: '',
                lines: [
                  { account_id: '', debit_amount: '', credit_amount: '', description: '' },
                  { account_id: '', debit_amount: '', credit_amount: '', description: '' }
                ]
              });
              setActiveTab('CREATE_VOUCHER');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all text-sm"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            New Journal Voucher
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />
      )}
      {successMsg && (
        <AlertBanner
          type="success"
          message={successMsg}
          onClose={() => setSuccessMsg(null)}
        />
      )}

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'JOURNALS', label: 'Journal Vouchers', icon: BookOpen, count: journals.length },
          { id: 'COA', label: 'Chart of Accounts', icon: Layers, count: accounts.length },
          { id: 'APPROVAL_QUEUE', label: 'Approval Queue', icon: ShieldCheck, count: approvalQueue.length, alert: approvalQueue.length > 0 },
          { id: 'CREATE_VOUCHER', label: 'Create Voucher', icon: Plus },
          { id: 'LEDGER_STATEMENT', label: 'Account Register', icon: FileText },
          { id: 'CASH_BANK', label: 'Cash & Bank Books', icon: Landmark },
          { id: 'AR_AP', label: 'AR & AP Ledger', icon: Receipt },
          { id: 'FINANCIAL_REPORTS', label: 'Financial Reports', icon: Scale },
          { id: 'PERIODS', label: 'Periods & Closing', icon: Calendar },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                isActive
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    tab.alert
                      ? 'bg-amber-400 text-slate-950 font-black animate-pulse'
                      : isActive
                      ? 'bg-slate-950 text-cyan-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: JOURNAL VOUCHER REGISTER */}
      {activeTab === 'JOURNALS' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search voucher #, narration, reference..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={journalStatusFilter}
                onChange={e => setJournalStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="POSTED">Posted</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="DRAFT">Draft</option>
                <option value="REVERSED">Reversed</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="text-xs text-slate-400 font-medium">
              Showing <span className="text-cyan-400 font-bold">{filteredJournals.length}</span> vouchers
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-bold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-4">Voucher No</th>
                    <th className="px-4 py-4">Date</th>
                    <th className="px-4 py-4">Type</th>
                    <th className="px-5 py-4">Narration</th>
                    <th className="px-4 py-4 text-right">Debit (₹)</th>
                    <th className="px-4 py-4 text-right">Credit (₹)</th>
                    <th className="px-4 py-4 text-center">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredJournals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                        <BookOpen className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
                        No journal vouchers found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredJournals.map(j => {
                      const isBalanced = parseFloat(j.total_debit) === parseFloat(j.total_credit);
                      return (
                        <tr key={j.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-5 py-3.5 font-bold text-white flex items-center gap-2">
                            <span>{j.voucher_number || j.entry_number}</span>
                            {j.source_module && j.source_module !== 'MANUAL' && (
                              <span className="text-[10px] bg-slate-800 text-cyan-400 px-1.5 py-0.5 rounded font-mono">
                                {j.source_module}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-xs">{j.entry_date}</td>
                          <td className="px-4 py-3.5">
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                              {j.voucher_type}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 max-w-xs truncate text-slate-200">
                            {j.narration}
                            {j.reference_number && (
                              <div className="text-[11px] text-slate-500">Ref: {j.reference_number}</div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-emerald-400 font-bold">
                            ₹{parseFloat(j.total_debit || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-cyan-400 font-bold">
                            ₹{parseFloat(j.total_credit || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge
                              variant={
                                j.status === 'POSTED'
                                  ? 'success'
                                  : j.status === 'APPROVED'
                                  ? 'cyan'
                                  : j.status === 'PENDING_APPROVAL'
                                  ? 'warning'
                                  : j.status === 'REVERSED'
                                  ? 'accent'
                                  : j.status === 'REJECTED'
                                  ? 'danger'
                                  : 'neutral'
                              }
                            >
                              {j.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right space-x-2">
                            <button
                              onClick={() => {
                                setSelectedVoucher(j);
                                setIsDetailModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold rounded-lg border border-slate-700 transition"
                            >
                              View
                            </button>
                            {j.status === 'POSTED' && (
                              <button
                                onClick={() => {
                                  setActionVoucherId(j.id);
                                  setIsReversalModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 font-semibold rounded-lg border border-purple-800 transition"
                              >
                                Reverse
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHART OF ACCOUNTS */}
      {activeTab === 'COA' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search code or account name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={coaFilterCategory}
                onChange={e => setCoaFilterCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Classifications</option>
                <option value="ASSET">Assets</option>
                <option value="LIABILITY">Liabilities</option>
                <option value="EQUITY">Equity</option>
                <option value="REVENUE">Operating Revenue</option>
                <option value="EXPENSE">Operating Expenses</option>
              </select>
            </div>

            <button
              onClick={() => setIsCreateAccountModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              Add Ledger Account
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-bold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-4">Account Code</th>
                  <th className="px-5 py-4">Account Name</th>
                  <th className="px-4 py-4">Classification</th>
                  <th className="px-4 py-4">Subcategory</th>
                  <th className="px-4 py-4 text-center">Normal Bal</th>
                  <th className="px-5 py-4 text-right">Current Balance (₹)</th>
                  <th className="px-4 py-4 text-center">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredCOA.map(acc => {
                  const isPositive = parseFloat(acc.current_balance) >= 0;
                  return (
                    <tr key={acc.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-3.5 font-bold font-mono text-cyan-400">{acc.account_code}</td>
                      <td className="px-5 py-3.5 text-white font-semibold">
                        {acc.name}
                        {acc.description && (
                          <div className="text-[11px] text-slate-500 font-normal">{acc.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant={
                            acc.category_type === 'ASSET'
                              ? 'cyan'
                              : acc.category_type === 'LIABILITY'
                              ? 'warning'
                              : acc.category_type === 'EQUITY'
                              ? 'accent'
                              : acc.category_type === 'REVENUE'
                              ? 'success'
                              : 'danger'
                          }
                        >
                          {acc.category_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400 font-mono">
                        {acc.sub_type_display || acc.account_type}
                      </td>
                      <td className="px-4 py-3.5 text-center text-xs font-bold text-slate-400">
                        {acc.normal_balance}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-base text-white">
                        ₹{parseFloat(acc.current_balance || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                            acc.is_active ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                          }`}
                        >
                          {acc.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSelectedLedgerAccountId(acc.id);
                            setActiveTab('LEDGER_STATEMENT');
                          }}
                          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold rounded-lg border border-slate-700 transition"
                        >
                          Ledger
                        </button>
                        <button
                          onClick={() => handleToggleAccountStatus(acc)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                            acc.is_active
                              ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800'
                              : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800'
                          }`}
                        >
                          {acc.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CREATE JOURNAL VOUCHER */}
      {activeTab === 'CREATE_VOUCHER' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-white">Create Double-Entry Journal Voucher</h2>
              <p className="text-xs text-slate-400">Strict server-side validation: Total Debits must equal Total Credits before posting.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                voucherTotals.isBalanced
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse'
              }`}>
                {voucherTotals.isBalanced ? 'Balanced (₹0.00)' : `Out of Balance (Variance: ₹${voucherTotals.variance.toFixed(2)})`}
              </span>
            </div>
          </div>

          {/* Voucher Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Voucher Type</label>
              <select
                value={voucherForm.voucher_type}
                onChange={e => setVoucherForm({ ...voucherForm, voucher_type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="STANDARD">Standard Journal Voucher</option>
                <option value="PAYMENT">Payment Voucher</option>
                <option value="RECEIPT">Receipt Voucher</option>
                <option value="CONTRA">Contra Voucher (Inter-Account)</option>
                <option value="ADJUSTMENT">Adjustment Voucher</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Voucher Date</label>
              <input
                type="date"
                value={voucherForm.entry_date}
                onChange={e => setVoucherForm({ ...voucherForm, entry_date: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Reference Number</label>
              <input
                type="text"
                placeholder="Bill / Invoice / Receipt #"
                value={voucherForm.reference_number}
                onChange={e => setVoucherForm({ ...voucherForm, reference_number: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Branch Campus</label>
              <input
                type="text"
                disabled
                value={currentBranch?.name || 'Central Hospital Campus'}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Narration & Description</label>
            <input
              type="text"
              placeholder="Detailed explanation of the double-entry accounting transaction..."
              value={voucherForm.narration}
              onChange={e => setVoucherForm({ ...voucherForm, narration: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Line Items Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Debit & Credit Journal Lines</h3>
              <button
                type="button"
                onClick={handleAddVoucherLine}
                className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold rounded-lg border border-slate-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Line
              </button>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3">
              {voucherForm.lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-5">
                    <select
                      value={line.account_id}
                      onChange={e => handleVoucherLineChange(idx, 'account_id', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">Select General Ledger Account...</option>
                      {accounts.filter(a => a.is_active).map(a => (
                        <option key={a.id} value={a.id}>
                          {a.account_code} - {a.name} ({a.category_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <input
                      type="text"
                      placeholder="Line narration..."
                      value={line.description}
                      onChange={e => handleVoucherLineChange(idx, 'description', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Debit ₹"
                      value={line.debit_amount}
                      onChange={e => handleVoucherLineChange(idx, 'debit_amount', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500 text-right"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Credit ₹"
                      value={line.credit_amount}
                      onChange={e => handleVoucherLineChange(idx, 'credit_amount', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-cyan-400 font-mono font-bold focus:outline-none focus:border-cyan-500 text-right"
                    />
                    {voucherForm.lines.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVoucherLine(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Running Totals Bar */}
              <div className="border-t border-slate-800 pt-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center font-bold text-sm">
                <div className="md:col-span-8 text-right text-slate-400 uppercase tracking-wider text-xs">
                  Running Totals:
                </div>
                <div className="md:col-span-2 text-right font-mono text-emerald-400 text-base">
                  ₹{voucherTotals.debits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="md:col-span-2 text-right font-mono text-cyan-400 text-base">
                  ₹{voucherTotals.credits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between pt-4 border-t border-slate-800 gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('JOURNALS')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={submittingVoucher}
                onClick={() => handleSubmitVoucher('DRAFT')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm transition"
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={submittingVoucher || !voucherTotals.isBalanced}
                onClick={() => handleSubmitVoucher('PENDING_APPROVAL')}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded-xl border border-amber-600/50 text-sm transition disabled:opacity-50"
              >
                Submit for Approval
              </button>
              <button
                type="button"
                disabled={submittingVoucher || !voucherTotals.isBalanced}
                onClick={() => handleSubmitVoucher('POSTED')}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
              >
                Direct Post to Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: APPROVAL QUEUE */}
      {activeTab === 'APPROVAL_QUEUE' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-black text-white">Journal Voucher Approval Queue</h2>
                <p className="text-xs text-slate-400">Independent supervisory review. Separation of duties applies: Creators cannot self-approve.</p>
              </div>
              <Badge variant="warning">{approvalQueue.length} Pending</Badge>
            </div>

            {approvalQueue.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2 opacity-60" />
                No vouchers pending approval. The approval queue is fully cleared!
              </div>
            ) : (
              <div className="space-y-4">
                {approvalQueue.map(v => (
                  <div key={v.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-5 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-base">{v.voucher_number || v.entry_number}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">{v.voucher_type}</span>
                          <span className="text-xs text-slate-400 font-mono">Date: {v.entry_date}</span>
                        </div>
                        <div className="text-xs text-slate-300 mt-1">{v.narration}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Created by: <span className="text-cyan-400">{v.created_by_name || 'Staff'}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-slate-400">Balanced Amount</div>
                        <div className="text-xl font-bold font-mono text-emerald-400">
                          ₹{parseFloat(v.total_debit || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* Lines summary */}
                    <div className="bg-slate-900/60 rounded-lg p-3 text-xs divide-y divide-slate-800/50">
                      {v.lines.map((l, lidx) => (
                        <div key={lidx} className="flex justify-between py-1 font-mono">
                          <span className="text-slate-300 font-sans">
                            {l.account_code} - {l.account_name} ({l.description})
                          </span>
                          <span className="space-x-3">
                            {parseFloat(l.debit_amount) > 0 && (
                              <span className="text-emerald-400">Dr: ₹{l.debit_amount}</span>
                            )}
                            {parseFloat(l.credit_amount) > 0 && (
                              <span className="text-cyan-400">Cr: ₹{l.credit_amount}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => {
                          setActionVoucherId(v.id);
                          setIsRejectModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold rounded-lg border border-rose-800 text-xs transition"
                      >
                        Reject Voucher
                      </button>
                      <button
                        onClick={() => handleApproveVoucher(v.id, true)}
                        className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs shadow-lg shadow-emerald-500/20 transition"
                      >
                        Approve & Post to Ledger
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: GENERAL LEDGER ACCOUNT REGISTER */}
      {activeTab === 'LEDGER_STATEMENT' && (
        <div className="space-y-4">
          {/* Account Selector & Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <label className="text-xs font-bold text-slate-400 uppercase">Select Account:</label>
              <select
                value={selectedLedgerAccountId}
                onChange={e => setSelectedLedgerAccountId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 min-w-[280px]"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.account_code} - {a.name} ({a.category_type})
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={dateFilterStart}
                  onChange={e => setDateFilterStart(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={dateFilterEnd}
                  onChange={e => setDateFilterEnd(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200"
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (!ledgerStatement) return;
                const rows = [
                  ['Date', 'Voucher Number', 'Narration', 'Reference', 'Debit', 'Credit', 'Running Balance'],
                  ...ledgerStatement.entries.map((e: any) => [
                    e.entry_date,
                    e.voucher_number,
                    e.narration,
                    e.reference_number || '',
                    e.debit,
                    e.credit,
                    e.running_balance
                  ])
                ];
                const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', `GL_${ledgerStatement.account.code}.csv`);
                document.body.appendChild(link);
                link.click();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>

          {/* Statement View */}
          {loadingLedger ? (
            <div className="py-20 text-center text-slate-400">Loading ledger statement...</div>
          ) : ledgerStatement ? (
            <div className="space-y-4">
              {/* Account Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400 font-bold uppercase">Opening Balance</div>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    ₹{parseFloat(ledgerStatement.opening_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400 font-bold uppercase">Period Debits (+)</div>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    ₹{parseFloat(ledgerStatement.period_debits).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400 font-bold uppercase">Period Credits (-)</div>
                  <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                    ₹{parseFloat(ledgerStatement.period_credits).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400 font-bold uppercase">Closing Balance</div>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    ₹{parseFloat(ledgerStatement.closing_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Transactions Register */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-bold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Voucher #</th>
                      <th className="px-5 py-3.5">Narration / Description</th>
                      <th className="px-4 py-3.5">Reference</th>
                      <th className="px-4 py-3.5 text-right">Debit (₹)</th>
                      <th className="px-4 py-3.5 text-right">Credit (₹)</th>
                      <th className="px-5 py-3.5 text-right">Running Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium font-mono text-xs">
                    {ledgerStatement.entries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                          No posted ledger movements recorded for this account.
                        </td>
                      </tr>
                    ) : (
                      ledgerStatement.entries.map((e: any) => (
                        <tr key={e.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-5 py-3 text-slate-400">{e.entry_date}</td>
                          <td className="px-5 py-3 text-white font-bold">{e.voucher_number}</td>
                          <td className="px-5 py-3 font-sans text-slate-200">{e.narration}</td>
                          <td className="px-4 py-3 text-slate-500">{e.reference_number || '-'}</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-bold">
                            {parseFloat(e.debit) > 0 ? `₹${parseFloat(e.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-cyan-400 font-bold">
                            {parseFloat(e.credit) > 0 ? `₹${parseFloat(e.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-5 py-3 text-right text-white font-bold text-sm">
                            ₹{parseFloat(e.running_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 6: CASH & BANK BOOKS */}
      {activeTab === 'CASH_BANK' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-black text-white">Cash Books & Bank Books Register</h2>
                <p className="text-xs text-slate-400">
                  Actual receipts, payments, and contra inter-bank transfers. Transfers between bank accounts are strictly neutral to P&L.
                </p>
              </div>
              <Badge variant="cyan">Real-Time Ledger</Badge>
            </div>

            {cashBankBooks?.books?.map((b: any, bidx: number) => (
              <div key={bidx} className="bg-slate-950 border border-slate-800/80 rounded-xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <span className="font-mono text-cyan-400 font-bold mr-2">[{b.account_code}]</span>
                    <span className="text-white font-bold text-base">{b.account_name}</span>
                  </div>
                  <div className="flex gap-4 font-mono text-xs">
                    <div>
                      <span className="text-slate-400">Receipts: </span>
                      <span className="text-emerald-400 font-bold">₹{parseFloat(b.total_receipts).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Payments: </span>
                      <span className="text-cyan-400 font-bold">₹{parseFloat(b.total_payments).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Closing Balance: </span>
                      <span className="text-white font-bold">₹{parseFloat(b.closing_balance).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="text-slate-500 uppercase text-[10px] border-b border-slate-800/60 font-sans">
                      <tr>
                        <th className="py-2">Date</th>
                        <th className="py-2">Voucher #</th>
                        <th className="py-2">Description</th>
                        <th className="py-2 text-right">Receipt (+)</th>
                        <th className="py-2 text-right">Payment (-)</th>
                        <th className="py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-slate-300">
                      {b.entries.length === 0 ? (
                        <tr><td colSpan={6} className="py-4 text-center text-slate-500 font-sans">No transactions recorded.</td></tr>
                      ) : (
                        b.entries.map((e: any, eidx: number) => (
                          <tr key={eidx} className="hover:bg-slate-900/60">
                            <td className="py-2 text-slate-400">{e.entry_date}</td>
                            <td className="py-2 text-cyan-400 font-bold">{e.voucher_number}</td>
                            <td className="py-2 font-sans text-slate-200">{e.narration}</td>
                            <td className="py-2 text-right text-emerald-400 font-bold">{parseFloat(e.debit) > 0 ? `₹${e.debit}` : '-'}</td>
                            <td className="py-2 text-right text-cyan-400 font-bold">{parseFloat(e.credit) > 0 ? `₹${e.credit}` : '-'}</td>
                            <td className="py-2 text-right text-white font-bold">₹{e.running_balance}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: ACCOUNTS RECEIVABLE & PAYABLE */}
      {activeTab === 'AR_AP' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Accounts Receivable Card */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-black text-white">Accounts Receivable (AR)</h3>
                  <p className="text-xs text-slate-400">Patient & TPA insurance balances due to hospital.</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Total Outstanding</div>
                  <div className="text-xl font-black font-mono text-emerald-400">
                    ₹{parseFloat(arApSummary?.accounts_receivable?.total_ar || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {arApSummary?.accounts_receivable?.breakdown?.map((item: any, idx: number) => (
                  <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-sm">{item.account_name}</span>
                      <span className="font-mono text-emerald-400 font-bold">₹{parseFloat(item.balance).toLocaleString('en-IN')}</span>
                    </div>
                    {/* Ageing */}
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono pt-2 border-t border-slate-800/60">
                      <div>
                        <div className="text-slate-500">0-30 Days</div>
                        <div className="text-slate-200 font-bold">₹{item.current_0_30d}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">31-60 Days</div>
                        <div className="text-amber-400 font-bold">₹{item.overdue_31_60d}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">61-90 Days</div>
                        <div className="text-rose-400 font-bold">₹{item.overdue_61_90d}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">&gt;90 Days</div>
                        <div className="text-rose-500 font-bold">₹{item.overdue_90plus_d}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Accounts Payable Card */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-black text-white">Accounts Payable (AP)</h3>
                  <p className="text-xs text-slate-400">Supplier invoices & pharma vendor balances due.</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Total Outstanding</div>
                  <div className="text-xl font-black font-mono text-cyan-400">
                    ₹{parseFloat(arApSummary?.accounts_payable?.total_ap || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {arApSummary?.accounts_payable?.breakdown?.map((item: any, idx: number) => (
                  <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-sm">{item.account_name}</span>
                      <span className="font-mono text-cyan-400 font-bold">₹{parseFloat(item.balance).toLocaleString('en-IN')}</span>
                    </div>
                    {/* Ageing */}
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono pt-2 border-t border-slate-800/60">
                      <div>
                        <div className="text-slate-500">0-30 Days</div>
                        <div className="text-slate-200 font-bold">₹{item.current_0_30d}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">31-60 Days</div>
                        <div className="text-amber-400 font-bold">₹{item.overdue_31_60d}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">61-90 Days</div>
                        <div className="text-rose-400 font-bold">₹{item.overdue_61_90d}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">&gt;90 Days</div>
                        <div className="text-rose-500 font-bold">₹{item.overdue_90plus_d}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: FINANCIAL REPORTS */}
      {activeTab === 'FINANCIAL_REPORTS' && (
        <div className="space-y-6">
          {/* Sub-Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
            {[
              { id: 'TRIAL_BALANCE', label: 'Trial Balance' },
              { id: 'BALANCE_SHEET', label: 'Balance Sheet' },
              { id: 'PROFIT_LOSS', label: 'Profit & Loss (P&L)' },
              { id: 'CASH_FLOW', label: 'Cash Flow Statement' }
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setReportSubTab(sub.id as ReportSubTab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  reportSubTab === sub.id
                    ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {/* Report 8A: Trial Balance */}
          {reportSubTab === 'TRIAL_BALANCE' && trialBalance && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-black text-white">Hospital Trial Balance</h3>
                  <p className="text-xs text-slate-400">As of: {trialBalance.as_of_date}</p>
                </div>
                <div className={`px-4 py-1.5 rounded-xl font-bold text-xs border ${
                  trialBalance.is_balanced
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse'
                }`}>
                  {trialBalance.is_balanced ? 'RECONCILED: DEBITS EQUAL CREDITS' : `OUT OF BALANCE (₹${trialBalance.variance})`}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Code</th>
                      <th className="p-3">Account Name</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Debit Balance (₹)</th>
                      <th className="p-3 text-right">Credit Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {trialBalance.accounts.map((acc: any) => (
                      <tr key={acc.id} className="hover:bg-slate-800/40">
                        <td className="p-3 text-cyan-400 font-bold">{acc.code}</td>
                        <td className="p-3 font-sans text-white font-medium">{acc.name}</td>
                        <td className="p-3 font-sans text-slate-400">{acc.category}</td>
                        <td className="p-3 text-right text-emerald-400 font-bold">
                          {parseFloat(acc.debit) > 0 ? `₹${parseFloat(acc.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="p-3 text-right text-cyan-400 font-bold">
                          {parseFloat(acc.credit) > 0 ? `₹${parseFloat(acc.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-700 bg-slate-950/80 font-bold text-sm text-white">
                    <tr>
                      <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-xs text-slate-400">
                        Total Reconciled Balances:
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-400 text-base">
                        ₹{parseFloat(trialBalance.total_debits).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono text-cyan-400 text-base">
                        ₹{parseFloat(trialBalance.total_credits).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Report 8B: Balance Sheet */}
          {reportSubTab === 'BALANCE_SHEET' && balanceSheet && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-black text-white">Hospital Balance Sheet (Statement of Financial Position)</h3>
                  <p className="text-xs text-slate-400">As of: {balanceSheet.as_of_date}</p>
                </div>
                <div className={`px-4 py-1.5 rounded-xl font-bold text-xs border ${
                  balanceSheet.is_balanced
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-rose-950 text-rose-300 border-rose-800'
                }`}>
                  {balanceSheet.is_balanced ? 'BALANCED: ASSETS = LIABILITIES + EQUITY' : 'EQUATION DISCREPANCY'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Assets Column */}
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-cyan-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                    Assets
                  </h4>

                  <div className="bg-slate-950 p-4 rounded-xl space-y-2">
                    <div className="font-bold text-xs text-slate-400 uppercase">Current Assets</div>
                    {balanceSheet.current_assets.map((a: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs font-mono">
                        <span className="font-sans text-slate-300">{a.name}</span>
                        <span className="text-white">₹{parseFloat(a.debit).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-mono font-bold text-cyan-400 border-t border-slate-800 pt-2">
                      <span>Total Current Assets:</span>
                      <span>₹{parseFloat(balanceSheet.total_current_assets).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl space-y-2">
                    <div className="font-bold text-xs text-slate-400 uppercase">Fixed & Capital Assets</div>
                    {balanceSheet.fixed_assets.map((a: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs font-mono">
                        <span className="font-sans text-slate-300">{a.name}</span>
                        <span className="text-white">₹{parseFloat(a.debit || a.credit).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-mono font-bold text-cyan-400 border-t border-slate-800 pt-2">
                      <span>Total Fixed Assets:</span>
                      <span>₹{parseFloat(balanceSheet.total_fixed_assets).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-cyan-950/40 border border-cyan-800/60 rounded-xl flex justify-between font-bold text-base text-cyan-300 font-mono">
                    <span>Total Assets:</span>
                    <span>₹{parseFloat(balanceSheet.total_assets).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Liabilities & Equity Column */}
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-amber-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                    Liabilities & Equity
                  </h4>

                  <div className="bg-slate-950 p-4 rounded-xl space-y-2">
                    <div className="font-bold text-xs text-slate-400 uppercase">Current Liabilities</div>
                    {balanceSheet.current_liabilities.map((a: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs font-mono">
                        <span className="font-sans text-slate-300">{a.name}</span>
                        <span className="text-white">₹{parseFloat(a.credit).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-mono font-bold text-amber-400 border-t border-slate-800 pt-2">
                      <span>Total Current Liabilities:</span>
                      <span>₹{parseFloat(balanceSheet.total_current_liabilities).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl space-y-2">
                    <div className="font-bold text-xs text-slate-400 uppercase">Hospital Equity & Net Assets</div>
                    {balanceSheet.equity_accounts.map((a: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs font-mono">
                        <span className="font-sans text-slate-300">{a.name}</span>
                        <span className="text-white">₹{parseFloat(a.credit).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-mono text-emerald-400">
                      <span className="font-sans">Current Period Retained Surplus:</span>
                      <span>₹{parseFloat(balanceSheet.retained_earnings_period_surplus).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono font-bold text-purple-400 border-t border-slate-800 pt-2">
                      <span>Total Equity:</span>
                      <span>₹{parseFloat(balanceSheet.total_equity).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl flex justify-between font-bold text-base text-amber-300 font-mono">
                    <span>Total Liabilities & Equity:</span>
                    <span>₹{parseFloat(balanceSheet.total_liabilities_and_equity).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Report 8C: Profit & Loss */}
          {reportSubTab === 'PROFIT_LOSS' && profitLoss && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-black text-white">Profit & Loss Statement (Income Statement)</h3>
                  <p className="text-xs text-slate-400">Real-time operating revenues, expenses, and clinical surplus margin.</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Operating Margin</div>
                  <div className="text-lg font-mono font-black text-emerald-400">{profitLoss.operating_margin_pct}%</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-3">
                  <h4 className="font-bold text-xs text-emerald-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                    Operating Revenues
                  </h4>
                  {profitLoss.revenues.map((r: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs font-mono">
                      <span className="font-sans text-slate-300">{r.name}</span>
                      <span className="text-emerald-400 font-bold">₹{parseFloat(r.amount).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-mono font-bold text-emerald-400 border-t border-slate-800 pt-2">
                    <span>Total Revenue:</span>
                    <span>₹{parseFloat(profitLoss.total_revenue).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800/80 space-y-3">
                  <h4 className="font-bold text-xs text-rose-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                    Operating Expenses
                  </h4>
                  {profitLoss.expenses.map((e: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs font-mono">
                      <span className="font-sans text-slate-300">{e.name}</span>
                      <span className="text-rose-400 font-bold">₹{parseFloat(e.amount).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-mono font-bold text-rose-400 border-t border-slate-800 pt-2">
                    <span>Total Expense:</span>
                    <span>₹{parseFloat(profitLoss.total_expense).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 rounded-xl flex justify-between items-center">
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase">Net Hospital Surplus / (Loss)</div>
                  <div className="text-2xl font-black font-mono text-white mt-1">
                    ₹{parseFloat(profitLoss.net_surplus_or_profit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <Badge variant={parseFloat(profitLoss.net_surplus_or_profit) >= 0 ? 'success' : 'danger'}>
                  {parseFloat(profitLoss.net_surplus_or_profit) >= 0 ? 'OPERATING SURPLUS' : 'DEFICIT'}
                </Badge>
              </div>
            </div>
          )}

          {/* Report 8D: Cash Flow */}
          {reportSubTab === 'CASH_FLOW' && cashFlow && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-lg font-black text-white">Cash Flow Statement (Direct Method)</h3>
                  <p className="text-xs text-slate-400">Classified by Operating, Investing, and Financing activities.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
                  <div className="font-bold text-xs text-slate-400 uppercase">1. Operating Activities</div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="font-sans text-slate-300">Cash Collections (Patients, TPA Insurance)</span>
                    <span className="text-emerald-400 font-bold">₹{parseFloat(cashFlow.operating_activities.inflows).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="font-sans text-slate-300">Operational Payments (Suppliers, Payroll, Utilities)</span>
                    <span className="text-cyan-400 font-bold">(₹{parseFloat(cashFlow.operating_activities.outflows).toLocaleString('en-IN')})</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono font-bold text-white border-t border-slate-800 pt-1">
                    <span>Net Cash from Operating Activities:</span>
                    <span>₹{parseFloat(cashFlow.operating_activities.net_operating_cash_flow).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
                  <div className="font-bold text-xs text-slate-400 uppercase">2. Investing Activities</div>
                  <div className="flex justify-between text-xs font-mono font-bold text-white">
                    <span>Net Cash from Investing Activities:</span>
                    <span>₹{parseFloat(cashFlow.investing_activities.net_investing_cash_flow).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
                  <div className="font-bold text-xs text-slate-400 uppercase">3. Financing Activities</div>
                  <div className="flex justify-between text-xs font-mono font-bold text-white">
                    <span>Net Cash from Financing Activities:</span>
                    <span>₹{parseFloat(cashFlow.financing_activities.net_financing_cash_flow).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl grid grid-cols-3 text-center font-mono text-xs">
                  <div>
                    <div className="text-slate-500 font-sans">Opening Cash</div>
                    <div className="text-sm font-bold text-white mt-1">₹{cashFlow.opening_cash_and_equivalents}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-sans">Net Cash Change</div>
                    <div className="text-sm font-bold text-emerald-400 mt-1">₹{cashFlow.net_change_in_cash}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 font-sans">Closing Cash</div>
                    <div className="text-sm font-bold text-white mt-1">₹{cashFlow.closing_cash_and_equivalents}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 9: ACCOUNTING PERIODS & CLOSING */}
      {activeTab === 'PERIODS' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-black text-white">Accounting Periods & Fiscal Year Closing Controls</h2>
                <p className="text-xs text-slate-400">
                  Hospital fiscal year follows April - March convention. Closed periods strictly block unauthorized retroactive postings.
                </p>
              </div>
              <Badge variant="cyan">FY 2026-27 Active</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {periods.map(p => (
                <div key={p.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-sm">{p.period_name}</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                        p.is_closed
                          ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                      }`}
                    >
                      {p.is_closed ? 'CLOSED' : 'OPEN'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 font-mono">
                    <div>Start: {p.start_date}</div>
                    <div>End: {p.end_date}</div>
                    {p.is_closed && (
                      <div className="text-[11px] text-slate-500 mt-1">Closed by: {p.closed_by_name || 'Finance Admin'}</div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => {
                        setSelectedPeriod(p);
                        setIsPeriodModalOpen(true);
                      }}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold transition border ${
                        p.is_closed
                          ? 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border-amber-800'
                          : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800'
                      }`}
                    >
                      {p.is_closed ? 'Reopen Period' : 'Close Period'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VOUCHER DETAIL */}
      {selectedVoucher && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Journal Voucher Details — ${selectedVoucher.voucher_number || selectedVoucher.entry_number}`}
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500">Date:</span> <span className="text-white font-mono">{selectedVoucher.entry_date}</span>
              </div>
              <div>
                <span className="text-slate-500">Status:</span> <span className="text-cyan-400 font-bold">{selectedVoucher.status}</span>
              </div>
              <div>
                <span className="text-slate-500">Type:</span> <span className="text-white">{selectedVoucher.voucher_type}</span>
              </div>
              <div>
                <span className="text-slate-500">Created By:</span> <span className="text-white">{selectedVoucher.created_by_name || 'Staff'}</span>
              </div>
            </div>

            <div>
              <div className="text-slate-400 font-bold uppercase mb-1">Narration</div>
              <p className="text-slate-200 bg-slate-950 p-2.5 rounded-xl border border-slate-800">{selectedVoucher.narration}</p>
            </div>

            <div>
              <div className="text-slate-400 font-bold uppercase mb-1">Journal Lines</div>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left font-mono">
                  <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-2">Account</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-right">Debit</th>
                      <th className="p-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-300">
                    {selectedVoucher.lines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="p-2 text-white font-sans">{l.account_code} - {l.account_name}</td>
                        <td className="p-2 text-slate-400 font-sans">{l.description}</td>
                        <td className="p-2 text-right text-emerald-400 font-bold">{parseFloat(l.debit_amount) > 0 ? `₹${l.debit_amount}` : '-'}</td>
                        <td className="p-2 text-right text-cyan-400 font-bold">{parseFloat(l.credit_amount) > 0 ? `₹${l.credit_amount}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-800 font-bold text-white bg-slate-950">
                    <tr>
                      <td colSpan={2} className="p-2 text-right">Total:</td>
                      <td className="p-2 text-right text-emerald-400">₹{selectedVoucher.total_debit}</td>
                      <td className="p-2 text-right text-cyan-400">₹{selectedVoucher.total_credit}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {selectedVoucher.audit_logs && selectedVoucher.audit_logs.length > 0 && (
              <div>
                <div className="text-slate-400 font-bold uppercase mb-1">Audit Trail</div>
                <div className="space-y-1 bg-slate-950 p-2 rounded-xl border border-slate-800 max-h-32 overflow-y-auto">
                  {selectedVoucher.audit_logs.map((log: any, idx: number) => (
                    <div key={idx} className="text-[11px] text-slate-400 flex justify-between py-0.5">
                      <span>{log.action} by {log.performed_by_name || 'Staff'}: {log.comments}</span>
                      <span className="text-slate-500 font-mono">{log.created_at?.slice(0, 10)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL: REVERSAL */}
      <Modal
        isOpen={isReversalModalOpen}
        onClose={() => setIsReversalModalOpen(false)}
        title="Authorize Journal Voucher Reversal"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            A mirror reversal entry with inverted debits and credits will be generated and posted atomically.
            The original entry remains auditable and will be flagged as REVERSED.
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Reversal Reason *</label>
            <input
              type="text"
              placeholder="e.g. Invoicing error correction, duplicated billing..."
              value={reversalReason}
              onChange={e => setReversalReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsReversalModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleReverseVoucher}
              disabled={!reversalReason.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition disabled:opacity-50"
            >
              Confirm Reversal
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: REJECTION */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Journal Voucher"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Provide an explicit audit justification for rejecting this voucher.</p>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Rejection Reason *</label>
            <input
              type="text"
              placeholder="e.g. Account misclassification, incorrect amount..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsRejectModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectVoucher}
              disabled={!rejectReason.trim()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition disabled:opacity-50"
            >
              Reject Voucher
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: PERIOD ACTION */}
      {selectedPeriod && (
        <Modal
          isOpen={isPeriodModalOpen}
          onClose={() => setIsPeriodModalOpen(false)}
          title={`${selectedPeriod.is_closed ? 'Reopen' : 'Close'} Accounting Period: ${selectedPeriod.period_name}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              {selectedPeriod.is_closed
                ? 'Reopening a period permits retroactive postings. A strict authorization reason is required for the audit trail.'
                : 'Closing this period will strictly block further journal entries with dates in this period.'}
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Justification Comments *</label>
              <input
                type="text"
                placeholder="Audit comments / authorization reason..."
                value={periodActionReason}
                onChange={e => setPeriodActionReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsPeriodModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handlePeriodAction}
                className={`px-4 py-2 font-bold text-xs rounded-xl transition ${
                  selectedPeriod.is_closed
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {selectedPeriod.is_closed ? 'Authorize Reopening' : 'Confirm Period Closing'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: CREATE ACCOUNT */}
      <Modal
        isOpen={isCreateAccountModalOpen}
        onClose={() => setIsCreateAccountModalOpen(false)}
        title="Add Hospital Chart of Account"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Account Code *</label>
              <input
                type="text"
                placeholder="e.g. 1070, 5080..."
                value={newAccountForm.account_code}
                onChange={e => setNewAccountForm({ ...newAccountForm, account_code: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Classification *</label>
              <select
                value={newAccountForm.category_type}
                onChange={e => setNewAccountForm({ ...newAccountForm, category_type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
                <option value="EQUITY">Equity</option>
                <option value="REVENUE">Operating Revenue</option>
                <option value="EXPENSE">Operating Expense</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Account Name *</label>
            <input
              type="text"
              placeholder="e.g. ICU Life Support Equipment Reserve"
              value={newAccountForm.name}
              onChange={e => setNewAccountForm({ ...newAccountForm, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Subcategory</label>
              <select
                value={newAccountForm.account_type}
                onChange={e => setNewAccountForm({ ...newAccountForm, account_type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="OTHER">Other Hospital Account</option>
                <option value="CASH_BANK">Cash & Bank</option>
                <option value="PATIENT_RECEIVABLE">Patient Receivables</option>
                <option value="INSURANCE_RECEIVABLE">Insurance Receivables</option>
                <option value="SUPPLIER_PAYABLE">Supplier Payables</option>
                <option value="INVENTORY">Inventory & Supplies</option>
                <option value="FIXED_ASSET">Fixed Asset</option>
                <option value="SALARIES_PAYROLL">Salaries & Payroll</option>
                <option value="RENT_UTILITIES">Rent & Utilities</option>
                <option value="BANK_CHARGES">Bank Charges</option>
                <option value="TAXES_STATUTORY">Taxes & Statutory</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Opening Balance (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newAccountForm.opening_balance}
                onChange={e => setNewAccountForm({ ...newAccountForm, opening_balance: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
            <input
              type="text"
              placeholder="Operational description or accounting policy..."
              value={newAccountForm.description}
              onChange={e => setNewAccountForm({ ...newAccountForm, description: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsCreateAccountModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateAccount}
              disabled={!newAccountForm.account_code.trim() || !newAccountForm.name.trim()}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition disabled:opacity-50"
            >
              Create Account
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
