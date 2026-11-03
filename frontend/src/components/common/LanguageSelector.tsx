import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from '../../i18n/i18n';
import { authService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import clsx from 'clsx';

interface LanguageSelectorProps {
  className?: string;
  variant?: 'compact' | 'full' | 'inline';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className,
  variant = 'compact',
}) => {
  const { i18n, t } = useTranslation();
  const { user, userProfile, updateUserLanguage } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentLang = (i18n.language || 'en').slice(0, 2) as SupportedLanguageCode;
  const currentLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  const handleSelectLanguage = async (code: SupportedLanguageCode) => {
    setIsOpen(false);
    if (code === currentLang) return;

    if (updateUserLanguage) {
      await updateUserLanguage(code);
    } else {
      await i18n.changeLanguage(code);
      try {
        localStorage.setItem('hms_language_preference', code);
      } catch (e) {}
    }
  };

  if (variant === 'full') {
    return (
      <div className={clsx('space-y-2', className)}>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
          {t('common.selectLanguage')}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = currentLang === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleSelectLanguage(lang.code)}
                className={clsx(
                  'flex items-center justify-between p-3 rounded-xl border text-left transition',
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 font-semibold shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <div>
                  <span className="block text-sm font-medium text-white">
                    {lang.nativeName}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {lang.name} ({lang.code.toUpperCase()})
                  </span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Default: Compact Header Dropdown (Fits in navigation bars and mobile headers)
  return (
    <div className={clsx('relative inline-block text-left', className)} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 text-xs font-medium transition active:scale-95 cursor-pointer shadow-sm"
        title={t('common.selectLanguage')}
        aria-label={t('common.selectLanguage')}
        aria-expanded={isOpen}
      >
        <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="font-semibold text-white tracking-wide">
          {currentLangObj.nativeName}
        </span>
        <ChevronDown
          className={clsx(
            'w-3 h-3 text-slate-400 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {t('common.selectLanguage')}
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = currentLang === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleSelectLanguage(lang.code)}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 text-xs text-left transition',
                  isSelected
                    ? 'bg-cyan-500/15 text-cyan-300 font-semibold'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-white text-xs">{lang.nativeName}</span>
                  <span className="text-[10px] text-slate-400">({lang.name})</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
