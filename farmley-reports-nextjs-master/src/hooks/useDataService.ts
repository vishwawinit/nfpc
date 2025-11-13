import { useState, useEffect, useCallback, useMemo } from 'react'
import { dataService } from '@/services/dataService'
import type { DashboardKPI, SalesTrendData, Customer, Product, Transaction, FilterOptions } from '@/types'

interface UseDataServiceOptions {
  enabled?: boolean
  refreshInterval?: number // in milliseconds
  onError?: (error: string) => void
}

// Helper function to get multipliers based on date range
const getDateMultiplier = (dateRange: string) => {
  switch (dateRange) {
    case 'today':
      return { sales: 0.3, orders: 0.4, customers: 0.5, aov: 1.1, mtd: 0.8, ytd: 0.9 }
    case 'yesterday':
      return { sales: 0.4, orders: 0.5, customers: 0.6, aov: 0.95, mtd: 0.85, ytd: 0.92 }
    case 'thisWeek':
      return { sales: 0.6, orders: 0.7, customers: 0.8, aov: 0.9, mtd: 0.95, ytd: 0.96 }
    case 'thisMonth':
      return { sales: 1.0, orders: 1.0, customers: 1.0, aov: 1.0, mtd: 1.0, ytd: 1.0 }
    case 'lastMonth':
      return { sales: 1.2, orders: 1.1, customers: 1.05, aov: 1.08, mtd: 1.1, ytd: 1.02 }
    case 'thisQuarter':
      return { sales: 1.5, orders: 1.3, customers: 1.2, aov: 1.15, mtd: 1.3, ytd: 1.1 }
    case 'thisYear':
      return { sales: 2.0, orders: 1.8, customers: 1.6, aov: 1.2, mtd: 1.8, ytd: 1.5 }
    default:
      return { sales: 1.0, orders: 1.0, customers: 1.0, aov: 1.0, mtd: 1.0, ytd: 1.0 }
  }
}

// Dashboard KPI hook using real API
export function useDashboardKPI(
  dateRange: string = 'thisMonth',
  options: UseDataServiceOptions & { additionalParams?: URLSearchParams } = {}
) {
  const { enabled = true, refreshInterval, onError, additionalParams } = options
  const [data, setData] = useState<DashboardKPI | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Convert additionalParams to string for stable comparison
  const paramsString = useMemo(() => additionalParams?.toString() || '', [additionalParams])

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      // Build query params with date range and additional filters
      const params = new URLSearchParams()
      params.append('range', dateRange)

      // Add additional params if provided
      if (paramsString) {
        const additionalURLParams = new URLSearchParams(paramsString)
        additionalURLParams.forEach((value, key) => {
          params.append(key, value)
        })
      }

      // Log the request for debugging
      console.log('KPI Hook: Fetching with params:', params.toString())

      // Use real API endpoint with date range and filters
      const response = await fetch(`/api/dashboard/kpi?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
        console.log('KPI Hook: Successfully fetched data:', {
          currentSales: result.data.currentSales,
          dateRange,
          hasFilters: paramsString.length > 0
        })
      } else {
        throw new Error(result.error || 'Failed to fetch dashboard KPIs')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
      console.error('Dashboard KPI error:', err)
    } finally {
      setLoading(false)
    }
  }, [enabled, onError, dateRange, paramsString])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (enabled) {
      fetchData()
    }
  }, [fetchData, enabled])

  useEffect(() => {
    if (!refreshInterval || !enabled) return
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval, enabled])

  return { data, loading, error, refresh }
}

// Sales Trend hook using real API - supports both days and date ranges
export function useSalesTrend(param: number | string = 30, options: UseDataServiceOptions & { additionalParams?: URLSearchParams } = {}) {
  const { enabled = true, refreshInterval, onError, additionalParams } = options
  const [data, setData] = useState<SalesTrendData[] | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Convert additionalParams to string for stable comparison
  const paramsString = useMemo(() => additionalParams?.toString() || '', [additionalParams])

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      // Build query params
      const params = new URLSearchParams()
      if (typeof param === 'string') {
        // Date range parameter
        params.append('range', param)
      } else {
        // Days parameter (legacy support)
        params.append('days', param.toString())
      }

      // Add additional params if provided
      if (paramsString) {
        const additionalURLParams = new URLSearchParams(paramsString)
        additionalURLParams.forEach((value, key) => {
          params.append(key, value)
        })
      }

      const response = await fetch(`/api/dashboard/sales-trend?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch sales trend')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
      console.error('Sales trend error:', err)
    } finally {
      setLoading(false)
    }
  }, [param, enabled, onError, paramsString])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!refreshInterval || !enabled) return
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval, enabled])

  return { data, loading, error, refresh }
}

