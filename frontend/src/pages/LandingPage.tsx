import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  HeartPulse,
  PhoneCall,
  Stethoscope,
  Building2,
  Pill,
  Users,
  ShieldCheck,
  CalendarCheck,
  Clock,
  MapPin,
  ChevronRight,
  Award,
  Lock,
  UserCheck,
  FileText,
  HeartHandshake,
  CheckCircle2,
  Syringe,
  Microscope,
  Baby,
  Brain,
  Bone,
  Menu,
  X
} from 'lucide-react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '../components/common/LanguageSelector';

export const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Check backend health
    api.get('/core/info/')
      .then(() => setApiStatus('online'))
      .catch(() => {
        api.get('/health/')
          .then(() => setApiStatus('online'))
          .catch(() => setApiStatus('offline'));
      });
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col selection:bg-teal-600 selection:text-white">
      {/* 1. Top Emergency Care & 24/7 Trauma Hotline Bar */}
      <div className="bg-slate-50 border-b border-slate-200 text-slate-600 px-3 sm:px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-rose-600 font-bold text-[11px] sm:text-xs">
            <PhoneCall className="w-3.5 h-3.5 animate-pulse shrink-0 text-rose-500" />
            <span>{t('landing.hotline', '24/7 Emergency Hotline: +1 (800) 432-AURA / (080) 4123-4567')}</span>
          </div>
          <span className="hidden xl:inline text-slate-300">|</span>
          <span className="hidden xl:flex items-center gap-1.5 text-teal-700 font-medium">
            <Activity className="w-3.5 h-3.5" />
            <span>{t('landing.hotlineCathLab', 'Emergency Resuscitation & Cardiac Cath Lab Operational 24/7')}</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-3 text-slate-500 text-[11px]">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-teal-600" />
            <span>{t('landing.mainCampus', 'Main Campus, Medical Enclave')}</span>
          </span>
          <span className="text-slate-300">&bull;</span>
          <span className="text-slate-700 font-semibold">{t('landing.opdHours', 'OPD: Mon–Sat 8:00 AM – 8:00 PM')}</span>
        </div>
      </div>

      {/* 2. Main Navigation Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          {/* Hospital Brand Identity */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-teal-600 via-emerald-600 to-cyan-500 flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
              <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-white stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  AURA
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  {t('landing.nabhJci', 'NABH • JCI Accredited')}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate max-w-[170px] sm:max-w-none">
                {t('landing.multiSpecialty', 'Multi-Specialty Hospital & Research')}
              </p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <a href="#clinical-specialties" className="hover:text-teal-700 transition">{t('landing.navSpecialties', 'Clinical Specialties')}</a>
            <a href="#patient-services" className="hover:text-teal-700 transition">{t('landing.navPatientCare', 'Patient Care')}</a>
            <a href="#hospital-facilities" className="hover:text-teal-700 transition">{t('landing.navFacilities', 'ICU & Facilities')}</a>
          </nav>

          {/* Action Portals Buttons (Desktop/Tablet) */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Global Language Selector */}
            <LanguageSelector variant="compact" />

            <Link
              to="/careers"
              className="px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 transition"
            >
              Careers
            </Link>
            <Link
              to="/patient/login"
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition"
            >
              {t('navigation.patientPortal', 'Patient Portal')}
            </Link>
            <Link
              to="/staff/login"
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-md shadow-teal-600/20 transition flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-white" />
              <span>{t('auth.staffGateway', 'Staff Gateway')}</span>
            </Link>
          </div>

          {/* Mobile Right Controls: Language Selector & Hamburger */}
          <div className="flex items-center gap-2 sm:hidden shrink-0">
            <LanguageSelector variant="compact" />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center shrink-0"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Drawer */}
        {isMobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3 shadow-lg">
            <nav className="flex flex-col space-y-1.5 text-xs font-medium text-slate-600">
              <a
                href="#clinical-specialties"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2.5 rounded-xl hover:bg-slate-50 hover:text-teal-700 transition"
              >
                {t('landing.navSpecialties', 'Clinical Specialties')}
              </a>
              <a
                href="#patient-services"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2.5 rounded-xl hover:bg-slate-50 hover:text-teal-700 transition"
              >
                {t('landing.navTraumaCare', 'Patient Care & 24/7 Trauma')}
              </a>
              <a
                href="#hospital-facilities"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2.5 rounded-xl hover:bg-slate-50 hover:text-teal-700 transition"
              >
                {t('landing.navInfrastructure', 'ICU & Medical Infrastructure')}
              </a>
            </nav>

            <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
              <Link
                to="/patient/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 shadow-sm"
              >
                {t('navigation.patientPortal', 'Patient Portal Login')}
              </Link>
              <Link
                to="/staff/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-600 to-emerald-600 text-white flex items-center justify-center gap-1.5 shadow-md shadow-teal-600/20"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{t('auth.staffGateway', 'Staff Gateway')}</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* 3. Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-20 lg:pt-24 lg:pb-28 bg-gradient-to-b from-cyan-50/50 via-white to-white">
          {/* Subtle Ambient Light Gradients */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] max-w-[90vw] h-[500px] bg-teal-100/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/4 right-1/4 w-[450px] max-w-[70vw] h-[450px] bg-cyan-100/40 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            {/* Accreditation Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-teal-800 text-[11px] sm:text-xs font-semibold mb-6 shadow-sm max-w-full truncate">
              <Award className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="truncate">{t('landing.accreditationBadge', 'Ranked Among Top Multi-Specialty Healthcare Centers')}</span>
            </div>

            {/* Inspiring Clinical Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto text-slate-900 leading-tight">
              {t('landing.heroHeadline', 'Advanced Medicine. Compassionate Healing. Trusted For Every Life.')}
            </h1>

            {/* Hospital Overview Copy */}
            <p className="mt-4 sm:mt-6 text-sm sm:text-lg lg:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              {t('landing.heroSubtitle', 'Welcome to AURA Multi-Specialty Hospital & Research Institute. We combine renowned clinical faculty, state-of-the-art robotic surgical suites, comprehensive inpatient critical care, and round-the-clock emergency response to deliver benchmark clinical excellence.')}
            </p>

            {/* Key Action Buttons */}
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto">
              <Link
                to="/patient/register"
                className="w-full sm:w-auto px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-teal-600/25 transition flex items-center justify-center gap-2"
              >
                <CalendarCheck className="w-4 h-4 shrink-0" />
                <span>{t('landing.bookConsultation', 'Book Doctor Consultation')}</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </Link>
              <Link
                to="/patient/login"
                className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm border border-slate-200 transition flex items-center justify-center gap-2 shadow-sm hover:border-teal-500/40"
              >
                <Lock className="w-4 h-4 text-teal-600 shrink-0" />
                <span>{t('landing.viewReports', 'View Diagnostic Reports')}</span>
              </Link>
            </div>

            {/* Real Hospital Trust Statistics */}
            <div className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
              <div className="p-3.5 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 block">{t('landing.statsBeds', '650+')}</span>
                <span className="text-[11px] sm:text-xs text-teal-700 font-semibold mt-1 block">{t('landing.statsBedsLabel', 'Inpatient Beds')}</span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 block">{t('landing.statsBedsSub', 'Dedicated ICUs & NICU')}</span>
              </div>
              <div className="p-3.5 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 block">{t('landing.statsSpecialties', '45+')}</span>
                <span className="text-[11px] sm:text-xs text-teal-700 font-semibold mt-1 block">{t('landing.statsSpecialtiesLabel', 'Specialties')}</span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 block">{t('landing.statsSpecialtiesSub', 'Super-Specialists')}</span>
              </div>
              <div className="p-3.5 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 block">{t('landing.statsRecovery', '99.4%')}</span>
                <span className="text-[11px] sm:text-xs text-teal-700 font-semibold mt-1 block">{t('landing.statsRecoveryLabel', 'Recovery Rate')}</span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 block">{t('landing.statsRecoverySub', 'NABH Benchmark')}</span>
              </div>
              <div className="p-3.5 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm text-center">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 block">{t('landing.statsTrauma', '24/7')}</span>
                <span className="text-[11px] sm:text-xs text-rose-600 font-semibold mt-1 block">{t('landing.statsTraumaLabel', 'Trauma Care')}</span>
                <span className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 block">{t('landing.statsTraumaSub', 'Cath Lab Operational')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Emergency & Quick Patient Care Services Ribbon */}
        <section id="patient-services" className="py-10 sm:py-12 bg-slate-50 border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{t('landing.emergencyTitle', '24/7 Level-1 Emergency & Trauma')}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t('landing.emergencyDesc', 'Immediate resuscitation bays, acute stroke team, and on-site cardiac catheterization lab ready 24/7.')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center shrink-0">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{t('landing.instantOpdTitle', 'Instant OPD Appointments')}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t('landing.instantOpdDesc', 'Book top clinical consultants, choose time slots, and access digital consultation tokens online.')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                  <Microscope className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{t('landing.diagnosticTitle', 'Automated Diagnostic Reports')}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t('landing.diagnosticDesc', 'NABL accredited pathology, 3T MRI, CT imaging, and secure online report access via Patient Portal.')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{t('landing.cashlessTitle', 'Cashless Insurance & TPA Desk')}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t('landing.cashlessDesc', '100% cashless hospitalization tie-ups with all major health insurance providers and corporate TPAs.')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Clinical Centers of Excellence */}
        <section id="clinical-specialties" className="py-12 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-white">
          <div className="text-center mb-10 sm:mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-800 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 inline-block mb-3">
              {t('landing.specializedBadge', 'Specialized Healthcare')}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {t('landing.centersTitle', 'Clinical Centers of Excellence')}
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed">
              {t('landing.centersSubtitle', 'Our multidisciplinary institutes combine senior clinical leadership, research innovation, and high-precision surgical infrastructure.')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md transition group shadow-sm">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
                <HeartPulse className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base group-hover:text-teal-700 transition">{t('landing.heartTitle', 'Heart & Vascular Institute')}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {t('landing.heartDesc', 'Primary angioplasty (PCI), minimally invasive bypass (CABG), cardiac electrophysiology, and 24/7 CCU.')}
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md transition group shadow-sm">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center mb-4">
                <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base group-hover:text-teal-700 transition">{t('landing.neuroTitle', 'Neurosciences & Stroke Care')}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {t('landing.neuroDesc', 'Microsurgical brain and spine tumor resections, hyper-acute stroke thrombolysis, and Neuro-ICU.')}
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md transition group shadow-sm">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base group-hover:text-teal-700 transition">{t('landing.cancerTitle', 'Comprehensive Cancer Care')}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {t('landing.cancerDesc', 'Multi-disciplinary tumor boards, surgical oncology, targeted immunotherapy, and daycare chemotherapy.')}
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md transition group shadow-sm">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center mb-4">
                <Bone className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base group-hover:text-teal-700 transition">{t('landing.orthoTitle', 'Orthopaedics & Joint Surgery')}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {t('landing.orthoDesc', 'Robotic-assisted total knee and hip replacement, arthroscopic reconstruction, and complex trauma care.')}
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md transition group shadow-sm">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-pink-50 text-pink-700 flex items-center justify-center mb-4">
                <Baby className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base group-hover:text-teal-700 transition">{t('landing.pediatricsTitle', 'Pediatrics & Level-III NICU')}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {t('landing.pediatricsDesc', 'High-frequency infant ventilator care, pediatric surgery, developmental subspecialties, and 24/7 pediatric emergency.')}
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md transition group shadow-sm">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base group-hover:text-teal-700 transition">{t('landing.criticalCareTitle', 'Critical Care & Pulmonology')}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {t('landing.criticalCareDesc', 'Multi-bed ICU and ECMO support, advanced mechanical ventilation, video bronchoscopy, and septic shock management.')}
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md transition group shadow-sm">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center mb-4">
                <Pill className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base group-hover:text-teal-700 transition">{t('landing.gastroTitle', 'Gastroenterology & GI Surgery')}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {t('landing.gastroDesc', 'Therapeutic ERCP, endoscopic ultrasound, minimal access laparoscopic abdominal surgery, and hepatology.')}
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md transition group shadow-sm">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-4">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base group-hover:text-teal-700 transition">{t('landing.nephroTitle', 'Nephrology & Dialysis Unit')}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {t('landing.nephroDesc', '24/7 maintenance hemodialysis, CRRT for ICU inpatients, peritoneal dialysis, and kidney transplant programs.')}
              </p>
            </div>
          </div>
        </section>

        {/* 6. Dedicated Portals Gateway (Patient & Staff) */}
        <section className="py-12 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-white">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {t('landing.portalsTitle', 'Hospital Digital Portals')}
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
              {t('landing.portalsSubtitle', 'Dedicated self-service for patients, and secure role-based Clinical Information System (CIS) for verified healthcare staff.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto text-left">
            {/* Patient Care Portal Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 hover:border-teal-500 transition group shadow-lg flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center mb-6 shadow-sm">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">{t('landing.patientPortalTitle', 'MyAura Patient Care Portal')}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                  {t('landing.patientPortalDesc', 'Self-service healthcare portal for patients and families. Schedule doctor consultations, review e-prescriptions, download laboratory reports, and settle hospital invoices securely.')}
                </p>
                <div className="space-y-2 mb-8 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
                    <span>{t('landing.patientFeature1', 'Public patient registration with phone & email verification')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
                    <span>{t('landing.patientFeature2', 'Online appointment booking & OPD token tracking')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
                    <span>{t('landing.patientFeature3', 'Digital prescriptions, diagnostic lab results & billing invoices')}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col xs:flex-row items-center gap-3">
                <Link
                  to="/patient/login"
                  className="w-full xs:flex-1 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-center text-xs transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/20"
                >
                  <span>{t('landing.loginPatient', 'Login to Patient Portal')}</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/patient/register"
                  className="w-full xs:w-auto py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-center text-xs border border-slate-200 transition"
                >
                  {t('landing.register', 'Register')}
                </Link>
              </div>
            </div>

            {/* Staff Clinical System Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 hover:border-cyan-500 transition group shadow-lg flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-700 flex items-center justify-center mb-6 shadow-sm">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">{t('landing.staffPortalTitle', 'Staff & Clinical EMR Gateway')}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                  {t('landing.staffPortalDesc', 'Administrator-provisioned gateway for Doctors, Nursing Officers, Pharmacists, Lab Technicians, and Hospital Administrators with strict role-based access control (RBAC).')}
                </p>
                <div className="space-y-2 mb-8 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 shrink-0" />
                    <span>{t('landing.staffFeature1', 'Strict admin/invite provisioning with role-based clinical security')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 shrink-0" />
                    <span>{t('landing.staffFeature2', 'Integrated EMR, ICU monitoring, OT scheduling & Pharmacy formulary')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 shrink-0" />
                    <span>{t('landing.staffFeature3', 'Integrated multi-branch governance & NABH compliance audit trails')}</span>
                  </div>
                </div>
              </div>
              <div>
                <Link
                  to="/staff/login"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-center text-xs transition flex items-center justify-center gap-2 shadow-md shadow-cyan-600/20"
                >
                  <Lock className="w-4 h-4 text-white" />
                  <span>{t('landing.enterStaff', 'Enter Staff Clinical Gateway')}</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Hospital Infrastructure & Safety Accreditations */}
        <section id="hospital-facilities" className="py-12 sm:py-16 bg-slate-50 border-t border-slate-200 text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10 sm:mb-12">
              <h3 className="text-xl font-bold text-slate-900">{t('landing.infraTitle', 'Advanced Medical Infrastructure')}</h3>
              <p className="text-xs text-slate-500 mt-1">{t('landing.infraSubtitle', 'Engineered for patient safety, sterile environments, and immediate clinical intervention')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-slate-600">
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <Building2 className="w-6 h-6 text-teal-600 mb-3" />
                <h4 className="font-bold text-slate-900 text-sm mb-1">{t('landing.modularOtTitle', 'Modular Operation Theatres')}</h4>
                <p className="leading-relaxed">
                  {t('landing.modularOtDesc', 'Laminar air-flow system with HEPA filtration, zero-touch doors, integrated C-arm fluoroscopy, and robotic surgical consoles.')}
                </p>
              </div>
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <Activity className="w-6 h-6 text-cyan-600 mb-3" />
                <h4 className="font-bold text-slate-900 text-sm mb-1">{t('landing.icuTitle', 'ICU & Critical Care Beds')}</h4>
                <p className="leading-relaxed">
                  {t('landing.icuDesc', '1:1 nursing monitoring, invasive arterial line monitoring, central nursing station telemetry, and negative pressure isolation suites.')}
                </p>
              </div>
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <Microscope className="w-6 h-6 text-indigo-600 mb-3" />
                <h4 className="font-bold text-slate-900 text-sm mb-1">{t('landing.pathologyTitle', 'Automated Pathology & 3T MRI')}</h4>
                <p className="leading-relaxed">
                  {t('landing.pathologyDesc', 'Fully automated high-throughput biochemistry analyzers, 3T silent MRI scanning, and 128-slice dual-energy CT scanners.')}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 bg-white text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div>
            <p className="font-semibold text-slate-800">{t('landing.footerHospitalName', 'AURA Multi-Specialty Hospital & Research Institute')}</p>
            <p className="mt-1">&copy; {new Date().getFullYear()} {t('landing.footerCopyright', 'AURA Healthcare Systems. Built with precision for NABH clinical compliance.')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] sm:text-xs">
            <Link to="/careers" className="text-cyan-700 hover:text-cyan-800 font-semibold transition">
              Careers & Job Openings
            </Link>
            <span>&bull;</span>
            <span className="text-teal-700 font-medium">{t('landing.footerApiStatus', 'Backend API')}: {apiStatus}</span>
            <span>&bull;</span>
            <span className="text-slate-500">{t('landing.footerTimezone', 'Timezone: Asia/Kolkata')}</span>
            <span>&bull;</span>
            <span className="text-slate-500">{t('landing.footerCurrency', 'Currency: INR (₹)')}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
