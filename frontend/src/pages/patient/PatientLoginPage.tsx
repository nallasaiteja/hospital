import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserCheck, Lock, Mail, ArrowLeft, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { authService, rbacService } from '../../services/api';
import { Modal } from '../../components/common/Modal';
import { parseApiError } from '../../utils/errorHandler';

export const PatientLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Explicitly reset fields on mount to prevent stale autofill
    setEmail('');
    setPassword('');
  }, []);

  // Recovery State
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

  const handleLogin = async (e: React.FormEvent) => {
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
      } else if (data.session) {
        // Query backend to verify profile initialization
        try {
          const profile = await authService.getCurrentUser();
          if (!profile.is_initialized) {
            // Lazy-initialize patient profile if missing
            await authService.initPatientProfile({
              gender: 'OTHER',
            });
          }
        } catch (apiErr) {
          console.warn('Could not sync profile during login, continuing with active session:', apiErr);
        }
        navigate('/patient/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to HMS Home</span>
        </Link>

        <div className="p-8 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-xl">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Patient Portal Login</h2>
            <p className="text-xs text-slate-400 mt-1">
              Access your medical records, appointment schedules, and digital prescriptions
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            {/* Hidden dummy fields to neutralize aggressive browser autofill */}
            <input type="text" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" readOnly />
            <input type="password" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" readOnly />

            <div>
              <label htmlFor="patient-login-email" className="block text-xs font-medium text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  id="patient-login-email"
                  name="patient_portal_user_email"
                  autoComplete="off"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="patient-login-password" className="block text-xs font-medium text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsRecoveryOpen(true)}
                  className="text-xs text-teal-400 hover:text-teal-300 transition"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  id="patient-login-password"
                  name="patient_portal_user_secret"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In as Patient</span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-700/60 text-center text-xs text-slate-400">
            <span>Don't have a patient account yet? </span>
            <Link to="/patient/register" className="text-teal-400 font-medium hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>

      {/* Recovery Modal */}
      {isRecoveryOpen && (
        <Modal
          isOpen={isRecoveryOpen}
          onClose={() => {
            setIsRecoveryOpen(false);
            setRecoverySent(false);
            setRecoveryError(null);
          }}
          title="Patient Password Recovery"
        >
          {recoverySent ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Reset Link Dispatched</h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto">
                If an account exists for <span className="text-teal-400 font-mono">{recoveryEmail}</span>, a secure password reset link has been dispatched.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsRecoveryOpen(false);
                  setRecoverySent(false);
                }}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordRecovery} className="space-y-4">
              <p className="text-xs text-slate-400">
                Enter your registered patient email address to receive password reset instructions.
              </p>

              {recoveryError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-lg">
                  {recoveryError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="patient@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-500"
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
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs transition"
                >
                  {recoveryLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};
