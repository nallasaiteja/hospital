import React from 'react';
import clsx from 'clsx';

export interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  placeholder,
  className,
  id,
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-medium text-slate-300">
          {label} {props.required && <span className="text-rose-400">*</span>}
        </label>
      )}

      <select
        id={selectId}
        className={clsx(
          'w-full py-2.5 px-3 rounded-xl bg-slate-950 border text-xs text-white transition focus:outline-none',
          error
            ? 'border-rose-500/80 focus:border-rose-500'
            : 'border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30',
          props.disabled && 'opacity-50 cursor-not-allowed bg-slate-900',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="text-slate-500">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-slate-950 text-white">
            {opt.label}
          </option>
        ))}
      </select>

      {error && <p className="text-[11px] text-rose-400 mt-1">{error}</p>}
    </div>
  );
};
