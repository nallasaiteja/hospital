import React, { useState, useEffect, useMemo } from 'react';
import {
  Stethoscope, Calendar, Clock, Plus, CheckCircle, XCircle, AlertCircle,
  User, FileText, Printer, Search, Filter, RefreshCw, Pill, FlaskConical,
  DollarSign, Activity, ChevronRight, AlertTriangle, TrendingUp, Sparkles,
  Check, CalendarCheck, UserPlus, FileSpreadsheet, Eye, ChevronDown
} from 'lucide-react';
import { opdService, clinicalService, authService, pharmacyService } from '../../services/api';
import { parseApiError } from '../../utils/errorHandler';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { DateField } from '../../components/common/DateField';
import { AlertBanner } from '../../components/common/AlertBanner';
import { useBranch } from '../../context/BranchContext';
import {
  Appointment, OPDDashboardStats, DoctorAvailabilityResponse,
  QueueItem, DoctorScheduleRecord, DoctorLeaveRecord
} from '../../types';

export const AppointmentsPage: React.FC = () => {
  const { currentBranch } = useBranch();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'queue' | 'book' | 'schedules' | 'reports'>('queue');

  // Date and filters
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dashboard Stats & Queue Data
  const [stats, setStats] = useState<OPDDashboardStats | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState<boolean>(true);

  // Dropdown reference data
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Booking & Walk-in Form States
  const [showBookModal, setShowBookModal] = useState<boolean>(false);
  const [showWalkInModal, setShowWalkInModal] = useState<boolean>(false);
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Doctor dynamic slots state
  const [bookingPatientId, setBookingPatientId] = useState<string>('');
  const [bookingDoctorId, setBookingDoctorId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bookingReason, setBookingReason] = useState<string>('');
  const [doctorSlots, setDoctorSlots] = useState<DoctorAvailabilityResponse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Walk-in Registration State
  const [walkInPatientId, setWalkInPatientId] = useState<string>('');
  const [walkInDoctorId, setWalkInDoctorId] = useState<string>('');
  const [walkInComplaint, setWalkInComplaint] = useState<string>('');
  const [walkInVitals, setWalkInVitals] = useState({ bp: '', pulse: '', temp: '', spo2: '' });
  const [tokenReceipt, setTokenReceipt] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  // Consultation Workspace State
  const [showConsultModal, setShowConsultModal] = useState<boolean>(false);
  const [activeConsultAppointment, setActiveConsultAppointment] = useState<QueueItem | null>(null);
  const [encounterData, setEncounterData] = useState<any | null>(null);
  const [consultLoading, setConsultLoading] = useState<boolean>(false);
  const [finalizingConsult, setFinalizingConsult] = useState<boolean>(false);

  // Consultation form fields
  const [vitals, setVitals] = useState({ bp: '', pulse: '', temp: '', spo2: '', weight: '', height: '', respRate: '' });
  const [chiefComplaint, setChiefComplaint] = useState<string>('');
  const [examFindings, setExamFindings] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [treatmentPlan, setTreatmentPlan] = useState<string>('');
  const [consultNotes, setConsultNotes] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState<string>('');
  const [followUpInstructions, setFollowUpInstructions] = useState<string>('');
  const [bookFollowUp, setBookFollowUp] = useState<boolean>(false);
  const [followUpSlot, setFollowUpSlot] = useState<string>('10:00 - 10:15');

  // E-Prescription Items
  const [rxItems, setRxItems] = useState<Array<{
    medicine_id: string;
    dosage: string;
    frequency: string;
    duration_days: number;
    total_quantity: number;
    instructions: string;
  }>>([]);

  // Diagnostic Lab Orders
  const [selectedLabTestIds, setSelectedLabTestIds] = useState<string[]>([]);

  // Schedules and Leaves
  const [schedules, setSchedules] = useState<DoctorScheduleRecord[]>([]);
  const [leaves, setLeaves] = useState<DoctorLeaveRecord[]>([]);
  const [scheduleDoctorFilter, setScheduleDoctorFilter] = useState<string>('');

  // Reports State
  const [reportStartDate, setReportStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [reportEndDate, setReportEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportsData, setReportsData] = useState<any | null>(null);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [consultError, setConsultError] = useState<string | null>(null);

  // 1. Initial Data Fetch
  const loadInitialData = async () => {
    try {
      const [patList, docList] = await Promise.all([
        authService.getPatients({ branch_id: currentBranch?.id }),
        authService.getStaffDirectory({ branch_id: currentBranch?.id, role: 'DOCTOR' }),
      ]);
      setPatients(patList || []);
      setDoctors(docList || []);
      if (docList && docList.length > 0) {
        setBookingDoctorId(docList[0].id);
        setWalkInDoctorId(docList[0].id);
        setScheduleDoctorFilter(docList[0].id);
      }
      if (patList && patList.length > 0) {
        setBookingPatientId(patList[0].id);
        setWalkInPatientId(patList[0].id);
      }
    } catch (err) {
      console.error('Failed to load doctors/patients:', err);
    }
  };

  // 2. Fetch Dashboard Stats & Queue
  const fetchOPDData = async () => {
    setLoadingQueue(true);
    try {
      const [statsRes, queueRes] = await Promise.all([
        opdService.getDashboardStats({
          date: selectedDate,
          branch_id: currentBranch?.id,
          doctor_id: selectedDoctorFilter || undefined,
        }),
        opdService.getQueue({
          date: selectedDate,
          doctor_id: selectedDoctorFilter || undefined,
          status: selectedStatusFilter || undefined,
          search: searchQuery || undefined,
        }),
      ]);
      setStats(statsRes);
      setQueue(queueRes);
    } catch (err) {
      console.error('Failed to load OPD queue and stats:', err);
      setPageError(parseApiError(err).message);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [currentBranch?.id]);

  useEffect(() => {
    fetchOPDData();
  }, [selectedDate, selectedDoctorFilter, selectedStatusFilter, searchQuery, currentBranch?.id]);

  // 3. Dynamic Doctor Slot Checker
  useEffect(() => {
    if (bookingDoctorId && bookingDate) {
      setLoadingSlots(true);
      opdService.getDoctorAvailableSlots(bookingDoctorId, bookingDate)
        .then((res) => {
          setDoctorSlots(res);
          // Auto select first available slot
          const firstAvail = res.slots.find((s) => !s.is_booked);
          if (firstAvail) setSelectedSlot(firstAvail.slot);
          else setSelectedSlot('');
        })
        .catch((err) => {
          console.error('Failed to load doctor slots:', err);
          setDoctorSlots(null);
        })
        .finally(() => setLoadingSlots(false));
    }
  }, [bookingDoctorId, bookingDate]);

  // 4. Handle Book Scheduled Appointment
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    if (!selectedSlot) {
      setBookingError('Please select a valid available time slot.');
      return;
    }
    setBookingLoading(true);
    try {
      await clinicalService.bookAppointment({
        patient_id: bookingPatientId,
        doctor_id: bookingDoctorId,
        branch_id: currentBranch?.id,
        appointment_date: bookingDate,
        time_slot: selectedSlot,
        reason_for_visit: bookingReason || 'General Consultation',
      });
      setShowBookModal(false);
      setBookingReason('');
      fetchOPDData();
    } catch (err: any) {
      setBookingError(parseApiError(err).message);
    } finally {
      setBookingLoading(false);
    }
  };

  // 5. Handle Walk-in Registration
  const handleWalkInRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    setBookingLoading(true);
    try {
      const res = await opdService.registerWalkIn({
        patient_id: walkInPatientId,
        doctor_id: walkInDoctorId,
        branch_id: currentBranch?.id,
        chief_complaint: walkInComplaint,
        vitals: walkInVitals,
      });
      setShowWalkInModal(false);
      setTokenReceipt(res.token_receipt);
      setShowReceiptModal(true);
      setWalkInComplaint('');
      setWalkInVitals({ bp: '', pulse: '', temp: '', spo2: '' });
      fetchOPDData();
    } catch (err: any) {
      setBookingError(parseApiError(err).message);
    } finally {
      setBookingLoading(false);
    }
  };

  // 6. Queue Actions Execution
  const handleQueueAction = async (aptId: string, action: string, payload?: any) => {
    try {
      await opdService.executeQueueAction(aptId, action, payload);
      fetchOPDData();
    } catch (err: any) {
      setPageError(parseApiError(err).message);
      
    }
  };

  // 7. Open Consultation Workspace
  const handleOpenConsultation = async (item: QueueItem) => {
    setActiveConsultAppointment(item);
    setShowConsultModal(true);
    setConsultLoading(true);
    // Reset consult state
    setChiefComplaint(item.chief_complaint || item.reason_for_visit || '');
    setExamFindings('');
    setDiagnosis('');
    setTreatmentPlan('');
    setConsultNotes('');
    setFollowUpDate('');
    setFollowUpInstructions('');
    setBookFollowUp(false);
    setRxItems([]);
    setSelectedLabTestIds([]);
    setVitals({ bp: '120/80', pulse: '76', temp: '98.4', spo2: '99', weight: '', height: '', respRate: '16' });

    try {
      const enc = await opdService.getConsultationEncounter(item.id);
      setEncounterData(enc);
      // Auto transition to IN_CONSULTATION if currently CHECKED_IN
      if (item.status === 'CHECKED_IN') {
        await opdService.executeQueueAction(item.id, 'START_CONSULTATION');
        fetchOPDData();
      }
    } catch (err) {
      console.error('Failed to load consultation encounter context:', err);
    } finally {
      setConsultLoading(false);
    }
  };

  // 8. Add Rx Item
  const handleAddRxItem = () => {
    if (!encounterData?.medicines || encounterData.medicines.length === 0) return;
    const defaultMed = encounterData.medicines[0];
    setRxItems((prev) => [
      ...prev,
      {
        medicine_id: defaultMed.id,
        dosage: '1 Tablet',
        frequency: '1-0-1 (After Food)',
        duration_days: 5,
        total_quantity: 10,
        instructions: 'Take after meals',
      },
    ]);
  };

  const handleRemoveRxItem = (index: number) => {
    setRxItems((prev) => prev.filter((_, i) => i !== index));
  };

  // 9. Finalize Consultation
  const handleFinalizeConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConsultAppointment) return;
    setFinalizingConsult(true);

    try {
      await opdService.finalizeConsultation(activeConsultAppointment.id, {
        chief_complaint: chiefComplaint,
        examination_findings: examFindings,
        diagnosis,
        treatment_plan: treatmentPlan,
        consultation_notes: consultNotes,
        vitals,
        prescriptions: rxItems,
        lab_test_ids: selectedLabTestIds,
        follow_up_date: followUpDate || undefined,
        follow_up_instructions: followUpInstructions,
        book_follow_up: bookFollowUp,
        follow_up_time_slot: followUpSlot,
      });

      setShowConsultModal(false);
      setActiveConsultAppointment(null);
      fetchOPDData();
    } catch (err: any) {
      setConsultError(parseApiError(err).message);
    } finally {
      setFinalizingConsult(false);
    }
  };

  // 10. Load Schedules & Leaves Tab
  const fetchSchedulesAndLeaves = async () => {
    try {
      const [schedRes, leaveRes] = await Promise.all([
        opdService.getDoctorSchedules({ doctor_id: scheduleDoctorFilter || undefined }),
        opdService.getDoctorLeaves({ doctor_id: scheduleDoctorFilter || undefined }),
      ]);
      setSchedules(schedRes);
      setLeaves(leaveRes);
    } catch (err) {
      console.error('Failed to load schedules/leaves:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'schedules') {
      fetchSchedulesAndLeaves();
    }
  }, [activeTab, scheduleDoctorFilter]);

  // 11. Load Reports Tab
  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const rep = await opdService.getOPDReports({
        start_date: reportStartDate,
        end_date: reportEndDate,
        branch_id: currentBranch?.id,
      });
      setReportsData(rep);
    } catch (err) {
      console.error('Failed to load OPD reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    }
  }, [activeTab, reportStartDate, reportEndDate]);

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return <Badge variant="info">Scheduled</Badge>;
      case 'CHECKED_IN':
        return <Badge variant="warning">Checked In (Waiting)</Badge>;
      case 'IN_CONSULTATION':
        return <Badge variant="accent">In Consultation</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      case 'NO_SHOW':
        return <Badge variant="neutral">No Show</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Queue Columns
  const queueColumns: Column<QueueItem>[] = [
    {
      key: 'token_number',
      header: 'Token #',
      render: (item) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-cyan-300 font-extrabold px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-xs shadow-sm">
            {item.token_number || '—'}
          </span>
          {item.appointment_type === 'WALK_IN' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
              Walk-in
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'patient_name',
      header: 'Patient Info',
      render: (item) => (
        <div>
          <div className="font-semibold text-white flex items-center gap-1.5">
            {item.patient_name}
            {item.patient_gender && (
              <span className="text-[11px] text-slate-400 font-normal">
                ({item.patient_gender[0]}
                {item.patient_blood_group ? `, ${item.patient_blood_group}` : ''})
              </span>
            )}
          </div>
          <div className="text-[11px] font-mono text-cyan-400/80">MRN: {item.patient_mrn}</div>
          {item.patient_allergies && item.patient_allergies.length > 0 && (
            <div className="text-[10px] text-rose-400 flex items-center gap-1 mt-0.5 font-medium">
              <AlertTriangle className="w-2.5 h-2.5" />
              Allergies: {item.patient_allergies.join(', ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'doctor_name',
      header: 'Doctor & Department',
      render: (item) => (
        <div>
          <div className="text-slate-200 font-medium">Dr. {item.doctor_name}</div>
          <div className="text-[11px] text-slate-400">{item.doctor_specialization || item.department_name}</div>
        </div>
      ),
    },
    {
      key: 'time_slot',
      header: 'Slot / Check-In',
      render: (item) => (
        <div className="text-xs">
          <div className="text-slate-300 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" />
            {item.time_slot}
          </div>
          {item.checked_in_at && (
            <div className="text-[11px] text-slate-500 mt-0.5">
              In: {new Date(item.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'wait_minutes',
      header: 'Wait Time',
      render: (item) => (
        <div>
          {item.status === 'CHECKED_IN' ? (
            <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
              item.wait_minutes > 30
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {item.wait_minutes} min
            </span>
          ) : item.status === 'IN_CONSULTATION' ? (
            <span className="text-xs text-cyan-400 font-medium animate-pulse flex items-center gap-1">
              <Activity className="w-3 h-3" /> Consulting
            </span>
          ) : (
            <span className="text-xs text-slate-500">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => getStatusBadge(item.status),
    },
    {
      key: 'invoice_status',
      header: 'Fee / Invoice',
      render: (item) => (
        <div className="text-xs">
          {item.invoice_number ? (
            <div>
              <span className="font-mono text-[11px] text-slate-400">{item.invoice_number}</span>
              <div>
                <span className={`text-[10px] font-semibold ${
                  item.invoice_status === 'PAID' ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {item.invoice_status}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-slate-600">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Queue Actions',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          {item.status === 'SCHEDULED' && (
            <button
              onClick={() => handleQueueAction(item.id, 'CHECK_IN')}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition shadow-sm"
            >
              Check In
            </button>
          )}

          {item.status === 'CHECKED_IN' && (
            <>
              <button
                onClick={() => handleOpenConsultation(item)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition shadow-sm flex items-center gap-1"
              >
                <Stethoscope className="w-3 h-3" /> Call In & Consult
              </button>
              <button
                onClick={() => handleQueueAction(item.id, 'NO_SHOW')}
                className="px-2 py-1 text-xs text-slate-400 hover:text-rose-400 transition"
                title="Mark No Show"
              >
                No Show
              </button>
            </>
          )}

          {item.status === 'IN_CONSULTATION' && (
            <button
              onClick={() => handleOpenConsultation(item)}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 hover:brightness-110 transition shadow-sm flex items-center gap-1"
            >
              <FileText className="w-3 h-3" /> Resume / Finalize Rx
            </button>
          )}

          {item.status === 'COMPLETED' && (
            <span className="text-xs text-emerald-400/80 font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Completed
            </span>
          )}

          {['SCHEDULED', 'CHECKED_IN'].includes(item.status) && (
            <button
              onClick={() => {
                const reason = prompt('Please enter cancellation reason:');
                if (reason) handleQueueAction(item.id, 'CANCEL', { reason });
              }}
              className="px-2 py-1 text-xs text-slate-500 hover:text-rose-400 transition"
              title="Cancel Appointment"
            >
              Cancel
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Stethoscope className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Outpatient Department (OPD) & Appointments
              </h1>
              <p className="text-xs text-slate-400">
                Multi-Specialty Clinic Management • Collision Prevention • Walk-in Tokens • Integrated EMR & Rx
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowWalkInModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold text-xs hover:bg-amber-500/25 transition shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Walk-in Token
          </button>
          <button
            onClick={() => setShowBookModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold text-xs hover:brightness-110 shadow-lg shadow-cyan-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            Book Appointment
          </button>
          <button
            onClick={fetchOPDData}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Refresh OPD Queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto custom-scrollbar whitespace-nowrap">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'queue'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          Live OPD Queue & Dashboard
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'schedules'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          Doctor Availability & Rosters
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'reports'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Doctor & OPD Analytics Reports
        </button>
      </div>

      {/* TAB 1: Live OPD Queue & Dashboard */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              title="Today's Appointments"
              value={stats ? stats.total_appointments.toString() : '0'}
              icon={Calendar}
            />
            <StatCard
              title="Waiting in Queue"
              value={stats ? stats.waiting.toString() : '0'}
              icon={Clock}
            />
            <StatCard
              title="In Consultation"
              value={stats ? stats.in_consultation.toString() : '0'}
              icon={Stethoscope}
            />
            <StatCard
              title="Completed Today"
              value={stats ? stats.completed.toString() : '0'}
              icon={CheckCircle}
            />
            <StatCard
              title="Avg Wait Duration"
              value={stats ? `${stats.average_wait_minutes} min` : '0 min'}
              icon={Activity}
            />
            <StatCard
              title="Doctors on Duty"
              value={stats ? stats.available_doctors_count.toString() : '0'}
              icon={User}
            />
          </div>

          {/* OPD Queue Filters Bar */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              {/* Date Selector */}
              <div className="w-44">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Doctor Filter */}
              <div className="w-56">
                <select
                  value={selectedDoctorFilter}
                  onChange={(e) => setSelectedDoctorFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="">All Doctors & Clinics</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.user_profile?.full_name} ({d.specialization || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="w-44">
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="">All Statuses</option>
                  <option value="CHECKED_IN">Waiting (Checked In)</option>
                  <option value="IN_CONSULTATION">In Consultation</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="NO_SHOW">No Show</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Patient Search */}
            <div className="w-64 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, MRN, token..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Queue DataTable */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="text-xs font-semibold text-slate-300">
                Patient Queue for {selectedDate} ({queue.length} Total Patients)
              </span>
              <span className="text-[11px] text-cyan-400 font-mono">
                Auto-sorting: In Consultation &gt; Checked In &gt; Scheduled
              </span>
            </div>

            <DataTable
              data={queue}
              columns={queueColumns}
              loading={loadingQueue}
              searchable={false}
              pageSize={15}
            />
          </div>
        </div>
      )}

      {/* TAB 2: Doctor Availability & Rosters */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Doctor Working Hours & Leave Schedule</h2>
              <p className="text-xs text-slate-400">
                Configure weekly consultation clinic shifts and block unavailable leave dates to prevent booking collisions.
              </p>
            </div>
            <div className="w-64">
              <select
                value={scheduleDoctorFilter}
                onChange={(e) => setScheduleDoctorFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
              >
                <option value="">All Doctors</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.user_profile?.full_name} ({d.specialization || 'General'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Schedules Card */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Weekly Recurring Clinic Shifts
                </h3>
              </div>
              <div className="space-y-2">
                {schedules.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">No recurring schedules found for this selection.</div>
                ) : (
                  schedules.map((s) => (
                    <div key={s.id} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white">{s.doctor_name}</div>
                        <div className="text-[11px] text-cyan-400 font-mono mt-0.5">
                          {s.day_of_week}: {s.start_time} - {s.end_time} ({s.slot_duration_minutes} min slots)
                        </div>
                      </div>
                      <Badge variant={s.is_available ? 'success' : 'neutral'}>
                        {s.is_available ? 'Active Clinic' : 'Off Duty'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Approved Leaves Card */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  Doctor Leaves & Time Offs
                </h3>
              </div>
              <div className="space-y-2">
                {leaves.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">No leaves recorded. All scheduled doctors available.</div>
                ) : (
                  leaves.map((l) => (
                    <div key={l.id} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white">{l.doctor_name}</div>
                        <div className="text-[11px] text-amber-400 font-mono mt-0.5">
                          {l.start_date} to {l.end_date} • {l.reason}
                        </div>
                      </div>
                      <Badge variant="warning">On Leave</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Reports & Analytics */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-base font-bold text-white">OPD Performance & Consultation Revenue Report</h2>
              <p className="text-xs text-slate-400">
                Audited clinical volume, completion rates, and doctor-wise consultation billing receipts.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span>From:</span>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span>To:</span>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          {reportsData && (
            <>
              {/* Financial & Volume Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-xs text-slate-400">Total Consultations</div>
                  <div className="text-xl font-bold text-white mt-1">{reportsData.summary.total_appointments}</div>
                  <div className="text-[11px] text-emerald-400 mt-1">
                    {reportsData.summary.completion_rate_percent}% Completion Rate
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-xs text-slate-400">Billed Consultation Fees</div>
                  <div className="text-xl font-bold text-cyan-400 mt-1 font-mono">
                    ₹{reportsData.summary.total_billed_revenue}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Generated Invoices</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-xs text-slate-400">Collected Revenue</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">
                    ₹{reportsData.summary.total_paid_revenue}
                  </div>
                  <div className="text-[11px] text-emerald-400/80 mt-1">Settled at Cashier</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-xs text-slate-400">Outstanding Balance</div>
                  <div className="text-xl font-bold text-amber-400 mt-1 font-mono">
                    ₹{reportsData.summary.total_outstanding_balance}
                  </div>
                  <div className="text-[11px] text-amber-400/80 mt-1">Pending Settlement</div>
                </div>
              </div>

              {/* Doctor-wise Report Table */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">Doctor-wise OPD Consultations & Revenue Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5">Doctor</th>
                        <th className="px-4 py-2.5">Department</th>
                        <th className="px-4 py-2.5 text-center">Total</th>
                        <th className="px-4 py-2.5 text-center">Completed</th>
                        <th className="px-4 py-2.5 text-center">Walk-ins</th>
                        <th className="px-4 py-2.5 text-right">Billed Revenue</th>
                        <th className="px-4 py-2.5 text-right">Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {reportsData.doctor_reports.map((dr: any) => (
                        <tr key={dr.doctor_id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-semibold text-white">Dr. {dr.doctor_name}</td>
                          <td className="px-4 py-3 text-cyan-400">{dr.department_name || dr.specialization}</td>
                          <td className="px-4 py-3 text-center font-mono">{dr.total}</td>
                          <td className="px-4 py-3 text-center font-mono text-emerald-400">{dr.completed}</td>
                          <td className="px-4 py-3 text-center font-mono text-amber-400">{dr.walk_in}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-white">₹{dr.billed_revenue}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-400">₹{dr.paid_revenue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL 1: Book Scheduled Appointment (with real available slots) */}
      <Modal
        isOpen={showBookModal}
        onClose={() => setShowBookModal(false)}
        title="Schedule Outpatient Appointment"
        size="lg"
      >
        <form onSubmit={handleBookAppointment} className="space-y-4">
          {bookingError && <AlertBanner variant="error" title="Booking Error" message={bookingError} />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Select Patient"
              value={bookingPatientId}
              onChange={(e) => setBookingPatientId(e.target.value)}
              options={patients.map((p) => ({
                value: p.id,
                label: `${p.user_profile?.first_name} ${p.user_profile?.last_name} (${p.medical_record_number})`,
              }))}
              required
            />

            <Select
              label="Consulting Doctor"
              value={bookingDoctorId}
              onChange={(e) => setBookingDoctorId(e.target.value)}
              options={doctors.map((d) => ({
                value: d.id,
                label: `Dr. ${d.user_profile?.full_name} (${d.specialization || 'General'})`,
              }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DateField
              label="Appointment Date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              required
            />
            <Input
              label="Chief Reason for Visit"
              value={bookingReason}
              onChange={(e) => setBookingReason(e.target.value)}
              placeholder="e.g. Follow-up consultation, fever, hypertension"
              required
            />
          </div>

          {/* Dynamic Available Slots Grid */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Available Doctor Time Slots on {bookingDate}
              </span>
              {doctorSlots && (
                <span className="text-[11px] text-cyan-400 font-mono">
                  Fee: ₹{doctorSlots.consultation_fee || '500.00'}
                </span>
              )}
            </div>

            {loadingSlots ? (
              <div className="p-4 text-center text-xs text-slate-400 animate-pulse">
                Checking doctor availability and existing bookings...
              </div>
            ) : doctorSlots?.is_on_leave ? (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                Dr. {doctorSlots.doctor_name} is on approved leave on this date: {doctorSlots.leave_reason}. Please select another date.
              </div>
            ) : doctorSlots && doctorSlots.slots.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs">
                {doctorSlots.message || 'No scheduled clinic hours on this day.'}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
                {doctorSlots?.slots.map((s) => (
                  <button
                    key={s.slot}
                    type="button"
                    disabled={s.is_booked}
                    onClick={() => setSelectedSlot(s.slot)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-mono transition text-center ${
                      s.is_booked
                        ? 'bg-slate-900/60 border border-slate-800 text-slate-600 cursor-not-allowed line-through'
                        : selectedSlot === s.slot
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30 border border-cyan-400'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-cyan-500/40 hover:text-white'
                    }`}
                  >
                    {s.slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowBookModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bookingLoading || !selectedSlot || doctorSlots?.is_on_leave}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold hover:brightness-110 disabled:opacity-50 transition"
            >
              {bookingLoading ? 'Reserving Slot...' : 'Confirm Appointment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: OPD Walk-in Registration & Queue Token */}
      <Modal
        isOpen={showWalkInModal}
        onClose={() => setShowWalkInModal(false)}
        title="OPD Walk-in Registration & Queue Token"
        size="md"
      >
        <form onSubmit={handleWalkInRegistration} className="space-y-4">
          {bookingError && <AlertBanner variant="error" title="Error" message={bookingError} />}

          <Select
            label="Select Patient"
            value={walkInPatientId}
            onChange={(e) => setWalkInPatientId(e.target.value)}
            options={patients.map((p) => ({
              value: p.id,
              label: `${p.user_profile?.first_name} ${p.user_profile?.last_name} (${p.medical_record_number})`,
            }))}
            required
          />

          <Select
            label="Attending Doctor / Clinic"
            value={walkInDoctorId}
            onChange={(e) => setWalkInDoctorId(e.target.value)}
            options={doctors.map((d) => ({
              value: d.id,
              label: `Dr. ${d.user_profile?.full_name} (${d.specialization || 'General'})`,
            }))}
            required
          />

          <Input
            label="Chief Complaint / Reason for Visit"
            value={walkInComplaint}
            onChange={(e) => setWalkInComplaint(e.target.value)}
            placeholder="e.g. Acute high fever, breathlessness, earache"
            required
          />

          {/* Quick Triage Vitals */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="text-xs font-semibold text-slate-400">Reception Triage Vitals (Optional)</div>
            <div className="grid grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="BP (120/80)"
                value={walkInVitals.bp}
                onChange={(e) => setWalkInVitals({ ...walkInVitals, bp: e.target.value })}
                className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
              />
              <input
                type="text"
                placeholder="Pulse (bpm)"
                value={walkInVitals.pulse}
                onChange={(e) => setWalkInVitals({ ...walkInVitals, pulse: e.target.value })}
                className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
              />
              <input
                type="text"
                placeholder="Temp (°F)"
                value={walkInVitals.temp}
                onChange={(e) => setWalkInVitals({ ...walkInVitals, temp: e.target.value })}
                className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
              />
              <input
                type="text"
                placeholder="SpO2 (%)"
                value={walkInVitals.spo2}
                onChange={(e) => setWalkInVitals({ ...walkInVitals, spo2: e.target.value })}
                className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowWalkInModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bookingLoading}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold hover:brightness-110 disabled:opacity-50 transition"
            >
              {bookingLoading ? 'Generating Token...' : 'Issue Token & Check In'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Printable OPD Token Receipt */}
      {tokenReceipt && (
        <Modal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          title="OPD Queue Token Receipt"
          size="sm"
        >
          <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-4 font-mono">
            <div className="text-xs uppercase tracking-widest text-slate-400">AURA Multi-Specialty Hospital</div>
            <div className="py-3 border-y border-dashed border-slate-700">
              <div className="text-4xl font-extrabold text-cyan-400">{tokenReceipt.token_number}</div>
              <div className="text-xs text-slate-400 mt-1">Outpatient Clinic Queue</div>
            </div>

            <div className="text-xs text-left space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Patient:</span>
                <span className="font-semibold text-white">{tokenReceipt.patient_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">MRN:</span>
                <span>{tokenReceipt.patient_mrn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Doctor:</span>
                <span className="text-white">Dr. {tokenReceipt.doctor_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <span>{tokenReceipt.department_name || tokenReceipt.specialization}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time:</span>
                <span>{tokenReceipt.date} {tokenReceipt.check_in_time}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-500">Consultation Fee:</span>
                <span className="text-emerald-400 font-bold">₹{tokenReceipt.consultation_fee}</span>
              </div>
              {tokenReceipt.invoice_number && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice:</span>
                  <span className="text-cyan-400">{tokenReceipt.invoice_number}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-center gap-3 no-print">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition"
              >
                <Printer className="w-4 h-4" /> Print Token Slip
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 4: Doctor Consultation Workspace (EMR Integration + Rx + Diagnostics) */}
      {activeConsultAppointment && (
        <Modal
          isOpen={showConsultModal}
          onClose={() => setShowConsultModal(false)}
          title={`Doctor Consultation Workspace: ${activeConsultAppointment.patient_name} (${activeConsultAppointment.patient_mrn})`}
          size="xl"
        >
          {consultLoading ? (
            <div className="p-12 text-center text-xs text-slate-400 animate-pulse">
              Loading Patient Electronic Medical Records (EMR) & Formulary...
            </div>
          ) : (
            <form onSubmit={handleFinalizeConsultation} className="space-y-5">
              {/* Patient EMR Banner (Section 5 Integration) */}
              {encounterData?.emr_summary && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                    <span className="font-bold text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-cyan-400" />
                      {encounterData.emr_summary.full_name} • {encounterData.emr_summary.gender} • Blood Group: {encounterData.emr_summary.blood_group || 'O+'}
                    </span>
                    <span className="text-slate-400 font-mono">
                      Doctor: <strong className="text-cyan-300">Dr. {activeConsultAppointment.doctor_name}</strong>
                    </span>
                  </div>

                  {/* Section 5 Allergies Warning Alert */}
                  {encounterData.emr_summary.allergies && encounterData.emr_summary.allergies.length > 0 ? (
                    <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        <strong>CRITICAL ALLERGIES ALERT:</strong> {encounterData.emr_summary.allergies.join(', ')}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500">No known drug allergies reported.</div>
                  )}

                  {/* Chronic Conditions */}
                  {encounterData.emr_summary.chronic_conditions && encounterData.emr_summary.chronic_conditions.length > 0 && (
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-300">Chronic Conditions:</span>
                      {encounterData.emr_summary.chronic_conditions.map((cc: string) => (
                        <span key={cc} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px]">
                          {cc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Consultation Vitals Recording */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Examination Vitals & Biometrics
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">BP (mmHg)</label>
                    <input
                      type="text"
                      value={vitals.bp}
                      onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                      placeholder="120/80"
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Pulse (bpm)</label>
                    <input
                      type="text"
                      value={vitals.pulse}
                      onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                      placeholder="76"
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Temp (°F)</label>
                    <input
                      type="text"
                      value={vitals.temp}
                      onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                      placeholder="98.6"
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">SpO2 (%)</label>
                    <input
                      type="text"
                      value={vitals.spo2}
                      onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                      placeholder="99"
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Resp Rate</label>
                    <input
                      type="text"
                      value={vitals.respRate}
                      onChange={(e) => setVitals({ ...vitals, respRate: e.target.value })}
                      placeholder="16"
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">Weight (kg)</label>
                    <input
                      type="text"
                      value={vitals.weight}
                      onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                      placeholder="70"
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Clinical Assessment & Diagnosis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Chief Complaint & History of Present Illness
                  </label>
                  <textarea
                    rows={2}
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="Patient presentation, symptom onset, progression..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Clinical Diagnosis (ICD-10 / Assessment)
                  </label>
                  <textarea
                    rows={2}
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Essential Primary Hypertension (ICD-10 I10), Acute Pharyngitis (J02.9)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                    required
                  />
                </div>
              </div>

              {/* Objective Examination & Treatment Plan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Doctor's Physical Examination Findings
                  </label>
                  <textarea
                    rows={2}
                    value={examFindings}
                    onChange={(e) => setExamFindings(e.target.value)}
                    placeholder="Systemic examination, cardiovascular, respiratory, CNS, per abdomen findings..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Treatment Plan & Lifestyle Advice
                  </label>
                  <textarea
                    rows={2}
                    value={treatmentPlan}
                    onChange={(e) => setTreatmentPlan(e.target.value)}
                    placeholder="Dietary recommendations, fluid intake, physical rest, monitoring..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              {/* E-Prescriptions Multi-Item Builder */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Pill className="w-4 h-4 text-cyan-400" />
                    Electronic Prescriptions (HMS Pharmacy Formulary)
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRxItem}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition"
                  >
                    <Plus className="w-3 h-3" /> Add Medicine
                  </button>
                </div>

                {rxItems.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500">
                    No medications prescribed yet. Click "+ Add Medicine" to prescribe from pharmacy formulary.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rxItems.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-6 gap-2 items-center text-xs">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-500">Medicine</label>
                          <select
                            value={item.medicine_id}
                            onChange={(e) => {
                              const updated = [...rxItems];
                              updated[idx].medicine_id = e.target.value;
                              setRxItems(updated);
                            }}
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                          >
                            {encounterData?.medicines?.map((m: any) => (
                              <option key={m.id} value={m.id}>
                                {m.brand_name} ({m.generic_name} {m.strength})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Dosage</label>
                          <input
                            type="text"
                            value={item.dosage}
                            onChange={(e) => {
                              const updated = [...rxItems];
                              updated[idx].dosage = e.target.value;
                              setRxItems(updated);
                            }}
                            placeholder="1 Tablet"
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Frequency</label>
                          <input
                            type="text"
                            value={item.frequency}
                            onChange={(e) => {
                              const updated = [...rxItems];
                              updated[idx].frequency = e.target.value;
                              setRxItems(updated);
                            }}
                            placeholder="1-0-1"
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500">Duration (Days)</label>
                          <input
                            type="number"
                            value={item.duration_days}
                            onChange={(e) => {
                              const updated = [...rxItems];
                              updated[idx].duration_days = parseInt(e.target.value) || 1;
                              setRxItems(updated);
                            }}
                            className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveRxItem(idx)}
                            className="p-1 rounded text-rose-400 hover:bg-rose-500/10 transition"
                            title="Remove Medicine"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Diagnostic Orders (Lab Tests) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FlaskConical className="w-4 h-4 text-purple-400" />
                  Order Laboratory Investigations
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 max-h-36 overflow-y-auto">
                  {encounterData?.lab_catalogue?.map((test: any) => {
                    const isSelected = selectedLabTestIds.includes(test.id);
                    return (
                      <button
                        key={test.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedLabTestIds(selectedLabTestIds.filter((id) => id !== test.id));
                          } else {
                            setSelectedLabTestIds([...selectedLabTestIds, test.id]);
                          }
                        }}
                        className={`p-2 rounded-xl text-left text-xs transition border flex items-center justify-between ${
                          isSelected
                            ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div>
                          <div className="truncate">{test.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">₹{test.standard_rate}</div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Follow-up Scheduling Section */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CalendarCheck className="w-4 h-4 text-emerald-400" />
                    Recommended Follow-up Consultation
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bookFollowUp}
                      onChange={(e) => setBookFollowUp(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-800 text-cyan-500 focus:ring-0"
                    />
                    <span>Automatically schedule follow-up slot</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Follow-up Date</label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Follow-up Clinical Instructions</label>
                    <input
                      type="text"
                      value={followUpInstructions}
                      onChange={(e) => setFollowUpInstructions(e.target.value)}
                      placeholder="e.g. Return in 2 weeks with fasting blood glucose report"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Consultation Fee Notice */}
              <div className="p-3 bg-cyan-950/40 border border-cyan-500/20 rounded-xl flex items-center justify-between text-xs text-slate-300">
                <span>
                  Consultation Fee: <strong className="text-cyan-400">₹{activeConsultAppointment.doctor_fee || '500.00'}</strong>
                </span>
                <span className="text-[11px] text-slate-400">
                  Auto-generates OPD invoice item linked to patient financial ledger.
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConsultModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Save as Draft
                </button>
                <button
                  type="submit"
                  disabled={finalizingConsult}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 text-slate-950 hover:brightness-110 shadow-lg shadow-cyan-500/30 transition disabled:opacity-50"
                >
                  {finalizingConsult ? 'Finalizing Clinical Record...' : 'Complete Encounter & Sign Rx'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};
