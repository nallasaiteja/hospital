import React, { useState, useEffect } from 'react';
import {
  Eye,
  Plus,
  CheckCircle,
  Clock,
  FileText,
  Camera,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Printer,
  RefreshCw,
  Search,
  Activity
} from 'lucide-react';
import { diagnosticsService, authService } from '../../services/api';
import { parseApiError } from '../../utils/errorHandler';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { Input } from '../../components/common/Input';
import { AlertBanner } from '../../components/common/AlertBanner';
import { useBranch } from '../../context/BranchContext';

interface RadiologyRecord {
  id: string;
  order_number: string;
  patient?: any;
  patient_name?: string;
  patient_mrn?: string;
  doctor?: any;
  doctor_name?: string;
  radiologist?: any;
  radiologist_name?: string;
  modality: string;
  study_name: string;
  clinical_indication: string;
  priority: string;
  status: string;
  is_released: boolean;
  scheduled_date?: string;
  scheduled_time?: string;
  suite_room?: string;
  pacs_study_uid?: string;
  technique?: string;
  findings?: string;
  impression?: string;
  key_recommendations?: string;
  created_at: string;
}

export const RadiologyPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const [orders, setOrders] = useState<RadiologyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannerAlert, setBannerAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Modals
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showViewReportModal, setShowViewReportModal] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<RadiologyRecord | null>(null);

  // Form states - Request
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [modality, setModality] = useState('CT_SCAN');
  const [studyName, setStudyName] = useState('');
  const [indication, setIndication] = useState('');
  const [priority, setPriority] = useState('ROUTINE');

  // Form states - Schedule
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('10:00:00');
  const [suiteRoom, setSuiteRoom] = useState('CT Suite 1');

  // Form states - Complete
  const [pacsUid, setPacsUid] = useState('');
  const [radDose, setRadDose] = useState('1.8 mSv');

  // Form states - Report
  const [technique, setTechnique] = useState('Helical volumetric 5mm non-contrast slices');
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [recommendations, setRecommendations] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await diagnosticsService.getRadiologyOrders({ branch_id: currentBranch?.id });
      setOrders(data || []);
    } catch (err) {
      console.error('Failed to load radiology orders:', err);
      setBannerAlert({ type: 'error', message: 'Failed to fetch radiology orders.' });
    } finally {
      setLoading(false);
    }
  };

  const loadDropdowns = async () => {
    try {
      const [patList, docList] = await Promise.all([
        authService.getPatients({ branch_id: currentBranch?.id }),
        authService.getStaffDirectory({ branch_id: currentBranch?.id, role: 'DOCTOR' }),
      ]);
      setPatients(patList || []);
      setDoctors(docList || []);
      if (patList?.length > 0) setSelectedPatientId(patList[0].id);
      if (docList?.length > 0) setSelectedDoctorId(docList[0].id);
    } catch (err) {
      console.error('Failed to load dropdowns:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    loadDropdowns();
  }, [currentBranch?.id]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await diagnosticsService.createRadiologyOrder({
        patient_id: selectedPatientId,
        doctor_id: selectedDoctorId,
        branch_id: currentBranch?.id,
        modality,
        study_name: studyName,
        clinical_indication: indication,
        priority,
      });
      setBannerAlert({ type: 'success', message: 'Imaging study order placed and synchronized with billing.' });
      setShowOrderModal(false);
      setStudyName('');
      setIndication('');
      fetchOrders();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  const handleScheduleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await diagnosticsService.scheduleRadiology(selectedOrder.id, {
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        suite_room: suiteRoom,
      });
      setBannerAlert({ type: 'success', message: `Imaging appointment confirmed for ${scheduledDate} in ${suiteRoom}.` });
      setShowScheduleModal(false);
      fetchOrders();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  const handleCompleteProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await diagnosticsService.completeRadiology(selectedOrder.id, {
        pacs_study_uid: pacsUid || `1.2.840.10008.5.1.4.1.1.${Date.now()}`,
        radiation_dose: radDose,
      });
      setBannerAlert({ type: 'success', message: 'Scan procedure marked completed. Transferred to Radiologist reporting worklist.' });
      setShowCompleteModal(false);
      fetchOrders();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  const handleReportProcedure = async (e: React.FormEvent, action: 'DRAFT' | 'APPROVE') => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await diagnosticsService.reportRadiology(selectedOrder.id, {
        action,
        technique,
        findings,
        impression,
        key_recommendations: recommendations,
      });
      setBannerAlert({
        type: 'success',
        message: action === 'APPROVE' ? 'Radiology diagnostic report verified, digitally signed & released!' : 'Report draft saved.',
      });
      setShowReportModal(false);
      fetchOrders();
    } catch (err: any) {
      setBannerAlert({ type: 'error', message: parseApiError(err).message });
    }
  };

  const columns: Column<RadiologyRecord>[] = [
    {
      key: 'order_number',
      header: 'Study Code',
      render: (r) => (
        <div>
          <span className="font-mono text-cyan-400 font-bold">{r.order_number}</span>
          <span className="block text-[10px] text-slate-500">{new Date(r.created_at).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      key: 'patient',
      header: 'Patient Details',
      render: (r) => (
        <div>
          <div className="font-semibold text-white">
            {r.patient?.user_profile?.full_name || r.patient_name || 'Patient'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            MRN: {r.patient?.medical_record_number || r.patient_mrn}
          </div>
        </div>
      ),
    },
    {
      key: 'study_name',
      header: 'Modality & Study',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-200">{r.study_name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="accent" size="sm">
              {r.modality}
            </Badge>
            <Badge variant={r.priority === 'STAT' ? 'danger' : r.priority === 'URGENT' ? 'warning' : 'neutral'} size="sm">
              {r.priority}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      key: 'clinical_indication',
      header: 'Clinical Indication',
      render: (r) => <span className="text-slate-400 text-xs line-clamp-2">{r.clinical_indication}</span>,
    },
    {
      key: 'status',
      header: 'Study Status',
      render: (r) => (
        <Badge
          variant={
            r.status === 'RELEASED' || r.status === 'REPORTED'
              ? 'success'
              : r.status === 'COMPLETED'
              ? 'info'
              : r.status === 'SCHEDULED'
              ? 'warning'
              : 'neutral'
          }
        >
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          {r.status === 'REQUESTED' && (
            <button
              onClick={() => {
                setSelectedOrder(r);
                setScheduledDate(new Date().toISOString().split('T')[0]);
                setShowScheduleModal(true);
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 transition flex items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5" />
              Schedule
            </button>
          )}

          {r.status === 'SCHEDULED' && (
            <button
              onClick={() => {
                setSelectedOrder(r);
                setPacsUid(`1.2.840.10008.5.1.4.1.1.${Date.now()}`);
                setShowCompleteModal(true);
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 hover:bg-indigo-900 transition flex items-center gap-1"
            >
              <Activity className="w-3.5 h-3.5" />
              Complete Scan
            </button>
          )}

          {(r.status === 'COMPLETED' || r.status === 'IN_PROGRESS') && (
            <button
              onClick={() => {
                setSelectedOrder(r);
                setFindings(r.findings || '');
                setImpression(r.impression || '');
                setRecommendations(r.key_recommendations || '');
                setShowReportModal(true);
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              Report Study
            </button>
          )}

          {(r.status === 'RELEASED' || r.status === 'REPORTED') && (
            <button
              onClick={() => {
                setSelectedOrder(r);
                setShowViewReportModal(true);
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 text-teal-300 hover:bg-slate-700 transition flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              View Report
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Camera className="w-6 h-6 text-cyan-400" />
            Radiology & Diagnostic Medical Imaging (RIS)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Integrated RIS/PACS engine: appointment scheduling, exam completion, radiologist diagnostic reporting, and DICOM 3.0 image linkage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOrderModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 font-semibold text-xs hover:brightness-110 shadow-lg shadow-cyan-500/20 transition self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            Request Imaging Study
          </button>
          <button
            onClick={fetchOrders}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {bannerAlert && (
        <AlertBanner
          type={bannerAlert.type}
          message={bannerAlert.message}
          onClose={() => setBannerAlert(null)}
        />
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Imaging Requests"
          value={orders.length.toString()}
          icon={Camera}
          accent="cyan"
        />
        <StatCard
          title="Awaiting Scheduling"
          value={orders.filter((r) => r.status === 'REQUESTED').length.toString()}
          icon={Clock}
          accent="amber"
        />
        <StatCard
          title="Pending Radiologist Report"
          value={orders.filter((r) => r.status === 'COMPLETED').length.toString()}
          icon={Activity}
          accent="indigo"
        />
        <StatCard
          title="Diagnostic Reports Finalized"
          value={orders.filter((r) => r.status === 'RELEASED' || r.status === 'REPORTED').length.toString()}
          icon={CheckCircle}
          accent="emerald"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <DataTable
          data={orders}
          columns={columns}
          loading={loading}
          searchable={true}
          searchPlaceholder="Search imaging orders by study code, patient, modality..."
          pageSize={10}
        />
      </div>

      {/* MODAL 1: Request Imaging Study */}
      {showOrderModal && (
        <Modal
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          title="Requisition Diagnostic Imaging Study"
          size="md"
        >
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <Select
              label="Select Patient"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              options={patients.map((p) => ({
                value: p.id,
                label: `${p.user_profile?.full_name || p.full_name} (${p.medical_record_number || p.mrn})`,
              }))}
              required
            />

            <Select
              label="Referring Physician"
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              options={doctors.map((d) => ({
                value: d.id,
                label: `Dr. ${d.user_profile?.first_name || ''} ${d.user_profile?.last_name || 'Staff'} (${d.specialization || d.designation || 'Consultant'})`,
              }))}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Imaging Modality"
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                options={[
                  { value: 'X_RAY', label: 'Digital X-Ray' },
                  { value: 'CT_SCAN', label: 'Computed Tomography (CT Scan)' },
                  { value: 'MRI', label: 'Magnetic Resonance Imaging (MRI 3.0T)' },
                  { value: 'ULTRASOUND', label: 'Ultrasound Sonography (USG Doppler)' },
                  { value: 'MAMMOGRAPHY', label: 'Digital Mammography' },
                  { value: 'PET_CT', label: 'Positron Emission Tomography (PET-CT)' },
                ]}
                required
              />
              <Select
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                options={[
                  { value: 'ROUTINE', label: 'Routine (Scheduled)' },
                  { value: 'URGENT', label: 'Urgent (Within 4 Hours)' },
                  { value: 'STAT', label: 'STAT (Immediate Emergency / Stroke / Trauma)' },
                ]}
                required
              />
            </div>

            <Input
              label="Investigation Study Protocol"
              value={studyName}
              onChange={(e) => setStudyName(e.target.value)}
              placeholder="e.g. NCCT Brain Plain, Chest X-Ray PA View, USG Whole Abdomen"
              required
            />

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Clinical Indication & Relevant History
              </label>
              <textarea
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                rows={3}
                placeholder="e.g. Acute onset right-sided hemiparesis, rule out intracranial hemorrhage..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition"
              >
                Place Imaging Requisition
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: Schedule Appointment */}
      {showScheduleModal && (
        <Modal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          title={`Schedule Imaging Procedure — ${selectedOrder?.order_number}`}
        >
          <form onSubmit={handleScheduleOrder} className="space-y-4">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1 text-slate-300">
              <div>
                <span className="text-slate-500">Study:</span>{' '}
                <strong className="text-cyan-300">{selectedOrder?.study_name}</strong> ({selectedOrder?.modality})
              </div>
              <div>
                <span className="text-slate-500">Patient:</span> {selectedOrder?.patient?.user_profile?.full_name}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Date:</label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Time:</label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Suite / Scanning Room:</label>
              <Select
                value={suiteRoom}
                onChange={(e) => setSuiteRoom(e.target.value)}
                options={[
                  { value: 'CT Suite 1 (Siemens Somatom 128)', label: 'CT Suite 1 (Siemens Somatom 128)' },
                  { value: 'MRI Suite 1 (GE Signa 3.0T)', label: 'MRI Suite 1 (GE Signa 3.0T)' },
                  { value: 'Ultrasound Suite 2 (Philips EPIQ)', label: 'Ultrasound Suite 2 (Philips EPIQ)' },
                  { value: 'Digital X-Ray Room 1', label: 'Digital X-Ray Room 1' },
                ]}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
              >
                Confirm Appointment Schedule
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: Complete Scan */}
      {showCompleteModal && (
        <Modal
          isOpen={showCompleteModal}
          onClose={() => setShowCompleteModal(false)}
          title={`Scan Completed & PACS Ingestion — ${selectedOrder?.order_number}`}
        >
          <form onSubmit={handleCompleteProcedure} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                PACS Study Instance UID (DICOM Tag 0020,000D):
              </label>
              <Input
                value={pacsUid}
                onChange={(e) => setPacsUid(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Radiation Exposure Dose Index (DLP / CTDIvol):
              </label>
              <Input
                value={radDose}
                onChange={(e) => setRadDose(e.target.value)}
                placeholder="e.g. 240 mGy.cm (CTDIvol: 14.2 mGy)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                className="px-3 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
              >
                Mark Scan Done & Route to Radiologist
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: Radiologist Reporting Modal */}
      {showReportModal && (
        <Modal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          title={`Radiologist Diagnostic Report — ${selectedOrder?.study_name}`}
          size="lg"
        >
          <form onSubmit={(e) => handleReportProcedure(e, 'APPROVE')} className="space-y-4">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1 text-slate-300">
              <div>
                <span className="text-slate-500">Patient:</span>{' '}
                <strong className="text-slate-200">{selectedOrder?.patient?.user_profile?.full_name}</strong> &bull; MRN: {selectedOrder?.patient?.medical_record_number}
              </div>
              <div>
                <span className="text-slate-500">PACS Study UID:</span>{' '}
                <span className="font-mono text-cyan-400">{selectedOrder?.pacs_study_uid || '1.2.840.10008.5.1.4.1.1.20261022'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Imaging Technique:</label>
              <Input
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Radiological Findings:</label>
              <textarea
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                rows={4}
                placeholder="Parenchymal density, contours, osseous structures, ventricular system..."
                required
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Diagnostic Impression:</label>
              <textarea
                value={impression}
                onChange={(e) => setImpression(e.target.value)}
                rows={2}
                placeholder="Final definitive radiological conclusion..."
                required
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Key Recommendations:</label>
              <Input
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="Clinical correlation, follow-up imaging in 6 weeks..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={(e) => handleReportProcedure(e, 'DRAFT')}
                className="px-3.5 py-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded text-xs"
              >
                Save Draft
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-semibold"
              >
                Verify & Digitally Release Report
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 5: View Verified Radiology Report */}
      {showViewReportModal && selectedOrder && (
        <Modal
          isOpen={showViewReportModal}
          onClose={() => setShowViewReportModal(false)}
          title={`Diagnostic Imaging Report — ${selectedOrder.order_number}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl space-y-4 text-xs font-sans">
              <div className="border-b border-slate-800 pb-3 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-bold text-slate-100">DEPARTMENT OF RADIODIAGNOSIS & IMAGING</h2>
                  <p className="text-teal-400 font-semibold text-[10px] uppercase mt-0.5">NABH & AERB Certified Diagnostic Facility</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-cyan-400">{selectedOrder.order_number}</span>
                  <span className="block text-[10px] text-emerald-400 font-bold uppercase">VERIFIED & RELEASED</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                <div>
                  <span className="text-slate-500">Patient:</span>{' '}
                  <strong className="text-slate-200">{selectedOrder.patient?.user_profile?.full_name || selectedOrder.patient_name}</strong>
                </div>
                <div>
                  <span className="text-slate-500">MRN:</span>{' '}
                  <span className="font-mono text-cyan-300">{selectedOrder.patient?.medical_record_number || selectedOrder.patient_mrn}</span>
                </div>
                <div>
                  <span className="text-slate-500">Modality:</span>{' '}
                  <span className="text-slate-200">{selectedOrder.modality}</span>
                </div>
                <div>
                  <span className="text-slate-500">Study:</span>{' '}
                  <span className="text-slate-200">{selectedOrder.study_name}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="text-slate-400 uppercase font-bold text-[11px]">Technique</h4>
                  <p className="text-slate-300 mt-0.5">{selectedOrder.technique || 'Standard axial helical non-contrast CT sections'}</p>
                </div>

                <div>
                  <h4 className="text-slate-400 uppercase font-bold text-[11px]">Radiological Findings</h4>
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed mt-0.5">
                    {selectedOrder.findings || 'No acute focal intracranial abnormality. Ventricular contours and basal cisterns preserved.'}
                  </p>
                </div>

                <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg">
                  <h4 className="text-cyan-400 uppercase font-bold text-[11px]">Impression</h4>
                  <p className="text-slate-100 font-semibold mt-0.5">
                    {selectedOrder.impression || 'Normal non-contrast CT examination with no acute intracranial pathology.'}
                  </p>
                </div>

                {selectedOrder.key_recommendations && (
                  <div>
                    <h4 className="text-slate-400 uppercase font-bold text-[11px]">Recommendations</h4>
                    <p className="text-slate-300 mt-0.5">{selectedOrder.key_recommendations}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <div>PACS Reference: {selectedOrder.pacs_study_uid || '1.2.840.10008.5.1.4.1.1.20261022'}</div>
                <div>Verified by: Dr. {selectedOrder.radiologist?.user_profile?.last_name || 'Senior Consultant Radiologist'}</div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4" />
                Print Imaging Report
              </button>
              <button
                onClick={() => setShowViewReportModal(false)}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
