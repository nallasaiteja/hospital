import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Activity,
  Calendar,
  Users,
  Stethoscope,
  Pill,
  FileText,
  Radio,
  Bed,
  Share2,
  FileCheck,
  Bell,
  Clock,
  UserCheck,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Printer,
  Download,
  Mic,
  ShieldAlert,
  ChevronRight,
  Filter,
  X,
  Tv,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { doctorWorkspaceService, pharmacyService, diagnosticsService, opdService } from '../../services/api';
import { downloadOrPrintReport } from '../../utils/printReport';
import { DoctorDashboardView } from '../../components/doctor/DoctorDashboardView';
import { VoicePrescriptionModal } from '../../components/clinical/VoicePrescriptionModal';
import { Modal } from '../../components/common/Modal';
import { LoungeTVPage } from '../LoungeTVPage';
import clsx from 'clsx';

type WorkspaceTab =
  | 'overview'
  | 'appointments'
  | 'patients'
  | 'consultation'
  | 'prescriptions'
  | 'investigations'
  | 'reports'
  | 'inpatients'
  | 'referrals'
  | 'documents'
  | 'leaves'
  | 'profile';

export const DoctorWorkspacePage: React.FC = () => {
  const { userProfile, staffProfile } = useAuth();
  const { currentBranch } = useBranch();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeTab = (searchParams.get('tab') as WorkspaceTab) || 'overview';

  // Core State
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState<boolean>(false);
  const [activePatientEMR, setActivePatientEMR] = useState<any>(null);
  const [loadingEMR, setLoadingEMR] = useState<boolean>(false);

  // Waiting Lounge TV & Queue Telemetry State
  const [showLoungeTVModal, setShowLoungeTVModal] = useState<boolean>(false);
  const [loungeStats, setLoungeStats] = useState<{ waitingInLounge: number; totalTokens: number; servingToken: string | null }>({
    waitingInLounge: 0,
    totalTokens: 0,
    servingToken: null,
  });

  const loadLoungeStats = async () => {
    try {
      const res = await opdService.getLoungeTV({ doctor_id: staffProfile?.id });
      const myDoc = res.doctors.find((d) => d.doctor_id === staffProfile?.id) || res.doctors[0];
      if (myDoc) {
        setLoungeStats({
          waitingInLounge: myDoc.waiting_in_lounge_count,
          totalTokens: myDoc.total_tokens,
          servingToken: myDoc.currently_serving_token,
        });
      }
    } catch (e) {
      // Non-critical background telemetry
    }
  };

  useEffect(() => {
    loadLoungeStats();
    loadDashboard();
    const interval = setInterval(() => {
      loadLoungeStats();
      if (activeTab === 'overview') {
        loadDashboard();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [staffProfile?.id, activeTab]);

  // Consultation State
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(
    searchParams.get('appointment_id') || null
  );
  const [consultationData, setConsultationData] = useState<any>(null);
  const [loadingConsultation, setLoadingConsultation] = useState<boolean>(false);
  const [savingConsultation, setSavingConsultation] = useState<boolean>(false);
  const [showAddendumModal, setShowAddendumModal] = useState<boolean>(false);
  const [addendumReason, setAddendumReason] = useState<string>('');
  const [addendumNotes, setAddendumNotes] = useState<string>('');

  // Prescription State
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState<boolean>(false);
  const [showNewRxModal, setShowNewRxModal] = useState<boolean>(false);
  const [showVoiceRxModal, setShowVoiceRxModal] = useState<boolean>(false);
  const [formularyMedicines, setFormularyMedicines] = useState<any[]>([]);
  const [rxForm, setRxForm] = useState({
    patient_id: '',
    appointment_id: '',
    diagnosis: '',
    clinical_notes: '',
    items: [
      {
        medicine_id: '',
        dosage: '1 Tablet',
        frequency: '1-0-1',
        duration_days: 5,
        total_quantity: 10,
        timing: 'MORNING_NIGHT',
        food_instruction: 'AFTER_FOOD',
        route: 'ORAL',
        instructions: '',
      },
    ],
  });

  // Investigation State
  const [investigationCatalogue, setInvestigationCatalogue] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [showOrderInvestigationModal, setShowOrderInvestigationModal] = useState<boolean>(false);
  const [invForm, setInvForm] = useState({
    patient_id: '',
    type: 'LAB',
    test_ids: [] as string[],
    modality: 'XRAY',
    procedure_name: 'Chest X-Ray PA View',
    priority: 'ROUTINE',
    clinical_reason: '',
  });
  const [invFilterType, setInvFilterType] = useState<'ALL' | 'LAB' | 'RADIOLOGY'>('ALL');
  const [invSearchQuery, setInvSearchQuery] = useState<string>('');

  // Inpatients State
  const [inpatients, setInpatients] = useState<any[]>([]);
  const [loadingInpatients, setLoadingInpatients] = useState<boolean>(false);
  const [showWardRoundModal, setShowWardRoundModal] = useState<boolean>(false);
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);
  const [wardRoundForm, setWardRoundForm] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    vitals: { bp: '', pulse: '', temp: '', spo2: '' },
  });

  // Referrals State
  const [referrals, setReferrals] = useState<{ outgoing: any[]; incoming: any[] }>({ outgoing: [], incoming: [] });
  const [loadingReferrals, setLoadingReferrals] = useState<boolean>(false);
  const [showReferralModal, setShowReferralModal] = useState<boolean>(false);
  const [refForm, setRefForm] = useState({
    patient_id: '',
    receiving_department_id: '',
    receiving_doctor_id: '',
    priority: 'ROUTINE',
    referral_reason: '',
    clinical_notes: '',
  });

  // Documents & Certificates State
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState<boolean>(false);
  const [showDocumentModal, setShowDocumentModal] = useState<boolean>(false);
  const [selectedDocumentToPrint, setSelectedDocumentToPrint] = useState<any>(null);
  const [docForm, setDocForm] = useState({
    patient_id: '',
    document_type: 'MEDICAL_CERTIFICATE',
    title: 'Medical Certificate of Illness',
    diagnosis: '',
    clinical_summary: '',
    recommendations: 'Complete bed rest advised.',
    leave_from_date: '',
    leave_to_date: '',
    fitness_date: '',
  });

  // Leaves State
  const [leavesData, setLeavesData] = useState<{ balances: any[]; history: any[]; leave_types: any[] }>({
    balances: [],
    history: [],
    leave_types: [],
  });
  const [loadingLeaves, setLoadingLeaves] = useState<boolean>(false);
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState<boolean>(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'CASUAL',
    start_date: '',
    end_date: '',
    reason: '',
  });

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Profile State
  const [profileData, setProfileData] = useState<any>(null);

  // Global Message / Alert
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
const handleTabChange = (tab: string, context?: any) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    if (context?.appointment_id) {
      params.set('appointment_id', context.appointment_id);
      setSelectedAppointmentId(context.appointment_id);
    }
    if (context?.patient_id) {
      params.set('patient_id', context.patient_id);
    }
    setSearchParams(params);
  };
// 1. Load Dashboard
  const loadDashboard = async () => {
    setLoadingDashboard(true);
    try {
      const data = await doctorWorkspaceService.getDashboard();
      setDashboardData(data);
    } catch (err: any) {
      console.error('Failed to load doctor dashboard', err);
    } finally {
      setLoadingDashboard(false);
    }
  };
// 2. Load Appointments
  const loadAppointments = async (scope = 'all', status = '', search = '') => {
    setLoadingAppointments(true);
    try {
      const data = await doctorWorkspaceService.getAppointments({ scope, status, search });
      setAppointments(data);
    } catch (err: any) {
      console.error('Failed to load appointments', err);
    } finally {
      setLoadingAppointments(false);
    }
  };
// 3. Load Patients
  const loadPatients = async (search = '') => {
    setLoadingPatients(true);
    try {
      const data = await doctorWorkspaceService.getPatients({ search });
      setPatients(data);
    } catch (err: any) {
      console.error('Failed to load patients', err);
    } finally {
      setLoadingPatients(false);
    }
  };
// 4. Load Consultation Detail
  const loadConsultation = async (appId: string) => {
    setLoadingConsultation(true);
    try {
      const data = await doctorWorkspaceService.getConsultationDetail(appId);
      setConsultationData(data);
    } catch (err: any) {
      console.error('Failed to load consultation', err);
      showToast('Failed to load consultation details', 'error');
    } finally {
      setLoadingConsultation(false);
    }
  };
// 5. Load Prescriptions & Formulary
  const loadPrescriptions = async () => {
    setLoadingPrescriptions(true);
    try {
      const [rxList, formulary] = await Promise.all([
        doctorWorkspaceService.getPrescriptions(),
        pharmacyService.getMedicines({ limit: 200 }).catch(() => []),
      ]);
      setPrescriptions(rxList);
      setFormularyMedicines(Array.isArray(formulary) ? formulary : formulary?.results || []);
    } catch (err: any) {
      console.error('Failed to load prescriptions', err);
    } finally {
      setLoadingPrescriptions(false);
    }
  };
