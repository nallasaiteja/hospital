import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  RefreshCw,
  DollarSign,
  Briefcase,
  AlertTriangle,
  Play,
  ArrowRight,
  FileText,
  UserCheck,
  Building,
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  FileCheck,
  Send,
  Download
} from 'lucide-react';
import { operationsHrService, authService } from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

export const HRPayrollPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const { role } = useAuth();
  const canAccessPayroll = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'HR_MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT'].includes(role || '');

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'EMPLOYEES' | 'ATTENDANCE' | 'ROSTERS' | 'LEAVES' | 'PAYROLL'>('DASHBOARD');
  
  // Data States
  const [dashboard, setDashboard] = useState<any>(null);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [rosters, setRosters] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [selectedStaffProfile, setSelectedStaffProfile] = useState<any>(null);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);

  // Form States
  const [onboardForm, setOnboardForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    designation: '',
    role_name: 'STAFF',
    department_id: '',
    joining_date: new Date().toISOString().split('T')[0],
    pan_number: '',
    aadhaar_number: '',
    bank_account_number: '',
    bank_name: 'HDFC Bank Ltd',
    bank_ifsc: 'HDFC0000123',
    basic_salary: '50000.00',
    hra: '20000.00',
    special_allowance: '10000.00'
  });

  const [leaveForm, setLeaveForm] = useState({
    staff_id: '',
    leave_type: 'PRIVILEGE',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    total_days: 1,
    reason: ''
  });

  const [payrollForm, setPayrollForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  const [correctionForm, setCorrectionForm] = useState({
    correction_reason: '',
    clock_in: '09:00:00',
    clock_out: '18:00:00',
    status: 'PRESENT',
    total_hours: '9.00'
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const promises: Promise<any>[] = [
        operationsHrService.getHRDashboard({ branch_id: currentBranch?.id }).catch(() => null),
        operationsHrService.getStaffMembers({ branch_id: currentBranch?.id }).catch(() => []),
        operationsHrService.getAttendance({ branch_id: currentBranch?.id }).catch(() => []),
        operationsHrService.getShifts({ branch_id: currentBranch?.id }).catch(() => []),
        operationsHrService.getRosters({ branch_id: currentBranch?.id }).catch(() => []),
        operationsHrService.getLeaveRequests({ branch_id: currentBranch?.id }).catch(() => []),
        operationsHrService.getLeaveBalances().catch(() => []),
      ];

      if (canAccessPayroll) {
        promises.push(operationsHrService.getPayrollPeriods().catch(() => []));
      } else {
        promises.push(Promise.resolve([]));
      }

      const [dashData, staffData, attData, shiftData, rosterData, leaveData, balanceData, payrollData] = await Promise.all(promises);

      setDashboard(dashData);
      setStaffMembers(staffData?.results || staffData || []);
      setAttendance(attData?.results || attData || []);
      setShifts(shiftData?.results || shiftData || []);
      setRosters(rosterData?.results || rosterData || []);
      setLeaves(leaveData?.results || leaveData || []);
      setLeaveBalances(balanceData?.results || balanceData || []);
      setPayrollPeriods(payrollData?.results || payrollData || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranch]);

  // Handle Quick Clock In/Out
  const handleQuickClock = async (action: 'CLOCK_IN' | 'CLOCK_OUT') => {
    try {
      setError(null);
      await operationsHrService.clockAttendance({ action });
      setSuccessMsg(`Successfully clocked ${action === 'CLOCK_IN' ? 'IN' : 'OUT'}. Hours updated.`);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Handle Employee Onboarding
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await operationsHrService.onboardEmployee({
        ...onboardForm,
        branch_id: currentBranch?.id
      });
      setSuccessMsg(`Employee ${onboardForm.first_name} ${onboardForm.last_name} onboarded successfully.`);
      setIsOnboardModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Handle Apply Leave
  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await operationsHrService.applyLeave(leaveForm);
      setSuccessMsg('Leave request submitted successfully.');
      setIsLeaveModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Handle Leave Decision
  const handleLeaveDecision = async (id: string, action: 'approve' | 'reject') => {
    try {
      setError(null);
      if (action === 'approve') {
        await operationsHrService.approveLeave(id, { comments: 'Approved by supervisor' });
        setSuccessMsg('Leave approved and employee balance updated.');
      } else {
        await operationsHrService.rejectLeave(id, { comments: 'Rejected by supervisor' });
        setSuccessMsg('Leave request rejected.');
      }
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Handle Payroll Lifecycle
  const handleRunPayrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await operationsHrService.generatePayrollRun({
        branch_id: currentBranch?.id,
        ...payrollForm
      });
      setSuccessMsg(`Payroll run for ${payrollForm.month}/${payrollForm.year} generated in DRAFT.`);
      setIsPayrollModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  const handleSubmitForApproval = async (id: string) => {
    try {
      setError(null);
      await operationsHrService.submitPayrollApproval(id);
      setSuccessMsg('Payroll submitted for executive approval.');
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  const handleApprovePayroll = async (id: string) => {
    try {
      setError(null);
      await operationsHrService.approvePayroll(id);
      setSuccessMsg('Payroll approved successfully under separation of duties.');
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  const handlePostGL = async (id: string) => {
    try {
      setError(null);
      await operationsHrService.postPayrollToGL(id);
      setSuccessMsg('Payroll journal entries posted to Section 17 General Ledger (Debit 5010 Salaries Expense, Credit 2040 Deductions, Credit 2010 Net Payable).');
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  const handleDisbursePayroll = async (id: string) => {
    try {
      setError(null);
      await operationsHrService.disbursePayroll(id, {
        payment_mode: 'BANK_TRANSFER',
        reference_number: `HDFC-NEFT-${Date.now().toString().slice(-6)}`
      });
      setSuccessMsg('Payroll disbursed! Payslips marked as PAID and disbursement transactions generated.');
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  const handleOpenPayslip = async (periodId: string) => {
    try {
      const data = await operationsHrService.getPayslips({ payroll_period_id: periodId });
      setPayslips(data?.results || data || []);
      if ((data?.results || data || []).length > 0) {
        setSelectedPayslip((data?.results || data || [])[0]);
      } else {
        setError('No payslips found for this payroll cycle.');
      }
    } catch (err: any) {
      setError('Failed to fetch payslips.');
    }
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttendance) return;
    try {
      setError(null);
      await operationsHrService.correctAttendance(selectedAttendance.id, correctionForm);
      setSuccessMsg('Attendance record corrected and supervisor audit trail updated.');
      setIsCorrectionModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-400" />
            Human Resources (HR) & Staff Payroll
          </h1>
          <p className="text-sm text-slate-400">
            Section 20: Employee lifecycle, biometric shift rosters, leave quotas, 5-stage payroll approval, and General Ledger integration.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh HR Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleQuickClock('CLOCK_IN')}
            className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Clock className="w-4 h-4" /> Quick Clock-In
          </button>
          <button
            onClick={() => setIsLeaveModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-700"
          >
            <Calendar className="w-4 h-4" /> Apply Leave
          </button>
          <button
            onClick={() => setIsOnboardModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-700"
          >
            <Plus className="w-4 h-4" /> Onboard Employee
          </button>
          {canAccessPayroll && (
            <button
              onClick={() => setIsPayrollModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Play className="w-4 h-4" /> Process Payroll Run
            </button>
          )}
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6 overflow-x-auto">
        {[
          { key: 'DASHBOARD', label: 'HR Executive Dashboard', icon: TrendingUp },
          { key: 'EMPLOYEES', label: 'Employee Directory', icon: Users },
          { key: 'ATTENDANCE', label: "Today's Attendance", icon: Clock },
          { key: 'ROSTERS', label: 'Shifts & Rosters', icon: Calendar },
          { key: 'LEAVES', label: 'Leave Requests & Quotas', icon: FileCheck },
          ...(canAccessPayroll ? [{ key: 'PAYROLL', label: 'Payroll & GL Posting', icon: DollarSign }] : [])
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. DASHBOARD TAB */}
      {activeTab === 'DASHBOARD' && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">Active Employees</span>
                <Users className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-3xl font-bold text-slate-100">{dashboard.total_active_employees}</div>
              <p className="text-xs text-slate-500 mt-1">Across all hospital clinical and operational units</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">Today's Present</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold text-emerald-400">{dashboard.today_attendance?.present || 0}</div>
              <p className="text-xs text-slate-500 mt-1">
                {dashboard.today_attendance?.late || 0} late arrivals | {dashboard.today_attendance?.on_leave || 0} on leave
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">Pending Leave Approvals</span>
                <Calendar className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-3xl font-bold text-amber-400">{dashboard.pending_leaves_count}</div>
              <p className="text-xs text-slate-500 mt-1">Awaiting supervisor and HR review</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">Latest Payroll Status</span>
                <DollarSign className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-xl font-bold text-slate-100">
                {dashboard.latest_payroll ? `${dashboard.latest_payroll.month}/${dashboard.latest_payroll.year}` : 'Active'}
              </div>
              <div className="mt-1">
                <Badge variant={dashboard.latest_payroll?.status === 'PAID' ? 'success' : 'warning'}>
                  {dashboard.latest_payroll?.status || 'RUNNING'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Department Breakdown */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-400" />
              Staff Distribution by Department
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {dashboard.departments_breakdown?.map((d: any, idx: number) => (
                <div key={idx} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                  <div className="text-xs text-slate-400 truncate">{d.department}</div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{d.count} staff</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. EMPLOYEES DIRECTORY TAB */}
      {activeTab === 'EMPLOYEES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search staff by employee ID, name, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-500">Showing {staffMembers.length} registered personnel</span>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-medium">
                <tr>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Staff Name</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Designation</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {staffMembers
                  .filter((s) =>
                    s.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.designation?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 font-mono font-semibold text-indigo-400">{staff.employee_id}</td>
                      <td className="p-3 font-medium text-slate-100">{staff.full_name}</td>
                      <td className="p-3 text-slate-400">{staff.department_name || 'General'}</td>
                      <td className="p-3 text-slate-300">{staff.designation}</td>
                      <td className="p-3 text-slate-400 text-xs">{staff.phone_number || staff.email}</td>
                      <td className="p-3">
                        <Badge variant={staff.status === 'ACTIVE' ? 'success' : 'neutral'}>{staff.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedStaffProfile(staff)}
                          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700 transition-colors"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. ATTENDANCE TAB */}
      {activeTab === 'ATTENDANCE' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-200">Today's Clock Records & Hours</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Total Entries: {attendance.length}</span>
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-medium">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Shift</th>
                  <th className="p-3">Clock In</th>
                  <th className="p-3">Clock Out</th>
                  <th className="p-3">Hours Worked</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Audit & Correction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {attendance.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-slate-100">{att.staff_name}</div>
                      <div className="text-xs text-slate-500 font-mono">{att.employee_id}</div>
                    </td>
                    <td className="p-3 text-slate-300">{att.shift_name || 'General Shift'}</td>
                    <td className="p-3 font-mono text-emerald-400">{att.clock_in || '--:--'}</td>
                    <td className="p-3 font-mono text-slate-400">{att.clock_out || 'Active'}</td>
                    <td className="p-3 font-mono font-semibold text-slate-100">{att.total_hours_worked} hrs</td>
                    <td className="p-3">
                      <Badge variant={att.status === 'PRESENT' ? 'success' : 'warning'}>{att.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedAttendance(att);
                          setCorrectionForm({
                            correction_reason: '',
                            clock_in: att.clock_in || '09:00:00',
                            clock_out: att.clock_out || '18:00:00',
                            status: att.status || 'PRESENT',
                            total_hours: att.total_hours_worked || '9.00'
                          });
                          setIsCorrectionModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                      >
                        Correct
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ROSTERS & SHIFTS TAB */}
      {activeTab === 'ROSTERS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                Hospital 24/7 Shift Schedules
              </h2>
              <div className="space-y-3">
                {shifts.map((sh) => (
                  <div key={sh.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">{sh.name}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {sh.start_time} - {sh.end_time} {sh.is_overnight && '(Overnight)'}
                      </div>
                    </div>
                    <Badge variant={sh.is_overnight ? 'danger' : 'neutral'}>
                      {sh.break_duration_minutes} min break
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                Active Shift Roster Assignments
              </h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {rosters.map((r) => (
                  <div key={r.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-200">{r.staff_name} ({r.employee_id})</div>
                      <div className="text-xs text-slate-400">{r.shift_name} on {r.roster_date}</div>
                    </div>
                    <Badge variant="success">{r.status || 'CONFIRMED'}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. LEAVES TAB */}
      {activeTab === 'LEAVES' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-indigo-400" />
              Annual Leave Balances & Entitlements
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {leaveBalances.slice(0, 8).map((b) => (
                <div key={b.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                  <div className="text-xs text-indigo-400 font-mono font-semibold">{b.staff_name}</div>
                  <div className="text-xs text-slate-400">{b.leave_type} Leave</div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{b.remaining_days} days left</div>
                  <div className="text-[10px] text-slate-500">Allocated: {b.allocated_days} | Used: {b.used_days}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
            <h3 className="p-4 bg-slate-800/40 text-sm font-semibold text-slate-200 border-b border-slate-800">
              Leave Requests & Approvals
            </h3>
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-medium">
                <tr>
                  <th className="p-3">Staff</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-medium text-slate-200">{l.staff_name}</td>
                    <td className="p-3 text-slate-300">{l.leave_type}</td>
                    <td className="p-3 text-xs text-slate-400 font-mono">
                      {l.start_date} to {l.end_date} ({l.total_days}d)
                    </td>
                    <td className="p-3 text-xs text-slate-400 max-w-xs truncate">{l.reason}</td>
                    <td className="p-3">
                      <Badge variant={l.status === 'APPROVED' ? 'success' : (l.status === 'REJECTED' ? 'danger' : 'warning')}>
                        {l.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {l.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleLeaveDecision(l.id, 'approve')}
                            className="px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleLeaveDecision(l.id, 'reject')}
                            className="px-2 py-1 text-xs bg-rose-700 hover:bg-rose-600 text-white rounded transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. PAYROLL TAB */}
      {activeTab === 'PAYROLL' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-200 mb-2">5-Stage Payroll Workflow Engine</h2>
            <p className="text-xs text-slate-400 mb-4">
              Draft &rarr; Pending Approval &rarr; Approved (Separation of Duties) &rarr; Posted to GL (Debit 5010 Salaries, Credit 2040 Statutory, Credit 2010 Payable) &rarr; Disbursed (Paid).
            </p>
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/60 text-slate-400 font-medium">
                  <tr>
                    <th className="p-3">Period</th>
                    <th className="p-3">Total Gross</th>
                    <th className="p-3">Total Deductions</th>
                    <th className="p-3">Net Disbursed</th>
                    <th className="p-3">Workflow Status</th>
                    <th className="p-3 text-right">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payrollPeriods.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 font-mono font-semibold text-indigo-400">{p.month}/{p.year}</td>
                      <td className="p-3 font-mono">₹{parseFloat(p.total_gross || '0').toLocaleString()}</td>
                      <td className="p-3 font-mono text-rose-400">₹{parseFloat(p.total_deductions || '0').toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">₹{parseFloat(p.total_disbursed || '0').toLocaleString()}</td>
                      <td className="p-3">
                        <Badge variant={p.status === 'PAID' ? 'success' : (p.status === 'POSTED_GL' ? 'info' : (p.status === 'APPROVED' ? 'warning' : 'neutral'))}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {p.status === 'DRAFT' && (
                          <button
                            onClick={() => handleSubmitForApproval(p.id)}
                            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded"
                          >
                            Submit Approval
                          </button>
                        )}
                        {p.status === 'PENDING_APPROVAL' && (
                          <button
                            onClick={() => handleApprovePayroll(p.id)}
                            className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
                          >
                            Executive Approve
                          </button>
                        )}
                        {p.status === 'APPROVED' && (
                          <button
                            onClick={() => handlePostGL(p.id)}
                            className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded font-medium"
                          >
                            Post to GL
                          </button>
                        )}
                        {p.status === 'POSTED_GL' && (
                          <button
                            onClick={() => handleDisbursePayroll(p.id)}
                            className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium"
                          >
                            Disburse Salary
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenPayslip(p.id)}
                          className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded"
                        >
                          View Payslips
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Onboard Employee */}
      <Modal isOpen={isOnboardModalOpen} onClose={() => setIsOnboardModalOpen(false)} title="Onboard New Hospital Employee">
        <form onSubmit={handleOnboardSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              value={onboardForm.first_name}
              onChange={(e) => setOnboardForm({ ...onboardForm, first_name: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={onboardForm.last_name}
              onChange={(e) => setOnboardForm({ ...onboardForm, last_name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Official Email"
              type="email"
              value={onboardForm.email}
              onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })}
              required
            />
            <Input
              label="Mobile Number"
              value={onboardForm.phone_number}
              onChange={(e) => setOnboardForm({ ...onboardForm, phone_number: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Job Designation"
              value={onboardForm.designation}
              onChange={(e) => setOnboardForm({ ...onboardForm, designation: e.target.value })}
              required
            />
            <Select
              label="Hospital Role"
              value={onboardForm.role_name}
              onChange={(e) => setOnboardForm({ ...onboardForm, role_name: e.target.value })}
              options={[
                { label: 'Doctor / Surgeon', value: 'DOCTOR' },
                { label: 'Nurse', value: 'NURSE' },
                { label: 'HR Staff', value: 'HR_STAFF' },
                { label: 'Technician', value: 'LAB_TECHNICIAN' },
                { label: 'General Staff', value: 'STAFF' }
              ]}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="PAN Card"
              value={onboardForm.pan_number}
              onChange={(e) => setOnboardForm({ ...onboardForm, pan_number: e.target.value })}
              required
            />
            <Input
              label="Bank Account No."
              value={onboardForm.bank_account_number}
              onChange={(e) => setOnboardForm({ ...onboardForm, bank_account_number: e.target.value })}
              required
            />
            <Input
              label="Basic Monthly Salary (₹)"
              type="number"
              value={onboardForm.basic_salary}
              onChange={(e) => setOnboardForm({ ...onboardForm, basic_salary: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsOnboardModalOpen(false)}
              className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
            >
              Confirm Onboarding
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Apply Leave */}
      <Modal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} title="Submit Staff Leave Application">
        <form onSubmit={handleApplyLeaveSubmit} className="space-y-4">
          <Select
            label="Staff Member"
            value={leaveForm.staff_id}
            onChange={(e) => setLeaveForm({ ...leaveForm, staff_id: e.target.value })}
            options={staffMembers.map((s) => ({ label: `${s.full_name} (${s.employee_id})`, value: s.id }))}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Leave Type"
              value={leaveForm.leave_type}
              onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
              options={[
                { label: 'Privilege / Annual Leave', value: 'PRIVILEGE' },
                { label: 'Sick / Medical Leave', value: 'SICK' },
                { label: 'Casual Leave', value: 'CASUAL' },
                { label: 'Maternity Leave', value: 'MATERNITY' },
                { label: 'Unpaid Leave (LWP)', value: 'UNPAID' }
              ]}
            />
            <Input
              label="Total Days"
              type="number"
              value={leaveForm.total_days}
              onChange={(e) => setLeaveForm({ ...leaveForm, total_days: parseInt(e.target.value) || 1 })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={leaveForm.start_date}
              onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={leaveForm.end_date}
              onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
              required
            />
          </div>
          <Input
            label="Reason for Leave"
            value={leaveForm.reason}
            onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsLeaveModalOpen(false)}
              className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
            >
              Submit Leave Request
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Run Payroll */}
      <Modal isOpen={isPayrollModalOpen} onClose={() => setIsPayrollModalOpen(false)} title="Generate Monthly Payroll Run">
        <form onSubmit={handleRunPayrollSubmit} className="space-y-4">
          <p className="text-xs text-slate-400">
            Calculates gross salary, provident fund, professional tax, and income tax TDS for all active hospital employees. Run will be created in DRAFT status.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Month (1-12)"
              type="number"
              min={1}
              max={12}
              value={payrollForm.month}
              onChange={(e) => setPayrollForm({ ...payrollForm, month: parseInt(e.target.value) || 1 })}
              required
            />
            <Input
              label="Year"
              type="number"
              value={payrollForm.year}
              onChange={(e) => setPayrollForm({ ...payrollForm, year: parseInt(e.target.value) || 2026 })}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsPayrollModalOpen(false)}
              className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
            >
              Start Payroll Calculation
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Payslip Detail */}
      {selectedPayslip && (
        <Modal isOpen={!!selectedPayslip} onClose={() => setSelectedPayslip(null)} title="Staff Salary Payslip">
          <div className="space-y-4 p-2 font-mono text-sm">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <div className="text-base font-bold text-slate-100">{selectedPayslip.staff_name}</div>
                <div className="text-xs text-slate-400">ID: {selectedPayslip.employee_id} | Ref: {selectedPayslip.payslip_number}</div>
              </div>
              <Badge variant={selectedPayslip.payment_status === 'PAID' ? 'success' : 'warning'}>
                {selectedPayslip.payment_status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                <div className="text-xs font-semibold text-emerald-400 mb-2">EARNINGS</div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-slate-400">Basic Pay:</span>
                  <span className="text-slate-100">₹{parseFloat(selectedPayslip.basic_pay || '0').toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-slate-400">Overtime:</span>
                  <span className="text-slate-100">₹{parseFloat(selectedPayslip.overtime_pay || '0').toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-bold pt-2 border-t border-slate-800 text-emerald-400">
                  <span>Gross Salary:</span>
                  <span>₹{parseFloat(selectedPayslip.gross_pay || '0').toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                <div className="text-xs font-semibold text-rose-400 mb-2">DEDUCTIONS</div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-slate-400">Statutory Deductions:</span>
                  <span className="text-rose-400">₹{parseFloat(selectedPayslip.deductions || '0').toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-bold pt-2 border-t border-slate-800 text-rose-400">
                  <span>Total Deductions:</span>
                  <span>₹{parseFloat(selectedPayslip.deductions || '0').toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-indigo-950/40 rounded-lg border border-indigo-800 flex justify-between items-center">
              <span className="font-semibold text-slate-200">Net Take-Home Pay:</span>
              <span className="text-xl font-bold text-emerald-400">₹{parseFloat(selectedPayslip.net_pay || '0').toLocaleString()}</span>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setSelectedPayslip(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded"
              >
                Close Payslip
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Attendance Correction */}
      <Modal isOpen={isCorrectionModalOpen} onClose={() => setIsCorrectionModalOpen(false)} title="Supervisor Attendance Correction">
        <form onSubmit={handleSaveCorrection} className="space-y-4">
          <p className="text-xs text-slate-400">
            Audit governance requires a verified justification reason for any manual attendance adjustment.
          </p>
          <Input
            label="Correction Reason (Mandatory)"
            value={correctionForm.correction_reason}
            onChange={(e) => setCorrectionForm({ ...correctionForm, correction_reason: e.target.value })}
            placeholder="e.g. Biometric scanner offline, verified by Department HOD"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Clock-In Time"
              type="time"
              value={correctionForm.clock_in}
              onChange={(e) => setCorrectionForm({ ...correctionForm, clock_in: e.target.value })}
              required
            />
            <Input
              label="Clock-Out Time"
              type="time"
              value={correctionForm.clock_out}
              onChange={(e) => setCorrectionForm({ ...correctionForm, clock_out: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Attendance Status"
              value={correctionForm.status}
              onChange={(e) => setCorrectionForm({ ...correctionForm, status: e.target.value })}
              options={[
                { label: 'Present', value: 'PRESENT' },
                { label: 'Half Day', value: 'HALF_DAY' },
                { label: 'Late', value: 'LATE' },
                { label: 'Approved Leave', value: 'ON_LEAVE' }
              ]}
            />
            <Input
              label="Total Working Hours"
              type="number"
              step="0.1"
              value={correctionForm.total_hours}
              onChange={(e) => setCorrectionForm({ ...correctionForm, total_hours: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsCorrectionModalOpen(false)}
              className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
            >
              Save Correction & Audit Trail
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Staff Member Profile Dossier */}
      {selectedStaffProfile && (
        <Modal
          isOpen={!!selectedStaffProfile}
          onClose={() => setSelectedStaffProfile(null)}
          title={`Staff Profile: ${selectedStaffProfile.full_name}`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg">
                {selectedStaffProfile.full_name?.[0] || 'S'}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">{selectedStaffProfile.full_name}</h3>
                  <Badge variant={selectedStaffProfile.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {selectedStaffProfile.status}
                  </Badge>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {selectedStaffProfile.designation} • {selectedStaffProfile.department_name || 'General Clinical'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Employee ID</span>
                <span className="font-mono font-semibold text-indigo-400">{selectedStaffProfile.employee_id}</span>
              </div>
              <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Assigned Branch</span>
                <span className="text-slate-200 font-medium">{selectedStaffProfile.branch_name || currentBranch?.name || 'Central Hospital'}</span>
              </div>
              <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Official Email</span>
                <span className="text-slate-200">{selectedStaffProfile.email || 'N/A'}</span>
              </div>
              <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Phone Number</span>
                <span className="text-slate-200">{selectedStaffProfile.phone_number || '+91 98765 43210'}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800 text-xs space-y-2">
              <div className="font-semibold text-slate-300">Statutory & Compliance Status</div>
              <div className="flex justify-between text-slate-400">
                <span>PAN & Tax Verification:</span>
                <span className="text-emerald-400 font-medium">Verified Active</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Direct Deposit Bank:</span>
                <span className="text-slate-200">HDFC Bank Ltd ••••••4102</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedStaffProfile(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default HRPayrollPage;
