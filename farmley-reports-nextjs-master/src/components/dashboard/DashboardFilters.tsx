'use client'

import React, { useState } from 'react'
import { Calendar, MapPin, Users, User, RefreshCw, Filter, X, ChevronDown, Store, Building2 } from 'lucide-react'
import { DashboardFilters as FiltersType, FilterOption, HierarchyInfo } from '@/hooks/useDashboardFilters'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { CustomDatePicker } from '@/components/ui/CustomDatePicker'

interface DashboardFiltersProps {
  filters: FiltersType | any
  filterOptions: {
    regions: FilterOption[]
    cities?: FilterOption[]
    fieldUserRoles: FilterOption[]
    teamLeaders: FilterOption[]
    fieldUsers: FilterOption[]
    chains?: FilterOption[]
    stores?: FilterOption[]
  }
  onFilterChange: (key: keyof FiltersType, value: string | null) => void
  onDateRangeChange: (startDate: string | null, endDate: string | null) => void
  onReset: () => void
  loading?: boolean
  selectedDateRange?: string
  onDateRangeSelect?: (range: string) => void
  showChainFilter?: boolean
  showStoreFilter?: boolean
  showCityFilter?: boolean
  hierarchyInfo?: HierarchyInfo
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  filters,
  filterOptions,
  onFilterChange,
  onDateRangeChange,
  onReset,
  loading = false,
  selectedDateRange = 'thisMonth',
  onDateRangeSelect,
  showChainFilter = false,
  showStoreFilter = false,
  showCityFilter = true,
  hierarchyInfo
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showCustomDateRange, setShowCustomDateRange] = useState(false)

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value && key !== 'startDate' && key !== 'endDate'
  ).length + (filters.startDate && filters.endDate ? 1 : 0)

  const handleCustomDateRange = () => {
    setShowCustomDateRange(!showCustomDateRange)
  }

  const formatOptionLabel = (option: FilterOption) => {
    // Already formatted as "name-code" from API
    return option.label
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
          {loading && (
            <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </div>

      {isExpanded && (
        <div className="p-5 border-t border-gray-200 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">Filter Controls</h2>
              <span className="text-xs text-slate-500">Configure the data set before analysis</span>
            </div>
            <button
              onClick={onReset}
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
              type="button"
            >
              Reset Filters
            </button>
          </div>

          <div className="space-y-4">
            {/* Date Range Presets and Custom Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                  Date Range Preset
                </label>
                <select
                  value={selectedDateRange}
                  onChange={(e) => onDateRangeSelect?.(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                  disabled={loading}
                >
                  <option value="custom">Custom Range</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="thisWeek">Last 7 Days</option>
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="thisQuarter">This Quarter</option>
                  <option value="lastQuarter">Last Quarter</option>
                  <option value="thisYear">This Year</option>
                </select>
              </div>

              {/* Custom Date Range Inputs */}
              <CustomDatePicker
                value={filters.startDate || ''}
                onChange={(date) => onDateRangeChange(date || null, filters.endDate)}
                label="Custom Start Date"
                placeholder="Select start date"
              />
              <CustomDatePicker
                value={filters.endDate || ''}
                onChange={(date) => onDateRangeChange(filters.startDate, date || null)}
                label="Custom End Date"
                placeholder="Select end date"
              />
            </div>

            {/* Main Filters Grid - Hierarchy: Region → City → Team Leader → Field User Role → Field User */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* 1. Region Filter */}
              <SearchableSelect
                value={filters.regionCode || null}
                onChange={(value) => onFilterChange('regionCode', value)}
                options={filterOptions.regions}
                placeholder={`All Regions (Available: ${filterOptions.regions.length})`}
                icon={<MapPin className="w-4 h-4 text-gray-500" />}
                label="Region"
                disabled={loading}
                formatOptionLabel={(option) => formatOptionLabel(option)}
              />

              {/* 2. City Filter */}
              {showCityFilter && filterOptions.cities && filterOptions.cities.length > 0 && (
                <SearchableSelect
                  value={filters.cityCode || null}
                  onChange={(value) => onFilterChange('cityCode', value)}
                  options={filterOptions.cities}
                  placeholder={`All Cities (Available: ${filterOptions.cities.length})`}
                  icon={<MapPin className="w-4 h-4 text-gray-500" />}
                  label="City"
                  disabled={loading}
                  formatOptionLabel={(option) => formatOptionLabel(option)}
                />
              )}

              {/* 3. Team Leader Filter */}
              <div>
                <SearchableSelect
                  value={filters.teamLeaderCode || null}
                  onChange={(value) => onFilterChange('teamLeaderCode', value)}
                  options={filterOptions.teamLeaders}
                  placeholder={`All Team Leaders (Available: ${filterOptions.teamLeaders.length})`}
                  icon={<User className="w-4 h-4 text-gray-500" />}
                  label="Team Leader"
                  disabled={loading || (hierarchyInfo?.isTeamLeader && filterOptions.teamLeaders.length === 1)}
                  formatOptionLabel={(option) => {
                    const opt = option as FilterOption
                    if (opt.subordinateCount) {
                      return `${opt.label} (${opt.subordinateCount} subordinates)`
                    }
                    return formatOptionLabel(option)
                  }}
                />
                {hierarchyInfo?.isTeamLeader && filterOptions.teamLeaders.length === 1 && (
                  <p className="text-xs text-blue-600 mt-1">
                    Fixed to your team
                  </p>
                )}
              </div>

              {/* 4. Field User Role Filter */}
              <SearchableSelect
                value={filters.fieldUserRole || null}
                onChange={(value) => onFilterChange('fieldUserRole', value)}
                options={filterOptions.fieldUserRoles}
                placeholder={`All Roles (Available: ${filterOptions.fieldUserRoles.length})`}
                icon={<Users className="w-4 h-4 text-gray-500" />}
                label="Field User Role"
                disabled={loading}
                formatOptionLabel={(option) => option.label}
              />

              {/* 5. Field User Filter */}
              <SearchableSelect
                value={filters.userCode || null}
                onChange={(value) => onFilterChange('userCode', value)}
                options={filterOptions.fieldUsers}
                placeholder={`All Field Users (Available: ${filterOptions.fieldUsers.length})`}
                icon={<User className="w-4 h-4 text-gray-500" />}
                label="Field User"
                disabled={loading}
                formatOptionLabel={(option) => formatOptionLabel(option)}
              />

              {/* 6. Chain/Channel Filter */}
              {showChainFilter && filterOptions.chains && (
                <SearchableSelect
                  value={filters.chainName || null}
                  onChange={(value) => onFilterChange('chainName', value)}
                  options={filterOptions.chains}
                  placeholder={`All Channels (Available: ${filterOptions.chains.length})`}
                  icon={<Building2 className="w-4 h-4 text-gray-500" />}
                  label="Chain / Channel"
                  disabled={loading}
                  formatOptionLabel={(option) => option.label}
                />
              )}

              {/* 7. Store Filter */}
              {showStoreFilter && filterOptions.stores && (
                <SearchableSelect
                  value={filters.storeCode || null}
                  onChange={(value) => onFilterChange('storeCode', value)}
                  options={filterOptions.stores}
                  placeholder={`All Stores (Available: ${filterOptions.stores.length})`}
                  icon={<Store className="w-4 h-4 text-gray-500" />}
                  label="Store / Customer"
                  disabled={loading}
                  formatOptionLabel={(option) => formatOptionLabel(option)}
                />
              )}
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              {activeFilterCount > 0 && (
                <span>
                  Showing filtered data with {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={activeFilterCount === 0 || loading}
            >
              <X className="w-4 h-4" />
              Reset All Filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}