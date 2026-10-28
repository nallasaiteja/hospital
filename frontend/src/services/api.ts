import axios from 'axios';
import { supabase } from './supabase';
import {
  UserProfile,
  StaffProfile,
  PatientProfile,
  Role,
  Permission,
  FinancialApprovalPolicy,
  FinancialApprovalRequest,
  SecurityAuditEvent,
  PatientConsent,
  PatientDocument,
  PatientDashboardStats,
  PatientEMRData,
  Appointment,
  OPDDashboardStats,
  DoctorAvailabilityResponse,
  QueueItem,
  DoctorScheduleRecord,
  DoctorLeaveRecord,
  EmergencyCase,
  Bed,
  Ward,
  InpatientAdmission,
  PatientTransferRecord,
  EmergencyIPDDashboardStats,
  InpatientRunningBill,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60s to allow Render free tier container cold start
});

// Request interceptor: Attach Supabase JWT Bearer token if session exists
api.interceptors.request.use(
  async (config) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('Failed to attach Supabase session token to request:', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

import { parseApiError, logError } from '../utils/errorHandler';

// Response interceptor: Global error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const parsed = parseApiError(error);
    if (error) {
      error.userMessage = parsed.message;
      error.parsedError = parsed;
    }

    if (error.response?.status === 401) {
      logError('Auth Session Expired', error);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hms:session-expired', { detail: { message: parsed.message } }));
      }
    } else {
      logError('API Response Error', error);
    }

    return Promise.reject(error);
  }
);

// --- Auth & Identity Service Methods ---

export interface CurrentUserResponse {
  is_initialized: boolean;
  user?: UserProfile;
  role?: string;
  permissions?: string[];
  staff_profile?: StaffProfile;
  patient_profile?: PatientProfile;
  message?: string;
}

export const authService = {
  /**
   * Fetch currently authenticated user profile, role, and permissions from Django backend.
   */
  async getCurrentUser(): Promise<CurrentUserResponse> {
    const res = await api.get<CurrentUserResponse>('/auth/me/');
    return res.data;
  },

  /**
   * Initialize a patient profile upon Supabase public registration.
   */
  async initPatientProfile(payload: {
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    blood_group?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    emergency_contact_relation?: string;
    allergies?: string[];
    chronic_conditions?: string[];
    primary_branch_id?: string;
  }): Promise<PatientProfile> {
    const res = await api.post<PatientProfile>('/auth/patient/profile-init/', payload);
    return res.data;
  },

  /**
   * Administrator-only API to provision a staff member.
   */
  async provisionStaff(payload: {
    email: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    role: string;
    branch_id: string;
    department_id?: string;
    designation: string;
    specialization?: string;
    medical_license_number?: string;
    qualification?: string;
    consultation_fee?: number;
  }): Promise<StaffProfile> {
    const res = await api.post<StaffProfile>('/auth/staff/provision/', payload);
    return res.data;
  },

  /**
   * Fetch active staff directory (e.g. Doctors for booking slots).
   */
  async getStaffDirectory(params?: {
    branch_id?: string;
    department_id?: string;
    role?: string;
  }): Promise<StaffProfile[]> {
    const res = await api.get<StaffProfile[]>('/auth/staff/', { params });
    return res.data;
  },

  /**
   * Fetch system roles for staff assignment dropdowns.
   */
  async getRoles(): Promise<Role[]> {
    const res = await api.get<Role[]>('/auth/roles/');
    return res.data;
  },

  /**
   * Fetch registered patients for lookups and appointment booking.
   */
  async getPatients(params?: { search?: string; branch_id?: string }): Promise<PatientProfile[]> {
    const res = await api.get<{ results: PatientProfile[] } | PatientProfile[]>('/core/patients/', { params }).catch(() => ({ data: [] }));
    if ('results' in res.data && Array.isArray(res.data.results)) {
      return res.data.results;
    }
    return Array.isArray(res.data) ? res.data : [];
  },
};

export const rbacService = {
  /**
   * Fetch users list for administrator user management table.
   */
  async getUsers(params?: { search?: string; role?: string; is_active?: boolean }): Promise<any[]> {
    const res = await api.get('/auth/users/', { params });
    return res.data;
  },

  /**
   * Update a user's role, status, branch, or department.
   */
  async updateUser(userId: string, payload: {
    role?: string;
    is_active?: boolean;
    branch_id?: string;
    department_id?: string;
  }): Promise<any> {
    const res = await api.patch(`/auth/users/${userId}/`, payload);
    return res.data;
  },

  /**
   * Fetch all system permissions catalog.
   */
  async getPermissionsCatalog(): Promise<{
    modules: string[];
    actions: string[];
    permissions: Permission[];
    total_count: number;
  }> {
    const res = await api.get('/auth/permissions/');
    return res.data;
  },

  /**
   * Get role details with active permissions.
   */
  async getRolePermissions(roleName: string): Promise<{
    role: Role;
    permission_codes: string[];
    permissions_count: number;
  }> {
    const res = await api.get(`/auth/roles/${roleName}/permissions/`);
    return res.data;
  },

  /**
   * Update permissions for a role.
   */
  async updateRolePermissions(roleName: string, permissionCodes: string[]): Promise<any> {
    const res = await api.put(`/auth/roles/${roleName}/permissions/`, {
      permission_codes: permissionCodes,
    });
    return res.data;
  },

  /**
   * Fetch financial approval policies.
   */
  async getFinancialPolicies(): Promise<FinancialApprovalPolicy[]> {
    const res = await api.get('/auth/financial-policies/');
    return res.data;
  },

  /**
   * Create or update financial approval policy.
   */
  async saveFinancialPolicy(payload: Partial<FinancialApprovalPolicy>): Promise<FinancialApprovalPolicy> {
    const res = await api.post('/auth/financial-policies/', payload);
    return res.data;
  },

  /**
   * Fetch pending or historic financial approval requests.
   */
  async getFinancialApprovals(params?: { status?: string; operation_type?: string }): Promise<FinancialApprovalRequest[]> {
    const res = await api.get('/auth/financial-approvals/', { params });
    return res.data;
  },

  /**
   * Submit new financial approval request.
   */
  async submitFinancialApproval(payload: {
    operation_type: string;
    entity_type: string;
    entity_id: string;
    amount: number | string;
    notes?: string;
  }): Promise<FinancialApprovalRequest> {
    const res = await api.post('/auth/financial-approvals/', payload);
    return res.data;
  },

  /**
   * Approve or reject a financial approval request (with separation of duties enforcement).
   */
  async actionFinancialApproval(requestId: string, payload: {
    action: 'APPROVE' | 'REJECT';
    notes?: string;
  }): Promise<FinancialApprovalRequest> {
    const res = await api.post(`/auth/financial-approvals/${requestId}/action/`, payload);
    return res.data;
  },

  /**
   * Fetch security & administrative audit events.
   */
  async getSecurityAuditEvents(params?: {
    event_type?: string;
    severity?: string;
    search?: string;
  }): Promise<SecurityAuditEvent[]> {
    const res = await api.get('/auth/security-audit-events/', { params });
    return res.data;
  },

  /**
   * Request password recovery.
   */
  async requestPasswordRecovery(email: string): Promise<any> {
    const res = await api.post('/auth/password-recovery/', { email });
    return res.data;
  },

  /**
   * Check MFA status.
   */
  async getMFAStatus(): Promise<any> {
    const res = await api.get('/auth/mfa-status/');
    return res.data;
  },
};

