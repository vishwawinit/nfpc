import { useState, useEffect, useCallback } from 'react'

interface ProductAnalyticsFilters {
  dateRange?: string
  category?: string
  brand?: string
  movement?: string
  sortBy?: string
  search?: string
}

interface UseProductAnalyticsOptions {
  enabled?: boolean
  onError?: (error: string) => void
}

export function useProductAnalytics(filters: ProductAnalyticsFilters = {}, options: UseProductAnalyticsOptions = {}) {
  const { enabled = true, onError } = options
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      // Build query parameters
      const params = new URLSearchParams()
      if (filters.dateRange) params.append('dateRange', filters.dateRange)
      if (filters.category && filters.category !== 'all') params.append('category', filters.category)
      if (filters.brand && filters.brand !== 'all') params.append('brand', filters.brand)
      if (filters.movement && filters.movement !== 'all') params.append('movement', filters.movement)
      if (filters.sortBy) params.append('sortBy', filters.sortBy)
      if (filters.search) params.append('search', filters.search)

      const response = await fetch(`/api/products/analytics?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Failed to fetch product analytics')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      onError?.(errorMessage)
      console.error('Product analytics error:', err)
    } finally {
      setLoading(false)
    }
  }, [enabled, onError, JSON.stringify(filters)])

  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refresh }
}