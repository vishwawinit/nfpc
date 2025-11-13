'use client'

import React, { ReactNode, useState } from 'react'
import { RefreshCw, Download, Maximize2, Minimize2, BarChart3, Table, HelpCircle, Calendar, FileText } from 'lucide-react'
import { businessColors } from '@/styles/businessColors'
import { FilterBar } from './FilterBar'

interface ReportTemplateProps {
  // Report metadata
  title: string
  subtitle: string
  description?: string
  icon?: ReactNode

  // View control
  defaultView?: 'summary' | 'detailed'
  summaryView?: ReactNode
  detailedView?: ReactNode

  // Filters
  filterFields?: any[]
  filterValues?: Record<string, any>
  onFilterChange?: (key: string, value: any) => void
  onFilterReset?: () => void
  onFilterApply?: () => void

  // Actions
  onRefresh?: () => void
  onExport?: () => void

  // State
  loading?: boolean
  error?: string
  lastUpdated?: Date

  // Options
  fullscreenable?: boolean
  exportable?: boolean
  refreshable?: boolean

  className?: string
}

export function ReportTemplate({
  title,
  subtitle,
  description,
  icon,
  defaultView = 'summary',
  summaryView,
  detailedView,
  filterFields,
  filterValues,
  onFilterChange,
  onFilterReset,
  onFilterApply,
  onRefresh,
  onExport,
  loading = false,
  error,
  lastUpdated,
  fullscreenable = true,
  exportable = true,
  refreshable = true,
  className = ''
}: ReportTemplateProps) {
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>(defaultView)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Format last updated time
  const formatLastUpdated = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    return `${days} day${days > 1 ? 's' : ''} ago`
  }

  // Report help tooltip
  const ReportHelp = () => (
    <div className="group relative inline-block ml-2">
      <HelpCircle
        className="w-5 h-5 cursor-help transition-colors"
        style={{ color: businessColors.gray[400] }}
      />
      <div className="absolute z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200
                      top-full left-0 mt-2 w-80 p-4 rounded-lg shadow-lg"
           style={{
             backgroundColor: businessColors.gray[900],
             color: 'white'
           }}>
        <h4 className="font-semibold text-sm mb-2">About This Report</h4>
        <p className="text-xs opacity-90 mb-3">{description || 'This report provides detailed analytics and insights.'}</p>

        <div className="space-y-2 pt-2 border-t" style={{ borderColor: businessColors.gray[700] }}>
          <div className="flex items-start gap-2 text-xs">
            <BarChart3 className="w-3 h-3 mt-0.5" />
            <div>
              <span className="font-medium">Summary View:</span> Charts and key metrics
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <Table className="w-3 h-3 mt-0.5" />
            <div>
              <span className="font-medium">Detailed View:</span> Full data table with export
            </div>
          </div>
        </div>

        {/* Tooltip arrow */}
        <div className="absolute bottom-full left-6 -mb-1">
          <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4"
               style={{ borderBottomColor: businessColors.gray[900] }}></div>
        </div>
      </div>
    </div>
  )

  const content = (
    <div
      className={`${className} ${isFullscreen ? 'fixed inset-0 z-50 bg-white overflow-auto' : ''}`}
      style={{ backgroundColor: businessColors.background.secondary }}
    >
      {/* Header */}
      <div className="bg-white border-b px-6 py-4"
           style={{ borderColor: businessColors.card.border }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-3 rounded-lg"
                   style={{ backgroundColor: businessColors.primary[50] }}>
                <div style={{ color: businessColors.primary[600] }}>
                  {icon}
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center">
                <h1 className="text-2xl font-bold" style={{ color: businessColors.gray[900] }}>
                  {title}
                </h1>
                <ReportHelp />
              </div>
              <p className="text-sm mt-1" style={{ color: businessColors.gray[600] }}>
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastUpdated && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
                   style={{ backgroundColor: businessColors.background.tertiary }}>
                <Calendar className="w-4 h-4" style={{ color: businessColors.gray[500] }} />
                <span className="text-xs" style={{ color: businessColors.gray[600] }}>
                  Updated {formatLastUpdated(lastUpdated)}
                </span>
              </div>
            )}

            {refreshable && onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50 disabled:opacity-50"
                style={{ borderColor: businessColors.gray[300] }}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Refresh</span>
              </button>
            )}

            {fullscreenable && (
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 rounded-lg border transition-colors hover:bg-gray-50"
                style={{ borderColor: businessColors.gray[300] }}
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      {filterFields && filterFields.length > 0 && (
        <div className="p-6">
          <FilterBar
            fields={filterFields}
            values={filterValues || {}}
            onChange={onFilterChange || (() => {})}
            onReset={onFilterReset}
            onApply={onFilterApply}
            loading={loading}
            collapsible
          />
        </div>
      )}

      {/* View Toggle */}
      {summaryView && detailedView && (
        <div className="px-6 py-4">
          <div className="flex justify-center">
            <div className="inline-flex rounded-lg p-1"
                 style={{ backgroundColor: businessColors.background.primary, border: `1px solid ${businessColors.gray[300]}` }}>
              <button
                onClick={() => setViewMode('summary')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'summary' ? 'shadow-sm' : ''
                }`}
                style={{
                  backgroundColor: viewMode === 'summary' ? businessColors.primary[600] : 'transparent',
                  color: viewMode === 'summary' ? 'white' : businessColors.gray[700]
                }}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Summary View
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'detailed' ? 'shadow-sm' : ''
                }`}
                style={{
                  backgroundColor: viewMode === 'detailed' ? businessColors.primary[600] : 'transparent',
                  color: viewMode === 'detailed' ? 'white' : businessColors.gray[700]
                }}
              >
                <Table className="w-4 h-4 inline mr-2" />
                Detailed View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Button for Detailed View */}
      {viewMode === 'detailed' && exportable && onExport && (
        <div className="px-6 pb-4">
          <div className="flex justify-end">
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              style={{
                backgroundColor: businessColors.success.main,
                color: 'white'
              }}
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export to Excel</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white rounded-lg">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2"
                   style={{ borderColor: businessColors.primary[600] }}></div>
              <p className="mt-4 text-sm" style={{ color: businessColors.gray[600] }}>
                Loading report data...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                 style={{ backgroundColor: businessColors.error.light }}>
              <FileText className="w-8 h-8" style={{ color: businessColors.error.main }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: businessColors.gray[900] }}>
              Error Loading Report
            </h3>
            <p className="text-sm" style={{ color: businessColors.gray[600] }}>
              {error}
            </p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: businessColors.primary[600],
                  color: 'white'
                }}
              >
                Try Again
              </button>
            )}
          </div>
        ) : (
          <>
            {viewMode === 'summary' && summaryView}
            {viewMode === 'detailed' && detailedView}
            {!summaryView && !detailedView && (
              <div className="bg-white rounded-lg p-12 text-center">
                <p className="text-sm" style={{ color: businessColors.gray[500] }}>
                  No data available to display
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  // Fullscreen overlay
  if (isFullscreen) {
    return content
  }

  return content
}

// Export common report utilities
export const reportDateRanges = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'lastQuarter', label: 'Last Quarter' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' }
]