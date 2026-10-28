import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  key?: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilterKeys?: (keyof T)[];
  pageSize?: number;
  pageSizeDefault?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  actions?: React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = 'Search records...',
  searchFilterKeys,
  pageSize: propPageSize,
  pageSizeDefault = 8,
  loading = false,
  error = null,
  onRetry,
  emptyMessage = 'No records found matching your query.',
  actions,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(propPageSize || pageSizeDefault);

  // Search filter
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const lower = searchTerm.toLowerCase();

    return data.filter((item) => {
      if (searchFilterKeys && searchFilterKeys.length > 0) {
        return searchFilterKeys.some((k) => {
          const val = item[k];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(lower);
        });
      }
      return Object.values(item).some((val) => {
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(lower);
        }
        return false;
      });
    });
  }, [data, searchTerm, searchFilterKeys]);

  // Pagination calculation
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const validPage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedData = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, validPage, pageSize]);

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm w-full">
      {/* Table Toolbar */}
      <div className="p-3 sm:p-4 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {searchable && (
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition min-h-[38px]"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 sm:gap-3 w-full sm:w-auto">
          {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto sm:ml-0 shrink-0">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value={5}>5</option>
              <option value={8}>8</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
            </select>
            <span className="hidden xs:inline">rows</span>
          </div>
        </div>
      </div>

      {/* Table Container with smooth horizontal touch scroll */}
      <div className="overflow-x-auto custom-scrollbar relative">
        <table className="w-full text-left text-xs min-w-full">
          <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 whitespace-nowrap">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={clsx(
                    'py-3 px-3 sm:py-3.5 sm:px-4 font-semibold',
                    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-slate-300">
            {error ? (
              <tr>
                <td colSpan={columns.length} className="py-12 px-4 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto text-rose-500 mb-2 stroke-1" />
                  <p className="text-xs font-semibold text-rose-400 mb-1">Failed to load table data</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">{error}</p>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 transition border border-slate-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Loading</span>
                    </button>
                  )}
                </td>
              </tr>
            ) : loading ? (
              Array.from({ length: 4 }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((_, cIdx) => (
                    <td key={cIdx} className="py-3.5 px-3 sm:px-4">
                      <div className="h-4 bg-slate-800 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 px-4 text-center text-slate-500">
                  <Inbox className="w-8 h-8 mx-auto text-slate-600 mb-2 stroke-1" />
                  <p className="text-xs">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                  {columns.map((col, cIdx) => (
                    <td
                      key={cIdx}
                      className={clsx(
                        'py-3 px-3 sm:py-3.5 sm:px-4',
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left',
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : col.accessorKey
                        ? String(row[col.accessorKey] ?? '—')
                        : '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 sm:p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div className="text-center sm:text-left text-[11px] sm:text-xs">
          Showing{' '}
          <strong className="text-white">
            {totalItems === 0 ? 0 : (validPage - 1) * pageSize + 1}
          </strong>{' '}
          to{' '}
          <strong className="text-white">
            {Math.min(validPage * pageSize, totalItems)}
          </strong>{' '}
          of <strong className="text-white">{totalItems}</strong> entries
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={validPage <= 1}
            className="p-2 sm:p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition touch-target flex items-center justify-center sm:min-h-0 sm:min-w-0"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2.5 sm:px-3 py-1 font-mono text-xs text-slate-300">
            {validPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={validPage >= totalPages}
            className="p-2 sm:p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition touch-target flex items-center justify-center sm:min-h-0 sm:min-w-0"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
