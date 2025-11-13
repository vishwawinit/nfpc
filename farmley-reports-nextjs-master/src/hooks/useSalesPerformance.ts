import { useState, useEffect } from 'react'

interface SalesPerformanceSummary {
  totalSales: number
  totalOrders: number
  uniqueCustomers: number
  activeSalesmen: number
  avgOrderValue: number
  growthPercentage: number
  periodStart: string
  periodEnd: string
}

interface SalesTrend {
  period: string
  date: string
  sales: number
  orders: number
  salesmen: number
}

interface TopSalesman {
  empNo: string
  name: string
  orders: number
  totalSales: number
  avgOrder: number
}

interface CategoryPerformance {
  name: string
  transactions: number
  unitsSold: number
  revenue: number
}

interface SalesPerformanceData {
  summary: SalesPerformanceSummary
  trend: SalesTrend[]
  topSalesmen: TopSalesman[]
  categoryPerformance: CategoryPerformance[]
}

export const useSalesPerformance = (dateRange: string = 'thisMonth') => {
  const [data, setData] = useState<SalesPerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPerformance = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/sales/performance?range=${dateRange}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || 'Failed to fetch performance data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPerformance()
  }, [dateRange])

  const refresh = () => {
    fetchPerformance()
  }

  return { data, loading, error, refresh }
}