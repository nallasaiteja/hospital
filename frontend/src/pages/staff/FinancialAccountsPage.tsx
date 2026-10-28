import React, { useState, useEffect } from 'react';
import {
  Building2,
  Landmark,
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Plus,
  UploadCloud,
  FileCheck,
  FileText,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Check,
  X,
  FileSpreadsheet,
  Layers,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import { billingFinanceService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

interface FinancialAccount {
  id: string;
  account_code: string;
  name: string;
  account_type: string;
  account_type_display: string;
  classification: string;
  classification_display: string;
  institution_name: string;
  account_holder: string;
  masked_account_number: string;
  account_number_raw: string;
  branch_name: string;
  ifsc_code: string;
  currency: string;
  opening_balance: string;
  calculated_closing_balance: string;
  total_debits: string;
  total_credits: string;
  transaction_count: number;
  is_active: boolean;
  reconciliation_status: string;
  reconciliation_status_display: string;
  last_reconciled_at: string | null;
  notes: string;
  branch_name_display?: string;
  created_at: string;
}

interface FinancialTransaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  accounting_date: string;
  category: string;
  description: string;
  counterparty: string;
  debit_amount: string;
  credit_amount: string;
  payment_method: string;
  reference_number: string;
  posting_status: string;
  reconciliation_status: string;
}

interface StatementEntry {
  id: string;
  entry_date: string;
  description: string;
  reference_number: string;
  debit_amount: string;
  credit_amount: string;
  balance_after: string | null;
  reconciliation_status: string;
  match_confidence: number;
  matched_transaction_number?: string;
  matched_transaction_desc?: string;
}

interface DashboardStats {
  total_active_accounts: number;
  total_bank_balances: string;
  total_cash_balances: string;
  payment_gateway_clearing: string;
  upi_card_settlement: string;
  total_fixed_deposits: string;
  investment_account_balances: string;
  outstanding_loan_liabilities: string;
  patient_advance_deposit_liabilities: string;
  insurance_receivables: string;
  supplier_payables: string;
  accounts_requiring_reconciliation: number;
  accounts_overdue_reconciliation: number;
  summary: {
    total_assets: string;
    total_liabilities: string;
    net_treasury_position: string;
  };
}

export const FinancialAccountsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ACCOUNTS' | 'TRANSACTIONS' | 'IMPORT' | 'RECONCILIATION' | 'DOCUMENTS'>('ACCOUNTS');
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & Active Selections
  const [selectedAccount, setSelectedAccount] = useState<FinancialAccount | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);

  // New Account Form
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState('BANK');
  const [newClassification, setNewClassification] = useState('ASSET');
  const [newInstName, setNewInstName] = useState('');
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newIfsc, setNewIfsc] = useState('');
  const [newOpeningBal, setNewOpeningBal] = useState('0.00');
  const [newNotes, setNewNotes] = useState('');

  // Transactions Tab
  const [txList, setTxList] = useState<FinancialTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txFromDate, setTxFromDate] = useState('');
  const [txToDate, setTxToDate] = useState('');
  const [txCategoryFilter, setTxCategoryFilter] = useState('ALL');

  // New Transaction Form
  const [txType, setTxType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txCategory, setTxCategory] = useState('MANUAL_ENTRY');
  const [txCounterparty, setTxCounterparty] = useState('');
  const [txRef, setTxRef] = useState('');
  const [txMethod, setTxMethod] = useState('BANK_TRANSFER');

  // Statement Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [importTargetAccId, setImportTargetAccId] = useState<string>('');
  const [colDate, setColDate] = useState<number>(0);
  const [colDesc, setColDesc] = useState<number>(1);
  const [colRef, setColRef] = useState<number>(2);
  const [colDebit, setColDebit] = useState<number>(3);
  const [colCredit, setColCredit] = useState<number>(4);
  const [colBalance, setColBalance] = useState<number | ''>(5);
  const [importLoading, setImportLoading] = useState(false);
  const [importBatches, setImportBatches] = useState<any[]>([]);

  // Reconciliation Desk State
  const [reconAccId, setReconAccId] = useState<string>('');
  const [stmtEntries, setStmtEntries] = useState<StatementEntry[]>([]);
  const [reconTxList, setReconTxList] = useState<FinancialTransaction[]>([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconSessions, setReconSessions] = useState<any[]>([]);
  const [activeReconSession, setActiveReconSession] = useState<any | null>(null);
  const [adjModalEntry, setAdjModalEntry] = useState<StatementEntry | null>(null);
  const [adjCategory, setAdjCategory] = useState('BANK_CHARGES');
  const [adjDesc, setAdjDesc] = useState('');

  // Documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('BANK_STATEMENT');
  const [docAccId, setDocAccId] = useState('');

  // Load Initial Master Data
  const loadMasterData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [accsRes, statsRes] = await Promise.all([
        billingFinanceService.getFinancialAccounts(),
        billingFinanceService.getFinancialAccountsDashboardStats(),
      ]);
      setAccounts(accsRes || []);
      setStats(statsRes || null);
      if (accsRes && accsRes.length > 0 && !selectedAccount) {
        setSelectedAccount(accsRes[0]);
        setImportTargetAccId(accsRes[0].id);
        setReconAccId(accsRes[0].id);
        setDocAccId(accsRes[0].id);
      }
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  // Load Transactions when Selected Account changes
  const loadTransactions = async (accId: string) => {
    try {
      setTxLoading(true);
      const params: any = {};
      if (txFromDate) params.from_date = txFromDate;
      if (txToDate) params.to_date = txToDate;
      if (txCategoryFilter !== 'ALL') params.category = txCategoryFilter;

      const res = await billingFinanceService.getFinancialAccountTransactions(accId, params);
      setTxList(res?.results || res || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccount && activeTab === 'TRANSACTIONS') {
      loadTransactions(selectedAccount.id);
    }
  }, [selectedAccount, activeTab, txFromDate, txToDate, txCategoryFilter]);

  // Handle Account Creation
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccCode.trim() || !newAccName.trim()) {
      setError('Account code and account name are required.');
      return;
    }
    if ((newAccType === 'BANK' || newAccType === 'FIXED_DEPOSIT') && !newInstName.trim()) {
      setError('Bank or financial institution name is required for bank and deposit accounts.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await billingFinanceService.createFinancialAccount({
        account_code: newAccCode.trim().toUpperCase(),
        name: newAccName.trim(),
        account_type: newAccType,
        classification: newClassification,
        institution_name: newInstName.trim(),
        account_number_raw: newAccNumber.trim(),
        branch_name: newBranchName.trim(),
        ifsc_code: newIfsc.trim().toUpperCase(),
        opening_balance: newOpeningBal || '0.00',
        notes: newNotes.trim(),
      });
      setSuccessMsg(`Financial account ${newAccCode.toUpperCase()} created successfully.`);
      setShowCreateModal(false);
      // Reset form
      setNewAccCode('');
      setNewAccName('');
      setNewInstName('');
      setNewAccNumber('');
      setNewBranchName('');
      setNewIfsc('');
      setNewOpeningBal('0.00');
      setNewNotes('');
      loadMasterData();
    } catch (err: any) {
      setError(err?.response?.data?.account_code?.[0] || err?.response?.data?.error || 'Failed to create financial account.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Account Status Toggle
  const handleToggleStatus = async (acc: FinancialAccount) => {
    try {
      setError(null);
      await billingFinanceService.toggleFinancialAccountStatus(acc.id);
      setSuccessMsg(`Account ${acc.account_code} status updated.`);
      loadMasterData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Handle Post Transaction
  const handlePostTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    if (!txDesc.trim()) {
      setError('Transaction description is required.');
      return;
    }
    const amt = parseFloat(txAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid monetary amount.');
      return;
    }

    try {
      setError(null);
      await billingFinanceService.postFinancialAccountTransaction(selectedAccount.id, {
        description: txDesc.trim(),
        debit_amount: txType === 'DEBIT' ? amt.toFixed(2) : '0.00',
        credit_amount: txType === 'CREDIT' ? amt.toFixed(2) : '0.00',
        category: txCategory,
        counterparty: txCounterparty.trim(),
        reference_number: txRef.trim(),
        payment_method: txMethod,
      });
      setSuccessMsg('Financial transaction posted successfully.');
      setShowTxModal(false);
      setTxDesc('');
      setTxAmount('');
      setTxCounterparty('');
      setTxRef('');
      loadTransactions(selectedAccount.id);
      loadMasterData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Handle Statement CSV Preview
  const handlePreviewCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    try {
      setImportLoading(true);
      setError(null);
      const fd = new FormData();
      fd.append('file', file);
      const res = await billingFinanceService.previewStatementCsv(fd);
      setPreviewData(res);
      if (res.detected_mapping) {
        if (res.detected_mapping.date_col !== undefined) setColDate(res.detected_mapping.date_col);
        if (res.detected_mapping.desc_col !== undefined) setColDesc(res.detected_mapping.desc_col);
        if (res.detected_mapping.ref_col !== undefined) setColRef(res.detected_mapping.ref_col);
        if (res.detected_mapping.debit_col !== undefined) setColDebit(res.detected_mapping.debit_col);
        if (res.detected_mapping.credit_col !== undefined) setColCredit(res.detected_mapping.credit_col);
        if (res.detected_mapping.balance_col !== undefined) setColBalance(res.detected_mapping.balance_col);
      }
    } catch (err: any) {
      setError(parseApiError(err).message);
      setImportFile(null);
    } finally {
      setImportLoading(false);
    }
  };

  // Handle Confirm Import
  const handleConfirmImport = async () => {
    if (!importFile || !importTargetAccId) {
      setError('Please select an account and an uploaded statement file.');
      return;
    }
    try {
      setImportLoading(true);
      setError(null);
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('account_id', importTargetAccId);
      fd.append('date_col', String(colDate));
      fd.append('desc_col', String(colDesc));
      fd.append('ref_col', String(colRef));
      fd.append('debit_col', String(colDebit));
      fd.append('credit_col', String(colCredit));
      if (colBalance !== '') fd.append('balance_col', String(colBalance));

      const res = await billingFinanceService.importStatementCsv(fd);
      setSuccessMsg(res.message);
      setImportFile(null);
      setPreviewData(null);
      loadMasterData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setImportLoading(false);
    }
  };

  // Load Reconciliation Workspace Data
  const loadReconData = async (accId: string) => {
    if (!accId) return;
    try {
      setReconLoading(true);
      const [entriesRes, txsRes, sessionsRes] = await Promise.all([
        billingFinanceService.getStatementEntries({ account_id: accId }),
        billingFinanceService.getFinancialAccountTransactions(accId),
        billingFinanceService.getReconciliations({ account_id: accId }),
      ]);
      setStmtEntries(entriesRes || []);
      setReconTxList(txsRes?.results || txsRes || []);
      setReconSessions(sessionsRes || []);
      if (sessionsRes && sessionsRes.length > 0) {
        setActiveReconSession(sessionsRes[0]);
      }
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setReconLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'RECONCILIATION' && reconAccId) {
      loadReconData(reconAccId);
    }
  }, [activeTab, reconAccId]);

  // Trigger Automated Match Suggestions
  const handleSuggestMatches = async () => {
    if (!activeReconSession) {
      setError('Please initiate a reconciliation session first.');
      return;
    }
    try {
      setError(null);
      const res = await billingFinanceService.suggestReconciliationMatches(activeReconSession.id);
      setSuccessMsg(res.message);
      loadReconData(reconAccId);
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Confirm Match
  const handleConfirmMatch = async (entry: StatementEntry) => {
    if (!activeReconSession) return;
    try {
      setError(null);
      await billingFinanceService.confirmReconciliationMatch(activeReconSession.id, {
        statement_entry_id: entry.id,
      });
      setSuccessMsg('Statement transaction confirmed and matched.');
      loadReconData(reconAccId);
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Unmatch
  const handleUnmatch = async (entry: StatementEntry) => {
    if (!activeReconSession) return;
    try {
      setError(null);
      await billingFinanceService.unmatchReconciliationEntry(activeReconSession.id, {
        statement_entry_id: entry.id,
      });
      setSuccessMsg('Match reverted to unmatched.');
      loadReconData(reconAccId);
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Record Adjustment
  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReconSession || !adjModalEntry) return;
    try {
      setError(null);
      await billingFinanceService.recordReconciliationAdjustment(activeReconSession.id, {
        statement_entry_id: adjModalEntry.id,
        category: adjCategory,
        description: adjDesc.trim() || `Reconciliation Adjustment for ${adjModalEntry.description}`,
      });
      setSuccessMsg('Reconciliation adjustment ledger transaction recorded.');
      setAdjModalEntry(null);
      setAdjDesc('');
      loadReconData(reconAccId);
      loadMasterData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Finalize Reconciliation
  const handleFinalizeRecon = async () => {
    if (!activeReconSession) return;
    try {
      setError(null);
      const res = await billingFinanceService.finalizeReconciliation(activeReconSession.id);
      setSuccessMsg(res.message);
      loadReconData(reconAccId);
      loadMasterData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Initiate New Reconciliation
  const handleInitiateRecon = async () => {
    if (!reconAccId) return;
    const targetAcc = accounts.find((a) => a.id === reconAccId);
    if (!targetAcc) return;

    try {
      setError(null);
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const res = await billingFinanceService.initiateReconciliation({
        account_id: reconAccId,
        period_start: startOfMonth,
        period_end: today,
        statement_closing_balance: targetAcc.calculated_closing_balance,
      });
      setSuccessMsg('New reconciliation period initiated.');
      setActiveReconSession(res);
      loadReconData(reconAccId);
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Load Documents
  const loadDocuments = async () => {
    try {
      const res = await billingFinanceService.getFinancialDocuments({ account_id: docAccId || undefined });
      setDocuments(res || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  useEffect(() => {
    if (activeTab === 'DOCUMENTS') {
      loadDocuments();
    }
  }, [activeTab, docAccId]);

  // Upload Document
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || !docAccId || !docTitle.trim()) {
      setError('Please provide document title, target account, and select a file.');
      return;
    }
    try {
      setError(null);
      const fd = new FormData();
      fd.append('account', docAccId);
      fd.append('title', docTitle.trim());
      fd.append('document_type', docType);
      fd.append('file', docFile);

      await billingFinanceService.uploadFinancialDocument(fd);
      setSuccessMsg('Document securely uploaded.');
      setDocFile(null);
      setDocTitle('');
      loadDocuments();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Filtered Accounts
  const filteredAccounts = accounts.filter((a) => {
    const matchSearch =
      a.account_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.institution_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.masked_account_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchType = typeFilter === 'ALL' || a.account_type === typeFilter;
    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && a.is_active) ||
      (statusFilter === 'INACTIVE' && !a.is_active);

    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Landmark className="w-8 h-8 text-amber-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Financial Accounts & Treasury Management
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Section 13: Central master across 12 classifications, real liquidity registers, statement CSV import & double-entry reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadMasterData}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setActiveTab('IMPORT')}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium text-slate-200 transition-colors"
          >
            <UploadCloud className="w-4 h-4 text-sky-400" />
            Import Statement
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-sm font-semibold text-slate-950 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Account
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* 13 Persisted Dashboard Cards */}
      {stats && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Accounts</span>
              <p className="text-xl font-bold text-slate-100 mt-1">{stats.total_active_accounts}</p>
              <span className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3" /> Fully Persisted
              </span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Bank Balances</span>
              <p className="text-xl font-bold text-sky-400 mt-1">₹{parseFloat(stats.total_bank_balances || '0').toLocaleString('en-IN')}</p>
              <span className="text-xs text-slate-500">Asset • Operating/Escrow</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cash & Petty Cash</span>
              <p className="text-xl font-bold text-emerald-400 mt-1">₹{parseFloat(stats.total_cash_balances || '0').toLocaleString('en-IN')}</p>
              <span className="text-xs text-slate-500">Asset • Counters & Floats</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gateway Clearing</span>
              <p className="text-xl font-bold text-indigo-400 mt-1">₹{parseFloat(stats.payment_gateway_clearing || '0').toLocaleString('en-IN')}</p>
              <span className="text-xs text-slate-500">Asset • Razorpay Node</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">UPI & Card Settl.</span>
              <p className="text-xl font-bold text-cyan-400 mt-1">₹{parseFloat(stats.upi_card_settlement || '0').toLocaleString('en-IN')}</p>
              <span className="text-xs text-slate-500">Asset • POS & Dynamic QR</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fixed Deposits (FD)</span>
              <p className="text-xl font-bold text-emerald-300 mt-1">₹{parseFloat(stats.total_fixed_deposits || '0').toLocaleString('en-IN')}</p>
              <span className="text-xs text-slate-500">Asset • Treasury Term</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Investments</span>
              <p className="text-xl font-bold text-teal-400 mt-1">₹{parseFloat(stats.investment_account_balances || '0').toLocaleString('en-IN')}</p>
              <span className="text-xs text-slate-500">Asset • Liquid Funds</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Loan Liabilities</span>
              <p className="text-xl font-bold text-rose-400 mt-1">₹{parseFloat(stats.outstanding_loan_liabilities || '0').toLocaleString('en-IN')}</p>
              <span className="text-xs text-rose-500/80">Liability • Outstanding</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Patient Deposits</span>
              <p className="text-xl font-bold text-amber-300 mt-1">₹{parseFloat(stats.patient_advance_deposit_liabilities || '0').toLocaleString('en-IN')}</p>
              <span className="text-xs text-amber-500/80">Liability • Unallocated</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Insurance Receivables</span>
              <p className="text-xl font-bold text-blue-400 mt-1">₹{parseFloat(stats.insurance_receivables || '0').toLocaleString('en-IN')}</p>
              <span className="text-xs text-slate-500">Asset • Unsettled Claims</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Supplier Payables</span>
              <p className="text-xl font-bold text-orange-400 mt-1">₹{parseFloat(stats.supplier_payables || '0').toLocaleString('en-IN')}</p>
              <span className="text-xs text-orange-500/80">Liability • Procurement</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recon Overdue</span>
              <p className="text-xl font-bold text-red-400 mt-1">{stats.accounts_overdue_reconciliation}</p>
              <span className="text-xs text-slate-500">{stats.accounts_requiring_reconciliation} Pending</span>
            </div>
          </div>

          {/* Asset vs Liability Ribbon */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-slate-400">Total Liquid & Current Assets: </span>
                <span className="font-bold text-emerald-400 text-sm">₹{parseFloat(stats.summary.total_assets || '0').toLocaleString('en-IN')}</span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div>
                <span className="text-slate-400">Total Outstanding Liabilities: </span>
                <span className="font-bold text-rose-400 text-sm">₹{parseFloat(stats.summary.total_liabilities || '0').toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div>
              <span className="text-slate-400">Net Treasury Position: </span>
              <span className="font-bold text-amber-400 text-sm">₹{parseFloat(stats.summary.net_treasury_position || '0').toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('ACCOUNTS')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'ACCOUNTS'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Landmark className="w-4 h-4" />
          Accounts Master ({accounts.length})
        </button>
        <button
          onClick={() => setActiveTab('TRANSACTIONS')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'TRANSACTIONS'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Cashbook & Transactions
        </button>
        <button
          onClick={() => setActiveTab('IMPORT')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'IMPORT'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          Statement CSV Import
        </button>
        <button
          onClick={() => setActiveTab('RECONCILIATION')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'RECONCILIATION'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          Reconciliation Desk
        </button>
        <button
          onClick={() => setActiveTab('DOCUMENTS')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'DOCUMENTS'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Supporting Documents
        </button>
      </div>

      {/* TAB 1: ACCOUNTS MASTER */}
      {activeTab === 'ACCOUNTS' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search account code, name, bank, or masked account number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Account Types</option>
                <option value="BANK">Bank Accounts</option>
                <option value="CASH">Cash Accounts</option>
                <option value="PETTY_CASH">Petty Cash</option>
                <option value="GATEWAY_CLEARING">Gateway Clearing</option>
                <option value="UPI_SETTLEMENT">UPI Settlements</option>
                <option value="CARD_SETTLEMENT">Card Settlements</option>
                <option value="FIXED_DEPOSIT">Fixed Deposits</option>
                <option value="INVESTMENT">Investments</option>
                <option value="LOAN_FACILITY">Loans / Credit</option>
                <option value="PATIENT_DEPOSIT_LIABILITY">Patient Deposit Liab.</option>
                <option value="INSURANCE_RECEIVABLE">Insurance Receivables</option>
                <option value="SUPPLIER_PAYABLE">Supplier Payables</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Deactivated Only</option>
              </select>
            </div>
          </div>

          {/* Account Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Account Details</th>
                    <th className="px-4 py-3">Type & Provider</th>
                    <th className="px-4 py-3">Reference / Branch</th>
                    <th className="px-4 py-3 text-right">Opening Bal.</th>
                    <th className="px-4 py-3 text-right">Closing Balance</th>
                    <th className="px-4 py-3 text-center">Reconciliation</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-normal">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No financial accounts found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => {
                      const isAsset = acc.classification === 'ASSET';
                      const closingVal = parseFloat(acc.calculated_closing_balance || '0');
                      return (
                        <tr key={acc.id} className="hover:bg-slate-850/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-100">{acc.name}</div>
                            <div className="text-xs text-amber-400/90 font-mono">{acc.account_code}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {acc.account_type_display}
                            </span>
                            {acc.institution_name && (
                              <div className="text-xs text-slate-400 mt-0.5">{acc.institution_name}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div className="font-mono text-slate-300">{acc.masked_account_number}</div>
                            <div className="text-slate-500">{acc.branch_name || acc.branch_name_display || 'Main'}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                            ₹{parseFloat(acc.opening_balance || '0').toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">
                            <span className={isAsset ? 'text-emerald-400' : 'text-rose-400'}>
                              ₹{closingVal.toLocaleString('en-IN')}
                            </span>
                            <div className="text-xs text-slate-500 font-normal">
                              {acc.transaction_count} txn{acc.transaction_count !== 1 ? 's' : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {acc.reconciliation_status === 'RECONCILED' ? (
                              <Badge variant="success">Reconciled</Badge>
                            ) : acc.reconciliation_status === 'DISCREPANCY' ? (
                              <Badge variant="danger">Discrepancy</Badge>
                            ) : (
                              <Badge variant="warning">Pending</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {acc.is_active ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              onClick={() => {
                                setSelectedAccount(acc);
                                setActiveTab('TRANSACTIONS');
                              }}
                              className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
                            >
                              Ledger
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAccount(acc);
                                setShowTxModal(true);
                              }}
                              className="px-2 py-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded border border-amber-500/30 transition-colors"
                            >
                              + Post
                            </button>
                            <button
                              onClick={() => handleToggleStatus(acc)}
                              className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700 transition-colors"
                              title={acc.is_active ? 'Deactivate account' : 'Activate account'}
                            >
                              {acc.is_active ? 'Deactivate' : 'Activate'}
                            </button>
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

      {/* TAB 2: CASHBOOK & TRANSACTIONS */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Financial Account</label>
                <select
                  value={selectedAccount?.id || ''}
                  onChange={(e) => {
                    const acc = accounts.find((a) => a.id === e.target.value);
                    if (acc) setSelectedAccount(acc);
                  }}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.account_code}] {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">From Date</label>
                <input
                  type="date"
                  value={txFromDate}
                  onChange={(e) => setTxFromDate(e.target.value)}
                  className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">To Date</label>
                <input
                  type="date"
                  value={txToDate}
                  onChange={(e) => setTxToDate(e.target.value)}
                  className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            {selectedAccount && (
              <button
                onClick={() => setShowTxModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Post Transaction
              </button>
            )}
          </div>

          {/* Transactions Register Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Txn Number & Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Description & Reference</th>
                    <th className="px-4 py-3">Counterparty</th>
                    <th className="px-4 py-3 text-right">Debit (Dr)</th>
                    <th className="px-4 py-3 text-right">Credit (Cr)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-normal">
                  {txLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Loading transaction register...
                      </td>
                    </tr>
                  ) : txList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No financial transactions recorded for this account.
                      </td>
                    </tr>
                  ) : (
                    txList.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-850/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs font-semibold text-slate-100">{tx.transaction_number}</div>
                          <div className="text-xs text-slate-400">{tx.transaction_date}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {tx.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="text-slate-200">{tx.description}</div>
                          {tx.reference_number && <div className="text-slate-500 font-mono">Ref: {tx.reference_number}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-300">{tx.counterparty || 'Hospital Internal'}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {parseFloat(tx.debit_amount) > 0 ? (
                            <span className="text-emerald-400 font-semibold">₹{parseFloat(tx.debit_amount).toLocaleString('en-IN')}</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {parseFloat(tx.credit_amount) > 0 ? (
                            <span className="text-rose-400 font-semibold">₹{parseFloat(tx.credit_amount).toLocaleString('en-IN')}</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {tx.reconciliation_status === 'RECONCILED' ? (
                            <Badge variant="success">Reconciled</Badge>
                          ) : (
                            <Badge variant="neutral">Unreconciled</Badge>
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

      {/* TAB 3: STATEMENT CSV IMPORT */}
      {activeTab === 'IMPORT' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-sky-400" />
              Bank Statement CSV Import Wizard
            </h2>
            <p className="text-sm text-slate-400">
              Upload bank statements directly in CSV format. The system parses line items, runs duplicate checks against existing statements, and stages entries for reconciliation matching.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Target Financial Account *</label>
                <select
                  value={importTargetAccId}
                  onChange={(e) => setImportTargetAccId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {accounts
                    .filter((a) => a.account_type === 'BANK' || a.account_type === 'GATEWAY_CLEARING')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.account_code}] {a.name} ({a.institution_name})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Upload CSV Statement File *</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handlePreviewCsv}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
                />
              </div>
            </div>

            {/* Column Mapping Configuration */}
            {previewData && (
              <div className="mt-6 border-t border-slate-800 pt-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  Map CSV Columns ({previewData.total_rows} data rows detected)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Date Column</label>
                    <select
                      value={colDate}
                      onChange={(e) => setColDate(parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200"
                    >
                      {previewData.headers.map((h: string, idx: number) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Description Column</label>
                    <select
                      value={colDesc}
                      onChange={(e) => setColDesc(parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200"
                    >
                      {previewData.headers.map((h: string, idx: number) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Reference Column</label>
                    <select
                      value={colRef}
                      onChange={(e) => setColRef(parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200"
                    >
                      {previewData.headers.map((h: string, idx: number) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Debit Column</label>
                    <select
                      value={colDebit}
                      onChange={(e) => setColDebit(parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200"
                    >
                      {previewData.headers.map((h: string, idx: number) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Credit Column</label>
                    <select
                      value={colCredit}
                      onChange={(e) => setColCredit(parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200"
                    >
                      {previewData.headers.map((h: string, idx: number) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Balance (Optional)</label>
                    <select
                      value={colBalance}
                      onChange={(e) => setColBalance(e.target.value === '' ? '' : parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200"
                    >
                      <option value="">None</option>
                      {previewData.headers.map((h: string, idx: number) => (
                        <option key={idx} value={idx}>
                          Col {idx + 1}: {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="border border-slate-800 rounded-lg overflow-x-auto mt-4">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400">
                      <tr>
                        {previewData.headers.map((h: string, i: number) => (
                          <th key={i} className="px-3 py-2 border-r border-slate-800 last:border-r-0">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {previewData.preview_rows.map((row: string[], rIdx: number) => (
                        <tr key={rIdx} className="hover:bg-slate-850">
                          {row.map((cell: string, cIdx: number) => (
                            <td key={cIdx} className="px-3 py-1.5 border-r border-slate-800 last:border-r-0 truncate max-w-xs">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={handleConfirmImport}
                    disabled={importLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-lg transition-colors shadow-md disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {importLoading ? 'Processing Import...' : 'Confirm & Import Statement'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: RECONCILIATION DESK */}
      {activeTab === 'RECONCILIATION' && (
        <div className="space-y-5">
          {/* Top Actions & Account Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Reconciliation Account</label>
                <select
                  value={reconAccId}
                  onChange={(e) => setReconAccId(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.account_code}] {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleInitiateRecon}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
              >
                + New Recon Period
              </button>
              <button
                onClick={handleSuggestMatches}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-lg text-xs font-semibold border border-sky-500/30 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Auto-Suggest Matches
              </button>
              <button
                onClick={handleFinalizeRecon}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-sm"
              >
                <FileCheck className="w-3.5 h-3.5" /> Finalize & Approve
              </button>
            </div>
          </div>

          {/* Active Session Info */}
          {activeReconSession && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <Badge variant={activeReconSession.status === 'RECONCILED' ? 'success' : 'warning'}>
                  {activeReconSession.status}
                </Badge>
                <span className="font-mono text-slate-200 font-semibold">{activeReconSession.reconciliation_number}</span>
                <span className="text-slate-400">
                  Period: {activeReconSession.period_start} to {activeReconSession.period_end}
                </span>
              </div>
              <div className="flex items-center gap-5">
                <div>
                  <span className="text-slate-400">Statement Closing: </span>
                  <span className="font-bold text-slate-200">₹{parseFloat(activeReconSession.statement_closing_balance || '0').toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-400">Ledger Closing: </span>
                  <span className="font-bold text-slate-200">₹{parseFloat(activeReconSession.ledger_closing_balance || '0').toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-400">Difference: </span>
                  <span className={`font-bold ${parseFloat(activeReconSession.unreconciled_difference || '0') === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    ₹{parseFloat(activeReconSession.unreconciled_difference || '0').toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Side-by-Side Matching Desk */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Statement Entries */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-400" />
                  Imported Statement Entries ({stmtEntries.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {stmtEntries.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No statement entries imported for this account.</p>
                ) : (
                  stmtEntries.map((e) => (
                    <div
                      key={e.id}
                      className={`p-3 rounded-lg border text-xs space-y-1.5 transition-colors ${
                        e.reconciliation_status === 'MATCHED'
                          ? 'bg-emerald-950/20 border-emerald-800/40'
                          : e.reconciliation_status === 'SUGGESTED'
                          ? 'bg-amber-950/20 border-amber-800/50'
                          : e.reconciliation_status === 'ADJUSTED'
                          ? 'bg-indigo-950/20 border-indigo-800/40'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-slate-400">{e.entry_date}</span>
                        <div>
                          {parseFloat(e.credit_amount) > 0 ? (
                            <span className="text-emerald-400 font-semibold">+₹{parseFloat(e.credit_amount).toLocaleString('en-IN')}</span>
                          ) : (
                            <span className="text-rose-400 font-semibold">-₹{parseFloat(e.debit_amount).toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-slate-200 font-medium">{e.description}</div>
                      {e.reference_number && <div className="text-slate-400 font-mono">Ref: {e.reference_number}</div>}

                      {/* Matching Action Footer */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                        <div>
                          {e.reconciliation_status === 'MATCHED' ? (
                            <span className="text-emerald-400 font-medium">✓ Matched</span>
                          ) : e.reconciliation_status === 'SUGGESTED' ? (
                            <span className="text-amber-400 font-medium">★ Suggested Match ({e.match_confidence}%)</span>
                          ) : e.reconciliation_status === 'ADJUSTED' ? (
                            <span className="text-indigo-400 font-medium">Adjusted</span>
                          ) : (
                            <span className="text-slate-500">Unmatched</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {e.reconciliation_status === 'SUGGESTED' && (
                            <button
                              onClick={() => handleConfirmMatch(e)}
                              className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-semibold hover:bg-emerald-500/30"
                            >
                              Confirm
                            </button>
                          )}
                          {e.reconciliation_status === 'MATCHED' && (
                            <button
                              onClick={() => handleUnmatch(e)}
                              className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded text-[11px] hover:text-rose-400"
                            >
                              Unmatch
                            </button>
                          )}
                          {e.reconciliation_status === 'UNMATCHED' && (
                            <button
                              onClick={() => {
                                setAdjModalEntry(e);
                                setAdjDesc(`Adjustment for ${e.description}`);
                              }}
                              className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[11px] font-semibold hover:bg-amber-500/30"
                            >
                              + Adjustment
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Hospital Ledger Transactions */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-emerald-400" />
                  Hospital Ledger Transactions ({reconTxList.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {reconTxList.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No recorded transactions for this account.</p>
                ) : (
                  reconTxList.map((tx) => (
                    <div
                      key={tx.id}
                      className={`p-3 rounded-lg border text-xs space-y-1.5 transition-colors ${
                        tx.reconciliation_status === 'RECONCILED'
                          ? 'bg-emerald-950/20 border-emerald-800/40'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-slate-400">{tx.transaction_date}</span>
                        <div>
                          {parseFloat(tx.debit_amount) > 0 ? (
                            <span className="text-emerald-400 font-semibold">+₹{parseFloat(tx.debit_amount).toLocaleString('en-IN')}</span>
                          ) : (
                            <span className="text-rose-400 font-semibold">-₹{parseFloat(tx.credit_amount).toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-slate-200 font-medium">{tx.description}</div>
                      <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                        <span>Txn: {tx.transaction_number}</span>
                        {tx.reference_number && <span>Ref: {tx.reference_number}</span>}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                        <span className="text-slate-500">{tx.category}</span>
                        <span>
                          {tx.reconciliation_status === 'RECONCILED' ? (
                            <Badge variant="success">Reconciled</Badge>
                          ) : (
                            <Badge variant="neutral">Unreconciled</Badge>
                          )}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SUPPORTING DOCUMENTS */}
      {activeTab === 'DOCUMENTS' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              Upload Financial Document
            </h3>
            <form onSubmit={handleUploadDocument} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Target Account *</label>
                <select
                  value={docAccId}
                  onChange={(e) => setDocAccId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.account_code}] {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Document Category *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                >
                  <option value="BANK_STATEMENT">Bank Statement</option>
                  <option value="ACCOUNT_OPENING">Account Opening Document</option>
                  <option value="DEPOSIT_RECEIPT">Deposit Receipt / Certificate</option>
                  <option value="RECONCILIATION_EVIDENCE">Reconciliation Evidence</option>
                  <option value="OTHER">Other Financial Doc</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Document Title *</label>
                <input
                  type="text"
                  placeholder="e.g. October 2026 Escrow Statement"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Select File (PDF, PNG, JPG, CSV) *</label>
                <input
                  type="file"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors"
                >
                  Upload Supporting Document
                </button>
              </div>
            </form>
          </div>

          {/* Documents List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Document Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Uploaded By</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No supporting documents attached.
                    </td>
                  </tr>
                ) : (
                  documents.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-850">
                      <td className="px-4 py-3 font-semibold text-slate-100">{d.title}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {d.document_type_display}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{d.uploaded_by_name || 'Staff'}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(d.uploaded_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        {d.file_url ? (
                          <a
                            href={d.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-slate-700 text-xs"
                          >
                            View File
                          </a>
                        ) : (
                          <span className="text-slate-600">Attached</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE ACCOUNT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                Create New Financial Account
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Unique Account Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FA-BNK-KOTAK"
                    value={newAccCode}
                    onChange={(e) => setNewAccCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 font-mono uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Account Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kotak Healthcare Operating Account"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Account Category *</label>
                  <select
                    value={newAccType}
                    onChange={(e) => {
                      const t = e.target.value;
                      setNewAccType(t);
                      if (['LOAN_FACILITY', 'PATIENT_DEPOSIT_LIABILITY', 'SUPPLIER_PAYABLE'].includes(t)) {
                        setNewClassification('LIABILITY');
                      } else {
                        setNewClassification('ASSET');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="BANK">Multiple Bank Accounts</option>
                    <option value="CASH">Cash Accounts</option>
                    <option value="PETTY_CASH">Petty Cash Accounts</option>
                    <option value="GATEWAY_CLEARING">Payment Gateway Clearing</option>
                    <option value="UPI_SETTLEMENT">UPI Settlement Accounts</option>
                    <option value="CARD_SETTLEMENT">Card Settlement Accounts</option>
                    <option value="FIXED_DEPOSIT">Fixed Deposit Accounts</option>
                    <option value="INVESTMENT">Investment and Brokerage</option>
                    <option value="LOAN_FACILITY">Loan & Credit Facility</option>
                    <option value="PATIENT_DEPOSIT_LIABILITY">Patient Advance & Deposit Liab.</option>
                    <option value="INSURANCE_RECEIVABLE">Insurance Receivables</option>
                    <option value="SUPPLIER_PAYABLE">Supplier Payables</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Accounting Classification</label>
                  <select
                    value={newClassification}
                    onChange={(e) => setNewClassification(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="ASSET">Asset (Dr increases, Cr decreases)</option>
                    <option value="LIABILITY">Liability (Cr increases, Dr decreases)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Institution / Provider Name {newAccType === 'BANK' ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kotak Mahindra Bank"
                    value={newInstName}
                    onChange={(e) => setNewInstName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Account Number / Reference</label>
                  <input
                    type="text"
                    placeholder="Full account number (will be masked)"
                    value={newAccNumber}
                    onChange={(e) => setNewAccNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Branch Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Vasant Kunj Branch"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">IFSC / Routing Code</label>
                  <input
                    type="text"
                    placeholder="e.g. KKBK0000123"
                    value={newIfsc}
                    onChange={(e) => setNewIfsc(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newOpeningBal}
                    onChange={(e) => setNewOpeningBal(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Notes & Description</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Operational purpose, mandates, or signatory restrictions..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-sm text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POST MANUAL TRANSACTION MODAL */}
      {showTxModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                Post Entry to [{selectedAccount.account_code}]
              </h2>
              <button
                onClick={() => setShowTxModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTxType('DEBIT')}
                  className={`py-2 text-xs font-bold rounded-lg border transition-colors ${
                    txType === 'DEBIT'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  Debit (Money In / Asset Dr)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('CREDIT')}
                  className={`py-2 text-xs font-bold rounded-lg border transition-colors ${
                    txType === 'CREDIT'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  Credit (Money Out / Asset Cr)
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Treasury transfer, patient deposit, supplier payment"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Category</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                  >
                    <option value="PATIENT_COLLECTION">Patient Collection</option>
                    <option value="INSURANCE_SETTLEMENT">Insurance Settlement</option>
                    <option value="VENDOR_PAYMENT">Vendor Payment</option>
                    <option value="TREASURY_TRANSFER">Treasury Transfer</option>
                    <option value="AUTHORIZED_ADJUSTMENT">Authorized Adjustment</option>
                    <option value="BANK_CHARGES">Bank Charges / Fees</option>
                    <option value="INTEREST_INCOME">Interest Income</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Payment Method</label>
                  <select
                    value={txMethod}
                    onChange={(e) => setTxMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                  >
                    <option value="BANK_TRANSFER">NEFT / RTGS / IMPS</option>
                    <option value="UPI">UPI / Dynamic QR</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque / Demand Draft</option>
                    <option value="INTERNAL">Internal Journal Adjustment</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Reference Number</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-998811"
                    value={txRef}
                    onChange={(e) => setTxRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Counterparty</label>
                  <input
                    type="text"
                    placeholder="e.g. MedSupply Corp"
                    value={txCounterparty}
                    onChange={(e) => setTxCounterparty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-sm text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-lg shadow-sm"
                >
                  Post Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUSTMENT MODAL FOR RECONCILIATION */}
      {adjModalEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              Record Reconciliation Adjustment
            </h3>
            <p className="text-xs text-slate-400">
              Create an authorized balancing transaction for statement entry:
              <span className="font-semibold text-slate-200 block mt-1">{adjModalEntry.description}</span>
              <span className="font-mono text-amber-400">
                Amount: ₹{(parseFloat(adjModalEntry.debit_amount) || parseFloat(adjModalEntry.credit_amount)).toLocaleString('en-IN')}
              </span>
            </p>

            <form onSubmit={handleRecordAdjustment} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Adjustment Category</label>
                <select
                  value={adjCategory}
                  onChange={(e) => setAdjCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                >
                  <option value="BANK_CHARGES">Bank Charges & Processing Fees</option>
                  <option value="INTEREST_INCOME">Interest Credited by Bank</option>
                  <option value="TIMING_DIFFERENCE">Timing Difference Settlement</option>
                  <option value="GATEWAY_FEE">Payment Gateway Deductions</option>
                  <option value="DISCREPANCY_CORRECTION">Audit Discrepancy Correction</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Adjustment Narration</label>
                <input
                  type="text"
                  required
                  value={adjDesc}
                  onChange={(e) => setAdjDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjModalEntry(null)}
                  className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 rounded text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded shadow-sm"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
