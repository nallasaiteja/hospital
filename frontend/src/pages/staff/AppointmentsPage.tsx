import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Tv, Stethoscope, Calendar, Clock, Plus, CheckCircle, XCircle, AlertCircle,
  User, FileText, Printer, Search, Filter, RefreshCw, Pill, FlaskConical,
  DollarSign, Activity, ChevronRight, AlertTriangle, TrendingUp, Sparkles,
  Check, CalendarCheck, UserPlus, FileSpreadsheet, Eye, ChevronDown, Ban,
  CreditCard, Banknote, Download, ShieldAlert, ShieldCheck, Receipt
} from 'lucide-react';
import api, { opdService, clinicalService, authService, pharmacyService, patientService } from '../../services/api';
import { VoicePrescriptionModal, StructuredPrescriptionItem } from '../../components/clinical/VoicePrescriptionModal';
import { parseApiError } from '../../utils/errorHandler';
import { getLocalTodayDateString } from '../../utils/dateUtils';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { DateField } from '../../components/common/DateField';
import { AlertBanner } from '../../components/common/AlertBanner';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { LoungeTVPage } from '../LoungeTVPage';
import {
  Appointment, OPDDashboardStats, DoctorAvailabilityResponse,
  QueueItem, DoctorScheduleRecord, DoctorLeaveRecord
} from '../../types';

