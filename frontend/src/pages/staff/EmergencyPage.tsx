import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Activity,
  Ambulance,
  Plus,
  CheckCircle,
  Clock,
  HeartCrack,
  ArrowRight,
  UserCheck,
  Stethoscope,
  Building2,
  RefreshCw,
  Search,
  Filter,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { ipdService, authService } from '../../services/api';
import { parseApiError } from '../../utils/errorHandler';
import { EmergencyCase, PatientProfile, StaffProfile } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import { useBranch } from '../../context/BranchContext';

export const EmergencyPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const [encounters, setEncounters] = useState<EmergencyCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [acuityFilter, setAcuityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showIPDRequestModal, setShowIPDRequestModal] = useState(false);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<EmergencyCase | null>(null);

  // Form states for Rapid Triage Intake
  const [patientMode, setPatientMode] = useState<'REGISTERED' | 'UNREGISTERED'>('UNREGISTERED');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [unregisteredName, setUnregisteredName] = useState('');
  const [acuity, setAcuity] = useState<'RED' | 'YELLOW' | 'GREEN'>('RED');
  const [arrivalMode, setArrivalMode] = useState<'AMBULANCE' | 'WALK_IN' | 'POLICE' | 'TRANSFER'>('AMBULANCE');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [assignedDoctorId, setAssignedDoctorId] = useState('');
  const [bp, setBp] = useState('120/80');
  const [pulse, setPulse] = useState('88');
  const [spO2, setSpO2] = useState('98');
  const [temp, setTemp] = useState('98.6');
  const [triageError, setTriageError] = useState<string | null>(null);
  const [triageSubmitting, setTriageSubmitting] = useState(false);

  // Action form states
  const [treatmentNotes, setTreatmentNotes] = useState('');
  const [reconcilePatientId, setReconcilePatientId] = useState('');
  const [ipdPriority, setIpdPriority] = useState<'STAT_EMERGENCY' | 'URGENT'>('STAT_EMERGENCY');
  const [requestedWardType, setRequestedWardType] = useState('ICU');
  const [admittingDoctorId, setAdmittingDoctorId] = useState('');
  const [initialDiagnosis, setInitialDiagnosis] = useState('');
  const [expectedStayDays, setExpectedStayDays] = useState('3');
  const [dischargeCondition, setDischargeCondition] = useState('Stable & Relieved');
  const [dischargeSummary, setDischargeSummary] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Reference data
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [doctors, setDoctors] = useState<StaffProfile[]>([]);

  const fetchEmergencyData = async () => {
    setLoading(true);
    try {
      const [cases, dashStats] = await Promise.all([
        ipdService.getEmergencyCases({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          triage_acuity: acuityFilter !== 'ALL' ? acuityFilter : undefined,
          search: searchQuery || undefined,
        }),
        ipdService.getDashboardStats({ branch_id: currentBranch?.id }),
      ]);
      setEncounters(cases);
      setStats(dashStats.emergency);
    } catch (err) {
      console.error('Failed to load emergency data:', err);
      setPageError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const [patList, docList] = await Promise.all([
        authService.getPatients({ branch_id: currentBranch?.id }),
        authService.getStaffDirectory({ branch_id: currentBranch?.id, role: 'DOCTOR' }),
      ]);
      setPatients(patList || []);
      setDoctors(docList || []);
      if (patList?.length > 0) {
        setSelectedPatientId(patList[0].id);
        setReconcilePatientId(patList[0].id);
      }
      if (docList?.length > 0) {
        setAssignedDoctorId(docList[0].id);
        setAdmittingDoctorId(docList[0].id);
      }
    } catch (err) {
      console.error('Failed to load reference dropdowns:', err);
    }
  };

  useEffect(() => {
    fetchEmergencyData();
  }, [currentBranch?.id, statusFilter, acuityFilter]);

  useEffect(() => {
    loadReferenceData();
  }, [currentBranch?.id]);

  const handleRegisterTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    setTriageError(null);
    setTriageSubmitting(true);
    try {
      await ipdService.registerEmergencyCase({
        patient: patientMode === 'REGISTERED' ? selectedPatientId : undefined,
        unregistered_patient_name: patientMode === 'UNREGISTERED' ? unregisteredName : undefined,
        triage_acuity: acuity,
        arrival_mode: arrivalMode,
        chief_complaint: chiefComplaint,
        assigned_doctor: assignedDoctorId || undefined,
        vitals: {
          blood_pressure: bp,
          pulse_rate: pulse,
          spO2: `${spO2}%`,
          temperature: `${temp}°F`,
          recorded_at: new Date().toISOString(),
        },
      });

      setShowTriageModal(false);
      setUnregisteredName('');
      setChiefComplaint('');
      setActionSuccess('Emergency casualty registered and triaged successfully!');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchEmergencyData();
    } catch (err: any) {
      setTriageError(parseApiError(err).message);
    } finally {
      setTriageSubmitting(false);
    }
  };

  const handleUpdateTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setActionError(null);
    try {
      await ipdService.emergencyAction(selectedCase.id, 'UPDATE_TREATMENT', {
        treatment_summary: treatmentNotes,
        vitals: {
          blood_pressure: bp,
          pulse_rate: pulse,
          spO2: `${spO2}%`,
          recorded_at: new Date().toISOString(),
        },
      });
      setShowTreatmentModal(false);
      setActionSuccess(`Treatment notes saved for ER Case ${selectedCase.encounter_number}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchEmergencyData();
    } catch (err: any) {
      setActionError(parseApiError(err).message);
    }
  };

  const handleReconcilePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setActionError(null);
    try {
      await ipdService.emergencyAction(selectedCase.id, 'RECONCILE_PATIENT', {
        patient_id: reconcilePatientId,
      });
      setShowReconcileModal(false);
      setActionSuccess(`ER Case ${selectedCase.encounter_number} successfully linked to patient MRN.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchEmergencyData();
    } catch (err: any) {
      setActionError(parseApiError(err).message);
    }
  };

  const handleRequestIPD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setActionError(null);
    try {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + parseInt(expectedStayDays || '3'));

      const res = await ipdService.emergencyAction(selectedCase.id, 'REQUEST_IPD_ADMISSION', {
        admitting_doctor_id: admittingDoctorId,
        requested_ward_type: requestedWardType,
        priority: ipdPriority,
        initial_diagnosis: initialDiagnosis || selectedCase.chief_complaint,
        expected_discharge_date: expDate.toISOString().split('T')[0],
      });
      setShowIPDRequestModal(false);
      setActionSuccess(
        `STAT Inpatient Admission Requested: ${res.admission?.admission_number || 'IPD-REQ'}. Bed allocation pending.`
      );
      setTimeout(() => setActionSuccess(null), 5000);
      fetchEmergencyData();
    } catch (err: any) {
      setActionError(parseApiError(err).message);
    }
  };

  const handleDischargeER = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setActionError(null);
    try {
      await ipdService.emergencyAction(selectedCase.id, 'DISCHARGE_ER', {
        discharge_condition: dischargeCondition,
        discharge_summary: dischargeSummary,
      });
      setShowDischargeModal(false);
      setActionSuccess(`ER Case ${selectedCase.encounter_number} discharged successfully.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchEmergencyData();
    } catch (err: any) {
      setActionError(parseApiError(err).message);
    }
  };

  const getAcuityBadge = (acuity: string) => {
    switch (acuity) {
      case 'RED':
        return <Badge variant="danger">🔴 Acuity 1: Resuscitation (Immediate)</Badge>;
      case 'YELLOW':
        return <Badge variant="warning">🟡 Acuity 2: Emergent (Within 15m)</Badge>;
      case 'GREEN':
        return <Badge variant="success">🟢 Acuity 3: Urgent / Stable</Badge>;
      default:
        return <Badge variant="neutral">{acuity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ARRIVED':
        return <Badge variant="neutral">Arrived</Badge>;
      case 'TRIAGED':
        return <Badge variant="warning">Triaged</Badge>;
      case 'IN_TREATMENT':
        return <Badge variant="accent">In Resuscitation</Badge>;
      case 'ADMITTED_IPD':
        return <Badge variant="success">Admitted to IPD</Badge>;
      case 'DISCHARGED':
        return <Badge variant="neutral">Discharged</Badge>;
      case 'EXPIRED':
        return <Badge variant="danger">Expired</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const columns: Column<EmergencyCase>[] = [
    {
      key: 'encounter_number',
      header: 'ER Case #',
      render: (c) => (
        <div>
          <span className="font-mono text-cyan-400 font-bold">{c.encounter_number}</span>
          {c.linked_admission_number && (
            <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
              ↳ IPD: {c.linked_admission_number}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'patient',
      header: 'Patient Identification',
      render: (c) => (
        <div>
          <div className="font-semibold text-white flex items-center gap-1.5">
            {c.patient_name || c.unregistered_patient_name || 'Unidentified Casualty'}
            {c.unregistered_patient_name && !c.patient_id && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-normal">
                Temp / Unreconciled
              </span>
            )}
          </div>
          {c.patient_phone && <div className="text-[11px] text-slate-400 font-mono">📱 {c.patient_phone}</div>}
        </div>
      ),
    },
    {
      key: 'triage_acuity',
      header: 'Triage Acuity',
      render: (c) => getAcuityBadge(c.triage_acuity),
    },
    {
      key: 'arrival_mode',
      header: 'Arrival Mode & Time',
      render: (c) => (
        <div className="text-xs">
          <div className="text-slate-300 font-medium flex items-center gap-1">
            <Ambulance className="w-3.5 h-3.5 text-cyan-400" />
            {c.arrival_mode}
          </div>
          <div className="text-slate-500 font-mono">{new Date(c.arrival_time).toLocaleTimeString()}</div>
        </div>
      ),
    },
    {
      key: 'chief_complaint',
      header: 'Clinical Presentation & Vitals',
      render: (c) => (
        <div className="max-w-xs">
          <div className="text-slate-200 text-xs font-medium line-clamp-1">{c.chief_complaint}</div>
          {c.vitals && Object.keys(c.vitals).length > 0 && (
            <div className="text-[11px] text-cyan-400/80 font-mono mt-0.5">
              BP: {c.vitals.blood_pressure || c.vitals.bp || '—'} | Pulse: {c.vitals.pulse_rate || c.vitals.pulse || '—'} | SpO2: {c.vitals.spO2 || '—'}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => getStatusBadge(c.status),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {c.status !== 'DISCHARGED' && c.status !== 'EXPIRED' && (
            <>
              <button
                onClick={() => {
                  setSelectedCase(c);
                  setTreatmentNotes(c.treatment_summary || '');
                  setShowTreatmentModal(true);
                }}
                className="px-2 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium transition"
                title="Update ER Clinical Notes & Observations"
              >
                Treat
              </button>

              {!c.patient_id && (
                <button
                  onClick={() => {
                    setSelectedCase(c);
                    setShowReconcileModal(true);
                  }}
                  className="px-2 py-1 text-[11px] rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium transition"
                  title="Link Unidentified Casualty to Patient MRN"
                >
                  Reconcile
                </button>
              )}

              {c.status !== 'ADMITTED_IPD' && (
                <button
                  onClick={() => {
                    setSelectedCase(c);
                    setInitialDiagnosis(c.chief_complaint);
                    setShowIPDRequestModal(true);
                  }}
                  className="px-2 py-1 text-[11px] rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-semibold transition"
                  title="Initiate Direct Inpatient Admission from ER"
                >
                  Admit IPD
                </button>
              )}

              <button
                onClick={() => {
                  setSelectedCase(c);
                  setShowDischargeModal(true);
                }}
                className="px-2 py-1 text-[11px] rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-medium transition"
                title="Discharge from Casualty"
              >
                Discharge
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Notice: Emergency Treatment Never Blocked */}
      <div className="bg-gradient-to-r from-rose-950/40 via-slate-900 to-amber-950/30 border border-rose-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm flex items-center gap-2">
              Stat Emergency Resuscitation Policy
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Non-Blocking Clinical Access
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              Urgent casualty intake, clinical triage, and resuscitation are never delayed or withheld due to billing, deposit checks, or insurance pre-authorizations.
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setTriageError(null);
            setShowTriageModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 text-slate-950 font-bold text-xs hover:brightness-110 shadow-lg shadow-rose-500/20 transition shrink-0"
        >
          <Ambulance className="w-4 h-4" />
          Rapid Casualty Triage
        </button>
      </div>

      {actionSuccess && <AlertBanner type="success" message={actionSuccess} onClose={() => setActionSuccess(null)} />}
      {actionError && <AlertBanner type="error" message={actionError} onClose={() => setActionError(null)} />}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Emergency Visits Today"
          value={stats?.visits_today?.toString() || encounters.length.toString()}
          subtitle="Casualty encounters recorded"
          icon={Activity}
        />
        <StatCard
          title="Active in Casualty"
          value={stats?.active_cases?.toString() || encounters.filter((c) => c.status !== 'DISCHARGED').length.toString()}
          subtitle="Currently undergoing care"
          icon={Clock}
        />
        <StatCard
          title="Acuity 1: Resuscitation"
          value={stats?.red_acuity?.toString() || encounters.filter((c) => c.triage_acuity === 'RED').length.toString()}
          subtitle="Immediate code red care"
          icon={HeartCrack}
        />
        <StatCard
          title="Direct IPD Admissions"
          value={stats?.direct_admissions?.toString() || encounters.filter((c) => c.status === 'ADMITTED_IPD').length.toString()}
          subtitle="Transferred to ICU / Ward"
          icon={Building2}
        />
      </div>

      {/* Filters and Controls */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none"
            >
              <option value="ALL">All Dispositions</option>
              <option value="ARRIVED">Arrived</option>
              <option value="TRIAGED">Triaged</option>
              <option value="IN_TREATMENT">In Treatment</option>
              <option value="ADMITTED_IPD">Admitted to IPD</option>
              <option value="DISCHARGED">Discharged</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-400">
            <span>Acuity Level:</span>
            <select
              value={acuityFilter}
              onChange={(e) => setAcuityFilter(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none"
            >
              <option value="ALL">All Acuities</option>
              <option value="RED">🔴 Acuity 1 (Red)</option>
              <option value="YELLOW">🟡 Acuity 2 (Yellow)</option>
              <option value="GREEN">🟢 Acuity 3 (Green)</option>
            </select>
          </div>
        </div>

        <button
          onClick={fetchEmergencyData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <DataTable
          data={encounters}
          columns={columns}
          loading={loading}
          searchable={true}
          searchPlaceholder="Search by ER case #, patient name, or complaint..."
          pageSize={10}
        />
      </div>

      {/* MODAL 1: RAPID CASUALTY TRIAGE INTAKE */}
      <Modal
        isOpen={showTriageModal}
        onClose={() => setShowTriageModal(false)}
        title="Rapid Casualty Triage & Intake"
        size="lg"
      >
        <form onSubmit={handleRegisterTriage} className="space-y-4">
          {triageError && <AlertBanner type="error" message={triageError} />}

          {/* Identification Mode */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Patient Identification Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPatientMode('UNREGISTERED')}
                className={`p-3 rounded-xl border text-xs font-semibold text-left transition ${
                  patientMode === 'UNREGISTERED'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-300'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold">🚨 Urgent / Unidentified Casualty</div>
                <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                  Immediate intake with temporary alias (reconcile MRN later).
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPatientMode('REGISTERED')}
                className={`p-3 rounded-xl border text-xs font-semibold text-left transition ${
                  patientMode === 'REGISTERED'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold">👤 Existing Patient Record</div>
                <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                  Select registered patient from system database.
                </div>
              </button>
            </div>
          </div>

          {patientMode === 'UNREGISTERED' ? (
            <Input
              label="Temporary Casualty Name / Alias"
              value={unregisteredName}
              onChange={(e) => setUnregisteredName(e.target.value)}
              placeholder="e.g. Unidentified Trauma Male #4, or Rahul (Relative Present)"
              required
            />
          ) : (
            <Select
              label="Select Registered Patient"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              options={patients.map((p) => ({
                value: p.id,
                label: `${p.user_profile?.first_name || ''} ${p.user_profile?.last_name || ''} (${p.medical_record_number}) — ${p.user_profile?.phone_number || ''}`,
              }))}
              required
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Triage Acuity Classification"
              value={acuity}
              onChange={(e) => setAcuity(e.target.value as any)}
              options={[
                { value: 'RED', label: '🔴 RED — Immediate Resuscitation (Code Red)' },
                { value: 'YELLOW', label: '🟡 YELLOW — Emergent / Urgent (Within 15 mins)' },
                { value: 'GREEN', label: '🟢 GREEN — Urgent / Ambulatory Stable' },
              ]}
              required
            />

            <Select
              label="Arrival Mode"
              value={arrivalMode}
              onChange={(e) => setArrivalMode(e.target.value as any)}
              options={[
                { value: 'AMBULANCE', label: '108 / Hospital Cardiac Ambulance' },
                { value: 'WALK_IN', label: 'Walk-In / Brought by Family' },
                { value: 'POLICE', label: 'Police Medico-Legal Case (MLC)' },
                { value: 'TRANSFER', label: 'Transfer from Peripheral Hospital' },
              ]}
              required
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <Input label="BP (mmHg)" value={bp} onChange={(e) => setBp(e.target.value)} placeholder="120/80" />
            <Input label="Pulse (bpm)" value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="88" />
            <Input label="SpO2 (%)" value={spO2} onChange={(e) => setSpO2(e.target.value)} placeholder="98" />
            <Input label="Temp (°F)" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="98.6" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Chief Emergency Complaint & Clinical Presentation
            </label>
            <textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              rows={3}
              placeholder="e.g. Sudden severe retrosternal chest pain radiating to neck, profuse diaphoresis, shortness of breath..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500/50"
              required
            />
          </div>

          {doctors.length > 0 && (
            <Select
              label="Assigned Emergency Physician / Team"
              value={assignedDoctorId}
              onChange={(e) => setAssignedDoctorId(e.target.value)}
              options={doctors.map((d) => ({
                value: d.id,
                label: `Dr. ${d.user_profile?.first_name || ''} ${d.user_profile?.last_name || ''} (${d.specialization || 'Casualty Officer'})`,
              }))}
            />
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowTriageModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={triageSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 font-bold hover:brightness-110 transition disabled:opacity-50"
            >
              {triageSubmitting ? 'Registering...' : 'Initiate Emergency Code & Admit'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: UPDATE TREATMENT NOTES & VITALS */}
      <Modal
        isOpen={showTreatmentModal}
        onClose={() => setShowTreatmentModal(false)}
        title={`ER Resuscitation Treatment — ${selectedCase?.encounter_number}`}
        size="md"
      >
        <form onSubmit={handleUpdateTreatment} className="space-y-4">
          <div className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-500 font-semibold">Patient:</span>{' '}
              <span className="text-white font-medium">{selectedCase?.patient_name || selectedCase?.unregistered_patient_name}</span>
            </div>
            <div className="mt-1">
              <span className="text-slate-500 font-semibold">Presentation:</span>{' '}
              <span className="text-slate-300">{selectedCase?.chief_complaint}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Current BP" value={bp} onChange={(e) => setBp(e.target.value)} />
            <Input label="Pulse Rate" value={pulse} onChange={(e) => setPulse(e.target.value)} />
            <Input label="SpO2 (%)" value={spO2} onChange={(e) => setSpO2(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Clinical Procedures, IV Drugs Given & Treatment Summary
            </label>
            <textarea
              value={treatmentNotes}
              onChange={(e) => setTreatmentNotes(e.target.value)}
              rows={4}
              placeholder="e.g. IV access secured 18G right forearm. Inj. Tramadol 50mg IV, loading dose Aspirin 300mg + Clopidogrel 300mg given. ECG shows ST elevation in leads II, III, aVF. Cardiology called for urgent cath lab activation..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowTreatmentModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400"
            >
              Save Treatment Record
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: RECONCILE TEMPORARY CASUALTY TO REGISTERED PATIENT */}
      <Modal
        isOpen={showReconcileModal}
        onClose={() => setShowReconcileModal(false)}
        title={`Reconcile Casualty Record — ${selectedCase?.encounter_number}`}
        size="md"
      >
        <form onSubmit={handleReconcilePatient} className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200">
            Link temporary casualty record{' '}
            <strong className="text-white font-mono">{selectedCase?.unregistered_patient_name}</strong> to a permanent patient MRN in the system. All emergency triage, treatment, and vital history will be preserved under this patient's master EMR.
          </div>

          <Select
            label="Select Matching Registered Patient"
            value={reconcilePatientId}
            onChange={(e) => setReconcilePatientId(e.target.value)}
            options={patients.map((p) => ({
              value: p.id,
              label: `${p.user_profile?.first_name || ''} ${p.user_profile?.last_name || ''} (${p.medical_record_number}) — ${p.user_profile?.phone_number || ''}`,
            }))}
            required
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowReconcileModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400"
            >
              Confirm Reconciliation
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: REQUEST IPD ADMISSION FROM EMERGENCY */}
      <Modal
        isOpen={showIPDRequestModal}
        onClose={() => setShowIPDRequestModal(false)}
        title={`Request Inpatient Admission — ${selectedCase?.encounter_number}`}
        size="lg"
      >
        <form onSubmit={handleRequestIPD} className="space-y-4">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 flex items-center justify-between">
            <div>
              Direct casualty transfer to inpatient care. Creates a high-priority admission request for immediate bed allocation.
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500 text-slate-950">
              PRIORITY: STAT EMERGENCY
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Requested Ward / Unit"
              value={requestedWardType}
              onChange={(e) => setRequestedWardType(e.target.value)}
              options={[
                { value: 'ICU', label: 'Intensive Care Unit (ICU)' },
                { value: 'CCU', label: 'Coronary Care Unit (CCU)' },
                { value: 'NICU', label: 'Neonatal ICU (NICU)' },
                { value: 'PRIVATE', label: 'Private Room' },
                { value: 'SEMI_PRIVATE', label: 'Semi-Private Room' },
                { value: 'GENERAL', label: 'General Male/Female Ward' },
              ]}
              required
            />

            <Select
              label="Admission Priority"
              value={ipdPriority}
              onChange={(e) => setIpdPriority(e.target.value as any)}
              options={[
                { value: 'STAT_EMERGENCY', label: '🚨 STAT_EMERGENCY (Immediate Bed Need)' },
                { value: 'URGENT', label: '⚠️ URGENT (Within 1 Hour)' },
              ]}
              required
            />
          </div>

          {doctors.length > 0 && (
            <Select
              label="Admitting Doctor"
              value={admittingDoctorId}
              onChange={(e) => setAdmittingDoctorId(e.target.value)}
              options={doctors.map((d) => ({
                value: d.id,
                label: `Dr. ${d.user_profile?.first_name || ''} ${d.user_profile?.last_name || ''} (${d.specialization || 'Consultant'})`,
              }))}
              required
            />
          )}

          <Input
            label="Provisional Diagnosis & Admission Reason"
            value={initialDiagnosis}
            onChange={(e) => setInitialDiagnosis(e.target.value)}
            placeholder="e.g. Acute Inferior Wall STEMI with cardiogenic shock"
            required
          />

          <Input
            label="Expected Inpatient Stay (Days)"
            type="number"
            value={expectedStayDays}
            onChange={(e) => setExpectedStayDays(e.target.value)}
            min="1"
            max="60"
            required
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowIPDRequestModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-400"
            >
              Submit IPD Admission Request
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: DISCHARGE FROM CASUALTY */}
      <Modal
        isOpen={showDischargeModal}
        onClose={() => setShowDischargeModal(false)}
        title={`Casualty Discharge — ${selectedCase?.encounter_number}`}
        size="md"
      >
        <form onSubmit={handleDischargeER} className="space-y-4">
          <Select
            label="Condition on Discharge"
            value={dischargeCondition}
            onChange={(e) => setDischargeCondition(e.target.value)}
            options={[
              { value: 'Stable & Relieved', label: 'Stable & Symptomatically Relieved' },
              { value: 'Treated & Ambulatory', label: 'Treated, Ambulatory & Alert' },
              { value: 'Referred to Specialist OPD', label: 'Referred to Specialist OPD Clinic' },
              { value: 'Against Medical Advice (LAMA)', label: 'Left Against Medical Advice (LAMA)' },
            ]}
            required
          />

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Discharge Instructions & Prescribed Medications
            </label>
            <textarea
              value={dischargeSummary}
              onChange={(e) => setDischargeSummary(e.target.value)}
              rows={4}
              placeholder="e.g. Patient observed for 4 hours post analgesia. Vitals stable. Advised Tab Pantoprazole 40mg OD x 5 days, review in Cardiology OPD Monday..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500/50"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowDischargeModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
            >
              Complete Casualty Discharge
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
