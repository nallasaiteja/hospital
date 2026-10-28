import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building,
  FileCheck,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  Plus,
  Search,
  Upload,
  CreditCard,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  AlertTriangle,
  UserCheck,
  Briefcase,
  HelpCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { billingFinanceService, authService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

type TabType =
  | 'overview'
  | 'providers'
  | 'corporates'
  | 'coverages'
  | 'eligibility'
  | 'preauth'
  | 'cashless'
  | 'reimbursement'
  | 'documents'
  | 'queries'
  | 'settlements'
  | 'corp_invoices'
  | 'receivables';

export const InsurancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Datasets
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [corporates, setCorporates] = useState<any[]>([]);
  const [coverages, setCoverages] = useState<any[]>([]);
  const [eligibilityChecks, setEligibilityChecks] = useState<any[]>([]);
  const [preAuths, setPreAuths] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [corporateInvoices, setCorporateInvoices] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any>(null);

  // Aux datasets
  const [patients, setPatients] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);

  // Modals state
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [isCorporateModalOpen, setIsCorporateModalOpen] = useState(false);
  const [isCoverageModalOpen, setIsCoverageModalOpen] = useState(false);
  const [isEligibilityModalOpen, setIsEligibilityModalOpen] = useState(false);
  const [isPreAuthModalOpen, setIsPreAuthModalOpen] = useState(false);
  const [isPreAuthAdjOpen, setIsPreAuthAdjOpen] = useState(false);
  const [selectedPreAuth, setSelectedPreAuth] = useState<any | null>(null);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isClaimAdjOpen, setIsClaimAdjOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const [isQueryRespOpen, setIsQueryRespOpen] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<any | null>(null);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [isCorpInvoiceModalOpen, setIsCorpInvoiceModalOpen] = useState(false);
  const [isCorpPayModalOpen, setIsCorpPayModalOpen] = useState(false);
  const [selectedCorpInvoice, setSelectedCorpInvoice] = useState<any | null>(null);

  // Form states
  const [providerForm, setProviderForm] = useState({
    name: '',
    code: '',
    org_type: 'TPA',
    contact_person: '',
    phone: '',
    email: '',
    claim_settlement_avg_days: 15,
    default_tariff: ''
  });

  const [corporateForm, setCorporateForm] = useState({
    name: '',
    code: '',
    contact_person: '',
    phone: '',
    email: '',
    billing_address: '',
    contract_reference: '',
    credit_terms_days: 30,
    credit_limit: '500000.00',
    corporate_tariff: ''
  });

  const [coverageForm, setCoverageForm] = useState({
    patient: '',
    provider: '',
    corporate_customer: '',
    policy_number: '',
    member_id: '',
    insured_person_name: '',
    relation_to_patient: 'SELF',
    sum_insured: '500000.00',
    copay_percentage: '0.00',
    deductible_amount: '0.00'
  });

  const [eligibilityForm, setEligibilityForm] = useState({
    coverage: '',
    patient: '',
    verification_method: 'PORTAL',
    reference_number: '',
    coverage_limit_confirmed: '500000.00',
    status: 'ELIGIBLE',
    notes: ''
  });

  const [preAuthForm, setPreAuthForm] = useState({
    patient: '',
    coverage: '',
    treatment_category: 'Inpatient Care',
    estimated_amount: '',
    requested_amount: '',
    notes: ''
  });

  const [preAuthAdjForm, setPreAuthAdjForm] = useState({
    decision: 'APPROVED',
    approved_amount: '',
    approval_reference: '',
    rejection_query_reason: ''
  });

  const [claimForm, setClaimForm] = useState({
    claim_type: 'CASHLESS',
    patient: '',
    invoice: '',
    provider: '',
    corporate_customer: '',
    coverage: '',
    policy_number: '',
    claim_amount: ''
  });

  const [claimAdjForm, setClaimAdjForm] = useState({
    decision: 'APPROVED',
    approved_amount: '',
    disallowed_amount: '0.00',
    patient_copay_amount: '0.00',
    rejection_reason: ''
  });

  const [docForm, setDocForm] = useState({
    claim: '',
    document_type: 'DISCHARGE_SUMMARY',
    document_name: '',
    file_url: '',
    notes: ''
  });

  const [queryForm, setQueryForm] = useState({
    claim: '',
    query_type: 'BILLING_QUERY',
    query_text: '',
    deadline_date: ''
  });

  const [queryRespForm, setQueryRespForm] = useState({
    response_text: ''
  });

  const [settlementForm, setSettlementForm] = useState({
    claim: '',
    settlement_reference: '',
    bank_utr: '',
    amount_settled: '',
    disallowed_amount: '0.00',
    tds_deducted: '0.00',
    reconciliation_notes: ''
  });

  const [corpInvoiceForm, setCorpInvoiceForm] = useState({
    corporate_customer: '',
    billing_period_start: '',
    billing_period_end: '',
    total_amount: '',
    balance_amount: '',
    due_date: '',
    notes: ''
  });

  const [corpPayForm, setCorpPayForm] = useState({
    amount: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [
        statsRes, provRes, corpRes, covRes, eligRes, paRes,
        clmRes, docRes, qryRes, stlRes, cInvRes, recRes,
        ptRes, invRes, trfRes
      ] = await Promise.all([
        billingFinanceService.getInsuranceDashboardStats().catch(() => null),
        billingFinanceService.getInsuranceProviders().catch(() => []),
        billingFinanceService.getCorporateCustomers().catch(() => []),
        billingFinanceService.getPatientCoverages().catch(() => []),
        billingFinanceService.getEligibilityChecks().catch(() => []),
        billingFinanceService.getPreAuthorizations().catch(() => []),
        billingFinanceService.getInsuranceClaims().catch(() => []),
        billingFinanceService.getClaimDocuments().catch(() => []),
        billingFinanceService.getClaimQueries().catch(() => []),
        billingFinanceService.getClaimSettlements().catch(() => []),
        billingFinanceService.getCorporateInvoices().catch(() => []),
        billingFinanceService.getInsuranceReceivables().catch(() => null),
        authService.getPatients().catch(() => []),
        billingFinanceService.getInvoices().catch(() => []),
        billingFinanceService.getTariffs().catch(() => [])
      ]);

      setDashboardStats(statsRes);
      setProviders(provRes || []);
      setCorporates(corpRes || []);
      setCoverages(covRes || []);
      setEligibilityChecks(eligRes || []);
      setPreAuths(paRes || []);
      setClaims(clmRes || []);
      setDocuments(docRes || []);
      setQueries(qryRes || []);
      setSettlements(stlRes || []);
      setCorporateInvoices(cInvRes || []);
      setReceivables(recRes);
      setPatients(ptRes || []);
      setInvoices(invRes || []);
      setTariffs(trfRes || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-cyan-400" />
            Insurance & Corporate Billing
          </h1>
          <p className="text-sm text-slate-400">
            Cashless hospitalization dossiers, TPA adjudication, pre-auths, corporate credit billing, and settlement reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh All Records"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* 13 NAVIGATION TABS */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 pb-2 text-xs scrollbar-thin">
        {[
          { id: 'overview', label: 'Executive Overview', icon: TrendingUp },
          { id: 'providers', label: 'TPAs & Insurers', icon: Building },
          { id: 'corporates', label: 'Corporate Partners', icon: Briefcase },
          { id: 'coverages', label: 'Patient Policies', icon: UserCheck },
          { id: 'eligibility', label: 'Eligibility Desk', icon: FileCheck },
          { id: 'preauth', label: 'Pre-Authorizations', icon: Clock },
          { id: 'cashless', label: 'Cashless Claims', icon: ShieldCheck },
          { id: 'reimbursement', label: 'Reimbursement Claims', icon: FileText },
          { id: 'documents', label: 'Claim Dossiers', icon: Upload },
          { id: 'queries', label: 'Queries & Denials', icon: HelpCircle },
          { id: 'settlements', label: 'Settlement Reconciliation', icon: DollarSign },
          { id: 'corp_invoices', label: 'Corporate Invoices', icon: FileSpreadsheet },
          { id: 'receivables', label: 'Receivables & Ageing', icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                isActive ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && dashboardStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Claims In Adjudication</span>
              <p className="text-2xl font-bold text-cyan-400 mt-1">{dashboardStats.claims_in_flight}</p>
              <span className="text-xs text-slate-500">Submitted & under review by TPAs</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Pre-Auths</span>
              <p className="text-2xl font-bold text-amber-400 mt-1">{dashboardStats.pending_preauths}</p>
              <span className="text-xs text-slate-500">Awaiting medical clearance</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Queries</span>
              <p className="text-2xl font-bold text-rose-400 mt-1">{dashboardStats.active_queries}</p>
              <span className="text-xs text-slate-500">Requires medical justification</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Settled Receipts</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">₹{parseFloat(dashboardStats.total_settled_value || 0).toLocaleString('en-IN')}</p>
              <span className="text-xs text-slate-500">Disbursed by TPAs to hospital bank</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" /> Claims Channel Breakdown
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">Cashless Hospitalization</span>
                  <Badge variant="cyan">{dashboardStats.cashless_count} Claims</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">Patient Reimbursements</span>
                  <Badge variant="neutral">{dashboardStats.reimbursement_count} Claims</Badge>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-400">Corporate Credit Claims</span>
                  <Badge variant="primary">{dashboardStats.corporate_count} Claims</Badge>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 lg:col-span-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Claims Financial Settlement Funnel
              </h3>
              <div className="grid grid-cols-3 gap-4 text-center py-4">
                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
                  <span className="text-xs text-slate-400 block mb-1">Total Claimed</span>
                  <span className="text-lg font-bold text-white font-mono">
                    ₹{parseFloat(dashboardStats.total_claimed_value || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
                  <span className="text-xs text-slate-400 block mb-1">TPA Approved</span>
                  <span className="text-lg font-bold text-cyan-400 font-mono">
                    ₹{parseFloat(dashboardStats.total_approved_value || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
                  <span className="text-xs text-slate-400 block mb-1">Actual Disbursed</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    ₹{parseFloat(dashboardStats.total_settled_value || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TPAS & INSURERS */}
      {activeTab === 'providers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Empanelled TPAs & Health Insurers</h3>
            <button
              onClick={() => setIsProviderModalOpen(true)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add TPA / Insurer
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Organization Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Desk Contact</th>
                  <th className="p-3">Avg Settlement</th>
                  <th className="p-3">Default Tariff</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {providers.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-cyan-400">{p.code}</td>
                    <td className="p-3 font-semibold text-white">{p.name}</td>
                    <td className="p-3">
                      <Badge variant="neutral">{p.org_type}</Badge>
                    </td>
                    <td className="p-3 text-xs">
                      <div>{p.contact_person}</div>
                      <div className="text-slate-400 font-mono">{p.phone}</div>
                    </td>
                    <td className="p-3 font-mono text-xs">{p.claim_settlement_avg_days} Days</td>
                    <td className="p-3 font-mono text-xs text-slate-300">{p.default_tariff_name || 'Standard Tariff'}</td>
                    <td className="p-3">
                      <Badge variant={p.is_active ? 'success' : 'neutral'}>
                        {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={async () => {
                          try {
                            await billingFinanceService.toggleInsuranceProviderActive(p.id);
                            loadData();
                          } catch (err: any) {
                            setError('Failed to toggle status.');
                          }
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold"
                      >
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CORPORATE PARTNERS */}
      {activeTab === 'corporates' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Corporate Clients & Credit Terms</h3>
            <button
              onClick={() => setIsCorporateModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Corporate Client
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {corporates.map((c) => (
              <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs text-cyan-400 font-bold">{c.code}</span>
                  <Badge variant={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'ACTIVE' : 'INACTIVE'}</Badge>
                </div>
                <div>
                  <h4 className="font-semibold text-white text-base">{c.name}</h4>
                  <p className="text-xs text-slate-400">{c.contact_person} &bull; {c.phone}</p>
                </div>
                <div className="text-xs bg-slate-800/50 p-2.5 rounded-lg space-y-1 font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span>Credit Limit:</span>
                    <span className="text-white font-bold">₹{c.credit_limit}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Credit Utilized:</span>
                    <span className="text-amber-400 font-bold">₹{c.current_credit_utilized}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Available Balance:</span>
                    <span className="text-emerald-400 font-bold">₹{c.available_credit}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  Tariff: <span className="text-slate-200">{c.corporate_tariff_name || 'Standard Agreement'}</span> &bull; Terms: {c.credit_terms_days} Days
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PATIENT POLICIES */}
      {activeTab === 'coverages' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Patient Insurance & Corporate Coverage Registry</h3>
            <button
              onClick={() => setIsCoverageModalOpen(true)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Register Coverage
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Provider / Corporate</th>
                  <th className="p-3">Policy #</th>
                  <th className="p-3">Sum Insured</th>
                  <th className="p-3">Co-Pay / Deductible</th>
                  <th className="p-3">Verification</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {coverages.map((cov) => (
                  <tr key={cov.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">{cov.patient_name}</td>
                    <td className="p-3 text-xs">{cov.provider_name || cov.corporate_customer_name}</td>
                    <td className="p-3 font-mono text-cyan-400 font-bold">{cov.policy_number}</td>
                    <td className="p-3 font-mono text-white">₹{cov.sum_insured}</td>
                    <td className="p-3 text-xs font-mono">
                      {cov.copay_percentage}% / ₹{cov.deductible_amount}
                    </td>
                    <td className="p-3">
                      <Badge variant={cov.is_verified ? 'success' : 'warning'}>
                        {cov.is_verified ? 'VERIFIED' : 'PENDING'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {!cov.is_verified && (
                        <button
                          onClick={async () => {
                            try {
                              await billingFinanceService.verifyPatientCoverage(cov.id);
                              setSuccessMsg('Policy verified successfully.');
                              loadData();
                            } catch (err: any) {
                              setError('Failed to verify policy.');
                            }
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                        >
                          Verify Policy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: ELIGIBILITY DESK */}
      {activeTab === 'eligibility' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Eligibility Verification Records</h3>
            <button
              onClick={() => setIsEligibilityModalOpen(true)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Check Eligibility
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Policy & Provider</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Reference #</th>
                  <th className="p-3">Confirmed Limit</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Checked By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {eligibilityChecks.map((el) => (
                  <tr key={el.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">{el.patient_name}</td>
                    <td className="p-3 text-xs">
                      <div className="font-mono text-cyan-400">{el.policy_number}</div>
                      <div className="text-slate-400">{el.provider_name}</div>
                    </td>
                    <td className="p-3 text-xs">{el.verification_method}</td>
                    <td className="p-3 font-mono text-xs">{el.reference_number || 'N/A'}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">₹{el.coverage_limit_confirmed}</td>
                    <td className="p-3">
                      <Badge variant={el.status === 'ELIGIBLE' ? 'success' : 'danger'}>{el.status}</Badge>
                    </td>
                    <td className="p-3 text-xs text-slate-300">{el.checked_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: PRE-AUTHORIZATIONS */}
      {activeTab === 'preauth' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Inpatient Pre-Authorization Desk</h3>
            <button
              onClick={() => setIsPreAuthModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Request Pre-Auth
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {preAuths.map((pa) => (
              <div key={pa.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs text-cyan-400 font-bold">{pa.request_number}</span>
                  <Badge variant={pa.status === 'APPROVED' ? 'success' : pa.status === 'PARTIALLY_APPROVED' ? 'warning' : 'neutral'}>
                    {pa.status}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-semibold text-white">{pa.patient_name}</h4>
                  <p className="text-xs text-slate-400">{pa.treatment_category}</p>
                </div>
                <div className="bg-slate-800/40 p-2.5 rounded-lg text-xs space-y-1 font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span>Requested Amount:</span>
                    <span className="text-white">₹{pa.requested_amount}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Approved Amount:</span>
                    <span className="text-emerald-400 font-bold">₹{pa.approved_amount}</span>
                  </div>
                  {pa.approval_reference && (
                    <div className="flex justify-between text-slate-400">
                      <span>Approval Ref:</span>
                      <span className="text-cyan-300">{pa.approval_reference}</span>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                  {pa.status === 'DRAFT' && (
                    <button
                      onClick={async () => {
                        try {
                          await billingFinanceService.submitPreAuthToTPA(pa.id);
                          setSuccessMsg('Submitted to TPA.');
                          loadData();
                        } catch (err: any) {
                          setError('Failed to submit pre-auth.');
                        }
                      }}
                      className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
                    >
                      Submit to TPA
                    </button>
                  )}
                  {pa.status === 'SUBMITTED' && (
                    <button
                      onClick={() => {
                        setSelectedPreAuth(pa);
                        setPreAuthAdjForm({
                          decision: 'APPROVED',
                          approved_amount: pa.requested_amount,
                          approval_reference: '',
                          rejection_query_reason: ''
                        });
                        setIsPreAuthAdjOpen(true);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                    >
                      Adjudicate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7 & 8: CASHLESS & REIMBURSEMENT CLAIMS */}
      {(activeTab === 'cashless' || activeTab === 'reimbursement') && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">
              {activeTab === 'cashless' ? 'Cashless Hospitalization Claims' : 'Patient Reimbursement Claims'}
            </h3>
            <button
              onClick={() => {
                setClaimForm({ ...claimForm, claim_type: activeTab === 'cashless' ? 'CASHLESS' : 'REIMBURSEMENT' });
                setIsClaimModalOpen(true);
              }}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> New Claim Docket
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Claim #</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Claimed</th>
                  <th className="p-3">Approved</th>
                  <th className="p-3">Patient Co-Pay</th>
                  <th className="p-3">Disbursed</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {claims
                  .filter((c) => c.claim_type === (activeTab === 'cashless' ? 'CASHLESS' : 'REIMBURSEMENT'))
                  .map((clm) => (
                    <tr key={clm.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-cyan-400">{clm.claim_number}</td>
                      <td className="p-3 font-semibold text-white">{clm.patient_name}</td>
                      <td className="p-3 font-mono text-slate-300">{clm.invoice_number}</td>
                      <td className="p-3 font-mono text-white">₹{clm.claim_amount}</td>
                      <td className="p-3 font-mono text-cyan-400 font-bold">₹{clm.approved_amount}</td>
                      <td className="p-3 font-mono text-amber-400 font-bold">₹{clm.patient_copay_amount}</td>
                      <td className="p-3 font-mono text-emerald-400 font-bold">₹{clm.settled_amount}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            clm.status === 'SETTLED'
                              ? 'success'
                              : clm.status === 'APPROVED' || clm.status === 'PARTIALLY_APPROVED'
                              ? 'info'
                              : clm.status === 'REJECTED'
                              ? 'danger'
                              : 'neutral'
                          }
                        >
                          {clm.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {clm.status === 'DRAFT' && (
                          <button
                            onClick={async () => {
                              try {
                                await billingFinanceService.submitClaimToTPA(clm.id);
                                setSuccessMsg('Claim submitted to TPA.');
                                loadData();
                              } catch (err: any) {
                                setError('Failed to submit claim.');
                              }
                            }}
                            className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
                          >
                            Submit
                          </button>
                        )}
                        {(clm.status === 'SUBMITTED' || clm.status === 'UNDER_REVIEW' || clm.status === 'RESUBMITTED') && (
                          <button
                            onClick={() => {
                              setSelectedClaim(clm);
                              setClaimAdjForm({
                                decision: 'APPROVED',
                                approved_amount: clm.claim_amount,
                                disallowed_amount: '0.00',
                                patient_copay_amount: '0.00',
                                rejection_reason: ''
                              });
                              setIsClaimAdjOpen(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                          >
                            Adjudicate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 9: CLAIM DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Claim Document Dossier & Attachments</h3>
            <button
              onClick={() => setIsDocModalOpen(true)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" /> Attach Document
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Claim #</th>
                  <th className="p-3">Document Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Uploaded By</th>
                  <th className="p-3 text-right">View / Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {documents.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-400">{d.claim?.claim_number || 'Claim File'}</td>
                    <td className="p-3 font-semibold text-white">{d.document_name}</td>
                    <td className="p-3">
                      <Badge variant="neutral">{d.document_type}</Badge>
                    </td>
                    <td className="p-3 text-xs">{d.uploaded_by_name}</td>
                    <td className="p-3 text-right">
                      {d.file_url ? (
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">File attached</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 10: QUERIES & DENIALS */}
      {activeTab === 'queries' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">TPA Queries & Medical Deficiencies</h3>
            <button
              onClick={() => setIsQueryModalOpen(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Log Query
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {queries.map((q) => (
              <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs text-cyan-400 font-bold">{q.query_number}</span>
                  <Badge variant={q.status === 'ANSWERED' ? 'success' : 'danger'}>{q.status}</Badge>
                </div>
                <div className="text-xs text-slate-400 font-semibold">{q.query_type}</div>
                <p className="text-xs text-slate-200 bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50">
                  {q.query_text}
                </p>
                {q.response_text && (
                  <div className="text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-800/50 p-2.5 rounded-lg">
                    <span className="font-bold block mb-0.5">Response:</span>
                    {q.response_text}
                  </div>
                )}
                {q.status === 'PENDING' && (
                  <div className="pt-2 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={() => {
                        setSelectedQuery(q);
                        setQueryRespForm({ response_text: '' });
                        setIsQueryRespOpen(true);
                      }}
                      className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
                    >
                      Respond & Resubmit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 11: SETTLEMENT RECONCILIATION */}
      {activeTab === 'settlements' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">TPA & Bank Settlement Receipts</h3>
            <button
              onClick={() => setIsSettlementModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Record Settlement
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Settlement #</th>
                  <th className="p-3">Reference / UTR</th>
                  <th className="p-3">Disbursed Amount</th>
                  <th className="p-3">Disallowed</th>
                  <th className="p-3">TDS</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Settled By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-cyan-400">{s.settlement_number}</td>
                    <td className="p-3 text-xs">
                      <div className="font-semibold text-white">{s.settlement_reference}</div>
                      <div className="font-mono text-slate-400">{s.bank_utr}</div>
                    </td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">₹{s.amount_settled}</td>
                    <td className="p-3 font-mono text-rose-400">₹{s.disallowed_amount}</td>
                    <td className="p-3 font-mono text-slate-400">₹{s.tds_deducted}</td>
                    <td className="p-3">
                      <Badge variant="success">{s.reconciliation_status}</Badge>
                    </td>
                    <td className="p-3 text-xs">{s.settled_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 12: CORPORATE INVOICES */}
      {activeTab === 'corp_invoices' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Consolidated Corporate Billing Statements</h3>
            <button
              onClick={() => setIsCorpInvoiceModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Generate Corporate Invoice
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Corporate Customer</th>
                  <th className="p-3">Billing Period</th>
                  <th className="p-3">Total Amount</th>
                  <th className="p-3">Paid Amount</th>
                  <th className="p-3">Balance Due</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {corporateInvoices.map((ci) => (
                  <tr key={ci.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-cyan-400">{ci.invoice_number}</td>
                    <td className="p-3 font-semibold text-white">{ci.corporate_customer_name}</td>
                    <td className="p-3 text-xs font-mono">
                      {ci.billing_period_start} to {ci.billing_period_end}
                    </td>
                    <td className="p-3 font-mono text-white">₹{ci.total_amount}</td>
                    <td className="p-3 font-mono text-emerald-400">₹{ci.paid_amount}</td>
                    <td className="p-3 font-mono text-rose-400 font-bold">₹{ci.balance_amount}</td>
                    <td className="p-3">
                      <Badge variant={ci.status === 'PAID' ? 'success' : 'neutral'}>{ci.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {ci.balance_amount !== '0.00' && (
                        <button
                          onClick={() => {
                            setSelectedCorpInvoice(ci);
                            setCorpPayForm({ amount: ci.balance_amount });
                            setIsCorpPayModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                        >
                          Collect Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 13: RECEIVABLES & AGEING */}
      {activeTab === 'receivables' && receivables && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current (0–30 Days)</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">₹{parseFloat(receivables.ageing_breakdown?.current_30_days || 0).toLocaleString('en-IN')}</p>
              <span className="text-xs text-slate-500">Within agreed credit terms</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">31–60 Days</span>
              <p className="text-2xl font-bold text-amber-400 mt-1">₹{parseFloat(receivables.ageing_breakdown?.days_31_to_60 || 0).toLocaleString('en-IN')}</p>
              <span className="text-xs text-slate-500">First follow-up cycle</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">61–90 Days</span>
              <p className="text-2xl font-bold text-rose-400 mt-1">₹{parseFloat(receivables.ageing_breakdown?.days_61_to_90 || 0).toLocaleString('en-IN')}</p>
              <span className="text-xs text-slate-500">Escalated to TPA head</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Over 90 Days</span>
              <p className="text-2xl font-bold text-rose-500 mt-1">₹{parseFloat(receivables.ageing_breakdown?.over_90_days || 0).toLocaleString('en-IN')}</p>
              <span className="text-xs text-slate-500">Overdue / Disputed items</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white">Insurer & Corporate Outstanding Receivables</h3>
              <span className="text-xs text-slate-400 font-mono">
                Total Outstanding: <span className="font-bold text-emerald-400">₹{parseFloat(receivables.total_outstanding_receivables || 0).toLocaleString('en-IN')}</span>
              </span>
            </div>
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Organization Name</th>
                  <th className="p-3 text-center">Open Claims</th>
                  <th className="p-3 text-right">Outstanding Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {receivables.organization_receivables?.map((org: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">{org.organization_name}</td>
                    <td className="p-3 text-center font-mono">{org.claim_count}</td>
                    <td className="p-3 text-right font-mono text-emerald-400 font-bold">₹{parseFloat(org.outstanding_amount).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD TPA / INSURER */}
      <Modal isOpen={isProviderModalOpen} onClose={() => setIsProviderModalOpen(false)} title="Register Empanelled TPA / Insurer">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.createInsuranceProvider({
                ...providerForm,
                default_tariff: providerForm.default_tariff || null
              });
              setSuccessMsg('Insurance Provider registered successfully.');
              setIsProviderModalOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Input label="Insurance / TPA Name" value={providerForm.name} onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Unique Code" value={providerForm.code} onChange={(e) => setProviderForm({ ...providerForm, code: e.target.value })} required />
            <Select
              label="Organization Type"
              value={providerForm.org_type}
              onChange={(e) => setProviderForm({ ...providerForm, org_type: e.target.value })}
              options={[
                { value: 'TPA', label: 'Third-Party Administrator (TPA)' },
                { value: 'PRIVATE_INSURER', label: 'Private Health Insurer' },
                { value: 'GOVT_SCHEME', label: 'Government Health Scheme' },
                { value: 'CORPORATE_TPA', label: 'Corporate TPA' }
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Person" value={providerForm.contact_person} onChange={(e) => setProviderForm({ ...providerForm, contact_person: e.target.value })} required />
            <Input label="Phone" value={providerForm.phone} onChange={(e) => setProviderForm({ ...providerForm, phone: e.target.value })} required />
          </div>
          <Input label="TPA Official Email" type="email" value={providerForm.email} onChange={(e) => setProviderForm({ ...providerForm, email: e.target.value })} />
          <Select
            label="Default Tariff Agreement"
            value={providerForm.default_tariff}
            onChange={(e) => setProviderForm({ ...providerForm, default_tariff: e.target.value })}
            options={[{ value: '', label: 'Standard Hospital Tariff' }, ...tariffs.map((t) => ({ value: t.id, label: t.name }))]}
          />
          <button type="submit" className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-xs">
            Save Provider
          </button>
        </form>
      </Modal>

      {/* MODAL 2: ADD CORPORATE CLIENT */}
      <Modal isOpen={isCorporateModalOpen} onClose={() => setIsCorporateModalOpen(false)} title="Register Corporate Partner">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.createCorporateCustomer({
                ...corporateForm,
                corporate_tariff: corporateForm.corporate_tariff || null
              });
              setSuccessMsg('Corporate Partner registered successfully.');
              setIsCorporateModalOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Input label="Company Name" value={corporateForm.name} onChange={(e) => setCorporateForm({ ...corporateForm, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Unique Code" value={corporateForm.code} onChange={(e) => setCorporateForm({ ...corporateForm, code: e.target.value })} required />
            <Input label="Contract Reference" value={corporateForm.contract_reference} onChange={(e) => setCorporateForm({ ...corporateForm, contract_reference: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Person" value={corporateForm.contact_person} onChange={(e) => setCorporateForm({ ...corporateForm, contact_person: e.target.value })} required />
            <Input label="Phone" value={corporateForm.phone} onChange={(e) => setCorporateForm({ ...corporateForm, phone: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Credit Limit (₹)" type="number" value={corporateForm.credit_limit} onChange={(e) => setCorporateForm({ ...corporateForm, credit_limit: e.target.value })} required />
            <Input label="Credit Terms (Days)" type="number" value={corporateForm.credit_terms_days} onChange={(e) => setCorporateForm({ ...corporateForm, credit_terms_days: Number(e.target.value) })} required />
          </div>
          <Select
            label="Corporate Tariff Agreement"
            value={corporateForm.corporate_tariff}
            onChange={(e) => setCorporateForm({ ...corporateForm, corporate_tariff: e.target.value })}
            options={[{ value: '', label: 'Standard Hospital Tariff' }, ...tariffs.map((t) => ({ value: t.id, label: t.name }))]}
          />
          <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-xs">
            Save Corporate Client
          </button>
        </form>
      </Modal>

      {/* MODAL 3: REGISTER PATIENT COVERAGE */}
      <Modal isOpen={isCoverageModalOpen} onClose={() => setIsCoverageModalOpen(false)} title="Register Patient Insurance Coverage">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.createPatientCoverage({
                ...coverageForm,
                provider: coverageForm.provider || null,
                corporate_customer: coverageForm.corporate_customer || null
              });
              setSuccessMsg('Patient coverage recorded.');
              setIsCoverageModalOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Select
            label="Patient"
            value={coverageForm.patient}
            onChange={(e) => setCoverageForm({ ...coverageForm, patient: e.target.value })}
            options={[{ value: '', label: 'Select Patient' }, ...patients.map((pt) => ({ value: pt.id, label: `${pt.user_profile?.full_name} (${pt.medical_record_number || 'MRN'})` }))]}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Insurance Provider"
              value={coverageForm.provider}
              onChange={(e) => setCoverageForm({ ...coverageForm, provider: e.target.value, corporate_customer: '' })}
              options={[{ value: '', label: 'None / Corporate' }, ...providers.map((p) => ({ value: p.id, label: p.name }))]}
            />
            <Select
              label="Corporate Client"
              value={coverageForm.corporate_customer}
              onChange={(e) => setCoverageForm({ ...coverageForm, corporate_customer: e.target.value, provider: '' })}
              options={[{ value: '', label: 'None / Private' }, ...corporates.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Policy / Member #" value={coverageForm.policy_number} onChange={(e) => setCoverageForm({ ...coverageForm, policy_number: e.target.value })} required />
            <Input label="Sum Insured (₹)" type="number" value={coverageForm.sum_insured} onChange={(e) => setCoverageForm({ ...coverageForm, sum_insured: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Co-Pay (%)" type="number" value={coverageForm.copay_percentage} onChange={(e) => setCoverageForm({ ...coverageForm, copay_percentage: e.target.value })} />
            <Input label="Deductible (₹)" type="number" value={coverageForm.deductible_amount} onChange={(e) => setCoverageForm({ ...coverageForm, deductible_amount: e.target.value })} />
          </div>
          <button type="submit" className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-xs">
            Save Coverage
          </button>
        </form>
      </Modal>

      {/* MODAL 4: ELIGIBILITY CHECK */}
      <Modal isOpen={isEligibilityModalOpen} onClose={() => setIsEligibilityModalOpen(false)} title="Conduct TPA Eligibility Verification">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.createEligibilityCheck(eligibilityForm);
              setSuccessMsg('Eligibility check recorded.');
              setIsEligibilityModalOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Select
            label="Policy Coverage"
            value={eligibilityForm.coverage}
            onChange={(e) => {
              const cov = coverages.find((c) => c.id === e.target.value);
              setEligibilityForm({
                ...eligibilityForm,
                coverage: e.target.value,
                patient: cov?.patient || ''
              });
            }}
            options={[{ value: '', label: 'Select Policy' }, ...coverages.map((c) => ({ value: c.id, label: `${c.patient_name} - ${c.policy_number}` }))]}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Verification Method"
              value={eligibilityForm.verification_method}
              onChange={(e) => setEligibilityForm({ ...eligibilityForm, verification_method: e.target.value })}
              options={[
                { value: 'PORTAL', label: 'Online TPA Portal' },
                { value: 'API', label: 'Automated Carrier API' },
                { value: 'PHONE', label: 'TPA Desk Hotline' },
                { value: 'EMAIL', label: 'Official Email Confirmation' }
              ]}
            />
            <Input label="Verification Reference #" value={eligibilityForm.reference_number} onChange={(e) => setEligibilityForm({ ...eligibilityForm, reference_number: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Confirmed Limit (₹)" type="number" value={eligibilityForm.coverage_limit_confirmed} onChange={(e) => setEligibilityForm({ ...eligibilityForm, coverage_limit_confirmed: e.target.value })} required />
            <Select
              label="Eligibility Outcome"
              value={eligibilityForm.status}
              onChange={(e) => setEligibilityForm({ ...eligibilityForm, status: e.target.value })}
              options={[
                { value: 'ELIGIBLE', label: 'ELIGIBLE' },
                { value: 'INELIGIBLE', label: 'INELIGIBLE' },
                { value: 'EXPIRED', label: 'EXPIRED' }
              ]}
            />
          </div>
          <Input label="Verification Notes" value={eligibilityForm.notes} onChange={(e) => setEligibilityForm({ ...eligibilityForm, notes: e.target.value })} />
          <button type="submit" className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-xs">
            Save Verification
          </button>
        </form>
      </Modal>

      {/* MODAL 5: REQUEST PRE-AUTH */}
      <Modal isOpen={isPreAuthModalOpen} onClose={() => setIsPreAuthModalOpen(false)} title="Initiate Inpatient Pre-Authorization">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.createPreAuthorization(preAuthForm);
              setSuccessMsg('Pre-authorization request generated.');
              setIsPreAuthModalOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Select
            label="Policy Coverage"
            value={preAuthForm.coverage}
            onChange={(e) => {
              const cov = coverages.find((c) => c.id === e.target.value);
              setPreAuthForm({ ...preAuthForm, coverage: e.target.value, patient: cov?.patient || '' });
            }}
            options={[{ value: '', label: 'Select Policy' }, ...coverages.map((c) => ({ value: c.id, label: `${c.patient_name} - ${c.policy_number}` }))]}
            required
          />
          <Input label="Treatment / Surgery Category" value={preAuthForm.treatment_category} onChange={(e) => setPreAuthForm({ ...preAuthForm, treatment_category: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Estimated Bill (₹)" type="number" value={preAuthForm.estimated_amount} onChange={(e) => setPreAuthForm({ ...preAuthForm, estimated_amount: e.target.value })} required />
            <Input label="Requested Authorization (₹)" type="number" value={preAuthForm.requested_amount} onChange={(e) => setPreAuthForm({ ...preAuthForm, requested_amount: e.target.value })} required />
          </div>
          <Input label="Clinical Notes" value={preAuthForm.notes} onChange={(e) => setPreAuthForm({ ...preAuthForm, notes: e.target.value })} />
          <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-xs">
            Generate Request
          </button>
        </form>
      </Modal>

      {/* MODAL 6: ADJUDICATE PRE-AUTH */}
      <Modal isOpen={isPreAuthAdjOpen} onClose={() => setIsPreAuthAdjOpen(false)} title={`Adjudicate Pre-Auth: ${selectedPreAuth?.request_number}`}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedPreAuth) return;
            try {
              setLoading(true);
              await billingFinanceService.adjudicatePreAuth(selectedPreAuth.id, preAuthAdjForm);
              setSuccessMsg('Pre-authorization adjudicated.');
              setIsPreAuthAdjOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Select
            label="Decision"
            value={preAuthAdjForm.decision}
            onChange={(e) => setPreAuthAdjForm({ ...preAuthAdjForm, decision: e.target.value })}
            options={[
              { value: 'APPROVED', label: 'Approved in Full' },
              { value: 'PARTIALLY_APPROVED', label: 'Partially Approved' },
              { value: 'QUERY_RECEIVED', label: 'Query Received' },
              { value: 'REJECTED', label: 'Rejected / Denied' }
            ]}
          />
          <Input label="Approved Amount (₹)" type="number" value={preAuthAdjForm.approved_amount} onChange={(e) => setPreAuthAdjForm({ ...preAuthAdjForm, approved_amount: e.target.value })} />
          <Input label="Approval Reference #" value={preAuthAdjForm.approval_reference} onChange={(e) => setPreAuthAdjForm({ ...preAuthAdjForm, approval_reference: e.target.value })} />
          <Input label="Rejection / Query Justification" value={preAuthAdjForm.rejection_query_reason} onChange={(e) => setPreAuthAdjForm({ ...preAuthAdjForm, rejection_query_reason: e.target.value })} />
          <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs">
            Save Decision
          </button>
        </form>
      </Modal>

      {/* MODAL 7: CREATE CLAIM DOCKET */}
      <Modal isOpen={isClaimModalOpen} onClose={() => setIsClaimModalOpen(false)} title="Create Insurance Claim Docket">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.submitClaim({
                ...claimForm,
                provider: claimForm.provider || null,
                corporate_customer: claimForm.corporate_customer || null,
                coverage: claimForm.coverage || null
              });
              setSuccessMsg('Insurance claim created.');
              setIsClaimModalOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Patient"
              value={claimForm.patient}
              onChange={(e) => setClaimForm({ ...claimForm, patient: e.target.value })}
              options={[{ value: '', label: 'Select Patient' }, ...patients.map((pt) => ({ value: pt.id, label: pt.user_profile?.full_name }))]}
              required
            />
            <Select
              label="Linked Hospital Invoice"
              value={claimForm.invoice}
              onChange={(e) => {
                const inv = invoices.find((i) => i.id === e.target.value);
                setClaimForm({ ...claimForm, invoice: e.target.value, claim_amount: inv?.total_amount || '' });
              }}
              options={[{ value: '', label: 'Select Invoice' }, ...invoices.map((inv) => ({ value: inv.id, label: `${inv.invoice_number} (₹${inv.total_amount})` }))]}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="TPA / Insurer"
              value={claimForm.provider}
              onChange={(e) => setClaimForm({ ...claimForm, provider: e.target.value, corporate_customer: '' })}
              options={[{ value: '', label: 'None' }, ...providers.map((p) => ({ value: p.id, label: p.name }))]}
            />
            <Select
              label="Corporate Client"
              value={claimForm.corporate_customer}
              onChange={(e) => setClaimForm({ ...claimForm, corporate_customer: e.target.value, provider: '' })}
              options={[{ value: '', label: 'None' }, ...corporates.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Policy #" value={claimForm.policy_number} onChange={(e) => setClaimForm({ ...claimForm, policy_number: e.target.value })} required />
            <Input label="Claim Amount (₹)" type="number" value={claimForm.claim_amount} onChange={(e) => setClaimForm({ ...claimForm, claim_amount: e.target.value })} required />
          </div>
          <button type="submit" className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-xs">
            Save Claim Docket
          </button>
        </form>
      </Modal>

      {/* MODAL 8: ADJUDICATE CLAIM */}
      <Modal isOpen={isClaimAdjOpen} onClose={() => setIsClaimAdjOpen(false)} title={`Adjudicate Claim: ${selectedClaim?.claim_number}`}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedClaim) return;
            try {
              setLoading(true);
              await billingFinanceService.adjudicateClaim(selectedClaim.id, claimAdjForm);
              setSuccessMsg('Claim adjudication recorded.');
              setIsClaimAdjOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Select
            label="Decision"
            value={claimAdjForm.decision}
            onChange={(e) => setClaimAdjForm({ ...claimAdjForm, decision: e.target.value })}
            options={[
              { value: 'APPROVED', label: 'Approved' },
              { value: 'PARTIALLY_APPROVED', label: 'Partially Approved' },
              { value: 'REJECTED', label: 'Rejected' }
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Approved Amount (₹)" type="number" value={claimAdjForm.approved_amount} onChange={(e) => setClaimAdjForm({ ...claimAdjForm, approved_amount: e.target.value })} required />
            <Input label="Disallowed Deductions (₹)" type="number" value={claimAdjForm.disallowed_amount} onChange={(e) => setClaimAdjForm({ ...claimAdjForm, disallowed_amount: e.target.value })} />
          </div>
          <Input label="Patient Co-Payment (₹)" type="number" value={claimAdjForm.patient_copay_amount} onChange={(e) => setClaimAdjForm({ ...claimAdjForm, patient_copay_amount: e.target.value })} />
          <Input label="Rejection Reason" value={claimAdjForm.rejection_reason} onChange={(e) => setClaimAdjForm({ ...claimAdjForm, rejection_reason: e.target.value })} />
          <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs">
            Save Decision & Update Balances
          </button>
        </form>
      </Modal>

      {/* MODAL 9: ATTACH CLAIM DOCUMENT */}
      <Modal isOpen={isDocModalOpen} onClose={() => setIsDocModalOpen(false)} title="Attach Claim Document">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.uploadClaimDocument(docForm);
              setSuccessMsg('Document attached.');
              setIsDocModalOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Select
            label="Target Claim"
            value={docForm.claim}
            onChange={(e) => setDocForm({ ...docForm, claim: e.target.value })}
            options={[{ value: '', label: 'Select Claim' }, ...claims.map((c) => ({ value: c.id, label: `${c.claim_number} - ${c.patient_name}` }))]}
            required
          />
          <Select
            label="Document Type"
            value={docForm.document_type}
            onChange={(e) => setDocForm({ ...docForm, document_type: e.target.value })}
            options={[
              { value: 'POLICY_CARD', label: 'Insurance Card' },
              { value: 'GOVT_ID', label: 'Government ID' },
              { value: 'PRE_AUTH_FORM', label: 'Pre-Auth Form' },
              { value: 'DISCHARGE_SUMMARY', label: 'Discharge Summary' },
              { value: 'ITEMIZED_BILL', label: 'Itemized Bill' },
              { value: 'DIAGNOSTIC_REPORT', label: 'Diagnostic Report' },
              { value: 'PHARMACY_PRESCRIPTION', label: 'Pharmacy Prescription' }
            ]}
          />
          <Input label="Document Name" value={docForm.document_name} onChange={(e) => setDocForm({ ...docForm, document_name: e.target.value })} required />
          <Input label="File URL / Storage Link" value={docForm.file_url} onChange={(e) => setDocForm({ ...docForm, file_url: e.target.value })} />
          <button type="submit" className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-xs">
            Upload & Attach
          </button>
        </form>
      </Modal>

      {/* MODAL 10: LOG TPA QUERY */}
      <Modal isOpen={isQueryModalOpen} onClose={() => setIsQueryModalOpen(false)} title="Log TPA Query / Deficiency">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.createClaimQuery(queryForm);
              setSuccessMsg('Query logged.');
              setIsQueryModalOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Select
            label="Target Claim"
            value={queryForm.claim}
            onChange={(e) => setQueryForm({ ...queryForm, claim: e.target.value })}
            options={[{ value: '', label: 'Select Claim' }, ...claims.map((c) => ({ value: c.id, label: `${c.claim_number} - ${c.patient_name}` }))]}
            required
          />
          <Select
            label="Query Type"
            value={queryForm.query_type}
            onChange={(e) => setQueryForm({ ...queryForm, query_type: e.target.value })}
            options={[
              { value: 'MEDICAL_NECESSITY', label: 'Medical Necessity Query' },
              { value: 'BILLING_QUERY', label: 'Billing / Tariff Disallowance' },
              { value: 'DOCUMENT_DEFICIENCY', label: 'Missing Documents' }
            ]}
          />
          <Input label="Query Text" value={queryForm.query_text} onChange={(e) => setQueryForm({ ...queryForm, query_text: e.target.value })} required />
          <button type="submit" className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold text-xs">
            Log Query
          </button>
        </form>
      </Modal>

      {/* MODAL 11: RESPOND QUERY */}
      <Modal isOpen={isQueryRespOpen} onClose={() => setIsQueryRespOpen(false)} title={`Respond to Query: ${selectedQuery?.query_number}`}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedQuery) return;
            try {
              setLoading(true);
              await billingFinanceService.respondClaimQuery(selectedQuery.id, queryRespForm);
              setSuccessMsg('Response submitted.');
              setIsQueryRespOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Input label="Clinical / Billing Response" value={queryRespForm.response_text} onChange={(e) => setQueryRespForm({ ...queryRespForm, response_text: e.target.value })} required />
          <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs">
            Submit Response & Resubmit Claim
          </button>
        </form>
      </Modal>

      {/* MODAL 12: RECORD SETTLEMENT */}
      <Modal isOpen={isSettlementModalOpen} onClose={() => setIsSettlementModalOpen(false)} title="Record TPA / Bank Settlement">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.recordClaimSettlement(settlementForm);
              setSuccessMsg('Settlement recorded.');
              setIsSettlementModalOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Select
            label="Settled Claim"
            value={settlementForm.claim}
            onChange={(e) => {
              const clm = claims.find((c) => c.id === e.target.value);
              setSettlementForm({ ...settlementForm, claim: e.target.value, amount_settled: clm?.approved_amount || '' });
            }}
            options={[{ value: '', label: 'Select Approved Claim' }, ...claims.map((c) => ({ value: c.id, label: `${c.claim_number} (Approved: ₹${c.approved_amount})` }))]}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Settlement Reference #" value={settlementForm.settlement_reference} onChange={(e) => setSettlementForm({ ...settlementForm, settlement_reference: e.target.value })} required />
            <Input label="Bank UTR #" value={settlementForm.bank_utr} onChange={(e) => setSettlementForm({ ...settlementForm, bank_utr: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount Settled (₹)" type="number" value={settlementForm.amount_settled} onChange={(e) => setSettlementForm({ ...settlementForm, amount_settled: e.target.value })} required />
            <Input label="Disallowed Amount (₹)" type="number" value={settlementForm.disallowed_amount} onChange={(e) => setSettlementForm({ ...settlementForm, disallowed_amount: e.target.value })} />
          </div>
          <Input label="Reconciliation Notes" value={settlementForm.reconciliation_notes} onChange={(e) => setSettlementForm({ ...settlementForm, reconciliation_notes: e.target.value })} />
          <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs">
            Save Settlement
          </button>
        </form>
      </Modal>

      {/* MODAL 13: GENERATE CORPORATE INVOICE */}
      <Modal isOpen={isCorpInvoiceModalOpen} onClose={() => setIsCorpInvoiceModalOpen(false)} title="Generate Corporate Statement">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.createCorporateInvoice({
                ...corpInvoiceForm,
                balance_amount: corpInvoiceForm.total_amount
              });
              setSuccessMsg('Corporate invoice generated.');
              setIsCorpInvoiceModalOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Select
            label="Corporate Partner"
            value={corpInvoiceForm.corporate_customer}
            onChange={(e) => setCorpInvoiceForm({ ...corpInvoiceForm, corporate_customer: e.target.value })}
            options={[{ value: '', label: 'Select Corporate' }, ...corporates.map((c) => ({ value: c.id, label: c.name }))]}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Billing Period Start" type="date" value={corpInvoiceForm.billing_period_start} onChange={(e) => setCorpInvoiceForm({ ...corpInvoiceForm, billing_period_start: e.target.value })} required />
            <Input label="Billing Period End" type="date" value={corpInvoiceForm.billing_period_end} onChange={(e) => setCorpInvoiceForm({ ...corpInvoiceForm, billing_period_end: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Total Amount (₹)" type="number" value={corpInvoiceForm.total_amount} onChange={(e) => setCorpInvoiceForm({ ...corpInvoiceForm, total_amount: e.target.value })} required />
            <Input label="Payment Due Date" type="date" value={corpInvoiceForm.due_date} onChange={(e) => setCorpInvoiceForm({ ...corpInvoiceForm, due_date: e.target.value })} required />
          </div>
          <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-xs">
            Generate Statement
          </button>
        </form>
      </Modal>

      {/* MODAL 14: COLLECT CORPORATE PAYMENT */}
      <Modal isOpen={isCorpPayModalOpen} onClose={() => setIsCorpPayModalOpen(false)} title={`Collect Payment: ${selectedCorpInvoice?.invoice_number}`}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedCorpInvoice) return;
            try {
              setLoading(true);
              await billingFinanceService.recordCorporatePayment(selectedCorpInvoice.id, corpPayForm);
              setSuccessMsg('Payment recorded.');
              setIsCorpPayModalOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Input label="Payment Amount (₹)" type="number" value={corpPayForm.amount} onChange={(e) => setCorpPayForm({ ...corpPayForm, amount: e.target.value })} required />
          <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs">
            Confirm Payment
          </button>
        </form>
      </Modal>
    </div>
  );
};
