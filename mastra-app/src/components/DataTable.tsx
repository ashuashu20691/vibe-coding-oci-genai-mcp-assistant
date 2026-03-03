'use client';

import { useState, useMemo, useCallback } from 'react';
import { FullscreenOverlay, FullscreenButton } from './FullscreenOverlay';
import { ExportDropdown, ExportIcons, ExportFormat } from './ExportDropdown';
import { ExportService } from '@/services/export-service';

export interface DataTableProps {
  data: Record<string, unknown>[];
  pageSize?: number;
  title?: string;
  fullscreenEnabled?: boolean;
  exportEnabled?: boolean;
  onUserModification?: (modificationType: 'filter' | 'sort', details: Record<string, unknown>) => void;
}

export interface SortState {
  column: string | null;
  direction: 'asc' | 'desc';
}

export interface FilterState {
  [column: string]: string;
}

/**
 * Sorts data by a column. Exported for testing.
 */
export function sortData(
  data: Record<string, unknown>[],
  sortCol: string | null,
  sortDir: 'asc' | 'desc'
): Record<string, unknown>[] {
  if (!sortCol) return data;
  return [...data].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === 'number' && typeof bv === 'number' 
      ? av - bv 
      : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });
}

/**
 * Filters data by column values. Exported for testing.
 */
export function filterData(
  data: Record<string, unknown>[],
  filters: FilterState
): Record<string, unknown>[] {
  const activeFilters = Object.entries(filters).filter(([, value]) => value.trim() !== '');
  if (activeFilters.length === 0) return data;
  
  return data.filter(row => {
    return activeFilters.every(([col, filterValue]) => {
      const cellValue = row[col];
      if (cellValue == null) return false;
      const cellStr = typeof cellValue === 'object' 
        ? JSON.stringify(cellValue) 
        : String(cellValue);
      return cellStr.toLowerCase().includes(filterValue.toLowerCase());
    });
  });
}

