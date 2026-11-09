import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Tag,
  Search,
  Plus,
  RefreshCw,
  History,
  ShieldCheck,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Lock,
  Globe,
  SlidersHorizontal,
  Clock,
  FileText,
  DollarSign,
  Activity,
  Bed,
  Stethoscope,
  Info
} from 'lucide-react';
import { tariffManagementService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AlertBanner } from '../../components/common/AlertBanner';
import {
  TariffServiceItem,
  TariffListResponse,
  PriceHistoryRecord,
  TariffPricePreview,
  TariffCategoryOption,
  PricingUnitOption,
} from '../../types';

// Tab categories mapped to backend ServiceCategory choices
const CATEGORY_TABS = [
  { key: 'ALL', label: 'All Services', icon: Layers },
  { key: 'OPD_CONSULTATION', label: 'Appointment Charges', icon: Stethoscope },
  { key: 'TOKEN_REGISTRATION', label: 'Token Charges', icon: Tag },
  { key: 'ADMISSION_CHARGES', label: 'Admission Charges', icon: Activity },
  { key: 'IPD_ROOM_BED', label: 'Bed & Room Charges', icon: Bed },
  { key: 'ICU_CARE', label: 'ICU & Critical Care', icon: Activity },
  { key: 'DIAGNOSTIC_LAB', label: 'Laboratory Services', icon: Layers },
  { key: 'RADIOLOGY_IMAGING', label: 'Radiology & Imaging', icon: Layers },
  { key: 'NURSING', label: 'Nursing Services', icon: Activity },
  { key: 'SURGERY_PROCEDURE', label: 'Procedures & Surgery', icon: Activity },
  { key: 'PHARMACY', label: 'Pharmacy & Dispensing', icon: Tag },
  { key: 'AMBULANCE', label: 'Ambulance Services', icon: Activity },
];

