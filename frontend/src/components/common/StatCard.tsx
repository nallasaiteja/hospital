import React from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export type StatAccent = 'teal' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accent?: StatAccent;
  change?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = 'cyan',
  change,
  trend = change ? { value: change, isPositive: !change.startsWith('-') } : undefined,
  onClick,
  className,
}) => {
  const accentIconBg: Record<StatAccent, string> = {
    teal: 'bg-teal-50 text-teal-600 border-teal-200',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    rose: 'bg-rose-50 text-rose-600 border-rose-200',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  };

  const accentBorder: Record<StatAccent, string> = {
    teal: 'hover:border-teal-300',
    cyan: 'hover:border-cyan-300',
    emerald: 'hover:border-emerald-300',
    amber: 'hover:border-amber-300',
    rose: 'hover:border-rose-300',
    indigo: 'hover:border-indigo-300',
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'p-3.5 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all duration-200 relative overflow-hidden flex flex-col justify-between w-full min-w-0',
        onClick && 'cursor-pointer hover:shadow-md',
        accentBorder[accent],
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
        <span className="text-xs font-semibold text-slate-500 truncate">{title}</span>
        <div className={clsx('w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border shrink-0 shadow-xs', accentIconBg[accent])}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2 mb-1">
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate max-w-full">
            {value}
          </span>
          {trend && (
            <span
              className={clsx(
                'text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded border shrink-0',
                trend.isPositive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              )}
            >
              {trend.value}
            </span>
          )}
        </div>

        {subtitle && <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-none">{subtitle}</p>}
      </div>
    </div>
  );
};