export const patientService = {
  getDashboardStats: async (params?: { branch_id?: string }): Promise<PatientDashboardStats> => {
    const res = await api.get<PatientDashboardStats>('/core/patients/dashboard-stats/', { params });
    return res.data;
  },

  getPatients: async (params?: {
    search?: string;
    branch_id?: string;
    gender?: string;
    status?: string;
    registration_date?: string;
    page?: number;
    page_size?: number;
    ordering?: string;
  }): Promise<{ results: PatientProfile[]; total_count: number; page: number; page_size: number }> => {
    const res = await api.get('/core/patients/', { params });
    if ('results' in res.data) {
      return res.data;
    }
    return { results: res.data || [], total_count: res.data?.length || 0, page: 1, page_size: 10 };
  },

  registerPatient: async (payload: any): Promise<PatientProfile> => {
    const res = await api.post<PatientProfile>('/core/patients/', payload);
    return res.data;
  },

  getPatient: async (id: string): Promise<PatientProfile> => {
    const res = await api.get<PatientProfile>(`/core/patients/${id}/`);
    return res.data;
  },

  updatePatient: async (id: string, payload: any): Promise<PatientProfile> => {
    const res = await api.patch<PatientProfile>(`/core/patients/${id}/`, payload);
    return res.data;
  },

  getPatientEMR: async (id: string): Promise<PatientEMRData> => {
    const res = await api.get<PatientEMRData>(`/core/patients/${id}/emr/`);
    return res.data;
  },

  updateMedicalHistory: async (id: string, payload: {
    allergies?: string[];
    chronic_conditions?: string[];
    past_medical_history?: string[];
    past_surgical_history?: string[];
    family_history?: string;
    social_history?: string;
  }): Promise<any> => {
    const res = await api.post(`/core/patients/${id}/medical-history/`, payload);
    return res.data;
  },

  getConsents: async (id: string): Promise<PatientConsent[]> => {
    const res = await api.get<PatientConsent[]>(`/core/patients/${id}/consents/`);
    return res.data;
  },

  recordConsent: async (id: string, payload: {
    consent_type: string;
    notes?: string;
    document_url?: string;
  }): Promise<PatientConsent> => {
    const res = await api.post<PatientConsent>(`/core/patients/${id}/consents/`, payload);
    return res.data;
  },

  revokeConsent: async (id: string, consentId: string, payload: { reason: string }): Promise<PatientConsent> => {
    const res = await api.post<PatientConsent>(`/core/patients/${id}/consents/${consentId}/revoke/`, payload);
    return res.data;
  },

  getDocuments: async (id: string): Promise<PatientDocument[]> => {
    const res = await api.get<PatientDocument[]>(`/core/patients/${id}/documents/`);
    return res.data;
  },

  uploadDocument: async (id: string, payload: {
    document_type: string;
    title: string;
    file_url: string;
    file_size_kb?: number;
    mime_type?: string;
    notes?: string;
  }): Promise<PatientDocument> => {
    const res = await api.post<PatientDocument>(`/core/patients/${id}/documents/`, payload);
    return res.data;
  },

  getDuplicates: async (): Promise<{
    total_candidate_groups: number;
    duplicate_groups: Array<{
      reason: string;
      similarity_score: number;
      patients: PatientProfile[];
    }>;
  }> => {
    const res = await api.get('/core/patients/duplicates/');
    return res.data;
  },

  mergePatients: async (payload: {
    source_patient_id: string;
    target_patient_id: string;
    reason: string;
  }): Promise<any> => {
    const res = await api.post('/core/patients/merge/', payload);
    return res.data;
  },
};

export const clinicalService = {
  getAppointments: async (params?: any) => (await api.get('/clinical/appointments/', { params })).data,
  bookAppointment: async (payload: any) => (await api.post('/clinical/appointments/', payload)).data,
  updateAppointmentStatus: async (id: string, status: string) => (await api.patch(`/clinical/appointments/${id}/status/`, { status })).data,
  recordConsultation: async (id: string, payload: any) => (await api.post(`/clinical/appointments/${id}/consultation/`, payload)).data,
  getEmergencyCases: async (params?: any) => (await api.get('/clinical/emergency/', { params })).data,
  triageEmergency: async (payload: any) => (await api.post('/clinical/emergency/', payload)).data,
  getWards: async (branch_id?: string) => (await api.get('/clinical/wards/', { params: { branch_id } })).data,
  getAdmissions: async (params?: any) => (await api.get('/clinical/admissions/', { params })).data,
  admitPatient: async (payload: any) => (await api.post('/clinical/admissions/', payload)).data,
  dischargePatient: async (id: string, payload: any) => (await api.post(`/clinical/admissions/${id}/discharge/`, payload)).data,
  getSurgeries: async () => (await api.get('/clinical/surgeries/')).data,
  scheduleSurgery: async (payload: any) => (await api.post('/clinical/surgeries/', payload)).data,
  getLabTests: async () => (await api.get('/clinical/lab/tests/')).data,
  getLabOrders: async (params?: any) => (await api.get('/clinical/lab/orders/', { params })).data,
  createLabOrder: async (payload: any) => (await api.post('/clinical/lab/orders/', payload)).data,
  recordLabResult: async (itemId: string, payload: any) => (await api.post(`/clinical/lab/items/${itemId}/record-result/`, payload)).data,
  getRadiologyOrders: async (params?: any) => (await api.get('/clinical/radiology/orders/', { params })).data,
  createRadiologyOrder: async (payload: any) => (await api.post('/clinical/radiology/orders/', payload)).data,
  getDutyRoster: async (params?: any) => (await api.get('/clinical/roster/', { params })).data,
  assignDutyShift: async (payload: any) => (await api.post('/clinical/roster/', payload)).data,
};

export const opdService = {
  getDashboardStats: async (params?: { date?: string; branch_id?: string; doctor_id?: string; department_id?: string }): Promise<OPDDashboardStats> => {
    const res = await api.get<OPDDashboardStats>('/clinical/opd/dashboard-stats/', { params });
    return res.data;
  },
  getDoctorAvailableSlots: async (doctorId: string, date: string): Promise<DoctorAvailabilityResponse> => {
    const res = await api.get<DoctorAvailabilityResponse>(`/clinical/doctors/${doctorId}/available-slots/`, {
      params: { date },
    });
    return res.data;
  },
  getDoctorSchedules: async (params?: { doctor_id?: string; day?: string }): Promise<DoctorScheduleRecord[]> => {
    const res = await api.get<DoctorScheduleRecord[]>('/clinical/schedules/', { params });
    return res.data;
  },
  saveDoctorSchedule: async (payload: Partial<DoctorScheduleRecord>): Promise<DoctorScheduleRecord> => {
    const res = await api.post<DoctorScheduleRecord>('/clinical/schedules/', payload);
    return res.data;
  },
  getDoctorLeaves: async (params?: { doctor_id?: string }): Promise<DoctorLeaveRecord[]> => {
    const res = await api.get<DoctorLeaveRecord[]>('/clinical/leaves/', { params });
    return res.data;
  },
  saveDoctorLeave: async (payload: Partial<DoctorLeaveRecord>): Promise<DoctorLeaveRecord> => {
    const res = await api.post<DoctorLeaveRecord>('/clinical/leaves/', payload);
    return res.data;
  },
  registerWalkIn: async (payload: {
    patient_id: string;
    doctor_id: string;
    department_id?: string;
    branch_id?: string;
    chief_complaint?: string;
    reason_for_visit?: string;
    vitals?: Record<string, any>;
  }): Promise<{ message: string; appointment: Appointment; token_receipt: any }> => {
    const res = await api.post('/clinical/opd/walk-in/', payload);
    return res.data;
  },
  getQueue: async (params?: {
    date?: string;
    doctor_id?: string;
    department_id?: string;
    status?: string;
    search?: string;
  }): Promise<QueueItem[]> => {
    const res = await api.get<QueueItem[]>('/clinical/opd/queue/', { params });
    return res.data;
  },
  executeQueueAction: async (appointmentId: string, action: string, payload?: any): Promise<Appointment> => {
    const res = await api.post<Appointment>(`/clinical/opd/queue/${appointmentId}/action/`, { action, ...payload });
    return res.data;
  },
  getConsultationEncounter: async (appointmentId: string): Promise<{
    appointment: Appointment;
    emr_summary: any;
    past_consultations: any[];
    lab_catalogue: any[];
    medicines: any[];
  }> => {
    const res = await api.get(`/clinical/appointments/${appointmentId}/encounter/`);
    return res.data;
  },
  finalizeConsultation: async (appointmentId: string, payload: any): Promise<{ message: string; appointment: Appointment }> => {
    const res = await api.post(`/clinical/appointments/${appointmentId}/finalize-consultation/`, payload);
    return res.data;
  },
  getOPDReports: async (params?: {
    start_date?: string;
    end_date?: string;
    doctor_id?: string;
    department_id?: string;
    branch_id?: string;
  }): Promise<any> => {
    const res = await api.get('/clinical/opd/reports/', { params });
    return res.data;
  },
};