export const HospitalPricingTariffPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const { branches } = useBranch();

  // Authorizations: Only HOSPITAL_ADMIN and SUPER_ADMIN have pricing authority
  const hasTariffAdminAuthority = role === 'HOSPITAL_ADMIN' || role === 'SUPER_ADMIN' || userProfile?.role?.name === 'HOSPITAL_ADMIN';

  // State
  const [services, setServices] = useState<TariffServiceItem[]>([]);
  const [categories, setCategories] = useState<TariffCategoryOption[]>([]);
  const [pricingUnits, setPricingUnits] = useState<PricingUnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<TariffServiceItem | null>(null);
  const [newPriceInput, setNewPriceInput] = useState<string>('');
  const [effectiveDateInput, setEffectiveDateInput] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [appliesToAllBranches, setAppliesToAllBranches] = useState<boolean>(true);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [priceChangeReason, setPriceChangeReason] = useState<string>('');
  const [pricePreview, setPricePreview] = useState<TariffPricePreview | null>(null);
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Add Service Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newServiceCode, setNewServiceCode] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('GENERAL_SERVICE');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceUnit, setNewServiceUnit] = useState('ONE_TIME');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServiceReason, setNewServiceReason] = useState('');
  const [addingService, setAddingService] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // History Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyService, setHistoryService] = useState<TariffServiceItem | null>(null);
  const [historyRecords, setHistoryRecords] = useState<PriceHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Status toggle confirmation
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Fetch tariffs from central endpoint
  const fetchTariffs = useCallback(async (showNotice = false) => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedCategory !== 'ALL') {
        params.category = selectedCategory;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (statusFilter === 'ACTIVE') {
        params.is_active = true;
      } else if (statusFilter === 'INACTIVE') {
        params.is_active = false;
      }
      if (selectedBranchId) {
        params.branch_id = selectedBranchId;
      }

      const res = await tariffManagementService.getHospitalTariffs(params);
      setServices(res.results || []);
      if (res.categories && res.categories.length > 0) {
        setCategories(res.categories);
      }
      if (res.pricing_units && res.pricing_units.length > 0) {
        setPricingUnits(res.pricing_units);
      }
      setLastSyncTime(new Date().toLocaleTimeString());

      if (showNotice) {
        setSyncNotice('Central tariff rates synchronized across all active hospital branches.');
        setTimeout(() => setSyncNotice(null), 4000);
      }
    } catch (err: any) {
      console.error('Error fetching central hospital tariffs:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, statusFilter, selectedBranchId]);

  useEffect(() => {
    fetchTariffs();
  }, [fetchTariffs]);

  // Dynamic live sync refresh interval (every 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTariffs();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTariffs]);

  // KPI Calculations
  const totalCount = services.length;
  const activeCount = useMemo(() => services.filter((s) => s.is_active).length, [services]);
  const allBranchesSyncedCount = useMemo(
    () => services.filter((s) => s.applies_to_all_branches).length,
    [services]
  );

  // Open Edit Price Modal & compute initial preview
  const handleOpenEditModal = (service: TariffServiceItem) => {
    setEditingService(service);
    setNewPriceInput(service.standard_price);
    setEffectiveDateInput(new Date().toISOString().split('T')[0]);
    setAppliesToAllBranches(true);
    setSelectedBranchIds(branches.map((b) => b.id));
    setPriceChangeReason('');
    setEditError(null);
    setPricePreview(null);
    setIsEditModalOpen(true);
  };

  // Live trigger preview when price or branches change in edit modal
  useEffect(() => {
    if (!isEditModalOpen || !editingService) return;
    const priceNum = parseFloat(newPriceInput);
    if (isNaN(priceNum) || priceNum < 0) {
      setPricePreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const preview = await tariffManagementService.previewPriceChange({
          service_id: editingService.id,
          new_price: priceNum,
          effective_date: effectiveDateInput,
          applies_to_all_branches: appliesToAllBranches,
          branch_ids: appliesToAllBranches ? [] : selectedBranchIds,
        });
        setPricePreview(preview);
      } catch (err) {
        console.warn('Failed to calculate preview:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isEditModalOpen, editingService, newPriceInput, effectiveDateInput, appliesToAllBranches, selectedBranchIds]);

  // Submit Price Update
  const handleSavePriceChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    const priceNum = parseFloat(newPriceInput);
    if (isNaN(priceNum) || priceNum < 0) {
      setEditError('Standard price must be a non-negative decimal value.');
      return;
    }

    if (!priceChangeReason.trim()) {
      setEditError('A mandatory reason / administrative justification must be provided for audit compliance.');
      return;
    }

    try {
      setUpdatingPrice(true);
      setEditError(null);

      await tariffManagementService.updateServicePrice(editingService.id, {
        new_price: priceNum,
        reason: priceChangeReason.trim(),
        effective_date: effectiveDateInput,
        applies_to_all_branches: appliesToAllBranches,
        branch_ids: appliesToAllBranches ? [] : selectedBranchIds,
      });

      setIsEditModalOpen(false);
      setEditingService(null);
      await fetchTariffs(true);
    } catch (err: any) {
      setEditError(err.response?.data?.error || err.message || 'Failed to update tariff price.');
    } finally {
      setUpdatingPrice(false);
    }
  };

  // Toggle active status
  const handleToggleStatus = async (service: TariffServiceItem) => {
    if (!hasTariffAdminAuthority) return;
    try {
      setTogglingId(service.id);
      await tariffManagementService.toggleServiceStatus(service.id, !service.is_active);
      await fetchTariffs(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update status');
    } finally {
      setTogglingId(null);
    }
  };

  // Open History Modal
  const handleOpenHistory = async (service?: TariffServiceItem) => {
    setHistoryService(service || null);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      if (service) {
        const res = await tariffManagementService.getServicePriceHistory(service.id);
        setHistoryRecords(res.results || []);
      } else {
        const res = await tariffManagementService.getAllPriceHistory({ limit: 50 });
        setHistoryRecords(res.results || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Submit Add Service
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || !newServiceCode.trim()) {
      setAddError('Service Name and Service Code are required.');
      return;
    }

    const priceNum = parseFloat(newServicePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setAddError('Standard price must be a valid non-negative number.');
      return;
    }

    try {
      setAddingService(true);
      setAddError(null);

      await tariffManagementService.createService({
        service_code: newServiceCode.trim().toUpperCase(),
        name: newServiceName.trim(),
        category: newServiceCategory,
        standard_price: priceNum,
        pricing_unit: newServiceUnit,
        description: newServiceDesc.trim(),
        reason: newServiceReason.trim() || 'Initial Tariff Service Creation',
      });

      setIsAddModalOpen(false);
      setNewServiceCode('');
      setNewServiceName('');
      setNewServicePrice('');
      setNewServiceDesc('');
      setNewServiceReason('');
      await fetchTariffs(true);
    } catch (err: any) {
      setAddError(err.response?.data?.error || err.message || 'Failed to create tariff service.');
    } finally {
      setAddingService(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Synchronization Notification Toast */}
      {syncNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-medium">{syncNotice}</span>
          </div>
          <span className="text-xs text-emerald-600 font-mono">100% Dynamic Synced</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                <Tag className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Hospital Pricing & Tariff Management
                </h1>
                <p className="text-sm text-gray-500">
                  Centralized Pricing Authority • Multi-Branch Automatic Sync • Non-Destructive Historic Safeguard
                </p>
              </div>
            </div>
          </div>

          {/* Action Header Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Branch View Selector */}
            <div className="flex items-center space-x-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-gray-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="">All Branches (Central Master)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sync Timestamp & Manual Refresh */}
            <button
              onClick={() => fetchTariffs(true)}
              disabled={loading}
              title={`Last synchronized: ${lastSyncTime}`}
              className="inline-flex items-center space-x-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              <span>{lastSyncTime ? `Synced ${lastSyncTime}` : 'Sync'}</span>
            </button>

            {/* Full Audit Log */}
            <button
              onClick={() => handleOpenHistory()}
              className="inline-flex items-center space-x-1.5 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-medium rounded-lg transition-colors"
            >
              <History className="w-3.5 h-3.5 text-gray-500" />
              <span>Pricing Audit Trail</span>
            </button>

            {/* Add Service Button (Authorized Admins Only) */}
            {hasTariffAdminAuthority && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Tariff Service</span>
              </button>
            )}
          </div>
        </div>

        {/* Read-Only Supervisory Banner for Non-Admins */}
        {!hasTariffAdminAuthority && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center space-x-2 text-xs text-amber-800">
            <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Supervisory Read-Only View:</strong> Pricing configuration is centrally managed by the authorized Hospital Administrator. Any modifications made at the central level instantly propagate to your branch.
            </span>
          </div>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Catalogue Items</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalCount}</p>
            <span className="text-xs text-gray-500">Across 11 categories</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Tariffs</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
            <span className="text-xs text-emerald-700 font-medium">Ready for billing & booking</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Multi-Branch Sync</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{branches.length || 3} Branches</p>
            <span className="text-xs text-indigo-700 font-medium">Centralized Single Source</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Globe className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Historic Integrity</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">Preserved</p>
            <span className="text-xs text-gray-500">Past invoices & visits immutable</span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Category Navigation Pills */}
      <div className="bg-white border border-gray-200 rounded-xl p-2 shadow-sm overflow-x-auto">
        <div className="flex space-x-1.5 min-w-max">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedCategory === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedCategory(tab.key)}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by service code, name, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">Status:</span>
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Inactive'}
            </button>
          ))}
          <span className="text-xs text-gray-400 pl-2">
            Showing {services.length} items
          </span>
        </div>
      </div>

      {/* Services Tariff Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-500">Retrieving live central tariffs from database...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Tag className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="text-sm font-semibold text-gray-800">No Services Found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              No hospital services match the selected category or filter query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Service Code & Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Standard Tariff</th>
                  <th className="py-3 px-4">Pricing Unit</th>
                  <th className="py-3 px-4">Branch Applicability</th>
                  <th className="py-3 px-4">Effective Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {services.map((service) => {
                  return (
                    <tr key={service.id} className="hover:bg-gray-50/75 transition-colors">
                      {/* Code & Name */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">{service.name}</span>
                          <span className="text-[11px] font-mono text-gray-500">{service.service_code}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          {service.category_display || service.category}
                        </span>
                      </td>

                      {/* Standard Price */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-bold text-gray-900 font-mono">
                            ₹{parseFloat(service.standard_price || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          {service.has_branch_override && (
                            <span className="text-[10px] text-amber-600 font-medium">Branch Override</span>
                          )}
                        </div>
                      </td>

                      {/* Pricing Unit */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">
                          {service.pricing_unit_display || service.pricing_unit}
                        </span>
                      </td>

                      {/* Branch Applicability */}
                      <td className="py-3 px-4">
                        {service.applies_to_all_branches ? (
                          <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-700 font-medium">
                            <Globe className="w-3.5 h-3.5 text-emerald-600" />
                            <span>All Branches Synced</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[11px] text-blue-700 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Selective Branches</span>
                          </span>
                        )}
                      </td>

                      {/* Effective Date */}
                      <td className="py-3 px-4 text-gray-600 text-[11px]">
                        {service.effective_from || 'Immediate'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {service.is_active ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          {/* Price History */}
                          <button
                            onClick={() => handleOpenHistory(service)}
                            title="View complete price change history"
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Edit Price (Admin Only) */}
                          {hasTariffAdminAuthority && (
                            <button
                              onClick={() => handleOpenEditModal(service)}
                              title="Edit price across branches"
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium border border-blue-200 transition-colors"
                            >
                              Edit Price
                            </button>
                          )}

                          {/* Activate / Deactivate Toggle (Admin Only) */}
                          {hasTariffAdminAuthority && (
                            <button
                              onClick={() => handleToggleStatus(service)}
                              disabled={togglingId === service.id}
                              title={service.is_active ? 'Deactivate this service' : 'Activate this service'}
                              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                service.is_active
                                  ? 'text-red-700 hover:bg-red-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {togglingId === service.id
                                ? '...'
                                : service.is_active
                                ? 'Deactivate'
                                : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT PRICE MODAL WITH LIVE PREVIEW */}
      {isEditModalOpen && editingService && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingService(null);
          }}
          title={`Edit Hospital Tariff: ${editingService.name}`}
        >
          <form onSubmit={handleSavePriceChange} className="space-y-4">
            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                {editError}
              </div>
            )}

            {/* Service Summary Header */}
            <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono text-gray-500 block">{editingService.service_code}</span>
                <span className="text-sm font-semibold text-gray-900">{editingService.name}</span>
                <span className="text-xs text-gray-500 block">{editingService.category_display}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 block">Current Standard Price</span>
                <span className="text-lg font-bold text-gray-900 font-mono">
                  ₹{parseFloat(editingService.standard_price).toFixed(2)}
                </span>
                <span className="text-[11px] text-gray-500 block">/{editingService.pricing_unit_display}</span>
              </div>
            </div>

            {/* New Price & Effective Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  New Standard Price (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newPriceInput}
                    onChange={(e) => setNewPriceInput(e.target.value)}
                    placeholder="e.g. 1800.00"
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Effective Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={effectiveDateInput}
                  onChange={(e) => setEffectiveDateInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Impact Comparative Preview Card */}
            {pricePreview && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
                  <span className="flex items-center space-x-1">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span>Price Change Impact Preview</span>
                  </span>
                  <span
                    className={`inline-flex items-center space-x-0.5 font-bold ${
                      parseFloat(pricePreview.difference) > 0
                        ? 'text-emerald-700'
                        : parseFloat(pricePreview.difference) < 0
                        ? 'text-red-700'
                        : 'text-gray-700'
                    }`}
                  >
                    {parseFloat(pricePreview.difference) > 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : parseFloat(pricePreview.difference) < 0 ? (
                      <TrendingDown className="w-3.5 h-3.5" />
                    ) : null}
                    <span>
                      {parseFloat(pricePreview.difference) >= 0 ? '+' : ''}
                      ₹{parseFloat(pricePreview.difference).toFixed(2)} ({pricePreview.percentage_change})
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-blue-200/60">
                  <div>
                    <span className="text-gray-500">Old Rate:</span>{' '}
                    <span className="font-mono font-medium text-gray-800">₹{parseFloat(pricePreview.current_price).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">New Rate:</span>{' '}
                    <span className="font-mono font-bold text-blue-800">₹{parseFloat(pricePreview.new_price).toFixed(2)}</span>
                  </div>
                  <div className="col-span-2 text-gray-600">
                    <span className="font-medium text-gray-800">
                      Propagation Target: {pricePreview.affected_branches_count} of {pricePreview.total_branches_count} Active Branches
                    </span>{' '}
                    ({pricePreview.affected_branches.map((b) => b.name).join(', ')})
                  </div>
                </div>
              </div>
            )}

            {/* Multi-Branch Applicability */}
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={appliesToAllBranches}
                  onChange={(e) => setAppliesToAllBranches(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-gray-900">
                  Apply centrally across all hospital branches automatically (Recommended)
                </span>
              </label>
              <p className="text-[11px] text-gray-500 pl-6">
                When enabled, Branch 1, Branch 2, Branch 3 and all newly added branches will adopt this new rate instantly.
              </p>

              {/* Individual Branch Selectors if unchecked */}
              {!appliesToAllBranches && (
                <div className="mt-2 pl-6 space-y-1.5 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <span className="text-xs font-medium text-gray-700 block">Select specific branches:</span>
                  {branches.map((branch) => (
                    <label key={branch.id} className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBranchIds.includes(branch.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBranchIds([...selectedBranchIds, branch.id]);
                          } else {
                            setSelectedBranchIds(selectedBranchIds.filter((id) => id !== branch.id));
                          }
                        }}
                        className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300"
                      />
                      <span>{branch.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Mandatory Reason for Change */}
            <div className="border-t border-gray-100 pt-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Reason / Administrative Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={priceChangeReason}
                onChange={(e) => setPriceChangeReason(e.target.value)}
                placeholder="e.g. Annual hospital tariff revision, operational inflation adjustment, management board approval..."
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-[10px] text-gray-500">
                This reason will be recorded immutably in the Hospital Price Change Audit Trail.
              </span>
            </div>

            {/* Non-Destructive Safeguard Notice */}
            <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 flex items-start space-x-2 text-[11px] text-gray-600">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Zero Disruption Guarantee:</strong> This change applies strictly to future appointments, tokens, and new inpatient admissions. Existing running admissions, finalized invoices, and completed receipts remain protected and unchanged.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingService(null);
                }}
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatingPrice}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-1"
              >
                {updatingPrice ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Synchronizing Branches...</span>
                  </>
                ) : (
                  <span>Commit Price Across Branches</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ADD SERVICE MODAL */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add New Hospital Tariff Service"
        >
          <form onSubmit={handleCreateService} className="space-y-3.5">
            {addError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
                {addError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Service Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newServiceCode}
                  onChange={(e) => setNewServiceCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CONSULT-SPEC-02"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg font-mono outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Service Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={newServiceCategory}
                  onChange={(e) => setNewServiceCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Service Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="e.g. Senior Specialist Consultation"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Standard Tariff Price (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(e.target.value)}
                    placeholder="e.g. 1200.00"
                    className="w-full pl-7 pr-3 py-2 text-xs border border-gray-300 rounded-lg font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Pricing Unit <span className="text-red-500">*</span>
                </label>
                <select
                  value={newServiceUnit}
                  onChange={(e) => setNewServiceUnit(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {pricingUnits.map((u) => (
                    <option key={u.key} value={u.key}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Description / Clinical Scope
              </label>
              <textarea
                rows={2}
                value={newServiceDesc}
                onChange={(e) => setNewServiceDesc(e.target.value)}
                placeholder="Optional description of the clinical service or coverage..."
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Creation Justification / Reason
              </label>
              <input
                type="text"
                value={newServiceReason}
                onChange={(e) => setNewServiceReason(e.target.value)}
                placeholder="e.g. Introducing new cardiology clinical consultation package"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingService}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center space-x-1"
              >
                {addingService ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Adding to Catalogue...</span>
                  </>
                ) : (
                  <span>Add Service to Catalogue</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* PRICE CHANGE HISTORY / AUDIT TRAIL MODAL */}
      {isHistoryModalOpen && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title={
            historyService
              ? `Price Change Audit Trail: ${historyService.name} (${historyService.service_code})`
              : 'Hospital-Wide Central Pricing Audit Trail'
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Immutable ledger of all price revisions, administrative approvals, and multi-branch propagation events.
            </p>

            {loadingHistory ? (
              <div className="py-12 text-center">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-500">Loading audit history...</p>
              </div>
            ) : historyRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">
                No price change history recorded for this service.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Date & Time</th>
                      {!historyService && <th className="py-2.5 px-3">Service</th>}
                      <th className="py-2.5 px-3">Price Revision</th>
                      <th className="py-2.5 px-3">Modified By</th>
                      <th className="py-2.5 px-3">Affected Branches</th>
                      <th className="py-2.5 px-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyRecords.map((rec) => {
                      const diff = parseFloat(rec.difference || '0');
                      return (
                        <tr key={rec.id} className="hover:bg-gray-50/60">
                          <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                            {new Date(rec.timestamp).toLocaleString()}
                          </td>
                          {!historyService && (
                            <td className="py-2 px-3">
                              <span className="font-semibold text-gray-900 block">{rec.service_name}</span>
                              <span className="text-[10px] font-mono text-gray-400">{rec.service_code}</span>
                            </td>
                          )}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="flex items-center space-x-1.5 font-mono">
                              <span className="text-gray-500">₹{parseFloat(rec.previous_price).toFixed(2)}</span>
                              <ArrowRight className="w-3 h-3 text-gray-400" />
                              <span className="font-bold text-gray-900">₹{parseFloat(rec.new_price).toFixed(2)}</span>
                              <span
                                className={`text-[10px] font-semibold px-1 rounded ${
                                  diff > 0
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : diff < 0
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-gray-50 text-gray-600'
                                }`}
                              >
                                {diff >= 0 ? '+' : ''}
                                {diff.toFixed(2)}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-gray-700 font-medium whitespace-nowrap">
                            {rec.modified_by}
                          </td>
                          <td className="py-2 px-3 text-gray-600">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-100">
                              {rec.affected_branches}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-gray-700 max-w-xs truncate" title={rec.reason}>
                            {rec.reason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg"
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

export default HospitalPricingTariffPage;

