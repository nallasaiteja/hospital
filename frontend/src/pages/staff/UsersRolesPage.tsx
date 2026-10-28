import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Plus,
  Search,
  RefreshCw,
  UserCheck,
  Building,
  Key,
  Lock,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  XCircle,
  DollarSign,
  FileText,
  Check,
  X,
  Shield,
  Filter,
  Eye,
  Edit2,
  FileCheck,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { authService, rbacService } from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';
import {
  FinancialApprovalPolicy,
  FinancialApprovalRequest,
  SecurityAuditEvent,
  Role,
  Permission
} from '../../types';

// The 21 exact roles from the PDF specification
export const PDF_ROLES: { name: string; display_name: string; description: string; category: string }[] = [
  { name: 'SUPER_ADMIN', display_name: 'Super Administrator', description: 'Manage system-wide configuration, roles, permissions, branches, and security events.', category: 'Governance' },
  { name: 'HOSPITAL_ADMIN', display_name: 'Hospital Administrator', description: 'Manage hospital operations, staff access within authorized scope, and hospital settings.', category: 'Governance' },
  { name: 'MEDICAL_DIRECTOR', display_name: 'Medical Director', description: 'Oversee authorized clinical operations, review clinical performance, and approve clinical protocols.', category: 'Clinical Leadership' },
  { name: 'DOCTOR', display_name: 'Doctor', description: 'Access assigned patient records, consultations, diagnoses, treatment plans, and prescriptions.', category: 'Clinical' },
  { name: 'NURSE', display_name: 'Nurse', description: 'Access assigned patient-care workflows, record authorized nursing observations, vitals, and care activities.', category: 'Clinical' },
  { name: 'RECEPTIONIST', display_name: 'Receptionist', description: 'Register patients, manage appointments, and handle front-desk operational tasks.', category: 'Front Desk' },
  { name: 'BILLING_EXECUTIVE', display_name: 'Billing Executive', description: 'Prepare and manage authorized invoices, charges, billing adjustments, and cashier settlements.', category: 'Finance' },
  { name: 'LAB_TECHNICIAN', display_name: 'Laboratory Technician', description: 'Manage authorized laboratory orders, sample tracking, processing, and lab results entry.', category: 'Diagnostics' },
  { name: 'RADIOLOGY_TECHNICIAN', display_name: 'Radiology Technician', description: 'Manage authorized imaging workflows, technical records, and DICOM study attachments.', category: 'Diagnostics' },
  { name: 'PHARMACIST', display_name: 'Pharmacist', description: 'Manage permitted prescriptions, dispensing, batch expiry tracking, and pharmacy stock.', category: 'Pharmacy' },
  { name: 'INVENTORY_MANAGER', display_name: 'Inventory Manager', description: 'Manage hospital stock, batches, movements, and inventory adjustments and write-offs.', category: 'Supply Chain' },
  { name: 'PROCUREMENT_OFFICER', display_name: 'Procurement Officer', description: 'Prepare purchase requests, supplier records, and purchase orders with separated approval.', category: 'Supply Chain' },
  { name: 'ACCOUNTANT', display_name: 'Accountant', description: 'Manage authorized accounting records, reconciliations, journal entries, and financial statements.', category: 'Finance' },
  { name: 'FINANCE_MANAGER', display_name: 'Finance Manager', description: 'Review financial performance, enforce transaction limits, and manage multi-level approvals.', category: 'Finance' },
  { name: 'INVESTMENT_MANAGER', display_name: 'Investment Manager', description: 'Manage authorized investment records, valuations, maturities, and investment reports.', category: 'Finance' },
  { name: 'CASHIER', display_name: 'Cashier', description: 'Record authorized receipts, patient collections, and day-end cash desk reconciliation.', category: 'Finance' },
  { name: 'INSURANCE_COORDINATOR', display_name: 'Insurance Coordinator', description: 'Manage authorized insurance and corporate billing workflows, pre-auth, and claim documentation.', category: 'Finance' },
  { name: 'HR_MANAGER', display_name: 'HR Manager', description: 'Manage authorized employee records, attendance, leaves, and staff performance workflows.', category: 'Human Resources' },
  { name: 'DEPARTMENT_HEAD', display_name: 'Department Head', description: 'Access and manage permitted departmental clinical and operational services and duty rosters.', category: 'Leadership' },
  { name: 'AUDITOR', display_name: 'Auditor', description: 'Read-only access to authorized financial, clinical, and administrative audit trails and reports.', category: 'Compliance' },
  { name: 'PATIENT', display_name: 'Patient', description: 'Strictly restricted to own profile, medical records, appointments, prescriptions, and invoices.', category: 'Patient Portal' },
];

