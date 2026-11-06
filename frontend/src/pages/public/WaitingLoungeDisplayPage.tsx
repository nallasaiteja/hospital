import React, { useEffect, useState, useRef } from 'react';
import { 
  Activity, 
  Clock, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Stethoscope, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Users
} from 'lucide-react';
import { opdService } from '../../services/api';

interface QueueItem {
  id: string;
  token_number: number | string;
  patient_name: string;
  patient_mrn?: string;
  doctor_name: string;
  department_name?: string;
  room_number?: string;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED';
  wait_minutes?: number;
  time_slot?: string;
}

export const WaitingLoungeDisplayPage: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastCalledToken, setLastCalledToken] = useState<string | number | null>(null);
  const [callAlertPulse, setCallAlertPulse] = useState(false);
  const previousCallingRef = useRef<string | number | null>(null);

  // Play a pleasant two-tone medical chime using Web Audio API
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      
      // Chime: 587.33Hz (D5) -> 880Hz (A5)
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.15);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.warn('Audio chime playback skipped:', e);
    }
  };

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll live OPD Queue every 5 seconds
  const fetchQueue = async () => {
    try {
      const data = await opdService.getQueue();
      const items: QueueItem[] = Array.isArray(data) ? (data as any) : (data as any)?.results || [];
      setQueue(items);

      // Check if there is an active IN_CONSULTATION token
      const currentlyCalling = items.find((i) => i.status === 'IN_CONSULTATION');
      if (currentlyCalling && currentlyCalling.token_number !== previousCallingRef.current) {
        previousCallingRef.current = currentlyCalling.token_number;
        setLastCalledToken(currentlyCalling.token_number);
        setCallAlertPulse(true);
        playChime();
        setTimeout(() => setCallAlertPulse(false), 5000);
      }
    } catch (err) {
      console.error('Failed to update waiting lounge queue:', err);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const inConsultationList = queue.filter((q) => q.status === 'IN_CONSULTATION');
  const waitingList = queue.filter((q) => q.status === 'CHECKED_IN');
  const activeCalling = inConsultationList[0] || null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none overflow-hidden">
      {/* 1. KIOSK HEADER */}
      <header className="bg-slate-900 border-b border-cyan-500/30 px-6 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Activity className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>AURA SUPERSPECIALITY HOSPITAL</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                OPD LOUNGE SIGNAGE
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Outpatient Department &bull; Digital Queue Calling System &bull; Ground & 1st Floor
            </p>
          </div>
        </div>

        {/* Right side: Clock, audio toggle & fullscreen */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-right">
            <Clock className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-sm font-mono font-bold text-white leading-tight">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-[10px] text-slate-400 font-medium uppercase">
                {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playChime();
            }}
            className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title={soundEnabled ? 'Mute Chime' : 'Enable Chime'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-cyan-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30 transition"
            title="Toggle TV Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* 2. MAIN DISPLAY CONTENT */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* LEFT / CENTER COLUMN: NOW CALLING (Large Hero Banner) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div
            className={`flex-1 rounded-3xl p-8 border-2 transition-all duration-500 flex flex-col justify-between relative overflow-hidden shadow-2xl ${
              callAlertPulse
                ? 'bg-gradient-to-br from-cyan-950 via-slate-900 to-blue-950 border-cyan-400 ring-8 ring-cyan-500/20'
                : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            {/* Top Badge */}
            <div className="flex items-center justify-between">
              <span className="px-4 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs sm:text-sm font-extrabold uppercase tracking-widest flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                NOW CALLING &bull; PROCEED TO CONSULTATION ROOM
              </span>
              <span className="text-xs font-mono text-slate-400">
                {activeCalling ? 'Active Consultation' : 'Waiting for Next Call'}
              </span>
            </div>

            {/* Huge Token Callout */}
            {activeCalling ? (
              <div className="my-auto py-6 text-center space-y-4">
                <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                  OPD Queue Token
                </div>
                <div className="text-7xl sm:text-9xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-blue-400 drop-shadow-lg">
                  #{String(activeCalling.token_number || '').replace(/^(token\s*#*|#)+/i, '').trim()}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {activeCalling.patient_name}
                </div>
                {activeCalling.patient_mrn && (
                  <div className="text-sm font-mono text-cyan-400/80 font-bold">
                    UHID / MRN: {activeCalling.patient_mrn}
                  </div>
                )}
              </div>
            ) : (
              <div className="my-auto py-12 text-center space-y-4">
                <Stethoscope className="w-20 h-20 text-slate-700 mx-auto animate-bounce" />
                <div className="text-2xl font-bold text-slate-400">
                  Doctor Consultation Room is Ready
                </div>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Patients with checked-in tokens will be announced and displayed here in sequence. Please watch this screen.
                </p>
              </div>
            )}

            {/* Room & Doctor Box */}
            {activeCalling && (
              <div className="grid grid-cols-2 gap-4 p-5 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <span>Consultation Room</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono mt-1">
                    {activeCalling.room_number || 'Room 102 • Wing A'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-emerald-400" />
                    <span>Consulting Physician</span>
                  </div>
                  <div className="text-base sm:text-lg font-bold text-white mt-1 truncate">
                    Dr. {activeCalling.doctor_name || 'Staff Physician'}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {activeCalling.department_name || 'General Medicine'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Additional Active Rooms Summary if multiple doctors are consulting */}
          {inConsultationList.length > 1 && (
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <h3 className="text-xs font-bold uppercase text-slate-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>Other Active Consultations in Progress</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {inConsultationList.slice(1).map((item) => (
                  <div key={item.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-base font-bold text-cyan-400">Token #{String(item.token_number || '').replace(/^(token\s*#*|#)+/i, '').trim()}</span>
                      <div className="text-xs font-semibold text-white">{item.patient_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-amber-300 font-mono font-bold">{item.room_number || 'OPD Room'}</div>
                      <div className="text-[11px] text-slate-400">Dr. {item.doctor_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: WAITING QUEUE LIST */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <span>Next in Waiting Lounge ({waitingList.length})</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">Estimated Order</span>
          </div>

          <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-3xl p-4 overflow-y-auto space-y-2.5">
            {waitingList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto" />
                <p className="text-sm font-semibold text-slate-400">Queue is Clear</p>
                <p className="text-xs text-slate-600">No patients currently waiting in the lounge.</p>
              </div>
            ) : (
              waitingList.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                    index === 0
                      ? 'bg-amber-500/10 border-amber-500/30 text-white'
                      : 'bg-slate-950 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono font-black text-lg ${
                        index === 0
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                          : 'bg-slate-800 text-cyan-400'
                      }`}
                    >
                      #{String(item.token_number || '').replace(/^(token\s*#*|#)+/i, '').trim()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{item.patient_name}</span>
                        {index === 0 && (
                          <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            Up Next
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        Dr. {item.doctor_name} &bull; {item.department_name || 'OPD'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-slate-400 block">
                      {item.wait_minutes ? `Wait ~${item.wait_minutes}m` : 'Checked In'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Slot: {item.time_slot || 'Walk-In'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* 3. SCROLLING MARQUEE FOOTER TICKER */}
      <footer className="bg-slate-900 border-t border-slate-800 py-2.5 px-6 flex items-center overflow-hidden">
        <div className="shrink-0 font-black text-xs uppercase tracking-wider text-cyan-400 flex items-center gap-2 mr-4">
          <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>HOSPITAL NOTICE:</span>
        </div>
        <div className="overflow-hidden whitespace-nowrap w-full">
          <div className="inline-block animate-marquee text-xs text-slate-300 font-medium">
            Welcome to Aura Superspeciality Hospital. &bull; Please keep your Token Slip and Government ID handy. &bull; Priority triage is allocated to emergency, senior citizens, and pediatric patients. &bull; For pharmacy pickup and diagnostic test results, please visit the Central Ground Floor Atrium. &bull; Emergency Hotline: 108 / +91 22 2654 0100.
          </div>
        </div>
      </footer>
    </div>
  );
};
