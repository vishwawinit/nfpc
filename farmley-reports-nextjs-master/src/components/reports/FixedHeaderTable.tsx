'use client'

import React, { useState, useMemo, ReactNode } from 'react'
import { ChevronUp, ChevronDown, Search, Download } from 'lucide-react'
import { businessColors } from '@/styles/businessColors'

interface Column {
  key: string
  header: string
  width?: string
  sortable?: boolean
  format?: (value: any) => ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
}

interface FixedHeaderTableProps {
  columns: Column[]
  data: any[]
  className?: string
  maxHeight?: string
  searchable?: boolean
  exportable?: boolean
  onExport?: () => void
  emptyMessage?: string
  loading?: boolean
  striped?: boolean
  hoverable?: boolean
  stickyHeader?: boolean
  pagination?: {
    enabled: boolean
    pageSize: number
  }
}

export function FixedHeaderTable({
  columns,
  data,
  className = '',
  maxHeight = '600px',
  searchable = true,
  exportable = true,
  onExport,
  emptyMessage = 'No data available',
  loading = false,
  striped = true,
  hoverable = true,
  stickyHeader = true,
  pagination = { enabled: true, pageSize: 50 }
}: FixedHeaderTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data

    return data.filter(row =>
      columns.some(col => {
        const value = row[col.key]
        if (value === null || value === undefined) return false
        return String(value).toLowerCase().includes(searchTerm.toLowerCase())
      })
    )
  }, [data, searchTerm, columns])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      let comparison = 0
      if (aVal > bVal) comparison = 1
      if (aVal < bVal) comparison = -1

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredData, sortColumn, sortDirection])

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination.enabled) return sortedData

    const start = (currentPage - 1) * pagination.pageSize
    const end = start + pagination.pageSize
    return sortedData.slice(start, end)
  }, [sortedData, currentPage, pagination])

  // Calculate total pages
  const totalPages = Math.ceil(sortedData.length / pagination.pageSize)

  // Handle sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  return (
    <div className={`bg-white rounded-lg border overflow-hidden ${className}`}
         style={{ borderColor: businessColors.card.border }}>

      {/* Table Header Actions */}
      {(searchable || exportable) && (
        <div className="px-6 py-4 border-b flex justify-between items-center"
             style={{ borderColor: businessColors.table.borderColor, backgroundColor: businessColors.background.secondary }}>
          {searchable && (
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                      style={{ color: businessColors.gray[400] }} />
              <input
                type="text"
                placeholder="Search table..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{
                  borderColor: businessColors.gray[300],
                  color: businessColors.gray[700]
                }}
              />
            </div>
          )}

          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: businessColors.gray[600] }}>
              Showing {paginatedData.length} of {sortedData.length} rows
            </span>
            {exportable && onExport && (
              <button
                onClick={onExport}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{
                  backgroundColor: businessColors.primary[600],
                  color: 'white'
                }}
              >
                <Download className="w-4 h-4" />
                Export to Excel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto" style={{ maxHeight }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2"
                   style={{ borderColor: businessColors.primary[600] }}></div>
              <p className="mt-2 text-sm" style={{ color: businessColors.gray[600] }}>Loading data...</p>
            </div>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm" style={{ color: businessColors.gray[500] }}>{emptyMessage}</p>
          </div>
        ) : (
          <table className="w-full">
            {/* Fixed Header */}
            <thead className={stickyHeader ? "sticky top-0 z-10" : ""}
                   style={{
                     backgroundColor: businessColors.table.headerBg,
                     boxShadow: stickyHeader ? `0 2px 4px ${businessColors.table.fixedHeaderShadow}` : 'none'
                   }}>
              <tr style={{ borderBottom: `2px solid ${businessColors.table.borderColor}` }}>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider ${column.className || ''}`}
                    style={{
                      width: column.width,
                      textAlign: column.align || 'left',
                      color: businessColors.table.headerText,
                      cursor: column.sortable ? 'pointer' : 'default'
                    }}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2" style={{ justifyContent: column.align === 'center' ? 'center' : column.align === 'right' ? 'flex-end' : 'flex-start' }}>
                      {column.header}
                      {column.sortable && (
                        <div className="flex flex-col">
                          <ChevronUp
                            className="w-3 h-3"
                            style={{
                              color: sortColumn === column.key && sortDirection === 'asc'
                                ? businessColors.primary[600]
                                : businessColors.gray[400]
                            }}
                          />
                          <ChevronDown
                            className="w-3 h-3 -mt-1"
                            style={{
                              color: sortColumn === column.key && sortDirection === 'desc'
                                ? businessColors.primary[600]
                                : businessColors.gray[400]
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y" style={{ divideColor: businessColors.table.borderColor }}>
              {paginatedData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={`
                    ${striped && rowIndex % 2 === 1 ? 'bg-gray-50' : ''}
                    ${hoverable ? 'hover:bg-gray-50 transition-colors' : ''}
                  `}
                  style={{
                    backgroundColor: striped && rowIndex % 2 === 1 ? businessColors.background.tertiary : businessColors.table.rowBg
                  }}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 text-sm ${column.className || ''}`}
                      style={{
                        textAlign: column.align || 'left',
                        color: businessColors.gray[900]
                      }}
                    >
                      {column.format
                        ? column.format(row[column.key])
                        : row[column.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.enabled && totalPages > 1 && (
        <div className="px-6 py-4 border-t flex justify-between items-center"
             style={{ borderColor: businessColors.table.borderColor, backgroundColor: businessColors.background.secondary }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: businessColors.gray[300],
                color: businessColors.gray[700]
              }}
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      currentPage === pageNum ? 'font-semibold' : ''
                    }`}
                    style={{
                      backgroundColor: currentPage === pageNum ? businessColors.primary[600] : 'transparent',
                      color: currentPage === pageNum ? 'white' : businessColors.gray[700]
                    }}
                  >
                    {pageNum}
                  </button>
                )
              })}
              {totalPages > 5 && <span style={{ color: businessColors.gray[500] }}>...</span>}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: businessColors.gray[300],
                color: businessColors.gray[700]
              }}
            >
              Next
            </button>
          </div>

          <span className="text-sm" style={{ color: businessColors.gray[600] }}>
            Page {currentPage} of {totalPages}
          </span>
        </div>
      )}
    </div>
  )
}