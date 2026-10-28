import React, { useState, useEffect } from 'react';
import {
  Pill,
  ShoppingBag,
  Plus,
  CheckCircle,
  AlertTriangle,
  Search,
  FileText,
  Barcode,
  RotateCcw,
  Hospital,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { pharmacyService } from '../../services/api';
import { parseApiError } from '../../utils/errorHandler';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { Input } from '../../components/common/Input';
import { AlertBanner } from '../../components/common/AlertBanner';
import { useBranch } from '../../context/BranchContext';

interface MedicineRecord {
  id: string;
  code: string;
  generic_name: string;
  brand_name: string;
  category: string;
  dosage_form: string;
  strength: string;
  unit_of_measure: string;
  min_stock_level: number;
  max_stock_level: number;
  reorder_level: number;
  purchase_cost: string;
  selling_price: string;
  total_stock: number;
  is_active: boolean;
  batches: {
    id: string;
    batch_number: string;
    expiry_date: string;
    quantity_in_stock: number;
    unit_selling_price: string;
    is_expired?: boolean;
    storage_location?: string;
  }[];
}

interface PrescriptionRecord {
  id: string;
  prescription_number: string;
  patient_id?: string;
  patient_name: string;
  patient_mrn: string;
  doctor_name: string;
  diagnosis: string;
  is_dispensed: boolean;
  dispense_status?: string;
  created_at: string;
  items: {
    id: string;
    medicine?: string;
    medicine_name: string;
    generic_name: string;
    dosage: string;
    frequency: string;
    duration_days: number;
    total_quantity: number;
    dispensed_quantity?: number;
  }[];
}

interface ReturnRecord {
  id: string;
  return_number: string;
  patient_name: string;
  medicine_name: string;
  batch_number: string;
  quantity: number;
  reason: string;
  disposition: string;
  created_at: string;
}

export const PharmacyPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'ipd_issue' | 'formulary' | 'returns' | 'alerts'>('prescriptions');
  const [medicines, setMedicines] = useState<MedicineRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [returnsList, setReturnsList] = useState<ReturnRecord[]>([]);
  const [alertsData, setAlertsData] = useState<{ low_stock_items: any[]; expiring_batches: any[]; expired_batches: any[] }>({
    low_stock_items: [],
    expiring_batches: [],
    expired_batches: [],
  });
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Barcode Scanner & Lookup
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [barcodeResult, setBarcodeResult] = useState<any | null>(null);
  const [barcodeSearching, setBarcodeSearching] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  // Dispense modal
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [selectedRx, setSelectedRx] = useState<PrescriptionRecord | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [dispenseQty, setDispenseQty] = useState(1);
  const [dispenseNotes, setDispenseNotes] = useState('');
  const [dispenseError, setDispenseError] = useState<string | null>(null);
  const [dispenseSuccess, setDispenseSuccess] = useState<string | null>(null);
  const [submittingDispense, setSubmittingDispense] = useState(false);

  // IPD Issue state
  const [ipdAdmissionId, setIpdAdmissionId] = useState('');
  const [ipdWard, setIpdWard] = useState('General Ward 2B');
  const [ipdNurse, setIpdNurse] = useState('');
  const [ipdMedicineId, setIpdMedicineId] = useState('');
  const [ipdBatchId, setIpdBatchId] = useState('');
  const [ipdQuantity, setIpdQuantity] = useState(1);
  const [ipdNotes, setIpdNotes] = useState('');
  const [ipdStatus, setIpdStatus] = useState<{ error?: string; success?: string }>({});
  const [submittingIpd, setSubmittingIpd] = useState(false);

  // Catalogue Item Creation modal
  const [showCatalogueModal, setShowCatalogueModal] = useState(false);
  const [newMedCode, setNewMedCode] = useState('');
  const [newMedBrand, setNewMedBrand] = useState('');
  const [newMedGeneric, setNewMedGeneric] = useState('');
  const [newMedCategory, setNewMedCategory] = useState('MEDICINE');
  const [newMedDosage, setNewMedDosage] = useState('TABLET');
  const [newMedStrength, setNewMedStrength] = useState('');
  const [newMedUnit, setNewMedUnit] = useState('TAB');
  const [newMedPurchaseCost, setNewMedPurchaseCost] = useState('10.00');
  const [newMedSellingPrice, setNewMedSellingPrice] = useState('15.00');
  const [newMedMinStock, setNewMedMinStock] = useState(50);
  const [newMedMaxStock, setNewMedMaxStock] = useState(500);
  const [catalogueSubmitting, setCatalogueSubmitting] = useState(false);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);

  // Return modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnPatientName, setReturnPatientName] = useState('');
  const [returnMedId, setReturnMedId] = useState('');
  const [returnBatchId, setReturnBatchId] = useState('');
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('THERAPY_STOPPED');
  const [returnDisposition, setReturnDisposition] = useState<'RESTOCK' | 'DISCARD'>('RESTOCK');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [medData, rxData, retData, alrtData] = await Promise.all([
        pharmacyService.getMedicines({ branch_id: currentBranch?.id }),
        pharmacyService.getPrescriptions({ branch_id: currentBranch?.id }),
        pharmacyService.getReturns ? pharmacyService.getReturns().catch(() => []) : Promise.resolve([]),
        pharmacyService.getReorderAlerts ? pharmacyService.getReorderAlerts(currentBranch?.id).catch(() => ({ low_stock_items: [], expiring_batches: [], expired_batches: [] })) : Promise.resolve({ low_stock_items: [], expiring_batches: [], expired_batches: [] }),
      ]);
      setMedicines(Array.isArray(medData) ? medData : medData?.results || []);
      setPrescriptions(Array.isArray(rxData) ? rxData : rxData?.results || []);
      setReturnsList(Array.isArray(retData) ? retData : retData?.results || []);
      const safeAlerts = {
        low_stock_items: Array.isArray(alrtData?.low_stock_items) ? alrtData.low_stock_items : (Array.isArray(alrtData?.alerts) ? alrtData.alerts : []),
        expiring_batches: Array.isArray(alrtData?.expiring_batches) ? alrtData.expiring_batches : [],
        expired_batches: Array.isArray(alrtData?.expired_batches) ? alrtData.expired_batches : [],
      };
      setAlertsData(safeAlerts);
    } catch (err) {
      console.error('Failed to load pharmacy data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentBranch?.id]);

  // Barcode Lookup Handler
  const handleBarcodeScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!barcodeQuery.trim()) return;
    setBarcodeSearching(true);
    setBarcodeError(null);
    setBarcodeResult(null);
    try {
      const res = await pharmacyService.lookupBarcode(barcodeQuery.trim());
      setBarcodeResult(res);
    } catch (err: any) {
      setBarcodeError(parseApiError(err).message);
    } finally {
      setBarcodeSearching(false);
    }
  };

  // Prescription Dispensing Submission
  const handleDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispenseError(null);
    setDispenseSuccess(null);
    if (!selectedBatchId) {
      setDispenseError('Please select a valid, unexpired stock batch.');
      return;
    }
    setSubmittingDispense(true);
    try {
      const currentItem = selectedRx?.items[selectedItemIndex];
      await pharmacyService.dispenseMedication({
        patient_id: selectedRx?.patient_id,
        prescription_id: selectedRx?.id,
        items: [
          {
            batch_id: selectedBatchId,
            medicine_id: currentItem?.medicine,
            quantity: dispenseQty,
          },
        ],
        notes: dispenseNotes || `Dispensed via Pharmacy Workstation for Rx ${selectedRx?.prescription_number}`,
      });
      setDispenseSuccess('Medication dispensed successfully! Stock deducted atomically and patient invoice synchronized.');
      setTimeout(() => {
        setShowDispenseModal(false);
        setSelectedRx(null);
        setDispenseSuccess(null);
        fetchData();
      }, 1400);
    } catch (err: any) {
      setDispenseError(parseApiError(err).message);
    } finally {
      setSubmittingDispense(false);
    }
  };

  // IPD Medication Issue Submission
  const handleIssueIPD = async (e: React.FormEvent) => {
    e.preventDefault();
    setIpdStatus({});
    if (!ipdAdmissionId.trim()) {
      setIpdStatus({ error: 'Please enter a valid Inpatient Admission ID or Patient MRN.' });
      return;
    }
    if (!ipdBatchId) {
      setIpdStatus({ error: 'Please select an active stock batch.' });
      return;
    }
    setSubmittingIpd(true);
    try {
      await pharmacyService.issueIPDMedication({
        admission_id: ipdAdmissionId,
        ward_location: ipdWard,
        recipient_nurse: ipdNurse || 'Nurse on Duty',
        batch_id: ipdBatchId,
        quantity: ipdQuantity,
        notes: ipdNotes || `Routine IPD ward stock issue to ${ipdWard}`,
      });
      setIpdStatus({ success: `Successfully issued ${ipdQuantity} unit(s) to ${ipdWard}! Stock deducted and recorded.` });
      setIpdAdmissionId('');
      setIpdNotes('');
      fetchData();
    } catch (err: any) {
      setIpdStatus({ error: parseApiError(err).message });
    } finally {
      setSubmittingIpd(false);
    }
  };

  // Catalogue Item Creation
  const handleCreateCatalogueItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatalogueError(null);
    setCatalogueSubmitting(true);
    try {
      await pharmacyService.createMedicine({
        code: newMedCode.toUpperCase(),
        brand_name: newMedBrand,
        generic_name: newMedGeneric,
        category: newMedCategory,
        dosage_form: newMedDosage,
        strength: newMedStrength,
        unit_of_measure: newMedUnit,
        purchase_cost: newMedPurchaseCost,
        selling_price: newMedSellingPrice,
        min_stock_level: newMedMinStock,
        max_stock_level: newMedMaxStock,
        branch_id: currentBranch?.id,
      });
      setShowCatalogueModal(false);
      setNewMedCode('');
      setNewMedBrand('');
      setNewMedGeneric('');
      setNewMedStrength('');
      fetchData();
    } catch (err: any) {
      setCatalogueError(parseApiError(err).message);
    } finally {
      setCatalogueSubmitting(false);
    }
  };

  // Patient Return Submission
  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturnSubmitting(true);
    try {
      await pharmacyService.createReturn({
        patient_name: returnPatientName,
        medicine_id: returnMedId,
        batch_id: returnBatchId,
        quantity: returnQty,
        reason: returnReason,
        disposition: returnDisposition,
      });
      setShowReturnModal(false);
      setReturnPatientName('');
      fetchData();
    } catch (err) {
      console.error('Failed to create return:', err);
    } finally {
      setReturnSubmitting(false);
    }
  };

  // Formulary columns
  const medicineColumns: Column<MedicineRecord>[] = [
    {
      key: 'code',
      header: 'Drug / Item Code',
      render: (m) => <span className="font-mono text-cyan-400 font-semibold">{m.code}</span>,
    },
    {
      key: 'brand_name',
      header: 'Brand & Generic Formulation',
      render: (m) => (
        <div>
          <div className="font-bold text-white text-sm flex items-center gap-2">
            {m.brand_name}
            {m.category === 'CONSUMABLE' && (
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                Consumable
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            {m.generic_name} {m.strength ? `(${m.strength})` : ''} • {m.dosage_form}
          </div>
        </div>
      ),
    },
    {
      key: 'pricing',
      header: 'Pricing & Unit',
      render: (m) => (
        <div className="text-xs">
          <div className="text-emerald-400 font-semibold font-mono">₹{m.selling_price || '0.00'} / {m.unit_of_measure || 'unit'}</div>
          <div className="text-slate-500 text-[10px] font-mono">Cost: ₹{m.purchase_cost || '0.00'}</div>
        </div>
      ),
    },
    {
      key: 'batches',
      header: 'Active Batches & Expiry (FEFO)',
      render: (m) => (
        <div className="space-y-1 max-w-xs">
          {m.batches && m.batches.length > 0 ? (
            m.batches.slice(0, 3).map((b) => {
              const isExpired = b.is_expired || new Date(b.expiry_date) < new Date();
              return (
                <div
                  key={b.id}
                  className={`text-[11px] font-mono flex items-center justify-between gap-2 px-2 py-0.5 rounded ${
                    isExpired ? 'bg-rose-950/60 text-rose-300 border border-rose-800' : 'bg-slate-950/80 text-slate-300'
                  }`}
                >
                  <span className="font-medium text-white">{b.batch_number}</span>
                  <span className={isExpired ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                    Exp: {b.expiry_date}
                  </span>
                  <span className="text-cyan-400 font-bold">{b.quantity_in_stock} units</span>
                </div>
              );
            })
          ) : (
            <span className="text-xs text-slate-500 italic">No active batches</span>
          )}
          {m.batches && m.batches.length > 3 && (
            <div className="text-[10px] text-slate-500 font-mono">+{m.batches.length - 3} more batches</div>
          )}
        </div>
      ),
    },
    {
      key: 'total_stock',
      header: 'Usable Stock & Level',
      render: (m) => {
        const minLevel = m.min_stock_level || m.reorder_level || 20;
        const isLow = m.total_stock <= minLevel;
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={`font-mono font-bold text-sm ${isLow ? 'text-rose-400' : 'text-emerald-400'}`}>
                {m.total_stock}
              </span>
              <span className="text-xs text-slate-400">{m.unit_of_measure || 'units'}</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Min: {minLevel} | Max: {m.max_stock_level || 500}
            </div>
            {isLow && <Badge variant="danger" size="sm">Low Stock</Badge>}
          </div>
        );
      },
    },
  ];

  // Prescription columns
  const rxColumns: Column<PrescriptionRecord>[] = [
    {
      key: 'prescription_number',
      header: 'Rx Code',
      render: (p) => <span className="font-mono text-cyan-400 font-bold">{p.prescription_number}</span>,
    },
    {
      key: 'patient_name',
      header: 'Patient Details',
      render: (p) => (
        <div>
          <div className="font-semibold text-white">{p.patient_name}</div>
          <div className="text-[11px] text-slate-400 font-mono">MRN: {p.patient_mrn}</div>
        </div>
      ),
    },
    {
      key: 'doctor_name',
      header: 'Prescribing Doctor',
      render: (p) => <span className="text-slate-200 text-xs font-medium">Dr. {p.doctor_name}</span>,
    },
    {
      key: 'items',
      header: 'Prescribed Regimen',
      render: (p) => (
        <div className="space-y-1">
          {p.items?.map((item, idx) => (
            <div key={idx} className="text-xs text-slate-300">
              <span className="font-semibold text-white">{item.medicine_name}</span> — {item.dosage} ({item.frequency}) × {item.duration_days}d
              <span className="ml-2 font-mono text-cyan-400 font-bold">Qty: {item.total_quantity}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'is_dispensed',
      header: 'Dispense Status',
      render: (p) => (
        <Badge variant={p.is_dispensed ? 'success' : 'warning'}>
          {p.is_dispensed ? 'Fully Dispensed' : 'Pending Dispense'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (p) => (
        <div>
          {!p.is_dispensed ? (
            <button
              onClick={() => {
                setSelectedRx(p);
                setSelectedItemIndex(0);
                setDispenseError(null);
                setDispenseSuccess(null);
                // Attempt to pick first valid batch for the first medicine
                const firstItem = p.items?.[0];
                const matchedMed = medicines.find(
                  (m) =>
                    m.id === firstItem?.medicine ||
                    m.brand_name.toLowerCase() === firstItem?.medicine_name?.toLowerCase()
                );
                if (matchedMed && matchedMed.batches?.length > 0) {
                  // pick first non-expired batch
                  const validBatch = matchedMed.batches.find((b) => !b.is_expired);
                  if (validBatch) setSelectedBatchId(validBatch.id);
                } else {
                  setSelectedBatchId('');
                }
                setDispenseQty(firstItem?.total_quantity || 1);
                setShowDispenseModal(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition flex items-center gap-1.5 shadow-sm"
            >
              <Pill className="w-3.5 h-3.5" />
              Dispense Rx
            </button>
          ) : (
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Completed
            </span>
          )}
        </div>
      ),
    },
  ];

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Pharmacy & Clinical Medication Dispensing
              </h1>
              <p className="text-xs text-slate-400">
                FEFO-ordered stock batches, electronic prescription verification, IPD ward issues, and barcode scanning.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCatalogueModal(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            Add Formulary Item
          </button>
          <button
            onClick={() => setShowReturnModal(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            Patient Return
          </button>
          <button
            onClick={fetchData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barcode Quick Scan Radar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-cyan-500/20 shadow-lg">
        <form onSubmit={handleBarcodeScan} className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs whitespace-nowrap">
            <Barcode className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span>Barcode Scanner / Item Lookup:</span>
          </div>
          <div className="flex-1 w-full relative">
            <input
              type="text"
              placeholder="Scan or type Item Code / Batch Barcode (e.g. MED-001 or BATCH-MED001-01)..."
              value={barcodeQuery}
              onChange={(e) => setBarcodeQuery(e.target.value)}
              className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={barcodeSearching}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 whitespace-nowrap"
          >
            {barcodeSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Lookup Stock
          </button>
        </form>

        {barcodeError && (
          <div className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> {barcodeError}
          </div>
        )}

        {barcodeResult && (
          <div className="mt-3 p-3 bg-slate-950/80 border border-cyan-500/30 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
            <div>
              <span className="text-slate-400">Match Found: </span>
              <strong className="text-white font-mono">{barcodeResult.code}</strong> —{' '}
              <span className="text-cyan-400 font-bold">{barcodeResult.name}</span>
            </div>
            <div>
              <span className="text-slate-400">Category: </span>
              <span className="text-slate-200">{barcodeResult.category}</span>
            </div>
            <div>
              <span className="text-slate-400">Unit Price: </span>
              <span className="text-emerald-400 font-mono font-bold">₹{barcodeResult.selling_price}</span>
            </div>
            <div>
              <span className="text-slate-400">Available Stock: </span>
              <span className="text-cyan-300 font-mono font-bold">{barcodeResult.available_stock} units</span>
            </div>
            {barcodeResult.batch && (
              <div className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                Batch: {barcodeResult.batch.batch_number} (Exp: {barcodeResult.batch.expiry_date})
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Formulary Items"
          value={medicines.length.toString()}
          icon={Pill}
          subtitle="Active medicines & consumables"
        />
        <StatCard
          title="Stock Batches"
          value={medicines.reduce((acc, m) => acc + (m.batches?.length || 0), 0).toString()}
          icon={ShoppingBag}
          subtitle="FEFO tracked inventory"
        />
        <StatCard
          title="Prescriptions Pending"
          value={prescriptions.filter((p) => !p.is_dispensed).length.toString()}
          icon={AlertTriangle}
          subtitle="Awaiting pharmacy issue"
        />
        <StatCard
          title="Reorder & Expiry Alerts"
          value={((alertsData?.low_stock_items?.length || 0) + (alertsData?.expiring_batches?.length || 0) + (alertsData?.expired_batches?.length || 0)).toString()}
          icon={ShieldAlert}
          subtitle="Immediate attention required"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('prescriptions')}
          className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 rounded-xl ${
            activeTab === 'prescriptions'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Prescription Dispensing ({prescriptions.filter((p) => !p.is_dispensed).length})
        </button>
        <button
          onClick={() => setActiveTab('ipd_issue')}
          className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 rounded-xl ${
            activeTab === 'ipd_issue'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Hospital className="w-4 h-4" />
          IPD Ward Medication Issues
        </button>
        <button
          onClick={() => setActiveTab('formulary')}
          className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 rounded-xl ${
            activeTab === 'formulary'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Pill className="w-4 h-4" />
          Drug Formulary & Catalogue ({medicines.length})
        </button>
        <button
          onClick={() => setActiveTab('returns')}
          className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 rounded-xl ${
            activeTab === 'returns'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Patient Returns & Quarantine ({returnsList.length})
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-2 rounded-xl ${
            activeTab === 'alerts'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          Stock & Expiry Alerts ({(alertsData?.low_stock_items?.length || 0) + (alertsData?.expiring_batches?.length || 0)})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'prescriptions' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <DataTable
            data={prescriptions}
            columns={rxColumns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search prescriptions by Rx code, patient name, or MRN..."
            pageSize={10}
          />
        </div>
      )}

      {activeTab === 'ipd_issue' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="max-w-2xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Hospital className="w-5 h-5 text-cyan-400" />
              Inpatient (IPD) Ward Medication Issue
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Issue verified medication stock directly to inpatient wards and emergency bays.
            </p>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>Clinical Accountability Notice:</strong> Issuing medicine from pharmacy stock deducts inventory and posts to the inpatient billing record. Medication is marked as <em>Administered</em> only after the ward nurse records MAR execution.
            </span>
          </div>

          {ipdStatus.error && <AlertBanner variant="error" title="Issue Error" message={ipdStatus.error} />}
          {ipdStatus.success && <AlertBanner variant="success" title="Stock Issued" message={ipdStatus.success} />}

          <form onSubmit={handleIssueIPD} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            <Input
              label="Inpatient Admission ID / Patient MRN"
              placeholder="e.g. ADM-2026-001 or MRN-9021"
              value={ipdAdmissionId}
              onChange={(e) => setIpdAdmissionId(e.target.value)}
              required
            />

            <Select
              label="Destination Ward / Department"
              value={ipdWard}
              onChange={(e) => setIpdWard(e.target.value)}
              options={[
                { value: 'General Ward 2B', label: 'General Ward 2B' },
                { value: 'Intensive Care Unit (ICU)', label: 'Intensive Care Unit (ICU)' },
                { value: 'Emergency Department', label: 'Emergency Department' },
                { value: 'Pediatric Ward 4A', label: 'Pediatric Ward 4A' },
                { value: 'Operation Theatre Recovery', label: 'Operation Theatre Recovery' },
              ]}
              required
            />

            <Input
              label="Recipient Ward Nurse / Staff Name"
              placeholder="Nurse on duty name"
              value={ipdNurse}
              onChange={(e) => setIpdNurse(e.target.value)}
              required
            />

            <Select
              label="Select Medicine & Formulation"
              value={ipdMedicineId}
              onChange={(e) => {
                setIpdMedicineId(e.target.value);
                const med = medicines.find((m) => m.id === e.target.value);
                if (med && med.batches?.length > 0) {
                  const firstValid = med.batches.find((b) => !b.is_expired) || med.batches[0];
                  setIpdBatchId(firstValid.id);
                } else {
                  setIpdBatchId('');
                }
              }}
              options={[
                { value: '', label: '-- Select Medication --' },
                ...medicines.map((m) => ({
                  value: m.id,
                  label: `${m.brand_name} (${m.generic_name} ${m.strength || ''}) — Total Avail: ${m.total_stock}`,
                })),
              ]}
              required
            />

            <Select
              label="Stock Batch (FEFO Order)"
              value={ipdBatchId}
              onChange={(e) => setIpdBatchId(e.target.value)}
              options={
                ipdMedicineId
                  ? (medicines.find((m) => m.id === ipdMedicineId)?.batches || []).map((b) => ({
                      value: b.id,
                      label: `Batch ${b.batch_number} (Exp: ${b.expiry_date}, Avail: ${b.quantity_in_stock} units)`,
                    }))
                  : [{ value: '', label: 'Select a medicine first' }]
              }
              required
            />

            <Input
              label="Quantity to Issue"
              type="number"
              value={ipdQuantity}
              onChange={(e) => setIpdQuantity(parseInt(e.target.value) || 1)}
              min={1}
              required
            />

            <div className="md:col-span-2">
              <Input
                label="Ward Issue Remarks / Clinical Instructions"
                placeholder="e.g. Stat dose required for post-op ICU bed 4"
                value={ipdNotes}
                onChange={(e) => setIpdNotes(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={submittingIpd}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center gap-2"
              >
                {submittingIpd ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Hospital className="w-4 h-4" />}
                Confirm IPD Stock Issue & Sync Charges
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'formulary' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <DataTable
            data={medicines}
            columns={medicineColumns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search medicines or consumables by brand or generic name..."
            pageSize={10}
          />
        </div>
      )}

      {activeTab === 'returns' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Medication Returns & Inspection Quarantine
              </h3>
              <p className="text-xs text-slate-400">
                Only items passing strict clinical inspection are restocked. Damaged or opened stock is quarantined or safely destroyed.
              </p>
            </div>
            <button
              onClick={() => setShowReturnModal(true)}
              className="px-3.5 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-cyan-400 transition"
            >
              <Plus className="w-4 h-4" /> Record New Return
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">Return #</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Medicine & Batch</th>
                  <th className="p-3">Qty</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Clinical Disposition</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {returnsList.length > 0 ? (
                  returnsList.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono text-cyan-400 font-semibold">{r.return_number || `RET-${r.id.substring(0, 6)}`}</td>
                      <td className="p-3 font-medium text-white">{r.patient_name || 'Walk-in Patient'}</td>
                      <td className="p-3">
                        {r.medicine_name} <span className="font-mono text-slate-500 text-[10px]">({r.batch_number})</span>
                      </td>
                      <td className="p-3 font-mono font-bold text-white">{r.quantity}</td>
                      <td className="p-3 text-slate-400">{r.reason}</td>
                      <td className="p-3">
                        <Badge variant={r.disposition === 'RESTOCK' ? 'success' : 'danger'}>
                          {r.disposition === 'RESTOCK' ? 'Restocked to Inventory' : 'Quarantined / Destroyed'}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-slate-400">{r.created_at?.split('T')[0] || 'Today'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No medication returns recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low Stock Alerts */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Low Stock & Reorder Threshold Alerts ({alertsData?.low_stock_items?.length || 0})
            </h3>
            <div className="space-y-3">
              {(alertsData?.low_stock_items?.length || 0) > 0 ? (
                (alertsData?.low_stock_items || []).map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/30 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-white font-bold text-sm">{item.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Code: {item.code} • Min Level: {item.min_stock_level}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-rose-400 font-mono font-bold text-sm">
                        {item.current_stock} {item.unit || 'units'}
                      </div>
                      <span className="text-[10px] text-amber-400 font-medium">Reorder Urgently</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs">
                  All active items are safely above minimum thresholds.
                </div>
              )}
            </div>
          </div>

          {/* Expiry Alerts */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Expiry Radar: Approaching & Expired Batches ({(alertsData?.expiring_batches?.length || 0) + (alertsData?.expired_batches?.length || 0)})
            </h3>
            <div className="space-y-3">
              {(alertsData?.expired_batches || []).map((batch: any, idx: number) => (
                <div
                  key={`exp-${idx}`}
                  className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-600/50 flex items-center justify-between"
                >
                  <div>
                    <div className="text-white font-bold text-sm">{batch.medicine_name}</div>
                    <div className="text-[11px] font-mono text-rose-300">
                      Batch: {batch.batch_number} • Expired: {batch.expiry_date}
                    </div>
                  </div>
                  <Badge variant="danger">BLOCKED FROM DISPENSING</Badge>
                </div>
              ))}

              {(alertsData?.expiring_batches || []).map((batch: any, idx: number) => (
                <div
                  key={`warn-${idx}`}
                  className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-600/40 flex items-center justify-between"
                >
                  <div>
                    <div className="text-white font-bold text-sm">{batch.medicine_name}</div>
                    <div className="text-[11px] font-mono text-amber-300">
                      Batch: {batch.batch_number} • Expiring: {batch.expiry_date}
                    </div>
                  </div>
                  <Badge variant="warning">Expiring in &lt;60 Days</Badge>
                </div>
              ))}

              {(alertsData?.expiring_batches?.length || 0) === 0 && (alertsData?.expired_batches?.length || 0) === 0 && (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No stock batches approaching expiration.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dispense Modal */}
      {selectedRx && (
        <Modal
          isOpen={showDispenseModal}
          onClose={() => setShowDispenseModal(false)}
          title={`Dispense Prescription: ${selectedRx.prescription_number}`}
          size="lg"
        >
          <form onSubmit={handleDispense} className="space-y-4">
            {dispenseError && <AlertBanner variant="error" title="Dispensing Blocked" message={dispenseError} />}
            {dispenseSuccess && <AlertBanner variant="success" title="Dispensed" message={dispenseSuccess} />}

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Patient:</span>
                <span className="text-white font-bold">{selectedRx.patient_name} (MRN: {selectedRx.patient_mrn})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Prescribing Doctor:</span>
                <span className="text-slate-200">Dr. {selectedRx.doctor_name}</span>
              </div>
              {selectedRx.diagnosis && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Clinical Diagnosis:</span>
                  <span className="text-slate-300">{selectedRx.diagnosis}</span>
                </div>
              )}
            </div>

            {/* Prescribed Items Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Select Prescribed Item:</label>
              <div className="space-y-2">
                {selectedRx.items?.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedItemIndex(idx);
                      // find matching medicine batches
                      const med = medicines.find(
                        (m) =>
                          m.id === item.medicine ||
                          m.brand_name.toLowerCase() === item.medicine_name.toLowerCase()
                      );
                      if (med && med.batches?.length > 0) {
                        const valid = med.batches.find((b) => !b.is_expired) || med.batches[0];
                        setSelectedBatchId(valid.id);
                      }
                      setDispenseQty(item.total_quantity || 1);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition text-xs flex items-center justify-between ${
                      selectedItemIndex === idx
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <strong className="text-white">{item.medicine_name}</strong> — {item.dosage} ({item.frequency})
                    </div>
                    <div className="font-mono text-cyan-400 font-bold">Prescribed: {item.total_quantity}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Batch Selection with FEFO Order & Expiry Badge */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Active Usable Batch (FEFO Sorted):
              </label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                required
              >
                <option value="">-- Choose Stock Batch --</option>
                {medicines
                  .flatMap((m) =>
                    (m.batches || []).map((b) => {
                      const isExp = b.is_expired || new Date(b.expiry_date) < new Date();
                      return {
                        id: b.id,
                        label: `${m.brand_name} • Batch ${b.batch_number} (Exp: ${b.expiry_date}) — Avail: ${b.quantity_in_stock} units [₹${b.unit_selling_price}] ${isExp ? 'EXPIRED' : ''}`,
                        isExpired: isExp,
                      };
                    })
                  )
                  .map((opt) => (
                    <option key={opt.id} value={opt.id} disabled={opt.isExpired}>
                      {opt.label}
                    </option>
                  ))}
              </select>
            </div>

            <Input
              label="Quantity to Dispense"
              type="number"
              value={dispenseQty}
              onChange={(e) => setDispenseQty(parseInt(e.target.value) || 1)}
              min={1}
              required
            />

            <Input
              label="Dispensing Notes"
              placeholder="e.g. Verified prescription, instructed patient on post-meal administration"
              value={dispenseNotes}
              onChange={(e) => setDispenseNotes(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDispenseModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingDispense}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition flex items-center gap-1.5"
              >
                {submittingDispense ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Confirm Dispensing & Sync Invoice
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Catalogue Item Modal */}
      <Modal
        isOpen={showCatalogueModal}
        onClose={() => setShowCatalogueModal(false)}
        title="Add Medicine / Consumable to Formulary"
        size="md"
      >
        <form onSubmit={handleCreateCatalogueItem} className="space-y-4">
          {catalogueError && <AlertBanner variant="error" title="Validation Error" message={catalogueError} />}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Item Code"
              placeholder="e.g. MED-005 or CONS-012"
              value={newMedCode}
              onChange={(e) => setNewMedCode(e.target.value)}
              required
            />
            <Select
              label="Category"
              value={newMedCategory}
              onChange={(e) => setNewMedCategory(e.target.value)}
              options={[
                { value: 'MEDICINE', label: 'Medicine / Pharmaceutical' },
                { value: 'CONSUMABLE', label: 'Hospital Consumable' },
                { value: 'EQUIPMENT', label: 'Medical Equipment / Device' },
              ]}
              required
            />
          </div>

          <Input
            label="Brand Name"
            placeholder="e.g. Amoxiclav 625mg or Sterile Surgical Gloves"
            value={newMedBrand}
            onChange={(e) => setNewMedBrand(e.target.value)}
            required
          />

          <Input
            label="Generic / Chemical Name"
            placeholder="e.g. Amoxicillin + Clavulanic Acid"
            value={newMedGeneric}
            onChange={(e) => setNewMedGeneric(e.target.value)}
            required
          />

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Dosage Form"
              placeholder="e.g. TABLET, SYRUP"
              value={newMedDosage}
              onChange={(e) => setNewMedDosage(e.target.value)}
              required
            />
            <Input
              label="Strength"
              placeholder="e.g. 625mg"
              value={newMedStrength}
              onChange={(e) => setNewMedStrength(e.target.value)}
            />
            <Input
              label="Dispensing Unit"
              placeholder="e.g. TAB, BOTTLE, PAIR"
              value={newMedUnit}
              onChange={(e) => setNewMedUnit(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Purchase Cost (₹)"
              type="number"
              step="0.01"
              value={newMedPurchaseCost}
              onChange={(e) => setNewMedPurchaseCost(e.target.value)}
              required
            />
            <Input
              label="Selling Price (₹)"
              type="number"
              step="0.01"
              value={newMedSellingPrice}
              onChange={(e) => setNewMedSellingPrice(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Min Stock Threshold"
              type="number"
              value={newMedMinStock}
              onChange={(e) => setNewMedMinStock(parseInt(e.target.value) || 10)}
              required
            />
            <Input
              label="Max Stock Level"
              type="number"
              value={newMedMaxStock}
              onChange={(e) => setNewMedMaxStock(parseInt(e.target.value) || 100)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowCatalogueModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={catalogueSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition"
            >
              {catalogueSubmitting ? 'Creating...' : 'Create Catalogue Item'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Patient Return Modal */}
      <Modal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Record Medication Return"
        size="md"
      >
        <form onSubmit={handleCreateReturn} className="space-y-4">
          <Input
            label="Patient Name / MRN"
            placeholder="e.g. Rajesh Kumar (MRN-1002)"
            value={returnPatientName}
            onChange={(e) => setReturnPatientName(e.target.value)}
            required
          />

          <Select
            label="Select Returned Medicine"
            value={returnMedId}
            onChange={(e) => {
              setReturnMedId(e.target.value);
              const med = medicines.find((m) => m.id === e.target.value);
              if (med && med.batches?.length > 0) {
                setReturnBatchId(med.batches[0].id);
              }
            }}
            options={[
              { value: '', label: '-- Select Item --' },
              ...medicines.map((m) => ({ value: m.id, label: m.brand_name })),
            ]}
            required
          />

          <Input
            label="Quantity Returned"
            type="number"
            value={returnQty}
            onChange={(e) => setReturnQty(parseInt(e.target.value) || 1)}
            min={1}
            required
          />

          <Select
            label="Return Reason"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            options={[
              { value: 'THERAPY_STOPPED', label: 'Therapy discontinued by doctor' },
              { value: 'ADVERSE_EFFECT', label: 'Adverse effect / Intolerance' },
              { value: 'EXCESS_DISPENSED', label: 'Excess quantity returned unopened' },
              { value: 'PATIENT_DISCHARGED', label: 'Early inpatient discharge' },
            ]}
            required
          />

          <Select
            label="Inspection Disposition"
            value={returnDisposition}
            onChange={(e) => setReturnDisposition(e.target.value as any)}
            options={[
              { value: 'RESTOCK', label: 'Approved for Restock (Unopened & Uncompromised)' },
              { value: 'DISCARD', label: 'Quarantine & Discard (Opened / Compromised)' },
            ]}
            required
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowReturnModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={returnSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition"
            >
              {returnSubmitting ? 'Recording...' : 'Process Return'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PharmacyPage;
