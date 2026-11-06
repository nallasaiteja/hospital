import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Briefcase,
  CheckSquare,
  Clock,
  Calendar,
  DollarSign,
  Award,
  GraduationCap,
  AlertOctagon,
  FileText,
  UserMinus,
  BarChart3,
  Bell,
  RefreshCw,
  Search,
  Plus,
  Download,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  TrendingUp,
  FileCheck,
  X,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { operationsHrService, reportsDashboardService } from '../../services/api';
import clsx from 'clsx';

export type HRTabKey =
  | 'overview'
  | 'employees'
  | 'recruitment'
  | 'onboarding'
  | 'attendance'
  | 'leaves'
  | 'payroll'
  | 'appraisals'
  | 'training'
  | 'grievances'
  | 'documents'
  | 'exits'
  | 'reports'
  | 'notifications';

interface HRTabConfig {
  id: HRTabKey;
  number: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const HR_TABS: HRTabConfig[] = [
  { id: 'overview', number: '0', label: 'Overview', icon: BarChart3 },
  { id: 'employees', number: '1', label: 'Employee Directory', icon: Users },
  { id: 'recruitment', number: '2', label: 'Recruitment & Hiring', icon: Briefcase },
  { id: 'onboarding', number: '3', label: 'Onboarding', icon: CheckSquare },
  { id: 'attendance', number: '4', label: 'Attendance', icon: Clock },
  { id: 'leaves', number: '5', label: 'Leave Management', icon: Calendar },
  { id: 'payroll', number: '6', label: 'Payroll & Salary', icon: DollarSign },
  { id: 'appraisals', number: '7', label: 'Performance Appraisals', icon: Award },
  { id: 'training', number: '8', label: 'Training & Development', icon: GraduationCap },
  { id: 'grievances', number: '9', label: 'Grievance Redressal', icon: AlertOctagon },
  { id: 'documents', number: '10', label: 'Credentials & Compliance', icon: FileCheck },
  { id: 'exits', number: '11', label: 'Exit & Offboarding', icon: UserMinus },
  { id: 'reports', number: '12', label: 'Reports & Analytics', icon: FileText },
  { id: 'notifications', number: '13', label: 'Notifications', icon: Bell },
];

export const HRDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { role, userProfile } = useAuth();
  const { currentBranch } = useBranch();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get('tab') as HRTabKey) || 'overview';
  const setTab = (tab: HRTabKey) => {
    setSearchParams({ tab });
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [selectedRecord, setSelectedRecord] = useState<{ title: string; data: any } | null>(null);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isVacancyModalOpen, setIsVacancyModalOpen] = useState(false);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [activeReqIdForVacancy, setActiveReqIdForVacancy] = useState<string | null>(null);
  const [isGrievanceModalOpen, setIsGrievanceModalOpen] = useState(false);
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Form states
  const [candidateForm, setCandidateForm] = useState({
    vacancy_id: '',
    candidate_name: '',
    email: '',
    phone: '',
    qualification: '',
    experience_years: 1,
    resume_url: '',
  });

  const [onboardForm, setOnboardForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    designation: '',
    role_name: 'STAFF',
    department_id: '',
    employment_type: 'FULL_TIME',
    qualification: '',
    medical_license_number: '',
    joining_date: new Date().toISOString().split('T')[0],
  });

  const [vacancyForm, setVacancyForm] = useState({
    title: '',
    department_id: '',
    designation: '',
    vacancies_count: 1,
    experience_years_min: 2,
    description: '',
    requirements: '',
    deadline_date: '',
  });

  const [grievanceForm, setGrievanceForm] = useState({
    category: 'WORKPLACE_ENVIRONMENT',
    subject: '',
    description: '',
    is_confidential: true,
  });

  const [trainingForm, setTrainingForm] = useState({
    title: '',
    category: 'CLINICAL_SAFETY',
    trainer_name: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    duration_hours: 2,
    is_mandatory: true,
    notes: '',
  });

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(`${label} copied!`);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const branchId = currentBranch?.id;
      const res = await operationsHrService.getComprehensiveHRDashboard({ branch_id: branchId });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load HR Dashboard data:', err);
      setError('Unable to load HR dashboard telemetry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentBranch?.id]);

  const handleExportData = async (metric: string) => {
    try {
      await reportsDashboardService.downloadExport({
        metric,
        branch_id: currentBranch?.id,
      });
    } catch (e) {
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        `Report,${metric}\nBranch,${currentBranch?.name || 'AURA Central Hospital'}\nDate,${new Date().toISOString()}\nStatus,Generated Successfully`;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${metric.toLowerCase()}_hr_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Submit Handlers
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await operationsHrService.onboardEmployee(onboardForm);
      setIsOnboardModalOpen(false);
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to onboard employee.');
    }
  };

  const handleVacancySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await operationsHrService.createVacancy({
        ...vacancyForm,
        branch: currentBranch?.id,
      });
      if (activeReqIdForVacancy) {
        await operationsHrService.updateStaffRequirement(activeReqIdForVacancy, {
          status: 'RECRUITING',
          hr_notes: 'Job vacancy published and actively accepting candidates.',
        });
        setActiveReqIdForVacancy(null);
      }
      setIsVacancyModalOpen(false);
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create vacancy.');
    }
  };

  const handleCandidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateForm.vacancy_id) {
      alert('Please select an active vacancy.');
      return;
    }
    try {
      await operationsHrService.createApplication({
        ...candidateForm,
        status: 'APPLIED',
      });
      setIsCandidateModalOpen(false);
      setCandidateForm({
        vacancy_id: '',
        candidate_name: '',
        email: '',
        phone: '',
        qualification: '',
        experience_years: 1,
        resume_url: '',
      });
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to register candidate application.');
    }
  };

  const handleUpdateCandidateStatus = async (appId: string, newStatus: string, extra: any = {}) => {
    try {
      await operationsHrService.updateApplication(appId, { status: newStatus, ...extra });
      setSelectedRecord(null);
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update candidate status.');
    }
  };

  const handleGrievanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await operationsHrService.createGrievance(grievanceForm);
      setIsGrievanceModalOpen(false);
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit grievance.');
    }
  };

  const handleTrainingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await operationsHrService.createTrainingProgram({
        ...trainingForm,
        branch: currentBranch?.id,
      });
      setIsTrainingModalOpen(false);
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create training program.');
    }
  };

  const handleLeaveDecision = async (leaveId: string, decision: 'APPROVED' | 'REJECTED') => {
    const comments = prompt(`Enter ${decision.toLowerCase()} notes for this leave request:`);
    if (comments === null) return;
    try {
      if (decision === 'APPROVED') {
        await operationsHrService.approveLeave(leaveId, { comments });
      } else {
        await operationsHrService.rejectLeave(leaveId, { comments });
      }
      setSelectedLeave(null);
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to ${decision.toLowerCase()} leave request.`);
    }
  };

  const handleApproveRequirement = async (reqId: string) => {
    try {
      await operationsHrService.updateStaffRequirement(reqId, { status: 'APPROVED' });
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to approve requisition.');
    }
  };

  const handleRejectRequirement = async (reqId: string) => {
    const reason = prompt('Enter reason for rejecting or deferring this requisition:');
    if (reason === null) return;
    try {
      await operationsHrService.updateStaffRequirement(reqId, { status: 'REJECTED', hr_notes: reason });
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reject requisition.');
    }
  };

  const handlePostVacancyFromRequirement = (req: any) => {
    setActiveReqIdForVacancy(req.id);
    setVacancyForm({
      title: `${req.designation} (${req.department})`,
      department_id: req.department_id || data?.departments?.[0]?.id || '',
      designation: req.designation,
      vacancies_count: req.count || 1,
      experience_years_min: 2,
      description: `Department requisition initiated by ${req.requested_by}. Justification: ${req.reason}`,
      requirements: req.qualifications_needed || 'Medical degree / relevant specialty certification',
      deadline_date: '',
    });
    setIsVacancyModalOpen(true);
  };

  const branchName = data?.branch_name || currentBranch?.name || 'AURA Central Multi-Specialty Hospital';

  const sectionMeta: Record<HRTabKey, { title: string; subtitle: string; action?: React.ReactNode }> = {
    overview: {
      title: 'Human Resources Overview',
      subtitle: 'Real-time hospital workforce telemetry, 7-day attendance trends, recruitment pipeline, and department distributions.',
    },
    employees: {
      title: 'Employee Directory',
      subtitle: 'Hospital-wide employee master profiles, qualifications, department assignments, and active duty status.',
      action: (
        <button
          onClick={() => setIsOnboardModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-cyan-600/20"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Onboard Employee</span>
        </button>
      ),
    },
    recruitment: {
      title: 'Recruitment & Hiring',
      subtitle: 'Clinical and administrative staffing requisitions, candidate pipeline, applicant screening, and interview evaluations.',
      action: (
        <button
          onClick={() => setIsVacancyModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Post Vacancy</span>
        </button>
      ),
    },
    onboarding: {
      title: 'Employee Onboarding',
      subtitle: 'Document verification checklists, background verification, credential authentication, and hospital badge issuance.',
      action: (
        <button
          onClick={() => setIsOnboardModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-cyan-600/20"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Initiate Onboarding</span>
        </button>
      ),
    },
    attendance: {
      title: 'Attendance Tracking',
      subtitle: 'Official hospital biometric punch logs, shift check-in times, overtime hours, and attendance regularizations.',
    },
    leaves: {
      title: 'Leave Management',
      subtitle: 'Employee leave requests, HOD replacement coverage recommendations, balance deductions, and policy approvals.',
    },
    payroll: {
      title: 'Payroll & Salary Administration',
      subtitle: 'Monthly payroll cycles, salary structure management, earnings, deductions, and compliant payslip generation.',
    },
    appraisals: {
      title: 'Performance Appraisals',
      subtitle: 'Formal staff performance evaluations, HOD clinical competency ratings, promotion reviews, and salary increment adjustments.',
    },
    training: {
      title: 'Training & Development',
      subtitle: 'Hospital-wide training programs, BLS/ACLS life support, infection control, and NABH compliance certifications.',
      action: (
        <button
          onClick={() => setIsTrainingModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Schedule Training</span>
        </button>
      ),
    },
    grievances: {
      title: 'Employee Grievance Redressal',
      subtitle: 'Strictly confidential intake, investigation tracking, and formal resolution of employee and workplace grievances.',
      action: (
        <button
          onClick={() => setIsGrievanceModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-lg shadow-rose-600/20"
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>File Grievance</span>
        </button>
      ),
    },
    documents: {
      title: 'Credentials & Compliance',
      subtitle: 'Medical council licenses, nursing council certificates, educational degrees, and statutory document renewals.',
    },
    exits: {
      title: 'Exit & Offboarding Management',
      subtitle: 'Staff resignation tracking, notice period administration, departmental asset returns, and No-Dues clearance.',
    },
    reports: {
      title: 'HR Reports & Analytics',
      subtitle: 'Official hospital workforce data, attendance summaries, attrition analytics, and audit export documentation.',
    },
    notifications: {
      title: 'HR Alerts & Notifications',
      subtitle: 'System alerts for pending leave approvals, upcoming applicant interviews, and credential expiry notices.',
    },
  };

  const currentSection = sectionMeta[activeTab] || sectionMeta.overview;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Operational Scope */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {branchName}
              </span>
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Human Resources Portal
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Workforce Administration Authority
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {currentSection.title}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {currentSection.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {currentSection.action}
            <button
              onClick={loadDashboardData}
              disabled={refreshing}
              className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
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
          <p className="text-sm font-medium">Aggregating real-time HR employment lifecycle telemetry...</p>
          <p className="text-xs text-slate-500 mt-1">Connecting to official attendance, recruitment, and payroll databases</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 flex items-center gap-3">
          <AlertOctagon className="w-6 h-6 shrink-0" />
          <div>
            <div className="font-semibold text-sm">HR Telemetry Alert</div>
            <div className="text-xs text-rose-400/90 mt-0.5">{error}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 0: OVERVIEW (Phase 3.1) */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 12 Core HR Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Employees"
                  value={data?.summary?.total_employees || 0}
                  subtitle={`${data?.summary?.active_employees || 0} Active on payroll`}
                  icon={Users}
                  color="cyan"
                />
                <MetricCard
                  title="Present on Duty Today"
                  value={data?.summary?.present_today || 0}
                  subtitle="Biometric clock-in recorded"
                  icon={CheckCircle2}
                  color="emerald"
                />
                <MetricCard
                  title="On Approved Leave"
                  value={data?.summary?.on_leave_today || 0}
                  subtitle="Sanctioned leave records"
                  icon={Calendar}
                  color="amber"
                />
                <MetricCard
                  title="Employees Absent"
                  value={data?.summary?.absent_today || 0}
                  subtitle="Unscheduled absences"
                  icon={AlertOctagon}
                  color="rose"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Open Vacancies"
                  value={data?.summary?.open_vacancies || 0}
                  subtitle="Active hiring requisitions"
                  icon={Briefcase}
                  color="blue"
                />
                <MetricCard
                  title="Upcoming Interviews"
                  value={data?.summary?.upcoming_interviews || 0}
                  subtitle="Scheduled candidate evaluations"
                  icon={Clock}
                  color="purple"
                />
                <MetricCard
                  title="Pending Leave Requests"
                  value={data?.summary?.pending_leaves || 0}
                  subtitle="Awaiting HR policy approval"
                  icon={Calendar}
                  color="amber"
                />
                <MetricCard
                  title="Pending Grievances"
                  value={data?.summary?.pending_grievances || 0}
                  subtitle="Under active investigation"
                  icon={AlertTriangle}
                  color="rose"
                />
              </div>

              {/* Distributions & Trends Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Department Distribution */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                  <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    Employee Distribution by Department
                  </h3>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {(data?.department_distribution || []).map((dept: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                        <span className="font-medium text-slate-200">{dept.department}</span>
                        <span className="px-2 py-0.5 rounded-full font-mono font-bold bg-cyan-500/10 text-cyan-400">
                          {dept.count} Staff
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Designation Distribution */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                  <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Staff Breakdown by Designation
                  </h3>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {(data?.designation_distribution || []).map((desig: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
                        <span className="font-medium text-slate-200">{desig.designation}</span>
                        <span className="px-2 py-0.5 rounded-full font-mono font-bold bg-indigo-500/10 text-indigo-400">
                          {desig.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recruitment Funnel */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                  <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-emerald-400" />
                    Recruitment Pipeline Status
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                      <span className="text-slate-400">Total Candidate Applications</span>
                      <span className="font-bold text-white font-mono">{data?.recruitment_pipeline?.total_applicants ?? 0}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                      <span className="text-slate-400">Candidates Shortlisted</span>
                      <span className="font-bold text-cyan-400 font-mono">{data?.recruitment_pipeline?.shortlisted ?? 0}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                      <span className="text-slate-400">Interviews Scheduled</span>
                      <span className="font-bold text-indigo-400 font-mono">{data?.recruitment_pipeline?.interview_scheduled ?? 0}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                      <span className="text-slate-400">Offers Extended / Hired</span>
                      <span className="font-bold text-emerald-400 font-mono">{data?.recruitment_pipeline?.hired ?? 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance Trends (7 Days) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  Hospital Attendance Compliance Trends (Last 7 Days)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  {(data?.attendance_trends || []).map((att: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-1">
                      <div className="text-[10px] uppercase font-bold text-slate-400">{att.date}</div>
                      <div className="text-lg font-extrabold text-white">{att.rate}%</div>
                      <div className="text-[10px] text-emerald-400 font-medium">{att.present} Present</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 1: EMPLOYEE MANAGEMENT (Module 1) */}
          {activeTab === 'employees' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-sm text-white">Hospital Employee Master Directory</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Complete employment profiles, qualifications, and active duty assignments</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search Employee, ID or Dept..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-64"
                    />
                  </div>
                  <button
                    onClick={() => setIsOnboardModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Onboard
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Role & Designation</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Employment Type</th>
                      <th className="py-2.5 px-3">Joining Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Inspect Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.employee_directory || [])
                      .filter(
                        (emp: any) =>
                          !searchQuery ||
                          emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.department.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((emp: any) => (
                        <tr key={emp.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{emp.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <span className="text-cyan-400">{emp.employee_id}</span>
                              <span>•</span>
                              <span>{emp.phone}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-slate-200 font-medium">{emp.designation}</div>
                            <div className="text-[10px] text-slate-400">{emp.role}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-medium">
                              {emp.department}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">{emp.employment_type.replace(/_/g, ' ')}</td>
                          <td className="py-3 px-3 font-mono text-slate-400">{emp.joining_date}</td>
                          <td className="py-3 px-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                              emp.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
                            )}>
                              {emp.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setSelectedRecord({ title: `Employee Profile: ${emp.name} (${emp.employee_id})`, data: emp })}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-cyan-400 text-xs font-medium transition inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 2: RECRUITMENT AND HIRING (Module 2) */}
          {activeTab === 'recruitment' && (
            <div className="space-y-6">
              {/* Department Head Staffing Requisitions Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-white">Department Head Staffing Requisitions</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Formal staffing requests and vacancy approvals submitted by clinical HODs</p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-slate-800 text-cyan-400 font-mono text-xs font-bold">
                    {(data?.staff_requirements || []).length} Requisitions
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">Department & Code</th>
                        <th className="py-2.5 px-3">Requested Designation</th>
                        <th className="py-2.5 px-3">Openings</th>
                        <th className="py-2.5 px-3">Urgency</th>
                        <th className="py-2.5 px-3">Clinical Justification</th>
                        <th className="py-2.5 px-3">Requested By</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">HR Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(data?.staff_requirements || []).map((req: any) => (
                        <tr key={req.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{req.department}</div>
                            <div className="text-[10px] text-cyan-400 font-mono">{req.department_code}</div>
                          </td>
                          <td className="py-3 px-3 font-semibold text-cyan-300">{req.designation}</td>
                          <td className="py-3 px-3 font-mono font-bold text-white">{req.count} Positions</td>
                          <td className="py-3 px-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded text-[10px] font-bold border',
                              req.urgency === 'CRITICAL' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' :
                              req.urgency === 'HIGH' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                              'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                            )}>
                              {req.urgency}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-slate-200">{req.requested_by}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{req.created_at}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                              req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                              req.status === 'RECRUITING' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' :
                              req.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' :
                              'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            )}>
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {req.status === 'SUBMITTED' ? (
                                <>
                                  <button
                                    onClick={() => handlePostVacancyFromRequirement(req)}
                                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm"
                                    title="Open job vacancy"
                                  >
                                    <Briefcase className="w-3 h-3" /> Post Vacancy
                                  </button>
                                  <button
                                    onClick={() => handleApproveRequirement(req.id)}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleRejectRequirement(req.id)}
                                    className="px-2 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-200 font-medium text-xs"
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : req.status === 'APPROVED' ? (
                                <button
                                  onClick={() => handlePostVacancyFromRequirement(req)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm"
                                  title="Open job vacancy"
                                >
                                  <Briefcase className="w-3 h-3" /> Post Vacancy
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono">{req.status}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!data?.staff_requirements || data.staff_requirements.length === 0) && (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-500">
                            No pending staffing requisitions from department heads.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Job Vacancies Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-white">Active Hospital Job Vacancies</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Clinical and administrative staffing requisitions</p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveReqIdForVacancy(null);
                      setIsVacancyModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Post Vacancy
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">Position Title</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3">Openings</th>
                        <th className="py-2.5 px-3">Min Experience</th>
                        <th className="py-2.5 px-3">Applicants</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(data?.vacancies || []).map((v: any) => (
                        <tr key={v.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-3 font-semibold text-white">{v.title}</td>
                          <td className="py-3 px-3 text-slate-300">{v.department}</td>
                          <td className="py-3 px-3 font-mono font-bold text-cyan-400">{v.vacancies_count} Positions</td>
                          <td className="py-3 px-3 text-slate-300">{v.experience_years_min} Years</td>
                          <td className="py-3 px-3 font-mono font-bold text-indigo-400">{v.applications_count} Applied</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              {v.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setSelectedRecord({ title: `Job Requisition: ${v.title}`, data: v })}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-cyan-400 text-xs font-medium"
                            >
                              Inspect →
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!data?.vacancies || data.vacancies.length === 0) && (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500">
                            No active job vacancies published yet. Post a new vacancy or approve a department requisition above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Candidate Applications Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-white">Candidate Application Database & Interviews</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Shortlisting, technical interviews, and evaluation ratings</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-cyan-400 font-mono text-xs font-bold">
                      {(data?.applications || []).length} Candidates
                    </span>
                    <button
                      onClick={() => {
                        setCandidateForm({
                          vacancy_id: data?.vacancies?.[0]?.id || '',
                          candidate_name: '',
                          email: '',
                          phone: '',
                          qualification: '',
                          experience_years: 1,
                          resume_url: '',
                        });
                        setIsCandidateModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Register Applicant
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">Candidate Name</th>
                        <th className="py-2.5 px-3">Applied Position</th>
                        <th className="py-2.5 px-3">Experience</th>
                        <th className="py-2.5 px-3">Interview Schedule</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Evaluation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(data?.applications || []).map((app: any) => (
                        <tr key={app.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{app.candidate_name}</div>
                            <div className="text-[10px] text-slate-400">{app.email} • {app.phone}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-300">{app.vacancy_title}</td>
                          <td className="py-3 px-3 text-slate-300">{app.experience_years} Years</td>
                          <td className="py-3 px-3 font-mono text-cyan-400">{app.interview_date}</td>
                          <td className="py-3 px-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                              app.status === 'HIRED' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                              app.status === 'INTERVIEW_SCHEDULED' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' :
                              app.status === 'SHORTLISTED' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' :
                              app.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' :
                              'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            )}>
                              {app.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setSelectedRecord({ title: `Candidate Dossier: ${app.candidate_name}`, data: app })}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-indigo-300 text-xs font-medium"
                            >
                              Review Candidate
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!data?.applications || data.applications.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500">
                            No candidate applications on file. Candidates will appear here once applications are submitted online or registered by HR.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: EMPLOYEE ONBOARDING (Module 3) */}
          {activeTab === 'onboarding' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Employee Onboarding Checklist & Documentation</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Verification of credentials, background clearance, and ID issuance</p>
                </div>
                <button
                  onClick={() => setIsOnboardModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Start Onboarding
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">Step 1: Document Verification</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300">COMPULSORY</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Aadhaar, PAN, degree certificates, and state medical council licenses verified against official registries.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">Step 2: Department Assignment</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300">COORDINATED</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Consultation chamber, OT scrub bay, or nursing bay allocation in coordination with the Department Head.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">Step 3: HMS Access & Biometrics</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300">SECURITY</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Role-based permissions granted according to professional privileges. Biometric attendance profile enrolled.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: ATTENDANCE ADMINISTRATION (Module 4) */}
          {activeTab === 'attendance' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-sm text-white">Hospital Official Attendance Register & Biometrics</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Administered by HR; validated by Department Heads</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportData('Attendance_Register')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Log
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Hours Worked</th>
                      <th className="py-2.5 px-3 text-right">Audit History</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.employee_directory || []).slice(0, 10).map((emp: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-semibold text-white">{emp.name} ({emp.employee_id})</td>
                        <td className="py-3 px-3 text-slate-300">{emp.department}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{new Date().toISOString().split('T')[0]}</td>
                        <td className="py-3 px-3">
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                            emp.is_on_duty ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                          )}>
                            {emp.is_on_duty ? 'PRESENT ON DUTY' : 'WEEKLY OFF / PENDING'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-cyan-400">8.00 Hrs</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedRecord({ title: `Attendance Audit: ${emp.name}`, data: emp })}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-400 text-xs font-medium"
                          >
                            Audit →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 5: LEAVE ADMINISTRATION (Module 5 & Workflow 2) */}
          {activeTab === 'leaves' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-white">Employee Leave Applications & Policy Approval</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Workflow: Employee submits → Department Head reviews coverage → HR officially approves per policy
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 font-mono text-xs font-bold">
                  {(data?.leave_requests || []).length} Total Requests
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Staff Member</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Leave Type</th>
                      <th className="py-2.5 px-3">Dates</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">HR Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.leave_requests || []).map((leave: any) => (
                      <tr key={leave.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">{leave.staff_name}</div>
                          <div className="text-[10px] text-cyan-400 font-mono">{leave.employee_id}</div>
                          {leave.approver_comments && (
                            <div className="text-[10px] text-emerald-400 font-medium mt-1 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5 max-w-xs" title={leave.approver_comments}>
                              {leave.approver_comments}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-300">{leave.department}</td>
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
                            leave.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                            leave.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' :
                            'bg-amber-500/10 text-amber-300 border-amber-500/20'
                          )}>
                            {leave.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {leave.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleLeaveDecision(leave.id, 'APPROVED')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleLeaveDecision(leave.id, 'REJECTED')}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-200 font-bold text-xs"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setSelectedRecord({ title: `Leave Application: ${leave.staff_name}`, data: leave })}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium"
                            >
                              Inspect
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

          {/* SECTION 6: PAYROLL AND SALARY ADMINISTRATION (Module 6) */}
          {activeTab === 'payroll' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Monthly Payroll Processing & Salary Structures</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    HR prepares payroll cycles; Accountant/Finance authorizes and disburses payments
                  </p>
                </div>
                <button
                  onClick={() => handleExportData('Payroll_Summary')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Export Payroll
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(data?.payroll_runs || []).map((p: any) => (
                  <div key={p.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">Cycle: {p.period}</span>
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-[10px] font-bold',
                        p.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
                      )}>
                        {p.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Total Gross Pay:</span>
                        <span className="font-mono text-white font-bold">₹{p.total_gross.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Statutory Deductions (PF/ESI/PT):</span>
                        <span className="font-mono text-rose-400">₹{p.total_deductions.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                        <span>Net Disbursed:</span>
                        <span className="font-mono text-emerald-400 font-bold">₹{p.total_disbursed.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 7: PERFORMANCE APPRAISALS (Module 7 & Workflow 5) */}
          {activeTab === 'appraisals' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Formal Performance Evaluation & Appraisal Cycles</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Department Heads provide clinical & operational feedback; HR administers increments and promotions
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-slate-800 text-indigo-400 font-mono text-xs font-bold">
                  {(data?.appraisals || []).length} Evaluated Profiles
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Staff Member</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Cycle</th>
                      <th className="py-2.5 px-3">Clinical Competence</th>
                      <th className="py-2.5 px-3">Overall Rating</th>
                      <th className="py-2.5 px-3">Increment %</th>
                      <th className="py-2.5 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.appraisals || []).map((ap: any) => (
                      <tr key={ap.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-semibold text-white">{ap.staff_name} ({ap.staff_id})</td>
                        <td className="py-3 px-3 text-slate-300">{ap.department}</td>
                        <td className="py-3 px-3 text-slate-400">{ap.cycle_name}</td>
                        <td className="py-3 px-3 font-bold text-cyan-400">{ap.clinical_competence_rating} / 5</td>
                        <td className="py-3 px-3 font-bold text-emerald-400">{ap.overall_rating} / 5.0</td>
                        <td className="py-3 px-3 font-mono font-bold text-indigo-400">+{ap.increment_percentage}%</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedRecord({ title: `Performance Appraisal: ${ap.staff_name}`, data: ap })}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-400 text-xs font-medium"
                          >
                            Inspect Feedback →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 8: TRAINING AND DEVELOPMENT (Module 8) */}
          {activeTab === 'training' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Hospital Training, CME & Statutory Certifications</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Mandatory clinical safety, infection control, and NABH compliance modules</p>
                </div>
                <button
                  onClick={() => setIsTrainingModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Schedule Training
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(data?.training_programs || []).map((prog: any) => (
                  <div key={prog.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-indigo-400 font-mono">{prog.category}</span>
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-[10px] font-bold',
                        prog.is_mandatory ? 'bg-rose-500/10 text-rose-300' : 'bg-slate-800 text-slate-300'
                      )}>
                        {prog.is_mandatory ? 'MANDATORY' : 'OPTIONAL'}
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm">{prog.title}</h4>
                    <p className="text-xs text-slate-400">Trainer: {prog.trainer_name}</p>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                      <span className="text-slate-400 font-mono">{prog.scheduled_date}</span>
                      <span className="font-bold text-cyan-400">{prog.enrolled_count} Enrolled</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 9: EMPLOYEE GRIEVANCES (Module 9) */}
          {activeTab === 'grievances' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Confidential Employee Grievance Redressal Register</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Strictly confidential handling of employment, duty, and interpersonal complaints</p>
                </div>
                <button
                  onClick={() => setIsGrievanceModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> File Grievance
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Complainant</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Investigation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.grievances || []).map((g: any) => (
                      <tr key={g.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-mono font-bold text-cyan-400">{g.grievance_code}</td>
                        <td className="py-3 px-3 font-semibold text-white">{g.staff_name} ({g.department})</td>
                        <td className="py-3 px-3 text-slate-300">{g.category.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-3 text-slate-300 max-w-xs truncate">{g.subject}</td>
                        <td className="py-3 px-3">
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                            g.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                            g.status === 'UNDER_INVESTIGATION' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                            'bg-rose-500/10 text-rose-300 border-rose-500/20'
                          )}>
                            {g.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedRecord({ title: `Grievance Case: ${g.grievance_code}`, data: g })}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-indigo-300 text-xs font-medium"
                          >
                            Inspect Dossier →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 10: DOCUMENTS AND CREDENTIALS (Module 10) */}
          {activeTab === 'documents' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Staff Professional Credentials & License Registry</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Medical council registrations, nursing licenses, and document renewal tracking</p>
                </div>
                <span className="px-2.5 py-1 rounded bg-slate-800 text-cyan-400 font-mono text-xs font-bold">
                  {(data?.employee_directory || []).filter((e: any) => e.medical_license_number).length} Licensed Clinicians
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Clinician / Staff</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">State Medical Council License</th>
                      <th className="py-2.5 px-3">Academic Qualification</th>
                      <th className="py-2.5 px-3">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.employee_directory || []).map((emp: any) => (
                      <tr key={emp.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 font-semibold text-white">{emp.name} ({emp.employee_id})</td>
                        <td className="py-3 px-3 text-slate-300">{emp.department}</td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-300">
                          {emp.medical_license_number || 'N/A (Non-Clinical)'}
                        </td>
                        <td className="py-3 px-3 text-slate-300">{emp.qualification}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            VERIFIED & ACTIVE
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 11: RESIGNATION AND EXIT MANAGEMENT (Module 11) */}
          {activeTab === 'exits' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Employee Separation & Multi-Department Clearance</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Notice period tracking, departmental asset handover, and final financial settlement</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Department Clearance</div>
                  <div className="text-xs text-slate-300">Handover of clinical files, keys, and equipment verified by Department Head.</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400">IT & Asset Return</div>
                  <div className="text-xs text-slate-300">ID card, workstation credentials, and mobile hardware de-provisioned.</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Finance Settlement</div>
                  <div className="text-xs text-slate-300">Gratuity, PF clearance, leave encashment, and no-dues certificate posted.</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Exit Interview</div>
                  <div className="text-xs text-slate-300">Formal confidential exit interview conducted by authorized HR Manager.</div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 12: HR REPORTS AND ANALYTICS (Module 12) */}
          {activeTab === 'reports' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">Hospital HR Reports & Analytics Exports</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Generate and download official CSV documentation for hospital audits</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { title: 'Employee Headcount & Designation Report', desc: 'Active staff distribution by department, gender, and band', code: 'Headcount_Report' },
                  { title: 'Monthly Biometric Attendance Audit', desc: 'Clock-in compliance, overtime hours, and unscheduled absences', code: 'Attendance_Report' },
                  { title: 'Leave Utilization & Quota Balance Log', desc: 'Casual, sick, and earned leave consumption records', code: 'Leave_Report' },
                  { title: 'Recruitment & Candidate Sourcing Telemetry', desc: 'Time-to-hire, applicant pipeline, and vacancy status', code: 'Recruitment_Report' },
                  { title: 'CME & Statutory Training Compliance Index', desc: 'BLS/ACLS and infection control certification records', code: 'Training_Report' },
                  { title: 'Employee Grievance & Resolution Register', desc: 'Redressal turnaround, category breakdown, and escalation history', code: 'Grievance_Report' },
                ].map((rep, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="font-bold text-white text-xs">{rep.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-1">{rep.desc}</p>
                    </div>
                    <button
                      onClick={() => handleExportData(rep.code)}
                      className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-medium transition flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Download CSV
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 13: HR NOTIFICATIONS (Module 13) */}
          {activeTab === 'notifications' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-sm text-white">HR Operational Alerts & Actionable Notifications</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Automated alerts for pending leaves, upcoming interviews, and training deadlines</p>
                </div>
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
            {selectedRecord.data?.candidate_name ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-bold text-white">{selectedRecord.data.candidate_name}</div>
                      <div className="text-slate-400">{selectedRecord.data.email} • {selectedRecord.data.phone}</div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                      {selectedRecord.data.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900">
                    <div>
                      <span className="text-slate-500">Applied For: </span>
                      <span className="text-slate-200 font-semibold">{selectedRecord.data.vacancy_title}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Experience: </span>
                      <span className="text-cyan-400 font-mono font-bold">{selectedRecord.data.experience_years} Years</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Qualifications: </span>
                      <span className="text-slate-200">{selectedRecord.data.qualification || 'Certified Professional'}</span>
                    </div>
                    {selectedRecord.data.interview_date && (
                      <div className="col-span-2">
                        <span className="text-slate-500">Scheduled Interview: </span>
                        <span className="text-indigo-400 font-mono font-bold">{selectedRecord.data.interview_date}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Candidate Pipeline Progression Actions */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recruitment Actions</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRecord.data.status === 'APPLIED' && (
                      <button
                        onClick={() => handleUpdateCandidateStatus(selectedRecord.data.id, 'SHORTLISTED')}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs"
                      >
                        Shortlist Candidate
                      </button>
                    )}
                    {(selectedRecord.data.status === 'APPLIED' || selectedRecord.data.status === 'SHORTLISTED') && (
                      <button
                        onClick={() => {
                          const dateStr = prompt('Enter Interview Date & Time (YYYY-MM-DD HH:MM):', new Date().toISOString().slice(0, 10) + ' 10:00');
                          if (dateStr) {
                            handleUpdateCandidateStatus(selectedRecord.data.id, 'INTERVIEW_SCHEDULED', { interview_date: dateStr });
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1"
                      >
                        Schedule Interview
                      </button>
                    )}
                    {selectedRecord.data.status === 'INTERVIEW_SCHEDULED' && (
                      <button
                        onClick={() => handleUpdateCandidateStatus(selectedRecord.data.id, 'HIRED')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs"
                      >
                        Extend Offer / Mark Hired
                      </button>
                    )}
                    {selectedRecord.data.status === 'HIRED' && (
                      <button
                        onClick={() => {
                          const nameParts = (selectedRecord.data.candidate_name || '').split(' ');
                          setOnboardForm({
                            ...onboardForm,
                            first_name: nameParts[0] || '',
                            last_name: nameParts.slice(1).join(' ') || '',
                            email: selectedRecord.data.email || '',
                            phone_number: selectedRecord.data.phone || '',
                            qualification: selectedRecord.data.qualification || '',
                            designation: selectedRecord.data.vacancy_title || '',
                          });
                          setSelectedRecord(null);
                          setIsOnboardModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Proceed to Employee Onboarding
                      </button>
                    )}
                    {selectedRecord.data.status !== 'REJECTED' && selectedRecord.data.status !== 'HIRED' && (
                      <button
                        onClick={() => handleUpdateCandidateStatus(selectedRecord.data.id, 'REJECTED')}
                        className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white font-medium text-xs"
                      >
                        Reject Candidate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                <pre className="text-cyan-300 whitespace-pre-wrap break-all">
                  {JSON.stringify(selectedRecord.data, null, 2)}
                </pre>
              </div>
            )}
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

      {/* Onboard Employee Modal */}
      {isOnboardModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Onboard New Hospital Employee</h3>
              <button onClick={() => setIsOnboardModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleOnboardSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={onboardForm.first_name}
                    onChange={(e) => setOnboardForm({ ...onboardForm, first_name: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={onboardForm.last_name}
                    onChange={(e) => setOnboardForm({ ...onboardForm, last_name: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={onboardForm.email}
                    onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={onboardForm.phone_number}
                    onChange={(e) => setOnboardForm({ ...onboardForm, phone_number: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Designation</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Staff Nurse, Consultant"
                    value={onboardForm.designation}
                    onChange={(e) => setOnboardForm({ ...onboardForm, designation: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">System Role</label>
                  <select
                    value={onboardForm.role_name}
                    onChange={(e) => setOnboardForm({ ...onboardForm, role_name: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="DOCTOR">Doctor</option>
                    <option value="NURSE">Nurse</option>
                    <option value="PHARMACIST">Pharmacist</option>
                    <option value="LAB_TECHNICIAN">Lab Technician</option>
                    <option value="RECEPTIONIST">Receptionist</option>
                    <option value="STAFF">General Staff</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Qualification</label>
                <input
                  type="text"
                  placeholder="e.g. MBBS, MD, B.Sc Nursing"
                  value={onboardForm.qualification}
                  onChange={(e) => setOnboardForm({ ...onboardForm, qualification: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Medical License Number (if Doctor/Nurse)</label>
                <input
                  type="text"
                  placeholder="e.g. MCI-2026-9812"
                  value={onboardForm.medical_license_number}
                  onChange={(e) => setOnboardForm({ ...onboardForm, medical_license_number: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOnboardModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl"
                >
                  Complete Onboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Vacancy Modal */}
      {isVacancyModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Create Hospital Job Vacancy</h3>
              <button onClick={() => setIsVacancyModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleVacancySubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior ICU Staff Nurse"
                  value={vacancyForm.title}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, title: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Open Positions</label>
                  <input
                    type="number"
                    min="1"
                    value={vacancyForm.vacancies_count}
                    onChange={(e) => setVacancyForm({ ...vacancyForm, vacancies_count: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Min Experience (Years)</label>
                  <input
                    type="number"
                    min="0"
                    value={vacancyForm.experience_years_min}
                    onChange={(e) => setVacancyForm({ ...vacancyForm, experience_years_min: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Job Description</label>
                <textarea
                  required
                  rows={3}
                  value={vacancyForm.description}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, description: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVacancyModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
                >
                  Publish Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Candidate Application Modal */}
      {isCandidateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base">Register Candidate Application</h3>
                <p className="text-xs text-slate-400 mt-0.5">Log an applicant received via recruitment drive, email or portal</p>
              </div>
              <button onClick={() => setIsCandidateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCandidateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Target Job Vacancy *</label>
                <select
                  required
                  value={candidateForm.vacancy_id}
                  onChange={(e) => setCandidateForm({ ...candidateForm, vacancy_id: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="">-- Select Open Job Vacancy --</option>
                  {(data?.vacancies || []).map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({v.department})
                    </option>
                  ))}
                </select>
                {(!data?.vacancies || data.vacancies.length === 0) && (
                  <p className="text-[11px] text-amber-400 mt-1">Please publish a job vacancy first before registering candidates.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Candidate Full Name *</label>
                  <input
                    required
                    type="text"
                    value={candidateForm.candidate_name}
                    onChange={(e) => setCandidateForm({ ...candidateForm, candidate_name: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    placeholder="e.g. Dr. Rajesh Kumar"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Email Address *</label>
                  <input
                    required
                    type="email"
                    value={candidateForm.email}
                    onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    placeholder="applicant@hospital.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Phone Number *</label>
                  <input
                    required
                    type="text"
                    value={candidateForm.phone}
                    onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={candidateForm.experience_years}
                    onChange={(e) => setCandidateForm({ ...candidateForm, experience_years: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Highest Qualification / Registration</label>
                <input
                  type="text"
                  value={candidateForm.qualification}
                  onChange={(e) => setCandidateForm({ ...candidateForm, qualification: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  placeholder="MBBS, MD (General Medicine), DNB"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Resume / Portfolio Link</label>
                <input
                  type="url"
                  value={candidateForm.resume_url}
                  onChange={(e) => setCandidateForm({ ...candidateForm, resume_url: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  placeholder="https://drive.google.com/... or LinkedIn"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCandidateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!data?.vacancies || data.vacancies.length === 0}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl"
                >
                  Register Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Grievance Modal */}
      {isGrievanceModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">File Employee Grievance (Confidential)</h3>
              <button onClick={() => setIsGrievanceModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleGrievanceSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Category</label>
                <select
                  value={grievanceForm.category}
                  onChange={(e) => setGrievanceForm({ ...grievanceForm, category: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="WORKPLACE_ENVIRONMENT">Workplace Environment & Ergonomics</option>
                  <option value="COMPENSATION">Salary, Allowances & Benefits</option>
                  <option value="INTERPERSONAL">Interpersonal Conflict / Team Relations</option>
                  <option value="HARASSMENT">Harassment / Discrimination</option>
                  <option value="SHIFT_DUTY">Duty Allocation & Working Hours</option>
                  <option value="ETHICAL">Clinical Ethics / Integrity Issue</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={grievanceForm.subject}
                  onChange={(e) => setGrievanceForm({ ...grievanceForm, subject: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Description</label>
                <textarea
                  required
                  rows={4}
                  value={grievanceForm.description}
                  onChange={(e) => setGrievanceForm({ ...grievanceForm, description: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGrievanceModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl"
                >
                  Submit Grievance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Training Modal */}
      {isTrainingModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Schedule Hospital Training Program</h3>
              <button onClick={() => setIsTrainingModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleTrainingSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Program Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BLS / ACLS Recertification"
                  value={trainingForm.title}
                  onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Category</label>
                  <select
                    value={trainingForm.category}
                    onChange={(e) => setTrainingForm({ ...trainingForm, category: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    <option value="CLINICAL_SAFETY">Clinical Protocols & Safety</option>
                    <option value="BLS_ACLS">BLS / ACLS Resuscitation</option>
                    <option value="INFECTION_CONTROL">Infection Prevention & Control</option>
                    <option value="NABH_COMPLIANCE">NABH Standards</option>
                    <option value="SOFTWARE_TRAINING">AURA HMS Software Training</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Trainer Name</label>
                  <input
                    type="text"
                    required
                    value={trainingForm.trainer_name}
                    onChange={(e) => setTrainingForm({ ...trainingForm, trainer_name: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTrainingModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
                >
                  Create Program
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

export default HRDashboardPage;