export const AppointmentsPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentBranch } = useBranch();
  const { role } = useAuth();
  const location = useLocation();

  // Strict Receptionist-Only Access Control for Appointment Booking & Token Issuing
  const isReceptionist = role === 'RECEPTIONIST';
  const canConductConsultation = ['DOCTOR', 'MEDICAL_DIRECTOR', 'DEPARTMENT_HEAD'].includes(role || '');

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'queue' | 'book' | 'schedules' | 'reports'>('queue');

  // Date and filters
  const [selectedDate, setSelectedDate] = useState<string>(getLocalTodayDateString());
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
  const [showLoungeTVModal, setShowLoungeTVModal] = useState<boolean>(false);
  const [showWalkInModal, setShowWalkInModal] = useState<boolean>(false);
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Doctor dynamic slots state
  const [bookingPatientId, setBookingPatientId] = useState<string>('');
  const [bookingDoctorId, setBookingDoctorId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>(getLocalTodayDateString());
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

  // Patient Search & Inline Quick Patient Registration State (Receptionist Workflow Step 1)
  const [patientSearchQuery, setPatientSearchQuery] = useState<string>('');
  const [showQuickRegForm, setShowQuickRegForm] = useState<boolean>(false);
  const [quickRegLoading, setQuickRegLoading] = useState<boolean>(false);
  const [quickRegError, setQuickRegError] = useState<string | null>(null);
  const [quickFirstName, setQuickFirstName] = useState<string>('');
  const [quickLastName, setQuickLastName] = useState<string>('');
  const [quickPhone, setQuickPhone] = useState<string>('');
  const [quickGender, setQuickGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [quickBloodGroup, setQuickBloodGroup] = useState<string>('O+');
  const [quickDob, setQuickDob] = useState<string>('');

  // Mandatory Payment Collection State (Receptionist Workflow Steps 3–8)
  const [consultationFeeInfo, setConsultationFeeInfo] = useState<{
    consultation_fee: string;
    formatted_amount: string;
    fee_source: string;
    department_name: string;
  } | null>(null);
  const [loadingFee, setLoadingFee] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE'>('CASH');
  const [cashReceivedConfirmed, setCashReceivedConfirmed] = useState<boolean>(false);
  const [cashReferenceNote, setCashReferenceNote] = useState<string>('');
  const [onlineOrderData, setOnlineOrderData] = useState<any | null>(null);
  const [onlineVerifiedData, setOnlineVerifiedData] = useState<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    amount: string;
  } | null>(null);
  const [onlinePaymentStatus, setOnlinePaymentStatus] = useState<'IDLE' | 'ORDER_CREATED' | 'VERIFIED' | 'FAILED'>('IDLE');
  const [onlinePaymentError, setOnlinePaymentError] = useState<string | null>(null);
  const [gatewayProcessing, setGatewayProcessing] = useState<boolean>(false);


  // Triage Vitals Modal State
  const [showTriageModal, setShowTriageModal] = useState<boolean>(false);
  const [selectedTriageItem, setSelectedTriageItem] = useState<any | null>(null);
  const [triageVitals, setTriageVitals] = useState({
    bp: '',
    pulse: '',
    temp: '',
    spo2: '',
    weight: '',
    height: '',
    respRate: ''
  });
  const [savingTriage, setSavingTriage] = useState<boolean>(false);

  const handleSaveTriageVitals = async () => {
    if (!selectedTriageItem) return;
    setSavingTriage(true);
    try {
      await api.patch(`/clinical/appointments/${selectedTriageItem.id}/`, {
        vitals: triageVitals
      });
      setShowTriageModal(false);
      fetchOPDData();
    } catch (err: any) {
      console.error('Failed to save triage vitals', err);
    } finally {
      setSavingTriage(false);
    }
  };

  // Cancellation Modal State
  const [cancelModalItem, setCancelModalItem] = useState<QueueItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Cancelled by doctor');
  const [cancelling, setCancelling] = useState<boolean>(false);

  // Consultation Workspace State
  const [showConsultModal, setShowConsultModal] = useState<boolean>(false);
  const [showVoicePrescriptionModal, setShowVoicePrescriptionModal] = useState<boolean>(false);
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

  // E-Prescription Items with detailed schedule & food instructions
  const [rxItems, setRxItems] = useState<Array<{
    medicine_id: string;
    dosage: string;
    frequency: string;
    duration_days: number;
    total_quantity: number;
    instructions: string;
    food_instruction?: string;
    route?: string;
    is_prn?: boolean;
    prn_indication?: string;
    morning?: boolean;
    morning_dose?: string;
    afternoon?: boolean;
    afternoon_dose?: string;
    evening?: boolean;
    evening_dose?: string;
    night?: boolean;
    night_dose?: string;
  }>>([]);

  // Diagnostic Lab Orders
  const [selectedLabTestIds, setSelectedLabTestIds] = useState<string[]>([]);

  // Schedules and Leaves
  const [schedules, setSchedules] = useState<DoctorScheduleRecord[]>([]);
  const [leaves, setLeaves] = useState<DoctorLeaveRecord[]>([]);
  const [scheduleDoctorFilter, setScheduleDoctorFilter] = useState<string>('');

  // Reports State
  const [reportStartDate, setReportStartDate] = useState<string>(getLocalTodayDateString(-30));
  const [reportEndDate, setReportEndDate] = useState<string>(getLocalTodayDateString());
  const [reportsData, setReportsData] = useState<any | null>(null);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [consultError, setConsultError] = useState<string | null>(null);

  const getDoctorLabel = (d: any) => {
    const rawName = d?.user_profile?.full_name || `${d?.user_profile?.first_name || ''} ${d?.user_profile?.last_name || ''}`.trim() || 'Physician';
    const cleanName = rawName.replace(/^Dr\.?\s*/i, '');
    const specialty = d?.specialization || d?.designation || d?.department_name || 'Specialist';
    return `Dr. ${cleanName} (${specialty})`;
  };

  // 1. Initial Data Fetch
  const loadInitialData = async () => {
    try {
      const [patList, docList, currentUser] = await Promise.all([
        authService.getPatients({ branch_id: currentBranch?.id }),
        authService.getStaffDirectory({ branch_id: currentBranch?.id, role: 'DOCTOR' }),
        authService.getCurrentUser().catch(() => null),
      ]);
      setPatients(patList || []);
      setDoctors(docList || []);

      const userRole = String(currentUser?.role || '');
      const isDoc = ['DOCTOR', 'MEDICAL_DIRECTOR', 'DEPARTMENT_HEAD'].includes(userRole);
      const myStaffId = currentUser?.staff_profile?.id;

      if (isDoc && myStaffId) {
        setSelectedDoctorFilter(myStaffId);
        setBookingDoctorId(myStaffId);
        setWalkInDoctorId(myStaffId);
        setScheduleDoctorFilter(myStaffId);
      } else if (docList && docList.length > 0) {
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

  // 3b. Direct URL Route Protection & Auto-Modal Trigger for Receptionist
  useEffect(() => {
    const path = location.pathname.toLowerCase();
    const params = new URLSearchParams(location.search);
    const actionParam = (params.get('action') || '').toLowerCase();
    const wantsBook = path.endsWith('/book') || actionParam === 'book';
    const wantsWalkIn = path.endsWith('/walk-in') || path.endsWith('/token') || actionParam === 'walk-in' || actionParam === 'token';

    if (wantsBook || wantsWalkIn) {
      if (!isReceptionist) {
        setShowBookModal(false);
        setShowWalkInModal(false);
        setPageError('Access Denied (403 Forbidden): Only the Receptionist role is authorized to book appointments or issue patient tokens.');
      } else if (wantsBook) {
        resetPaymentState();
        setShowBookModal(true);
      } else if (wantsWalkIn) {
        resetPaymentState();
        setShowWalkInModal(true);
      }
    }
  }, [location.pathname, location.search, isReceptionist]);

  // 3c. Reset Payment State when switching modal, doctor, or patient
  const resetPaymentState = () => {
    setPaymentMethod('CASH');
    setCashReceivedConfirmed(false);
    setCashReferenceNote('');
    setOnlineOrderData(null);
    setOnlineVerifiedData(null);
    setOnlinePaymentStatus('IDLE');
    setOnlinePaymentError(null);
    setBookingError(null);
    setShowQuickRegForm(false);
    setQuickRegError(null);
  };

  // 3d. Fetch Authoritative Hospital Consultation Fee in ₹ whenever active doctor/patient changes
  const activeModalDoctorId = showWalkInModal ? walkInDoctorId : bookingDoctorId;
  const activeModalPatientId = showWalkInModal ? walkInPatientId : bookingPatientId;

  useEffect(() => {
    if (!isReceptionist || (!showBookModal && !showWalkInModal) || !activeModalDoctorId) return;
    setLoadingFee(true);
    setOnlineOrderData(null);
    setOnlineVerifiedData(null);
    setOnlinePaymentStatus('IDLE');
    setOnlinePaymentError(null);
    setCashReceivedConfirmed(false);

    opdService
      .getConsultationFee({
        doctor_id: activeModalDoctorId,
        patient_id: activeModalPatientId || undefined,
      })
      .then((res) => {
        setConsultationFeeInfo({
          consultation_fee: res.consultation_fee,
          formatted_amount: res.formatted_amount,
          fee_source: res.fee_source,
          department_name: res.department_name,
        });
      })
      .catch(() => {
        const docObj = doctors.find((d) => d.id === activeModalDoctorId);
        const fallbackFee = docObj?.consultation_fee ? Number(docObj.consultation_fee).toFixed(2) : '500.00';
        setConsultationFeeInfo({
          consultation_fee: fallbackFee,
          formatted_amount: `₹${fallbackFee}`,
          fee_source: 'DOCTOR_PROFILE',
          department_name: docObj?.department_name || docObj?.specialization || 'General OPD',
        });
      })
      .finally(() => setLoadingFee(false));
  }, [isReceptionist, showBookModal, showWalkInModal, activeModalDoctorId, activeModalPatientId, doctors]);

  // Filtered patients for quick search inside Booking / Walk-in modals
  const filteredModalPatients = useMemo(() => {
    if (!patientSearchQuery.trim()) return patients;
    const q = patientSearchQuery.toLowerCase().trim();
    return patients.filter((p) => {
      const fullName = `${p.user_profile?.first_name || ''} ${p.user_profile?.last_name || ''} ${p.user_profile?.full_name || ''}`.toLowerCase();
      const mrn = (p.medical_record_number || '').toLowerCase();
      const phone = (p.user_profile?.phone_number || '').toLowerCase();
      return fullName.includes(q) || mrn.includes(q) || phone.includes(q);
    });
  }, [patients, patientSearchQuery]);

  // Inline Quick New Patient Registration Handler (Step 1 of Receptionist Workflow)
  const handleQuickPatientRegister = async () => {
    if (!quickFirstName.trim() || !quickLastName.trim() || !quickPhone.trim()) {
      setQuickRegError('First name, last name, and phone number are required to register a new patient.');
      return;
    }
    setQuickRegLoading(true);
    setQuickRegError(null);
    try {
      const created = await patientService.registerPatient({
        first_name: quickFirstName.trim(),
        last_name: quickLastName.trim(),
        phone_number: quickPhone.trim(),
        gender: quickGender,
        blood_group: quickBloodGroup,
        date_of_birth: quickDob || null,
        primary_branch_id: currentBranch?.id,
      });
      const updatedPatients = [created, ...patients];
      setPatients(updatedPatients);
      if (showWalkInModal) {
        setWalkInPatientId(created.id);
      } else {
        setBookingPatientId(created.id);
      }
      setShowQuickRegForm(false);
      setQuickFirstName('');
      setQuickLastName('');
      setQuickPhone('');
      setQuickDob('');
    } catch (err: any) {
      setQuickRegError(parseApiError(err).message);
    } finally {
      setQuickRegLoading(false);
    }
  };

  // Online Payment Step A: Generate Razorpay Order
  const handleGenerateOnlineOrder = async (bookingType: 'APPOINTMENT' | 'WALK_IN') => {
    const patId = bookingType === 'WALK_IN' ? walkInPatientId : bookingPatientId;
    const docId = bookingType === 'WALK_IN' ? walkInDoctorId : bookingDoctorId;
    if (!patId || !docId) {
      setOnlinePaymentError('Please select both a patient and a doctor before generating an online payment order.');
      return;
    }
    setGatewayProcessing(true);
    setOnlinePaymentError(null);
    try {
      const orderRes = await opdService.createPaymentOrder({
        patient_id: patId,
        doctor_id: docId,
        booking_type: bookingType,
      });
      setOnlineOrderData(orderRes);
      setOnlineVerifiedData(null);
      setOnlinePaymentStatus('ORDER_CREATED');
    } catch (err: any) {
      setOnlinePaymentStatus('FAILED');
      setOnlinePaymentError(parseApiError(err).message);
    } finally {
      setGatewayProcessing(false);
    }
  };

  // Online Payment Step B: Complete & Verify Gateway Payment (or Simulate Failure to test Retry)
  const handleCompleteOnlinePayment = async (simulateFailure: boolean = false) => {
    if (!onlineOrderData?.razorpay_order_id) {
      setOnlinePaymentError('Please generate a payment order first.');
      return;
    }
    setGatewayProcessing(true);
    setOnlinePaymentError(null);
    try {
      const authRes = await opdService.authorizeSandboxPaymentOrder({
        razorpay_order_id: onlineOrderData.razorpay_order_id,
        simulate_failure: simulateFailure,
      });
      setOnlineVerifiedData({
        razorpay_order_id: authRes.razorpay_order_id,
        razorpay_payment_id: authRes.razorpay_payment_id,
        razorpay_signature: authRes.razorpay_signature,
        amount: authRes.amount,
      });
      setOnlinePaymentStatus('VERIFIED');
    } catch (err: any) {
      setOnlineVerifiedData(null);
      setOnlinePaymentStatus('FAILED');
      setOnlinePaymentError(parseApiError(err).message);
    } finally {
      setGatewayProcessing(false);
    }
  };

  // 4. Handle Book Scheduled Appointment (Strictly Receptionist + Mandatory Payment)
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    if (!isReceptionist) {
      setBookingError('Access Denied: Only Receptionists are permitted to book appointments.');
      return;
    }
    if (!bookingPatientId) {
      setBookingError('Please select or register a patient.');
      return;
    }
    if (!selectedSlot) {
      setBookingError('Please select a valid available time slot.');
      return;
    }
    if (paymentMethod === 'CASH' && !cashReceivedConfirmed) {
      setBookingError(`Please confirm that ${consultationFeeInfo?.formatted_amount || 'the consultation fee'} in Cash has been received before confirming the appointment.`);
      return;
    }
    if (paymentMethod === 'ONLINE' && (!onlineVerifiedData || onlinePaymentStatus !== 'VERIFIED')) {
      setBookingError('Please complete and verify the Online (Razorpay) payment before confirming the appointment.');
      return;
    }

    setBookingLoading(true);
    try {
      const payload: any = {
        patient_id: bookingPatientId,
        doctor_id: bookingDoctorId,
        branch_id: currentBranch?.id,
        appointment_date: bookingDate,
        time_slot: selectedSlot,
        reason_for_visit: bookingReason || 'General Consultation',
        payment_method: paymentMethod,
      };
      if (paymentMethod === 'CASH') {
        payload.cash_received_confirmed = true;
        if (cashReferenceNote.trim()) payload.transaction_reference = cashReferenceNote.trim();
      } else {
        payload.razorpay_order_id = onlineVerifiedData!.razorpay_order_id;
        payload.razorpay_payment_id = onlineVerifiedData!.razorpay_payment_id;
        payload.razorpay_signature = onlineVerifiedData!.razorpay_signature;
      }

      const res = await clinicalService.bookAppointment(payload);
      setShowBookModal(false);
      setBookingReason('');
      resetPaymentState();
      if (res?.receipt || res?.token_receipt) {
        setTokenReceipt(res.receipt || res.token_receipt);
        setShowReceiptModal(true);
      }
      fetchOPDData();
    } catch (err: any) {
      setBookingError(parseApiError(err).message);
    } finally {
      setBookingLoading(false);
    }
  };

  // 5. Handle Walk-in Registration (Strictly Receptionist + Mandatory Payment)
  const handleWalkInRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    if (!isReceptionist) {
      setBookingError('Access Denied: Only Receptionists are permitted to issue walk-in tokens.');
      return;
    }
    if (!walkInPatientId) {
      setBookingError('Please select or register a patient.');
      return;
    }
    if (paymentMethod === 'CASH' && !cashReceivedConfirmed) {
      setBookingError(`Please confirm that ${consultationFeeInfo?.formatted_amount || 'the consultation fee'} in Cash has been received before issuing the token.`);
      return;
    }
    if (paymentMethod === 'ONLINE' && (!onlineVerifiedData || onlinePaymentStatus !== 'VERIFIED')) {
      setBookingError('Please complete and verify the Online (Razorpay) payment before issuing the token.');
      return;
    }

    setBookingLoading(true);
    try {
      const payload: any = {
        patient_id: walkInPatientId,
        doctor_id: walkInDoctorId,
        branch_id: currentBranch?.id,
        chief_complaint: walkInComplaint,
        vitals: walkInVitals,
        payment_method: paymentMethod,
      };
      if (paymentMethod === 'CASH') {
        payload.cash_received_confirmed = true;
        if (cashReferenceNote.trim()) payload.transaction_reference = cashReferenceNote.trim();
      } else {
        payload.razorpay_order_id = onlineVerifiedData!.razorpay_order_id;
        payload.razorpay_payment_id = onlineVerifiedData!.razorpay_payment_id;
        payload.razorpay_signature = onlineVerifiedData!.razorpay_signature;
      }

      const res = await opdService.registerWalkIn(payload);
      setShowWalkInModal(false);
      setTokenReceipt(res.receipt || res.token_receipt);
      setShowReceiptModal(true);
      setWalkInComplaint('');
      setWalkInVitals({ bp: '', pulse: '', temp: '', spo2: '' });
      resetPaymentState();
      fetchOPDData();
    } catch (err: any) {
      setBookingError(parseApiError(err).message);
    } finally {
      setBookingLoading(false);
    }
  };

  // Open Receipt Modal for any existing appointment in the queue
  const handleOpenReceiptForAppointment = async (appointmentId: string) => {
    try {
      const rec = await opdService.getAppointmentReceipt(appointmentId);
      setTokenReceipt(rec);
      setShowReceiptModal(true);
    } catch (err: any) {
      setPageError(parseApiError(err).message);
    }
  };

  // Download Printable HTML Receipt Slip
  const handleDownloadReceipt = (rec: any) => {
    if (!rec) return;
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payment & Token Receipt - ${rec.receipt_number || rec.appointment_number}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 32px; color: #0f172a; max-width: 680px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .hospital-name { font-size: 22px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
    .sub { font-size: 12px; color: #475569; margin-top: 4px; }
    .token-box { background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px; }
    .token-num { font-size: 32px; font-weight: 800; color: #0369a1; }
    .grid { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .grid td { padding: 8px 4px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .label { color: #64748b; font-weight: 600; width: 42%; }
    .val { color: #0f172a; font-weight: 700; text-align: right; }
    .paid-badge { display: inline-block; background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 12px; }
    .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 28px; border-top: 1px solid #cbd5e1; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="hospital-name">${rec.hospital_name || 'AURA Multi-Specialty Hospital'}</div>
    <div class="sub">${rec.branch_name || 'Main Branch'} • ${rec.hospital_address || ''}</div>
    <div class="sub">Phone: ${rec.hospital_phone || '+91 40 2345 6789'} • Email: ${rec.hospital_email || 'billing@aurahospital.org'}</div>
    <div style="margin-top:10px; font-weight:700; font-size:14px;">OFFICIAL OPD CONSULTATION & PAYMENT RECEIPT</div>
  </div>
  <div class="token-box">
    <div style="font-size:11px; text-transform:uppercase; color:#0369a1; font-weight:700;">Queue Token Number</div>
    <div class="token-num">${rec.token_number || '—'}</div>
    <div style="font-size:12px; color:#334155; margin-top:4px;">Appointment Ref: <strong>${rec.appointment_number || ''}</strong> (${rec.appointment_type || 'OPD'})</div>
  </div>
  <table class="grid">
    <tr><td class="label">Receipt Number</td><td class="val">${rec.receipt_number || '—'}</td></tr>
    <tr><td class="label">Invoice Number</td><td class="val">${rec.invoice_number || '—'}</td></tr>
    <tr><td class="label">Payment Date & Time</td><td class="val">${rec.payment_date_display || `${rec.date || ''} ${rec.check_in_time || ''}`}</td></tr>
    <tr><td class="label">Patient Name & MRN</td><td class="val">${rec.patient_name} (${rec.patient_mrn})</td></tr>
    <tr><td class="label">Consulting Doctor</td><td class="val">Dr. ${rec.doctor_name} (${rec.specialization || ''})</td></tr>
    <tr><td class="label">Department</td><td class="val">${rec.department_name || 'General OPD'}</td></tr>
    <tr><td class="label">Appointment Date / Slot</td><td class="val">${rec.appointment_date || rec.date} • ${rec.time_slot || rec.check_in_time}</td></tr>
    <tr><td class="label">Consultation Fee</td><td class="val">₹${rec.consultation_fee}</td></tr>
    <tr><td class="label">Amount Paid (INR)</td><td class="val" style="color:#15803d; font-size:15px;">₹${rec.amount_paid || rec.consultation_fee}</td></tr>
    <tr><td class="label">Balance Due</td><td class="val">₹${rec.balance_amount || '0.00'}</td></tr>
    <tr><td class="label">Payment Method</td><td class="val">${rec.payment_method || 'CASH'}</td></tr>
    <tr><td class="label">Transaction / Ref ID</td><td class="val">${rec.transaction_reference || '—'}</td></tr>
    <tr><td class="label">Payment Status</td><td class="val"><span class="paid-badge">${rec.payment_status || 'PAID'}</span></td></tr>
    <tr><td class="label">Processed By (Receptionist)</td><td class="val">${rec.processed_by_name || 'Reception Desk'} ${rec.processed_by_employee_id ? `(${rec.processed_by_employee_id})` : ''}</td></tr>
  </table>
  <div class="footer">
    Thank you for choosing ${rec.hospital_name || 'AURA Multi-Specialty Hospital'}. This is a computer-generated payment receipt.
  </div>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt_${rec.receipt_number || rec.appointment_number || 'OPD'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 6. Queue Actions Execution
  const handleQueueAction = async (aptId: string, action: string, payload?: any) => {
    if (['NO_SHOW', 'CANCEL', 'START_CONSULTATION', 'CALL_NEXT'].includes(action) && !canConductConsultation) {
      setPageError('Access Denied (403 Forbidden): Only attending doctors are authorized to mark appointments as No Show or Cancel consultations.');
      return;
    }
    try {
      await opdService.executeQueueAction(aptId, action, payload);
      fetchOPDData();
    } catch (err: any) {
      setPageError(parseApiError(err).message);
    }
  };

  // 7. Open Consultation Workspace
  const handleOpenConsultation = async (item: QueueItem) => {
    if (!canConductConsultation) {
      setPageError('Access Denied: Only attending doctors and clinical directors are authorized to conduct consultations.');
      return;
    }
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
  // Handle items extracted from Voice Prescription Modal
  const handleApplyVoicePrescriptions = (items: StructuredPrescriptionItem[]) => {
    const formatted = items.map((item) => {
      // Build dosage string
      const dosageStr = item.dosage_form ? `${item.dose_amount || '1'} ${item.dose_unit || 'Tablet'}` : (item.strength || '1 Tablet');

      // Build timing and frequency instructions
      const timingParts = [];
      if (item.schedule?.morning) timingParts.push(`M:${item.schedule.morning_dose || '1'}`);
      if (item.schedule?.afternoon) timingParts.push(`A:${item.schedule.afternoon_dose || '1'}`);
      if (item.schedule?.evening) timingParts.push(`E:${item.schedule.evening_dose || '1'}`);
      if (item.schedule?.night) timingParts.push(`N:${item.schedule.night_dose || '1'}`);
      const schedStr = timingParts.length > 0 ? ` [${timingParts.join('-')}]` : '';

      const foodStr = item.food_instruction ? ` (${item.food_instruction.replace('_', ' ')})` : '';
      const freqFormatted = `${item.frequency || '1-0-1'}${schedStr}${foodStr}`;

      return {
        medicine_id: item.medicine_id || 'fb3ef1cc-4d06-4f95-a9f5-6aaef3c50aa5',
        dosage: dosageStr,
        frequency: freqFormatted,
        duration_days: item.duration_days || 5,
        total_quantity: item.total_quantity || 10,
        instructions: item.instructions || 'Take as prescribed',
        food_instruction: item.food_instruction || 'AFTER_FOOD',
        route: item.route || 'Oral',
        is_prn: !!item.is_prn,
        prn_indication: item.prn_indication || '',
        morning: item.schedule?.morning ?? true,
        morning_dose: item.schedule?.morning_dose || '1',
        afternoon: item.schedule?.afternoon ?? false,
        afternoon_dose: item.schedule?.afternoon_dose || '0',
        evening: item.schedule?.evening ?? false,
        evening_dose: item.schedule?.evening_dose || '0',
        night: item.schedule?.night ?? true,
        night_dose: item.schedule?.night_dose || '1',
      };
    });

    setRxItems((prev) => [...prev, ...formatted]);
  };

  const handleAddRxItem = async () => {
    let availableMeds = encounterData?.medicines || [];

    if (availableMeds.length === 0) {
      try {
        const res = await pharmacyService.getMedicines({ page_size: 50 });
        const fetched = Array.isArray(res) ? res : res?.results || [];
        if (fetched.length > 0) {
          availableMeds = fetched;
          setEncounterData((prev: any) => ({ ...(prev || {}), medicines: fetched }));
        }
      } catch (err) {
        console.warn('Could not fetch pharmacy formulary fallback:', err);
      }
    }

    const defaultMedId = availableMeds[0]?.id || 'fb3ef1cc-4d06-4f95-a9f5-6aaef3c50aa5';

    setRxItems((prev) => [
      ...prev,
      {
        medicine_id: defaultMedId,
        dosage: '1 Tablet',
        frequency: '1-0-1 (After Food)',
        duration_days: 5,
        total_quantity: 10,
        instructions: 'Take after meals',
        food_instruction: 'AFTER_FOOD',
        route: 'Oral',
        is_prn: false,
        morning: true,
        morning_dose: '1',
        afternoon: false,
        afternoon_dose: '0',
        evening: false,
        evening_dose: '0',
        night: true,
        night_dose: '1',
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
        return <Badge variant="info">{t('appointments.statusScheduled', 'Scheduled')}</Badge>;
      case 'CHECKED_IN':
        return <Badge variant="warning">{t('appointments.statusCheckedIn', 'Checked In (Waiting)')}</Badge>;
      case 'IN_CONSULTATION':
        return <Badge variant="accent">{t('appointments.statusInConsultation', 'In Consultation')}</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">{t('appointments.statusCompleted', 'Completed')}</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">{t('appointments.statusCancelled', 'Cancelled')}</Badge>;
      case 'NO_SHOW':
        return <Badge variant="neutral">{t('appointments.statusNoShow', 'No Show')}</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Queue Columns
  const queueColumns: Column<QueueItem>[] = useMemo(
    () => [
      {
        key: 'token_number',
        header: t('appointments.tokenHeader', 'Token #'),
        render: (item) => (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-cyan-300 font-extrabold px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-xs shadow-sm">
              {item.token_number || '—'}
            </span>
            {item.appointment_type === 'WALK_IN' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                {t('appointments.walkIn', 'Walk-in')}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'patient_name',
        header: t('appointments.patientInfoHeader', 'Patient Info'),
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
                {t('patients.allergies', 'Allergies')}: {item.patient_allergies.join(', ')}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'doctor_name',
        header: t('appointments.doctorDeptHeader', 'Doctor & Department'),
        render: (item) => (
          <div>
            <div className="text-slate-200 font-medium">Dr. {item.doctor_name}</div>
            <div className="text-[11px] text-slate-400">{item.doctor_specialization || item.department_name}</div>
          </div>
        ),
      },
      {
        key: 'time_slot',
        header: t('appointments.slotCheckInHeader', 'Slot / Check-In'),
        render: (item) => (
          <div className="text-xs">
            {item.appointment_date && (
              <div className="text-[11px] text-cyan-400 font-semibold mb-0.5 font-mono">
                {item.appointment_date}
              </div>
            )}
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
        header: t('appointments.waitTimeHeader', 'Wait Time'),
        render: (item) => (
          <div>
            {item.status === 'CHECKED_IN' ? (
              <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${item.wait_minutes > 30
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                {item.wait_minutes} min
              </span>
            ) : item.status === 'IN_CONSULTATION' ? (
              <span className="text-xs text-cyan-400 font-medium animate-pulse flex items-center gap-1">
                <Activity className="w-3 h-3" /> {t('appointments.statusInConsultation', 'In Consultation')}
              </span>
            ) : (
              <span className="text-xs text-slate-500">—</span>
            )}
          </div>
        ),
      },
      {
        key: 'status',
        header: t('common.status', 'Status'),
        render: (item) => getStatusBadge(item.status),
      },
      {
        key: 'invoice_status',
        header: t('billing.invoiceNumber', 'Fee / Invoice'),
        render: (item) => (
          <div className="text-xs">
            {item.invoice_number ? (
              <div>
                <div className="font-mono text-[11px] text-slate-300 font-semibold">
                  ₹{item.paid_amount || item.doctor_fee || '500.00'}
                </div>
                <span className="font-mono text-[10px] text-slate-400">{item.invoice_number}</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[10px] font-semibold ${item.invoice_status === 'PAID' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                    {item.invoice_status}
                  </span>
                  {item.payment_method && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono">
                      {item.payment_method}
                    </span>
                  )}
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
        header: t('appointments.queueActionsHeader', 'Queue Actions'),
        align: 'right',
        render: (item) => (
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            {item.invoice_number && (
              <button
                onClick={() => handleOpenReceiptForAppointment(item.id)}
                className="px-2 py-1 text-xs font-medium rounded-lg bg-slate-800/80 text-cyan-300 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1"
                title="View / Print Payment & Token Receipt"
              >
                <Receipt className="w-3 h-3" /> Receipt
              </button>
            )}

            {item.status === 'SCHEDULED' && (
              <button
                onClick={() => handleQueueAction(item.id, 'CHECK_IN')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition shadow-sm"
              >
                {t('appointments.checkIn', 'Check In')}
              </button>
            )}

            {item.status === 'CHECKED_IN' && (
              <>
                <button
                  onClick={() => {
                    setSelectedTriageItem(item);
                    setTriageVitals({
                      bp: item.vitals?.bp || '',
                      pulse: item.vitals?.pulse || item.vitals?.heart_rate || '',
                      temp: item.vitals?.temp || '',
                      spo2: item.vitals?.spo2 || '',
                      weight: item.vitals?.weight || '',
                      height: item.vitals?.height || '',
                      respRate: item.vitals?.respRate || ''
                    });
                    setShowTriageModal(true);
                  }}
                  className="px-2 py-1 text-xs text-amber-300 hover:text-white bg-amber-950/60 hover:bg-amber-900 border border-amber-800/60 rounded-lg transition shadow-sm flex items-center gap-1"
                  title="Log / Update Pre-Consultation Triage Vitals"
                >
                  <Activity className="w-3 h-3" /> Triage
                </button>
                <button
                  onClick={() => handleDownloadReceipt(item.receipt || item)}
                  className="px-2 py-1 text-xs text-cyan-300 hover:text-white bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/60 rounded-lg transition shadow-sm flex items-center gap-1"
                  title="Print 80mm Queue Token Slip"
                >
                  <Printer className="w-3 h-3" /> Slip
                </button>
                {canConductConsultation ? (
                  <button
                    onClick={() => handleOpenConsultation(item)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition shadow-sm flex items-center gap-1"
                  >
                    <Stethoscope className="w-3 h-3" /> {t('appointments.callInConsult', 'Call In & Consult')}
                  </button>
                ) : (
                  <span className="px-2 py-1 text-[11px] font-medium text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" /> Waiting in Lounge
                  </span>
                )}
                {canConductConsultation && (
                  <button
                    onClick={() => handleQueueAction(item.id, 'NO_SHOW')}
                    className="px-2 py-1 text-xs text-slate-400 hover:text-rose-400 transition"
                    title={t('appointments.noShow', 'No Show')}
                  >
                    {t('appointments.noShow', 'No Show')}
                  </button>
                )}
              </>
            )}

            {item.status === 'IN_CONSULTATION' && (
              canConductConsultation ? (
                <button
                  onClick={() => handleOpenConsultation(item)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 hover:brightness-110 transition shadow-sm flex items-center gap-1"
                >
                  <FileText className="w-3 h-3" /> {t('appointments.resumeRx', 'Resume / Finalize Rx')}
                </button>
              ) : (
                <span className="px-2.5 py-1 text-[11px] font-medium text-cyan-300/90 bg-cyan-500/10 border border-cyan-500/20 rounded-lg flex items-center gap-1.5 animate-pulse">
                  <Activity className="w-3 h-3 text-cyan-400" /> In Consultation
                </span>
              )
            )}

            {item.status === 'COMPLETED' && (
              <span className="text-xs text-emerald-400/80 font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {t('appointments.statusCompleted', 'Completed')}
              </span>
            )}

            {item.status === 'CANCELLED' && (
              <span className="text-xs text-rose-400/80 font-medium flex items-center gap-1">
                <Ban className="w-3 h-3" /> {t('appointments.statusCancelled', 'Cancelled')}
              </span>
            )}

            {item.status === 'NO_SHOW' && (
              <span className="text-xs text-slate-400/80 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> {t('appointments.statusNoShow', 'No Show')}
              </span>
            )}

            {canConductConsultation && ['SCHEDULED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(item.status) && (
              <button
                onClick={() => {
                  setCancelModalItem(item);
                  setCancelReason(item.status === 'IN_CONSULTATION' ? 'Consultation cancelled by doctor' : 'Cancelled by doctor');
                }}
                className="px-2 py-1 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition"
                title={t('common.cancel', 'Cancel')}
              >
                {t('common.cancel', 'Cancel')}
              </button>
            )}
          </div>
        ),
      },
    ],
    [t, queue]
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {pageError && (
        <AlertBanner
          variant="error"
          title="Authorization / Operation Notice"
          message={pageError}
          onClose={() => setPageError(null)}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Stethoscope className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {t('navigation.appointments', 'Outpatient Department (OPD) & Appointments')}
              </h1>
              <p className="text-xs text-slate-400">
                {t('appointments.subtitle', 'Multi-Specialty Clinic Management • Collision Prevention • Walk-in Tokens • Integrated EMR & Rx')}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons — Strictly Receptionist Only for Booking & Token Issuing */}
        <div className="flex items-center gap-2 flex-wrap">
          {isReceptionist && (
            <>
              <button
                onClick={() => {
                  setBookingError(null);
                  resetPaymentState();
                  setShowWalkInModal(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold text-xs hover:bg-amber-500/25 transition shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                {t('appointments.walkInToken', 'Walk-in Token')}
              </button>
              <button
                onClick={() => {
                  setBookingError(null);
                  resetPaymentState();
                  setShowBookModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold text-xs hover:brightness-110 shadow-lg shadow-cyan-500/20 transition"
              >
                <Plus className="w-4 h-4" />
                {t('appointments.bookAppointment', 'Book Appointment')}
              </button>
            </>
          )}
          <button
            onClick={() => setShowLoungeTVModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold shadow-sm transition"
            title="Launch Real-Time Lounge TV with Interactive Doctor Filters"
          >
            <Tv className="w-4 h-4 text-amber-400" />
            <span>Lounge TV</span>
          </button>
          <a
            href="/lounge-tv"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            title="Open Lounge TV in Dedicated Window / TV Display"
          >
            <Tv className="w-4 h-4 text-cyan-400" />
          </a>
          <button
            onClick={fetchOPDData}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title={t('appointments.refreshQueue', 'Refresh OPD Queue')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto custom-scrollbar whitespace-nowrap">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${activeTab === 'queue'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
        >
          <Activity className="w-4 h-4" />
          {t('appointments.liveQueueTab', 'Live OPD Queue & Dashboard')}
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${activeTab === 'schedules'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
        >
          <CalendarCheck className="w-4 h-4" />
          {t('appointments.schedulesTab', 'Doctor Availability & Rosters')}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${activeTab === 'reports'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
        >
          <TrendingUp className="w-4 h-4" />
          {t('appointments.reportsTab', 'Doctor & OPD Analytics Reports')}
        </button>
      </div>

      {/* TAB 1: Live OPD Queue & Dashboard */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              title={t('dashboard.todayAppointments', "Today's Appointments")}
              value={stats ? stats.total_appointments.toString() : '0'}
              icon={Calendar}
            />
            <StatCard
              title={t('appointments.waiting', 'Waiting in Queue')}
              value={stats ? stats.waiting.toString() : '0'}
              icon={Clock}
            />
            <StatCard
              title={t('appointments.inConsultation', 'In Consultation')}
              value={stats ? stats.in_consultation.toString() : '0'}
              icon={Stethoscope}
            />
            <StatCard
              title={t('appointments.completed', 'Completed Today')}
              value={stats ? stats.completed.toString() : '0'}
              icon={CheckCircle}
            />
            <StatCard
              title={t('dashboard.pendingReports', 'Avg Wait Duration')}
              value={stats ? `${stats.average_wait_minutes} min` : '0 min'}
              icon={Activity}
            />
            <StatCard
              title={t('common.activeClinician', 'Doctors on Duty')}
              value={stats ? stats.available_doctors_count.toString() : '0'}
              icon={User}
            />
          </div>

          {/* OPD Queue Filters Bar */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              {/* Date Selector & Quick Filters */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  type="date"
                  value={selectedDate === 'UPCOMING' ? '' : selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-36 px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(getLocalTodayDateString())}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition ${selectedDate === getLocalTodayDateString()
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(getLocalTodayDateString(1));
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition ${selectedDate === getLocalTodayDateString(1)
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate('UPCOMING')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition ${selectedDate === 'UPCOMING'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                >
                  All Upcoming
                </button>
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
                      {getDoctorLabel(d)}
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
                Patient Queue {selectedDate === 'UPCOMING' ? '— All Upcoming Consultations' : `for ${selectedDate}`} ({queue.length} Total Patients)
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
                    {getDoctorLabel(d)}
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

      
      {/* Triage Vitals Modal */}
      {showTriageModal && selectedTriageItem && (
        <Modal
          isOpen={showTriageModal}
          onClose={() => setShowTriageModal(false)}
          title={`Pre-Consultation Nursing Triage Vitals — ${selectedTriageItem.patient_name} (Token #${String(selectedTriageItem.token_number || '-').replace(/^(token\s*#*|#)+/i, '').trim()})`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Record vital signs before patient enters doctor consultation. These vitals automatically populate in the doctor's clinical workspace.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Blood Pressure</label>
                <input
                  type="text"
                  placeholder="120/80"
                  value={triageVitals.bp}
                  onChange={(e) => setTriageVitals({ ...triageVitals, bp: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Pulse Rate (bpm)</label>
                <input
                  type="text"
                  placeholder="72"
                  value={triageVitals.pulse}
                  onChange={(e) => setTriageVitals({ ...triageVitals, pulse: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Temperature (°F)</label>
                <input
                  type="text"
                  placeholder="98.4"
                  value={triageVitals.temp}
                  onChange={(e) => setTriageVitals({ ...triageVitals, temp: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Oxygen SpO2 (%)</label>
                <input
                  type="text"
                  placeholder="99"
                  value={triageVitals.spo2}
                  onChange={(e) => setTriageVitals({ ...triageVitals, spo2: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Weight (kg)</label>
                <input
                  type="number"
                  placeholder="70"
                  value={triageVitals.weight}
                  onChange={(e) => setTriageVitals({ ...triageVitals, weight: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Height (cm)</label>
                <input
                  type="number"
                  placeholder="170"
                  value={triageVitals.height}
                  onChange={(e) => setTriageVitals({ ...triageVitals, height: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowTriageModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingTriage}
                onClick={handleSaveTriageVitals}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition shadow-sm"
              >
                {savingTriage ? 'Saving...' : 'Save Triage Vitals'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 1: Book Scheduled Appointment (Strictly Receptionist + Mandatory Payment) */}
      {isReceptionist && (
        <Modal
          isOpen={showBookModal}
          onClose={() => setShowBookModal(false)}
          title="Schedule Outpatient Appointment & Collect Consultation Fee"
          size="lg"
        >
          <form onSubmit={handleBookAppointment} className="space-y-4">
            {bookingError && <AlertBanner variant="error" title="Booking / Payment Error" message={bookingError} />}

            {/* Step 1: Search Existing Patient or Register New Patient */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  1. Select Existing Patient or Register New Patient
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickRegForm(!showQuickRegForm)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" />
                  {showQuickRegForm ? 'Use Existing Patient List' : '+ Register New Patient'}
                </button>
              </div>

              {showQuickRegForm ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-3">
                  <div className="text-xs font-semibold text-cyan-300">Quick Patient Registration</div>
                  {quickRegError && <div className="text-xs text-rose-400">{quickRegError}</div>}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      placeholder="First Name *"
                      value={quickFirstName}
                      onChange={(e) => setQuickFirstName(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Last Name *"
                      value={quickLastName}
                      onChange={(e) => setQuickLastName(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Phone Number *"
                      value={quickPhone}
                      onChange={(e) => setQuickPhone(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select
                      value={quickGender}
                      onChange={(e) => setQuickGender(e.target.value as 'MALE' | 'FEMALE' | 'OTHER')}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <input
                      type="date"
                      value={quickDob}
                      onChange={(e) => setQuickDob(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={quickRegLoading}
                      onClick={handleQuickPatientRegister}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition disabled:opacity-50"
                    >
                      {quickRegLoading ? 'Registering...' : 'Save & Select Patient'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Filter Patient by Name / MRN / Phone</label>
                    <input
                      type="text"
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                      placeholder="Type to search patient..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <Select
                    label="Select Patient"
                    value={bookingPatientId}
                    onChange={(e) => setBookingPatientId(e.target.value)}
                    options={filteredModalPatients.map((p: any) => ({
                      value: p.id,
                      label: `${p.user_profile?.first_name} ${p.user_profile?.last_name} (${p.medical_record_number})`,
                    }))}
                    required
                  />
                </div>
              )}
            </div>

            {/* Step 2: Doctor, Date, and Visit Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="2. Consulting Doctor & Department"
                value={bookingDoctorId}
                onChange={(e) => {
                  setBookingDoctorId(e.target.value);
                  resetPaymentState();
                }}
                options={doctors.map((d) => ({
                  value: d.id,
                  label: getDoctorLabel(d),
                }))}
                required
              />

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
                placeholder="e.g. Follow-up consultation, fever"
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
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  Applicable Consultation Fee: {consultationFeeInfo?.formatted_amount || `₹${doctorSlots?.consultation_fee || '500.00'}`}
                </span>
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
                      className={`px-2.5 py-2 rounded-xl text-xs font-mono transition text-center ${s.is_booked
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

            {/* Step 3 & 4: Mandatory Consultation Fee & Payment Collection */}
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    3. Mandatory Consultation Fee Collection
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {consultationFeeInfo?.department_name ? `${consultationFeeInfo.department_name} • ` : ''}
                    Payment must be completed before confirming the appointment or generating a token.
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Payable Amount</div>
                  <div className="text-lg font-extrabold text-emerald-400 font-mono">
                    {loadingFee ? '...' : consultationFeeInfo?.formatted_amount || '₹500.00'}
                  </div>
                </div>
              </div>

              {/* Payment Method Selector: Cash or Online */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('CASH');
                    setBookingError(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${paymentMethod === 'CASH'
                      ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                >
                  <Banknote className={`w-5 h-5 ${paymentMethod === 'CASH' ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="text-xs font-bold">Cash Payment</div>
                    <div className="text-[10px] text-slate-400">Collect cash at reception counter</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('ONLINE');
                    setBookingError(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${paymentMethod === 'ONLINE'
                      ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                >
                  <CreditCard className={`w-5 h-5 ${paymentMethod === 'ONLINE' ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="text-xs font-bold">Online Payment (Razorpay)</div>
                    <div className="text-[10px] text-slate-400">UPI / Card / NetBanking gateway</div>
                  </div>
                </button>
              </div>

              {/* Cash Payment Confirmation Box */}
              {paymentMethod === 'CASH' && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={cashReceivedConfirmed}
                      onChange={(e) => setCashReceivedConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <span>
                      I confirm that <strong className="text-emerald-400 font-mono">{consultationFeeInfo?.formatted_amount || '₹500.00'}</strong> in Cash has been received from the patient at the reception counter.
                    </span>
                  </label>
                  <input
                    type="text"
                    value={cashReferenceNote}
                    onChange={(e) => setCashReferenceNote(e.target.value)}
                    placeholder="Optional cash receipt / counter voucher note"
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300"
                  />
                </div>
              )}

              {/* Online Payment Gateway Box */}
              {paymentMethod === 'ONLINE' && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      Razorpay Gateway Verification Status:
                    </span>
                    <Badge
                      variant={
                        onlinePaymentStatus === 'VERIFIED'
                          ? 'success'
                          : onlinePaymentStatus === 'FAILED'
                            ? 'danger'
                            : onlinePaymentStatus === 'ORDER_CREATED'
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {onlinePaymentStatus}
                    </Badge>
                  </div>
                  {onlinePaymentError && <div className="text-xs text-rose-400">{onlinePaymentError}</div>}

                  {onlinePaymentStatus === 'IDLE' && (
                    <button
                      type="button"
                      disabled={gatewayProcessing}
                      onClick={() => handleGenerateOnlineOrder('APPOINTMENT')}
                      className="w-full py-2 px-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 font-bold text-xs transition"
                    >
                      {gatewayProcessing ? 'Creating Gateway Order...' : `1. Generate Online Payment Order (${consultationFeeInfo?.formatted_amount || '₹500.00'})`}
                    </button>
                  )}

                  {onlinePaymentStatus === 'ORDER_CREATED' && onlineOrderData && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-slate-400 font-mono">
                        Gateway Order ID: <span className="text-cyan-300">{onlineOrderData.razorpay_order_id}</span> • Amount: <span className="text-emerald-400">{onlineOrderData.formatted_amount}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          disabled={gatewayProcessing}
                          onClick={() => handleCompleteOnlinePayment(false)}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition"
                        >
                          {gatewayProcessing ? 'Verifying Signature...' : '2. Complete & Verify Online Payment'}
                        </button>
                        <button
                          type="button"
                          disabled={gatewayProcessing}
                          onClick={() => handleCompleteOnlinePayment(true)}
                          className="py-2 px-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold hover:bg-rose-500/25 transition"
                        >
                          Simulate Gateway Failure
                        </button>
                      </div>
                    </div>
                  )}

                  {onlinePaymentStatus === 'FAILED' && (
                    <div className="space-y-2">
                      <div className="text-xs text-rose-400">
                        Online payment failed or was declined. Appointment booking is blocked until payment succeeds.
                      </div>
                      <button
                        type="button"
                        disabled={gatewayProcessing}
                        onClick={() => handleGenerateOnlineOrder('APPOINTMENT')}
                        className="py-1.5 px-3 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition"
                      >
                        Retry Online Payment
                      </button>
                    </div>
                  )}

                  {onlinePaymentStatus === 'VERIFIED' && onlineVerifiedData && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                      <span>
                        Verified Payment Ref: <strong className="font-mono">{onlineVerifiedData.razorpay_payment_id}</strong>
                      </span>
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
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
                disabled={
                  bookingLoading ||
                  !selectedSlot ||
                  doctorSlots?.is_on_leave ||
                  (paymentMethod === 'CASH' && !cashReceivedConfirmed) ||
                  (paymentMethod === 'ONLINE' && onlinePaymentStatus !== 'VERIFIED')
                }
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold hover:brightness-110 disabled:opacity-50 transition"
              >
                {bookingLoading ? 'Processing Payment & Booking...' : `Confirm Payment (${consultationFeeInfo?.formatted_amount || '₹500.00'}) & Book Appointment`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: OPD Walk-in Registration & Queue Token (Strictly Receptionist + Mandatory Payment) */}
      {isReceptionist && (
        <Modal
          isOpen={showWalkInModal}
          onClose={() => setShowWalkInModal(false)}
          title="OPD Walk-in Registration, Payment & Queue Token"
          size="lg"
        >
          <form onSubmit={handleWalkInRegistration} className="space-y-4">
            {bookingError && <AlertBanner variant="error" title="Walk-in / Payment Error" message={bookingError} />}

            {/* Step 1: Search Existing Patient or Register New Patient */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  1. Select Existing Patient or Register New Patient
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickRegForm(!showQuickRegForm)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" />
                  {showQuickRegForm ? 'Use Existing Patient List' : '+ Register New Patient'}
                </button>
              </div>

              {showQuickRegForm ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/30 space-y-3">
                  <div className="text-xs font-semibold text-amber-300">Quick Patient Registration</div>
                  {quickRegError && <div className="text-xs text-rose-400">{quickRegError}</div>}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      placeholder="First Name *"
                      value={quickFirstName}
                      onChange={(e) => setQuickFirstName(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Last Name *"
                      value={quickLastName}
                      onChange={(e) => setQuickLastName(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="Phone Number *"
                      value={quickPhone}
                      onChange={(e) => setQuickPhone(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select
                      value={quickGender}
                      onChange={(e) => setQuickGender(e.target.value as 'MALE' | 'FEMALE' | 'OTHER')}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <input
                      type="date"
                      value={quickDob}
                      onChange={(e) => setQuickDob(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={quickRegLoading}
                      onClick={handleQuickPatientRegister}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition disabled:opacity-50"
                    >
                      {quickRegLoading ? 'Registering...' : 'Save & Select Patient'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Filter Patient by Name / MRN / Phone</label>
                    <input
                      type="text"
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                      placeholder="Type to search patient..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <Select
                    label="Select Patient"
                    value={walkInPatientId}
                    onChange={(e) => setWalkInPatientId(e.target.value)}
                    options={filteredModalPatients.map((p: any) => ({
                      value: p.id,
                      label: `${p.user_profile?.first_name} ${p.user_profile?.last_name} (${p.medical_record_number})`,
                    }))}
                    required
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="2. Attending Doctor / Department"
                value={walkInDoctorId}
                onChange={(e) => {
                  setWalkInDoctorId(e.target.value);
                  resetPaymentState();
                }}
                options={doctors.map((d) => ({
                  value: d.id,
                  label: getDoctorLabel(d),
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
            </div>

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

            {/* Step 3 & 4: Mandatory Consultation Fee & Payment Collection */}
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    3. Mandatory Consultation / Token Fee Collection
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {consultationFeeInfo?.department_name ? `${consultationFeeInfo.department_name} • ` : ''}
                    Payment must be verified before issuing the walk-in token.
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Payable Amount</div>
                  <div className="text-lg font-extrabold text-emerald-400 font-mono">
                    {loadingFee ? '...' : consultationFeeInfo?.formatted_amount || '₹500.00'}
                  </div>
                </div>
              </div>

              {/* Payment Method Selector: Cash or Online */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('CASH');
                    setBookingError(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${paymentMethod === 'CASH'
                      ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                >
                  <Banknote className={`w-5 h-5 ${paymentMethod === 'CASH' ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="text-xs font-bold">Cash Payment</div>
                    <div className="text-[10px] text-slate-400">Collect cash at reception counter</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('ONLINE');
                    setBookingError(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${paymentMethod === 'ONLINE'
                      ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                >
                  <CreditCard className={`w-5 h-5 ${paymentMethod === 'ONLINE' ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="text-xs font-bold">Online Payment (Razorpay)</div>
                    <div className="text-[10px] text-slate-400">UPI / Card / NetBanking gateway</div>
                  </div>
                </button>
              </div>

              {paymentMethod === 'CASH' && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={cashReceivedConfirmed}
                      onChange={(e) => setCashReceivedConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <span>
                      I confirm that <strong className="text-emerald-400 font-mono">{consultationFeeInfo?.formatted_amount || '₹500.00'}</strong> in Cash has been received from the patient at the reception counter.
                    </span>
                  </label>
                  <input
                    type="text"
                    value={cashReferenceNote}
                    onChange={(e) => setCashReferenceNote(e.target.value)}
                    placeholder="Optional cash receipt / counter voucher note"
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300"
                  />
                </div>
              )}

              {paymentMethod === 'ONLINE' && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      Razorpay Gateway Verification Status:
                    </span>
                    <Badge
                      variant={
                        onlinePaymentStatus === 'VERIFIED'
                          ? 'success'
                          : onlinePaymentStatus === 'FAILED'
                            ? 'danger'
                            : onlinePaymentStatus === 'ORDER_CREATED'
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {onlinePaymentStatus}
                    </Badge>
                  </div>
                  {onlinePaymentError && <div className="text-xs text-rose-400">{onlinePaymentError}</div>}

                  {onlinePaymentStatus === 'IDLE' && (
                    <button
                      type="button"
                      disabled={gatewayProcessing}
                      onClick={() => handleGenerateOnlineOrder('WALK_IN')}
                      className="w-full py-2 px-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 font-bold text-xs transition"
                    >
                      {gatewayProcessing ? 'Creating Gateway Order...' : `1. Generate Online Payment Order (${consultationFeeInfo?.formatted_amount || '₹500.00'})`}
                    </button>
                  )}

                  {onlinePaymentStatus === 'ORDER_CREATED' && onlineOrderData && (
                    <div className="space-y-2">
                      <div className="text-[11px] text-slate-400 font-mono">
                        Gateway Order ID: <span className="text-cyan-300">{onlineOrderData.razorpay_order_id}</span> • Amount: <span className="text-emerald-400">{onlineOrderData.formatted_amount}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          disabled={gatewayProcessing}
                          onClick={() => handleCompleteOnlinePayment(false)}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition"
                        >
                          {gatewayProcessing ? 'Verifying Signature...' : '2. Complete & Verify Online Payment'}
                        </button>
                        <button
                          type="button"
                          disabled={gatewayProcessing}
                          onClick={() => handleCompleteOnlinePayment(true)}
                          className="py-2 px-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold hover:bg-rose-500/25 transition"
                        >
                          Simulate Gateway Failure
                        </button>
                      </div>
                    </div>
                  )}

                  {onlinePaymentStatus === 'FAILED' && (
                    <div className="space-y-2">
                      <div className="text-xs text-rose-400">
                        Online payment failed or was declined. Token generation is blocked until payment succeeds.
                      </div>
                      <button
                        type="button"
                        disabled={gatewayProcessing}
                        onClick={() => handleGenerateOnlineOrder('WALK_IN')}
                        className="py-1.5 px-3 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition"
                      >
                        Retry Online Payment
                      </button>
                    </div>
                  )}

                  {onlinePaymentStatus === 'VERIFIED' && onlineVerifiedData && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                      <span>
                        Verified Payment Ref: <strong className="font-mono">{onlineVerifiedData.razorpay_payment_id}</strong>
                      </span>
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                </div>
              )}
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
                disabled={
                  bookingLoading ||
                  (paymentMethod === 'CASH' && !cashReceivedConfirmed) ||
                  (paymentMethod === 'ONLINE' && onlinePaymentStatus !== 'VERIFIED')
                }
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold hover:brightness-110 disabled:opacity-50 transition"
              >
                {bookingLoading ? 'Generating Token & Receipt...' : `Confirm Payment (${consultationFeeInfo?.formatted_amount || '₹500.00'}) & Issue Token`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: Printable & Downloadable OPD Payment & Queue Token Receipt */}
      {tokenReceipt && (
        <Modal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          title="Official OPD Payment & Queue Token Receipt"
          size="md"
        >
          <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-4 font-mono">
            <div>
              <div className="text-sm font-extrabold uppercase tracking-wider text-white">
                {tokenReceipt.hospital_name || 'AURA Multi-Specialty Hospital'}
              </div>
              <div className="text-[11px] text-slate-400">
                {tokenReceipt.branch_name || 'Main Hospital Branch'} {tokenReceipt.hospital_address ? `• ${tokenReceipt.hospital_address}` : ''}
              </div>
            </div>

            <div className="py-3 border-y border-dashed border-slate-700">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Queue Token Number</div>
              <div className="text-4xl font-extrabold text-cyan-400">{tokenReceipt.token_number}</div>
              <div className="text-xs text-slate-400 mt-1">
                Appointment Ref: <span className="text-white font-semibold">{tokenReceipt.appointment_number}</span>
              </div>
            </div>

            <div className="text-xs text-left space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Receipt Number:</span>
                <span className="font-bold text-cyan-400">{tokenReceipt.receipt_number || '—'}</span>
              </div>
              {tokenReceipt.invoice_number && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Number:</span>
                  <span className="text-slate-200">{tokenReceipt.invoice_number}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Patient Name:</span>
                <span className="font-semibold text-white">{tokenReceipt.patient_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Patient MRN:</span>
                <span>{tokenReceipt.patient_mrn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Consulting Doctor:</span>
                <span className="text-white">Dr. {tokenReceipt.doctor_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <span>{tokenReceipt.department_name || tokenReceipt.specialization}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Time:</span>
                <span>{tokenReceipt.date} {tokenReceipt.check_in_time}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-500">Consultation Fee Paid:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {tokenReceipt.formatted_amount || `₹${tokenReceipt.paid_amount || tokenReceipt.consultation_fee}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold text-white">{tokenReceipt.payment_method || 'CASH'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction / Ref ID:</span>
                <span className="text-cyan-300">{tokenReceipt.transaction_reference || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Status:</span>
                <span className="text-emerald-400 font-bold">{tokenReceipt.payment_status || 'PAID'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Processed By (Receptionist):</span>
                <span className="text-slate-200">{tokenReceipt.processed_by_name || 'Reception Desk'}</span>
              </div>
            </div>

            <div className="pt-3 flex flex-wrap justify-center gap-2.5 no-print">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button
                onClick={() => handleDownloadReceipt(tokenReceipt)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs hover:bg-emerald-500/30 transition"
              >
                <Download className="w-4 h-4" /> Download Receipt
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

      {/* MODAL: Voice Prescription Dictation & AI Extraction */}
      <VoicePrescriptionModal
        isOpen={showVoicePrescriptionModal}
        onClose={() => setShowVoicePrescriptionModal(false)}
        patientId={activeConsultAppointment?.patient_id}
        patientName={activeConsultAppointment?.patient_name}
        patientAllergies={encounterData?.emr_summary?.allergies || []}
        formularyMedicines={encounterData?.medicines || []}
        onApplyPrescriptions={handleApplyVoicePrescriptions}
      />

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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowVoicePrescriptionModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/40 text-purple-300 hover:from-purple-500/30 hover:to-indigo-500/30 transition shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                      Voice Prescription
                    </button>
                    <button
                      type="button"
                      onClick={handleAddRxItem}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition"
                    >
                      <Plus className="w-3 h-3" /> Add Medicine
                    </button>
                  </div>
                </div>

                {rxItems.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500">
                    No medications prescribed yet. Click "+ Add Medicine" to prescribe from pharmacy formulary.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rxItems.map((item, idx) => (
                      <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5 text-xs">
                        {/* Row 1: Medicine, Dosage, Frequency, Duration, Qty, Remove */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-4">
                            <label className="text-[10px] font-semibold text-slate-400">Medicine</label>
                            <select
                              value={item.medicine_id}
                              onChange={(e) => {
                                const updated = [...rxItems];
                                updated[idx].medicine_id = e.target.value;
                                setRxItems(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                            >
                              {(encounterData?.medicines && encounterData.medicines.length > 0
                                ? encounterData.medicines
                                : [
                                  { id: 'fb3ef1cc-4d06-4f95-a9f5-6aaef3c50aa5', brand_name: 'Augmentin Duo / Amoxycillin', generic_name: 'Amoxicillin Trihydrate', strength: '500mg' },
                                  { id: '644061a7-7d9f-480e-87be-a828852ee472', brand_name: 'Atorva 20', generic_name: 'Atorvastatin Calcium', strength: '20mg' },
                                  { id: 'fe0a1f1b-d43c-4b31-919b-49da25beba11', brand_name: 'Monocef 1g', generic_name: 'Ceftriaxone Sodium Injection', strength: '1g Vial' },
                                  { id: '6082f368-ed54-4181-9470-25535950820a', brand_name: 'Glycomet 500', generic_name: 'Metformin Hydrochloride', strength: '500mg' },
                                  { id: '471b13da-2842-489e-8001-577def17ec4d', brand_name: 'Dolo 650', generic_name: 'Paracetamol', strength: '650mg' },
                                  { id: '95fffc76-f447-467f-ab46-dbc55fcd3f7d', brand_name: 'Pan 40', generic_name: 'Pantoprazole Sodium', strength: '40mg' },
                                ]
                              ).map((m: any) => (
                                <option key={m.id} value={m.id}>
                                  {m.brand_name} ({m.generic_name} • {m.strength})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-semibold text-slate-400">Dose</label>
                            <input
                              type="text"
                              value={item.dosage}
                              onChange={(e) => {
                                const updated = [...rxItems];
                                updated[idx].dosage = e.target.value;
                                setRxItems(updated);
                              }}
                              placeholder="1 Tablet"
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-semibold text-slate-400">Frequency</label>
                            <input
                              type="text"
                              value={item.frequency}
                              onChange={(e) => {
                                const updated = [...rxItems];
                                updated[idx].frequency = e.target.value;
                                setRxItems(updated);
                              }}
                              placeholder="1-0-1"
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="text-[10px] font-semibold text-slate-400">Days</label>
                            <input
                              type="number"
                              min={1}
                              value={item.duration_days}
                              onChange={(e) => {
                                const updated = [...rxItems];
                                updated[idx].duration_days = parseInt(e.target.value) || 1;
                                // recalculate qty
                                let d = 0;
                                if (updated[idx].morning) d += parseFloat(updated[idx].morning_dose || '1') || 1;
                                if (updated[idx].afternoon) d += parseFloat(updated[idx].afternoon_dose || '1') || 1;
                                if (updated[idx].evening) d += parseFloat(updated[idx].evening_dose || '1') || 1;
                                if (updated[idx].night) d += parseFloat(updated[idx].night_dose || '1') || 1;
                                if (d > 0) updated[idx].total_quantity = Math.ceil(d * updated[idx].duration_days);
                                setRxItems(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-semibold text-slate-400">Food Instruction</label>
                            <select
                              value={item.food_instruction || 'AFTER_FOOD'}
                              onChange={(e) => {
                                const updated = [...rxItems];
                                updated[idx].food_instruction = e.target.value;
                                setRxItems(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                            >
                              <option value="AFTER_FOOD">After Food</option>
                              <option value="BEFORE_FOOD">Before Food</option>
                              <option value="WITH_FOOD">With Food</option>
                              <option value="EMPTY_STOMACH">Empty Stomach</option>
                              <option value="BEDTIME">At Bedtime</option>
                              <option value="NONE">No Restriction</option>
                            </select>
                          </div>
                          <div className="sm:col-span-1 flex items-center justify-end pt-3">
                            <button
                              type="button"
                              onClick={() => handleRemoveRxItem(idx)}
                              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 transition"
                              title="Remove Medicine"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Morning, Afternoon, Evening, Night Time-of-day Schedule */}
                        <div className="p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-lg flex items-center justify-between flex-wrap gap-2 text-[11px]">
                          <div className="text-slate-400 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            Schedule:
                          </div>

                          <div className="flex items-center gap-3 flex-wrap">
                            {/* Morning */}
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.morning !== false}
                                onChange={(e) => {
                                  const updated = [...rxItems];
                                  updated[idx].morning = e.target.checked;
                                  setRxItems(updated);
                                }}
                                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                              />
                              <span className="text-slate-300">Morning ({item.morning_dose || '1'})</span>
                            </label>

                            {/* Afternoon */}
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!item.afternoon}
                                onChange={(e) => {
                                  const updated = [...rxItems];
                                  updated[idx].afternoon = e.target.checked;
                                  setRxItems(updated);
                                }}
                                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                              />
                              <span className="text-slate-300">Afternoon ({item.afternoon_dose || '1'})</span>
                            </label>

                            {/* Evening */}
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!item.evening}
                                onChange={(e) => {
                                  const updated = [...rxItems];
                                  updated[idx].evening = e.target.checked;
                                  setRxItems(updated);
                                }}
                                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                              />
                              <span className="text-slate-300">Evening ({item.evening_dose || '1'})</span>
                            </label>

                            {/* Night */}
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.night !== false}
                                onChange={(e) => {
                                  const updated = [...rxItems];
                                  updated[idx].night = e.target.checked;
                                  setRxItems(updated);
                                }}
                                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                              />
                              <span className="text-slate-300">Night ({item.night_dose || '1'})</span>
                            </label>
                          </div>

                          <div className="text-slate-400 text-[10px]">
                            Qty: <strong className="text-white">{item.total_quantity || 10}</strong>
                          </div>
                        </div>

                        {/* Row 3: Special instructions */}
                        <div>
                          <input
                            type="text"
                            value={item.instructions || ''}
                            onChange={(e) => {
                              const updated = [...rxItems];
                              updated[idx].instructions = e.target.value;
                              setRxItems(updated);
                            }}
                            placeholder="Specific clinical instructions (e.g. Take after meals with warm water, avoid milk)"
                            className="w-full px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                          />
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
                        className={`p-2 rounded-xl text-left text-xs transition border flex items-center justify-between ${isSelected
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

              {/* Follow-up Recommendation Section */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CalendarCheck className="w-4 h-4 text-emerald-400" />
                    Recommended Follow-up Consultation (Clinical Advice)
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Reception desk will collect payment & book follow-up token
                  </span>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setCancelModalItem(activeConsultAppointment);
                    setCancelReason('Consultation cancelled by doctor');
                  }}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition flex items-center justify-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Cancel Consultation
                </button>
                <div className="flex items-center justify-end gap-2">
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
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* MODAL 5: Cancel Appointment Confirmation Modal (Strictly Doctor Authorized) */}
      {canConductConsultation && cancelModalItem && (
        <Modal
          isOpen={!!cancelModalItem}
          onClose={() => setCancelModalItem(null)}
          title={`Cancel Appointment: ${cancelModalItem.patient_name}`}
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Confirm Appointment Cancellation</span>
              </div>
              <p className="text-slate-300">
                You are about to cancel the consultation for <strong className="text-white">{cancelModalItem.patient_name}</strong> (MRN: {cancelModalItem.patient_mrn}, Token: #{String(cancelModalItem.token_number || cancelModalItem.appointment_number).replace(/^(token\s*#*|#)+/i, '').trim()}).
              </p>
              <p className="text-slate-400 text-[11px]">
                Current Status: <span className="font-mono text-cyan-400 font-semibold">{cancelModalItem.status}</span>. Once cancelled, this consultation will be removed from the active queue and marked as Cancelled in both staff records and the patient portal.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Reason for Cancellation <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Cancelled by doctor, Patient unavailable, Patient requested reschedule"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500/50"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  'Consultation cancelled by doctor',
                  'Patient requested cancellation',
                  'Patient did not show up',
                  'Emergency case priority',
                  'Duplicate token issued',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCancelReason(preset)}
                    className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setCancelModalItem(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={async () => {
                  setCancelling(true);
                  try {
                    await handleQueueAction(cancelModalItem.id, 'CANCEL', { reason: cancelReason || 'Cancelled by doctor' });
                    if (activeConsultAppointment?.id === cancelModalItem.id) {
                      setShowConsultModal(false);
                      setActiveConsultAppointment(null);
                    }
                    setCancelModalItem(null);
                  } catch (err: any) {
                    setPageError(parseApiError(err).message);
                  } finally {
                    setCancelling(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30"
              >
                {cancelling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    Confirm Cancellation
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Interactive Lounge TV Modal for Receptionist */}
      {showLoungeTVModal && (
        <Modal
          isOpen={showLoungeTVModal}
          onClose={() => setShowLoungeTVModal(false)}
          title="Hospital Outpatient Waiting Lounge TV • Interactive Doctor Queues"
          size="full"
        >
          <div className="max-h-[85vh] overflow-y-auto custom-scrollbar -m-4">
            <LoungeTVPage
              isStaffView={true}
              onClose={() => setShowLoungeTVModal(false)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};
