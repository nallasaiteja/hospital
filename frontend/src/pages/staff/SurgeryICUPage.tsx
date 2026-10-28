import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Activity,
  HeartPulse,
  Building,
  RefreshCw,
  Truck,
  Droplet,
  Sparkles,
  Trash2,
  Send,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  MapPin,
  Calendar
} from 'lucide-react';
import { operationsHrService, authService } from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

export const SurgeryICUPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'OT' | 'ICU' | 'AMBULANCE' | 'BLOOD_BANK' | 'HOUSEKEEPING' | 'WASTE'>('DASHBOARD');
  
  // Data States
  const [dashboard, setDashboard] = useState<any>(null);
  const [otSuites, setOTSuites] = useState<any[]>([]);
  const [otBookings, setOTBookings] = useState<any[]>([]);
  const [icuObservations, setICUObservations] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [bloodStock, setBloodStock] = useState<any[]>([]);
  const [housekeeping, setHousekeeping] = useState<any[]>([]);
  const [wasteRecords, setWasteRecords] = useState<any[]>([]);

  // Patients & Surgeons for Modals
  const [patients, setPatients] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isOTModalOpen, setIsOTModalOpen] = useState(false);
  const [isICUModalOpen, setIsICUModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isIssueBloodModalOpen, setIsIssueBloodModalOpen] = useState(false);
  const [selectedBloodBag, setSelectedBloodBag] = useState<any>(null);
  const [isHandoverWasteModalOpen, setIsHandoverWasteModalOpen] = useState(false);
  const [selectedWasteRecord, setSelectedWasteRecord] = useState<any>(null);

  // Forms
  const [otForm, setOTForm] = useState({
    theatre: '',
    patient: '',
    lead_surgeon: '',
    procedure_name: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    start_time: '09:00:00',
    end_time: '12:00:00',
    anesthesia_type: 'GENERAL_ANESTHESIA',
    clinical_notes: ''
  });

  const [icuForm, setICUForm] = useState({
    patient_id: '',
    bed_identifier: 'ICU-Bed-01',
    bp_systolic: 120,
    bp_diastolic: 80,
    heart_rate: 75,
    respiratory_rate: 16,
    spo2_percentage: '98.5',
    temperature_celsius: '37.0',
    gcs_score: 15,
    ventilator_mode: 'CPAP',
    fio2_percentage: '35.0',
    urine_output_ml: '50.0',
    escalation_status: 'STABLE',
    clinical_notes: 'Patient stable on room air / minimal support.'
  });

  const [dispatchForm, setDispatchForm] = useState({
    ambulance: '',
    pickup_location: 'Central Trauma Location',
    destination: 'Hospital Emergency Resuscitation Bay',
    patient_name_unregistered: '',
    emergency_nature: 'EMERGENCY_TRANSFER'
  });

  const [bloodIssueForm, setBloodIssueForm] = useState({
    department_name: 'Emergency OT Suite 1'
  });

  const [wasteHandoverForm, setWasteHandoverForm] = useState({
    agency_name: 'State Bio-Clean Eco Solutions Pvt Ltd',
    vehicle_number: 'KA-04-TR-9988',
    receipt_number: `CBMWTF-REC-${Date.now().toString().slice(-4)}`
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dash, suites, bookings, icu, fleet, disp, blood, hk, waste, pts, staff] = await Promise.all([
        operationsHrService.getOperationsDashboard({ branch_id: currentBranch?.id }),
        operationsHrService.getOTSuites(),
        operationsHrService.getOTBookings({ branch_id: currentBranch?.id }),
        operationsHrService.getICUObservations(),
        operationsHrService.getAmbulances(),
        operationsHrService.getAmbulanceDispatches(),
        operationsHrService.getBloodStock(),
        operationsHrService.getHousekeepingTasks(),
        operationsHrService.getBiomedicalWasteRecords(),
        authService.getPatients(),
        operationsHrService.getStaffMembers({ branch_id: currentBranch?.id })
      ]);

      setDashboard(dash);
      setOTSuites(suites?.results || suites || []);
      setOTBookings(bookings?.results || bookings || []);
      setICUObservations(icu?.results || icu || []);
      setAmbulances(fleet?.results || fleet || []);
      setDispatches(disp?.results || disp || []);
      setBloodStock(blood?.results || blood || []);
      setHousekeeping(hk?.results || hk || []);
      setWasteRecords(waste?.results || waste || []);
      setPatients(Array.isArray(pts) ? pts : (pts as any)?.results || []);
      setStaffList(staff?.results || staff || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranch]);

  // Book OT
  const handleOTSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await operationsHrService.bookOperationTheatre(otForm);
      setSuccessMsg(`Operating theatre scheduled without conflicts for ${otForm.procedure_name}.`);
      setIsOTModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Record ICU Vitals
  const handleICUSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await operationsHrService.recordICUObservation(icuForm);
      setSuccessMsg('Continuous ICU observations and vitals recorded.');
      setIsICUModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Dispatch Ambulance
  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await operationsHrService.dispatchAmbulance(dispatchForm);
      setSuccessMsg('Emergency ambulance dispatched! Vehicle status set to DISPATCHED.');
      setIsDispatchModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Complete Ambulance Trip
  const handleCompleteTrip = async (id: string) => {
    try {
      setError(null);
      await operationsHrService.completeAmbulanceTrip(id, {
        distance_km: '18.5',
        fuel_consumed_liters: '3.2',
        notes: 'Trip completed safely. Patient delivered to Emergency Casualty.'
      });
      setSuccessMsg('Ambulance trip completed. Odometer updated and vehicle restored to AVAILABLE.');
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Issue Blood Unit
  const handleIssueBloodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBloodBag) return;
    try {
      setError(null);
      await operationsHrService.issueBloodUnit(selectedBloodBag.id, bloodIssueForm);
      setSuccessMsg(`Blood unit ${selectedBloodBag.bag_barcode} (${selectedBloodBag.blood_group}) successfully issued.`);
      setIsIssueBloodModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Housekeeping Task Workflow
  const handleHousekeepingAction = async (id: string, action: 'start' | 'complete' | 'inspect') => {
    try {
      setError(null);
      if (action === 'start') {
        await operationsHrService.startCleaning(id);
        setSuccessMsg('Cleaning task started.');
      } else if (action === 'complete') {
        await operationsHrService.completeCleaning(id);
        setSuccessMsg('Cleaning completed by staff.');
      } else {
        await operationsHrService.inspectCleaningTask(id);
        setSuccessMsg('Housekeeping area inspected and certified clean.');
      }
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Handover Biomedical Waste
  const handleWasteHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWasteRecord) return;
    try {
      setError(null);
      await operationsHrService.handoverWasteManifest(selectedWasteRecord.id, wasteHandoverForm);
      setSuccessMsg(`Biomedical waste manifest ${selectedWasteRecord.manifest_code} handed over to authorized CBMWTF operator.`);
      setIsHandoverWasteModalOpen(false);
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
            <Activity className="w-7 h-7 text-indigo-400" />
            Hospital Operations: Surgery, ICU, Fleet & Safety
          </h1>
          <p className="text-sm text-slate-400">
            Section 20: Operation Theatre scheduling with conflict checks, ICU hemodynamic vitals, ambulance dispatch, blood bank, housekeeping, and biomedical waste manifests.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh Operations"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOTModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Scissors className="w-4 h-4" /> Book OT Surgery
          </button>
          <button
            onClick={() => setIsICUModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <HeartPulse className="w-4 h-4" /> Record ICU Vitals
          </button>
          <button
            onClick={() => setIsDispatchModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Truck className="w-4 h-4" /> Emergency Dispatch
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6 overflow-x-auto">
        {[
          { key: 'DASHBOARD', label: 'Operations Dashboard', icon: TrendingUp },
          { key: 'OT', label: 'Operation Theatres', icon: Scissors },
          { key: 'ICU', label: 'ICU Continuous Monitoring', icon: HeartPulse },
          { key: 'AMBULANCE', label: 'Ambulance Fleet & Dispatch', icon: Truck },
          { key: 'BLOOD_BANK', label: 'Blood Bank Inventory', icon: Droplet },
          { key: 'HOUSEKEEPING', label: 'Housekeeping & Sanitization', icon: Sparkles },
          { key: 'WASTE', label: 'Biomedical Waste Tracking', icon: Trash2 }
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

      {/* 1. OPERATIONS DASHBOARD TAB */}
      {activeTab === 'DASHBOARD' && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">Scheduled Surgeries</span>
                <Scissors className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="text-3xl font-bold text-slate-100">{otBookings.length}</div>
              <p className="text-xs text-slate-500 mt-1">Across cleanroom surgical suites</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">Ambulance Fleet</span>
                <Truck className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold text-emerald-400">
                {dashboard.ambulances?.available || 0} / {dashboard.ambulances?.total || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">Available at base ready for emergency dispatch</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">Blood Bank Units</span>
                <Droplet className="w-5 h-5 text-rose-400" />
              </div>
              <div className="text-3xl font-bold text-rose-400">{dashboard.blood_bank?.total_available_units || 0}</div>
              <p className="text-xs text-slate-500 mt-1">Cross-matched and tested units</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">Housekeeping Tasks</span>
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-3xl font-bold text-amber-400">{dashboard.housekeeping?.pending_tasks || 0}</div>
              <p className="text-xs text-slate-500 mt-1">Terminal & routine ward cleanings</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-sm font-medium">Waste in Storage</span>
                <Trash2 className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-yellow-400 font-mono">
                {dashboard.biomedical_waste?.pending_collection_kg || '0.00'} kg
              </div>
              <p className="text-xs text-slate-500 mt-1">Awaiting CBMWTF handover manifest</p>
            </div>
          </div>
        </div>
      )}

      {/* 2. OPERATION THEATRE TAB */}
      {activeTab === 'OT' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {otSuites.map((suite) => (
              <div key={suite.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-slate-100">{suite.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">Room: {suite.room_number}</p>
                  </div>
                  <Badge variant={suite.is_operational ? 'success' : 'danger'}>
                    {suite.is_operational ? 'OPERATIONAL' : 'OFFLINE'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-2">{suite.equipment_summary || 'Standard Major OT Equipment'}</p>
              </div>
            ))}
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <h3 className="p-4 bg-slate-800/40 text-sm font-semibold text-slate-200 border-b border-slate-800">
              Scheduled Surgical Bookings (Conflict-Free Roster)
            </h3>
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-medium">
                <tr>
                  <th className="p-3">Booking Code</th>
                  <th className="p-3">Theatre Suite</th>
                  <th className="p-3">Procedure Name</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Lead Surgeon</th>
                  <th className="p-3">Time Window</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {otBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-mono font-semibold text-indigo-400">{b.booking_code}</td>
                    <td className="p-3 text-slate-200">{b.theatre_name || 'OT Suite 1'}</td>
                    <td className="p-3 font-medium text-slate-100">{b.procedure_name}</td>
                    <td className="p-3 text-slate-300">{b.patient_name || 'Patient'}</td>
                    <td className="p-3 text-indigo-300">{b.lead_surgeon_name}</td>
                    <td className="p-3 font-mono text-xs text-slate-400">
                      {b.scheduled_date} ({b.start_time} - {b.end_time})
                    </td>
                    <td className="p-3">
                      <Badge variant={b.status === 'COMPLETED' ? 'success' : 'warning'}>{b.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. ICU CONTINUOUS MONITORING TAB */}
      {activeTab === 'ICU' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-200">ICU Continuous Vital Signs & Escalation Status</h2>
            <span className="text-xs text-slate-400">{icuObservations.length} observations logged</span>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-medium">
                <tr>
                  <th className="p-3">Bed</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Hemodynamics (BP / HR / RR)</th>
                  <th className="p-3">SpO2 / Temp</th>
                  <th className="p-3">Ventilator / GCS</th>
                  <th className="p-3">Escalation Status</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {icuObservations.map((obs) => (
                  <tr key={obs.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-indigo-400">{obs.bed_identifier}</td>
                    <td className="p-3 font-medium text-slate-100">{obs.patient_name || 'Patient'}</td>
                    <td className="p-3 font-mono text-xs">
                      {obs.bp_systolic}/{obs.bp_diastolic} mmHg | {obs.heart_rate} bpm | {obs.respiratory_rate} /min
                    </td>
                    <td className="p-3 font-mono text-xs text-emerald-400">
                      {obs.spo2_percentage}% | {obs.temperature_celsius}&deg;C
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-300">
                      {obs.ventilator_mode || 'Room Air'} | GCS {obs.gcs_score || 15}/15
                    </td>
                    <td className="p-3">
                      <Badge variant={obs.escalation_status === 'CRITICAL_ESCALATION' ? 'danger' : (obs.escalation_status === 'WATCH' ? 'warning' : 'success')}>
                        {obs.escalation_status}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-slate-400 max-w-xs truncate">{obs.clinical_notes || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. AMBULANCE FLEET TAB */}
      {activeTab === 'AMBULANCE' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ambulances.map((amb) => (
              <div key={amb.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-slate-100 font-mono">{amb.registration_number}</div>
                  <div className="text-xs text-slate-400">{amb.vehicle_type}</div>
                  <div className="text-xs text-slate-500 mt-1">Odometer: {amb.odo_reading_km} km | Fuel: {amb.fuel_level_pct}%</div>
                </div>
                <Badge variant={amb.status === 'AVAILABLE' ? 'success' : 'danger'}>{amb.status}</Badge>
              </div>
            ))}
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <h3 className="p-4 bg-slate-800/40 text-sm font-semibold text-slate-200 border-b border-slate-800">
              Ambulance Dispatch & Emergency Trip Tracking
            </h3>
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-medium">
                <tr>
                  <th className="p-3">Dispatch No.</th>
                  <th className="p-3">Ambulance</th>
                  <th className="p-3">Pickup Location</th>
                  <th className="p-3">Destination</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {dispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-mono text-indigo-400 font-semibold">{d.dispatch_number}</td>
                    <td className="p-3 font-mono">{d.registration_number}</td>
                    <td className="p-3 text-slate-300">{d.pickup_location}</td>
                    <td className="p-3 text-slate-400">{d.destination}</td>
                    <td className="p-3">
                      <Badge variant={d.trip_status === 'COMPLETED' ? 'success' : 'warning'}>{d.trip_status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {d.trip_status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleCompleteTrip(d.id)}
                          className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                        >
                          Complete Trip
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. BLOOD BANK TAB */}
      {activeTab === 'BLOOD_BANK' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-200">Blood Bank Inventory & Tested Component Bags</h2>
            <span className="text-xs text-slate-400">{bloodStock.length} total bags catalogued</span>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-medium">
                <tr>
                  <th className="p-3">Barcode</th>
                  <th className="p-3">Blood Group</th>
                  <th className="p-3">Component Type</th>
                  <th className="p-3">Volume</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3">Screening</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Issue to OT/Ward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {bloodStock.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-mono font-semibold text-indigo-400">{b.bag_barcode}</td>
                    <td className="p-3 font-bold text-rose-400">{b.blood_group}</td>
                    <td className="p-3 text-slate-300">{b.component_type}</td>
                    <td className="p-3 font-mono">{b.volume_ml} ml</td>
                    <td className="p-3 font-mono text-xs">{b.expiry_date}</td>
                    <td className="p-3">
                      <Badge variant={b.screening_status === 'PASSED' ? 'success' : 'danger'}>
                        {b.screening_status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={b.status === 'AVAILABLE' ? 'success' : (b.status === 'EXPIRED' ? 'danger' : 'neutral')}>
                        {b.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {b.status === 'AVAILABLE' && (
                        <button
                          onClick={() => {
                            setSelectedBloodBag(b);
                            setIsIssueBloodModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded transition-colors"
                        >
                          Issue Unit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. HOUSEKEEPING TAB */}
      {activeTab === 'HOUSEKEEPING' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-200">Hospital Sanitization & Ward Cleaning Schedules</h2>
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-medium">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Room / Area</th>
                  <th className="p-3">Task Type</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {housekeeping.map((hk) => (
                  <tr key={hk.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-mono text-indigo-400">{hk.task_code}</td>
                    <td className="p-3 font-medium text-slate-200">{hk.room_area} ({hk.floor})</td>
                    <td className="p-3 text-slate-300">{hk.task_type}</td>
                    <td className="p-3">
                      <Badge variant={hk.priority === 'CRITICAL' ? 'danger' : 'warning'}>{hk.priority}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={hk.status === 'INSPECTED' ? 'success' : (hk.status === 'COMPLETED' ? 'info' : 'neutral')}>
                        {hk.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {hk.status === 'PENDING' && (
                        <button
                          onClick={() => handleHousekeepingAction(hk.id, 'start')}
                          className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded"
                        >
                          Start Cleaning
                        </button>
                      )}
                      {hk.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleHousekeepingAction(hk.id, 'complete')}
                          className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded"
                        >
                          Complete
                        </button>
                      )}
                      {hk.status === 'COMPLETED' && (
                        <button
                          onClick={() => handleHousekeepingAction(hk.id, 'inspect')}
                          className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium"
                        >
                          Supervisor Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. BIOMEDICAL WASTE TAB */}
      {activeTab === 'WASTE' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-200">Biomedical Waste Segregation & Manifest Tracking</h2>
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-medium">
                <tr>
                  <th className="p-3">Manifest Code</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Weight</th>
                  <th className="p-3">Storage Area</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Handover to CBMWTF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {wasteRecords.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-mono font-semibold text-yellow-400">{w.manifest_code}</td>
                    <td className="p-3 text-slate-300">{w.department_name}</td>
                    <td className="p-3">
                      <Badge variant="neutral">{w.waste_category}</Badge>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-100">{w.weight_kg} kg</td>
                    <td className="p-3 text-xs text-slate-400">{w.storage_area}</td>
                    <td className="p-3">
                      <Badge variant={w.status === 'HANDED_OVER' ? 'success' : 'warning'}>{w.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {w.status !== 'HANDED_OVER' && (
                        <button
                          onClick={() => {
                            setSelectedWasteRecord(w);
                            setIsHandoverWasteModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 text-white rounded transition-colors"
                        >
                          Handover Manifest
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Book OT */}
      <Modal isOpen={isOTModalOpen} onClose={() => setIsOTModalOpen(false)} title="Schedule Operation Theatre Procedure">
        <form onSubmit={handleOTSubmit} className="space-y-4">
          <Input
            label="Surgical Procedure Name"
            value={otForm.procedure_name}
            onChange={(e) => setOTForm({ ...otForm, procedure_name: e.target.value })}
            placeholder="e.g. Laparoscopic Cholecystectomy"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Operating Theatre Suite"
              value={otForm.theatre}
              onChange={(e) => setOTForm({ ...otForm, theatre: e.target.value })}
              options={otSuites.map((s) => ({ label: `${s.name} (${s.room_number})`, value: s.id }))}
              required
            />
            <Select
              label="Lead Surgeon"
              value={otForm.lead_surgeon}
              onChange={(e) => setOTForm({ ...otForm, lead_surgeon: e.target.value })}
              options={staffList.map((st) => ({ label: `${st.full_name} (${st.designation})`, value: st.id }))}
              required
            />
          </div>
          <Select
            label="Patient"
            value={otForm.patient}
            onChange={(e) => setOTForm({ ...otForm, patient: e.target.value })}
            options={patients.map((p) => ({ label: `${p.full_name} (${p.medical_record_number || 'MRN'})`, value: p.id }))}
            required
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Scheduled Date"
              type="date"
              value={otForm.scheduled_date}
              onChange={(e) => setOTForm({ ...otForm, scheduled_date: e.target.value })}
              required
            />
            <Input
              label="Start Time"
              type="time"
              value={otForm.start_time}
              onChange={(e) => setOTForm({ ...otForm, start_time: e.target.value })}
              required
            />
            <Input
              label="End Time"
              type="time"
              value={otForm.end_time}
              onChange={(e) => setOTForm({ ...otForm, end_time: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsOTModalOpen(false)}
              className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
            >
              Confirm Conflict-Free Booking
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Record ICU Vitals */}
      <Modal isOpen={isICUModalOpen} onClose={() => setIsICUModalOpen(false)} title="Record Continuous ICU Observations">
        <form onSubmit={handleICUSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="ICU Patient"
              value={icuForm.patient_id}
              onChange={(e) => setICUForm({ ...icuForm, patient_id: e.target.value })}
              options={patients.map((p) => ({ label: `${p.full_name} (${p.medical_record_number || 'MRN'})`, value: p.id }))}
              required
            />
            <Input
              label="Bed Identifier"
              value={icuForm.bed_identifier}
              onChange={(e) => setICUForm({ ...icuForm, bed_identifier: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="BP Systolic (mmHg)"
              type="number"
              value={icuForm.bp_systolic}
              onChange={(e) => setICUForm({ ...icuForm, bp_systolic: parseInt(e.target.value) || 120 })}
              required
            />
            <Input
              label="BP Diastolic (mmHg)"
              type="number"
              value={icuForm.bp_diastolic}
              onChange={(e) => setICUForm({ ...icuForm, bp_diastolic: parseInt(e.target.value) || 80 })}
              required
            />
            <Input
              label="Heart Rate (BPM)"
              type="number"
              value={icuForm.heart_rate}
              onChange={(e) => setICUForm({ ...icuForm, heart_rate: parseInt(e.target.value) || 75 })}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="SpO2 (%)"
              value={icuForm.spo2_percentage}
              onChange={(e) => setICUForm({ ...icuForm, spo2_percentage: e.target.value })}
              required
            />
            <Input
              label="GCS Score (3-15)"
              type="number"
              min={3}
              max={15}
              value={icuForm.gcs_score}
              onChange={(e) => setICUForm({ ...icuForm, gcs_score: parseInt(e.target.value) || 15 })}
              required
            />
            <Select
              label="Escalation Status"
              value={icuForm.escalation_status}
              onChange={(e) => setICUForm({ ...icuForm, escalation_status: e.target.value })}
              options={[
                { label: 'Stable', value: 'STABLE' },
                { label: 'Watch / High Risk', value: 'WATCH' },
                { label: 'Critical Escalation', value: 'CRITICAL_ESCALATION' }
              ]}
            />
          </div>
          <Input
            label="Clinical Notes"
            value={icuForm.clinical_notes}
            onChange={(e) => setICUForm({ ...icuForm, clinical_notes: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsICUModalOpen(false)}
              className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
            >
              Save ICU Observations
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Dispatch Ambulance */}
      <Modal isOpen={isDispatchModalOpen} onClose={() => setIsDispatchModalOpen(false)} title="Dispatch Emergency Ambulance">
        <form onSubmit={handleDispatchSubmit} className="space-y-4">
          <Select
            label="Available Ambulance Vehicle"
            value={dispatchForm.ambulance}
            onChange={(e) => setDispatchForm({ ...dispatchForm, ambulance: e.target.value })}
            options={ambulances
              .filter((a) => a.status === 'AVAILABLE')
              .map((a) => ({ label: `${a.registration_number} (${a.vehicle_type})`, value: a.id }))}
            required
          />
          <Input
            label="Pickup Location"
            value={dispatchForm.pickup_location}
            onChange={(e) => setDispatchForm({ ...dispatchForm, pickup_location: e.target.value })}
            required
          />
          <Input
            label="Destination"
            value={dispatchForm.destination}
            onChange={(e) => setDispatchForm({ ...dispatchForm, destination: e.target.value })}
            required
          />
          <Input
            label="Caller / Patient Name"
            value={dispatchForm.patient_name_unregistered}
            onChange={(e) => setDispatchForm({ ...dispatchForm, patient_name_unregistered: e.target.value })}
            placeholder="e.g. Emergency Caller on 108 line"
          />
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsDispatchModalOpen(false)}
              className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium"
            >
              Confirm Emergency Dispatch
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Issue Blood */}
      {selectedBloodBag && (
        <Modal isOpen={isIssueBloodModalOpen} onClose={() => setIsIssueBloodModalOpen(false)} title="Issue Blood Bank Unit">
          <form onSubmit={handleIssueBloodSubmit} className="space-y-4">
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="font-bold text-rose-400 font-mono text-base">{selectedBloodBag.blood_group} - {selectedBloodBag.component_type}</div>
              <div className="text-xs text-slate-400">Barcode: {selectedBloodBag.bag_barcode} | Expiry: {selectedBloodBag.expiry_date}</div>
              <div className="text-xs text-emerald-400 mt-1">Screening Status: {selectedBloodBag.screening_status}</div>
            </div>
            <Input
              label="Receiving Department / OT"
              value={bloodIssueForm.department_name}
              onChange={(e) => setBloodIssueForm({ ...bloodIssueForm, department_name: e.target.value })}
              required
            />
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsIssueBloodModalOpen(false)}
                className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm font-medium"
              >
                Issue Blood Unit
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Handover Waste Manifest */}
      {selectedWasteRecord && (
        <Modal isOpen={isHandoverWasteModalOpen} onClose={() => setIsHandoverWasteModalOpen(false)} title="Handover Biomedical Waste Manifest">
          <form onSubmit={handleWasteHandoverSubmit} className="space-y-4">
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="font-bold text-yellow-400 font-mono">{selectedWasteRecord.manifest_code} ({selectedWasteRecord.waste_category})</div>
              <div className="text-xs text-slate-400">Weight: {selectedWasteRecord.weight_kg} kg | From: {selectedWasteRecord.department_name}</div>
            </div>
            <Input
              label="Authorized Disposal Agency"
              value={wasteHandoverForm.agency_name}
              onChange={(e) => setWasteHandoverForm({ ...wasteHandoverForm, agency_name: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Vehicle Number"
                value={wasteHandoverForm.vehicle_number}
                onChange={(e) => setWasteHandoverForm({ ...wasteHandoverForm, vehicle_number: e.target.value })}
                required
              />
              <Input
                label="Agency Receipt Number"
                value={wasteHandoverForm.receipt_number}
                onChange={(e) => setWasteHandoverForm({ ...wasteHandoverForm, receipt_number: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsHandoverWasteModalOpen(false)}
                className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium"
              >
                Certify CBMWTF Handover
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default SurgeryICUPage;
