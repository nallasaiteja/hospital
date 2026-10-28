export type UserRole =
  | 'SUPER_ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'MEDICAL_DIRECTOR'
  | 'DOCTOR'
  | 'NURSE'
  | 'RECEPTIONIST'
  | 'BILLING_EXECUTIVE'
  | 'LAB_TECHNICIAN'
  | 'RADIOLOGY_TECHNICIAN'
  | 'PHARMACIST'
  | 'INVENTORY_MANAGER'
  | 'PROCUREMENT_OFFICER'
  | 'ACCOUNTANT'
  | 'FINANCE_MANAGER'
  | 'INVESTMENT_MANAGER'
  | 'CASHIER'
  | 'INSURANCE_COORDINATOR'
  | 'HR_MANAGER'
  | 'DEPARTMENT_HEAD'
  | 'AUDITOR'
  | 'PATIENT'
  | 'BRANCH_MANAGER'; // preserved for backward compatibility

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  action?: string;
  description?: string;
}

export interface Role {
  id: string;
  name: UserRole;
  display_name: string;
  description?: string;
  permissions?: Permission[];
  users_count?: number;
}

export interface FinancialApprovalPolicy {
  id: string;
  operation_type: string;
  min_amount: string | number;
  max_amount?: string | number | null;
  approver_roles: string[];
  requires_separation_of_duties: boolean;
  approval_level: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialApprovalRequest {
  id: string;
  operation_type: string;
  entity_type: string;
  entity_id: string;
  amount: string | number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'POSTED' | 'REVERSED' | 'REJECTED';
  requested_by: string;
  requested_by_name?: string;
  requested_by_email?: string;
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_by_email?: string;
  policy?: string;
  notes?: string;
  rejection_reason?: string;
  created_at: string;
  reviewed_at?: string;
}

export interface SecurityAuditEvent {
  id: string;
  event_type: string;
  event_type_display?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  actor_id?: string;
  actor_email?: string;
  actor_role?: string;
  ip_address?: string;
  target_model?: string;
  target_id?: string;
  target_user_email?: string;
  action_summary: string;
  metadata?: Record<string, any>;
  details?: Record<string, any>;
  timestamp: string;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  supabase_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  role: Role | { name: UserRole; display_name?: string };
  is_verified?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Hospital {
  id: string;
  name: string;
  code: string;
  tax_identifier?: string;
  is_active: boolean;
  created_at: string;
}

export interface Branch {
  id: string;
  hospital_id: string;
  name: string;
  code: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  is_main_branch: boolean;
  is_active: boolean;
}

export interface Department {
  id: string;
  branch_id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
}

export interface StaffProfile {
  id: string;
  user_id?: string;
  user_profile: UserProfile;
  branch_id?: string;
  branch?: Branch;
  branch_name?: string;
  department_id?: string;
  department?: Department;
  department_name?: string;
  employee_id: string;
  designation: string;
  specialization?: string;
  medical_license_number?: string;
  qualification?: string;
  consultation_fee?: number;
  status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'RESIGNED';
  is_on_duty: boolean;
  joining_date?: string;
}

export interface PatientProfile {
  id: string;
  user_id?: string;
  user_profile: UserProfile;
  primary_branch_id?: string;
  primary_branch?: Branch;
  primary_branch_name?: string;
  medical_record_number: string; // e.g. MRN-2026-00001
  status?: 'ACTIVE' | 'INACTIVE' | 'MERGED';
  merged_into?: string;
  merged_into_mrn?: string;
  uhid?: string;
  date_of_birth?: string;
  age?: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  blood_group?: string;
  photo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  allergies: string[];
  chronic_conditions: string[];
  past_medical_history?: string[];
  past_surgical_history?: string[];
  family_history?: string;
  social_history?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  consents_count?: number;
  documents_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PatientConsent {
  id: string;
  patient: string;
  consent_type: 'GENERAL_TREATMENT' | 'SURGERY_ANESTHESIA' | 'DATA_SHARING' | 'TELEMEDICINE' | 'RESEARCH';
  status: 'GRANTED' | 'REVOKED' | 'EXPIRED';
  recorded_by?: string;
  recorded_by_name?: string;
  recorded_at: string;
  document_url?: string;
  notes?: string;
  revocation_reason?: string;
  revoked_at?: string;
}

export interface PatientDocument {
  id: string;
  patient: string;
  document_type: 'GOVT_ID' | 'INSURANCE_CARD' | 'CONSENT_FORM' | 'EXTERNAL_REPORT' | 'DISCHARGE_SUMMARY' | 'OTHER';
  title: string;
  file_url: string;
  file_size_kb?: number;
  mime_type?: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  notes?: string;
  created_at: string;
}

export interface PatientDashboardStats {
  total_registered: number;
  registered_today: number;
  active_patients: number;
  upcoming_appointments: number;
  recently_updated: number;
  requiring_follow_up: number;
  potential_duplicates_count: number;
}

export interface PatientEMRData {
  patient: PatientProfile;
  overview: {
    mrn: string;
    full_name: string;
    age?: number;
    gender: string;
    blood_group?: string;
    status: string;
    primary_branch: string;
    active_allergies_count: number;
    chronic_conditions_count: number;
    total_appointments: number;
    total_admissions: number;
    total_prescriptions: number;
    total_lab_orders: number;
    total_invoices: number;
  };
  demographics: {
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    phone?: string;
    email?: string;
    registered_date?: string;
  };
  emergency_contacts: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  medical_history: {
    chronic_conditions: string[];
    past_medical_history: string[];
    past_surgical_history: string[];
    family_history?: string;
    social_history?: string;
  };
  allergies: string[];
  consents: PatientConsent[];
  documents: PatientDocument[];
  appointments: Array<{
    id: string;
    appointment_number: string;
    date: string;
    time_slot: string;
    token_number?: string;
    doctor_name: string;
    department_name: string;
    status: string;
    reason_for_visit?: string;
    created_at: string;
  }>;
  consultations: Array<{
    appointment_id: string;
    appointment_number: string;
    date: string;
    doctor_name: string;
    department_name: string;
    vitals: Record<string, any>;
    consultation_notes: string;
    diagnosis: string;
    prescription_summary?: string;
    follow_up_date?: string;
  }>;
  diagnoses_and_plans: Array<{
    type: string;
    date: string;
    diagnosis: string;
    doctor_name: string;
    treatment_plan: string;
  }>;
  prescriptions: Array<{
    id: string;
    prescription_number: string;
    doctor_name: string;
    diagnosis: string;
    clinical_notes?: string;
    is_dispensed: boolean;
    created_at: string;
    items: Array<{
      medicine_name: string;
      generic_name: string;
      dosage: string;
      frequency: string;
      duration_days: number;
      total_quantity: number;
      instructions?: string;
    }>;
  }>;
  admissions: Array<{
    id: string;
    admission_number: string;
    admission_date: string;
    discharge_date?: string;
    ward_name: string;
    ward_type: string;
    bed_number: string;
    admitting_doctor: string;
    initial_diagnosis: string;
    status: string;
    discharge_condition?: string;
    discharge_summary?: string;
    discharge_medications: any[];
  }>;
  lab_reports: Array<{
    id: string;
    order_number: string;
    doctor_name: string;
    priority: string;
    status: string;
    created_at: string;
    items: Array<{
      test_code: string;
      test_name: string;
      category: string;
      result_value: string;
      reference_range: string;
      unit: string;
      is_abnormal: boolean;
      result_notes?: string;
      verified_by?: string;
      verified_at?: string;
    }>;
  }>;
  radiology_reports: Array<{
    id: string;
    order_number: string;
    doctor_name: string;
    radiologist_name?: string;
    modality: string;
    study_name: string;
    clinical_indication?: string;
    findings?: string;
    impression?: string;
    dicom_viewer_url?: string;
    status: string;
    reported_at?: string;
    created_at: string;
  }>;
  billing_history: Array<{
    id: string;
    invoice_number: string;
    date: string;
    total_amount: string;
    paid_amount: string;
    balance_amount: string;
    status: string;
    items_count: number;
    payments: Array<{
      payment_number: string;
      amount: string;
      method: string;
      reference?: string;
      date: string;
    }>;
  }>;
  clinical_notes: Array<{
    type: string;
    recorded_at: string;
    recorded_by: string;
    clinical_notes: string;
    vitals: Record<string, any>;
    treatment_plan?: string;
  }>;
  audit_trail: Array<{
    action: string;
    actor_email: string;
    timestamp: string;
    old_values?: any;
    new_values?: any;
  }>;
}

export interface Appointment {
  id: string;
  appointment_number: string;
  appointment_type?: 'SCHEDULED' | 'WALK_IN';
  booking_source?: string;
  patient_id: string;
  patient?: PatientProfile;
  patient_name?: string;
  patient_mrn?: string;
  patient_phone?: string;
  patient_gender?: string;
  patient_blood_group?: string;
  patient_allergies?: string[];
  doctor_id: string;
  doctor?: StaffProfile;
  doctor_name?: string;
  doctor_specialization?: string;
  doctor_fee?: string | number;
  department_id: string;
  department?: Department;
  department_name?: string;
  branch_name?: string;
  appointment_date: string;
  time_slot: string;
  token_number?: string;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  reason_for_visit: string;
  chief_complaint?: string;
  examination_findings?: string;
  diagnosis?: string;
  treatment_plan?: string;
  consultation_notes?: string;
  prescription_summary?: string;
  follow_up_instructions?: string;
  follow_up_date?: string;
  vitals?: Record<string, any>;
  checked_in_at?: string;
  consultation_started_at?: string;
  consultation_ended_at?: string;
  cancellation_reason?: string;
  invoice_number?: string;
  invoice_status?: string;
}

export interface OPDDashboardStats {
  date: string;
  total_appointments: number;
  scheduled: number;
  checked_in: number;
  waiting: number;
  in_consultation: number;
  completed: number;
  cancelled: number;
  no_show: number;
  walk_in_count: number;
  scheduled_type_count: number;
  average_wait_minutes: number;
  available_doctors_count: number;
  pending_follow_ups: number;
}

export interface DoctorSlot {
  slot: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  appointment?: {
    appointment_id: string;
    patient_name: string;
    appointment_number: string;
    status: string;
  };
}

export interface DoctorAvailabilityResponse {
  doctor_id: string;
  doctor_name: string;
  specialization?: string;
  department_name?: string;
  consultation_fee?: string;
  date: string;
  is_on_leave: boolean;
  leave_reason?: string;
  message?: string;
  slots: DoctorSlot[];
}

export interface QueueItem {
  id: string;
  appointment_number: string;
  token_number: string;
  appointment_type: 'SCHEDULED' | 'WALK_IN';
  status: 'SCHEDULED' | 'CHECKED_IN' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  time_slot: string;
  patient_id: string;
  patient_name: string;
  patient_mrn: string;
  patient_gender?: string;
  patient_blood_group?: string;
  patient_allergies?: string[];
  doctor_id: string;
  doctor_name: string;
  doctor_specialization?: string;
  doctor_fee?: string | number;
  department_name?: string;
  reason_for_visit?: string;
  chief_complaint?: string;
  checked_in_at?: string;
  consultation_started_at?: string;
  consultation_ended_at?: string;
  wait_minutes: number;
  invoice_number?: string;
  invoice_status?: string;
}

export interface DoctorScheduleRecord {
  id: string;
  doctor: string;
  doctor_name?: string;
  day_of_week: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  max_patients: number;
  is_available: boolean;
}

export interface DoctorLeaveRecord {
  id: string;
  doctor: string;
  doctor_name?: string;
  start_date: string;
  end_date: string;
  reason: string;
  is_approved: boolean;
}

// ==========================================
// SECTION 7: EMERGENCY & IPD INTERFACES
// ==========================================

export interface EmergencyCase {
  id: string;
  encounter_number: string;
  patient?: string;
  patient_id?: string;
  patient_name: string;
  patient_phone?: string;
  unregistered_patient_name?: string;
  triage_acuity: 'RED' | 'YELLOW' | 'GREEN';
  chief_complaint: string;
  arrival_mode: 'AMBULANCE' | 'WALK_IN' | 'POLICE' | 'TRANSFER';
  arrival_time: string;
  status: 'ARRIVED' | 'TRIAGED' | 'IN_TREATMENT' | 'ADMITTED_IPD' | 'DISCHARGED' | 'EXPIRED';
  assigned_doctor?: string;
  assigned_doctor_id?: string;
  assigned_doctor_name?: string;
  vitals?: Record<string, any>;
  treatment_summary?: string;
  discharge_summary?: string;
  discharged_at?: string;
  linked_admission?: string;
  linked_admission_number?: string;
  created_at: string;
}

export interface Bed {
  id: string;
  bed_number: string;
  ward: string;
  ward_name?: string;
  ward_type?: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  is_operational: boolean;
  current_patient?: string;
  current_patient_id?: string;
  current_patient_name?: string;
  daily_charge: string | number;
  features?: string[];
}

export interface Ward {
  id: string;
  name: string;
  branch: string;
  branch_name?: string;
  department: string;
  department_name?: string;
  ward_type: 'GENERAL' | 'SEMI_PRIVATE' | 'PRIVATE' | 'ICU' | 'NICU' | 'CCU' | 'EMERGENCY';
  total_beds: number;
  available_beds_count: number;
  occupied_beds_count: number;
  cleaning_beds_count: number;
  maintenance_beds_count: number;
  beds?: Bed[];
}

export interface InpatientAdmission {
  id: string;
  admission_number: string;
  patient: string;
  patient_id?: string;
  patient_name: string;
  patient_mrn: string;
  patient_gender?: string;
  patient_blood_group?: string;
  patient_allergies?: string[];
  patient_phone?: string;
  admission_date: string;
  discharge_date?: string;
  expected_discharge_date?: string;
  ward?: string;
  ward_id?: string;
  ward_name?: string;
  ward_type?: string;
  bed?: string;
  bed_id?: string;
  bed_number?: string;
  bed_daily_charge?: string | number;
  admitting_doctor: string;
  admitting_doctor_id?: string;
  admitting_doctor_name: string;
  requesting_doctor?: string;
  requesting_doctor_id?: string;
  requesting_doctor_name?: string;
  admission_source: 'EMERGENCY' | 'OPD' | 'DIRECT' | 'TRANSFER';
  priority: 'ROUTINE' | 'URGENT' | 'STAT_EMERGENCY';
  requested_ward_type: string;
  initial_diagnosis: string;
  status: 'REQUESTED' | 'APPROVED' | 'ADMITTED' | 'AWAITING_DISCHARGE' | 'DISCHARGED' | 'REJECTED' | 'TRANSFERRED';
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  admission_deposit: string | number;
  clinical_clearance: boolean;
  nursing_clearance: boolean;
  pharmacy_clearance: boolean;
  billing_clearance: boolean;
  cleared_by?: string;
  cleared_by_name?: string;
  discharge_condition?: string;
  discharge_summary?: string;
  follow_up_instructions?: string;
  invoice?: string;
  invoice_id?: string;
  invoice_number?: string;
  invoice_status?: string;
  invoice_total?: string | number;
  invoice_paid?: string | number;
  invoice_balance?: string | number;
  running_days: number;
  running_bed_charges: number;
}

export interface PatientTransferRecord {
  id: string;
  admission: string;
  admission_number: string;
  patient_id: string;
  patient_name: string;
  from_bed: string;
  from_bed_number: string;
  from_ward_name: string;
  to_bed: string;
  to_bed_number: string;
  to_ward_name: string;
  requested_by?: string;
  requested_by_name?: string;
  transfer_reason: string;
  clinical_handover_notes?: string;
  transfer_time: string;
}

export interface EmergencyIPDDashboardStats {
  emergency: {
    visits_today: number;
    active_cases: number;
    red_acuity: number;
    yellow_acuity: number;
    green_acuity: number;
    direct_admissions: number;
    discharges_today: number;
  };
  ipd: {
    total_beds: number;
    occupied_beds: number;
    available_beds: number;
    cleaning_beds: number;
    maintenance_beds: number;
    reserved_beds: number;
    occupancy_rate: number;
    active_inpatient_census: number;
    icu_patients: number;
    pending_admission_requests: number;
    awaiting_discharge: number;
    discharges_today: number;
    pending_transfers: number;
  };
  wards_breakdown: Array<{
    id: string;
    name: string;
    ward_type: string;
    total_beds: number;
    occupied_beds: number;
    available_beds: number;
    cleaning_beds: number;
  }>;
  recent_transfers: Array<{
    id: string;
    patient_name: string;
    from_bed: string;
    to_bed: string;
    transfer_time: string;
  }>;
}

export interface InpatientRunningBill {
  admission_id: string;
  admission_number: string;
  patient_name: string;
  patient_mrn: string;
  admission_date: string;
  days_stayed: number;
  bed_number: string;
  ward_name: string;
  bed_daily_rate: number;
  calculated_bed_charge: number;
  posted_charges: Array<{
    id: string;
    item_name: string;
    category: string;
    quantity: number;
    unit_price: string;
    total_amount: string;
  }>;
  posted_charges_total: number;
  advance_deposit: number;
  payments_recorded: Array<{
    payment_number: string;
    amount: string;
    method: string;
    date: string;
  }>;
  total_payments: number;
  estimated_gross_total: number;
  estimated_balance_due: number;
  invoice_number?: string;
  invoice_status?: string;
}


