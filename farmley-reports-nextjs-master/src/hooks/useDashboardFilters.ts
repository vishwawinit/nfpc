import { useState, useEffect, useCallback, useMemo } from 'react'

export interface FilterOption {
  value: string
  label: string
  available?: number
  regionCode?: string
  routeCode?: string
  teamLeaderCode?: string
  role?: string
  userCount?: number
  storeCount?: number
  subordinateCount?: number
  atlCount?: number
  promoterCount?: number
  merchandiserCount?: number
}

export interface DashboardFilters {
  startDate: string | null
  endDate: string | null
  regionCode: string | null
  cityCode: string | null
  fieldUserRole: string | null
  teamLeaderCode: string | null
  userCode: string | null
  chainName: string | null
  storeCode: string | null
}

export interface FilterOptions {
  regions: FilterOption[]
  cities: FilterOption[]
  fieldUserRoles: FilterOption[]
  teamLeaders: FilterOption[]
  fieldUsers: FilterOption[]
  chains: FilterOption[]
  stores: FilterOption[]
  summary: {
    totalRegions: number
    totalRoutes: number
    totalUsers: number
    totalTeamLeaders: number
    totalChains: number
    totalStores: number
    dateRange: {
      min: string
      max: string
      daysWithData: number
    }
  }
}

export interface HierarchyInfo {
  loginUserCode: string | null
  isTeamLeader: boolean
  allowedUserCount: number
  allowedTeamLeaderCount: number
  allowedFieldUserCount: number
}

export const useDashboardFilters = () => {
  // Initialize with default values
  const [filters, setFilters] = useState<DashboardFilters>({
    startDate: null,
    endDate: null,
    regionCode: null,
    cityCode: null,
    fieldUserRole: null,
    teamLeaderCode: null,
    userCode: null,
    chainName: null,
    storeCode: null
  })

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    regions: [],
    cities: [],
    fieldUserRoles: [],
    teamLeaders: [],
    fieldUsers: [],
    chains: [],
    stores: [],
    summary: {
      totalRegions: 0,
      totalRoutes: 0,
      totalUsers: 0,
      totalTeamLeaders: 0,
      totalChains: 0,
      totalStores: 0,
      dateRange: {
        min: '',
        max: '',
        daysWithData: 0
      }
    }
  })

  const [hierarchyInfo, setHierarchyInfo] = useState<HierarchyInfo>({
    loginUserCode: null,
    isTeamLeader: false,
    allowedUserCount: 0,
    allowedTeamLeaderCount: 0,
    allowedFieldUserCount: 0
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch filter options based on current selections
  const fetchFilterOptions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      // Add current filter values to params
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.regionCode) params.append('regionCode', filters.regionCode)
      if (filters.cityCode) params.append('cityCode', filters.cityCode)
      if (filters.fieldUserRole) params.append('fieldUserRole', filters.fieldUserRole)
      if (filters.teamLeaderCode) params.append('teamLeaderCode', filters.teamLeaderCode)
      if (filters.userCode) params.append('userCode', filters.userCode)
      if (filters.chainName) params.append('chainName', filters.chainName)
      if (filters.storeCode) params.append('storeCode', filters.storeCode)
      
      // Authentication removed - no hierarchy filtering

      const response = await fetch(`/api/dashboard/filters?${params}`)
      const result = await response.json()

      if (result.success) {
        setFilterOptions(result.data)
        // Store hierarchy info from response
        if (result.hierarchy) {
          setHierarchyInfo(result.hierarchy)
        }
      } else {
        setError(result.error || 'Failed to fetch filter options')
      }
    } catch (err) {
      console.error('Error fetching filter options:', err)
      setError('Failed to fetch filter options')
    } finally {
      setLoading(false)
    }
  }, [
    filters.startDate,
    filters.endDate,
    filters.regionCode,
    filters.cityCode,
    filters.fieldUserRole,
    filters.teamLeaderCode,
    filters.userCode,
    filters.chainName,
    filters.storeCode
  ])

  // Update filter value with cascading logic
  const updateFilter = useCallback((key: keyof DashboardFilters, value: string | null) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value }

      // Clear dependent filters when parent filter changes
      if (key === 'startDate' || key === 'endDate') {
        // Date change affects all filters - optionally keep selections
        // Or clear all: updated.regionCode = null, updated.routeCode = null, etc.
      }

      if (key === 'regionCode') {
        // Region change clears city and downstream filters
        updated.cityCode = null
        updated.teamLeaderCode = null
        updated.fieldUserRole = null
        updated.userCode = null
      }

      if (key === 'cityCode') {
        // City change clears team leader and subordinates
        updated.teamLeaderCode = null
        updated.fieldUserRole = null
        updated.userCode = null
      }

      if (key === 'teamLeaderCode') {
        // Team leader change clears field user role and user
        updated.fieldUserRole = null
        updated.userCode = null
      }

      if (key === 'fieldUserRole') {
        // Field user role change clears field user
        updated.userCode = null
      }

      if (key === 'chainName') {
        // Chain change may affect stores - clear store selection
        updated.storeCode = null
      }

      // Store is independent - doesn't cascade

      return updated
    })
  }, [])

  // Set date range
  const setDateRange = useCallback((startDate: string | null, endDate: string | null) => {
    setFilters(prev => ({
      ...prev,
      startDate,
      endDate
    }))
  }, [])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters({
      startDate: null,
      endDate: null,
      regionCode: null,
      cityCode: null,
      fieldUserRole: null,
      teamLeaderCode: null,
      userCode: null,
      chainName: null,
      storeCode: null
    })
  }, [])

  // Fetch filter options on mount and when filters change
  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])

  // Build query params for data APIs
  const getQueryParams = useCallback((): URLSearchParams => {
    const params = new URLSearchParams()

    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.regionCode) params.append('regionCode', filters.regionCode)
    if (filters.cityCode) params.append('cityCode', filters.cityCode)
    if (filters.fieldUserRole) params.append('fieldUserRole', filters.fieldUserRole)
    if (filters.teamLeaderCode) params.append('teamLeaderCode', filters.teamLeaderCode)
    if (filters.userCode) params.append('userCode', filters.userCode)
    if (filters.chainName) params.append('chainName', filters.chainName)
    if (filters.storeCode) params.append('storeCode', filters.storeCode)
    
    // Authentication removed - no hierarchy filtering

    return params
  }, [filters])

  return {
    filters,
    filterOptions,
    loading,
    error,
    updateFilter,
    setDateRange,
    resetFilters,
    getQueryParams,
    summary: filterOptions.summary,
    hierarchyInfo
  }
}