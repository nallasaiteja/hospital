import api from './api';

export interface NurseOverview {
  nurse_info?: {
    id: string;
    name: string;
    employee_id: string;
    email?: string;
    department: string;
    branch: string;
    specialization?: string;
    is_on_duty?: boolean;
  };
  nurse?: {
    id: string;
    name: string;
    employee_id: string;
    email?: string;
    department: string;
    branch: string;
    specialization?: string;
    is_on_duty?: boolean;
  };
  shift_info?: {
    id?: string;
    shift_type?: string;
    shift_name?: string;
    shift_display?: string;
    start_time?: string;
    end_time?: string;
    ward?: string;
    ward_id?: string;
    assigned_beds_count?: number;
    hours_remaining?: string;
    working_hours?: string;
    is_on_duty?: boolean;
  };
  shift?: {
    id?: string;
    shift_type?: string;
    shift_name?: string;
    shift_display?: string;
    start_time?: string;
    end_time?: string;
    ward?: string;
    ward_id?: string;
    assigned_beds_count?: number;
    hours_remaining?: string;
    working_hours?: string;
    is_on_duty?: boolean;
  };
  summary_metrics?: {
    assigned_patients_count?: number;
    medications_due_count?: number;
    pending_tasks_count?: number;
    critical_alerts_count?: number;
  };
  summary_cards?: {
    assigned_patients?: number;
    medications_due?: number;
    pending_tasks?: number;
    critical_alerts?: number;
  };
  server_time: string;
  handover_status: {
    pending_acknowledgment?: boolean;
    pending_id?: string;
    last_completed_at?: string;
    code?: string;
    label?: string;
    latest_handover_id?: string | null;
  };
}

export interface NursePatient {
  id: string;
  admission_id: string;
  admission_number: string;
  uhid: string;
  first_name: string;
  last_name: string;
  full_name: string;
  age: number;
  gender: string;
  contact_number: string;
  emergency_contact: string;
  allergies: string[];
  dietary_restrictions: string;
  fall_risk: boolean;
  isolation_required: boolean;
  blood_group: string;
  admission_date: string;
  ward: string;
  ward_code: string;
  room_number: string;
  bed_number: string;
  admitting_doctor: {
    id: string;
    name: string;
    department: string;
    contact: string;
  };
  initial_diagnosis: string;
  latest_vitals: {
    id: string;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    heart_rate: number | null;
    body_temperature: number | null;
    respiratory_rate: number | null;
    spo2: number | null;
    blood_glucose: number | null;
    pain_score: number | null;
    severity_level: 'NORMAL' | 'WARNING' | 'CRITICAL';
    recorded_at: string;
    nurse_name: string;
  } | null;
  pending_medications_count: number;
  pending_tasks_count: number;
}

export interface MedicationRecord {
  id: string;
  patient_id: string;
  patient_name: string;
  uhid: string;
  ward_bed: string;
  prescription_id: string;
  item_id: string;
  medication_name: string;
  dosage: string;
  route: string;
  frequency: string;
  scheduled_time: string;
  food_instructions: string;
  doctor_instructions: string;
  prescribing_doctor: string;
  status: 'UPCOMING' | 'DUE' | 'ADMINISTERED' | 'MISSED' | 'REFUSED' | 'OVERDUE';
  administered_at: string | null;
  dosage_given: string;
  route_used: string;
  administering_nurse_name: string;
  nurse_remarks: string;
  reason_for_non_admin: string;
  adverse_reaction_notes: string;
  escalated_to_doctor: boolean;
}

export interface NursingTaskItem {
  id: string;
  patient_id: string;
  patient_name: string;
  uhid: string;
  ward_bed: string;
  attending_doctor: string;
  task_name: string;
  instructions: string;
  category: string;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  due_time: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assigned_nurse_name: string;
  completed_by_name: string;
  completed_at: string | null;
  completion_notes: string;
  created_at: string;
}

export interface VitalSignItem {
  id: string;
  patient_id: string;
  patient_name: string;
  uhid: string;
  ward_bed: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
  body_temperature: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  blood_glucose: number | null;
  pain_score: number | null;
  severity_level: 'NORMAL' | 'WARNING' | 'CRITICAL';
  alerts_triggered: string[];
  is_escalated: boolean;
  escalation_notes: string;
  recorded_by_name: string;
  recorded_at: string;
}

export interface ShiftHandoverItem {
  id: string;
  outgoing_nurse_name: string;
  incoming_nurse_name: string;
  shift_name: string;
  shift_date: string;
  ward_name: string;
  patient_condition_updates: string;
  important_observations: string;
  pending_medications_summary: string;
  pending_tasks_summary: string;
  critical_alerts_summary: string;
  follow_up_procedures: string;
  status: 'SUBMITTED' | 'ACKNOWLEDGED';
  submitted_at: string;
  acknowledged_at: string | null;
  acknowledgment_notes: string;
}

