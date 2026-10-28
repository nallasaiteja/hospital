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
  LogOut,
  AlertTriangle,
  Clock,
  UserPlus,
  CheckCircle,
  X,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { authService, CurrentUserResponse, reportsDashboardService, clinicalService } from '../../services/api';

export const StaffDashboard: React.FC = () => {
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionError(null);
    setProvisionSuccess(null);
    setProvisionLoading(true);

    try {
      // Find branch ID from current staff member's branch or fallback
      const branchId = profileData?.staff_profile?.branch_id || '00000000-0000-0000-0000-000000000000';

      const res = await authService.provisionStaff({
        email: staffEmail,
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
  const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'BRANCH_MANAGER';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Clinical Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-500 text-slate-950 flex items-center justify-center font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white tracking-tight">AURA Clinical Engine</span>
              <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
                {staff?.branch_name || 'Main Hospital Branch'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium">Role: {userRole}</span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-cyan-400">{user?.email || 'staff@aurahms.org'}</span>
              {staff?.employee_id && (
                <span className="font-mono text-slate-400 border-l border-slate-700 pl-2">
                  {staff.employee_id}
                </span>
              )}
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowProvisionModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition font-medium"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Provision Staff</span>
              </button>
            )}

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

      {/* Main Operations Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>Operations & Clinical Command Center</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Active Clinician: <strong className="text-white">{user?.first_name ? `${user.first_name} ${user.last_name}` : 'Staff Clinician'}</strong> &bull; Designation: <strong className="text-cyan-400">{staff?.designation || userRole}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Duty Status:</span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800 text-xs font-medium">
              On Duty &bull; Active
            </span>
          </div>
        </div>

        {/* Operational Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">OPD Registrations Today</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {adminMetrics?.metrics?.today_opd_registrations ?? 0}
            </div>
            <p className="text-[11px] text-cyan-400 mt-1">Real-time outpatient census</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Inpatient Bed Occupancy</span>
              <Bed className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {adminMetrics?.metrics?.bed_occupancy_rate_pct ?? 0}% ({adminMetrics?.metrics?.occupied_beds ?? 0} / {adminMetrics?.metrics?.total_hospital_beds ?? 0})
            </div>
            <p className="text-[11px] text-emerald-400 mt-1">
              {adminMetrics?.metrics?.available_beds ?? 0} beds ready for admission
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Pending Diagnostic Reports</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {adminMetrics?.metrics?.pending_diagnostic_reports ?? 0}
            </div>
            <p className="text-[11px] text-amber-400 mt-1">Awaiting verification/result</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Emergency Visits</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {adminMetrics?.metrics?.emergency_visits ?? 0}
            </div>
            <p className="text-[11px] text-rose-400 mt-1">
              Active census: {adminMetrics?.metrics?.current_inpatient_census ?? 0} inpatients
            </p>
          </div>
        </div>

        {/* Modules Nav Grid */}
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Clinical & Operational Workflows
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 transition cursor-pointer group">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
              <Stethoscope className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition">Outpatient Consultations (OPD)</h3>
            <p className="text-xs text-slate-400 mt-1">Queue management, vital signs, ICD-10 diagnostic coding, and e-prescriptions.</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer group">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
              <Bed className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition">Inpatient Admissions (IPD)</h3>
            <p className="text-xs text-slate-400 mt-1">Ward assignments, bed management, nurse treatment sheets, and discharge summaries.</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 transition cursor-pointer group">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-indigo-400 transition">Pathology & Diagnostic Lab</h3>
            <p className="text-xs text-slate-400 mt-1">Specimen barcoding, test orders, pathologist verification, and private report upload.</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-violet-500/50 transition cursor-pointer group">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center mb-3">
              <Pill className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-violet-400 transition">Pharmacy & Drug Formulary</h3>
            <p className="text-xs text-slate-400 mt-1">Dispensing against doctor prescriptions, batch expiry monitoring, and stock alerts.</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/50 transition cursor-pointer group">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center mb-3">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-teal-400 transition">Billing & General Ledger</h3>
            <p className="text-xs text-slate-400 mt-1">Invoices, tariff management, receipts, double-entry journal entries, and P&L reporting.</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer group">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition">Branch & Staff Administration</h3>
            <p className="text-xs text-slate-400 mt-1">Staff provisioning, branch assignments, doctor duty rosters, and audit trails.</p>
          </div>
        </div>

        {/* Real-Time Live Queue Preview */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Current OPD Queue &bull; Cardiology Clinic</span>
            </h3>
            <span className="text-xs text-cyan-400 font-mono">Live Sync</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Token</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">MRN</th>
                  <th className="py-3 px-4">Scheduled Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {queueAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      <Clock className="w-7 h-7 mx-auto mb-2 opacity-30 text-slate-400" />
                      <p className="font-medium text-slate-400 text-xs">No OPD Patients in Queue</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">All scheduled consultations for this clinic are completed or none are registered today.</p>
                    </td>
                  </tr>
                ) : (
                  queueAppointments.map((app, idx) => (
                    <tr key={app.id || idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        #{app.token_number || app.queue_number || idx + 1}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        {app.patient?.user_profile?.full_name || app.patient_name || 'Patient'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {app.patient?.medical_record_number || 'MRN-PENDING'}
                      </td>
                      <td className="py-3 px-4">
                        {app.appointment_time || app.scheduled_time || 'Scheduled'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                          {app.status || 'Scheduled'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button 
                          onClick={() => navigate('/staff/appointments')}
                          className="text-cyan-400 hover:text-cyan-300 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Administrator Provisioning Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setShowProvisionModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">Provision Hospital Staff Member</h3>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Create an official staff account. Server controls role allocation and branch security boundaries.
            </p>

            {provisionError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {provisionError}
              </div>
            )}

            {provisionSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{provisionSuccess}</span>
              </div>
            )}

            <form onSubmit={handleProvisionSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Rajesh"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Verma"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Staff Work Email</label>
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="r.verma@aurahms.org"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Assigned Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="DOCTOR">Doctor / Surgeon</option>
                    <option value="NURSE">Nurse</option>
                    <option value="PHARMACIST">Pharmacist</option>
                    <option value="LAB_TECHNICIAN">Lab Technician</option>
                    <option value="RECEPTIONIST">Receptionist</option>
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="BRANCH_MANAGER">Branch Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Designation</label>
                  <input
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="Consultant Cardiologist"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Specialization</label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="Electrophysiology"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Medical License / Reg No</label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="MCI-19482"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisionLoading}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
                >
                  {provisionLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <span>Confirm Provisioning</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
