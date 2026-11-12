import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Tv,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  RefreshCw,
  Users,
  Stethoscope,
  Clock,
  CheckCircle2,
  Building2,
  Calendar,
  Sparkles,
  ArrowRight,
  Filter,
  UserCheck,
  Megaphone,
  Activity,
  Layers,
  ChevronRight,
  ShieldCheck,
  Info,
  X,
} from 'lucide-react';
import { opdService } from '../services/api';
import { LoungeTVData, LoungeDoctorInfo, LoungeQueueItem } from '../types';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

interface LoungeTVPageProps {
  isStaffView?: boolean;
  preselectedDoctorId?: string;
  onClose?: () => void;
}

export const LoungeTVPage: React.FC<LoungeTVPageProps> = ({
  isStaffView = false,
  preselectedDoctorId,
  onClose,
}) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentBranch } = useBranch();
  const { userProfile, role, staffProfile } = useAuth();

  // ---------------------------------------------------------------
  // Lounge TV RBAC
  //  - RECEPTIONIST: front-desk queue controller -> may switch between ALL
  //    doctor cabins and announce any token ("Call on TV").
  //  - DOCTOR / DEPARTMENT_HEAD / MEDICAL_DIRECTOR: locked to their OWN cabin;
  //    may announce only their own patients.
  //  - Everyone else (patients, other staff, unauthenticated wall TV):
  //    read-only display, no cabin switching, no announcements.
  // ---------------------------------------------------------------
  const isReceptionist = role === 'RECEPTIONIST';
  const isClinician = ['DOCTOR', 'DEPARTMENT_HEAD', 'MEDICAL_DIRECTOR'].includes(role || '');
  const ownDoctorId = isClinician ? (staffProfile?.id || preselectedDoctorId || '') : '';
  const canSwitchCabins = isReceptionist;
  const canAnnounce = isStaffView && (isReceptionist || isClinician);

  const queryDoctorId = isClinician
    ? ownDoctorId
    : (preselectedDoctorId || (canSwitchCabins ? searchParams.get('doctor_id') : '') || '');
  const [selectedDoctorId, setSelectedDoctorIdRaw] = useState<string>(queryDoctorId);
  // Guarded setter: only receptionists may change the cabin being viewed
  const setSelectedDoctorId = (id: string) => {
    if (!canSwitchCabins) return;
    setSelectedDoctorIdRaw(id);
  };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [data, setData] = useState<LoungeTVData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastAnnouncedToken, setLastAnnouncedToken] = useState<string | null>(null);
  const [callingToken, setCallingToken] = useState<LoungeQueueItem | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Digital clock interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync query doctor
  useEffect(() => {
    // Clinicians are always pinned to their own cabin
    if (isClinician && ownDoctorId) {
      setSelectedDoctorIdRaw(ownDoctorId);
    } else if (preselectedDoctorId) {
      setSelectedDoctorIdRaw(preselectedDoctorId);
    }
  }, [preselectedDoctorId, isClinician, ownDoctorId]);

  // Fetch live lounge data
  const fetchLoungeData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setRefreshing(true);
    try {
      const branchId = currentBranch?.id;
      const res = await opdService.getLoungeTV({
        branch_id: branchId,
        doctor_id: selectedDoctorId || undefined,
      });
      setData(res);

      // Check if there is an active serving token to announce
      const activeServing = res.queue.find((q) => q.status === 'IN_CONSULTATION');
      if (activeServing && activeServing.token_number !== lastAnnouncedToken && soundEnabled) {
        setLastAnnouncedToken(activeServing.token_number);
        announceToken(activeServing);
      }
    } catch (err) {
      console.error('Failed to load Lounge TV data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial and Polling every 5 seconds
  useEffect(() => {
    fetchLoungeData(false);
    const pollInterval = setInterval(() => {
      fetchLoungeData(true);
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [selectedDoctorId, currentBranch?.id]);

  // Web Speech API Voice Announcement
  const announceToken = (item: LoungeQueueItem) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const text = `Token number ${item.token_number}. Patient ${item.patient_display_name}. Please proceed to ${item.cabin_number} for Dr. ${item.doctor_name}.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.05;
      utterance.lang = 'en-IN';
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  // Manual Trigger Call / Recall
  const handleManualAnnounce = (item: LoungeQueueItem) => {
    setCallingToken(item);
    announceToken(item);
    setTimeout(() => {
      setCallingToken(null);
    }, 4000);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => console.warn('Fullscreen request failed:', err));
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => console.warn('Exit fullscreen failed:', err));
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Filtered doctors and queues
  const doctorsList = data?.doctors || [];
  const selectedDoctor = useMemo(() => {
    if (!selectedDoctorId) return null;
    return doctorsList.find((d) => d.doctor_id === selectedDoctorId) || null;
  }, [doctorsList, selectedDoctorId]);

  const activeQueue = useMemo(() => {
    if (!data?.queue) return [];
    if (!selectedDoctorId) return data.queue;
    return data.queue.filter((q) => q.doctor_id === selectedDoctorId);
  }, [data?.queue, selectedDoctorId]);

  const currentlyServingList = useMemo(() => {
    return activeQueue.filter((q) => q.status === 'IN_CONSULTATION');
  }, [activeQueue]);

  const waitingInLoungeList = useMemo(() => {
    return activeQueue.filter((q) => q.status === 'CHECKED_IN' || q.status === 'SCHEDULED');
  }, [activeQueue]);

  const completedList = useMemo(() => {
    return activeQueue.filter((q) => q.status === 'COMPLETED');
  }, [activeQueue]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        'min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-all selection:bg-cyan-500/30 selection:text-cyan-200',
        isFullscreen ? 'p-6 lg:p-8' : 'p-4 sm:p-6'
      )}
    >
      {/* 1. Header Display Banner (High-contrast for Waiting Room TVs) */}
      <header className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-3xl p-4 sm:p-6 mb-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Hospital Branding & Title */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-500 to-blue-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/25 shrink-0">
            <Tv className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                Live Waiting Lounge Telemetry
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono">
                {data?.branch_name || currentBranch?.name || 'AURA Central Multi-Specialty'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1 flex items-center gap-2.5">
              <span>{t('loungeDisplay.title', 'OPD Patient Lounge TV')}</span>
              <span className="text-cyan-400 font-mono text-xl sm:text-2xl font-light">| Cabin Queue</span>
            </h1>
          </div>
        </div>

        {/* Digital Clock, Fullscreen & Sound Controls */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Live Digital Clock */}
          <div className="px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-right shadow-inner">
            <div className="text-xl sm:text-2xl font-mono font-black text-white tracking-wider">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[11px] font-medium text-slate-400">
              {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={clsx(
              'p-3 rounded-2xl border transition flex items-center gap-2 font-medium text-xs',
              soundEnabled
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
            )}
            title={soundEnabled ? 'Audio Chime Enabled' : 'Audio Chime Muted'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Chime ON' : 'Chime Muted'}</span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-cyan-600/25"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter TV Fullscreen Mode (F11)'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit TV' : 'TV Kiosk'}</span>
          </button>

          {/* Close button if rendered in modal */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Close Lounge View"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Interactive Doctor Filter Bar (Crucial for Receptionists, Doctors, and Lounge Patients) */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 mb-6 shadow-lg">
        <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Doctor Consultation Cabins ({doctorsList.length} Active on Duty)
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Total in Lounge:</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
              {data?.summary.total_waiting_in_lounge || 0} Waiting
            </span>
            <span className="text-slate-400">Total Served:</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
              {data?.summary.total_completed || 0} Completed
            </span>
          </div>
        </div>

        {/* Doctor Filter Buttons — Receptionist only (front-desk queue controller) */}
        {canSwitchCabins ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {/* All Doctors Pill */}
          <button
            onClick={() => {
              setSelectedDoctorId('');
              setSearchParams({});
            }}
            className={clsx(
              'px-4 py-2.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-2',
              !selectedDoctorId
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 font-bold'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 hover:text-white'
            )}
          >
            <Users className="w-4 h-4" />
            <span>All Doctor Cabins</span>
            <span className={clsx(
              'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold',
              !selectedDoctorId ? 'bg-slate-950 text-cyan-400' : 'bg-slate-900 text-slate-400'
            )}>
              {data?.summary.total_tokens_today || 0}
            </span>
          </button>

          {/* Specific Doctor Pills */}
          {doctorsList.map((doc) => {
            const isSelected = selectedDoctorId === doc.doctor_id;
            return (
              <button
                key={doc.doctor_id}
                onClick={() => {
                  setSelectedDoctorId(doc.doctor_id);
                  setSearchParams({ doctor_id: doc.doctor_id });
                }}
                className={clsx(
                  'px-3.5 py-2 rounded-xl text-left shrink-0 transition border flex items-center gap-3',
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/60 hover:bg-slate-850 border-slate-800 text-slate-300 hover:border-slate-700'
                )}
              >
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0',
                  isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                )}>
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight truncate flex items-center gap-1.5">
                    <span>{doc.doctor_name}</span>
                    <span className="text-[10px] text-amber-400 font-mono font-semibold">({doc.cabin_number})</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                    {doc.specialization}
                  </div>
                </div>
                {/* Doctor's queue badge */}
                <div className="flex flex-col items-end shrink-0 ml-1">
                  <span className={clsx(
                    'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold',
                    doc.waiting_in_lounge_count > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'
                  )}>
                    {doc.waiting_in_lounge_count} in lounge
                  </span>
                  {doc.currently_serving_token && (
                    <span className="text-[9px] font-mono text-cyan-400 font-semibold mt-0.5">
                      Now #{doc.currently_serving_token}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        ) : isClinician ? (
          <div className="px-2 py-1.5 text-xs text-slate-400 flex items-center gap-2">
            <Stethoscope className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Showing your own consultation cabin only
              {selectedDoctor ? <> — <strong className="text-cyan-300">{selectedDoctor.cabin_number}</strong></> : null}
            </span>
          </div>
        ) : null}
      </section>

      {/* 3. Hero Now Calling / Currently In Consultation Section */}
      <section className="mb-6">
        {selectedDoctor ? (
          /* Single Doctor Focus View */
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-2 border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Doctor Details */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
                    <Stethoscope className="w-4 h-4 text-cyan-400" />
                    Consultation Room: {selectedDoctor.cabin_number}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
                    {selectedDoctor.department_name}
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {selectedDoctor.doctor_name}
                </h2>
                <p className="text-sm text-cyan-300/80 font-medium">
                  {selectedDoctor.specialization} &bull; Live Patient Consultation Telemetry
                </p>

                {/* KPI Metrics */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <div className="px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Tokens Today</div>
                    <div className="text-xl font-mono font-extrabold text-white">{selectedDoctor.total_tokens}</div>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-slate-950/80 border border-amber-500/30">
                    <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Waiting in Lounge</div>
                    <div className="text-xl font-mono font-extrabold text-amber-300">{selectedDoctor.waiting_in_lounge_count} Patients</div>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-slate-950/80 border border-emerald-500/30">
                    <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Completed Today</div>
                    <div className="text-xl font-mono font-extrabold text-emerald-400">{selectedDoctor.completed_count}</div>
                  </div>
                </div>
              </div>

              {/* Huge Now Serving Display Card */}
              <div className="bg-slate-950 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 text-center shadow-2xl min-w-[280px] sm:min-w-[340px] relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/30 flex items-center gap-1.5 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                  Now Consulting
                </div>

                {selectedDoctor.currently_serving_token ? (
                  <div className="space-y-3 mt-2">
                    <div className="text-6xl sm:text-7xl font-mono font-black text-emerald-400 tracking-tight drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                      #{selectedDoctor.currently_serving_token}
                    </div>
                    <div className="text-lg font-bold text-white">
                      {selectedDoctor.currently_serving_patient || 'Patient'}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      Please proceed inside: <strong className="text-amber-300">{selectedDoctor.cabin_number}</strong>
                    </div>

                    {/* Recall / Announce Button for Staff */}
                    {canAnnounce && (
                      <button
                        onClick={() => {
                          const item = currentlyServingList[0];
                          if (item) handleManualAnnounce(item);
                        }}
                        className="mt-3 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-2 mx-auto transition"
                      >
                        <Megaphone className="w-3.5 h-3.5" />
                        <span>Repeat Announcement</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="py-6 space-y-2">
                    <Clock className="w-12 h-12 text-slate-600 mx-auto" />
                    <div className="text-lg font-bold text-slate-300">Doctor Ready for Next</div>
                    <p className="text-xs text-slate-500">
                      {selectedDoctor.waiting_in_lounge_count > 0
                        ? `${selectedDoctor.waiting_in_lounge_count} patients waiting in the lounge.`
                        : 'No patients currently waiting in the lounge.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Multi-Doctor Overview Grid for Lounge Wall Display */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {doctorsList.map((doc) => (
              <div
                key={doc.doctor_id}
                onClick={() => {
                  if (!canSwitchCabins) return;
                  setSelectedDoctorId(doc.doctor_id);
                  setSearchParams({ doctor_id: doc.doctor_id });
                }}
                className={clsx(
                  'bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl transition-all group flex flex-col justify-between',
                  canSwitchCabins && 'hover:border-cyan-500/50 cursor-pointer'
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
                      {doc.cabin_number}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-400">
                      {doc.department_name}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition leading-snug">
                    {doc.doctor_name}
                  </h3>
                  <p className="text-xs text-slate-400">{doc.specialization}</p>
                </div>

                {/* Serving Token Banner */}
                <div className="my-4 p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Now Serving</div>
                  {doc.currently_serving_token ? (
                    <div>
                      <div className="text-3xl font-mono font-black text-emerald-400">
                        #{doc.currently_serving_token}
                      </div>
                      <div className="text-xs font-semibold text-slate-300 mt-0.5 truncate">
                        {doc.currently_serving_patient}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-slate-500 py-1">Ready for Patient</div>
                  )}
                </div>

                {/* Waiting Count & Next Tokens */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Lounge:</span>
                    <strong className="text-amber-300 font-mono">{doc.waiting_in_lounge_count}</strong>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {doc.next_tokens.length > 0 ? (
                      <span>Next: #{doc.next_tokens.slice(0, 3).join(', #')}</span>
                    ) : (
                      <span>Queue clear</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Detailed Waiting Lounge Queue Table (Shows exact token holders waiting) */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span>Patients Waiting in the Lounge</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold">
                {waitingInLoungeList.length} In Line
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedDoctor
                ? `Real-time token sequence waiting in the lounge for ${selectedDoctor.doctor_name}`
                : 'All patients currently checked in and waiting across hospital consultation cabins'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => fetchLoungeData(false)}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center gap-1.5 transition"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin text-cyan-400')} />
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>

        {/* Queue Cards / Grid */}
        {waitingInLoungeList.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-2" />
            <p className="text-base font-semibold text-slate-300">No Patients Currently Waiting in Lounge</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              All token holders have been consulted or are currently inside consultation cabins. New tokens will appear automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {waitingInLoungeList.map((item, index) => {
              const isFirstNext = index === 0;
              return (
                <div
                  key={item.id}
                  className={clsx(
                    'p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3',
                    isFirstNext
                      ? 'bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border-amber-500/40 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {/* Big Token Number */}
                      <div className={clsx(
                        'w-12 h-12 rounded-xl flex flex-col items-center justify-center font-mono font-black text-lg shrink-0 shadow-md',
                        isFirstNext ? 'bg-amber-500 text-slate-950 shadow-amber-500/20' : 'bg-slate-800 text-cyan-300'
                      )}>
                        <span className="text-[9px] uppercase font-bold tracking-wider leading-none">Token</span>
                        <span>#{String(item.token_number || '').replace(/^(token\s*#*|#)+/i, '').trim()}</span>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white truncate max-w-[140px]">
                          {item.patient_display_name}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[140px]">
                          {item.doctor_name}
                        </div>
                      </div>
                    </div>

                    {/* Position Badge */}
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0',
                      isFirstNext ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400'
                    )}>
                      {isFirstNext ? 'Next In Line' : `Position #${index + 1}`}
                    </span>
                  </div>

                  {/* Cabin & Wait Duration */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1 font-mono text-cyan-400">
                      <span>{item.cabin_number}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{item.wait_minutes}m in lounge</span>
                    </div>
                  </div>

                  {/* Staff Call Button (Receptionist: any token; Doctor: own cabin only) */}
                  {canAnnounce && (isReceptionist || item.doctor_id === ownDoctorId) && (
                    <button
                      onClick={() => handleManualAnnounce(item)}
                      className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 hover:text-slate-950 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Megaphone className="w-3.5 h-3.5" />
                      <span>Call on TV</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Audio Broadcast Alert Banner (Visible when speech plays) */}
      {callingToken && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl bg-cyan-500 text-slate-950 font-black text-sm flex items-center gap-3 shadow-2xl shadow-cyan-500/50 animate-bounce">
          <Megaphone className="w-5 h-5 text-slate-950" />
          <span>
            CALLING: Token #{String(callingToken.token_number || '').replace(/^(token\s*#*|#)+/i, '').trim()} &bull; {callingToken.patient_display_name} &bull; Please enter {callingToken.cabin_number}!
          </span>
        </div>
      )}
    </div>
  );
};

