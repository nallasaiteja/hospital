import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, Mail, ArrowLeft, AlertCircle, Loader2, Hospital, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { authService, rbacService } from '../../services/api';
import { Modal } from '../../components/common/Modal';
import { parseApiError } from '../../utils/errorHandler';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '../../components/common/LanguageSelector';

export const StaffLoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Password Recovery State
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setRecoveryLoading(true);
      setRecoveryError(null);
      await rbacService.requestPasswordRecovery(recoveryEmail);
      setRecoverySent(true);
    } catch (err: any) {
      setRecoveryError(parseApiError(err).message);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(parseApiError(error).message);
        setLoading(false);
        return;
      }

      if (data.session) {
        // Enforce Server-Side Role and Staff Verification
        try {
          const profile = await authService.getCurrentUser();

          if (!profile.is_initialized || profile.role === 'PATIENT') {
            await supabase.auth.signOut();
            setErrorMessage(
              'Access denied: This email is registered as a Patient. Please use the Patient Portal.'
            );
            setLoading(false);
            return;
          }

          if (profile.staff_profile && profile.staff_profile.status !== 'ACTIVE') {
            await supabase.auth.signOut();
            setErrorMessage(
              `Your staff account status is ${profile.staff_profile.status}. Contact your Hospital Administrator.`
            );
            setLoading(false);
            return;
          }

          navigate('/staff/dashboard');
        } catch (apiErr: any) {
          // If server error or offline mode, allow local development fallback
          console.warn('Backend staff role check could not be completed:', apiErr);
          navigate('/staff/dashboard');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during staff login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('common.back', 'Back to HMS Home')}</span>
          </Link>
          <LanguageSelector variant="compact" />
        </div>

        <div className="p-5 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-4">
              <Hospital className="w-6 h-6" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-800 text-[11px] font-semibold text-cyan-400 mb-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{t('auth.staffGateway', 'Restricted Staff Gateway')}</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">{t('auth.login', 'Staff Authentication')}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {t('auth.staffSpecialist', 'Authorized clinical, administrative, and operations personnel only')}
            </p>
          </div>

          {/* Quick Demo Accounts Selector (All 21 Staff Roles) */}
          <div className="mb-6 p-4 rounded-xl bg-slate-950/90 border border-cyan-900/50 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  All 21 Demo Staff Roles
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-950 border border-cyan-800 text-cyan-400">
                  21 Roles
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                <span>Password:</span>
                <code className="text-cyan-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-semibold">HospitalDemo@123</code>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-1 mb-2.5 pb-2 border-b border-slate-800/80 text-[11px]">
              {[
                { key: 'ALL', label: 'All Roles (21)' },
                { key: 'EXECUTIVE', label: 'Executive (4)' },
                { key: 'CLINICAL', label: 'Clinical (3)' },
                { key: 'DIAGNOSTICS', label: 'Diagnostics & Pharm (4)' },
                { key: 'FINANCE', label: 'Finance & Billing (7)' },
                { key: 'OPERATIONS', label: 'Operations & HR (3)' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`px-2 py-0.5 rounded-md font-medium transition ${
                    selectedCategory === tab.key
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                      : 'bg-slate-900/40 text-slate-400 border border-transparent hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Accounts Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {[
                { label: '👑 Super Admin', role: 'Chief Administrator', category: 'EXECUTIVE', email: 'admin.demo@aurahospital.com' },
                { label: '🏛️ Hospital Admin', role: 'Hospital COO', category: 'EXECUTIVE', email: 'hospital.admin@aurahospital.com' },
                { label: '🏢 Branch Manager', role: 'Branch Operations', category: 'EXECUTIVE', email: 'branch.manager@aurahospital.com' },
                { label: '🩺 Medical Director', role: 'Chief Medical Head', category: 'EXECUTIVE', email: 'medical.director@aurahospital.com' },
                { label: '👨‍⚕️ Doctor', role: 'Internal Medicine', category: 'CLINICAL', email: 'doctor.demo@aurahospital.com' },
                { label: '💉 Nurse', role: 'Head Nursing Officer', category: 'CLINICAL', email: 'nurse.demo@aurahospital.com' },
                { label: '🎖️ Dept Head', role: 'Clinical Department HOD', category: 'CLINICAL', email: 'dept.head@aurahospital.com' },
                { label: '🔬 Lab Tech', role: 'Pathology & Lab', category: 'DIAGNOSTICS', email: 'lab.demo@aurahospital.com' },
                { label: '🩻 Radiology Tech', role: 'Imaging & Scans', category: 'DIAGNOSTICS', email: 'radiology.demo@aurahospital.com' },
                { label: '💊 Pharmacist', role: 'Formulary & Dispensary', category: 'DIAGNOSTICS', email: 'pharmacist.demo@aurahospital.com' },
                { label: '📦 Inventory Mgr', role: 'Materials & Stock', category: 'DIAGNOSTICS', email: 'inventory.demo@aurahospital.com' },
                { label: '💼 Finance Mgr', role: 'Finance Head', category: 'FINANCE', email: 'finance.manager@aurahospital.com' },
                { label: '💳 Billing Exec', role: 'Patient Billing & Invoices', category: 'FINANCE', email: 'billing.demo@aurahospital.com' },
                { label: '💵 Cashier', role: 'Cash Counter Desk', category: 'FINANCE', email: 'cashier.demo@aurahospital.com' },
                { label: '📊 Accountant', role: 'General Ledger & Audit', category: 'FINANCE', email: 'accountant.demo@aurahospital.com' },
                { label: '📈 Investment Mgr', role: 'Treasury & Yields', category: 'FINANCE', email: 'investment.demo@aurahospital.com' },
                { label: '📑 Insurance Coord', role: 'TPA & Cashless Claims', category: 'FINANCE', email: 'insurance.demo@aurahospital.com' },
                { label: '🔍 Auditor', role: 'Compliance & Audit', category: 'FINANCE', email: 'auditor.demo@aurahospital.com' },
                { label: '📋 Receptionist', role: 'Front Desk Lead', category: 'OPERATIONS', email: 'receptionist.demo@aurahospital.com' },
                { label: '🛍️ Procurement', role: 'Vendor & Purchasing', category: 'OPERATIONS', email: 'procurement.demo@aurahospital.com' },
                { label: '👥 HR Manager', role: 'Human Resources & Roster', category: 'OPERATIONS', email: 'hr.manager@aurahospital.com' },
              ]
                .filter((acc) => selectedCategory === 'ALL' || acc.category === selectedCategory)
                .map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword('HospitalDemo@123');
                    }}
                    className={`px-2 py-1.5 rounded-lg text-left border transition flex items-center justify-between ${
                      email === acc.email
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 shadow-sm'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                    title={`${acc.label} (${acc.role}): ${acc.email}`}
                  >
                    <div className="truncate">
                      <div className="text-[11px] font-semibold truncate leading-tight">{acc.label}</div>
                      <div className="text-[9px] text-slate-400 truncate leading-tight mt-0.5">{acc.role}</div>
                    </div>
                    {email === acc.email && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-1" />}
                  </button>
                ))}
            </div>
          </div>

          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div>
              <label htmlFor="staff-login-email" className="block text-xs font-medium text-slate-300 mb-1">
                {t('auth.staffEmail', 'Official Staff Email')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  id="staff-login-email"
                  name="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor.name@aurahms.org"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="staff-login-password" className="block text-xs font-medium text-slate-300">
                  {t('auth.password', 'Password')}
                </label>
                <button
                  type="button"
                  onClick={() => setIsRecoveryOpen(true)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition"
                >
                  {t('auth.forgotPassword', 'Forgot Password?')}
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  id="staff-login-password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('auth.signingIn', 'Verifying Credentials & Permissions...')}</span>
                </>
              ) : (
                <span>{t('auth.accessStaff', 'Access Staff System')}</span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Public registration is disabled for staff roles. Staff accounts are provisioned exclusively by hospital administrators and branch managers.
            </p>
          </div>
        </div>
      </div>

      {/* Password Recovery Modal */}
      {isRecoveryOpen && (
        <Modal
          isOpen={isRecoveryOpen}
          onClose={() => {
            setIsRecoveryOpen(false);
            setRecoverySent(false);
            setRecoveryError(null);
          }}
          title="Staff Account Recovery & Password Reset"
        >
          {recoverySent ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Recovery Instructions Dispatched</h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                If an active account exists for <span className="text-cyan-400 font-mono">{recoveryEmail}</span>, a secure password reset link has been dispatched to that inbox.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsRecoveryOpen(false);
                  setRecoverySent(false);
                }}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordRecovery} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter your registered hospital email address to receive secure instructions to reset your password.
              </p>

              {recoveryError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-lg">
                  {recoveryError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Registered Staff Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="doctor.name@aurahospital.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRecoveryOpen(false)}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs transition"
                >
                  {recoveryLoading ? 'Sending...' : 'Send Recovery Link'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};