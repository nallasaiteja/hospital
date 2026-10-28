import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building,
  Tag,
  ShieldCheck,
  Clock,
  Plus,
  Play,
  TrendingDown,
  DollarSign,
  Activity,
  Layers,
  FileText
} from 'lucide-react';
import { operationsHrService } from '../../services/api';
import { useBranch } from '../../context/BranchContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import { parseApiError } from '../../utils/errorHandler';

export const AssetsPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'DEPRECIATION' | 'MAINTENANCE' | 'SCHEDULES'>('REGISTER');
  
  // Data States
  const [dashboard, setDashboard] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<any[]>([]);
  const [depSchedules, setDepSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modals
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [isDepreciateModalOpen, setIsDepreciateModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [isCertifyModalOpen, setIsCertifyModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // Form States
  const [assetForm, setAssetForm] = useState({
    name: '',
    asset_code: '',
    category: 'MEDICAL_EQUIPMENT',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_cost: '1000000.00',
    residual_value: '50000.00',
    useful_life_years: 7,
    physical_location: 'Radiology / ICU Ground Floor',
    supplier_name: 'GE Healthcare Ltd',
    serial_number: 'SN-2026-001'
  });

  const [depreciationForm, setDepreciationForm] = useState({
    fiscal_year: '2026-2027',
    period_name: 'FY2026-Annual'
  });

  const [certifyForm, setCertifyForm] = useState({
    action_taken: 'Preventive maintenance performed and calibrated.',
    findings: 'Operating within manufacturer clinical tolerances.',
    total_cost: '2500.00',
    clinical_safety_certified: true,
    certification_notes: 'Certified safe for patient diagnostic and therapeutic use.'
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashData, assetData, taskData, schedData] = await Promise.all([
        operationsHrService.getAssetDashboard({ branch_id: currentBranch?.id }),
        operationsHrService.getFixedAssets({ branch_id: currentBranch?.id }),
        operationsHrService.getMaintenanceTasks({ branch_id: currentBranch?.id }),
        operationsHrService.getDepreciationSchedules()
      ]);
      setDashboard(dashData);
      setAssets(assetData?.results || assetData || []);
      setMaintenanceTasks(taskData?.results || taskData || []);
      setDepSchedules(schedData?.results || schedData || []);
    } catch (err: any) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranch]);

  // Create Fixed Asset
  const handleAddAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await operationsHrService.createFixedAsset({
        ...assetForm,
        current_carrying_value: assetForm.purchase_cost,
        branch: currentBranch?.id
      });
      setSuccessMsg(`Asset ${assetForm.name} registered into Fixed Asset Register.`);
      setIsAddAssetModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Run Depreciation
  const handleDepreciateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      setError(null);
      const result = await operationsHrService.calculateDepreciation(selectedAsset.id, depreciationForm);
      setSuccessMsg(`Straight-line depreciation for ${selectedAsset.name} computed and posted to Section 17 GL (Debit 5060, Credit 1520). New Carrying Value: ₹${parseFloat(result.carrying_value_after || '0').toLocaleString()}`);
      setIsDepreciateModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  // Complete Maintenance & Certify
  const handleCertifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    try {
      setError(null);
      await operationsHrService.completeAndCertifyMaintenance(selectedTask.id, certifyForm);
      setSuccessMsg(`Maintenance task completed and clinical safety certification issued for ${selectedTask.asset_name}.`);
      setIsCertifyModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(parseApiError(err).message);
    }
  };

  const filteredAssets = assets.filter((a) => {
    const matchSearch =
      a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.asset_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.serial_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoryFilter === 'ALL' || a.category === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Wrench className="w-7 h-7 text-amber-400" />
            Fixed Asset Register & Medical Equipment Maintenance
          </h1>
          <p className="text-sm text-slate-400">
            Section 20: Capital assets register, straight-line depreciation engine, GL integration (Account 5060/1520), and clinical safety PPM certification.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
            title="Refresh Assets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsAddAssetModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Register New Asset
          </button>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} onRetry={loadData} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />}

      {/* Real-time Asset Dashboard Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-sm font-medium">Total Registered Assets</span>
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-3xl font-bold text-slate-100">{dashboard.total_assets_registered}</div>
            <p className="text-xs text-slate-500 mt-1">Medical equipment, vehicles & clinical hardware</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-sm font-medium">Total Carrying Valuation</span>
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              ₹{parseFloat(dashboard.total_carrying_valuation || '0').toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">Original Cost: ₹{parseFloat(dashboard.total_original_cost || '0').toLocaleString()}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-sm font-medium">Accumulated Depreciation</span>
              <TrendingDown className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 font-mono">
              ₹{parseFloat(dashboard.total_accumulated_depreciation || '0').toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">Posted to Section 17 Double-Entry General Ledger</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-sm font-medium">Maintenance Pending</span>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-amber-400">{dashboard.awaiting_maintenance_count}</div>
            <p className="text-xs text-slate-500 mt-1">{dashboard.overdue_maintenance_count} overdue inspections</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        {[
          { key: 'REGISTER', label: 'Fixed Asset Register', icon: Layers },
          { key: 'DEPRECIATION', label: 'Depreciation Engine & SLM', icon: TrendingDown },
          { key: 'MAINTENANCE', label: 'Medical Equipment Maintenance & PPM', icon: Wrench },
          { key: 'SCHEDULES', label: 'Depreciation Schedules Log', icon: FileText }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. REGISTER TAB */}
      {activeTab === 'REGISTER' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search asset by name, code, serial number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none"
              >
                <option value="ALL">All Asset Categories</option>
                <option value="MEDICAL_EQUIPMENT">Medical Equipment</option>
                <option value="SURGICAL_DEVICE">Surgical Devices</option>
                <option value="VEHICLE">Vehicles & Ambulances</option>
                <option value="IT_INFRASTRUCTURE">IT & Computers</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-medium">
                <tr>
                  <th className="p-3">Asset Code</th>
                  <th className="p-3">Asset Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Original Cost</th>
                  <th className="p-3">Carrying Value</th>
                  <th className="p-3">Useful Life</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Depreciation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-mono font-semibold text-amber-400">{asset.asset_code}</td>
                    <td className="p-3">
                      <div className="font-medium text-slate-100">{asset.name}</div>
                      <div className="text-xs text-slate-500">{asset.physical_location || 'Hospital Campus'}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="neutral">{asset.category}</Badge>
                    </td>
                    <td className="p-3 font-mono">₹{parseFloat(asset.purchase_cost || '0').toLocaleString()}</td>
                    <td className="p-3 font-mono font-bold text-emerald-400">
                      ₹{parseFloat(asset.current_carrying_value || '0').toLocaleString()}
                    </td>
                    <td className="p-3 text-slate-300">{asset.useful_life_years} yrs</td>
                    <td className="p-3">
                      <Badge variant={asset.status === 'OPERATIONAL' ? 'success' : 'warning'}>{asset.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedAsset(asset);
                          setIsDepreciateModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 rounded transition-colors"
                      >
                        <TrendingDown className="w-3.5 h-3.5" /> Depreciate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. DEPRECIATION ENGINE TAB */}
      {activeTab === 'DEPRECIATION' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold text-slate-200 mb-2 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-amber-400" />
              Straight-Line Method (SLM) Depreciation Calculation Engine
            </h2>
            <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-lg text-sm text-slate-300 mb-4 font-mono">
              Annual Depreciation = (Original Purchase Cost - Residual Scrap Value) / Useful Life in Years
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Posting depreciation creates an automated balanced Journal Voucher in Section 17 General Ledger:
              <br />
              &bull; <strong>Debit Account 5060</strong>: Depreciation & Amortization Expense
              <br />
              &bull; <strong>Credit Account 1520</strong>: Accumulated Depreciation - Medical Equipment
            </p>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/60 text-slate-400 font-medium">
                  <tr>
                    <th className="p-3">Asset</th>
                    <th className="p-3">Cost</th>
                    <th className="p-3">Residual Value</th>
                    <th className="p-3">Useful Life</th>
                    <th className="p-3">Calculated Annual SLM</th>
                    <th className="p-3 text-right">Execute Post</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {assets.map((asset) => {
                    const annual = asset.annual_depreciation || '0.00';
                    return (
                      <tr key={asset.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-medium text-slate-100">{asset.name} ({asset.asset_code})</td>
                        <td className="p-3 font-mono">₹{parseFloat(asset.purchase_cost || '0').toLocaleString()}</td>
                        <td className="p-3 font-mono text-slate-400">₹{parseFloat(asset.residual_value || '0').toLocaleString()}</td>
                        <td className="p-3">{asset.useful_life_years} years</td>
                        <td className="p-3 font-mono font-bold text-amber-400">₹{parseFloat(annual).toLocaleString()} / yr</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedAsset(asset);
                              setIsDepreciateModalOpen(true);
                            }}
                            className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded font-medium shadow-sm transition-colors"
                          >
                            Post to GL
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

      {/* 3. MAINTENANCE TAB */}
      {activeTab === 'MAINTENANCE' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Biomedical Equipment PPM & Clinical Safety Clearances
            </h2>
            <span className="text-xs text-slate-400">{maintenanceTasks.length} active service tasks</span>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-medium">
                <tr>
                  <th className="p-3">Equipment</th>
                  <th className="p-3">Maintenance Type</th>
                  <th className="p-3">Scheduled Date</th>
                  <th className="p-3">Service Vendor</th>
                  <th className="p-3">Clinical Safety Certified</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {maintenanceTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-slate-100">{t.asset_name}</div>
                      <div className="text-xs text-slate-500 font-mono">{t.asset_code}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant="neutral">{t.maintenance_type}</Badge>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{t.scheduled_date}</td>
                    <td className="p-3 text-slate-400">{t.technician_vendor || t.service_provider}</td>
                    <td className="p-3">
                      <Badge variant={t.clinical_safety_certified ? 'success' : 'warning'}>
                        {t.clinical_safety_certified ? 'Certified Safe' : 'Pending Certification'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedTask(t);
                          setIsCertifyModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 text-white rounded transition-colors"
                      >
                        Certify & Complete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. SCHEDULES TAB */}
      {activeTab === 'SCHEDULES' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-200">Historical Depreciation Logs & Postings</h2>
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-medium">
                <tr>
                  <th className="p-3">Asset</th>
                  <th className="p-3">Fiscal Year</th>
                  <th className="p-3">Carrying Value Before</th>
                  <th className="p-3">Depreciation Amount</th>
                  <th className="p-3">Carrying Value After</th>
                  <th className="p-3">GL Voucher Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {depSchedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-medium text-slate-200">{s.asset_name} ({s.asset_code})</td>
                    <td className="p-3 font-mono text-indigo-400">{s.fiscal_year}</td>
                    <td className="p-3 font-mono">₹{parseFloat(s.carrying_value_before || '0').toLocaleString()}</td>
                    <td className="p-3 font-mono font-bold text-rose-400">-₹{parseFloat(s.depreciation_amount || '0').toLocaleString()}</td>
                    <td className="p-3 font-mono font-bold text-emerald-400">₹{parseFloat(s.carrying_value_after || '0').toLocaleString()}</td>
                    <td className="p-3">
                      <Badge variant="success">POSTED TO GL</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Register New Asset */}
      <Modal isOpen={isAddAssetModalOpen} onClose={() => setIsAddAssetModalOpen(false)} title="Register Hospital Capital Asset">
        <form onSubmit={handleAddAssetSubmit} className="space-y-4">
          <Input
            label="Asset Name"
            value={assetForm.name}
            onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
            placeholder="e.g. Philips Ultrasound EPIQ 7"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Asset Identification Code"
              value={assetForm.asset_code}
              onChange={(e) => setAssetForm({ ...assetForm, asset_code: e.target.value })}
              placeholder="e.g. MED-EQ-901"
              required
            />
            <Select
              label="Asset Category"
              value={assetForm.category}
              onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
              options={[
                { label: 'Medical Equipment', value: 'MEDICAL_EQUIPMENT' },
                { label: 'Surgical Device', value: 'SURGICAL_DEVICE' },
                { label: 'Vehicle / Ambulance', value: 'VEHICLE' },
                { label: 'IT Infrastructure', value: 'IT_INFRASTRUCTURE' },
                { label: 'Hospital Furniture', value: 'FURNITURE' }
              ]}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Purchase Cost (₹)"
              type="number"
              value={assetForm.purchase_cost}
              onChange={(e) => setAssetForm({ ...assetForm, purchase_cost: e.target.value })}
              required
            />
            <Input
              label="Residual Scrap Value (₹)"
              type="number"
              value={assetForm.residual_value}
              onChange={(e) => setAssetForm({ ...assetForm, residual_value: e.target.value })}
              required
            />
            <Input
              label="Useful Life (Years)"
              type="number"
              value={assetForm.useful_life_years}
              onChange={(e) => setAssetForm({ ...assetForm, useful_life_years: parseInt(e.target.value) || 5 })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Supplier / Vendor"
              value={assetForm.supplier_name}
              onChange={(e) => setAssetForm({ ...assetForm, supplier_name: e.target.value })}
              required
            />
            <Input
              label="Physical Location"
              value={assetForm.physical_location}
              onChange={(e) => setAssetForm({ ...assetForm, physical_location: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsAddAssetModalOpen(false)}
              className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium"
            >
              Save to Asset Register
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Post Depreciation */}
      {selectedAsset && (
        <Modal isOpen={isDepreciateModalOpen} onClose={() => setIsDepreciateModalOpen(false)} title="Calculate & Post Depreciation">
          <form onSubmit={handleDepreciateSubmit} className="space-y-4">
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="font-semibold text-slate-100">{selectedAsset.name}</div>
              <div className="text-xs text-slate-400">Current Carrying Value: ₹{parseFloat(selectedAsset.current_carrying_value || '0').toLocaleString()}</div>
              <div className="text-xs text-amber-400 mt-1 font-mono">Calculated Annual SLM: ₹{parseFloat(selectedAsset.annual_depreciation || '0').toLocaleString()}</div>
            </div>
            <Input
              label="Fiscal Year"
              value={depreciationForm.fiscal_year}
              onChange={(e) => setDepreciationForm({ ...depreciationForm, fiscal_year: e.target.value })}
              required
            />
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsDepreciateModalOpen(false)}
                className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium"
              >
                Post to General Ledger
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Certify Maintenance */}
      {selectedTask && (
        <Modal isOpen={isCertifyModalOpen} onClose={() => setIsCertifyModalOpen(false)} title="Certify Clinical Safety & Complete Maintenance">
          <form onSubmit={handleCertifySubmit} className="space-y-4">
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="font-semibold text-slate-100">{selectedTask.asset_name}</div>
              <div className="text-xs text-slate-400">Task: {selectedTask.maintenance_type} | Vendor: {selectedTask.technician_vendor}</div>
            </div>
            <Input
              label="Action Taken"
              value={certifyForm.action_taken}
              onChange={(e) => setCertifyForm({ ...certifyForm, action_taken: e.target.value })}
              required
            />
            <Input
              label="Inspection Findings"
              value={certifyForm.findings}
              onChange={(e) => setCertifyForm({ ...certifyForm, findings: e.target.value })}
              required
            />
            <Input
              label="Maintenance Cost (₹)"
              type="number"
              value={certifyForm.total_cost}
              onChange={(e) => setCertifyForm({ ...certifyForm, total_cost: e.target.value })}
              required
            />
            <Input
              label="Clinical Safety Certification Statement"
              value={certifyForm.certification_notes}
              onChange={(e) => setCertifyForm({ ...certifyForm, certification_notes: e.target.value })}
              required
            />
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsCertifyModalOpen(false)}
                className="px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
              >
                Issue Clinical Safety Clearance
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AssetsPage;