// 6. Load Investigations & Reports
  const loadInvestigationsAndReports = async () => {
    setLoadingReports(true);
    try {
      const [cat, repList] = await Promise.all([
        doctorWorkspaceService.getInvestigationCatalogue().catch(() => null),
        doctorWorkspaceService.getReports().catch(() => []),
      ]);
      setInvestigationCatalogue(cat);
      setReports(repList);
    } catch (err: any) {
      console.error('Failed to load reports', err);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleDownloadReport = async (orderId: string) => {
    try {
      const detail = await diagnosticsService.getReportDetail(orderId);
      downloadOrPrintReport(detail);
    } catch (err: any) {
      showToast('Unable to download official report PDF', 'error');
    }
  };

  
  // 7. Load Inpatients
  const loadInpatients = async () => {
    setLoadingInpatients(true);
    try {
      const data = await doctorWorkspaceService.getInpatients();
      setInpatients(data);
    } catch (err: any) {
      console.error('Failed to load inpatients', err);
    } finally {
      setLoadingInpatients(false);
    }
  };
// 8. Load Referrals
  const loadReferrals = async () => {
    setLoadingReferrals(true);
    try {
      const data = await doctorWorkspaceService.getReferrals();
      setReferrals(data);
    } catch (err: any) {
      console.error('Failed to load referrals', err);
    } finally {
      setLoadingReferrals(false);
    }
  };
// 9. Load Documents
  const loadDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const data = await doctorWorkspaceService.getDocuments();
      setDocuments(data);
    } catch (err: any) {
      console.error('Failed to load documents', err);
    } finally {
      setLoadingDocuments(false);
    }
  };
// 10. Load Leaves
  const loadLeaves = async () => {
    setLoadingLeaves(true);
    try {
      const data = await doctorWorkspaceService.getLeaves();
      setLeavesData(data);
    } catch (err: any) {
      console.error('Failed to load leaves', err);
    } finally {
      setLoadingLeaves(false);
    }
  };
// 11. Load Notifications
  const loadNotifications = async () => {
    try {
      const res = await doctorWorkspaceService.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch (err: any) {
      console.error('Failed to load notifications', err);
    }
  };
// 12. Load Profile
  const loadProfile = async () => {
    try {
      const data = await doctorWorkspaceService.getProfile();
      setProfileData(data);
    } catch (err: any) {
      console.error('Failed to load doctor profile', err);
    }
  };
// Load dashboard, orders, reports, appointments on initial mount for live badge metrics
  useEffect(() => {
    loadDashboard();
    loadAppointments();
    loadPatients();
    loadPrescriptions();
    loadInvestigationsAndReports();
    loadInpatients();
    loadReferrals();
    loadDocuments();
    loadLeaves();
  }, []);

  // Effect to reload specific activeTab data on tab switch
  useEffect(() => {
    if (activeTab === 'overview') loadDashboard();
    if (activeTab === 'appointments') loadAppointments();
    if (activeTab === 'patients') loadPatients();
    if (activeTab === 'consultation' && selectedAppointmentId) loadConsultation(selectedAppointmentId);
    if (activeTab === 'prescriptions') loadPrescriptions();
    if (activeTab === 'investigations' || activeTab === 'reports') loadInvestigationsAndReports();
    if (activeTab === 'inpatients') loadInpatients();
    if (activeTab === 'referrals') loadReferrals();
    if (activeTab === 'documents') loadDocuments();
    if (activeTab === 'leaves') loadLeaves();
    if (activeTab === 'profile') loadProfile();
  }, [activeTab, selectedAppointmentId]);

  // Handle Save Consultation
  const handleSaveConsultation = async (action: 'SAVE_DRAFT' | 'COMPLETE_AND_SIGN') => {
    if (!selectedAppointmentId || !consultationData) return;
    setSavingConsultation(true);
    try {
      const res = await doctorWorkspaceService.saveConsultation(selectedAppointmentId, {
        action,
        chief_complaint: consultationData.chief_complaint,
        symptom_duration: consultationData.symptom_duration,
        vitals: consultationData.vitals,
        general_examination: consultationData.general_examination,
        systemic_examination: consultationData.systemic_examination,
        examination_findings: consultationData.examination_findings,
        diagnosis: consultationData.diagnosis,
        secondary_diagnosis: consultationData.secondary_diagnosis,
        icd10_code: consultationData.icd10_code,
        treatment_plan: consultationData.treatment_plan,
        consultation_notes: consultationData.consultation_notes,
        follow_up_instructions: consultationData.follow_up_instructions,
        follow_up_date: consultationData.follow_up_date,
      });
      showToast(res.message || 'Consultation saved successfully');
      loadConsultation(selectedAppointmentId);
      loadDashboard();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to save consultation', 'error');
    } finally {
      setSavingConsultation(false);
    }
  };
// Handle Addendum Submit
  const handleAddendumSubmit = async () => {
    if (!selectedAppointmentId || !addendumReason || !addendumNotes) {
      showToast('Reason and notes are required for an addendum', 'error');
      return;
    }
    try {
      const res = await doctorWorkspaceService.addConsultationAddendum(selectedAppointmentId, {
        reason_for_amendment: addendumReason,
        addendum_notes: addendumNotes,
      });
      showToast(res.message || 'Addendum recorded');
      setShowAddendumModal(false);
      setAddendumReason('');
      setAddendumNotes('');
      loadConsultation(selectedAppointmentId);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to record addendum', 'error');
    }
  };
// Handle Prescription Submit
  const handleCreatePrescription = async () => {
    if (!rxForm.patient_id || !rxForm.diagnosis || rxForm.items.length === 0) {
      showToast('Please select a patient, diagnosis, and at least one medication', 'error');
      return;
    }
    try {
      const res = await doctorWorkspaceService.createPrescription(rxForm);
      showToast(`Prescription ${res.prescription_number} signed & created!`);
      if (res.allergy_warnings && res.allergy_warnings.length > 0) {
        showToast(res.allergy_warnings[0], 'error');
      }
      setShowNewRxModal(false);
      loadPrescriptions();
      loadDashboard();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to issue prescription', 'error');
    }
  };
// Handle Apply Leave Submit
  const handleApplyLeave = async () => {
    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason) {
      showToast('All fields are required', 'error');
      return;
    }
    try {
      const res = await doctorWorkspaceService.applyLeave(leaveForm);
      showToast(res.message || 'Leave application submitted to HR');
      setShowApplyLeaveModal(false);
      setLeaveForm({ leave_type: 'CASUAL', start_date: '', end_date: '', reason: '' });
      loadLeaves();
      loadDashboard();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to submit leave application', 'error');
    }
  };
// Handle Create Investigation Order
  const handleCreateInvestigation = async () => {
    if (!invForm.patient_id || !invForm.clinical_reason) {
      showToast('Patient and clinical indication are required', 'error');
      return;
    }
    try {
      const res = await doctorWorkspaceService.orderInvestigation(invForm);
      showToast(res.message || 'Investigation order submitted successfully');
      setShowOrderInvestigationModal(false);
      loadInvestigationsAndReports();
      loadDashboard();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to order investigation', 'error');
    }
  };