export const UsersRolesPage: React.FC = () => {
  const { currentBranch, branches } = useBranch();
  const { userProfile } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'accounts' | 'roles_directory' | 'matrix' | 'financial_approvals' | 'audit_trail'>('accounts');

  // Common Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Tab 1: User Accounts Data
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editUserData, setEditUserData] = useState({
    role: '',
    branch_id: '',
    department_id: '',
    is_active: true,
  });

  // Provisioning Modal
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionData, setProvisionData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    role: 'DOCTOR',
    branch_id: '',
    department_id: '',
    designation: '',
    specialization: '',
    medical_license_number: '',
  });

  // Tab 2 & 3: Roles & Permissions Data
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState<{
    modules: string[];
    actions: string[];
    permissions: Permission[];
  }>({ modules: [], actions: [], permissions: [] });
  const [selectedRoleName, setSelectedRoleName] = useState<string>('DOCTOR');
  const [selectedRolePermissions, setSelectedRolePermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionFilterModule, setPermissionFilterModule] = useState<string>('ALL');

  // Tab 4: Financial Approval Policies & Requests
  const [policies, setPolicies] = useState<FinancialApprovalPolicy[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<FinancialApprovalRequest[]>([]);
  const [isNewPolicyModalOpen, setIsNewPolicyModalOpen] = useState(false);
  const [policyFormData, setPolicyFormData] = useState({
    operation_type: 'INVOICE_ADJUSTMENT',
    min_amount: '1000',
    max_amount: '50000',
    approver_roles: ['FINANCE_MANAGER', 'SUPER_ADMIN'],
    requires_separation_of_duties: true,
    approval_level: 1,
    description: '',
  });
  const [isNewApprovalModalOpen, setIsNewApprovalModalOpen] = useState(false);
  const [newApprovalData, setNewApprovalData] = useState({
    operation_type: 'INVOICE_ADJUSTMENT',
    entity_type: 'INVOICE',
    entity_id: 'INV-TEST-001',
    amount: '5000',
    notes: 'Commercial concession approved by clinical head.',
  });

  // Tab 5: Security Audit Log
  const [auditEvents, setAuditEvents] = useState<SecurityAuditEvent[]>([]);
  const [auditFilterSeverity, setAuditFilterSeverity] = useState('ALL');
  const [auditSearch, setAuditSearch] = useState('');

  // MFA Status Modal
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [mfaData, setMfaData] = useState<any>(null);

  // Load Initial Data
  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersData, rolesData, catalogData, policiesData, approvalsData, auditData] = await Promise.all([
        rbacService.getUsers().catch(() => []),
        authService.getRoles().catch(() => []),
        rbacService.getPermissionsCatalog().catch(() => ({ modules: [], actions: [], permissions: [] })),
        rbacService.getFinancialPolicies().catch(() => []),
        rbacService.getFinancialApprovals().catch(() => []),
        rbacService.getSecurityAuditEvents().catch(() => []),
      ]);

      setUsers(usersData || []);
      setRoles(rolesData || []);
      setPermissionsCatalog(catalogData);
      setPolicies(policiesData || []);
      setApprovalRequests(approvalsData || []);
      setAuditEvents(auditData || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch role permissions when selected role changes
  useEffect(() => {
    if (selectedRoleName) {
      rbacService.getRolePermissions(selectedRoleName)
        .then((res) => {
          setSelectedRolePermissions(res.permission_codes || []);
        })
        .catch(() => {
          setSelectedRolePermissions([]);
        });
    }
  }, [selectedRoleName]);

  // Handle Edit User
  const handleOpenEditUser = (u: any) => {
    setSelectedUser(u);
    setEditUserData({
      role: u.role_name || 'DOCTOR',
      branch_id: u.branch_id || '',
      department_id: u.department_id || '',
      is_active: u.is_active,
    });
    setIsEditUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      setError(null);
      await rbacService.updateUser(selectedUser.id, editUserData);
      setSuccessMsg(`User ${selectedUser.email} updated successfully.`);
      setIsEditUserModalOpen(false);
      const updatedUsers = await rbacService.getUsers();
      setUsers(updatedUsers);
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Handle Staff Provisioning
  const handleProvisionStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProvisioning(true);
      setError(null);
      await authService.provisionStaff({
        email: provisionData.email,
        first_name: provisionData.first_name,
        last_name: provisionData.last_name,
        phone_number: provisionData.phone_number || undefined,
        role: provisionData.role,
        branch_id: provisionData.branch_id || currentBranch?.id || '',
        designation: provisionData.designation || provisionData.role,
        specialization: provisionData.specialization || undefined,
        medical_license_number: provisionData.medical_license_number || undefined,
      });

      setSuccessMsg(`Account for ${provisionData.first_name} ${provisionData.last_name} provisioned as ${provisionData.role}.`);
      setIsProvisionModalOpen(false);
      setProvisionData({
        email: '',
        first_name: '',
        last_name: '',
        phone_number: '',
        role: 'DOCTOR',
        branch_id: '',
        department_id: '',
        designation: '',
        specialization: '',
        medical_license_number: '',
      });
      const updatedUsers = await rbacService.getUsers();
      setUsers(updatedUsers);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setProvisioning(false);
    }
  };

  // Handle Role Permission Toggle
  const handleTogglePermission = (code: string) => {
    if (selectedRolePermissions.includes(code)) {
      setSelectedRolePermissions(selectedRolePermissions.filter(c => c !== code));
    } else {
      setSelectedRolePermissions([...selectedRolePermissions, code]);
    }
  };

  const handleToggleAllForModule = (moduleName: string) => {
    const moduleCodes = permissionsCatalog.permissions
      .filter(p => p.module === moduleName)
      .map(p => p.code);

    const allPresent = moduleCodes.every(c => selectedRolePermissions.includes(c));
    if (allPresent) {
      setSelectedRolePermissions(selectedRolePermissions.filter(c => !moduleCodes.includes(c)));
    } else {
      const merged = Array.from(new Set([...selectedRolePermissions, ...moduleCodes]));
      setSelectedRolePermissions(merged);
    }
  };

  const handleSaveRolePermissions = async () => {
    try {
      setSavingPermissions(true);
      setError(null);
      await rbacService.updateRolePermissions(selectedRoleName, selectedRolePermissions);
      setSuccessMsg(`Permissions updated for role ${selectedRoleName} (${selectedRolePermissions.length} granted).`);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setSavingPermissions(false);
    }
  };

  // Handle Financial Approval Action (Separation of Duties verification)
  const handleActionApproval = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      setError(null);
      await rbacService.actionFinancialApproval(id, { action, notes: `Reviewed by user ${userProfile?.email}` });
      setSuccessMsg(`Request marked as ${action} successfully.`);
      const updated = await rbacService.getFinancialApprovals();
      setApprovalRequests(updated);
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Handle Submit Test Approval Request
  const handleSubmitNewApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await rbacService.submitFinancialApproval({
        operation_type: newApprovalData.operation_type,
        entity_type: newApprovalData.entity_type,
        entity_id: newApprovalData.entity_id,
        amount: parseFloat(newApprovalData.amount),
        notes: newApprovalData.notes,
      });
      setSuccessMsg('Financial approval request submitted successfully.');
      setIsNewApprovalModalOpen(false);
      const updated = await rbacService.getFinancialApprovals();
      setApprovalRequests(updated);
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Handle Save Policy
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await rbacService.saveFinancialPolicy({
        operation_type: policyFormData.operation_type,
        min_amount: parseFloat(policyFormData.min_amount),
        max_amount: policyFormData.max_amount ? parseFloat(policyFormData.max_amount) : null,
        approver_roles: policyFormData.approver_roles,
        requires_separation_of_duties: policyFormData.requires_separation_of_duties,
        approval_level: policyFormData.approval_level,
        description: policyFormData.description,
      });
      setSuccessMsg(`Financial approval policy for ${policyFormData.operation_type} saved.`);
      setIsNewPolicyModalOpen(false);
      const updated = await rbacService.getFinancialPolicies();
      setPolicies(updated);
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // View MFA Info
  const handleOpenMfa = async () => {
    try {
      const data = await rbacService.getMFAStatus();
      setMfaData(data);
      setIsMfaModalOpen(true);
    } catch (err: any) {
      setError('Could not fetch MFA security status.');
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const name = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const query = (userSearch || '').toLowerCase();
    const matchSearch = name.includes(query) || email.includes(query);
    const userRole = u.role_name || u.role || '';
    const matchRole = userRoleFilter === 'ALL' || userRole === userRoleFilter;
    return matchSearch && matchRole;
  });

  // Filtered Audit Events
  const filteredAuditEvents = auditEvents.filter((ev) => {
    const severity = ev.severity || 'INFO';
    const matchSeverity = auditFilterSeverity === 'ALL' || severity === auditFilterSeverity;
    const query = (auditSearch || '').toLowerCase();
    const summary = (ev.action_summary || ev.event_type_display || ev.event_type || '').toLowerCase();
    const email = (ev.actor_email || '').toLowerCase();
    const type = (ev.event_type || '').toLowerCase();
    const matchSearch = summary.includes(query) || email.includes(query) || type.includes(query);
    return matchSeverity && matchSearch;
  });

  // Filtered Modules for Permission Matrix
  const displayedModules = permissionFilterModule === 'ALL'
    ? permissionsCatalog.modules
    : permissionsCatalog.modules.filter(m => m === permissionFilterModule);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800 text-xs font-semibold text-cyan-400 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Section 4 • Hospital Master Specification</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-cyan-400" />
            Authentication, RBAC & Security Administration
          </h1>
          <p className="text-sm text-slate-400">
            Granular role-based access control across all 21 PDF roles, financial approval limits, separation of duties, and security audit log.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenMfa}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium transition"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" /> MFA & Sessions
          </button>
          <button
            onClick={loadInitialData}
            className="p-2 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-300 transition"
            title="Refresh All Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsProvisionModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-semibold rounded-lg text-sm transition shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Provision Staff Account
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 overflow-x-auto space-x-1">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition flex items-center gap-2 border-b-2 ${
            activeTab === 'accounts'
              ? 'border-cyan-400 text-cyan-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Accounts ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles_directory')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition flex items-center gap-2 border-b-2 ${
            activeTab === 'roles_directory'
              ? 'border-cyan-400 text-cyan-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>21 System Roles</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition flex items-center gap-2 border-b-2 ${
            activeTab === 'matrix'
              ? 'border-cyan-400 text-cyan-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Role-Permission Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('financial_approvals')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition flex items-center gap-2 border-b-2 ${
            activeTab === 'financial_approvals'
              ? 'border-cyan-400 text-cyan-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Financial Approval Limits & Separation of Duties</span>
          {approvalRequests.filter(r => r.status === 'PENDING').length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] bg-amber-500/20 text-amber-300 rounded-full font-bold">
              {approvalRequests.filter(r => r.status === 'PENDING').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit_trail')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition flex items-center gap-2 border-b-2 ${
            activeTab === 'audit_trail'
              ? 'border-cyan-400 text-cyan-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Security & Audit Trail</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: USER ACCOUNTS & PROVISIONING */}
      {/* ========================================================================= */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name or email address..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="w-full sm:w-60">
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Roles ({users.length})</option>
                {PDF_ROLES.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* User Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">User / Email</th>
                    <th className="px-6 py-3.5">Assigned Role</th>
                    <th className="px-6 py-3.5">Branch / Scope</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Designation</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-normal">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        No users found matching query.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-100">
                            {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : 'Aura User'}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{u.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800">
                            {u.role_display_name || u.role_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-300">
                          <div className="flex items-center gap-1">
                            <Building className="w-3.5 h-3.5 text-slate-500" />
                            <span>{u.branch_name || 'All Branches'}</span>
                          </div>
                          {u.department_name && (
                            <div className="text-[11px] text-slate-400 mt-0.5 ml-4.5">
                              Dept: {u.department_name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              u.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {u.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {u.designation || (u.role_name === 'PATIENT' ? 'Registered Patient' : 'Staff Member')}
                          {u.employee_id && <div className="text-[10px] font-mono text-slate-500">ID: {u.employee_id}</div>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 border border-slate-700 transition"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit Scope</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 21 SYSTEM ROLES DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'roles_directory' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <div>
              <span className="font-bold text-white text-sm">21 Mandatory Roles from Master Specification</span>
              <p className="text-slate-400 text-xs mt-0.5">
                Configured with zero omissions, strict mapping to database roles, and granular action tokens.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono text-xs font-bold">
                21/21 Configured
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PDF_ROLES.map((r, idx) => {
              const assignedCount = users.filter(u => u.role_name === r.name).length;
              return (
                <div
                  key={r.name}
                  className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-900/50">
                          {r.category}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-400">
                        {assignedCount} {assignedCount === 1 ? 'User' : 'Users'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white tracking-tight">{r.display_name}</h3>
                    <div className="text-[11px] font-mono text-indigo-400 mb-2">{r.name}</div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{r.description}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setSelectedRoleName(r.name);
                        setActiveTab('matrix');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition"
                    >
                      <span>Configure Permissions</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {selectedRoleName === r.name ? 'Selected' : 'Active'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GRANULAR ROLE-PERMISSION MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Selected Role to Configure
                </label>
                <select
                  value={selectedRoleName}
                  onChange={(e) => setSelectedRoleName(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-cyan-300 font-semibold focus:outline-none focus:border-cyan-500"
                >
                  {PDF_ROLES.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.display_name} ({r.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Filter by Hospital Module
                </label>
                <select
                  value={permissionFilterModule}
                  onChange={(e) => setPermissionFilterModule(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Modules ({permissionsCatalog.modules.length})</option>
                  {permissionsCatalog.modules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Granted Tokens</span>
                <span className="text-sm font-bold text-cyan-400 font-mono">
                  {selectedRolePermissions.length} / {permissionsCatalog.permissions.length}
                </span>
              </div>
              <button
                onClick={handleSaveRolePermissions}
                disabled={savingPermissions}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider transition shadow-md"
              >
                {savingPermissions ? (
                  <span>Saving Matrix...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Save Configuration</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5 w-1/4">Hospital Module</th>
                    {permissionsCatalog.actions.map((act) => (
                      <th key={act} className="px-3 py-3.5 text-center font-mono">
                        {act}
                      </th>
                    ))}
                    <th className="px-4 py-3.5 text-right">Quick Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayedModules.map((moduleName) => {
                    const modulePerms = permissionsCatalog.permissions.filter(p => p.module === moduleName);
                    const allGranted = modulePerms.every(p => selectedRolePermissions.includes(p.code));

                    return (
                      <tr key={moduleName} className="hover:bg-slate-800/40 transition">
                        <td className="px-6 py-3 font-semibold text-white">
                          <div>{moduleName}</div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {modulePerms.length} Action Tokens
                          </span>
                        </td>

                        {permissionsCatalog.actions.map((actionName) => {
                          const targetPerm = modulePerms.find(p => p.action === actionName);
                          if (!targetPerm) {
                            return (
                              <td key={actionName} className="px-3 py-3 text-center text-slate-700">
                                —
                              </td>
                            );
                          }

                          const isGranted = selectedRolePermissions.includes(targetPerm.code);
                          return (
                            <td key={actionName} className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleTogglePermission(targetPerm.code)}
                                className={`w-6 h-6 rounded flex items-center justify-center transition mx-auto ${
                                  isGranted
                                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                                    : 'bg-slate-950 border border-slate-700 hover:border-slate-500 text-slate-600'
                                }`}
                                title={`${targetPerm.code}: ${targetPerm.name}`}
                              >
                                {isGranted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>
                            </td>
                          );
                        })}

                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleAllForModule(moduleName)}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                          >
                            {allGranted ? 'Deselect All' : 'Select All'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: FINANCIAL APPROVAL LIMITS & SEPARATION OF DUTIES */}
      {/* ========================================================================= */}
      {activeTab === 'financial_approvals' && (
        <div className="space-y-6">
          {/* Header Description & Separation of Duties Policy */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-white text-sm">
                  Separation of Duties & Configurable Financial Thresholds
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                As required by Section 4, financial transactions exceeding configured monetary thresholds require explicit review.
                The system strictly enforces <strong className="text-amber-300">Separation of Duties</strong>:
                a user cannot approve their own financial requests, reversals, or adjustments.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsNewPolicyModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Configure Policy</span>
              </button>
              <button
                onClick={() => setIsNewApprovalModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Submit Test Request</span>
              </button>
            </div>
          </div>

          {/* Section A: Configured Financial Threshold Policies */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-cyan-400" />
              <span>Configured Financial Operation Policies ({policies.length})</span>
            </h3>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Operation Type</th>
                      <th className="px-5 py-3.5">Threshold Band</th>
                      <th className="px-5 py-3.5">Authorized Approver Roles</th>
                      <th className="px-5 py-3.5 text-center">Separation of Duties</th>
                      <th className="px-5 py-3.5 text-center">Level</th>
                      <th className="px-5 py-3.5">Policy Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {policies.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-5 py-3 font-semibold text-white">
                          {p.operation_type}
                          {p.description && (
                            <div className="text-[11px] text-slate-400 font-normal mt-0.5">{p.description}</div>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono font-bold text-cyan-300">
                          ₹{Number(p.min_amount).toLocaleString()} – {p.max_amount ? `₹${Number(p.max_amount).toLocaleString()}` : 'Unlimited'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {p.approver_roles.map((r) => (
                              <span key={r} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {p.requires_separation_of_duties ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <ShieldCheck className="w-3 h-3" /> Mandatory
                            </span>
                          ) : (
                            <span className="text-slate-500">Optional</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center font-mono font-semibold">
                          Level {p.approval_level}
                        </td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active Enforced
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section B: Financial Approval Requests Queue */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-amber-400" />
              <span>Pending & Historic Financial Approval Queue ({approvalRequests.length})</span>
            </h3>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Operation & Entity</th>
                      <th className="px-5 py-3.5">Amount</th>
                      <th className="px-5 py-3.5">Requester</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Reviewed By</th>
                      <th className="px-5 py-3.5 text-right">Approval Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {approvalRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                          No financial approval requests recorded.
                        </td>
                      </tr>
                    ) : (
                      approvalRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-5 py-3">
                            <div className="font-semibold text-white">{req.operation_type}</div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {req.entity_type}: {req.entity_id}
                            </div>
                            {req.notes && (
                              <div className="text-[11px] text-slate-500 italic mt-0.5">"{req.notes}"</div>
                            )}
                          </td>
                          <td className="px-5 py-3 font-mono font-bold text-emerald-400 text-sm">
                            ₹{Number(req.amount).toLocaleString()}
                          </td>
                          <td className="px-5 py-3">
                            <div className="font-medium text-slate-200">{req.requested_by_name || 'Requester'}</div>
                            <div className="text-[11px] text-slate-500">{req.requested_by_email}</div>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                req.status === 'PENDING'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                  : req.status === 'APPROVED' || req.status === 'POSTED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-400">
                            {req.reviewed_by_email ? (
                              <div>
                                <span className="font-medium text-slate-300">{req.reviewed_by_name || 'Approver'}</span>
                                <div className="text-[10px] text-slate-500">{req.reviewed_at ? new Date(req.reviewed_at).toLocaleString() : ''}</div>
                              </div>
                            ) : (
                              <span className="text-slate-600 italic">Pending Review</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {req.status === 'PENDING' ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => handleActionApproval(req.id, 'APPROVE')}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition flex items-center gap-1"
                                  title="Approve (enforces separation of duties)"
                                >
                                  <Check className="w-3 h-3 stroke-[3]" /> Approve
                                </button>
                                <button
                                  onClick={() => handleActionApproval(req.id, 'REJECT')}
                                  className="px-2.5 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white font-semibold transition flex items-center gap-1"
                                  title="Reject"
                                >
                                  <X className="w-3 h-3" /> Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 font-mono">Completed</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SECURITY & ACCESS AUDIT LOG */}
      {/* ========================================================================= */}
      {activeTab === 'audit_trail' && (
        <div className="space-y-4">
          {/* Audit Filter */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit actions, user email, or event type..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="w-full sm:w-56">
              <select
                value={auditFilterSeverity}
                onChange={(e) => setAuditFilterSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Severities</option>
                <option value="INFO">INFO Events</option>
                <option value="WARNING">WARNING Events</option>
                <option value="CRITICAL">CRITICAL Violations</option>
              </select>
            </div>
          </div>

          {/* Audit Events Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Timestamp</th>
                    <th className="px-5 py-3.5">Severity</th>
                    <th className="px-5 py-3.5">Event Type</th>
                    <th className="px-5 py-3.5">Actor & Role</th>
                    <th className="px-5 py-3.5">Action Summary</th>
                    <th className="px-5 py-3.5">Target / IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredAuditEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-500 font-sans">
                        No security audit events recorded.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                          {ev.timestamp || ev.created_at ? new Date((ev.timestamp || ev.created_at) as string).toLocaleString() : 'Recent'}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ev.severity === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : ev.severity === 'WARNING'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            }`}
                          >
                            {ev.severity || 'INFO'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-200 font-semibold">{ev.event_type_display || ev.event_type}</td>
                        <td className="px-5 py-3">
                          <div className="text-slate-100 font-sans">{ev.actor_email || 'System'}</div>
                          <div className="text-[10px] text-cyan-400">{ev.actor_role || 'STAFF'}</div>
                        </td>
                        <td className="px-5 py-3 font-sans text-slate-300 max-w-md">
                          {ev.action_summary || ev.event_type_display || (typeof ev.details === 'object' ? JSON.stringify(ev.details) : '')}
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-[11px]">
                          {ev.target_model ? `${ev.target_model}#${ev.target_id || ''}` : (ev.target_user_email || ev.ip_address || '127.0.0.1')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT USER ROLE & SCOPE */}
      {/* ========================================================================= */}
      {isEditUserModalOpen && selectedUser && (
        <Modal
          isOpen={isEditUserModalOpen}
          onClose={() => setIsEditUserModalOpen(false)}
          title={`Edit User Scope & Role: ${selectedUser.email}`}
        >
          <form onSubmit={handleSaveUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Assign System Role (From 21 PDF Roles)
              </label>
              <select
                value={editUserData.role}
                onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {PDF_ROLES.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.display_name} ({r.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Assigned Branch Scope
              </label>
              <select
                value={editUserData.branch_id}
                onChange={(e) => setEditUserData({ ...editUserData, branch_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Hospital Branches (Global)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-white block">Account Status</span>
                <span className="text-xs text-slate-400">
                  Suspended accounts are blocked from login and API actions
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditUserData({ ...editUserData, is_active: !editUserData.is_active })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  editUserData.is_active
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
              >
                {editUserData.is_active ? 'Active' : 'Suspended'}
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditUserModalOpen(false)}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-sm transition"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PROVISION STAFF ACCOUNT */}
      {/* ========================================================================= */}
      {isProvisionModalOpen && (
        <Modal
          isOpen={isProvisionModalOpen}
          onClose={() => setIsProvisionModalOpen(false)}
          title="Provision New Staff Account"
        >
          <form onSubmit={handleProvisionStaff} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={provisionData.first_name}
                  onChange={(e) => setProvisionData({ ...provisionData, first_name: e.target.value })}
                  placeholder="e.g. Ramesh"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={provisionData.last_name}
                  onChange={(e) => setProvisionData({ ...provisionData, last_name: e.target.value })}
                  placeholder="e.g. Patel"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Official Hospital Email</label>
              <input
                type="email"
                required
                value={provisionData.email}
                onChange={(e) => setProvisionData({ ...provisionData, email: e.target.value })}
                placeholder="staff.name@aurahospital.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Role</label>
                <select
                  value={provisionData.role}
                  onChange={(e) => setProvisionData({ ...provisionData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                >
                  {PDF_ROLES.filter(r => r.name !== 'PATIENT').map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Branch</label>
                <select
                  value={provisionData.branch_id}
                  onChange={(e) => setProvisionData({ ...provisionData, branch_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                >
                  <option value="">Default Main Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Designation</label>
                <input
                  type="text"
                  value={provisionData.designation}
                  onChange={(e) => setProvisionData({ ...provisionData, designation: e.target.value })}
                  placeholder="e.g. Senior Consultant"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Specialization / License</label>
                <input
                  type="text"
                  value={provisionData.specialization}
                  onChange={(e) => setProvisionData({ ...provisionData, specialization: e.target.value })}
                  placeholder="e.g. Cardiology / MCI-99201"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400">
              A temporary password will be sent to the staff email. Password recovery and initial session onboarding are managed via Supabase Auth.
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsProvisionModalOpen(false)}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={provisioning}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-sm transition"
              >
                {provisioning ? 'Provisioning Account...' : 'Provision Staff Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIGURE FINANCIAL POLICY */}
      {/* ========================================================================= */}
      {isNewPolicyModalOpen && (
        <Modal
          isOpen={isNewPolicyModalOpen}
          onClose={() => setIsNewPolicyModalOpen(false)}
          title="Configure Financial Approval Limit Policy"
        >
          <form onSubmit={handleSavePolicy} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Operation Type</label>
              <select
                value={policyFormData.operation_type}
                onChange={(e) => setPolicyFormData({ ...policyFormData, operation_type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
              >
                <option value="INVOICE_ADJUSTMENT">Invoice Adjustment</option>
                <option value="REFUND_REVERSAL">Refund & Reversal</option>
                <option value="SUPPLIER_PAYMENT">Supplier Payment</option>
                <option value="PURCHASE_APPROVAL">Purchase Order Approval</option>
                <option value="JOURNAL_POSTING">General Ledger Journal Posting</option>
                <option value="INVESTMENT_TRANSACTION">Investment Transaction</option>
                <option value="PAYROLL_DISBURSEMENT">Payroll Disbursement</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Min Threshold (₹)</label>
                <input
                  type="number"
                  required
                  value={policyFormData.min_amount}
                  onChange={(e) => setPolicyFormData({ ...policyFormData, min_amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Max Threshold (₹)</label>
                <input
                  type="number"
                  value={policyFormData.max_amount}
                  onChange={(e) => setPolicyFormData({ ...policyFormData, max_amount: e.target.value })}
                  placeholder="Leave empty for unlimited"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Rationale</label>
              <input
                type="text"
                value={policyFormData.description}
                onChange={(e) => setPolicyFormData({ ...policyFormData, description: e.target.value })}
                placeholder="e.g. Major equipment purchases requiring Finance Manager approval"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="sod-check"
                checked={policyFormData.requires_separation_of_duties}
                onChange={(e) => setPolicyFormData({ ...policyFormData, requires_separation_of_duties: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-800"
              />
              <label htmlFor="sod-check" className="text-xs text-slate-300 font-medium cursor-pointer">
                Strictly enforce Separation of Duties (Self-approval strictly prohibited)
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewPolicyModalOpen(false)}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-sm transition"
              >
                Save Threshold Policy
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUBMIT TEST FINANCIAL APPROVAL REQUEST */}
      {/* ========================================================================= */}
      {isNewApprovalModalOpen && (
        <Modal
          isOpen={isNewApprovalModalOpen}
          onClose={() => setIsNewApprovalModalOpen(false)}
          title="Submit Financial Approval Request"
        >
          <form onSubmit={handleSubmitNewApproval} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Financial Operation</label>
              <select
                value={newApprovalData.operation_type}
                onChange={(e) => setNewApprovalData({ ...newApprovalData, operation_type: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
              >
                <option value="INVOICE_ADJUSTMENT">Invoice Adjustment</option>
                <option value="REFUND_REVERSAL">Refund & Reversal</option>
                <option value="SUPPLIER_PAYMENT">Supplier Payment</option>
                <option value="PURCHASE_APPROVAL">Purchase Order Approval</option>
                <option value="JOURNAL_POSTING">Journal Posting</option>
                <option value="INVESTMENT_TRANSACTION">Investment Transaction</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Entity Reference ID</label>
                <input
                  type="text"
                  required
                  value={newApprovalData.entity_id}
                  onChange={(e) => setNewApprovalData({ ...newApprovalData, entity_id: e.target.value })}
                  placeholder="e.g. INV-2026-9041"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={newApprovalData.amount}
                  onChange={(e) => setNewApprovalData({ ...newApprovalData, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Justification / Clinical Notes</label>
              <textarea
                rows={2}
                value={newApprovalData.notes}
                onChange={(e) => setNewApprovalData({ ...newApprovalData, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
              />
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
              <strong>Testing Separation of Duties:</strong> Once submitted by your account, attempting to approve this request with the same user identity will be automatically blocked with HTTP 403 Forbidden.
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewApprovalModalOpen(false)}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-sm transition"
              >
                Submit for Approval
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MFA & SESSION SECURITY STATUS */}
      {/* ========================================================================= */}
      {isMfaModalOpen && mfaData && (
        <Modal
          isOpen={isMfaModalOpen}
          onClose={() => setIsMfaModalOpen(false)}
          title="Multi-Factor Authentication & Session Security"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Current Session User:</span>
                <span className="text-xs font-bold text-white font-mono">{mfaData.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Assigned Role:</span>
                <span className="text-xs font-bold text-cyan-400 font-mono">{mfaData.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">MFA Configured:</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {mfaData.mfa_enforced ? 'TOTP Authenticator Enabled' : 'Optional (Supabase TOTP Ready)'}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                <strong>Security Architecture:</strong> Antigravity HMS integrates with Supabase Auth for multi-factor authentication (MFA) via TOTP authenticator apps (Google Authenticator, Authy, 1Password).
              </p>
              <p>
                Session invalidation is enforced immediately upon logout or account suspension. Privileged accounts (Super Administrator, Hospital Administrator, Finance Manager) are recommended to enable TOTP verification in production.
              </p>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsMfaModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Close Security Panel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default UsersRolesPage;
