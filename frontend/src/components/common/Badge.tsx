import React from 'react';
import clsx from 'clsx';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'teal' | 'cyan' | 'accent' | 'primary';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  pulse = false,
  className,
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    accent: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    primary: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const pulseColors: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-blue-500',
    teal: 'bg-teal-500',
    cyan: 'bg-cyan-500',
    accent: 'bg-indigo-500',
    primary: 'bg-indigo-500',
    neutral: 'bg-slate-500',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold border rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        variantStyles[variant],
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={clsx(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              pulseColors[variant]
            )}
          />
          <span
            className={clsx('relative inline-flex rounded-full h-2 w-2', pulseColors[variant])}
          />
        </span>
      )}
      {children}
    </span>
  );
};
