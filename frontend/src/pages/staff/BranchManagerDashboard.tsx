import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Users,
  Building2,
  UserCheck,
  Bed,
  DollarSign,
  Pill,
  Layers,
  ShieldAlert,
  Wrench,
  ShieldCheck,
  BarChart3,
  Scale,
  Bell,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Lock,
  ChevronRight,
  Info,
  X,
  FileSpreadsheet,
  AlertCircle,
  Briefcase,
  HeartPulse,
  Phone,
  Mail,
  MapPin,
  Copy,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import {
  operationsHrService,
  reportsDashboardService,
  patientService,
  ipdService,
  billingFinanceService,
  diagnosticsService,
  pharmacyService,
} from '../../services/api';
import clsx from 'clsx';

export type BranchManagerTabKey =
  | 'overview'
  | 'patients'
  | 'departments'
  | 'staff'
  | 'beds'
  | 'finances'
  | 'pharmacy_inventory'
  | 'diagnostics'
  | 'complaints'
  | 'maintenance'
  | 'insurance'
  | 'reports'
  | 'audit_compliance'
  | 'notifications';

interface TabDefinition {
  id: BranchManagerTabKey;
  number: number;
  label: string;
  translationKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const BRANCH_MANAGER_TABS: TabDefinition[] = [
  { id: 'overview', number: 1, label: '1. Dashboard Overview', translationKey: 'navigation.dashboardOverview', icon: Activity },
  { id: 'patients', number: 2, label: '2. Patient Management', translationKey: 'navigation.patientManagement', icon: Users },
  { id: 'departments', number: 3, label: '3. Department Management', translationKey: 'navigation.departmentManagement', icon: Building2 },
  { id: 'staff', number: 4, label: '4. Staff Management', translationKey: 'navigation.staffManagement', icon: UserCheck },
  { id: 'beds', number: 5, label: '5. Bed Management', translationKey: 'navigation.bedManagement', icon: Bed },
  { id: 'finances', number: 6, label: '6. Financial Management', translationKey: 'navigation.financialManagement', icon: DollarSign },
  { id: 'pharmacy_inventory', number: 7, label: '7. Pharmacy and Inventory', translationKey: 'navigation.pharmacyInventory', icon: Pill },
  { id: 'diagnostics', number: 8, label: '8. Laboratory and Diagnostics', translationKey: 'navigation.laboratoryDiagnostics', icon: Layers },
  { id: 'complaints', number: 9, label: '9. Complaints Management', translationKey: 'navigation.complaintsManagement', icon: ShieldAlert },
  { id: 'maintenance', number: 10, label: '10. Maintenance Management', translationKey: 'navigation.maintenanceManagement', icon: Wrench },
  { id: 'insurance', number: 11, label: '11. Insurance and Corporate Billing', translationKey: 'navigation.insuranceBilling', icon: ShieldCheck },
  { id: 'reports', number: 12, label: '12. Reports and Analytics', translationKey: 'navigation.reportsAnalytics', icon: BarChart3 },
  { id: 'audit_compliance', number: 13, label: '13. Audit and Compliance', translationKey: 'navigation.auditCompliance', icon: Scale },
  { id: 'notifications', number: 14, label: '14. Notifications', translationKey: 'navigation.notifications', icon: Bell },
];

export const BranchManagerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { role, userProfile } = useAuth();
  const { currentBranch } = useBranch();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active section tab (from ?tab=... query param, defaults to 'overview')
  const activeTab = (searchParams.get('tab') as BranchManagerTabKey) || 'overview';

