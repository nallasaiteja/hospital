import React, { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, CheckCircle2, AlertTriangle, Layers, Printer, ShieldCheck } from 'lucide-react';
import { diagnosticsService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { Modal } from '../../components/common/Modal';
import { parseApiError } from '../../utils/errorHandler';

export const PatientLabReportsPage: React.FC = () => {
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await diagnosticsService.getOrders();
      // Only show released reports to patients in portal
      const releasedOnly = (data || []).filter((o: any) => o.status === 'RELEASED');
      setLabOrders(releasedOnly);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenReport = async (orderId: string) => {
    try {
      const detail = await diagnosticsService.getReportDetail(orderId);
      setSelectedReport(detail);
      setShowReportModal(true);
    } catch (err: any) {
      setError('Unable to fetch official report details.');
    }
  };

  const filtered = labOrders.filter((o) => {
    return (
      (o.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.doctor?.user_profile?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <FileText className="w-7 h-7 text-teal-400" />
            Verified Diagnostic Laboratory Reports
          </h1>
          <p className="text-sm text-slate-400">
            Pathology profiles, hematology counts, specimen test outcomes, and verified reference ranges released by clinical pathologists.
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors self-start sm:self-auto"
          title="Refresh Lab Reports"
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
            placeholder="Search by order # or prescribing doctor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
            Loading your verified diagnostic findings...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-300">No released diagnostic reports available</p>
            <p className="text-xs text-slate-500 mt-1">
              Tests under laboratory processing or awaiting final pathologist authorization are not shown until digitally released.
            </p>
          </div>
        ) : (
          filtered.map((order) => (
            <div
              key={order.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-teal-400 text-sm">
                      Order #{order.order_number}
                    </span>
                    <Badge variant="success">Verified & Released</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Prescribed by: <strong className="text-slate-200">Dr. {order.doctor?.user_profile?.last_name || 'Staff'}</strong> &bull; Ordered on {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleOpenReport(order.id)}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto"
                >
                  <ShieldCheck className="w-4 h-4" />
                  View & Print Official Report
                </button>
              </div>

              {order.items && order.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="text-slate-400 uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Test Name</th>
                        <th className="py-2 px-3">Specimen</th>
                        <th className="py-2 px-3">Result Value</th>
                        <th className="py-2 px-3">Biological Reference Interval</th>
                        <th className="py-2 px-3 text-center">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {order.items.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-800/20">
                          <td className="py-2 px-3 font-medium text-slate-200">
                            {item.test?.name || item.test_name}
                          </td>
                          <td className="py-2 px-3 text-slate-400">{item.test?.sample_type || 'Blood'}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-100">
                            {item.result_value} {item.test?.unit_of_measurement || ''}
                          </td>
                          <td className="py-2 px-3 text-slate-400">
                            {item.test?.reference_range ||
                              `${item.test?.normal_min ?? ''} - ${item.test?.normal_max ?? ''}`}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.abnormal_flag === 'NORMAL' ? (
                              <Badge variant="success">Normal</Badge>
                            ) : (
                              <Badge variant="warning">{item.abnormal_flag || 'Flagged'}</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Official Report Inspection Modal */}
      {showReportModal && selectedReport && (
        <Modal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          title="Official Diagnostic Pathology Report"
        >
          <div className="space-y-4">
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl space-y-4 text-xs font-sans">
              <div className="border-b border-slate-800 pb-3 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-bold text-slate-100">{selectedReport.hospital?.name}</h2>
                  <p className="text-slate-400">{selectedReport.hospital?.branch} &bull; {selectedReport.hospital?.address}</p>
                  <p className="text-teal-400 font-semibold text-[10px] uppercase mt-0.5">{selectedReport.hospital?.accreditation}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-teal-400">{selectedReport.report?.report_number}</span>
                  <span className="block text-[10px] text-emerald-400 font-bold uppercase">DIGITALLY RELEASED (v{selectedReport.report?.version})</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                <div>
                  <span className="text-slate-500">Patient:</span>{' '}
                  <strong className="text-slate-200">{selectedReport.patient?.name}</strong>
                </div>
                <div>
                  <span className="text-slate-500">MRN:</span>{' '}
                  <span className="font-mono text-teal-300">{selectedReport.patient?.mrn}</span>
                </div>
                <div>
                  <span className="text-slate-500">Age / Gender:</span>{' '}
                  <span className="text-slate-300">{selectedReport.patient?.age || 'Adult'} / {selectedReport.patient?.gender}</span>
                </div>
                <div>
                  <span className="text-slate-500">Released At:</span>{' '}
                  <span className="text-slate-300">{new Date(selectedReport.report?.released_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Investigation</th>
                      <th className="py-2 px-3">Result</th>
                      <th className="py-2 px-3">Reference Interval</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {selectedReport.lab_order?.items?.map((it: any) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-medium text-slate-200">{it.test?.name}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-100">
                          {it.result_value} {it.test?.unit_of_measurement}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {it.test?.reference_range || `${it.test?.normal_min} - ${it.test?.normal_max}`}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={it.abnormal_flag === 'NORMAL' ? 'success' : 'warning'}>
                            {it.abnormal_flag}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <div>Digital Hash: <span className="text-teal-400">{selectedReport.report?.digital_signature_hash}</span></div>
                <div>Approved by: Dr. {selectedReport.report?.approved_by?.user_profile?.last_name || 'Consultant Pathologist'}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4" />
                Print Verified Report
              </button>
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
