import React from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: LucideIcon;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  icon: Icon,
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
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <input
          id={inputId}
          className={clsx(
            'w-full py-2.5 rounded-xl bg-white border text-sm sm:text-xs text-slate-900 placeholder-slate-400 transition focus:outline-none min-h-[42px] shadow-2xs',
            Icon ? 'pl-9 pr-3.5' : 'px-3.5',
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
