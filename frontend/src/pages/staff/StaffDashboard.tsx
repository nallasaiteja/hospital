import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Users,
  Bed,
  Stethoscope,
  Pill,
  DollarSign,
  Building2,
  AlertTriangle,
  Clock,
  UserPlus,
  CheckCircle,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { authService, CurrentUserResponse, reportsDashboardService, clinicalService } from '../../services/api';
import { Modal } from '../../components/common/Modal';
import { useTranslation } from 'react-i18next';

export const StaffDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<CurrentUserResponse | null>(null);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [provisionSuccess, setProvisionSuccess] = useState<string | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  // Provisioning form state
  const [staffEmail, setStaffEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('DOCTOR');
  const [designation, setDesignation] = useState('Consultant Physician');
  const [specialization, setSpecialization] = useState('Cardiology');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [consultationFee, setConsultationFee] = useState(800);

  const [adminMetrics, setAdminMetrics] = useState<any>(null);
  const [queueAppointments, setQueueAppointments] = useState<any[]>([]);

  useEffect(() => {
    // Fetch live OPD queue appointments from Supabase PostgreSQL
    clinicalService.getAppointments()
      .then((res: any) => {
        const list = res?.results || (Array.isArray(res) ? res : []);
        setQueueAppointments(list.slice(0, 5));
      })
      .catch(() => setQueueAppointments([]));

    authService.getCurrentUser()
      .then((data) => {
        setProfileData(data);
        const userRole = String(data?.role || '');
        if (userRole === 'BRANCH_MANAGER') {
          navigate('/staff/branch-manager');
          return;
        }
        if (userRole === 'DEPARTMENT_HEAD') {
          navigate('/staff/department-head');
          return;
        }
        if (userRole === 'HR_MANAGER') {
          navigate('/staff/hr-management');
          return;
        }
        if (userRole === 'LAB_TECHNICIAN') {
          navigate('/staff/laboratory');
          return;
        }
        if (userRole === 'PHARMACIST') {
          navigate('/staff/pharmacy');
          return;
        }
        if (userRole === 'INSURANCE_COORDINATOR') {
          navigate('/staff/insurance');
          return;
        }
        if (userRole === 'BILLING_EXECUTIVE') {
          navigate('/staff/billing?tab=invoices');
          return;
        }
        if (userRole === 'CASHIER') {
          navigate('/staff/billing?tab=receipts');
          return;
        }
        if (userRole === 'ACCOUNTANT') {
          navigate('/staff/general-ledger');
          return;
        }
        if (userRole === 'AUDITOR') {
          navigate('/staff/settings-audit');
          return;
        }
        const isAdminOrMgr = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'FINANCE_MANAGER', 'AUDITOR', 'MEDICAL_DIRECTOR'].includes(userRole);

        if (isAdminOrMgr) {
          reportsDashboardService.getAdminDashboard()
            .then((res) => {
              setAdminMetrics(res);
            })
            .catch(() => {});
        } else if (['DOCTOR', 'NURSE'].includes(userRole)) {
          reportsDashboardService.getClinicalDashboard()
            .then((res) => {
              const totalBeds = res?.ward_distribution?.reduce((acc: number, w: any) => acc + (w.total || 0), 0) ?? 0;
              const occupiedBeds = res?.ward_distribution?.reduce((acc: number, w: any) => acc + (w.occupied || 0), 0) ?? 0;
              const availableBeds = res?.ward_distribution?.reduce((acc: number, w: any) => acc + (w.available || 0), 0) ?? 0;
              const occRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
              setAdminMetrics({
                metrics: {
                  today_opd_registrations: res?.summary?.total_consultations ?? 0,
                  current_inpatient_census: res?.summary?.active_inpatients ?? 0,
                  total_hospital_beds: totalBeds,
                  occupied_beds: occupiedBeds,
                  available_beds: availableBeds,
                  bed_occupancy_rate_pct: occRate,
                  pending_diagnostic_reports: res?.summary?.icu_critical_monitored ?? 0,
                  emergency_visits: res?.summary?.surgeries_scheduled ?? 0,
                }
              });
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('Could not load staff profile from backend API:', err);
      });
  }, []);

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionError(null);
    try {
      setProvisionLoading(true);
      const rawBranch = profileData?.staff_profile?.branch;
      const branchId = typeof rawBranch === 'object' && rawBranch ? rawBranch.id : (typeof rawBranch === 'string' ? rawBranch : '00000000-0000-0000-0000-000000000001');
      const res = await authService.provisionStaff({
        email: staffEmail.trim(),
        first_name: firstName,
        last_name: lastName,
        phone_number: phone,
        role: role,
        branch_id: branchId,
        designation: designation,
        specialization: specialization,
        medical_license_number: licenseNumber,
        consultation_fee: consultationFee,
      });

      setProvisionSuccess(`Staff provisioned successfully! Employee ID: ${res.employee_id}`);
      setTimeout(() => {
        setShowProvisionModal(false);
        setProvisionSuccess(null);
        // Clear inputs
        setStaffEmail('');
        setFirstName('');
        setLastName('');
      }, 2500);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.email?.[0] || err.message || 'Failed to provision staff member.';
      setProvisionError(msg);
    } finally {
      setProvisionLoading(false);
    }
  };

  const staff = profileData?.staff_profile;
  const user = profileData?.user;
  const userRole = profileData?.role || 'DOCTOR';
  const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'BRANCH_MANAGER' || userRole === 'HOSPITAL_ADMIN';

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <span>{t('dashboard.commandCenter', 'Clinical & Operations Command Center')}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('common.activeClinician', 'Active Clinician')}: <strong className="text-white">{user?.first_name ? `${user.first_name} ${user.last_name}` : t('auth.staffClinician', 'Staff Clinician')}</strong> &bull; {t('common.designation', 'Designation')}: <strong className="text-cyan-400">{staff?.designation || userRole}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {userRole === 'SUPER_ADMIN' && (
            <button
              onClick={() => setShowProvisionModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition text-xs font-semibold"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t('common.provisionStaff', 'Provision Staff')}</span>
            </button>
          )}
          <span className="px-2.5 py-1 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800 text-xs font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{t('auth.onDuty', 'On Duty')} &bull; {t('common.active', 'Active')}</span>
          </span>
        </div>
      </div>

      {/* Doctor Clinical Workspace Quick Launch Banner */}
      {userRole === 'DOCTOR' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/80 via-blue-950/60 to-slate-900 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-cyan-950/20">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Doctor Clinical Workspace</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold uppercase tracking-wider">Active Clinical Mode</span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Access your real-time consultation desk, digital prescriptions, inpatient ward rounds, lab requisitions, and patient EMR timeline.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/staff/doctor-workspace')}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-cyan-500/20 shrink-0"
          >
            <span>Launch Clinical Workspace</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Operational Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('dashboard.opdToday', 'OPD Registrations Today')}</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {adminMetrics?.metrics?.today_opd_registrations ?? 0}
          </div>
          <p className="text-[11px] text-cyan-400 mt-1">{t('dashboard.realtimeCensus', 'Real-time outpatient census')}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('dashboard.bedOccupancy', 'Inpatient Bed Occupancy')}</span>
            <Bed className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {adminMetrics?.metrics?.bed_occupancy_rate_pct ?? 0}%
          </div>
          <p className="text-[11px] text-emerald-400 mt-1">
            {adminMetrics?.metrics?.available_beds ?? 0} {t('dashboard.bedsReady', 'beds ready for admission')}
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('dashboard.pendingReports', 'Pending Diagnostic Reports')}</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {adminMetrics?.metrics?.pending_diagnostic_reports ?? 0}
          </div>
          <p className="text-[11px] text-amber-400 mt-1">{t('dashboard.awaitingVerification', 'Awaiting verification')}</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('dashboard.emergencyVisits', 'Emergency Visits')}</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {adminMetrics?.metrics?.emergency_visits ?? 0}
          </div>
          <p className="text-[11px] text-rose-400 mt-1">
            {t('dashboard.activeCensus', 'Active census')}: {adminMetrics?.metrics?.current_inpatient_census ?? 0} {t('dashboard.inpatients', 'inpatients')}
          </p>
        </div>
      </div>

      {/* Modules Nav Grid */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          {t('dashboard.workflows')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div
            onClick={() => navigate('/staff/appointments')}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 transition cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
              <Stethoscope className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition flex items-center justify-between">
              <span>{t('dashboard.opdCardTitle')}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
            </h3>
            <p className="text-xs text-slate-400 mt-1">{t('dashboard.opdCardDesc')}</p>
          </div>

          <div
            onClick={() => navigate('/staff/admissions')}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <Bed className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition flex items-center justify-between">
              <span>{t('dashboard.ipdCardTitle')}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
            </h3>
            <p className="text-xs text-slate-400 mt-1">{t('dashboard.ipdCardDesc')}</p>
          </div>

          <div
            onClick={() => navigate('/staff/laboratory')}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 transition cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-indigo-400 transition flex items-center justify-between">
              <span>{t('dashboard.labCardTitle')}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
            </h3>
            <p className="text-xs text-slate-400 mt-1">{t('dashboard.labCardDesc')}</p>
          </div>

          <div
            onClick={() => navigate('/staff/pharmacy')}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-violet-500/50 transition cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-3">
              <Pill className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-violet-400 transition flex items-center justify-between">
              <span>{t('dashboard.pharmacyCardTitle')}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
            </h3>
            <p className="text-xs text-slate-400 mt-1">{t('dashboard.pharmacyCardDesc')}</p>
          </div>

          <div
            onClick={() => navigate('/staff/billing')}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/50 transition cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-3">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-teal-400 transition flex items-center justify-between">
              <span>{t('dashboard.billingCardTitle')}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
            </h3>
            <p className="text-xs text-slate-400 mt-1">{t('dashboard.billingCardDesc')}</p>
          </div>

          <div
            onClick={() => navigate(userRole === 'SUPER_ADMIN' ? '/staff/users-roles' : '/staff/settings-audit')}
            className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition flex items-center justify-between">
              <span>{userRole === 'SUPER_ADMIN' ? t('dashboard.adminCardTitle') : 'Hospital Settings & Audit'}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {userRole === 'SUPER_ADMIN' ? t('dashboard.adminCardDesc') : 'View hospital branch configurations, system parameters, and audit trails.'}
            </p>
          </div>
        </div>
      </div>

      {/* Real-Time Live Queue Preview */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>{t('dashboard.queueTitle')}</span>
          </h3>
          <span className="text-xs text-cyan-400 font-mono">{t('dashboard.liveSync')}</span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs min-w-full">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 whitespace-nowrap">
              <tr>
                <th className="py-3 px-3 sm:px-4">{t('dashboard.token')}</th>
                <th className="py-3 px-3 sm:px-4">{t('common.patientName')}</th>
                <th className="py-3 px-3 sm:px-4">{t('dashboard.mrn')}</th>
                <th className="py-3 px-3 sm:px-4">{t('dashboard.scheduledTime')}</th>
                <th className="py-3 px-3 sm:px-4">{t('common.status')}</th>
                <th className="py-3 px-3 sm:px-4">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {queueAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-slate-500">
                    <Clock className="w-7 h-7 mx-auto mb-2 opacity-30 text-slate-400" />
                    <p className="font-medium text-slate-400 text-xs">{t('dashboard.noPatientsInQueue')}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{t('dashboard.noPatientsInQueueDesc')}</p>
                  </td>
                </tr>
              ) : (
                queueAppointments.map((app, idx) => (
                  <tr key={app.id || idx} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 sm:px-4 font-mono font-bold text-cyan-400">
                      #{String(app.token_number || app.queue_number || idx + 1).replace(/^(token\s*#*|#)+/i, '').trim()}
                    </td>
                    <td className="py-3 px-3 sm:px-4 font-medium text-white whitespace-nowrap">
                      {app.patient?.user_profile?.full_name || app.patient_name || t('auth.patient')}
                    </td>
                    <td className="py-3 px-3 sm:px-4 font-mono text-slate-400 whitespace-nowrap">
                      {app.patient?.medical_record_number || 'MRN-PENDING'}
                    </td>
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      {app.appointment_time || app.scheduled_time || 'Scheduled'}
                    </td>
                    <td className="py-3 px-3 sm:px-4">
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium whitespace-nowrap">
                        {app.status || 'Scheduled'}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <button 
                        onClick={() => navigate('/staff/appointments')}
                        className="text-cyan-400 hover:text-cyan-300 font-medium text-xs"
                      >
                        {t('common.viewDetails')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Administrator Provisioning Modal (Responsive Shared Component) */}
      <Modal
        isOpen={showProvisionModal}
        onClose={() => setShowProvisionModal(false)}
        title={t('dashboard.provisionStaffModalTitle')}
        subtitle={t('dashboard.provisionStaffModalSubtitle')}
        size="md"
      >
        {provisionError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {provisionError}
          </div>
        )}

        {provisionSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{provisionSuccess}</span>
          </div>
        )}

        <form onSubmit={handleProvisionSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t('dashboard.firstName')}</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Rajesh"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t('dashboard.lastName')}</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Verma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{t('dashboard.staffWorkEmail')}</label>
            <input
              type="email"
              required
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              placeholder="r.verma@aurahms.org"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t('dashboard.assignedRole')}</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="DOCTOR">{t('roles.doctor')}</option>
                <option value="NURSE">{t('roles.nurse')}</option>
                <option value="PHARMACIST">{t('roles.pharmacist')}</option>
                <option value="LAB_TECHNICIAN">{t('roles.labTechnician')}</option>
                <option value="RECEPTIONIST">{t('roles.receptionist')}</option>
                <option value="ACCOUNTANT">{t('roles.accountant')}</option>
                <option value="BRANCH_MANAGER">{t('roles.branchManager')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t('dashboard.designation')}</label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Consultant Cardiologist"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t('dashboard.specialization')}</label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="Electrophysiology"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t('dashboard.medicalLicense')}</label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="MCI-19482"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setShowProvisionModal(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={provisionLoading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20"
            >
              {provisionLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('dashboard.provisioning')}</span>
                </>
              ) : (
                <span>{t('dashboard.confirmProvisioning')}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
