import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCheck,
  Calendar,
  FileText,
  Clock,
  LogOut,
  Pill,
  CreditCard,
  PlusCircle,
  Activity,
  Hospital,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../services/supabase';
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

export const PatientDashboard: React.FC = () => {
  const navigate = useNavigate();
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

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
      });
      setSuccessMsg('Your OPD Consultation slot has been booked with the physician.');
      setIsBookModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setBookingSubmitting(false);
    }
  };

  const patient = profileData?.patient_profile;
  const user = profileData?.user;

  const totalOutstanding = invoices.reduce((s, i) => s + parseFloat(i.balance_amount || '0'), 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Patient Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white tracking-tight">AURA Care</span>
              <span className="ml-2 text-xs text-teal-400 font-medium">Patient Medical Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-slate-300">{user?.email || 'patient@example.com'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}
        {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-950/40 via-slate-800/60 to-slate-800/40 border border-teal-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Welcome, {user?.first_name ? `${user.first_name} ${user.last_name}` : 'Patient'}!
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              UHID: <strong className="text-teal-400 font-mono">{patient?.uhid || patient?.medical_record_number || 'PENDING'}</strong> &bull; Blood Group: <strong className="text-white">{patient?.blood_group || 'Not Recorded'}</strong> &bull; Primary Branch: <strong className="text-slate-300">{patient?.primary_branch_name || 'Main Hospital Branch'}</strong>
            </p>
          </div>
          <button
            onClick={() => setIsBookModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition flex items-center gap-2 shadow-lg shadow-teal-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Book New Appointment</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Scheduled Visits</span>
              <Calendar className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-2xl font-bold text-white">{appointments.length}</div>
            <p className="text-[11px] text-teal-400 mt-1">Confirmed OPD consultations</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Digital Prescriptions</span>
              <Pill className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white">{prescriptions.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">Hospital pharmacy prescriptions</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Medical Invoices</span>
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white">{invoices.length}</div>
            <p className="text-[11px] text-emerald-400 mt-1">Itemized hospital bills</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Outstanding Due</span>
              <CreditCard className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">₹{totalOutstanding.toFixed(2)}</div>
            <p className="text-[11px] text-emerald-400 mt-1">
              {totalOutstanding === 0 ? 'All bills cleared' : 'Payment pending at cashier'}
            </p>
          </div>
        </div>

        {/* Detailed Records Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Consultations */}
          <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              <span>My Scheduled Appointments</span>
            </h3>
            {appointments.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No upcoming consultations booked.</p>
            ) : (
              <div className="space-y-3">
                {appointments.slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-700/60 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">Dr. {a.doctor_name || 'Consultant'}</p>
                      <p className="text-xs text-slate-400">{a.department_name || 'General OPD'}</p>
                      <p className="text-[11px] text-teal-400 mt-1">
                        Token #{a.token_number} &bull; {a.appointment_date} at {a.appointment_time}
                      </p>
                    </div>
                    <Badge variant={a.status === 'COMPLETED' ? 'success' : 'info'}>{a.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clinical Prescriptions */}
          <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Pill className="w-4 h-4 text-cyan-400" />
              <span>My Active Prescriptions & Medications</span>
            </h3>
            {prescriptions.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No active prescriptions on file.</p>
            ) : (
              <div className="space-y-3">
                {prescriptions.slice(0, 4).map((rx) => (
                  <div
                    key={rx.id}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/60 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">Rx #{rx.prescription_number}</p>
                      <p className="text-[11px] text-slate-400">{rx.diagnosis || 'Clinical Prescription'}</p>
                      <p className="text-[11px] text-slate-500">Prescribed by {rx.doctor_name}</p>
                    </div>
                    <Badge variant={rx.is_dispensed ? 'success' : 'warning'}>
                      {rx.is_dispensed ? 'Dispensed' : 'Ready at Pharmacy'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Booking Modal */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title="Schedule OPD Consultation Slot"
      >
        <form onSubmit={handleBookAppointment} className="space-y-4">
          <Select
            label="Consulting Doctor / Specialist"
            required
            value={bookForm.doctor_id}
            onChange={(e) => setBookForm({ ...bookForm, doctor_id: e.target.value })}
            options={[
              { value: '', label: '-- Choose Doctor --' },
              ...doctors.map((d) => ({
                value: d.id,
                label: `Dr. ${d.user_profile?.first_name || ''} ${d.user_profile?.last_name || ''} (${d.specialization || d.designation || 'General Physician'})`,
              })),
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Consultation Date"
              type="date"
              required
              value={bookForm.appointment_date}
              onChange={(e) => setBookForm({ ...bookForm, appointment_date: e.target.value })}
            />
            <Input
              label="Preferred Time Slot"
              type="time"
              required
              value={bookForm.appointment_time}
              onChange={(e) => setBookForm({ ...bookForm, appointment_time: e.target.value })}
            />
          </div>

          <Input
            label="Current Symptoms / Reason for Visit"
            placeholder="e.g. Chest discomfort, recurrent fever, routine checkup"
            required
            value={bookForm.symptoms}
            onChange={(e) => setBookForm({ ...bookForm, symptoms: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsBookModalOpen(false)}
              className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bookingSubmitting}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-sm disabled:opacity-50"
            >
              {bookingSubmitting ? 'Confirming Slot...' : 'Confirm Appointment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
