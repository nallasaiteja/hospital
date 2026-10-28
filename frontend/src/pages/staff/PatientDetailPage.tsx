import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Calendar,
  FileText,
  Activity,
  Heart,
  Shield,
  AlertTriangle,
  Pill,
  Bed,
  TestTube,
  Radio,
  CreditCard,
  ClipboardList,
  Clock,
  Plus,
  CheckCircle,
  XCircle,
  FileCheck,
  Upload,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { patientService } from '../../services/api';
import { PatientEMRData, PatientProfile } from '../../types';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

export const PatientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [emr, setEmr] = useState<PatientEMRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Modals state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // History edit state
  const [allergiesInput, setAllergiesInput] = useState('');
  const [conditionsInput, setConditionsInput] = useState('');
  const [pastMedInput, setPastMedInput] = useState('');
  const [pastSurgInput, setPastSurgInput] = useState('');
  const [familyHistoryInput, setFamilyHistoryInput] = useState('');
  const [socialHistoryInput, setSocialHistoryInput] = useState('');

  // Consent form state
  const [consentType, setConsentType] = useState('GENERAL_TREATMENT');
  const [consentNotes, setConsentNotes] = useState('');
  const [consentDocUrl, setConsentDocUrl] = useState('');

  // Document form state
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('GOVT_ID');
  const [docUrl, setDocUrl] = useState('');
  const [docNotes, setDocNotes] = useState('');

  const fetchEMR = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await patientService.getPatientEMR(id);
      setEmr(data);
      // Pre-fill history form
      setAllergiesInput((data.allergies || []).join(', '));
      setConditionsInput((data.medical_history.chronic_conditions || []).join(', '));
      setPastMedInput((data.medical_history.past_medical_history || []).join(', '));
      setPastSurgInput((data.medical_history.past_surgical_history || []).join(', '));
      setFamilyHistoryInput(data.medical_history.family_history || '');
      setSocialHistoryInput(data.medical_history.social_history || '');
    } catch (err: any) {
      console.error('Failed to load patient EMR:', err);
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEMR();
  }, [id]);

  const handleSaveHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setModalLoading(true);
    try {
      await patientService.updateMedicalHistory(id, {
        allergies: allergiesInput.split(',').map((s) => s.trim()).filter(Boolean),
        chronic_conditions: conditionsInput.split(',').map((s) => s.trim()).filter(Boolean),
        past_medical_history: pastMedInput.split(',').map((s) => s.trim()).filter(Boolean),
        past_surgical_history: pastSurgInput.split(',').map((s) => s.trim()).filter(Boolean),
        family_history: familyHistoryInput,
        social_history: socialHistoryInput,
      });
      setShowHistoryModal(false);
      await fetchEMR();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to update medical history.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleRecordConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setModalLoading(true);
    try {
      await patientService.recordConsent(id, {
        consent_type: consentType,
        notes: consentNotes,
        document_url: consentDocUrl,
      });
      setShowConsentModal(false);
      setConsentNotes('');
      setConsentDocUrl('');
      await fetchEMR();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to record consent.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleRevokeConsent = async () => {
    if (!id || !showRevokeModal) return;
    setModalLoading(true);
    try {
      await patientService.revokeConsent(id, showRevokeModal, {
        reason: revokeReason || 'Patient requested consent withdrawal',
      });
      setShowRevokeModal(null);
      setRevokeReason('');
      await fetchEMR();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to revoke consent.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setModalLoading(true);
    try {
      await patientService.uploadDocument(id, {
        document_type: docType,
        title: docTitle,
        file_url: docUrl,
        notes: docNotes,
      });
      setShowDocModal(false);
      setDocTitle('');
      setDocUrl('');
      setDocNotes('');
      await fetchEMR();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to upload document reference.');
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
        <p className="text-slate-400 text-sm">Aggregating comprehensive electronic medical records...</p>
      </div>
    );
  }

  if (error || !emr) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <Link to="/staff/patients" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back to Patient Directory
        </Link>
        <AlertBanner title="Electronic Medical Record Error" message={error || 'Patient record could not be loaded.'} variant="error" />
      </div>
    );
  }

  const { patient, overview, demographics, emergency_contacts, medical_history } = emr;

  const tabs = [
    { id: 'overview', label: 'Overview & Vitals', icon: Activity, count: null },
    { id: 'demographics', label: 'Demographics & Address', icon: MapPin, count: null },
    { id: 'emergency', label: 'Emergency Contacts', icon: Phone, count: null },
    { id: 'history', label: 'Medical History', icon: Heart, count: (medical_history.chronic_conditions?.length || 0) + (medical_history.past_medical_history?.length || 0) },
    { id: 'allergies', label: 'Allergies & Alerts', icon: AlertTriangle, count: emr.allergies?.length || 0 },
    { id: 'consents', label: 'Consents & Legal', icon: FileCheck, count: emr.consents?.length || 0 },
    { id: 'documents', label: 'Documents & IDs', icon: Upload, count: emr.documents?.length || 0 },
    { id: 'appointments', label: 'Appointments', icon: Calendar, count: emr.appointments?.length || 0 },
    { id: 'consultations', label: 'Consultations', icon: ClipboardList, count: emr.consultations?.length || 0 },
    { id: 'diagnoses', label: 'Diagnoses & Plans', icon: FileText, count: emr.diagnoses_and_plans?.length || 0 },
    { id: 'prescriptions', label: 'Prescriptions', icon: Pill, count: emr.prescriptions?.length || 0 },
    { id: 'admissions', label: 'Admissions & Inpatient', icon: Bed, count: emr.admissions?.length || 0 },
    { id: 'lab', label: 'Lab Reports', icon: TestTube, count: emr.lab_reports?.length || 0 },
    { id: 'radiology', label: 'Radiology & Imaging', icon: Radio, count: emr.radiology_reports?.length || 0 },
    { id: 'billing', label: 'Billing & Invoices', icon: CreditCard, count: emr.billing_history?.length || 0 },
    { id: 'notes', label: 'Clinical Notes', icon: FileText, count: emr.clinical_notes?.length || 0 },
    { id: 'audit', label: 'Audit Trail', icon: Clock, count: emr.audit_trail?.length || 0 },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/staff/patients"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-cyan-400 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Patient Directory
        </Link>
      </div>

      {/* Patient Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-2xl shadow-inner">
              {patient.user_profile?.first_name?.[0] || 'P'}
              {patient.user_profile?.last_name?.[0] || ''}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {patient.user_profile?.first_name} {patient.user_profile?.last_name}
                </h1>
                <Badge variant={patient.status === 'ACTIVE' ? 'success' : 'danger'}>
                  {patient.status || 'ACTIVE'}
                </Badge>
                {patient.blood_group && (
                  <Badge variant="warning">Blood: {patient.blood_group}</Badge>
                )}
                {patient.age !== undefined && patient.age !== null && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                    {patient.age} Yrs ({patient.gender})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono flex items-center gap-3">
                <span>MRN: <strong className="text-cyan-400">{patient.medical_record_number}</strong></span>
                <span>• Primary Facility: {patient.primary_branch_name}</span>
                <span>• DOB: {patient.date_of_birth || 'Not recorded'}</span>
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 text-cyan-400 hover:bg-slate-700 transition flex items-center gap-1.5 border border-slate-700"
            >
              <Heart className="w-3.5 h-3.5" /> Update Allergies/History
            </button>
            <button
              onClick={() => setShowConsentModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 text-emerald-400 hover:bg-slate-700 transition flex items-center gap-1.5 border border-slate-700"
            >
              <FileCheck className="w-3.5 h-3.5" /> Record Consent
            </button>
            <button
              onClick={() => setShowDocModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 text-violet-400 hover:bg-slate-700 transition flex items-center gap-1.5 border border-slate-700"
            >
              <Upload className="w-3.5 h-3.5" /> Attach Document
            </button>
          </div>
        </div>

        {/* Critical Allergies Alert Bar */}
        {emr.allergies && emr.allergies.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 flex items-center gap-3 text-rose-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold text-rose-300">CLINICAL ALLERGY ALERT:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {emr.allergies.map((allergen, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-md bg-rose-900/60 border border-rose-700 text-rose-200 font-medium">
                  {allergen}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 15 Tabs Navigation */}
      <div className="border-b border-slate-800 overflow-x-auto scrollbar-thin">
        <nav className="flex space-x-1 min-w-max pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-500">Active Allergies</span>
              <p className="text-xl font-bold text-rose-400 mt-1">{overview.active_allergies_count}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-500">Chronic Conditions</span>
              <p className="text-xl font-bold text-amber-400 mt-1">{overview.chronic_conditions_count}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-500">Appointments</span>
              <p className="text-xl font-bold text-cyan-400 mt-1">{overview.total_appointments}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-500">Inpatient Stays</span>
              <p className="text-xl font-bold text-indigo-400 mt-1">{overview.total_admissions}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-500">Prescriptions</span>
              <p className="text-xl font-bold text-emerald-400 mt-1">{overview.total_prescriptions}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-500">Diagnostic Reports</span>
              <p className="text-xl font-bold text-purple-400 mt-1">{overview.total_lab_orders}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Contact & Emergency */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Phone className="w-4 h-4 text-cyan-400" /> Key Contact & Emergency
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Mobile Phone:</span>
                  <span className="font-mono text-slate-200">{demographics.phone || 'Not recorded'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Email Address:</span>
                  <span className="text-slate-200">{demographics.email || 'None'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Emergency Contact:</span>
                  <span className="text-slate-200 font-medium">
                    {emergency_contacts.name || 'N/A'} ({emergency_contacts.relationship || 'Contact'})
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Emergency Phone:</span>
                  <span className="font-mono text-cyan-400">{emergency_contacts.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Quick Active Conditions & Insurance */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" /> Chronic Conditions & Coverage
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Insurance Provider:</span>
                  <span className="text-slate-200 font-medium">{patient.insurance_provider || 'Self-Pay / Cash'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Policy Number:</span>
                  <span className="font-mono text-slate-200">{patient.insurance_policy_number || 'N/A'}</span>
                </div>
                <div className="pt-1">
                  <span className="text-slate-400 block mb-1.5">Chronic Medical Conditions:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {medical_history.chronic_conditions && medical_history.chronic_conditions.length > 0 ? (
                      medical_history.chronic_conditions.map((c, i) => (
                        <Badge key={i} variant="warning">
                          {c}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-500 italic">No chronic illnesses reported.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Demographics */}
      {activeTab === 'demographics' && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" /> Identification & Demographics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 font-medium">Full Name</span>
              <p className="text-sm font-semibold text-white mt-1">{overview.full_name}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 font-medium">Medical Record Number (MRN)</span>
              <p className="text-sm font-mono text-cyan-400 mt-1">{overview.mrn}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 font-medium">Date of Birth & Age</span>
              <p className="text-sm text-slate-200 mt-1">
                {patient.date_of_birth || 'Not specified'} {overview.age ? `(${overview.age} years)` : ''}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 font-medium">Gender</span>
              <p className="text-sm text-slate-200 mt-1">{patient.gender}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 font-medium">Blood Group</span>
              <p className="text-sm text-slate-200 mt-1">{patient.blood_group || 'Unknown'}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 font-medium">Primary Facility Branch</span>
              <p className="text-sm text-slate-200 mt-1">{overview.primary_branch}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 lg:col-span-2">
              <span className="text-slate-500 font-medium">Residential Street Address</span>
              <p className="text-sm text-slate-200 mt-1">{demographics.address || 'Not recorded'}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-500 font-medium">City, State, PIN</span>
              <p className="text-sm text-slate-200 mt-1">
                {demographics.city || ''} {demographics.state || ''} {demographics.postal_code || ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Emergency Contacts */}
      {activeTab === 'emergency' && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-cyan-400" /> Designated Emergency Contact
          </h3>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 max-w-lg space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Contact Name:</span>
              <span className="text-white font-semibold">{emergency_contacts.name || 'None on file'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Relationship:</span>
              <span className="text-slate-300">{emergency_contacts.relationship || 'Not specified'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Contact Phone:</span>
              <span className="font-mono text-cyan-400 font-medium">{emergency_contacts.phone || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Medical History */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-400" /> Past Clinical History
            </h3>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 text-cyan-400 hover:bg-slate-700 transition"
            >
              Edit History
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">Past Illnesses & Conditions</span>
              <ul className="space-y-1 list-disc list-inside text-slate-200">
                {medical_history.past_medical_history?.length > 0 ? (
                  medical_history.past_medical_history.map((item, idx) => <li key={idx}>{item}</li>)
                ) : (
                  <p className="text-slate-500 italic">No past illnesses recorded.</p>
                )}
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">Past Surgeries & Procedures</span>
              <ul className="space-y-1 list-disc list-inside text-slate-200">
                {medical_history.past_surgical_history?.length > 0 ? (
                  medical_history.past_surgical_history.map((item, idx) => <li key={idx}>{item}</li>)
                ) : (
                  <p className="text-slate-500 italic">No surgical interventions documented.</p>
                )}
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">Family Medical History</span>
              <p className="text-slate-200 leading-relaxed">
                {medical_history.family_history || 'No significant familial history noted.'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">Social / Occupational History</span>
              <p className="text-slate-200 leading-relaxed">
                {medical_history.social_history || 'No occupational exposures or tobacco/alcohol use documented.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Allergies */}
      {activeTab === 'allergies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" /> Documented Drug & Environmental Allergies
            </h3>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 text-rose-400 hover:bg-slate-700 transition"
            >
              Update Allergies
            </button>
          </div>
          {emr.allergies && emr.allergies.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {emr.allergies.map((allergen, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-white">{allergen}</h4>
                    <p className="text-xs text-rose-300/80 mt-1">High clinical risk • Contraindicated for prescribing</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No known allergies documented for this patient.
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Consents & Legal */}
      {activeTab === 'consents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-400" /> Informed Consents & Authorizations
            </h3>
            <button
              onClick={() => setShowConsentModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Consent Form
            </button>
          </div>
          {emr.consents && emr.consents.length > 0 ? (
            <div className="space-y-3">
              {emr.consents.map((consent) => (
                <div
                  key={consent.id}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{consent.consent_type}</h4>
                      <Badge variant={consent.status === 'GRANTED' ? 'success' : 'danger'}>
                        {consent.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400">{consent.notes || 'Standard patient consent'}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Recorded: {new Date(consent.recorded_at).toLocaleString()} • Officer: {consent.recorded_by_name || 'Staff'}
                    </p>
                    {consent.status === 'REVOKED' && (
                      <p className="text-xs text-rose-400 font-medium">Revocation Reason: {consent.revocation_reason}</p>
                    )}
                  </div>
                  {consent.status === 'GRANTED' && (
                    <button
                      onClick={() => setShowRevokeModal(consent.id)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No consent forms captured yet.
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Documents & IDs */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-violet-400" /> Supporting Clinical Documents & Identification
            </h3>
            <button
              onClick={() => setShowDocModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/30 hover:bg-violet-500/20 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Upload Document
            </button>
          </div>
          {emr.documents && emr.documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {emr.documents.map((doc) => (
                <div key={doc.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{doc.title}</h4>
                      <Badge variant="neutral">{doc.document_type}</Badge>
                    </div>
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 text-cyan-400 hover:bg-slate-700 transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  {doc.notes && <p className="text-xs text-slate-400">{doc.notes}</p>}
                  <p className="text-[11px] text-slate-500 font-mono">
                    Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No attached documents on record.
            </div>
          )}
        </div>
      )}

      {/* Tab 8: Appointments */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" /> Consultation Appointments History
          </h3>
          {emr.appointments && emr.appointments.length > 0 ? (
            <div className="space-y-3">
              {emr.appointments.map((appt) => (
                <div
                  key={appt.id}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-cyan-400 font-bold">{appt.appointment_number}</span>
                      <Badge variant={appt.status === 'COMPLETED' ? 'success' : appt.status === 'SCHEDULED' ? 'warning' : 'neutral'}>
                        {appt.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-white">{appt.doctor_name} ({appt.department_name})</p>
                    <p className="text-slate-400">Reason: {appt.reason_for_visit || 'Routine Consultation'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-200 font-medium">{appt.date} • {appt.time_slot}</p>
                    {appt.token_number && <p className="text-slate-400 font-mono text-[11px]">Token: #{appt.token_number}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No consultation appointments scheduled.
            </div>
          )}
        </div>
      )}

      {/* Tab 9: Consultations */}
      {activeTab === 'consultations' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-cyan-400" /> Doctor Clinical Consultations
          </h3>
          {emr.consultations && emr.consultations.length > 0 ? (
            <div className="space-y-4">
              {emr.consultations.map((c, i) => (
                <div key={i} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold text-white">{c.doctor_name}</h4>
                      <p className="text-xs text-slate-400">{c.department_name} • Date: {c.date}</p>
                    </div>
                    {c.follow_up_date && (
                      <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 text-xs font-medium">
                        Follow-up: {c.follow_up_date}
                      </span>
                    )}
                  </div>
                  {c.diagnosis && (
                    <div className="text-xs">
                      <span className="text-slate-400 font-semibold">Diagnosis: </span>
                      <span className="text-emerald-400 font-medium">{c.diagnosis}</span>
                    </div>
                  )}
                  {c.consultation_notes && (
                    <div className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-slate-400 font-semibold block mb-1">Clinical Notes:</span>
                      {c.consultation_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No doctor consultation notes recorded.
            </div>
          )}
        </div>
      )}

      {/* Tab 10: Diagnoses & Treatment Plans */}
      {activeTab === 'diagnoses' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" /> Problem List & Treatment Plans
          </h3>
          {emr.diagnoses_and_plans && emr.diagnoses_and_plans.length > 0 ? (
            <div className="space-y-3">
              {emr.diagnoses_and_plans.map((dp, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-emerald-400">{dp.diagnosis}</h4>
                    <span className="text-xs text-slate-400">{dp.date}</span>
                  </div>
                  <p className="text-xs text-slate-300">Plan: {dp.treatment_plan}</p>
                  <p className="text-[11px] text-slate-500">Clinician: {dp.doctor_name}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No clinical diagnoses registered.
            </div>
          )}
        </div>
      )}

      {/* Tab 11: Prescriptions */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Pill className="w-5 h-5 text-emerald-400" /> Electronic Prescriptions & Medication Orders
          </h3>
          {emr.prescriptions && emr.prescriptions.length > 0 ? (
            <div className="space-y-4">
              {emr.prescriptions.map((rx) => (
                <div key={rx.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <span className="font-mono text-xs text-cyan-400 font-bold">{rx.prescription_number}</span>
                      <h4 className="text-sm font-bold text-white mt-0.5">{rx.doctor_name}</h4>
                    </div>
                    <Badge variant={rx.is_dispensed ? 'success' : 'warning'}>
                      {rx.is_dispensed ? 'Dispensed' : 'Pending Dispensation'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300">Indication: {rx.diagnosis}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="p-2">Medication</th>
                          <th className="p-2">Dosage</th>
                          <th className="p-2">Frequency</th>
                          <th className="p-2">Duration</th>
                          <th className="p-2">Instructions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {rx.items?.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-medium text-white">{item.medicine_name}</td>
                            <td className="p-2">{item.dosage}</td>
                            <td className="p-2 font-mono text-cyan-300">{item.frequency}</td>
                            <td className="p-2">{item.duration_days} days</td>
                            <td className="p-2 text-slate-400">{item.instructions || 'As advised'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No prescriptions issued for this patient.
            </div>
          )}
        </div>
      )}

      {/* Tab 12: Inpatient Admissions */}
      {activeTab === 'admissions' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Bed className="w-5 h-5 text-indigo-400" /> Inpatient (IPD) Admissions & Discharge Summaries
          </h3>
          {emr.admissions && emr.admissions.length > 0 ? (
            <div className="space-y-4">
              {emr.admissions.map((adm) => (
                <div key={adm.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <span className="font-mono text-xs text-indigo-400 font-bold">{adm.admission_number}</span>
                      <h4 className="text-sm font-bold text-white mt-0.5">{adm.ward_name} (Bed {adm.bed_number})</h4>
                    </div>
                    <Badge variant={adm.status === 'ADMITTED' ? 'warning' : 'success'}>
                      {adm.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400">Admitting Clinician:</span>
                      <p className="text-slate-200 font-medium">{adm.admitting_doctor}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Admission Date:</span>
                      <p className="text-slate-200 font-mono">{new Date(adm.admission_date).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-400 font-semibold">Initial Diagnosis: </span>
                    <span className="text-slate-200">{adm.initial_diagnosis}</span>
                  </div>
                  {adm.discharge_summary && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <span className="text-emerald-400 font-semibold block">Discharge Summary:</span>
                      <p className="text-slate-300">{adm.discharge_summary}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No inpatient admission history recorded.
            </div>
          )}
        </div>
      )}

      {/* Tab 13: Lab Reports */}
      {activeTab === 'lab' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <TestTube className="w-5 h-5 text-purple-400" /> Laboratory & Pathology Diagnostics
          </h3>
          {emr.lab_reports && emr.lab_reports.length > 0 ? (
            <div className="space-y-4">
              {emr.lab_reports.map((lo) => (
                <div key={lo.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <span className="font-mono text-xs text-purple-400 font-bold">{lo.order_number}</span>
                      <p className="text-xs text-slate-400">Ordering Doctor: {lo.doctor_name}</p>
                    </div>
                    <Badge variant={lo.status === 'VERIFIED' ? 'success' : 'warning'}>
                      {lo.status}
                    </Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="p-2">Test Name</th>
                          <th className="p-2">Result</th>
                          <th className="p-2">Reference Range</th>
                          <th className="p-2">Abnormal?</th>
                          <th className="p-2">Sign-Off</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {lo.items?.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-medium text-white">{item.test_name}</td>
                            <td className="p-2 font-mono font-bold text-white">{item.result_value || 'Pending'} {item.unit}</td>
                            <td className="p-2 text-slate-400">{item.reference_range}</td>
                            <td className="p-2">
                              {item.is_abnormal ? (
                                <Badge variant="danger" size="sm">ABNORMAL</Badge>
                              ) : (
                                <Badge variant="neutral" size="sm">Normal</Badge>
                              )}
                            </td>
                            <td className="p-2 text-slate-400">{item.verified_by || 'Unverified'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No diagnostic laboratory orders recorded.
            </div>
          )}
        </div>
      )}

      {/* Tab 14: Radiology & Imaging */}
      {activeTab === 'radiology' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" /> Radiology & Imaging Studies
          </h3>
          {emr.radiology_reports && emr.radiology_reports.length > 0 ? (
            <div className="space-y-4">
              {emr.radiology_reports.map((ro) => (
                <div key={ro.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <span className="font-mono text-xs text-cyan-400 font-bold">{ro.order_number}</span>
                      <h4 className="text-sm font-bold text-white">{ro.study_name} ({ro.modality})</h4>
                    </div>
                    <Badge variant={ro.status === 'REPORTED' ? 'success' : 'warning'}>
                      {ro.status}
                    </Badge>
                  </div>
                  {ro.findings && (
                    <div className="text-xs text-slate-300">
                      <span className="text-slate-400 font-semibold block mb-0.5">Radiological Findings:</span>
                      {ro.findings}
                    </div>
                  )}
                  {ro.impression && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      <span className="text-cyan-400 font-semibold block mb-0.5">Impression:</span>
                      {ro.impression}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No radiology or imaging studies performed.
            </div>
          )}
        </div>
      )}

      {/* Tab 15: Billing & Payments */}
      {activeTab === 'billing' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" /> Patient Billing & Payment Settlements
          </h3>
          {emr.billing_history && emr.billing_history.length > 0 ? (
            <div className="space-y-4">
              {emr.billing_history.map((inv) => (
                <div key={inv.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div>
                      <span className="font-mono text-xs text-cyan-400 font-bold">{inv.invoice_number}</span>
                      <p className="text-xs text-slate-400">Date: {inv.date}</p>
                    </div>
                    <Badge variant={inv.status === 'PAID' ? 'success' : 'warning'}>
                      {inv.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-400 block">Total Invoiced:</span>
                      <span className="text-sm font-bold text-white">₹{inv.total_amount}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Settled Amount:</span>
                      <span className="text-sm font-bold text-emerald-400">₹{inv.paid_amount}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Balance Due:</span>
                      <span className="text-sm font-bold text-rose-400">₹{inv.balance_amount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No financial invoices on record.
            </div>
          )}
        </div>
      )}

      {/* Tab 16: Clinical Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-cyan-400" /> Chronological Clinical Notes & Rounds
          </h3>
          {emr.clinical_notes && emr.clinical_notes.length > 0 ? (
            <div className="space-y-3">
              {emr.clinical_notes.map((note, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <Badge variant="neutral">{note.type}</Badge>
                    <span className="text-slate-500 font-mono">{note.recorded_at}</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{note.clinical_notes}</p>
                  <p className="text-[11px] text-slate-400 italic">Author: {note.recorded_by}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No clinical progress notes on record.
            </div>
          )}
        </div>
      )}

      {/* Tab 17: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" /> Record Access & Change History
          </h3>
          {emr.audit_trail && emr.audit_trail.length > 0 ? (
            <div className="space-y-2">
              {emr.audit_trail.map((al, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-cyan-400 font-semibold">{al.action}</span>
                    <p className="text-slate-400 text-[11px]">Actor: {al.actor_email}</p>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">{new Date(al.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
              No audit logs captured.
            </div>
          )}
        </div>
      )}

      {/* Modal: Update Medical History & Allergies */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Update Clinical History & Allergies"
        size="lg"
      >
        <form onSubmit={handleSaveHistory} className="space-y-4">
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">
              Known Drug & Food Allergies (comma-separated)
            </label>
            <Input
              value={allergiesInput}
              onChange={(e) => setAllergiesInput(e.target.value)}
              placeholder="e.g. Penicillin, Aspirin, Sulfa drugs"
            />
          </div>
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">
              Chronic Medical Conditions (comma-separated)
            </label>
            <Input
              value={conditionsInput}
              onChange={(e) => setConditionsInput(e.target.value)}
              placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma"
            />
          </div>
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">
              Past Medical Illnesses (comma-separated)
            </label>
            <Input
              value={pastMedInput}
              onChange={(e) => setPastMedInput(e.target.value)}
              placeholder="e.g. Pneumonia (2018), Tuberculosis cured"
            />
          </div>
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">
              Previous Surgeries (comma-separated)
            </label>
            <Input
              value={pastSurgInput}
              onChange={(e) => setPastSurgInput(e.target.value)}
              placeholder="e.g. Appendectomy (2015), Cholecystectomy (2020)"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowHistoryModal(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalLoading}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition"
            >
              {modalLoading ? 'Saving...' : 'Save Clinical History'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Record Consent */}
      <Modal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        title="Record Informed Consent"
        size="md"
      >
        <form onSubmit={handleRecordConsent} className="space-y-4">
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Consent Type</label>
            <Select
              value={consentType}
              onChange={(e) => setConsentType(e.target.value)}
              options={[
                { value: 'GENERAL_TREATMENT', label: 'General Medical Treatment' },
                { value: 'SURGERY_ANESTHESIA', label: 'Surgical & Anesthesia Consent' },
                { value: 'DATA_SHARING', label: 'Health Records & Data Sharing' },
                { value: 'TELEMEDICINE', label: 'Telemedicine Consultation' },
                { value: 'RESEARCH', label: 'Clinical Research & Study' },
              ]}
            />
          </div>
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Clinical / Waiver Notes</label>
            <textarea
              value={consentNotes}
              onChange={(e) => setConsentNotes(e.target.value)}
              placeholder="Details of risks, benefits explained to patient or legal guardian..."
              className="w-full h-24 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Supporting Document URL (Optional)</label>
            <Input
              value={consentDocUrl}
              onChange={(e) => setConsentDocUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowConsentModal(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalLoading}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
            >
              {modalLoading ? 'Recording...' : 'Grant Consent'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Revoke Consent */}
      <Modal
        isOpen={Boolean(showRevokeModal)}
        onClose={() => setShowRevokeModal(null)}
        title="Revoke Patient Consent"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-rose-300">
            Revoking consent will withdraw authorization for ongoing clinical procedures and document it in the audit log.
          </p>
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Revocation Reason</label>
            <Input
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="e.g. Patient requested termination"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              onClick={() => setShowRevokeModal(null)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleRevokeConsent}
              disabled={modalLoading}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition"
            >
              {modalLoading ? 'Revoking...' : 'Confirm Revocation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Upload Document */}
      <Modal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        title="Attach Supporting Document"
        size="md"
      >
        <form onSubmit={handleUploadDocument} className="space-y-4">
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Document Title</label>
            <Input
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="e.g. Aadhaar Card / External Echo Report"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Document Classification</label>
            <Select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              options={[
                { value: 'GOVT_ID', label: 'Government ID / National Card' },
                { value: 'INSURANCE_CARD', label: 'Insurance Card / TPA Letter' },
                { value: 'CONSENT_FORM', label: 'Signed Consent Form' },
                { value: 'EXTERNAL_REPORT', label: 'External Medical / Imaging Report' },
                { value: 'DISCHARGE_SUMMARY', label: 'Discharge Summary' },
                { value: 'OTHER', label: 'Other Clinical Document' },
              ]}
            />
          </div>
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Secure Document URL</label>
            <Input
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://..."
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Clinical Notes (Optional)</label>
            <Input
              value={docNotes}
              onChange={(e) => setDocNotes(e.target.value)}
              placeholder="Notes on document provenance or expiry..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowDocModal(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalLoading}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-violet-500 text-white hover:bg-violet-400 transition"
            >
              {modalLoading ? 'Attaching...' : 'Attach Document'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
