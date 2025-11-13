'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Users, TrendingUp, ShoppingBag, DollarSign, RefreshCw, ChevronLeft, ChevronRight, Download, X, Maximize2, Minimize2, Search } from 'lucide-react'
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

export function CustomersReport() {
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth')
  const [activeView, setActiveView] = useState<'summary' | 'detailed'>('summary')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [filterOptions, setFilterOptions] = useState<any>(null)
  
  // Filters
  const [regionFilter, setRegionFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [chainFilter, setChainFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [classificationFilter, setClassificationFilter] = useState('all')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50)
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await fetch(`/api/customers/filters-v2?range=${selectedPeriod}`)
      const result = await response.json()
      
      console.log('Customer Report - Filter Options Response:', result)
      console.log('Customer Report - Filter Counts:', {
        regions: result.filters?.regions?.length || 0,
        cities: result.filters?.cities?.length || 0,
        chains: result.filters?.chains?.length || 0,
        salesmen: result.filters?.salesmen?.length || 0,
        routes: result.filters?.routes?.length || 0
      })
      
      if (result.success) {
        setFilterOptions(result.filters)
      } else {
        console.error('Filter options fetch failed:', result.error)
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }, [selectedPeriod])
  
  // Fetch customer data
  const fetchCustomerData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        range: selectedPeriod,
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      })
      
      if (regionFilter && regionFilter !== 'all') params.append('region', regionFilter)
      if (cityFilter && cityFilter !== 'all') params.append('city', cityFilter)
      if (chainFilter && chainFilter !== 'all') params.append('chain', chainFilter)
      if (searchQuery) params.append('search', searchQuery)
      if (classificationFilter && classificationFilter !== 'all') params.append('classification', classificationFilter)
      
      const response = await fetch(`/api/customers/analytics-v2?${params.toString()}`)
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
      } else {
        console.error('Error loading data:', result.error)
      }
    } catch (error) {
      console.error('Error fetching customer data:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedPeriod, currentPage, itemsPerPage, regionFilter, cityFilter, chainFilter, searchQuery, classificationFilter])
  
  // Load data on mount and when filters change
  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])
  
  useEffect(() => {
    fetchCustomerData()
  }, [fetchCustomerData])
  
  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `AED ${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `AED ${(value / 1000).toFixed(0)}K`
    return `AED ${value.toFixed(0)}`
  }
  
  // Format number
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
  }
  
  // Truncate customer name for chart display
  const truncateName = (name: string, maxLength: number = 15) => {
    if (!name) return 'Unknown'
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name
  }
  
  // Get classification for customer
  const getClassification = (sales: number) => {
    if (sales >= 100000) return 'VIP Account'
    if (sales >= 50000) return 'Key Account'
    if (sales >= 20000) return 'A Class'
    if (sales >= 10000) return 'B Class'
    if (sales >= 5000) return 'C Class'
    return 'New Customer'
  }
  
  // Clear all filters
  const resetFilters = () => {
    setRegionFilter('all')
    setCityFilter('all')
    setChainFilter('all')
    setSearchQuery('')
    setClassificationFilter('all')
    setCurrentPage(1)
  }
  
  // Check if any filters are active
  const hasActiveFilters = regionFilter !== 'all' || cityFilter !== 'all' || chainFilter !== 'all' || searchQuery || classificationFilter !== 'all'
  
  // Export to Excel
  const exportToExcel = async () => {
    try {
      // Fetch all data without pagination
      const params = new URLSearchParams({
        range: selectedPeriod,
        page: '1',
        limit: '10000'
      })
      
      if (regionFilter && regionFilter !== 'all') params.append('region', regionFilter)
      if (cityFilter && cityFilter !== 'all') params.append('city', cityFilter)
      if (chainFilter && chainFilter !== 'all') params.append('chain', chainFilter)
      if (searchQuery) params.append('search', searchQuery)
      if (classificationFilter && classificationFilter !== 'all') params.append('classification', classificationFilter)
      
      const response = await fetch(`/api/customers/analytics-v2?${params.toString()}`)
      const result = await response.json()
      
      if (!result.success || !result.data?.topCustomers) {
        alert('No data to export')
        return
      }
      
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Customer Analysis')
      
      // Add headers
      worksheet.columns = [
        { header: 'Customer Code', key: 'customerCode', width: 15 },
        { header: 'Customer Name', key: 'customerName', width: 30 },
        { header: 'Classification', key: 'classification', width: 15 },
        { header: 'Region', key: 'region', width: 20 },
        { header: 'City', key: 'city', width: 20 },
        { header: 'Chain', key: 'chain', width: 20 },
        { header: 'Route', key: 'routeName', width: 20 },
        { header: 'Salesman', key: 'salesmanName', width: 20 },
        { header: 'Total Sales', key: 'totalSales', width: 15 },
        { header: 'Orders', key: 'orderCount', width: 10 },
        { header: 'Avg Order Value', key: 'avgOrderValue', width: 15 },
        { header: 'Last Order', key: 'lastOrderDate', width: 15 },
        { header: 'Days Since Order', key: 'daysSinceLastOrder', width: 15 },
        { header: 'Status', key: 'status', width: 10 }
      ]
      
      // Add data
      result.data.topCustomers.forEach((customer: CustomerData) => {
        worksheet.addRow({
          ...customer,
          classification: getClassification(customer.totalSales)
        })
      })
      
      // Generate file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Customer_Analysis_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data')
    }
  }
  
  const metrics = data?.metrics || {
    totalCustomers: 0,
    activeCustomers: 0,
    totalSales: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    totalOutstanding: 0
  }
  
  const chartColors = ['#00b4d8', '#0077b6', '#90e0ef', '#ffd60a', '#ef476f', '#06ffa5']
  
  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-lg shadow">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Customer Analysis</h1>
            <p className="text-blue-100 mt-1">
              {loading ? 'Loading customer data...' : 
               `Analyzing ${formatNumber(metrics.totalCustomers)} customers`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="secondary"
              size="sm"
              onClick={() => fetchCustomerData()}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40 bg-white text-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="thisQuarter">This Quarter</SelectItem>
                <SelectItem value="lastQuarter">Last Quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold">{formatNumber(metrics.totalCustomers)}</p>
                <p className="text-xs text-green-600">{formatNumber(metrics.activeCustomers)} active</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics.totalSales)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold">{formatNumber(metrics.totalOrders)}</p>
              </div>
              <ShoppingBag className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics.avgOrderValue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Outstanding</p>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(metrics.totalOutstanding)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Rate</p>
                <p className="text-2xl font-bold">
                  {metrics.totalCustomers > 0 
                    ? `${((metrics.activeCustomers / metrics.totalCustomers) * 100).toFixed(1)}%`
                    : '0%'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-cyan-500" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* View Toggle */}
      <div className="flex gap-2">
        <Button
          variant={activeView === 'summary' ? 'default' : 'outline'}
          onClick={() => setActiveView('summary')}
        >
          Summary View
        </Button>
        <Button
          variant={activeView === 'detailed' ? 'default' : 'outline'}
          onClick={() => setActiveView('detailed')}
        >
          Detailed View
        </Button>
      </div>
      
      {/* Filters Section - Only show in detailed view */}
      {activeView === 'detailed' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Filters</CardTitle>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {filterOptions?.regions?.filter((region: any) => region.value && region.value !== '').map((region: any) => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label} ({region.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {filterOptions?.cities?.filter((city: any) => city.value && city.value !== '').map((city: any) => (
                    <SelectItem key={city.value} value={city.value}>
                      {city.label} ({city.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={chainFilter} onValueChange={setChainFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Chain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chains</SelectItem>
                  {filterOptions?.chains?.filter((chain: any) => chain.value && chain.value !== '').map((chain: any) => (
                    <SelectItem key={chain.value} value={chain.value}>
                      {chain.label} ({chain.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="vip">VIP Account</SelectItem>
                  <SelectItem value="key">Key Account</SelectItem>
                  <SelectItem value="a">A Class</SelectItem>
                  <SelectItem value="b">B Class</SelectItem>
                  <SelectItem value="c">C Class</SelectItem>
                  <SelectItem value="new">New Customer</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="col-span-2 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Content based on view */}
      {activeView === 'summary' ? (
        <div className="space-y-6">
          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Classification Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Classification</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data?.customerClassification || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ classification, customerCount, totalSales }) => 
                        `${classification}: ${customerCount} (${formatCurrency(totalSales)})`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="totalSales"
                      nameKey="classification"
                    >
                      {(data?.customerClassification || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={CLASSIFICATION_COLORS[entry.classification as keyof typeof CLASSIFICATION_COLORS] || chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* Sales by Channel Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Sales by Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data?.salesByChannel?.slice(0, 10) || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} />
                    <YAxis tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="value" fill={CHART_COLORS.primary}>
                      <LabelList dataKey="customers" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          
          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ABC Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>ABC Analysis (Pareto)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data?.abcAnalysis || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, percentage }) => `${category}: ${percentage?.toFixed(1)}%`}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="totalSales"
                      nameKey="category"
                    >
                      {(data?.abcAnalysis || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* Top 10 Customers */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top 10 Customers by Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={(() => {
                    const chartData = data?.topCustomers?.slice(0, 10) || []
                    console.log('Top 10 Customers Chart Data:', chartData)
                    return chartData
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="customerName" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      tickFormatter={(value) => truncateName(value, 15)}
                    />
                    <YAxis tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value} />
                    <Tooltip 
                      formatter={(value: number) => [`Sales: ${formatCurrency(value)}`, 'Amount']}
                      labelFormatter={(label) => {
                        const customer = data?.topCustomers?.find((c: any) => c.customerName === label)
                        if (customer) {
                          return `${customer.customerCode} - ${customer.customerName}`
                        }
                        return label
                      }}
                    />
                    <Bar dataKey="totalSales" fill={CHART_COLORS.secondary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Detailed View */
        <Card className={isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Customer Details</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  disabled={loading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className={isFullscreen ? 'h-[calc(100vh-120px)] overflow-auto' : ''}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Code</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Salesman</TableHead>
                    <TableHead>Total Sales</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>AOV</TableHead>
                    <TableHead>Last Order</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                          Loading customer data...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : data?.topCustomers?.length > 0 ? (
                    data.topCustomers.map((customer: CustomerData) => (
                      <TableRow key={customer.customerCode}>
                        <TableCell className="font-medium">{customer.customerCode}</TableCell>
                        <TableCell>{customer.customerName || 'Unknown'}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            style={{ 
                              backgroundColor: CLASSIFICATION_COLORS[getClassification(customer.totalSales) as keyof typeof CLASSIFICATION_COLORS],
                              color: 'white',
                              borderColor: CLASSIFICATION_COLORS[getClassification(customer.totalSales) as keyof typeof CLASSIFICATION_COLORS]
                            }}
                          >
                            {getClassification(customer.totalSales)}
                          </Badge>
                        </TableCell>
                        <TableCell>{customer.region || '-'}</TableCell>
                        <TableCell>{customer.city || '-'}</TableCell>
                        <TableCell>{customer.chain || '-'}</TableCell>
                        <TableCell>{customer.routeCode || customer.routeName || '-'}</TableCell>
                        <TableCell>{customer.salesmanName || customer.salesmanCode || '-'}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatCurrency(customer.totalSales)}
                        </TableCell>
                        <TableCell>{formatNumber(customer.orderCount)}</TableCell>
                        <TableCell>{formatCurrency(customer.avgOrderValue)}</TableCell>
                        <TableCell>
                          {customer.lastOrderDate 
                            ? new Date(customer.lastOrderDate).toLocaleDateString()
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={customer.status === 'Active' ? 'default' : 'secondary'}>
                            {customer.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                        No customer data available for the selected filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {data?.pagination && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-600">
                  Showing {data.pagination.showing}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={!data.pagination.hasPrevPage}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!data.pagination.hasNextPage}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
