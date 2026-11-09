import React from 'react';
import { Calendar } from 'lucide-react';
import clsx from 'clsx';

interface DateFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const DateField: React.FC<DateFieldProps> = ({
  label,
  error,
  helperText,
  className,
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">
          {label} {props.required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Calendar className="w-4 h-4" />
        </div>
        <input
          type="date"
          id={inputId}
          className={clsx(
            'w-full py-2.5 pl-9 pr-3 rounded-xl bg-white border text-sm sm:text-xs text-slate-900 transition focus:outline-none [color-scheme:light] min-h-[42px] shadow-2xs',
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'
              : 'border-slate-300 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/15',
            props.disabled && 'opacity-60 cursor-not-allowed bg-slate-50 text-slate-500',
            className
          )}
          {...props}
        />
      </div>

      {error ? (
        <p className="text-[11px] text-rose-600 mt-1 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
};
