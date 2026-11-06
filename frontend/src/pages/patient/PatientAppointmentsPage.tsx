import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Search,
  RefreshCw,
  Tv,
  Users,
  Sparkles,
} from 'lucide-react';
import { clinicalService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';
import { useTranslation } from 'react-i18next';

interface Appointment {
  id: string;
  appointment_number: string;
  token_number: number | string;
  doctor_id?: string;
  doctor?: any;
  doctor_name: string;
  department_name: string;
  appointment_date: string;
  appointment_time: string;
  type: string;
  status: string;
  symptoms?: string;
  consultation_notes?: string;
  cancellation_reason?: string;
  paid_amount?: string;
  receipt_number?: string;
  payment_method?: string;
  lounge_waiting_count?: number;
  serving_token?: string;
  tokens_ahead?: number;
}

const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const PatientAppointmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const apptData = await clinicalService.getAppointments();
      setAppointments(apptData || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = appointments.filter((a) => {
    const doctorMatch = (a.doctor_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const deptMatch = (a.department_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchSearch = doctorMatch || deptMatch;
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: string, appointmentDate?: string) => {
    const todayStr = getTodayDateStr();
    if (appointmentDate && appointmentDate < todayStr && (status === 'SCHEDULED' || status === 'CHECKED_IN')) {
      return <Badge variant="danger">{t('appointments.statusNoShow', 'No Show / Lapsed')}</Badge>;
    }
    switch (status) {
      case 'CONFIRMED':
      case 'SCHEDULED':
        return <Badge variant="info">{t('appointments.statusScheduled', 'Scheduled')}</Badge>;
      case 'CHECKED_IN':
        return <Badge variant="warning">{t('appointments.statusCheckedIn', 'Checked In (In Queue)')}</Badge>;
      case 'IN_CONSULTATION':
        return <Badge variant="accent">{t('appointments.statusInConsultation', 'In Doctor Cabin')}</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">{t('appointments.statusCompleted', 'Completed')}</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">{t('appointments.statusCancelled', 'Cancelled')}</Badge>;
      case 'NO_SHOW':
        return <Badge variant="danger">{t('appointments.statusNoShow', 'No Show / Lapsed')}</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-teal-400" />
            {t('navigation.myAppointments', 'My Doctor Appointments')}
          </h1>
          <p className="text-sm text-slate-400">
            {t('patient.confirmedOPD', 'Track your confirmed outpatient appointments, queue tokens, payment receipts, and doctor consultation notes. Please contact the Hospital Reception Desk to book a new appointment or token.')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title={t('common.refresh', 'Refresh Appointments')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Search & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('common.searchRecords', 'Search by doctor name or specialty department...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="CHECKED_IN">Checked In</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Appointment Cards / Grid */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
            Loading your appointments...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-300">No appointments found</p>
            <p className="text-xs text-slate-500 mt-1">
              No appointments or OPD tokens are currently on record. Please visit or call the Hospital Reception Desk to schedule a consultation and obtain a queue token.
            </p>
          </div>
        ) : (
          filtered.map((a) => (
            <div
              key={a.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Token</span>
                  <span className="text-sm font-extrabold text-teal-400">
                    #{String(a.token_number || '').replace(/^(token\s*#*|#)+/i, '').trim()}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">Dr. {a.doctor_name || 'Consultant'}</h3>
                    {getStatusBadge(a.status, a.appointment_date)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {a.department_name || 'General OPD'} &bull; Ref: <span className="font-mono text-slate-300">{a.appointment_number}</span>
                    {a.paid_amount && (
                      <>
                        {' '}&bull; Paid: <span className="font-mono text-emerald-400 font-semibold">₹{a.paid_amount}</span>
                      </>
                    )}
                    {a.receipt_number && (
                      <>
                        {' '}&bull; Receipt: <span className="font-mono text-cyan-400">{a.receipt_number}</span>
                      </>
                    )}
                  </p>

                  {/* Real-time Waiting Lounge Telemetry for this Token (STRICTLY FOR TODAY'S ACTIVE CONSULTATIONS) */}
                  {(() => {
                    const todayStr = getTodayDateStr();
                    const isTodayActive =
                      a.appointment_date === todayStr &&
                      Boolean(a.token_number) &&
                      ['SCHEDULED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(a.status);
                    if (!isTodayActive) return null;

                    const waitingCount = a.lounge_waiting_count ?? 0;

                    return (
                      <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-teal-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center font-bold shrink-0">
                            <Tv className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span className="text-slate-300">Lounge Telemetry:</span>
                              {a.status === 'IN_CONSULTATION' ? (
                                <span className="text-emerald-400 font-extrabold flex items-center gap-1 animate-pulse">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  It's Your Turn! Please proceed inside doctor's cabin
                                </span>
                              ) : a.status === 'CHECKED_IN' ? (
                                <span className="text-amber-300 font-semibold">
                                  {a.tokens_ahead !== undefined && a.tokens_ahead > 0
                                    ? `${a.tokens_ahead} patients ahead of you in lounge`
                                    : waitingCount > 1
                                    ? 'You are next in line in the lounge!'
                                    : waitingCount === 1
                                    ? 'You are next in line in the lounge!'
                                    : 'You have checked in for today\'s consultation.'}
                                </span>
                              ) : (
                                <span className="text-teal-300 font-medium">
                                  Appointment Confirmed for Today &bull; Please check in at Reception upon arrival
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                              {a.status === 'CHECKED_IN' ? (
                                <span>
                                  {waitingCount > 0
                                    ? `Total ${waitingCount} ${waitingCount === 1 ? 'person' : 'people'} waiting for Dr. ${a.doctor_name}`
                                    : 'Queue currently clear'}
                                </span>
                              ) : null}
                              {a.serving_token && (
                                <>
                                  <span>&bull;</span>
                                  <span className="font-mono text-teal-300">
                                    Currently Calling: Token #{String(a.serving_token).replace(/^(token\s*#*|#)+/i, '').trim()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <a
                          href={`/lounge-tv?doctor_id=${a.doctor || a.doctor_id || ''}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 hover:brightness-110 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow"
                        >
                          <Tv className="w-3.5 h-3.5" />
                          <span>Watch Lounge TV</span>
                        </a>
                      </div>
                    );
                  })()}
                  {a.symptoms && (
                    <p className="text-xs text-slate-400 mt-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/80">
                      Reason / Symptoms: <span className="text-slate-200">{a.symptoms}</span>
                    </p>
                  )}
                  {a.consultation_notes && (
                    <div className="mt-2 text-xs text-emerald-300 bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-900/40">
                      <strong className="block text-emerald-400 font-semibold mb-0.5">Doctor's Consultation Notes:</strong>
                      {a.consultation_notes}
                    </div>
                  )}
                  {a.status === 'CANCELLED' && a.cancellation_reason && (
                    <div className="mt-2 text-xs text-rose-300 bg-rose-950/30 p-2.5 rounded-lg border border-rose-900/40">
                      <strong className="block text-rose-400 font-semibold mb-0.5">Cancellation Note:</strong>
                      {a.cancellation_reason}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-slate-800 text-xs text-slate-400">
                <div className="flex items-center gap-1.5 font-medium text-slate-200">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>
                    {a.appointment_date} at {a.appointment_time || (a as any).time_slot || '10:00 AM'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 capitalize">
                  {a.type?.replace('_', ' ').toLowerCase()}
                </span>
                {a.status === 'SCHEDULED' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to cancel this appointment?')) {
                        try {
                          await clinicalService.cancelAppointment(a.id, 'Cancelled by patient');
                          loadData();
                        } catch (err: any) {
                          setError(parseApiError(err).message);
                        }
                      }
                    }}
                    className="mt-2 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg border border-rose-500/20 transition self-start md:self-end"
                  >
                    Cancel Appointment
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
