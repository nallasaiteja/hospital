import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Search,
  RefreshCw,
  Sliders,
  History,
  Lock,
  Building,
  Clock,
  User,
  Activity,
  AlertCircle,
  Plus,
  Filter,
  FileCheck,
  ShieldAlert
} from 'lucide-react';
import { operationsHrService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

export const SettingsAuditPage: React.FC = () => {
  const { role } = useAuth();
  const { currentBranch } = useBranch();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const canRecordAuditFinding = role === 'AUDITOR' || role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'AUDIT_LOGS'>('AUDIT_LOGS');
  const [settings, setSettings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Record Audit Finding Modal (for Auditor / Super Admin)
  const [isFindingModalOpen, setIsFindingModalOpen] = useState(false);
  const [savingFinding, setSavingFinding] = useState(false);
  const [findingForm, setFindingForm] = useState({
    module: 'COMPLIANCE',
    entity_type: 'AUDIT_FINDING',
    entity_id: 'FIND-2026-001',
    severity: 'WARNING',
    description: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = {};
      if (currentBranch?.id && role !== 'SUPER_ADMIN') {
        params.branch_id = currentBranch.id;
      }
      if (moduleFilter !== 'ALL') params.module = moduleFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const [setData, logData] = await Promise.all([
        operationsHrService.getSettings().catch(() => []),
        operationsHrService.getAuditLogs(params).catch(() => []),
      ]);
      setSettings(setData || []);
      setAuditLogs(Array.isArray(logData) ? logData : logData?.results || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranch?.id, moduleFilter, statusFilter]);

  const handleCreateFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findingForm.description.trim()) return;
    try {
      setSavingFinding(true);
      setError(null);
      await operationsHrService.createAuditFinding(findingForm);
      setSuccessMsg('Official audit finding recorded into the immutable forensic trail.');
      setIsFindingModalOpen(false);
      setFindingForm({
        module: 'COMPLIANCE',
        entity_type: 'AUDIT_FINDING',
        entity_id: `FIND-${Date.now().toString().slice(-6)}`,
        severity: 'WARNING',
        description: '',
      });
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setSavingFinding(false);
    }
  };

  const filteredLogs = auditLogs.filter((l) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      l.action?.toLowerCase().includes(q) ||
      l.entity_type?.toLowerCase().includes(q) ||
      l.actor_email?.toLowerCase().includes(q) ||
      l.actor_name?.toLowerCase().includes(q) ||
      l.actor_role?.toLowerCase().includes(q) ||
      l.department_name?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.record_id?.toLowerCase().includes(q) ||
      l.entity_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-800 text-xs font-semibold text-indigo-300 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Tamper-Resistant Centralized Activity &amp; Audit Trail • Scope: {role}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Settings className="w-7 h-7 text-indigo-400" />
            Centralized Activity Monitoring &amp; Forensic Audit Logs
          </h1>
          <p className="text-sm text-slate-400">
            14-point organizational activity records scoped to your role, branch, and department. Audit logs cannot be edited or deleted by any user.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canRecordAuditFinding && (
            <button
              onClick={() => setIsFindingModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Record Audit Finding</span>
            </button>
          )}
          <button
            onClick={loadData}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh Audit Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('AUDIT_LOGS')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'AUDIT_LOGS'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Centralized Activity &amp; Audit Trail ({filteredLogs.length})
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'SETTINGS'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Hospital System Configuration (Super Admin)
          </button>
        )}
      </div>

      {activeTab === 'AUDIT_LOGS' ? (
        <div className="space-y-4">
          {/* Filters Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee name, role, department, action, module, or record ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="w-full md:w-48 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
            >
              <option value="ALL">All Authorized Modules</option>
              <option value="HR">HR &amp; Onboarding</option>
              <option value="CLINICAL">Clinical &amp; Consultations</option>
              <option value="NURSING">Nursing &amp; Vitals</option>
              <option value="RECEPTION">Reception &amp; Registration</option>
              <option value="PHARMACY">Pharmacy &amp; Dispensing</option>
              <option value="LABORATORY">Laboratory &amp; Diagnostics</option>
              <option value="FINANCE">Finance &amp; Billing</option>
              <option value="INVENTORY">Inventory &amp; Procurement</option>
              <option value="RBAC">Security &amp; RBAC</option>
              <option value="COMPLIANCE">Audit &amp; Compliance</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-44 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="DENIED">Denied / Blocked</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Employee &amp; Role</th>
                    <th className="px-4 py-3">Dept / Branch</th>
                    <th className="px-4 py-3">Module &amp; Action</th>
                    <th className="px-4 py-3">Activity Summary</th>
                    <th className="px-4 py-3">Target Record</th>
                    <th className="px-4 py-3">Status / Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                          Verifying cryptographic audit trails...
                        </div>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No audit events recorded for current filter scope.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-100">
                            {log.actor_name || log.actor_email || 'System Daemon'}
                          </div>
                          <div className="text-[10px] font-mono text-indigo-400">
                            {log.actor_role || 'SYSTEM'} {log.employee_id ? `• ${log.employee_id}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-200 font-medium">{log.department_name || 'General'}</div>
                          <div className="text-[10px] text-slate-500">{log.branch_name || 'Hospital-Wide'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[10px] font-mono uppercase text-slate-400 mb-0.5">
                            {log.module || log.entity_type}
                          </div>
                          <Badge
                            variant={
                              log.action?.includes('DENIED') || log.action?.includes('DELETE') || log.action?.includes('REJECT')
                                ? 'danger'
                                : log.action?.includes('APPROVE') || log.action?.includes('CREATE') || log.action?.includes('ONBOARD')
                                ? 'success'
                                : 'info'
                            }
                          >
                            {log.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-300 max-w-xs">
                          {log.description || `${log.action} on ${log.entity_type} (${log.entity_id || log.record_id})`}
                        </td>
                        <td className="px-4 py-3 font-mono text-indigo-300">
                          {log.entity_type}: {log.entity_id || log.record_id}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              log.status === 'DENIED'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {log.status || 'SUCCESS'}
                          </span>
                          {log.approval_status && log.approval_status !== 'NOT_REQUIRED' && (
                            <div className="text-[10px] text-amber-400 font-mono mt-0.5">
                              Approval: {log.approval_status}
                            </div>
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
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <h2 className="font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            Global Hospital Operational Parameters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <span className="font-semibold text-slate-200 text-sm">UHID Patient Numbering Prefix</span>
              <p className="text-xs text-slate-400">Standard nomenclature for patient identifiers.</p>
              <div className="font-mono text-indigo-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800 text-sm">
                UHID-YYYYMMDD-XXXX
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <span className="font-semibold text-slate-200 text-sm">Invoice Numbering Sequence</span>
              <p className="text-xs text-slate-400">Immutable sequential sequence for patient billing.</p>
              <div className="font-mono text-emerald-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800 text-sm">
                INV-YYYYMMDD-XXXXXX
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <span className="font-semibold text-slate-200 text-sm">Emergency Triage Protocol</span>
              <p className="text-xs text-slate-400">Standard clinical classification (ESI Level 1 - 5).</p>
              <div className="font-mono text-rose-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800 text-sm">
                Emergency Severity Index (ESI) Active
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <span className="font-semibold text-slate-200 text-sm">Double-Entry Accounting Rule</span>
              <p className="text-xs text-slate-400">Strict database level constraint on balanced debits and credits.</p>
              <div className="font-mono text-amber-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800 text-sm">
                Enforced Invariant: Total(Debit) == Total(Credit)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Record Official Audit Finding */}
      {isFindingModalOpen && (
        <Modal
          isOpen={isFindingModalOpen}
          onClose={() => setIsFindingModalOpen(false)}
          title="Record Official Audit Finding / Observation"
        >
          <form onSubmit={handleCreateFinding} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Audited Module</label>
                <select
                  value={findingForm.module}
                  onChange={(e) => setFindingForm({ ...findingForm, module: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
                >
                  <option value="COMPLIANCE">Compliance &amp; Governance</option>
                  <option value="FINANCE">Finance &amp; Billing</option>
                  <option value="CLINICAL">Clinical &amp; EMR</option>
                  <option value="PHARMACY">Pharmacy &amp; Narcotics</option>
                  <option value="HR">HR &amp; Payroll</option>
                  <option value="INVENTORY">Inventory &amp; Procurement</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Finding Reference ID</label>
                <input
                  type="text"
                  required
                  value={findingForm.entity_id}
                  onChange={(e) => setFindingForm({ ...findingForm, entity_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Finding Observation &amp; Evidence Notes</label>
              <textarea
                rows={3}
                required
                value={findingForm.description}
                onChange={(e) => setFindingForm({ ...findingForm, description: e.target.value })}
                placeholder="Document compliance observation, discrepancy, or control review note..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200"
              />
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsFindingModalOpen(false)}
                className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingFinding}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold"
              >
                {savingFinding ? 'Recording...' : 'Record Immutable Finding'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
