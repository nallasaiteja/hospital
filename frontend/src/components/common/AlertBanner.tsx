import React from 'react';
import { Info, AlertTriangle, AlertCircle, CheckCircle, X, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

export type AlertType = 'info' | 'warning' | 'error' | 'success';

interface AlertBannerProps {
  type?: AlertType;
  variant?: AlertType;
  title?: string;
  message: string;
  onDismiss?: () => void;
  onClose?: () => void;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type,
  variant,
  title,
  message,
  onDismiss,
  onClose,
  onRetry,
  retryLabel = 'Retry',
  className,
}) => {
  const alertType: AlertType = variant || type || 'info';
  const handleClose = onDismiss || onClose;

  const styles: Record<AlertType, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      text: 'text-blue-300',
      icon: <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />,
    },
    warning: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-300',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
    },
    error: {
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      text: 'text-rose-300',
      icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
    },
    success: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      text: 'text-emerald-300',
      icon: <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
    },
  };

  const current = styles[alertType];

  return (
    <div
      role="alert"
      className={clsx(
        'p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs leading-relaxed',
        current.bg,
        current.border,
        current.text,
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        {current.icon}
        <div>
          {title && <h4 className="font-semibold mb-0.5 text-white">{title}</h4>}
          <span>{message}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition border border-slate-700/80"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{retryLabel}</span>
          </button>
        )}
        {handleClose && (
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-0.5 rounded transition shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
