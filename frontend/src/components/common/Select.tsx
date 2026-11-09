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
        <label htmlFor={selectId} className="block text-xs font-semibold text-slate-700">
          {label} {props.required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <select
        id={selectId}
        className={clsx(
          'w-full py-2.5 px-3 rounded-xl bg-white border text-sm sm:text-xs text-slate-900 transition focus:outline-none min-h-[42px] shadow-2xs',
          error
            ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'
            : 'border-slate-300 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/15',
          props.disabled && 'opacity-60 cursor-not-allowed bg-slate-50 text-slate-500',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="text-slate-400">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white text-slate-900">
            {opt.label}
          </option>
        ))}
      </select>

      {error && <p className="text-[11px] text-rose-600 mt-1 font-medium">{error}</p>}
    </div>
  );
};
