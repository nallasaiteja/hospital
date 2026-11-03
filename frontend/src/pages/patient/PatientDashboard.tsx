import React, { useEffect, useState } from 'react';
import {
  Calendar,
  FileText,
  Clock,
  Pill,
  CreditCard,
  PlusCircle,
  Activity,
  Hospital
} from 'lucide-react';
import {
  authService,
  clinicalService,
  pharmacyService,
  billingFinanceService,
  CurrentUserResponse
} from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';
import { useTranslation } from 'react-i18next';

export const PatientDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [profileData, setProfileData] = useState<CurrentUserResponse | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Booking Modal
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookForm, setBookForm] = useState({
    doctor_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
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

      const [appts, rxs, invs, docs] = await Promise.all([
        clinicalService.getAppointments().catch(() => []),
        pharmacyService.getPrescriptions().catch(() => []),
        billingFinanceService.getInvoices().catch(() => []),
        authService.getStaffDirectory({ role: 'DOCTOR' }).catch(() => [])
      ]);
      setAppointments(appts || []);
      setPrescriptions(rxs || []);
      setInvoices(invs || []);
      setDoctors(docs || []);
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
        appointment_date: new Date().toISOString().split('T')[0],
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
        <button
          onClick={() => setIsBookModalOpen(true)}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 shrink-0"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>{t('patient.bookAppointment', 'Book Appointment')}</span>
        </button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('patient.scheduledVisits', 'Scheduled Visits')}</span>
            <Calendar className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white">{appointments.length}</div>
          <p className="text-[11px] text-teal-400 mt-1">{t('patient.confirmedOPD', 'Confirmed OPD consultations')}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('patient.digitalPrescriptions', 'Digital Prescriptions')}</span>
            <Pill className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">{prescriptions.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">{t('patient.pharmacyPrescriptions', 'Hospital pharmacy prescriptions')}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-slate-800/60 border border-slate-700/60">
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
          {appointments.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">{t('patient.noUpcomingConsultations')}</p>
          ) : (
            <div className="space-y-3">
              {appointments.slice(0, 4).map((a) => (
                <div
                  key={a.id}
                  className="p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 flex flex-col xs:flex-row xs:items-center justify-between gap-2.5"
                >
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-white">Dr. {a.doctor_name || t('roles.doctor')}</p>
                    <p className="text-xs text-slate-400">{a.department_name || t('navigation.appointments')}</p>
                    <p className="text-[11px] text-teal-400 mt-0.5">
                      {t('dashboard.token')} #{a.token_number} &bull; {a.appointment_date} at {a.appointment_time}
                    </p>
                  </div>
                  <div className="self-start xs:self-center shrink-0">
                    <Badge variant={a.status === 'COMPLETED' ? 'success' : 'info'}>{a.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {/* Booking Modal */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title={t('patient.scheduleSlotModalTitle')}
        size="md"
      >
        <form onSubmit={handleBookAppointment} className="space-y-4">
          <Select
            label={t('patient.consultingDoctor')}
            required
            value={bookForm.doctor_id}
            onChange={(e) => setBookForm({ ...bookForm, doctor_id: e.target.value })}
            options={[
              { value: '', label: t('patient.chooseDoctor') },
              ...doctors.map((d) => ({
                value: d.id,
                label: `Dr. ${d.user_profile?.first_name || ''} ${d.user_profile?.last_name || ''} (${d.specialization || d.designation || 'General Physician'})`,
              })),
            ]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Input
              label={t('patient.consultationDate')}
              type="date"
              required
              value={bookForm.appointment_date}
              onChange={(e) => setBookForm({ ...bookForm, appointment_date: e.target.value })}
            />
            <Input
              label={t('patient.preferredTimeSlot')}
              type="time"
              required
              value={bookForm.appointment_time}
              onChange={(e) => setBookForm({ ...bookForm, appointment_time: e.target.value })}
            />
          </div>

          <Input
            label={t('patient.currentSymptoms')}
            placeholder="e.g. Chest discomfort, recurrent fever, routine checkup"
            required
            value={bookForm.symptoms}
            onChange={(e) => setBookForm({ ...bookForm, symptoms: e.target.value })}
          />

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsBookModalOpen(false)}
              className="w-full sm:w-auto px-4 py-2.5 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl text-xs"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={bookingSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs disabled:opacity-50 shadow-md shadow-teal-500/20"
            >
              {bookingSubmitting ? t('patient.confirmingSlot') : t('patient.confirmAppointment')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
