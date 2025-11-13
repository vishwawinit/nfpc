'use client'

import { useState, useCallback, useEffect } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { 
  ShoppingCart, TrendingUp, Package, DollarSign, Users,
  Download, RefreshCw, Maximize, Minimize, ChevronLeft, ChevronRight, 
  Eye, Filter, MapPin, Store, Calendar, X
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

export function OrdersReport({ loginUserCode }: { loginUserCode?: string }) {
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth')
  const [activeView, setActiveView] = useState<'summary' | 'detailed'>('summary')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [filterOptions, setFilterOptions] = useState<any>(null)
  const [showFilters, setShowFilters] = useState(true)
  
  // Date range states
  const [dateRangeType, setDateRangeType] = useState('preset')
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0])
  
  // Filters - changed from 'all' to empty string to match customer report
  const [regionFilter, setRegionFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [chainFilter, setChainFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [salesmanFilter, setSalesmanFilter] = useState('')
  const [teamLeaderFilter, setTeamLeaderFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  
  const fetchFilterOptions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (dateRangeType === 'custom') {
        params.append('startDate', customStartDate)
        params.append('endDate', customEndDate)
      } else {
        params.append('range', selectedPeriod)
      }
      if (loginUserCode) params.append('loginUserCode', loginUserCode)
      
      let url = `/api/orders/filters?${params.toString()}`
      
      const response = await fetch(url)
      const result = await response.json()
      
      if (result.success) {
        setFilterOptions(result.filters)
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }, [selectedPeriod, dateRangeType, customStartDate, customEndDate, loginUserCode])
  
  const fetchOrdersData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      })
      
      // Handle date range
      if (dateRangeType === 'custom') {
        params.append('startDate', customStartDate)
        params.append('endDate', customEndDate)
      } else {
        params.append('range', selectedPeriod)
      }
      
      if (regionFilter) params.append('region', regionFilter)
      if (cityFilter) params.append('city', cityFilter)
      if (chainFilter) params.append('chain', chainFilter)
      if (customerFilter) params.append('customer', customerFilter)
      if (salesmanFilter) params.append('salesman', salesmanFilter)
      if (teamLeaderFilter) params.append('teamLeader', teamLeaderFilter)
      if (categoryFilter) params.append('category', categoryFilter)
      if (searchQuery) params.append('search', searchQuery)
      if (loginUserCode) params.append('loginUserCode', loginUserCode)
      
      const response = await fetch(`/api/orders?${params.toString()}`)
      const result = await response.json()
      
      if (result.success) {
        console.log('Orders data received:', result.data)
        console.log('Category-wise chart data:', result.data?.charts?.categoryWise)
        setData(result.data)
      } else {
        console.error('Error loading data:', result.error)
      }
    } catch (error) {
      console.error('Error fetching orders data:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedPeriod, dateRangeType, customStartDate, customEndDate, currentPage, customerFilter, regionFilter, cityFilter, chainFilter, salesmanFilter, teamLeaderFilter, categoryFilter, searchQuery, itemsPerPage, loginUserCode])
  
  const fetchOrderDetails = async (orderCode: string) => {
    setLoadingDetails(true)
    setSelectedOrder(orderCode)
    try {
      const params = new URLSearchParams()
      if (loginUserCode) params.append('loginUserCode', loginUserCode)
      
      const response = await fetch(`/api/orders/details/${orderCode}?${params.toString()}`)
      const result = await response.json()
      if (result.success) {
        setOrderDetails(result.data)
      } else {
        console.error('Error loading order details:', result.error)
        alert(result.error || 'Failed to load order details')
      }
    } catch (error) {
      console.error('Error fetching order details:', error)
      alert('Failed to load order details')
    } finally {
      setLoadingDetails(false)
    }
  }
  
  useEffect(() => {
    fetchFilterOptions()
  }, [fetchFilterOptions])
  
  useEffect(() => {
    fetchOrdersData()
  }, [fetchOrdersData])
  
  const resetFilters = () => {
    setRegionFilter('')
    setCityFilter('')
    setChainFilter('')
    setCustomerFilter('')
    setSalesmanFilter('')
    setTeamLeaderFilter('')
    setCategoryFilter('')
    setSearchQuery('')
    setDateRangeType('preset')
    setSelectedPeriod('thisMonth')
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    setCustomStartDate(date.toISOString().split('T')[0])
    setCustomEndDate(new Date().toISOString().split('T')[0])
    setCurrentPage(1)
  }
  
  const hasActiveFilters = regionFilter || cityFilter || chainFilter || 
    customerFilter || salesmanFilter || teamLeaderFilter || 
    categoryFilter || searchQuery
  
  const exportOrderDetails = async (orderDetails: any) => {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Order Details')
      
      // Add order header info
      worksheet.addRow(['ORDER INFORMATION'])
      worksheet.addRow([])
      worksheet.addRow(['Order Code:', orderDetails.header.orderCode])
      worksheet.addRow(['Order Date:', new Date(orderDetails.header.orderDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })])
      worksheet.addRow(['Customer Code:', orderDetails.header.customerCode])
      worksheet.addRow(['Customer Name:', orderDetails.header.customerName])
      worksheet.addRow(['Region:', orderDetails.header.region])
      worksheet.addRow(['City:', orderDetails.header.city])
      worksheet.addRow(['Chain:', orderDetails.header.chain])
      worksheet.addRow(['Salesman:', orderDetails.header.salesman])
      worksheet.addRow([])
      worksheet.addRow([])
      
      // Style header section
      worksheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      }
      
      // Add line items header
      const headerRowIndex = worksheet.lastRow!.number + 1
      worksheet.addRow(['Product Code', 'Product Name', 'Category', 'Quantity', 'Unit Price', 'Amount'])
      
      // Style line items header
      worksheet.getRow(headerRowIndex).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(headerRowIndex).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      }
      worksheet.getRow(headerRowIndex).alignment = { vertical: 'middle', horizontal: 'center' }
      
      // Add line items
      orderDetails.items.forEach((item: any) => {
        worksheet.addRow([
          item.productCode,
          item.productName,
          item.category,
          item.quantity,
          item.unitPrice,
          item.netAmount
        ])
      })
      
      // Add summary
      worksheet.addRow([])
      worksheet.addRow(['', '', '', '', 'Total Items:', orderDetails.summary.itemCount])
      worksheet.addRow(['', '', '', '', 'Total Quantity:', orderDetails.summary.totalQuantity])
      worksheet.addRow(['', '', '', '', 'Order Total:', orderDetails.summary.orderTotal])
      
      // Style summary rows
      const summaryStartRow = worksheet.lastRow!.number - 2
      for (let i = summaryStartRow; i <= worksheet.lastRow!.number; i++) {
        worksheet.getRow(i).font = { bold: true }
      }
      
      // Set column widths
      worksheet.columns = [
        { width: 15 },
        { width: 35 },
        { width: 20 },
        { width: 12 },
        { width: 15 },
        { width: 15 }
      ]
      
      // Format number columns
      worksheet.getColumn(5).numFmt = '#,##0.00'
      worksheet.getColumn(6).numFmt = '#,##0.00'
      
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Order_${orderDetails.header.orderCode}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export order details')
    }
  }
  
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
      
      if (regionFilter) params.append('region', regionFilter)
      if (cityFilter) params.append('city', cityFilter)
      if (chainFilter) params.append('chain', chainFilter)
      if (customerFilter) params.append('customer', customerFilter)
      if (salesmanFilter) params.append('salesman', salesmanFilter)
      if (teamLeaderFilter) params.append('teamLeader', teamLeaderFilter)
      if (categoryFilter) params.append('category', categoryFilter)
      if (loginUserCode) params.append('loginUserCode', loginUserCode)
      
      const response = await fetch(`/api/orders?${params.toString()}`)
      const result = await response.json()
      
      if (!result.success || !result.data?.orders) {
        alert('No data to export')
        return
      }
      
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Orders Report')
      worksheet.columns = [
        { header: 'Order Code', key: 'orderCode', width: 20 },
        { header: 'Order Date', key: 'orderDate', width: 15 },
        { header: 'Customer Code', key: 'customerCode', width: 15 },
        { header: 'Customer Name', key: 'customerName', width: 30 },
        { header: 'Region', key: 'region', width: 20 },
        { header: 'City', key: 'city', width: 20 },
        { header: 'Chain', key: 'chain', width: 20 },
        { header: 'Salesman', key: 'salesman', width: 20 },
        { header: 'Team Leader', key: 'teamLeader', width: 20 },
        { header: 'Items', key: 'itemCount', width: 10 },
        { header: 'Total Quantity', key: 'totalQuantity', width: 15 },
        { header: 'Order Total', key: 'orderTotal', width: 15 }
      ]
      result.data.orders.forEach((order: any) => worksheet.addRow(order))
      
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Orders_Report_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data')
    }
  }
  
  const metrics = data?.metrics || { totalOrders: 0, totalCustomers: 0, totalProducts: 0, totalSales: 0, avgOrderValue: 0, totalQuantity: 0 }
  
  return (
    <div className={`p-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-white overflow-auto' : ''}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">
            Orders Report
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
              onClick={fetchOrdersData}
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
                
                {/* Filter Section */}
                <SearchableSelect
                  value={customerFilter}
                  onChange={(value) => setCustomerFilter(value || '')}
                  options={filterOptions?.customers || []}
                  placeholder="Select Customer"
                  label="Customer"
                />
                
                <SearchableSelect
                  value={regionFilter}
                  onChange={(value) => setRegionFilter(value || '')}
                  options={filterOptions?.regions || []}
                  placeholder="Select Region"
                  label="Region"
                />
                
                <SearchableSelect
                  value={cityFilter}
                  onChange={(value) => setCityFilter(value || '')}
                  options={filterOptions?.cities || []}
                  placeholder="Select City"
                  label="City"
                />
                
                <SearchableSelect
                  value={chainFilter}
                  onChange={(value) => setChainFilter(value || '')}
                  options={filterOptions?.chains || []}
                  placeholder="Select Chain"
                  label="Chain"
                />
                
                <SearchableSelect
                  value={salesmanFilter}
                  onChange={(value) => setSalesmanFilter(value || '')}
                  options={filterOptions?.salesmen || []}
                  placeholder="Select Salesman"
                  label="Salesman"
                />
                
                <SearchableSelect
                  value={teamLeaderFilter}
                  onChange={(value) => setTeamLeaderFilter(value || '')}
                  options={filterOptions?.teamLeaders || []}
                  placeholder="Select Team Leader"
                  label="Team Leader"
                />
                
                <SearchableSelect
                  value={categoryFilter}
                  onChange={(value) => setCategoryFilter(value || '')}
                  options={filterOptions?.productCategories || []}
                  placeholder="Select Category"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
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
              Total Orders
              <InfoTooltip content="Total number of orders in selected period" />
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(59, 130, 246)',
              marginBottom: '4px'
            }}>
              {formatNumber(metrics.totalOrders)}
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
              {formatCurrency(metrics.totalSales)}
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
              Customers
              <InfoTooltip content="Total unique customers with orders" />
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(168, 85, 247)',
              marginBottom: '4px'
            }}>
              {formatNumber(metrics.totalCustomers)}
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
              {formatCurrency(metrics.avgOrderValue)}
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'rgb(255, 255, 255)',
            borderRadius: '12px',
            border: '1px solid rgb(228, 228, 231)',
            borderLeft: '4px solid rgb(236, 72, 153)',
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
              Products
              <InfoTooltip content="Total unique products ordered" />
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(236, 72, 153)',
              marginBottom: '4px'
            }}>
              {formatNumber(metrics.totalProducts)}
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
              Total Quantity
              <InfoTooltip content="Total quantity of items ordered" />
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(14, 165, 233)',
              marginBottom: '4px'
            }}>
              {formatNumber(metrics.totalQuantity)}
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
          {/* Orders by Region */}
          {data?.charts?.regionWise && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Orders by Region
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.charts.regionWise.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="region" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Bar dataKey="totalSales" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          
          {/* Orders by City */}
          {data?.charts?.cityWise && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Orders by City
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.charts.cityWise.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="city" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Bar dataKey="totalSales" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          
          {/* Orders by Chain */}
          {data?.charts?.chainWise && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Orders by Chain
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.charts.chainWise.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="chain" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Bar dataKey="totalSales" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          
          {/* Orders by Product Group */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Orders by Product Group
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.charts?.categoryWise && data.charts.categoryWise.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.charts.categoryWise}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => {
                        const percentage = ((entry.totalSales / metrics.totalSales) * 100).toFixed(1)
                        return `${entry.category || 'Others'}: ${percentage}%`
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="totalSales"
                      nameKey="category"
                    >
                      {data.charts.categoryWise.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(value)}
                      labelFormatter={(label) => `Product Group: ${label}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  <p>No product group data available for the selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Top 10 Customers */}
          {data?.charts?.topCustomers && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top 10 Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.charts.topCustomers.slice(0, 10)}>
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
                      formatter={(value: any) => formatCurrency(value)}
                      labelFormatter={(label) => label}
                    />
                    <Bar dataKey="totalSales" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          
          {/* Top 10 Products */}
          {data?.charts?.topProducts && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Top 10 Products by Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.charts.topProducts.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="productName" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      tickFormatter={(value) => truncateName(value, 15)}
                    />
                    <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Bar dataKey="totalSales" fill="#8b5cf6" />
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
                <CardTitle>Order Details</CardTitle>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">Order Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px]">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[250px]">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">Region</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">City</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">Chain</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[180px]">Salesman</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[80px]">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[140px]">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data?.orders?.length > 0 ? (
                    data.orders.map((order: any) => (
                      <tr key={order.orderCode} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.orderCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {new Date(order.orderDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{order.customerName}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{order.region || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{order.city || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{order.chain || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{order.salesman || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">{order.itemCount || 0}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">{formatNumber(order.totalQuantity || 0)}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                          {formatCurrency(order.orderTotal)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchOrderDetails(order.orderCode)}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">
                        No orders found for the selected filters
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
      
      <Dialog open={selectedOrder !== null} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>Order Details - {orderDetails?.header?.orderCode}</DialogTitle>
              {orderDetails && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportOrderDetails(orderDetails)}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              )}
            </div>
          </DialogHeader>
          {loadingDetails ? (
            <div className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin inline" /></div>
          ) : orderDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded">
                <div><p className="text-sm text-gray-600">Customer</p><p className="font-semibold">{orderDetails.header.customerName}</p></div>
                <div><p className="text-sm text-gray-600">Order Date</p><p className="font-semibold">{new Date(orderDetails.header.orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p></div>
                <div><p className="text-sm text-gray-600">Region</p><p className="font-semibold">{orderDetails.header.region}</p></div>
                <div><p className="text-sm text-gray-600">City</p><p className="font-semibold">{orderDetails.header.city}</p></div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderDetails.items.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{item.productCode}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.netAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded">
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">Total Items: {orderDetails.summary.itemCount}</p>
                  <p className="text-sm text-gray-600">Total Qty: {formatNumber(orderDetails.summary.totalQuantity)}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-lg font-bold text-green-600">Order Total: {formatCurrency(orderDetails.summary.orderTotal)}</p>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
