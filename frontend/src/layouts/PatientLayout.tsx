import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Calendar,
  FileText,
  Pill,
  CreditCard,
  LogOut,
  PhoneCall,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import clsx from 'clsx';

export const PatientLayout: React.FC = () => {
  const { userProfile, patientProfile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    { label: 'Health Overview', path: '/patient/dashboard', icon: Activity },
    { label: 'My Appointments', path: '/patient/appointments', icon: Calendar },
    { label: 'Digital Prescriptions', path: '/patient/prescriptions', icon: Pill },
    { label: 'Diagnostic Reports', path: '/patient/lab-reports', icon: FileText },
    { label: 'Billing & Invoices', path: '/patient/billing', icon: CreditCard },
  ];

  const handleSignOut = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Emergency Helpline Banner */}
      <div className="bg-gradient-to-r from-teal-950/90 via-slate-900 to-teal-950/90 border-b border-teal-500/20 py-2 px-3 sm:px-4 text-center text-xs text-slate-300 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
        <span className="flex items-center gap-1.5 text-teal-400 font-medium text-[11px] sm:text-xs">
          <PhoneCall className="w-3.5 h-3.5 shrink-0" />
          <span>24x7 Emergency Helpline: <strong>+91 22 2654 0100 / 108</strong></span>
        </span>
        <span className="hidden md:inline text-slate-500">&bull;</span>
        <span className="hidden md:inline text-slate-400 text-xs">
          Ambulance & Critical Care Trauma Available 24x7
        </span>
      </div>

      {/* Main Patient Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Brand */}
          <Link to="/patient/dashboard" className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-teal-500/20 shrink-0">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-white block text-sm sm:text-base leading-tight">
                AURA Care
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-teal-400 leading-tight block">
                Patient Portal
              </span>
            </div>
          </Link>

          {/* Right: Patient Profile and Sign Out */}
          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            <div className="hidden sm:flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 max-w-[200px] truncate">
              <UserCheck className="w-4 h-4 text-teal-400 shrink-0" />
              <div className="truncate">
                <span className="text-white font-medium block truncate text-xs">
                  {userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name}` : 'Patient'}
                </span>
                <span className="text-[10px] text-teal-400 font-mono block truncate">
                  {patientProfile?.medical_record_number || 'UHID: Registered'}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Bar for Patient Tabs */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 border-t border-slate-800/60 overflow-x-auto custom-scrollbar">
          <nav className="flex space-x-1.5 py-2 min-w-max">
            {navLinks.map((tab) => {
              const Icon = tab.icon;
              const isActive = location.pathname === tab.path;

              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0',
                    isActive
                      ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  )}
                >
                  <Icon className={clsx('w-4 h-4 shrink-0', isActive ? 'text-teal-400' : 'text-slate-500')} />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 bg-slate-950 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p>&copy; {new Date().getFullYear()} AURA Multi-Specialty Healthcare Systems. All medical data encrypted.</p>
          <div className="flex items-center gap-3 text-[11px] sm:text-xs">
            <span className="text-teal-400">Asia/Kolkata</span>
            <span>&bull;</span>
            <span className="text-slate-400">Currency: INR (₹)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
