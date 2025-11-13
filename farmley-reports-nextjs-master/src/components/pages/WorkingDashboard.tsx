import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { TrendingUp, TrendingDown, Loader2, Store, Calendar, MapPin, Phone, Mail, Download } from 'lucide-react'
import * as ExcelJS from 'exceljs'
import { useSalesPerformance } from '@/hooks/useSalesPerformance'
import { useTopCustomers, useTopProducts, useRecentTransactions } from '@/hooks/useDataService'
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// Helper function to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0)
}

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-IN').format(value)
}

// Helper function to map date range values to API parameters
const mapDateRangeToAPI = (dateRange: string) => {
  switch (dateRange) {
    case 'today': return 'today'
    case 'yesterday': return 'yesterday'
    case 'last7days': return 'thisWeek'
    case 'last30days': return 'last30Days'
    case 'thisMonth': return 'thisMonth'
    case 'lastMonth': return 'lastMonth'
    case 'thisQuarter': return 'thisQuarter'
    case 'lastQuarter': return 'lastQuarter'
    case 'thisYear': return 'thisYear'
    default: return 'thisMonth'
  }
}

export const WorkingDashboard: React.FC = () => {
  console.log('WorkingDashboard component rendered')

  const [dateRange, setDateRange] = useState('last30days')
  const apiDateRange = mapDateRangeToAPI(dateRange)

  // Fetch real data using hooks
  const { data: performanceData, loading: perfLoading } = useSalesPerformance(apiDateRange)
  const { data: topCustomersData, loading: customersLoading } = useTopCustomers(1000, apiDateRange)
  const { data: topProductsData, loading: productsLoading } = useTopProducts(1000, apiDateRange)
  const { data: recentTransactionsData, loading: transactionsLoading } = useRecentTransactions(5)

  const loading = perfLoading || customersLoading || productsLoading || transactionsLoading

  // Dialog states for customer details
  const [showOrdersDialog, setShowOrdersDialog] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerDetail, setCustomerDetail] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [transactionsLoading2, setTransactionsLoading] = useState(false)

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case 'today': return "Today's Sales"
      case 'yesterday': return "Yesterday's Sales"
      case 'last7days': return "Last 7 Days Sales"
      case 'last30days': return "Last 30 Days Sales"
      case 'thisMonth': return "This Month's Sales"
      case 'lastMonth': return "Last Month's Sales"
      case 'thisQuarter': return "This Quarter's Sales"
      case 'lastQuarter': return "Last Quarter's Sales"
      case 'thisYear': return "This Year's Sales"
      case 'custom': return "Custom Range Sales"
      default: return "This Month's Sales"
    }
  }

  // Transform sales trend data from API
  const salesTrendData = performanceData?.trend && performanceData.trend.length > 0 ?
    performanceData.trend.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sales: Math.round(item.sales / 1000) // Convert to thousands for better chart display
    })) : []

  // Get KPI data from API or show zeros if no data
  const kpiData = {
    totalSales: performanceData?.summary?.totalSales || 0,
    totalOrders: performanceData?.summary?.totalOrders || 0,
    uniqueCustomers: performanceData?.summary?.uniqueCustomers || 0,
    avgOrderValue: performanceData?.summary?.avgOrderValue || 0,
    growthPercentage: performanceData?.summary?.growthPercentage || 0
  }


  // Check if we have any real data
  const hasData = kpiData.totalSales > 0 || kpiData.totalOrders > 0

  // View customer orders in dialog
  const viewCustomerOrders = async (customer: any) => {
    setSelectedCustomer(customer)
    setShowOrdersDialog(true)
    setTransactionsLoading(true)
    
    try {
      const detailResponse = await fetch(`/api/customers/${customer.customerCode}/details`)
      const detailResult = await detailResponse.json()
      
      if (detailResult.success) {
        setCustomerDetail(detailResult.data)
      }
      
      const transUrl = `/api/customers/${customer.customerCode}/transactions?range=${apiDateRange}`
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

  // Export customer transactions to Excel
  const exportCustomerTransactions = async (customer: any, customerDetail: any, transactions: any[]) => {
    const formatCurrencyExport = (value: number) => {
      if (value >= 1000000) return `AED${(value / 1000000).toFixed(1)}M`
      if (value >= 1000) return `AED${(value / 1000).toFixed(0)}K`
      return `AED${value.toFixed(0)}`
    }
    
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Customer Transactions')
      
      worksheet.addRow(['CUSTOMER INFORMATION'])
      worksheet.addRow([])
      worksheet.addRow(['Customer Code:', customer.customerCode || ''])
      worksheet.addRow(['Customer Name:', customerDetail?.customerName || customer.customerName || ''])
      worksheet.addRow(['Region:', customerDetail?.region || customer.region || ''])
      worksheet.addRow(['City:', customerDetail?.city || customer.city || ''])
      worksheet.addRow(['Chain:', customerDetail?.chain || customer.chain || ''])
      if (customerDetail?.address) worksheet.addRow(['Address:', customerDetail.address])
      if (customerDetail?.phone) worksheet.addRow(['Phone:', customerDetail.phone])
      if (customerDetail?.email) worksheet.addRow(['Email:', customerDetail.email])
      worksheet.addRow(['Total Sales:', formatCurrencyExport(customer.totalSales || 0)])
      worksheet.addRow([])
      worksheet.addRow([])
      
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      
      const headerRowIndex = worksheet.lastRow!.number + 1
      worksheet.addRow(['Transaction ID', 'Date', 'Product Code', 'Product Name', 'Quantity', 'Unit Price', 'Total Amount', 'Net Amount'])
      worksheet.getRow(headerRowIndex).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(headerRowIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      
      transactions.forEach(trans => {
        worksheet.addRow([
          trans.transactionId,
          new Date(trans.transactionDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          trans.productCode,
          trans.productName,
          trans.quantity,
          trans.unitPrice,
          trans.totalAmount,
          trans.netAmount
        ])
      })
      
      worksheet.columns = [{ width: 20 }, { width: 15 }, { width: 15 }, { width: 35 }, { width: 12 }, { width: 15 }, { width: 15 }, { width: 15 }]
      
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
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

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 5:
        return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Paid</Badge>
      case 4:
        return <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Invoiced</Badge>
      case 3:
        return <Badge variant="default" className="bg-orange-100 text-orange-800 hover:bg-orange-100">Delivered</Badge>
      default:
        return <Badge variant="default" className="bg-purple-100 text-purple-800 hover:bg-purple-100">Processing</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold">Loading Dashboard...</h2>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-gray-900">
              SFA Dashboard
            </h1>
            <p className="text-gray-500 text-sm">
              Welcome back! Here's your sales performance overview.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Date Range:</span>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last7days">Last 7 Days</SelectItem>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="thisQuarter">This Quarter</SelectItem>
                <SelectItem value="lastQuarter">Last Quarter</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {getDateRangeLabel()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-blue-600">
                  {hasData ? formatCurrency(kpiData.totalSales) : 'AED 0'}
                </div>
                <div className={`flex items-center text-xs mt-2 font-medium ${
                  kpiData.growthPercentage >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {kpiData.growthPercentage >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {hasData ? `${Math.abs(kpiData.growthPercentage).toFixed(1)}% from last period` : '100.0% from last month'}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {getDateRangeLabel().replace('Sales', 'Orders')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">
                  {hasData ? kpiData.totalOrders.toLocaleString() : '0'}
                </div>
                <div className={`flex items-center text-xs mt-2 font-medium ${
                  kpiData.growthPercentage >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {kpiData.growthPercentage >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {hasData ? `${Math.abs(kpiData.growthPercentage).toFixed(1)}% from last period` : '100.0% from last month'}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {getDateRangeLabel().replace('Sales', 'Customers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-orange-600">
                  {hasData ? kpiData.uniqueCustomers.toLocaleString() : '0'}
                </div>
                <div className="flex items-center text-xs text-red-600 mt-2 font-medium">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {hasData ? '0.0% from last period' : '100.0% from last month'}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Avg Order Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-purple-600">
                  {hasData ? formatCurrency(kpiData.avgOrderValue) : 'AED 0'}
                </div>
                <div className="flex items-center text-xs text-red-600 mt-2 font-medium">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {hasData ? '0.0% from last period' : '0.0% from last month'}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Chart Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">
              Sales Trend (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                  <XAxis
                    dataKey="date"
                    className="text-xs"
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: '#6b7280' }}
                    tickFormatter={(value) => `AED ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: any) => [`AED ${value.toLocaleString()}`, 'Sales']}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ fill: '#3b82f6', r: 3 }}
                    activeDot={{ r: 5, fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">
              Top Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : topCustomersData && topCustomersData.length > 0 ? (
              <div className="space-y-3">
                {topCustomersData.map((customer, index) => (
                  <div key={customer.customerCode || index}>
                    <div 
                      className="flex justify-between items-center cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                      onClick={() => viewCustomerOrders(customer)}
                    >
                      <div className="flex items-center">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold flex items-center justify-center mr-2">
                          {index + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm text-blue-600 hover:text-blue-800 font-medium truncate max-w-[150px]">
                            {customer.customerName || 'Unknown Customer'}
                          </span>
                          <span className="text-xs text-gray-500 font-mono">
                            {customer.customerCode || ''}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(customer.totalSales || 0)}
                      </span>
                    </div>
                    {index < topCustomersData.length - 1 && <div className="border-b border-gray-200 mt-3" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <div className="text-center">
                  <div className="text-sm font-medium">No customer data available</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Top Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : topProductsData && topProductsData.length > 0 ? (
              <TooltipProvider>
                <div className="space-y-3">
                  {topProductsData.map((product, index) => (
                    <div key={product.itemCode || index}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <span className="text-xs font-mono text-gray-500 mr-2">{index + 1}</span>
                          <div className="flex flex-col">
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-gray-700 truncate max-w-[180px] cursor-help">
                                  {product.itemDescription || 'Unknown Product'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md">
                                <div className="text-sm">
                                  <div className="font-semibold mb-1">{product.itemDescription || 'Unknown Product'}</div>
                                  {product.itemCode && (
                                    <div className="text-gray-500">Code: {product.itemCode}</div>
                                  )}
                                </div>
                              </TooltipContent>
                            </UITooltip>
                            <span className="text-xs text-gray-500 font-mono">
                              {product.itemCode || ''}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            {(product.totalQuantitySold || 0).toLocaleString()} units
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {formatCurrency((product.totalRevenue || product.totalQuantitySold * (product.averagePrice || 10)) || 0)}
                          </div>
                        </div>
                      </div>
                      {index < topProductsData.length - 1 && <div className="border-b border-gray-200 mt-3" />}
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <div className="text-center">
                  <div className="text-sm font-medium">No product data available</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : recentTransactionsData && recentTransactionsData.length > 0 ? (
              <div className="space-y-4">
                {recentTransactionsData.map((trx, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{trx.clientName || ''}</span>
                        <span className="text-xs text-gray-500 font-mono">{trx.trxCode || trx.clientCode || ''}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(trx.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">{new Date(trx.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</span>
                      <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">
                        {trx.status}
                      </Badge>
                    </div>
                    {index < recentTransactionsData.length - 1 && <div className="border-b border-gray-200 mt-4" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <div className="text-center">
                  <div className="text-sm font-medium">No recent transactions</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Orders Dialog */}
      <Dialog open={showOrdersDialog} onOpenChange={setShowOrdersDialog}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Customer Orders - {selectedCustomer?.customerName}
            </DialogTitle>
            <DialogDescription>
              Order details for selected date range
            </DialogDescription>
          </DialogHeader>
          
          {transactionsLoading2 ? (
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