import { useState, useEffect, useCallback } from 'react'
import type { DashboardKPI, SalesTrendData, Customer, Product, Transaction } from '@/types'

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
  message?: string
  timestamp?: string
}

interface UseApiDataOptions {
  enabled?: boolean
  refreshInterval?: number // in milliseconds
  onError?: (error: string) => void
}

// Generic hook for API data fetching
export function useApiData<T>(
  endpoint: string,
  options: UseApiDataOptions = {}
) {
  const { enabled = true, refreshInterval, onError } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(enabled)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result: ApiResponse<T> = await response.json()

      if (!result.success) {
        throw new Error(result.error || result.message || 'API request failed')
      }

      setData(result.data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [endpoint, enabled, onError])

  // Refresh data manually
  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Set up refresh interval
  useEffect(() => {
    if (!refreshInterval || !enabled) return

    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval, enabled])

  return {
    data,
    loading,
    error,
    refresh
  }
}

// Specialized hooks for different data types
export function useDashboardKPI(options: UseApiDataOptions = {}) {
  return useApiData<DashboardKPI>('/api/dashboard/kpi', {
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    ...options
  })
}

export function useSalesTrend(days: number = 30, options: UseApiDataOptions = {}) {
  return useApiData<SalesTrendData[]>(`/api/dashboard/sales-trend?days=${days}`, {
    refreshInterval: 15 * 60 * 1000, // 15 minutes
    ...options
  })
}

export function useTopCustomers(limit: number = 20, options: UseApiDataOptions = {}) {
  return useApiData<Customer[]>(`/api/customers/top?limit=${limit}`, {
    refreshInterval: 30 * 60 * 1000, // 30 minutes
    ...options
  })
}

export function useTopProducts(limit: number = 20, options: UseApiDataOptions = {}) {
  return useApiData<Product[]>(`/api/products/top?limit=${limit}`, {
    refreshInterval: 30 * 60 * 1000, // 30 minutes
    ...options
  })
}

export function useTransactions(
  filters: Record<string, string | number | undefined> = {},
  options: UseApiDataOptions = {}
) {
  const queryParams = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value))
    }
  })

  const queryString = queryParams.toString()
  const endpoint = queryString ? `/api/transactions?${queryString}` : '/api/transactions'

  return useApiData<Transaction[]>(endpoint, {
    refreshInterval: 10 * 60 * 1000, // 10 minutes
    ...options
  })
}

// Hook for manual cache invalidation
export function useCacheInvalidation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invalidateKPI = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/dashboard/kpi', {
        method: 'POST'
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to invalidate KPI cache')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const invalidateTransactions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST'
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to invalidate transactions cache')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    invalidateKPI,
    invalidateTransactions
  }
}

// Hook for real-time data updates (can be extended with WebSocket support)
export function useRealTimeUpdates() {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const triggerUpdate = useCallback(() => {
    setLastUpdate(new Date())
  }, [])

  // This can be extended to listen to WebSocket events, database triggers, etc.
  useEffect(() => {
    // Example: Listen for storage events, WebSocket messages, etc.
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sfa-data-update') {
        triggerUpdate()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [triggerUpdate])

  return {
    lastUpdate,
    triggerUpdate
  }
}