export interface NursingNoteItem {
  id: string;
  patient_id: string;
  nurse_name: string;
  shift_assessment: string;
  care_plan_notes: string;
  patient_response: string;
  created_at: string;
}

export const nurseService = {
  getOverview: async (nurseId?: string): Promise<NurseOverview> => {
    const res = await api.get('/clinical/nurse-workspace/overview/', {
      params: nurseId ? { nurse_id: nurseId } : {},
    });
    return res.data;
  },

  getPatients: async (search?: string): Promise<NursePatient[]> => {
    const res = await api.get('/clinical/nurse-workspace/patients/', {
      params: search ? { search } : {},
    });
    return res.data;
  },

  updatePatientNursingInfo: async (
    patientId: string,
    data: {
      allergies?: string[];
      dietary_restrictions?: string;
      emergency_contact?: string;
      fall_risk?: boolean;
      isolation_required?: boolean;
    }
  ) => {
    const res = await api.patch(`/clinical/nurse-workspace/patients/${patientId}/update/`, data);
    return res.data;
  },

  getPatientNotes: async (patientId: string): Promise<NursingNoteItem[]> => {
    const res = await api.get(`/clinical/nurse-workspace/patients/${patientId}/notes/`);
    return res.data;
  },

  addPatientNote: async (
    patientId: string,
    data: {
      shift_assessment: string;
      care_plan_notes?: string;
      patient_response?: string;
    }
  ) => {
    const res = await api.post(`/clinical/nurse-workspace/patients/${patientId}/notes/`, data);
    return res.data;
  },

  getMedications: async (params?: {
    patient_id?: string;
    status?: string;
    search?: string;
  }): Promise<MedicationRecord[]> => {
    const res = await api.get('/clinical/nurse-workspace/medications/', { params });
    return res.data;
  },

  recordMedicationAction: async (
    recordId: string,
    data: {
      action: 'ADMINISTER' | 'MISSED' | 'REFUSED';
      dosage_given?: string;
      route_used?: string;
      remarks?: string;
      reason_for_non_admin?: string;
      adverse_reaction_notes?: string;
      escalate_to_doctor?: boolean;
    }
  ) => {
    const res = await api.post(`/clinical/nurse-workspace/medications/${recordId}/action/`, data);
    return res.data;
  },

  getTasks: async (params?: {
    patient_id?: string;
    status?: string;
    priority?: string;
  }): Promise<NursingTaskItem[]> => {
    const res = await api.get('/clinical/nurse-workspace/tasks/', { params });
    return res.data;
  },

  createTask: async (data: {
    patient_id: string;
    task_name: string;
    instructions?: string;
    priority?: 'ROUTINE' | 'URGENT' | 'STAT';
    due_time: string;
    category?: string;
  }) => {
    const res = await api.post('/clinical/nurse-workspace/tasks/', data);
    return res.data;
  },

  recordTaskAction: async (
    taskId: string,
    data: {
      action: 'START' | 'COMPLETE' | 'CANCEL';
      completion_notes?: string;
    }
  ) => {
    const res = await api.post(`/clinical/nurse-workspace/tasks/${taskId}/action/`, data);
    return res.data;
  },

  getVitals: async (params?: { patient_id?: string; limit?: number }): Promise<VitalSignItem[]> => {
    const res = await api.get('/clinical/nurse-workspace/vitals/', { params });
    return res.data;
  },

  recordVitals: async (data: {
    patient_id: string;
    admission_id?: string;
    bp_systolic?: number;
    bp_diastolic?: number;
    heart_rate?: number;
    body_temperature?: number;
    respiratory_rate?: number;
    spo2?: number;
    blood_glucose?: number;
    pain_score?: number;
    nurse_remarks?: string;
    escalate_to_doctor?: boolean;
  }) => {
    const res = await api.post('/clinical/nurse-workspace/vitals/', data);
    return res.data;
  },

  escalateVital: async (vitalId: string, escalation_notes: string) => {
    const res = await api.post(`/clinical/nurse-workspace/vitals/${vitalId}/escalate/`, {
      escalation_reason: escalation_notes,
    });
    return res.data;
  },

  getShiftHandovers: async (): Promise<ShiftHandoverItem[]> => {
    const res = await api.get('/clinical/nurse-workspace/shift-handover/');
    return res.data;
  },

  submitShiftHandover: async (data: {
    incoming_nurse_id?: string;
    patient_condition_updates: string;
    important_observations?: string;
    pending_medications_summary?: string;
    pending_tasks_summary?: string;
    critical_alerts_summary?: string;
    follow_up_procedures?: string;
  }) => {
    const res = await api.post('/clinical/nurse-workspace/shift-handover/', data);
    return res.data;
  },

  acknowledgeShiftHandover: async (handoverId: string, acknowledgment_notes?: string) => {
    const res = await api.post(`/clinical/nurse-workspace/shift-handover/${handoverId}/acknowledge/`, {
      acknowledgment_notes,
    });
    return res.data;
  },
};

