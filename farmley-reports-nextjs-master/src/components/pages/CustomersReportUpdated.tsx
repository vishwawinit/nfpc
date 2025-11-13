'use client'

import { useState, useCallback, useEffect } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { 
  TrendingUp, TrendingDown, Users, Package, ShoppingCart, DollarSign, 
  Download, RefreshCw, Maximize, Minimize, ChevronLeft, ChevronRight, 
  Eye, Filter, MapPin, Store, Calendar, X, Phone, Mail
} from 'lucide-react'
import * as ExcelJS from 'exceljs'
import { CustomDatePicker } from '@/components/ui/CustomDatePicker'

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-IN').format(value)
}

const truncateName = (name: string, maxLength: number = 15) => {
  if (!name) return 'Unknown'
  return name.length > maxLength ? name.substring(0, maxLength) + '...' : name
}

interface CustomerData {
  customerCode: string
  customerName: string
  region: string
  city: string
  chain: string
  routeCode: string
  tlCode: string
  tlName: string
  salesmanCode: string
  salesmanName: string
  totalSales: number
  orderCount: number
  totalQuantity: number
  avgOrderValue: number
  lastOrderDate: string
}

interface CustomersReportUpdatedProps {
  loginUserCode?: string
}

export function CustomersReportUpdated({ loginUserCode = 'admin' }: CustomersReportUpdatedProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth')
  const [activeView, setActiveView] = useState<'summary' | 'detailed'>('summary')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [filterOptions, setFilterOptions] = useState<any>(null)
  const [showFilters, setShowFilters] = useState(true)
  
  // Date range states
  const [dateRangeType, setDateRangeType] = useState('preset') //  // Date range states - Default to current month (1st to today)
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0])
  
  // Dialog states
  const [showOrdersDialog, setShowOrdersDialog] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerDetail, setCustomerDetail] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  
  // Filters
  const [customerFilter, setCustomerFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [chainFilter, setChainFilter] = useState('')
  const [salesmanFilter, setSalesmanFilter] = useState('')
  const [teamLeaderFilter, setTeamLeaderFilter] = useState('')
  const [productCategoryFilter, setProductCategoryFilter] = useState('')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50)
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      
      // Add loginUserCode for hierarchy filtering
      if (loginUserCode) {
        params.append('loginUserCode', loginUserCode)
      }
      
      // Add date range
      if (dateRangeType === 'custom') {
        params.append('startDate', customStartDate)
        params.append('endDate', customEndDate)
      } else {
        params.append('range', selectedPeriod)
      }
      
      const response = await fetch(`/api/customers/filters-v3?${params.toString()}`)
      const result = await response.json()
      
      if (result.success) {
        setFilterOptions(result.filters)
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }, [selectedPeriod, dateRangeType, customStartDate, customEndDate, loginUserCode])
  
  // Fetch customer data
  const fetchCustomerData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      // Add loginUserCode for hierarchy filtering
      if (loginUserCode) {
        params.append('loginUserCode', loginUserCode)
      }
      
      // Add date range
      if (dateRangeType === 'preset') {
        params.append('range', selectedPeriod)
      } else {
        params.append('startDate', customStartDate)
        params.append('endDate', customEndDate)
      }
      
      if (customerFilter) params.append('customer', customerFilter)
      if (regionFilter) params.append('region', regionFilter)
      if (cityFilter) params.append('city', cityFilter)
      if (chainFilter) params.append('chain', chainFilter)
      if (salesmanFilter) params.append('salesman', salesmanFilter)
      if (teamLeaderFilter) params.append('teamLeader', teamLeaderFilter)
      if (productCategoryFilter) params.append('category', productCategoryFilter)
      
      const response = await fetch(`/api/customers/analytics-v3?${params.toString()}`)
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
  }, [selectedPeriod, dateRangeType, customStartDate, customEndDate, customerFilter, regionFilter, cityFilter, chainFilter, salesmanFilter, teamLeaderFilter, productCategoryFilter, loginUserCode])
  
  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])
  
  useEffect(() => {
    fetchCustomerData()
  }, [fetchCustomerData])
  
  // Reset filters
  const resetFilters = () => {
    setCustomerFilter('')
    setRegionFilter('')
    setCityFilter('')
    setChainFilter('')
    setSalesmanFilter('')
    setTeamLeaderFilter('')
    setProductCategoryFilter('')
    setDateRangeType('preset')
    setSelectedPeriod('thisMonth')
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    setCustomStartDate(date.toISOString().split('T')[0])
    setCustomEndDate(new Date().toISOString().split('T')[0])
    setCurrentPage(1)
  }
  
  // Check if any filters are active
  const hasActiveFilters = customerFilter || regionFilter || cityFilter || chainFilter || 
                          salesmanFilter || teamLeaderFilter || productCategoryFilter
  
  // View customer orders in dialog
  const viewCustomerOrders = async (customer: any) => {
    setSelectedCustomer(customer)
    setShowOrdersDialog(true)
    setTransactionsLoading(true)
    
    try {
      // Fetch customer details
      const detailResponse = await fetch(`/api/customers/${customer.customerCode}/details`)
      const detailResult = await detailResponse.json()
      
      if (detailResult.success) {
        setCustomerDetail(detailResult.data)
      }
      
      // Fetch customer transactions
      let transUrl = `/api/customers/${customer.customerCode}/transactions`
      if (dateRangeType === 'custom') {
        transUrl += `?startDate=${customStartDate}&endDate=${customEndDate}`
      } else {
        transUrl += `?range=${selectedPeriod}`
      }
      const transResponse = await fetch(transUrl)
      const transResult = await transResponse.json()
      
      if (transResult.success) {
        setTransactions(transResult.data.transactions || [])
      }
    } catch (error) {
      console.error('Error fetching customer data:', error)
    } finally {
      setTransactionsLoading(false)
    }
  }
  
  // Export to Excel
  const exportToExcel = async () => {
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '10000'
      })
      
      // Handle date range
      if (dateRangeType === 'custom') {
        params.append('startDate', customStartDate)
        params.append('endDate', customEndDate)
      } else {
        params.append('range', selectedPeriod)
      }
      
      if (customerFilter) params.append('customer', customerFilter)
      if (regionFilter) params.append('region', regionFilter)
      if (cityFilter) params.append('city', cityFilter)
      if (chainFilter) params.append('chain', chainFilter)
      if (salesmanFilter) params.append('salesman', salesmanFilter)
      if (teamLeaderFilter) params.append('teamLeader', teamLeaderFilter)
      if (productCategoryFilter) params.append('category', productCategoryFilter)
      
      const response = await fetch(`/api/customers/analytics-v3?${params.toString()}`)
      const result = await response.json()
      
      if (!result.success || !result.data?.topCustomers) {
        alert('No data to export')
        return
      }
      
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Customer Analysis')
      
      worksheet.columns = [
        { header: 'Customer Code', key: 'customerCode', width: 15 },
        { header: 'Customer Name', key: 'customerName', width: 30 },
        { header: 'Region', key: 'region', width: 20 },
        { header: 'City', key: 'city', width: 20 },
        { header: 'Chain', key: 'chain', width: 20 },
        { header: 'TL Code', key: 'tlCode', width: 15 },
        { header: 'TL Name', key: 'tlName', width: 25 },
        { header: 'Field User Code', key: 'fieldUserCode', width: 15 },
        { header: 'Field User Name', key: 'fieldUserName', width: 25 },
        { header: 'Total Sales', key: 'totalSales', width: 18 },
        { header: 'Order Count', key: 'orderCount', width: 12 },
        { header: 'Quantity/Units', key: 'totalQuantity', width: 15 },
        { header: 'Avg Order Value', key: 'avgOrderValue', width: 18 },
        { header: 'Last Order Date', key: 'lastOrderDate', width: 15 }
      ]
      
      // Format data for Excel
      const formattedData = result.data.topCustomers.map((customer: any) => ({
        customerCode: customer.customerCode || '',
        customerName: customer.customerName || '',
        region: customer.region || '',
        city: customer.city || '',
        chain: customer.chain || '',
        tlCode: customer.tlCode || '',
        tlName: customer.tlName || '',
        fieldUserCode: customer.salesmanCode || '',
        fieldUserName: customer.salesmanName || '',
        totalSales: customer.totalSales || 0,
        orderCount: customer.orderCount || 0,
        totalQuantity: customer.totalQuantity || 0,
        avgOrderValue: customer.avgOrderValue || 0,
        lastOrderDate: customer.lastOrderDate 
          ? new Date(customer.lastOrderDate).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })
          : ''
      }))
      
      worksheet.addRows(formattedData)
      
      // Style the header row
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      }
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
      
      // Format number columns
      worksheet.getColumn('totalSales').numFmt = '#,##0.00'
      worksheet.getColumn('avgOrderValue').numFmt = '#,##0.00'
      worksheet.getColumn('orderCount').numFmt = '#,##0'
      worksheet.getColumn('totalQuantity').numFmt = '#,##0'
      
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `customer-analysis-${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data')
    }
  }
  
  return (
    <div className={`p-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-white overflow-auto' : ''}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">
            Customer Analysis Report
          </h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCustomerData}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Filters Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-gray-600" />
                <CardTitle className="text-lg">Filters</CardTitle>
              </div>
              <div className="flex gap-2">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Date Range Section - Full Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:col-span-2 lg:col-span-3 xl:col-span-4">
                  {/* Date Range Type Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Date Range
                    </label>
                    <Select value={dateRangeType} onValueChange={setDateRangeType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preset">Preset Range</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Preset Date Range or Custom Date Inputs */}
                  {dateRangeType === 'custom' ? (
                    <>
                      <CustomDatePicker
                        value={customStartDate}
                        onChange={setCustomStartDate}
                        label="Start Date"
                        placeholder="Select start date"
                      />
                      <CustomDatePicker
                        value={customEndDate}
                        onChange={setCustomEndDate}
                        label="End Date"
                        placeholder="Select end date"
                      />
                    </>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Period
                      </label>
                      <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="thisWeek">This Week</SelectItem>
                          <SelectItem value="thisMonth">This Month</SelectItem>
                          <SelectItem value="lastMonth">Last Month</SelectItem>
                          <SelectItem value="thisQuarter">This Quarter</SelectItem>
                          <SelectItem value="lastQuarter">Last Quarter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                
                {/* Filter Section - Proper Grid */}
                <SearchableSelect
                  value={customerFilter}
                  onChange={(value) => setCustomerFilter(value || '')}
                  options={filterOptions?.customers || []}
                  placeholder={`All Customers (Available: ${filterOptions?.customers?.length || 0})`}
                  label="Customer"
                />
                
                <SearchableSelect
                  value={regionFilter}
                  onChange={(value) => setRegionFilter(value || '')}
                  options={filterOptions?.regions || []}
                  placeholder={`All Regions (Available: ${filterOptions?.regions?.length || 0})`}
                  label="Region"
                />
                
                <SearchableSelect
                  value={cityFilter}
                  onChange={(value) => setCityFilter(value || '')}
                  options={filterOptions?.cities || []}
                  placeholder={`All Cities (Available: ${filterOptions?.cities?.length || 0})`}
                  label="City"
                />
                
                <SearchableSelect
                  value={chainFilter}
                  onChange={(value) => setChainFilter(value || '')}
                  options={filterOptions?.chains || []}
                  placeholder={`All Chains (Available: ${filterOptions?.chains?.length || 0})`}
                  label="Chain"
                />
                
                <SearchableSelect
                  value={salesmanFilter}
                  onChange={(value) => setSalesmanFilter(value || '')}
                  options={filterOptions?.salesmen || []}
                  placeholder={`All Salesmen (Available: ${filterOptions?.salesmen?.length || 0})`}
                  label="Salesman"
                />
                
                <SearchableSelect
                  value={teamLeaderFilter}
                  onChange={(value) => setTeamLeaderFilter(value || '')}
                  options={filterOptions?.teamLeaders || []}
                  placeholder={`All Team Leaders (Available: ${filterOptions?.teamLeaders?.length || 0})`}
                  label="Team Leader"
                />
                
                <SearchableSelect
                  value={productCategoryFilter}
                  onChange={(value) => setProductCategoryFilter(value || '')}
                  options={filterOptions?.productCategories || []}
                  placeholder={`All Categories (Available: ${filterOptions?.productCategories?.length || 0})`}
                  label="Product Category"
                />
              </div>
            </CardContent>
          )}
        </Card>
      </div>
      
      {loading && <LoadingBar />}
      
      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          <div style={{
            backgroundColor: 'rgb(255, 255, 255)',
            borderRadius: '12px',
            border: '1px solid rgb(228, 228, 231)',
            borderLeft: '4px solid rgb(59, 130, 246)',
            boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
            padding: '16px'
          }}>
            <div style={{
              fontSize: '14px',
              color: 'rgb(113, 113, 122)',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              Total Customers
              <InfoTooltip content="Total unique customers with sales in selected period" />
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(59, 130, 246)',
              marginBottom: '4px'
            }}>
              {formatNumber(data.metrics?.totalCustomers || 0)}
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'rgb(255, 255, 255)',
            borderRadius: '12px',
            border: '1px solid rgb(228, 228, 231)',
            borderLeft: '4px solid rgb(34, 197, 94)',
            boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
            padding: '16px'
          }}>
            <div style={{
              fontSize: '14px',
              color: 'rgb(113, 113, 122)',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              Total Sales
              <InfoTooltip content="Total sales amount in selected period" />
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(34, 197, 94)',
              marginBottom: '4px'
            }}>
              {formatCurrency(data.metrics?.totalSales || 0)}
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'rgb(255, 255, 255)',
            borderRadius: '12px',
            border: '1px solid rgb(228, 228, 231)',
            borderLeft: '4px solid rgb(168, 85, 247)',
            boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
            padding: '16px'
          }}>
            <div style={{
              fontSize: '14px',
              color: 'rgb(113, 113, 122)',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              Total Orders
              <InfoTooltip content="Total number of orders placed" />
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(168, 85, 247)',
              marginBottom: '4px'
            }}>
              {formatNumber(data.metrics?.totalOrders || 0)}
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'rgb(255, 255, 255)',
            borderRadius: '12px',
            border: '1px solid rgb(228, 228, 231)',
            borderLeft: '4px solid rgb(249, 115, 22)',
            boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
            padding: '16px'
          }}>
            <div style={{
              fontSize: '14px',
              color: 'rgb(113, 113, 122)',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              Avg Order Value
              <InfoTooltip content="Average value per order" />
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(249, 115, 22)',
              marginBottom: '4px'
            }}>
              {formatCurrency(data.metrics?.avgOrderValue || 0)}
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'rgb(255, 255, 255)',
            borderRadius: '12px',
            border: '1px solid rgb(228, 228, 231)',
            borderLeft: '4px solid rgb(14, 165, 233)',
            boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
            padding: '16px'
          }}>
            <div style={{
              fontSize: '14px',
              color: 'rgb(113, 113, 122)',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              Avg Orders/Customer
              <InfoTooltip content="Average orders per customer" />
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(14, 165, 233)',
              marginBottom: '4px'
            }}>
              {((data.metrics?.totalOrders || 0) / Math.max(data.metrics?.totalCustomers || 1, 1)).toFixed(1)}
            </div>
          </div>
        </div>
      )}
      
      {/* View Mode Toggle */}
      {data && !loading && (
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
            <button
              onClick={() => setActiveView('summary')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === 'summary'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Summary View
            </button>
            <button
              onClick={() => setActiveView('detailed')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === 'detailed'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Detailed View
            </button>
          </div>
        </div>
      )}
      
      {/* Content based on view mode */}
      {activeView === 'summary' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales by Region */}
          {data?.salesByRegion && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Sales by Region
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.salesByRegion.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="region" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Bar dataKey="sales" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          
          {/* Sales by City */}
          {data?.salesByCity && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Sales by City
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.salesByCity.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="city" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Bar dataKey="sales" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          
          {/* Sales by Product Category */}
          {data?.salesByCategory && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Sales by Product Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.salesByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${entry.name}: ${((entry.value / data.metrics.totalSales) * 100).toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {data.salesByCategory.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          
          {/* Top 10 Customers */}
          {data?.topCustomers && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top 10 Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.topCustomers.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="customerName" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      tickFormatter={(value) => truncateName(value, 15)}
                    />
                    <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                    <Tooltip 
                      formatter={(value: any) => [`Sales: ${formatCurrency(value)}`, 'Amount']}
                      labelFormatter={(label) => {
                        const customer = data.topCustomers.find((c: any) => c.customerName === label)
                        if (customer) {
                          return `${customer.customerCode} - ${customer.customerName}`
                        }
                        return label
                      }}
                    />
                    <Bar dataKey="totalSales" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Detailed View - Table */
        <Card className={isFullscreen ? 'h-full' : ''}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Customer Details</CardTitle>
                {data?.pagination && (
                  <p className="text-sm text-gray-600 mt-1">
                    {data.pagination.showing}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export Excel
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`overflow-x-auto ${isFullscreen ? 'max-h-[calc(100vh-180px)]' : 'max-h-[700px]'}`}>
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px]">Customer Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[250px]">Customer Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">Region</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">City</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">Chain</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">TL Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[180px]">TL Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px]">Field User Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[180px]">Field User Name</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[140px]">Total Sales</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px]">Quantity/Units</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[140px]">Avg Order</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px]">Last Order</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data?.topCustomers?.length > 0 ? (
                    data.topCustomers.map((customer: CustomerData) => (
                      <tr key={customer.customerCode} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.customerCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{customer.customerName}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{customer.region || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{customer.city || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{customer.chain || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{customer.tlCode || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{customer.tlName || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{customer.salesmanCode || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{customer.salesmanName || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                          {formatCurrency(customer.totalSales)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">{formatNumber(customer.orderCount)}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">{formatNumber(customer.totalQuantity || 0)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">{formatCurrency(customer.avgOrderValue)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {customer.lastOrderDate 
                            ? new Date(customer.lastOrderDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewCustomerOrders(customer)}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            View Orders
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={15} className="px-4 py-8 text-center text-sm text-gray-500">
                        No customer data available for the selected filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {data?.pagination && (
              <div className="flex justify-center items-center mt-4">
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
      
      {/* Customer Orders Dialog */}
      <Dialog open={showOrdersDialog} onOpenChange={setShowOrdersDialog}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Customer Orders - {selectedCustomer?.customerName}
            </DialogTitle>
            <DialogDescription>
              Order details for {dateRangeType === 'custom' 
                ? `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`
                : getDateRangeLabel(selectedPeriod)}
            </DialogDescription>
          </DialogHeader>
          
          {transactionsLoading ? (
            <div className="flex justify-center py-8">
              <LoadingBar />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Customer Code</p>
                      <p className="font-semibold">{selectedCustomer?.customerCode}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Customer Name</p>
                      <p className="font-semibold">{customerDetail?.customerName || selectedCustomer?.customerName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Region</p>
                      <p className="font-semibold">{customerDetail?.region || selectedCustomer?.region || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">City</p>
                      <p className="font-semibold">{customerDetail?.city || selectedCustomer?.city || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Chain</p>
                      <p className="font-semibold">{customerDetail?.chain || selectedCustomer?.chain || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Sales</p>
                      <p className="font-semibold text-green-600">{formatCurrency(selectedCustomer?.totalSales || 0)}</p>
                    </div>
                  </div>
                  {customerDetail?.address && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-500 mt-1" />
                        <div>
                          <p className="text-sm text-gray-600">Address</p>
                          <p className="font-medium">{customerDetail.address}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {customerDetail?.phone && (
                          <div className="flex items-start gap-2">
                            <Phone className="h-4 w-4 text-gray-500 mt-1" />
                            <div>
                              <p className="text-sm text-gray-600">Phone</p>
                              <p className="font-medium">{customerDetail.phone}</p>
                            </div>
                          </div>
                        )}
                        {customerDetail?.email && (
                          <div className="flex items-start gap-2">
                            <Mail className="h-4 w-4 text-gray-500 mt-1" />
                            <div>
                              <p className="text-sm text-gray-600">Email</p>
                              <p className="font-medium">{customerDetail.email}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Transactions Table */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Transactions
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => exportCustomerTransactions(selectedCustomer, customerDetail, transactions)}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Transaction ID</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Product Code</TableHead>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Net Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.length > 0 ? (
                          transactions.map((trans: any, index: number) => (
                            <TableRow key={`${trans.transactionId}-${index}`}>
                              <TableCell className="font-medium">{trans.transactionId}</TableCell>
                              <TableCell>
                                {new Date(trans.transactionDate).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </TableCell>
                              <TableCell>{trans.productCode}</TableCell>
                              <TableCell>{trans.productName}</TableCell>
                              <TableCell>{formatNumber(trans.quantity)}</TableCell>
                              <TableCell>{formatCurrency(trans.unitPrice)}</TableCell>
                              <TableCell>{formatCurrency(trans.totalAmount)}</TableCell>
                              <TableCell className="font-semibold text-green-600">
                                {formatCurrency(trans.netAmount)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                              No transactions found for this period
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper function for date range labels
function getDateRangeLabel(range: string): string {
  const labels: any = {
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    thisQuarter: 'This Quarter',
    lastQuarter: 'Last Quarter'
  }
  return labels[range] || range
}

// Export customer transactions to Excel
async function exportCustomerTransactions(customer: any, customerDetail: any, transactions: any[]) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `AED${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `AED${(value / 1000).toFixed(0)}K`
    return `AED${value.toFixed(0)}`
  }
  
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Customer Transactions')
    
    // Add customer info header section
    worksheet.addRow(['CUSTOMER INFORMATION'])
    worksheet.addRow([])
    worksheet.addRow(['Customer Code:', customer.customerCode || ''])
    worksheet.addRow(['Customer Name:', customerDetail?.customerName || customer.customerName || ''])
    worksheet.addRow(['Region:', customerDetail?.region || customer.region || ''])
    worksheet.addRow(['City:', customerDetail?.city || customer.city || ''])
    worksheet.addRow(['Chain:', customerDetail?.chain || customer.chain || ''])
    if (customerDetail?.address) {
      worksheet.addRow(['Address:', customerDetail.address])
    }
    if (customerDetail?.phone) {
      worksheet.addRow(['Phone:', customerDetail.phone])
    }
    if (customerDetail?.email) {
      worksheet.addRow(['Email:', customerDetail.email])
    }
    worksheet.addRow(['Total Sales:', formatCurrency(customer.totalSales || 0)])
    worksheet.addRow([])
    worksheet.addRow([])
    
    // Style customer info section
    worksheet.getRow(1).font = { bold: true, size: 14 }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
    
    // Add transaction headers
    const headerRowIndex = worksheet.lastRow.number + 1
    const headers = [
      'Transaction ID', 'Date', 'Product Code', 'Product Name', 
      'Quantity', 'Unit Price', 'Total Amount', 'Net Amount'
    ]
    worksheet.addRow(headers)
    
    // Style transaction headers
    worksheet.getRow(headerRowIndex).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    worksheet.getRow(headerRowIndex).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    worksheet.getRow(headerRowIndex).alignment = { vertical: 'middle', horizontal: 'center' }
    
    // Add transaction data
    transactions.forEach(trans => {
      worksheet.addRow([
        trans.transactionId,
        new Date(trans.transactionDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }),
        trans.productCode,
        trans.productName,
        trans.quantity,
        trans.unitPrice,
        trans.totalAmount,
        trans.netAmount
      ])
    })
    
    // Set column widths
    worksheet.columns = [
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 35 },
      { width: 12 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ]
    
    // Style the worksheet
    worksheet.eachRow((row, rowNumber) => {
      row.alignment = { vertical: 'middle', horizontal: 'left' }
    })
    
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `customer-${customer.customerCode}-transactions-${new Date().toISOString().split('T')[0]}.xlsx`
    link.click()
  } catch (error) {
    console.error('Export error:', error)
    alert('Failed to export data')
  }
}