export const ipdService = {
  getDashboardStats: async (params?: { branch_id?: string; department_id?: string }): Promise<EmergencyIPDDashboardStats> => {
    const res = await api.get<EmergencyIPDDashboardStats>('/clinical/ipd/dashboard-stats/', { params });
    return res.data;
  },

  getEmergencyCases: async (params?: {
    status?: string;
    triage_acuity?: string;
    search?: string;
    date?: string;
  }): Promise<EmergencyCase[]> => {
    const res = await api.get<EmergencyCase[]>('/clinical/emergency/', { params });
    return res.data;
  },

  registerEmergencyCase: async (payload: {
    patient?: string;
    unregistered_patient_name?: string;
    triage_acuity?: 'RED' | 'YELLOW' | 'GREEN';
    chief_complaint: string;
    arrival_mode?: 'AMBULANCE' | 'WALK_IN' | 'POLICE' | 'TRANSFER';
    vitals?: Record<string, any>;
    assigned_doctor?: string;
  }): Promise<EmergencyCase> => {
    const res = await api.post<EmergencyCase>('/clinical/emergency/', payload);
    return res.data;
  },

  emergencyAction: async (
    id: string,
    action: 'UPDATE_TREATMENT' | 'RECONCILE_PATIENT' | 'REQUEST_IPD_ADMISSION' | 'DISCHARGE_ER',
    payload: any
  ): Promise<any> => {
    const res = await api.post(`/clinical/emergency/${id}/action/`, { action, ...payload });
    return res.data;
  },

  getWards: async (branch_id?: string): Promise<Ward[]> => {
    const res = await api.get<Ward[]>('/clinical/wards/', { params: { branch_id } });
    return res.data;
  },

  getBeds: async (params?: { ward_id?: string; status?: string }): Promise<Bed[]> => {
    const res = await api.get<Bed[]>('/clinical/beds/', { params });
    return res.data;
  },

  bedAction: async (bedId: string, action: 'MARK_CLEANED' | 'SET_MAINTENANCE' | 'RELEASE_MAINTENANCE', notes?: string): Promise<any> => {
    const res = await api.post(`/clinical/beds/${bedId}/action/`, { action, notes });
    return res.data;
  },

  getAdmissions: async (params?: {
    status?: string;
    priority?: string;
    ward_id?: string;
    search?: string;
  }): Promise<InpatientAdmission[]> => {
    const res = await api.get<InpatientAdmission[]>('/clinical/admissions/', { params });
    return res.data;
  },

  requestAdmission: async (payload: {
    patient: string;
    admission_source?: 'EMERGENCY' | 'OPD' | 'DIRECT' | 'TRANSFER';
    priority?: 'ROUTINE' | 'URGENT' | 'STAT_EMERGENCY';
    requested_ward_type?: string;
    admitting_doctor: string;
    requesting_doctor?: string;
    ward?: string;
    bed?: string;
    initial_diagnosis: string;
    expected_discharge_date?: string;
    admission_deposit?: number;
  }): Promise<InpatientAdmission> => {
    const res = await api.post<InpatientAdmission>('/clinical/admissions/', payload);
    return res.data;
  },

  admissionAction: async (
    id: string,
    action: 'APPROVE' | 'REJECT' | 'ALLOCATE_BED' | 'REQUEST_DISCHARGE' | 'DISCHARGE_CLEARANCE' | 'FINALIZE_DISCHARGE',
    payload?: any
  ): Promise<any> => {
    const res = await api.post(`/clinical/admissions/${id}/action/`, { action, ...payload });
    return res.data;
  },

  getTransfers: async (params?: { admission_id?: string }): Promise<PatientTransferRecord[]> => {
    const res = await api.get<PatientTransferRecord[]>('/clinical/transfers/', { params });
    return res.data;
  },

  transferPatient: async (payload: {
    admission_id: string;
    target_bed_id: string;
    transfer_reason: string;
    clinical_handover_notes?: string;
  }): Promise<any> => {
    const res = await api.post('/clinical/transfers/', payload);
    return res.data;
  },

  getRunningBill: async (admissionId: string): Promise<InpatientRunningBill> => {
    const res = await api.get<InpatientRunningBill>(`/clinical/admissions/${admissionId}/running-bill/`);
    return res.data;
  },

  recordDeposit: async (admissionId: string, payload: {
    amount: number;
    payment_method: string;
    reference?: string;
    notes?: string;
  }): Promise<any> => {
    const res = await api.post(`/clinical/admissions/${admissionId}/running-bill/`, payload);
    return res.data;
  },

  getIPDReports: async (params?: { start_date?: string; end_date?: string; branch_id?: string }): Promise<any> => {
    const res = await api.get('/clinical/ipd/reports/', { params });
    return res.data;
  },
};


