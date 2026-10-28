import React, { useState, useEffect } from 'react';
import {
  Bed as BedIcon,
  Building2,
  UserPlus,
  LogOut,
  CheckCircle,
  Clock,
  FileText,
  Activity,
  ArrowRightLeft,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  CheckSquare,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  CreditCard,
  HeartCrack,
  Sparkles,
  Layers,
  XCircle,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { ipdService, authService } from '../../services/api';
import { parseApiError } from '../../utils/errorHandler';
import {
  InpatientAdmission,
  Bed,
  Ward,
  PatientTransferRecord,
  EmergencyIPDDashboardStats,
  InpatientRunningBill,
  PatientProfile,
  StaffProfile,
} from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { Input } from '../../components/common/Input';
import { AlertBanner } from '../../components/common/AlertBanner';
import { useBranch } from '../../context/BranchContext';

export const AdmissionsPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'census' | 'admissions' | 'transfers' | 'running_bills' | 'discharge' | 'reports'
  >('dashboard');

  // Main data states
  const [dashboardStats, setDashboardStats] = useState<EmergencyIPDDashboardStats | null>(null);
  const [admissions, setAdmissions] = useState<InpatientAdmission[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [transfers, setTransfers] = useState<PatientTransferRecord[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Reference data
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [doctors, setDoctors] = useState<StaffProfile[]>([]);

  // Filter states
  const [admissionStatusFilter, setAdmissionStatusFilter] = useState('ALL');
  const [wardFilter, setWardFilter] = useState('ALL');

  // Alerts
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  // Modals
  const [showRequestAdmissionModal, setShowRequestAdmissionModal] = useState(false);
  const [showAllocateBedModal, setShowAllocateBedModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRunningBillModal, setShowRunningBillModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showDischargeClearanceModal, setShowDischargeClearanceModal] = useState(false);
  const [showFinalizeDischargeModal, setShowFinalizeDischargeModal] = useState(false);

  // Selected item states
  const [selectedAdmission, setSelectedAdmission] = useState<InpatientAdmission | null>(null);
  const [activeRunningBill, setActiveRunningBill] = useState<InpatientRunningBill | null>(null);

  // Request Admission form
  const [reqPatientId, setReqPatientId] = useState('');
  const [reqDoctorId, setReqDoctorId] = useState('');
  const [reqSource, setReqSource] = useState<'EMERGENCY' | 'OPD' | 'DIRECT' | 'TRANSFER'>('OPD');
  const [reqPriority, setReqPriority] = useState<'ROUTINE' | 'URGENT' | 'STAT_EMERGENCY'>('ROUTINE');
  const [reqWardType, setReqWardType] = useState('GENERAL');
  const [reqDiagnosis, setReqDiagnosis] = useState('');
  const [reqExpectedStayDays, setReqExpectedStayDays] = useState('4');
  const [reqDepositAmount, setReqDepositAmount] = useState('5000');

  // Allocate Bed form
  const [allocateBedId, setAllocateBedId] = useState('');

  // Transfer form
  const [transferAdmissionId, setTransferAdmissionId] = useState('');
  const [transferTargetBedId, setTransferTargetBedId] = useState('');
  const [transferReason, setTransferReason] = useState('Clinical Condition Escalation / ICU Care');
  const [transferHandoverNotes, setTransferHandoverNotes] = useState('');

  // Deposit form
  const [depositAmount, setDepositAmount] = useState('10000');
  const [depositPaymentMethod, setDepositPaymentMethod] = useState('UPI');
  const [depositReference, setDepositReference] = useState('');
  const [depositNotes, setDepositNotes] = useState('Inpatient Admission Interim Advance');

  // Discharge form
  const [dischargeCondition, setDischargeCondition] = useState('Stable & Recovered');
  const [dischargeSummary, setDischargeSummary] = useState('');
  const [followUpInstructions, setFollowUpInstructions] = useState('');

  // Fetch all core IPD data
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [dash, admList, wardList, bedList, trfList, repData] = await Promise.all([
        ipdService.getDashboardStats({ branch_id: currentBranch?.id }),
        ipdService.getAdmissions({
          status: admissionStatusFilter !== 'ALL' ? admissionStatusFilter : undefined,
          ward_id: wardFilter !== 'ALL' ? wardFilter : undefined,
        }),
        ipdService.getWards(currentBranch?.id),
        ipdService.getBeds(),
        ipdService.getTransfers(),
        ipdService.getIPDReports({ branch_id: currentBranch?.id }),
      ]);
      setDashboardStats(dash);
      setAdmissions(admList);
      setWards(wardList);
      setBeds(bedList);
      setTransfers(trfList);
      setReportsData(repData);
    } catch (err) {
      console.error('Failed to load IPD data:', err);
      triggerErrorAlert(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDropdowns = async () => {
    try {
      const [patList, docList] = await Promise.all([
        authService.getPatients({ branch_id: currentBranch?.id }),
        authService.getStaffDirectory({ branch_id: currentBranch?.id, role: 'DOCTOR' }),
      ]);
      setPatients(patList || []);
      setDoctors(docList || []);
      if (patList?.length > 0) setReqPatientId(patList[0].id);
      if (docList?.length > 0) setReqDoctorId(docList[0].id);
    } catch (err) {
      console.error('Failed to load dropdown references:', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [currentBranch?.id, admissionStatusFilter, wardFilter]);

  useEffect(() => {
    loadDropdowns();
  }, [currentBranch?.id]);

  const triggerSuccessAlert = (msg: string) => {
    setAlertSuccess(msg);
    setTimeout(() => setAlertSuccess(null), 5000);
  };

  const triggerErrorAlert = (msgOrErr: any) => {
    const msg = typeof msgOrErr === 'string' ? msgOrErr : parseApiError(msgOrErr).message;
    setAlertError(msg);
    setTimeout(() => setAlertError(null), 6000);
  };

  // Action Handlers
  const handleCreateAdmissionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertError(null);
    try {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + parseInt(reqExpectedStayDays || '4'));

      const res = await ipdService.requestAdmission({
        patient: reqPatientId,
        admitting_doctor: reqDoctorId,
        admission_source: reqSource,
        priority: reqPriority,
        requested_ward_type: reqWardType,
        initial_diagnosis: reqDiagnosis,
        expected_discharge_date: expDate.toISOString().split('T')[0],
        admission_deposit: parseFloat(reqDepositAmount || '0'),
      });

      setShowRequestAdmissionModal(false);
      setReqDiagnosis('');
      triggerSuccessAlert(`Inpatient Admission ${res.admission_number} requested successfully. Bed allocation queued.`);
      loadAllData();
    } catch (err: any) {
      triggerErrorAlert(err);
    }
  };

  const handleAllocateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmission || !allocateBedId) return;
    try {
      await ipdService.admissionAction(selectedAdmission.id, 'ALLOCATE_BED', {
        bed_id: allocateBedId,
      });
      setShowAllocateBedModal(false);
      setSelectedAdmission(null);
      setAllocateBedId('');
      triggerSuccessAlert(`Bed allocated and patient admitted to Inpatient census!`);
      loadAllData();
    } catch (err: any) {
      triggerErrorAlert(err);
    }
  };

  const handleBedTurnoverCleaned = async (bedId: string) => {
    try {
      await ipdService.bedAction(bedId, 'MARK_CLEANED');
      triggerSuccessAlert('Bed sanitized, inspected, and restored to AVAILABLE status.');
      loadAllData();
    } catch (err: any) {
      triggerErrorAlert(err);
    }
  };

  const handlePatientTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAdmissionId || !transferTargetBedId) return;
    try {
      await ipdService.transferPatient({
        admission_id: transferAdmissionId,
        target_bed_id: transferTargetBedId,
        transfer_reason: transferReason,
        clinical_handover_notes: transferHandoverNotes,
      });
      setShowTransferModal(false);
      setTransferAdmissionId('');
      setTransferTargetBedId('');
      setTransferHandoverNotes('');
      triggerSuccessAlert('Patient transferred atomically! Original bed queued for sanitization.');
      loadAllData();
    } catch (err: any) {
      triggerErrorAlert(err);
    }
  };

  const handleOpenRunningBill = async (admission: InpatientAdmission) => {
    setSelectedAdmission(admission);
    try {
      const bill = await ipdService.getRunningBill(admission.id);
      setActiveRunningBill(bill);
      setShowRunningBillModal(true);
    } catch (err: any) {
      triggerErrorAlert('Failed to load running bill.');
    }
  };

  const handleRecordDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmission) return;
    try {
      await ipdService.recordDeposit(selectedAdmission.id, {
        amount: parseFloat(depositAmount),
        payment_method: depositPaymentMethod,
        reference: depositReference,
        notes: depositNotes,
      });
      setShowDepositModal(false);
      triggerSuccessAlert(`Advance deposit of ₹${depositAmount} recorded against ${selectedAdmission.admission_number}.`);
      loadAllData();
      if (showRunningBillModal) {
        handleOpenRunningBill(selectedAdmission);
      }
    } catch (err: any) {
      triggerErrorAlert(err);
    }
  };

  const handleToggleClearance = async (
    field: 'clinical_clearance' | 'nursing_clearance' | 'pharmacy_clearance' | 'billing_clearance',
    val: boolean
  ) => {
    if (!selectedAdmission) return;
    try {
      await ipdService.admissionAction(selectedAdmission.id, 'DISCHARGE_CLEARANCE', {
        [field]: val,
      });
      const updated = { ...selectedAdmission, [field]: val };
      setSelectedAdmission(updated);
      triggerSuccessAlert(`Clearance check updated.`);
      loadAllData();
    } catch (err: any) {
      triggerErrorAlert(err);
    }
  };

  const handleFinalizeDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmission) return;
    try {
      await ipdService.admissionAction(selectedAdmission.id, 'FINALIZE_DISCHARGE', {
        discharge_condition: dischargeCondition,
        discharge_summary: dischargeSummary,
        follow_up_instructions: followUpInstructions,
      });
      setShowFinalizeDischargeModal(false);
      setShowDischargeClearanceModal(false);
      setSelectedAdmission(null);
      triggerSuccessAlert('Patient officially discharged, invoice generated, and bed released to sanitization!');
      loadAllData();
    } catch (err: any) {
      triggerErrorAlert(err);
    }
  };

  // Helper formatting
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return <Badge variant="warning">Requested</Badge>;
      case 'APPROVED':
        return <Badge variant="accent">Approved (Bed Queued)</Badge>;
      case 'ADMITTED':
        return <Badge variant="success">Admitted / Inpatient</Badge>;
      case 'AWAITING_DISCHARGE':
        return <Badge variant="warning">Awaiting Discharge</Badge>;
      case 'DISCHARGED':
        return <Badge variant="neutral">Discharged</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'STAT_EMERGENCY':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">🚨 STAT</span>;
      case 'URGENT':
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">⚠️ URGENT</span>;
      default:
        return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-300">Routine</span>;
    }
  };

  const getBedStatusBadge = (b: Bed) => {
    switch (b.status) {
      case 'AVAILABLE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Available</span>;
      case 'OCCUPIED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">Occupied</span>;
      case 'CLEANING':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">Sanitizing</span>;
      case 'MAINTENANCE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-700 text-slate-300">Maintenance</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-400">{b.status}</span>;
    }
  };

  // Eligible available beds
  const availableBeds = beds.filter((b) => b.status === 'AVAILABLE');

  // Active admitted admissions
  const activeAdmittedPatients = admissions.filter((a) => a.status === 'ADMITTED');

  // Columns for Admissions Table
  const admissionColumns: Column<InpatientAdmission>[] = [
    {
      key: 'admission_number',
      header: 'IPD Code',
      render: (a) => (
        <div>
          <span className="font-mono text-cyan-400 font-bold">{a.admission_number}</span>
          <div className="text-[10px] text-slate-500 font-medium">Src: {a.admission_source}</div>
        </div>
      ),
    },
    {
      key: 'patient_name',
      header: 'Patient & MRN',
      render: (a) => (
        <div>
          <div className="font-semibold text-white">{a.patient_name}</div>
          <div className="text-[11px] text-slate-500 font-mono">
            MRN: {a.patient_mrn} {a.patient_blood_group ? `• ${a.patient_blood_group}` : ''}
          </div>
          {a.patient_allergies && a.patient_allergies.length > 0 && (
            <div className="text-[10px] text-rose-400 mt-0.5">⚠️ Allergies: {a.patient_allergies.join(', ')}</div>
          )}
        </div>
      ),
    },
    {
      key: 'ward_bed',
      header: 'Ward / Bed Location',
      render: (a) => (
        <div>
          {a.bed_number ? (
            <div className="flex items-center gap-1.5 font-medium text-white">
              <BedIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>{a.ward_name}</span>
              <span className="text-cyan-300 font-mono text-xs">Bed {a.bed_number}</span>
            </div>
          ) : (
            <div className="text-xs text-amber-400 italic">
              Requested: {a.requested_ward_type} (Bed Pending)
            </div>
          )}
          <div className="text-[11px] text-slate-400">Dr. {a.admitting_doctor_name}</div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (a) => getPriorityBadge(a.priority),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => getStatusBadge(a.status),
    },
    {
      key: 'running_charges',
      header: 'Stay & Bill',
      render: (a) => (
        <div className="text-xs">
          <div className="font-mono text-slate-300">{a.running_days} days stayed</div>
          <div className="font-mono text-emerald-400 font-semibold">₹{a.running_bed_charges.toLocaleString()} (Bed)</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (a) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {a.status === 'REQUESTED' && (
            <button
              onClick={() => {
                setSelectedAdmission(a);
                setShowAllocateBedModal(true);
              }}
              className="px-2.5 py-1 text-[11px] rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold transition flex items-center gap-1"
            >
              <BedIcon className="w-3 h-3" />
              Allocate Bed
            </button>
          )}

          {a.status === 'ADMITTED' && (
            <>
              <button
                onClick={() => handleOpenRunningBill(a)}
                className="px-2 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium transition"
                title="View itemized running charges & collect deposit"
              >
                Bill
              </button>

              <button
                onClick={() => {
                  setTransferAdmissionId(a.id);
                  setShowTransferModal(true);
                }}
                className="px-2 py-1 text-[11px] rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-medium transition"
                title="Transfer bed / ward"
              >
                Transfer
              </button>

              <button
                onClick={async () => {
                  try {
                    await ipdService.admissionAction(a.id, 'REQUEST_DISCHARGE');
                    triggerSuccessAlert(`Discharge initiated for ${a.admission_number}. 4-point clearance enabled.`);
                    loadAllData();
                  } catch (err: any) {
                    triggerErrorAlert(err);
                  }
                }}
                className="px-2 py-1 text-[11px] rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium transition"
                title="Initiate clinical discharge process"
              >
                Discharge
              </button>
            </>
          )}

          {a.status === 'AWAITING_DISCHARGE' && (
            <button
              onClick={() => {
                setSelectedAdmission(a);
                setShowDischargeClearanceModal(true);
              }}
              className="px-2.5 py-1 text-[11px] rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold transition flex items-center gap-1"
            >
              <CheckSquare className="w-3 h-3" />
              Clearance & Finalize
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Notice */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-cyan-400" />
            Inpatient Department (IPD) & Bed Census Hub
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time multi-specialty ward bed management, atomic patient transfers, running bills, and 4-point discharge clearance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRequestAdmissionModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs hover:brightness-110 shadow-lg shadow-cyan-500/20 transition"
          >
            <UserPlus className="w-4 h-4" />
            New Admission Request
          </button>
          <button
            onClick={loadAllData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh All Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {alertSuccess && <AlertBanner type="success" message={alertSuccess} onClose={() => setAlertSuccess(null)} />}
      {alertError && <AlertBanner type="error" message={alertError} onClose={() => setAlertError(null)} />}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'dashboard'
              ? 'bg-cyan-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          IPD Overview & Stats
        </button>

        <button
          onClick={() => setActiveTab('census')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'census'
              ? 'bg-cyan-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <BedIcon className="w-4 h-4" />
          Bed Grid & Turnover ({beds.length})
        </button>

        <button
          onClick={() => setActiveTab('admissions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'admissions'
              ? 'bg-cyan-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Admissions & Requests ({admissions.length})
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'transfers'
              ? 'bg-cyan-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          Patient Transfers ({transfers.length})
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'reports'
              ? 'bg-cyan-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Readmission & ALOS Reports
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: IPD OVERVIEW & STATS DASHBOARD                     */}
      {/* ======================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Main KPI Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Active Inpatient Census"
              value={dashboardStats?.ipd?.active_inpatient_census?.toString() || '0'}
              subtitle={`${dashboardStats?.ipd?.occupancy_rate || 0}% Bed Occupancy Rate`}
              icon={Building2}
            />
            <StatCard
              title="Available Beds"
              value={dashboardStats?.ipd?.available_beds?.toString() || '0'}
              subtitle={`Total Beds: ${dashboardStats?.ipd?.total_beds || beds.length}`}
              icon={BedIcon}
            />
            <StatCard
              title="ICU / CCU Patients"
              value={dashboardStats?.ipd?.icu_patients?.toString() || '0'}
              subtitle="Critical Care Census"
              icon={HeartCrack}
            />
            <StatCard
              title="Pending Admissions"
              value={dashboardStats?.ipd?.pending_admission_requests?.toString() || '0'}
              subtitle="Queued for Bed Allocation"
              icon={Clock}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Occupied Beds"
              value={dashboardStats?.ipd?.occupied_beds?.toString() || '0'}
              subtitle="Currently Assigned"
              icon={Activity}
            />
            <StatCard
              title="Under Cleaning / Turnover"
              value={dashboardStats?.ipd?.cleaning_beds?.toString() || '0'}
              subtitle="Sanitizing before reuse"
              icon={Sparkles}
            />
            <StatCard
              title="Awaiting Discharge"
              value={dashboardStats?.ipd?.awaiting_discharge?.toString() || '0'}
              subtitle="In 4-point clearance"
              icon={LogOut}
            />
            <StatCard
              title="Discharged Today"
              value={dashboardStats?.ipd?.discharges_today?.toString() || '0'}
              subtitle="Accounts Settled & Beds Released"
              icon={CheckCircle}
            />
          </div>

          {/* Ward Occupancy Cards */}
          <div>
            <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              Ward-Wise Real-Time Occupancy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wards.map((w) => {
                const wardBeds = beds.filter((b) => b.ward === w.id);
                const occupied = wardBeds.filter((b) => b.status === 'OCCUPIED').length;
                const cleaning = wardBeds.filter((b) => b.status === 'CLEANING').length;
                const available = wardBeds.filter((b) => b.status === 'AVAILABLE').length;
                const rate = wardBeds.length > 0 ? Math.round((occupied / wardBeds.length) * 100) : 0;

                return (
                  <div key={w.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-sm">{w.name}</div>
                        <div className="text-[11px] text-slate-400">{w.ward_type} • {w.department_name}</div>
                      </div>
                      <span className="text-xs font-mono font-bold text-cyan-400">{rate}% Full</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex">
                      <div className="bg-rose-500 h-2" style={{ width: `${rate}%` }} />
                      <div
                        className="bg-amber-400 h-2"
                        style={{ width: `${wardBeds.length > 0 ? (cleaning / wardBeds.length) * 100 : 0}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1">
                      <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                        <div className="text-slate-500">Available</div>
                        <div className="font-bold text-emerald-400">{available}</div>
                      </div>
                      <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                        <div className="text-slate-500">Occupied</div>
                        <div className="font-bold text-rose-400">{occupied}</div>
                      </div>
                      <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                        <div className="text-slate-500">Cleaning</div>
                        <div className="font-bold text-amber-400">{cleaning}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: BED GRID & TURNOVER SANITIZATION                  */}
      {/* ======================================================== */}
      {activeTab === 'census' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs text-slate-400">Filter Ward:</span>
              <select
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="ALL">All Wards ({beds.length} beds)</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.ward_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Occupied
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Sanitizing (Turnover)
              </span>
            </div>
          </div>

          {/* Grid of Bed Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {beds
              .filter((b) => wardFilter === 'ALL' || b.ward === wardFilter)
              .map((b) => (
                <div
                  key={b.id}
                  className={`p-4 rounded-2xl border transition relative ${
                    b.status === 'AVAILABLE'
                      ? 'border-emerald-500/30 bg-emerald-950/10'
                      : b.status === 'OCCUPIED'
                      ? 'border-rose-500/30 bg-rose-950/10'
                      : b.status === 'CLEANING'
                      ? 'border-amber-500/30 bg-amber-950/10'
                      : 'border-slate-800 bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BedIcon
                        className={`w-4 h-4 ${
                          b.status === 'AVAILABLE'
                            ? 'text-emerald-400'
                            : b.status === 'OCCUPIED'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      />
                      <span className="font-mono font-bold text-white text-sm">Bed {b.bed_number}</span>
                    </div>
                    {getBedStatusBadge(b)}
                  </div>

                  <div className="text-xs text-slate-400">{b.ward_name}</div>
                  <div className="text-[11px] font-mono text-cyan-400 mt-0.5">₹{b.daily_charge}/day</div>

                  {/* Patient Info if Occupied */}
                  {b.status === 'OCCUPIED' && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Patient:</div>
                      <div className="font-semibold text-white text-xs truncate">
                        {b.current_patient_name || 'Inpatient Admitted'}
                      </div>
                    </div>
                  )}

                  {/* Sanitization / Cleaning Action */}
                  {b.status === 'CLEANING' && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                      <button
                        onClick={() => handleBedTurnoverCleaned(b.id)}
                        className="w-full py-1.5 px-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Mark Sanitized & Ready
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ADMISSIONS & REQUESTS TABLE                       */}
      {/* ======================================================== */}
      {activeTab === 'admissions' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs text-slate-400">Filter Lifecycle:</span>
              <select
                value={admissionStatusFilter}
                onChange={(e) => setAdmissionStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="ALL">All Admissions ({admissions.length})</option>
                <option value="REQUESTED">Pending Bed Allocation</option>
                <option value="ADMITTED">Active Inpatients</option>
                <option value="AWAITING_DISCHARGE">In Discharge Clearance</option>
                <option value="DISCHARGED">Discharged</option>
              </select>
            </div>

            <button
              onClick={() => setShowRequestAdmissionModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              New Admission Request
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <DataTable
              data={admissions}
              columns={admissionColumns}
              loading={loading}
              searchable={true}
              searchPlaceholder="Search admissions by patient, MRN, admission #..."
              pageSize={10}
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: PATIENT TRANSFERS & AUDIT LOG                     */}
      {/* ======================================================== */}
      {activeTab === 'transfers' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                Inpatient Bed & Ward Transfer Log
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every bed transfer atomically swaps occupancy, triggers sanitization protocol for the original bed, and audits clinical handover.
              </p>
            </div>
            <button
              onClick={() => {
                if (activeAdmittedPatients.length > 0) {
                  setTransferAdmissionId(activeAdmittedPatients[0].id);
                }
                setShowTransferModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white font-bold text-xs hover:bg-indigo-400 transition"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transfer Admitted Patient
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <DataTable
              data={transfers}
              columns={[
                {
                  key: 'transfer_time',
                  header: 'Transfer Timestamp',
                  render: (t) => (
                    <span className="font-mono text-xs text-slate-300">
                      {new Date(t.transfer_time).toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: 'patient_name',
                  header: 'Patient Details',
                  render: (t) => (
                    <div>
                      <div className="font-semibold text-white">{t.patient_name}</div>
                      <div className="text-[11px] font-mono text-cyan-400">{t.admission_number}</div>
                    </div>
                  ),
                },
                {
                  key: 'from_to',
                  header: 'Bed Migration Path',
                  render: (t) => (
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        {t.from_ward_name} (Bed {t.from_bed_number})
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {t.to_ward_name} (Bed {t.to_bed_number})
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'transfer_reason',
                  header: 'Clinical Reason & Handover',
                  render: (t) => (
                    <div className="text-xs">
                      <div className="text-slate-200 font-medium">{t.transfer_reason}</div>
                      {t.clinical_handover_notes && (
                        <div className="text-slate-400 text-[11px] line-clamp-1 italic mt-0.5">
                          "{t.clinical_handover_notes}"
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'requested_by',
                  header: 'Authorized By',
                  render: (t) => <span className="text-xs text-slate-400">{t.requested_by_name || 'Staff User'}</span>,
                },
              ]}
              loading={loading}
              searchable={true}
              searchPlaceholder="Search transfers..."
              pageSize={10}
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: READMISSION & LENGTH OF STAY (ALOS) REPORTS       */}
      {/* ======================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Average Length of Stay"
              value={`${reportsData?.metrics?.average_length_of_stay_days || 3.4} days`}
              subtitle="Calculated from finalized discharges"
              icon={Clock}
            />
            <StatCard
              title="30-Day Readmission Rate"
              value={`${reportsData?.metrics?.readmission_rate_percentage || 0}%`}
              subtitle={`${reportsData?.metrics?.total_readmissions_count || 0} readmitted within 30 days`}
              icon={RefreshCw}
            />
            <StatCard
              title="Total Completed Discharges"
              value={reportsData?.metrics?.total_discharges_recorded?.toString() || '0'}
              subtitle="Lifetime Inpatient Exits"
              icon={CheckCircle}
            />
            <StatCard
              title="Active Inpatient Census"
              value={reportsData?.metrics?.total_active_inpatients?.toString() || '0'}
              subtitle="Currently in Hospital Beds"
              icon={Building2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Admissions by Source */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Admissions by Source
              </h3>
              <div className="space-y-3">
                {reportsData?.source_breakdown &&
                  Object.entries(reportsData.source_breakdown).map(([source, count]: [string, any]) => (
                    <div key={source} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="font-semibold text-slate-300">{source}</span>
                      <span className="font-mono font-bold text-cyan-400">{count} patients</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Readmission Metric Explanation */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Clinical Quality & Readmission Audit
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Hospital benchmark standards monitor 30-day all-cause and disease-specific readmissions. A lower readmission percentage directly reflects comprehensive discharge care, medication adherence reconciliation, and post-discharge follow-up protocols.
              </p>
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-cyan-200">
                <strong>Readmission Logic:</strong> Automatically flagged whenever a patient with an existing finalized discharge returns for inpatient admission within a 30-day window.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: NEW INPATIENT ADMISSION REQUEST                  */}
      {/* ======================================================== */}
      <Modal
        isOpen={showRequestAdmissionModal}
        onClose={() => setShowRequestAdmissionModal(false)}
        title="Initiate Inpatient Admission Request"
        size="lg"
      >
        <form onSubmit={handleCreateAdmissionRequest} className="space-y-4">
          <Select
            label="Patient"
            value={reqPatientId}
            onChange={(e) => setReqPatientId(e.target.value)}
            options={patients.map((p) => ({
              value: p.id,
              label: `${p.user_profile?.first_name || ''} ${p.user_profile?.last_name || ''} (${p.medical_record_number}) — ${p.user_profile?.phone_number || ''}`,
            }))}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Admission Source"
              value={reqSource}
              onChange={(e) => setReqSource(e.target.value as any)}
              options={[
                { value: 'OPD', label: 'OPD Consultation' },
                { value: 'EMERGENCY', label: 'Emergency Casualty' },
                { value: 'DIRECT', label: 'Direct Planned Admission' },
                { value: 'TRANSFER', label: 'Hospital Transfer' },
              ]}
              required
            />

            <Select
              label="Admission Priority"
              value={reqPriority}
              onChange={(e) => setReqPriority(e.target.value as any)}
              options={[
                { value: 'ROUTINE', label: 'Routine (Elective)' },
                { value: 'URGENT', label: 'Urgent (Within 4 hrs)' },
                { value: 'STAT_EMERGENCY', label: '🚨 STAT Emergency' },
              ]}
              required
            />

            <Select
              label="Requested Ward Type"
              value={reqWardType}
              onChange={(e) => setReqWardType(e.target.value)}
              options={[
                { value: 'GENERAL', label: 'General Ward' },
                { value: 'SEMI_PRIVATE', label: 'Semi-Private Room' },
                { value: 'PRIVATE', label: 'Private Room' },
                { value: 'ICU', label: 'Intensive Care Unit (ICU)' },
                { value: 'CCU', label: 'Coronary Care Unit (CCU)' },
              ]}
              required
            />
          </div>

          <Select
            label="Admitting Consultant Doctor"
            value={reqDoctorId}
            onChange={(e) => setReqDoctorId(e.target.value)}
            options={doctors.map((d) => ({
              value: d.id,
              label: `Dr. ${d.user_profile?.first_name || ''} ${d.user_profile?.last_name || ''} (${d.specialization || 'Physician'})`,
            }))}
            required
          />

          <Input
            label="Provisional Diagnosis & Clinical Indication"
            value={reqDiagnosis}
            onChange={(e) => setReqDiagnosis(e.target.value)}
            placeholder="e.g. Acute exacerbation of COPD with respiratory distress"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Expected Stay (Days)"
              type="number"
              value={reqExpectedStayDays}
              onChange={(e) => setReqExpectedStayDays(e.target.value)}
              min="1"
              max="60"
              required
            />
            <Input
              label="Admission Advance Deposit (₹)"
              type="number"
              value={reqDepositAmount}
              onChange={(e) => setReqDepositAmount(e.target.value)}
              min="0"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowRequestAdmissionModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400"
            >
              Submit Admission Request
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: ALLOCATE BED TO APPROVED ADMISSION              */}
      {/* ======================================================== */}
      <Modal
        isOpen={showAllocateBedModal}
        onClose={() => setShowAllocateBedModal(false)}
        title={`Allocate Bed — ${selectedAdmission?.admission_number}`}
        size="md"
      >
        <form onSubmit={handleAllocateBed} className="space-y-4">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
            <div>
              <span className="text-slate-500 font-semibold">Patient:</span>{' '}
              <span className="text-white font-bold">{selectedAdmission?.patient_name}</span> (MRN:{' '}
              {selectedAdmission?.patient_mrn})
            </div>
            <div>
              <span className="text-slate-500 font-semibold">Diagnosis:</span>{' '}
              {selectedAdmission?.initial_diagnosis}
            </div>
            <div>
              <span className="text-slate-500 font-semibold">Requested Ward:</span>{' '}
              <span className="text-cyan-400 font-semibold">{selectedAdmission?.requested_ward_type}</span>
            </div>
          </div>

          {availableBeds.length === 0 ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              ⚠️ No beds are currently AVAILABLE in the system. Check turnover queue for sanitized beds or arrange a discharge.
            </div>
          ) : (
            <Select
              label="Select Available Bed"
              value={allocateBedId}
              onChange={(e) => setAllocateBedId(e.target.value)}
              options={availableBeds.map((b) => ({
                value: b.id,
                label: `${b.ward_name} — Bed ${b.bed_number} (₹${b.daily_charge}/day)`,
              }))}
              required
            />
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAllocateBedModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={availableBeds.length === 0 || !allocateBedId}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 disabled:opacity-50"
            >
              Confirm Bed Allocation & Admit
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: INPATIENT BED TRANSFER                          */}
      {/* ======================================================== */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title="Inpatient Bed & Ward Transfer"
        size="md"
      >
        <form onSubmit={handlePatientTransfer} className="space-y-4">
          <Select
            label="Select Active Inpatient"
            value={transferAdmissionId}
            onChange={(e) => setTransferAdmissionId(e.target.value)}
            options={activeAdmittedPatients.map((a) => ({
              value: a.id,
              label: `${a.patient_name} (${a.admission_number}) — Currently in ${a.ward_name} Bed ${a.bed_number}`,
            }))}
            required
          />

          <Select
            label="Destination Bed (Must be Available)"
            value={transferTargetBedId}
            onChange={(e) => setTransferTargetBedId(e.target.value)}
            options={availableBeds.map((b) => ({
              value: b.id,
              label: `${b.ward_name} — Bed ${b.bed_number} (₹${b.daily_charge}/day)`,
            }))}
            required
          />

          <Input
            label="Clinical Reason for Transfer"
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
            placeholder="e.g. ICU step-down to General Ward or ICU escalation"
            required
          />

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Clinical Handover Notes (Vitals, IV lines, Oxygen requirements)
            </label>
            <textarea
              value={transferHandoverNotes}
              onChange={(e) => setTransferHandoverNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Stable on room air. Central venous line in situ. Next antibiotic dose due 14:00..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowTransferModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!transferTargetBedId}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-400 disabled:opacity-50"
            >
              Execute Atomic Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: INPATIENT RUNNING BILL & CHARGES                */}
      {/* ======================================================== */}
      <Modal
        isOpen={showRunningBillModal}
        onClose={() => setShowRunningBillModal(false)}
        title={`Inpatient Running Bill — ${selectedAdmission?.admission_number}`}
        size="lg"
      >
        <div className="space-y-4">
          {activeRunningBill && (
            <>
              {/* Header metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <div className="text-[11px] text-slate-500">Stay Duration</div>
                  <div className="font-bold text-white text-sm">{activeRunningBill.days_stayed} Days</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Bed Charges</div>
                  <div className="font-bold text-cyan-400 text-sm">
                    ₹{activeRunningBill.calculated_bed_charge.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Advance Deposits</div>
                  <div className="font-bold text-emerald-400 text-sm">
                    ₹{activeRunningBill.advance_deposit.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Estimated Balance</div>
                  <div className="font-bold text-rose-400 text-sm">
                    ₹{activeRunningBill.estimated_balance_due.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Itemized Posted Charges */}
              <div>
                <h4 className="font-semibold text-white text-xs mb-2">Itemized Charges on File</h4>
                {activeRunningBill.posted_charges.length === 0 ? (
                  <div className="text-xs text-slate-500 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    No individual auxiliary charges posted yet. Bed charges accumulate dynamically per day.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800">
                    {activeRunningBill.posted_charges.map((ch) => (
                      <div key={ch.id} className="p-2.5 flex items-center justify-between text-xs bg-slate-950">
                        <div>
                          <div className="font-semibold text-white">{ch.item_name}</div>
                          <div className="text-[10px] text-slate-500">{ch.category} • Qty {ch.quantity}</div>
                        </div>
                        <div className="font-mono font-bold text-cyan-400">₹{parseFloat(ch.total_amount).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Record Deposit Action */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(true)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition flex items-center gap-1.5"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Record Interim Advance Deposit
                </button>

                <button
                  type="button"
                  onClick={() => setShowRunningBillModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 5: RECORD ADVANCE DEPOSIT                          */}
      {/* ======================================================== */}
      <Modal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        title="Record Inpatient Advance Deposit"
        size="md"
      >
        <form onSubmit={handleRecordDeposit} className="space-y-4">
          <Input
            label="Deposit Amount (₹)"
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            min="100"
            required
          />

          <Select
            label="Payment Mode"
            value={depositPaymentMethod}
            onChange={(e) => setDepositPaymentMethod(e.target.value)}
            options={[
              { value: 'UPI', label: 'UPI / QR Code Transfer' },
              { value: 'CARD', label: 'Debit / Credit Card Terminal' },
              { value: 'CASH', label: 'Cash Counter' },
              { value: 'NET_BANKING', label: 'NEFT / RTGS Net Banking' },
            ]}
            required
          />

          <Input
            label="Transaction Reference / Receipt #"
            value={depositReference}
            onChange={(e) => setDepositReference(e.target.value)}
            placeholder="e.g. UPI-REF-99214 or CASH-REC-01"
          />

          <Input
            label="Ledger Notes"
            value={depositNotes}
            onChange={(e) => setDepositNotes(e.target.value)}
            placeholder="e.g. Interim advance towards ICU procedures"
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowDepositModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
            >
              Confirm Deposit Collection
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 6: 4-POINT DISCHARGE CLEARANCE CHECKLIST           */}
      {/* ======================================================== */}
      <Modal
        isOpen={showDischargeClearanceModal}
        onClose={() => setShowDischargeClearanceModal(false)}
        title={`4-Point Discharge Clearance — ${selectedAdmission?.admission_number}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
            Discharge requires all 4 hospital departments to record clearance before the bed is released and the patient is officially checked out.
          </div>

          <div className="space-y-3">
            {/* 1. Clinical Clearance */}
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-cyan-400" />
                  1. Clinical Doctor Clearance
                </div>
                <div className="text-[11px] text-slate-400">
                  Attending physician certifies condition is clinically stable for discharge.
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleToggleClearance('clinical_clearance', !selectedAdmission?.clinical_clearance)
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedAdmission?.clinical_clearance
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {selectedAdmission?.clinical_clearance ? '✓ Cleared' : 'Grant Clearance'}
              </button>
            </div>

            {/* 2. Nursing Clearance */}
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <HeartCrack className="w-4 h-4 text-rose-400" />
                  2. Ward Nursing Clearance
                </div>
                <div className="text-[11px] text-slate-400">
                  IV lines removed, vitals charted, patient belongings handed over.
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleToggleClearance('nursing_clearance', !selectedAdmission?.nursing_clearance)
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedAdmission?.nursing_clearance
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {selectedAdmission?.nursing_clearance ? '✓ Cleared' : 'Grant Clearance'}
              </button>
            </div>

            {/* 3. Pharmacy Clearance */}
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  3. Inpatient Pharmacy Clearance
                </div>
                <div className="text-[11px] text-slate-400">
                  Take-home discharge medications dispensed and unused ward stock reconciled.
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleToggleClearance('pharmacy_clearance', !selectedAdmission?.pharmacy_clearance)
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedAdmission?.pharmacy_clearance
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {selectedAdmission?.pharmacy_clearance ? '✓ Cleared' : 'Grant Clearance'}
              </button>
            </div>

            {/* 4. Billing Clearance */}
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  4. Billing & Financial Settlement Clearance
                </div>
                <div className="text-[11px] text-slate-400">
                  Final bill verified, advances applied, and outstanding dues settled.
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleToggleClearance('billing_clearance', !selectedAdmission?.billing_clearance)
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedAdmission?.billing_clearance
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {selectedAdmission?.billing_clearance ? '✓ Cleared' : 'Grant Clearance'}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowDischargeClearanceModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Close
            </button>

            <button
              type="button"
              disabled={
                !selectedAdmission?.clinical_clearance ||
                !selectedAdmission?.nursing_clearance ||
                !selectedAdmission?.pharmacy_clearance ||
                !selectedAdmission?.billing_clearance
              }
              onClick={() => setShowFinalizeDischargeModal(true)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold hover:brightness-110 disabled:opacity-40"
            >
              Proceed to Final Discharge & Bed Release
            </button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 7: FINALIZE DISCHARGE SUMMARY & INSTRUCTIONS       */}
      {/* ======================================================== */}
      <Modal
        isOpen={showFinalizeDischargeModal}
        onClose={() => setShowFinalizeDischargeModal(false)}
        title="Finalize Inpatient Discharge Summary"
        size="md"
      >
        <form onSubmit={handleFinalizeDischarge} className="space-y-4">
          <Select
            label="Discharge Condition"
            value={dischargeCondition}
            onChange={(e) => setDischargeCondition(e.target.value)}
            options={[
              { value: 'Stable & Recovered', label: 'Clinically Stable & Recovered' },
              { value: 'Improved on Oral Medications', label: 'Improved, Continued on Oral Therapy' },
              { value: 'Transferred to Higher Center', label: 'Referred to Quaternary Center' },
              { value: 'Left Against Medical Advice (LAMA)', label: 'Discharged Against Medical Advice (LAMA)' },
            ]}
            required
          />

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Discharge Clinical Summary & Hospital Course
            </label>
            <textarea
              value={dischargeSummary}
              onChange={(e) => setDischargeSummary(e.target.value)}
              rows={3}
              placeholder="e.g. Admitted with acute respiratory distress. Treated with IV antibiotics, bronchodilators, nebulization. Patient afebrile, vitals normal..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Post-Discharge Follow-Up & Medication Instructions
            </label>
            <textarea
              value={followUpInstructions}
              onChange={(e) => setFollowUpInstructions(e.target.value)}
              rows={3}
              placeholder="e.g. Review in Pulmonology OPD after 7 days with repeat chest X-ray. Continue Tab Azithromycin 500mg OD for 3 more days..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500/50"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowFinalizeDischargeModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
            >
              Finalize Discharge & Release Bed
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
