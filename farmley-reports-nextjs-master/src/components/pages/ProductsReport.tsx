'use client'

import React, { useState, useEffect } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Package, TrendingUp, TrendingDown, DollarSign, RefreshCw, ChevronDown, Download, X, Search, Filter, AlertTriangle, BarChart3 } from 'lucide-react'
import ExcelJS from 'exceljs'
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils'
import { CustomDatePicker } from '@/components/ui/CustomDatePicker'

// Chart colors
const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28DFF', '#FF6666', '#8DD1E1', '#83A6ED', '#8884D8', '#82CA9D']

// --- Interfaces ---
interface ProductMetric {
  totalProducts: number
  activeProducts: number
  totalSales: number
  totalQuantity: number
  fastMoving: number
  slowMoving: number
  noSales: number
  currencyCode: string
}

interface SalesByBrand {
  brand: string
  sales: number
  products: number
  quantity: number
}

interface CategorySalesDistribution {
  category: string
  sales: number
  products: number
  quantity: number
  percentage: number
}

interface TopProduct {
  productCode: string
  productName: string
  category: string
  brand: string
  sales: number
  quantity: number
  avgPrice: number
  movementStatus: string
  currencyCode: string
}

interface ProductAnalyticsData {
  metrics: ProductMetric
  salesByBrand: SalesByBrand[]
  categorySalesDistribution: CategorySalesDistribution[]
  topProducts: TopProduct[]
}

interface DetailedProduct {
  productCode: string
  productName: string
  category: string
  subcategory: string
  productGroup: string
  brand: string
  baseUom: string
  imageUrl: string
  maxPrice: number
  minPrice: number
  totalSales: number
  totalQuantity: number
  totalOrders: number
  avgPrice: number
  movementStatus: string
  isActive: boolean
  isDelist: boolean
  currencyCode: string
}

interface FilterOptions {
  categories: Array<{ code: string; name: string }>
  brands: Array<{ code: string; name: string }>
  subcategories: Array<{ code: string; name: string }>
  products?: Array<{ code: string; name: string }>
}

