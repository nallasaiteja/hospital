import React, { useState, useEffect } from 'react';
import { UserCheck, Stethoscope, Users, Calendar, Clock, Plus, Shield, Award } from 'lucide-react';
import { authService, clinicalService } from '../../services/api';
import { parseApiError } from '../../utils/errorHandler';
import { AlertBanner } from '../../components/common/AlertBanner';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { DateField } from '../../components/common/DateField';
import { Input } from '../../components/common/Input';
import { useBranch } from '../../context/BranchContext';

interface StaffMember {
  id: string;
  employee_id: string;
  user_profile: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  };
  designation: string;
  specialization: string;
  medical_license_number: string;
  qualification: string;
  consultation_fee: string;
  status: string;
  is_on_duty: boolean;
}

interface RosterEntry {
  id: string;
  staff_name: string;
  designation: string;
  department_name: string;
  shift: string;
  roster_date: string;
  assigned_station: string;
}

export const DoctorsNursingPage: React.FC = () => {
  const { currentBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<'roster' | 'directory'>('directory');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [rosterList, setRosterList] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRosterModal, setShowRosterModal] = useState(false);

  // Form states
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [rosterDate, setRosterDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('MORNING');
  const [station, setStation] = useState('OPD Block A');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [staffData, rosterData] = await Promise.all([
        authService.getStaffDirectory({ branch_id: currentBranch?.id }),
        clinicalService.getDutyRoster({ branch_id: currentBranch?.id }),
      ]);
      setStaffList(staffData as unknown as StaffMember[]);
      setRosterList(rosterData);
      if (staffData?.length > 0) setSelectedStaffId(staffData[0].id);
    } catch (err) {
      console.error('Failed to load doctors and nursing:', err);
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentBranch?.id]);

  const handleAssignShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await clinicalService.assignDutyShift({
        staff_id: selectedStaffId,
        branch_id: currentBranch?.id,
        roster_date: rosterDate,
        shift,
        assigned_station: station,
      });
      setShowRosterModal(false);
      fetchData();
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  const staffColumns: Column<StaffMember>[] = [
    {
      key: 'employee_id',
      header: 'Staff ID',
      render: (s) => <span className="font-mono text-cyan-400 font-bold">{s.employee_id}</span>,
    },
    {
      key: 'name',
      header: 'Clinician / Specialist',
      render: (s) => (
        <div>
          <div className="font-semibold text-white">
            {s.user_profile?.first_name} {s.user_profile?.last_name}
          </div>
          <div className="text-[11px] text-slate-500">{s.qualification || s.designation}</div>
        </div>
      ),
    },
    {
      key: 'specialization',
      header: 'Specialty & Department',
      render: (s) => (
        <div>
          <div className="text-slate-200 text-xs font-medium">{s.specialization || 'General Medicine'}</div>
          <div className="text-[11px] text-cyan-400">{s.designation}</div>
        </div>
      ),
    },
    {
      key: 'medical_license_number',
      header: 'Medical License',
      render: (s) => (
        <span className="font-mono text-xs text-slate-300">
          {s.medical_license_number || 'NMC-REG-PENDING'}
        </span>
      ),
    },
    {
      key: 'consultation_fee',
      header: 'OPD Fee',
      render: (s) => <span className="font-mono text-emerald-400 font-semibold">₹{s.consultation_fee}</span>,
    },
    {
      key: 'duty',
      header: 'Shift Status',
      render: (s) => (
        <Badge variant={s.is_on_duty ? 'success' : 'neutral'}>
          {s.is_on_duty ? 'On Active Duty' : 'Off Duty'}
        </Badge>
      ),
    },
  ];

  const rosterColumns: Column<RosterEntry>[] = [
    {
      key: 'roster_date',
      header: 'Date',
      render: (r) => <span className="font-mono text-xs text-slate-300">{r.roster_date}</span>,
    },
    {
      key: 'staff_name',
      header: 'Staff Member',
      render: (r) => (
        <div>
          <div className="font-semibold text-white">{r.staff_name}</div>
          <div className="text-[11px] text-slate-500">{r.designation}</div>
        </div>
      ),
    },
    {
      key: 'shift',
      header: 'Shift Timing',
      render: (r) => (
        <Badge variant={r.shift === 'NIGHT' ? 'danger' : r.shift === 'EVENING' ? 'warning' : 'info'}>
          {r.shift}
        </Badge>
      ),
    },
    {
      key: 'station',
      header: 'Assigned Station / Ward',
      render: (r) => <span className="text-slate-300 text-xs font-medium">{r.assigned_station}</span>,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-cyan-400" />
            Doctors, Specialists & Nursing Roster
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Medical staff credentials, qualifications, consultation fees, and 24x7 clinical duty roster schedules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRosterModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-semibold text-xs hover:brightness-110 shadow-lg shadow-cyan-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            Assign Duty Shift
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Physicians & Surgeons"
          value={staffList.length.toString()}
          icon={Stethoscope}
        />
        <StatCard
          title="On-Duty Staff"
          value={staffList.filter((s) => s.is_on_duty).length.toString()}
          icon={UserCheck}
        />
        <StatCard
          title="Roster Shifts Scheduled"
          value={rosterList.length.toString()}
          icon={Calendar}
        />
        <StatCard
          title="Medical Credentials"
          value="100% Verified"
          icon={Award}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-4">
        <button
          onClick={() => setActiveTab('directory')}
          className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'directory'
              ? 'text-cyan-400 border-cyan-400'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          Clinical Staff Directory ({staffList.length})
        </button>
        <button
          onClick={() => setActiveTab('roster')}
          className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === 'roster'
              ? 'text-cyan-400 border-cyan-400'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Active Duty Roster Shifts ({rosterList.length})
        </button>
      </div>

      {/* Active Tab Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        {activeTab === 'directory' ? (
          <DataTable
            data={staffList}
            columns={staffColumns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search doctors by name, specialty, or license..."
            pageSize={10}
          />
        ) : (
          <DataTable
            data={rosterList}
            columns={rosterColumns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search duty shifts..."
            pageSize={10}
          />
        )}
      </div>

      {/* Duty Shift Assignment Modal */}
      <Modal
        isOpen={showRosterModal}
        onClose={() => setShowRosterModal(false)}
        title="Schedule Clinical Duty Shift"
        size="md"
      >
        <form onSubmit={handleAssignShift} className="space-y-4">
          <Select
            label="Staff Member"
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            options={staffList.map((s) => ({
              value: s.id,
              label: `${s.user_profile?.first_name} ${s.user_profile?.last_name} (${s.designation})`,
            }))}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <DateField
              label="Roster Date"
              value={rosterDate}
              onChange={(e) => setRosterDate(e.target.value)}
              required
            />
            <Select
              label="Shift Hours"
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              options={[
                { value: 'MORNING', label: 'Morning (08:00 - 16:00)' },
                { value: 'EVENING', label: 'Evening (16:00 - 00:00)' },
                { value: 'NIGHT', label: 'Night (00:00 - 08:00)' },
                { value: 'ON_CALL', label: '24-Hour On Call' },
              ]}
              required
            />
          </div>

          <Input
            label="Assigned Clinical Station / Ward"
            value={station}
            onChange={(e) => setStation(e.target.value)}
            placeholder="e.g. Critical Care ICU, Emergency Bay 3, OPD Room 102"
            required
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowRosterModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition"
            >
              Assign Roster Shift
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
