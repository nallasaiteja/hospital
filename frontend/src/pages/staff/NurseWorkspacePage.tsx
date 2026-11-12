import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  Pill,
  CheckSquare,
  AlertTriangle,
  Clock,
  HeartPulse,
  Activity,
  FileText,
  ShieldAlert,
  ArrowRightLeft,
  Calendar,
  Building2,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Send,
  Eye,
  Edit3,
  Phone,
  Thermometer,
  Zap,
  Check,
  ChevronRight,
  UserCheck,
  Stethoscope,
  Info
} from 'lucide-react';
import {
  nurseService,
  NurseOverview,
  NursePatient,
  MedicationRecord,
  NursingTaskItem,
  VitalSignItem,
  ShiftHandoverItem,
  NursingNoteItem
} from '../../services/nurseService';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';

type TabKey = 'patients' | 'medications' | 'tasks' | 'handover';

export const NurseWorkspacePage: React.FC = () => {
  const { t } = useTranslation();
  const { userProfile, staffProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as TabKey) || 'patients';

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [overview, setOverview] = useState<NurseOverview | null>(null);

  // Tab A: Patients state
  const [patients, setPatients] = useState<NursePatient[]>([]);
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [selectedPatientForNotes, setSelectedPatientForNotes] = useState<NursePatient | null>(null);
  const [patientNotes, setPatientNotes] = useState<NursingNoteItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [newNoteAssessment, setNewNoteAssessment] = useState<string>('');
  const [newNoteCarePlan, setNewNoteCarePlan] = useState<string>('');
  const [newNoteResponse, setNewNoteResponse] = useState<string>('');
  const [savingNote, setSavingNote] = useState<boolean>(false);

  // Patient Info Edit Modal (Allergies, Emergency Contact, Fall Risk, Isolation)
  const [editingPatient, setEditingPatient] = useState<NursePatient | null>(null);
  const [editAllergiesText, setEditAllergiesText] = useState<string>('');
  const [editEmergencyContact, setEditEmergencyContact] = useState<string>('');
  const [editDietary, setEditDietary] = useState<string>('');
  const [editFallRisk, setEditFallRisk] = useState<boolean>(false);
  const [editIsolation, setEditIsolation] = useState<boolean>(false);
  const [savingPatientInfo, setSavingPatientInfo] = useState<boolean>(false);

  // Tab B: Medications state
  const [medications, setMedications] = useState<MedicationRecord[]>([]);
  const [medSearch, setMedSearch] = useState<string>('');
  const [medStatusFilter, setMedStatusFilter] = useState<string>('ALL');
  const [actionMedication, setActionMedication] = useState<MedicationRecord | null>(null);
  const [medActionType, setMedActionType] = useState<'ADMINISTER' | 'MISSED' | 'REFUSED'>('ADMINISTER');
  const [medDosageGiven, setMedDosageGiven] = useState<string>('');
  const [medRouteUsed, setMedRouteUsed] = useState<string>('');
  const [medRemarks, setMedRemarks] = useState<string>('');
  const [medReasonNonAdmin, setMedReasonNonAdmin] = useState<string>('');
  const [medAdverseNotes, setMedAdverseNotes] = useState<string>('');
  const [medEscalateDoctor, setMedEscalateDoctor] = useState<boolean>(false);
  const [savingMedAction, setSavingMedAction] = useState<boolean>(false);

  // Tab C: Tasks & Vitals state
  const [tasks, setTasks] = useState<NursingTaskItem[]>([]);
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('ALL');
  const [completingTask, setCompletingTask] = useState<NursingTaskItem | null>(null);
  const [taskCompletionNotes, setTaskCompletionNotes] = useState<string>('');
  const [savingTaskAction, setSavingTaskAction] = useState<boolean>(false);

  // Care Plan Task Create Modal
  const [showCreateTaskModal, setShowCreateTaskModal] = useState<boolean>(false);
  const [newTaskPatientId, setNewTaskPatientId] = useState<string>('');
  const [newTaskName, setNewTaskName] = useState<string>('');
  const [newTaskInstructions, setNewTaskInstructions] = useState<string>('');
  const [newTaskPriority, setNewTaskPriority] = useState<'ROUTINE' | 'URGENT' | 'STAT'>('ROUTINE');
  const [newTaskDueTime, setNewTaskDueTime] = useState<string>('');
  const [savingNewTask, setSavingNewTask] = useState<boolean>(false);

  // Vitals State
  const [vitalsList, setVitalsList] = useState<VitalSignItem[]>([]);
  const [showRecordVitalsModal, setShowRecordVitalsModal] = useState<boolean>(false);
  const [vitalsPatientId, setVitalsPatientId] = useState<string>('');
  const [vitalsBpSystolic, setVitalsBpSystolic] = useState<string>('');
  const [vitalsBpDiastolic, setVitalsBpDiastolic] = useState<string>('');
  const [vitalsHeartRate, setVitalsHeartRate] = useState<string>('');
  const [vitalsTemp, setVitalsTemp] = useState<string>('');
  const [vitalsRespRate, setVitalsRespRate] = useState<string>('');
  const [vitalsSpo2, setVitalsSpo2] = useState<string>('');
  const [vitalsGlucose, setVitalsGlucose] = useState<string>('');
  const [vitalsPainScore, setVitalsPainScore] = useState<string>('0');
  const [vitalsRemarks, setVitalsRemarks] = useState<string>('');
  const [vitalsEscalateDoctor, setVitalsEscalateDoctor] = useState<boolean>(false);
  const [savingVitals, setSavingVitals] = useState<boolean>(false);

  // Tab D: Shift Handover state
  const [handovers, setHandovers] = useState<ShiftHandoverItem[]>([]);
  const [showSubmitHandoverModal, setShowSubmitHandoverModal] = useState<boolean>(false);
  const [handoverConditionUpdates, setHandoverConditionUpdates] = useState<string>('');
  const [handoverObservations, setHandoverObservations] = useState<string>('');
  const [handoverPendingMeds, setHandoverPendingMeds] = useState<string>('');
  const [handoverPendingTasks, setHandoverPendingTasks] = useState<string>('');
  const [handoverCriticalAlerts, setHandoverCriticalAlerts] = useState<string>('');
  const [handoverFollowUp, setHandoverFollowUp] = useState<string>('');
  const [submittingHandover, setSubmittingHandover] = useState<boolean>(false);

  const [acknowledgingHandoverId, setAcknowledgingHandoverId] = useState<string | null>(null);
  const [ackNotes, setAckNotes] = useState<string>('');
  const [submittingAck, setSubmittingAck] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const setTab = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  // Load Overview & Initial Data
  const loadWorkspaceData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const ov = await nurseService.getOverview();
      setOverview(ov);

      // Load data according to tab
      if (currentTab === 'patients') {
        const pats = await nurseService.getPatients(patientSearch);
        setPatients(pats);
      } else if (currentTab === 'medications') {
        const meds = await nurseService.getMedications({
          status: medStatusFilter !== 'ALL' ? medStatusFilter : undefined,
          search: medSearch || undefined
        });
        setMedications(meds);
      } else if (currentTab === 'tasks') {
        const [tsk, vit] = await Promise.all([
          nurseService.getTasks({
            status: taskStatusFilter !== 'ALL' ? taskStatusFilter : undefined
          }),
          nurseService.getVitals({ limit: 20 })
        ]);
        setTasks(tsk);
        setVitalsList(vit);
      } else if (currentTab === 'handover') {
        const hList = await nurseService.getShiftHandovers();
        setHandovers(hList);
      }
    } catch (err: any) {
      console.error('Failed to load nurse workspace data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [currentTab, medStatusFilter, taskStatusFilter]);

  // Synchronize workspace immediately whenever nurse toggles On Duty / Off Duty in the sidebar
  useEffect(() => {
    const handleDutyChange = () => {
      loadWorkspaceData(true);
    };
    window.addEventListener('hms_staff_duty_changed', handleDutyChange);
    return () => window.removeEventListener('hms_staff_duty_changed', handleDutyChange);
  }, []);

  // Handle Note view/add
  const handleOpenNotes = async (p: NursePatient) => {
    setSelectedPatientForNotes(p);
    setLoadingNotes(true);
    try {
      const notes = await nurseService.getPatientNotes(p.id);
      setPatientNotes(notes);
    } catch (err) {
      console.error('Failed to load notes', err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedPatientForNotes || !newNoteAssessment.trim()) return;
    setSavingNote(true);
    try {
      await nurseService.addPatientNote(selectedPatientForNotes.id, {
        shift_assessment: newNoteAssessment,
        care_plan_notes: newNoteCarePlan,
        patient_response: newNoteResponse
      });
      showToast('Shift assessment note recorded successfully.');
      setNewNoteAssessment('');
      setNewNoteCarePlan('');
      setNewNoteResponse('');
      const updatedNotes = await nurseService.getPatientNotes(selectedPatientForNotes.id);
      setPatientNotes(updatedNotes);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  // Handle Patient Info Edit
  const handleOpenEditPatient = (p: NursePatient) => {
    setEditingPatient(p);
    setEditAllergiesText((p.allergies || []).join(', '));
    setEditEmergencyContact(p.emergency_contact || '');
    setEditDietary(p.dietary_restrictions || '');
    setEditFallRisk(!!p.fall_risk);
    setEditIsolation(!!p.isolation_required);
  };

  const handleSavePatientInfo = async () => {
    if (!editingPatient) return;
    setSavingPatientInfo(true);
    try {
      const allergiesList = editAllergiesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await nurseService.updatePatientNursingInfo(editingPatient.id, {
        allergies: allergiesList,
        emergency_contact: editEmergencyContact,
        dietary_restrictions: editDietary,
        fall_risk: editFallRisk,
        isolation_required: editIsolation
      });
      showToast('Patient nursing profile updated successfully.');
      setEditingPatient(null);
      loadWorkspaceData(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update patient info');
    } finally {
      setSavingPatientInfo(false);
    }
  };

  // Handle Medication Action Modal Open
  const handleOpenMedAction = (
    med: MedicationRecord,
    action: 'ADMINISTER' | 'MISSED' | 'REFUSED'
  ) => {
    setActionMedication(med);
    setMedActionType(action);
    setMedDosageGiven(med.dosage);
    setMedRouteUsed(med.route);
    setMedRemarks('');
    setMedReasonNonAdmin('');
    setMedAdverseNotes('');
    setMedEscalateDoctor(false);
  };

  const handleSaveMedAction = async () => {
    if (!actionMedication) return;
    if (
      (medActionType === 'MISSED' || medActionType === 'REFUSED') &&
      !medReasonNonAdmin.trim()
    ) {
      alert('Mandatory requirement: A clinical reason must be provided when medication is missed or refused.');
      return;
    }

    setSavingMedAction(true);
    try {
      await nurseService.recordMedicationAction(actionMedication.id, {
        action: medActionType,
        dosage_given: medDosageGiven,
        route_used: medRouteUsed,
        remarks: medRemarks,
        reason_for_non_admin: medReasonNonAdmin,
        adverse_reaction_notes: medAdverseNotes,
        escalate_to_doctor: medEscalateDoctor
      });

      showToast(
        medActionType === 'ADMINISTER'
          ? 'Medication administration successfully recorded on eMAR.'
          : `Medication marked as ${medActionType} with recorded justification.`
      );
      setActionMedication(null);
      loadWorkspaceData(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to record medication action');
    } finally {
      setSavingMedAction(false);
    }
  };

  // Task Actions
  const handleStartTask = async (task: NursingTaskItem) => {
    try {
      await nurseService.recordTaskAction(task.id, { action: 'START' });
      showToast(`Task "${task.task_name}" marked In Progress.`);
      loadWorkspaceData(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update task');
    }
  };

  const handleSaveCompleteTask = async () => {
    if (!completingTask) return;
    setSavingTaskAction(true);
    try {
      await nurseService.recordTaskAction(completingTask.id, {
        action: 'COMPLETE',
        completion_notes: taskCompletionNotes
      });
      showToast(`Task "${completingTask.task_name}" completed successfully.`);
      setCompletingTask(null);
      setTaskCompletionNotes('');
      loadWorkspaceData(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to complete task');
    } finally {
      setSavingTaskAction(false);
    }
  };

  const handleCreateCarePlanTask = async () => {
    if (!newTaskPatientId || !newTaskName.trim() || !newTaskDueTime) {
      alert('Please select patient, task title, and scheduled time.');
      return;
    }
    setSavingNewTask(true);
    try {
      await nurseService.createTask({
        patient_id: newTaskPatientId,
        task_name: newTaskName,
        instructions: newTaskInstructions,
        priority: newTaskPriority,
        due_time: newTaskDueTime
      });
      showToast('Nursing care plan task scheduled.');
      setShowCreateTaskModal(false);
      setNewTaskName('');
      setNewTaskInstructions('');
      loadWorkspaceData(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create task');
    } finally {
      setSavingNewTask(false);
    }
  };

  // Record Vitals
  const handleSaveVitals = async () => {
    if (!vitalsPatientId) {
      alert('Please select a patient.');
      return;
    }
    setSavingVitals(true);
    try {
      await nurseService.recordVitals({
        patient_id: vitalsPatientId,
        bp_systolic: vitalsBpSystolic ? parseInt(vitalsBpSystolic) : undefined,
        bp_diastolic: vitalsBpDiastolic ? parseInt(vitalsBpDiastolic) : undefined,
        heart_rate: vitalsHeartRate ? parseInt(vitalsHeartRate) : undefined,
        body_temperature: vitalsTemp ? parseFloat(vitalsTemp) : undefined,
        respiratory_rate: vitalsRespRate ? parseInt(vitalsRespRate) : undefined,
        spo2: vitalsSpo2 ? parseFloat(vitalsSpo2) : undefined,
        blood_glucose: vitalsGlucose ? parseFloat(vitalsGlucose) : undefined,
        pain_score: vitalsPainScore ? parseInt(vitalsPainScore) : 0,
        nurse_remarks: vitalsRemarks,
        escalate_to_doctor: vitalsEscalateDoctor
      });
      showToast('Vital signs recorded with automated threshold evaluation.');
      setShowRecordVitalsModal(false);
      // Reset form
      setVitalsBpSystolic('');
      setVitalsBpDiastolic('');
      setVitalsHeartRate('');
      setVitalsTemp('');
      setVitalsRespRate('');
      setVitalsSpo2('');
      setVitalsGlucose('');
      setVitalsPainScore('0');
      setVitalsRemarks('');
      setVitalsEscalateDoctor(false);
      loadWorkspaceData(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to record vitals');
    } finally {
      setSavingVitals(false);
    }
  };

  // Handover submission & acknowledgment
  const handleSubmitHandover = async () => {
    if (!handoverConditionUpdates.trim()) {
      alert('Patient condition updates are mandatory for shift handover.');
      return;
    }
    setSubmittingHandover(true);
    try {
      await nurseService.submitShiftHandover({
        patient_condition_updates: handoverConditionUpdates,
        important_observations: handoverObservations,
        pending_medications_summary: handoverPendingMeds,
        pending_tasks_summary: handoverPendingTasks,
        critical_alerts_summary: handoverCriticalAlerts,
        follow_up_procedures: handoverFollowUp
      });
      showToast('Shift handover successfully submitted for incoming nurse review.');
      setShowSubmitHandoverModal(false);
      setHandoverConditionUpdates('');
      setHandoverObservations('');
      setHandoverPendingMeds('');
      setHandoverPendingTasks('');
      setHandoverCriticalAlerts('');
      setHandoverFollowUp('');
      loadWorkspaceData(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit shift handover');
    } finally {
      setSubmittingHandover(false);
    }
  };

  const handleAcknowledgeHandover = async () => {
    if (!acknowledgingHandoverId) return;
    setSubmittingAck(true);
    try {
      await nurseService.acknowledgeShiftHandover(acknowledgingHandoverId, ackNotes);
      showToast('Shift handover officially acknowledged. Shift custody transferred.');
      setAcknowledgingHandoverId(null);
      setAckNotes('');
      loadWorkspaceData(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to acknowledge handover');
    } finally {
      setSubmittingAck(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Nurse Shift Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-800">
                <HeartPulse className="w-6 h-6 text-cyan-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {t('nurseWorkspace.title', 'Nurse Clinical Workspace')}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">
                    24/7 Inpatient Care
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  Assigned Ward: <strong className="text-slate-900">{overview?.shift_info?.ward || 'General Medical Inpatient Ward'}</strong> &bull; {overview?.shift_info?.shift_name || 'Active Nursing Shift'} ({overview?.shift_info?.start_time || '07:00'} - {overview?.shift_info?.end_time || '15:30'})
                </p>
              </div>
            </div>
          </div>

          {/* Quick Shift Badges & Refresh */}
          {(() => {
            const isNurseOnDuty = staffProfile?.is_on_duty ?? overview?.shift_info?.is_on_duty ?? overview?.shift?.is_on_duty ?? true;
            return (
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">{t('nurseWorkspace.nurseDutyStatus', 'Duty Status')}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-2 h-2 rounded-full ${isNurseOnDuty ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="font-bold text-slate-900">{overview?.nurse_info?.name || overview?.nurse?.name || userProfile?.full_name || 'Staff Nurse'}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${isNurseOnDuty ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {isNurseOnDuty ? 'ON DUTY' : 'OFF DUTY'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => loadWorkspaceData(true)}
                  disabled={refreshing}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition"
                  title="Refresh Workspace Data"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-700' : ''}`} />
                </button>
              </div>
            );
          })()}
        </div>

        {/* Shift Handover Pending Warning Banner if applicable */}
        {overview?.handover_status?.pending_acknowledgment && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Attention:</strong> An incoming shift handover report is awaiting formal review and custody sign-off.
              </span>
            </div>
            <button
              onClick={() => setTab('handover')}
              className="px-3 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition shrink-0"
            >
              Review Handover &rarr;
            </button>
          </div>
        )}
      </div>

      {/* 4 TOP MANDATORY SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Assigned Patients */}
        <div
          onClick={() => setTab('patients')}
          className={`p-5 rounded-2xl bg-white border transition cursor-pointer shadow-xs group ${
            currentTab === 'patients'
              ? 'border-cyan-600 ring-2 ring-cyan-500/20'
              : 'border-slate-200 hover:border-cyan-400'
          }`}
        >
          <div className="flex items-center justify-between text-slate-600 mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Assigned Patients
            </span>
            <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center border border-cyan-200 group-hover:bg-cyan-100 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {overview?.summary_metrics?.assigned_patients_count ?? patients.length}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px]">
            <span className="text-slate-600 font-medium">Ward Bed Allocation</span>
            <span className="text-cyan-800 font-bold group-hover:text-cyan-900 flex items-center gap-1 transition">
              View Roster &rarr;
            </span>
          </div>
        </div>

        {/* Card 2: Medications Due */}
        <div
          onClick={() => setTab('medications')}
          className={`p-5 rounded-2xl bg-white border transition cursor-pointer shadow-xs group ${
            currentTab === 'medications'
              ? 'border-blue-600 ring-2 ring-blue-500/20'
              : 'border-slate-200 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between text-slate-600 mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              2. Medications Due
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200 group-hover:bg-blue-100 transition">
              <Pill className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {overview?.summary_metrics?.medications_due_count ?? 0}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px]">
            <span className="text-slate-600 font-medium">Doctor eMAR Orders</span>
            <span className="text-blue-800 font-bold group-hover:text-blue-900 flex items-center gap-1 transition">
              eMAR Sheet &rarr;
            </span>
          </div>
        </div>

        {/* Card 3: Pending Nursing Tasks */}
        <div
          onClick={() => setTab('tasks')}
          className={`p-5 rounded-2xl bg-white border transition cursor-pointer shadow-xs group ${
            currentTab === 'tasks'
              ? 'border-indigo-600 ring-2 ring-indigo-500/20'
              : 'border-slate-200 hover:border-indigo-400'
          }`}
        >
          <div className="flex items-center justify-between text-slate-600 mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              3. Pending Tasks
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200 group-hover:bg-indigo-100 transition">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">
            {overview?.summary_metrics?.pending_tasks_count ?? 0}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px]">
            <span className="text-slate-600 font-medium">Care Plan & Doctor Orders</span>
            <span className="text-indigo-800 font-bold group-hover:text-indigo-900 flex items-center gap-1 transition">
              Tasks & Vitals &rarr;
            </span>
          </div>
        </div>

        {/* Card 4: Critical Alerts */}
        <div
          onClick={() => setTab('tasks')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-rose-400 transition cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between text-slate-600 mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              4. Critical Alerts
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200 group-hover:bg-rose-100 transition">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-700 tracking-tight">
            {overview?.summary_metrics?.critical_alerts_count ?? 0}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px]">
            <span className="text-rose-700 font-semibold">Immediate Physician Review</span>
            <span className="text-slate-500 group-hover:text-rose-700 flex items-center gap-1 font-bold transition">
              View Alerts &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* PRIMARY SECTION TABS (The 4 Official Requirements) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-xs flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setTab('patients')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition shrink-0 ${
            currentTab === 'patients'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('nurseWorkspace.myPatients', 'A. My Patients')}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${currentTab === 'patients' ? 'bg-cyan-700 text-white' : 'bg-slate-200 text-slate-800'}`}>
            {patients.length}
          </span>
        </button>

        <button
          onClick={() => setTab('medications')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition shrink-0 ${
            currentTab === 'medications'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Pill className="w-4 h-4" />
          <span>{t('nurseWorkspace.medicationAdmin', 'B. Medication Administration')}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${currentTab === 'medications' ? 'bg-cyan-700 text-white' : 'bg-slate-200 text-slate-800'}`}>
            {overview?.summary_metrics?.medications_due_count || 0} {t('nurseWorkspace.due', 'Due')}
          </span>
        </button>

        <button
          onClick={() => setTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition shrink-0 ${
            currentTab === 'tasks'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{t('nurseWorkspace.nursingTasksVitals', 'C. Nursing Tasks & Vital Signs')}</span>
        </button>

        <button
          onClick={() => setTab('handover')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition shrink-0 ${
            currentTab === 'handover'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>{t('nurseWorkspace.shiftHandoverNotes', 'D. Shift Handover')}</span>
          {overview?.handover_status?.pending_acknowledgment && (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION A: MY PATIENTS */}
      {/* ========================================================================= */}
      {currentTab === 'patients' && (
        <div className="space-y-4">
          {/* Section Toolbar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Assigned Inpatient Census</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Patients assigned to your active ward, department, and shift allocation.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by UHID, patient name, room..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadWorkspaceData(true)}
                  className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/15 w-64"
                />
              </div>
              <button
                onClick={() => loadWorkspaceData(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
              >
                Filter
              </button>
            </div>
          </div>

          {/* Clinical Guard Notice */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-2.5">
            <Info className="w-4 h-4 text-cyan-700 shrink-0" />
            <span>
              <strong>Clinical Guard:</strong> Nurses can update permitted nursing-related patient data (Allergies, Dietary, Fall/Isolation Precautions, Emergency Contact). Primary diagnoses and prescription orders are locked to authorized physicians.
            </span>
          </div>

          {/* Patients Grid / Cards */}
          {loading ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-cyan-700 mb-2" />
              <p className="text-xs text-slate-600 font-medium">Loading assigned inpatients...</p>
            </div>
          ) : patients.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
              <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-800">No inpatients assigned to this ward/shift</p>
              <p className="text-xs text-slate-500 mt-1">
                Patients will appear here once admitted to your allocated beds.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patients.map((p) => {
                const vit = p.latest_vitals;
                return (
                  <div
                    key={p.id}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs transition space-y-3.5"
                  >
                    {/* Patient Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base text-slate-900">{p.full_name}</h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
                            {p.uhid}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 font-medium">
                          {p.age} yrs &bull; {p.gender} &bull; Blood: <strong className="text-slate-800">{p.blood_group || 'O+'}</strong>
                        </p>
                      </div>

                      {/* Ward & Bed Tag */}
                      <div className="text-right">
                        <span className="px-2.5 py-1 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs font-black font-mono block">
                          Bed {p.bed_number || 'N/A'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                          {p.ward} (Rm {p.room_number || '-'})
                        </span>
                      </div>
                    </div>

                    {/* Attending Physician & Admission Date */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] font-semibold flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-cyan-700" /> Attending Doctor:
                        </span>
                        <strong className="text-slate-900">{p.admitting_doctor?.name || 'Dr. On Duty'}</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] font-semibold flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" /> Admitted On:
                        </span>
                        <span className="font-medium text-slate-800">
                          {p.admission_date ? new Date(p.admission_date).toLocaleDateString() : 'Active'}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-slate-200 flex items-start gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-600 shrink-0">Diagnosis:</span>
                        <span className="text-slate-900 font-medium italic">
                          {p.initial_diagnosis || 'Under Clinical Evaluation'}
                        </span>
                      </div>
                    </div>

                    {/* Clinical Tags: Allergies, Fall Risk, Isolation */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                      {p.fall_risk && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Fall Risk
                        </span>
                      )}
                      {p.isolation_required && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-300 font-bold flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-purple-600" /> Isolation
                        </span>
                      )}
                      {p.allergies && p.allergies.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-300 font-bold">
                          Allergies: {p.allergies.join(', ')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 font-medium">
                          No Known Drug Allergies (NKDA)
                        </span>
                      )}
                    </div>

                    {/* Latest Recorded Vitals Snapshot */}
                    <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5 text-cyan-700" /> Latest Vital Signs:
                        </span>
                        {vit ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              vit.severity_level === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : vit.severity_level === 'WARNING'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            {vit.severity_level}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No vitals logged today</span>
                        )}
                      </div>

                      {vit ? (
                        <div className="grid grid-cols-4 gap-2 text-center pt-1">
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-[9px] text-slate-500 block uppercase font-bold">BP</span>
                            <span className="text-xs font-mono font-extrabold text-slate-900">
                              {vit.bp_systolic}/{vit.bp_diastolic}
                            </span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-[9px] text-slate-500 block uppercase font-bold">HR (bpm)</span>
                            <span className="text-xs font-mono font-extrabold text-slate-900">{vit.heart_rate}</span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-[9px] text-slate-500 block uppercase font-bold">SpO2</span>
                            <span className="text-xs font-mono font-extrabold text-slate-900">{vit.spo2}%</span>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-[9px] text-slate-500 block uppercase font-bold">Temp (°C)</span>
                            <span className="text-xs font-mono font-extrabold text-slate-900">{vit.body_temperature}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Action Buttons: Notes/EMR & Edit Nursing Info */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <button
                        onClick={() => handleOpenNotes(p)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-cyan-700" />
                        Nursing Notes & EMR
                      </button>

                      <button
                        onClick={() => handleOpenEditPatient(p)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200 font-bold transition flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-cyan-700" />
                        Update Nursing Info
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B: MEDICATION ADMINISTRATION (eMAR) */}
      {/* ========================================================================= */}
      {currentTab === 'medications' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Doctor Prescribed Medications (eMAR)</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Verify patient identity, five rights of medication administration, and record clinical actions.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filters */}
              {['ALL', 'DUE', 'UPCOMING', 'ADMINISTERED', 'MISSED', 'OVERDUE'].map((st) => (
                <button
                  key={st}
                  onClick={() => setMedStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    medStatusFilter === st
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* eMAR Warning Box */}
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              <strong>Prescription Authority:</strong> All listed items are directly synchronized from authorized physician orders. Nurses record execution (Administered, Missed, Refused) and clinical adverse responses. Modification of doctor prescription orders is restricted.
            </span>
          </div>

          {/* eMAR Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Patient & Bed</th>
                    <th className="py-3.5 px-4">Medication & Dosage</th>
                    <th className="py-3.5 px-4">Route / Freq</th>
                    <th className="py-3.5 px-4">Scheduled Time</th>
                    <th className="py-3.5 px-4">Food / Instructions</th>
                    <th className="py-3.5 px-4">Prescribing Doctor</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">eMAR Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {medications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No medication administration records matching filter.
                      </td>
                    </tr>
                  ) : (
                    medications.map((m) => {
                      const isDue = m.status === 'DUE' || m.status === 'OVERDUE';
                      const isAdministered = m.status === 'ADMINISTERED';
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-medium">
                            <strong className="text-slate-900 block">{m.patient_name}</strong>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {m.uhid} &bull; {m.ward_bed}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <strong className="text-slate-900 block font-bold text-sm">
                              {m.medication_name}
                            </strong>
                            <span className="text-slate-600 font-semibold">{m.dosage}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] font-bold">
                              {m.route}
                            </span>
                            <span className="block text-[11px] text-slate-500 mt-0.5">{m.frequency}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                            {m.scheduled_time}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                            <span className="text-slate-800 font-medium">{m.food_instructions || 'Standard'}</span>
                            {m.doctor_instructions && (
                              <p className="text-[10px] text-cyan-800 italic mt-0.5">{m.doctor_instructions}</p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            {m.prescribing_doctor || 'Attending Physician'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
                                m.status === 'ADMINISTERED'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : m.status === 'DUE'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : m.status === 'OVERDUE'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : m.status === 'MISSED' || m.status === 'REFUSED'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {m.status}
                            </span>
                            {m.administered_at && (
                              <span className="block text-[10px] text-slate-500 mt-1">
                                at {new Date(m.administered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by {m.administering_nurse_name}
                              </span>
                            )}
                            {m.reason_for_non_admin && (
                              <span className="block text-[10px] text-rose-700 italic mt-0.5">
                                Reason: {m.reason_for_non_admin}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {!isAdministered ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenMedAction(m, 'ADMINISTER')}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                                >
                                  Administer
                                </button>
                                <button
                                  onClick={() => handleOpenMedAction(m, 'MISSED')}
                                  className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                                  title="Mark Missed or Refused"
                                >
                                  Omit...
                                </button>
                              </div>
                            ) : (
                              <span className="text-emerald-700 font-bold text-xs inline-flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Given
                              </span>
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

      {/* ========================================================================= */}
      {/* SECTION C: NURSING TASKS & VITAL SIGNS */}
      {/* ========================================================================= */}
      {currentTab === 'tasks' && (
        <div className="space-y-6">
          {/* Top Controls: Schedule Care Plan Task & Record Vitals */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Nursing Care Plan Tasks & Vitals Monitoring</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Execute physician orders, manage routine nursing tasks, and record vitals with automated threshold alerts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRecordVitalsModal(true)}
                className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
              >
                <HeartPulse className="w-4 h-4" />
                Record Vitals Signs
              </button>
              <button
                onClick={() => setShowCreateTaskModal(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Care Plan Task
              </button>
            </div>
          </div>

          {/* SUB-SECTION 1: NURSING TASKS LIST */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-cyan-700" />
                Nursing Task Roster
              </h3>
              <div className="flex items-center gap-1.5">
                {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setTaskStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      taskStatusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {tasks.length === 0 ? (
                <p className="py-8 text-center text-slate-500 text-xs">
                  No nursing tasks currently scheduled.
                </p>
              ) : (
                tasks.map((t) => (
                  <div key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                            t.priority === 'STAT'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                              : t.priority === 'URGENT'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.priority}
                        </span>
                        <strong className="text-sm font-bold text-slate-900">{t.task_name}</strong>
                      </div>
                      <p className="text-xs text-slate-600">
                        Patient: <strong className="text-slate-800">{t.patient_name}</strong> ({t.ward_bed}) &bull; Instructions: {t.instructions || 'Standard nursing protocol'}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" /> Due: {t.due_time}
                        </span>
                        {t.completed_by_name && (
                          <span className="text-emerald-700 font-semibold">
                            Completed by {t.completed_by_name} at {t.completed_at ? new Date(t.completed_at).toLocaleTimeString() : ''}
                          </span>
                        )}
                        {t.completion_notes && (
                          <span className="text-slate-600 italic">Notes: {t.completion_notes}</span>
                        )}
                      </div>
                    </div>

                    {/* Task Actions */}
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      {t.status === 'PENDING' && (
                        <button
                          onClick={() => handleStartTask(t)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
                        >
                          Start Task
                        </button>
                      )}
                      {t.status !== 'COMPLETED' && (
                        <button
                          onClick={() => {
                            setCompletingTask(t);
                            setTaskCompletionNotes('');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs transition flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Complete
                        </button>
                      )}
                      {t.status === 'COMPLETED' && (
                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SUB-SECTION 2: RECENT VITALS OBSERVATIONS & ALERTS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-700" />
                  Recent Vital Signs Observations & Clinical Thresholds
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated clinical threshold validation. Abnormal or critical observations are flagged for immediate physician escalation.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3">Patient & Location</th>
                    <th className="py-3 px-3">BP (mmHg)</th>
                    <th className="py-3 px-3">HR (bpm)</th>
                    <th className="py-3 px-3">Temp (°C)</th>
                    <th className="py-3 px-3">SpO2 (%)</th>
                    <th className="py-3 px-3">Resp / Glucose</th>
                    <th className="py-3 px-3">Pain (0-10)</th>
                    <th className="py-3 px-3">Threshold Severity</th>
                    <th className="py-3 px-3">Recorded By / Time</th>
                    <th className="py-3 px-3 text-right">Escalation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {vitalsList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        No vital sign observations logged today.
                      </td>
                    </tr>
                  ) : (
                    vitalsList.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3 font-medium">
                          <strong className="text-slate-900 block">{v.patient_name}</strong>
                          <span className="text-[11px] text-slate-500 font-mono">{v.uhid} &bull; {v.ward_bed}</span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '-'}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{v.heart_rate || '-'}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{v.body_temperature || '-'}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {v.spo2 ? (
                            <span className={v.spo2 < 95 ? 'text-rose-700 font-extrabold' : 'text-slate-900'}>
                              {v.spo2}%
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                          <div>RR: {v.respiratory_rate || '-'}</div>
                          <div className="text-slate-500">Glu: {v.blood_glucose || '-'} mg/dL</div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{v.pain_score ?? 0}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              v.severity_level === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : v.severity_level === 'WARNING'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {v.severity_level}
                          </span>
                          {v.alerts_triggered && v.alerts_triggered.length > 0 && (
                            <p className="text-[10px] text-rose-700 font-medium mt-1">
                              {v.alerts_triggered.join(', ')}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-600">
                          <div className="font-semibold text-slate-900">{v.recorded_by_name}</div>
                          <div className="text-slate-400 font-mono">
                            {new Date(v.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {v.is_escalated ? (
                            <span className="px-2 py-1 rounded-md bg-purple-100 text-purple-900 text-[10px] font-bold border border-purple-300 inline-flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> Escalated
                            </span>
                          ) : v.severity_level !== 'NORMAL' ? (
                            <button
                              onClick={async () => {
                                const note = prompt('Enter clinical escalation message to attending physician:');
                                if (note) {
                                  await nurseService.escalateVital(v.id, note);
                                  showToast('Vitals escalated to attending doctor.');
                                  loadWorkspaceData(true);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition"
                            >
                              Escalate
                            </button>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
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

      {/* ========================================================================= */}
      {/* SECTION D: SHIFT HANDOVER */}
      {/* ========================================================================= */}
      {currentTab === 'handover' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Shift Handover & Patient Custody Transfer</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Structured clinical shift handover. Handover is formally marked complete once the incoming nurse acknowledges custody.
              </p>
            </div>
            <button
              onClick={() => setShowSubmitHandoverModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-4 h-4" />
              Prepare & Submit Handover
            </button>
          </div>

          {/* Handover List */}
          <div className="space-y-3">
            {handovers.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
                <ArrowRightLeft className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-800">No shift handover reports logged yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  At the end of your shift, click "Prepare & Submit Handover" to brief the incoming nurse.
                </p>
              </div>
            ) : (
              handovers.map((h) => {
                const isAcknowledged = h.status === 'ACKNOWLEDGED';
                return (
                  <div
                    key={h.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              isAcknowledged
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {h.status}
                          </span>
                          <strong className="text-slate-900 text-sm font-bold">
                            {h.ward_name} &bull; {h.shift_name}
                          </strong>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Submitted by <strong className="text-slate-800">{h.outgoing_nurse_name}</strong> on {new Date(h.submitted_at).toLocaleString()}
                        </p>
                      </div>

                      {/* Acknowledgment Status / Button */}
                      <div>
                        {isAcknowledged ? (
                          <div className="text-right">
                            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold inline-flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              Acknowledged by {h.incoming_nurse_name}
                            </span>
                            {h.acknowledged_at && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Signed off: {new Date(h.acknowledged_at).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setAcknowledgingHandoverId(h.id);
                              setAckNotes('');
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                          >
                            <UserCheck className="w-4 h-4" />
                            Acknowledge & Accept Custody
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Handover Sections */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Patient Condition Updates
                        </span>
                        <p className="text-slate-800 mt-1 whitespace-pre-wrap font-medium">
                          {h.patient_condition_updates}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Important Observations
                        </span>
                        <p className="text-slate-800 mt-1 whitespace-pre-wrap font-medium">
                          {h.important_observations || 'No abnormal observations flagged.'}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Pending Medications Summary
                        </span>
                        <p className="text-slate-800 mt-1 whitespace-pre-wrap font-medium">
                          {h.pending_medications_summary || 'All scheduled medications administered or documented.'}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Critical Alerts & Follow-up
                        </span>
                        <p className="text-slate-800 mt-1 whitespace-pre-wrap font-medium">
                          {h.critical_alerts_summary || h.follow_up_procedures || 'No open escalations.'}
                        </p>
                      </div>
                    </div>

                    {h.acknowledgment_notes && (
                      <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900">
                        <strong>Incoming Nurse Notes:</strong> {h.acknowledgment_notes}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PATIENT NOTES & EMR */}
      {/* ========================================================================= */}
      {selectedPatientForNotes && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">
                  Nursing Notes & Assessment
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Patient: <strong className="text-slate-900">{selectedPatientForNotes.full_name}</strong> ({selectedPatientForNotes.uhid}) &bull; Bed {selectedPatientForNotes.bed_number}
                </p>
              </div>
              <button
                onClick={() => setSelectedPatientForNotes(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Existing Notes History */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Shift Assessment History
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {loadingNotes ? (
                  <p className="text-xs text-slate-500 py-4 text-center">Loading notes...</p>
                ) : patientNotes.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No nursing notes recorded yet.</p>
                ) : (
                  patientNotes.map((n) => (
                    <div key={n.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="font-bold text-slate-900">{n.nurse_name}</span>
                        <span className="font-mono text-[10px]">{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-800 font-medium">{n.shift_assessment}</p>
                      {n.care_plan_notes && (
                        <p className="text-slate-600 text-[11px] italic">Care Plan: {n.care_plan_notes}</p>
                      )}
                      {n.patient_response && (
                        <p className="text-slate-600 text-[11px]">Response: {n.patient_response}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add New Note Form */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Record New Shift Assessment
              </h4>
              <textarea
                rows={3}
                placeholder="Detailed shift assessment and observations..."
                value={newNoteAssessment}
                onChange={(e) => setNewNoteAssessment(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/15"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Care plan adjustments..."
                  value={newNoteCarePlan}
                  onChange={(e) => setNewNoteCarePlan(e.target.value)}
                  className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400"
                />
                <input
                  type="text"
                  placeholder="Patient response to treatment..."
                  value={newNoteResponse}
                  onChange={(e) => setNewNoteResponse(e.target.value)}
                  className="p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setSelectedPatientForNotes(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || !newNoteAssessment.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {savingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: UPDATE PATIENT NURSING PROFILE */}
      {/* ========================================================================= */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Update Nursing-Permitted Info
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {editingPatient.full_name} ({editingPatient.uhid})
                </p>
              </div>
              <button
                onClick={() => setEditingPatient(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
              Note: Modifications to official doctor diagnoses and prescription orders are restricted. Only nursing care flags and emergency contacts can be updated here.
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Known Allergies (comma-separated):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Sulfa drugs, Peanuts"
                  value={editAllergiesText}
                  onChange={(e) => setEditAllergiesText(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Dietary Restrictions:</label>
                <input
                  type="text"
                  placeholder="e.g. Diabetic renal, Low sodium, NPO"
                  value={editDietary}
                  onChange={(e) => setEditDietary(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Emergency Contact Number:</label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={editEmergencyContact}
                  onChange={(e) => setEditEmergencyContact(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFallRisk}
                    onChange={(e) => setEditFallRisk(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                  />
                  <span className="font-bold text-slate-800">Fall Risk Precaution</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsolation}
                    onChange={(e) => setEditIsolation(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                  />
                  <span className="font-bold text-slate-800">Isolation Required</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingPatient(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePatientInfo}
                disabled={savingPatientInfo}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {savingPatientInfo ? 'Saving...' : 'Save Updates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: eMAR MEDICATION ACTION (Administer / Missed / Refused) */}
      {/* ========================================================================= */}
      {actionMedication && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {medActionType === 'ADMINISTER' ? 'Record Medication Administration' : 'Record Omitted / Refused Dose'}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Patient: <strong className="text-slate-900">{actionMedication.patient_name}</strong> ({actionMedication.ward_bed})
                </p>
              </div>
              <button
                onClick={() => setActionMedication(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Med Summary */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-900 text-sm">{actionMedication.medication_name}</div>
              <div className="text-slate-600">
                Prescribed Dose: <strong>{actionMedication.dosage}</strong> &bull; Route: <strong>{actionMedication.route}</strong> &bull; Freq: <strong>{actionMedication.frequency}</strong>
              </div>
              <div className="text-[11px] text-slate-500">
                Scheduled: {actionMedication.scheduled_time} &bull; Doctor: {actionMedication.prescribing_doctor}
              </div>
            </div>

            {/* Action Type Picker */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMedActionType('ADMINISTER')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  medActionType === 'ADMINISTER'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Administer
              </button>
              <button
                onClick={() => setMedActionType('MISSED')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  medActionType === 'MISSED'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Missed
              </button>
              <button
                onClick={() => setMedActionType('REFUSED')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  medActionType === 'REFUSED'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Patient Refused
              </button>
            </div>

            {/* Form Fields */}
            {medActionType === 'ADMINISTER' ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Dosage Given:</label>
                    <input
                      type="text"
                      value={medDosageGiven}
                      onChange={(e) => setMedDosageGiven(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Route Used:</label>
                    <input
                      type="text"
                      value={medRouteUsed}
                      onChange={(e) => setMedRouteUsed(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Administration Remarks:</label>
                  <input
                    type="text"
                    placeholder="e.g. Well tolerated, given with breakfast"
                    value={medRemarks}
                    onChange={(e) => setMedRemarks(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                {/* Adverse reaction check */}
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-900">
                    <input
                      type="checkbox"
                      checked={medEscalateDoctor}
                      onChange={(e) => setMedEscalateDoctor(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500"
                    />
                    Flag Adverse Drug Reaction (Auto-escalate to Doctor)
                  </label>
                  {medEscalateDoctor && (
                    <textarea
                      rows={2}
                      placeholder="Describe symptoms, onset time, urticaria, rash, vomiting, etc."
                      value={medAdverseNotes}
                      onChange={(e) => setMedAdverseNotes(e.target.value)}
                      className="w-full p-2 bg-white border border-rose-300 rounded-xl text-slate-900 text-xs"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Mandatory Clinical Reason for Non-Administration:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Patient fasting for procedure / Patient refused due to nausea / NPO order active"
                    value={medReasonNonAdmin}
                    onChange={(e) => setMedReasonNonAdmin(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                    required
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={medEscalateDoctor}
                    onChange={(e) => setMedEscalateDoctor(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                  />
                  Notify Attending Doctor regarding missed dose
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setActionMedication(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMedAction}
                disabled={savingMedAction}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {savingMedAction ? 'Recording...' : 'Confirm eMAR Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: COMPLETE TASK */}
      {/* ========================================================================= */}
      {completingTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Complete Nursing Task</h3>
                <p className="text-xs text-slate-600 mt-0.5">{completingTask.task_name}</p>
              </div>
              <button
                onClick={() => setCompletingTask(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Completion Documentation & Observations:
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Wound dressed with sterile gauze, minimal exudate, healing cleanly..."
                  value={taskCompletionNotes}
                  onChange={(e) => setTaskCompletionNotes(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setCompletingTask(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCompleteTask}
                disabled={savingTaskAction}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {savingTaskAction ? 'Submitting...' : 'Sign Off Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ADD CARE PLAN TASK */}
      {/* ========================================================================= */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">Add Nursing Care Plan Task</h3>
              <button
                onClick={() => setShowCreateTaskModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Patient:</label>
                <select
                  value={newTaskPatientId}
                  onChange={(e) => setNewTaskPatientId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                >
                  <option value="">-- Choose Assigned Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.uhid} - Bed {p.bed_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Task Title / Action:</label>
                <input
                  type="text"
                  placeholder="e.g. Turn patient q2h, Foley catheter bag emptying, Dressing change"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority:</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e: any) => setNewTaskPriority(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  >
                    <option value="ROUTINE">ROUTINE</option>
                    <option value="URGENT">URGENT</option>
                    <option value="STAT">STAT (Immediate)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Scheduled Time:</label>
                  <input
                    type="time"
                    value={newTaskDueTime}
                    onChange={(e) => setNewTaskDueTime(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Clinical Instructions:</label>
                <textarea
                  rows={2}
                  placeholder="Specific sterile or nursing precautions..."
                  value={newTaskInstructions}
                  onChange={(e) => setNewTaskInstructions(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowCreateTaskModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCarePlanTask}
                disabled={savingNewTask}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {savingNewTask ? 'Adding...' : 'Schedule Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: RECORD VITAL SIGNS */}
      {/* ========================================================================= */}
      {showRecordVitalsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Record Patient Vital Signs</h3>
                <p className="text-xs text-slate-500 mt-0.5">Automated clinical threshold detection enabled.</p>
              </div>
              <button
                onClick={() => setShowRecordVitalsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Patient:</label>
                <select
                  value={vitalsPatientId}
                  onChange={(e) => setVitalsPatientId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.uhid} - Bed {p.bed_number})
                    </option>
                  ))}
                </select>
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Systolic BP (mmHg):</label>
                  <input
                    type="number"
                    placeholder="120"
                    value={vitalsBpSystolic}
                    onChange={(e) => setVitalsBpSystolic(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Diastolic BP (mmHg):</label>
                  <input
                    type="number"
                    placeholder="80"
                    value={vitalsBpDiastolic}
                    onChange={(e) => setVitalsBpDiastolic(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Heart Rate (bpm):</label>
                  <input
                    type="number"
                    placeholder="75"
                    value={vitalsHeartRate}
                    onChange={(e) => setVitalsHeartRate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Body Temp (°C):</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="37.0"
                    value={vitalsTemp}
                    onChange={(e) => setVitalsTemp(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">SpO2 Oxygen (%):</label>
                  <input
                    type="number"
                    placeholder="98"
                    value={vitalsSpo2}
                    onChange={(e) => setVitalsSpo2(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Respiratory Rate (bpm):</label>
                  <input
                    type="number"
                    placeholder="16"
                    value={vitalsRespRate}
                    onChange={(e) => setVitalsRespRate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Blood Glucose (mg/dL):</label>
                  <input
                    type="number"
                    placeholder="110"
                    value={vitalsGlucose}
                    onChange={(e) => setVitalsGlucose(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Pain Score (0 - 10):</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    placeholder="0"
                    value={vitalsPainScore}
                    onChange={(e) => setVitalsPainScore(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nurse Observations / Remarks:</label>
                <input
                  type="text"
                  placeholder="e.g. Patient resting quietly, oxygen on room air"
                  value={vitalsRemarks}
                  onChange={(e) => setVitalsRemarks(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 pt-1">
                <input
                  type="checkbox"
                  checked={vitalsEscalateDoctor}
                  onChange={(e) => setVitalsEscalateDoctor(e.target.checked)}
                  className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500"
                />
                Immediately Escalate & Notify Attending Doctor
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowRecordVitalsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVitals}
                disabled={savingVitals}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {savingVitals ? 'Recording...' : 'Save Vitals'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: PREPARE SHIFT HANDOVER */}
      {/* ========================================================================= */}
      {showSubmitHandoverModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Prepare Clinical Shift Handover
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ward: {overview?.shift_info?.ward} &bull; Shift: {overview?.shift_info?.shift_name}
                </p>
              </div>
              <button
                onClick={() => setShowSubmitHandoverModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Patient Condition Updates (Mandatory):
                </label>
                <textarea
                  rows={3}
                  placeholder="Summary of all inpatient conditions, clinical course, and stable/unstable states..."
                  value={handoverConditionUpdates}
                  onChange={(e) => setHandoverConditionUpdates(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Important Observations & Significant Events:
                </label>
                <textarea
                  rows={2}
                  placeholder="Changes in vitals, fever spikes, bleeding, drain outputs..."
                  value={handoverObservations}
                  onChange={(e) => setHandoverObservations(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Pending Medications & IV Infusions:
                </label>
                <textarea
                  rows={2}
                  placeholder="Antibiotic doses due next shift, continuous drip titration status..."
                  value={handoverPendingMeds}
                  onChange={(e) => setHandoverPendingMeds(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Critical Alerts & Follow-up Procedures:
                </label>
                <textarea
                  rows={2}
                  placeholder="Pending lab results, post-op vitals protocol, planned MRI transfer..."
                  value={handoverCriticalAlerts}
                  onChange={(e) => setHandoverCriticalAlerts(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowSubmitHandoverModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitHandover}
                disabled={submittingHandover}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {submittingHandover ? 'Submitting...' : 'Submit Handover Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: ACKNOWLEDGE HANDOVER SIGN-OFF */}
      {/* ========================================================================= */}
      {acknowledgingHandoverId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">
                Acknowledge Shift Custody
              </h3>
              <button
                onClick={() => setAcknowledgingHandoverId(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
              By confirming, you certify that you have reviewed all patient condition updates, pending medications, and critical alerts with the outgoing nurse and accept formal clinical custody.
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1 text-xs">
                Incoming Nurse Notes / Verification (Optional):
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Bedside rounds completed, all patients verified..."
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setAcknowledgingHandoverId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledgeHandover}
                disabled={submittingAck}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {submittingAck ? 'Signing...' : 'Confirm & Accept Custody'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NurseWorkspacePage;

