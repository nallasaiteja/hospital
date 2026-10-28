import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Plus,
  Search,
  CreditCard,
  FileText,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  TrendingUp,
  Receipt,
  RefreshCw,
  Wallet,
  Building2,
  Tag,
  Package,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Send,
  Eye,
  Check,
  X,
  Lock,
  Trash2
} from 'lucide-react';
import { billingFinanceService, patientService, clinicalService } from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

type TabType =
  | 'dashboard'
  | 'invoices'
  | 'ipd_billing'
  | 'services'
  | 'tariffs'
  | 'packages'
  | 'deposits'
  | 'receipts'
  | 'discounts'
  | 'credit_notes'
  | 'cashier_shifts'
  | 'gateway';

export const BillingPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [packageSubs, setPackageSubs] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isCreateDepositOpen, setIsCreateDepositOpen] = useState(false);
  const [isAllocateDepositOpen, setIsAllocateDepositOpen] = useState(false);
  const [isCreateServiceOpen, setIsCreateServiceOpen] = useState(false);
  const [isCreateTariffOpen, setIsCreateTariffOpen] = useState(false);
  const [isCreatePackageOpen, setIsCreatePackageOpen] = useState(false);
  const [isSubscribePackageOpen, setIsSubscribePackageOpen] = useState(false);
  const [isRequestDiscountOpen, setIsRequestDiscountOpen] = useState(false);
  const [isCreateCreditNoteOpen, setIsCreateCreditNoteOpen] = useState(false);
  const [isCreateRefundOpen, setIsCreateRefundOpen] = useState(false);
  const [isOpenShiftOpen, setIsOpenShiftOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [isGatewayCheckoutOpen, setIsGatewayCheckoutOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [selectedDeposit, setSelectedDeposit] = useState<any | null>(null);
  const [selectedShift, setSelectedShift] = useState<any | null>(null);

  // Forms
  const [invoiceForm, setInvoiceForm] = useState({
    patient_id: '',
    encounter_type: 'OPD',
    tariff_plan_id: '',
    notes: '',
    items: [{ service_id: '', description: '', quantity: 1, unit_price: '0.00', tax_rate: '0.00' }]
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'UPI',
    transaction_reference: ''
  });

  const [depositForm, setDepositForm] = useState({
    patient_id: '',
    amount: '',
    payment_method: 'CASH',
    transaction_reference: '',
    notes: ''
  });

  const [allocDepositForm, setAllocDepositForm] = useState({
    invoice_id: '',
    amount: ''
  });

  const [serviceForm, setServiceForm] = useState({
    service_code: '',
    name: '',
    category: 'OPD_CONSULTATION',
    standard_price: '',
    tax_rate: '0.00',
    description: ''
  });

  const [tariffForm, setTariffForm] = useState({
    code: '',
    name: '',
    tariff_type: 'STANDARD'
  });

  const [packageForm, setPackageForm] = useState({
    package_code: '',
    name: '',
    total_price: '',
    validity_days: 30,
    description: ''
  });

  const [subPackageForm, setSubPackageForm] = useState({
    patient_id: '',
    package_id: ''
  });

  const [discountForm, setDiscountForm] = useState({
    invoice_id: '',
    discount_type: 'FIXED_AMOUNT',
    discount_value: '',
    reason: ''
  });

  const [creditNoteForm, setCreditNoteForm] = useState({
    invoice_id: '',
    amount: '',
    reason: ''
  });

  const [refundForm, setRefundForm] = useState({
    invoice_id: '',
    refund_amount: '',
    refund_method: 'CASH',
    reason: ''
  });

  const [openShiftForm, setOpenShiftForm] = useState({
    opening_cash: '1000.00'
  });

  const [closeShiftForm, setCloseShiftForm] = useState({
    closing_cash_counted: '',
    reconciliation_notes: ''
  });

  const [gatewayCheckoutData, setGatewayCheckoutData] = useState<any>(null);
  const [gatewaySubmitting, setGatewaySubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [stats, invs, svcs, trfs, pkgs, deps, rcpts, discs, cns, rfs, sfts, stls, pts, adms] = await Promise.all([
        billingFinanceService.getDashboardStats().catch(() => null),
        billingFinanceService.getInvoices({ branch_id: currentBranch?.id }).catch(() => []),
        billingFinanceService.getServices().catch(() => []),
        billingFinanceService.getTariffs().catch(() => []),
        billingFinanceService.getPackages().catch(() => []),
        billingFinanceService.getDeposits().catch(() => []),
        billingFinanceService.getReceipts().catch(() => []),
        billingFinanceService.getDiscounts().catch(() => []),
        billingFinanceService.getCreditNotes().catch(() => []),
        billingFinanceService.getRefunds().catch(() => []),
        billingFinanceService.getCashierShifts().catch(() => []),
        billingFinanceService.getGatewaySettlements().catch(() => []),
        patientService.getPatients().then((r: any) => r?.results || r || []).catch(() => []),
        clinicalService.getAdmissions ? clinicalService.getAdmissions().catch(() => []) : Promise.resolve([])
      ]);

      setDashboardStats(stats);
      setInvoices(invs || []);
      setServices(svcs || []);
      setTariffs(trfs || []);
      setPackages(pkgs || []);
      setDeposits(deps || []);
      setReceipts(rcpts || []);
      setDiscounts(discs || []);
      setCreditNotes(cns || []);
      setRefunds(rfs || []);
      setShifts(sfts || []);
      setSettlements(stls || []);
      setPatients(pts || []);
      setAdmissions(adms || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranch]);

  // Line item manipulation handlers
  const handleAddItem = () => {
    setInvoiceForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { service_id: '', description: '', quantity: 1, unit_price: '0.00', tax_rate: '0.00' }
      ]
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (invoiceForm.items.length <= 1) return;
    setInvoiceForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...invoiceForm.items];
    if (field === 'service_id') {
      const selectedSvc = services.find(s => s.id === value);
      updated[index] = {
        ...updated[index],
        service_id: value,
        description: selectedSvc ? selectedSvc.name : updated[index].description,
        unit_price: selectedSvc ? String(selectedSvc.standard_price) : updated[index].unit_price,
        tax_rate: selectedSvc ? String(selectedSvc.tax_rate || '0.00') : '0.00'
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setInvoiceForm(prev => ({ ...prev, items: updated }));
  };

  // Handle invoice submission
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.patient_id) {
      setError('Please select a patient.');
      return;
    }
    try {
      setLoading(true);
      await billingFinanceService.createInvoice({
        ...invoiceForm,
        branch_id: currentBranch?.id
      });
      setSuccessMsg('Invoice generated successfully.');
      setIsCreateInvoiceOpen(false);
      setInvoiceForm({
        patient_id: '',
        encounter_type: 'OPD',
        tariff_plan_id: '',
        notes: '',
        items: [{ service_id: '', description: '', quantity: 1, unit_price: '0.00', tax_rate: '0.00' }]
      });
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Open Cashier Shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await billingFinanceService.openCashierShift({
        opening_cash: openShiftForm.opening_cash
      });
      setSuccessMsg('Cashier shift opened successfully.');
      setIsOpenShiftOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  // Handle IPD Bill Generation
  const handleGenerateIPDBill = async (admissionId: string, isFinal: boolean) => {
    try {
      setLoading(true);
      const inv = await billingFinanceService.generateInpatientBill({
        admission_id: admissionId,
        is_final: isFinal
      });
      setSuccessMsg(`Generated ${isFinal ? 'Final Discharge' : 'Interim'} Bill ${inv.invoice_number}.`);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  // Handle record payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      setLoading(true);
      await billingFinanceService.recordPayment({
        invoice_id: selectedInvoice.id,
        ...paymentForm
      });
      setSuccessMsg(`Payment of ₹${paymentForm.amount} recorded for ${selectedInvoice.invoice_number}.`);
      setIsRecordPaymentOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger Online Gateway / Razorpay order
  const handleInitiateGatewayOrder = async (inv: any) => {
    try {
      setGatewaySubmitting(true);
      const res = await billingFinanceService.createGatewayOrder({
        invoice_id: inv.id
      });
      setGatewayCheckoutData(res);
      setSelectedInvoice(inv);
      setIsGatewayCheckoutOpen(true);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setGatewaySubmitting(false);
    }
  };

  // Verify Gateway Payment (Sandbox / Live)
  const handleVerifyGatewayPayment = async () => {
    if (!gatewayCheckoutData) return;
    try {
      setGatewaySubmitting(true);
      const paymentGatewayTransactionId = `pay_gateway_${Date.now()}`;
      await billingFinanceService.verifyGatewayPayment({
        razorpay_order_id: gatewayCheckoutData.order_id,
        razorpay_payment_id: paymentGatewayTransactionId,
        razorpay_signature: 'sandbox_test_verified_signature'
      });
      setSuccessMsg(`Gateway payment of ₹${gatewayCheckoutData.amount} verified and settled!`);
      setIsGatewayCheckoutOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setGatewaySubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-400" />
            Billing & Payment Gateway Management
          </h1>
          <p className="text-sm text-slate-400">
            Section 11: Centralized Hospital Invoicing, Service Tariffs, Deposits, Shifts & Online Gateway.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpenShiftOpen(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Clock className="w-4 h-4" /> Open Shift
          </button>
          <button
            onClick={() => setIsCreateDepositOpen(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Wallet className="w-4 h-4" /> Collect Deposit
          </button>
          <button
            onClick={() => setIsCreateInvoiceOpen(true)}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Bill
          </button>
          <button
            onClick={loadData}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh Datasets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-800 gap-1 text-sm font-medium">
        {[
          { key: 'dashboard', label: 'Overview', icon: TrendingUp },
          { key: 'invoices', label: 'Bills & Invoices', icon: FileText },
          { key: 'ipd_billing', label: 'IPD Discharge Billing', icon: Building2 },
          { key: 'services', label: 'Service Catalogue', icon: Tag },
          { key: 'tariffs', label: 'Tariff Plans', icon: Layers },
          { key: 'packages', label: 'Care Bundles', icon: Package },
          { key: 'deposits', label: 'Advance Deposits', icon: Wallet },
          { key: 'receipts', label: 'Official Receipts', icon: Receipt },
          { key: 'discounts', label: 'Discounts & Approvals', icon: ShieldCheck },
          { key: 'credit_notes', label: 'Credit Notes & Refunds', icon: ArrowDownLeft },
          { key: 'cashier_shifts', label: 'Cashier Shifts', icon: Clock },
          { key: 'gateway', label: 'Gateway & Settlements', icon: CreditCard }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-cyan-400 text-cyan-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gross Billed</span>
              <p className="text-2xl font-bold text-white mt-1">₹{dashboardStats?.total_billed || '0.00'}</p>
              <span className="text-xs text-slate-500">Total hospital patient billings</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Collected</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">₹{dashboardStats?.total_collected || '0.00'}</p>
              <span className="text-xs text-slate-500">Cleared through cash, cards, UPI & gateway</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Dues</span>
              <p className="text-2xl font-bold text-amber-400 mt-1">₹{dashboardStats?.total_outstanding || '0.00'}</p>
              <span className="text-xs text-slate-500">Unsettled patient balances</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Deposits</span>
              <p className="text-2xl font-bold text-cyan-400 mt-1">₹{dashboardStats?.total_deposits_available || '0.00'}</p>
              <span className="text-xs text-slate-500">Advance balances ready for bill allocation</span>
            </div>
          </div>

          {/* Departmental Revenue Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-base font-semibold text-white mb-4">Revenue Breakdown by Clinical Care Stream</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {dashboardStats?.revenue_by_category &&
                Object.entries(dashboardStats.revenue_by_category).map(([cat, val]: any) => (
                  <div key={cat} className="p-3 bg-slate-800/40 border border-slate-800 rounded-lg">
                    <span className="text-xs text-slate-400 uppercase font-mono">{cat.replace('_', ' ')}</span>
                    <p className="text-lg font-bold text-cyan-300 mt-0.5">₹{val}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVOICES */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Invoice #, Patient Name, MRN..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300"
              >
                <option value="ALL">All Statuses</option>
                <option value="ISSUED">Outstanding (Issued)</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Patient / MRN</th>
                  <th className="p-3">Care Stream</th>
                  <th className="p-3">Total Amount</th>
                  <th className="p-3">Paid</th>
                  <th className="p-3">Outstanding</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {invoices
                  .filter(inv => {
                    if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
                    if (searchTerm) {
                      const q = searchTerm.toLowerCase();
                      return (
                        inv.invoice_number?.toLowerCase().includes(q) ||
                        inv.patient_name?.toLowerCase().includes(q) ||
                        inv.patient_mrn?.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-cyan-400">{inv.invoice_number}</td>
                      <td className="p-3">
                        <div className="font-semibold text-white">{inv.patient_name}</div>
                        <div className="text-xs font-mono text-slate-400">{inv.patient_mrn}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant="neutral">{inv.encounter_type}</Badge>
                      </td>
                      <td className="p-3 font-mono text-white">₹{inv.total_amount}</td>
                      <td className="p-3 font-mono text-emerald-400">₹{inv.paid_amount}</td>
                      <td className="p-3 font-mono text-rose-400 font-bold">₹{inv.balance_amount}</td>
                      <td className="p-3">
                        <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIALLY_PAID' ? 'warning' : 'neutral'}>
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        {inv.balance_amount !== '0.00' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setPaymentForm({ amount: inv.balance_amount, payment_method: 'UPI', transaction_reference: '' });
                                setIsRecordPaymentOpen(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/40 rounded text-xs font-semibold"
                            >
                              Collect
                            </button>
                            <button
                              onClick={() => handleInitiateGatewayOrder(inv)}
                              className="px-2.5 py-1 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/40 rounded text-xs font-semibold"
                            >
                              Razorpay
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setDiscountForm({ invoice_id: inv.id, discount_type: 'FIXED_AMOUNT', discount_value: '', reason: '' });
                            setIsRequestDiscountOpen(true);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                          title="Request Discount"
                        >
                          Discount
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: IPD DISCHARGE BILLING */}
      {activeTab === 'ipd_billing' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-base font-semibold text-white mb-2">Inpatient (IPD) Active Admissions & Discharge Settlements</h3>
            <p className="text-xs text-slate-400 mb-4">
              Select an admitted inpatient to aggregate bed stay daily rates, unbilled lab investigations, pharmacy counter dispenses, and auto-apply advance deposits.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {admissions.map(adm => (
                <div key={adm.id} className="p-4 bg-slate-800/40 border border-slate-700 rounded-lg space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs text-cyan-400 font-bold">{adm.admission_number}</span>
                      <h4 className="font-semibold text-white">{adm.patient_name || adm.patient?.user_profile?.full_name}</h4>
                    </div>
                    <Badge variant="neutral">{adm.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Bed: {adm.bed_number || adm.bed?.bed_number || 'Assigned'} | Ward: {adm.ward_name || adm.bed?.ward?.name}
                  </p>
                  <div className="pt-2 flex gap-2 border-t border-slate-700">
                    <button
                      onClick={() => handleGenerateIPDBill(adm.id, false)}
                      className="flex-1 py-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 rounded text-xs font-semibold"
                    >
                      Interim Bill
                    </button>
                    <button
                      onClick={() => handleGenerateIPDBill(adm.id, true)}
                      className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                    >
                      Final Settlement
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SERVICE CATALOGUE */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Hospital Master Service Catalogue</h3>
            <button
              onClick={() => setIsCreateServiceOpen(true)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Service
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Service Code</th>
                  <th className="p-3">Service Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Standard Tariff</th>
                  <th className="p-3">Tax Rate</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {services.map(svc => (
                  <tr key={svc.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-400 font-bold">{svc.service_code}</td>
                    <td className="p-3 font-semibold text-white">{svc.name}</td>
                    <td className="p-3">
                      <Badge variant="neutral">{svc.category}</Badge>
                    </td>
                    <td className="p-3 font-mono text-white">₹{svc.standard_price}</td>
                    <td className="p-3 font-mono text-slate-400">{svc.tax_rate}%</td>
                    <td className="p-3">
                      <Badge variant={svc.is_active ? 'success' : 'neutral'}>{svc.is_active ? 'ACTIVE' : 'INACTIVE'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: TARIFFS */}
      {activeTab === 'tariffs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Price Lists & Multi-Tier Tariffs</h3>
            <button
              onClick={() => setIsCreateTariffOpen(true)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Tariff Plan
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tariffs.map(trf => (
              <div key={trf.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs text-cyan-400 font-bold">{trf.code}</span>
                  <Badge variant="neutral">{trf.tariff_type}</Badge>
                </div>
                <h4 className="font-semibold text-white">{trf.name}</h4>
                <p className="text-xs text-slate-400">Rate Overrides: {trf.rates?.length || 0} active service tariffs</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: PACKAGES */}
      {activeTab === 'packages' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Hospital Care Packages & Care Bundles</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setIsSubscribePackageOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Assign to Patient
              </button>
              <button
                onClick={() => setIsCreatePackageOpen(true)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> New Package
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map(pkg => (
              <div key={pkg.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs text-cyan-400 font-bold">{pkg.package_code}</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">₹{pkg.total_price}</span>
                </div>
                <h4 className="font-semibold text-white">{pkg.name}</h4>
                <p className="text-xs text-slate-400">{pkg.description || 'All-inclusive care package'}</p>
                <div className="pt-2 text-xs text-slate-500 border-t border-slate-800">
                  Included components: {pkg.components?.length || 0} services
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: ADVANCE DEPOSITS */}
      {activeTab === 'deposits' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Patient Advance Deposits Ledger</h3>
            <button
              onClick={() => setIsCreateDepositOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Collect Deposit
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Receipt #</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Deposit Amount</th>
                  <th className="p-3">Available Balance</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {deposits.map(dep => (
                  <tr key={dep.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-400 font-bold">{dep.receipt_number}</td>
                    <td className="p-3 font-semibold text-white">{dep.patient_name}</td>
                    <td className="p-3 font-mono text-white">₹{dep.amount}</td>
                    <td className="p-3 font-mono text-cyan-400 font-bold">₹{dep.available_balance}</td>
                    <td className="p-3">{dep.payment_method}</td>
                    <td className="p-3">
                      <Badge variant={dep.status === 'AVAILABLE' ? 'success' : dep.status === 'PARTIALLY_UTILIZED' ? 'warning' : 'neutral'}>
                        {dep.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {dep.available_balance !== '0.00' && (
                        <button
                          onClick={() => {
                            setSelectedDeposit(dep);
                            setAllocDepositForm({ invoice_id: '', amount: dep.available_balance });
                            setIsAllocateDepositOpen(true);
                          }}
                          className="px-2.5 py-1 bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-600/40 rounded text-xs font-semibold"
                        >
                          Allocate to Bill
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

      {/* TAB 8: RECEIPTS */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Official Payment Receipts Issued</h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Receipt #</th>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Amount Paid</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Balance After</th>
                  <th className="p-3">Cashier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {receipts.map(rcp => (
                  <tr key={rcp.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-400 font-bold">{rcp.receipt_number}</td>
                    <td className="p-3 font-mono text-white">{rcp.invoice_number}</td>
                    <td className="p-3">{rcp.patient_name}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">₹{rcp.amount_paid}</td>
                    <td className="p-3">{rcp.payment_method}</td>
                    <td className="p-3 font-mono text-slate-400">₹{rcp.balance_after_payment}</td>
                    <td className="p-3 font-mono text-xs">{rcp.cashier_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 9: DISCOUNTS */}
      {activeTab === 'discounts' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white">Discount Authorizations & Separation of Duties</h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="p-3">Request #</th>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Concession Amount</th>
                  <th className="p-3">Requested By</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {discounts.map(disc => (
                  <tr key={disc.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-400 font-bold">{disc.request_number}</td>
                    <td className="p-3 font-mono text-white">{disc.invoice_number}</td>
                    <td className="p-3">{disc.discount_type}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">₹{disc.calculated_amount}</td>
                    <td className="p-3 text-xs">{disc.requested_by_name}</td>
                    <td className="p-3">
                      <Badge variant={disc.status === 'APPROVED' ? 'success' : disc.status === 'REJECTED' ? 'neutral' : 'warning'}>
                        {disc.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {disc.status === 'PENDING' && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                await billingFinanceService.approveDiscount(disc.id);
                                setSuccessMsg('Discount approved.');
                                loadData();
                              } catch (err: any) {
                                setError(parseApiError(err).message);
                              }
                            }}
                            className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-semibold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await billingFinanceService.rejectDiscount(disc.id);
                                setSuccessMsg('Discount rejected.');
                                loadData();
                              } catch (err: any) {
                                setError(parseApiError(err).message);
                              }
                            }}
                            className="px-2 py-1 bg-rose-600 text-white rounded text-xs font-semibold"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 10: CASHIER SHIFTS */}
      {activeTab === 'cashier_shifts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-white">Cashier Shift Management & Cash Reconciliation</h3>
            <button
              onClick={() => setIsOpenShiftOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" /> Open Shift
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shifts.map(sft => (
              <div key={sft.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-mono text-xs text-cyan-400 font-bold">{sft.shift_number}</span>
                  <Badge variant={sft.status === 'RECONCILED' ? 'success' : sft.status === 'OPEN' ? 'warning' : 'neutral'}>
                    {sft.status}
                  </Badge>
                </div>
                <h4 className="font-semibold text-white">{sft.cashier_name}</h4>
                <div className="text-xs text-slate-400 space-y-1">
                  <div>Opening Cash: ₹{sft.opening_cash}</div>
                  <div>Cash Collected: ₹{sft.total_cash_collected}</div>
                  <div>UPI Collections: ₹{sft.total_upi_collected}</div>
                  <div>Card Collections: ₹{sft.total_card_collected}</div>
                  <div>Expected Cash: ₹{sft.expected_cash}</div>
                  {sft.status !== 'OPEN' && (
                    <div className="font-bold text-white">Counted Cash: ₹{sft.closing_cash_counted}</div>
                  )}
                  {sft.status !== 'OPEN' && (
                    <div className={`font-mono font-bold ${parseFloat(sft.cash_variance || '0') === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      Variance: ₹{sft.cash_variance}
                    </div>
                  )}
                </div>
                {sft.status === 'OPEN' && (
                  <button
                    onClick={() => {
                      setSelectedShift(sft);
                      setCloseShiftForm({ closing_cash_counted: '', reconciliation_notes: '' });
                      setIsCloseShiftOpen(true);
                    }}
                    className="w-full mt-2 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold transition-colors"
                  >
                    Close Shift & Reconcile
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 11: GATEWAY & SETTLEMENTS */}
      {activeTab === 'gateway' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-base font-semibold text-white mb-2">Razorpay Online Gateway Integration Status</h3>
            <p className="text-xs text-slate-400 mb-4">
              Cryptographically verified checkout flow via HMAC-SHA256 signatures, server-calculated amounts, signed raw webhooks, and gateway settlement reports.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-800/40 border border-slate-700 rounded-lg">
                <span className="text-xs text-slate-400 uppercase">Gateway Mode</span>
                <p className="text-base font-bold text-emerald-400">Sandbox / Live Ready</p>
              </div>
              <div className="p-3 bg-slate-800/40 border border-slate-700 rounded-lg">
                <span className="text-xs text-slate-400 uppercase">Signature Verification</span>
                <p className="text-base font-bold text-cyan-400">HMAC-SHA256 Active</p>
              </div>
              <div className="p-3 bg-slate-800/40 border border-slate-700 rounded-lg">
                <span className="text-xs text-slate-400 uppercase">Webhook Idempotency</span>
                <p className="text-base font-bold text-indigo-400">Deduplication Active</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GENERATE NEW BILL */}
      <Modal
        isOpen={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
        title="Generate New Patient Bill / Central Invoice"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Select Patient *"
              value={invoiceForm.patient_id}
              onChange={e => setInvoiceForm({ ...invoiceForm, patient_id: e.target.value })}
              options={[
                { label: 'Select Patient', value: '' },
                ...patients.map(p => ({
                  label: `${p.user_profile?.first_name || ''} ${p.user_profile?.last_name || ''} (${p.medical_record_number || 'No MRN'})`,
                  value: p.id
                }))
              ]}
              required
            />
            <Select
              label="Care Stream / Encounter Type *"
              value={invoiceForm.encounter_type}
              onChange={e => setInvoiceForm({ ...invoiceForm, encounter_type: e.target.value })}
              options={[
                { label: 'OPD Consultation', value: 'OPD' },
                { label: 'Inpatient (IPD)', value: 'IPD' },
                { label: 'Emergency & Casualty', value: 'EMERGENCY' },
                { label: 'Laboratory Diagnostics', value: 'LAB' },
                { label: 'Pharmacy Dispensary', value: 'PHARMACY' },
                { label: 'General Hospital Service', value: 'GENERAL' },
              ]}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Tariff Pricing Plan"
              value={invoiceForm.tariff_plan_id}
              onChange={e => setInvoiceForm({ ...invoiceForm, tariff_plan_id: e.target.value })}
              options={[
                { label: 'Standard Hospital General Tariff', value: '' },
                ...tariffs.map(t => ({ label: `${t.name} (${t.code})`, value: t.id }))
              ]}
            />
            <Input
              label="Clinical / Billing Remarks"
              value={invoiceForm.notes}
              onChange={e => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
              placeholder="e.g. Follow-up consultation & routine lab tests"
            />
          </div>

          {/* Line Items */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Bill Charge Items ({invoiceForm.items.length})
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded text-xs font-semibold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Service Item
              </button>
            </div>

            <div className="space-y-2">
              {invoiceForm.items.map((item, idx) => {
                const lineTotal = (Number(item.quantity) || 1) * (parseFloat(item.unit_price) || 0);
                return (
                  <div key={idx} className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-5">
                        <label className="text-[10px] text-slate-400 font-medium block mb-1">Service / Procedure</label>
                        <select
                          value={item.service_id}
                          onChange={e => handleItemChange(idx, 'service_id', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                        >
                          <option value="">Custom Service Item</option>
                          {services.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} (₹{s.standard_price})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-4">
                        <label className="text-[10px] text-slate-400 font-medium block mb-1">Item Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => handleItemChange(idx, 'description', e.target.value)}
                          placeholder="Description"
                          required
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="text-[10px] text-slate-400 font-medium block mb-1">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-center outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-center justify-between gap-1">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 font-medium block mb-1">Rate (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={e => handleItemChange(idx, 'unit_price', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-right outline-none focus:border-cyan-500"
                          />
                        </div>
                        {invoiceForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 mt-4 text-slate-500 hover:text-rose-400 transition"
                            title="Remove line item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400 font-mono">
                      Line Total: <strong className="text-cyan-300">₹{lineTotal.toFixed(2)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Box */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-sm">
            <span className="text-slate-400 font-medium">Estimated Bill Total:</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">
              ₹{invoiceForm.items.reduce((sum, it) => sum + (Number(it.quantity) || 1) * (parseFloat(it.unit_price) || 0), 0).toFixed(2)}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateInvoiceOpen(false)}
              className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs transition shadow-md shadow-cyan-600/20"
            >
              {loading ? 'Generating Bill...' : 'Create & Issue Bill'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: OPEN CASHIER SHIFT */}
      <Modal
        isOpen={isOpenShiftOpen}
        onClose={() => setIsOpenShiftOpen(false)}
        title="Open New Cashier Shift"
      >
        <form onSubmit={handleOpenShift} className="space-y-4">
          <p className="text-xs text-slate-400">
            Start a new cashier drawer shift for today's OPD, IPD, and emergency collections.
          </p>
          <Input
            label="Initial Cash Drawer Float (₹)"
            type="number"
            step="0.01"
            value={openShiftForm.opening_cash}
            onChange={e => setOpenShiftForm({ opening_cash: e.target.value })}
            required
          />
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsOpenShiftOpen(false)}
              className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition"
            >
              {loading ? 'Opening...' : 'Confirm Open Shift'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: COLLECT PAYMENT */}
      <Modal isOpen={isRecordPaymentOpen} onClose={() => setIsRecordPaymentOpen(false)} title={`Collect Payment for ${selectedInvoice?.invoice_number}`}>
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <Input
            label="Payment Amount (₹)"
            type="number"
            value={paymentForm.amount}
            onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            required
          />
          <Select
            label="Payment Method"
            value={paymentForm.payment_method}
            onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
            options={[
              { label: 'UPI / QR Payment', value: 'UPI' },
              { label: 'Cash', value: 'CASH' },
              { label: 'Credit Card', value: 'CREDIT_CARD' },
              { label: 'Debit Card', value: 'DEBIT_CARD' },
              { label: 'Bank Wire Transfer', value: 'BANK_TRANSFER' }
            ]}
          />
          <Input
            label="Transaction Reference (UTR, POS Slip #, Ref ID)"
            value={paymentForm.transaction_reference}
            onChange={e => setPaymentForm({ ...paymentForm, transaction_reference: e.target.value })}
            placeholder="e.g. UPI/12345678/AXIS"
          />
          <button type="submit" disabled={loading} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm">
            {loading ? 'Recording...' : 'Confirm Payment & Issue Receipt'}
          </button>
        </form>
      </Modal>

      {/* MODAL: RAZORPAY CHECKOUT */}
      <Modal isOpen={isGatewayCheckoutOpen} onClose={() => setIsGatewayCheckoutOpen(false)} title="Razorpay Secure Checkout">
        <div className="space-y-4">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Order ID:</span>
              <span className="font-mono text-cyan-400 font-bold">{gatewayCheckoutData?.order_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Invoice:</span>
              <span className="text-white font-semibold">{gatewayCheckoutData?.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Payable Amount:</span>
              <span className="font-mono text-emerald-400 font-bold text-lg">₹{gatewayCheckoutData?.amount}</span>
            </div>
          </div>
          <button
            onClick={handleVerifyGatewayPayment}
            disabled={gatewaySubmitting}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {gatewaySubmitting ? 'Verifying with Razorpay...' : 'Simulate & Verify Secure Razorpay Payment'}
          </button>
        </div>
      </Modal>

      {/* MODAL: COLLECT ADVANCE DEPOSIT */}
      <Modal isOpen={isCreateDepositOpen} onClose={() => setIsCreateDepositOpen(false)} title="Collect Patient Advance Deposit">
        <form
          onSubmit={async e => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.createDeposit(depositForm);
              setSuccessMsg('Advance deposit recorded.');
              setIsCreateDepositOpen(false);
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
            value={depositForm.patient_id}
            onChange={e => setDepositForm({ ...depositForm, patient_id: e.target.value })}
            options={[{ label: 'Select Patient', value: '' }, ...patients.map(p => ({ label: `${p.user_profile?.full_name} (${p.medical_record_number})`, value: p.id }))]}
            required
          />
          <Input
            label="Deposit Amount (₹)"
            type="number"
            value={depositForm.amount}
            onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })}
            required
          />
          <Select
            label="Payment Method"
            value={depositForm.payment_method}
            onChange={e => setDepositForm({ ...depositForm, payment_method: e.target.value })}
            options={[
              { label: 'Cash', value: 'CASH' },
              { label: 'UPI', value: 'UPI' },
              { label: 'Card', value: 'CREDIT_CARD' },
              { label: 'Bank Transfer', value: 'BANK_TRANSFER' }
            ]}
          />
          <button type="submit" disabled={loading} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm">
            {loading ? 'Recording...' : 'Issue Deposit Receipt'}
          </button>
        </form>
      </Modal>

      {/* MODAL: CLOSE SHIFT */}
      <Modal isOpen={isCloseShiftOpen} onClose={() => setIsCloseShiftOpen(false)} title={`Close Shift ${selectedShift?.shift_number}`}>
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!selectedShift) return;
            try {
              setLoading(true);
              await billingFinanceService.closeCashierShift(selectedShift.id, closeShiftForm);
              setSuccessMsg('Shift closed and reconciled.');
              setIsCloseShiftOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <Input
            label="Physical Cash Counted (₹)"
            type="number"
            value={closeShiftForm.closing_cash_counted}
            onChange={e => setCloseShiftForm({ ...closeShiftForm, closing_cash_counted: e.target.value })}
            required
          />
          <Input
            label="Reconciliation Notes (if variance exists)"
            value={closeShiftForm.reconciliation_notes}
            onChange={e => setCloseShiftForm({ ...closeShiftForm, reconciliation_notes: e.target.value })}
          />
          <button type="submit" disabled={loading} className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold text-sm">
            {loading ? 'Reconciling...' : 'Confirm Shift Close & Calculate Variance'}
          </button>
        </form>
      </Modal>

      {/* MODAL: ADD SERVICE */}
      <Modal isOpen={isCreateServiceOpen} onClose={() => setIsCreateServiceOpen(false)} title="Add Hospital Service to Catalogue">
        <form
          onSubmit={async e => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.createService(serviceForm);
              setSuccessMsg(`Service ${serviceForm.name} added to catalog.`);
              setIsCreateServiceOpen(false);
              setServiceForm({
                service_code: '',
                name: '',
                category: 'OPD_CONSULTATION',
                standard_price: '',
                tax_rate: '0.00',
                description: ''
              });
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Service Code"
              value={serviceForm.service_code}
              onChange={e => setServiceForm({ ...serviceForm, service_code: e.target.value })}
              placeholder="e.g. LAB-LIPID"
              required
            />
            <Select
              label="Category"
              value={serviceForm.category}
              onChange={e => setServiceForm({ ...serviceForm, category: e.target.value })}
              options={[
                { label: 'OPD Consultation', value: 'OPD_CONSULTATION' },
                { label: 'IPD Room / Bed', value: 'IPD_ROOM_BED' },
                { label: 'Emergency / Triage', value: 'EMERGENCY_CARE' },
                { label: 'Diagnostics / Laboratory', value: 'DIAGNOSTIC_LAB' },
                { label: 'Radiology / Imaging', value: 'RADIOLOGY_IMAGING' },
                { label: 'OT / Surgery Procedure', value: 'OT_PROCEDURE' },
                { label: 'Pharmacy Medication', value: 'PHARMACY' },
                { label: 'Nursing Care', value: 'NURSING' }
              ]}
            />
          </div>
          <Input
            label="Service Name"
            value={serviceForm.name}
            onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })}
            placeholder="e.g. Comprehensive Lipid Profile"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Standard Rate (₹)"
              type="number"
              step="0.01"
              value={serviceForm.standard_price}
              onChange={e => setServiceForm({ ...serviceForm, standard_price: e.target.value })}
              required
            />
            <Input
              label="GST / Tax Rate (%)"
              type="number"
              step="0.01"
              value={serviceForm.tax_rate}
              onChange={e => setServiceForm({ ...serviceForm, tax_rate: e.target.value })}
            />
          </div>
          <Input
            label="Description / Clinical Indications"
            value={serviceForm.description}
            onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })}
          />
          <button type="submit" disabled={loading} className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-sm">
            {loading ? 'Adding...' : 'Add Service to Master Catalogue'}
          </button>
        </form>
      </Modal>

      {/* MODAL: CREATE TARIFF PLAN */}
      <Modal isOpen={isCreateTariffOpen} onClose={() => setIsCreateTariffOpen(false)} title="Create New Tariff Pricing Plan">
        <form
          onSubmit={async e => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.createTariff(tariffForm);
              setSuccessMsg(`Tariff plan ${tariffForm.name} created.`);
              setIsCreateTariffOpen(false);
              setTariffForm({ code: '', name: '', tariff_type: 'STANDARD' });
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Plan Code"
              value={tariffForm.code}
              onChange={e => setTariffForm({ ...tariffForm, code: e.target.value })}
              placeholder="e.g. TAR-CGHS"
              required
            />
            <Select
              label="Tariff Type"
              value={tariffForm.tariff_type}
              onChange={e => setTariffForm({ ...tariffForm, tariff_type: e.target.value })}
              options={[
                { label: 'Standard Hospital General', value: 'STANDARD' },
                { label: 'Insurance / TPA Emplanelled', value: 'INSURANCE' },
                { label: 'Corporate / PSU Tie-up', value: 'CORPORATE' },
                { label: 'Government / Subsidized Scheme', value: 'SUBSIDIZED' }
              ]}
            />
          </div>
          <Input
            label="Plan Name"
            value={tariffForm.name}
            onChange={e => setTariffForm({ ...tariffForm, name: e.target.value })}
            placeholder="e.g. CGHS Beneficiary Standard Rates"
            required
          />
          <button type="submit" disabled={loading} className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-sm">
            {loading ? 'Creating...' : 'Create Tariff Plan'}
          </button>
        </form>
      </Modal>

      {/* MODAL: CREATE PACKAGE */}
      <Modal isOpen={isCreatePackageOpen} onClose={() => setIsCreatePackageOpen(false)} title="Create Bundled Care Package">
        <form
          onSubmit={async e => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.createPackage(packageForm);
              setSuccessMsg(`Package ${packageForm.name} created.`);
              setIsCreatePackageOpen(false);
              setPackageForm({ package_code: '', name: '', total_price: '', validity_days: 30, description: '' });
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Package Code"
              value={packageForm.package_code}
              onChange={e => setPackageForm({ ...packageForm, package_code: e.target.value })}
              placeholder="e.g. PKG-MATERNITY"
              required
            />
            <Input
              label="Validity (Days)"
              type="number"
              value={packageForm.validity_days}
              onChange={e => setPackageForm({ ...packageForm, validity_days: parseInt(e.target.value) || 30 })}
              required
            />
          </div>
          <Input
            label="Package Name"
            value={packageForm.name}
            onChange={e => setPackageForm({ ...packageForm, name: e.target.value })}
            placeholder="e.g. Comprehensive Maternity Normal Delivery Package"
            required
          />
          <Input
            label="Bundled Price (₹)"
            type="number"
            step="0.01"
            value={packageForm.total_price}
            onChange={e => setPackageForm({ ...packageForm, total_price: e.target.value })}
            required
          />
          <Input
            label="Inclusions / Description"
            value={packageForm.description}
            onChange={e => setPackageForm({ ...packageForm, description: e.target.value })}
          />
          <button type="submit" disabled={loading} className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold text-sm">
            {loading ? 'Creating...' : 'Create Bundled Package'}
          </button>
        </form>
      </Modal>

      {/* MODAL: SUBSCRIBE PATIENT TO PACKAGE */}
      <Modal isOpen={isSubscribePackageOpen} onClose={() => setIsSubscribePackageOpen(false)} title="Enroll Patient in Care Package">
        <form
          onSubmit={async e => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.subscribePackage(subPackageForm);
              setSuccessMsg('Patient enrolled in care package successfully.');
              setIsSubscribePackageOpen(false);
              setSubPackageForm({ patient_id: '', package_id: '' });
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
            label="Select Patient"
            value={subPackageForm.patient_id}
            onChange={e => setSubPackageForm({ ...subPackageForm, patient_id: e.target.value })}
            options={[{ label: 'Select Patient', value: '' }, ...patients.map(p => ({ label: `${p.user_profile?.full_name} (${p.medical_record_number})`, value: p.id }))]}
            required
          />
          <Select
            label="Select Care Package"
            value={subPackageForm.package_id}
            onChange={e => setSubPackageForm({ ...subPackageForm, package_id: e.target.value })}
            options={[{ label: 'Select Package', value: '' }, ...packages.map(pkg => ({ label: `${pkg.name} (₹${parseFloat(pkg.total_price).toLocaleString()})`, value: pkg.id }))]}
            required
          />
          <button type="submit" disabled={loading} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-sm">
            {loading ? 'Enrolling...' : 'Confirm Patient Enrollment'}
          </button>
        </form>
      </Modal>

      {/* MODAL: REQUEST DISCOUNT WAIVER */}
      <Modal isOpen={isRequestDiscountOpen} onClose={() => setIsRequestDiscountOpen(false)} title="Request Bill Discount / Waiver">
        <form
          onSubmit={async e => {
            e.preventDefault();
            try {
              setLoading(true);
              await billingFinanceService.requestDiscount(discountForm);
              setSuccessMsg('Discount request submitted for supervisory approval.');
              setIsRequestDiscountOpen(false);
              setDiscountForm({ invoice_id: '', discount_type: 'FIXED_AMOUNT', discount_value: '', reason: '' });
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
            label="Target Invoice"
            value={discountForm.invoice_id}
            onChange={e => setDiscountForm({ ...discountForm, invoice_id: e.target.value })}
            options={[{ label: 'Select Invoice', value: '' }, ...invoices.map(inv => ({ label: `${inv.invoice_number} - ${inv.patient_name} (₹${parseFloat(inv.net_amount || '0').toLocaleString()})`, value: inv.id }))]}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Discount Type"
              value={discountForm.discount_type}
              onChange={e => setDiscountForm({ ...discountForm, discount_type: e.target.value })}
              options={[
                { label: 'Fixed Amount (₹)', value: 'FIXED_AMOUNT' },
                { label: 'Percentage (%)', value: 'PERCENTAGE' }
              ]}
            />
            <Input
              label="Value"
              type="number"
              step="0.01"
              value={discountForm.discount_value}
              onChange={e => setDiscountForm({ ...discountForm, discount_value: e.target.value })}
              placeholder={discountForm.discount_type === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 500'}
              required
            />
          </div>
          <Input
            label="Justification Reason (Mandatory)"
            value={discountForm.reason}
            onChange={e => setDiscountForm({ ...discountForm, reason: e.target.value })}
            placeholder="e.g. BPL cardholder approved by Medical Superintendent"
            required
          />
          <button type="submit" disabled={loading} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-sm">
            {loading ? 'Submitting...' : 'Submit Discount for Approval'}
          </button>
        </form>
      </Modal>

      {/* MODAL: ALLOCATE DEPOSIT */}
      <Modal isOpen={isAllocateDepositOpen} onClose={() => setIsAllocateDepositOpen(false)} title={`Allocate Deposit ${selectedDeposit?.receipt_number || ''}`}>
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!selectedDeposit) return;
            try {
              setLoading(true);
              await billingFinanceService.allocateDepositToBill(selectedDeposit.id, allocDepositForm);
              setSuccessMsg('Deposit allocated to invoice successfully.');
              setIsAllocateDepositOpen(false);
              loadData();
            } catch (err: any) {
              setError(parseApiError(err).message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-slate-800/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Available Advance Balance:</span>
              <span className="font-mono text-emerald-400 font-bold">₹{parseFloat(selectedDeposit?.amount || '0').toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Patient:</span>
              <span className="text-white font-medium">{selectedDeposit?.patient_name}</span>
            </div>
          </div>
          <Select
            label="Select Invoice to Settle"
            value={allocDepositForm.invoice_id}
            onChange={e => setAllocDepositForm({ ...allocDepositForm, invoice_id: e.target.value })}
            options={[{ label: 'Select Invoice', value: '' }, ...invoices.filter(i => !selectedDeposit?.patient_id || i.patient_id === selectedDeposit.patient_id).map(inv => ({ label: `${inv.invoice_number} (Bal: ₹${parseFloat(inv.net_amount || '0').toLocaleString()})`, value: inv.id }))]}
            required
          />
          <Input
            label="Allocation Amount (₹)"
            type="number"
            step="0.01"
            value={allocDepositForm.amount}
            onChange={e => setAllocDepositForm({ ...allocDepositForm, amount: e.target.value })}
            placeholder={`Max: ${selectedDeposit?.amount || '0.00'}`}
            required
          />
          <button type="submit" disabled={loading} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm">
            {loading ? 'Allocating...' : 'Confirm Allocation to Invoice'}
          </button>
        </form>
      </Modal>
    </div>
  );
};