// Live Section Counts for Tab Badges and Section Headers
  const todaysAppointmentsCount = Math.max(
    appointments.length,
    dashboardData?.statistics?.todays_appointments ?? 0,
    loungeStats.totalTokens
  );
  const patientsCount = patients.length || 0;
  const waitingPatientsCount = Math.max(
    dashboardData?.statistics?.waiting_patients ?? 0,
    loungeStats.waitingInLounge
  );
  const prescriptionsCount = prescriptions.length || 0;
  const activeLabOrdersCount = investigationCatalogue?.recent_orders?.length || dashboardData?.statistics?.pending_lab_results || 0;
  const reportsCount = reports.length || 0;
  const inpatientsCount = inpatients.length || dashboardData?.statistics?.admitted_patients || 0;
  const totalReferralsCount = (referrals.incoming?.length || 0) + (referrals.outgoing?.length || 0);
  const documentsCount = documents.length || 0;
  const pendingLeavesCount = leavesData.history?.filter((l: any) => l.status === 'PENDING').length || 0;

  // Navigation Items
  const navTabs = [
    { id: 'overview', label: '1. Overview', icon: Activity },
    { id: 'appointments', label: '2. My Appointments', icon: Calendar, badge: todaysAppointmentsCount },
    { id: 'patients', label: '3. My Patients', icon: Users, badge: patientsCount },
    { id: 'consultation', label: '4. Examination', icon: Stethoscope, badge: waitingPatientsCount },
    { id: 'prescriptions', label: '5. Prescriptions', icon: Pill, badge: prescriptionsCount },
    { id: 'investigations', label: '6. Lab & Radiology', icon: FileText, badge: activeLabOrdersCount },
    { id: 'reports', label: '7. Diagnostic Reports', icon: Radio, badge: reportsCount },
    { id: 'inpatients', label: '8. Inpatient Rounds', icon: Bed, badge: inpatientsCount },
    { id: 'referrals', label: '9. Referrals', icon: Share2, badge: totalReferralsCount },
    { id: 'documents', label: '10. Certificates', icon: FileCheck, badge: documentsCount },
    { id: 'leaves', label: '11. Leave Management', icon: Clock, badge: pendingLeavesCount },
    { id: 'profile', label: '12. My Profile & Duty', icon: UserCheck },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border text-sm font-medium transition-all ${
            toast.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/50'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Executive Doctor Header with Lounge TV Access */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold shadow-inner shrink-0">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Doctor Clinical Command Center
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Consultation Roster
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              Dr. {userProfile?.first_name} {userProfile?.last_name}{' '}
              <span className="text-sm font-normal text-cyan-300">
                ({staffProfile?.specialization || 'Clinical Specialist'})
              </span>
            </h1>
          </div>
        </div>

        {/* Doctor Header Actions: Direct Lounge TV Button */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={() => setShowLoungeTVModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-200 font-bold text-xs flex items-center gap-2 transition shadow-md shadow-amber-500/10"
            title="Open Live Waiting Lounge TV for your cabin"
          >
            <Tv className="w-4 h-4 text-amber-400" />
            <span>Lounge TV</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-mono font-extrabold">
              {loungeStats.waitingInLounge} in lounge
            </span>
          </button>
          <a
            href={`/lounge-tv?doctor_id=${staffProfile?.id || ''}`}
            target="_blank"
            rel="noreferrer"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            title="Open Waiting Lounge TV in Full-screen Window / Second Monitor"
          >
            <Tv className="w-4 h-4 text-cyan-400" />
          </a>
        </div>
      </div>

      {/* Top Clinical Navigation Bar */}
      <div className="p-2 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as WorkspaceTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {Boolean(tab.badge !== undefined && tab.badge > 0) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview / Doctor Dashboard */}
      {activeTab === 'overview' && (
        <DoctorDashboardView
          data={dashboardData}
          loading={loadingDashboard}
          loungeStats={loungeStats}
          onRefresh={loadDashboard}
          onNavigateTab={handleTabChange}
          onOpenLoungeTV={() => setShowLoungeTVModal(true)}
          onAcknowledgeAlert={async (alertId) => {
            try {
              await doctorWorkspaceService.acknowledgeCriticalAlert(alertId);
              showToast('Critical alert acknowledged');
              loadDashboard();
            } catch (err: any) {
              showToast('Failed to acknowledge alert', 'error');
            }
          }}
        />
      )}

      {/* Tab 2: My Appointments */}
      {activeTab === 'appointments' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <span>2. My Assigned Appointments & OPD Schedule</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold">
                  {todaysAppointmentsCount}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Appointments assigned to you by Hospital Receptionists upon mandatory payment collection.
              </p>
            </div>

            {/* Strict Receptionist Role Restriction Notice */}
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Strict RBAC: Appointment booking & token issuing is restricted to Receptionists.</span>
            </div>
          </div>


          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
            {['all', 'today', 'upcoming', 'previous'].map((scope) => (
              <button
                key={scope}
                onClick={() => loadAppointments(scope)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                {scope}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <input
                type="text"
                placeholder="Search patient or MRN..."
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadAppointments('all', '', (e.target as HTMLInputElement).value);
                }}
              />
              <button
                onClick={() => loadAppointments()}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>


          {/* Appointments Table */}
          {loadingAppointments ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading appointments...</div>
          ) : appointments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">No appointments match your filter criteria.</div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Token</th>
                    <th className="py-3 px-3">Patient Name</th>
                    <th className="py-3 px-3">MRN</th>
                    <th className="py-3 px-3">Date & Slot</th>
                    <th className="py-3 px-3">Reason / Complaint</th>
                    <th className="py-3 px-3">Fee Status</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {appointments.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-mono font-bold text-cyan-400">
                        #{String(app.token_number || '-').replace(/^(token\s*#*|#)+/i, '').trim()}
                      </td>
                      <td className="py-3 px-3 font-medium text-white">{app.patient_name}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">{app.patient_mrn}</td>
                      <td className="py-3 px-3 font-mono">
                        <div>{app.appointment_date}</div>
                        <div className="text-[10px] text-slate-500">{app.time_slot}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-400 max-w-[180px] truncate">
                        {app.chief_complaint || app.reason_for_visit || 'General Consultation'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          PAID ₹{app.paid_amount || app.doctor_fee || '500'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            app.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : app.status === 'IN_CONSULTATION'
                              ? 'bg-blue-500/10 text-blue-400'
                              : app.status === 'CHECKED_IN'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleTabChange('consultation', { appointment_id: app.id })}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-xs font-semibold transition"
                        >
                          {app.status === 'COMPLETED' ? 'View Record' : 'Examine Patient'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: My Patients */}
      {activeTab === 'patients' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>3. My Patient Roster & Medical Profiles</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold">
                  {patientsCount}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Authorized patients treated by or assigned to your medical practice.
              </p>
            </div>
            <input
              type="text"
              placeholder="Filter by name, MRN, phone..."
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-full sm:w-64"
              onChange={(e) => loadPatients(e.target.value)}
            />
          </div>

          {loadingPatients ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading patients...</div>
          ) : patients.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">No authorized patients found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {patients.map((p) => (
                <div
                  key={p.patient_id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-cyan-500/30 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-cyan-400 font-bold">{p.mrn}</span>
                      <span className="text-[10px] font-semibold text-slate-400">{p.blood_group || 'Blood N/A'}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1">{p.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {p.age} yrs • {p.gender} • {p.contact_number}
                    </p>

                    <div className="mt-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] space-y-1">
                      <div className="text-slate-300">
                        <span className="font-semibold text-slate-400">Last Diagnosis:</span> {p.current_condition}
                      </div>
                      <div className="text-slate-400">
                        <span className="font-semibold text-slate-500">Last Visit:</span> {p.last_visit}
                      </div>
                    </div>

                    {/* Allergies & Chronic Conditions */}
                    {p.allergies && p.allergies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.allergies.map((alg: any, idx: number) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20"
                          >
                            Allergy: {typeof alg === 'string' ? alg : alg.allergen}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                    <button
                      onClick={async () => {
                        setLoadingEMR(true);
                        try {
                          const emr = await doctorWorkspaceService.getPatientEMR(p.patient_id);
                          setActivePatientEMR(emr);
                        } catch (err: any) {
                          showToast('Failed to load patient EMR', 'error');
                        } finally {
                          setLoadingEMR(false);
                        }
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                    >
                      <span>Chronological EMR Timeline</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Patient EMR Modal */}
      {activePatientEMR && (
        <Modal
          isOpen={true}
          onClose={() => setActivePatientEMR(null)}
          title={`Electronic Medical Record (EMR) - ${activePatientEMR.patient.name} [${activePatientEMR.patient.mrn}]`}
          size="xl"
        >
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
            {/* Demographics Banner */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Age / Gender:</span>
                <p className="font-medium text-white">{activePatientEMR.patient.age}y / {activePatientEMR.patient.gender}</p>
              </div>
              <div>
                <span className="text-slate-500">Blood Group:</span>
                <p className="font-medium text-cyan-400">{activePatientEMR.patient.blood_group || 'N/A'}</p>
              </div>
              <div>
                <span className="text-slate-500">Contact:</span>
                <p className="font-medium text-white">{activePatientEMR.patient.phone}</p>
              </div>
              <div>
                <span className="text-slate-500">Allergies Recorded:</span>
                <p className="font-medium text-rose-400">{activePatientEMR.patient.allergies?.length || 0} documented</p>
              </div>
            </div>

            {/* Timeline Sections */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chronological Timeline</h4>

              {/* Consultations */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4" /> Consultations & Diagnoses ({activePatientEMR.timeline.consultations.length})
                </span>
                {activePatientEMR.timeline.consultations.map((c: any) => (
                  <div key={c.appointment_id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>{c.date} • {c.doctor_name}</span>
                      <span className="text-emerald-400">{c.diagnosis}</span>
                    </div>
                    <p className="text-slate-400">Chief Complaint: {c.chief_complaint}</p>
                    {c.treatment_plan && <p className="text-slate-400">Plan: {c.treatment_plan}</p>}
                    {c.addendums && c.addendums.length > 0 && (
                      <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                        <span className="font-bold">Audited Addendum:</span> {c.addendums[0].addendum_notes} (by {c.addendums[0].doctor_name})
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Prescriptions */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Pill className="w-4 h-4" /> Prescriptions Issued ({activePatientEMR.timeline.prescriptions.length})
                </span>
                {activePatientEMR.timeline.prescriptions.map((pr: any) => (
                  <div key={pr.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-white font-medium">
                      <span>{pr.prescription_number} ({pr.date})</span>
                      <span className="text-slate-400">{pr.doctor_name}</span>
                    </div>
                    <div className="mt-1 text-slate-300">
                      {pr.items?.map((it: any, i: number) => (
                        <span key={i} className="inline-block mr-2 text-[11px] text-slate-400">
                          • {it.medicine_name} ({it.dosage}, {it.frequency}, {it.duration_days}d)
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Lab Reports */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Laboratory & Diagnostic Reports ({activePatientEMR.timeline.laboratory_reports.length})
                </span>
                {activePatientEMR.timeline.laboratory_reports.map((lr: any) => (
                  <div key={lr.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white">{lr.title}</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">{lr.impressions || 'Normal findings'}</p>
                    </div>
                    <span className="font-mono text-cyan-400 text-[11px]">{lr.report_date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </Modal>
      )}

      {/* Tab 4: Consultation / Patient Examination (Section 5) */}
      {activeTab === 'consultation' && (
        <div className="space-y-6">
          {!selectedAppointmentId ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
              <Stethoscope className="w-12 h-12 mx-auto mb-3 text-cyan-400 opacity-60" />
              <h3 className="text-base font-bold text-white">Select a Patient Appointment to Begin Consultation</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Open any patient from the Appointments schedule or queue to conduct clinical examination, record vitals, and issue prescriptions.
              </p>
              <button
                onClick={() => handleTabChange('appointments')}
                className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-950/40"
              >
                Go to Appointments
              </button>
            </div>
          ) : loadingConsultation ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading clinical examination record...</div>
          ) : !consultationData ? (
            <div className="p-12 text-center text-slate-500 text-xs">Consultation record not found.</div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
              {/* Patient Banner */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{consultationData.patient_name}</h3>
                    <span className="text-xs font-mono text-cyan-400 font-semibold">{consultationData.patient_mrn}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        consultationData.is_signed
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {consultationData.is_signed ? 'COMPLETED & SIGNED' : 'IN CONSULTATION'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Gender: {consultationData.patient_gender} • Blood Group: {consultationData.patient_blood_group || 'N/A'} • Token: #{String(consultationData.token_number || '-').replace(/^(token\s*#*|#)+/i, '').trim()} • Appt #{consultationData.appointment_number}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setRxForm((prev) => ({
                        ...prev,
                        patient_id: consultationData.patient,
                        appointment_id: consultationData.id,
                        diagnosis: consultationData.diagnosis || '',
                      }));
                      setShowNewRxModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Pill className="w-3.5 h-3.5" />
                    <span>Prescribe Medication</span>
                  </button>

                  <button
                    onClick={() => {
                      setInvForm((prev) => ({
                        ...prev,
                        patient_id: consultationData.patient,
                      }));
                      setShowOrderInvestigationModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Order Investigations</span>
                  </button>
                </div>
              </div>

              {/* Consultation Sections A through G */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Section B: Chief Complaints */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    <span>B. Chief Complaints & Duration</span>
                  </h4>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Main Reason / Symptoms</label>
                    <textarea
                      disabled={consultationData.is_signed}
                      rows={2}
                      value={consultationData.chief_complaint || ''}
                      onChange={(e) => setConsultationData({ ...consultationData, chief_complaint: e.target.value })}
                      placeholder="e.g. High fever, headache, body aches"
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Duration of Symptoms</label>
                    <input
                      disabled={consultationData.is_signed}
                      type="text"
                      value={consultationData.symptom_duration || ''}
                      onChange={(e) => setConsultationData({ ...consultationData, symptom_duration: e.target.value })}
                      placeholder="e.g. 3 days"
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-70"
                    />
                  </div>
                </div>

                {/* Section C: Vital Signs (BP, Pulse, Temp, Resp, SpO2, H, W, BMI) */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    <span>C. Vital Signs (Auto BMI Computation)</span>
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400">BP (mmHg)</label>
                      <input
                        disabled={consultationData.is_signed}
                        type="text"
                        placeholder="120/80"
                        value={consultationData.vitals?.bp || ''}
                        onChange={(e) =>
                          setConsultationData({
                            ...consultationData,
                            vitals: { ...(consultationData.vitals || {}), bp: e.target.value },
                          })
                        }
                        className="w-full mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Pulse (bpm)</label>
                      <input
                        disabled={consultationData.is_signed}
                        type="text"
                        placeholder="72"
                        value={consultationData.vitals?.heart_rate || consultationData.vitals?.pulse || ''}
                        onChange={(e) =>
                          setConsultationData({
                            ...consultationData,
                            vitals: { ...(consultationData.vitals || {}), heart_rate: e.target.value },
                          })
                        }
                        className="w-full mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Temp (°F)</label>
                      <input
                        disabled={consultationData.is_signed}
                        type="text"
                        placeholder="98.6"
                        value={consultationData.vitals?.temp || ''}
                        onChange={(e) =>
                          setConsultationData({
                            ...consultationData,
                            vitals: { ...(consultationData.vitals || {}), temp: e.target.value },
                          })
                        }
                        className="w-full mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">SpO2 (%)</label>
                      <input
                        disabled={consultationData.is_signed}
                        type="text"
                        placeholder="99"
                        value={consultationData.vitals?.spO2 || consultationData.vitals?.spo2 || ''}
                        onChange={(e) =>
                          setConsultationData({
                            ...consultationData,
                            vitals: { ...(consultationData.vitals || {}), spO2: e.target.value },
                          })
                        }
                        className="w-full mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Height (cm)</label>
                      <input
                        disabled={consultationData.is_signed}
                        type="number"
                        placeholder="170"
                        value={consultationData.vitals?.height || ''}
                        onChange={(e) => {
                          const h = parseFloat(e.target.value) || 0;
                          const w = parseFloat(consultationData.vitals?.weight) || 0;
                          const bmi = h > 0 && w > 0 ? (w / ((h / 100) * (h / 100))).toFixed(1) : '';
                          setConsultationData({
                            ...consultationData,
                            vitals: { ...(consultationData.vitals || {}), height: e.target.value, bmi },
                          });
                        }}
                        className="w-full mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Weight (kg)</label>
                      <input
                        disabled={consultationData.is_signed}
                        type="number"
                        placeholder="70"
                        value={consultationData.vitals?.weight || ''}
                        onChange={(e) => {
                          const w = parseFloat(e.target.value) || 0;
                          const h = parseFloat(consultationData.vitals?.height) || 0;
                          const bmi = h > 0 && w > 0 ? (w / ((h / 100) * (h / 100))).toFixed(1) : '';
                          setConsultationData({
                            ...consultationData,
                            vitals: { ...(consultationData.vitals || {}), weight: e.target.value, bmi },
                          });
                        }}
                        className="w-full mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400">Calculated BMI</label>
                      <div className="mt-1 p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono font-bold text-cyan-400">
                        {consultationData.vitals?.bmi ? `${consultationData.vitals.bmi} kg/m²` : 'Enter Height & Weight'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section D: Clinical Examination */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>D. Clinical Examination</span>
                  </h4>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">General Examination</label>
                    <input
                      disabled={consultationData.is_signed}
                      type="text"
                      placeholder="Conscious, oriented, no pallor/icterus"
                      value={consultationData.general_examination || ''}
                      onChange={(e) => setConsultationData({ ...consultationData, general_examination: e.target.value })}
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Systemic Examination / Findings</label>
                    <textarea
                      disabled={consultationData.is_signed}
                      rows={2}
                      placeholder="CVS: S1 S2 heard. RS: Clear. P/A: Soft, non-tender."
                      value={consultationData.systemic_examination || consultationData.examination_findings || ''}
                      onChange={(e) =>
                        setConsultationData({
                          ...consultationData,
                          systemic_examination: e.target.value,
                          examination_findings: e.target.value,
                        })
                      }
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-70"
                    />
                  </div>
                </div>

                {/* Section E: Diagnosis */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>E. Diagnosis & ICD-10 Classification</span>
                  </h4>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Primary Diagnosis *</label>
                    <input
                      disabled={consultationData.is_signed}
                      type="text"
                      placeholder="e.g. Acute Viral Bronchitis"
                      value={consultationData.diagnosis || ''}
                      onChange={(e) => setConsultationData({ ...consultationData, diagnosis: e.target.value })}
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-70 font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Secondary Diagnosis</label>
                      <input
                        disabled={consultationData.is_signed}
                        type="text"
                        placeholder="e.g. Mild dehydration"
                        value={consultationData.secondary_diagnosis || ''}
                        onChange={(e) => setConsultationData({ ...consultationData, secondary_diagnosis: e.target.value })}
                        className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">ICD-10 Code</label>
                      <input
                        disabled={consultationData.is_signed}
                        type="text"
                        placeholder="e.g. J20.9"
                        value={consultationData.icd10_code || ''}
                        onChange={(e) => setConsultationData({ ...consultationData, icd10_code: e.target.value })}
                        className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Section F: Treatment Plan */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>F. Recommended Treatment Plan</span>
                  </h4>
                  <textarea
                    disabled={consultationData.is_signed}
                    rows={3}
                    placeholder="e.g. Hydration therapy, rest, steam inhalation. Prescribed antipyretics and cough syrup."
                    value={consultationData.treatment_plan || ''}
                    onChange={(e) => setConsultationData({ ...consultationData, treatment_plan: e.target.value })}
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-70"
                  />
                </div>

                {/* Section G: Clinical Notes & Follow-Up */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>G. Clinical Observations & Follow-Up</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Follow-up Date</label>
                      <input
                        disabled={consultationData.is_signed}
                        type="date"
                        value={consultationData.follow_up_date || ''}
                        onChange={(e) => setConsultationData({ ...consultationData, follow_up_date: e.target.value })}
                        className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Follow-up Instructions</label>
                      <input
                        disabled={consultationData.is_signed}
                        type="text"
                        placeholder="e.g. SOS if fever persists"
                        value={consultationData.follow_up_instructions || ''}
                        onChange={(e) => setConsultationData({ ...consultationData, follow_up_instructions: e.target.value })}
                        className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Consultation Action Bar */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  Doctor ID:{' '}
                  <span className="font-semibold text-white">
                    {staffProfile?.user_profile?.full_name || userProfile?.full_name}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {!consultationData.is_signed ? (
                    <>
                      <button
                        disabled={savingConsultation}
                        onClick={() => handleSaveConsultation('SAVE_DRAFT')}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                      >
                        Save Draft
                      </button>
                      <button
                        disabled={savingConsultation}
                        onClick={() => handleSaveConsultation('COMPLETE_AND_SIGN')}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/40 transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Complete & Sign Consultation</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Consultation Finalized & Digitally Signed
                      </span>
                      <button
                        onClick={() => setShowAddendumModal(true)}
                        className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-semibold border border-amber-500/30 transition flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Audited Addendum</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Addendum Modal */}
              {showAddendumModal && (
                <Modal
                  isOpen={true}
                  onClose={() => setShowAddendumModal(false)}
                  title={`Record Clinical Addendum / Amendment - ${consultationData.patient_name}`}
                >
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">
                      Completed consultations are protected legal medical records. Any corrections or post-investigation updates must be recorded via an audited addendum.
                    </p>
                    <div>
                      <label className="text-xs font-semibold text-slate-300">Reason for Amendment *</label>
                      <input
                        type="text"
                        placeholder="e.g. Laboratory report review follow-up"
                        value={addendumReason}
                        onChange={(e) => setAddendumReason(e.target.value)}
                        className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300">Addendum Notes / Corrected Instructions *</label>
                      <textarea
                        rows={4}
                        placeholder="Document additional clinical findings or medication changes..."
                        value={addendumNotes}
                        onChange={(e) => setAddendumNotes(e.target.value)}
                        className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setShowAddendumModal(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddendumSubmit}
                        className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                      >
                        Save Addendum to Audit Trail
                      </button>
                    </div>
                  </div>
                </Modal>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Prescription Management & Voice Entry (Section 6) */}
      {activeTab === 'prescriptions' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Pill className="w-5 h-5 text-emerald-400" />
                <span>5. Prescription Management & Voice Entry</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                  {prescriptionsCount}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Issue multi-medicine digital prescriptions with allergy checks, dosage schedules, and voice recognition.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowVoiceRxModal(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold border border-purple-500/30 flex items-center gap-1.5 transition"
              >
                <Mic className="w-4 h-4 text-purple-400" />
                <span>Voice Prescription Entry</span>
              </button>
              <button
                onClick={() => setShowNewRxModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition"
              >
                <Plus className="w-4 h-4" />
                <span>New Prescription</span>
              </button>
            </div>
          </div>


          {loadingPrescriptions ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading prescriptions...</div>
          ) : prescriptions.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">No prescriptions issued yet.</div>
          ) : (
            <div className="space-y-3">
              {prescriptions.map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-cyan-400 font-bold">{p.prescription_number}</span>
                      <span className="ml-2 font-bold text-white">{p.patient_name}</span>
                      <span className="ml-1 text-slate-500">({p.patient_mrn})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        DIGITALLY SIGNED
                      </span>
                      <button
                        onClick={() => {
                          const w = window.open('', '_blank');
                          if (w) {
                            w.document.write(`
                              <html><head><title>Prescription ${p.prescription_number}</title>
                              <style>body{font-family:sans-serif;padding:30px;color:#1e293b}h2{color:#0f766e}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}</style>
                              </head><body>
                              <h2>HOSPITAL MEDICAL PRESCRIPTION</h2>
                              <p><strong>Rx #:</strong> ${p.prescription_number} | <strong>Date:</strong> ${new Date(p.created_at).toLocaleDateString()}</p>
                              <p><strong>Patient:</strong> ${p.patient_name} (${p.patient_mrn})</p>
                              <p><strong>Diagnosis:</strong> ${p.diagnosis}</p>
                              <hr/>
                              <h3>Medications:</h3>
                              <table>
                                <tr><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Timing & Food</th></tr>
                                ${p.items.map((i: any) => `<tr><td>${i.medicine_name}</td><td>${i.dosage}</td><td>${i.frequency}</td><td>${i.duration_days} days</td><td>${i.timing} (${i.food_instruction})</td></tr>`).join('')}
                              </table>
                              <p style="margin-top:40px"><strong>Doctor Signature:</strong> Digitally Signed by Dr. ${staffProfile?.user_profile?.full_name || 'Medical Officer'}</p>
                              <script>window.print();</script>
                              </body></html>
                            `);
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-300"><span className="text-slate-500">Diagnosis:</span> {p.diagnosis}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                    {p.items?.map((it: any) => (
                      <div key={it.id} className="p-2 rounded bg-slate-900 border border-slate-800/80 text-[11px]">
                        <div className="font-semibold text-white">{it.medicine_name}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          {it.dosage} • {it.frequency} • {it.duration_days}d ({it.food_instruction})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New Prescription Modal */}
          {showNewRxModal && (
            <Modal
              isOpen={true}
              onClose={() => setShowNewRxModal(false)}
              title="Issue Multi-Medicine Digital Prescription"
              size="lg"
            >
              <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Select Patient *</label>
                    <select
                      value={rxForm.patient_id}
                      onChange={(e) => setRxForm({ ...rxForm, patient_id: e.target.value })}
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    >
                      <option value="">-- Choose Patient --</option>
                      {patients.map((p) => (
                        <option key={p.patient_id} value={p.patient_id}>
                          {p.name} ({p.mrn})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Primary Diagnosis *</label>
                    <input
                      type="text"
                      placeholder="e.g. Acute Pharyngitis"
                      value={rxForm.diagnosis}
                      onChange={(e) => setRxForm({ ...rxForm, diagnosis: e.target.value })}
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Medication Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Medications</span>
                    <button
                      type="button"
                      onClick={() =>
                        setRxForm({
                          ...rxForm,
                          items: [
                            ...rxForm.items,
                            {
                              medicine_id: '',
                              dosage: '1 Tablet',
                              frequency: '1-0-1',
                              duration_days: 5,
                              total_quantity: 10,
                              timing: 'MORNING_NIGHT',
                              food_instruction: 'AFTER_FOOD',
                              route: 'ORAL',
                              instructions: '',
                            },
                          ],
                        })
                      }
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Another Medicine
                    </button>
                  </div>

                  {rxForm.items.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-300">Medicine #{idx + 1}</span>
                        {rxForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = rxForm.items.filter((_, i) => i !== idx);
                              setRxForm({ ...rxForm, items: updated });
                            }}
                            className="text-rose-400 hover:text-rose-300 text-[11px]"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-400">Medicine Form *</label>
                          <select
                            value={item.medicine_id}
                            onChange={(e) => {
                              const updated = [...rxForm.items];
                              updated[idx].medicine_id = e.target.value;
                              setRxForm({ ...rxForm, items: updated });
                            }}
                            className="w-full mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                          >
                            <option value="">-- Select from Formulary --</option>
                            {formularyMedicines.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.brand_name || m.name} ({m.generic_name}) - Stock: {m.stock_quantity ?? 'Avail'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Dosage</label>
                          <input
                            type="text"
                            value={item.dosage}
                            onChange={(e) => {
                              const updated = [...rxForm.items];
                              updated[idx].dosage = e.target.value;
                              setRxForm({ ...rxForm, items: updated });
                            }}
                            className="w-full mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Frequency</label>
                          <select
                            value={item.frequency}
                            onChange={(e) => {
                              const updated = [...rxForm.items];
                              updated[idx].frequency = e.target.value;
                              setRxForm({ ...rxForm, items: updated });
                            }}
                            className="w-full mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                          >
                            <option value="1-0-0">Once Daily (1-0-0)</option>
                            <option value="1-0-1">Twice Daily (1-0-1)</option>
                            <option value="1-1-1">Thrice Daily (1-1-1)</option>
                            <option value="0-0-1">Night only (0-0-1)</option>
                            <option value="SOS">As Needed (SOS)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Duration (Days)</label>
                          <input
                            type="number"
                            value={item.duration_days}
                            onChange={(e) => {
                              const updated = [...rxForm.items];
                              const d = parseInt(e.target.value) || 1;
                              updated[idx].duration_days = d;
                              updated[idx].total_quantity = d * 2;
                              setRxForm({ ...rxForm, items: updated });
                            }}
                            className="w-full mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Food Instruction</label>
                          <select
                            value={item.food_instruction}
                            onChange={(e) => {
                              const updated = [...rxForm.items];
                              updated[idx].food_instruction = e.target.value;
                              setRxForm({ ...rxForm, items: updated });
                            }}
                            className="w-full mt-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                          >
                            <option value="AFTER_FOOD">After Food</option>
                            <option value="BEFORE_FOOD">Before Food</option>
                            <option value="WITH_FOOD">With Food</option>
                            <option value="EMPTY_STOMACH">Empty Stomach</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowNewRxModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreatePrescription}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40"
                  >
                    Sign & Transmit to Pharmacy
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* Voice Prescription Modal */}
          {showVoiceRxModal && (
            <VoicePrescriptionModal
              isOpen={true}
              onClose={() => setShowVoiceRxModal(false)}
              formularyMedicines={formularyMedicines}
              onApplyPrescriptions={(extractedItems) => {
                const mappedItems = extractedItems.map((item) => ({
                  medicine_id: item.medicine_id || '',
                  dosage: item.dosage_form ? `${item.dose_amount || '1'} ${item.dosage_form}` : '1 Tablet',
                  frequency: item.frequency || '1-0-1',
                  duration_days: item.duration_days || 5,
                  total_quantity: item.total_quantity || 10,
                  timing: 'MORNING_NIGHT',
                  food_instruction: item.food_instruction || 'AFTER_FOOD',
                  route: item.route || 'ORAL',
                  instructions: item.instructions || '',
                }));
                setRxForm((prev) => ({
                  ...prev,
                  items: mappedItems.length > 0 ? mappedItems : prev.items,
                }));
                setShowVoiceRxModal(false);
                setShowNewRxModal(true);
                showToast('Voice prescription extracted for doctor review');
              }}
            />
          )}
        </div>
      )}

      {/* Tab 6: Laboratory & Investigation Requests (Section 7) */}
      {activeTab === 'investigations' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <span>6. Laboratory & Radiology Investigation Orders</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold">
                  {activeLabOrdersCount}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Order blood tests, biochemistry, hematology, X-rays, CT scans, and MRI scans.
              </p>
            </div>
            <button
              onClick={() => setShowOrderInvestigationModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-950/40"
            >
              <Plus className="w-4 h-4" />
              <span>Order New Test</span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
            <span className="font-semibold text-slate-300">Available Investigation Disciplines:</span>
            <div className="flex flex-wrap gap-2 pt-1">
              {['Hematology (CBC, ESR)', 'Biochemistry (LFT, KFT, Lipid)', 'Microbiology & Serology', 'X-Ray Radiography', 'CT Scan', 'MRI Imaging', 'Ultrasound'].map((t, idx) => (
                <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px]">
                  {t}
                </span>
              ))}
            </div>
          </div>


          {/* Active Orders Tracker */}
          <div className="pt-2 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Your Submitted Investigation Requisitions</h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                  {investigationCatalogue?.recent_orders?.length || 0} Total
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search patient, order #..."
                    value={invSearchQuery}
                    onChange={(e) => setInvSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setInvFilterType('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      invFilterType === 'ALL' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setInvFilterType('LAB')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      invFilterType === 'LAB' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Lab
                  </button>
                  <button
                    onClick={() => setInvFilterType('RADIOLOGY')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      invFilterType === 'RADIOLOGY' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Radiology
                  </button>
                </div>

                {/* Refresh */}
                <button
                  onClick={loadInvestigationsAndReports}
                  disabled={loadingReports}
                  className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
                  title="Refresh orders"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingReports ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Orders List */}
            {loadingReports && !investigationCatalogue ? (
              <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Loading your submitted requisitions...</span>
              </div>
            ) : (() => {
              const orders = (investigationCatalogue?.recent_orders || []).filter((o: any) => {
                if (invFilterType !== 'ALL' && o.type !== invFilterType) return false;
                if (invSearchQuery.trim()) {
                  const q = invSearchQuery.toLowerCase();
                  const matchesNum = (o.order_number || '').toLowerCase().includes(q);
                  const matchesName = (o.patient_name || '').toLowerCase().includes(q);
                  const matchesMrn = (o.patient_mrn || '').toLowerCase().includes(q);
                  const matchesItems = (o.items || []).some((it: string) => it.toLowerCase().includes(q));
                  if (!matchesNum && !matchesName && !matchesMrn && !matchesItems) return false;
                }
                return true;
              });

              if (orders.length === 0) {
                return (
                  <div className="py-12 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 p-6 space-y-2">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-sm font-semibold text-slate-400">No investigation orders match your criteria</p>
                    <p className="text-xs text-slate-500">
                      When you click &ldquo;Order New Test&rdquo; above, your requested tests and live laboratory processing stages will appear here.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {orders.map((ord: any) => {
                    const isLab = ord.type === 'LAB';
                    const stage = ord.stage || 1;

                    return (
                      <div
                        key={ord.id}
                        className={`p-4 rounded-xl border transition-all ${
                          ord.is_critical
                            ? 'bg-rose-950/20 border-rose-500/50 shadow-md shadow-rose-950/20'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Top Row: Type Pill, Order Number, Priority, Status Badge */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800/70">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                isLab
                                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                  : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                              }`}
                            >
                              {isLab ? '🧪 Lab Order' : '☢️ Radiology'}
                            </span>

                            <span className="font-mono text-xs font-bold text-white">{ord.order_number}</span>

                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                ord.priority === 'STAT'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                  : ord.priority === 'URGENT'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {ord.priority}
                            </span>

                            {ord.encounter_type && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-400">
                                {ord.encounter_type}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {ord.created_at}
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 ${
                                ['COMPLETED', 'RELEASED', 'APPROVED'].includes(ord.status) || ord.stage >= 4
                                  ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800'
                                  : ord.status === 'CANCELLED'
                                  ? 'bg-rose-950/70 text-rose-400 border border-rose-800'
                                  : 'bg-amber-950/60 text-amber-300 border border-amber-800'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  ['COMPLETED', 'RELEASED', 'APPROVED'].includes(ord.status) || ord.stage >= 4
                                    ? 'bg-emerald-400'
                                    : ord.status === 'CANCELLED'
                                    ? 'bg-rose-400'
                                    : 'bg-amber-400 animate-pulse'
                                }`}
                              />
                              <span>{ord.stage_label || ord.status}</span>
                            </span>
                          </div>
                        </div>

                        {/* Middle: Patient Info and Tests */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-3">
                          <div>
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-0.5">
                              Patient Information
                            </span>
                            <div className="font-semibold text-white text-xs">{ord.patient_name}</div>
                            <div className="text-[11px] text-slate-400">MRN: {ord.patient_mrn}</div>
                          </div>

                          <div className="md:col-span-2">
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                              Prescribed Tests / Investigation
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {(ord.items || []).map((tName: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 font-medium text-xs"
                                >
                                  {tName}
                                </span>
                              ))}
                            </div>
                            {ord.clinical_indication && (
                              <p className="text-[11px] text-slate-400 mt-1 italic">
                                &ldquo;{ord.clinical_indication}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 4-Step Visual Progress Stepper */}
                        <div className="pt-2 border-t border-slate-900">
                          <span className="text-[10px] font-semibold text-slate-400 block mb-1.5">
                            Live Processing Workflow:
                          </span>
                          <div className="grid grid-cols-4 gap-2">
                            {/* Step 1 */}
                            <div
                              className={`p-2 rounded-lg text-center border text-[11px] font-medium ${
                                stage >= 1
                                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                                  : 'bg-slate-900/40 border-slate-800 text-slate-500'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1 mb-0.5">
                                <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                                <span className="text-[10px] uppercase font-bold">Step 1</span>
                              </div>
                              <span>Requisition Sent</span>
                            </div>

                            {/* Step 2 */}
                            <div
                              className={`p-2 rounded-lg text-center border text-[11px] font-medium ${
                                stage >= 2
                                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                                  : 'bg-slate-900/40 border-slate-800 text-slate-500'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1 mb-0.5">
                                {stage >= 2 ? (
                                  <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                                ) : (
                                  <Clock className="w-3 h-3 text-slate-500" />
                                )}
                                <span className="text-[10px] uppercase font-bold">Step 2</span>
                              </div>
                              <span>{isLab ? 'Sample Collected' : 'Scheduled'}</span>
                            </div>

                            {/* Step 3 */}
                            <div
                              className={`p-2 rounded-lg text-center border text-[11px] font-medium ${
                                stage >= 3
                                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                                  : 'bg-slate-900/40 border-slate-800 text-slate-500'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1 mb-0.5">
                                {stage >= 3 ? (
                                  <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                                ) : (
                                  <Clock className="w-3 h-3 text-slate-500" />
                                )}
                                <span className="text-[10px] uppercase font-bold">Step 3</span>
                              </div>
                              <span>{isLab ? 'Under Processing' : 'Scan In Progress'}</span>
                            </div>

                            {/* Step 4 */}
                            <div
                              className={`p-2 rounded-lg text-center border text-[11px] font-medium ${
                                stage >= 4
                                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                                  : 'bg-slate-900/40 border-slate-800 text-slate-500'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1 mb-0.5">
                                {stage >= 4 ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Clock className="w-3 h-3 text-slate-500" />
                                )}
                                <span className="text-[10px] uppercase font-bold">Step 4</span>
                              </div>
                              <span>{stage >= 4 ? (ord.stage_label || "Report Released") : "Report Released"}</span>
                            </div>
                          </div>

                          {/* Specimen / Lab accession notes if any */}
                          {isLab && ord.samples && ord.samples.length > 0 && (
                            <div className="mt-2 p-2 rounded-lg bg-slate-900/70 text-[11px] flex items-center justify-between text-slate-400">
                              <span>Specimen Accession: {ord.samples[0].specimen_type} ({ord.samples[0].sample_barcode})</span>
                              <span className="text-cyan-400 font-semibold">{ord.samples[0].status}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Test Ordering Modal */}
          {showOrderInvestigationModal && (
            <Modal
              isOpen={true}
              onClose={() => setShowOrderInvestigationModal(false)}
              title="Order Clinical Investigation (Lab / Radiology)"
              size="lg"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Select Patient *</label>
                    <select
                      value={invForm.patient_id}
                      onChange={(e) => setInvForm({ ...invForm, patient_id: e.target.value })}
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    >
                      <option value="">-- Choose Patient --</option>
                      {patients.map((p) => (
                        <option key={p.patient_id} value={p.patient_id}>
                          {p.name} ({p.mrn})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Priority Level *</label>
                    <select
                      value={invForm.priority}
                      onChange={(e) => setInvForm({ ...invForm, priority: e.target.value })}
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    >
                      <option value="ROUTINE">Routine</option>
                      <option value="URGENT">Urgent</option>
                      <option value="STAT">STAT / Emergency</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="inv_type"
                      checked={invForm.type === 'LAB'}
                      onChange={() => setInvForm({ ...invForm, type: 'LAB' })}
                    />
                    <span>Laboratory Test</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="inv_type"
                      checked={invForm.type === 'RADIOLOGY'}
                      onChange={() => setInvForm({ ...invForm, type: 'RADIOLOGY' })}
                    />
                    <span>Radiology / Imaging</span>
                  </label>
                </div>

                {invForm.type === 'LAB' ? (
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Select Lab Test(s) *</label>
                    <div className="mt-1 max-h-48 overflow-y-auto p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1 custom-scrollbar">
                      {investigationCatalogue?.lab_tests?.map((t: any) => (
                        <label key={t.id} className="flex items-center justify-between p-1.5 hover:bg-slate-900 rounded cursor-pointer text-xs">
                          <div className="flex items-center gap-2 text-slate-200">
                            <input
                              type="checkbox"
                              checked={invForm.test_ids.includes(t.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setInvForm({ ...invForm, test_ids: [...invForm.test_ids, t.id] });
                                } else {
                                  setInvForm({ ...invForm, test_ids: invForm.test_ids.filter((id) => id !== t.id) });
                                }
                              }}
                            />
                            <span>{t.test_name}</span>
                          </div>
                          <span className="font-mono text-cyan-400 text-[10px]">₹{t.price}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300">Modality</label>
                      <select
                        value={invForm.modality}
                        onChange={(e) => setInvForm({ ...invForm, modality: e.target.value })}
                        className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                      >
                        <option value="XRAY">X-Ray</option>
                        <option value="CT">CT Scan</option>
                        <option value="MRI">MRI</option>
                        <option value="ULTRASOUND">Ultrasound</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300">Procedure Name</label>
                      <input
                        type="text"
                        value={invForm.procedure_name}
                        onChange={(e) => setInvForm({ ...invForm, procedure_name: e.target.value })}
                        className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-300">Clinical Indication / Reason *</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Rule out pneumonia; persistent cough with fever for 5 days"
                    value={invForm.clinical_reason}
                    onChange={(e) => setInvForm({ ...invForm, clinical_reason: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowOrderInvestigationModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateInvestigation}
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                  >
                    Submit Test Request
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* Tab 7: Medical Reports & Test Results (Section 8) */}
      {activeTab === 'reports' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-400" />
                <span>7. Medical Reports & Test Results</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold">
                  {reportsCount}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Review verified laboratory and radiology findings with abnormal and critical value highlights.
              </p>
            </div>
          </div>

          {/* Quick link to live orders tracker */}
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                Looking for recently submitted tests? Track live specimen collection, laboratory analysis, and imaging stages in the order tracker.
              </span>
            </div>
            <button
              onClick={() => handleTabChange('investigations')}
              className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs whitespace-nowrap self-start sm:self-auto transition"
            >
              View Active Orders ({investigationCatalogue?.recent_orders?.length || 0})
            </button>
          </div>


          {loadingReports ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">No diagnostic reports available yet.</div>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className={`p-4 rounded-xl border text-xs space-y-2 transition ${
                    r.is_critical
                      ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/20'
                      : r.is_abnormal
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{r.title}</span>
                      <span className="font-mono text-cyan-400">{r.report_number}</span>
                      {r.is_critical && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 uppercase">
                          CRITICAL
                        </span>
                      )}
                      {r.is_abnormal && !r.is_critical && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 uppercase">
                          ABNORMAL
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400">{r.report_date}</span>
                      {r.order_id && (
                        <button
                          onClick={() => handleDownloadReport(r.order_id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-medium flex items-center gap-1.5 transition"
                          title="Download Official PDF Report"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-300">
                    <span className="text-slate-500">Patient:</span> {r.patient_name} ({r.patient_mrn}) • Verified by: {r.verified_by}
                  </p>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300 space-y-1">
                    <div className="font-semibold text-slate-400">Impression / Clinical Result:</div>
                    <p>{r.impressions || 'All test parameters within biological reference intervals.'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 8: Inpatient / Ward Rounds (Section 10) */}
      {activeTab === 'inpatients' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bed className="w-5 h-5 text-purple-400" />
                <span>8. Inpatient & Ward Rounds Management</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold">
                  {inpatientsCount}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitor admitted patients, document daily ward rounds, progress notes, and discharge recommendations.
              </p>
            </div>
          </div>


          {loadingInpatients ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading admitted patients...</div>
          ) : inpatients.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">No active inpatient admissions assigned to your care.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inpatients.map((adm) => (
                <div key={adm.admission_id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white text-sm">{adm.patient_name}</span>
                      <span className="ml-1 text-slate-500 font-mono">({adm.patient_mrn})</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {adm.ward_name} • Bed #{adm.bed_number}
                    </span>
                  </div>

                  <p className="text-slate-300">
                    <span className="text-slate-500">Admitting Diagnosis:</span> {adm.admitting_diagnosis}
                  </p>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                    <span className="text-slate-400 font-semibold">Latest Round Assessment:</span>
                    <p className="text-slate-300">{adm.latest_progress_note}</p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => {
                        setSelectedAdmission(adm);
                        setShowWardRoundModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold"
                    >
                      Document Ward Round
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ward Round Progress Note Modal */}
          {showWardRoundModal && selectedAdmission && (
            <Modal
              isOpen={true}
              onClose={() => setShowWardRoundModal(false)}
              title={`Ward Round Note - ${selectedAdmission.patient_name} [Bed #${selectedAdmission.bed_number}]`}
            >
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Subjective (Patient Complaints)</label>
                  <input
                    type="text"
                    placeholder="Patient reports improvement in breathing"
                    value={wardRoundForm.subjective}
                    onChange={(e) => setWardRoundForm({ ...wardRoundForm, subjective: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Objective (Examination Findings)</label>
                  <input
                    type="text"
                    placeholder="Chest clear, afebrile, vitals stable"
                    value={wardRoundForm.objective}
                    onChange={(e) => setWardRoundForm({ ...wardRoundForm, objective: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Assessment (Clinical Status)</label>
                  <input
                    type="text"
                    placeholder="Recovering well from respiratory infection"
                    value={wardRoundForm.assessment}
                    onChange={(e) => setWardRoundForm({ ...wardRoundForm, assessment: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Treatment Plan / Instructions</label>
                  <textarea
                    rows={2}
                    placeholder="Continue current antibiotics. Plan discharge tomorrow if stable."
                    value={wardRoundForm.plan}
                    onChange={(e) => setWardRoundForm({ ...wardRoundForm, plan: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowWardRoundModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await doctorWorkspaceService.logInpatientNote(selectedAdmission.admission_id, wardRoundForm);
                        showToast('Ward round progress note recorded');
                        setShowWardRoundModal(false);
                        loadInpatients();
                      } catch (err: any) {
                        showToast('Failed to record progress note', 'error');
                      }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                  >
                    Save Ward Note
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* Tab 9: Specialist Referrals (Section 11) */}
      {activeTab === 'referrals' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-cyan-400" />
                <span>9. Specialist Referrals</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold">
                  {totalReferralsCount}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Refer patients to cardiology, neurology, surgery, and receive incoming specialist consultation requests.
              </p>
            </div>
            <button
              onClick={() => setShowReferralModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Initiate Referral</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Outgoing Referrals */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Outgoing Referrals ({referrals.outgoing?.length || 0})</h3>
              {referrals.outgoing?.map((ref) => (
                <div key={ref.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>{ref.patient_name}</span>
                    <span className="text-cyan-400 text-[10px] font-mono">{ref.status}</span>
                  </div>
                  <p className="text-slate-400">Referred to: {ref.receiving_department_name}</p>
                  <p className="text-slate-300">Reason: {ref.referral_reason}</p>
                </div>
              ))}
            </div>

            {/* Incoming Referrals */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Incoming Referrals ({referrals.incoming?.length || 0})</h3>
              {referrals.incoming?.map((ref) => (
                <div key={ref.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>{ref.patient_name}</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400">
                      {ref.status}
                    </span>
                  </div>
                  <p className="text-slate-400">From: {ref.referring_doctor_name}</p>
                  <p className="text-slate-300">{ref.referral_reason}</p>
                  {ref.status === 'PENDING' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={async () => {
                          await doctorWorkspaceService.respondReferral(ref.id, { action: 'ACCEPTED' });
                          showToast('Referral accepted');
                          loadReferrals();
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-600/20 text-emerald-400 text-[11px] font-semibold"
                      >
                        Accept
                      </button>
                      <button
                        onClick={async () => {
                          await doctorWorkspaceService.respondReferral(ref.id, { action: 'COMPLETED' });
                          showToast('Referral marked completed');
                          loadReferrals();
                        }}
                        className="px-2.5 py-1 rounded bg-cyan-600/20 text-cyan-400 text-[11px] font-semibold"
                      >
                        Complete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>


          {/* Referral Modal */}
          {showReferralModal && (
            <Modal
              isOpen={true}
              onClose={() => setShowReferralModal(false)}
              title="Refer Patient to Specialist / Department"
            >
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Select Patient *</label>
                  <select
                    value={refForm.patient_id}
                    onChange={(e) => setRefForm({ ...refForm, patient_id: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  >
                    <option value="">-- Choose Patient --</option>
                    {patients.map((p) => (
                      <option key={p.patient_id} value={p.patient_id}>
                        {p.name} ({p.mrn})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Referral Reason *</label>
                  <textarea
                    rows={2}
                    placeholder="Clinical reason for specialist consultation"
                    value={refForm.referral_reason}
                    onChange={(e) => setRefForm({ ...refForm, referral_reason: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowReferralModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await doctorWorkspaceService.createReferral({
                          ...refForm,
                          receiving_department_id: staffProfile?.department_id || currentBranch?.id,
                        });
                        showToast('Specialist referral submitted');
                        setShowReferralModal(false);
                        loadReferrals();
                      } catch (err: any) {
                        showToast(err.response?.data?.detail || 'Failed to submit referral', 'error');
                      }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                  >
                    Submit Referral
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* Tab 10: Medical Documents & Certificates (Section 12) */}
      {activeTab === 'documents' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-cyan-400" />
                <span>10. Medical Certificates & Official Clinical Documents</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold">
                  {documentsCount}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Issue digitally signed Medical Certificates, Sick Leave Certificates, Fitness Certificates, and Discharge Summaries.
              </p>
            </div>
            <button
              onClick={() => setShowDocumentModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Issue New Document</span>
            </button>
          </div>

          {loadingDocuments ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">No certificates or medical documents issued yet.</div>
          ) : (
            <div className="space-y-3">
              {documents.map((d) => (
                <div key={d.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white text-sm">{d.title}</span>
                      <span className="ml-2 font-mono text-cyan-400 text-xs">[{d.document_number}]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                        DIGITALLY SIGNED
                      </span>
                      <button
                        onClick={() => {
                          const w = window.open('', '_blank');
                          if (w) {
                            w.document.write(`
                              <html><head><title>${d.title}</title>
                              <style>body{font-family:sans-serif;padding:40px;color:#0f172a}h1{color:#0891b2;border-bottom:2px solid #0891b2;padding-bottom:10px}.meta{margin:20px 0;line-height:1.6}.sig{margin-top:60px;border-top:1px dashed #94a3b8;padding-top:10px}</style>
                              </head><body>
                              <h1>HOSPITAL MEDICAL CERTIFICATE</h1>
                              <div class="meta">
                                <p><strong>Document ID:</strong> ${d.document_number} | <strong>Date of Issue:</strong> ${d.issue_date}</p>
                                <p><strong>Patient Name:</strong> ${d.patient_name} (${d.patient_mrn}) | <strong>Age/Gender:</strong> ${d.patient_age}y / ${d.patient_gender}</p>
                                <p><strong>Diagnosis:</strong> ${d.diagnosis}</p>
                                <p><strong>Clinical Summary:</strong> ${d.clinical_summary}</p>
                                <p><strong>Recommendations:</strong> ${d.recommendations || 'Bed rest recommended'}</p>
                                ${d.leave_from_date ? `<p><strong>Leave Duration:</strong> ${d.leave_from_date} to ${d.leave_to_date}</p>` : ''}
                              </div>
                              <div class="sig">
                                <p><strong>Authorized Medical Practitioner:</strong> Dr. ${d.doctor_name}</p>
                                <p><strong>Registration Number:</strong> ${d.doctor_registration_number || 'REG-MED-2026'}</p>
                                <p><strong>Department:</strong> ${d.doctor_specialization || 'General Medicine'}</p>
                              </div>
                              <script>window.print();</script>
                              </body></html>
                            `);
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Print Document</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-300">
                    <span className="text-slate-500">Patient:</span> {d.patient_name} • <span className="text-slate-500">Diagnosis:</span> {d.diagnosis}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* New Document Modal */}
          {showDocumentModal && (
            <Modal
              isOpen={true}
              onClose={() => setShowDocumentModal(false)}
              title="Issue Official Medical Certificate"
              size="lg"
            >
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Select Patient *</label>
                    <select
                      value={docForm.patient_id}
                      onChange={(e) => setDocForm({ ...docForm, patient_id: e.target.value })}
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    >
                      <option value="">-- Choose Patient --</option>
                      {patients.map((p) => (
                        <option key={p.patient_id} value={p.patient_id}>
                          {p.name} ({p.mrn})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Document Type *</label>
                    <select
                      value={docForm.document_type}
                      onChange={(e) => setDocForm({ ...docForm, document_type: e.target.value })}
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    >
                      <option value="MEDICAL_CERTIFICATE">Medical Certificate</option>
                      <option value="SICK_LEAVE_CERTIFICATE">Sick Leave Certificate</option>
                      <option value="FITNESS_CERTIFICATE">Fitness Certificate</option>
                      <option value="DISCHARGE_SUMMARY">Discharge Summary</option>
                      <option value="TREATMENT_SUMMARY">Treatment Summary</option>
                      <option value="REFERRAL_SUMMARY">Referral Summary</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Diagnosis *</label>
                  <input
                    type="text"
                    placeholder="e.g. Typhoid Fever"
                    value={docForm.diagnosis}
                    onChange={(e) => setDocForm({ ...docForm, diagnosis: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Clinical Summary *</label>
                  <textarea
                    rows={2}
                    placeholder="Clinical evaluation and treatment received"
                    value={docForm.clinical_summary}
                    onChange={(e) => setDocForm({ ...docForm, clinical_summary: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Leave From Date</label>
                    <input
                      type="date"
                      value={docForm.leave_from_date}
                      onChange={(e) => setDocForm({ ...docForm, leave_from_date: e.target.value })}
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Leave To Date</label>
                    <input
                      type="date"
                      value={docForm.leave_to_date}
                      onChange={(e) => setDocForm({ ...docForm, leave_to_date: e.target.value })}
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowDocumentModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await doctorWorkspaceService.createDocument(docForm);
                        showToast(res.message || 'Medical certificate issued successfully');
                        setShowDocumentModal(false);
                        loadDocuments();
                      } catch (err: any) {
                        showToast(err.response?.data?.detail || 'Failed to issue document', 'error');
                      }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                  >
                    Sign & Issue Certificate
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* Tab 11: Leave Management (Section 14) */}
      {activeTab === 'leaves' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                <span>11. Doctor Leave Management & Availability Coordination</span>
                {pendingLeavesCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                    {pendingLeavesCount} pending
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                View real HR leave balances, apply for leave, and coordinate patient appointments.
              </p>
            </div>
            <button
              onClick={() => setShowApplyLeaveModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-950/40"
            >
              <Plus className="w-4 h-4" />
              <span>Apply for Leave</span>
            </button>
          </div>

          {/* Real HR Leave Balances */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Official Annual Leave Quotas (Database Calculated)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {leavesData.balances.map((b, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">{b.leave_type_display || b.leave_type}</span>
                    <span className="text-[10px] text-cyan-400 font-mono">FY 2026-27</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold font-mono text-white">{b.remaining_days}</span>
                    <span className="text-xs text-slate-400">days available</span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                    <span>Used: {b.used_days} days</span>
                    <span>Allocated: {b.allocated_days} days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>


          {/* Leave Application History */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Leave Application History
            </h3>
            {leavesData.history.length === 0 ? (
              <p className="text-xs text-slate-500">No leave requests submitted.</p>
            ) : (
              <div className="space-y-2">
                {leavesData.history.map((h) => (
                  <div key={h.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{h.leave_type}</span>
                        <span className="text-slate-400">
                          ({h.start_date} to {h.end_date} • {h.total_days} days)
                        </span>
                      </div>
                      <p className="text-slate-400 mt-0.5">Reason: {h.reason}</p>
                      {h.approver_comments && (
                        <p className="text-cyan-400 text-[11px]">Approver Remarks: {h.approver_comments}</p>
                      )}
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        h.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : h.status === 'PENDING'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {h.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Apply Leave Modal */}
          {showApplyLeaveModal && (
            <Modal
              isOpen={true}
              onClose={() => setShowApplyLeaveModal(false)}
              title="Submit Doctor Leave Application"
            >
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                  Separation of Duties Notice: Doctor leave requires HR Manager or Medical Director approval.
                  Upon approval, your OPD slot availability will be automatically updated and overlapping appointments flagged for Receptionist rescheduling.
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Leave Type *</label>
                  <select
                    value={leaveForm.leave_type}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  >
                    <option value="CASUAL">Casual Leave</option>
                    <option value="SICK">Medical / Sick Leave</option>
                    <option value="PRIVILEGE">Earned / Privilege Leave</option>
                    <option value="MATERNITY">Maternity / Paternity Leave</option>
                    <option value="UNPAID">Leave Without Pay (LWP)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Start Date *</label>
                    <input
                      type="date"
                      value={leaveForm.start_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">End Date *</label>
                    <input
                      type="date"
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                      className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Reason for Leave *</label>
                  <textarea
                    rows={3}
                    placeholder="State reason for absence"
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    className="w-full mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowApplyLeaveModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyLeave}
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                  >
                    Submit for HR Approval
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* Tab 12: Doctor Profile & Duty Roster */}
      {activeTab === 'profile' && profileData && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-2xl font-bold">
              Dr
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">12. Dr. {profileData.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {profileData.qualification} • {profileData.specialization} • Reg Lic: {profileData.medical_license_number || profileData.employee_id}
              </p>
            </div>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
              <h3 className="font-bold text-cyan-400 uppercase tracking-wider">Professional Credentials</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Employee ID:</span>
                  <span className="font-mono font-bold text-white">{profileData.employee_id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Medical Council Reg #:</span>
                  <span className="font-mono text-cyan-400">{profileData.medical_license_number || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Department:</span>
                  <span className="text-white">{profileData.department}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">OPD Tariff Fee:</span>
                  <span className="font-mono text-emerald-400 font-bold">₹{profileData.consultation_fee}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
              <h3 className="font-bold text-cyan-400 uppercase tracking-wider">Recurring Weekly Working Hours</h3>
              <div className="space-y-1.5">
                {profileData.working_hours?.map((wh: any, i: number) => (
                  <div key={i} className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300 font-medium">{wh.day}</span>
                    <span className="font-mono text-cyan-400">{wh.start_time} - {wh.end_time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Assigned Clinical Shifts & Duty Rosters Scheduled by Department Head */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-cyan-400 uppercase tracking-wider">Scheduled Duty Rosters & Station Assignments</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Clinical shift assignments scheduled by Head of Department</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono font-bold">
                {(profileData.duty_roster || []).length} Scheduled Duties
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2 px-3">Duty Date</th>
                    <th className="py-2 px-3">Shift Schedule</th>
                    <th className="py-2 px-3">Assigned Station / Chamber</th>
                    <th className="py-2 px-3">Shift Hours</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(profileData.duty_roster && profileData.duty_roster.length > 0) ? (
                    profileData.duty_roster.map((sh: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-3 font-mono font-semibold text-white">{sh.date}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {sh.shift}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-200">{sh.station}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{sh.shift_window}</td>
                        <td className="py-2.5 px-3">
                          <span className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                            sh.status === 'COMPLETED' ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" :
                            sh.status === 'SWAP_REQUESTED' ? "bg-purple-500/10 text-purple-300 border-purple-500/20" :
                            "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                          )}>
                            {sh.status || 'SCHEDULED'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        No upcoming duty rosters currently scheduled.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Full-width Lounge TV Modal for Doctor */}
      {showLoungeTVModal && (
        <Modal
          isOpen={showLoungeTVModal}
          onClose={() => setShowLoungeTVModal(false)}
          title="Doctor Consultation Cabin • Real-Time Lounge TV & Queue"
          size="full"
        >
          <div className="max-h-[85vh] overflow-y-auto custom-scrollbar -m-4">
            <LoungeTVPage
              isStaffView={true}
              preselectedDoctorId={staffProfile?.id}
              onClose={() => setShowLoungeTVModal(false)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
