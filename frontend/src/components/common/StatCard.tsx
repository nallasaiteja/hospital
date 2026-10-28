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
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  };

  const accentBorder: Record<StatAccent, string> = {
    teal: 'hover:border-teal-500/40',
    cyan: 'hover:border-cyan-500/40',
    emerald: 'hover:border-emerald-500/40',
    amber: 'hover:border-amber-500/40',
    rose: 'hover:border-rose-500/40',
    indigo: 'hover:border-indigo-500/40',
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'p-3.5 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 transition-all duration-200 relative overflow-hidden flex flex-col justify-between w-full min-w-0',
        onClick && 'cursor-pointer hover:shadow-lg',
        accentBorder[accent],
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
        <span className="text-xs font-medium text-slate-400 truncate">{title}</span>
        <div className={clsx('w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border shrink-0', accentIconBg[accent])}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2 mb-1">
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate max-w-full">
            {value}
          </span>
          {trend && (
            <span
              className={clsx(
                'text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded shrink-0',
                trend.isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              )}
            >
              {trend.value}
            </span>
          )}
        </div>

        {subtitle && <p className="text-[11px] sm:text-xs text-slate-400 line-clamp-1 sm:line-clamp-none">{subtitle}</p>}
      </div>
    </div>
  );
};
