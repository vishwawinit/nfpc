'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Users, User, Filter, ChevronDown, X } from 'lucide-react'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface AttendanceFiltersProps {
  filters: {
    startDate: string | null
    endDate: string | null
    teamLeaderCode: string | null
    userRole: string | null
    userCode: string | null
  }
  filterOptions: {
    teamLeaders: any[]
    roles: any[]
    users: any[]
  }
  availableMonths: any[]
  selectedDateRange: string
  onDateRangeSelect: (range: string) => void
  onFilterChange: (key: string, value: string | null) => void
  onReset: () => void
  loading?: boolean
}

export const AttendanceFilters: React.FC<AttendanceFiltersProps> = ({
  filters,
  filterOptions,
  availableMonths,
  selectedDateRange,
  onDateRangeSelect,
  onFilterChange,
  onReset,
  loading = false
}) => {
  const [isExpanded, setIsExpanded] = useState(true)

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value && key !== 'startDate' && key !== 'endDate'
  ).length

  // Build date options dynamically
  const getDateOptions = () => {
    const options = [
      { value: 'today', label: 'Today' },
      { value: 'yesterday', label: 'Yesterday' },
      { value: 'lastWeek', label: 'Last Week' }
    ]

    // Add available months dynamically
    availableMonths.forEach((month: any) => {
      options.push({
        value: `month_${month.yearMonth}`,
        label: month.monthName
      })
    })

    options.push({ value: 'thisYear', label: 'This Year' })
    return options
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </div>

      {isExpanded && (
        <div className="p-4 border-t border-gray-200">
          {/* Date Range Selector - Presets Only */}
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date Range:
              </label>
              <select
                value={selectedDateRange}
                onChange={(e) => onDateRangeSelect(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                disabled={loading}
              >
                {getDateOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Grid - Team Leader → Role → User */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Team Leader Filter */}
            <CustomSelect
              value={filters.teamLeaderCode}
              onChange={(value) => onFilterChange('teamLeaderCode', value)}
              options={filterOptions.teamLeaders}
              placeholder="All Team Leaders"
              icon={<User className="w-4 h-4 text-gray-500" />}
              label="Team Leader"
              disabled={loading}
              formatOptionLabel={(option) => {
                if (option.subordinateCount) {
                  return `${option.label} (${option.subordinateCount} subordinates)`
                }
                return option.label
              }}
            />

            {/* Field User Role Filter */}
            <CustomSelect
              value={filters.userRole}
              onChange={(value) => onFilterChange('userRole', value)}
              options={filterOptions.roles}
              placeholder="All Roles"
              icon={<Users className="w-4 h-4 text-gray-500" />}
              label="Field User Role"
              disabled={loading}
              formatOptionLabel={(option) => `${option.label} (${option.userCount} users)`}
            />

            {/* Field User Filter */}
            <CustomSelect
              value={filters.userCode}
              onChange={(value) => onFilterChange('userCode', value)}
              options={filterOptions.users}
              placeholder="All Field Users"
              icon={<User className="w-4 h-4 text-gray-500" />}
              label="Field User"
              disabled={loading}
              formatOptionLabel={(option) => option.label}
            />
          </div>

          {/* Filter Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              {activeFilterCount > 0 && (
                <span>
                  Showing filtered data with {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={activeFilterCount === 0}
            >
              <X className="w-4 h-4" />
              Reset Filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
