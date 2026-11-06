import React from 'react';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Pill,
  Bed,
  ClipboardList,
  Activity,
  ArrowRight,
  ShieldAlert,
  Stethoscope,
  RefreshCw,
  Bell,
  Check,
  FileCheck,
  ChevronRight,
  Tv,
} from 'lucide-react';

interface DoctorDashboardViewProps {
  data: any;
  loading: boolean;
  loungeStats?: { waitingInLounge: number; totalTokens: number; servingToken: string | null };
  onRefresh: () => void;
  onNavigateTab: (tab: string, context?: any) => void;
  onAcknowledgeAlert?: (alertId: string) => void;
  onOpenLoungeTV?: () => void;
}

export const DoctorDashboardView: React.FC<DoctorDashboardViewProps> = ({
  data,
  loading,
  loungeStats,
  onRefresh,
  onNavigateTab,
  onAcknowledgeAlert,
  onOpenLoungeTV,
}) => {
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
        <p className="text-sm font-medium">Loading Real-Time Doctor Dashboard...</p>
      </div>
    );
  }

  const doctor = data?.doctor || {};
  const stats = data?.statistics || {};
  const widgets = data?.widgets || {};

  const waitingPatientsCount = Math.max(stats.waiting_patients ?? 0, loungeStats?.waitingInLounge ?? 0);
  const totalTokensCount = Math.max(stats.todays_appointments ?? 0, loungeStats?.totalTokens ?? 0);

  return (
    <div className="space-y-6">
      {/* Doctor Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {doctor.name ? `Dr. ${doctor.name}` : 'Doctor Dashboard'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                ACTIVE
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 flex flex-wrap items-center gap-2">
              <span className="text-slate-200 font-medium">{doctor.specialization || 'Consultant Physician'}</span>
              <span>•</span>
              <span>{doctor.department || 'General Medicine'}</span>
              <span>•</span>
              <span className="font-mono text-cyan-400 font-semibold">{doctor.employee_id}</span>
              {doctor.branch && (
                <>
                  <span>•</span>
                  <span>{doctor.branch}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={onRefresh}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Live DB</span>
          </button>
          <button
            onClick={() => onNavigateTab('appointments')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-cyan-900/30 transition"
          >
            <span>My Appointments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Real-time Waiting Lounge Telemetry for this Doctor */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shrink-0 shadow-inner">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Live Waiting Lounge Telemetry
              </span>
              <span className="text-xs font-mono text-slate-400">Cabin Queue Display</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
              Doctor Waiting Room & Token Monitor
            </h3>
            <p className="text-xs text-slate-400">
              <strong className="text-amber-300 font-mono">{waitingPatientsCount} Patients</strong> currently waiting in the lounge with tokens &bull;{' '}
              <strong className="text-white font-mono">{totalTokensCount} Total Tokens</strong> issued today
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenLoungeTV && (
            <button
              onClick={onOpenLoungeTV}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/20"
            >
              <Tv className="w-4 h-4" />
              <span>Launch Lounge TV</span>
            </button>
          )}
          <a
            href="/lounge-tv"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            title="Open in Dedicated TV Window / Second Monitor"
          >
            <Tv className="w-4 h-4 text-cyan-400" />
          </a>
        </div>
      </div>

      {/* 10 Key Real-Time KPI Statistics Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Real-Time Clinical Statistics (Database Verified)</span>
          </h3>
          <span className="text-[11px] font-mono text-cyan-400">LIVE DB SYNC</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. Today's Appointments */}
          <div
            onClick={() => onNavigateTab('appointments', { scope: 'today' })}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Today's Appts</span>
              <Calendar className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition" />
            </div>
            <p className="text-2xl font-bold text-white mt-2 font-mono">{totalTokensCount}</p>
            <p className="text-[10px] text-cyan-400 mt-1">Scheduled for today</p>
          </div>

          {/* 2. Waiting Patients */}
          <div
            onClick={() => onNavigateTab('appointments', { status: 'CHECKED_IN' })}
            className="p-4 rounded-xl bg-slate-900/90 border border-amber-900/40 hover:border-amber-500/40 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-300">Waiting Patients</span>
              <Clock className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
            </div>
            <p className="text-2xl font-bold text-amber-400 mt-2 font-mono">{waitingPatientsCount}</p>
            <p className="text-[10px] text-amber-400/80 mt-1">Checked-in & queued</p>
          </div>

          {/* 3. In Consultation */}
          <div
            onClick={() => onNavigateTab('appointments', { status: 'IN_CONSULTATION' })}
            className="p-4 rounded-xl bg-slate-900/90 border border-blue-900/40 hover:border-blue-500/40 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-300">In Consultation</span>
              <Activity className="w-4 h-4 text-blue-400 group-hover:scale-110 transition" />
            </div>
            <p className="text-2xl font-bold text-blue-400 mt-2 font-mono">{stats.in_consultation ?? 0}</p>
            <p className="text-[10px] text-blue-400/80 mt-1">Active examinations</p>
          </div>

          {/* 4. Completed Consultations */}
          <div
            onClick={() => onNavigateTab('appointments', { status: 'COMPLETED' })}
            className="p-4 rounded-xl bg-slate-900/90 border border-emerald-900/40 hover:border-emerald-500/40 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-300">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
            </div>
            <p className="text-2xl font-bold text-emerald-400 mt-2 font-mono">{stats.completed_consultations ?? 0}</p>
            <p className="text-[10px] text-emerald-400/80 mt-1">Signed today</p>
          </div>

          {/* 5. Upcoming Appointments */}
          <div
            onClick={() => onNavigateTab('appointments', { scope: 'upcoming' })}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Upcoming</span>
              <Calendar className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition" />
            </div>
            <p className="text-2xl font-bold text-white mt-2 font-mono">{stats.upcoming_appointments ?? 0}</p>
            <p className="text-[10px] text-indigo-400 mt-1">Future days</p>
          </div>

          {/* 6. Admitted Patients */}
          <div
            onClick={() => onNavigateTab('inpatients')}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-purple-300">Admitted IPD</span>
              <Bed className="w-4 h-4 text-purple-400 group-hover:scale-110 transition" />
            </div>
            <p className="text-2xl font-bold text-purple-400 mt-2 font-mono">{stats.admitted_patients ?? 0}</p>
            <p className="text-[10px] text-purple-400/80 mt-1">Under doctor care</p>
          </div>

          {/* 7. Pending Lab Results */}
          <div
            onClick={() => onNavigateTab('investigations')}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Pending Labs</span>
              <FileText className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition" />
            </div>
            <p className="text-2xl font-bold text-white mt-2 font-mono">{stats.pending_lab_results ?? 0}</p>
            <p className="text-[10px] text-cyan-400 mt-1">Awaiting processing</p>
          </div>

          {/* 8. Critical Patient Alerts */}
          <div
            onClick={() => onNavigateTab('reports', { abnormal_only: true })}
            className={`p-4 rounded-xl bg-slate-900/90 border cursor-pointer transition group ${
              (stats.critical_patient_alerts || 0) > 0
                ? 'border-rose-500/60 bg-rose-950/20 shadow-lg shadow-rose-950/20'
                : 'border-slate-800 hover:border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-300">Critical Alerts</span>
              <AlertTriangle className={`w-4 h-4 text-rose-400 ${stats.critical_patient_alerts > 0 ? 'animate-pulse' : ''}`} />
            </div>
            <p className="text-2xl font-bold text-rose-400 mt-2 font-mono">{stats.critical_patient_alerts ?? 0}</p>
            <p className="text-[10px] text-rose-400/80 mt-1">Requires immediate review</p>
          </div>

          {/* 9. Pending Tasks */}
          <div
            onClick={() => onNavigateTab('notifications')}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Pending Tasks</span>
              <ClipboardList className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition" />
            </div>
            <p className="text-2xl font-bold text-white mt-2 font-mono">{stats.pending_tasks ?? 0}</p>
            <p className="text-[10px] text-cyan-400 mt-1">Queues & referrals</p>
          </div>

          {/* 10. Leave Application Status */}
          <div
            onClick={() => onNavigateTab('leaves')}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Leave Status</span>
              <FileCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
            </div>
            <p className="text-sm font-bold text-white mt-2 truncate font-mono">
              {stats.leave_status?.status === 'APPROVED' ? (
                <span className="text-emerald-400">APPROVED</span>
              ) : stats.leave_status?.status === 'PENDING' ? (
                <span className="text-amber-400">PENDING HR</span>
              ) : (
                <span className="text-slate-400">{stats.leave_status?.status || 'NO ACTIVE LEAVE'}</span>
              )}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 truncate">
              {stats.leave_status?.leave_type ? `${stats.leave_status.leave_type} (${stats.leave_status.total_days}d)` : 'View balances'}
            </p>
          </div>
        </div>
      </div>

      {/* 8 Dynamic Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Widget 1: Today's Appointment Schedule (Takes 2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>Today's Appointment Schedule</span>
                <span className="text-xs text-slate-400 font-normal">({widgets.todays_schedule?.length || 0} active)</span>
              </h3>
              <button
                onClick={() => onNavigateTab('appointments', { scope: 'today' })}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {(!widgets.todays_schedule || widgets.todays_schedule.length === 0) ? (
              <div className="py-12 text-center text-slate-500">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-xs font-medium text-slate-400">No appointments scheduled for today</p>
                <p className="text-[11px] text-slate-500 mt-1">New OPD patient bookings will appear here in real time.</p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Token</th>
                      <th className="py-2.5 px-3">Patient</th>
                      <th className="py-2.5 px-3">Time Slot</th>
                      <th className="py-2.5 px-3">Chief Complaint</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {widgets.todays_schedule.map((app: any) => (
                      <tr key={app.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-cyan-400">
                          #{String(app.token_number || '-').replace(/^(token\s*#*|#)+/i, '').trim()}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-white">{app.patient_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{app.patient_mrn} • {app.patient_age}y • {app.patient_gender}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{app.time_slot}</td>
                        <td className="py-2.5 px-3 text-slate-400 max-w-[160px] truncate">{app.chief_complaint}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              app.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : app.status === 'IN_CONSULTATION'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : app.status === 'CHECKED_IN'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {app.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => onNavigateTab('consultation', { appointment_id: app.id })}
                            className="px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-[11px] font-medium transition"
                          >
                            {app.status === 'COMPLETED' ? 'View Details' : 'Start Consultation'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Widget 4: Critical Patient Notifications */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Critical Alerts & Abnormal Labs</span>
              </h3>
              <span className="text-xs text-rose-400 font-mono font-bold">
                {widgets.critical_patient_notifications?.length || 0} ALERTS
              </span>
            </div>

            {(!widgets.critical_patient_notifications || widgets.critical_patient_notifications.length === 0) ? (
              <div className="py-8 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400/40" />
                <p className="text-xs font-medium text-slate-400">All Patient Parameters Stable</p>
                <p className="text-[11px] text-slate-500 mt-1">No critical diagnostic alerts require attention.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {widgets.critical_patient_notifications.map((alert: any) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{alert.patient_name}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 uppercase">
                          {alert.alert_level || 'CRITICAL'}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-200 mt-0.5">
                        <span className="font-semibold">{alert.parameter_name}:</span> {alert.critical_value}
                      </p>
                    </div>

                    {!alert.is_acknowledged && onAcknowledgeAlert && (
                      <button
                        onClick={() => onAcknowledgeAlert(alert.id)}
                        className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold transition"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('reports', { abnormal_only: true })}
            className="w-full mt-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition"
          >
            <span>View All Investigation Reports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2 of Widgets: Recently Visited, Pending Labs, Recent Prescriptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Widget 2: Recently Visited Patients */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Recently Visited Patients</span>
              </h3>
              <button
                onClick={() => onNavigateTab('patients')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                View EMR
              </button>
            </div>

            {(!widgets.recently_visited_patients || widgets.recently_visited_patients.length === 0) ? (
              <p className="py-6 text-center text-xs text-slate-500">No completed consultations yet</p>
            ) : (
              <div className="space-y-2">
                {widgets.recently_visited_patients.slice(0, 5).map((p: any) => (
                  <div
                    key={p.id}
                    onClick={() => onNavigateTab('emr', { patient_id: p.patient_id })}
                    className="p-2.5 rounded-xl bg-slate-950/50 hover:bg-slate-800/60 border border-slate-800/80 cursor-pointer transition flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{p.patient_name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]">{p.diagnosis}</p>
                    </div>
                    <span className="text-[10px] text-cyan-400 font-mono">{p.appointment_date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Widget 5: Pending Laboratory Reports */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Pending Lab Orders</span>
              </h3>
              <button
                onClick={() => onNavigateTab('investigations')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Order Test
              </button>
            </div>

            {(!widgets.pending_laboratory_reports || widgets.pending_laboratory_reports.length === 0) ? (
              <p className="py-6 text-center text-xs text-slate-500">No pending laboratory orders</p>
            ) : (
              <div className="space-y-2">
                {widgets.pending_laboratory_reports.slice(0, 5).map((lo: any) => (
                  <div
                    key={lo.id}
                    className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{lo.patient_name}</span>
                        <span className="text-[9px] font-mono font-bold text-cyan-400">{lo.order_number}</span>
                      </div>
                      <span className="text-[10px] text-amber-400 font-medium">{lo.status}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{lo.order_date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Widget 6: Recent Prescriptions */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Pill className="w-4 h-4 text-emerald-400" />
                <span>Recent Prescriptions</span>
              </h3>
              <button
                onClick={() => onNavigateTab('prescriptions')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                New Rx
              </button>
            </div>

            {(!widgets.recent_prescriptions || widgets.recent_prescriptions.length === 0) ? (
              <p className="py-6 text-center text-xs text-slate-500">No prescriptions recorded</p>
            ) : (
              <div className="space-y-2">
                {widgets.recent_prescriptions.slice(0, 5).map((rx: any) => (
                  <div
                    key={rx.id}
                    className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{rx.patient_name}</span>
                        <span className="text-[9px] font-mono text-slate-400">({rx.item_count} meds)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{rx.diagnosis}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      SIGNED
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3 of Widgets: Leave Summary & 7-Day Consultation Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Widget 7: Leave Application Summary */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-cyan-400" />
              <span>Leave Balances & Status</span>
            </h3>
            <button
              onClick={() => onNavigateTab('leaves')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Apply Leave
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {widgets.leave_application_summary?.balances?.map((b: any, idx: number) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <p className="text-[11px] text-slate-400 font-medium truncate">{b.leave_type_display || b.leave_type}</p>
                <p className="text-lg font-bold text-white font-mono mt-1">{b.remaining_days}d</p>
                <p className="text-[9px] text-slate-500 mt-0.5">Used: {b.used_days} / {b.allocated_days}d</p>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Recent Applications:</span>
            {(!widgets.leave_application_summary?.recent_applications || widgets.leave_application_summary.recent_applications.length === 0) ? (
              <p className="text-[11px] text-slate-500 mt-1">No recent leave requests on record.</p>
            ) : (
              <div className="space-y-1.5 mt-2">
                {widgets.leave_application_summary.recent_applications.slice(0, 2).map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800/60">
                    <span className="text-slate-300 font-medium">{l.leave_type} ({l.start_date} to {l.end_date})</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-semibold ${
                        l.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : l.status === 'PENDING'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Widget 8: Daily Consultation Activity (Last 7 Days) */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Daily Consultation Activity (Last 7 Days)</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Completed</span>
          </div>

          <div className="grid grid-cols-7 gap-2 pt-4">
            {widgets.daily_consultation_activity?.map((day: any, idx: number) => {
              const maxVal = Math.max(...(widgets.daily_consultation_activity?.map((d: any) => d.completed_consultations || 0) || [1]), 1);
              const heightPct = Math.max(15, Math.round((day.completed_consultations / maxVal) * 100));
              return (
                <div key={idx} className="flex flex-col items-center justify-end h-32">
                  <span className="text-xs font-mono font-bold text-white mb-1.5">{day.completed_consultations}</span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-cyan-600 to-blue-500 transition-all shadow-md shadow-cyan-900/20"
                  />
                  <span className="text-[10px] text-slate-400 font-medium mt-2">{day.day_name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
