"use client";

import React, { useState, useMemo, useId } from 'react';
import { ChevronUpIcon, ChevronDownIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { clsx } from 'clsx';

export interface Column<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  width?: string;
  ariaLabel?: string; // Custom aria-label for column
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  caption?: string; // Table caption for accessibility
  ariaLabel?: string; // Custom aria-label for table
  id?: string; // Custom ID for table
}

type SortDirection = 'asc' | 'desc' | null;

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSize = 10,
  searchable = true,
  searchPlaceholder = "Search...",
  className,
  onRowClick,
  loading = false,
  emptyMessage = "No data available",
  caption,
  ariaLabel,
  id
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  
  // Generate unique IDs for accessibility
  const tableId = useId();
  const searchId = useId();
  const statusId = useId();
  const finalTableId = id || tableId;

  // Filter data based on search term and column filters
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Global search
    if (searchTerm) {
      filtered = filtered.filter((row: any) =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Column-specific filters
    Object.entries(columnFilters).forEach(([columnKey, filterValue]: any) => {
      if (filterValue) {
        filtered = filtered.filter((row: any) =>
          String(row[columnKey]).toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });

    return filtered;
  }, [data, searchTerm, columnFilters]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (column: keyof T) => {
    if (sortColumn === column) {
      setSortDirection(prev => 
        prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'
      );
      if (sortDirection === 'desc') {
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  const getSortAriaSort = (column: keyof T): 'ascending' | 'descending' | 'none' => {
    if (sortColumn !== column) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const getSortAriaLabel = (column: keyof T, header: string): string => {
    if (sortColumn !== column) {
      return `Sort by ${header}`;
    }
    const currentSort = sortDirection === 'asc' ? 'ascending' : 'descending';
    const nextSort = sortDirection === 'asc' ? 'descending' : 'ascending';
    return `${header}, currently sorted ${currentSort}, click to sort ${nextSort}`;
  };

  const handleColumnFilter = (columnKey: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const getSortIcon = (column: keyof T) => {
    if (sortColumn !== column) {
      return <ChevronUpDownIcon className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUpIcon className="w-4 h-4 text-blue-600" />
      : <ChevronDownIcon className="w-4 h-4 text-blue-600" />;
  };

  if (loading) {
    return (
      <div 
        className="flex items-center justify-center p-8"
        role="status"
        aria-live="polite"
        aria-label="Loading table data"
      >
        <div 
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
          aria-hidden="true"
        />
        <span className="sr-only">Loading table data...</span>
      </div>
    );
  }

  return (
    <div className={clsx("w-full", className)}>
      {/* Search and Controls */}
      {searchable && (
        <div className="mb-4">
          <label htmlFor={searchId} className="sr-only">
            Search table data
          </label>
          <Input
            id={searchId}
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="max-w-sm"
            aria-describedby={statusId}
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table 
          id={finalTableId}
          className="min-w-full divide-y divide-gray-200"
          role="table"
          aria-label={ariaLabel || "Data table"}
          aria-describedby={statusId}
        >
          {caption && (
            <caption className="sr-only">
              {caption}
            </caption>
          )}
          <thead className="bg-gray-50">
            <tr role="row">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  scope="col"
                  className={clsx(
                    "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                    column.sortable && "cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset",
                    column.width && `w-${column.width}`
                  )}
                  onClick={() => column.sortable && handleSort(column.key)}
                  onKeyDown={(e) => column.sortable && handleKeyDown(e, () => handleSort(column.key))}
                  tabIndex={column.sortable ? 0 : undefined}
                  role={column.sortable ? "columnheader button" : "columnheader"}
                  aria-sort={column.sortable ? getSortAriaSort(column.key) : undefined}
                  aria-label={column.sortable ? getSortAriaLabel(column.key, column.header) : column.ariaLabel || column.header}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.header}</span>
                    {column.sortable && (
                      <span aria-hidden="true">
                        {getSortIcon(column.key)}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
            {/* Column Filters Row */}
            <tr className="bg-gray-25" role="row">
              {columns.map((column) => {
                const filterId = `filter-${String(column.key)}-${tableId}`;
                return (
                  <th key={`filter-${String(column.key)}`} className="px-6 py-2" scope="col">
                    {column.filterable && (
                      <>
                        <label htmlFor={filterId} className="sr-only">
                          Filter {column.header}
                        </label>
                        <Input
                          id={filterId}
                          type="text"
                          placeholder={`Filter ${column.header.toLowerCase()}...`}
                          value={columnFilters[String(column.key)] || ''}
                          onChange={(e) => handleColumnFilter(String(column.key), e.target.value)}
                          className="text-sm h-8"
                          aria-label={`Filter ${column.header}`}
                        />
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr role="row">
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-gray-500"
                  role="cell"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={index}
                  role="row"
                  className={clsx(
                    "hover:bg-gray-50",
                    onRowClick && "cursor-pointer focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                  )}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(e) => onRowClick && handleKeyDown(e, () => onRowClick(row))}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick ? `Row ${index + 1}, click to select` : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                      role="cell"
                    >
                      {column.render
                        ? column.render(row[column.key], row)
                        : String(row[column.key] || '')
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Status and Pagination */}
      <div 
        id={statusId}
        className="mt-4"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="text-sm text-gray-700 mb-2">
          Showing {((currentPage - 1) * pageSize) + 1} to{' '}
          {Math.min(currentPage * pageSize, sortedData.length)} of{' '}
          {sortedData.length} results
          {searchTerm && ` (filtered from ${data.length} total)`}
        </div>
        
        {totalPages > 1 && (
          <nav 
            className="flex items-center justify-between"
            role="navigation"
            aria-label="Table pagination"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              aria-label="Go to previous page"
            >
              Previous
            </Button>
            
            {/* Page Numbers */}
            <div className="flex items-center space-x-1" role="group" aria-label="Page numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    aria-label={`Go to page ${pageNum}`}
                    aria-current={currentPage === pageNum ? "page" : undefined}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <span className="text-gray-500" aria-hidden="true">...</span>
                  <Button
                    variant={currentPage === totalPages ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    aria-label={`Go to page ${totalPages}`}
                    aria-current={currentPage === totalPages ? "page" : undefined}
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              aria-label="Go to next page"
            >
              Next
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}
