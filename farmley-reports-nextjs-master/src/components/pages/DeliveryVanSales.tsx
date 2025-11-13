'use client'

import React, { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Truck, Package, CheckCircle, Clock, TrendingUp, TrendingDown,
  RefreshCw, Loader2, AlertCircle, BarChart3, Users, Activity,
  PackageCheck, PackageX, Timer, Target, Download, Eye, X
} from 'lucide-react'
import { businessColors } from '@/styles/businessColors'
import { useResponsive } from '@/hooks/useResponsive'
import ExcelJS from 'exceljs'

export function DeliveryVanSales() {
  const [activeTab, setActiveTab] = useState('load-vs-sales')
  const [dateRange, setDateRange] = useState('lastMonth')
  const [selectedSalesman, setSelectedSalesman] = useState('all')
  const [selectedRoute, setSelectedRoute] = useState('all')
  const { isMobile, styles } = useResponsive()

  // State for data
  const [data, setData] = useState<any>(null)
  const [filters, setFilters] = useState<any>({ salesmen: [], routes: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedSalesmanForDetails, setSelectedSalesmanForDetails] = useState<any>(null)

  // Fetch filter options when date range changes
  useEffect(() => {
    fetchFilters()
    // Reset filters when date range changes
    setSelectedSalesman('all')
    setSelectedRoute('all')
  }, [dateRange])

  // Fetch data when filters change
  useEffect(() => {
    fetchData()
  }, [dateRange, selectedSalesman, selectedRoute])

  const fetchFilters = async () => {
    try {
      const response = await fetch(`/api/delivery-van-sales/filters?range=${dateRange}`)
      const result = await response.json()
      if (result.success) {
        setFilters({
          salesmen: result.salesmen || [],
          routes: result.routes || []
        })
      }
    } catch (error) {
      console.error('Error fetching filters:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        range: dateRange,
        salesman: selectedSalesman,
        route: selectedRoute
      })

      const response = await fetch(`/api/delivery-van-sales?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    // Invalidate cache
    await fetch('/api/delivery-van-sales', { method: 'POST' })
    // Refetch data
    await fetchData()
  }

  const tabs = [
    { id: 'load-vs-sales', label: 'Load vs. Sales', icon: Truck },
    { id: 'fulfillment', label: 'Delivery Fulfillment', icon: PackageCheck },
    { id: 'on-time', label: 'On-Time Delivery', icon: Clock },
    { id: 'reconciliation', label: 'Stock Reconciliation', icon: Activity },
    { id: 'productivity', label: 'Salesman Productivity', icon: Users }
  ]

  // Helper function to format numbers
  const formatNumber = (num: number | string) => {
    const value = typeof num === 'string' ? parseFloat(num) : num
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0)
  }

  const formatCurrency = (num: number | string) => {
    const value = typeof num === 'string' ? parseFloat(num) : num
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0)
  }

  const formatPercent = (num: number | string) => {
    const value = typeof num === 'string' ? parseFloat(num) : num
    return `${(value || 0).toFixed(1)}%`
  }

  // Salesman Details Modal Component
  const SalesmanDetailsModal: React.FC<{ salesman: any; onClose: () => void }> = ({ salesman, onClose }) => {
    if (!salesman) return null

    const [detailsData, setDetailsData] = useState<any>(null)
    const [detailsLoading, setDetailsLoading] = useState(true)
    const [detailsError, setDetailsError] = useState<string | null>(null)

    useEffect(() => {
      const fetchSalesmanDetails = async () => {
        try {
          setDetailsLoading(true)
          setDetailsError(null)

          const response = await fetch(
            `/api/delivery-van-sales/details?salesmanCode=${salesman.salesman_code}&routeCode=${salesman.route_code}&range=${dateRange}`
          )
          const result = await response.json()

          if (result.success) {
            setDetailsData(result)
          } else {
            setDetailsError(result.error || 'Failed to load details')
          }
        } catch (err) {
          console.error('Error fetching salesman details:', err)
          setDetailsError('Failed to load details')
        } finally {
          setDetailsLoading(false)
        }
      }

      if (salesman.salesman_code) {
        fetchSalesmanDetails()
      }
    }, [salesman.salesman_code, salesman.route_code])

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-[95vw] w-full max-h-[90vh] overflow-y-auto m-4 max-sm:m-2">
          <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-start z-50 max-md:p-4 max-sm:p-3">
            <div>
              <h2 className="text-2xl font-bold max-md:text-xl max-sm:text-lg">{salesman.salesman_name || salesman.salesman_code}</h2>
              <div className="flex items-center gap-4 mt-2 max-sm:flex-col max-sm:items-start max-sm:gap-1">
                <span className="text-sm text-gray-600 max-sm:text-xs">Code: <strong>{salesman.salesman_code}</strong></span>
                <span className="text-sm text-gray-600 max-sm:text-xs">Route: <strong>{salesman.route_code}</strong></span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 max-md:p-4 max-sm:p-3">
            {detailsLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : detailsError ? (
              <div className="flex items-center justify-center h-64 text-red-500">
                <AlertCircle className="w-6 h-6 mr-2" />
                {detailsError}
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6 max-lg:grid-cols-2 max-sm:grid-cols-1 max-md:gap-3 max-md:mb-4">
                  <Card>
                    <CardContent className="pt-6 max-sm:pt-4">
                      <div className="text-sm text-gray-600 max-sm:text-xs">Total Products</div>
                      <div className="text-2xl font-bold max-sm:text-xl">{formatNumber(detailsData?.summary?.total_products || 0)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6 max-sm:pt-4">
                      <div className="text-sm text-gray-600 max-sm:text-xs">Load Value</div>
                      <div className="text-2xl font-bold text-blue-600 max-sm:text-xl">{formatCurrency(detailsData?.summary?.total_load_value || 0)}</div>
                      <div className="text-xs text-gray-500">{formatNumber(detailsData?.summary?.total_loaded || 0)} units</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6 max-sm:pt-4">
                      <div className="text-sm text-gray-600 max-sm:text-xs">Sales Value</div>
                      <div className="text-2xl font-bold text-green-600 max-sm:text-xl">{formatCurrency(detailsData?.summary?.total_sales_value || 0)}</div>
                      <div className="text-xs text-gray-500">{formatNumber(detailsData?.summary?.total_sold || 0)} units</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6 max-sm:pt-4">
                      <div className="text-sm text-gray-600 max-sm:text-xs">Return Value</div>
                      <div className="text-2xl font-bold text-orange-600 max-sm:text-xl">
                        {parseFloat(detailsData?.summary?.total_return_value || 0) === 0 ? '-' : formatCurrency(detailsData?.summary?.total_return_value || 0)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {parseFloat(detailsData?.summary?.total_returned || 0) === 0 ? '-' : `${formatNumber(detailsData?.summary?.total_returned || 0)} units`}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Product Details Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Product-Level Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product Code</TableHead>
                            <TableHead>Product Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead className="text-right">Loaded Qty</TableHead>
                            <TableHead className="text-right">Load Value</TableHead>
                            <TableHead className="text-right">Sold Qty</TableHead>
                            <TableHead className="text-right">Sales Value</TableHead>
                            <TableHead className="text-right">Returned Qty</TableHead>
                            <TableHead className="text-right">Return Value</TableHead>
                            <TableHead className="text-right">Sell-Through %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailsData?.products?.map((product: any, idx: number) => (
                            <TableRow key={`product-${product.product_code}-${idx}`}>
                              <TableCell className="font-medium">{product.product_code}</TableCell>
                              <TableCell>{product.product_name}</TableCell>
                              <TableCell>{product.category_name}</TableCell>
                              <TableCell>{product.brand}</TableCell>
                              <TableCell className="text-right">{formatNumber(product.qty_loaded)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(product.load_value)}</TableCell>
                              <TableCell className="text-right">{formatNumber(product.qty_sold)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(product.sales_value)}</TableCell>
                              <TableCell className="text-right">{parseFloat(product.qty_returned) === 0 ? '-' : formatNumber(product.qty_returned)}</TableCell>
                              <TableCell className="text-right">{parseFloat(product.return_value) === 0 ? '-' : formatCurrency(product.return_value)}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={parseFloat(product.sell_through_pct) >= 80 ? 'default' : 'destructive'}>
                                  {formatPercent(product.sell_through_pct)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Excel Export Functions
  const exportToExcel = async (reportType: string) => {
    if (!data) return

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Report')

    // Set column widths
    worksheet.columns = [
      { width: 20 },  // Salesman
      { width: 15 },  // Salesman Code
      { width: 15 },  // Route
      { width: 12 },  // Products
      { width: 15 },  // Loaded Qty
      { width: 18 },  // Load Value
      { width: 15 },  // Sold Qty
      { width: 18 },  // Sales Value
      { width: 15 },  // Returned Qty
      { width: 18 },  // Return Value
      { width: 15 }   // Efficiency %
    ]

    let reportTitle = ''
    let headers: string[] = []
    let reportData: any[] = []

    switch (reportType) {
      case 'load-vs-sales':
        reportTitle = 'Load vs Sales Report'
        headers = ['Salesman', 'Salesman Code', 'Route', 'Products', 'Loaded Qty', 'Load Value', 'Sold Qty', 'Sales Value', 'Returned Qty', 'Return Value', 'Efficiency %']
        reportData = data.loadVsSales?.data || []
        break
      case 'fulfillment':
        reportTitle = 'Delivery Fulfillment Report'
        headers = ['Salesman', 'Route', 'Customers', 'Orders', 'Requested', 'Delivered', 'Shortage', 'Fulfillment %']
        reportData = data.fulfillment?.data || []
        break
      case 'on-time':
        reportTitle = 'On-Time Delivery Report'
        headers = ['Salesman', 'Route', 'Total', 'On Time', 'Delayed', 'Late', 'Not Delivered', 'On-Time %']
        reportData = data.onTimeDelivery?.data || []
        break
      case 'reconciliation':
        reportTitle = 'Stock Reconciliation Report'
        headers = ['Salesman', 'Route', 'Products', 'Loaded', 'Delivered', 'Returned', 'Stock Variance', 'Status']
        reportData = data.stockReconciliation?.data || []
        break
      case 'productivity':
        reportTitle = 'Salesman Productivity Report'
        headers = ['Rank', 'Salesman', 'Name', 'Total Visits', 'Productive', 'Conversion %', 'Avg Duration', 'Customers', 'VIP Customers', 'Key Accounts', 'Total Revenue', 'Achievement %', 'Active Days', 'Best Order']
        reportData = data.productivity?.data || []
        break
    }

    // Add title row
    worksheet.mergeCells('A1:K1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = reportTitle
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    worksheet.getRow(1).height = 30

    // Add date info row
    worksheet.mergeCells('A2:K2')
    const dateCell = worksheet.getCell('A2')
    dateCell.value = `Period: ${dateRange} | Generated: ${new Date().toLocaleString()}`
    dateCell.font = { size: 11, italic: true }
    dateCell.alignment = { vertical: 'middle', horizontal: 'center' }
    worksheet.getRow(2).height = 20

    worksheet.addRow([])

    // Add header row
    const headerRow = worksheet.addRow(headers)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 25

    // Add borders to header
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })

    // Add data rows
    reportData.forEach((item, index) => {
      let rowData: any[] = []

      switch (reportType) {
        case 'load-vs-sales':
          rowData = [
            item.salesman_name || item.salesman_code,
            item.salesman_code,
            item.route_code,
            parseInt(item.products_count),
            parseFloat(item.total_loaded),
            parseFloat(item.total_load_value || 0),
            parseFloat(item.total_delivered),
            parseFloat(item.total_sales_value || 0),
            parseFloat(item.total_returned),
            parseFloat(item.total_return_value || 0),
            parseFloat(item.delivery_efficiency_pct).toFixed(1) + '%'
          ]
          break
        case 'fulfillment':
          rowData = [
            item.salesman_code,
            item.route_code,
            parseInt(item.customers_count),
            parseInt(item.orders_count),
            parseFloat(item.total_requested),
            parseFloat(item.total_delivered),
            parseFloat(item.total_shortage),
            parseFloat(item.fulfillment_rate).toFixed(1) + '%'
          ]
          break
        case 'on-time':
          rowData = [
            item.salesman_code,
            item.route_code,
            parseInt(item.total_deliveries),
            parseInt(item.on_time),
            parseInt(item.delayed),
            parseInt(item.late),
            parseInt(item.not_delivered),
            parseFloat(item.on_time_percentage).toFixed(1) + '%'
          ]
          break
        case 'reconciliation':
          rowData = [
            item.salesman_name || item.salesman_code,
            item.route_code,
            parseInt(item.products_count),
            parseFloat(item.loaded),
            parseFloat(item.delivered),
            parseFloat(item.returned),
            parseFloat(item.stock_variance),
            item.variance_status
          ]
          break
        case 'productivity':
          rowData = [
            item.sales_rank || idx + 1,
            item.salesman_code,
            item.salesman_name,
            parseInt(item.total_visits || 0),
            parseInt(item.productive_visits || 0),
            parseFloat(item.conversion_rate || 0).toFixed(1) + '%',
            parseFloat(item.avg_visit_duration || 0).toFixed(0) + ' min',
            parseInt(item.unique_customers || 0),
            parseInt(item.vip_customers || 0),
            parseInt(item.key_account_customers || 0),
            parseFloat(item.total_revenue || 0).toFixed(2),
            item.achievement_percentage !== null ? parseFloat(item.achievement_percentage).toFixed(1) + '%' : 'No Target',
            parseInt(item.active_days || 0),
            parseFloat(item.best_order || 0).toFixed(2)
          ]
          break
      }

      const dataRow = worksheet.addRow(rowData)
      dataRow.alignment = { vertical: 'middle' }

      // Add borders and alternating colors
      dataRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        }
        if (index % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
        }
      })
    })

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${reportTitle.replace(/ /g, '_')}_${dateRange}_${new Date().toISOString().split('T')[0]}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 max-md:p-4 max-sm:p-3">
      {/* Header */}
      <div className="mb-6 max-md:mb-4">
        <div className="flex items-center justify-between gap-4 mb-6 max-md:flex-col max-md:items-start max-md:gap-3 max-md:mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2 max-md:text-2xl max-sm:text-xl">
              <Truck className="w-7 h-7 text-sky-600 max-sm:w-6 max-sm:h-6" />
              Delivery & Van Sales
            </h1>
            <p className="text-base text-slate-600 mt-1 max-sm:text-sm">Monitor delivery performance, fulfillment, and van operations</p>
          </div>

          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-sky-600 hover:bg-sky-700 text-white max-md:w-full"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 bg-white p-3 md:p-4 rounded-lg shadow-sm border border-slate-200">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Date Range</label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" disabled>Today</SelectItem>
                <SelectItem value="yesterday" disabled>Yesterday</SelectItem>
                <SelectItem value="thisWeek" disabled>This Week</SelectItem>
                <SelectItem value="thisMonth" disabled>This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="thisQuarter" disabled>This Quarter</SelectItem>
                <SelectItem value="lastQuarter">Last Quarter</SelectItem>
                <SelectItem value="thisYear" disabled>This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Salesman <span className="text-xs text-slate-500 font-normal">(Available: {filters.salesmen.length})</span>
            </label>
            <Select value={selectedSalesman} onValueChange={setSelectedSalesman}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                <SelectItem value="all">All Salesmen</SelectItem>
                {filters.salesmen.map((s: any, idx: number) => (
                  <SelectItem key={`salesman-${s.code}-${idx}`} value={s.code}>{s.code} - {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Route <span className="text-xs text-slate-500 font-normal">(Available: {filters.routes.length})</span>
            </label>
            <Select value={selectedRoute} onValueChange={setSelectedRoute}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                <SelectItem value="all">All Routes</SelectItem>
                {filters.routes.map((r: any, idx: number) => (
                  <SelectItem key={`route-${r.code}-${idx}`} value={r.code}>{r.code} - {r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex gap-3 flex-wrap w-full h-auto bg-white p-4 rounded-lg shadow-sm mb-6 max-md:grid max-md:grid-cols-2 max-md:gap-3 max-md:mb-4 max-sm:gap-2 max-sm:p-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-3 py-4 px-8 data-[state=active]:bg-sky-50 data-[state=active]:text-sky-700 font-semibold transition-all text-lg whitespace-nowrap max-md:flex-col max-md:py-5 max-md:px-4 max-md:min-h-[90px] max-md:text-sm max-sm:py-4 max-sm:px-2 max-sm:min-h-[80px] max-sm:text-xs"
              >
                <Icon className="w-7 h-7 max-md:mb-1 max-sm:w-6 max-sm:h-6" />
                <span className="max-md:text-center max-md:leading-tight">{tab.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* TAB 1: LOAD VS SALES */}
        <TabsContent value="load-vs-sales">
          <LoadVsSalesReport
            data={data?.loadVsSales}
            isMobile={isMobile}
            loading={loading}
            onExport={() => exportToExcel('load-vs-sales')}
            onViewDetails={(salesman) => setSelectedSalesmanForDetails(salesman)}
          />
        </TabsContent>

        {/* TAB 2: DELIVERY FULFILLMENT */}
        <TabsContent value="fulfillment">
          <FulfillmentReport data={data?.fulfillment} isMobile={isMobile} loading={loading} onExport={() => exportToExcel('fulfillment')} />
        </TabsContent>

        {/* TAB 3: ON-TIME DELIVERY */}
        <TabsContent value="on-time">
          <OnTimeDeliveryReport data={data?.onTimeDelivery} isMobile={isMobile} loading={loading} onExport={() => exportToExcel('on-time')} />
        </TabsContent>

        {/* TAB 4: STOCK RECONCILIATION */}
        <TabsContent value="reconciliation">
          <StockReconciliationReport data={data?.stockReconciliation} isMobile={isMobile} loading={loading} onExport={() => exportToExcel('reconciliation')} />
        </TabsContent>

        {/* TAB 5: SALESMAN PRODUCTIVITY */}
        <TabsContent value="productivity">
          <ProductivityReport data={data?.productivity} isMobile={isMobile} loading={loading} onExport={() => exportToExcel('productivity')} />
        </TabsContent>
      </Tabs>

      {/* Salesman Details Modal */}
      {selectedSalesmanForDetails && (
        <SalesmanDetailsModal
          salesman={selectedSalesmanForDetails}
          onClose={() => setSelectedSalesmanForDetails(null)}
        />
      )}
    </div>
  )
}

// SUB-COMPONENT: Load vs Sales Report
function LoadVsSalesReport({ data, isMobile, loading, onExport, onViewDetails }: { data: any; isMobile: boolean; loading: boolean; onExport: () => void; onViewDetails: (salesman: any) => void }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    )
  }

  if (!data) return <div>No data available</div>

  const summary = data.summary || {}
  const details = data.data || []

  // Chart data: All salesmen by loaded quantity (scrollable)
  const chartData = details.map((item: any, index: number) => ({
    name: `load-${item.salesman_code}-${index}`,
    displayLabel: item.salesman_name || item.salesman_code,
    code: item.salesman_code,
    route: item.route_code,
    products: parseFloat(item.products_count),
    displayName: `${item.salesman_name || item.salesman_code}\n${item.salesman_code} | ${item.route_code}`,
    loaded: parseFloat(item.total_loaded),
    delivered: parseFloat(item.total_delivered),
    loadValue: parseFloat(item.total_load_value),
    salesValue: parseFloat(item.total_sales_value),
    efficiency: parseFloat(item.delivery_efficiency_pct)
  }))

  const totalSalesmen = chartData.length

  return (
    <div className="space-y-6 max-md:space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-md:gap-3">
        <Card className="border-l-4 border-sky-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Total Loaded</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.total_loaded)}
                </h3>
              </div>
              <Package className="w-8 h-8 text-sky-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-green-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Total Delivered</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.total_delivered)}
                </h3>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-orange-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Total Returned</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.total_returned)}
                </h3>
              </div>
              <PackageX className="w-8 h-8 text-orange-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-purple-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Efficiency</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatPercent(summary.overall_efficiency_pct)}
                </h3>
              </div>
              <Target className="w-8 h-8 text-purple-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
        <CardHeader className="pb-3 border-b bg-white/80 backdrop-blur">
          <div>
            <CardTitle className="text-xl font-bold text-slate-800 tracking-tight">
              Top Salesmen Performance - Load vs Delivery <span className="text-base font-semibold text-slate-600">(Showing {totalSalesmen})</span>
            </CardTitle>
            <p className="text-sm text-slate-600 mt-2 font-medium">
              Quantity metrics (bars) • Value metrics in AED (lines) • {totalSalesmen > 10 ? '← Scroll horizontally to view all →' : ''}
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-8 pb-6 px-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div style={{ width: chartData.length * 140, minWidth: 1400 }}>
                  <ResponsiveContainer width="100%" height={isMobile ? 400 : 500}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
              <defs>
                <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95}/>
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.75}/>
                </linearGradient>
                <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.95}/>
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.75}/>
                </linearGradient>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
                </filter>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
                strokeOpacity={0.6}
                vertical={false}
              />
              <XAxis
                dataKey="displayName"
                tick={(props: any) => {
                  const { x, y, payload } = props
                  const lines = payload.value.split('\n')
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={0} textAnchor="middle" fill="#475569" fontSize={isMobile ? 10 : 12} fontFamily="system-ui, -apple-system">
                        <tspan x={0} dy="0.71em" fontWeight="600">{lines[0] || ''}</tspan>
                        <tspan x={0} dy="1.3em" fontSize={isMobile ? 9 : 11} fill="#94a3b8" fontWeight="500">{lines[1] || ''}</tspan>
                      </text>
                    </g>
                  )
                }}
                height={isMobile ? 85 : 70}
                interval={0}
                axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: isMobile ? 11 : 13, fill: '#475569', fontWeight: 500 }}
                axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                tickLine={{ stroke: '#cbd5e1' }}
                label={{
                  value: 'Units Loaded/Delivered',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: isMobile ? 11 : 13, fill: '#1e293b', fontWeight: 600 }
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: isMobile ? 11 : 13, fill: '#475569', fontWeight: 500 }}
                axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                tickLine={{ stroke: '#cbd5e1' }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                content={(props: any) => {
                  if (!props.active || !props.payload) return null
                  const data = props.payload[0]?.payload
                  return (
                    <div className="bg-white border-2 border-slate-200 rounded-xl shadow-2xl overflow-hidden" style={{ minWidth: '320px' }}>
                      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
                        <p className="font-bold text-lg text-white tracking-tight">{data?.displayLabel}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-slate-300 bg-slate-700/50 px-3 py-1 rounded-full font-medium">
                            {data?.code}
                          </span>
                          <span className="text-xs text-slate-300 bg-slate-700/50 px-3 py-1 rounded-full font-medium">
                            Route: {data?.route}
                          </span>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 p-3 rounded-lg border border-violet-200">
                            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Products</p>
                            <p className="text-2xl font-bold text-violet-900 mt-1">{formatNumber(data?.products)}</p>
                          </div>
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-3 rounded-lg border border-purple-200">
                            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Efficiency</p>
                            <p className="text-2xl font-bold text-purple-900 mt-1">{formatPercent(data?.efficiency)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100/30 p-4 rounded-xl border-2 border-blue-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Loaded</p>
                            </div>
                            <p className="text-2xl font-bold text-blue-900 mb-1">{formatNumber(data?.loaded)}</p>
                            <p className="text-xs text-blue-600 font-medium mb-3">units</p>
                            <div className="pt-3 border-t border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/30 -mx-4 -mb-4 px-4 pb-4 mt-3">
                              <p className="text-xs text-indigo-700 font-semibold mb-1">Load Value</p>
                              <p className="text-lg font-bold text-indigo-900">{formatCurrency(data?.loadValue)}</p>
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 p-4 rounded-xl border-2 border-emerald-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-2 h-8 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-full"></div>
                              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Delivered</p>
                            </div>
                            <p className="text-2xl font-bold text-emerald-900 mb-1">{formatNumber(data?.delivered)}</p>
                            <p className="text-xs text-emerald-600 font-medium mb-3">units</p>
                            <div className="pt-3 border-t border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/30 -mx-4 -mb-4 px-4 pb-4 mt-3">
                              <p className="text-xs text-amber-700 font-semibold mb-1">Sales Value</p>
                              <p className="text-lg font-bold text-amber-900">{formatCurrency(data?.salesValue)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="loaded"
                fill="url(#loadGradient)"
                name="Loaded Quantity"
                radius={[6, 6, 0, 0]}
                maxBarSize={60}
              />
              <Bar
                yAxisId="left"
                dataKey="delivered"
                fill="url(#deliveryGradient)"
                name="Delivered Quantity"
                radius={[6, 6, 0, 0]}
                maxBarSize={60}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="loadValue"
                stroke="#6366f1"
                strokeWidth={3.5}
                dot={{ fill: '#6366f1', r: 6, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 8, strokeWidth: 3, stroke: '#fff', filter: 'url(#shadow)' }}
                name="Load Value (AED)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="salesValue"
                stroke="#f59e0b"
                strokeWidth={3.5}
                dot={{ fill: '#f59e0b', r: 6, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 8, strokeWidth: 3, stroke: '#fff', filter: 'url(#shadow)' }}
                name="Sales Value (AED)"
              />
            </ComposedChart>
          </ResponsiveContainer>
                </div>
              </div>
              <div className="flex items-center justify-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Value (AED)</span>
              </div>
            </div>

            {/* Custom Legend - Outside scrollable area */}
            <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-gradient-to-b from-blue-500 to-blue-400"></div>
                <span className="text-sm font-semibold text-slate-700">Loaded Quantity</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-gradient-to-b from-emerald-500 to-emerald-400"></div>
                <span className="text-sm font-semibold text-slate-700">Delivered Quantity</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-indigo-600"></div>
                <span className="text-sm font-semibold text-slate-700">Load Value (AED)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-600"></div>
                <span className="text-sm font-semibold text-slate-700">Sales Value (AED)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between max-sm:flex-col max-sm:items-start gap-3">
            <CardTitle>Detailed Load vs Sales</CardTitle>
            <Button onClick={onExport} variant="outline" size="sm" className="gap-2 max-sm:w-full">
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Salesman</TableHead>
                  <TableHead>Salesman Code</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Loaded Qty</TableHead>
                  <TableHead className="text-right">Load Value</TableHead>
                  <TableHead className="text-right">Sold Qty</TableHead>
                  <TableHead className="text-right">Sales Value</TableHead>
                  <TableHead className="text-right">Returned Qty</TableHead>
                  <TableHead className="text-right">Return Value</TableHead>
                  <TableHead className="text-right">Efficiency %</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.map((item: any, idx: number) => (
                  <TableRow
                    key={`load-row-${item.salesman_code}-${item.route_code}-${idx}`}
                    onClick={() => onViewDetails(item)}
                    className="cursor-pointer hover:bg-blue-50 transition-colors"
                  >
                    <TableCell className="text-slate-500 font-semibold">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{item.salesman_name || item.salesman_code}</TableCell>
                    <TableCell>{item.salesman_code}</TableCell>
                    <TableCell>{item.route_code}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.products_count)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.total_loaded)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total_load_value)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.total_delivered)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total_sales_value)}</TableCell>
                    <TableCell className="text-right">{parseFloat(item.total_returned) === 0 ? '-' : formatNumber(item.total_returned)}</TableCell>
                    <TableCell className="text-right">{parseFloat(item.total_return_value) === 0 ? '-' : formatCurrency(item.total_return_value)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={parseFloat(item.delivery_efficiency_pct) >= 80 ? 'default' : 'destructive'}>
                        {formatPercent(item.delivery_efficiency_pct)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// SUB-COMPONENT: Fulfillment Report
function FulfillmentReport({ data, isMobile, loading, onExport }: { data: any; isMobile: boolean; loading: boolean; onExport: () => void }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    )
  }

  if (!data) return <div>No data available</div>

  const summary = data.summary || {}
  const details = data.data || []

  // Pie chart data for fulfillment status
  const pieData = [
    { name: 'Fully Fulfilled', value: parseInt(summary.fully_fulfilled || 0), color: '#10b981' },
    { name: 'Partial', value: parseInt(summary.partial_fulfilled || 0), color: '#f59e0b' },
    { name: 'Not Fulfilled', value: parseInt(summary.not_fulfilled || 0), color: '#ef4444' }
  ]

  return (
    <div className="space-y-6 max-md:space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-md:gap-3">
        <Card className="border-l-4 border-sky-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Total Orders</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.total_orders)}
                </h3>
              </div>
              <Package className="w-8 h-8 text-sky-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-green-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Avg Fulfillment</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatPercent(summary.avg_fulfillment_rate)}
                </h3>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-orange-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Total Requested</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.total_requested)}
                </h3>
              </div>
              <BarChart3 className="w-8 h-8 text-orange-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-red-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Shortage</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.total_shortage)}
                </h3>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pie Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Fulfillment Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={isMobile ? 70 : 100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fulfillment Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Fully Fulfilled</span>
                  <span className="text-sm font-semibold text-green-600">
                    {formatNumber(summary.fully_fulfilled)} ({formatPercent((summary.fully_fulfilled / summary.total_orders) * 100)})
                  </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${(summary.fully_fulfilled / summary.total_orders) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Partially Fulfilled</span>
                  <span className="text-sm font-semibold text-orange-600">
                    {formatNumber(summary.partial_fulfilled)} ({formatPercent((summary.partial_fulfilled / summary.total_orders) * 100)})
                  </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500"
                    style={{ width: `${(summary.partial_fulfilled / summary.total_orders) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Not Fulfilled</span>
                  <span className="text-sm font-semibold text-red-600">
                    {formatNumber(summary.not_fulfilled)} ({formatPercent((summary.not_fulfilled / summary.total_orders) * 100)})
                  </span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${(summary.not_fulfilled / summary.total_orders) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between max-sm:flex-col max-sm:items-start gap-3">
            <CardTitle>Delivery Fulfillment by Salesman</CardTitle>
            <Button onClick={onExport} variant="outline" size="sm" className="gap-2 max-sm:w-full">
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salesman</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Shortage</TableHead>
                  <TableHead className="text-right">Fulfillment %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.map((item: any, idx: number) => (
                  <TableRow key={`fulfill-row-${item.salesman_code}-${item.route_code}-${idx}`}>
                    <TableCell className="font-medium">{item.salesman_code}</TableCell>
                    <TableCell>{item.route_code}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.customers_count)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.orders_count)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.total_requested)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.total_delivered)}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-orange-600 font-semibold">
                        {formatNumber(item.total_shortage)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={parseFloat(item.fulfillment_rate) >= 95 ? 'default' : 'destructive'}>
                        {formatPercent(item.fulfillment_rate)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// SUB-COMPONENT: On-Time Delivery Report
function OnTimeDeliveryReport({ data, isMobile, loading, onExport }: { data: any; isMobile: boolean; loading: boolean; onExport: () => void }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    )
  }

  if (!data) return <div>No data available</div>

  const summary = data.summary || {}
  const details = data.data || []

  // Pie chart for delivery status
  const pieData = [
    { name: 'On Time', value: parseInt(summary.on_time || 0), color: '#10b981' },
    { name: 'Delayed', value: parseInt(summary.delayed || 0), color: '#f59e0b' },
    { name: 'Late', value: parseInt(summary.late || 0), color: '#ef4444' },
    { name: 'Not Delivered', value: parseInt(summary.not_delivered || 0), color: '#64748b' }
  ]

  return (
    <div className="space-y-6 max-md:space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-md:gap-3">
        <Card className="border-l-4 border-green-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">On Time</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.on_time)}
                </h3>
                <p className="text-xs text-green-600 mt-1">
                  {formatPercent((summary.on_time / summary.total_deliveries) * 100)}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-orange-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Delayed</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.delayed)}
                </h3>
                <p className="text-xs text-orange-600 mt-1">
                  {formatPercent((summary.delayed / summary.total_deliveries) * 100)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-red-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Late</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.late)}
                </h3>
                <p className="text-xs text-red-600 mt-1">
                  {formatPercent((summary.late / summary.total_deliveries) * 100)}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-sky-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Avg Days</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {parseFloat(summary.avg_delivery_days || 0).toFixed(1)}
                </h3>
                <p className="text-xs text-slate-600 mt-1">days</p>
              </div>
              <Timer className="w-8 h-8 text-sky-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={isMobile ? 70 : 100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between max-sm:flex-col max-sm:items-start gap-3">
            <CardTitle>On-Time Delivery by Salesman</CardTitle>
            <Button onClick={onExport} variant="outline" size="sm" className="gap-2 max-sm:w-full">
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salesman</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">On Time</TableHead>
                  <TableHead className="text-right">Delayed</TableHead>
                  <TableHead className="text-right">Late</TableHead>
                  <TableHead className="text-right">Not Delivered</TableHead>
                  <TableHead className="text-right">On-Time %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.map((item: any, idx: number) => (
                  <TableRow key={`ontime-row-${item.salesman_code}-${item.route_code}-${idx}`}>
                    <TableCell className="font-medium">{item.salesman_code}</TableCell>
                    <TableCell>{item.route_code}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.total_deliveries)}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-semibold">
                        {formatNumber(item.on_time)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-orange-600">
                        {formatNumber(item.delayed)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-600">
                        {formatNumber(item.late)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-slate-600">
                        {formatNumber(item.not_delivered)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={parseFloat(item.on_time_percentage) >= 90 ? 'default' : 'destructive'}>
                        {formatPercent(item.on_time_percentage)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// SUB-COMPONENT: Stock Reconciliation Report
function StockReconciliationReport({ data, isMobile, loading, onExport }: { data: any; isMobile: boolean; loading: boolean; onExport: () => void }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    )
  }

  if (!data) return <div>No data available</div>

  const summary = data.summary || {}
  const details = data.data || []

  // Chart data for variance analysis - showing salesmen with highest stock variances
  const chartData = details
    .slice(0, 10)
    .map((item: any, index: number) => ({
      name: `recon-${item.salesman_code}-${index}`,
      displayLabel: item.salesman_code,
      variance: Math.abs(parseFloat(item.stock_variance || 0)),
      loaded: parseFloat(item.loaded || 0),
      delivered: parseFloat(item.delivered || 0)
    }))

  return (
    <div className="space-y-6 max-md:space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-md:gap-3">
        <Card className="border-l-4 border-sky-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Total Loaded</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.total_loaded)}
                </h3>
              </div>
              <Package className="w-8 h-8 text-sky-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-green-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Total Delivered</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.total_delivered)}
                </h3>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-red-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Stock Variance</p>
                <h3 className={`text-2xl font-bold mt-1 max-sm:text-xl ${parseFloat(summary.total_stock_variance || 0) < 0 ? 'text-blue-600' : 'text-green-600'}`}>
                  {formatNumber(summary.total_stock_variance)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {parseFloat(summary.total_stock_variance || 0) < 0 ? 'Shortage' : 'Excess'}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-blue-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-orange-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Salesmen w/ Variance</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.salesmen_with_variance)}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {formatNumber(summary.excess_count)} excess, {formatNumber(summary.shortage_count)} shortage
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-orange-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Salesmen with Highest Stock Variance</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="displayLabel"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? 'end' : 'middle'}
                height={isMobile ? 60 : 30}
              />
              <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="variance" fill="#3b82f6" name="Variance" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between max-sm:flex-col max-sm:items-start gap-3">
            <CardTitle>Stock Reconciliation by Salesman</CardTitle>
            <Button onClick={onExport} variant="outline" size="sm" className="gap-2 max-sm:w-full">
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salesman</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Loaded</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Stock Variance</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.map((item: any, idx: number) => (
                  <TableRow key={`recon-row-${item.salesman_code}-${item.route_code}-${idx}`}>
                    <TableCell className="font-medium">{item.salesman_name || item.salesman_code}</TableCell>
                    <TableCell>{item.route_code}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.products_count)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.loaded)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.delivered)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.returned)}</TableCell>
                    <TableCell className="text-right">
                      <span className={parseFloat(item.stock_variance || 0) < 0 ? 'text-blue-600 font-semibold' : parseFloat(item.stock_variance || 0) > 0 ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                        {formatNumber(item.stock_variance)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={item.variance_status === 'Shortage' ? 'destructive' : item.variance_status === 'Excess' ? 'secondary' : 'default'}>
                        {item.variance_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// SUB-COMPONENT: Salesman Productivity Report
function ProductivityReport({ data, isMobile, loading, onExport }: { data: any; isMobile: boolean; loading: boolean; onExport: () => void }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    )
  }

  if (!data) return <div>No data available</div>

  const summary = data.summary || {}
  const details = data.data || []

  // Chart data for productivity - only show salesmen WITH targets
  const salesmenWithTargets = details.filter((item: any) => item.achievement_percentage !== null)
  const chartData = salesmenWithTargets.map((item: any, index: number) => ({
    name: `prod-${item.salesman_code}-${index}`,
    displayLabel: item.salesman_code,
    displayName: `${item.salesman_name?.split('-')[0] || item.salesman_code}\n${item.salesman_code}`,
    achievement: parseFloat(item.achievement_percentage || 0),
    conversion: parseFloat(item.conversion_rate || 0),
    revenue: parseFloat(item.total_revenue || 0), // In AED
    target: parseFloat(item.target_amount || 0),
    customers: parseInt(item.unique_customers || 0),
    visits: parseInt(item.total_visits || 0)
  }))

  const totalWithTargets = chartData.length

  return (
    <div className="space-y-6 max-md:space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1 max-md:gap-3">
        <Card className="border-l-4 border-sky-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Visit Efficiency</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatPercent(summary.overall_conversion_rate)}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  {formatNumber(summary.productive_visits)}/{formatNumber(summary.total_visits)} productive
                </p>
              </div>
              <Users className="w-8 h-8 text-sky-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-green-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Total Revenue</p>
                <h3 className="text-2xl font-bold text-green-600 mt-1 max-sm:text-xl">
                  {formatCurrency(summary.total_revenue)}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  {summary.total_target ? `Target: ${formatCurrency(summary.total_target)}` : 'No target set'}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-purple-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Avg Visit Duration</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatNumber(summary.avg_visit_duration)} min
                </h3>
                <p className="text-xs text-slate-600 mt-1">{formatNumber(summary.total_transactions)} transactions</p>
              </div>
              <Target className="w-8 h-8 text-purple-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-orange-500">
          <CardContent className="p-4 max-sm:p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 max-sm:text-xs">Avg Transaction</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1 max-sm:text-xl">
                  {formatCurrency(summary.avg_transaction_value)}
                </h3>
                <p className="text-xs text-slate-600 mt-1">{formatNumber(summary.total_customers)} customers</p>
              </div>
              <BarChart3 className="w-8 h-8 text-orange-500 max-sm:w-7 max-sm:h-7" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
        <CardHeader className="pb-3 border-b bg-white/80 backdrop-blur">
          <div>
            <CardTitle className="text-xl font-bold text-slate-800 tracking-tight">
              Salesmen Performance Metrics - With Targets <span className="text-base font-semibold text-slate-600">(Showing {totalWithTargets})</span>
            </CardTitle>
            <p className="text-sm text-slate-600 mt-2 font-medium">
              Achievement % & Conversion % (bars) • Revenue in AED (line) • {totalWithTargets > 10 ? '← Scroll horizontally to view all →' : ''}
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-8 pb-6 px-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div style={{ width: chartData.length * 120, minWidth: 1200 }}>
                  <ResponsiveContainer width="100%" height={isMobile ? 400 : 500}>
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="achievementGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.95}/>
                          <stop offset="100%" stopColor="#34d399" stopOpacity={0.75}/>
                        </linearGradient>
                        <linearGradient id="conversionGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.95}/>
                          <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.75}/>
                        </linearGradient>
                        <filter id="shadow2" x="-50%" y="-50%" width="200%" height="200%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
                        </filter>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                        strokeOpacity={0.6}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="displayName"
                        tick={(props: any) => {
                          const { x, y, payload } = props
                          const lines = payload.value.split('\n')
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={0} textAnchor="middle" fill="#475569" fontSize={isMobile ? 10 : 12} fontFamily="system-ui, -apple-system">
                                <tspan x={0} dy="0.71em" fontWeight="600">{lines[0] || ''}</tspan>
                                <tspan x={0} dy="1.3em" fontSize={isMobile ? 9 : 11} fill="#94a3b8" fontWeight="500">{lines[1] || ''}</tspan>
                              </text>
                            </g>
                          )
                        }}
                        height={isMobile ? 85 : 70}
                        interval={0}
                        axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                        tickLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: isMobile ? 11 : 13, fill: '#475569', fontWeight: 500 }}
                        axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        label={{
                          value: 'Achievement % / Conversion %',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: isMobile ? 11 : 13, fill: '#1e293b', fontWeight: 600 }
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: isMobile ? 11 : 13, fill: '#475569', fontWeight: 500 }}
                        axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                        tickLine={{ stroke: '#cbd5e1' }}
                        tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                        content={(props: any) => {
                          if (!props.active || !props.payload) return null
                          const data = props.payload[0]?.payload
                          return (
                            <div className="bg-white border-2 border-slate-200 rounded-xl shadow-2xl overflow-hidden" style={{ minWidth: '320px' }}>
                              <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
                                <p className="font-bold text-lg text-white tracking-tight">{data?.displayName?.split('\n')[0]}</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-xs text-slate-300 bg-slate-700/50 px-3 py-1 rounded-full font-medium">
                                    {data?.displayLabel}
                                  </span>
                                </div>
                              </div>

                              <div className="p-5">
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-3 rounded-lg border border-emerald-200">
                                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Achievement</p>
                                    <p className="text-2xl font-bold text-emerald-900 mt-1">{formatPercent(data?.achievement)}</p>
                                  </div>
                                  <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-3 rounded-lg border border-purple-200">
                                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Conversion</p>
                                    <p className="text-2xl font-bold text-purple-900 mt-1">{formatPercent(data?.conversion)}</p>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/30 p-4 rounded-xl border-2 border-amber-200">
                                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Revenue</p>
                                    <p className="text-2xl font-bold text-amber-900">{formatCurrency(data?.revenue)}</p>
                                    <p className="text-xs text-amber-600 mt-1">Target: {formatCurrency(data?.target)}</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                      <p className="text-xs text-slate-600">Customers</p>
                                      <p className="text-lg font-bold text-slate-900">{formatNumber(data?.customers)}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                      <p className="text-xs text-slate-600">Visits</p>
                                      <p className="text-lg font-bold text-slate-900">{formatNumber(data?.visits)}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="achievement"
                        fill="url(#achievementGradient)"
                        name="Achievement %"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={50}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="conversion"
                        fill="url(#conversionGradient)"
                        name="Conversion %"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={50}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="revenue"
                        stroke="#f59e0b"
                        strokeWidth={3.5}
                        dot={{ fill: '#f59e0b', r: 6, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 8, strokeWidth: 3, stroke: '#fff', filter: 'url(#shadow2)' }}
                        name="Revenue (AED)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="flex items-center justify-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Revenue (AED)</span>
              </div>
            </div>

            {/* Custom Legend - Outside scrollable area */}
            <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-gradient-to-b from-emerald-500 to-emerald-400"></div>
                <span className="text-sm font-semibold text-slate-700">Achievement %</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-sm bg-gradient-to-b from-purple-500 to-purple-400"></div>
                <span className="text-sm font-semibold text-slate-700">Conversion %</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-600"></div>
                <span className="text-sm font-semibold text-slate-700">Revenue (AED)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between max-sm:flex-col max-sm:items-start gap-3">
            <CardTitle>Salesman Productivity Details</CardTitle>
            <Button onClick={onExport} variant="outline" size="sm" className="gap-2 max-sm:w-full">
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Salesman</TableHead>
                  <TableHead className="text-right">Total Visits</TableHead>
                  <TableHead className="text-right">Productive</TableHead>
                  <TableHead className="text-right">Conversion %</TableHead>
                  <TableHead className="text-right">Avg Duration</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="text-right">VIP/Key</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">Achievement %</TableHead>
                  <TableHead className="text-right">Active Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.map((item: any, idx: number) => (
                  <TableRow key={`prod-table-${item.salesman_code}-${idx}`}>
                    <TableCell className="font-medium">#{item.sales_rank}</TableCell>
                    <TableCell className="font-medium">
                      {item.salesman_code}
                      <div className="text-xs text-slate-500">{item.salesman_name?.split('-')[0]}</div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(item.total_visits)}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.productive_visits)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={parseFloat(item.conversion_rate || 0) >= 70 ? 'default' : parseFloat(item.conversion_rate || 0) >= 50 ? 'secondary' : 'destructive'}>
                        {formatPercent(item.conversion_rate)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(item.avg_visit_duration)} min</TableCell>
                    <TableCell className="text-right">{formatNumber(item.unique_customers)}</TableCell>
                    <TableCell className="text-right">
                      {parseInt(item.vip_customers || 0) + parseInt(item.key_account_customers || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="default">
                        {formatCurrency(item.total_revenue)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.achievement_percentage !== null ? (
                        <Badge variant={parseFloat(item.achievement_percentage || 0) >= 100 ? 'default' : parseFloat(item.achievement_percentage || 0) >= 80 ? 'secondary' : 'destructive'}>
                          {formatPercent(item.achievement_percentage)}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-sm">No Target</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(item.active_days)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper function for formatting
function formatNumber(num: number | string) {
  const value = typeof num === 'string' ? parseFloat(num) : num
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0)
}

function formatCurrency(num: number | string) {
  const value = typeof num === 'string' ? parseFloat(num) : num
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0)
}

function formatPercent(num: number | string) {
  const value = typeof num === 'string' ? parseFloat(num) : num
  return `${(value || 0).toFixed(1)}%`
}
