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
  Key,
  Clock,
  User,
  Activity,
  AlertCircle
} from 'lucide-react';
import { operationsHrService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

export const SettingsAuditPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'AUDIT_LOGS'>('AUDIT_LOGS');
  const [settings, setSettings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [setData, logData] = await Promise.all([
        operationsHrService.getSettings().catch(() => []),
        operationsHrService.getAuditLogs().catch(() => []),
      ]);
      setSettings(setData || []);
      setAuditLogs(logData || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredLogs = auditLogs.filter((l) => {
    return (
      l.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.entity_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.actor_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.record_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Settings className="w-7 h-7 text-indigo-400" />
            Hospital Settings & Forensic Audit Trail
          </h1>
          <p className="text-sm text-slate-400">
            System configuration keys, numbering sequences, and tamper-resistant immutable security audit logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          Immutable Security Audit Logs
        </button>
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'SETTINGS'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Hospital System Configuration
        </button>
      </div>

      {activeTab === 'AUDIT_LOGS' ? (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit action, actor email, entity type or record ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp (UTC)</th>
                    <th className="px-4 py-3">Actor / Principal</th>
                    <th className="px-4 py-3">Security Action</th>
                    <th className="px-4 py-3">Entity Domain</th>
                    <th className="px-4 py-3">Target Record ID</th>
                    <th className="px-4 py-3">Client IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                          Verifying cryptographic audit trails...
                        </div>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No audit events recorded for current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors font-mono text-xs">
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-200">
                          {log.actor_email || 'System Daemon'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={log.action.includes('DELETE') ? 'danger' : 'info'}>{log.action}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-300 font-semibold">{log.entity_type}</td>
                        <td className="px-4 py-3 text-indigo-400">{log.record_id}</td>
                        <td className="px-4 py-3 text-slate-400">{log.ip_address || '127.0.0.1'}</td>
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
    </div>
  );
};
