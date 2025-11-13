'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Package, ShoppingCart, TrendingUp, Store, DollarSign, BarChart3, Maximize, Minimize, RefreshCw, ZoomIn, ZoomOut, X } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { businessColors } from '@/styles/businessColors'
import { useDashboardFilters } from '@/hooks/useDashboardFilters'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'
import { useSalesByChannel } from '@/hooks/useDataService'

interface DailyStockSaleReportProps {
  loginUserCode?: string
}

export const DailyStockSaleReport: React.FC<DailyStockSaleReportProps> = ({ loginUserCode = 'admin' }) => {
  const [selectedDateRange, setSelectedDateRange] = useState('thisMonth')
  const [isInitialized, setIsInitialized] = useState(false)
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary')
  const [loading, setLoading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Use the dashboard filters hook with hierarchy support
  const {
    filters,
    filterOptions,
    loading: filtersLoading,
    error: filtersError,
    updateFilter,
    setDateRange,
    resetFilters,
    getQueryParams,
    hierarchyInfo
  } = useDashboardFilters(loginUserCode)

  // Channel colors for pie chart
  const CHANNEL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

  // Data states
  const [summary, setSummary] = useState<any>(null)
  const [trendData, setTrendData] = useState<any[]>([])
  const [productsData, setProductsData] = useState<any[]>([])
  const [storesData, setStoresData] = useState<any[]>([])
  const [usersData, setUsersData] = useState<any[]>([])
  const [transactionsData, setTransactionsData] = useState<any[]>([])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100

  // Table fullscreen and zoom state
  const [isTableFullscreen, setIsTableFullscreen] = useState(false)
  const [tableZoom, setTableZoom] = useState(100)

  // Get days from range
  const getDaysFromRange = (range: string): number => {
    switch(range) {
      case 'today': return 1
      case 'yesterday': return 2
      case 'thisWeek': return 7
      case 'lastWeek': return 14
      case 'thisMonth': return 30
      case 'lastMonth': return 60
      case 'thisQuarter': return 90
      case 'lastQuarter': return 90
      case 'thisYear': return 365
      default: return 30
    }
  }

  const getDateRangeLabel = (range: string): string => {
    switch(range) {
      case 'today': return 'Today'
      case 'yesterday': return 'Yesterday'
      case 'thisWeek': return 'Last 7 Days'
      case 'lastWeek': return 'Last 14 Days'
      case 'thisMonth': return 'This Month'
      case 'lastMonth': return 'Last Month'
      case 'thisQuarter': return 'This Quarter'
      case 'lastQuarter': return 'Last Quarter'
      case 'thisYear': return 'This Year'
      default: return 'This Month'
    }
  }

  // Handle date range preset selection - update filters accordingly
  const handleDateRangeSelect = (range: string) => {
    setSelectedDateRange(range)

    // Convert preset to actual dates and update filters
    const currentDate = new Date()
    let startDate: Date | null = null
    let endDate: Date | null = null

    switch(range) {
      case 'today':
        startDate = currentDate
        endDate = currentDate
        break
      case 'yesterday':
        const yesterday = new Date(currentDate)
        yesterday.setDate(yesterday.getDate() - 1)
        startDate = yesterday
        endDate = yesterday
        break
      case 'thisWeek':
        const weekStart = new Date(currentDate)
        weekStart.setDate(weekStart.getDate() - 6)
        startDate = weekStart
        endDate = currentDate
        break
      case 'thisMonth':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        endDate = currentDate
        break
      case 'lastMonth':
        const lastMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
        const lastMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0)
        startDate = lastMonthStart
        endDate = lastMonthEnd
        break
      case 'thisQuarter':
        const quarterStart = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1)
        startDate = quarterStart
        endDate = currentDate
        break
      case 'lastQuarter':
        const currentQuarterStart = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1)
        const lastQuarterStart = new Date(currentQuarterStart)
        lastQuarterStart.setMonth(lastQuarterStart.getMonth() - 3)
        startDate = lastQuarterStart
        endDate = new Date(currentQuarterStart.getTime() - 1)
        break
      case 'thisYear':
        startDate = new Date(currentDate.getFullYear(), 0, 1)
        endDate = currentDate
        break
      default:
        const thirtyDaysAgo = new Date(currentDate)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        startDate = thirtyDaysAgo
        endDate = currentDate
    }

    // Update filters with formatted dates (YYYY-MM-DD)
    if (startDate && endDate) {
      const formatDate = (date: Date) => date.toISOString().split('T')[0]
      setDateRange(formatDate(startDate), formatDate(endDate))
    }
  }

  // Initialize date range on mount
  useEffect(() => {
    if (!isInitialized) {
      handleDateRangeSelect(selectedDateRange)
      setIsInitialized(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, selectedDateRange])

  // Detect mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Memoize query params to prevent infinite re-renders
  const queryParams = useMemo(() => {
    const params = getQueryParams()
    // Add loginUserCode for hierarchy-based filtering
    if (loginUserCode) {
      params.set('loginUserCode', loginUserCode)
    }
    return params.toString()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, loginUserCode])

  // Fetch sales by channel data
  const { data: salesByChannelData, loading: channelLoading } = useSalesByChannel({
    additionalParams: new URLSearchParams(queryParams)
  })

  // Load data when filters change
  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      loadData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams, filters.startDate, filters.endDate])

  const loadData = async () => {
    setLoading(true)
    try {
      const [summaryRes, trendRes, productsRes, storesRes, usersRes, transactionsRes] = await Promise.all([
        fetch(`/api/daily-sales/summary?${queryParams}`),
        fetch(`/api/daily-sales/trend?${queryParams}`),
        fetch(`/api/daily-sales/products?${queryParams}`),
        fetch(`/api/daily-sales/stores?${queryParams}`),
        fetch(`/api/daily-sales/users?${queryParams}`),
        fetch(`/api/daily-sales/transactions?${queryParams}`)
      ])

      const [summaryData, trendResult, productsResult, storesResult, usersResult, transactionsResult] = await Promise.all([
        summaryRes.json(),
        trendRes.json(),
        productsRes.json(),
        storesRes.json(),
        usersRes.json(),
        transactionsRes.json()
      ])

      setSummary(summaryData)
      setTrendData(trendResult?.trend || [])
      setProductsData(productsResult?.products || [])
      setStoresData(storesResult?.stores || [])
      setUsersData(usersResult?.users || [])
      setTransactionsData(transactionsResult?.transactions || [])
    } catch (error) {
      console.error('Error loading sales data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      window.location.href = `/api/daily-sales/export?${queryParams}`
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Format currency
  const formatCurrency = (amount: number | null | undefined) => {
    const currency = summary?.currencyCode || 'INR'
    const validAmount = amount ?? 0
    return `${currency} ${validAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  // Get top products for chart - keep full info for tooltips
  const topProductsChart = useMemo(() => {
    if (!Array.isArray(productsData) || productsData.length === 0) return []
    return productsData.slice(0, 10).map(p => ({
      name: p.productName?.substring(0, 30) + (p.productName?.length > 30 ? '...' : '') || p.productCode,
      fullName: p.productName || p.productCode,
      productCode: p.productCode,
      value: p.netSales
    }))
  }, [productsData])

  // Get top stores for chart
  const topStoresChart = useMemo(() => {
    if (!Array.isArray(storesData) || storesData.length === 0) return []
    return storesData.slice(0, 10).map(s => ({
      name: s.storeName || s.storeCode,
      value: s.netSales
    }))
  }, [storesData])

  // Pie chart data transformation - group channels < 5% as "Others"
  const pieChartData = useMemo(() => {
    if (!salesByChannelData || salesByChannelData.length === 0) return []

    const totalSales = salesByChannelData.reduce((sum: number, channel: any) => sum + Number(channel.sales), 0)

    const channelsWithPercentage = salesByChannelData.map((channel: any) => ({
      ...channel,
      percentage: (Number(channel.sales) / totalSales) * 100
    }))

    const significantChannels = channelsWithPercentage.filter((c: any) => c.percentage >= 5)
    const minorChannels = channelsWithPercentage.filter((c: any) => c.percentage < 5)

    const result = significantChannels.map((c: any) => ({
      channel: c.channel,
      sales: Number(c.sales),
      orders: c.orders,
      customers: c.customers,
      percentage: c.percentage
    }))

    if (minorChannels.length > 0) {
      const othersSales = minorChannels.reduce((sum: number, c: any) => sum + Number(c.sales), 0)
      const othersOrders = minorChannels.reduce((sum: number, c: any) => sum + c.orders, 0)
      const othersCustomers = minorChannels.reduce((sum: number, c: any) => sum + c.customers, 0)

      result.push({
        channel: 'Others',
        sales: othersSales,
        orders: othersOrders,
        customers: othersCustomers,
        percentage: (othersSales / totalSales) * 100
      })
    }

    return result
  }, [salesByChannelData])

  // Transform sales trend data for chart with appropriate date formatting
  const trendChartData = useMemo(() => {
    return trendData.map(item => {
      const date = new Date(item.date)
      let formattedDate = ''
      let fullDate = ''

      // Format date based on selected range for better readability
      switch(selectedDateRange) {
        case 'thisYear':
          // Monthly aggregates - show month names
          formattedDate = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          fullDate = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          break
        case 'thisQuarter':
        case 'lastQuarter':
          // Weekly aggregates - show week starting date
          formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          fullDate = 'Week of ' + date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          break
        default:
          // Daily aggregates - show month and day
          formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          fullDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      }

      return {
        date: formattedDate,
        fullDate: fullDate,
        sales: item.sales,
        orders: item.orders || 0,
        customers: item.customers || 0
      }
    })
  }, [trendData, selectedDateRange])

  const COLORS = businessColors.charts

  // Pagination calculations
  const totalPages = Math.ceil(transactionsData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = transactionsData.slice(startIndex, endIndex)

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1)
  }, [transactionsData.length])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top of table
    document.querySelector('.scrollable-table-container')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-white p-6 space-y-6 overflow-y-auto" : "min-h-screen bg-slate-50 p-4 md:p-6"}>
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              Daily Sales Report
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Comprehensive sales analysis with advanced filtering
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadData} disabled={loading} variant="outline" size="sm" className="sm:size-default">
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              onClick={() => setIsFullscreen(!isFullscreen)}
              variant="outline"
              size="sm"
              className="sm:size-default"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Filters */}
      <DashboardFilters
        filters={filters}
        filterOptions={filterOptions}
        onFilterChange={updateFilter}
        onDateRangeChange={setDateRange}
        onReset={resetFilters}
        loading={filtersLoading}
        selectedDateRange={selectedDateRange}
        onDateRangeSelect={handleDateRangeSelect}
        showChainFilter={true}
        showStoreFilter={true}
        hierarchyInfo={hierarchyInfo}
      />

      {/* View Mode Toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'summary'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Summary View
          </button>
          <button
            onClick={() => setViewMode('detailed')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'detailed'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Detailed View
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <LoadingBar message="Loading sales data..." />
      )}

      {/* KPI Cards */}
      {!loading && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <InfoTooltip content="Total sales amount for the selected period. Net Sales = Gross Sales - Discounts." />
              </div>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalNetSales)}</div>
              <p className="text-xs text-muted-foreground">
                Gross: {formatCurrency(summary.totalSales)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <InfoTooltip content="Count of unique transactions/orders in the period." />
              </div>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                Avg: {formatCurrency(summary.avgOrderValue)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
                <InfoTooltip content="Total number of product units sold across all transactions." />
              </div>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(summary?.totalQuantity || 0).toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">
                Units sold
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Stores</CardTitle>
                <InfoTooltip content="Number of unique retail locations that generated sales in this period." />
              </div>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalStores}</div>
              <p className="text-xs text-muted-foreground">
                Unique stores
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Products</CardTitle>
                <InfoTooltip content="Count of distinct product SKUs sold during the period." />
              </div>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalProducts}</div>
              <p className="text-xs text-muted-foreground">
                Unique products
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Field Users</CardTitle>
                <InfoTooltip content="Number of active field sales representatives who completed transactions." />
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Active users
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary View - Charts */}
      {!loading && viewMode === 'summary' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Daily Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Sales Trend</CardTitle>
            <CardDescription>Sales performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={trendChartData} margin={{ top: 5, right: 50, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  label={{ value: 'Date', position: 'insideBottom', offset: -10, style: { fontSize: 12, fill: '#374151', fontWeight: 600 } }}
                  tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }}
                />
                {/* Left Y-Axis for Sales Amount in INR */}
                <YAxis
                  yAxisId="left"
                  tickFormatter={(value) => `AED${(value / 1000).toFixed(0)}K`}
                  label={{ value: 'Sales (AED)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#374151', fontWeight: 600 } }}
                  tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }}
                />
                {/* Right Y-Axis for Orders, Customers */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toString()}
                  label={{ value: 'Orders/Customers', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#374151', fontWeight: 600 } }}
                  tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }}
                />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    if (name === 'Sales (AED)') {
                      return [`AED${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name]
                    }
                    return [Number(value).toLocaleString(), name]
                  }}
                  labelFormatter={(label: string) => {
                    // Find the full date for this label
                    const dataPoint = trendChartData.find(d => d.date === label)
                    return dataPoint?.fullDate || label
                  }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '2px solid #3b82f6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    padding: '12px 16px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                  }}
                  labelStyle={{
                    fontWeight: '600',
                    fontSize: '15px',
                    color: '#1f2937',
                    marginBottom: '8px'
                  }}
                  itemStyle={{
                    fontSize: '14px',
                    padding: '4px 0'
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '10px' }}
                  iconType="line"
                />
                {/* Sales - Primary line (Blue) */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 8, strokeWidth: 3, fill: '#3b82f6', stroke: '#fff' }}
                  name="Sales (AED)"
                />
                {/* Orders - Line (Green) */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="orders"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 7, strokeWidth: 3, fill: '#10b981', stroke: '#fff' }}
                  name="Orders"
                />
                {/* Customers - Line (Orange) */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="customers"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 7, strokeWidth: 3, fill: '#f97316', stroke: '#fff' }}
                  name="Customers"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Products</CardTitle>
            <CardDescription>Best performing products by sales</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProductsChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `AED${(value / 1000).toFixed(0)}K`}
                  style={{ fontSize: '12px', fill: '#6b7280' }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  style={{ fontSize: '11px', fill: '#374151' }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload
                      return (
                        <div style={{
                          backgroundColor: '#fff',
                          border: '2px solid #10b981',
                          borderRadius: '8px',
                          fontSize: '13px',
                          padding: '12px 16px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }}>
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontWeight: '600', color: '#374151', marginBottom: '4px' }}>{data.fullName}</div>
                            {data.productCode && <div style={{ fontSize: '11px', color: '#6b7280' }}>Code: {data.productCode}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                            <span style={{ fontWeight: '600', color: '#1f2937' }}>
                              AED{Number(payload[0].value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                  cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }}
                />
                <Bar
                  dataKey="value"
                  fill="#10b981"
                  name="Sales"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Stores */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Stores</CardTitle>
            <CardDescription>Best performing stores by sales</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topStoresChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  style={{ fontSize: '11px', fill: '#374151' }}
                  interval={0}
                />
                <YAxis
                  tickFormatter={(value) => `AED${(value / 1000).toFixed(0)}K`}
                  style={{ fontSize: '12px', fill: '#6b7280' }}
                />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    return [
                      <div key="tooltip" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }}></span>
                        <span style={{ fontWeight: '600', color: '#1f2937' }}>
                          AED{Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>,
                      ''
                    ]
                  }}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '2px solid #3b82f6',
                    borderRadius: '8px',
                    fontSize: '13px',
                    padding: '12px 16px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}
                  labelStyle={{ fontWeight: '600', color: '#374151', marginBottom: '6px' }}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                />
                <Bar
                  dataKey="value"
                  fill="#3b82f6"
                  name="Sales"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sales by Channel */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            {channelLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                Loading channel data...
              </div>
            ) : salesByChannelData && salesByChannelData.length > 0 ? (
              <div>
                {/* Pie Chart - Shows channels >= 5% individually, others grouped */}
                <div style={{ height: isMobile ? '200px' : '250px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ channel, percentage }) => `${channel}: ${percentage.toFixed(2)}%`}
                        outerRadius={isMobile ? 70 : 90}
                        fill="#8884d8"
                        dataKey="sales"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null
                          
                          const data = payload[0].payload
                          
                          return (
                            <div style={{
                              backgroundColor: '#fff',
                              border: '2px solid #3b82f6',
                              borderRadius: '8px',
                              padding: '14px 18px',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                              fontSize: '13px',
                              lineHeight: '1.6'
                            }}>
                              <div style={{ fontWeight: '600', marginBottom: '6px', fontSize: '14px', color: '#1f2937' }}>
                                {data.channel}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }}></span>
                                <span>Sales: AED{Number(data.sales).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                                <span>Orders: {data.orders?.toLocaleString()}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }}></span>
                                <span>Customers: {data.customers?.toLocaleString()}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'inline-block' }}></span>
                                <span>Share: {data.percentage?.toFixed(2)}%</span>
                              </div>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Channel Legend - Shows ALL channels individually */}
                <div style={{
                  marginTop: isMobile ? '12px' : '16px',
                  maxHeight: isMobile ? '150px' : '180px',
                  overflowY: 'auto',
                  paddingRight: isMobile ? '4px' : '8px'
                }}>
                  {salesByChannelData.map((channel: any, index: number) => {
                    const percentage = (Number(channel.sales) / salesByChannelData.reduce((sum: number, c: any) => sum + Number(c.sales), 0)) * 100
                    return (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: isMobile ? '8px' : '10px 12px',
                          marginBottom: isMobile ? '6px' : '8px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f4f6'
                          e.currentTarget.style.borderColor = '#d1d5db'
                          e.currentTarget.style.transform = 'translateX(4px)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb'
                          e.currentTarget.style.borderColor = '#e5e7eb'
                          e.currentTarget.style.transform = 'translateX(0)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px', flex: 1 }}>
                          <div style={{
                            width: isMobile ? '10px' : '12px',
                            height: isMobile ? '10px' : '12px',
                            borderRadius: '50%',
                            backgroundColor: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
                            flexShrink: 0
                          }} />
                          <span style={{
                            fontWeight: '500',
                            color: '#374151',
                            fontSize: isMobile ? '13px' : '14px'
                          }}>
                            {channel.channel}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '600', color: '#1f2937', fontSize: isMobile ? '13px' : '14px' }}>
                            AED{Number(channel.sales).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#6b7280', marginTop: '2px' }}>
                            {percentage.toFixed(2)}% • {channel.orders} orders
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                No channel data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Detailed View - Comprehensive Data Table */}
      {!loading && viewMode === 'detailed' && (
        <div className={isTableFullscreen ? "fixed inset-0 z-50 bg-white" : ""}>
          <Card className={isTableFullscreen ? "h-full rounded-none" : ""}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Detailed Transaction Data</CardTitle>
                  <CardDescription>
                    Showing {startIndex + 1}-{Math.min(endIndex, transactionsData.length)} of {transactionsData.length} transactions
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setTableZoom(Math.max(50, tableZoom - 10))}
                    variant="outline"
                    size="sm"
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="flex items-center px-2 text-sm text-gray-600">{tableZoom}%</span>
                  <Button
                    onClick={() => setTableZoom(Math.min(150, tableZoom + 10))}
                    variant="outline"
                    size="sm"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => setIsTableFullscreen(!isTableFullscreen)}
                    variant="outline"
                    size="sm"
                    title={isTableFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                  >
                    {isTableFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </Button>
                  {isTableFullscreen && (
                    <Button
                      onClick={() => setIsTableFullscreen(false)}
                      variant="outline"
                      size="sm"
                      title="Close"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button onClick={handleExport} variant="default" size="sm">
                    Export to Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
          <CardContent className="px-12 py-0">
            <style jsx>{`
              .scrollable-table-container {
                overflow-x: auto;
                overflow-y: auto;
                position: relative;
              }
              .scrollable-table-container::-webkit-scrollbar {
                width: 14px;
                height: 14px;
              }
              .scrollable-table-container::-webkit-scrollbar-track {
                background: #fafafa;
                border-radius: 8px;
                border: 1px solid #f0f0f0;
              }
              .scrollable-table-container::-webkit-scrollbar-thumb {
                background: linear-gradient(180deg, #e8e8e8 0%, #d4d4d4 100%);
                border-radius: 8px;
                border: 2px solid #fafafa;
              }
              .scrollable-table-container::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(180deg, #d4d4d4 0%, #c0c0c0 100%);
              }
              .scrollable-table-container::-webkit-scrollbar-corner {
                background: #fafafa;
              }
              .table-wrapper {
                display: block;
                width: 100%;
                overflow: visible;
              }
              .sticky-header {
                position: sticky;
                top: 0;
                z-index: 100;
                background-color: #f3f4f6;
              }
              .sticky-header th {
                position: sticky;
                top: 0;
                background-color: #f3f4f6;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
            `}</style>
            <div
              className={`scrollable-table-container ${isTableFullscreen ? "max-h-[calc(100vh-200px)]" : "max-h-[600px]"}`}
            >
              <div className="table-wrapper" style={{ transform: `scale(${tableZoom / 100})`, transformOrigin: 'top left', width: `${10000 / tableZoom}%` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead className="sticky-header">
                    <tr className="border-b-2 border-gray-400">
                      <th className="font-semibold text-gray-800 pl-12 pr-6 py-4 min-w-[140px] whitespace-nowrap text-left">Transaction Code</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[120px] whitespace-nowrap text-left">Date</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[140px] whitespace-nowrap text-left">Field User Code</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[180px] whitespace-nowrap text-left">Field User Name</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[150px] whitespace-nowrap text-left">Field User Role</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[120px] whitespace-nowrap text-left">TL Code</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[180px] whitespace-nowrap text-left">TL Name</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[120px] whitespace-nowrap text-left">Region</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[120px] whitespace-nowrap text-left">City</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[120px] whitespace-nowrap text-left">Store Code</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[200px] whitespace-nowrap text-left">Store Name</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[140px] whitespace-nowrap text-left">Product Code</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[250px] whitespace-nowrap text-left">Product Name</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[100px] text-right whitespace-nowrap">Quantity</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 min-w-[130px] text-right whitespace-nowrap">Unit Price</th>
                      <th className="font-semibold text-gray-800 px-6 py-4 pr-12 min-w-[150px] text-right whitespace-nowrap">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((trx, idx) => (
                      <tr key={startIndex + idx} className="hover:bg-gray-50 border-b border-gray-200">
                        <td className="text-sm pl-12 pr-6 py-4 whitespace-nowrap">{trx.trxCode}</td>
                        <td className="text-sm px-6 py-4 whitespace-nowrap">{new Date(trx.trxDateOnly).toLocaleDateString()}</td>
                        <td className="text-sm px-6 py-4 whitespace-nowrap">{trx.fieldUserCode}</td>
                        <td className="text-sm px-6 py-4">{trx.fieldUserName}</td>
                        <td className="text-sm px-6 py-4"><Badge variant="outline" className="text-sm whitespace-nowrap">{trx.fieldUserRole}</Badge></td>
                        <td className="text-sm px-6 py-4 whitespace-nowrap">{trx.tlCode || '-'}</td>
                        <td className="text-sm px-6 py-4">{trx.tlName || '-'}</td>
                        <td className="text-sm px-6 py-4 whitespace-nowrap">{trx.regionCode || '-'}</td>
                        <td className="text-sm px-6 py-4 whitespace-nowrap">{trx.cityCode ? trx.cityCode.split('_').slice(1).join('_') || trx.cityCode : '-'}</td>
                        <td className="text-sm px-6 py-4 whitespace-nowrap">{trx.storeCode}</td>
                        <td className="text-sm px-6 py-4">{trx.storeName}</td>
                        <td className="text-sm px-6 py-4 whitespace-nowrap">{trx.productCode}</td>
                        <td className="text-sm px-6 py-4">{trx.productName}</td>
                        <td className="text-sm text-right px-6 py-4 whitespace-nowrap">{trx.quantity.toFixed(2)}</td>
                        <td className="text-sm text-right px-6 py-4 whitespace-nowrap">{formatCurrency(trx.unitPrice)}</td>
                        <td className="text-sm text-right font-bold px-6 py-4 pr-12 whitespace-nowrap">{formatCurrency(trx.lineAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                  >
                    First
                  </Button>
                  <Button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                  <Button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="sm"
                  >
                    Last
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  )
}
