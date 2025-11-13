'use client'

import React, { useState } from 'react'
import { Filter, Calendar, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react'
import { businessColors } from '@/styles/businessColors'

interface FilterOption {
  value: string
  label: string
  count?: number
}

interface FilterField {
  key: string
  label: string
  type: 'select' | 'date' | 'daterange' | 'multiselect' | 'search'
  options?: FilterOption[]
  placeholder?: string
  icon?: React.ReactNode
}

interface FilterBarProps {
  fields: FilterField[]
  values: Record<string, any>
  onChange: (key: string, value: any) => void
  onReset?: () => void
  onApply?: () => void
  loading?: boolean
  collapsible?: boolean
  className?: string
}

export function FilterBar({
  fields,
  values,
  onChange,
  onReset,
  onApply,
  loading = false,
  collapsible = false,
  className = ''
}: FilterBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeFilters, setActiveFilters] = useState<string[]>([])

  // Count active filters
  const activeFilterCount = Object.entries(values).filter(([key, value]) => {
    if (!value) return false
    if (Array.isArray(value) && value.length === 0) return false
    if (typeof value === 'string' && value === '') return false
    return true
  }).length

  // Handle field change
  const handleFieldChange = (key: string, value: any) => {
    onChange(key, value)
    if (value && !activeFilters.includes(key)) {
      setActiveFilters([...activeFilters, key])
    } else if (!value && activeFilters.includes(key)) {
      setActiveFilters(activeFilters.filter(k => k !== key))
    }
  }

  // Clear specific filter
  const clearFilter = (key: string) => {
    onChange(key, null)
    setActiveFilters(activeFilters.filter(k => k !== key))
  }

  // Render field based on type
  const renderField = (field: FilterField) => {
    switch (field.type) {
      case 'select':
        return (
          <select
            value={values[field.key] || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors"
            style={{
              borderColor: values[field.key] ? businessColors.primary[400] : businessColors.gray[300],
              backgroundColor: businessColors.background.primary
            }}
          >
            <option value="">{field.placeholder || `All ${field.label}`}</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.count !== undefined && ` (${option.count})`}
              </option>
            ))}
          </select>
        )

      case 'multiselect':
        return (
          <div className="relative">
            <div
              className="w-full px-3 py-2 border rounded-lg text-sm cursor-pointer flex items-center justify-between"
              style={{
                borderColor: values[field.key]?.length > 0 ? businessColors.primary[400] : businessColors.gray[300],
                backgroundColor: businessColors.background.primary
              }}
            >
              <span style={{ color: values[field.key]?.length > 0 ? businessColors.gray[900] : businessColors.gray[500] }}>
                {values[field.key]?.length > 0
                  ? `${values[field.key].length} selected`
                  : field.placeholder || `Select ${field.label}`}
              </span>
              <ChevronDown className="w-4 h-4" style={{ color: businessColors.gray[400] }} />
            </div>
          </div>
        )

      case 'date':
        return (
          <input
            type="date"
            value={values[field.key] || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors"
            style={{
              borderColor: values[field.key] ? businessColors.primary[400] : businessColors.gray[300],
              backgroundColor: businessColors.background.primary
            }}
          />
        )

      case 'daterange':
        const [startKey, endKey] = field.key.split(',')
        return (
          <div className="flex gap-2">
            <input
              type="date"
              value={values[startKey] || ''}
              onChange={(e) => handleFieldChange(startKey, e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors"
              placeholder="Start"
              style={{
                borderColor: values[startKey] ? businessColors.primary[400] : businessColors.gray[300],
                backgroundColor: businessColors.background.primary
              }}
            />
            <span className="self-center text-sm" style={{ color: businessColors.gray[500] }}>to</span>
            <input
              type="date"
              value={values[endKey] || ''}
              onChange={(e) => handleFieldChange(endKey, e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors"
              placeholder="End"
              style={{
                borderColor: values[endKey] ? businessColors.primary[400] : businessColors.gray[300],
                backgroundColor: businessColors.background.primary
              }}
            />
          </div>
        )

      case 'search':
        return (
          <input
            type="text"
            value={values[field.key] || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder || `Search ${field.label}...`}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors"
            style={{
              borderColor: values[field.key] ? businessColors.primary[400] : businessColors.gray[300],
              backgroundColor: businessColors.background.primary
            }}
          />
        )

      default:
        return null
    }
  }

  return (
    <div
      className={`bg-white rounded-lg border p-4 ${className}`}
      style={{ borderColor: businessColors.card.border }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" style={{ color: businessColors.gray[600] }} />
            <h3 className="text-lg font-semibold" style={{ color: businessColors.gray[900] }}>
              Filters
            </h3>
          </div>
          {activeFilterCount > 0 && (
            <span
              className="px-2 py-1 text-xs font-medium rounded-full"
              style={{
                backgroundColor: businessColors.primary[100],
                color: businessColors.primary[700]
              }}
            >
              {activeFilterCount} active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onReset && activeFilterCount > 0 && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors"
              style={{
                color: businessColors.gray[600],
                borderWidth: 1,
                borderColor: businessColors.gray[300]
              }}
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          )}
          {collapsible && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
            >
              {isCollapsed ? (
                <ChevronDown className="w-4 h-4" style={{ color: businessColors.gray[600] }} />
              ) : (
                <ChevronUp className="w-4 h-4" style={{ color: businessColors.gray[600] }} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Filter Fields */}
      {!isCollapsed && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {fields.map(field => (
              <div key={field.key}>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: businessColors.gray[700] }}
                >
                  {field.icon && <span className="inline-block mr-1">{field.icon}</span>}
                  {field.label}
                </label>
                {renderField(field)}
              </div>
            ))}
          </div>

          {/* Apply Button */}
          {onApply && (
            <div className="mt-4 pt-4 border-t flex justify-end"
                 style={{ borderColor: businessColors.gray[200] }}>
              <button
                onClick={onApply}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: businessColors.primary[600],
                  color: 'white'
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Apply Filters
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Active Filter Tags */}
      {activeFilterCount > 0 && !isCollapsed && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: businessColors.gray[200] }}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(values).map(([key, value]) => {
              if (!value || (Array.isArray(value) && value.length === 0)) return null
              const field = fields.find(f => f.key === key || f.key.includes(key))
              if (!field) return null

              return (
                <div
                  key={key}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                  style={{
                    backgroundColor: businessColors.primary[50],
                    color: businessColors.primary[700]
                  }}
                >
                  <span className="font-medium">{field.label}:</span>
                  <span>
                    {Array.isArray(value) ? `${value.length} selected` : value}
                  </span>
                  <button
                    onClick={() => clearFilter(key)}
                    className="ml-1 hover:opacity-70 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Export preset date ranges for consistency
export const dateRangePresets = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'thisYear', label: 'This Year' }
]