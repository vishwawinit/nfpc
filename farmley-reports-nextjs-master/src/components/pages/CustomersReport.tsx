'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Users, TrendingUp, ShoppingBag, DollarSign, RefreshCw, ChevronLeft, ChevronRight, Download, X, Maximize2, Minimize2, Search, Filter, ChevronDown, Package, BarChart3 } from 'lucide-react'
import ExcelJS from 'exceljs'

// Color palette
const CHART_COLORS = {
  primary: '#00b4d8',
  secondary: '#0077b6',
  accent: '#90e0ef',
  warning: '#ffd60a',
  danger: '#ef476f',
  success: '#06ffa5',
  info: '#118ab2'
}

const CLASSIFICATION_COLORS = {
  'VIP Account': '#ef4444',
  'Key Account': '#9333ea',
  'A Class': '#0ea5e9',
  'B Class': '#10b981',
  'C Class': '#fbbf24',
  'New Customer': '#94a3b8'
}

interface CustomerData {
  customerCode: string
  customerName: string
  region: string
  city: string
  chain: string
  routeCode: string
  routeName: string
  salesmanCode: string
  salesmanName: string
  totalSales: number
  orderCount: number
  avgOrderValue: number
  lastOrderDate: string
  daysSinceLastOrder: number
  outstandingAmount: number
  status: string
}

interface CustomerMetrics {
  totalCustomers: number
  activeCustomers: number
  totalSales: number
  totalOrders: number
  avgOrderValue: number
  currencyCode: string
}

interface CityAnalysis {
  city: string
  sales: number
  customers: number
}

interface RegionAnalysis {
  region: string
  sales: number
  customers: number
}

interface ChannelCodeAnalysis {
  channelCode: string
  sales: number
  customers: number
  contribution: number
}

interface ChainNameAnalysis {
  chainName: string
  sales: number
  customers: number
}

interface Customer {
  customerCode: string
  customerName: string
  territory: string
  region: string
  regionName: string
  city: string
  channelCode: string
  chainName: string
  totalSales: number
  totalOrders: number
  avgOrderValue: number
  status: string
  lastOrderDate: string
  assignedSalesmen: number
  currencyCode: string
  daysSinceLastOrder?: number | null
}

interface CustomerAnalytics {
  metrics: CustomerMetrics
  cityAnalysis: CityAnalysis[]
  regionAnalysis: RegionAnalysis[]
  channelCodeAnalysis: ChannelCodeAnalysis[]
  chainNameAnalysis: ChainNameAnalysis[]
  customers: Customer[]
}

interface FilterOptions {
  regions: Array<{ code: string; name: string; route_count: number }>
  salesmen: Array<{ code: string; name: string }>
  routes: Array<{ code: string; name: string }>
}

