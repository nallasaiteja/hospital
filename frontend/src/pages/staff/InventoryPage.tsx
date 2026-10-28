import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Truck,
  History,
  Plus,
  CheckCircle,
  Clock,
  PackageCheck,
  AlertCircle,
  FileCheck,
  FileText,
  DollarSign,
  TrendingUp,
  RotateCw,
  RefreshCw,
  Search,
  Layers,
  ArrowRightLeft,
  ShieldCheck,
  SlidersHorizontal,
  ClipboardList,
  Building2,
  Scale,
  Award,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  CreditCard,
  FileSpreadsheet,
} from 'lucide-react';
import { pharmacyService, procurementService } from '../../services/api';
import { parseApiError } from '../../utils/errorHandler';
import { AlertBanner } from '../../components/common/AlertBanner';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { Input } from '../../components/common/Input';
import { useBranch } from '../../context/BranchContext';

export const InventoryPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<
    | 'suppliers'
    | 'requisitions'
    | 'quotations'
    | 'pos'
    | 'grns'
    | 'invoices'
    | 'returns'
    | 'credit_notes'
    | 'payment_schedules'
    | 'ap_balances'
    | 'vendor_perf'
    | 'movements'
  >('requisitions');

  // Master Data
  const [medicines, setMedicines] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [comparativeStatements, setComparativeStatements] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);
  const [supplierReturns, setSupplierReturns] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [paymentSchedules, setPaymentSchedules] = useState<any[]>([]);
  const [apAgingData, setApAgingData] = useState<any | null>(null);
  const [vendorPerfData, setVendorPerfData] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Supplier Modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supCode, setSupCode] = useState('');
  const [supName, setSupName] = useState('');
  const [supCategory, setSupCategory] = useState('PHARMACEUTICALS');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supGst, setSupGst] = useState('');
  const [supPan, setSupPan] = useState('');
  const [supBank, setSupBank] = useState('');
  const [supAccount, setSupAccount] = useState('');
  const [supIfsc, setSupIfsc] = useState('');
  const [supTerms, setSupTerms] = useState(30);

  // Requisition Modal (5 categories)
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqCategory, setReqCategory] = useState('MEDICINES');
  const [reqDept, setReqDept] = useState('Central Pharmacy');
  const [reqItemName, setReqItemName] = useState('');
  const [reqQty, setReqQty] = useState(50);
  const [reqUrgency, setReqUrgency] = useState('ROUTINE');
  const [reqDeliveryDate, setReqDeliveryDate] = useState('');
  const [reqReason, setReqReason] = useState('');

  // Quotation Modal
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteReqId, setQuoteReqId] = useState('');
  const [quoteSupplierId, setQuoteSupplierId] = useState('');
  const [quoteLeadDays, setQuoteLeadDays] = useState(7);
  const [quoteTotal, setQuoteTotal] = useState('15000.00');
  const [quotePaymentTerms, setQuotePaymentTerms] = useState('Net 30 Days');
  const [quoteItemName, setQuoteItemName] = useState('');
  const [quoteItemQty, setQuoteItemQty] = useState(50);
  const [quoteItemPrice, setQuoteItemPrice] = useState('300.00');

  // Award Modal
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardCSId, setAwardCSId] = useState('');
  const [awardQuoteId, setAwardQuoteId] = useState('');
  const [awardJustification, setAwardJustification] = useState('');

  // PO Creation Modal
  const [showPOModal, setShowPOModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poReqId, setPoReqId] = useState('');
  const [poItemName, setPoItemName] = useState('');
  const [poQuantity, setPoQuantity] = useState(100);
  const [poUnitCost, setPoUnitCost] = useState('15.00');
  const [poDeliveryDate, setPoDeliveryDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );

  // GRN Modal
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [grnPOId, setGrnPOId] = useState('');
  const [grnDeliveryNote, setGrnDeliveryNote] = useState('');
  const [grnBatchNumber, setGrnBatchNumber] = useState('');
  const [grnExpiryDate, setGrnExpiryDate] = useState(
    new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
  );
  const [grnAcceptedQty, setGrnAcceptedQty] = useState(100);
  const [grnRejectedQty, setGrnRejectedQty] = useState(0);
  const [grnRejectReason, setGrnRejectReason] = useState('');

  // Supplier Return Modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [retSupplierId, setRetSupplierId] = useState('');
  const [retMedId, setRetMedId] = useState('');
  const [retBatchId, setRetBatchId] = useState('');
  const [retQty, setRetQty] = useState(10);
  const [retReasonType, setRetReasonType] = useState('DEFECTIVE');
  const [retReasonDetails, setRetReasonDetails] = useState('');

  // Credit Note Apply Modal
  const [showApplyCreditModal, setShowApplyCreditModal] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState<any | null>(null);
  const [targetInvoiceId, setTargetInvoiceId] = useState('');

  // Payment Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedInvoiceId, setSchedInvoiceId] = useState('');
  const [schedAmount, setSchedAmount] = useState('5000.00');
  const [schedDate, setSchedDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const safe = (d: any) => (Array.isArray(d) ? d : d?.results || []);
      const [
        medData,
        supData,
        reqData,
        quoData,
        csData,
        poData,
        grnData,
        invData,
        sretData,
        cnData,
        psData,
        apData,
        perfData,
        movData,
      ] = await Promise.all([
        pharmacyService.getMedicines({ branch_id: currentBranch?.id }),
        procurementService.getSuppliers(),
        procurementService.getRequisitions({ branch_id: currentBranch?.id }),
        procurementService.getQuotations(),
        procurementService.getComparativeStatements(),
        procurementService.getPurchaseOrders({ branch_id: currentBranch?.id }),
        procurementService.getGRNs({ branch_id: currentBranch?.id }),
        procurementService.getSupplierInvoices(),
        procurementService.getSupplierReturns(),
        procurementService.getCreditNotes(),
        procurementService.getPaymentSchedules(),
        procurementService.getOutstandingBalances(),
        procurementService.getVendorPerformance(),
        pharmacyService.getStockMovements({ branch_id: currentBranch?.id }),
      ]);

      setMedicines(safe(medData));
      setSuppliers(safe(supData));
      setRequisitions(safe(reqData));
      setQuotations(safe(quoData));
      setComparativeStatements(safe(csData));
      setPurchaseOrders(safe(poData));
      setGrns(safe(grnData));
      setSupplierInvoices(safe(invData));
      setSupplierReturns(safe(sretData));
      setCreditNotes(safe(cnData));
      setPaymentSchedules(safe(psData));
      setApAgingData(apData);
      setVendorPerfData(perfData?.performance_reports || []);
      setMovements(safe(movData));

      if (supData && supData.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(supData[0].id);
      }
    } catch (err) {
      console.error('Failed to load procurement data:', err);
      setPageError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentBranch?.id]);

  // Actions
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await procurementService.createSupplier({
        code: supCode || undefined,
        name: supName,
        category: supCategory,
        contact_person: supContact,
        phone: supPhone,
        email: supEmail,
        gst_or_tax_id: supGst,
        pan_number: supPan,
        bank_name: supBank,
        bank_account_number: supAccount,
        bank_ifsc: supIfsc,
        payment_terms_days: supTerms,
        is_active: true,
      });
      setShowSupplierModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to create supplier:', err);
    }
  };

  const handleToggleSupplier = async (id: string) => {
    try {
      await procurementService.toggleSupplierStatus(id);
      fetchData();
    } catch (err) {
      console.error('Failed to toggle supplier status:', err);
    }
  };

  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await procurementService.createRequisition({
        procurement_category: reqCategory,
        requesting_department_name: reqDept,
        urgency: reqUrgency,
        requested_delivery_date: reqDeliveryDate || undefined,
        reason: reqReason,
        items: [
          {
            item_name: reqItemName,
            quantity_requested: reqQty,
          },
        ],
      });
      setShowReqModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to create requisition:', err);
    }
  };

  const handleApproveRequisition = async (id: string) => {
    try {
      await procurementService.approveRequisition(id);
      fetchData();
    } catch (err) {
      console.error('Failed to approve requisition:', err);
    }
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await procurementService.createQuotation({
        requisition_id: quoteReqId,
        supplier_id: quoteSupplierId,
        delivery_lead_time_days: quoteLeadDays,
        payment_terms: quotePaymentTerms,
        items: [
          {
            item_name: quoteItemName,
            quantity: quoteItemQty,
            unit_price: quoteItemPrice,
          },
        ],
      });
      setShowQuoteModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to record quotation:', err);
    }
  };

  const handleAwardQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await procurementService.awardComparativeStatement(awardCSId, {
        quotation_id: awardQuoteId,
        selection_justification: awardJustification,
      });
      setShowAwardModal(false);
      fetchData();
    } catch (err: any) {
      setPageError(parseApiError(err).message);
    }
  };

  const handleApprovePO = async (id: string) => {
    try {
      await procurementService.approvePurchaseOrder(id);
      fetchData();
    } catch (err) {
      console.error('Failed to approve PO:', err);
    }
  };

  const handleIssuePO = async (id: string) => {
    try {
      await procurementService.issuePurchaseOrder(id);
      fetchData();
    } catch (err: any) {
      setPageError(parseApiError(err).message);
    }
  };

  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const po = purchaseOrders.find((p) => p.id === grnPOId);
      const firstPoItem = po?.items?.[0];
      await procurementService.createGRN({
        purchase_order_id: grnPOId,
        delivery_challan_number: grnDeliveryNote || `DC-${Date.now().toString().slice(-4)}`,
        items: [
          {
            po_item_id: firstPoItem?.id,
            medicine_id: firstPoItem?.medicine || medicines[0]?.id,
            quantity_received: grnAcceptedQty + grnRejectedQty,
            quantity_accepted: grnAcceptedQty,
            quantity_rejected: grnRejectedQty,
            rejection_reason: grnRejectReason,
            batch_number: grnBatchNumber || `BATCH-${Date.now().toString().slice(-4)}`,
            expiry_date: grnExpiryDate,
            purchase_cost: firstPoItem?.unit_cost || '15.00',
          },
        ],
      });
      setShowGRNModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to record GRN:', err);
    }
  };

  const handleCreateSupplierReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await procurementService.createSupplierReturn({
        supplier_id: retSupplierId,
        reason_type: retReasonType,
        reason_details: retReasonDetails,
        items: [
          {
            batch_id: retBatchId,
            quantity_returned: retQty,
          },
        ],
      });
      setShowReturnModal(false);
      fetchData();
    } catch (err: any) {
      setPageError(parseApiError(err).message);
    }
  };

  const handleApplyCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreditNote || !targetInvoiceId) return;
    try {
      await procurementService.applyCreditNoteToInvoice(selectedCreditNote.id, targetInvoiceId);
      setShowApplyCreditModal(false);
      fetchData();
    } catch (err: any) {
      setPageError(parseApiError(err).message);
    }
  };

  const handleCreatePaymentSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await procurementService.createPaymentSchedule({
        invoice_id: schedInvoiceId,
        scheduled_amount: schedAmount,
        scheduled_date: schedDate,
      });
      setShowScheduleModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to create payment schedule:', err);
    }
  };

  const handleSettleSchedule = async (id: string) => {
    const ref = prompt('Enter bank transaction / settlement reference:', `NEFT-${Date.now().toString().slice(-6)}`);
    if (!ref) return;
    try {
      await procurementService.recordPaymentSettlement(id, ref);
      fetchData();
    } catch (err) {
      console.error('Failed to settle schedule:', err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {pageError && (
        <AlertBanner
          type="error"
          message={pageError}
          onClose={() => setPageError(null)}
          onRetry={fetchData}
        />
      )}
      {actionSuccess && (
        <AlertBanner
          type="success"
          message={actionSuccess}
          onClose={() => setActionSuccess(null)}
        />
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Procurement & Vendor Management (Section 10)
              </h1>
              <p className="text-xs text-slate-400">
                End-to-end supply chain: multi-category requisitions, quotations & comparative statements, PO approvals, GRNs, vendor returns, credit notes, and AP aging.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSupplierModal(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4 text-cyan-400" /> Register Supplier
          </button>
          <button
            onClick={() => setShowReqModal(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4 text-emerald-400" /> New Requisition
          </button>
          <button
            onClick={() => setShowReturnModal(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-4 h-4 text-rose-400" /> Vendor Return
          </button>
          <button
            onClick={fetchData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh Procurement"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Vendors"
          value={suppliers.filter((s) => s.is_active).length.toString()}
          icon={Building2}
          subtitle="Registered qualified suppliers"
        />
        <StatCard
          title="Pending Requisitions"
          value={requisitions.filter((r) => r.status === 'SUBMITTED').length.toString()}
          icon={ClipboardList}
          subtitle="Across all 5 hospital categories"
        />
        <StatCard
          title="Total AP Liabilities"
          value={`₹${apAgingData?.summary?.total_outstanding_payable || '0.00'}`}
          icon={DollarSign}
          subtitle="Verified outstanding payables"
        />
        <StatCard
          title="Active Credit Notes"
          value={creditNotes.filter((c) => c.status === 'APPROVED' || c.status === 'PARTIALLY_UTILIZED').length.toString()}
          icon={CreditCard}
          subtitle="Available supplier credits"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
        {[
          { id: 'suppliers', label: `Vendors (${suppliers.length})`, icon: Building2 },
          { id: 'requisitions', label: `Requisitions (${requisitions.length})`, icon: ClipboardList },
          { id: 'quotations', label: `Quotations & Bids (${quotations.length})`, icon: Scale },
          { id: 'pos', label: `Purchase Orders (${purchaseOrders.length})`, icon: ShoppingBag },
          { id: 'grns', label: `Goods Receipts (${grns.length})`, icon: PackageCheck },
          { id: 'invoices', label: `Invoices (AP) (${supplierInvoices.length})`, icon: FileText },
          { id: 'returns', label: `Vendor Returns (${supplierReturns.length})`, icon: RotateCcw },
          { id: 'credit_notes', label: `Credit Notes (${creditNotes.length})`, icon: CreditCard },
          { id: 'payment_schedules', label: `Payment Schedules (${paymentSchedules.length})`, icon: Calendar },
          { id: 'ap_balances', label: 'AP Aging & Balances', icon: DollarSign },
          { id: 'vendor_perf', label: 'Vendor Performance', icon: Award },
          { id: 'movements', label: 'Audit Movements', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}

      {/* 1. Suppliers Directory */}
      {activeTab === 'suppliers' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                Qualified Supplier & Manufacturer Directory
              </h3>
              <p className="text-xs text-slate-400">
                Maintains vendor credentials, tax IDs (GST/PAN), bank accounts, and active status.
              </p>
            </div>
            <button
              onClick={() => setShowSupplierModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400"
            >
              + Add Supplier
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">Vendor Code</th>
                  <th className="p-3">Business Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Contact Person & Phone</th>
                  <th className="p-3">Tax / GST ID</th>
                  <th className="p-3">Terms</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-400 font-bold">{s.code}</td>
                    <td className="p-3 font-semibold text-white">{s.name}</td>
                    <td className="p-3 text-slate-300">{s.category}</td>
                    <td className="p-3">
                      <div>{s.contact_person}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{s.phone}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-400">{s.gst_or_tax_id || 'N/A'}</td>
                    <td className="p-3 font-mono">{s.payment_terms_days} days</td>
                    <td className="p-3">
                      <Badge variant={s.is_active ? 'success' : 'danger'}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleToggleSupplier(s.id)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded transition ${
                          s.is_active
                            ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        }`}
                      >
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Requisitions (All 5 Categories) */}
      {activeTab === 'requisitions' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-emerald-400" />
                Procurement Requisitions Across 5 Categories
              </h3>
              <p className="text-xs text-slate-400">
                Medicines, Surgical Supplies, Diagnostic Reagents, Equipment, and General Materials.
              </p>
            </div>
            <button
              onClick={() => setShowReqModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400"
            >
              + Create Requisition
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">Req #</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Location / Dept</th>
                  <th className="p-3">Requested Items</th>
                  <th className="p-3">Urgency</th>
                  <th className="p-3">Delivery By</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {requisitions.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-400 font-bold">{r.requisition_number}</td>
                    <td className="p-3 font-semibold text-white">{r.procurement_category}</td>
                    <td className="p-3 text-slate-300">{r.requesting_location}</td>
                    <td className="p-3">
                      {r.items?.map((it: any, i: number) => (
                        <div key={i}>
                          {it.effective_name || it.item_name} ({it.quantity_requested} units)
                        </div>
                      ))}
                    </td>
                    <td className="p-3">
                      <Badge variant={r.urgency === 'STAT_EMERGENCY' ? 'danger' : r.urgency === 'URGENT' ? 'warning' : 'info'}>
                        {r.urgency}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-slate-400">{r.requested_delivery_date || 'Standard'}</td>
                    <td className="p-3">
                      <Badge variant={r.status === 'APPROVED' ? 'success' : r.status === 'CONVERTED_TO_PO' ? 'accent' : 'warning'}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        {r.status === 'SUBMITTED' && (
                          <button
                            onClick={() => handleApproveRequisition(r.id)}
                            className="px-2 py-1 text-xs rounded bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setQuoteReqId(r.id);
                            setShowQuoteModal(true);
                          }}
                          className="px-2 py-1 text-xs rounded bg-slate-800 text-cyan-400 border border-slate-700 hover:bg-slate-700"
                        >
                          + Quote
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Quotations & Comparative Statements */}
      {activeTab === 'quotations' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-purple-400" />
                Comparative Bid Evaluation & Supplier Quotations
              </h3>
              <p className="text-xs text-slate-400">
                Multi-supplier quotations evaluated side-by-side with mandatory justification for non-lowest awards.
              </p>
            </div>
            <button
              onClick={() => setShowQuoteModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-purple-500 text-white font-bold text-xs hover:bg-purple-400"
            >
              + Record Vendor Quote
            </button>
          </div>

          {/* Comparative Statements List */}
          <div className="space-y-4">
            <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider">Active Comparative Statements:</h4>
            {comparativeStatements.map((cs) => (
              <div key={cs.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-purple-400 font-bold text-sm">{cs.statement_number}</span>
                    <span className="text-xs text-slate-400">for Requisition</span>
                    <span className="font-mono text-cyan-400 font-bold text-xs">{cs.requisition_number}</span>
                    <span className="text-xs text-slate-300">({cs.procurement_category})</span>
                  </div>
                  <Badge variant={cs.approval_status === 'APPROVED' ? 'success' : 'warning'}>
                    {cs.approval_status}
                  </Badge>
                </div>

                {/* Side-by-side quotes table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 font-mono bg-slate-900/40">
                      <tr>
                        <th className="p-2">Supplier</th>
                        <th className="p-2">Quote #</th>
                        <th className="p-2">Lead Time</th>
                        <th className="p-2">Payment Terms</th>
                        <th className="p-2">Total Quoted Amount</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 text-right">Award Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {cs.quotations?.map((q: any) => (
                        <tr key={q.id} className="hover:bg-slate-800/30">
                          <td className="p-2 font-semibold text-white">{q.supplier_name}</td>
                          <td className="p-2 text-cyan-400">{q.quotation_number}</td>
                          <td className="p-2 text-slate-300">{q.delivery_lead_time_days} days</td>
                          <td className="p-2 text-slate-300">{q.payment_terms}</td>
                          <td className="p-2 text-emerald-400 font-bold">₹{q.total_amount}</td>
                          <td className="p-2">
                            <Badge variant={q.status === 'ACCEPTED' ? 'success' : q.status === 'REJECTED' ? 'danger' : 'info'}>
                              {q.status}
                            </Badge>
                          </td>
                          <td className="p-2 text-right">
                            {cs.approval_status !== 'APPROVED' && q.status !== 'ACCEPTED' && (
                              <button
                                onClick={() => {
                                  setAwardCSId(cs.id);
                                  setAwardQuoteId(q.id);
                                  setShowAwardModal(true);
                                }}
                                className="px-2.5 py-1 text-xs rounded bg-purple-500 text-white font-bold hover:bg-purple-400"
                              >
                                Select & Award
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {cs.selected_quotation_number && (
                  <div className="p-2.5 bg-emerald-950/30 border border-emerald-600/30 rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <strong className="text-emerald-400">Awarded to:</strong> {cs.selected_supplier_name} (Quote {cs.selected_quotation_number})
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      Justification: <em>{cs.selection_justification}</em>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {comparativeStatements.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-xs">
                No comparative bid statements compiled yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Purchase Orders & Approvals */}
      {activeTab === 'pos' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-cyan-400" />
                Purchase Orders & Lifecycle Management
              </h3>
              <p className="text-xs text-slate-400">
                Approval controls, amendments, and delivery location tracking.
              </p>
            </div>
            <button
              onClick={() => setShowPOModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400"
            >
              + Create Purchase Order
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">PO Number</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Order Date</th>
                  <th className="p-3">Expected Date</th>
                  <th className="p-3">Total Value</th>
                  <th className="p-3">Approval</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-400 font-bold">{po.po_number}</td>
                    <td className="p-3 font-semibold text-white">{po.supplier_name}</td>
                    <td className="p-3 font-mono text-slate-400">{po.order_date}</td>
                    <td className="p-3 font-mono text-slate-400">{po.expected_delivery_date || 'N/A'}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">₹{po.total_amount}</td>
                    <td className="p-3">
                      <Badge variant={po.approval_status === 'APPROVED' ? 'success' : 'warning'}>
                        {po.approval_status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={po.status === 'RECEIVED' ? 'success' : po.status === 'ISSUED' ? 'info' : 'warning'}>
                        {po.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        {po.approval_status !== 'APPROVED' && (
                          <button
                            onClick={() => handleApprovePO(po.id)}
                            className="px-2 py-1 text-xs rounded bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
                          >
                            Approve
                          </button>
                        )}
                        {po.approval_status === 'APPROVED' && po.status !== 'ISSUED' && po.status !== 'RECEIVED' && (
                          <button
                            onClick={() => handleIssuePO(po.id)}
                            className="px-2 py-1 text-xs rounded bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400"
                          >
                            Issue
                          </button>
                        )}
                        {po.status === 'ISSUED' && (
                          <button
                            onClick={() => {
                              setGrnPOId(po.id);
                              setShowGRNModal(true);
                            }}
                            className="px-2 py-1 text-xs rounded bg-purple-500 text-white font-bold hover:bg-purple-400"
                          >
                            Record GRN
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Goods Receipts (GRN) */}
      {activeTab === 'grns' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-400" />
                Goods Receipt Notes (GRN) & Physical Inspection
              </h3>
              <p className="text-xs text-slate-400">
                Only accepted quantities update inventory stock; rejected goods are quarantined with defect logs.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">GRN #</th>
                  <th className="p-3">PO Reference</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Received At</th>
                  <th className="p-3">Accepted vs Rejected</th>
                  <th className="p-3">Ledger Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {grns.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-400 font-bold">{g.grn_number}</td>
                    <td className="p-3 font-mono text-slate-400">{g.po_number || 'Direct'}</td>
                    <td className="p-3 font-semibold text-white">{g.supplier_name}</td>
                    <td className="p-3 font-mono text-slate-400">{g.receipt_date?.split('T')[0]}</td>
                    <td className="p-3">
                      {g.items?.map((it: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 font-mono">
                          <span className="text-emerald-400 font-bold">+{it.quantity_accepted} accepted</span>
                          {it.quantity_rejected > 0 && (
                            <span className="text-rose-400 font-bold">({it.quantity_rejected} rejected)</span>
                          )}
                        </div>
                      ))}
                    </td>
                    <td className="p-3">
                      <Badge variant="success">Stock Ledger Posted</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Invoices (AP) */}
      {activeTab === 'invoices' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            Supplier Invoices & Accounts Payable Integration
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Total Amount</th>
                  <th className="p-3">Paid Amount</th>
                  <th className="p-3">Outstanding</th>
                  <th className="p-3">Due Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {supplierInvoices.map((inv) => {
                  const outstanding = Number(inv.total_amount || 0) - Number(inv.paid_amount || 0);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono text-cyan-400 font-bold">{inv.invoice_number}</td>
                      <td className="p-3 font-semibold text-white">{inv.supplier_name}</td>
                      <td className="p-3 font-mono text-white">₹{inv.total_amount}</td>
                      <td className="p-3 font-mono text-emerald-400">₹{inv.paid_amount}</td>
                      <td className="p-3 font-mono text-rose-400 font-bold">₹{outstanding.toFixed(2)}</td>
                      <td className="p-3 font-mono text-slate-400">{inv.due_date}</td>
                      <td className="p-3">
                        <Badge variant={inv.payment_status === 'PAID' ? 'success' : 'warning'}>
                          {inv.payment_status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        {inv.payment_status !== 'PAID' && (
                          <button
                            onClick={() => {
                              setSchedInvoiceId(inv.id);
                              setSchedAmount(outstanding.toFixed(2));
                              setShowScheduleModal(true);
                            }}
                            className="px-2.5 py-1 text-xs rounded bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400"
                          >
                            Schedule Payment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Vendor Returns */}
      {activeTab === 'returns' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                Supplier Returns & RMA Stock Deductions
              </h3>
              <p className="text-xs text-slate-400">
                Returns defective/expired goods back to vendors, deducting physical inventory and issuing credit notes.
              </p>
            </div>
            <button
              onClick={() => setShowReturnModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-400"
            >
              + Process Return
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">Return #</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Return Date</th>
                  <th className="p-3">Reason Type</th>
                  <th className="p-3">Tracking / Dispatch #</th>
                  <th className="p-3">Total Credit Value</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {supplierReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-rose-400 font-bold">{ret.return_number}</td>
                    <td className="p-3 font-semibold text-white">{ret.supplier_name}</td>
                    <td className="p-3 font-mono text-slate-400">{ret.return_date}</td>
                    <td className="p-3 text-slate-300">{ret.reason_type}</td>
                    <td className="p-3 font-mono text-slate-400">{ret.dispatch_tracking_number}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">₹{ret.total_return_value}</td>
                    <td className="p-3">
                      <Badge variant="accent">{ret.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. Credit Notes */}
      {activeTab === 'credit_notes' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            Supplier Credit Notes (Liability Reductions)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">Credit Note #</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Credit Date</th>
                  <th className="p-3">Total Amount</th>
                  <th className="p-3">Utilized</th>
                  <th className="p-3">Remaining Balance</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {creditNotes.map((cn) => (
                  <tr key={cn.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-400 font-bold">{cn.credit_note_number}</td>
                    <td className="p-3 font-semibold text-white">{cn.supplier_name}</td>
                    <td className="p-3 font-mono text-slate-400">{cn.credit_date}</td>
                    <td className="p-3 font-mono text-white">₹{cn.total_credit_amount}</td>
                    <td className="p-3 font-mono text-slate-400">₹{cn.utilized_amount}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">₹{cn.remaining_balance}</td>
                    <td className="p-3">
                      <Badge variant={cn.status === 'UTILIZED' ? 'neutral' : 'success'}>
                        {cn.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {cn.remaining_balance > 0 && (
                        <button
                          onClick={() => {
                            setSelectedCreditNote(cn);
                            setShowApplyCreditModal(true);
                          }}
                          className="px-2.5 py-1 text-xs rounded bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
                        >
                          Apply to Invoice
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

      {/* 9. Payment Schedules */}
      {activeTab === 'payment_schedules' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            Supplier Installment Payment Schedules
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">Schedule Ref</th>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Scheduled Date</th>
                  <th className="p-3">Installment Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {paymentSchedules.map((ps) => (
                  <tr key={ps.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-cyan-400 font-bold">{ps.schedule_reference}</td>
                    <td className="p-3 font-mono text-slate-300">{ps.invoice_number}</td>
                    <td className="p-3 font-semibold text-white">{ps.supplier_name}</td>
                    <td className="p-3 font-mono text-slate-400">{ps.scheduled_date}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">₹{ps.scheduled_amount}</td>
                    <td className="p-3">
                      <Badge variant={ps.status === 'PAID' ? 'success' : 'warning'}>{ps.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {ps.status !== 'PAID' && (
                        <button
                          onClick={() => handleSettleSchedule(ps.id)}
                          className="px-2.5 py-1 text-xs rounded bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
                        >
                          Record Settlement
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

      {/* 10. Accounts Payable Aging & Balances */}
      {activeTab === 'ap_balances' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400">Total Invoiced</span>
              <div className="text-xl font-bold font-mono text-white mt-1">
                ₹{apAgingData?.summary?.total_invoiced || '0.00'}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400">Total Settled (Paid)</span>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                ₹{apAgingData?.summary?.total_paid || '0.00'}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400">Vendor Credits Available</span>
              <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                ₹{apAgingData?.summary?.total_credits || '0.00'}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-400">Net Outstanding AP Liability</span>
              <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                ₹{apAgingData?.summary?.total_outstanding_payable || '0.00'}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Supplier Accounts Payable Aging Schedule
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                  <tr>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">Terms</th>
                    <th className="p-3">Invoiced</th>
                    <th className="p-3">Credits</th>
                    <th className="p-3">0-30 Days</th>
                    <th className="p-3">31-60 Days</th>
                    <th className="p-3">61-90 Days</th>
                    <th className="p-3">&gt;90 Days</th>
                    <th className="p-3 text-right">Net Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {apAgingData?.suppliers?.map((s: any) => (
                    <tr key={s.supplier_id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-semibold text-white">{s.supplier_name}</td>
                      <td className="p-3 font-mono">{s.payment_terms_days}d</td>
                      <td className="p-3 font-mono">₹{s.total_invoiced}</td>
                      <td className="p-3 font-mono text-cyan-400">₹{s.available_credits}</td>
                      <td className="p-3 font-mono text-slate-300">₹{s.aging?.days_0_30}</td>
                      <td className="p-3 font-mono text-amber-300">₹{s.aging?.days_31_60}</td>
                      <td className="p-3 font-mono text-orange-400">₹{s.aging?.days_61_90}</td>
                      <td className="p-3 font-mono text-rose-400 font-bold">₹{s.aging?.days_over_90}</td>
                      <td className="p-3 font-mono text-rose-400 font-bold text-right">₹{s.net_outstanding}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 11. Vendor Performance Reports */}
      {activeTab === 'vendor_perf' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-400" />
            Vendor Performance, Quality & Delivery Analytics
          </h3>
          <p className="text-xs text-slate-400">
            Fulfillment rate, on-time delivery, rejection rate, and total procurement spend calculated from actual database records.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">Vendor</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Orders</th>
                  <th className="p-3">Total Spend</th>
                  <th className="p-3">Accepted Qty</th>
                  <th className="p-3">Rejected Qty</th>
                  <th className="p-3">Defect Rate</th>
                  <th className="p-3 text-right">On-Time Delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {vendorPerfData.map((vp) => (
                  <tr key={vp.supplier_id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-semibold text-white">{vp.supplier_name}</td>
                    <td className="p-3 text-slate-300">{vp.category}</td>
                    <td className="p-3 font-mono">{vp.total_purchase_orders}</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">₹{vp.total_spend}</td>
                    <td className="p-3 font-mono text-slate-300">{vp.total_accepted_quantity}</td>
                    <td className="p-3 font-mono text-rose-400">{vp.total_rejected_quantity}</td>
                    <td className="p-3 font-mono font-bold">
                      <span className={vp.rejection_defect_rate_pct > 5 ? 'text-rose-400' : 'text-emerald-400'}>
                        {vp.rejection_defect_rate_pct}%
                      </span>
                    </td>
                    <td className="p-3 font-mono text-right font-bold text-cyan-400">
                      {vp.on_time_delivery_rate_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 12. Movements Ledger */}
      {activeTab === 'movements' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            Auditable Physical Inventory Movement Ledger
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Item Name</th>
                  <th className="p-3">Batch Ref</th>
                  <th className="p-3">Movement Type</th>
                  <th className="p-3">Delta</th>
                  <th className="p-3">New Balance</th>
                  <th className="p-3">Reference Doc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-slate-400">{m.created_at?.replace('T', ' ').substring(0, 19)}</td>
                    <td className="p-3 font-bold text-white">{m.item_name}</td>
                    <td className="p-3 text-cyan-400">{m.batch_reference || 'General'}</td>
                    <td className="p-3">
                      <Badge variant={m.quantity_delta > 0 ? 'success' : 'danger'}>{m.movement_type}</Badge>
                    </td>
                    <td className={`p-3 font-bold ${m.quantity_delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                    </td>
                    <td className="p-3 text-white font-bold">{m.new_stock}</td>
                    <td className="p-3 text-slate-400">{m.reference_document}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      <Modal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        title="Register Qualified Supplier"
        size="md"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Supplier Code (Optional)"
              placeholder="e.g. SUP-MED-05"
              value={supCode}
              onChange={(e) => setSupCode(e.target.value)}
            />
            <Select
              label="Supplier Category"
              value={supCategory}
              onChange={(e) => setSupCategory(e.target.value)}
              options={[
                { value: 'PHARMACEUTICALS', label: 'Pharmaceuticals & Drugs' },
                { value: 'SURGICAL', label: 'Surgical & Disposable Supplies' },
                { value: 'LAB_DIAGNOSTICS', label: 'Diagnostic Lab Reagents' },
                { value: 'EQUIPMENT', label: 'Biomedical & Hospital Equipment' },
                { value: 'GENERAL', label: 'General Materials & Consumables' },
              ]}
              required
            />
          </div>

          <Input
            label="Business / Corporate Name"
            placeholder="e.g. Medtronic Healthcare Solutions"
            value={supName}
            onChange={(e) => setSupName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Person"
              placeholder="e.g. Anand Varma"
              value={supContact}
              onChange={(e) => setSupContact(e.target.value)}
              required
            />
            <Input
              label="Contact Phone"
              placeholder="e.g. 9876543210"
              value={supPhone}
              onChange={(e) => setSupPhone(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. sales@vendor.com"
              value={supEmail}
              onChange={(e) => setSupEmail(e.target.value)}
            />
            <Input
              label="GST / Tax Identification #"
              placeholder="e.g. GST27AAACA1234A1Z5"
              value={supGst}
              onChange={(e) => setSupGst(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Bank Name"
              placeholder="e.g. HDFC Bank"
              value={supBank}
              onChange={(e) => setSupBank(e.target.value)}
            />
            <Input
              label="Account #"
              placeholder="e.g. 50200012345678"
              value={supAccount}
              onChange={(e) => setSupAccount(e.target.value)}
            />
            <Input
              label="IFSC Code"
              placeholder="e.g. HDFC0000123"
              value={supIfsc}
              onChange={(e) => setSupIfsc(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowSupplierModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400"
            >
              Register Supplier
            </button>
          </div>
        </form>
      </Modal>

      {/* Requisition Modal */}
      <Modal
        isOpen={showReqModal}
        onClose={() => setShowReqModal(false)}
        title="Create Procurement Requisition"
        size="md"
      >
        <form onSubmit={handleCreateRequisition} className="space-y-4">
          <Select
            label="Procurement Category (Required by PDF)"
            value={reqCategory}
            onChange={(e) => setReqCategory(e.target.value)}
            options={[
              { value: 'MEDICINES', label: '1. Medicines' },
              { value: 'SURGICAL_SUPPLIES', label: '2. Surgical Supplies' },
              { value: 'DIAGNOSTIC_REAGENTS', label: '3. Diagnostic Reagents' },
              { value: 'EQUIPMENT', label: '4. Equipment' },
              { value: 'GENERAL_MATERIALS', label: '5. General Hospital Materials' },
            ]}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Requesting Department / Location"
              value={reqDept}
              onChange={(e) => setReqDept(e.target.value)}
              required
            />
            <Select
              label="Urgency"
              value={reqUrgency}
              onChange={(e) => setReqUrgency(e.target.value)}
              options={[
                { value: 'ROUTINE', label: 'Routine Replenishment' },
                { value: 'URGENT', label: 'Urgent' },
                { value: 'STAT_EMERGENCY', label: 'Stat Emergency' },
              ]}
              required
            />
          </div>

          <Input
            label="Requested Item Description & Specifications"
            placeholder="e.g. Cardiac Monitor or Disposable Surgical Gowns"
            value={reqItemName}
            onChange={(e) => setReqItemName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity"
              type="number"
              value={reqQty}
              onChange={(e) => setReqQty(parseInt(e.target.value) || 1)}
              min={1}
              required
            />
            <Input
              label="Required By Date"
              type="date"
              value={reqDeliveryDate}
              onChange={(e) => setReqDeliveryDate(e.target.value)}
            />
          </div>

          <Input
            label="Reason / Purpose of Request"
            placeholder="e.g. Needed for ICU capacity expansion"
            value={reqReason}
            onChange={(e) => setReqReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowReqModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
            >
              Submit Requisition
            </button>
          </div>
        </form>
      </Modal>

      {/* Quotation Modal */}
      <Modal
        isOpen={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        title="Record Supplier Quotation"
        size="md"
      >
        <form onSubmit={handleCreateQuotation} className="space-y-4">
          <Select
            label="Select Requisition"
            value={quoteReqId}
            onChange={(e) => setQuoteReqId(e.target.value)}
            options={[
              { value: '', label: '-- Select Requisition --' },
              ...requisitions.map((r) => ({
                value: r.id,
                label: `${r.requisition_number} (${r.procurement_category} - ${r.requesting_location})`,
              })),
            ]}
            required
          />

          <Select
            label="Supplier"
            value={quoteSupplierId}
            onChange={(e) => setQuoteSupplierId(e.target.value)}
            options={[
              { value: '', label: '-- Select Supplier --' },
              ...suppliers.filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name })),
            ]}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Delivery Lead Time (Days)"
              type="number"
              value={quoteLeadDays}
              onChange={(e) => setQuoteLeadDays(parseInt(e.target.value) || 7)}
              required
            />
            <Input
              label="Payment Terms"
              value={quotePaymentTerms}
              onChange={(e) => setQuotePaymentTerms(e.target.value)}
              required
            />
          </div>

          <Input
            label="Quoted Item Name"
            placeholder="e.g. Multipara Monitor 12-inch"
            value={quoteItemName}
            onChange={(e) => setQuoteItemName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity"
              type="number"
              value={quoteItemQty}
              onChange={(e) => setQuoteItemQty(parseInt(e.target.value) || 1)}
              required
            />
            <Input
              label="Unit Price (₹)"
              type="number"
              step="0.01"
              value={quoteItemPrice}
              onChange={(e) => setQuoteItemPrice(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowQuoteModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-purple-500 text-white font-bold hover:bg-purple-400"
            >
              Save Quotation
            </button>
          </div>
        </form>
      </Modal>

      {/* Award Modal */}
      <Modal
        isOpen={showAwardModal}
        onClose={() => setShowAwardModal(false)}
        title="Award Procurement Contract"
        size="md"
      >
        <form onSubmit={handleAwardQuotation} className="space-y-4">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-300">
            Selecting this quotation will mark it as accepted and reject competing bids for this requisition.
          </div>

          <Input
            label="Selection Justification (Mandatory for non-lowest bid)"
            placeholder="e.g. Superior warranty terms, immediate delivery availability, OEM certification"
            value={awardJustification}
            onChange={(e) => setAwardJustification(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAwardModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-purple-500 text-white font-bold hover:bg-purple-400"
            >
              Confirm Award
            </button>
          </div>
        </form>
      </Modal>

      {/* PO Modal */}
      <Modal
        isOpen={showPOModal}
        onClose={() => setShowPOModal(false)}
        title="Create Purchase Order"
        size="md"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await procurementService.createPurchaseOrder({
                supplier_id: selectedSupplierId,
                expected_delivery_date: poDeliveryDate,
                items: [
                  {
                    item_name: poItemName || 'Hospital Supplies',
                    quantity: poQuantity,
                    unit_cost: poUnitCost,
                  },
                ],
              });
              setShowPOModal(false);
              fetchData();
            } catch (err) {
              console.error(err);
            }
          }}
          className="space-y-4"
        >
          <Select
            label="Select Supplier"
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            options={suppliers.filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name }))}
            required
          />

          <Input
            label="Item Description"
            placeholder="e.g. Ciprobid 500mg or Surgical Drapes"
            value={poItemName}
            onChange={(e) => setPoItemName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Order Quantity"
              type="number"
              value={poQuantity}
              onChange={(e) => setPoQuantity(parseInt(e.target.value) || 1)}
              required
            />
            <Input
              label="Unit Cost (₹)"
              type="number"
              step="0.01"
              value={poUnitCost}
              onChange={(e) => setPoUnitCost(e.target.value)}
              required
            />
          </div>

          <Input
            label="Expected Delivery Date"
            type="date"
            value={poDeliveryDate}
            onChange={(e) => setPoDeliveryDate(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowPOModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400"
            >
              Save Draft PO
            </button>
          </div>
        </form>
      </Modal>

      {/* GRN Modal */}
      <Modal
        isOpen={showGRNModal}
        onClose={() => setShowGRNModal(false)}
        title="Record Goods Receipt Note (GRN)"
        size="md"
      >
        <form onSubmit={handleCreateGRN} className="space-y-4">
          <Input
            label="Supplier Delivery Note / Challan #"
            placeholder="e.g. DN-2026-9921"
            value={grnDeliveryNote}
            onChange={(e) => setGrnDeliveryNote(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Batch Number"
              placeholder="e.g. BATCH-2026-X"
              value={grnBatchNumber}
              onChange={(e) => setGrnBatchNumber(e.target.value)}
              required
            />
            <Input
              label="Expiry Date"
              type="date"
              value={grnExpiryDate}
              onChange={(e) => setGrnExpiryDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Accepted Quantity (Updates Stock)"
              type="number"
              value={grnAcceptedQty}
              onChange={(e) => setGrnAcceptedQty(parseInt(e.target.value) || 0)}
              min={1}
              required
            />
            <Input
              label="Rejected Quantity"
              type="number"
              value={grnRejectedQty}
              onChange={(e) => setGrnRejectedQty(parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>

          {grnRejectedQty > 0 && (
            <Input
              label="Rejection Reason"
              placeholder="e.g. Fractured packaging, broken seal"
              value={grnRejectReason}
              onChange={(e) => setGrnRejectReason(e.target.value)}
              required
            />
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowGRNModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400"
            >
              Accept Goods & Post Stock
            </button>
          </div>
        </form>
      </Modal>

      {/* Supplier Return Modal */}
      <Modal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Initiate Supplier Return (RMA)"
        size="md"
      >
        <form onSubmit={handleCreateSupplierReturn} className="space-y-4">
          <Select
            label="Supplier"
            value={retSupplierId}
            onChange={(e) => setRetSupplierId(e.target.value)}
            options={[
              { value: '', label: '-- Select Supplier --' },
              ...suppliers.map((s) => ({ value: s.id, label: s.name })),
            ]}
            required
          />

          <Select
            label="Select Medicine & Stock Batch"
            value={retBatchId}
            onChange={(e) => setRetBatchId(e.target.value)}
            options={[
              { value: '', label: '-- Select Batch to Return --' },
              ...medicines.flatMap((m) =>
                (m.batches || []).map((b: any) => ({
                  value: b.id,
                  label: `${m.brand_name} • Batch ${b.batch_number} (Avail: ${b.quantity_in_stock})`,
                }))
              ),
            ]}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity to Return"
              type="number"
              value={retQty}
              onChange={(e) => setRetQty(parseInt(e.target.value) || 1)}
              min={1}
              required
            />
            <Select
              label="Reason Type"
              value={retReasonType}
              onChange={(e) => setRetReasonType(e.target.value)}
              options={[
                { value: 'DAMAGED', label: 'Damaged Packaging / Broken Vials' },
                { value: 'DEFECTIVE', label: 'Defective Quality / QC Failure' },
                { value: 'EXPIRED', label: 'Received Near-Expiry' },
                { value: 'WRONG_ITEM', label: 'Incorrect Specification' },
                { value: 'RECALLED', label: 'Safety Recall' },
              ]}
              required
            />
          </div>

          <Input
            label="Reason Details & Inspection Notes"
            placeholder="e.g. Visual inspection found breached blister packaging"
            value={retReasonDetails}
            onChange={(e) => setRetReasonDetails(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowReturnModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-400"
            >
              Deduct Stock & Issue Return
            </button>
          </div>
        </form>
      </Modal>

      {/* Apply Credit Note Modal */}
      <Modal
        isOpen={showApplyCreditModal}
        onClose={() => setShowApplyCreditModal(false)}
        title="Apply Credit Note to Supplier Invoice"
        size="md"
      >
        <form onSubmit={handleApplyCreditNote} className="space-y-4">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
            <div>
              Credit Note: <strong className="text-white font-mono">{selectedCreditNote?.credit_note_number}</strong>
            </div>
            <div>
              Remaining Credit Balance:{' '}
              <strong className="text-emerald-400 font-mono">₹{selectedCreditNote?.remaining_balance}</strong>
            </div>
          </div>

          <Select
            label="Select Invoice to Apply Credit"
            value={targetInvoiceId}
            onChange={(e) => setTargetInvoiceId(e.target.value)}
            options={[
              { value: '', label: '-- Choose Supplier Invoice --' },
              ...supplierInvoices
                .filter((inv) => inv.payment_status !== 'PAID')
                .map((inv) => ({
                  value: inv.id,
                  label: `${inv.invoice_number} (${inv.supplier_name}) — Total: ₹${inv.total_amount}, Paid: ₹${inv.paid_amount}`,
                })),
            ]}
            required
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowApplyCreditModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
            >
              Apply Credit & Reduce Liability
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Schedule Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Schedule Payment Installment"
        size="md"
      >
        <form onSubmit={handleCreatePaymentSchedule} className="space-y-4">
          <Input
            label="Installment Amount (₹)"
            type="number"
            step="0.01"
            value={schedAmount}
            onChange={(e) => setSchedAmount(e.target.value)}
            required
          />

          <Input
            label="Scheduled Payment Date"
            type="date"
            value={schedDate}
            onChange={(e) => setSchedDate(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowScheduleModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400"
            >
              Create Schedule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default InventoryPage;
