'use client'

import React, { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Wallet, TrendingUp, RefreshCw, Loader2,
  AlertCircle, BarChart3, Calendar, Clock, Download
} from 'lucide-react'
import { businessColors } from '@/styles/businessColors'
import { useResponsive } from '@/hooks/useResponsive'
import ExcelJS from 'exceljs'

export function CollectionsFinance() {
  const [activeTab, setActiveTab] = useState('outstanding')
  const [dateRange, setDateRange] = useState('lastMonth')
  const [selectedSalesman, setSelectedSalesman] = useState('all')
  const [selectedRoute, setSelectedRoute] = useState('all')
  const { isMobile } = useResponsive()

  // State for data
  const [data, setData] = useState<any>(null)
  const [filters, setFilters] = useState<any>({ salesmen: [], routes: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filtersLoading, setFiltersLoading] = useState(false)

  // Pagination state for Outstanding Report table
  const [outstandingCurrentPage, setOutstandingCurrentPage] = useState(1)
  const outstandingItemsPerPage = 20

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

  // Reset pagination when data changes
  useEffect(() => {
    setOutstandingCurrentPage(1)
  }, [data])

  const fetchFilters = async () => {
    try {
      setFiltersLoading(true)
      const response = await fetch(`/api/collections-finance/filters?range=${dateRange}`)
      const result = await response.json()
      if (result.success) {
        setFilters({
          salesmen: result.salesmen || [],
          routes: result.routes || []
        })
      }
    } catch (error) {
      console.error('Error fetching filters:', error)
    } finally {
      setFiltersLoading(false)
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

      const response = await fetch(`/api/collections-finance?${params}`)
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
    await fetchData()
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case 'today':
        return 'Today'
      case 'yesterday':
        return 'Yesterday'
      case 'thisWeek':
        return 'This Week'
      case 'thisMonth':
        return 'This Month'
      case 'lastMonth':
        return 'Last Month'
      case 'thisQuarter':
        return 'This Quarter'
      case 'lastQuarter':
        return 'Last Quarter'
      case 'thisYear':
        return 'This Year'
      default:
        return 'Selected Period'
    }
  }

  // Excel Export Functions
  const exportToExcel = async (reportType: string) => {
    if (!data) return

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Report')

    let reportTitle = ''
    let headers: string[] = []
    let reportData: any[] = []
    let columnWidths: number[] = []

    switch (reportType) {
      case 'top-customers':
        reportTitle = 'Top 20 Customers by Outstanding'
        headers = ['Customer Code', 'Customer Name', 'Salesman', 'Route', 'Outstanding (AED)', 'Invoices', 'Max Days Outstanding', 'Overdue Count']
        reportData = data.topCustomers || []
        columnWidths = [15, 35, 25, 12, 18, 12, 18, 15]
        break
      case 'aging-analysis':
        reportTitle = 'Aging Analysis Details'
        headers = ['Aging Bucket', 'Outstanding (AED)', 'Invoices', 'Customers', 'Avg Days', '% of Total']
        reportData = data.agingAnalysis || []
        columnWidths = [15, 20, 12, 12, 12, 12]
        break
      case 'salesman-analysis':
        reportTitle = 'Outstanding by Salesman'
        headers = ['Salesman Code', 'Salesman Name', 'Route', 'Outstanding (AED)', 'Invoices', 'Customers', 'Avg Days', 'Overdue Amount (AED)']
        reportData = data.salesmanAnalysis || []
        columnWidths = [15, 25, 12, 18, 12, 12, 12, 18]
        break
      case 'detailed-invoices':
        reportTitle = 'Detailed Outstanding Invoices'
        headers = ['Invoice #', 'Invoice Date', 'Due Date', 'Customer Code', 'Customer Name', 'Salesman Code', 'Salesman Name', 'Route', 'Invoice Amount (AED)', 'Paid Amount (AED)', 'Balance (AED)', 'Days Outstanding', 'Aging Bucket', 'Payment Status']
        reportData = data.detailedInvoices || []
        columnWidths = [18, 14, 14, 15, 35, 15, 25, 12, 18, 18, 18, 16, 15, 15]
        break
    }

    // Set column widths
    worksheet.columns = columnWidths.map(width => ({ width }))

    // Add title row
    const lastCol = String.fromCharCode(64 + headers.length)
    worksheet.mergeCells(`A1:${lastCol}1`)
    const titleCell = worksheet.getCell('A1')
    titleCell.value = reportTitle
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
    worksheet.getRow(1).height = 30

    // Add date info row
    worksheet.mergeCells(`A2:${lastCol}2`)
    const dateCell = worksheet.getCell('A2')
    dateCell.value = `Period: ${getDateRangeLabel()} | Generated: ${new Date().toLocaleString()}`
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
        case 'top-customers':
          rowData = [
            item.customer_code,
            item.customer_name,
            item.salesman_name,
            item.route_code,
            parseFloat(item.total_outstanding),
            parseInt(item.invoice_count),
            parseInt(item.max_days_outstanding),
            parseInt(item.overdue_count)
          ]
          break
        case 'aging-analysis':
          const totalOutstanding = data.agingAnalysis.reduce((sum: number, bucket: any) => sum + Number(bucket.outstanding_amount), 0)
          const percentage = totalOutstanding > 0 ? ((Number(item.outstanding_amount) / totalOutstanding) * 100).toFixed(1) : '0.0'
          rowData = [
            `${item.aging_bucket} days`,
            parseFloat(item.outstanding_amount),
            parseInt(item.invoice_count),
            parseInt(item.customer_count),
            parseInt(item.avg_days),
            percentage + '%'
          ]
          break
        case 'salesman-analysis':
          rowData = [
            item.salesman_code,
            item.salesman_name,
            item.route_code,
            parseFloat(item.total_outstanding),
            parseInt(item.invoice_count),
            parseInt(item.customer_count),
            parseInt(item.avg_days),
            parseFloat(item.overdue_amount)
          ]
          break
        case 'detailed-invoices':
          rowData = [
            item.invoice_number,
            formatDate(item.invoice_date),
            formatDate(item.due_date),
            item.customer_code,
            item.customer_name,
            item.salesman_code,
            item.salesman_name,
            item.route_code,
            parseFloat(item.invoice_amount),
            parseFloat(item.paid_amount),
            parseFloat(item.balance_amount),
            parseInt(item.days_outstanding),
            item.aging_bucket,
            item.payment_status
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
    link.download = `${reportTitle.replace(/ /g, '_')}_${getDateRangeLabel().replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const tabs = [
    { id: 'outstanding', label: 'Outstanding Collections', icon: Wallet },
    { id: 'aging', label: 'Invoice Ageing Report', icon: Clock },
    { id: 'detailed', label: 'Outstanding Report', icon: BarChart3 }
  ]

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
              <Wallet className="w-7 h-7 text-blue-600 max-sm:w-6 max-sm:h-6" />
              Collections & Finance
            </h1>
            <p className="text-base text-slate-600 mt-1 max-sm:text-sm">Track outstanding invoices and aging analysis</p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-blue-600 hover:bg-blue-700 text-white max-md:w-full"
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
        <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Filters</h3>
            {loading && (
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Loading data...</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
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
                Salesman
                {filtersLoading ? (
                  <Loader2 className="inline h-3 w-3 animate-spin ml-1" />
                ) : (
                  <span className="text-xs text-slate-500 font-normal ml-1">(Available: {filters.salesmen.length})</span>
                )}
              </label>
              <Select value={selectedSalesman} onValueChange={setSelectedSalesman} disabled={filtersLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  <SelectItem value="all">All Salesmen</SelectItem>
                  {filters.salesmen.map((s: any, idx: number) => (
                    <SelectItem key={`salesman-${s.code}-${idx}`} value={s.code}>
                      {s.code} - {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Route
                {filtersLoading ? (
                  <Loader2 className="inline h-3 w-3 animate-spin ml-1" />
                ) : (
                  <span className="text-xs text-slate-500 font-normal ml-1">(Available: {filters.routes.length})</span>
                )}
              </label>
              <Select value={selectedRoute} onValueChange={setSelectedRoute} disabled={filtersLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  <SelectItem value="all">All Routes</SelectItem>
                  {filters.routes.map((r: any, idx: number) => (
                    <SelectItem key={`route-${r.code}-${idx}`} value={r.code}>
                      {r.code} - {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex gap-3 flex-wrap w-full h-auto bg-white p-4 rounded-lg shadow-sm mb-6 max-md:grid max-md:grid-cols-2 max-md:gap-3 max-md:mb-4 max-sm:gap-2 max-sm:p-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-3 py-4 px-8 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 font-semibold transition-all text-lg whitespace-nowrap max-md:flex-col max-md:py-5 max-md:px-4 max-md:min-h-[90px] max-md:text-sm max-sm:py-4 max-sm:px-2 max-sm:min-h-[80px] max-sm:text-xs"
              >
                <Icon className="w-7 h-7 max-md:mb-1 max-sm:w-6 max-sm:h-6" />
                <span className="max-md:text-center max-md:leading-tight">{tab.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* Tab 1: Outstanding Collections */}
        <TabsContent value="outstanding">
          <div className="space-y-6 max-md:space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">Total Outstanding</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600 max-sm:text-xl">
                    {formatCurrency(data?.summary?.total_outstanding || 0)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{formatNumber(data?.summary?.total_invoices || 0)} invoices</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">Overdue Amount</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600 max-sm:text-xl">
                    {formatCurrency(data?.summary?.overdue_amount || 0)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{formatNumber(data?.summary?.overdue_invoices || 0)} overdue</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">Customers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600 max-sm:text-xl">
                    {formatNumber(data?.summary?.total_customers || 0)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">With outstanding</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600">Avg Days Outstanding</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600 max-sm:text-xl">
                    {data?.summary?.avg_days_outstanding || 0}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Days</p>
                </CardContent>
              </Card>
            </div>

            {/* Collection Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold max-sm:text-base">Collection Trend ({getDateRangeLabel()})</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                  <BarChart data={data?.collectionTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date_label"
                      tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      label={{ value: 'Date', position: 'insideBottom', offset: -10, style: { fontSize: 12, fill: '#374151', fontWeight: 600 } }}
                    />
                    <YAxis
                      tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                      label={{ value: 'Collections (AED)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#374151', fontWeight: 600 } }}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value)), 'Collections']}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '10px' }}
                      iconType="rect"
                    />
                    <Bar dataKey="collections" fill="#3b82f6" name="Collections (AED)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Customers by Outstanding */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold max-sm:text-base">Top 20 Customers by Outstanding</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel('top-customers')}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span className="max-sm:hidden">Export to Excel</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Customer</TableHead>
                        <TableHead className="min-w-[150px]">Salesman</TableHead>
                        <TableHead className="min-w-[100px]">Route</TableHead>
                        <TableHead className="text-right min-w-[120px]">Outstanding</TableHead>
                        <TableHead className="text-right min-w-[100px]">Invoices</TableHead>
                        <TableHead className="text-right min-w-[100px]">Max Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.topCustomers?.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="font-medium text-sm max-sm:text-xs">{item.customer_name}</div>
                            <div className="text-xs text-slate-500">{item.customer_code}</div>
                          </TableCell>
                          <TableCell className="text-sm max-sm:text-xs">{item.salesman_name}</TableCell>
                          <TableCell className="text-sm max-sm:text-xs">{item.route_code}</TableCell>
                          <TableCell className="text-right font-semibold text-amber-600 text-sm max-sm:text-xs">
                            {formatCurrency(item.total_outstanding)}
                          </TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.invoice_count)}</TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">
                            <Badge variant={item.max_days_outstanding > 90 ? 'destructive' : item.max_days_outstanding > 60 ? 'default' : 'secondary'} className="text-xs">
                              {item.max_days_outstanding} days
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
        </TabsContent>

        {/* Tab 2: Invoice Ageing Report */}
        <TabsContent value="aging">
          <div className="space-y-6 max-md:space-y-4">
            {/* Aging Buckets Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold max-sm:text-base">Invoice Aging Distribution</CardTitle>
                <p className="text-xs text-slate-500 mt-1">Outstanding amounts by aging period</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                  <ComposedChart data={data?.agingAnalysis || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <defs>
                      <linearGradient id="colorOutstanding" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="aging_bucket"
                      tick={{ fontSize: isMobile ? 11 : 12, fill: '#6b7280' }}
                      tickFormatter={(value) => `${value} Days`}
                      label={{ value: 'Aging Period (Days)', position: 'insideBottom', offset: -20, style: { fontSize: 12, fill: '#374151', fontWeight: 600 } }}
                      height={80}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                      label={{ value: 'Outstanding Amount (AED)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#374151', fontWeight: 600 } }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                      label={{ value: 'Number of Invoices', angle: 90, position: 'insideRight', style: { fontSize: 12, fill: '#374151', fontWeight: 600 } }}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === 'Outstanding Amount (AED)') {
                          return [formatCurrency(Number(value)), 'Outstanding'];
                        }
                        return [formatNumber(Number(value)), 'Invoices'];
                      }}
                      labelFormatter={(label) => `Period: ${label} Days`}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="rect" />
                    <Bar yAxisId="left" dataKey="outstanding_amount" fill="url(#colorOutstanding)" name="Outstanding Amount (AED)" radius={[8, 8, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="invoice_count" stroke="#3b82f6" strokeWidth={3} name="Invoice Count" dot={{ r: 6 }} activeDot={{ r: 8 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Aging Buckets Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold max-sm:text-base">Aging Analysis Details</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel('aging-analysis')}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span className="max-sm:hidden">Export to Excel</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Aging Bucket</TableHead>
                        <TableHead className="text-right min-w-[120px]">Outstanding</TableHead>
                        <TableHead className="text-right min-w-[100px]">Invoices</TableHead>
                        <TableHead className="text-right min-w-[100px]">Customers</TableHead>
                        <TableHead className="text-right min-w-[100px]">Avg Days</TableHead>
                        <TableHead className="text-right min-w-[100px]">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.agingAnalysis?.map((item: any, idx: number) => {
                        const totalOutstanding = data.agingAnalysis.reduce(
                          (sum: number, bucket: any) => sum + (Number(bucket.outstanding_amount) || 0),
                          0
                        )
                        const percentage = totalOutstanding > 0
                          ? ((Number(item.outstanding_amount) / totalOutstanding) * 100).toFixed(1)
                          : '0.0'

                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              <Badge
                                variant={item.aging_bucket === '90+' ? 'destructive' : item.aging_bucket === '61-90' ? 'default' : 'secondary'}
                                className="text-sm"
                              >
                                {item.aging_bucket} days
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-amber-600 text-sm max-sm:text-xs">
                              {formatCurrency(item.outstanding_amount)}
                            </TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.invoice_count)}</TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.customer_count)}</TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">{item.avg_days} days</TableCell>
                            <TableCell className="text-right font-semibold text-sm max-sm:text-xs">{percentage}%</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Outstanding by Salesman */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold max-sm:text-base">Outstanding by Salesman</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      Showing {data?.salesmanAnalysis?.length || 0} salesmen with outstanding
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel('salesman-analysis')}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span className="max-sm:hidden">Export to Excel</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">Salesman</TableHead>
                        <TableHead className="min-w-[100px]">Route</TableHead>
                        <TableHead className="text-right min-w-[120px]">Outstanding</TableHead>
                        <TableHead className="text-right min-w-[100px]">Invoices</TableHead>
                        <TableHead className="text-right min-w-[100px]">Customers</TableHead>
                        <TableHead className="text-right min-w-[100px]">Avg Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.salesmanAnalysis?.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="font-medium text-sm max-sm:text-xs">{item.salesman_name}</div>
                            <div className="text-xs text-slate-500">{item.salesman_code}</div>
                          </TableCell>
                          <TableCell className="text-sm max-sm:text-xs">{item.route_code}</TableCell>
                          <TableCell className="text-right font-semibold text-amber-600 text-sm max-sm:text-xs">
                            {formatCurrency(item.total_outstanding)}
                          </TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.invoice_count)}</TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.customer_count)}</TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">
                            <Badge variant={item.avg_days > 90 ? 'destructive' : item.avg_days > 60 ? 'default' : 'secondary'} className="text-xs">
                              {item.avg_days} days
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
        </TabsContent>

        {/* Tab 3: Outstanding Report (Detailed Invoices) */}
        <TabsContent value="detailed">
          <div className="space-y-6 max-md:space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold max-sm:text-base">Detailed Outstanding Invoices</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      Showing {data?.detailedInvoices?.length || 0} invoices
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel('detailed-invoices')}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span className="max-sm:hidden">Export to Excel</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[140px]">Invoice #</TableHead>
                        <TableHead className="min-w-[110px]">Invoice Date</TableHead>
                        <TableHead className="min-w-[110px]">Due Date</TableHead>
                        <TableHead className="min-w-[180px]">Customer</TableHead>
                        <TableHead className="min-w-[150px]">Salesman</TableHead>
                        <TableHead className="text-right min-w-[110px]">Amount</TableHead>
                        <TableHead className="text-right min-w-[110px]">Balance</TableHead>
                        <TableHead className="text-right min-w-[100px]">Days</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const invoices = data?.detailedInvoices || []
                        const startIndex = (outstandingCurrentPage - 1) * outstandingItemsPerPage
                        const endIndex = startIndex + outstandingItemsPerPage
                        const paginatedInvoices = invoices.slice(startIndex, endIndex)

                        return paginatedInvoices.map((item: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm max-sm:text-xs">{item.invoice_number}</TableCell>
                            <TableCell className="text-sm max-sm:text-xs">{formatDate(item.invoice_date)}</TableCell>
                            <TableCell className="text-sm max-sm:text-xs">{formatDate(item.due_date)}</TableCell>
                            <TableCell>
                              <div className="font-medium text-sm max-sm:text-xs">{item.customer_name}</div>
                              <div className="text-xs text-slate-500">{item.customer_code}</div>
                            </TableCell>
                            <TableCell className="text-sm max-sm:text-xs">{item.salesman_name}</TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">{formatCurrency(item.invoice_amount)}</TableCell>
                            <TableCell className="text-right font-semibold text-amber-600 text-sm max-sm:text-xs">
                              {formatCurrency(item.balance_amount)}
                            </TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">
                              <Badge
                                variant={item.days_outstanding > 90 ? 'destructive' : item.days_outstanding > 60 ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {item.days_outstanding}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm max-sm:text-xs">
                              <Badge variant={item.is_overdue ? 'destructive' : 'secondary'} className="text-xs">
                                {item.payment_status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      })()}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {data?.detailedInvoices && data.detailedInvoices.length > outstandingItemsPerPage && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t max-sm:flex-col max-sm:gap-3">
                    <div className="text-sm text-slate-600 max-sm:text-xs max-sm:text-center">
                      Showing {((outstandingCurrentPage - 1) * outstandingItemsPerPage) + 1} to {Math.min(outstandingCurrentPage * outstandingItemsPerPage, data.detailedInvoices.length)} of {data.detailedInvoices.length} invoices
                    </div>
                    <div className="flex gap-2 max-sm:w-full max-sm:justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOutstandingCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={outstandingCurrentPage === 1}
                        className="max-sm:text-xs"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center px-3 text-sm max-sm:text-xs max-sm:px-2">
                        Page {outstandingCurrentPage} of {Math.ceil(data.detailedInvoices.length / outstandingItemsPerPage)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOutstandingCurrentPage(prev => Math.min(Math.ceil(data.detailedInvoices.length / outstandingItemsPerPage), prev + 1))}
                        disabled={outstandingCurrentPage >= Math.ceil(data.detailedInvoices.length / outstandingItemsPerPage)}
                        className="max-sm:text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