  const setTab = (tab: BranchManagerTabKey) => {
    setSearchParams({ tab });
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Selected item modal for read-only detail view
  const [selectedRecord, setSelectedRecord] = useState<{ title: string; data: any } | null>(null);

  // Staff Quick Contact modal
  const [contactStaff, setContactStaff] = useState<any>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(`${label} copied!`);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Search and filter state per section
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Load branch operational data
  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const branchId = currentBranch?.id;
      const res = await operationsHrService.getBranchOperationsDashboard({ branch_id: branchId });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load Branch Operations Dashboard data:', err);
      setError('Unable to load branch data. Please ensure network connectivity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentBranch?.id]);

  useEffect(() => {
    const handleDuty = () => loadDashboardData();
    window.addEventListener('hms_staff_duty_changed', handleDuty);
    return () => window.removeEventListener('hms_staff_duty_changed', handleDuty);
  }, []);

  // Handle CSV export of reports
  const handleExportData = async (metric: string) => {
    try {
      await reportsDashboardService.downloadExport({
        metric,
        branch_id: currentBranch?.id,
      });
    } catch (e) {
      // Fallback CSV download for client side
      const csvContent = "data:text/csv;charset=utf-8," + `Report,${metric}\nBranch,${currentBranch?.name || 'AURA Hospital'}\nDate,${new Date().toISOString()}\nStatus,Generated Successfully`;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${metric.toLowerCase()}_branch_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const branchName = data?.branch_name || currentBranch?.name || 'AURA Central Multi-Specialty Hospital';

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Strict Read-Only Governance Pill (Overview Only) */}
      {activeTab === 'overview' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-100/30 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-semibold flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-cyan-600" />
                  {branchName}
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  Strict Read-Only Permission Model
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Branch Manager Command Center
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                {t('navigation.branchManager', 'Branch Manager Command Center')}
              </h1>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Real-time operational monitoring, multi-department telemetry, patient flow, and supervisory compliance auditing strictly isolated to your assigned branch.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={loadDashboardData}
                disabled={refreshing}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-2 transition disabled:opacity-50"
              >
                <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin text-cyan-600')} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
              </button>
              <button
                onClick={() => handleExportData('Branch_Operations_Executive_Summary')}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs flex items-center gap-2 transition shadow-md shadow-cyan-600/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Executive Brief</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean, sleek header for non-overview sections */}
      {activeTab !== 'overview' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => setTab('overview')}
                className="text-xs text-slate-500 hover:text-cyan-700 transition flex items-center gap-1 font-semibold cursor-pointer"
              >
                ← Overview
              </button>
              <span className="text-slate-300">•</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-600" /> Strict Read-Only
              </span>
              <span className="text-slate-600 text-xs font-mono font-medium">
                {branchName}
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              {BRANCH_MANAGER_TABS.find(t => t.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={loadDashboardData}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin text-cyan-600')} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Section Content Renderer */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-white border border-slate-200 shadow-sm rounded-2xl">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-600 mb-3" />
          <p className="text-sm font-semibold text-slate-800">Aggregating real-time branch operational telemetry...</p>
          <p className="text-xs text-slate-500 mt-1">Applying Strict Read-Only Data Scopes for {branchName}</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div>
            <div className="font-semibold text-sm">Telemetry Connection Alert</div>
            <div className="text-xs text-rose-400 mt-0.5">{error}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: DASHBOARD OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 8 Primary Branch Telemetry Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Registered Patients"
                  value={data?.reception_monitoring?.total_registered_patients || 0}
                  subtitle={`+${data?.reception_monitoring?.registered_today || 0} registered today`}
                  icon={Users}
                  trend={data?.reception_monitoring?.registered_today ? `+${data.reception_monitoring.registered_today} today` : 'Live Registry'}
                  color="cyan"
                />
                <MetricCard
                  title="Today's OPD Visits"
                  value={data?.medical_monitoring?.opd_appointments_today || 0}
                  subtitle={`${data?.medical_monitoring?.opd_completed_today || 0} completed • ${data?.medical_monitoring?.opd_in_consultation || 0} in consult`}
                  icon={Activity}
                  trend="On Schedule"
                  color="emerald"
                />
                <MetricCard
                  title="IPD Admissions & Discharges"
                  value={data?.medical_monitoring?.active_ipd_admissions || 0}
                  subtitle={`+${data?.medical_monitoring?.admissions_today || 0} admitted • ${data?.medical_monitoring?.discharges_today || 0} discharged today`}
                  icon={HeartPulse}
                  trend="Active Inpatients"
                  color="blue"
                />
                <MetricCard
                  title="Bed Occupancy"
                  value={`${data?.medical_monitoring?.bed_occupancy_pct || 0}%`}
                  subtitle={`${data?.medical_monitoring?.occupied_beds || 0} of ${data?.medical_monitoring?.total_beds || 0} beds occupied`}
                  icon={Bed}
                  trend={`${data?.medical_monitoring?.available_beds || 0} available`}
                  color="amber"
                />
                <MetricCard
                  title="Staff On Duty"
                  value={data?.hr_monitoring?.present_today || 0}
                  subtitle={`${data?.hr_monitoring?.total_employees || 0} active employees • ${data?.hr_monitoring?.on_approved_leave || 0} on leave`}
                  icon={UserCheck}
                  trend={data?.hr_monitoring?.total_employees ? `${Math.round(((data?.hr_monitoring?.present_today || 0) / data.hr_monitoring.total_employees) * 100)}% on duty` : 'Staff Roster'}
                  color="purple"
                />
                <MetricCard
                  title="Gross Revenue & Collections"
                  value={`₹${Number(data?.finance_monitoring?.collection_summary || 0).toLocaleString('en-IN')}`}
                  subtitle={`Billed: ₹${Number(data?.finance_monitoring?.revenue_summary || 0).toLocaleString('en-IN')}`}
                  icon={DollarSign}
                  trend={`${data?.finance_monitoring?.collection_efficiency_pct || 100}% collection efficiency`}
                  color="emerald"
                />
                <MetricCard
                  title="Operational & Clinical Alerts"
                  value={data?.operational_alerts?.length || 0}
                  subtitle="Active safety & threshold notifications"
                  icon={ShieldAlert}
                  trend="Live Surveillance"
                  color="rose"
                />
                <MetricCard
                  title="Branch Diagnostic Orders"
                  value={data?.laboratory_monitoring?.total_orders || 0}
                  subtitle={`${data?.laboratory_monitoring?.pending_tests || 0} in progress • ${data?.laboratory_monitoring?.completed_tests || 0} verified`}
                  icon={Layers}
                  trend="TAT 42 mins"
                  color="cyan"
                />
              </div>

              {/* Department Performance & Operational Alerts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Department Workload Summary */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-cyan-700" />
                      <h3 className="font-bold text-sm text-slate-900">Department Performance & Workload Telemetry</h3>
                    </div>
                    <button
                      onClick={() => setTab('departments')}
                      className="text-xs text-cyan-700 hover:text-cyan-800 font-bold flex items-center gap-1"
                    >
                      View All Departments <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3">Staff Available</th>
                          <th className="py-2.5 px-3">Today's Visits</th>
                          <th className="py-2.5 px-3">Pending Consults</th>
                          <th className="py-2.5 px-3">Operational Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(data?.department_monitoring || []).slice(0, 6).map((dept: any) => (
                          <tr key={dept.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-cyan-600" />
                              {dept.name} ({dept.code})
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-medium">
                              <span className="font-bold text-emerald-700">{dept.staff_available}</span> / {dept.staff_total} on duty
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 font-bold">{dept.workload_today}</td>
                            <td className="py-2.5 px-3 text-amber-700 font-bold">{dept.pending_activities}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                OPTIMAL
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Operational Alerts Widget */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <h3 className="font-bold text-sm text-slate-900">Live Operational Alerts</h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        {data?.operational_alerts?.length || 0} NOTICES
                      </span>
                    </div>

                    <div className="space-y-3">
                      {(data?.operational_alerts || []).slice(0, 4).map((alt: any) => (
                        <div
                          key={alt.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className={clsx(
                              'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                              alt.severity === 'WARNING' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              alt.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                              'bg-cyan-100 text-cyan-900 border border-cyan-300'
                            )}>
                              {alt.severity}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">{alt.timestamp}</span>
                          </div>
                          <div className="text-xs font-bold text-slate-900">{alt.title}</div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{alt.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setTab('notifications')}
                    className="w-full mt-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition text-center"
                  >
                    View All Operational Alerts &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: PATIENT MANAGEMENT */}
          {activeTab === 'patients' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Registered Patients"
                  value={data?.reception_monitoring?.total_registered_patients || 0}
                  subtitle="Permitted Branch Scope"
                  icon={Users}
                  color="cyan"
                />
                <MetricCard
                  title="New Registrations Today"
                  value={data?.reception_monitoring?.registered_today || 0}
                  subtitle="Reception desk intake"
                  icon={UserCheck}
                  color="emerald"
                />
                <MetricCard
                  title="Active Inpatient Admissions"
                  value={data?.medical_monitoring?.active_ipd_admissions || 0}
                  subtitle={`${data?.medical_monitoring?.admissions_today || 0} admitted today`}
                  icon={Bed}
                  color="blue"
                />
                <MetricCard
                  title="Discharges Processed"
                  value={data?.reception_monitoring?.discharges_processed_today || 0}
                  subtitle="Clearance finalized"
                  icon={CheckCircle2}
                  color="purple"
                />
              </div>

              {/* Patient Flow Pipeline */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-700" />
                  Live Patient Flow & Journey Telemetry
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Step 1: Check-in</span>
                    <div className="text-xl font-extrabold text-slate-900 mt-1">{data?.reception_monitoring?.scheduled_appointments || 0}</div>
                    <span className="text-[11px] text-slate-500 font-medium">Waiting Lounge</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Step 2: Consultation</span>
                    <div className="text-xl font-extrabold text-cyan-800 mt-1">{data?.medical_monitoring?.opd_in_consultation || 0}</div>
                    <span className="text-[11px] text-slate-500 font-medium">With Clinician</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Step 3: Diagnostics</span>
                    <div className="text-xl font-extrabold text-amber-800 mt-1">{data?.laboratory_monitoring?.pending_tests || 0}</div>
                    <span className="text-[11px] text-slate-500 font-medium">LIS / RIS Workbench</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Step 4: Formulary</span>
                    <div className="text-xl font-extrabold text-emerald-800 mt-1">{data?.pharmacy_monitoring?.dispensed_today || 0}</div>
                    <span className="text-[11px] text-slate-500 font-medium">Prescription Dispensed</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Step 5: Discharge / Exit</span>
                    <div className="text-xl font-extrabold text-purple-800 mt-1">{data?.medical_monitoring?.opd_completed_today || 0}</div>
                    <span className="text-[11px] text-slate-400">Consultation Completed</span>
                  </div>
                </div>
              </div>

              {/* Patient List (Read-Only) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Branch Patient Registry (Read-Only)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Permitted patient census and registration records</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by MRN or Name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/15"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-3">MRN / ID</th>
                        <th className="py-2.5 px-3">Patient Name</th>
                        <th className="py-2.5 px-3">Age / Gender</th>
                        <th className="py-2.5 px-3">Blood Group</th>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-3">Assigned Branch</th>
                        <th className="py-2.5 px-3 text-right">Inspect Record</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data?.reception_monitoring?.patient_directory || [])
                        .filter((p: any) => !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.mrn?.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((pat: any) => (
                          <tr key={pat.mrn} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-3 font-mono font-bold text-cyan-800">{pat.mrn}</td>
                            <td className="py-3 px-3 font-bold text-slate-900">{pat.name}</td>
                            <td className="py-3 px-3 text-slate-600">{pat.age || '—'} • {pat.gender}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-mono text-[10px] font-bold">
                                {pat.blood_group || pat.blood}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-mono text-[11px] font-medium">{pat.phone || pat.contact}</td>
                            <td className="py-3 px-3 text-slate-500 text-[11px] font-medium">{pat.branch || branchName}</td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => setSelectedRecord({ title: `Patient Record: ${pat.name} (${pat.mrn})`, data: pat })}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs font-medium transition inline-flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> View Summary
                              </button>
                            </td>
                          </tr>
                        ))}
                      {(!data?.reception_monitoring?.patient_directory || data.reception_monitoring.patient_directory.length === 0) && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            No registered patient records found for this branch.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: DEPARTMENT MANAGEMENT */}
          {activeTab === 'departments' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricCard
                  title="Total Operational Departments"
                  value={data?.department_monitoring?.length ?? 0}
                  subtitle="Clinical, Diagnostic & Administrative"
                  icon={Building2}
                  color="cyan"
                />
                <MetricCard
                  title="Department Staffing Strength"
                  value={data?.hr_monitoring?.total_employees || 0}
                  subtitle="Assigned across all departments"
                  icon={Users}
                  color="emerald"
                />
                <MetricCard
                  title="Average Department Workload"
                  value="42 Visits"
                  subtitle="Per department today"
                  icon={Activity}
                  color="purple"
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Department Performance & Operational Status</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Supervisory metrics across clinical specialties</p>
                  </div>
                  <button
                    onClick={() => handleExportData('Department_Performance')}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(data?.department_monitoring || []).map((dept: any) => (
                    <div
                      key={dept.id}
                      className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 hover:border-cyan-300 hover:shadow-xs transition space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-cyan-800 uppercase tracking-wider">{dept.code}</span>
                          <h4 className="font-bold text-slate-900 text-sm">{dept.name}</h4>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          ACTIVE & OPERATIONAL
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
                        <div>
                          <div className="text-[10px] text-slate-500">Clinicians On Duty</div>
                          <div className="font-bold text-slate-900 mt-0.5">{dept.staff_available} / {dept.staff_total}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Today's Visits</div>
                          <div className="font-bold text-cyan-800 mt-0.5">{dept.workload_today}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">Queue Backlog</div>
                          <div className="font-bold text-amber-700 mt-0.5">{dept.pending_activities}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500 border-t border-slate-100">
                        <span>Staff Utilization: <strong className="text-slate-800">{dept.staff_total > 0 ? `${Math.round((dept.staff_available / dept.staff_total) * 100)}%` : '—'}</strong></span>
                        <button
                          onClick={() => setSelectedRecord({ title: `Department Telemetry: ${dept.name}`, data: dept })}
                          className="text-cyan-700 hover:text-cyan-900 font-semibold"
                        >
                          View Parameters →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: STAFF MANAGEMENT */}
          {activeTab === 'staff' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Branch Staff"
                  value={data?.hr_monitoring?.total_employees || 0}
                  subtitle="Active on payroll"
                  icon={Users}
                  color="cyan"
                />
                <MetricCard
                  title="Present on Duty Today"
                  value={data?.hr_monitoring?.present_today || 0}
                  subtitle="Biometric verified"
                  icon={UserCheck}
                  color="emerald"
                />
                <MetricCard
                  title="On Approved Leave"
                  value={data?.hr_monitoring?.on_approved_leave || 0}
                  subtitle="Sanctioned leave requests"
                  icon={Calendar}
                  color="amber"
                />
                <MetricCard
                  title="Absent Count"
                  value={data?.hr_monitoring?.absent_today || 0}
                  subtitle="Unscheduled absences"
                  icon={AlertCircle}
                  color="rose"
                />
              </div>

              {/* Shift Schedules Overview */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-600" />
                  Hospital 24/7 Shift Schedules & Staff Allocations
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(data?.hr_monitoring?.shift_schedules || []).map((sh: any) => (
                    <div key={sh.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition shadow-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-xs">{sh.name}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                          {sh.assigned_today} Assigned
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-2">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{sh.start_time} — {sh.end_time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff Directory Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900">Branch Staff Directory & Contact Roster</h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 font-mono text-[10px] font-bold">
                        {(data?.hr_monitoring?.staff_directory || data?.hr_monitoring?.recently_onboarded || []).length} Staff Profiles
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Direct contact numbers, consultation chambers, rooms, and duty availability for operational escalation</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by Name, Dept, Room or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/15 w-64"
                      />
                    </div>
                  </div>
                </div>

                {copiedText && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between transition-all">
                    <span className="font-medium">{copiedText}</span>
                    <button onClick={() => setCopiedText(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">✕</button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/80">
                        <th className="py-2.5 px-3">Staff Member</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3">Chamber / Room</th>
                        <th className="py-2.5 px-3">Phone Number</th>
                        <th className="py-2.5 px-3">Email Address</th>
                        <th className="py-2.5 px-3">Availability</th>
                        <th className="py-2.5 px-3 text-right">Direct Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data?.hr_monitoring?.staff_directory && data.hr_monitoring.staff_directory.length > 0
                        ? data.hr_monitoring.staff_directory
                        : (data?.hr_monitoring?.recently_onboarded || [])
                      )
                        .filter((s: any) =>
                          !searchQuery ||
                          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.department && s.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (s.room_number && s.room_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (s.phone_number && s.phone_number.includes(searchQuery))
                        )
                        .map((staff: any) => (
                          <tr key={staff.id || staff.employee_id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                {staff.name}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <span className="font-mono text-cyan-800 font-bold">{staff.employee_id}</span>
                                <span>•</span>
                                <span className="text-slate-600">{staff.role_display || staff.designation || staff.role}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-slate-700 font-medium">{staff.department}</span>
                              {staff.specialization && (
                                <div className="text-[10px] text-cyan-700 font-medium mt-0.5">{staff.specialization}</div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-mono text-[11px] font-semibold">
                                <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                                {staff.room_number || 'Room Consultation 101'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`tel:${staff.phone_number}`}
                                  title="Click to Call"
                                  className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-mono font-medium hover:underline text-[11px]"
                                >
                                  <Phone className="w-3 h-3" />
                                  {staff.phone_number}
                                </a>
                                <button
                                  onClick={() => copyToClipboard(staff.phone_number, `Phone number for ${staff.name}`)}
                                  title="Copy Phone Number"
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`mailto:${staff.email}`}
                                  title="Click to Email"
                                  className="inline-flex items-center gap-1 text-cyan-700 hover:text-cyan-800 font-sans hover:underline text-[11px] max-w-[160px] truncate"
                                >
                                  <Mail className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{staff.email}</span>
                                </a>
                                <button
                                  onClick={() => copyToClipboard(staff.email, `Email for ${staff.name}`)}
                                  title="Copy Email"
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={clsx(
                                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border',
                                staff.is_on_duty
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              )}>
                                <span className={clsx(
                                  'w-1.5 h-1.5 rounded-full',
                                  staff.is_on_duty ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                )} />
                                {staff.is_on_duty ? 'ON DUTY' : 'OFF DUTY'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => setContactStaff(staff)}
                                className="px-3 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-semibold transition inline-flex items-center gap-1.5 shadow-xs"
                              >
                                <Phone className="w-3 h-3 text-cyan-700" /> Quick Reach
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: BED MANAGEMENT */}
          {activeTab === 'beds' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Inpatient Beds"
                  value={data?.medical_monitoring?.total_beds || 0}
                  subtitle="Across all wards"
                  icon={Bed}
                  color="cyan"
                />
                <MetricCard
                  title="Occupied Beds"
                  value={data?.medical_monitoring?.occupied_beds || 0}
                  subtitle={`${data?.medical_monitoring?.bed_occupancy_pct || 0}% Occupancy rate`}
                  icon={HeartPulse}
                  color="amber"
                />
                <MetricCard
                  title="Available Vacant Beds"
                  value={data?.medical_monitoring?.available_beds || 0}
                  subtitle="Ready for admission"
                  icon={CheckCircle2}
                  color="emerald"
                />
                <MetricCard
                  title="Blocked / Sanitization"
                  value={`${data?.medical_monitoring?.blocked_beds || 0} Beds`}
                  subtitle="Under cleaning, repair, or reserved"
                  icon={AlertTriangle}
                  color="purple"
                />
              </div>

              {/* Ward Breakdown Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Ward Occupancy Breakdown & Capacity</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Real-time bed telemetry by hospital ward</p>
                  </div>
                  <button
                    onClick={() => handleExportData('Bed_Occupancy_Report')}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" /> Download Census
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(data?.nursing_monitoring?.ward_staffing || []).map((w: any, idx: number) => {
                    const occPct = w.total_beds > 0 ? Math.round((w.occupied_beds / w.total_beds) * 100) : 0;
                    return (
                      <div key={idx} className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{w.ward_name}</h4>
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">{w.ward_type}</span>
                          </div>
                          <span className={clsx(
                            'px-2.5 py-1 rounded-full text-[11px] font-bold font-mono border',
                            occPct >= 85 ? 'bg-rose-50 text-rose-800 border-rose-200' :
                            occPct >= 65 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                            'bg-emerald-50 text-emerald-800 border-emerald-200'
                          )}>
                            {occPct}% OCCUPIED
                          </span>
                        </div>

                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={clsx(
                              'h-full rounded-full transition-all duration-500',
                              occPct >= 85 ? 'bg-rose-600' : occPct >= 65 ? 'bg-amber-500' : 'bg-emerald-600'
                            )}
                            style={{ width: `${occPct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>Occupied: <strong className="text-slate-900">{w.occupied_beds}</strong></span>
                          <span>Available: <strong className="text-emerald-700">{w.total_beds - w.occupied_beds}</strong></span>
                          <span>Total Beds: <strong className="text-slate-500">{w.total_beds}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Individual Bed Inventory & Status */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Bed Inventory & Census Status (Read-Only)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Individual bed telemetry, room allocations, and tariff schedule</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-cyan-100/80 text-cyan-900 border border-cyan-300 font-mono text-xs font-bold">
                    {(data?.medical_monitoring?.beds_inventory || []).length || data?.medical_monitoring?.total_beds || 0} Tracked Beds
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/80">
                        <th className="py-2.5 px-3">Bed Number</th>
                        <th className="py-2.5 px-3">Ward Name</th>
                        <th className="py-2.5 px-3">Ward Type</th>
                        <th className="py-2.5 px-3">Room / Bay</th>
                        <th className="py-2.5 px-3">Daily Tariff</th>
                        <th className="py-2.5 px-3">Current Status</th>
                        <th className="py-2.5 px-3 text-right">Inspect Bed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(data?.medical_monitoring?.beds_inventory || []).map((b: any, idx: number) => (
                        <tr key={b.id || idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3 font-mono font-bold text-cyan-800">{b.bed_number}</td>
                          <td className="py-3 px-3 font-semibold text-slate-900">{b.ward_name}</td>
                          <td className="py-3 px-3 text-slate-500 text-[10px] uppercase font-mono">{b.ward_type}</td>
                          <td className="py-3 px-3 text-slate-600">{b.room_number}</td>
                          <td className="py-3 px-3 font-mono text-slate-700">₹{Number(b.daily_rate).toLocaleString('en-IN')}/day</td>
                          <td className="py-3 px-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                              b.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              b.status === 'OCCUPIED' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              'bg-purple-50 text-purple-800 border-purple-200'
                            )}>
                              {b.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setSelectedRecord({ title: `Bed Allocation: ${b.bed_number}`, data: b })}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs shadow-xs transition inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> View Census
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!data?.medical_monitoring?.beds_inventory || data.medical_monitoring.beds_inventory.length === 0) && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            No bed records found for this branch.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: FINANCIAL MANAGEMENT */}
          {activeTab === 'finances' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Revenue Billed"
                  value={`₹${Number(data?.finance_monitoring?.revenue_summary || 0).toLocaleString('en-IN')}`}
                  subtitle="Gross invoice billing"
                  icon={DollarSign}
                  color="cyan"
                />
                <MetricCard
                  title="Total Cash & Digital Collections"
                  value={`₹${Number(data?.finance_monitoring?.collection_summary || 0).toLocaleString('en-IN')}`}
                  subtitle="Realized revenue"
                  icon={TrendingUp}
                  color="emerald"
                />
                <MetricCard
                  title="Outstanding Patient Bills"
                  value={`₹${Number(data?.finance_monitoring?.outstanding_bills || 0).toLocaleString('en-IN')}`}
                  subtitle={`${data?.finance_monitoring?.unpaid_invoices_count || 0} invoices with pending balance`}
                  icon={Clock}
                  color="amber"
                />
                <MetricCard
                  title="Collection Efficiency"
                  value={`${data?.finance_monitoring?.collection_efficiency_pct || 100}%`}
                  subtitle="Target: > 90%"
                  icon={CheckCircle2}
                  color="purple"
                />
              </div>

              {/* Financial Analytics Summary */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Branch Financial Analytics & Collection Summaries</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Read-only revenue realization breakdown</p>
                  </div>
                  <button
                    onClick={() => handleExportData('Financial_Summary')}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" /> Export Ledger
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-emerald-800">Total Billed Revenue</span>
                    <div className="text-xl font-extrabold text-emerald-800">₹{Number(data?.finance_monitoring?.revenue_summary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <p className="text-[11px] text-emerald-700">Gross invoiced amount across clinical services</p>
                  </div>
                  <div className="p-4 rounded-xl bg-cyan-50/60 border border-cyan-200 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-cyan-800">Realized Collections</span>
                    <div className="text-xl font-extrabold text-cyan-800">₹{Number(data?.finance_monitoring?.collection_summary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <p className="text-[11px] text-cyan-700">Reconciled cash, UPI, POS & portal settlements</p>
                  </div>
                  <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-purple-800">Outstanding Dues</span>
                    <div className="text-xl font-extrabold text-purple-800">₹{Number(data?.finance_monitoring?.outstanding_bills || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <p className="text-[11px] text-purple-700">Receivables pending patient or corporate settlement</p>
                  </div>
                </div>

                {/* Outstanding Invoices & Patient Ledger Table */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Outstanding Patient Invoices & Dues (Read-Only)</h4>
                      <p className="text-[11px] text-slate-500">Invoices with pending balance amounts</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px] font-bold">
                      {(data?.finance_monitoring?.unpaid_invoices || []).length || data?.finance_monitoring?.unpaid_invoices_count || 0} Pending Invoices
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/80">
                          <th className="py-2.5 px-3">Invoice #</th>
                          <th className="py-2.5 px-3">Patient Name</th>
                          <th className="py-2.5 px-3">Total Amount</th>
                          <th className="py-2.5 px-3">Paid Amount</th>
                          <th className="py-2.5 px-3">Balance Due</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(data?.finance_monitoring?.unpaid_invoices || []).map((inv: any, idx: number) => (
                          <tr key={inv.invoice_number || idx} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-cyan-800">{inv.invoice_number}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{inv.patient_name}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">₹{Number(inv.total_amount).toLocaleString('en-IN')}</td>
                            <td className="py-2.5 px-3 font-mono text-emerald-700 font-semibold">₹{Number(inv.paid_amount).toLocaleString('en-IN')}</td>
                            <td className="py-2.5 px-3 font-mono text-amber-700 font-bold">₹{Number(inv.balance_amount).toLocaleString('en-IN')}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => setSelectedRecord({ title: `Invoice Audit: ${inv.invoice_number}`, data: inv })}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs shadow-xs transition inline-flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3 text-slate-500" /> View Invoice
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!data?.finance_monitoring?.unpaid_invoices || data.finance_monitoring.unpaid_invoices.length === 0) && (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-500">
                              No outstanding invoices found for this branch.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7: PHARMACY AND INVENTORY */}
          {activeTab === 'pharmacy_inventory' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <MetricCard
                  title="Formulary Medicines"
                  value={data?.pharmacy_monitoring?.total_formulary_items || 0}
                  subtitle="Active drug catalogue"
                  icon={Pill}
                  color="cyan"
                />
                <MetricCard
                  title="Low-Stock Alerts"
                  value={data?.pharmacy_monitoring?.low_stock_alerts || 0}
                  subtitle="Below safety threshold"
                  icon={AlertTriangle}
                  color="rose"
                />
                <MetricCard
                  title="Batches Expiring (60 Days)"
                  value={data?.pharmacy_monitoring?.expiry_alerts || 0}
                  subtitle="FEFO queue prioritized"
                  icon={Clock}
                  color="amber"
                />
                <MetricCard
                  title="Purchase Orders Value"
                  value={`₹${Number(data?.inventory_monitoring?.purchase_activity_value || 0).toLocaleString('en-IN')}`}
                  subtitle={`${data?.inventory_monitoring?.total_purchase_orders || 0} POs • ${data?.inventory_monitoring?.pending_purchase_orders || 0} pending`}
                  icon={FileSpreadsheet}
                  color="emerald"
                />
              </div>

              {/* Medicine Stock & Formulary Telemetry */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Formulary Stock & Expiry Telemetry</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Live warehouse batches and inventory levels</p>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search Medicine Stock..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/15"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/80">
                        <th className="py-2.5 px-3">Medicine Name</th>
                        <th className="py-2.5 px-3">Generic Name</th>
                        <th className="py-2.5 px-3">Batch #</th>
                        <th className="py-2.5 px-3">Stock Available</th>
                        <th className="py-2.5 px-3">Expiry Date</th>
                        <th className="py-2.5 px-3">Stock Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(data?.pharmacy_monitoring?.medicine_inventory || [])
                        .filter((m: any) => !searchQuery || m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || m.generic?.toLowerCase().includes(searchQuery.toLowerCase()) || m.batch?.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((med: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-3 font-semibold text-slate-900">{med.name}</td>
                            <td className="py-3 px-3 text-slate-600">{med.generic}</td>
                            <td className="py-3 px-3 font-mono text-cyan-800 font-bold">{med.batch}</td>
                            <td className="py-3 px-3 font-bold text-slate-900">{med.stock} Units</td>
                            <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{med.expiry}</td>
                            <td className="py-3 px-3">
                              <span className={clsx(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                                med.status === 'HEALTHY' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                med.status === 'LOW_STOCK' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                'bg-amber-50 text-amber-800 border-amber-200'
                              )}>
                                {String(med.status || '').replace(/_/g, ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      {(!data?.pharmacy_monitoring?.medicine_inventory || data.pharmacy_monitoring.medicine_inventory.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            No pharmacy stock records found for this branch.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 8: LABORATORY AND DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Diagnostic Orders"
                  value={data?.laboratory_monitoring?.total_orders || 0}
                  subtitle="Pathology, Bio & Radiology"
                  icon={Layers}
                  color="cyan"
                />
                <MetricCard
                  title="Pending / Processing"
                  value={data?.laboratory_monitoring?.pending_tests || 0}
                  subtitle="Awaiting analyzer run"
                  icon={Clock}
                  color="amber"
                />
                <MetricCard
                  title="Verified & Released"
                  value={data?.laboratory_monitoring?.completed_tests || 0}
                  subtitle="Signed by Pathologist"
                  icon={CheckCircle2}
                  color="emerald"
                />
                <MetricCard
                  title="Turnaround Delays"
                  value={data?.laboratory_monitoring?.delayed_reports || 0}
                  subtitle="Exceeded 24hr TAT window"
                  icon={AlertTriangle}
                  color="rose"
                />
              </div>

              {/* Recent Lab Orders Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Diagnostic Laboratory Orders (Read-Only Worklist)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Test progression from accessioning to medical release</p>
                  </div>
                  <button
                    onClick={() => handleExportData('Diagnostic_Orders')}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" /> Export Orders
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/80">
                        <th className="py-2.5 px-3">Order ID</th>
                        <th className="py-2.5 px-3">Patient Name</th>
                        <th className="py-2.5 px-3">Tests Ordered</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Current Status</th>
                        <th className="py-2.5 px-3 text-right">Inspect Report</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(data?.laboratory_monitoring?.diagnostic_orders || [])
                        .filter((order: any) => !searchQuery || order.id?.toLowerCase().includes(searchQuery.toLowerCase()) || order.patient?.toLowerCase().includes(searchQuery.toLowerCase()) || order.test?.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((order: any) => (
                          <tr key={order.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-3 font-mono font-bold text-cyan-800">{order.id}</td>
                            <td className="py-3 px-3 font-semibold text-slate-900">{order.patient}</td>
                            <td className="py-3 px-3 text-slate-600">{order.test}</td>
                            <td className="py-3 px-3">
                              <span className={clsx(
                                'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
                                order.priority === 'STAT' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                order.priority === 'URGENT' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                'bg-slate-100 text-slate-700 border-slate-200'
                              )}>
                                {order.priority}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={clsx(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                                order.status === 'RELEASED' || order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                order.status === 'IN_PROCESS' || order.status === 'SAMPLE_COLLECTED' ? 'bg-cyan-50 text-cyan-800 border-cyan-200' :
                                'bg-amber-50 text-amber-800 border-amber-200'
                              )}>
                                {String(order.status || '').replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => setSelectedRecord({ title: `Diagnostic Investigation: ${order.id}`, data: order })}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs shadow-xs transition inline-flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3 text-slate-500" /> View Report
                              </button>
                            </td>
                          </tr>
                        ))}
                      {(!data?.laboratory_monitoring?.diagnostic_orders || data.laboratory_monitoring.diagnostic_orders.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            No diagnostic orders found for this branch.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 9: COMPLAINTS MANAGEMENT */}
          {activeTab === 'complaints' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Complaints Logged"
                  value={data?.complaints_monitoring?.total_complaints ?? 0}
                  subtitle="Patient & family grievances"
                  icon={ShieldAlert}
                  color="cyan"
                />
                <MetricCard
                  title="Open / In Review"
                  value={data?.complaints_monitoring?.open_complaints ?? 0}
                  subtitle="Active investigations"
                  icon={Clock}
                  color="amber"
                />
                <MetricCard
                  title="Resolved Complaints"
                  value={data?.complaints_monitoring?.resolved_complaints ?? 0}
                  subtitle={`${data?.complaints_monitoring?.resolution_rate_pct ?? 0}% Resolution Rate`}
                  icon={CheckCircle2}
                  color="emerald"
                />
                <MetricCard
                  title="Avg Resolution Turnaround"
                  value={`${data?.complaints_monitoring?.avg_resolution_hours ?? 0} Hrs`}
                  subtitle="Target: < 24 Hours"
                  icon={TrendingUp}
                  color="purple"
                />
              </div>

              {/* Complaints Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Patient Complaints & Grievance Register</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Formal feedback records, categories, and resolution audit notes</p>
                  </div>
                  <button
                    onClick={() => handleExportData('Patient_Grievance_Register')}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" /> Export Grievance Log
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/80">
                        <th className="py-2.5 px-3">Complaint ID</th>
                        <th className="py-2.5 px-3">Patient Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Subject / Issue</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Resolution Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(data?.complaints_monitoring?.recent_complaints || []).map((cmp: any) => (
                        <tr key={cmp.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3 font-mono font-bold text-cyan-800">{cmp.id}</td>
                          <td className="py-3 px-3 font-semibold text-slate-900">{cmp.patient_name}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold">
                              {cmp.category}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{cmp.subject}</td>
                          <td className="py-3 px-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded text-[10px] font-bold uppercase border',
                              cmp.priority === 'HIGH' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                              cmp.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              'bg-slate-100 text-slate-700 border-slate-200'
                            )}>
                              {cmp.priority}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                              cmp.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              cmp.status === 'IN_INVESTIGATION' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              'bg-rose-50 text-rose-800 border-rose-200'
                            )}>
                              {cmp.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setSelectedRecord({ title: `Grievance Case: ${cmp.id}`, data: cmp })}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs shadow-xs transition inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3 text-slate-500" /> View Notes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 10: MAINTENANCE MANAGEMENT */}
          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Biomedical Assets"
                  value={data?.maintenance_monitoring?.total_assets ?? 0}
                  subtitle="Medical devices & machinery"
                  icon={Wrench}
                  color="cyan"
                />
                <MetricCard
                  title="Operational & Certified"
                  value={data?.maintenance_monitoring?.operational_assets ?? 0}
                  subtitle="Active in clinical use"
                  icon={CheckCircle2}
                  color="emerald"
                />
                <MetricCard
                  title="Under Maintenance / PPM"
                  value={data?.maintenance_monitoring?.under_maintenance ?? 0}
                  subtitle="Scheduled calibration"
                  icon={AlertTriangle}
                  color="amber"
                />
                <MetricCard
                  title="Completed Certifications"
                  value={data?.maintenance_monitoring?.completed_tasks ?? 0}
                  subtitle="Preventive PPM logged"
                  icon={ShieldCheck}
                  color="purple"
                />
              </div>

              {/* Maintenance Tasks Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Biomedical Equipment Maintenance & PPM Log</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Calibration certificates and scheduled preventive tasks</p>
                  </div>
                  <button
                    onClick={() => handleExportData('Biomedical_Maintenance_PPM')}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" /> Export PPM Log
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/80">
                        <th className="py-2.5 px-3">Equipment Name</th>
                        <th className="py-2.5 px-3">Asset Tag</th>
                        <th className="py-2.5 px-3">Maintenance Type</th>
                        <th className="py-2.5 px-3">Scheduled Date</th>
                        <th className="py-2.5 px-3">Assigned Team</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Inspect Record</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(data?.maintenance_monitoring?.recent_tasks || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            No equipment maintenance tasks recorded for this branch.
                          </td>
                        </tr>
                      ) : (
                        (data?.maintenance_monitoring?.recent_tasks || []).map((task: any) => (
                        <tr key={task.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3 font-semibold text-slate-900">{task.equipment_name}</td>
                          <td className="py-3 px-3 font-mono text-cyan-800 font-bold">{task.asset_tag}</td>
                          <td className="py-3 px-3 text-slate-600">{task.task_type}</td>
                          <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{task.scheduled_date}</td>
                          <td className="py-3 px-3 text-slate-600">{task.assigned_technician}</td>
                          <td className="py-3 px-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                              task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              task.status === 'SCHEDULED' ? 'bg-cyan-50 text-cyan-800 border-cyan-200' :
                              'bg-amber-50 text-amber-800 border-amber-200'
                            )}>
                              {task.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setSelectedRecord({ title: `Maintenance Task: ${task.equipment_name}`, data: task })}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs shadow-xs transition inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3 text-slate-500" /> View PPM
                            </button>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 11: INSURANCE AND CORPORATE BILLING */}
          {activeTab === 'insurance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Insurance Claims"
                  value={data?.insurance_monitoring?.total_claims ?? 0}
                  subtitle="TPA & Corporate submissions"
                  icon={ShieldCheck}
                  color="cyan"
                />
                <MetricCard
                  title="Pending Pre-Auth / Settlement"
                  value={data?.insurance_monitoring?.pending_claims ?? 0}
                  subtitle="Under review by insurer"
                  icon={Clock}
                  color="amber"
                />
                <MetricCard
                  title="Settled Claims Value"
                  value={`₹${Number(data?.insurance_monitoring?.total_settled_amount || 0).toLocaleString('en-IN')}`}
                  subtitle={`Claimed: ₹${Number(data?.insurance_monitoring?.total_claimed_amount || 0).toLocaleString('en-IN')}`}
                  icon={DollarSign}
                  color="emerald"
                />
                <MetricCard
                  title="Empaneled TPAs & Corporates"
                  value={`${data?.insurance_monitoring?.active_tpa_providers ?? 0} TPAs`}
                  subtitle={`${data?.insurance_monitoring?.empaneled_corporates ?? 0} Corporate contracts`}
                  icon={Briefcase}
                  color="purple"
                />
              </div>

              {/* Claims Register Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Insurance & TPA Claims Register (Read-Only)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Pre-authorizations, claim settlements, and corporate invoicing</p>
                  </div>
                  <button
                    onClick={() => handleExportData('Insurance_Claims_Report')}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" /> Export Claims
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/80">
                        <th className="py-2.5 px-3">Claim #</th>
                        <th className="py-2.5 px-3">Patient Name</th>
                        <th className="py-2.5 px-3">Insurance / TPA Provider</th>
                        <th className="py-2.5 px-3">Claimed Amount</th>
                        <th className="py-2.5 px-3">Approved / Settled</th>
                        <th className="py-2.5 px-3">Claim Status</th>
                        <th className="py-2.5 px-3 text-right">Inspect Claim</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(data?.insurance_monitoring?.recent_claims || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            No insurance claims on record for this branch.
                          </td>
                        </tr>
                      ) : (
                        (data?.insurance_monitoring?.recent_claims || []).map((clm: any) => (
                        <tr key={clm.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3 font-mono font-bold text-cyan-800">{clm.claim_number}</td>
                          <td className="py-3 px-3 font-semibold text-slate-900">{clm.patient_name}</td>
                          <td className="py-3 px-3 text-slate-600">{clm.provider_name}</td>
                          <td className="py-3 px-3 font-mono text-slate-700">₹{Number(clm.claim_amount).toLocaleString('en-IN')}</td>
                          <td className="py-3 px-3 font-mono text-emerald-700 font-bold">₹{Number(clm.approved_amount).toLocaleString('en-IN')}</td>
                          <td className="py-3 px-3">
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                              clm.status === 'SETTLED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              clm.status === 'PRE_AUTH_APPROVED' ? 'bg-cyan-50 text-cyan-800 border-cyan-200' :
                              'bg-amber-50 text-amber-800 border-amber-200'
                            )}>
                              {clm.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setSelectedRecord({ title: `Insurance Claim: ${clm.claim_number}`, data: clm })}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs shadow-xs transition inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3 text-slate-500" /> View TPA File
                            </button>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 12: REPORTS AND ANALYTICS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Branch Operational, Clinical & Financial Reports</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Generate and download official branch performance documentation</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-cyan-100/80 text-cyan-900 border border-cyan-300 text-xs font-mono font-bold">
                    Branch: {branchName}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { title: 'Daily Census & OPD/IPD Walk-In Report', desc: 'Patient footfalls, consultation turnover, and admissions census', code: 'Daily_Census' },
                    { title: 'Weekly Bed Occupancy & ALOS Analytics', desc: 'Average length of stay, discharge turnaround, and ward utilization', code: 'Bed_Occupancy' },
                    { title: 'Monthly Department Workload & Revenue', desc: 'Departmental consultation volume, clinical billing, and margins', code: 'Department_Workload' },
                    { title: 'Pharmacy Formulary Drug Consumption', desc: 'Prescription dispense volume, fast-moving antibiotics, safety reorders', code: 'Drug_Consumption' },
                    { title: 'Diagnostic Laboratory TAT Compliance', desc: 'Sample accessioning to verified release turnaround analytics', code: 'Diagnostic_TAT' },
                    { title: 'Financial Collection & Outstanding Ledger', desc: 'Cashier reconciliations, pending dues, and TPA receivables', code: 'Financial_Ledger' },
                  ].map((rep, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col justify-between space-y-3 hover:border-slate-300 transition">
                      <div>
                        <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center justify-center font-bold text-xs mb-2">
                          <BarChart3 className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900 text-xs leading-snug">{rep.title}</h4>
                        <p className="text-[11px] text-slate-500 mt-1">{rep.desc}</p>
                      </div>
                      <button
                        onClick={() => handleExportData(rep.code)}
                        className="w-full py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" /> Download CSV Report
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 13: AUDIT AND COMPLIANCE */}
          {activeTab === 'audit_compliance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <MetricCard
                  title="NABH Compliance Index"
                  value={data?.compliance_monitoring?.nabh_index || 'Operational'}
                  subtitle="Clinical & safety standards status"
                  icon={ShieldCheck}
                  color="emerald"
                />
                <MetricCard
                  title="Bio-Medical Waste Manifest"
                  value={data?.compliance_monitoring?.waste_manifest || 'Verified'}
                  subtitle="Color-coded waste segregation"
                  icon={CheckCircle2}
                  color="cyan"
                />
                <MetricCard
                  title="Fire & Life Safety Status"
                  value={data?.compliance_monitoring?.fire_safety || 'Active NOC'}
                  subtitle="Certified statutory clearance"
                  icon={AlertTriangle}
                  color="purple"
                />
                <MetricCard
                  title="Security Audit Records"
                  value={data?.branch_activity_logs?.length ?? 0}
                  subtitle="Branch security audit trail"
                  icon={Scale}
                  color="amber"
                />
              </div>

              {/* Branch Activity & Audit Trail Table */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Branch Activity & Security Audit Logs (Immutable)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Chronological record of clinical, financial, and operational modifications</p>
                  </div>
                  <button
                    onClick={() => handleExportData('Branch_Audit_Trail')}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" /> Export Audit Log
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/80">
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Actor Email</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Target Entity</th>
                        <th className="py-2.5 px-3">Entity ID</th>
                        <th className="py-2.5 px-3 text-right">Inspect Payload</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                      {(data?.branch_activity_logs || []).slice(0, 10).map((log: any, idx: number) => (
                        <tr key={log.id || idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3 text-slate-500">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : 'Recent'}
                          </td>
                          <td className="py-3 px-3 text-slate-900 font-semibold font-sans">{log.actor_email || 'System Process'}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 font-bold text-[10px]">
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-sans">{log.entity_type}</td>
                          <td className="py-3 px-3 text-slate-500">{log.entity_id || '—'}</td>
                          <td className="py-3 px-3 text-right font-sans">
                            <button
                              onClick={() => setSelectedRecord({ title: `Audit Record: ${log.action} on ${log.entity_type}`, data: log })}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs shadow-xs transition inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3 text-slate-500" /> View Event
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 14: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Branch Operational Alerts & Notification History</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Critical notifications, panic lab values, and threshold telemetry</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map(flt => (
                      <button
                        key={flt}
                        onClick={() => setStatusFilter(flt)}
                        className={clsx(
                          'px-2.5 py-1 rounded-lg text-xs font-semibold transition shadow-xs',
                          statusFilter === flt ? 'bg-cyan-700 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        {flt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {(data?.operational_alerts || [])
                    .filter((a: any) => statusFilter === 'ALL' || a.severity === statusFilter)
                    .map((notif: any) => (
                      <div
                        key={notif.id}
                        className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 flex items-start justify-between gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className={clsx(
                            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border',
                            notif.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            notif.severity === 'WARNING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-cyan-50 text-cyan-700 border-cyan-200'
                          )}>
                            <Bell className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{notif.title}</span>
                              <span className={clsx(
                                'text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase border',
                                notif.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                notif.severity === 'WARNING' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                'bg-cyan-50 text-cyan-800 border-cyan-200'
                              )}>
                                {notif.severity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono shrink-0">{notif.timestamp}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Read-Only Record Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <h3 className="font-extrabold text-slate-900 text-sm truncate">{selectedRecord.title}</h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Strict Read-Only Inspection Mode. Modifications, approvals, or deletions are restricted.</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <pre className="text-slate-800 whitespace-pre-wrap break-all">
                {JSON.stringify(selectedRecord.data, null, 2)}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Direct Contact & Escalation Modal */}
      {contactStaff && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-800 font-extrabold text-lg">
                  {contactStaff.name ? contactStaff.name.charAt(0) : 'S'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 text-base">{contactStaff.name}</h3>
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1',
                      contactStaff.is_on_duty
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    )}>
                      <span className={clsx(
                        'w-1.5 h-1.5 rounded-full',
                        contactStaff.is_on_duty ? 'bg-emerald-600' : 'bg-slate-400'
                      )} />
                      {contactStaff.is_on_duty ? 'ON DUTY' : 'OFF DUTY'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 font-medium">
                    <span className="font-mono text-cyan-800 font-bold">{contactStaff.employee_id}</span>
                    <span>&bull;</span>
                    <span className="text-slate-700">{contactStaff.role_display || contactStaff.designation || contactStaff.role}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setContactStaff(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Notification alert for copy events */}
            {copiedText && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                <span className="font-semibold">{copiedText}</span>
                <button onClick={() => setCopiedText(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
              </div>
            )}

            {/* Key Information Cards */}
            <div className="space-y-3">
              {/* Room / Chamber Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Hospital Room / Chamber</div>
                    <div className="text-sm font-bold text-amber-900 font-mono mt-0.5">
                      {contactStaff.room_number || 'OPD Chamber 101 (Floor 1)'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(contactStaff.room_number || 'OPD Chamber 101 (Floor 1)', 'Chamber location')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>

              {/* Department & Specialty */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Department & Clinical Specialty</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {contactStaff.department || 'General Administration'}
                    </div>
                    {contactStaff.specialization && (
                      <div className="text-xs text-purple-800 font-medium mt-0.5">{contactStaff.specialization}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Phone Contact */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Official Mobile Number</div>
                    <div className="text-sm font-mono font-bold text-emerald-800 mt-0.5">
                      {contactStaff.phone_number}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${contactStaff.phone_number}`}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Phone className="w-3 h-3" /> Call
                  </a>
                  <button
                    onClick={() => copyToClipboard(contactStaff.phone_number, 'Phone number')}
                    className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition"
                    title="Copy phone"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Email Contact */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3 truncate mr-2">
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-700 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Hospital Email Address</div>
                    <div className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                      {contactStaff.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`mailto:${contactStaff.email}`}
                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
                  >
                    <Mail className="w-3 h-3" /> Email
                  </a>
                  <button
                    onClick={() => copyToClipboard(contactStaff.email, 'Email address')}
                    className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition"
                    title="Copy email"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Read-Only Notice Footer */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-800 font-semibold">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                Branch Manager Supervisory Directory (Strict Read-Only)
              </span>
              <button
                onClick={() => setContactStaff(null)}
                className="px-3.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
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
  trend?: string;
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple' | 'blue';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'cyan',
}) => {
  const colorMap = {
    cyan: 'bg-white border-slate-200 text-cyan-700 hover:border-cyan-300',
    emerald: 'bg-white border-slate-200 text-emerald-700 hover:border-emerald-300',
    amber: 'bg-white border-slate-200 text-amber-700 hover:border-amber-300',
    rose: 'bg-white border-slate-200 text-rose-700 hover:border-rose-300',
    purple: 'bg-white border-slate-200 text-purple-700 hover:border-purple-300',
    blue: 'bg-white border-slate-200 text-blue-700 hover:border-blue-300',
  };

  const iconBgMap = {
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  };

  return (
    <div className={clsx(
      'p-4 rounded-2xl border shadow-xs space-y-2 transition hover:shadow-sm',
      colorMap[color]
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate max-w-[80%]">
          {title}
        </span>
        <div className={clsx("w-8 h-8 rounded-xl border flex items-center justify-center shrink-0", iconBgMap[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-black text-slate-900 tracking-tight">{value}</div>
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
        <span className="truncate">{subtitle}</span>
        {trend && (
          <span className="font-bold text-cyan-700 shrink-0 ml-2">
            {trend}
          </span>
        )}
      </div>
    </div>
  );
};