export function DataTable({ data, pageSize = 10, title, fullscreenEnabled = true, exportEnabled = true, onUserModification }: DataTableProps) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<FilterState>({});
  const [page, setPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const columns = useMemo(() => {
    // Add null checks before accessing rows/columns
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    const firstRow = data[0];
    if (!firstRow || typeof firstRow !== 'object') return [];
    return Object.keys(firstRow);
  }, [data]);

  // Apply filters first, then sort
  const filtered = useMemo(() => filterData(data, filters), [data, filters]);
  const sorted = useMemo(() => sortData(filtered, sortCol, sortDir), [filtered, sortCol, sortDir]);
  const paged = useMemo(() => sorted.slice(page * pageSize, (page + 1) * pageSize), [sorted, page, pageSize]);
  const totalPages = Math.ceil(sorted.length / pageSize);

  // Export handler for CSV export
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (format === 'csv' && data && Array.isArray(data) && data.length > 0) {
      const filename = `${title || 'data'}-${new Date().toISOString().split('T')[0]}.csv`;
      // Export the filtered/sorted data, not just the current page
      ExportService.exportToCSV(sorted, filename);
    }
  }, [data, sorted, title]);

  // Export options for tables (CSV only)
  const exportOptions = [
    {
      format: 'csv' as ExportFormat,
      label: 'Export as CSV',
      icon: ExportIcons.csv,
      description: 'Download data as spreadsheet',
    },
  ];

  const handleSort = useCallback((col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      // Emit modification event
      if (onUserModification) {
        onUserModification('sort', {
          column: col,
          direction: sortDir === 'asc' ? 'desc' : 'asc',
        });
      }
    } else {
      setSortCol(col);
      setSortDir('asc');
      // Emit modification event
      if (onUserModification) {
        onUserModification('sort', {
          column: col,
          direction: 'asc',
        });
      }
    }
  }, [sortCol, sortDir, onUserModification]);

  const handleFilterChange = useCallback((col: string, value: string) => {
    setFilters(prev => ({ ...prev, [col]: value }));
    setPage(0); // Reset to first page when filtering
    
    // Emit modification event
    if (onUserModification) {
      onUserModification('filter', {
        column: col,
        value: value,
        activeFilters: { ...filters, [col]: value },
      });
    }
  }, [filters, onUserModification]);

  const clearFilters = useCallback(() => {
    setFilters({});
    setPage(0);
  }, []);

  const hasActiveFilters = Object.values(filters).some(v => v.trim() !== '');

  const fmt = (v: unknown) => {
    if (v == null) return '—';
    if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  if (!data || !Array.isArray(data) || data.length === 0) return <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No data</div>;

  const tableContent = (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
      {title && (
        <div className="px-4 py-3 text-sm font-medium flex justify-between items-center" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <span>{title}</span>
          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button 
                onClick={clearFilters}
                className="text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity"
                style={{ background: 'var(--accent-color)', color: 'white' }}
              >
                Clear filters
              </button>
            )}
            <span style={{ color: 'var(--text-muted)' }}>
              {sorted.length === data.length 
                ? `${data.length} rows` 
                : `${sorted.length} of ${data.length} rows`}
            </span>
            {exportEnabled && !isFullscreen && (
              <ExportDropdown
                options={exportOptions}
                onExport={handleExport}
              />
            )}
            {fullscreenEnabled && !isFullscreen && (
              <FullscreenButton onClick={() => setIsFullscreen(true)} />
            )}
          </div>
        </div>
      )}
      {!title && (fullscreenEnabled || exportEnabled) && !isFullscreen && (
        <div className="px-4 py-2 flex justify-end gap-2" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
          {exportEnabled && (
            <ExportDropdown
              options={exportOptions}
              onExport={handleExport}
            />
          )}
          {fullscreenEnabled && (
            <FullscreenButton onClick={() => setIsFullscreen(true)} />
          )}
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* Sort headers row */}
            <tr style={{ background: 'var(--bg-secondary)' }}>
              {columns.map(col => (
                <th 
                  key={col} 
                  onClick={() => handleSort(col)} 
                  className="px-4 py-3 text-left font-medium cursor-pointer select-none hover:opacity-80 transition-opacity" 
                  style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}
                  data-testid={`sort-header-${col}`}
                >
                  <div className="flex items-center gap-1">
                    {col}
                    {sortCol === col && (
                      <svg 
                        className={`w-3 h-3 transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                        data-testid={`sort-indicator-${col}`}
                        data-direction={sortDir}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
            </tr>
            {/* Filter inputs row */}
            <tr style={{ background: 'var(--bg-primary)' }}>
              {columns.map(col => (
                <th key={`filter-${col}`} className="px-4 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <input
                    type="text"
                    placeholder={`Filter ${col}...`}
                    value={filters[col] || ''}
                    onChange={(e) => handleFilterChange(col, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1.5 text-xs rounded-md outline-none transition-colors"
                    style={{ 
                      background: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                    data-testid={`filter-input-${col}`}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td 
                  colSpan={columns.length} 
                  className="px-4 py-8 text-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  No matching rows
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr key={i} className="transition-colors hover:opacity-90" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {columns.map(col => (
                    <td key={col} className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                      {fmt(row[col])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between px-4 py-3 text-sm" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {sorted.length === 0 
            ? '0 rows' 
            : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, sorted.length)} of ${sorted.length}`}
        </span>
        <div className="flex gap-1">
          <button 
            onClick={() => setPage(0)} 
            disabled={page === 0} 
            className="px-2 py-1.5 rounded-lg disabled:opacity-40 hover:opacity-80 transition-opacity" 
            style={{ border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            data-testid="pagination-first"
          >
            ««
          </button>
          <button 
            onClick={() => setPage(p => Math.max(0, p - 1))} 
            disabled={page === 0} 
            className="px-3 py-1.5 rounded-lg disabled:opacity-40 hover:opacity-80 transition-opacity" 
            style={{ border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            data-testid="pagination-prev"
          >
            Prev
          </button>
          <span className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }} data-testid="pagination-info">
            {totalPages > 0 ? `${page + 1} / ${totalPages}` : '0 / 0'}
          </span>
          <button 
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} 
            disabled={page >= totalPages - 1 || totalPages === 0} 
            className="px-3 py-1.5 rounded-lg disabled:opacity-40 hover:opacity-80 transition-opacity" 
            style={{ border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            data-testid="pagination-next"
          >
            Next
          </button>
          <button 
            onClick={() => setPage(totalPages - 1)} 
            disabled={page >= totalPages - 1 || totalPages === 0} 
            className="px-2 py-1.5 rounded-lg disabled:opacity-40 hover:opacity-80 transition-opacity" 
            style={{ border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            data-testid="pagination-last"
          >
            »»
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {tableContent}
      
      {/* Fullscreen overlay */}
      <FullscreenOverlay
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        title={title || 'Data Table'}
      >
        <div className="w-full h-full overflow-auto">
          {tableContent}
        </div>
      </FullscreenOverlay>
    </>
  );
}
