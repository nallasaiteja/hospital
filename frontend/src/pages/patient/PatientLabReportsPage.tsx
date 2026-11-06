import React, { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, CheckCircle2, AlertTriangle, Layers, Printer, ShieldCheck, Download } from 'lucide-react';
import { diagnosticsService } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { Modal } from '../../components/common/Modal';
import { parseApiError } from '../../utils/errorHandler';
import { useTranslation } from 'react-i18next';
import { downloadOrPrintReport } from '../../utils/printReport';

export const PatientLabReportsPage: React.FC = () => {
  const { t } = useTranslation();
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
      // Include all patient orders (both verified/released reports and in-progress requisitions)
      setLabOrders(data || []);
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

  const handleDownloadReport = async (orderId: string) => {
    try {
      const detail = await diagnosticsService.getReportDetail(orderId);
      downloadOrPrintReport(detail);
    } catch (err: any) {
      setError('Unable to download official PDF report.');
    }
  };

  const filtered = labOrders.filter((o) => {
    return (
      (o.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.doctor?.user_profile?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const releasedOrders = filtered.filter((o) => ['RELEASED', 'APPROVED', 'COMPLETED'].includes(o.status));
  const inProgressOrders = filtered.filter((o) => ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROCESS', 'AWAITING_APPROVAL'].includes(o.status));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <FileText className="w-7 h-7 text-teal-400" />
            {t('labReports.title', 'Diagnostic Laboratory Reports & Investigation Tracker')}
          </h1>
          <p className="text-sm text-slate-400">
            {t('labReports.subtitle', 'Track active laboratory test requisitions, specimen analysis, and verified pathology reports released by clinical pathologists.')}
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
            placeholder={t('labReports.searchPlaceholder', 'Search by order # or prescribing doctor...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* 1. Active In-Progress Investigations Section */}
      {!loading && inProgressOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Active Investigations in Progress ({inProgressOrders.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inProgressOrders.map((ord) => (
              <div key={ord.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-amber-300">#{ord.order_number}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {ord.status === 'SAMPLE_COLLECTED'
                      ? 'Specimen Collected — Under Processing in Lab'
                      : ord.status === 'AWAITING_APPROVAL'
                      ? 'Results Entered — In Pathologist Verification'
                      : ord.status === 'IN_PROCESS'
                      ? 'Analyzing Specimen in Lab'
                      : `Prescribed by Dr. ${ord.doctor?.user_profile?.last_name || 'Staff'} — Awaiting Sample Collection`}
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  Tests: {(ord.items || []).map((it: any) => it.test?.name).join(', ') || 'Diagnostic Panel'}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Prescribed by Dr. {ord.doctor?.user_profile?.last_name || 'Staff'}</span>
                  <span>{new Date(ord.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Released / Verified Diagnostic Reports Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>Verified & Released Diagnostic Reports ({releasedOrders.length})</span>
        </h2>

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
            {t('labReports.loading', 'Loading your verified diagnostic findings...')}
          </div>
        ) : releasedOrders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-300">{t('labReports.emptyTitle', 'No released diagnostic reports available')}</p>
            <p className="text-xs text-slate-500 mt-1">
              {t('labReports.emptySubtitle', 'Tests under laboratory processing or awaiting final pathologist authorization are displayed above and will appear here once finalized.')}
            </p>
          </div>
        ) : (
          releasedOrders.map((order) => (
            <div
              key={order.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-teal-400 text-sm">
                      {t('labReports.order', 'Order')} #{order.order_number}
                    </span>
                    <Badge variant="success">{t('labReports.verifiedReleased', 'Verified & Released')}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {t('labReports.prescribedBy', 'Prescribed by')}: <strong className="text-slate-200">Dr. {order.doctor?.user_profile?.last_name || 'Staff'}</strong> &bull; {t('labReports.orderedOn', 'Ordered on')} {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() => handleDownloadReport(order.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                    title="Download Official PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    onClick={() => handleOpenReport(order.id)}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>View Report</span>
                  </button>
                </div>
              </div>

              {order.items && order.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="text-slate-400 uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">{t('labReports.testName', 'Test Name')}</th>
                        <th className="py-2 px-3">{t('labReports.specimen', 'Specimen')}</th>
                        <th className="py-2 px-3">{t('labReports.resultValue', 'Result Value')}</th>
                        <th className="py-2 px-3">{t('labReports.biologicalRef', 'Biological Reference Interval')}</th>
                        <th className="py-2 px-3 text-center">{t('labReports.outcome', 'Outcome')}</th>
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
                              <Badge variant="success">{t('labReports.normal', 'Normal')}</Badge>
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
                      <th className="py-2 px-3">{t('labReports.testName', 'Investigation')}</th>
                      <th className="py-2 px-3">{t('labReports.resultValue', 'Result')}</th>
                      <th className="py-2 px-3">{t('labReports.biologicalRef', 'Reference Interval')}</th>
                      <th className="py-2 px-3">{t('labReports.outcome', 'Status')}</th>
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
                onClick={() => downloadOrPrintReport(selectedReport)}
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition shadow"
              >
                <Download className="w-4 h-4" />
                Download / Print Official PDF
              </button>
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium"
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
