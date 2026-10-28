import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Search,
  User,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Filter,
  FileText
} from 'lucide-react';
import { clinicalService, authService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

interface Appointment {
  id: string;
  appointment_number: string;
  token_number: number;
  doctor_name: string;
  department_name: string;
  appointment_date: string;
  appointment_time: string;
  type: string;
  status: string;
  symptoms?: string;
  consultation_notes?: string;
}

export const PatientAppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Booking Modal
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [patientProfile, setPatientProfile] = useState<any | null>(null);
  const [bookForm, setBookForm] = useState({
    doctor_id: '',
    appointment_date: new Date().toISOString().split('T')[0],
    appointment_time: '10:00:00',
    type: 'NEW_CONSULTATION',
    symptoms: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [userRes, apptData, docData] = await Promise.all([
        authService.getCurrentUser(),
        clinicalService.getAppointments(),
        authService.getStaffDirectory({ role: 'DOCTOR' }).catch(() => []),
      ]);
      setPatientProfile(userRes?.patient_profile || null);
      setAppointments(apptData || []);
      setDoctors(docData || []);
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
    if (!patientProfile) {
      setError('Patient record could not be identified. Please sign in again.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await clinicalService.bookAppointment({
        patient_id: patientProfile.id,
        ...bookForm,
      });
      setSuccessMsg('Your appointment slot has been successfully booked!');
      setIsBookModalOpen(false);
      setBookForm({
        doctor_id: '',
        appointment_date: new Date().toISOString().split('T')[0],
        appointment_time: '10:00:00',
        type: 'NEW_CONSULTATION',
        symptoms: '',
      });
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = appointments.filter((a) => {
    const doctorMatch = (a.doctor_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const deptMatch = (a.department_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchSearch = doctorMatch || deptMatch;
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'SCHEDULED':
        return <Badge variant="info">Scheduled</Badge>;
      case 'CHECKED_IN':
        return <Badge variant="warning">Checked In (In Queue)</Badge>;
      case 'IN_CONSULTATION':
        return <Badge variant="accent">In Doctor Cabin</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
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
            My Doctor Appointments
          </h1>
          <p className="text-sm text-slate-400">
            Book outpatient appointments, track queue tokens, and review doctor consultation notes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh Appointments"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsBookModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg text-sm font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Book New Appointment
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
            placeholder="Search by doctor name or specialty department..."
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
              You haven't booked any consultations yet. Click "Book New Appointment" above to schedule a visit with our medical specialists.
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
                  <span className="text-sm font-extrabold text-teal-400">#{a.token_number}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">Dr. {a.doctor_name || 'Consultant'}</h3>
                    {getStatusBadge(a.status)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {a.department_name || 'General OPD'} &bull; Ref: <span className="font-mono text-slate-300">{a.appointment_number}</span>
                  </p>
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
                </div>
              </div>

              <div className="flex flex-col md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-slate-800 text-xs text-slate-400">
                <div className="flex items-center gap-1.5 font-medium text-slate-200">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>
                    {a.appointment_date} at {a.appointment_time}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 capitalize">
                  {a.type?.replace('_', ' ').toLowerCase()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

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
                label: `Dr. ${d.user_profile?.first_name} ${d.user_profile?.last_name} (${d.specialty || 'General Physician'})`,
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
              disabled={submitting}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-sm disabled:opacity-50"
            >
              {submitting ? 'Confirming Slot...' : 'Confirm Appointment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