// Top Customers hook - now supports date range filtering
export function useTopCustomers(limit: number = 20, dateRange: string = 'thisMonth', options: UseDataServiceOptions & { additionalParams?: URLSearchParams } = {}) {
  const { enabled = true, refreshInterval, onError, additionalParams } = options
  const [data, setData] = useState<Customer[] | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Convert additionalParams to string for stable comparison
  const paramsString = useMemo(() => additionalParams?.toString() || '', [additionalParams])

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      // Build query params
      const params = new URLSearchParams()
      params.append('limit', limit.toString())
      params.append('range', dateRange)

      // Add additional params if provided
      if (paramsString) {
        const additionalURLParams = new URLSearchParams(paramsString)
        additionalURLParams.forEach((value, key) => {
          params.append(key, value)
        })
      }

      const response = await fetch(`/api/customers/top?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch top customers')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
      console.error('Top customers error:', err)
    } finally {
      setLoading(false)
    }
  }, [limit, enabled, onError, dateRange, paramsString])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!refreshInterval || !enabled) return
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval, enabled])

  return { data, loading, error, refresh }
}

// Top Products hook - now supports date range filtering
export function useTopProducts(limit: number = 20, dateRange: string = 'thisMonth', options: UseDataServiceOptions & { additionalParams?: URLSearchParams } = {}) {
  const { enabled = true, refreshInterval, onError, additionalParams } = options
  const [data, setData] = useState<Product[] | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Convert additionalParams to string for stable comparison
  const paramsString = useMemo(() => additionalParams?.toString() || '', [additionalParams])

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      // Build query params
      const params = new URLSearchParams()
      params.append('limit', limit.toString())
      params.append('range', dateRange)

      // Add additional params if provided
      if (paramsString) {
        const additionalURLParams = new URLSearchParams(paramsString)
        additionalURLParams.forEach((value, key) => {
          params.append(key, value)
        })
      }

      const response = await fetch(`/api/products/top?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch top products')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
      console.error('Top products error:', err)
    } finally {
      setLoading(false)
    }
  }, [limit, enabled, onError, dateRange, paramsString])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!refreshInterval || !enabled) return
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval, enabled])

  return { data, loading, error, refresh }
}

// Sales by Channel hook - fetches sales distribution by chain/channel
export function useSalesByChannel(options: UseDataServiceOptions & { additionalParams?: URLSearchParams } = {}) {
  const { enabled = true, refreshInterval, onError, additionalParams } = options
  const [data, setData] = useState<any[] | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Convert additionalParams to string for stable comparison
  const paramsString = useMemo(() => additionalParams?.toString() || '', [additionalParams])

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      // Build query params
      const params = new URLSearchParams()

      // Add additional params if provided
      if (paramsString) {
        const additionalURLParams = new URLSearchParams(paramsString)
        additionalURLParams.forEach((value, key) => {
          params.append(key, value)
        })
      }

      const response = await fetch(`/api/dashboard/sales-by-channel?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch sales by channel')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
      console.error('Sales by channel error:', err)
    } finally {
      setLoading(false)
    }
  }, [enabled, onError, paramsString])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!refreshInterval || !enabled) return
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval, enabled])

  return { data, loading, error, refresh }
}

// Transactions hook using real API - now supports limit parameter for dashboard display
export function useTransactions(filters: FilterOptions = {}, limit: number = 20, options: UseDataServiceOptions & { additionalParams?: URLSearchParams } = {}) {
  const { enabled = true, refreshInterval, onError, additionalParams } = options
  const [data, setData] = useState<Transaction[] | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Stabilize filters object to prevent infinite re-renders
  const stableFilters = useMemo(() => filters, [
    filters?.startDate,
    filters?.endDate,
    filters?.userCode,
    filters?.organizationCode,
    filters?.customerType,
    filters?.productCategory
  ])

  // Convert additionalParams to string for stable comparison
  const paramsString = useMemo(() => additionalParams?.toString() || '', [additionalParams])

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      // Build query parameters
      const params = new URLSearchParams()

      // Add limit parameter for dashboard top 20 display
      params.append('limit', limit.toString())

      if (stableFilters.startDate) {
        params.append('startDate', new Date(stableFilters.startDate).toISOString().split('T')[0])
      }
      if (stableFilters.endDate) {
        params.append('endDate', new Date(stableFilters.endDate).toISOString().split('T')[0])
      }
      if (stableFilters.userCode) {
        params.append('userCode', stableFilters.userCode)
      }

      // Add additional params if provided
      if (paramsString) {
        const additionalURLParams = new URLSearchParams(paramsString)
        additionalURLParams.forEach((value, key) => {
          params.append(key, value)
        })
      }

      const response = await fetch(`/api/transactions/recent?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch recent transactions')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
      console.error('Recent transactions error:', err)
    } finally {
      setLoading(false)
    }
  }, [stableFilters, limit, enabled, onError, paramsString])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!refreshInterval || !enabled) return
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval, enabled])

  return { data, loading, error, refresh }
}

