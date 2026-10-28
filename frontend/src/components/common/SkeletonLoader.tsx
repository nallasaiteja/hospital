import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle' | 'card' | 'table';
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonProps> = ({
  className,
  variant = 'text',
  count = 1,
}) => {
  if (variant === 'card') {
    return (
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse space-y-3">
        <div className="flex justify-between items-center">
          <div className="h-3 bg-slate-800 rounded w-1/3" />
          <div className="w-8 h-8 rounded-lg bg-slate-800" />
        </div>
        <div className="h-7 bg-slate-800 rounded w-1/2" />
        <div className="h-3 bg-slate-800 rounded w-3/4" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 animate-pulse space-y-4">
        <div className="h-8 bg-slate-800 rounded w-1/4 mb-4" />
        {Array.from({ length: count || 4 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 bg-slate-800 rounded flex-1" />
            <div className="h-4 bg-slate-800 rounded flex-1" />
            <div className="h-4 bg-slate-800 rounded flex-1" />
            <div className="h-4 bg-slate-800 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'bg-slate-800/80 animate-pulse',
            variant === 'circle' && 'rounded-full w-10 h-10',
            variant === 'rect' && 'rounded-xl h-10 w-full',
            variant === 'text' && 'rounded h-4 w-full',
            className
          )}
        />
      ))}
    </div>
  );
};