export function CustomersReport() {
  const [activeTab, setActiveTab] = useState('summary')
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)

  // Filters state
  const [filters, setFilters] = useState({
    dateRange: 'lastMonth',
    regionCode: 'all',
    salesmanCode: 'all',
    routeCode: 'all',
    channelCode: 'all',
    searchTerm: '',
  })

  // Applied filters state (for applying filters on button click)
  const [appliedFilters, setAppliedFilters] = useState(filters)

  // Detailed view state
  const [detailedCustomers, setDetailedCustomers] = useState<Customer[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [sortBy, setSortBy] = useState('total_sales')
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC')

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        range: appliedFilters.dateRange,
        ...(appliedFilters.regionCode !== 'all' && { regionCode: appliedFilters.regionCode }),
        ...(appliedFilters.salesmanCode !== 'all' && { salesmanCode: appliedFilters.salesmanCode }),
        ...(appliedFilters.routeCode !== 'all' && { routeCode: appliedFilters.routeCode }),
        ...(appliedFilters.channelCode !== 'all' && { channelCode: appliedFilters.channelCode }),
        ...(appliedFilters.searchTerm && { search: appliedFilters.searchTerm }),
      })

      const response = await fetch(`/api/customers/analytics?${params}`)
      const result = await response.json()

      if (result.success) {
        setAnalytics(result.data)
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
      const response = await fetch(`/api/customers/filters?range=${appliedFilters.dateRange}`)
      const result = await response.json()

      if (result.success) {
        setFilterOptions(result)
      }
    } catch (err) {
      console.error('Error fetching filter options:', err)
    }
  }

  // Fetch detailed customers
  const fetchDetailedCustomers = async () => {
    try {
      const params = new URLSearchParams({
        range: appliedFilters.dateRange,
        page: currentPage.toString(),
        limit: '25',
        sortBy,
        sortOrder,
        ...(appliedFilters.regionCode !== 'all' && { regionCode: appliedFilters.regionCode }),
        ...(appliedFilters.salesmanCode !== 'all' && { salesmanCode: appliedFilters.salesmanCode }),
        ...(appliedFilters.routeCode !== 'all' && { routeCode: appliedFilters.routeCode }),
        ...(appliedFilters.channelCode !== 'all' && { channelCode: appliedFilters.channelCode }),
        ...(appliedFilters.searchTerm && { search: appliedFilters.searchTerm }),
      })

      const response = await fetch(`/api/customers/details?${params}`)
      const result = await response.json()

      if (result.success) {
        setDetailedCustomers(result.data.customers)
        setTotalCustomers(result.data.pagination.totalCount)
      }
    } catch (err) {
      console.error('Error fetching detailed customers:', err)
    }
  }

  const applyFilters = () => {
    setAppliedFilters(filters)
  }

  const resetFilters = () => {
    const initialFilters = {
      dateRange: 'lastMonth',
      regionCode: 'all',
      salesmanCode: 'all',
      routeCode: 'all',
      channelCode: 'all',
      searchTerm: '',
    }
    setFilters(initialFilters)
    setAppliedFilters(initialFilters)
  }

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value && value !== 'all' && key !== 'dateRange'
  ).length

  useEffect(() => {
    fetchAnalytics()
    fetchFilterOptions()
  }, [appliedFilters])

  useEffect(() => {
    if (activeTab === 'detailed') {
      fetchDetailedCustomers()
    }
  }, [activeTab, currentPage, sortBy, sortOrder, appliedFilters])

  const formatCurrency = (amount: number, currency: string = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-AE').format(num)
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Analysis</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive customer sales analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div
          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-800">Filter Controls</h3>
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
                onClick={resetFilters}
                className="text-xs font-medium text-slate-600 hover:text-slate-800"
                type="button"
              >
                Reset Filters
              </button>
            </div>

            <div className="space-y-4">
              {/* Date Range and Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Date Range */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                    Date Range
                  </label>
                  <Select
                    value={filters.dateRange}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, dateRange: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Date Range" />
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
                    </SelectContent>
                  </Select>
                </div>

                {/* Region Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                    Region
                  </label>
                  <Select
                    value={filters.regionCode}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, regionCode: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions ({filterOptions?.regions.length || 0})</SelectItem>
                      {filterOptions?.regions.map((region) => (
                        <SelectItem key={region.code} value={region.code}>
                          {region.name} ({region.route_count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Salesman Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                    Salesman
                  </label>
                  <Select
                    value={filters.salesmanCode}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, salesmanCode: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Salesman" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Salesmen ({filterOptions?.salesmen.length || 0})</SelectItem>
                      {filterOptions?.salesmen.map((salesman) => (
                        <SelectItem key={salesman.code} value={salesman.code}>
                          {salesman.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Route Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                    Route
                  </label>
                  <Select
                    value={filters.routeCode}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, routeCode: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Route" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Routes ({filterOptions?.routes.length || 0})</SelectItem>
                      {filterOptions?.routes.map((route) => (
                        <SelectItem key={route.code} value={route.code}>
                          {route.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Channel Code Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                    Channel Code
                  </label>
                  <Select
                    value={filters.channelCode}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, channelCode: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      <SelectItem value="GT">General Trade (GT)</SelectItem>
                      <SelectItem value="MT">Modern Trade (MT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Search */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                    Search Customer
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search customer..."
                      value={filters.searchTerm}
                      onChange={(e) => setFilters((prev) => ({ ...prev, searchTerm: e.target.value }))}
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>
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
              <div className="flex gap-2">
                <Button onClick={applyFilters} disabled={loading}>
                  Apply Filters
                </Button>
                <Button variant="outline" onClick={resetFilters} disabled={loading}>
                  <X className="w-4 h-4 mr-2" />
                  Reset All Filters
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Key Metrics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatNumber(analytics.metrics.totalCustomers)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {analytics.metrics.activeCustomers} active
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(analytics.metrics.totalSales, analytics.metrics.currencyCode)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatNumber(analytics.metrics.totalOrders)} orders
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatNumber(analytics.metrics.totalOrders)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Invoice transactions
                  </p>
                </div>
                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(analytics.metrics.avgOrderValue, analytics.metrics.currencyCode)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Per order
                  </p>
                </div>
                <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary">Summary View</TabsTrigger>
          <TabsTrigger value="detailed">Detailed View</TabsTrigger>
        </TabsList>

        {/* Summary View */}
        <TabsContent value="summary" className="space-y-6">
          {analytics && (
            <>
              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales by Region */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Sales by Region
                    </CardTitle>
                    <p className="text-sm text-gray-600">Top 10 regions by sales</p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.regionAnalysis.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="region" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value), analytics.metrics.currencyCode)} />
                        <Bar dataKey="sales" fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Sales by City */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Sales by City
                    </CardTitle>
                    <p className="text-sm text-gray-600">Top 10 cities by sales</p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.cityAnalysis.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="city" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value), analytics.metrics.currencyCode)} />
                        <Bar dataKey="sales" fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Channel Code and Chain Name Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Sales by Channel Code
                    </CardTitle>
                    <p className="text-sm text-gray-600">Distribution by channel</p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.channelCodeAnalysis}
                          dataKey="sales"
                          nameKey="channelCode"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={(entry) => `${entry.channelCode}: ${entry.contribution?.toFixed(1)}%`}
                        >
                          {analytics.channelCodeAnalysis.map((entry: any, index: number) => (
                            <Cell key={`channel-cell-${index}`} fill={CHART_COLORS.primary} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [formatCurrency(Number(value), analytics.metrics.currencyCode), name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Sales by Chain Name
                    </CardTitle>
                    <p className="text-sm text-gray-600">Top 10 chains by sales</p>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.chainNameAnalysis.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="chainName" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value), analytics.metrics.currencyCode)} />
                        <Bar dataKey="sales" fill="#8B5CF6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Detailed View */}
        <TabsContent value="detailed" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Customer Details Table</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {totalCustomers > 0
                      ? `Showing ${((currentPage - 1) * 25) + 1}-${Math.min(currentPage * 25, totalCustomers)} of ${formatNumber(totalCustomers)} customers`
                      : 'No customers found'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Sort By:</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="total_sales">Total Sales</SelectItem>
                        <SelectItem value="total_orders">Total Orders</SelectItem>
                        <SelectItem value="avg_order_value">AOV</SelectItem>
                        <SelectItem value="customer_name">Customer Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Select value={sortOrder} onValueChange={(value: 'ASC' | 'DESC') => setSortOrder(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DESC">Highest First</SelectItem>
                      <SelectItem value="ASC">Lowest First</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {detailedCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
                  <p className="text-gray-600">Try adjusting your filters or search criteria</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Code</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Channel Code</TableHead>
                      <TableHead>Chain Name</TableHead>
                      <TableHead>Total Sales</TableHead>
                      <TableHead>Total Orders</TableHead>
                      <TableHead>AOV</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailedCustomers.map((customer) => (
                      <TableRow key={customer.customerCode}>
                        <TableCell className="font-medium text-blue-600 underline cursor-pointer">
                          {customer.customerCode}
                        </TableCell>
                        <TableCell>{customer.customerName}</TableCell>
                        <TableCell>{customer.city || 'N/A'}</TableCell>
                        <TableCell>{customer.regionName || customer.region || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {customer.channelCode || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>{customer.chainName || 'N/A'}</TableCell>
                        <TableCell className="text-green-600">
                          {formatCurrency(customer.totalSales, customer.currencyCode)}
                        </TableCell>
                        <TableCell>{formatNumber(customer.totalOrders)}</TableCell>
                        <TableCell className="text-blue-600">
                          {formatCurrency(customer.avgOrderValue, customer.currencyCode)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(customer.status)}>
                              {customer.status}
                            </Badge>
                            {customer.daysSinceLastOrder !== null && (
                              <span className="text-xs text-gray-500">
                                {customer.daysSinceLastOrder}d ago
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            Orders
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination Controls */}
              {detailedCustomers.length > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {Math.ceil(totalCustomers / 25)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(totalCustomers / 25)}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.ceil(totalCustomers / 25))}
                      disabled={currentPage >= Math.ceil(totalCustomers / 25)}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}