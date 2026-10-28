import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Filter,
  Shield,
  Activity,
  Phone,
  Calendar,
  Heart,
  GitMerge,
  AlertTriangle,
  FileCheck,
  CheckCircle,
  X,
  ExternalLink,
  Loader2,
  RefreshCw,
  Clock,
  UserCheck,
} from 'lucide-react';
import { patientService } from '../../services/api';
import { parseApiError } from '../../utils/errorHandler';
import { PatientProfile, PatientDashboardStats } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import { useBranch } from '../../context/BranchContext';

export const PatientsPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const navigate = useNavigate();

  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState<PatientDashboardStats | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Registration Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regStep, setRegStep] = useState<'IDENTITY' | 'CONTACT' | 'EMERGENCY' | 'CLINICAL' | 'CONSENT'>('IDENTITY');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Registration Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [conditionsText, setConditionsText] = useState('');
  const [pastMedText, setPastMedText] = useState('');
  const [pastSurgText, setPastSurgText] = useState('');
  const [familyHistText, setFamilyHistText] = useState('');
  const [socialHistText, setSocialHistText] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [initialConsent, setInitialConsent] = useState('GENERAL_TREATMENT');
  const [consentNotes, setConsentNotes] = useState('');

  // Duplicate Detection & Merge State
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<Array<{
    reason: string;
    similarity_score: number;
    patients: PatientProfile[];
  }>>([]);
  const [dupLoading, setDupLoading] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeReason, setMergeReason] = useState('');
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeSuccess, setMergeSuccess] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Edit Demographics Modal
  const [editingPatient, setEditingPatient] = useState<PatientProfile | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPostal, setEditPostal] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const fetchStats = async () => {
    try {
      const data = await patientService.getDashboardStats({
        branch_id: currentBranch?.id,
      });
      setStats(data);
    } catch (err) {
      console.error('Failed to load patient dashboard stats:', err);
    }
  };

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await patientService.getPatients({
        branch_id: currentBranch?.id,
        search: searchTerm || undefined,
        gender: genderFilter || undefined,
        status: statusFilter || undefined,
        page,
        page_size: pageSize,
      });
      setPatients(res.results || []);
      setTotalCount(res.total_count || 0);
    } catch (err) {
      console.error('Failed to load patient directory:', err);
      setPageError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [currentBranch?.id]);

  useEffect(() => {
    fetchPatients();
  }, [currentBranch?.id, searchTerm, genderFilter, statusFilter, page, pageSize]);

  const handleOpenDuplicates = async () => {
    setShowDuplicatesModal(true);
    setDupLoading(true);
    setMergeError(null);
    setMergeSuccess(null);
    try {
      const data = await patientService.getDuplicates();
      setDuplicateGroups(data.duplicate_groups || []);
    } catch (err) {
      console.error('Failed to load duplicate patient candidates:', err);
    } finally {
      setDupLoading(false);
    }
  };

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch?.id) {
      setRegError('Please select an active hospital branch.');
      return;
    }
    setRegLoading(true);
    setRegError(null);
    setRegSuccess(null);
    try {
      const res = await patientService.registerPatient({
        first_name: firstName,
        last_name: lastName,
        email: email || undefined,
        phone_number: phoneNumber,
        primary_branch_id: currentBranch.id,
        date_of_birth: dob || null,
        gender,
        blood_group: bloodGroup,
        address,
        city,
        state: stateName,
        postal_code: postalCode,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        emergency_contact_relation: emergencyRelation,
        allergies: allergiesText.split(',').map((s) => s.trim()).filter(Boolean),
        chronic_conditions: conditionsText.split(',').map((s) => s.trim()).filter(Boolean),
        past_medical_history: pastMedText.split(',').map((s) => s.trim()).filter(Boolean),
        past_surgical_history: pastSurgText.split(',').map((s) => s.trim()).filter(Boolean),
        family_history: familyHistText,
        social_history: socialHistText,
        insurance_provider: insuranceProvider,
        insurance_policy_number: policyNumber,
        initial_consent_type: initialConsent,
        initial_consent_notes: consentNotes,
      });

      setRegSuccess(`Patient successfully registered! Medical Record Number: ${res.medical_record_number}`);
      setTimeout(() => {
        setShowRegisterModal(false);
        setRegSuccess(null);
        // Reset form
        setFirstName('');
        setLastName('');
        setEmail('');
        setPhoneNumber('');
        setDob('');
        setAddress('');
        setCity('');
        setStateName('');
        setPostalCode('');
        setEmergencyName('');
        setEmergencyPhone('');
        setEmergencyRelation('');
        setAllergiesText('');
        setConditionsText('');
        setPastMedText('');
        setPastSurgText('');
        setRegStep('IDENTITY');
        fetchPatients();
        fetchStats();
      }, 2000);
    } catch (err: any) {
      setRegError(parseApiError(err).message);
    } finally {
      setRegLoading(false);
    }
  };

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSourceId || !mergeTargetId) {
      setMergeError('Please select both a source patient (to retire) and a target patient (to keep).');
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      setMergeError('Source and target patient cannot be the same record.');
      return;
    }
    if (!mergeReason.trim()) {
      setMergeError('A formal merge reason is required for the audit record.');
      return;
    }

    setMergeLoading(true);
    setMergeError(null);
    setMergeSuccess(null);
    try {
      const res = await patientService.mergePatients({
        source_patient_id: mergeSourceId,
        target_patient_id: mergeTargetId,
        reason: mergeReason,
      });
      setMergeSuccess(res.message || 'Records successfully merged and clinical data reassigned.');
      setTimeout(() => {
        setMergeSourceId('');
        setMergeTargetId('');
        setMergeReason('');
        handleOpenDuplicates();
        fetchPatients();
        fetchStats();
      }, 2000);
    } catch (err: any) {
      setMergeError(parseApiError(err).message);
    } finally {
      setMergeLoading(false);
    }
  };

  const handleSaveDemographics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;
    setEditLoading(true);
    try {
      await patientService.updatePatient(editingPatient.id, {
        first_name: editFirstName,
        last_name: editLastName,
        phone_number: editPhone,
        address: editAddress,
        city: editCity,
        state: editState,
        postal_code: editPostal,
        emergency_contact_name: editEmergencyName,
        emergency_contact_phone: editEmergencyPhone,
      });
      setEditingPatient(null);
      fetchPatients();
    } catch (err: any) {
      setPageError(parseApiError(err).message);
    } finally {
      setEditLoading(false);
    }
  };

  const columns: Column<PatientProfile>[] = [
    {
      key: 'medical_record_number',
      header: 'MRN Identifier',
      render: (p) => (
        <div>
          <span className="font-mono text-cyan-400 font-semibold tracking-wide">
            {p.medical_record_number}
          </span>
          {p.status === 'MERGED' && (
            <div className="text-[10px] text-amber-400 font-mono">
              Merged into: {p.merged_into_mrn}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'user_profile',
      header: 'Patient Full Name',
      render: (p) => (
        <div>
          <div className="font-semibold text-white">
            {p.user_profile?.first_name} {p.user_profile?.last_name}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">{p.user_profile?.email}</div>
        </div>
      ),
    },
    {
      key: 'gender',
      header: 'Demographics',
      render: (p) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="neutral">{p.gender}</Badge>
          {p.blood_group && <Badge variant="warning">{p.blood_group}</Badge>}
          {p.age !== undefined && p.age !== null && (
            <span className="text-[11px] text-slate-400 font-mono">{p.age}y</span>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone / Location',
      render: (p) => (
        <div>
          <span className="text-slate-300 font-mono text-xs block">
            {p.user_profile?.phone_number || 'No phone'}
          </span>
          <span className="text-[11px] text-slate-500">
            {p.city ? `${p.city}, ${p.state || ''}` : p.primary_branch_name}
          </span>
        </div>
      ),
    },
    {
      key: 'allergies',
      header: 'Clinical Alerts',
      render: (p) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {p.allergies && p.allergies.length > 0 ? (
            p.allergies.map((a, i) => (
              <Badge key={i} variant="danger" size="sm">
                {a}
              </Badge>
            ))
          ) : (
            <span className="text-slate-500 text-xs">No known allergies</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <Badge variant={p.status === 'ACTIVE' ? 'success' : p.status === 'MERGED' ? 'warning' : 'neutral'}>
          {p.status || 'ACTIVE'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => {
              setEditingPatient(p);
              setEditFirstName(p.user_profile?.first_name || '');
              setEditLastName(p.user_profile?.last_name || '');
              setEditPhone(p.user_profile?.phone_number || '');
              setEditAddress(p.address || '');
              setEditCity(p.city || '');
              setEditState(p.state || '');
              setEditPostal(p.postal_code || '');
              setEditEmergencyName(p.emergency_contact_name || '');
              setEditEmergencyPhone(p.emergency_contact_phone || '');
            }}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
          >
            Edit
          </button>
          <button
            onClick={() => navigate(`/staff/patients/${p.id}`)}
            className="px-3 py-1 text-xs font-semibold rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition flex items-center gap-1"
          >
            <span>EMR Chart</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {pageError && (
        <AlertBanner
          type="error"
          message={pageError}
          onClose={() => setPageError(null)}
          onRetry={fetchPatients}
        />
      )}
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-400" />
            Patient Management & Electronic Medical Records (EMR)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Enterprise Master Patient Index (EMPI), Longitudinal Clinical Records, Duplicate Matching & Merging.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleOpenDuplicates}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition flex items-center gap-1.5"
          >
            <GitMerge className="w-4 h-4" /> Duplicate Review
            {stats && stats.potential_duplicates_count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
                {stats.potential_duplicates_count}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setRegStep('IDENTITY');
              setShowRegisterModal(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" /> Register New Patient
          </button>
        </div>
      </div>

      {/* KPI Stats Calculated from Persistent Database Records */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Total Registered"
          value={stats ? stats.total_registered.toString() : '...'}
          change="+100% Verified"
          icon={Users}
        />
        <StatCard
          title="Registered Today"
          value={stats ? stats.registered_today.toString() : '...'}
          icon={Calendar}
        />
        <StatCard
          title="Active Census"
          value={stats ? stats.active_patients.toString() : '...'}
          icon={Activity}
        />
        <StatCard
          title="Upcoming Appts"
          value={stats ? stats.upcoming_appointments.toString() : '...'}
          icon={Clock}
        />
        <StatCard
          title="Follow-ups Due"
          value={stats ? stats.requiring_follow_up.toString() : '...'}
          icon={Heart}
        />
        <StatCard
          title="Potential Duplicates"
          value={stats ? stats.potential_duplicates_count.toString() : '...'}
          icon={GitMerge}
        />
      </div>

      {/* Search & Filters Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by MRN, Name, Phone, Email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={genderFilter}
            onChange={(e) => {
              setGenderFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Genders</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="">Status: Active</option>
            <option value="ACTIVE">Active Records</option>
            <option value="INACTIVE">Inactive</option>
            <option value="MERGED">Merged Records</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm('');
              setGenderFilter('');
              setStatusFilter('');
              setPage(1);
              fetchPatients();
              fetchStats();
            }}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
            title="Refresh Directory"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Patient Master Index Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <DataTable
          data={patients}
          columns={columns}
          loading={loading}
          error={pageError}
          onRetry={fetchPatients}
          searchable={false}
          pageSize={pageSize}
        />
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-800/60 text-xs text-slate-400">
          <span>Showing {patients.length} of {totalCount} total patient records</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-50 hover:bg-slate-700"
            >
              Previous
            </button>
            <span className="font-mono text-cyan-400">Page {page}</span>
            <button
              disabled={page * pageSize >= totalCount}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-50 hover:bg-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Patient Registration Modal (Multi-Tab) */}
      <Modal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title="Patient Registration & Demographics (EMPI)"
        size="lg"
      >
        <div className="space-y-4">
          {regError && <AlertBanner title="Registration Error" message={regError} variant="error" />}
          {regSuccess && <AlertBanner title="Success" message={regSuccess} variant="success" />}

          {/* Registration Step Navigation */}
          <div className="flex border-b border-slate-800 pb-2 gap-2 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setRegStep('IDENTITY')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                regStep === 'IDENTITY' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              1. Demographics
            </button>
            <button
              type="button"
              onClick={() => setRegStep('CONTACT')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                regStep === 'CONTACT' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              2. Address & Contact
            </button>
            <button
              type="button"
              onClick={() => setRegStep('EMERGENCY')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                regStep === 'EMERGENCY' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              3. Emergency Contact
            </button>
            <button
              type="button"
              onClick={() => setRegStep('CLINICAL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                regStep === 'CLINICAL' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              4. Medical History
            </button>
            <button
              type="button"
              onClick={() => setRegStep('CONSENT')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                regStep === 'CONSENT' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              5. Insurance & Consent
            </button>
          </div>

          <form onSubmit={handleRegisterPatient} className="space-y-4">
            {/* Step 1: Demographics */}
            {regStep === 'IDENTITY' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">First Name *</label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Ramesh"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Last Name</label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Patel"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Date of Birth</label>
                    <Input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Gender *</label>
                    <Select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      options={[
                        { value: 'MALE', label: 'Male' },
                        { value: 'FEMALE', label: 'Female' },
                        { value: 'OTHER', label: 'Other' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Blood Group</label>
                    <Select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      options={[
                        { value: 'A+', label: 'A+' },
                        { value: 'A-', label: 'A-' },
                        { value: 'B+', label: 'B+' },
                        { value: 'B-', label: 'B-' },
                        { value: 'AB+', label: 'AB+' },
                        { value: 'AB-', label: 'AB-' },
                        { value: 'O+', label: 'O+' },
                        { value: 'O-', label: 'O-' },
                      ]}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                  <p className="font-semibold text-slate-300">Hospital Facility:</p>
                  <span>{currentBranch?.name || 'Default Central Branch'} (Primary Enrollment)</span>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setRegStep('CONTACT')}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition"
                  >
                    Next: Address & Contact →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Contact */}
            {regStep === 'CONTACT' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Mobile Phone Number</label>
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Email (Optional)</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="patient@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Residential Address</label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House / Flat / Street address"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">City</label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Mumbai"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">State</label>
                    <Input
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      placeholder="e.g. Maharashtra"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Postal Code (PIN)</label>
                    <Input
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="e.g. 400053"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setRegStep('IDENTITY')}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegStep('EMERGENCY')}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition"
                  >
                    Next: Emergency Contact →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Emergency Contact */}
            {regStep === 'EMERGENCY' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Emergency Contact Person</label>
                    <Input
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="e.g. Sunita Patel"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Relationship to Patient</label>
                    <Input
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                      placeholder="e.g. Spouse / Mother / Brother"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Emergency Phone Number</label>
                  <Input
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="e.g. 9876543219"
                  />
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setRegStep('CONTACT')}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegStep('CLINICAL')}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition"
                  >
                    Next: Medical History →
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Clinical History */}
            {regStep === 'CLINICAL' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-rose-300 font-medium block mb-1">
                    Known Drug & Food Allergies (comma-separated)
                  </label>
                  <Input
                    value={allergiesText}
                    onChange={(e) => setAllergiesText(e.target.value)}
                    placeholder="e.g. Penicillin, Sulfa drugs, Peanuts"
                  />
                </div>

                <div>
                  <label className="text-xs text-amber-300 font-medium block mb-1">
                    Chronic Medical Conditions (comma-separated)
                  </label>
                  <Input
                    value={conditionsText}
                    onChange={(e) => setConditionsText(e.target.value)}
                    placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Past Illnesses</label>
                    <Input
                      value={pastMedText}
                      onChange={(e) => setPastMedText(e.target.value)}
                      placeholder="e.g. Jaundice (2019)"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Past Surgeries</label>
                    <Input
                      value={pastSurgText}
                      onChange={(e) => setPastSurgText(e.target.value)}
                      placeholder="e.g. Appendectomy (2016)"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setRegStep('EMERGENCY')}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegStep('CONSENT')}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition"
                  >
                    Next: Insurance & Consent →
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Insurance & Consent */}
            {regStep === 'CONSENT' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Insurance / TPA Provider</label>
                    <Input
                      value={insuranceProvider}
                      onChange={(e) => setInsuranceProvider(e.target.value)}
                      placeholder="e.g. Star Health / ICICI Lombard"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium block mb-1">Policy / Card Number</label>
                    <Input
                      value={policyNumber}
                      onChange={(e) => setPolicyNumber(e.target.value)}
                      placeholder="e.g. POL-8823901"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Initial Informed Consent</label>
                  <Select
                    value={initialConsent}
                    onChange={(e) => setInitialConsent(e.target.value)}
                    options={[
                      { value: 'GENERAL_TREATMENT', label: 'General Medical Treatment & Hospital Care' },
                      { value: 'SURGERY_ANESTHESIA', label: 'Surgical & Anesthetic Consent' },
                      { value: 'DATA_SHARING', label: 'Health Records & Telemedicine Consent' },
                    ]}
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">Consent Documentation Notes</label>
                  <textarea
                    value={consentNotes}
                    onChange={(e) => setConsentNotes(e.target.value)}
                    placeholder="Patient or authorized surrogate signed standard hospital admission consent..."
                    className="w-full h-16 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRegStep('CLINICAL')}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={regLoading}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                  >
                    {regLoading ? 'Registering Patient...' : 'Complete Patient Registration'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </Modal>

      {/* Duplicate Patient Review & Authorized Merge Modal */}
      <Modal
        isOpen={showDuplicatesModal}
        onClose={() => setShowDuplicatesModal(false)}
        title="Duplicate Patient Detection & Authorized Merging"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Automated scanning matches patients sharing identical phone numbers or demographic profiles.
            Authorized merging will transactionally transfer all clinical encounters, appointments, prescriptions,
            admissions, invoices, and diagnostic records into the surviving master record.
          </p>

          {mergeError && <AlertBanner title="Merge Error" message={mergeError} variant="error" />}
          {mergeSuccess && <AlertBanner title="Success" message={mergeSuccess} variant="success" />}

          {dupLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto mb-2" />
              Scanning database for potential duplicate records...
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              No duplicate patient records detected across the database.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                {duplicateGroups.map((group, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-amber-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">{group.reason}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                        {group.similarity_score}% Match
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {group.patients.map((p) => (
                        <div
                          key={p.id}
                          className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1"
                        >
                          <span className="font-mono text-cyan-400 font-bold">{p.medical_record_number}</span>
                          <p className="font-semibold text-white">{p.user_profile?.first_name} {p.user_profile?.last_name}</p>
                          <p className="text-slate-400 text-[11px]">Phone: {p.user_profile?.phone_number || 'N/A'}</p>
                          <p className="text-slate-500 text-[10px]">Registered: {new Date(p.created_at || '').toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Merge Action Form */}
              <form onSubmit={handleMergeSubmit} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Execute Authorized Merge</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">
                      Source Record to Retire (Duplicate)
                    </label>
                    <select
                      value={mergeSourceId}
                      onChange={(e) => setMergeSourceId(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                      required
                    >
                      <option value="">Select source patient...</option>
                      {duplicateGroups.flatMap((g) => g.patients).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.medical_record_number} - {p.user_profile?.first_name} {p.user_profile?.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">
                      Surviving Target Master Record
                    </label>
                    <select
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                      required
                    >
                      <option value="">Select surviving master patient...</option>
                      {duplicateGroups.flatMap((g) => g.patients).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.medical_record_number} - {p.user_profile?.first_name} {p.user_profile?.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">
                    Justification / Merge Audit Reason *
                  </label>
                  <Input
                    value={mergeReason}
                    onChange={(e) => setMergeReason(e.target.value)}
                    placeholder="e.g. Accidental duplicate intake with matching phone and address."
                    required
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={mergeLoading}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 transition"
                  >
                    {mergeLoading ? 'Merging...' : 'Confirm & Reassign All Records'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Demographics Modal */}
      <Modal
        isOpen={Boolean(editingPatient)}
        onClose={() => setEditingPatient(null)}
        title={`Edit Patient Demographics: ${editingPatient?.medical_record_number}`}
        size="md"
      >
        <form onSubmit={handleSaveDemographics} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">First Name</label>
              <Input
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Last Name</label>
              <Input
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Phone Number</label>
            <Input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Street Address</label>
            <Input
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">City</label>
              <Input
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">State</label>
              <Input
                value={editState}
                onChange={(e) => setEditState(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">PIN</label>
              <Input
                value={editPostal}
                onChange={(e) => setEditPostal(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditingPatient(null)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editLoading}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition"
            >
              {editLoading ? 'Saving...' : 'Update Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
