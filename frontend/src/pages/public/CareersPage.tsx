import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Building2,
  Clock,
  GraduationCap,
  CheckCircle2,
  ArrowLeft,
  Send,
  X,
  Stethoscope,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { operationsHrService } from '../../services/api';

export const CareersPage: React.FC = () => {
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Application modal
  const [selectedVacancy, setSelectedVacancy] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [applicantForm, setApplicantForm] = useState({
    candidate_name: '',
    email: '',
    phone: '',
    qualification: '',
    experience_years: 1,
    resume_url: '',
  });

  const loadVacancies = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await operationsHrService.getVacancies({ status: 'OPEN' });
      const list = Array.isArray(data) ? data : data?.results || [];
      setVacancies(list);
    } catch (err: any) {
      console.error('Failed to load vacancies:', err);
      setError('Unable to load current career openings. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVacancies();
  }, []);

  const handleApplyClick = (vacancy: any) => {
    setSelectedVacancy(vacancy);
    setSubmitSuccess(false);
    setFormError(null);
    setApplicantForm({
      candidate_name: '',
      email: '',
      phone: '',
      qualification: '',
      experience_years: vacancy.experience_years_min || 1,
      resume_url: '',
    });
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVacancy) return;
    setSubmitting(true);
    setFormError(null);

    try {
      await operationsHrService.createApplication({
        vacancy: selectedVacancy.id,
        candidate_name: applicantForm.candidate_name,
        email: applicantForm.email,
        phone: applicantForm.phone,
        qualification: applicantForm.qualification,
        experience_years: applicantForm.experience_years,
        resume_url: applicantForm.resume_url,
        status: 'APPLIED',
      });
      setSubmitSuccess(true);
    } catch (err: any) {
      console.error('Failed to submit application:', err);
      setFormError(err.response?.data?.error || 'Failed to submit application. Please check your inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Return to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-600/20">
                <Stethoscope className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight text-white">AURA Multi-Specialty Hospital</span>
                <span className="text-[10px] text-cyan-400 font-mono block">Careers & Recruitment Portal</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link
              to="/staff/login"
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition font-medium"
            >
              Staff Login →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="border-b border-slate-800/80 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>NABH Accredited Clinical Excellence</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Build Your Clinical Career With Us
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Explore verified career opportunities across clinical departments, intensive care units, diagnostic laboratories, and hospital administration.
          </p>
        </div>
      </section>

      {/* Main Vacancy Directory */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-cyan-400" />
              Active Hospital Job Openings
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Current positions actively recruiting at AURA Central Hospital
            </p>
          </div>
          <span className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 font-mono text-xs font-bold self-start sm:self-auto">
            {vacancies.length} Active Opening{vacancies.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Loading active hospital openings...
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center text-xs">
            {error}
          </div>
        ) : vacancies.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
              <Briefcase className="w-6 h-6" />
            </div>
            <div className="font-semibold text-white text-base">No Open Vacancies Currently Published</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              All clinical and administrative positions are currently staffed. When departmental staffing requisitions are approved and published by the Human Resources department, they will be listed here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vacancies.map((v) => (
              <div
                key={v.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-white text-base leading-snug">{v.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{v.department_name || v.department}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold font-mono shrink-0">
                      {v.vacancies_count} Openings
                    </span>
                  </div>

                  {v.description && (
                    <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                      {v.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 text-[11px] text-slate-400 border-t border-slate-800/60">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Min {v.experience_years_min || 0} Years Experience</span>
                    </div>
                    {v.requirements && (
                      <div className="flex items-center gap-1 text-cyan-300/80">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[200px]">{v.requirements}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleApplyClick(v)}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-cyan-600/20"
                  >
                    <span>Apply for Position</span>
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Application Modal */}
      {selectedVacancy && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base">Application Submission</h3>
                <p className="text-xs text-cyan-400 mt-0.5">{selectedVacancy.title}</p>
              </div>
              <button
                onClick={() => setSelectedVacancy(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-base">Application Submitted Successfully!</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Thank you for applying. Your application has been registered in our recruitment database with initial status <strong>"Application Received"</strong>. The Human Resources department will review your profile.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedVacancy(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitApplication} className="space-y-3 text-xs">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="text-slate-400 font-medium block mb-1">Full Legal Name *</label>
                  <input
                    required
                    type="text"
                    value={applicantForm.candidate_name}
                    onChange={(e) => setApplicantForm({ ...applicantForm, candidate_name: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    placeholder="e.g. Dr. Rajesh Kumar / Sneha Nair"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Email Address *</label>
                    <input
                      required
                      type="email"
                      value={applicantForm.email}
                      onChange={(e) => setApplicantForm({ ...applicantForm, email: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                      placeholder="applicant@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Phone Number *</label>
                    <input
                      required
                      type="text"
                      value={applicantForm.phone}
                      onChange={(e) => setApplicantForm({ ...applicantForm, phone: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Highest Qualification *</label>
                    <input
                      required
                      type="text"
                      value={applicantForm.qualification}
                      onChange={(e) => setApplicantForm({ ...applicantForm, qualification: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                      placeholder="MBBS, MD, B.Sc Nursing, etc."
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Total Experience (Years) *</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.5"
                      value={applicantForm.experience_years}
                      onChange={(e) => setApplicantForm({ ...applicantForm, experience_years: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1">Resume / Portfolio / LinkedIn URL</label>
                  <input
                    type="url"
                    value={applicantForm.resume_url}
                    onChange={(e) => setApplicantForm({ ...applicantForm, resume_url: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    placeholder="https://drive.google.com/... or LinkedIn"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedVacancy(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl flex items-center gap-1.5"
                  >
                    {submitting ? 'Submitting Application...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>© 2026 AURA Multi-Specialty Hospital. All clinical and employment records are governed by hospital HR compliance policies.</p>
      </footer>
    </div>
  );
};

