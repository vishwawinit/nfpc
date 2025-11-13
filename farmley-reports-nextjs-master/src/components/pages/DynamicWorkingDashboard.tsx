import React, { useState, useMemo, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, PieChart, Pie, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Store, Calendar, MapPin, Phone, Mail, Download } from 'lucide-react'
import * as ExcelJS from 'exceljs'
import { DynamicKPICards } from '../dashboard/DynamicKPICards'
import { DashboardFilters } from '../dashboard/DashboardFilters'
import { useDashboardFilters } from '@/hooks/useDashboardFilters'
import { useSalesTrend, useTopCustomers, useTopProducts, useSalesByChannel } from '@/hooks/useDataService'
import { useResponsive } from '@/hooks/useResponsive'

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

export const DynamicWorkingDashboard: React.FC = () => {
  const [selectedDateRange, setSelectedDateRange] = useState('thisMonth')
  const [isInitialized, setIsInitialized] = useState(false)
  const { isMobile, styles } = useResponsive()
  
  // Initialize on mount
  useEffect(() => {
    console.log('Dashboard initialized')
  }, [])

  // Dialog states for customer details
  const [showOrdersDialog, setShowOrdersDialog] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerDetail, setCustomerDetail] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)

  // Use the dashboard filters hook
  const {
    filters,
    filterOptions,
    loading: filtersLoading,
    error: filtersError,
    updateFilter: setFilter,
    setDateRange,
    resetFilters,
    getQueryParams,
    summary,
    hierarchyInfo
  } = useDashboardFilters()

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
      case 'custom': return 'Custom Range'
      default: return 'This Month'
    }
  }

  const days = getDaysFromRange(selectedDateRange)

  // Handle date range preset selection - update filters accordingly
  const handleDateRangeSelect = (range: string) => {
    setSelectedDateRange(range)
    
    // If 'custom' is selected, don't update the date filters - user will set them manually
    if (range === 'custom') {
      return
    }

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

  // Handle manual date changes - switch to 'custom' preset
  const handleManualDateChange = (startDate: string | null, endDate: string | null) => {
    setSelectedDateRange('custom')
    setDateRange(startDate, endDate)
  }

  // Initialize date range on mount
  useEffect(() => {
    if (!isInitialized) {
      handleDateRangeSelect(selectedDateRange)
      setIsInitialized(true)
    }
  }, [isInitialized, selectedDateRange])

  // Memoize query params to prevent infinite re-renders
  const queryParams = useMemo(() => {
    const params = getQueryParams()
    console.log('Dashboard: Query params updated:', params.toString())
    return params
  }, [
    filters.startDate,
    filters.endDate,
    filters.regionCode,
    filters.cityCode,
    filters.fieldUserRole,
    filters.teamLeaderCode,
    filters.userCode,
    filters.chainName,
    filters.storeCode
  ])

  // Colors for pie chart
  const CHANNEL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

  // Fetch data - Limited to Top 20 for dashboard sections - WITH FILTERS APPLIED
  const { data: salesTrendData, loading: trendLoading } = useSalesTrend(selectedDateRange, { additionalParams: queryParams })
  const { data: topCustomersData, loading: customersLoading } = useTopCustomers(20, selectedDateRange, { additionalParams: queryParams })
  const { data: topProductsData, loading: productsLoading } = useTopProducts(20, selectedDateRange, { additionalParams: queryParams })
  const { data: salesByChannelData, loading: channelLoading } = useSalesByChannel({ additionalParams: queryParams })

  // Transform channel data for pie chart - group < 5% as "Others"
  const pieChartData = useMemo(() => {
    if (!salesByChannelData || salesByChannelData.length === 0) return []

    const majorChannels = salesByChannelData.filter(c => c.percentage >= 5)
    const minorChannels = salesByChannelData.filter(c => c.percentage < 5)

    const chartData = [...majorChannels]

    // If there are minor channels, group them as "Others"
    if (minorChannels.length > 0) {
      const othersTotal = minorChannels.reduce((sum, c) => sum + c.sales, 0)
      const othersPercentage = minorChannels.reduce((sum, c) => sum + c.percentage, 0)
      const othersOrders = minorChannels.reduce((sum, c) => sum + c.orders, 0)
      const othersCustomers = minorChannels.reduce((sum, c) => sum + c.customers, 0)

      chartData.push({
        channel: 'Others',
        sales: parseFloat(othersTotal.toFixed(2)),
        percentage: parseFloat(othersPercentage.toFixed(2)),
        orders: othersOrders,
        customers: othersCustomers
      })
    }

    return chartData
  }, [salesByChannelData])

  // Transform sales trend data for chart with appropriate date formatting
  const chartData = salesTrendData?.map(item => {
    const date = new Date(item.date)
    let formattedDate = ''
    let fullDate = '' // For tooltip

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
      orders: item.orders,
      customers: item.customers
    }
  }) || []

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
      
      const transUrl = `/api/customers/${customer.customerCode}/transactions?range=${selectedDateRange}`
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
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Customer Transactions')
      
      worksheet.addRow(['CUSTOMER INFORMATION'])
      worksheet.addRow([])
      worksheet.addRow(['Customer Code:', customer.customerCode || ''])
      worksheet.addRow(['Customer Name:', customerDetail?.customerName || customer.customerName || ''])
      worksheet.addRow(['Total Sales:', formatCurrency(customer.totalSales || 0)])
      worksheet.addRow([])
      
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      
      const headerRowIndex = worksheet.lastRow!.number + 1
      worksheet.addRow(['Transaction ID', 'Date', 'Product Code', 'Product Name', 'Quantity', 'Unit Price', 'Total', 'Net Amount'])
      worksheet.getRow(headerRowIndex).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(headerRowIndex).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      
      transactions.forEach(trans => {
        worksheet.addRow([
          trans.transactionId,
          new Date(trans.transactionDate).toLocaleDateString('en-GB'),
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
      link.download = `customer-${customer.customerCode}-transactions.xlsx`
      link.click()
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  return (
    <>
      <style>{`
        .customer-card-hover:hover,
        .product-card-hover:hover,
        .transaction-card-hover:hover {
          background-color: #f3f4f6 !important;
        }

        .customer-card-hover:active,
        .product-card-hover:active,
        .transaction-card-hover:active {
          background-color: #e5e7eb !important;
          transform: scale(0.98);
        }

        /* FORCE mobile layout - sections stacked vertically below each other */
        @media (max-width: 768px) {
          .dashboard-grid-row-1,
          .dashboard-grid-row-2 {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }

          /* Ensure cards take full width on mobile */
          .dashboard-grid-row-1 > *,
          .dashboard-grid-row-2 > * {
            width: 100% !important;
            max-width: 100% !important;
          }
        }

        /* FORCE desktop layout - sections side by side */
        @media (min-width: 769px) {
          .dashboard-grid-row-1 {
            display: grid !important;
            grid-template-columns: 2fr 1fr !important;
            gap: 24px !important;
          }

          .dashboard-grid-row-2 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 24px !important;
          }
        }

        /* Touch-friendly scrollbars for mobile */
        @media (max-width: 768px) {
          ::-webkit-scrollbar {
            width: 4px;
            height: 4px;
          }

          ::-webkit-scrollbar-track {
            background: #f1f1f1;
          }

          ::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 2px;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: #555;
          }
        }
      `}</style>
      <div style={{
        ...styles.padding('24px', '16px'),
        backgroundColor: '#f8fafc',
        minHeight: '100vh'
      }}>
      {/* Header */}
      <div style={{
        marginBottom: isMobile ? '16px' : '24px'
      }}>
        <h1 style={{
          ...styles.fontSize('32px', '20px'),
          fontWeight: '700',
          color: '#1f2937',
          marginBottom: '4px'
        }}>
          NFPC Dashboard
        </h1>
        <p style={{
          ...styles.fontSize('16px', '13px'),
          color: '#6b7280',
          marginBottom: '0px'
        }}>
          Welcome back! Here's your NFPC sales performance overview.
        </p>
      </div>

      {/* Show error if user not found */}
      {filtersError && filtersError.includes('not found in the system') ? (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <svg
              style={{ width: '24px', height: '24px', color: '#dc2626' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#991b1b',
                marginBottom: '4px'
              }}>
                User Not Found
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#7f1d1d'
              }}>
                {filtersError}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Dashboard Filters */}
      <DashboardFilters
        filters={filters}
        filterOptions={filterOptions}
        onFilterChange={setFilter}
        onDateRangeChange={handleManualDateChange}
        onReset={resetFilters}
        loading={filtersLoading}
        selectedDateRange={selectedDateRange}
        onDateRangeSelect={handleDateRangeSelect}
        showChainFilter={true}
        showStoreFilter={true}
        hierarchyInfo={hierarchyInfo}
      />

      {/* KPI Cards Row */}
      <div style={{ marginBottom: isMobile ? '20px' : '32px' }}>
        <DynamicKPICards
          showRefreshButton={false}
          dateRange={selectedDateRange}
          additionalParams={queryParams}
        />
      </div>

      {/* Sales Trend Chart with Top Customers Side by Side */}
      <div
        className="dashboard-grid-row-1"
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
          gap: isMobile ? '16px' : '24px',
          marginBottom: isMobile ? '20px' : '32px'
        }}
      >
        {/* Sales Trend Chart - Left Side */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Trend ({getDateRangeLabel(selectedDateRange)})</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ ...styles.height('350px', '280px'), width: '100%' }}>
              {trendLoading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%'
                }}>
                  <div>Loading sales data...</div>
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 50, left: 20, bottom: 20 }}>
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
                          return [`AED ${Number(value).toLocaleString('en-IN')}`, name]
                        }
                        return [Number(value).toLocaleString(), name]
                      }}
                      labelFormatter={(label: string) => {
                        // Find the full date for this label
                        const dataPoint = chartData.find(d => d.date === label)
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
              ) : (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  color: '#6b7280'
                }}>
                  No sales data available for selected period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Customers - Right Side */}
        <Card>
          <CardHeader>
            <CardTitle>Top 20 Customers</CardTitle>
          </CardHeader>
          <CardContent>
            {customersLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                Loading customer data...
              </div>
            ) : topCustomersData && topCustomersData.length > 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? '6px' : '4px',
                maxHeight: isMobile ? '330px' : '370px',
                overflowY: 'auto',
                paddingRight: isMobile ? '2px' : '4px'
              }}>
                {topCustomersData.map((customer, index) => (
                  <div
                    key={`customer-${customer.customerCode}-${index}`}
                    className="customer-card-hover"
                    onClick={() => viewCustomerOrders(customer)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: isMobile ? '8px 10px' : '10px 12px',
                      borderBottom: index < 9 ? '1px solid #e5e7eb' : 'none',
                      backgroundColor: '#fafafa',
                      borderRadius: isMobile ? '4px' : '6px',
                      marginBottom: '2px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                    title={`${customer.customerName} (${customer.customerCode})\nTotal Sales: AED ${((customer.totalSales ?? 0) as number).toLocaleString('en-IN')}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#374151',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        display: 'inline-block',
                        textAlign: 'center',
                        lineHeight: '18px',
                        backgroundColor: '#e5e7eb',
                        border: '1px solid #d1d5db'
                      }}>{index + 1}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>
                          {customer.customerName.length > 18
                            ? customer.customerName.substring(0, 18) + '...'
                            : customer.customerName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                          {customer.customerCode || ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                      {`AED ${(customer.totalSales || 0).toLocaleString('en-IN')}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                No customer data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Top Products and Recent Transactions */}
      <div
        className="dashboard-grid-row-2"
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? '16px' : '24px'
        }}
      >
        {/* Top Products - Left */}
        <Card>
          <CardHeader>
            <CardTitle>Top 20 Products</CardTitle>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                Loading product data...
              </div>
            ) : topProductsData && topProductsData.length > 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? '6px' : '4px',
                maxHeight: isMobile ? '350px' : '650px',
                overflowY: 'auto',
                paddingRight: isMobile ? '2px' : '4px'
              }}>
                {topProductsData.map((product, index) => (
                  <div
                    key={`product-${product.productCode}-${index}`}
                    className="product-card-hover"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '30px 1fr 80px 100px',
                      gap: '8px',
                      alignItems: 'center',
                      padding: isMobile ? '8px 10px' : '10px 12px',
                      borderBottom: index < 9 ? '1px solid #e5e7eb' : 'none',
                      backgroundColor: '#fafafa',
                      borderRadius: isMobile ? '4px' : '6px',
                      marginBottom: '2px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#374151',
                      minWidth: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#e5e7eb',
                      border: '1px solid #d1d5db'
                    }}>{index + 1}</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#111827', wordWrap: 'break-word' }}>
                        {product.productName || 'Unknown Product'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        {product.productCode || ''}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', textAlign: 'right' }}>
                      {(product.quantitySold || 0).toLocaleString()} units
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', textAlign: 'right' }}>
                      {`AED ${(product.salesAmount || 0).toLocaleString('en-IN')}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                No product data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales by Channel - Right */}
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
                <div style={{ ...styles.height('250px', '200px'), width: '100%' }}>
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
                                <span>Sales: AED {Number(data.sales).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                                <span>Percentage: {data.percentage?.toFixed(2)}%</span>
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
                  paddingRight: isMobile ? '4px' : '8px'
                }}>
                  {salesByChannelData.map((channel, index) => {
                    // Create rich tooltip content with color indicators
                    const tooltipContent = `${channel.channel}

🔵 Sales: AED ${channel.sales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
🟢 Orders: ${channel.orders.toLocaleString()}
🟠 Customers: ${channel.customers.toLocaleString()}
🟣 Percentage: ${channel.percentage.toFixed(2)}%`

                    return (
                      <div
                        key={`channel-${index}`}
                        title={tooltipContent}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: isMobile ? '6px 8px' : '8px 12px',
                          marginBottom: '4px',
                          backgroundColor: '#fafafa',
                          borderRadius: '6px',
                          borderLeft: `4px solid ${CHANNEL_COLORS[index % CHANNEL_COLORS.length]}`,
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f4f6'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#fafafa'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <div
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: CHANNEL_COLORS[index % CHANNEL_COLORS.length]
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {channel.channel}
                            </div>
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>
                              <span style={{ color: '#10b981' }}>●</span> {channel.orders} orders · <span style={{ color: '#f59e0b' }}>●</span> {channel.customers} customers
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '8px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                            <span style={{ color: '#3b82f6', fontSize: '10px' }}>●</span> {`AED ${channel.sales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            <span style={{ color: '#8b5cf6' }}>●</span> {channel.percentage.toFixed(2)}%
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
                      <p className="font-semibold">{customerDetail?.region || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">City</p>
                      <p className="font-semibold">{customerDetail?.city || 'N/A'}</p>
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
    </>
  )
}

export default DynamicWorkingDashboard