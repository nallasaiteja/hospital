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
  Languages,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { LanguageSelector } from '../components/common/LanguageSelector';
import clsx from 'clsx';

export const PatientLayout: React.FC = () => {
  const { t } = useTranslation();
  const { userProfile, patientProfile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navLinks = [
    { label: 'Health Overview', translationKey: 'navigation.healthOverview', path: '/patient/dashboard', icon: Activity },
    { label: 'My Appointments', translationKey: 'navigation.myAppointments', path: '/patient/appointments', icon: Calendar },
    { label: 'Digital Prescriptions', translationKey: 'navigation.prescriptionsTab', path: '/patient/prescriptions', icon: Pill },
    { label: 'Diagnostic Reports', translationKey: 'navigation.labReportsTab', path: '/patient/lab-reports', icon: FileText },
    { label: 'Billing & Invoices', translationKey: 'navigation.billingTab', path: '/patient/billing', icon: CreditCard },
    { label: 'Voice Translation', translationKey: 'navigation.voiceTranslation', path: '/patient/voice-translation', icon: Languages },
  ];

  const handleSignOut = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col selection:bg-teal-600 selection:text-white">
      {/* Emergency Helpline Banner */}
      <div className="bg-teal-50 border-b border-teal-200 py-2 px-3 sm:px-4 text-center text-xs text-teal-900 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
        <span className="flex items-center gap-1.5 text-teal-800 font-medium text-[11px] sm:text-xs">
          <PhoneCall className="w-3.5 h-3.5 shrink-0 text-teal-600" />
          <span>{t('common.emergencyHelpline', '24x7 Emergency Helpline')}: <strong className="text-teal-950">+91 22 2654 0100 / 108</strong></span>
        </span>
        <span className="hidden md:inline text-teal-300">&bull;</span>
        <span className="hidden md:inline text-teal-700 text-xs">
          {t('common.ambulanceAvailable', 'Ambulance & Critical Care Trauma Available 24x7')}
        </span>
      </div>

      {/* Main Patient Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Brand */}
          <Link to="/patient/dashboard" className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white flex items-center justify-center font-bold shadow-md shadow-teal-500/20 shrink-0">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-slate-900 block text-sm sm:text-base leading-tight">
                AURA Care
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-teal-700 leading-tight block">
                {t('navigation.patientPortal', 'Patient Portal')}
              </span>
            </div>
          </Link>

          {/* Right: Language Selector, Patient Profile and Sign Out */}
          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            {/* Global Language Selector */}
            <LanguageSelector variant="compact" />

            <div className="hidden sm:flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 max-w-[200px] truncate shadow-sm">
              <UserCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <div className="truncate">
                <span className="text-slate-900 font-medium block truncate text-xs">
                  {userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name}` : t('auth.patient', 'Patient')}
                </span>
                <span className="text-[10px] text-teal-700 font-mono block truncate font-medium">
                  {patientProfile?.medical_record_number || 'UHID: Registered'}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition shrink-0 border border-slate-200 font-medium"
              title={t('auth.signOut', 'Sign Out')}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{t('auth.signOut', 'Sign Out')}</span>
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Bar for Patient Tabs */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 border-t border-slate-200 overflow-x-auto custom-scrollbar">
          <nav className="flex space-x-1.5 py-2 min-w-max">
            {navLinks.map((tab) => {
              const Icon = tab.icon;
              const isActive = location.pathname === tab.path;
              const displayLabel = tab.translationKey ? t(tab.translationKey) : tab.label;

              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0',
                    isActive
                      ? 'bg-teal-50 text-teal-800 border border-teal-200 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  )}
                >
                  <Icon className={clsx('w-4 h-4 shrink-0', isActive ? 'text-teal-700' : 'text-slate-400')} />
                  <span>{displayLabel}</span>
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
      <footer className="border-t border-slate-200 py-6 bg-white text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p>&copy; {new Date().getFullYear()} AURA Multi-Specialty Healthcare Systems. All medical data encrypted.</p>
          <div className="flex items-center gap-3 text-[11px] sm:text-xs">
            <span className="text-teal-700 font-medium">Asia/Kolkata</span>
            <span>&bull;</span>
            <span className="text-slate-500">{t('common.currencyINR', 'Currency: INR (₹)')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
