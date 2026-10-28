import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  FileText,
  Search,
  Barcode,
  ShieldAlert,
  Cpu,
  ExternalLink,
  Printer,
  Send,
  RefreshCw,
  XCircle,
  RotateCcw,
  DollarSign,
  Activity,
  Layers,
  Eye,
  Check,
  Building2,
  FileCode
} from 'lucide-react';
import { diagnosticsService, clinicalService, authService } from '../../services/api';
import { parseApiError } from '../../utils/errorHandler';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { Input } from '../../components/common/Input';
import { AlertBanner } from '../../components/common/AlertBanner';
import { useBranch } from '../../context/BranchContext';

export const LaboratoryPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<
    'orders' | 'samples' | 'results' | 'critical' | 'catalogue' | 'outsourced' | 'equipment' | 'financials'
  >('orders');

  // Operational metrics
  const [stats, setStats] = useState<any>({
    orders_received: 0,
    awaiting_sample_collection: 0,
    samples_in_processing: 0,
    tests_in_progress: 0,
    awaiting_approval: 0,
    completed_released_reports: 0,
    critical_panic_results: 0,
    radiology_orders_pending: 0,
    outsourced_tests_pending: 0,
  });

  const [orders, setOrders] = useState<any[]>([]);
  const [catalogue, setCatalogue] = useState<any[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<any[]>([]);
  const [outsourcedOrders, setOutsourcedOrders] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [financialReport, setFinancialReport] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [bannerAlert, setBannerAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Modals
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [showAckModal, setShowAckModal] = useState(false);
  const [showCatalogueModal, setShowCatalogueModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [showInteroperabilityModal, setShowInteroperabilityModal] = useState(false);
  const [showReportDetailModal, setShowReportDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Selection states
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedSample, setSelectedSample] = useState<any>(null);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [interopData, setInteropData] = useState<any>(null);
  const [reportDetail, setReportDetail] = useState<any>(null);

  // Barcode search
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeSearchResult, setBarcodeSearchResult] = useState<any>(null);

  // Form states - Create Order
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [orderPriority, setOrderPriority] = useState('ROUTINE');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Form states - Collect Sample
  const [specimenType, setSpecimenType] = useState('Whole Blood (EDTA)');
  const [containerType, setContainerType] = useState('Lavender Top 3mL');
  const [collectionSite, setCollectionSite] = useState('Right median cubital vein');

  // Form states - Result Entry
  const [resultVal, setResultVal] = useState('');
  const [resultNotes, setResultNotes] = useState('');

  // Form states - Approval
  const [approvalNotes, setApprovalNotes] = useState('');
  const [enforceSeparation, setEnforceSeparation] = useState(true);

  // Form states - Amendment
  const [amendmentReason, setAmendmentReason] = useState('');
  const [amendedValue, setAmendedValue] = useState('');

  // Form states - Critical Alert Ack
  const [ackNotes, setAckNotes] = useState('');

  // Form states - Reject Sample
  const [rejectReason, setRejectReason] = useState('');

  // Form states - Catalogue
  const [testForm, setTestForm] = useState({
    code: '',
    name: '',
    category: 'BIOCHEMISTRY',
    sample_type: 'Blood',
    standard_rate: '500.00',
    turnaround_hours: 2,
    unit_of_measurement: 'mg/dL',
    normal_min: '',
    normal_max: '',
    critical_low: '',
    critical_high: '',
    is_outsourced: false,
  });

  // Form states - Outsourced
  const [dispatchRef, setDispatchRef] = useState('');
  const [dispatchTat, setDispatchTat] = useState('3');
  const [externalCost, setExternalCost] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [externalResult, setExternalResult] = useState('');

  // Form states - Simulator
  const [simBarcode, setSimBarcode] = useState('');
  const [simValue, setSimValue] = useState('14.2');

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [statsRes, ordersRes, catRes, critRes, outRes, equipRes, finRes, patRes] = await Promise.all([
        diagnosticsService.getLabDashboardStats(currentBranch?.id).catch(() => ({})),
        diagnosticsService.getOrders({ branch_id: currentBranch?.id }).catch(() => []),
        diagnosticsService.getCatalogue().catch(() => []),
        diagnosticsService.getCriticalAlerts({ is_acknowledged: false }).catch(() => []),
        diagnosticsService.getOutsourced({ branch_id: currentBranch?.id }).catch(() => []),
        diagnosticsService.getEquipment().catch(() => []),
        diagnosticsService.getFinancialReports().catch(() => null),
        authService.getPatients({ branch_id: currentBranch?.id }).catch(() => []),
      ]);

      setStats(statsRes);
      setOrders(ordersRes || []);
      setCatalogue(catRes || []);
      setCriticalAlerts(critRes || []);
      setOutsourcedOrders(outRes || []);
      setEquipmentList(equipRes || []);
      setFinancialReport(finRes);
      setPatients(patRes || []);

      if (patRes?.length > 0 && !selectedPatientId) {
        setSelectedPatientId(patRes[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load lab data:', err);
      setBannerAlert({ type: 'error', message: 'Failed to load laboratory workspace records.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [currentBranch?.id]);

  // Order Placement
  const handleCreateOrder = async (e: React.FormEvent, allowDuplicate: boolean = false) => {
    e.preventDefault();
    if (selectedTestIds.length === 0) {
      setBannerAlert({ type: 'warning', message: 'Please select at least one investigation test.' });
      return;
    }
    try {
      await diagnosticsService.createOrder({
        patient_id: selectedPatientId,
        test_ids: selectedTestIds,
        priority: orderPriority,
        clinical_notes: clinicalNotes,
        allow_duplicate: allowDuplicate,
      });
      setBannerAlert({ type: 'success', message: 'Investigation order placed successfully and billed to encounter.' });
      setShowOrderModal(false);
      setDuplicateWarning(null);
      setSelectedTestIds([]);
      setClinicalNotes('');
      loadAllData();
    } catch (err: any) {
      if (err?.response?.status === 409 && err?.response?.data?.duplicate_warning) {
        setDuplicateWarning(err.response.data.duplicate_warning);
      } else {
        setBannerAlert({ type: 'error', message: parseApiError(err).message });
      }
    }
  };

  // Sample Collection
  const handleCollectSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const res = await diagnosticsService.collectSample(selectedOrder.id, {
        specimen_type: specimenType,
        container_type: containerType,
        collection_site: collectionSite,
      });
      setBannerAlert({
        type: 'success',
        message: `Sample accessioned! Generated unique barcode: ${res?.sample?.sample_barcode}`,
      });
      setShowCollectModal(false);
      loadAllData();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Barcode Lookup
  const handleBarcodeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    try {
      const res = await diagnosticsService.lookupBarcode(barcodeInput.trim());
      setBarcodeSearchResult(res);
      setBannerAlert({ type: 'success', message: `Found specimen matching barcode: ${res.sample.sample_barcode}` });
    } catch (err: any) {
      setBarcodeSearchResult(null);
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Sample Reject
  const handleRejectSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSample) return;
    try {
      await diagnosticsService.sampleAction(selectedSample.id, {
        action: 'REJECT',
        reason: rejectReason,
      });
      setBannerAlert({ type: 'warning', message: 'Sample rejected. Recollection request flagged.' });
      setShowRejectModal(false);
      setRejectReason('');
      loadAllData();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Sample Recollect
  const handleRecollectSample = async (sample: any) => {
    try {
      const res = await diagnosticsService.sampleAction(sample.id, { action: 'RECOLLECTION' });
      setBannerAlert({
        type: 'success',
        message: `Linked recollection generated! New Barcode: ${res?.sample?.sample_barcode}`,
      });
      loadAllData();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Result Entry
  const handleEnterResult = async (e: React.FormEvent, isDraft: boolean = false) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      const res = await diagnosticsService.enterResult(selectedItem.id, {
        result_value: resultVal,
        result_notes: resultNotes,
        is_draft: isDraft,
      });
      if (res.is_critical_alert_triggered) {
        setBannerAlert({
          type: 'error',
          message: `CRITICAL PANIC VALUE ALERT TRIGGERED (${res.item.abnormal_flag})! Clinical notifications dispatched.`,
        });
      } else {
        setBannerAlert({ type: 'success', message: `Result recorded successfully (${res.item.abnormal_flag}).` });
      }
      setShowResultModal(false);
      setResultVal('');
      setResultNotes('');
      loadAllData();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Report Approval
  const handleApproveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await diagnosticsService.approveReport(selectedOrder.id, {
        summary_findings: approvalNotes,
        enforce_separation_of_duties: enforceSeparation,
      });
      setBannerAlert({ type: 'success', message: 'Laboratory diagnostic report verified and approved.' });
      setShowApprovalModal(false);
      setApprovalNotes('');
      loadAllData();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Report Release
  const handleReleaseReport = async (orderId: string) => {
    try {
      const res = await diagnosticsService.releaseReport(orderId);
      setBannerAlert({
        type: 'success',
        message: `Diagnostic report digitally signed and released! Hash: ${res?.report?.digital_signature_hash?.slice(0, 16)}...`,
      });
      loadAllData();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Report Amendment
  const handleAmendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !selectedItem) return;
    try {
      await diagnosticsService.amendReport(selectedOrder.id, {
        amendment_reason: amendmentReason,
        item_updates: [{ item_id: selectedItem.id, new_value: amendedValue }],
      });
      setBannerAlert({
        type: 'success',
        message: 'Report amended! Created version 2 and archived historical value in audit logs.',
      });
      setShowAmendModal(false);
      setAmendmentReason('');
      setAmendedValue('');
      loadAllData();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Critical Alert Ack
  const handleAckAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;
    try {
      await diagnosticsService.acknowledgeCriticalAlert(selectedAlert.id, ackNotes);
      setBannerAlert({ type: 'success', message: 'Critical panic alert acknowledged and recorded in audit log.' });
      setShowAckModal(false);
      setAckNotes('');
      loadAllData();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Save Catalogue Item
  const handleSaveCatalogue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await diagnosticsService.createCatalogueItem(testForm);
      setBannerAlert({ type: 'success', message: 'Diagnostic test created in catalogue with rate invariance.' });
      setShowCatalogueModal(false);
      setTestForm({
        code: '',
        name: '',
        category: 'BIOCHEMISTRY',
        sample_type: 'Blood',
        standard_rate: '500.00',
        turnaround_hours: 2,
        unit_of_measurement: 'mg/dL',
        normal_min: '',
        normal_max: '',
        critical_low: '',
        critical_high: '',
        is_outsourced: false,
      });
      loadAllData();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Outsourced Dispatch
  const handleDispatchOutsourced = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await diagnosticsService.dispatchOutsourced(selectedOrder.id, {
        external_reference_number: dispatchRef,
        expected_tat_days: parseInt(dispatchTat) || 3,
      });
      setBannerAlert({ type: 'success', message: 'Sample dispatched to external laboratory partner.' });
      setShowDispatchModal(false);
      setDispatchRef('');
      loadAllData();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Outsourced Receive
  const handleReceiveOutsourced = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await diagnosticsService.receiveOutsourcedResults(selectedOrder.id, {
        external_cost: externalCost,
        external_report_url: externalUrl,
        result_value: externalResult,
      });
      setBannerAlert({
        type: 'success',
        message: 'External laboratory findings recorded! Hospital diagnostic expense logged.',
      });
      setShowReceiveModal(false);
      setExternalCost('');
      setExternalUrl('');
      setExternalResult('');
      loadAllData();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Equipment Simulator
  const handleSimulateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await diagnosticsService.simulateEquipment({
        sample_barcode: simBarcode,
        results: { CBC_001: simValue },
        analyzer_model: 'Sysmex XN-1000 Automated Hematology Analyzer',
      });
      setBannerAlert({
        type: 'success',
        message: `Equipment Ingestion Successful! Analyzer sent result: ${simValue} (Status: ${res.status})`,
      });
      setShowSimulateModal(false);
      loadAllData();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  // Interoperability Preview
  const handleViewInterop = async (orderId: string, fmt: 'hl7' | 'fhir') => {
    try {
      const res = await diagnosticsService.getInteroperability(orderId, fmt);
      setInteropData(res);
      setShowInteroperabilityModal(true);
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: 'Failed to generate interoperability packet.' });
    }
  };

  // View Printable Report
  const handleViewReportDetail = async (reportId: string) => {
    try {
      const res = await diagnosticsService.getReportDetail(reportId);
      setReportDetail(res);
      setShowReportDetailModal(true);
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: 'Failed to fetch verified report details.' });
    }
  };

  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    return (
      (o.order_number || '').toLowerCase().includes(term) ||
      (o.patient?.user_profile?.full_name || '').toLowerCase().includes(term) ||
      (o.patient?.medical_record_number || '').toLowerCase().includes(term) ||
      (o.status || '').toLowerCase().includes(term) ||
      (o.priority || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <FlaskConical className="w-7 h-7 text-teal-400" />
            Laboratory & Diagnostic Management
          </h1>
          <p className="text-sm text-slate-400">
            End-to-end LIS/RIS engine: barcode accessioning, analyzer telemetry, panic alerts, NABL verified reporting & HL7/FHIR interoperability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSimulateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 rounded-lg text-sm font-medium transition"
            title="Launch Automated Analyzer Ingestion Simulator"
          >
            <Cpu className="w-4 h-4" />
            Equipment Simulator
          </button>
          <button
            onClick={() => setShowOrderModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-teal-900/30"
          >
            <Plus className="w-4 h-4" />
            New Investigation
          </button>
          <button
            onClick={loadAllData}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {bannerAlert && (
        <AlertBanner
          type={bannerAlert.type}
          message={bannerAlert.message}
          onClose={() => setBannerAlert(null)}
        />
      )}

      {/* Critical Panic Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-rose-950/70 border-2 border-rose-500/80 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/20 rounded-lg text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-200 text-sm tracking-wide uppercase">
                  Immediate Clinical Attention Required!
                </span>
                <Badge variant="danger">{criticalAlerts.length} Panic Result(s)</Badge>
              </div>
              <p className="text-xs text-rose-300/80 mt-0.5">
                Critical panic threshold breached. Escalation countdown active until acknowledged by attending physician.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('critical')}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow transition"
          >
            Review & Acknowledge ({criticalAlerts.length})
          </button>
        </div>
      )}

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard
          title="Orders Received"
          value={stats.orders_received ?? 0}
          icon={Layers}
          accent="indigo"
        />
        <StatCard
          title="Awaiting Sample"
          value={stats.awaiting_sample_collection ?? 0}
          icon={Clock}
          accent="amber"
        />
        <StatCard
          title="In Processing"
          value={stats.samples_in_processing ?? 0}
          icon={Activity}
          accent="cyan"
        />
        <StatCard
          title="Awaiting Approval"
          value={stats.awaiting_approval ?? 0}
          icon={AlertTriangle}
          accent="amber"
        />
        <StatCard
          title="Reports Released"
          value={stats.completed_released_reports ?? 0}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          title="Critical Panic"
          value={stats.critical_panic_results ?? 0}
          icon={ShieldAlert}
          accent="rose"
        />
        <StatCard
          title="Radiology Pending"
          value={stats.radiology_orders_pending ?? 0}
          icon={Eye}
          accent="teal"
        />
        <StatCard
          title="Outsourced"
          value={stats.outsourced_tests_pending ?? 0}
          icon={Building2}
          accent="indigo"
        />
      </div>

      {/* Barcode Quick Lookup Scanner Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2 text-teal-400 text-sm font-semibold whitespace-nowrap">
          <Barcode className="w-5 h-5" />
          Barcode Accessioning:
        </div>
        <form onSubmit={handleBarcodeLookup} className="flex-1 flex gap-2 w-full">
          <input
            type="text"
            placeholder="Scan or enter specimen barcode (e.g. SMP-20261022-XXXX)..."
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
          >
            Lookup
          </button>
        </form>
      </div>

      {/* Barcode Search Result Card */}
      {barcodeSearchResult && (
        <div className="bg-slate-900 border border-teal-500/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-teal-300">
                Barcode: {barcodeSearchResult.sample.sample_barcode}
              </span>
              <Badge variant="info">{barcodeSearchResult.sample.status}</Badge>
              {barcodeSearchResult.sample.is_recollection && (
                <Badge variant="warning">Recollected Sample</Badge>
              )}
            </div>
            <button
              onClick={() => setBarcodeSearchResult(null)}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Patient:</span>{' '}
              <strong className="text-slate-200">{barcodeSearchResult.patient.name}</strong> ({barcodeSearchResult.patient.mrn})
            </div>
            <div>
              <span className="text-slate-500">Specimen:</span>{' '}
              <span className="text-slate-300">{barcodeSearchResult.sample.specimen_type}</span>
            </div>
            <div>
              <span className="text-slate-500">Container:</span>{' '}
              <span className="text-slate-300">{barcodeSearchResult.sample.container_type}</span>
            </div>
            <div>
              <span className="text-slate-500">Collected At:</span>{' '}
              <span className="text-slate-300">
                {new Date(barcodeSearchResult.sample.collected_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
            <button
              onClick={() => {
                setSelectedSample(barcodeSearchResult.sample);
                setShowRejectModal(true);
              }}
              className="px-2.5 py-1 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded text-xs transition"
            >
              Reject Specimen (Hemolyzed/Clotted)
            </button>
            <button
              onClick={() => handleRecollectSample(barcodeSearchResult.sample)}
              className="px-2.5 py-1 bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-800/40 rounded text-xs transition"
            >
              Trigger Recollection
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto text-sm font-medium">
        {[
          { key: 'orders', label: 'Investigation Orders' },
          { key: 'results', label: 'Worklist & Result Entry' },
          { key: 'critical', label: `Critical Alerts (${criticalAlerts.length})` },
          { key: 'catalogue', label: 'Test Catalogue & Pricing' },
          { key: 'outsourced', label: 'Outsourced Investigations' },
          { key: 'equipment', label: 'Analyzers & Ingestion' },
          { key: 'financials', label: 'Revenue & Margins' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 border-b-2 transition whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: INVESTIGATION ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search orders by #, patient MRN, doctor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <span className="text-xs text-slate-400 self-end sm:self-auto">
              Showing {filteredOrders.length} orders
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Patient (MRN)</th>
                  <th className="py-3 px-4">Encounter</th>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tests Included</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No investigation orders found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono font-bold text-teal-300">
                        {ord.order_number}
                        {ord.is_outsourced && (
                          <span className="block text-[10px] text-amber-400">Outsourced</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-200">
                          {ord.patient?.user_profile?.full_name || 'Direct Patient'}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {ord.patient?.medical_record_number}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="neutral">{ord.encounter_type}</Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        Dr. {ord.doctor?.user_profile?.last_name || 'Staff'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            ord.priority === 'STAT'
                              ? 'danger'
                              : ord.priority === 'URGENT'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {ord.priority}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            ord.status === 'RELEASED'
                              ? 'success'
                              : ord.status === 'APPROVED'
                              ? 'info'
                              : ord.status === 'CANCELLED'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {ord.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                        {(ord.items || []).map((it: any) => it.test?.name).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        {ord.status === 'ORDERED' && (
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setShowCollectModal(true);
                            }}
                            className="px-2 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded text-[11px] font-medium transition"
                          >
                            Collect Sample
                          </button>
                        )}
                        {ord.status === 'IN_PROCESS' && (
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setShowApprovalModal(true);
                            }}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium transition"
                          >
                            Approve
                          </button>
                        )}
                        {ord.status === 'APPROVED' && (
                          <button
                            onClick={() => handleReleaseReport(ord.id)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium transition"
                          >
                            Digital Release
                          </button>
                        )}
                        {ord.status === 'RELEASED' && (
                          <button
                            onClick={() => handleViewReportDetail(ord.id)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded text-[11px] font-medium transition"
                          >
                            View Report
                          </button>
                        )}
                        <button
                          onClick={() => handleViewInterop(ord.id, 'hl7')}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition"
                          title="View HL7 / FHIR Payload"
                        >
                          <FileCode className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: WORKLIST & RESULT ENTRY */}
      {activeTab === 'results' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Laboratory processing workbench: quantitative results are auto-flagged against normal reference intervals and critical panic cutoffs.
          </p>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Specimen Barcode</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Test Code & Name</th>
                  <th className="py-3 px-4">Reference Range</th>
                  <th className="py-3 px-4">Result Value</th>
                  <th className="py-3 px-4">Flag</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders.flatMap((ord) =>
                  (ord.items || []).map((itm: any) => (
                    <tr key={itm.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono font-bold text-teal-300">
                        {ord.specimen_accession_number || itm.sample?.sample_barcode || 'PENDING'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-200">
                          {ord.patient?.user_profile?.full_name}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {ord.patient?.gender}, {ord.patient?.age || 'Adult'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-slate-200">{itm.test?.name}</strong>
                        <span className="block text-[10px] text-slate-500 font-mono">
                          {itm.test?.code} ({itm.test?.category})
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {itm.test?.reference_range ||
                          `${itm.test?.normal_min ?? ''} - ${itm.test?.normal_max ?? ''} ${itm.test?.unit_of_measurement || ''}`}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-100">
                        {itm.result_value || <span className="text-slate-500 italic">Unentered</span>}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            itm.abnormal_flag?.includes('CRITICAL')
                              ? 'danger'
                              : itm.abnormal_flag?.includes('ABNORMAL')
                              ? 'warning'
                              : 'success'
                          }
                        >
                          {itm.abnormal_flag}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="neutral">{itm.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        {itm.status !== 'RELEASED' && (
                          <button
                            onClick={() => {
                              setSelectedItem(itm);
                              setSelectedOrder(ord);
                              setResultVal(itm.result_value || '');
                              setShowResultModal(true);
                            }}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded text-[11px] font-medium transition"
                          >
                            Enter Result
                          </button>
                        )}
                        {itm.status === 'RELEASED' && (
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setSelectedItem(itm);
                              setAmendedValue(itm.result_value);
                              setShowAmendModal(true);
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-medium transition"
                          >
                            Amend Result
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
      )}

      {/* TAB 3: CRITICAL ALERTS */}
      {activeTab === 'critical' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2 mb-1">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Critical Panic Value Registry & Doctor Escalation Log
            </h3>
            <p className="text-xs text-slate-400">
              Under medical laboratory safety standards, panic values must be promptly notified, verbally or electronically, and logged with timestamp and clinical recipient acknowledgement.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Panic Value</th>
                  <th className="py-3 px-4">Investigation Test</th>
                  <th className="py-3 px-4">Patient MRN & Name</th>
                  <th className="py-3 px-4">Trigger Timestamp</th>
                  <th className="py-3 px-4">Physician Recipient</th>
                  <th className="py-3 px-4">Delivery Status</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {criticalAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No active unacknowledged critical panic alerts. All clear.
                    </td>
                  </tr>
                ) : (
                  criticalAlerts.map((alt) => (
                    <tr key={alt.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono font-bold text-rose-400">
                        {alt.critical_value}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {alt.order_item?.test?.name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-200">{alt.patient?.name}</span>
                        <span className="block text-[10px] text-slate-400">{alt.patient?.mrn}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(alt.triggered_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        Dr. {alt.recipient_doctor?.user_profile?.last_name || 'Attending Physician'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="neutral">{alt.external_delivery_status}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {alt.is_acknowledged ? (
                          <Badge variant="success">Acknowledged</Badge>
                        ) : (
                          <Badge variant="danger">Pending Ack</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!alt.is_acknowledged && (
                          <button
                            onClick={() => {
                              setSelectedAlert(alt);
                              setShowAckModal(true);
                            }}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold shadow transition"
                          >
                            Acknowledge Alert
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
      )}

      {/* TAB 4: TEST CATALOGUE & PRICING */}
      {activeTab === 'catalogue' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-400">
              Database-backed investigation catalogue. Standard rates are captured at order time, ensuring historical financial invariance.
            </p>
            <button
              onClick={() => setShowCatalogueModal(true)}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium transition"
            >
              + Add Investigation
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Investigation Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Specimen Type</th>
                  <th className="py-3 px-4">Turnaround (Hrs)</th>
                  <th className="py-3 px-4">Reference Range</th>
                  <th className="py-3 px-4">Standard Rate (₹)</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {catalogue.map((test) => (
                  <tr key={test.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono font-bold text-teal-300">{test.code}</td>
                    <td className="py-3 px-4 font-medium text-slate-200">{test.name}</td>
                    <td className="py-3 px-4">
                      <Badge variant="neutral">{test.category}</Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{test.sample_type || 'Blood'}</td>
                    <td className="py-3 px-4 text-slate-400">{test.turnaround_hours}h</td>
                    <td className="py-3 px-4 text-slate-400">
                      {test.normal_min && test.normal_max
                        ? `${test.normal_min} - ${test.normal_max} ${test.unit_of_measurement || ''}`
                        : test.reference_range || 'Configured Clinical Interval'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-100">
                      ₹{parseFloat(test.standard_rate).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={test.is_active ? 'success' : 'neutral'}>
                        {test.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: OUTSOURCED INVESTIGATIONS */}
      {activeTab === 'outsourced' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Specialized reference laboratory referral tracking (e.g., Histopathology, Oncogenetics, Mass Spectrometry). Hospital expense is tracked separately from billed revenue.
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Partner Laboratory</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Courier / Waybill Ref</th>
                  <th className="py-3 px-4">Dispatch Date</th>
                  <th className="py-3 px-4">Partner Expense (₹)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {outsourcedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No outsourced investigations currently logged.
                    </td>
                  </tr>
                ) : (
                  outsourcedOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">
                        {ord.order_number}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {ord.external_provider?.name || 'Metropolis / SRL Diagnostics'}
                      </td>
                      <td className="py-3 px-4">{ord.patient?.user_profile?.full_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {ord.external_reference_number || (
                          <span className="text-slate-500 italic">Not Dispatched</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {ord.external_dispatch_date
                          ? new Date(ord.external_dispatch_date).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-rose-300">
                        ₹{parseFloat(ord.external_cost || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="warning">{ord.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        {!ord.external_dispatch_date && (
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setShowDispatchModal(true);
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-medium transition"
                          >
                            Dispatch Sample
                          </button>
                        )}
                        {ord.external_dispatch_date && ord.status !== 'RELEASED' && (
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setShowReceiveModal(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium transition"
                          >
                            Receive Results
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
      )}

      {/* TAB 6: EQUIPMENT & INGESTION */}
      {activeTab === 'equipment' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-400">
              Laboratory equipment connectivity: ASTM / HL7 serial-over-IP and HTTP REST ingestion endpoints with automated result telemetry.
            </p>
            <button
              onClick={() => setShowSimulateModal(true)}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            >
              <Cpu className="w-4 h-4" />
              Simulate Ingestion
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {equipmentList.map((eq) => (
              <div
                key={eq.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-sm">{eq.name}</span>
                  <Badge variant={eq.status === 'ONLINE' ? 'success' : 'neutral'}>
                    {eq.status}
                  </Badge>
                </div>
                <div className="text-xs space-y-1 text-slate-400">
                  <div>
                    <span className="text-slate-500">Serial #:</span>{' '}
                    <span className="font-mono text-slate-300">{eq.serial_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Modality:</span> {eq.equipment_type}
                  </div>
                  <div>
                    <span className="text-slate-500">Protocol:</span>{' '}
                    <span className="font-mono text-teal-300">{eq.protocol}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Endpoint:</span>{' '}
                    <span className="font-mono text-slate-400">
                      /api/v1/clinical/lab/equipment/ingest/
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: FINANCIAL REPORTS & CONTRIBUTION MARGINS */}
      {activeTab === 'financials' && (
        <div className="space-y-4">
          {financialReport && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs text-slate-400 uppercase font-semibold">
                    Total Recognized Diagnostic Revenue
                  </span>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                    ₹{financialReport.grand_billed_revenue?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs text-slate-400 uppercase font-semibold">
                    Diagnostic Direct Expenses (Outsourced)
                  </span>
                  <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
                    ₹{financialReport.grand_diagnostic_expenses?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <span className="text-xs text-slate-400 uppercase font-semibold">
                    Net Diagnostic Contribution Margin
                  </span>
                  <div className="text-2xl font-bold font-mono text-teal-300 mt-1">
                    ₹{financialReport.grand_net_contribution?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Test Code</th>
                      <th className="py-3 px-4">Test Name</th>
                      <th className="py-3 px-4">Department / Modality</th>
                      <th className="py-3 px-4 text-center">Orders</th>
                      <th className="py-3 px-4 text-center">Completed</th>
                      <th className="py-3 px-4 text-right">Billed Revenue (₹)</th>
                      <th className="py-3 px-4 text-right">Expenses (₹)</th>
                      <th className="py-3 px-4 text-right">Net Margin (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(financialReport.test_breakdown || []).map((row: any) => (
                      <tr key={row.test_code} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono font-bold text-teal-300">
                          {row.test_code}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-200">{row.test_name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="neutral">{row.category}</Badge>
                        </td>
                        <td className="py-3 px-4 text-center">{row.tests_ordered}</td>
                        <td className="py-3 px-4 text-center">{row.tests_completed}</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">
                          ₹{parseFloat(row.billed_revenue).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-300">
                          ₹{parseFloat(row.recorded_expenses).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-teal-300">
                          ₹{parseFloat(row.net_contribution).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL 1: CREATE INVESTIGATION ORDER */}
      {showOrderModal && (
        <Modal
          isOpen={showOrderModal}
          onClose={() => {
            setShowOrderModal(false);
            setDuplicateWarning(null);
          }}
          title="Place Diagnostic Investigation Order"
        >
          <form onSubmit={(e) => handleCreateOrder(e, false)} className="space-y-4">
            {duplicateWarning && (
              <div className="bg-amber-950/70 border border-amber-600 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  Clinical Safety Warning: Duplicate Order
                </div>
                <p className="text-xs text-amber-200/90">{duplicateWarning}</p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => handleCreateOrder(e, true)}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold"
                  >
                    Authorize Repeat Test Anyway
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Select Patient:
              </label>
              <Select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                options={patients.map((p) => ({
                  value: p.id,
                  label: `${p.user_profile?.full_name || p.full_name} (${p.medical_record_number || p.mrn})`,
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Priority:</label>
              <Select
                value={orderPriority}
                onChange={(e) => setOrderPriority(e.target.value)}
                options={[
                  { value: 'ROUTINE', label: 'Routine (Standard TAT)' },
                  { value: 'URGENT', label: 'Urgent (Priority Processing)' },
                  { value: 'STAT', label: 'STAT (Emergency Room / ICU Immediate)' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Requested Tests:
              </label>
              <div className="max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-1.5">
                {catalogue.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center justify-between text-xs p-1.5 hover:bg-slate-900 rounded cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTestIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTestIds([...selectedTestIds, t.id]);
                          } else {
                            setSelectedTestIds(selectedTestIds.filter((id) => id !== t.id));
                          }
                        }}
                        className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-slate-200">{t.name}</span>
                    </div>
                    <span className="font-mono text-slate-400">₹{parseFloat(t.standard_rate).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Clinical Indication & Notes:
              </label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={2}
                placeholder="Diagnostic query, symptoms, or clinical background..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold"
              >
                Confirm Order & Synchronize Bill
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: SAMPLE COLLECTION */}
      {showCollectModal && (
        <Modal
          isOpen={showCollectModal}
          onClose={() => setShowCollectModal(false)}
          title={`Sample Collection — Order ${selectedOrder?.order_number}`}
        >
          <form onSubmit={handleCollectSample} className="space-y-4">
            <div className="p-3 bg-slate-950 rounded-lg text-xs space-y-1 text-slate-300 border border-slate-800">
              <div>
                <span className="text-slate-500">Patient:</span>{' '}
                <strong className="text-slate-100">{selectedOrder?.patient?.user_profile?.full_name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Tests:</span>{' '}
                {selectedOrder?.items?.map((it: any) => it.test?.name).join(', ')}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Specimen Type:</label>
              <Select
                value={specimenType}
                onChange={(e) => setSpecimenType(e.target.value)}
                options={[
                  { value: 'Whole Blood (EDTA)', label: 'Whole Blood (EDTA)' },
                  { value: 'Serum (Plain/Clot Activator)', label: 'Serum (Plain/Clot Activator)' },
                  { value: 'Plasma (Sodium Citrate)', label: 'Plasma (Sodium Citrate 3.2%)' },
                  { value: 'Clean Catch Midstream Urine', label: 'Clean Catch Midstream Urine' },
                  { value: 'CSF / Synovial Fluid', label: 'CSF / Synovial Fluid' },
                  { value: 'Biopsy Tissue (Formalin)', label: 'Biopsy Tissue (10% Neutral Buffered Formalin)' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Container & Tube Color:</label>
              <Input
                value={containerType}
                onChange={(e) => setContainerType(e.target.value)}
                placeholder="Lavender Top, Gold SST, Light Blue, Sterile Cup..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Collection Site / Phlebotomist Notes:</label>
              <Input
                value={collectionSite}
                onChange={(e) => setCollectionSite(e.target.value)}
                placeholder="Right antecubital fossa, Left hand dorsal vein..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCollectModal(false)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold"
              >
                Generate Barcode & Accession Specimen
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: RESULT ENTRY */}
      {showResultModal && (
        <Modal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          title={`Enter Test Result — ${selectedItem?.test?.name}`}
        >
          <form onSubmit={(e) => handleEnterResult(e, false)} className="space-y-4">
            <div className="p-3 bg-slate-950 rounded-lg text-xs space-y-1 text-slate-300 border border-slate-800">
              <div>
                <span className="text-slate-500">Biological Reference Interval:</span>{' '}
                <strong className="text-teal-300">
                  {selectedItem?.test?.normal_min && selectedItem?.test?.normal_max
                    ? `${selectedItem.test.normal_min} - ${selectedItem.test.normal_max} ${selectedItem.test.unit_of_measurement || ''}`
                    : selectedItem?.test?.reference_range || 'Configured Range'}
                </strong>
              </div>
              {selectedItem?.test?.critical_low && (
                <div>
                  <span className="text-slate-500">Critical Panic Limits:</span>{' '}
                  <span className="text-rose-400 font-mono">
                    &lt; {selectedItem.test.critical_low} or &gt; {selectedItem.test.critical_high}{' '}
                    {selectedItem.test.unit_of_measurement}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Result Value ({selectedItem?.test?.unit_of_measurement || 'Units'}):
              </label>
              <Input
                value={resultVal}
                onChange={(e) => setResultVal(e.target.value)}
                placeholder="Enter quantitative count or qualitative finding..."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Technologist Observation / Notes:
              </label>
              <textarea
                value={resultNotes}
                onChange={(e) => setResultNotes(e.target.value)}
                rows={2}
                placeholder="Repeated on secondary dilution, hemolysis index..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={(e) => handleEnterResult(e, true)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Save as Draft
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold"
              >
                Submit for Clinical Validation
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: REPORT APPROVAL */}
      {showApprovalModal && (
        <Modal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          title={`Pathologist Report Approval — Order ${selectedOrder?.order_number}`}
        >
          <form onSubmit={handleApproveReport} className="space-y-4">
            <div className="p-3 bg-slate-950 rounded-lg text-xs space-y-1.5 text-slate-300 border border-slate-800">
              <div className="font-semibold text-slate-200">Review Findings:</div>
              {selectedOrder?.items?.map((it: any) => (
                <div key={it.id} className="flex justify-between items-center text-xs">
                  <span>{it.test?.name}:</span>
                  <span className="font-mono font-bold text-teal-300">
                    {it.result_value || 'Pending'} {it.test?.unit_of_measurement}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Summary Clinical Opinion / Impression:
              </label>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={3}
                placeholder="Final pathologist clinical summary, morphological observations..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enforceSeparation}
                onChange={(e) => setEnforceSeparation(e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              <span>
                Enforce Separation of Duties (Prevent user from approving results entered by themselves)
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
              >
                Approve Report
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 5: AMENDMENT */}
      {showAmendModal && (
        <Modal
          isOpen={showAmendModal}
          onClose={() => setShowAmendModal(false)}
          title={`Amend Released Report — ${selectedItem?.test?.name}`}
        >
          <form onSubmit={handleAmendReport} className="space-y-4">
            <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-lg text-xs text-amber-200">
              Amending a released report will generate Version 2, archive the prior value ({selectedItem?.result_value}) in tamper-proof audit trails, and require a formal clerical/clinical justification.
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Corrected Result Value:
              </label>
              <Input
                value={amendedValue}
                onChange={(e) => setAmendedValue(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Formal Amendment Justification:
              </label>
              <textarea
                value={amendmentReason}
                onChange={(e) => setAmendmentReason(e.target.value)}
                rows={3}
                placeholder="Reason for transcription correction or repeat specimen review..."
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAmendModal(false)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold"
              >
                Release Amended Version (v2)
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 6: ACKNOWLEDGE CRITICAL ALERT */}
      {showAckModal && (
        <Modal
          isOpen={showAckModal}
          onClose={() => setShowAckModal(false)}
          title="Clinical Acknowledgement of Panic Result"
        >
          <form onSubmit={handleAckAlert} className="space-y-4">
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-xs space-y-1 text-rose-200">
              <div>
                <strong>Critical Value:</strong> {selectedAlert?.critical_value}
              </div>
              <div>
                <strong>Investigation:</strong> {selectedAlert?.order_item?.test?.name}
              </div>
              <div>
                <strong>Patient:</strong> {selectedAlert?.patient?.name} ({selectedAlert?.patient?.mrn})
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Physician Response & Clinical Action Initiated:
              </label>
              <textarea
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                rows={3}
                placeholder="Immediate intervention initiated (e.g., verbal readback confirmed with Dr. Arun, emergency IV bolus ordered)..."
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAckModal(false)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold"
              >
                Confirm Acknowledged
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 7: CREATE CATALOGUE ITEM */}
      {showCatalogueModal && (
        <Modal
          isOpen={showCatalogueModal}
          onClose={() => setShowCatalogueModal(false)}
          title="Add New Investigation to Test Catalogue"
        >
          <form onSubmit={handleSaveCatalogue} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Test Code:</label>
                <Input
                  value={testForm.code}
                  onChange={(e) => setTestForm({ ...testForm, code: e.target.value })}
                  placeholder="e.g. TROP_I"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category:</label>
                <Select
                  value={testForm.category}
                  onChange={(e) => setTestForm({ ...testForm, category: e.target.value })}
                  options={[
                    { value: 'BIOCHEMISTRY', label: 'Biochemistry' },
                    { value: 'HEMATOLOGY', label: 'Hematology' },
                    { value: 'MICROBIOLOGY', label: 'Microbiology' },
                    { value: 'HISTOPATHOLOGY', label: 'Histopathology' },
                    { value: 'IMMUNOLOGY', label: 'Immunology & Serology' },
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Investigation Name:</label>
              <Input
                value={testForm.name}
                onChange={(e) => setTestForm({ ...testForm, name: e.target.value })}
                placeholder="e.g. High-Sensitivity Troponin I (Cardiac)"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Standard Rate (₹):</label>
                <Input
                  type="number"
                  value={testForm.standard_rate}
                  onChange={(e) => setTestForm({ ...testForm, standard_rate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Turnaround (Hrs):</label>
                <Input
                  type="number"
                  value={testForm.turnaround_hours}
                  onChange={(e) => setTestForm({ ...testForm, turnaround_hours: parseInt(e.target.value) || 2 })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Units:</label>
                <Input
                  value={testForm.unit_of_measurement}
                  onChange={(e) => setTestForm({ ...testForm, unit_of_measurement: e.target.value })}
                  placeholder="mg/dL, g/dL, ng/L..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Normal Low:</label>
                <Input
                  value={testForm.normal_min}
                  onChange={(e) => setTestForm({ ...testForm, normal_min: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Normal High:</label>
                <Input
                  value={testForm.normal_max}
                  onChange={(e) => setTestForm({ ...testForm, normal_max: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Critical Panic Low:</label>
                <Input
                  value={testForm.critical_low}
                  onChange={(e) => setTestForm({ ...testForm, critical_low: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Critical Panic High:</label>
                <Input
                  value={testForm.critical_high}
                  onChange={(e) => setTestForm({ ...testForm, critical_high: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCatalogueModal(false)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold"
              >
                Save Investigation
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 8: REJECT SAMPLE */}
      {showRejectModal && (
        <Modal
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          title={`Reject Specimen — ${selectedSample?.sample_barcode}`}
        >
          <form onSubmit={handleRejectSample} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Clinical Reason for Specimen Rejection:
              </label>
              <Select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                options={[
                  { value: 'Grossly hemolyzed specimen (free hemoglobin interference)', label: 'Grossly hemolyzed specimen' },
                  { value: 'Clotted whole blood in EDTA tube', label: 'Clotted whole blood in EDTA tube' },
                  { value: 'Insufficient specimen volume for complete panel (QNS)', label: 'Quantity Not Sufficient (QNS)' },
                  { value: 'Improper container / anticoagulant ratio', label: 'Improper container / anticoagulant ratio' },
                  { value: 'Mislabeled or unlabeled specimen tube', label: 'Mislabeled or unlabeled specimen tube' },
                ]}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold"
              >
                Confirm Rejection & Flag Recollection
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 9: SIMULATE EQUIPMENT INGESTION */}
      {showSimulateModal && (
        <Modal
          isOpen={showSimulateModal}
          onClose={() => setShowSimulateModal(false)}
          title="Automated Analyzer Result Ingestion Simulator"
        >
          <form onSubmit={handleSimulateEquipment} className="space-y-4">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1 text-slate-300">
              <span className="font-semibold text-teal-300">Analyzer Simulation:</span>
              <p className="text-slate-400">
                Simulates real-time ASTM/HL7 ingestion from Sysmex XN-1000 or Roche Cobas analyzer directly matching specimen barcode.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Specimen Barcode:
              </label>
              <Input
                value={simBarcode}
                onChange={(e) => setSimBarcode(e.target.value)}
                placeholder="e.g. SMP-20261022-XXXX"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Simulated Analyzer Value (Hemoglobin g/dL):
              </label>
              <Input
                value={simValue}
                onChange={(e) => setSimValue(e.target.value)}
                placeholder="e.g. 14.8"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold"
              >
                Transmit Ingestion Packet
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 10: INTEROPERABILITY VIEWER (HL7 / FHIR) */}
      {showInteroperabilityModal && (
        <Modal
          isOpen={showInteroperabilityModal}
          onClose={() => setShowInteroperabilityModal(false)}
          title="HL7 v2.5.1 & FHIR R4 Interoperability Packet"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-mono text-xs text-teal-300 font-bold">
                Format: {interopData?.format}
              </span>
              <span className="text-xs text-slate-400">
                Control ID: {interopData?.message_control_id}
              </span>
            </div>

            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto max-h-80 whitespace-pre-wrap">
              {interopData?.hl7_message || JSON.stringify(interopData?.resource, null, 2)}
            </pre>

            <div className="flex justify-end">
              <button
                onClick={() => setShowInteroperabilityModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 11: PRINTABLE REPORT DETAIL */}
      {showReportDetailModal && (
        <Modal
          isOpen={showReportDetailModal}
          onClose={() => setShowReportDetailModal(false)}
          title="Diagnostic Report — Verified Final Release"
        >
          <div className="space-y-4">
            {reportDetail && (
              <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl space-y-4 text-xs font-sans">
                {/* Letterhead */}
                <div className="border-b border-slate-800 pb-3 flex justify-between items-start">
                  <div>
                    <h2 className="text-base font-bold text-slate-100">{reportDetail.hospital?.name}</h2>
                    <p className="text-slate-400">{reportDetail.hospital?.branch} &bull; {reportDetail.hospital?.address}</p>
                    <p className="text-teal-400 font-semibold text-[10px] uppercase mt-0.5">{reportDetail.hospital?.accreditation}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-200">
                      {reportDetail.report?.report_number}
                    </span>
                    <span className="block text-[10px] text-emerald-400 font-bold uppercase">
                      VERIFIED DIGITAL REPORT (v{reportDetail.report?.version})
                    </span>
                  </div>
                </div>

                {/* Patient Demographics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="text-slate-500">Patient:</span>{' '}
                    <strong className="text-slate-200">{reportDetail.patient?.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">MRN:</span>{' '}
                    <span className="font-mono text-teal-300">{reportDetail.patient?.mrn}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Age / Gender:</span>{' '}
                    <span className="text-slate-300">{reportDetail.patient?.age || 'Adult'} / {reportDetail.patient?.gender}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Released:</span>{' '}
                    <span className="text-slate-300">{new Date(reportDetail.report?.released_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Results Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Investigation</th>
                        <th className="py-2 px-3">Result</th>
                        <th className="py-2 px-3">Reference Range</th>
                        <th className="py-2 px-3">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {reportDetail.lab_order?.items?.map((it: any) => (
                        <tr key={it.id}>
                          <td className="py-2 px-3 font-medium text-slate-200">{it.test?.name}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-100">
                            {it.result_value} {it.test?.unit_of_measurement}
                          </td>
                          <td className="py-2 px-3 text-slate-400">
                            {it.test?.reference_range || `${it.test?.normal_min} - ${it.test?.normal_max}`}
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant={it.abnormal_flag === 'NORMAL' ? 'success' : 'warning'}>
                              {it.abnormal_flag}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Digital Signature */}
                <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                  <div>
                    SHA-256 Signature Hash: <span className="text-teal-400">{reportDetail.report?.digital_signature_hash}</span>
                  </div>
                  <div className="text-right">
                    Verified by: Dr. {reportDetail.report?.approved_by?.user_profile?.last_name || 'Senior Pathologist'}
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4" />
                Print Verified Report
              </button>
              <button
                onClick={() => setShowReportDetailModal(false)}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 12: OUTSOURCED DISPATCH */}
      {showDispatchModal && (
        <Modal
          isOpen={showDispatchModal}
          onClose={() => setShowDispatchModal(false)}
          title={`Dispatch Sample to External Partner — Order ${selectedOrder?.order_number}`}
        >
          <form onSubmit={handleDispatchOutsourced} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Courier Tracking / Waybill / External Reference #:
              </label>
              <Input
                value={dispatchRef}
                onChange={(e) => setDispatchRef(e.target.value)}
                placeholder="e.g. BLUEDART-AIR-789012"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Expected Turnaround (Days):
              </label>
              <Input
                type="number"
                value={dispatchTat}
                onChange={(e) => setDispatchTat(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold"
              >
                Confirm Dispatch
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 13: OUTSOURCED RECEIVE RESULTS */}
      {showReceiveModal && (
        <Modal
          isOpen={showReceiveModal}
          onClose={() => setShowReceiveModal(false)}
          title={`Receive External Findings — Order ${selectedOrder?.order_number}`}
        >
          <form onSubmit={handleReceiveOutsourced} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                External Diagnostic Expense / Hospital Cost (₹):
              </label>
              <Input
                type="number"
                value={externalCost}
                onChange={(e) => setExternalCost(e.target.value)}
                placeholder="1400.00"
                required
              />
              <span className="block text-[11px] text-slate-400 mt-0.5">
                Kept separate from patient billing to accurately record hospital diagnostic expense.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Secure External PDF Report Link:
              </label>
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://storage.hospital.local/reports/external-biopsy-101.pdf"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                External Pathologist Findings / Conclusion:
              </label>
              <textarea
                value={externalResult}
                onChange={(e) => setExternalResult(e.target.value)}
                rows={3}
                placeholder="Histopathological findings, immunohistochemistry markers..."
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
              >
                Record External Result & Hospital Expense
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
