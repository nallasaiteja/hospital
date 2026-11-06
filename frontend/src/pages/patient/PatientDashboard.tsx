import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  FileText,
  Clock,
  Pill,
  CreditCard,
  PlusCircle,
  Activity,
  Hospital,
  Tv,
} from 'lucide-react';
import {
  authService,
  clinicalService,
  pharmacyService,
  billingFinanceService,
  diagnosticsService,
  CurrentUserResponse
} from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';
import { useTranslation } from 'react-i18next';

const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const PatientDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<CurrentUserResponse | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Booking Modal
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookForm, setBookForm] = useState({
    doctor_id: '',
    appointment_date: getTodayDateStr(),
    appointment_time: '10:00:00',
    type: 'NEW_CONSULTATION',
    symptoms: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const userRes = await authService.getCurrentUser();
      setProfileData(userRes);

      const [appts, rxs, invs, docs, labs] = await Promise.all([
        clinicalService.getAppointments().catch(() => []),
        pharmacyService.getPrescriptions().catch(() => []),
        billingFinanceService.getInvoices().catch(() => []),
        authService.getStaffDirectory({ role: 'DOCTOR' }).catch(() => []),
        diagnosticsService.getOrders().catch(() => [])
      ]);
      setAppointments(appts || []);
      setPrescriptions(rxs || []);
      setInvoices(invs || []);
      setDoctors(docs || []);
      setLabOrders(labs || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData?.patient_profile) return;
    try {
      setBookingSubmitting(true);
      setError(null);
      await clinicalService.bookAppointment({
        patient_id: profileData.patient_profile.id,
        doctor_id: bookForm.doctor_id,
        appointment_date: bookForm.appointment_date,
        time_slot: bookForm.appointment_time || '10:00:00',
        appointment_time: bookForm.appointment_time || '10:00:00',
        reason_for_visit: bookForm.symptoms || 'General OPD Consultation',
        symptoms: bookForm.symptoms,
        type: bookForm.type,
      });

      setSuccessMsg('Consultation appointment booked successfully! Live token issued.');
      setIsBookModalOpen(false);
      setBookForm({
        doctor_id: '',
        appointment_date: getTodayDateStr(),
        appointment_time: '10:00:00',
        type: 'NEW_CONSULTATION',
        symptoms: ''
      });
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setBookingSubmitting(false);
    }
  };

  const patient = profileData?.patient_profile;
  const user = profileData?.user;

  const totalOutstanding = invoices.reduce((acc, inv) => {
    const total = parseFloat(inv.total_amount) || 0;
    const paid = parseFloat(inv.paid_amount) || 0;
    return acc + Math.max(0, total - paid);
  }, 0);

  return (
    <div className="w-full space-y-6">
      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Welcome Banner */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-teal-950/60 via-slate-800/80 to-slate-800/60 border border-teal-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            {t('common.welcome', 'Welcome')}, {user?.first_name ? `${user.first_name} ${user.last_name}` : t('auth.patient', 'Patient')}!
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span>{t('patient.uhid', 'UHID')}: <strong className="text-teal-400 font-mono">{patient?.uhid || patient?.medical_record_number || 'PENDING'}</strong></span>
            <span>&bull;</span>
            <span>{t('patient.bloodGroup', 'Blood Group')}: <strong className="text-white">{patient?.blood_group || 'Recorded in EMR'}</strong></span>
            <span>&bull;</span>
            <span>{t('common.branch', 'Branch')}: <strong className="text-slate-300">{patient?.primary_branch_name || 'Main Hospital Campus'}</strong></span>
          </p>
        </div>
        <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-slate-300">
          For new appointments or OPD tokens, please visit the <strong className="text-teal-400">Hospital Reception Desk</strong>.
        </div>
      </div>

      {/* Active Token & Waiting Lounge Telemetry Card (STRICTLY FOR TODAY'S ACTIVE APPOINTMENTS) */}
      {(() => {
        const todayStr = getTodayDateStr();
        const activeAppt = appointments.find(
          (a) =>
            a.appointment_date === todayStr &&
            Boolean(a.token_number) &&
            ['SCHEDULED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(a.status)
        );
        if (!activeAppt) return null;

        const cleanTokenStr = String(activeAppt.token_number).replace(/^(token\s*#*|#)+/i, '').trim();
        const waitingCount = activeAppt.lounge_waiting_count ?? 0;

        return (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-cyan-950/40 border-2 border-teal-500/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-500 text-slate-950 flex flex-col items-center justify-center font-mono font-black shadow-lg shadow-teal-500/30 shrink-0">
                <span className="text-[9px] uppercase tracking-wider">Token</span>
                <span className="text-xl">#{cleanTokenStr}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                    Live Waiting Lounge Telemetry
                  </span>
                  <span className="text-xs font-mono text-slate-400">Ref: {activeAppt.appointment_number}</span>
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Dr. {activeAppt.doctor_name || 'Consultant'} &bull; {activeAppt.department_name || 'General OPD'}
                </h3>
                <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                  {activeAppt.status === 'IN_CONSULTATION' ? (
                    <span className="text-emerald-400 font-bold">🟢 It&apos;s Your Turn! Please proceed inside consultation cabin</span>
                  ) : activeAppt.status === 'CHECKED_IN' ? (
                    <>
                      <span className="text-amber-300 font-semibold">
                        {activeAppt.tokens_ahead !== undefined && activeAppt.tokens_ahead > 0
                          ? `${activeAppt.tokens_ahead} patients ahead of you in lounge`
                          : waitingCount > 1
                          ? 'You are next in line in the lounge!'
                          : waitingCount === 1
                          ? 'You are next in line in the lounge!'
                          : 'You have checked in for today\'s consultation.'}
                      </span>
                      <span>&bull;</span>
                      <span>
                        {waitingCount > 0
                          ? `Total ${waitingCount} ${waitingCount === 1 ? 'person' : 'people'} waiting for this doctor`
                          : 'Queue currently clear'}
                      </span>
                      {activeAppt.serving_token && (
                        <>
                          <span>&bull;</span>
                          <span className="text-cyan-400 font-mono">
                            Now Calling: #{String(activeAppt.serving_token).replace(/^(token\s*#*|#)+/i, '').trim()}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-teal-300 font-semibold">
                        Appointment Confirmed for Today
                      </span>
                      <span>&bull;</span>
                      <span className="text-slate-400">
                        Please check in at Reception Desk upon arrival to enter the live waiting lounge queue.
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <a
                href={`/lounge-tv?doctor_id=${activeAppt.doctor_id || activeAppt.doctor || ''}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-teal-500/25"
              >
                <Tv className="w-4 h-4" />
                <span>Open Lounge TV</span>
              </a>
            </div>
          </div>
        );
      })()}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {(() => {
          const todayStr = getTodayDateStr();
          const activeScheduledCount = appointments.filter(
            (a) => a.appointment_date >= todayStr && ['SCHEDULED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(a.status)
          ).length;
          return (
            <div onClick={() => navigate('/patient/appointments')} className="p-4 sm:p-5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-teal-500/50 cursor-pointer transition">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">{t('patient.scheduledVisits', 'Scheduled Visits')}</span>
                <Calendar className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-2xl font-bold text-white">{activeScheduledCount}</div>
              <p className="text-[11px] text-teal-400 mt-1">{t('patient.confirmedOPD', 'Confirmed OPD consultations')}</p>
            </div>
          );
        })()}

        <div onClick={() => navigate('/patient/prescriptions')} className="p-4 sm:p-5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-cyan-500/50 cursor-pointer transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('patient.digitalPrescriptions', 'Digital Prescriptions')}</span>
            <Pill className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">{prescriptions.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">{t('patient.pharmacyPrescriptions', 'Hospital pharmacy prescriptions')}</p>
        </div>

        <div onClick={() => navigate('/patient/lab-reports')} className="p-4 sm:p-5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-teal-500/50 cursor-pointer transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('patient.diagnosticReports', 'Diagnostic Reports')}</span>
            <Activity className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white">{labOrders.length}</div>
          <p className="text-[11px] text-teal-400 mt-1">{t('patient.labInvestigations', 'Pathology & Lab reports')}</p>
        </div>

        <div onClick={() => navigate('/patient/billing')} className="p-4 sm:p-5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-indigo-500/50 cursor-pointer transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('patient.medicalInvoices', 'Medical Invoices')}</span>
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{invoices.length}</div>
          <p className="text-[11px] text-emerald-400 mt-1">{t('patient.itemizedBills', 'Itemized hospital bills')}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('patient.outstandingDue', 'Outstanding Due')}</span>
            <CreditCard className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">₹{totalOutstanding.toFixed(2)}</div>
          <p className="text-[11px] text-emerald-400 mt-1">
            {totalOutstanding === 0 ? t('patient.allBillsCleared') : t('patient.paymentPendingCashier')}
          </p>
        </div>
      </div>

      {/* Detailed Records Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Upcoming Consultations */}
        <div className="p-4 sm:p-6 rounded-2xl bg-slate-800/60 border border-slate-700/60">
          <h3 className="text-sm sm:text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-400" />
            <span>{t('patient.myScheduledAppointments')}</span>
          </h3>
          {(() => {
            const todayStr = getTodayDateStr();
            const upcomingAppointments = appointments.filter(
              (a) => a.appointment_date >= todayStr && ['SCHEDULED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(a.status)
            );
            if (upcomingAppointments.length === 0) {
              return (
                <div className="text-center py-6 text-slate-400">
                  <p className="text-xs font-medium">{t('patient.noUpcomingConsultations', 'No active upcoming consultations.')}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Visit or contact Hospital Reception Desk to schedule an appointment or obtain a queue token.</p>
                </div>
              );
            }
            return (
              <div className="space-y-3">
                {upcomingAppointments.slice(0, 4).map((a) => {
                  const cleanTok = String(a.token_number || '').replace(/^(token\s*#*|#)+/i, '').trim();
                  return (
                    <div
                      key={a.id}
                      className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 flex flex-col xs:flex-row xs:items-center justify-between gap-2.5"
                    >
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-white">Dr. {a.doctor_name || t('roles.doctor')}</p>
                        <p className="text-xs text-slate-400">{a.department_name || t('navigation.appointments')}</p>
                        <p className="text-[11px] text-teal-400 mt-0.5">
                          {cleanTok ? `Token #${cleanTok} • ` : ''}{a.appointment_date} at {a.appointment_time || a.time_slot || '10:00 AM'}
                        </p>
                      </div>
                      <div className="self-start xs:self-center shrink-0">
                        <Badge
                          variant={
                            a.status === 'COMPLETED'
                              ? 'success'
                              : a.status === 'CANCELLED' || a.status === 'NO_SHOW'
                              ? 'danger'
                              : a.status === 'IN_CONSULTATION'
                              ? 'accent'
                              : a.status === 'CHECKED_IN'
                              ? 'warning'
                              : 'info'
                          }
                        >
                          {a.status === 'NO_SHOW' ? 'No Show / Lapsed' : a.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Clinical Prescriptions */}
        <div className="p-4 sm:p-6 rounded-2xl bg-slate-800/60 border border-slate-700/60">
          <h3 className="text-sm sm:text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Pill className="w-4 h-4 text-cyan-400" />
            <span>{t('patient.myActivePrescriptions')}</span>
          </h3>
          {prescriptions.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">{t('patient.noActivePrescriptions')}</p>
          ) : (
            <div className="space-y-3">
              {prescriptions.slice(0, 4).map((rx) => (
                <div
                  key={rx.id}
                  className="p-3 sm:p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60 flex flex-col xs:flex-row xs:items-center justify-between gap-2.5"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">Rx #{rx.prescription_number}</p>
                    <p className="text-[11px] text-slate-400">{rx.diagnosis || t('navigation.prescriptionsTab')}</p>
                    <p className="text-[11px] text-slate-500">{t('patient.prescribedBy')} {rx.doctor_name}</p>
                  </div>
                  <div className="self-start xs:self-center shrink-0">
                    <Badge variant={rx.is_dispensed ? 'success' : 'warning'}>
                      {rx.is_dispensed ? t('patient.dispensed') : t('patient.readyAtPharmacy')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