export const billingFinanceService = {
  getInvoices: async (params?: any) => (await api.get('/billing-finance/invoices/', { params })).data,
  createInvoice: async (payload: any) => (await api.post('/billing-finance/invoices/', payload)).data,
  generateInpatientBill: async (payload: { admission_id: string; is_final?: boolean }) => (await api.post('/billing-finance/invoices/generate-inpatient-bill/', payload)).data,
  recordPayment: async (payload: any) => (await api.post('/billing-finance/payments/record/', payload)).data,
  getDashboardStats: async () => (await api.get('/billing-finance/dashboard-stats/')).data,

  // Service catalogue & tariffs
  getServices: async (params?: any) => (await api.get('/billing-finance/services/', { params })).data,
  createService: async (payload: any) => (await api.post('/billing-finance/services/', payload)).data,
  updateService: async (id: string, payload: any) => (await api.patch(`/billing-finance/services/${id}/`, payload)).data,
  getTariffs: async (params?: any) => (await api.get('/billing-finance/tariffs/', { params })).data,
  createTariff: async (payload: any) => (await api.post('/billing-finance/tariffs/', payload)).data,
  setTariffRate: async (id: string, payload: { service_id: string; rate: string | number }) => (await api.post(`/billing-finance/tariffs/${id}/set-rate/`, payload)).data,

  // Packages
  getPackages: async (params?: any) => (await api.get('/billing-finance/packages/', { params })).data,
  createPackage: async (payload: any) => (await api.post('/billing-finance/packages/', payload)).data,
  addPackageComponent: async (id: string, payload: { service_id: string; quantity_included: number }) => (await api.post(`/billing-finance/packages/${id}/add-component/`, payload)).data,
  getPackageSubscriptions: async (params?: any) => (await api.get('/billing-finance/package-subscriptions/', { params })).data,
  subscribePackage: async (payload: any) => (await api.post('/billing-finance/package-subscriptions/', payload)).data,
  consumePackageService: async (id: string, payload: { service_id: string; quantity?: number; notes?: string }) => (await api.post(`/billing-finance/package-subscriptions/${id}/consume-service/`, payload)).data,

  // Discounts
  getDiscounts: async (params?: any) => (await api.get('/billing-finance/discounts/', { params })).data,
  requestDiscount: async (payload: any) => (await api.post('/billing-finance/discounts/', payload)).data,
  approveDiscount: async (id: string) => (await api.post(`/billing-finance/discounts/${id}/approve/`)).data,
  rejectDiscount: async (id: string, reason?: string) => (await api.post(`/billing-finance/discounts/${id}/reject/`, { reason })).data,

  // Deposits
  getDeposits: async (params?: any) => (await api.get('/billing-finance/deposits/', { params })).data,
  createDeposit: async (payload: any) => (await api.post('/billing-finance/deposits/', payload)).data,
  allocateDepositToBill: async (id: string, payload: { invoice_id: string; amount?: string }) => (await api.post(`/billing-finance/deposits/${id}/allocate-to-bill/`, payload)).data,

  // Receipts
  getReceipts: async (params?: any) => (await api.get('/billing-finance/receipts/', { params })).data,

  // Credit notes & refunds
  getCreditNotes: async (params?: any) => (await api.get('/billing-finance/credit-notes/', { params })).data,
  createCreditNote: async (payload: any) => (await api.post('/billing-finance/credit-notes/', payload)).data,
  getRefunds: async (params?: any) => (await api.get('/billing-finance/refunds/', { params })).data,
  createRefund: async (payload: any) => (await api.post('/billing-finance/refunds/', payload)).data,

  // Cashier Shifts
  getCashierShifts: async (params?: any) => (await api.get('/billing-finance/cashier-shifts/', { params })).data,
  openCashierShift: async (payload: { opening_cash: string }) => (await api.post('/billing-finance/cashier-shifts/open-shift/', payload)).data,
  closeCashierShift: async (id: string, payload: { closing_cash_counted: string; reconciliation_notes?: string }) => (await api.post(`/billing-finance/cashier-shifts/${id}/close-shift/`, payload)).data,

  // Payment Gateway
  createGatewayOrder: async (payload: { invoice_id?: string; deposit_id?: string; amount?: string; idempotency_key?: string }) => (await api.post('/billing-finance/gateway/create-order/', payload)).data,
  verifyGatewayPayment: async (payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => (await api.post('/billing-finance/gateway/verify/', payload)).data,
  getGatewaySettlements: async (params?: any) => (await api.get('/billing-finance/settlements/', { params })).data,

  // Section 12 Insurance & Corporate Billing
  getInsuranceProviders: async (params?: any) => (await api.get('/billing-finance/insurance-providers/', { params })).data,
  createInsuranceProvider: async (payload: any) => (await api.post('/billing-finance/insurance-providers/', payload)).data,
  toggleInsuranceProviderActive: async (id: string) => (await api.post(`/billing-finance/insurance-providers/${id}/toggle-active/`)).data,
  getCorporateCustomers: async (params?: any) => (await api.get('/billing-finance/corporate-customers/', { params })).data,
  createCorporateCustomer: async (payload: any) => (await api.post('/billing-finance/corporate-customers/', payload)).data,
  adjustCorporateCreditLimit: async (id: string, payload: { credit_limit: string }) => (await api.post(`/billing-finance/corporate-customers/${id}/adjust-credit-limit/`, payload)).data,
  getPatientCoverages: async (params?: any) => (await api.get('/billing-finance/patient-coverages/', { params })).data,
  createPatientCoverage: async (payload: any) => (await api.post('/billing-finance/patient-coverages/', payload)).data,
  verifyPatientCoverage: async (id: string) => (await api.post(`/billing-finance/patient-coverages/${id}/verify-policy/`)).data,
  getEligibilityChecks: async (params?: any) => (await api.get('/billing-finance/eligibility-checks/', { params })).data,
  createEligibilityCheck: async (payload: any) => (await api.post('/billing-finance/eligibility-checks/', payload)).data,
  getPreAuthorizations: async (params?: any) => (await api.get('/billing-finance/pre-authorizations/', { params })).data,
  createPreAuthorization: async (payload: any) => (await api.post('/billing-finance/pre-authorizations/', payload)).data,
  submitPreAuthToTPA: async (id: string) => (await api.post(`/billing-finance/pre-authorizations/${id}/submit-to-tpa/`)).data,
  adjudicatePreAuth: async (id: string, payload: any) => (await api.post(`/billing-finance/pre-authorizations/${id}/adjudicate/`, payload)).data,
  getInsuranceClaims: async (params?: any) => (await api.get('/billing-finance/claims/', { params })).data,
  submitClaim: async (payload: any) => (await api.post('/billing-finance/claims/', payload)).data,
  submitClaimToTPA: async (id: string, payload?: any) => (await api.post(`/billing-finance/claims/${id}/submit-claim/`, payload || {})).data,
  adjudicateClaim: async (id: string, payload: any) => (await api.post(`/billing-finance/claims/${id}/adjudicate/`, payload)).data,
  getClaimDocuments: async (params?: any) => (await api.get('/billing-finance/claim-documents/', { params })).data,
  uploadClaimDocument: async (payload: any) => (await api.post('/billing-finance/claim-documents/', payload)).data,
  getClaimQueries: async (params?: any) => (await api.get('/billing-finance/claim-queries/', { params })).data,
  createClaimQuery: async (payload: any) => (await api.post('/billing-finance/claim-queries/', payload)).data,
  respondClaimQuery: async (id: string, payload: { response_text: string }) => (await api.post(`/billing-finance/claim-queries/${id}/respond/`, payload)).data,
  getClaimSettlements: async (params?: any) => (await api.get('/billing-finance/claim-settlements/', { params })).data,
  recordClaimSettlement: async (payload: any) => (await api.post('/billing-finance/claim-settlements/', payload)).data,
  getCorporateInvoices: async (params?: any) => (await api.get('/billing-finance/corporate-invoices/', { params })).data,
  createCorporateInvoice: async (payload: any) => (await api.post('/billing-finance/corporate-invoices/', payload)).data,
  recordCorporatePayment: async (id: string, payload: { amount: string }) => (await api.post(`/billing-finance/corporate-invoices/${id}/record-payment/`, payload)).data,
  getInsuranceReceivables: async () => (await api.get('/billing-finance/insurance/receivables/')).data,
  getInsuranceDashboardStats: async () => (await api.get('/billing-finance/insurance/dashboard-stats/')).data,

  // Section 17: Accounting & General Ledger
  getChartOfAccounts: (params?: any) => api.get('/billing-finance/chart-of-accounts/', { params }).then(r => r.data),
  createChartOfAccount: (payload: any) => api.post('/billing-finance/chart-of-accounts/', payload).then(r => r.data),
  updateChartOfAccount: (id: string, payload: any) => api.patch(`/billing-finance/chart-of-accounts/${id}/`, payload).then(r => r.data),
  toggleChartOfAccountStatus: (id: string) => api.post(`/billing-finance/chart-of-accounts/${id}/toggle-status/`).then(r => r.data),
  getAccountLedgerStatement: (id: string, params?: any) => api.get(`/billing-finance/chart-of-accounts/${id}/ledger-statement/`, { params }).then(r => r.data),
  seedDefaultChartOfAccounts: (branch_id?: string) => api.post('/billing-finance/chart-of-accounts/seed-defaults/', { branch_id }).then(r => r.data),

  // Journal Vouchers & Double-Entry Engine
  getJournalEntries: (params?: any) => api.get('/billing-finance/journal-entries/', { params }).then(r => r.data),
  createJournalEntry: (payload: any) => api.post('/billing-finance/journal-entries/', payload).then(r => r.data),
  postJournalEntry: (payload: any) => api.post('/billing-finance/journal-entries/', payload).then(r => r.data),
  submitJournalForApproval: (id: string) => api.post(`/billing-finance/journal-entries/${id}/submit-approval/`).then(r => r.data),
  approveJournalEntry: (id: string, payload?: { comments?: string; auto_post?: boolean }) => api.post(`/billing-finance/journal-entries/${id}/approve/`, payload || {}).then(r => r.data),
  rejectJournalEntry: (id: string, payload: { reason: string }) => api.post(`/billing-finance/journal-entries/${id}/reject/`, payload).then(r => r.data),
  postJournalVoucher: (id: string) => api.post(`/billing-finance/journal-entries/${id}/post/`).then(r => r.data),
  reverseJournalVoucher: (id: string, payload: { reason: string }) => api.post(`/billing-finance/journal-entries/${id}/reverse/`, payload).then(r => r.data),
  uploadJournalDocument: (id: string, payload: any) => api.post(`/billing-finance/journal-entries/${id}/documents/`, payload).then(r => r.data),

  // Accounting Periods & Fiscal Years
  getFiscalYears: () => api.get('/billing-finance/fiscal-years/').then(r => r.data),
  getAccountingPeriods: () => api.get('/billing-finance/accounting-periods/').then(r => r.data),
  closeAccountingPeriod: (id: string, payload?: { comments?: string }) => api.post(`/billing-finance/accounting-periods/${id}/close-period/`, payload || {}).then(r => r.data),
  reopenAccountingPeriod: (id: string, payload: { reason: string }) => api.post(`/billing-finance/accounting-periods/${id}/reopen-period/`, payload).then(r => r.data),

  // Reconciled Financial Reports
  getGeneralLedger: (params: { account_id: string; start_date?: string; end_date?: string; branch_id?: string }) => api.get('/billing-finance/general-ledger/', { params }).then(r => r.data),
  getTrialBalance: (params?: any) => api.get('/billing-finance/trial-balance/', { params }).then(r => r.data),
  getBalanceSheet: (params?: any) => api.get('/billing-finance/balance-sheet/', { params }).then(r => r.data),
  getProfitAndLoss: (params?: any) => api.get('/billing-finance/profit-loss/', { params }).then(r => r.data),
  getProfitLossDashboard: (params?: any) => api.get('/billing-finance/pnl/dashboard/', { params }).then(r => r.data),
  getProfitLossDetailedReport: (params?: any) => api.get('/billing-finance/pnl/report/', { params }).then(r => r.data),
  getDepartmentProfitability: (params?: any) => api.get('/billing-finance/pnl/departments/', { params }).then(r => r.data),
  getBranchProfitability: (params?: any) => api.get('/billing-finance/pnl/branches/', { params }).then(r => r.data),
  getProfitLossDrilldown: (params: any) => api.get('/billing-finance/pnl/drilldown/', { params }).then(r => r.data),
  exportProfitLossCSV: (params?: any) => api.get('/billing-finance/pnl/export-csv/', { params, responseType: 'blob' }),
  getCashFlow: (params?: any) => api.get('/billing-finance/cash-flow/', { params }).then(r => r.data),
  getCashBankBooks: (params?: any) => api.get('/billing-finance/cash-bank-book/', { params }).then(r => r.data),
  getReceivablesPayablesLedger: (params?: any) => api.get('/billing-finance/receivables-payables-ledger/', { params }).then(r => r.data),
  autoPostModuleGL: (payload: { event_type: string; payload: any }) => api.post('/billing-finance/auto-post-module/', payload).then(r => r.data),

  getBankAccounts: () => api.get('/billing-finance/bank-accounts/').then(r => r.data),
  reconcileBankTransaction: (id: string) => api.post(`/billing-finance/bank-transactions/${id}/reconcile/`).then(r => r.data),
  getBudgets: () => api.get('/billing-finance/budgets/').then(r => r.data),

  // Section 13: Financial Accounts Management
  getFinancialAccounts: async (params?: any) => (await api.get('/billing-finance/financial-accounts/', { params })).data,
  getFinancialAccountDetail: async (id: string) => (await api.get(`/billing-finance/financial-accounts/${id}/`)).data,
  createFinancialAccount: async (payload: any) => (await api.post('/billing-finance/financial-accounts/', payload)).data,
  updateFinancialAccount: async (id: string, payload: any) => (await api.patch(`/billing-finance/financial-accounts/${id}/`, payload)).data,
  deleteFinancialAccount: async (id: string) => (await api.delete(`/billing-finance/financial-accounts/${id}/`)).data,
  toggleFinancialAccountStatus: async (id: string) => (await api.post(`/billing-finance/financial-accounts/${id}/toggle-status/`)).data,
  getFinancialAccountTransactions: async (id: string, params?: any) => (await api.get(`/billing-finance/financial-accounts/${id}/transactions/`, { params })).data,
  postFinancialAccountTransaction: async (id: string, payload: any) => (await api.post(`/billing-finance/financial-accounts/${id}/post-transaction/`, payload)).data,
  getFinancialAccountsDashboardStats: async () => (await api.get('/billing-finance/financial-accounts/dashboard-stats/')).data,

  // Bank Statement Import & Verification
  previewStatementCsv: async (formData: FormData) => (await api.post('/billing-finance/bank-statements/preview-csv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })).data,
  importStatementCsv: async (formData: FormData) => (await api.post('/billing-finance/bank-statements/import-csv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })).data,
  getStatementBatches: async (params?: any) => (await api.get('/billing-finance/bank-statements/batches/', { params })).data,
  getStatementEntries: async (params?: any) => (await api.get('/billing-finance/bank-statements/entries/', { params })).data,

  // Bank & Settlement Reconciliation
  initiateReconciliation: async (payload: any) => (await api.post('/billing-finance/reconciliations/initiate/', payload)).data,
  getReconciliations: async (params?: any) => (await api.get('/billing-finance/reconciliations/', { params })).data,
  suggestReconciliationMatches: async (id: string) => (await api.post(`/billing-finance/reconciliations/${id}/suggest-matches/`)).data,
  confirmReconciliationMatch: async (id: string, payload: any) => (await api.post(`/billing-finance/reconciliations/${id}/confirm-match/`, payload)).data,
  unmatchReconciliationEntry: async (id: string, payload: any) => (await api.post(`/billing-finance/reconciliations/${id}/unmatch/`, payload)).data,
  recordReconciliationAdjustment: async (id: string, payload: any) => (await api.post(`/billing-finance/reconciliations/${id}/record-adjustment/`, payload)).data,
  finalizeReconciliation: async (id: string, payload?: any) => (await api.post(`/billing-finance/reconciliations/${id}/finalize/`, payload || {})).data,

  // Section 14: Financial Transaction Management
  getFinancialTransactions: async (params?: any) => (await api.get('/billing-finance/financial-transactions/', { params })).data,
  getFinancialTransactionDetail: async (id: string) => (await api.get(`/billing-finance/financial-transactions/${id}/`)).data,
  createFinancialTransaction: async (payload: any) => (await api.post('/billing-finance/financial-transactions/', payload)).data,
  updateFinancialTransaction: async (id: string, payload: any) => (await api.patch(`/billing-finance/financial-transactions/${id}/`, payload)).data,
  submitFinancialTransactionForApproval: async (id: string, payload?: any) => (await api.post(`/billing-finance/financial-transactions/${id}/submit-approval/`, payload || {})).data,
  approveFinancialTransaction: async (id: string, payload?: any) => (await api.post(`/billing-finance/financial-transactions/${id}/approve/`, payload || {})).data,
  rejectFinancialTransaction: async (id: string, payload: { reason: string }) => (await api.post(`/billing-finance/financial-transactions/${id}/reject/`, payload)).data,
  postFinancialTransaction: async (id: string) => (await api.post(`/billing-finance/financial-transactions/${id}/post/`)).data,
  reverseFinancialTransaction: async (id: string, payload: { reason: string }) => (await api.post(`/billing-finance/financial-transactions/${id}/reverse/`, payload)).data,
  cancelFinancialTransaction: async (id: string, payload?: { reason?: string }) => (await api.post(`/billing-finance/financial-transactions/${id}/cancel/`, payload || {})).data,
  getFinancialTransactionAuditTrail: async (id: string) => (await api.get(`/billing-finance/financial-transactions/${id}/audit-trail/`)).data,
  uploadFinancialTransactionDocument: async (id: string, formData: FormData) => (await api.post(`/billing-finance/financial-transactions/${id}/documents/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })).data,
  getFinancialTransactionDashboardStats: async () => (await api.get('/billing-finance/financial-transactions/dashboard-stats/')).data,
  exportFinancialTransactionsCsv: async (params?: any) => (await api.get('/billing-finance/financial-transactions/export/', { params, responseType: 'blob' })).data,
  // Section 13: Supporting Documents
  getFinancialDocuments: async (params?: any) => (await api.get('/billing-finance/financial-documents/', { params })).data,
  uploadFinancialDocument: async (formData: FormData) => (await api.post('/billing-finance/financial-documents/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })).data,

  // Section 15: Investment Portfolio Management
  getInvestments: async (params?: any) => (await api.get('/billing-finance/investments/', { params })).data,
  getInvestmentDetail: async (id: string) => (await api.get(`/billing-finance/investments/${id}/`)).data,
  createInvestment: async (payload: any) => (await api.post('/billing-finance/investments/', payload)).data,
  updateInvestment: async (id: string, payload: any) => (await api.patch(`/billing-finance/investments/${id}/`, payload)).data,
  deleteInvestment: async (id: string) => (await api.delete(`/billing-finance/investments/${id}/`)).data,
  calculateInvestmentYield: async (payload: any) => (await api.post('/billing-finance/investments/calculate-yield/', payload)).data,
  submitInvestmentForApproval: async (id: string) => (await api.post(`/billing-finance/investments/${id}/submit-approval/`)).data,
  approveInvestment: async (id: string, payload?: any) => (await api.post(`/billing-finance/investments/${id}/approve/`, payload || {})).data,
  rejectInvestment: async (id: string, payload: { reason: string }) => (await api.post(`/billing-finance/investments/${id}/reject/`, payload)).data,
  purchaseInvestment: async (id: string, payload?: any) => (await api.post(`/billing-finance/investments/${id}/purchase/`, payload || {})).data,
  recordInvestmentIncome: async (id: string, payload: any) => (await api.post(`/billing-finance/investments/${id}/record-income/`, payload)).data,
  recordInvestmentValuation: async (id: string, payload: any) => (await api.post(`/billing-finance/investments/${id}/record-valuation/`, payload)).data,
  redeemInvestment: async (id: string, payload: any) => (await api.post(`/billing-finance/investments/${id}/redeem/`, payload)).data,
  getInvestmentDashboardStats: async () => (await api.get('/billing-finance/investments/dashboard-stats/')).data,
  getInvestmentMaturityCalendar: async () => (await api.get('/billing-finance/investments/maturity-calendar/')).data,
  getInvestmentAuditTrail: async (id: string) => (await api.get(`/billing-finance/investments/${id}/audit-trail/`)).data,
  uploadInvestmentDocument: async (id: string, formData: FormData) => (await api.post(`/billing-finance/investments/${id}/documents/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })).data,
  exportInvestmentsCsv: async (params?: any) => (await api.get('/billing-finance/investments/export/', { params, responseType: 'blob' })).data,

  // Section 16: Loan Management
  getLoans: async (params?: any) => (await api.get('/billing-finance/loans/', { params })).data,
  getLoanDetail: async (id: string) => (await api.get(`/billing-finance/loans/${id}/`)).data,
  createLoan: async (payload: any) => (await api.post('/billing-finance/loans/', payload)).data,
  updateLoan: async (id: string, payload: any) => (await api.patch(`/billing-finance/loans/${id}/`, payload)).data,
  deleteLoan: async (id: string) => (await api.delete(`/billing-finance/loans/${id}/`)).data,
  submitLoanForApproval: async (id: string) => (await api.post(`/billing-finance/loans/${id}/submit/`)).data,
  approveLoan: async (id: string, payload?: any) => (await api.post(`/billing-finance/loans/${id}/approve/`, payload || {})).data,
  disburseLoan: async (id: string, payload: any) => (await api.post(`/billing-finance/loans/${id}/disburse/`, payload)).data,
  recordLoanRepayment: async (id: string, payload: any) => (await api.post(`/billing-finance/loans/${id}/record-repayment/`, payload)).data,
  earlyPayoffLoan: async (id: string, payload?: any) => (await api.post(`/billing-finance/loans/${id}/early-payoff/`, payload || {})).data,
  getLoanSchedules: async (id: string) => (await api.get(`/billing-finance/loans/${id}/schedules/`)).data,
  getLoanRepayments: async (id: string) => (await api.get(`/billing-finance/loans/${id}/repayments/`)).data,
  getLoanAuditLogs: async (id: string) => (await api.get(`/billing-finance/loans/${id}/audit-logs/`)).data,
  uploadLoanDocument: async (id: string, formData: FormData) => (await api.post(`/billing-finance/loans/${id}/documents/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })).data,

  // Section 16: Liability Management
  getLiabilities: async (params?: any) => (await api.get('/billing-finance/liabilities/', { params })).data,
  getLiabilityDetail: async (id: string) => (await api.get(`/billing-finance/liabilities/${id}/`)).data,
  createLiability: async (payload: any) => (await api.post('/billing-finance/liabilities/', payload)).data,
  updateLiability: async (id: string, payload: any) => (await api.patch(`/billing-finance/liabilities/${id}/`, payload)).data,
  deleteLiability: async (id: string) => (await api.delete(`/billing-finance/liabilities/${id}/`)).data,
  recordLiabilityPayment: async (id: string, payload: any) => (await api.post(`/billing-finance/liabilities/${id}/record-payment/`, payload)).data,
  syncSupplierInvoices: async () => (await api.post('/billing-finance/liabilities/sync-supplier-invoices/')).data,
  getLiabilityAuditLogs: async (id: string) => (await api.get(`/billing-finance/liabilities/${id}/audit-logs/`)).data,
  uploadLiabilityDocument: async (id: string, formData: FormData) => (await api.post(`/billing-finance/liabilities/${id}/documents/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })).data,

  // Section 16: Dashboard & Reports
  getLoanLiabilityDashboard: async () => (await api.get('/billing-finance/loans/dashboard/')).data,
  exportLoansCsv: async (params?: any) => (await api.get('/billing-finance/loans/export-csv/', { params: { ...params, type: 'loans' }, responseType: 'blob' })).data,
  exportLiabilitiesCsv: async (params?: any) => (await api.get('/billing-finance/loans/export-csv/', { params: { ...params, type: 'liabilities' }, responseType: 'blob' })).data,

  // Section 19: Cash Flow and Financial Planning
  getCashFlowDashboard: async (params?: any) => (await api.get('/billing-finance/cash-flow/dashboard/', { params })).data,
  getCashFlowActualBreakdown: async (params?: any) => (await api.get('/billing-finance/cash-flow/actual-breakdown/', { params })).data,
  getCashFlowForecast: async (params?: any) => (await api.get('/billing-finance/cash-flow/forecast/', { params })).data,
  getExpectedPatientCollections: async (params?: any) => (await api.get('/billing-finance/cash-flow/patient-collections/', { params })).data,
  getExpectedInsuranceReceipts: async (params?: any) => (await api.get('/billing-finance/cash-flow/insurance-receipts/', { params })).data,
  getSupplierPaymentSchedules: async (params?: any) => (await api.get('/billing-finance/cash-flow/supplier-schedules/', { params })).data,
  updateSupplierPlannedPaymentDate: async (payload: { schedule_id: string; planned_payment_date: string }) => (await api.post('/billing-finance/cash-flow/supplier-schedules/update-date/', payload)).data,
  getPayrollTaxSchedules: async (params?: any) => (await api.get('/billing-finance/cash-flow/payroll-tax-schedules/', { params })).data,
  getLoanRepaymentForecasts: async (params?: any) => (await api.get('/billing-finance/cash-flow/loan-forecasts/', { params })).data,
  getInvestmentMaturityForecasts: async (params?: any) => (await api.get('/billing-finance/cash-flow/investment-forecasts/', { params })).data,
  getBudgetVarianceReport: async (params?: any) => (await api.get('/billing-finance/cash-flow/budget-variance/', { params })).data,
  exportCashFlowCsv: async (params?: any) => (await api.get('/billing-finance/cash-flow/export-csv/', { params, responseType: 'blob' })).data,

  getFinancialBudgets: async (params?: any) => (await api.get('/billing-finance/financial-budgets/', { params })).data,
  createFinancialBudget: async (payload: any) => (await api.post('/billing-finance/financial-budgets/', payload)).data,
  submitBudgetForApproval: async (id: string) => (await api.post(`/billing-finance/financial-budgets/${id}/submit-approval/`)).data,
  approveFinancialBudget: async (id: string) => (await api.post(`/billing-finance/financial-budgets/${id}/approve/`)).data,
  reviseFinancialBudget: async (id: string, payload: { revised_amount: string; reason: string }) => (await api.post(`/billing-finance/financial-budgets/${id}/revise/`, payload)).data,

  getCapexPlans: async (params?: any) => (await api.get('/billing-finance/capex-plans/', { params })).data,
  createCapexPlan: async (payload: any) => (await api.post('/billing-finance/capex-plans/', payload)).data,
  approveCapexPlan: async (id: string) => (await api.post(`/billing-finance/capex-plans/${id}/approve/`)).data,

  getMinimumCashThresholds: async (params?: any) => (await api.get('/billing-finance/minimum-cash-thresholds/', { params })).data,
  createMinimumCashThreshold: async (payload: any) => (await api.post('/billing-finance/minimum-cash-thresholds/', payload)).data,
  deleteMinimumCashThreshold: async (id: string) => (await api.delete(`/billing-finance/minimum-cash-thresholds/${id}/`)).data,

  getLiquidityAlerts: async (params?: any) => (await api.get('/billing-finance/liquidity-alerts/', { params })).data,
  acknowledgeLiquidityAlert: async (id: string) => (await api.post(`/billing-finance/liquidity-alerts/${id}/acknowledge/`)).data,
  refreshLiquidityAlerts: async (payload?: any) => (await api.post('/billing-finance/liquidity-alerts/refresh/', payload || {})).data,
};

export const diagnosticsService = {
  getLabDashboardStats: (branch_id?: string) => api.get('/clinical/lab/dashboard-stats/', { params: { branch_id } }).then(r => r.data),
  getCatalogue: (params?: any) => api.get('/clinical/lab/catalogue/', { params }).then(r => r.data),
  createCatalogueItem: (data: any) => api.post('/clinical/lab/catalogue/', data).then(r => r.data),
  updateCatalogueItem: (id: string, data: any) => api.patch(`/clinical/lab/catalogue/${id}/`, data).then(r => r.data),
  getOrders: (params?: any) => api.get('/clinical/lab/orders/', { params }).then(r => r.data),
  createOrder: (data: any) => api.post('/clinical/lab/orders/create/', data).then(r => r.data),
  cancelOrder: (id: string, reason: string) => api.post(`/clinical/lab/orders/${id}/cancel/`, { reason }).then(r => r.data),
  collectSample: (orderId: string, data: any) => api.post(`/clinical/lab/orders/${orderId}/collect-sample/`, data).then(r => r.data),
  sampleAction: (sampleId: string, data: { action: string; reason?: string }) => api.post(`/clinical/lab/samples/${sampleId}/action/`, data).then(r => r.data),
  lookupBarcode: (barcode: string) => api.get(`/clinical/lab/barcode/${barcode}/`).then(r => r.data),
  enterResult: (itemId: string, data: any) => api.post(`/clinical/lab/items/${itemId}/enter-result/`, data).then(r => r.data),
  approveReport: (orderId: string, data?: any) => api.post(`/clinical/lab/orders/${orderId}/approve/`, data || {}).then(r => r.data),
  releaseReport: (orderId: string) => api.post(`/clinical/lab/orders/${orderId}/release/`).then(r => r.data),
  amendReport: (orderId: string, data: any) => api.post(`/clinical/lab/orders/${orderId}/amend/`, data).then(r => r.data),
  getCriticalAlerts: (params?: any) => api.get('/clinical/lab/critical-alerts/', { params }).then(r => r.data),
  acknowledgeCriticalAlert: (id: string, notes: string) => api.post(`/clinical/lab/critical-alerts/${id}/acknowledge/`, { acknowledgement_notes: notes }).then(r => r.data),
  escalateCriticalAlert: (id: string, reason: string) => api.post(`/clinical/lab/critical-alerts/${id}/escalate/`, { escalation_reason: reason }).then(r => r.data),
  getReportDetail: (reportId: string) => api.get(`/clinical/lab/reports/${reportId}/detail/`).then(r => r.data),
  downloadReport: (reportId: string) => api.get(`/clinical/lab/reports/${reportId}/download/`).then(r => r.data),
  getEquipment: () => api.get('/clinical/lab/equipment/').then(r => r.data),
  simulateEquipment: (data: any) => api.post('/clinical/lab/equipment/simulate/', data).then(r => r.data),
  getOutsourced: (params?: any) => api.get('/clinical/lab/outsourced/', { params }).then(r => r.data),
  dispatchOutsourced: (orderId: string, data: any) => api.post(`/clinical/lab/outsourced/${orderId}/dispatch/`, data).then(r => r.data),
  receiveOutsourcedResults: (orderId: string, data: any) => api.post(`/clinical/lab/outsourced/${orderId}/receive-results/`, data).then(r => r.data),
  getFinancialReports: (params?: any) => api.get('/clinical/lab/financial-reports/', { params }).then(r => r.data),
  getInteroperability: (orderId: string, format: string) => api.get(`/clinical/lab/orders/${orderId}/interoperability/`, { params: { format } }).then(r => r.data),
  getRadiologyOrders: (params?: any) => api.get('/clinical/radiology/orders/', { params }).then(r => r.data),
  createRadiologyOrder: (data: any) => api.post('/clinical/radiology/orders/', data).then(r => r.data),
  scheduleRadiology: (id: string, data: any) => api.post(`/clinical/radiology/orders/${id}/schedule/`, data).then(r => r.data),
  completeRadiology: (id: string, data: any) => api.post(`/clinical/radiology/orders/${id}/complete/`, data).then(r => r.data),
  reportRadiology: (id: string, data: any) => api.post(`/clinical/radiology/orders/${id}/report/`, data).then(r => r.data),
};

export const pharmacyService = {
  getDashboardStats: (branch_id?: string) =>
    api.get('/pharmacy/dashboard-stats/', { params: { branch_id } }).then(r => r.data),
  getMedicines: (params?: any) =>
    api.get('/pharmacy/medicines/', { params }).then(r => r.data),
  createMedicine: (data: any) =>
    api.post('/pharmacy/medicines/', data).then(r => r.data),
  updateMedicine: (id: string, data: any) =>
    api.patch(`/pharmacy/medicines/${id}/`, data).then(r => r.data),
  getBatches: (params?: any) =>
    api.get('/pharmacy/batches/', { params }).then(r => r.data),
  createBatch: (data: any) =>
    api.post('/pharmacy/batches/', data).then(r => r.data),
  getPrescriptions: (params?: any) =>
    api.get('/pharmacy/prescriptions/', { params }).then(r => r.data),
  createPrescription: (data: any) =>
    api.post('/pharmacy/prescriptions/', data).then(r => r.data),
  dispenseMedication: (data: any) =>
    api.post('/pharmacy/dispense/', data).then(r => r.data),
  issueIPDMedication: (data: any) =>
    api.post('/pharmacy/ipd-issue/', data).then(r => r.data),
  getSuppliers: () =>
    api.get('/pharmacy/suppliers/').then(r => r.data),
  createSupplier: (data: any) =>
    api.post('/pharmacy/suppliers/', data).then(r => r.data),
  getRequisitions: (params?: any) =>
    api.get('/pharmacy/requisitions/', { params }).then(r => r.data),
  createRequisition: (data: any) =>
    api.post('/pharmacy/requisitions/', data).then(r => r.data),
  approveRequisition: (id: string, notes?: string) =>
    api.post(`/pharmacy/requisitions/${id}/approve/`, { notes }).then(r => r.data),
  rejectRequisition: (id: string, reason: string) =>
    api.post(`/pharmacy/requisitions/${id}/reject/`, { reason }).then(r => r.data),
  convertRequisitionToPO: (id: string, data: any) =>
    api.post(`/pharmacy/requisitions/${id}/convert_to_po/`, data).then(r => r.data),
  getPurchaseOrders: (params?: any) =>
    api.get('/pharmacy/purchase-orders/', { params }).then(r => r.data),
  createPurchaseOrder: (data: any) =>
    api.post('/pharmacy/purchase-orders/', data).then(r => r.data),
  receiveGoodsPO: (id: string) =>
    api.post(`/pharmacy/purchase-orders/${id}/receive/`).then(r => r.data),
  getGRNs: (params?: any) =>
    api.get('/pharmacy/grns/', { params }).then(r => r.data),
  createGRN: (data: any) =>
    api.post('/pharmacy/grns/', data).then(r => r.data),
  getSupplierInvoices: (params?: any) =>
    api.get('/pharmacy/supplier-invoices/', { params }).then(r => r.data),
  createSupplierInvoice: (data: any) =>
    api.post('/pharmacy/supplier-invoices/', data).then(r => r.data),
  approveSupplierInvoice: (id: string) =>
    api.post(`/pharmacy/supplier-invoices/${id}/approve/`).then(r => r.data),
  getTransfers: (params?: any) =>
    api.get('/pharmacy/transfers/', { params }).then(r => r.data),
  createTransfer: (data: any) =>
    api.post('/pharmacy/transfers/', data).then(r => r.data),
  dispatchTransfer: (id: string) =>
    api.post(`/pharmacy/transfers/${id}/dispatch/`).then(r => r.data),
  receiveTransfer: (id: string, data?: any) =>
    api.post(`/pharmacy/transfers/${id}/receive/`, data || {}).then(r => r.data),
  getAdjustments: (params?: any) =>
    api.get('/pharmacy/adjustments/', { params }).then(r => r.data),
  createAdjustment: (data: any) =>
    api.post('/pharmacy/adjustments/', data).then(r => r.data),
  approveAdjustment: (id: string) =>
    api.post(`/pharmacy/adjustments/${id}/approve_and_post/`).then(r => r.data),
  getReturns: (params?: any) =>
    api.get('/pharmacy/returns/', { params }).then(r => r.data),
  createReturn: (data: any) =>
    api.post('/pharmacy/returns/', data).then(r => r.data),
  processReturnDisposition: (id: string, data: any) =>
    api.post(`/pharmacy/returns/${id}/process_disposition/`, data).then(r => r.data),
  getReconciliations: () =>
    api.get('/pharmacy/reconciliations/').then(r => r.data),
  createReconciliation: (data: any) =>
    api.post('/pharmacy/reconciliations/', data).then(r => r.data),
  approveReconciliation: (id: string) =>
    api.post(`/pharmacy/reconciliations/${id}/approve_and_post/`).then(r => r.data),
  getValuation: (branch_id?: string) =>
    api.get('/pharmacy/valuation/', { params: { branch_id } }).then(r => r.data),
  getFinancialReports: (params?: any) =>
    api.get('/pharmacy/financial-reports/', { params }).then(r => r.data),
  lookupBarcode: (code: string) =>
    api.get('/pharmacy/barcode-lookup/', { params: { code } }).then(r => r.data),
  getReorderAlerts: (branch_id?: string) =>
    api.get('/pharmacy/reorder-alerts/', { params: { branch_id } }).then(r => r.data),
  getStockMovements: (params?: any) =>
    api.get('/pharmacy/stock-movements/', { params }).then(r => r.data),
  getAssets: (params?: any) =>
    api.get('/pharmacy/assets/', { params }).then(r => r.data),

  // Section 10: Procurement & Vendor Management
  toggleSupplierStatus: (id: string) =>
    api.post(`/pharmacy/suppliers/${id}/toggle-status/`).then(r => r.data),
  getQuotations: (params?: any) =>
    api.get('/pharmacy/quotations/', { params }).then(r => r.data),
  createQuotation: (data: any) =>
    api.post('/pharmacy/quotations/', data).then(r => r.data),
  getComparativeStatements: (params?: any) =>
    api.get('/pharmacy/comparative-statements/', { params }).then(r => r.data),
  createComparativeStatement: (data: any) =>
    api.post('/pharmacy/comparative-statements/', data).then(r => r.data),
  awardComparativeStatement: (id: string, data: any) =>
    api.post(`/pharmacy/comparative-statements/${id}/award/`, data).then(r => r.data),
  approvePurchaseOrder: (id: string, data?: any) =>
    api.post(`/pharmacy/purchase-orders/${id}/approve/`, data || {}).then(r => r.data),
  issuePurchaseOrder: (id: string) =>
    api.post(`/pharmacy/purchase-orders/${id}/issue/`).then(r => r.data),
  amendPurchaseOrder: (id: string, data: any) =>
    api.post(`/pharmacy/purchase-orders/${id}/amend/`, data).then(r => r.data),
  getSupplierReturns: (params?: any) =>
    api.get('/pharmacy/supplier-returns/', { params }).then(r => r.data),
  createSupplierReturn: (data: any) =>
    api.post('/pharmacy/supplier-returns/', data).then(r => r.data),
  getCreditNotes: (params?: any) =>
    api.get('/pharmacy/credit-notes/', { params }).then(r => r.data),
  applyCreditNoteToInvoice: (id: string, invoice_id: string) =>
    api.post(`/pharmacy/credit-notes/${id}/apply-to-invoice/`, { invoice_id }).then(r => r.data),
  getPaymentSchedules: (params?: any) =>
    api.get('/pharmacy/payment-schedules/', { params }).then(r => r.data),
  createPaymentSchedule: (data: any) =>
    api.post('/pharmacy/payment-schedules/', data).then(r => r.data),
  recordPaymentSettlement: (id: string, payment_reference: string) =>
    api.post(`/pharmacy/payment-schedules/${id}/record-settlement/`, { payment_reference }).then(r => r.data),
  getOutstandingBalances: (params?: any) =>
    api.get('/pharmacy/outstanding-balances/', { params }).then(r => r.data),
  getVendorPerformance: (params?: any) =>
    api.get('/pharmacy/vendor-performance/', { params }).then(r => r.data),
};

export const procurementService = pharmacyService;

// =============================================================================
// SECTION 20: HR, PAYROLL, FIXED ASSETS & OPERATIONS SERVICE
// =============================================================================
export const operationsHrService = {
  // Dashboards
  getHRDashboard: (params?: any) => api.get('/operations-hr/dashboards/hr/', { params }).then(r => r.data),
  getAssetDashboard: (params?: any) => api.get('/operations-hr/dashboards/assets/', { params }).then(r => r.data),
  getOperationsDashboard: (params?: any) => api.get('/operations-hr/dashboards/operations/', { params }).then(r => r.data),

  // Employees & HR
  getStaffMembers: (params?: any) => api.get('/operations-hr/staff-members/', { params }).then(r => r.data),
  getStaffDetail: (id: string) => api.get(`/operations-hr/staff-members/${id}/`).then(r => r.data),
  onboardEmployee: (payload: any) => api.post('/operations-hr/staff-members/', payload).then(r => r.data),
  updateEmployee: (id: string, payload: any) => api.patch(`/operations-hr/staff-members/${id}/`, payload).then(r => r.data),
  separateEmployee: (id: string, payload: any) => api.post(`/operations-hr/staff-members/${id}/separate/`, payload).then(r => r.data),
  uploadEmployeeDocument: (id: string, payload: any) => api.post(`/operations-hr/staff-members/${id}/upload-document/`, payload).then(r => r.data),

  // Shifts & Rosters
  getShifts: (params?: any) => api.get('/operations-hr/shifts/', { params }).then(r => r.data),
  createShift: (payload: any) => api.post('/operations-hr/shifts/', payload).then(r => r.data),
  getRosters: (params?: any) => api.get('/operations-hr/rosters/', { params }).then(r => r.data),
  assignRoster: (payload: any) => api.post('/operations-hr/rosters/', payload).then(r => r.data),
  requestShiftSwap: (id: string, payload: any) => api.post(`/operations-hr/rosters/${id}/swap-request/`, payload).then(r => r.data),
  approveShiftSwap: (id: string) => api.post(`/operations-hr/rosters/${id}/approve-swap/`).then(r => r.data),

  // Attendance
  getAttendance: (params?: any) => api.get('/operations-hr/attendance/', { params }).then(r => r.data),
  clockAttendance: (payload: any) => api.post('/operations-hr/attendance/clock/', payload).then(r => r.data),
  correctAttendance: (id: string, payload: any) => api.post(`/operations-hr/attendance/${id}/correct/`, payload).then(r => r.data),

  // Leaves & Holidays
  getLeaveRequests: (params?: any) => api.get('/operations-hr/leaves/', { params }).then(r => r.data),
  applyLeave: (payload: any) => api.post('/operations-hr/leaves/', payload).then(r => r.data),
  approveLeave: (id: string, payload?: any) => api.post(`/operations-hr/leaves/${id}/approve/`, payload || {}).then(r => r.data),
  rejectLeave: (id: string, payload?: any) => api.post(`/operations-hr/leaves/${id}/reject/`, payload || {}).then(r => r.data),
  getLeaveBalances: (params?: any) => api.get('/operations-hr/leave-balances/', { params }).then(r => r.data),
  getHolidays: () => api.get('/operations-hr/holidays/').then(r => r.data),

  // Payroll & Salary
  getSalaryStructures: (params?: any) => api.get('/operations-hr/salary-structures/', { params }).then(r => r.data),
  createOrUpdateSalaryStructure: (payload: any) => api.post('/operations-hr/salary-structures/', payload).then(r => r.data),
  getPayrollPeriods: (params?: any) => api.get('/operations-hr/payroll/', { params }).then(r => r.data),
  generatePayrollRun: (payload: any) => api.post('/operations-hr/payroll/', payload).then(r => r.data),
  submitPayrollApproval: (id: string) => api.post(`/operations-hr/payroll/${id}/submit-approval/`).then(r => r.data),
  approvePayroll: (id: string) => api.post(`/operations-hr/payroll/${id}/approve/`).then(r => r.data),
  postPayrollToGL: (id: string) => api.post(`/operations-hr/payroll/${id}/post-gl/`).then(r => r.data),
  disbursePayroll: (id: string, payload?: any) => api.post(`/operations-hr/payroll/${id}/disburse/`, payload || {}).then(r => r.data),
  getPayslips: (params?: any) => api.get('/operations-hr/payslips/', { params }).then(r => r.data),

  // Fixed Assets & Straight-Line Depreciation
  getFixedAssets: (params?: any) => api.get('/operations-hr/fixed-assets/', { params }).then(r => r.data),
  createFixedAsset: (payload: any) => api.post('/operations-hr/fixed-assets/', payload).then(r => r.data),
  updateFixedAsset: (id: string, payload: any) => api.patch(`/operations-hr/fixed-assets/${id}/`, payload).then(r => r.data),
  calculateDepreciation: (id: string, payload: any) => api.post(`/operations-hr/fixed-assets/${id}/depreciate/`, payload).then(r => r.data),
  getDepreciationSchedules: (params?: any) => api.get('/operations-hr/depreciation-schedules/', { params }).then(r => r.data),

  // Medical Equipment Maintenance
  getMaintenanceTasks: (params?: any) => api.get('/operations-hr/maintenance-tasks/', { params }).then(r => r.data),
  createMaintenanceTask: (payload: any) => api.post('/operations-hr/maintenance-tasks/', payload).then(r => r.data),
  completeAndCertifyMaintenance: (id: string, payload: any) => api.post(`/operations-hr/maintenance-tasks/${id}/certify-complete/`, payload).then(r => r.data),

  // Operation Theatre (OT) & ICU
  getOTSuites: () => api.get('/operations-hr/ot-suites/').then(r => r.data),
  getOTBookings: (params?: any) => api.get('/operations-hr/ot-bookings/', { params }).then(r => r.data),
  bookOperationTheatre: (payload: any) => api.post('/operations-hr/ot-bookings/', payload).then(r => r.data),
  completeSurgery: (id: string) => api.post(`/operations-hr/ot-bookings/${id}/complete/`).then(r => r.data),
  cancelSurgeryBooking: (id: string, payload: any) => api.post(`/operations-hr/ot-bookings/${id}/cancel/`, payload).then(r => r.data),
  getICUObservations: (params?: any) => api.get('/operations-hr/icu-observations/', { params }).then(r => r.data),
  recordICUObservation: (payload: any) => api.post('/operations-hr/icu-observations/', payload).then(r => r.data),

  // Ambulance Fleet & Dispatch
  getAmbulances: (params?: any) => api.get('/operations-hr/ambulances/', { params }).then(r => r.data),
  getAmbulanceDispatches: (params?: any) => api.get('/operations-hr/ambulance-dispatches/', { params }).then(r => r.data),
  dispatchAmbulance: (payload: any) => api.post('/operations-hr/ambulance-dispatches/', payload).then(r => r.data),
  completeAmbulanceTrip: (id: string, payload: any) => api.post(`/operations-hr/ambulance-dispatches/${id}/complete/`, payload).then(r => r.data),

  // Blood Bank
  getBloodStock: (params?: any) => api.get('/operations-hr/blood-bank/', { params }).then(r => r.data),
  issueBloodUnit: (id: string, payload: any) => api.post(`/operations-hr/blood-bank/${id}/issue/`, payload).then(r => r.data),

  // Housekeeping
  getHousekeepingTasks: (params?: any) => api.get('/operations-hr/housekeeping/', { params }).then(r => r.data),
  createHousekeepingTask: (payload: any) => api.post('/operations-hr/housekeeping/', payload).then(r => r.data),
  startCleaning: (id: string) => api.post(`/operations-hr/housekeeping/${id}/start/`).then(r => r.data),
  completeCleaning: (id: string, payload?: any) => api.post(`/operations-hr/housekeeping/${id}/complete/`, payload || {}).then(r => r.data),
  inspectCleaningTask: (id: string, payload?: any) => api.post(`/operations-hr/housekeeping/${id}/inspect/`, payload || {}).then(r => r.data),

  // Biomedical Waste
  getBiomedicalWasteRecords: (params?: any) => api.get('/operations-hr/biomedical-waste/', { params }).then(r => r.data),
  createBiomedicalWasteRecord: (payload: any) => api.post('/operations-hr/biomedical-waste/', payload).then(r => r.data),
  handoverWasteManifest: (id: string, payload: any) => api.post(`/operations-hr/biomedical-waste/${id}/handover/`, payload).then(r => r.data),

  // Legacy & General Operations
  logAttendance: (payload: any) => api.post('/operations-hr/attendance/clock/', payload).then(r => r.data),
  getLeaves: (params?: any) => api.get('/operations-hr/leaves/', { params }).then(r => r.data),
  getPayroll: (params?: any) => api.get('/operations-hr/payroll/', { params }).then(r => r.data),
  processPayroll: (payload: any) => api.post('/operations-hr/payroll/', payload).then(r => r.data),
  getAnalyticsOverview: (branch_id?: string) => api.get('/operations-hr/dashboards/hr/', { params: { branch_id } }).then(r => r.data),
  getAuditLogs: () => api.get('/operations-hr/audit-logs/').then(r => r.data),
  getSettings: () => api.get('/operations-hr/settings/').then(r => r.data),
};

// ==============================================================================
// SECTION 21: DASHBOARDS AND REPORTS SERVICE
// ==============================================================================

export interface DashboardFilterParams {
  from_date?: string;
  to_date?: string;
  branch_id?: string;
  department_id?: string;
  account_id?: string;
}

export interface DrillDownParams extends DashboardFilterParams {
  metric: string;
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export const reportsDashboardService = {
  getAdminDashboard: (params?: DashboardFilterParams) =>
    api.get('/dashboards-reports/admin/', { params }).then(r => r.data),

  getFinanceDashboard: (params?: DashboardFilterParams) =>
    api.get('/dashboards-reports/finance/', { params }).then(r => r.data),

  getClinicalDashboard: (params?: DashboardFilterParams) =>
    api.get('/dashboards-reports/clinical/', { params }).then(r => r.data),

  getPharmacyDashboard: (params?: DashboardFilterParams) =>
    api.get('/dashboards-reports/pharmacy/', { params }).then(r => r.data),

  getDiagnosticsDashboard: (params?: DashboardFilterParams) =>
    api.get('/dashboards-reports/diagnostics/', { params }).then(r => r.data),

  getInventoryDashboard: (params?: DashboardFilterParams) =>
    api.get('/dashboards-reports/inventory/', { params }).then(r => r.data),

  getBillingDashboard: (params?: DashboardFilterParams) =>
    api.get('/dashboards-reports/billing/', { params }).then(r => r.data),

  getAccountingDashboard: (params?: DashboardFilterParams) =>
    api.get('/dashboards-reports/accounting/', { params }).then(r => r.data),

  getInvestmentsDashboard: (params?: DashboardFilterParams) =>
    api.get('/dashboards-reports/investments/', { params }).then(r => r.data),

  getDrillDownRecords: (params: DrillDownParams) =>
    api.get('/dashboards-reports/drill-down/', { params }).then(r => r.data),

  getExportUrl: (params: { metric: string; from_date?: string; to_date?: string; branch_id?: string; department_id?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
    return `${base}/dashboards-reports/export/?${query}`;
  },

  downloadExport: async (params: { metric: string; from_date?: string; to_date?: string; branch_id?: string; department_id?: string }) => {
    const res = await api.get('/dashboards-reports/export/', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${params.metric.toLowerCase()}_report.csv`;
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

export default api;