// Recent Transactions hook using real API
export function useRecentTransactions(limit: number = 5, options: UseDataServiceOptions = {}) {
  const { enabled = true, refreshInterval, onError } = options
  const [data, setData] = useState<any[] | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/transactions/recent?limit=${limit}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch recent transactions')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
      console.error('Recent transactions error:', err)
    } finally {
      setLoading(false)
    }
  }, [limit, enabled, onError])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!refreshInterval || !enabled) return
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval, enabled])

  return { data, loading, error, refresh }
}

// Targets Achievement hook
export function useTargetsAchievement(dateRange: string = 'thisYear', userId?: string, options: UseDataServiceOptions & { loginUserCode?: string } = {}) {
  const { enabled = true, refreshInterval, onError, loginUserCode } = options
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    // Block data fetching if user is invalid (non-admin users will be validated on server)
    if (loginUserCode && loginUserCode !== 'admin') {
      // Server will validate and return 404 if user not found
    }

    try {
      setLoading(true)
      setError(null)

      // Build query parameters
      const params = new URLSearchParams({ range: dateRange })
      if (userId) params.append('userId', userId)

      // Add loginUserCode if provided
      if (loginUserCode) {
        params.append('loginUserCode', loginUserCode)
      }

      const response = await fetch(`/api/targets/achievement?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        // Check if user not found error
        if (result.isUserNotFound) {
          if (typeof window !== 'undefined') {
            window.location.href = `/user-not-found?userCode=${loginUserCode}`
          }
          return
        }
        throw new Error(result.error || 'Failed to fetch targets achievement data')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
      console.error('Targets achievement error:', err)
    } finally {
      setLoading(false)
    }
  }, [enabled, onError, dateRange, userId, loginUserCode])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!refreshInterval || !enabled) return
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval, enabled])

  return { data, loading, error, refresh }
}

// Category Performance hook
export function useCategoryPerformance(limit: number = 10, dateRange: string = 'thisMonth', options: UseDataServiceOptions = {}) {
  const { enabled = true, refreshInterval, onError } = options
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      // Use new category performance API
      const response = await fetch(`/api/categories/performance?limit=${limit}&range=${dateRange}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch category performance')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
      console.error('Category performance error:', err)
    } finally {
      setLoading(false)
    }
  }, [limit, enabled, onError, dateRange])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!refreshInterval || !enabled) return
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval, enabled])

  return { data, loading, error, refresh }
}

// Customer Analytics hook
export function useCustomerAnalytics(
  dateRange: string = 'last30Days',
  filters: {
    channel?: string;
    classification?: string;
    region?: string;
    type?: string;
    status?: string;
    search?: string;
  } = {},
  pagination: {
    page?: number;
    limit?: number;
  } = {},
  options: UseDataServiceOptions = {}
) {
  const { enabled = true, refreshInterval, onError } = options
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Stabilize filters object to prevent infinite re-renders
  const stableFilters = useMemo(() => filters, [
    filters?.channel,
    filters?.classification,
    filters?.region,
    filters?.type,
    filters?.status,
    filters?.search
  ])

  // Stabilize pagination object
  const stablePagination = useMemo(() => pagination, [
    pagination?.page,
    pagination?.limit
  ])

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      // Build query parameters
      const params = new URLSearchParams({ range: dateRange })

      if (stableFilters.channel && stableFilters.channel !== 'all') {
        params.append('channel', stableFilters.channel)
      }
      if (stableFilters.classification && stableFilters.classification !== 'all') {
        params.append('classification', stableFilters.classification)
      }
      if (stableFilters.region && stableFilters.region !== 'all') {
        params.append('region', stableFilters.region)
      }
      if (stableFilters.type && stableFilters.type !== 'all') {
        params.append('type', stableFilters.type)
      }
      if (stableFilters.status && stableFilters.status !== 'all') {
        params.append('status', stableFilters.status)
      }
      if (stableFilters.search) {
        params.append('search', stableFilters.search)
      }
      if (stablePagination.page) {
        params.append('page', stablePagination.page.toString())
      }
      if (stablePagination.limit) {
        params.append('limit', stablePagination.limit.toString())
      }

      const response = await fetch(`/api/customers/analytics?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setData({
          ...result.data,
          pagination: result.pagination // Include pagination from API response
        })
      } else {
        throw new Error(result.error || 'Failed to fetch customer analytics data')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
      console.error('Customer analytics error:', err)
    } finally {
      setLoading(false)
    }
  }, [enabled, onError, dateRange, stableFilters, stablePagination])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!refreshInterval || !enabled) return
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval, enabled])

  return { data, loading, error, refresh }
}

// Additional utility hooks
export function useBatchRefresh() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshAll = useCallback(async (refreshFunctions: (() => void)[]) => {
    setLoading(true)
    setError(null)

    try {
      refreshFunctions.forEach(fn => fn())
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Batch refresh error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, error, refreshAll }
}