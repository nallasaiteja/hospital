import React, { useState, useEffect } from 'react';
import { Pill, Search, RefreshCw, Clock, CheckCircle2, FileText, User } from 'lucide-react';
import { pharmacyService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

export const PatientPrescriptionsPage: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pharmacyService.getPrescriptions();
      setPrescriptions(data || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = prescriptions.filter((p) => {
    return (
      (p.prescription_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.doctor_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.diagnosis || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Pill className="w-7 h-7 text-cyan-400" />
            Digital Medical Prescriptions
          </h1>
          <p className="text-sm text-slate-400">
            Verified electronic doctor prescriptions, dosage instructions, and hospital dispensary status.
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors self-start sm:self-auto"
          title="Refresh Prescriptions"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Rx number, doctor name, or diagnosis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
            Loading your medical prescriptions...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
            <Pill className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-300">No active prescriptions</p>
            <p className="text-xs text-slate-500 mt-1">
              You do not have any pending medication prescriptions on record.
            </p>
          </div>
        ) : (
          filtered.map((rx) => (
            <div key={rx.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-cyan-400 text-sm">Rx #{rx.prescription_number}</span>
                    <Badge variant={rx.is_dispensed ? 'success' : 'warning'}>
                      {rx.is_dispensed ? 'Dispensed' : 'Ready at Pharmacy'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Prescribed by: <strong className="text-slate-200">{rx.doctor_name}</strong> &bull; {new Date(rx.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-xs text-slate-400">
                  Diagnosis: <span className="text-slate-200 font-medium">{rx.diagnosis || 'Clinical evaluation'}</span>
                </div>
              </div>

              {rx.items && rx.items.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Prescribed Medicines</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {rx.items.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{item.medicine_name}</p>
                          <p className="text-xs text-slate-400">{item.dosage} &bull; {item.frequency} &bull; {item.duration_days} Days</p>
                          {item.instructions && <p className="text-[11px] text-teal-400 mt-0.5">{item.instructions}</p>}
                        </div>
                        <span className="text-xs font-mono text-slate-400">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
