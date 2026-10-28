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
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-300">
          {label} {props.required && <span className="text-rose-400">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
          <Calendar className="w-4 h-4" />
        </div>
        <input
          type="date"
          id={inputId}
          className={clsx(
            'w-full py-2.5 pl-9 pr-3 rounded-xl bg-slate-950 border text-xs text-white transition focus:outline-none [color-scheme:dark]',
            error
              ? 'border-rose-500/80 focus:border-rose-500'
              : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30',
            props.disabled && 'opacity-50 cursor-not-allowed bg-slate-900',
            className
          )}
          {...props}
        />
      </div>

      {error ? (
        <p className="text-[11px] text-rose-400 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
};