// --- Main Component ---
export function ProductsReport({ loginUserCode }: { loginUserCode?: string }) {
  const [activeTab, setActiveTab] = useState('summary')
  const [analytics, setAnalytics] = useState<ProductAnalyticsData | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)

  // Filters state
  const [filters, setFilters] = useState({
    dateRange: 'thisMonth',
    category: 'all',
    searchTerm: 'all'
  })

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Applied filters state
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [appliedCustomDates, setAppliedCustomDates] = useState({ start: '', end: '' })

  // Detailed view state
  const [detailedProducts, setDetailedProducts] = useState<DetailedProduct[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [sortBy, setSortBy] = useState('total_sales')
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC')

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        range: appliedFilters.dateRange,
        ...(appliedCustomDates.start && { startDate: appliedCustomDates.start }),
        ...(appliedCustomDates.end && { endDate: appliedCustomDates.end }),
        ...(appliedFilters.category !== 'all' && { category: appliedFilters.category }),
        ...(appliedFilters.searchTerm !== 'all' && { productCode: appliedFilters.searchTerm }),
        ...(loginUserCode && { loginUserCode }),
      })

      const response = await fetch(`/api/products/analytics?${params}`)
      const result = await response.json()

      if (result.success) {
        setAnalytics(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to fetch analytics')
      }
    } catch (err) {
      setError('Failed to fetch analytics')
      console.error('Error fetching analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch filter options
  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`/api/products/filters?range=${appliedFilters.dateRange}&includeProducts=true`)
      const result = await response.json()

      if (result.success) {
        setFilterOptions(result.data)
      }
    } catch (err) {
      console.error('Error fetching filter options:', err)
    }
  }

  // Fetch detailed products
  const fetchDetailedProducts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        range: appliedFilters.dateRange,
        page: currentPage.toString(),
        limit: '25',
        sortBy,
        sortOrder,
        ...(appliedCustomDates.start && { startDate: appliedCustomDates.start }),
        ...(appliedCustomDates.end && { endDate: appliedCustomDates.end }),
        ...(appliedFilters.category !== 'all' && { category: appliedFilters.category }),
        ...(appliedFilters.searchTerm !== 'all' && { productCode: appliedFilters.searchTerm }),
        ...(loginUserCode && { loginUserCode }),
      })

      const response = await fetch(`/api/products/details?${params}`)
      const result = await response.json()

      if (result.success) {
        setDetailedProducts(result.data.products)
        setTotalProducts(result.data.pagination.totalCount)
      } else {
        setError(result.error || 'Failed to fetch products')
      }
    } catch (err) {
      console.error('Error fetching detailed products:', err)
      setError('Failed to load product details')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    setAppliedFilters(filters)
    setAppliedCustomDates({ start: customStartDate, end: customEndDate })
    setCurrentPage(1)
  }

  const resetFilters = () => {
    const initialFilters = {
      dateRange: 'lastMonth',
      category: 'all',
      searchTerm: 'all'
    }
    setFilters(initialFilters)
    setCustomStartDate('')
    setCustomEndDate('')
    setAppliedFilters(initialFilters)
    setAppliedCustomDates({ start: '', end: '' })
    setCurrentPage(1)
  }

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value && value !== 'all' && key !== 'dateRange'
  ).length

  useEffect(() => {
    fetchAnalytics()
    fetchFilterOptions()
  }, [appliedFilters.dateRange, appliedFilters.category])

  useEffect(() => {
    if (activeTab === 'detailed') {
      fetchDetailedProducts()
    }
  }, [activeTab, currentPage, sortBy, sortOrder, appliedFilters])

  // Export to Excel
  const exportToExcel = async () => {
    try {
      const params = new URLSearchParams({
        range: appliedFilters.dateRange,
        limit: '999999',
        sortBy,
        sortOrder,
        ...(appliedCustomDates.start && { startDate: appliedCustomDates.start }),
        ...(appliedCustomDates.end && { endDate: appliedCustomDates.end }),
        ...(appliedFilters.category !== 'all' && { category: appliedFilters.category }),
        ...(appliedFilters.searchTerm !== 'all' && { productCode: appliedFilters.searchTerm }),
        ...(loginUserCode && { loginUserCode }),
      })

      const response = await fetch(`/api/products/details?${params}`)
      const result = await response.json()
      const allProducts = result.data?.products || []

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Products Report')

      worksheet.columns = [
        { header: 'Product Code', key: 'productCode', width: 15 },
        { header: 'Product Name', key: 'productName', width: 40 },
        { header: 'Product Group', key: 'category', width: 20 },
        { header: 'UOM', key: 'baseUom', width: 10 },
        { header: 'Sales Amount', key: 'totalSales', width: 15 },
        { header: 'Qty Sold', key: 'totalQuantity', width: 12 },
        { header: 'Avg Price', key: 'avgPrice', width: 12 },
        { header: 'Image URL', key: 'imageUrl', width: 50 },
      ]

      worksheet.addRows(allProducts.map((p: DetailedProduct) => ({
        productCode: p.productCode,
        productName: p.productName,
        category: p.category,
        baseUom: p.baseUom,
        totalSales: parseFloat(p.totalSales.toFixed(2)),
        totalQuantity: p.totalQuantity,
        avgPrice: parseFloat(p.avgPrice.toFixed(2)),
        imageUrl: p.imageUrl,
      })))

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Products_Report_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export to Excel:', err)
    }
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setSortBy(column)
      setSortOrder('DESC')
    }
  }

  const getSortIndicator = (column: string) => {
    if (sortBy === column) {
      return sortOrder === 'ASC' ? ' ▲' : ' ▼'
    }
    return ''
  }

  const getMovementStatusBadge = (status: string) => {
    switch (status) {
      case 'Fast':
        return <Badge className="bg-green-500 text-white">Fast Moving</Badge>
      case 'Medium':
        return <Badge variant="secondary">Medium</Badge>
      case 'Slow':
        return <Badge className="bg-orange-500 text-white">Slow Moving</Badge>
      case 'No Sales':
        return <Badge variant="destructive">No Sales</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatYAxis = (value: number) => {
    if (value >= 10000000) return `AED${(value / 10000000).toFixed(1)}Cr`
    if (value >= 100000) return `AED${(value / 100000).toFixed(0)}L`
    if (value >= 1000) return `AED${(value / 1000).toFixed(0)}K`
    return `AED${value}`
  }

  const totalPages = Math.ceil(totalProducts / 25)
  const metrics = analytics?.metrics

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Analysis</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive product performance and sales analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
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
            className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>

        {isExpanded && (
          <div className="p-5 border-t border-gray-200 space-y-5">
            {/* Filter Controls Row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-700">Filter Controls</h2>
                <span className="text-xs text-slate-500">Configure data parameters</span>
              </div>
              <button
                onClick={resetFilters}
                className="text-xs font-medium text-slate-600 hover:text-slate-800"
                type="button"
              >
                Reset Filters
              </button>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                  Date Range
                </label>
                <Select 
                  value={filters.dateRange} 
                  onValueChange={(value) => setFilters({ ...filters, dateRange: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="thisWeek">Last 7 Days</SelectItem>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="thisQuarter">This Quarter</SelectItem>
                    <SelectItem value="lastQuarter">Last Quarter</SelectItem>
                    <SelectItem value="thisYear">This Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={filters.dateRange !== 'custom' ? 'opacity-50 pointer-events-none' : ''}>
                <CustomDatePicker
                  value={customStartDate}
                  onChange={setCustomStartDate}
                  label="Start Date"
                  placeholder="Select start date"
                />
              </div>
              <div className={filters.dateRange !== 'custom' ? 'opacity-50 pointer-events-none' : ''}>
                <CustomDatePicker
                  value={customEndDate}
                  onChange={setCustomEndDate}
                  label="End Date"
                  placeholder="Select end date"
                />
              </div>
            </div>

            {/* Main Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Product Group Filter */}
              <SearchableSelect
                value={filters.category === 'all' ? '' : filters.category}
                onChange={(value) => setFilters({ ...filters, category: value || 'all' })}
                options={[
                  ...(filterOptions?.categories || []).map(c => ({
                    value: c.code,
                    label: c.name
                  }))
                ]}
                placeholder="All Product Groups"
                label="Product Group"
              />

              {/* Product Search Filter */}
              <SearchableSelect
                value={filters.searchTerm === 'all' ? '' : filters.searchTerm}
                onChange={(value) => setFilters({ ...filters, searchTerm: value || 'all' })}
                options={[
                  ...(filterOptions?.products || []).map(p => ({
                    value: p.code,
                    label: `${p.name} - ${p.code}`
                  }))
                ]}
                placeholder="All Products"
                label="Search Product"
              />
            </div>

            {/* Apply Button */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                {activeFilterCount > 0 && (
                  <span>
                    Showing filtered data with {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={resetFilters}
                  variant="outline"
                  className="flex items-center gap-2"
                  disabled={activeFilterCount === 0 || loading}
                >
                  <X className="w-4 h-4" />
                  Reset All Filters
                </Button>
                <Button
                  onClick={applyFilters}
                  className="flex items-center gap-2"
                  disabled={loading}
                >
                  <Filter className="w-4 h-4" />
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex justify-center mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="grid grid-cols-2 h-10 items-center justify-center rounded-lg bg-slate-100 p-1 gap-1">
            <TabsTrigger 
              value="summary"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2 rounded-md font-medium transition-all"
            >
              Summary View
            </TabsTrigger>
            <TabsTrigger 
              value="detailed"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2 rounded-md font-medium transition-all"
            >
              Detailed View
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Summary Tab */}
        <TabsContent value="summary" className="mt-0 space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Package className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? '...' : formatNumber(metrics?.totalProducts || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatNumber(metrics?.activeProducts || 0)} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? '...' : formatCurrency(metrics?.totalSales || 0, 'INR')}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatNumber(metrics?.totalQuantity || 0)} units sold
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fast Moving</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{loading ? '...' : formatNumber(metrics?.fastMoving || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  High demand products
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Slow/No Sales</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {loading ? '...' : formatNumber((metrics?.slowMoving || 0) + (metrics?.noSales || 0))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatNumber(metrics?.slowMoving || 0)} slow, {formatNumber(metrics?.noSales || 0)} no sales
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sales by Product Group Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Product Groups by Sales</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">Loading...</div>
                ) : analytics?.salesByBrand.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">No data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics?.salesByBrand.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="brand" angle={-45} textAnchor="end" height={100} />
                      <YAxis tickFormatter={formatYAxis} />
                      <Tooltip formatter={(value: number) => formatCurrency(value, 'INR')} />
                      <Bar dataKey="sales" fill="#0088FE" name="Sales" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Product Group Distribution - Pie Chart & List Combined */}
            <Card>
              <CardHeader>
                <CardTitle>Product Group Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">Loading...</div>
                ) : analytics?.categorySalesDistribution.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">No data available</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pie Chart */}
                    <div>
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={analytics?.categorySalesDistribution.slice(0, 6)}
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            fill="#8884d8"
                            dataKey="sales"
                            nameKey="category"
                            label={({ category, percentage }) => percentage > 5 ? `${formatPercentage(percentage)}` : ''}
                          >
                            {analytics?.categorySalesDistribution.slice(0, 6).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value, 'INR')} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                      {analytics?.categorySalesDistribution.slice(0, 6).map((category, index) => (
                        <div
                          key={category.category}
                          className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            />
                            <div>
                              <div className="font-medium text-sm text-gray-900">{category.category}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatNumber(category.products)} products
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-sm text-gray-900">
                              {formatCurrency(category.sales, 'INR')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatPercentage(category.percentage)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Products by Sales</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading products...</div>
              ) : analytics?.topProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No products found</div>
              ) : (
                <div className="space-y-3">
                  {analytics?.topProducts.slice(0, 10).map((product, index) => (
                    <div
                      key={product.productCode}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{product.productName}</div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-mono text-blue-600">{product.productCode}</span>
                            {/* Show category/brand - only once if they're the same */}
                            {(() => {
                              const hasCategory = product.category && product.category !== '-' && product.category !== 'Uncategorized'
                              const hasBrand = product.brand && product.brand !== '-' && product.brand !== 'No Brand'
                              
                              if (hasCategory && hasBrand && product.category === product.brand) {
                                // If both exist and are the same, show only category
                                return (
                                  <>
                                    <span className="mx-1">•</span>
                                    <span>{product.category}</span>
                                  </>
                                )
                              } else if (hasCategory) {
                                // Show category
                                return (
                                  <>
                                    <span className="mx-1">•</span>
                                    <span>{product.category}</span>
                                  </>
                                )
                              } else if (hasBrand) {
                                // Show brand if no category
                                return (
                                  <>
                                    <span className="mx-1">•</span>
                                    <span>{product.brand}</span>
                                  </>
                                )
                              }
                              return null
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">
                          {formatCurrency(product.sales, 'INR')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatNumber(product.quantity)} units
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detailed List Tab */}
        <TabsContent value="detailed" className="mt-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Product Details</h2>
                <p className="text-sm text-gray-600">
                  Showing {detailedProducts.length > 0 ? ((currentPage - 1) * 25) + 1 : 0} to {Math.min(currentPage * 25, totalProducts)} of {totalProducts} products
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={exportToExcel} variant="outline" size="sm" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export Excel
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[700px]">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors min-w-[140px]"
                      onClick={() => handleSort('product_code')}
                    >
                      Code{getSortIndicator('product_code')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors min-w-[300px]"
                      onClick={() => handleSort('product_name')}
                    >
                      Product Name{getSortIndicator('product_name')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors min-w-[180px]"
                      onClick={() => handleSort('category')}
                    >
                      Product Group{getSortIndicator('category')}
                    </th>
                    <th 
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors min-w-[140px]"
                      onClick={() => handleSort('total_sales')}
                    >
                      Sales{getSortIndicator('total_sales')}
                    </th>
                    <th 
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors min-w-[120px]"
                      onClick={() => handleSort('total_quantity')}
                    >
                      Qty Sold{getSortIndicator('total_quantity')}
                    </th>
                    <th 
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors min-w-[140px]"
                      onClick={() => handleSort('avg_price')}
                    >
                      Avg Price{getSortIndicator('avg_price')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">
                      Image
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                        Loading products...
                      </td>
                    </tr>
                  ) : detailedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                        No products found
                      </td>
                    </tr>
                  ) : (
                    detailedProducts.map((product) => (
                      <tr key={product.productCode} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-blue-600 font-medium whitespace-nowrap">
                          {product.productCode}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">{product.productName}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <span className={product.category === 'Uncategorized' ? 'text-gray-400 italic' : 'font-medium'}>
                            {product.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 whitespace-nowrap">
                          {product.totalSales > 0 ? formatCurrency(product.totalSales, 'INR') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                          {product.totalQuantity > 0 ? formatNumber(product.totalQuantity) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                          {product.avgPrice > 0 ? formatCurrency(product.avgPrice, 'INR') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {product.imageUrl ? (
                            <a 
                              href={product.imageUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-block cursor-pointer hover:opacity-80 transition-opacity"
                              title="Click to view full image"
                            >
                              <img 
                                src={product.imageUrl} 
                                alt={product.productName}
                                className="w-12 h-12 object-cover rounded border mx-auto"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                }}
                              />
                            </a>
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center mx-auto">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * 25) + 1} to {Math.min(currentPage * 25, totalProducts)} of {totalProducts} products
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || loading}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
