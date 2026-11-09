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
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-900',
      icon: <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />,
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-900',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
    },
    error: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-900',
      icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
    },
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      icon: <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
    },
  };

  const current = styles[alertType];

  return (
    <div
      role="alert"
      className={clsx(
        'p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs leading-relaxed shadow-2xs',
        current.bg,
        current.border,
        current.text,
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        {current.icon}
        <div>
          {title && <h4 className="font-bold mb-0.5 text-slate-900">{title}</h4>}
          <span className="font-medium">{message}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition border border-slate-300 shadow-2xs"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{retryLabel}</span>
          </button>
        )}
        {handleClose && (
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
