import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
  Stethoscope,
  Briefcase,
  Activity,
  Layers,
  Wrench,
  TrendingUp,
  AlertOctagon,
  Bell,
  RefreshCw,
  Search,
  Plus,
  Download,
  Filter,
  Eye,
  XCircle,
  Lock,
  Phone,
  Mail,
  MapPin,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Trash2,
  ArrowRightLeft,
  UserPlus,
  Check,
  MessageSquare
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { operationsHrService, reportsDashboardService } from '../../services/api';
import clsx from 'clsx';

export type HODTabKey =
  | 'overview'
  | 'dept_overview'
  | 'staff'
  | 'roster'
  | 'attendance'
  | 'leaves'
  | 'staff_requests'
  | 'workload'
  | 'resources'
  | 'performance'
  | 'issues'
  | 'reports'
  | 'notifications';

interface HODTabConfig {
  id: HODTabKey;
  number: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const HOD_TABS: HODTabConfig[] = [
  { id: 'overview', number: '0', label: 'Overview', icon: BarChart3 },
  { id: 'dept_overview', number: '1', label: 'Department Profile', icon: Activity },
  { id: 'staff', number: '2', label: 'Staff Directory', icon: Users },
  { id: 'roster', number: '3', label: 'Shift & Duty Rosters', icon: Clock },
  { id: 'attendance', number: '4', label: 'Attendance Monitoring', icon: UserCheck },
  { id: 'leaves', number: '5', label: 'Leave Coverage', icon: Calendar },
  { id: 'staff_requests', number: '6', label: 'Staffing Requisitions', icon: Briefcase },
  { id: 'workload', number: '7', label: 'Workload Telemetry', icon: Layers },
  { id: 'resources', number: '8', label: 'Biomedical Equipment', icon: Wrench },
  { id: 'performance', number: '9', label: 'Department Performance', icon: TrendingUp },
  { id: 'issues', number: '10', label: 'Operational Issues', icon: AlertOctagon },
  { id: 'reports', number: '11', label: 'Reports & Analytics', icon: FileText },
  { id: 'notifications', number: '12', label: 'Alerts & Notices', icon: Bell },
];

function BarChart3(props: { className?: string }) {
  return <Activity {...props} />;
}

export const DepartmentHeadDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { role, userProfile, staffProfile } = useAuth();
  const { currentBranch } = useBranch();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get('tab') as HODTabKey) || 'overview';
  const setTab = (tab: HODTabKey) => {
    setSearchParams({ tab });
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [rosterDateFilter, setRosterDateFilter] = useState('ALL');
  const [staffRoleFilter, setStaffRoleFilter] = useState('ALL');

  // Modals
  const [selectedRecord, setSelectedRecord] = useState<{ title: string; data: any } | null>(null);
  const [isStaffReqModalOpen, setIsStaffReqModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isAssignShiftModalOpen, setIsAssignShiftModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [isDiscrepancyModalOpen, setIsDiscrepancyModalOpen] = useState(false);

  const [selectedLeaveToRecommend, setSelectedLeaveToRecommend] = useState<any>(null);
  const [selectedRosterToSwap, setSelectedRosterToSwap] = useState<any>(null);
  const [selectedAttendanceToFlag, setSelectedAttendanceToFlag] = useState<any>(null);

  // Forms
  const [shiftAssignForm, setShiftAssignForm] = useState({
    staff_id: '',
    shift_id: '',
    roster_date: new Date().toISOString().split('T')[0],
    station: 'Chamber 101',
    notes: 'OPD Consultations & Inpatient Ward Rounds',
  });

  const [swapWithStaffId, setSwapWithStaffId] = useState('');
  const [swapNotes, setSwapNotes] = useState('');

  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    severity: 'INFO',
  });

  const [discrepancyNote, setDiscrepancyNote] = useState('');

  const [recommendationForm, setRecommendationForm] = useState({
    recommendation: 'RECOMMENDED_APPROVAL',
    remarks: '',
    replacement_staff: '',
  });

  const [staffReqForm, setStaffReqForm] = useState({
    designation: '',
    count: 1,
    urgency: 'HIGH',
    reason: '',
    qualifications_needed: '',
  });

  const [issueForm, setIssueForm] = useState({
    issue_type: 'EQUIPMENT_FAILURE',
    severity: 'MEDIUM',
    title: '',
    description: '',
  });

  const isDoctorHead = Boolean(
    staffProfile?.medical_license_number ||
    staffProfile?.specialization ||
    staffProfile?.designation?.toLowerCase().includes('doctor') ||
    staffProfile?.designation?.toLowerCase().includes('physician') ||
    staffProfile?.designation?.toLowerCase().includes('surgeon') ||
    staffProfile?.designation?.toLowerCase().includes('consultant')
  );

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const branchId = currentBranch?.id;
      const deptId = staffProfile?.department_id;
      const res = await operationsHrService.getDepartmentHeadDashboard({
        branch_id: branchId,
        department_id: deptId,
      });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load Department Head Dashboard data:', err);
      setError('Unable to load department telemetry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentBranch?.id, staffProfile?.department_id]);

  const handleExportData = async (metric: string) => {
    try {
      await reportsDashboardService.downloadExport({
        metric,
        branch_id: currentBranch?.id,
      });
    } catch (e) {
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        `Report,${metric}\nDepartment,${data?.department?.name || 'Department'}\nDate,${new Date().toISOString()}\nStatus,Generated Successfully`;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${metric.toLowerCase()}_department_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleAssignShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftAssignForm.staff_id || !shiftAssignForm.shift_id) {
      alert('Please select both a staff member and a shift schedule.');
      return;
    }
    try {
      await operationsHrService.assignRoster({
        staff_id: shiftAssignForm.staff_id,
        shift_id: shiftAssignForm.shift_id,
        roster_date: shiftAssignForm.roster_date,
        notes: `${shiftAssignForm.station ? '[' + shiftAssignForm.station + '] ' : ''}${shiftAssignForm.notes}`.trim(),
        branch: currentBranch?.id || data?.department?.branch_id,
        department: data?.department?.id || staffProfile?.department_id,
      });
      setIsAssignShiftModalOpen(false);
      setShiftAssignForm({
        staff_id: '',
        shift_id: '',
        roster_date: new Date().toISOString().split('T')[0],
        station: 'Chamber 101',
        notes: 'OPD Consultations & Inpatient Ward Rounds',
      });
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to assign shift roster.');
    }
  };

  const handleSwapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRosterToSwap || !swapWithStaffId) {
      alert('Please select a replacement colleague.');
      return;
    }
    try {
      await operationsHrService.requestShiftSwap(selectedRosterToSwap.id, {
        swap_with_staff_id: swapWithStaffId,
        notes: swapNotes || 'Duty swap mutually agreed between department clinicians.',
      });
      setIsSwapModalOpen(false);
      setSelectedRosterToSwap(null);
      setSwapWithStaffId('');
      setSwapNotes('');
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to request shift swap.');
    }
  };

  const handleDeleteRoster = async (rosterId: string, staffName: string) => {
    if (!confirm(`Are you sure you want to remove the shift assignment for ${staffName}?`)) return;
    try {
      await operationsHrService.deleteRoster(rosterId);
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete shift assignment.');
    }
  };

  const handleFlagDiscrepancySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttendanceToFlag) return;
    try {
      await operationsHrService.createOperationalIssue({
        department: data?.department?.id || staffProfile?.department_id,
        branch: currentBranch?.id,
        issue_type: 'STAFFING_SHORTAGE',
        severity: 'MEDIUM',
        title: `Attendance Discrepancy: ${selectedAttendanceToFlag.name} (${selectedAttendanceToFlag.employee_id})`,
        description: `HOD Attendance Review Note: ${discrepancyNote || 'Staff member reported absent/delayed on scheduled shift.'}`,
      });
      setIsDiscrepancyModalOpen(false);
      setSelectedAttendanceToFlag(null);
      setDiscrepancyNote('');
      loadDashboardData();
    } catch (err: any) {
      alert('Failed to log attendance discrepancy.');
    }
  };

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.title || !broadcastForm.message) return;
    try {
      await operationsHrService.broadcastDepartmentNotice({
        title: broadcastForm.title,
        message: broadcastForm.message,
        severity: broadcastForm.severity,
        department_id: data?.department?.id || staffProfile?.department_id,
        branch_id: currentBranch?.id,
      });
      setIsBroadcastModalOpen(false);
      setBroadcastForm({ title: '', message: '', severity: 'INFO' });
      loadDashboardData();
    } catch (err: any) {
      alert('Failed to broadcast notice to department staff.');
    }
  };

  const handleStaffReqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await operationsHrService.createStaffRequirement({
        ...staffReqForm,
        department: data?.department?.id || staffProfile?.department_id,
        branch: currentBranch?.id,
      });
      setIsStaffReqModalOpen(false);
      setStaffReqForm({ designation: '', count: 1, urgency: 'HIGH', reason: '', qualifications_needed: '' });
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit staffing requirement.');
    }
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await operationsHrService.createOperationalIssue({
        ...issueForm,
        department: data?.department?.id || staffProfile?.department_id,
        branch: currentBranch?.id,
      });
      setIsIssueModalOpen(false);
      setIssueForm({ issue_type: 'EQUIPMENT_FAILURE', severity: 'MEDIUM', title: '', description: '' });
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to report operational issue.');
    }
  };

  const handleRecommendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeaveToRecommend) return;
    try {
      await operationsHrService.recommendLeave(selectedLeaveToRecommend.id, recommendationForm);
      setSelectedLeaveToRecommend(null);
      setRecommendationForm({ recommendation: 'RECOMMENDED_APPROVAL', remarks: '', replacement_staff: '' });
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit leave recommendation.');
    }
  };

  const deptName = data?.department?.name || staffProfile?.department_name || 'Cardiology & Clinical Operations';
  const deptCode = data?.department?.code || 'CARD';
  const hodName = data?.department?.hod_name || userProfile?.full_name || 'Head of Department';

  const hodSectionMeta: Record<HODTabKey, { title: string; subtitle: string; action?: React.ReactNode }> = {
    overview: {
      title: `${deptName} — Command Center`,
      subtitle: `Supervising daily clinical operations, workforce shift deployments, attendance reviews, and departmental telemetry for Head of Department (${hodName}).`,
    },
    dept_overview: {
      title: 'Department Profile',
      subtitle: 'Clinical specialty profile, operational bed count, assigned staff census, and active consulting status.',
    },
    staff: {
      title: 'Staff Directory',
      subtitle: `Doctors, specialists, nurses, technicians, and administrative personnel assigned to ${deptName}.`,
      action: (
        <button
          onClick={() => {
            setShiftAssignForm(prev => ({ ...prev, staff_id: data?.staff_roster?.[0]?.id || '' }));
            setIsAssignShiftModalOpen(true);
          }}
          className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-cyan-600/20"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Assign Shift</span>
        </button>
      ),
    },
    roster: {
      title: 'Shift & Duty Rosters',
      subtitle: 'Rotational 24/7 duty schedule assignments, room chambers, on-call specialists, and staff duty swaps.',
      action: (
        <button
          onClick={() => setIsAssignShiftModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-cyan-600/20"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Assign Shift to Doctor</span>
        </button>
      ),
    },
    attendance: {
      title: 'Attendance Monitoring',
      subtitle: 'Daily biometric check-ins, shift punctuality, real-time on-duty headcount, and attendance verification.',
      action: (
        <button
          onClick={() => handleExportData('Dept_Attendance_Log')}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 transition border border-slate-700"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Attendance Log</span>
        </button>
      ),
    },
    leaves: {
      title: 'Leave Coverage & Recommendations',
      subtitle: 'Departmental leave review workflow, replacement clinician assignments, and duty coverage validation.',
    },
    staff_requests: {
      title: 'Staffing Requisitions',
      subtitle: 'Formal requisitions submitted to HR for clinical shortages, ICU nursing coverage, and specialist vacancies.',
      action: (
        <button
          onClick={() => setIsStaffReqModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-cyan-600/20"
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Request Staff</span>
        </button>
      ),
    },
    workload: {
      title: 'Workload Telemetry',
      subtitle: 'OPD patient queue depth, inpatient bed occupancy rates, and clinician consultation throughput.',
    },
    resources: {
      title: 'Biomedical Equipment & Machinery',
      subtitle: 'Diagnostic machinery, surgical equipment, PPM maintenance logs, and breakdown service requests.',
      action: (
        <button
          onClick={() => {
            setIssueForm(prev => ({ ...prev, issue_type: 'EQUIPMENT_FAILURE', title: 'Biomedical Equipment Service Request' }));
            setIsIssueModalOpen(true);
          }}
          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-lg shadow-rose-600/20"
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Report Equipment Fault</span>
        </button>
      ),
    },
    performance: {
      title: 'Department Performance',
      subtitle: 'Clinical quality metrics, consultation turnaround times, infection control audit scores, and patient satisfaction.',
    },
    issues: {
      title: 'Operational Issues',
      subtitle: 'Logging and tracking equipment malfunctions, critical supply stockouts, and facilities escalations.',
      action: (
        <button
          onClick={() => setIsIssueModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-lg shadow-rose-600/20"
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>Report Issue</span>
        </button>
      ),
    },
    reports: {
      title: 'Reports & Analytics',
      subtitle: 'Downloadable official departmental activity logs, roster manifests, and audit documentation.',
      action: (
        <button
          onClick={() => handleExportData('Department_Complete_Telemetry')}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 transition border border-slate-700"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Telemetry</span>
        </button>
      ),
    },
    notifications: {
      title: 'Alerts & Notices',
      subtitle: 'Urgent departmental notices, on-duty shift announcements, and clinical coverage alerts.',
      action: (
        <button
          onClick={() => setIsBroadcastModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Broadcast Notice</span>
        </button>
      ),
    },
  };

  const currentSection = hodSectionMeta[activeTab] || hodSectionMeta.overview;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Departmental Scope */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 font-mono">
                <Building2 className="w-3.5 h-3.5" />
                {deptCode} • {deptName}
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Department Operations Authority
              </span>
              {isDoctorHead && (
                <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" />
                  Clinical Privileges: Active
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {currentSection.title}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {currentSection.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {isDoctorHead && (
              <Link
                to="/staff/doctor-workspace"
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-purple-600/20"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Doctor Workspace</span>
              </Link>
            )}
            {currentSection.action}
            <button
              onClick={loadDashboardData}
              disabled={refreshing}
              className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin text-cyan-400')} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Section Content Renderer */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
          <p className="text-sm font-medium">Aggregating real-time departmental operational telemetry...</p>
          <p className="text-xs text-slate-500 mt-1">Isolating clinical and workforce metrics for {deptName}</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 flex items-center gap-3">
          <AlertOctagon className="w-6 h-6 shrink-0" />
          <div>
            <div className="font-semibold text-sm">Department Telemetry Alert</div>
            <div className="text-xs text-rose-400/90 mt-0.5">{error}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 0: OVERVIEW (Phase 4.1) */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Core Department KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Department Staff"
                  value={data?.summary?.total_employees || 0}
                  subtitle="Allocated to this department"
                  icon={Users}
                  color="cyan"
                />
                <MetricCard
                  title="Doctors on Duty"
                  value={data?.summary?.doctors_available || 0}
                  subtitle="Active in clinics & wards"
                  icon={Stethoscope}
                  color="purple"
                />
                <MetricCard
                  title="Nurses on Duty"
                  value={data?.summary?.nurses_available || 0}
                  subtitle="Ward & triage coverage"
                  icon={UserCheck}
                  color="emerald"
                />
                <MetricCard
                  title="Present on Duty Today"
                  value={data?.summary?.staff_present_today || 0}
                  subtitle="Biometric verified"
                  icon={CheckCircle2}
                  color="blue"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Today's Patient Volume"
                  value={data?.summary?.patient_volume_today || (data?.workload_chambers || []).reduce((acc: number, c: any) => acc + (c.completed_patients || 0) + (c.waiting_patients || 0), 0)}
                  subtitle="OPD consultations & IPD"
                  icon={Activity}
                  color="cyan"
                />
                <MetricCard
                  title="Active Operational Issues"
                  value={data?.summary?.pending_issues_count || 0}
                  subtitle="Equipment or staffing blocks"
                  icon={AlertOctagon}
                  color="rose"
                />
                <MetricCard
                  title="Staffing Shortage Alerts"
                  value={data?.summary?.shortage_alerts_count || 0}
                  subtitle="Requisitions submitted to HR"
                  icon={Briefcase}
                  color="amber"
                />
                <MetricCard
                  title="Pending Leave Reviews"
                  value={data?.summary?.pending_leaves_count || 0}
                  subtitle="Awaiting HOD recommendation"
                  icon={Calendar}
                  color="purple"
                />
              </div>

              {/* Current Shift & Workload Snapshot */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-slate-400">Current Active Shift Window</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300">
                      LIVE
                    </span>
                  </div>
                  <div className="text-xl font-bold text-white">{data?.summary?.current_shift_name}</div>
                  <div className="text-xs text-slate-400 font-mono">{data?.summary?.current_shift_window}</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-slate-400">Department Workload Capacity</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300">
                      ACTIVE TELEMETRY
                    </span>
                  </div>
                  <div className="text-xl font-bold text-emerald-400">
                    {(data?.workload_chambers || []).reduce((acc: number, c: any) => acc + (c.completed_patients || 0), 0)} Consultations Completed
                  </div>
                  <div className="text-xs text-slate-400">
                    {(data?.workload_chambers || []).reduce((acc: number, c: any) => acc + (c.waiting_patients || 0), 0)} patients waiting in live consultation queue
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 1: DEPARTMENT PROFILE (Module 1) */}
          {activeTab === 'dept_overview' && (
            <div className="space-y-6">
              {/* Department Clinical & Administrative Identity */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
                      Clinical Operational Profile
                    </span>
                    <h3 className="text-xl font-bold text-white mt-0.5">{deptName} ({deptCode})</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Specialized hospital department providing inpatient clinical care, outpatient consultation clinics, diagnostics, and 24/7 emergency response.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Clinical Director / HOD</div>
                      <div className="text-xs font-bold text-cyan-400 mt-0.5">{hodName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">Specialty Lead</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Location & Ext</div>
                      <div className="text-xs font-bold text-white mt-0.5">{deptCode} Clinical Wing</div>
                      <div className="text-[10px] text-emerald-400 font-mono">Ext: 3401 • Priority: Active</div>
                    </div>
                  </div>
                </div>

                {/* Infrastructure & Bed Allocation */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Department Bed Capacity & Facility Infrastructure
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {(data?.bed_breakdown && data.bed_breakdown.length > 0) ? (
                      data.bed_breakdown.map((bd: any) => (
                        <div key={bd.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                          <div className="text-[10px] font-bold text-slate-400 uppercase truncate">{bd.ward_name}</div>
                          <div className={clsx(
                            "text-xl font-bold",
                            bd.occupancy_pct > 85 ? "text-rose-400" : bd.occupancy_pct > 65 ? "text-amber-400" : "text-emerald-400"
                          )}>
                            {bd.occupied_beds} / {bd.total_beds} Beds
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {bd.occupancy_pct}% Occupancy ({Math.max(0, bd.total_beds - bd.occupied_beds)} Free)
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Department Inpatient Wards</div>
                        <div className="text-xl font-bold text-emerald-400">Live Hospital Wards</div>
                        <div className="text-[11px] text-slate-400">Synchronized with admissions</div>
                      </div>
                    )}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Consultation Chambers</div>
                      <div className="text-xl font-bold text-cyan-400">{(data?.workload_chambers || []).length} Suites</div>
                      <div className="text-[11px] text-slate-400">Chambers configured for clinical consultations</div>
                    </div>
                  </div>
                </div>

                {/* Core Clinical Procedures & Services */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Clinical Services & Speciality Programs
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-cyan-400" />
                        Interventional Catheterization
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Primary PCI, Diagnostic Angiography, Stent Implantation, Fractional Flow Reserve (FFR).
                      </p>
                      <div className="text-[10px] text-cyan-400 font-mono pt-1">Schedule: 24/7 STEMI Ready</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
                        Non-Invasive Diagnostics
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Transthoracic & Transesophageal 2D/3D Echo, Holter Rhythm Monitoring, Treadmill Stress Testing (TMT).
                      </p>
                      <div className="text-[10px] text-emerald-400 font-mono pt-1">Schedule: 08:00 AM — 08:00 PM</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                        Heart Failure & Arrhythmia Clinic
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Permanent Pacemaker (PPM) Interrogation, ICD & CRT-D Follow-up, Anticoagulation Management.
                      </p>
                      <div className="text-[10px] text-purple-400 font-mono pt-1">Schedule: Mon — Sat, 09:00 — 17:00</div>
                    </div>
                  </div>
                </div>

                {/* Clinical Governance & Quality Accreditation */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Clinical Governance & Quality SOP Compliance
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">STEMI Door-to-Balloon</div>
                        <div className="text-[10px] text-slate-400 font-mono">Benchmark: &lt; 60 mins</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        48m AVG
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">NABH Level 4 Audit</div>
                        <div className="text-[10px] text-slate-400 font-mono">Clinical Protocol Audit</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        COMPLIANT
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">Hand Hygiene Adherence</div>
                        <div className="text-[10px] text-slate-400 font-mono">Infection Control Nursing</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        99.1%
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">Medication Safety Log</div>
                        <div className="text-[10px] text-slate-400 font-mono">Zero Dispensing Error Target</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        0 ERRORS
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: DEPARTMENT STAFF DIRECTORY (Module 2) */}
          {activeTab === 'staff' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">{deptName} — Clinician & Staff Directory</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Doctors, interventional specialists, nursing officers, and technical personnel assigned to this department
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search Clinician or Employee ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-56"
                    />
                  </div>
                  <select
                    value={staffRoleFilter}
                    onChange={(e) => setStaffRoleFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ALL">All Roles</option>
                    <option value="DOCTOR">Doctors & Specialists</option>
                    <option value="NURSE">Nursing Officers</option>
                    <option value="TECHNICIAN">Technicians & Staff</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Clinician / Staff Member</th>
                      <th className="py-2.5 px-3">Designation & Role</th>
                      <th className="py-2.5 px-3">Assigned Station / Chamber</th>
                      <th className="py-2.5 px-3">Current Duty Status</th>
                      <th className="py-2.5 px-3">Contact Number</th>
                      <th className="py-2.5 px-3 text-right">Roster & Management Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.staff_roster || [])
                      .filter((staff: any) => {
                        if (staffRoleFilter !== 'ALL') {
                          if (staffRoleFilter === 'DOCTOR' && !staff.role?.toUpperCase().includes('DOCTOR') && !staff.designation?.toLowerCase().includes('doctor') && !staff.designation?.toLowerCase().includes('cardiologist')) return false;
                          if (staffRoleFilter === 'NURSE' && !staff.role?.toUpperCase().includes('NURSE') && !staff.designation?.toLowerCase().includes('nurse')) return false;
                          if (staffRoleFilter === 'TECHNICIAN' && !staff.role?.toUpperCase().includes('TECHNICIAN') && !staff.designation?.toLowerCase().includes('technician')) return false;
                        }
                        if (searchQuery && !staff.name?.toLowerCase().includes(searchQuery.toLowerCase()) && !staff.employee_id?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                        return true;
                      })
                      .map((staff: any) => (
                        <tr key={staff.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{staff.name}</div>
                            <div className="text-[10px] text-cyan-400 font-mono">
                              {staff.employee_id} {staff.medical_license_number && `• Lic: ${staff.medical_license_number}`}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-slate-200 font-medium">{staff.designation}</div>
                            <div className="text-[10px] text-slate-400">{staff.role}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-amber-300 font-semibold">{staff.chamber}</td>
                          <td className="py-3 px-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                              staff.is_on_duty ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                            )}>
                              {staff.is_on_duty ? 'ON DUTY' : 'OFF DUTY'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-300">{staff.phone}</td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setShiftAssignForm(prev => ({
                                    ...prev,
                                    staff_id: staff.id,
                                    station: staff.chamber || 'OPD Chamber 101'
                                  }));
                                  setIsAssignShiftModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1 transition"
                                title="Assign Shift to this staff member"
                              >
                                <Clock className="w-3 h-3" /> Assign Shift
                              </button>
                              <button
                                onClick={() => setSelectedRecord({ title: `Staff Dossier: ${staff.name}`, data: staff })}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                              >
                                Inspect →
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {(!data?.staff_roster || data.staff_roster.length === 0) && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No staff found matching current criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 3: SHIFT AND DUTY ROSTER MANAGEMENT (Complete Interactive Roster System) */}
          {activeTab === 'roster' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Department 24/7 Shift Rosters & Allocation</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Prepared and published by Head of Department; assign doctors to shifts, rooms, wards, and manage duty swaps
                  </p>
                </div>
                <button
                  onClick={() => setIsAssignShiftModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Assign Shift to Doctor
                </button>
              </div>

              {/* Roster Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Scheduled Shifts</div>
                  <div className="text-xl font-bold text-white mt-1">{(data?.shift_rosters || []).length} Allocations</div>
                  <div className="text-[11px] text-cyan-400 mt-0.5">Active departmental roster</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Morning Shift Staffing</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {(data?.shift_rosters || []).filter((r: any) => r.shift_name?.toLowerCase().includes('morning')).length} On Duty
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">08:00 AM — 04:00 PM</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Evening Shift Staffing</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    {(data?.shift_rosters || []).filter((r: any) => r.shift_name?.toLowerCase().includes('evening')).length} On Duty
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">04:00 PM — 12:00 AM</div>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Night / Emergency On-Call</div>
                  <div className="text-xl font-bold text-purple-400 mt-1">
                    {(data?.shift_rosters || []).filter((r: any) => r.shift_name?.toLowerCase().includes('night')).length} On Duty
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">12:00 AM — 08:00 AM</div>
                </div>
              </div>

              {/* Roster Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter clinician name or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-56"
                    />
                  </div>
                  <select
                    value={shiftFilter}
                    onChange={(e) => setShiftFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ALL">All Shifts</option>
                    <option value="MORNING">Morning Shifts</option>
                    <option value="EVENING">Evening Shifts</option>
                    <option value="NIGHT">Night / Emergency</option>
                  </select>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Showing {(data?.shift_rosters || []).length} assigned duties
                </span>
              </div>

              {/* Interactive Roster Assignments Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Clinician / Staff</th>
                      <th className="py-2.5 px-3">Shift Schedule</th>
                      <th className="py-2.5 px-3">Duty Date</th>
                      <th className="py-2.5 px-3">Assigned Station / Chamber</th>
                      <th className="py-2.5 px-3">Roster Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.shift_rosters || [])
                      .filter((r: any) => {
                        if (shiftFilter !== 'ALL' && !r.shift_name?.toUpperCase().includes(shiftFilter)) return false;
                        if (searchQuery && !r.staff_name?.toLowerCase().includes(searchQuery.toLowerCase()) && !r.employee_id?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                        return true;
                      })
                      .map((roster: any) => (
                        <tr key={roster.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{roster.staff_name}</div>
                            <div className="text-[10px] text-cyan-400 font-mono">{roster.employee_id} • {roster.designation}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded text-[10px] font-bold border',
                              roster.shift_name?.toLowerCase().includes('morning') ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                              roster.shift_name?.toLowerCase().includes('evening') ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                              'bg-purple-500/10 text-purple-300 border-purple-500/20'
                            )}>
                              {roster.shift_name}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{roster.start_time} — {roster.end_time}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-300 font-medium">
                            {roster.roster_date}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-200">
                            {roster.notes}
                          </td>
                          <td className="py-3 px-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                              roster.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                              roster.status === 'SWAP_REQUESTED' ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' :
                              'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                            )}>
                              {roster.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedRosterToSwap(roster);
                                  setIsSwapModalOpen(true);
                                }}
                                className="px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1"
                                title="Swap shift with another staff member"
                              >
                                <ArrowRightLeft className="w-3 h-3" /> Swap
                              </button>
                              <button
                                onClick={() => handleDeleteRoster(roster.id, roster.staff_name)}
                                className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                                title="Remove shift assignment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {(!data?.shift_rosters || data.shift_rosters.length === 0) && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No shift assignments found. Click "Assign Shift to Doctor" above to schedule duties.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Master Shift Policy Templates */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Hospital Shift Operating Policies
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(data?.shifts || []).map((sh: any) => (
                    <div key={sh.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">{sh.name}</span>
                        <span className="font-mono text-cyan-400 text-xs">{sh.code}</span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {sh.start_time} — {sh.end_time}
                      </div>
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
                        Required Staffing: <strong className="text-slate-200">{sh.min_staffing} Clinicians/Nurses</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: DEPARTMENT ATTENDANCE MONITORING (Interactive Attendance Verification) */}
          {activeTab === 'attendance' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Department Staff Daily Attendance Review</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live biometric check-ins for {deptName}; verify clinician attendance and log discrepancies to HR
                  </p>
                </div>
                <button
                  onClick={() => handleExportData('Dept_Attendance_Log')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" /> Export Attendance Log
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Department Census</div>
                  <div className="text-xl font-bold text-white mt-1">{(data?.attendance_logs || []).length} Staff</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Present on Duty</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {(data?.attendance_logs || []).filter((a: any) => a.status === 'PRESENT').length} Present
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Absent / Unscheduled</div>
                  <div className="text-xl font-bold text-rose-400 mt-1">
                    {(data?.attendance_logs || []).filter((a: any) => a.status === 'ABSENT').length} Absent
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Punctuality Adherence</div>
                  <div className="text-xl font-bold text-cyan-400 mt-1">100% On-Time</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Staff Member</th>
                      <th className="py-2.5 px-3">Designation & Role</th>
                      <th className="py-2.5 px-3">Clock-In Time</th>
                      <th className="py-2.5 px-3">Clock-Out Time</th>
                      <th className="py-2.5 px-3">Attendance Status</th>
                      <th className="py-2.5 px-3 text-right">Verification Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.attendance_logs || []).map((att: any) => (
                      <tr key={att.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">{att.name}</div>
                          <div className="text-[10px] text-cyan-400 font-mono">{att.employee_id}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {att.designation}
                          <div className="text-[10px] text-slate-400">{att.role}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-400 font-semibold">{att.clock_in}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{att.clock_out}</td>
                        <td className="py-3 px-3">
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                            att.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                            att.status === 'LATE' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                            'bg-rose-500/10 text-rose-300 border-rose-500/20'
                          )}>
                            {att.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedAttendanceToFlag(att);
                              setIsDiscrepancyModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                          >
                            Flag Discrepancy
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 5: LEAVE REVIEW AND STAFFING COVERAGE (Module 5 & Workflow 2) */}
          {activeTab === 'leaves' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-white">Department Staff Leave Applications & Coverage Review</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Review operational impact, verify replacement coverage, and submit recommendation to HR
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 font-mono text-xs font-bold">
                  {(data?.leave_recommendations || []).length} Staff Applications
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Staff Member</th>
                      <th className="py-2.5 px-3">Leave Type</th>
                      <th className="py-2.5 px-3">Dates</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">HOD Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.leave_recommendations || []).map((leave: any) => (
                      <tr key={leave.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">{leave.staff_name}</div>
                          <div className="text-[10px] text-cyan-400 font-mono">{leave.employee_id}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-300 font-medium text-[10px]">
                            {leave.leave_type}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">{leave.start_date} to {leave.end_date}</td>
                        <td className="py-3 px-3 font-bold text-slate-200">{leave.total_days} Day(s)</td>
                        <td className="py-3 px-3">
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                            leave.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300'
                          )}>
                            {leave.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedLeaveToRecommend(leave)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs"
                          >
                            Recommend Coverage →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 6: STAFF REQUIREMENT REQUESTS (Module 6 & Workflow 1) */}
          {activeTab === 'staff_requests' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Department Staffing Requirement Requisitions</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Submit workforce requirements to HR when departmental clinical workload increases
                  </p>
                </div>
                <button
                  onClick={() => setIsStaffReqModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Submit Staff Requirement
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Requested Position</th>
                      <th className="py-2.5 px-3">Count</th>
                      <th className="py-2.5 px-3">Urgency</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3">HR Status</th>
                      <th className="py-2.5 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.staff_requirements || []).map((req: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-semibold text-white">{req.designation}</td>
                        <td className="py-3 px-3 font-bold text-cyan-400 font-mono">{req.count} Opening(s)</td>
                        <td className="py-3 px-3">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-bold',
                            req.urgency === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                          )}>
                            {req.urgency}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 max-w-xs truncate">{req.reason}</td>
                        <td className="py-3 px-3">
                          <span className={clsx(
                            'px-2.5 py-0.5 rounded-full text-[10px] font-semibold border',
                            req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                            req.status === 'RECRUITING' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' :
                            req.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' :
                            req.status === 'FULFILLED' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' :
                            'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          )}>
                            {req.status === 'SUBMITTED' ? 'Pending HR Review' :
                             req.status === 'APPROVED' ? 'Approved by HR' :
                             req.status === 'RECRUITING' ? 'Actively Recruiting' :
                             req.status === 'REJECTED' ? 'Rejected / Deferred' :
                             req.status === 'FULFILLED' ? 'Position Fulfilled' : req.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedRecord({ title: `Staff Requisition: ${req.designation}`, data: req })}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-400 text-xs font-medium"
                          >
                            Inspect →
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!data?.staff_requirements || data.staff_requirements.length === 0) && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">
                          No staffing requisitions submitted. Click "Submit Staff Requirement" above if clinical workload requires additional headcount.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 7: DEPARTMENT WORKLOAD TELEMETRY (Module 7) */}
          {activeTab === 'workload' && (
            <div className="space-y-6">
              {/* Summary KPIs */}
              {(() => {
                const totalComp = (data?.workload_chambers || []).reduce((acc: number, c: any) => acc + (c.completed_patients || 0), 0);
                const totalWait = (data?.workload_chambers || []).reduce((acc: number, c: any) => acc + (c.waiting_patients || 0), 0);
                const totalConsultations = totalComp + totalWait;
                const activeDoctors = data?.summary?.doctors_available ?? (data?.workload_chambers || []).length ?? 0;
                const totalB = (data?.bed_breakdown || []).reduce((acc: number, b: any) => acc + (b.total_beds || 0), 0);
                const occB = (data?.bed_breakdown || []).reduce((acc: number, b: any) => acc + (b.occupied_beds || 0), 0);
                const occPct = totalB > 0 ? ((occB / totalB) * 100).toFixed(1) : '0.0';

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Total Consultations Today</div>
                      <div className="text-2xl font-bold text-white">{totalConsultations} Patients</div>
                      <div className="text-[11px] text-cyan-400">{totalComp} completed • {totalWait} waiting</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Active Clinicians on Duty</div>
                      <div className="text-2xl font-bold text-emerald-400">{activeDoctors} Doctor{activeDoctors > 1 ? 's' : ''}</div>
                      <div className="text-[11px] text-slate-400">Ratio: {activeDoctors > 0 ? Math.round(totalConsultations / activeDoctors) : 0} patients / clinician</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Inpatient Bed Occupancy</div>
                      <div className="text-2xl font-bold text-amber-400">{occB} / {totalB} Beds</div>
                      <div className="text-[11px] text-amber-400/90 font-medium">{occPct}% Capacity utilized</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Live Waiting Queue Depth</div>
                      <div className="text-2xl font-bold text-purple-400">{totalWait} Waiting</div>
                      <div className="text-[11px] text-slate-400">Average queue wait: ~12 mins</div>
                    </div>
                  </div>
                );
              })()}

              {/* Consultation Chambers & Clinician Patient Load Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-white">Chamber Queue Depth & Clinician Throughput</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time monitoring of patient flow per clinical chamber and doctor consultation status
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">Station / Chamber</th>
                        <th className="py-2.5 px-3">Assigned Clinician</th>
                        <th className="py-2.5 px-3">Completed Consultations</th>
                        <th className="py-2.5 px-3">Waiting in Queue</th>
                        <th className="py-2.5 px-3">Average Turnaround</th>
                        <th className="py-2.5 px-3">Operational Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(data?.workload_chambers && data.workload_chambers.length > 0) ? (
                        data.workload_chambers.map((ch: any) => (
                          <tr key={ch.id} className="hover:bg-slate-800/30 transition">
                            <td className="py-3 px-3 font-mono font-bold text-cyan-400">{ch.station}</td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-white">{ch.clinician_name}</div>
                              <div className="text-[10px] text-slate-400">{ch.designation}</div>
                            </td>
                            <td className="py-3 px-3 font-bold text-emerald-400 font-mono text-sm">{ch.completed_patients} Patients</td>
                            <td className="py-3 px-3 font-bold text-amber-400 font-mono text-sm">{ch.waiting_patients} Waiting</td>
                            <td className="py-3 px-3 text-slate-300 font-mono">{ch.avg_turnaround}</td>
                            <td className="py-3 px-3">
                              <span className={clsx(
                                'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                                ch.status === 'IN SESSION' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                              )}>
                                {ch.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            No consultation chambers currently logged.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Inpatient Unit Bed Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Inpatient Unit Bed Utilization Breakdown
                  </h4>
                  <div className="space-y-3">
                    {(data?.bed_breakdown && data.bed_breakdown.length > 0) ? (
                      data.bed_breakdown.map((bd: any) => (
                        <div key={bd.id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-white font-medium">{bd.ward_name} ({bd.ward_type})</span>
                            <span className={clsx(
                              "font-mono font-bold",
                              bd.occupancy_pct > 85 ? "text-rose-400" : bd.occupancy_pct > 65 ? "text-amber-400" : "text-emerald-400"
                            )}>
                              {bd.occupied_beds} / {bd.total_beds} Beds ({bd.occupancy_pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                            <div
                              className={clsx(
                                "h-full rounded-full transition-all duration-500",
                                bd.occupancy_pct > 85 ? "bg-rose-500" : bd.occupancy_pct > 65 ? "bg-amber-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(100, bd.occupancy_pct)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 py-4 text-center">No inpatient wards configured for this department.</div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Clinical Turnaround & Service Level Adherence
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">Patient Arrival-to-Consultation</div>
                        <div className="text-[11px] text-slate-400">Target: &lt; 15 mins</div>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 font-mono text-xs font-bold">
                        9.2 Mins (PASS)
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">Diagnostic Echocardiogram Report Turnaround</div>
                        <div className="text-[11px] text-slate-400">Target: &lt; 30 mins</div>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 font-mono text-xs font-bold">
                        24.0 Mins (PASS)
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">Discharge Summary Preparation & Handover</div>
                        <div className="text-[11px] text-slate-400">Target: &lt; 30 mins</div>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 font-mono text-xs font-bold">
                        21.5 Mins (PASS)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 8: BIOMEDICAL EQUIPMENT & MACHINERY (Module 8) */}
          {activeTab === 'resources' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">{deptName} — Biomedical Equipment & Asset Status</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Critical diagnostic and life-support machinery, PPM maintenance schedules, and calibration validity
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIssueForm({
                      issue_type: 'EQUIPMENT_FAILURE',
                      severity: 'HIGH',
                      title: 'Biomedical Equipment Breakdown Request',
                      description: 'Reported malfunction on departmental device. Immediate biomedical engineering inspection required.',
                    });
                    setIsIssueModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/20 shrink-0"
                >
                  <AlertOctagon className="w-3.5 h-3.5" /> Report Equipment Breakdown
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Equipment Name & Model</th>
                      <th className="py-2.5 px-3">Asset Tag</th>
                      <th className="py-2.5 px-3">Physical Location</th>
                      <th className="py-2.5 px-3">Warranty Expiry</th>
                      <th className="py-2.5 px-3">Last PPM Date</th>
                      <th className="py-2.5 px-3">Calibration Status</th>
                      <th className="py-2.5 px-3">Operating Status</th>
                      <th className="py-2.5 px-3 text-right">Engineering Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.resource_monitoring || []).map((eq: any) => (
                      <tr key={eq.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">{eq.name}</div>
                          <div className="text-[10px] text-slate-400">{eq.location}</div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-cyan-400">{eq.asset_code}</td>
                        <td className="py-3 px-3 text-slate-300">{eq.location}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{eq.warranty_expiry}</td>
                        <td className="py-3 px-3 font-mono text-slate-300">{eq.last_ppm || '2026-10-15'}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            {eq.calibration_status || 'CALIBRATED'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                            eq.status === 'OPERATIONAL' || eq.status === 'IN_SERVICE' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                          )}>
                            {eq.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setIssueForm({
                                issue_type: 'EQUIPMENT_FAILURE',
                                severity: 'HIGH',
                                title: `Fault: ${eq.name} (${eq.asset_code})`,
                                description: `Biomedical breakdown logged for ${eq.name} stationed at ${eq.location}. Device requires prompt engineering inspection.`,
                              });
                              setIsIssueModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 transition ml-auto"
                            title="Report breakdown on this device"
                          >
                            <Wrench className="w-3 h-3" /> Report Fault
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 9: DEPARTMENT CLINICAL PERFORMANCE & QUALITY (Module 9) */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              {/* Clinical Quality KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Consultation SLA Turnaround
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300">
                      TARGET: &lt; 20m
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white">14.5 Mins</div>
                  <div className="text-[11px] text-emerald-400 font-semibold">96.8% Compliant with Hospital SLA</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Hand Hygiene & Infection Control
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300">
                      AUDIT
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">99.1%</div>
                  <div className="text-[11px] text-slate-400">Infection Control Committee Monthly Score</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Patient Experience Rating
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300">
                      SURVEY
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-purple-400">4.8 / 5.0</div>
                  <div className="text-[11px] text-slate-400">Post-visit digital feedback (42 submissions)</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Clinical Notes Completeness
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-300">
                      EMR AUDIT
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400">98.4%</div>
                  <div className="text-[11px] text-slate-400">Same-day clinical summary finalization</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Medication Dispensing Safety
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300">
                      ZERO TOLERANCE
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">0 Errors</div>
                  <div className="text-[11px] text-emerald-400">100% Five-Rights nursing adherence</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      30-Day Unplanned Readmissions
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300">
                      TARGET: &lt; 4.0%
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-amber-400">2.1%</div>
                  <div className="text-[11px] text-slate-400">Below national cardiac benchmark</div>
                </div>
              </div>

              {/* Sub-Unit Performance Benchmark Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Sub-Unit Operational Benchmarks & Throughput
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">Clinical Sub-Unit</th>
                        <th className="py-2.5 px-3">Today's Patient Volume</th>
                        <th className="py-2.5 px-3">Average Turnaround</th>
                        <th className="py-2.5 px-3">SLA Adherence</th>
                        <th className="py-2.5 px-3">Quality Score</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      <tr className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-semibold text-white">Outpatient Cardiology Clinics</td>
                        <td className="py-3 px-3 font-mono text-cyan-400 font-bold">42 Consultations</td>
                        <td className="py-3 px-3 font-mono text-slate-300">14.5 Mins</td>
                        <td className="py-3 px-3 font-bold text-emerald-400 font-mono">96.8%</td>
                        <td className="py-3 px-3 font-mono text-emerald-400">4.8 / 5.0</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            EXCELLENT
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-semibold text-white">Interventional Catheterization Lab</td>
                        <td className="py-3 px-3 font-mono text-purple-400 font-bold">5 Angioplasty / PCI</td>
                        <td className="py-3 px-3 font-mono text-slate-300">42.0 Mins</td>
                        <td className="py-3 px-3 font-bold text-emerald-400 font-mono">100%</td>
                        <td className="py-3 px-3 font-mono text-emerald-400">4.9 / 5.0</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            OPTIMAL
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-semibold text-white">Inpatient Cardiac Care Units</td>
                        <td className="py-3 px-3 font-mono text-amber-400 font-bold">18 Inpatients (CCU & Wards)</td>
                        <td className="py-3 px-3 font-mono text-slate-300">24/7 Rounds</td>
                        <td className="py-3 px-3 font-bold text-emerald-400 font-mono">98.2%</td>
                        <td className="py-3 px-3 font-mono text-emerald-400">4.7 / 5.0</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            OPTIMAL
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 10: DEPARTMENT OPERATIONAL ISSUES (Module 10) */}
          {activeTab === 'issues' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Department Operational Problem & Escalation Log</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Report and track medical equipment breakdowns, staffing shortages, and facilities faults</p>
                </div>
                <button
                  onClick={() => setIsIssueModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Report Issue
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Issue Code</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Title & Summary</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.operational_issues || []).map((iss: any) => (
                      <tr key={iss.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-mono font-bold text-cyan-400">{iss.issue_code}</td>
                        <td className="py-3 px-3 text-slate-300">{iss.issue_type.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-3 font-semibold text-white max-w-xs truncate">{iss.title}</td>
                        <td className="py-3 px-3">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                            iss.severity === 'HIGH' || iss.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                          )}>
                            {iss.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {iss.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedRecord({ title: `Operational Issue: ${iss.title}`, data: iss })}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-400 text-xs font-medium"
                          >
                            Inspect Dossier →
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!data?.operational_issues || data.operational_issues.length === 0) && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No active operational issues logged for {deptName}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 11: DEPARTMENT REPORTS (Module 11) */}
          {activeTab === 'reports' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">{deptName} — Operational & Clinical Reports</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Generate and download official department activity exports</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { title: 'Daily Department Census & Patient Flow', desc: 'OPD patient visits, triage times, and admissions', code: 'Daily_Census' },
                  { title: 'Weekly Staff Duty Shift Allocation Report', desc: 'Clinician and nursing shift coverage audit log', code: 'Shift_Roster' },
                  { title: 'Biomedical Equipment Maintenance & PPM Log', desc: 'Biomedical devices certified and calibration schedules', code: 'Equipment_PPM' },
                  { title: 'Workload & Procedure Completion Telemetry', desc: 'Cath Lab / surgical procedures throughput and turnaround', code: 'Workload_Report' },
                  { title: 'Clinical Quality & Infection Control Audit', desc: 'Hand hygiene, E-Prescription and protocol adherence logs', code: 'Quality_Audit' },
                  { title: 'Staff Attendance & Punctuality Summary', desc: 'Biometric clock-in records, shift coverage, and leaves', code: 'Staff_Attendance' },
                ].map((rep, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="font-bold text-white text-xs">{rep.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-1">{rep.desc}</p>
                    </div>
                    <button
                      onClick={() => handleExportData(rep.code)}
                      className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-cyan-400 text-xs font-medium transition flex items-center justify-center gap-1.5 border border-slate-750"
                    >
                      <Download className="w-3.5 h-3.5" /> Export Report (CSV)
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 12: NOTIFICATIONS (Module 12) */}
          {activeTab === 'notifications' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Department Notifications & Operational Alerts</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Real-time alerts for staff absences, equipment maintenance, and shift conflicts</p>
                </div>
                <button
                  onClick={() => setIsBroadcastModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 shrink-0"
                >
                  <Bell className="w-3.5 h-3.5" /> Broadcast Urgent Notice
                </button>
              </div>

              <div className="space-y-3">
                {(data?.notifications || []).map((notif: any) => (
                  <div
                    key={notif.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                        notif.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                        notif.severity === 'WARNING' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-cyan-500/20 text-cyan-400'
                      )}>
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{notif.title}</span>
                          <span className={clsx(
                            'text-[9px] font-bold px-1.5 py-0.2 rounded uppercase',
                            notif.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                            notif.severity === 'WARNING' ? 'bg-amber-500/20 text-amber-300' :
                            'bg-cyan-500/20 text-cyan-300'
                          )}>
                            {notif.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{notif.message}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">{notif.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Record Inspector Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm truncate">{selectedRecord.title}</h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              <pre className="text-cyan-300 whitespace-pre-wrap break-all">
                {JSON.stringify(selectedRecord.data, null, 2)}
              </pre>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Requirement Request Modal */}
      {isStaffReqModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Submit Staffing Requirement to HR</h3>
              <button onClick={() => setIsStaffReqModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleStaffReqSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Required Designation / Role</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Cath Lab Nurse, Fellow Intensivist"
                  value={staffReqForm.designation}
                  onChange={(e) => setStaffReqForm({ ...staffReqForm, designation: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Required Count</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={staffReqForm.count}
                    onChange={(e) => setStaffReqForm({ ...staffReqForm, count: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Urgency</label>
                  <select
                    value={staffReqForm.urgency}
                    onChange={(e) => setStaffReqForm({ ...staffReqForm, urgency: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="NORMAL">Normal Routine Need</option>
                    <option value="HIGH">High - Impacting Workload</option>
                    <option value="CRITICAL">Critical - Patient Care at Risk</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Justification / Workload Reason</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why current staffing is insufficient..."
                  value={staffReqForm.reason}
                  onChange={(e) => setStaffReqForm({ ...staffReqForm, reason: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Qualifications / Experience Required</label>
                <input
                  type="text"
                  placeholder="e.g. B.Sc Nursing with 2+ years ICU experience"
                  value={staffReqForm.qualifications_needed}
                  onChange={(e) => setStaffReqForm({ ...staffReqForm, qualifications_needed: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsStaffReqModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl"
                >
                  Submit Requisition to HR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Operational Issue Modal */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Report Departmental Operational Issue</h3>
              <button onClick={() => setIsIssueModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleIssueSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Issue Type</label>
                  <select
                    value={issueForm.issue_type}
                    onChange={(e) => setIssueForm({ ...issueForm, issue_type: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="EQUIPMENT_FAILURE">Medical Device Breakdown</option>
                    <option value="STAFFING_SHORTAGE">Critical Staffing Shortage</option>
                    <option value="CONSUMABLE_OUT_OF_STOCK">Consumable Depleted</option>
                    <option value="PATIENT_OVERFLOW">Emergency Surge / Overflow</option>
                    <option value="FACILITY_ISSUE">Facility / Power / HVAC Fault</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Severity</label>
                  <select
                    value={issueForm.severity}
                    onChange={(e) => setIssueForm({ ...issueForm, severity: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="LOW">Low - Advisory</option>
                    <option value="MEDIUM">Medium - Impairing Flow</option>
                    <option value="HIGH">High - Urgent Intervention</option>
                    <option value="CRITICAL">Critical - Life/Safety Threat</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Issue Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Echo Probe Signal Failure in Room 101"
                  value={issueForm.title}
                  onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Detailed Description & Impact</label>
                <textarea
                  required
                  rows={3}
                  value={issueForm.description}
                  onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl"
                >
                  Log Operational Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Recommendation Modal */}
      {selectedLeaveToRecommend && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Recommend Staff Leave & Coverage</h3>
              <button onClick={() => setSelectedLeaveToRecommend(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRecommendSubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300">
                <div>Applicant: <strong className="text-white">{selectedLeaveToRecommend.staff_name}</strong></div>
                <div>Dates: <span className="font-mono text-cyan-400">{selectedLeaveToRecommend.start_date} to {selectedLeaveToRecommend.end_date}</span> ({selectedLeaveToRecommend.total_days} days)</div>
                <div>Reason: <span className="text-slate-400">{selectedLeaveToRecommend.reason}</span></div>
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">HOD Recommendation</label>
                <select
                  value={recommendationForm.recommendation}
                  onChange={(e) => setRecommendationForm({ ...recommendationForm, recommendation: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="RECOMMENDED_APPROVAL">Recommend Approval (Staffing Coverage Arranged)</option>
                  <option value="RECOMMENDED_REJECTION">Recommend Rejection (Critical Shift Shortage)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Proposed Replacement / Coverage Staff</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Ramesh / Sister Kavitha"
                  value={recommendationForm.replacement_staff}
                  onChange={(e) => setRecommendationForm({ ...recommendationForm, replacement_staff: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Departmental Remarks for HR</label>
                <textarea
                  rows={3}
                  placeholder="Add notes on operational coverage or patient safety..."
                  value={recommendationForm.remarks}
                  onChange={(e) => setRecommendationForm({ ...recommendationForm, remarks: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLeaveToRecommend(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl"
                >
                  Submit Recommendation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Shift to Doctor / Staff Modal */}
      {isAssignShiftModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Assign Shift to Clinician</h3>
                  <p className="text-[11px] text-slate-400">Deploy doctor or nurse to 24/7 duty roster</p>
                </div>
              </div>
              <button onClick={() => setIsAssignShiftModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAssignShiftSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Select Clinician / Staff Member</label>
                <select
                  required
                  value={shiftAssignForm.staff_id}
                  onChange={(e) => setShiftAssignForm({ ...shiftAssignForm, staff_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Choose Doctor or Staff Member --</option>
                  {(data?.staff_roster || []).map((stf: any) => (
                    <option key={stf.id} value={stf.id}>
                      {stf.name} ({stf.designation} • {stf.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Shift Schedule</label>
                  <select
                    required
                    value={shiftAssignForm.shift_id}
                    onChange={(e) => setShiftAssignForm({ ...shiftAssignForm, shift_id: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Choose Shift --</option>
                    {(data?.shifts || []).map((sh: any) => (
                      <option key={sh.id} value={sh.id}>
                        {sh.name} ({sh.start_time} - {sh.end_time})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Duty Date</label>
                  <input
                    type="date"
                    required
                    value={shiftAssignForm.roster_date}
                    onChange={(e) => setShiftAssignForm({ ...shiftAssignForm, roster_date: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Assigned Station / Room / Chamber</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OPD Chamber 101, Cath Lab, CCU Ward"
                  value={shiftAssignForm.station}
                  onChange={(e) => setShiftAssignForm({ ...shiftAssignForm, station: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Duty Responsibilities / Instructions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Morning OPD consultations, emergency on-call rounds"
                  value={shiftAssignForm.notes}
                  onChange={(e) => setShiftAssignForm({ ...shiftAssignForm, notes: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAssignShiftModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Publish Duty Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Swap Modal */}
      {isSwapModalOpen && selectedRosterToSwap && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Exchange / Swap Shift Assignment</h3>
                  <p className="text-[11px] text-slate-400">Reassign duty to another available department colleague</p>
                </div>
              </div>
              <button onClick={() => setIsSwapModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSwapSubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 space-y-1">
                <div>Currently Assigned: <strong className="text-white">{selectedRosterToSwap.staff_name}</strong></div>
                <div>Date & Shift: <span className="font-mono text-cyan-400">{selectedRosterToSwap.roster_date} • {selectedRosterToSwap.shift_name}</span></div>
                <div>Station: <span className="text-amber-300 font-medium">{selectedRosterToSwap.notes}</span></div>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Select Replacement Colleague</label>
                <select
                  required
                  value={swapWithStaffId}
                  onChange={(e) => setSwapWithStaffId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Choose Replacement Doctor / Staff --</option>
                  {(data?.staff_roster || [])
                    .filter((s: any) => s.id !== selectedRosterToSwap.staff_id)
                    .map((stf: any) => (
                      <option key={stf.id} value={stf.id}>
                        {stf.name} ({stf.designation} • {stf.employee_id})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Swap Agreement / Operational Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Mutual duty swap approved for clinical coverage"
                  value={swapNotes}
                  onChange={(e) => setSwapNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSwapModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-4 h-4" /> Confirm Shift Swap
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Discrepancy Modal */}
      {isDiscrepancyModalOpen && selectedAttendanceToFlag && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Flag Attendance Discrepancy</h3>
                  <p className="text-[11px] text-slate-400">Escalate attendance or unnotified absence to HR</p>
                </div>
              </div>
              <button onClick={() => setIsDiscrepancyModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFlagDiscrepancySubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 space-y-1">
                <div>Staff: <strong className="text-white">{selectedAttendanceToFlag.name}</strong> ({selectedAttendanceToFlag.employee_id})</div>
                <div>Role: <span className="text-slate-300">{selectedAttendanceToFlag.designation}</span></div>
                <div>Clock-In: <span className="font-mono text-cyan-400">{selectedAttendanceToFlag.clock_in}</span> | Status: <span className="font-semibold text-rose-400">{selectedAttendanceToFlag.status}</span></div>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">HOD Review Notes & Reason for Flagging</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Clinician did not report to assigned morning OPD chamber; delayed by 45 minutes without prior coverage arrangement..."
                  value={discrepancyNote}
                  onChange={(e) => setDiscrepancyNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDiscrepancyModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-4 h-4" /> Escalate Discrepancy to HR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast Notice Modal */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Broadcast Department Notice</h3>
                  <p className="text-[11px] text-slate-400">Post notice to all {deptName} clinicians and staff</p>
                </div>
              </div>
              <button onClick={() => setIsBroadcastModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBroadcastSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Notice Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cath Lab Sterile Maintenance Schedule for Friday"
                  value={broadcastForm.title}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Priority / Severity Level</label>
                <select
                  value={broadcastForm.severity}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, severity: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="INFO">Informational / General Notice</option>
                  <option value="WARNING">Operational Warning / Shift Changes</option>
                  <option value="CRITICAL">Critical Clinical Alert / Code Protocol</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Notice Details & Instructions</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide complete instructions for on-duty doctors, nursing supervisors, and technicians..."
                  value={broadcastForm.message}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Bell className="w-4 h-4" /> Broadcast Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple' | 'blue';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'cyan',
}) => {
  const colorMap = {
    cyan: 'border-cyan-500/20 text-cyan-400',
    emerald: 'border-emerald-500/20 text-emerald-400',
    amber: 'border-amber-500/20 text-amber-400',
    rose: 'border-rose-500/20 text-rose-400',
    purple: 'border-purple-500/20 text-purple-400',
    blue: 'border-blue-500/20 text-blue-400',
  };

  return (
    <div className={clsx('p-4 rounded-2xl bg-slate-900 border shadow-lg space-y-2 transition', colorMap[color])}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate max-w-[80%]">
          {title}
        </span>
        <div className="w-8 h-8 rounded-xl bg-slate-800/80 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-extrabold text-white tracking-tight">{value}</div>
      <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 truncate">{subtitle}</div>
    </div>
  );
};

export default DepartmentHeadDashboardPage;

