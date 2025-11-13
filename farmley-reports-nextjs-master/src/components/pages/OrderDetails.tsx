'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, Search, Download, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import OrderItemDetails from './OrderItemDetails'
import ExcelJS from 'exceljs'

interface OrderDetailsProps {
  routeCode: string
  onBack: () => void
}

export default function OrderDetails({ routeCode, onBack }: OrderDetailsProps) {
  const [orderData, setOrderData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState('lastMonth')

  // Helper function to get date range details
  const getDateRangeDetails = (range: string) => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    let startDate: Date
    let endDate: Date
    let periodLabel = ''
    let dateRangeText = ''
    let fileLabel = ''

    switch (range) {
      case 'lastMonth':
        startDate = new Date(currentYear, currentMonth - 1, 1)
        endDate = new Date(currentYear, currentMonth, 0)
        periodLabel = `${startDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`
        fileLabel = `${startDate.toLocaleString('en-US', { month: 'short' })}_${startDate.getFullYear()}`
        break
      case 'lastQuarter':
        const lastQuarter = Math.floor(currentMonth / 3) - 1
        const quarterYear = lastQuarter < 0 ? currentYear - 1 : currentYear
        const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter

        startDate = new Date(quarterYear, adjustedQuarter * 3, 1)
        endDate = new Date(quarterYear, (adjustedQuarter + 1) * 3, 0)

        const month1 = new Date(quarterYear, adjustedQuarter * 3, 1).toLocaleString('en-US', { month: 'short' })
        const month2 = new Date(quarterYear, adjustedQuarter * 3 + 1, 1).toLocaleString('en-US', { month: 'short' })
        const month3 = new Date(quarterYear, adjustedQuarter * 3 + 2, 1).toLocaleString('en-US', { month: 'short' })

        periodLabel = `Q${adjustedQuarter + 1} ${quarterYear} (${month1}, ${month2}, ${month3})`
        fileLabel = `Q${adjustedQuarter + 1}_${quarterYear}`
        break
      default:
        startDate = new Date(currentYear, currentMonth - 1, 1)
        endDate = new Date(currentYear, currentMonth, 0)
        periodLabel = `${startDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`
        fileLabel = `${startDate.toLocaleString('en-US', { month: 'short' })}_${startDate.getFullYear()}`
    }

    dateRangeText = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

    return { periodLabel, dateRangeText, fileLabel, startDate, endDate }
  }

  // Excel Export Function
  const exportOrdersToExcel = async () => {
    if (!filteredOrders || filteredOrders.length === 0) {
      alert('No orders available to export')
      return
    }

    try {
      const { periodLabel, dateRangeText, fileLabel } = getDateRangeDetails(dateRange)

      // Build filter descriptions
      const activeFilters: string[] = []
      if (searchTerm) activeFilters.push(`Search: "${searchTerm}"`)
      if (statusFilter !== 'all') activeFilters.push(`Status: ${statusFilter}`)

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Orders')

      // Set column widths
      worksheet.columns = [
        { key: 'orderId', width: 18 },
        { key: 'date', width: 15 },
        { key: 'customerName', width: 30 },
        { key: 'customerCode', width: 18 },
        { key: 'items', width: 12 },
        { key: 'totalAmount', width: 18 },
        { key: 'paymentMethod', width: 18 },
        { key: 'status', width: 15 },
      ]

      // Add title row
      worksheet.mergeCells('A1:H1')
      const titleRow = worksheet.getCell('A1')
      titleRow.value = `Order Details - Route ${routeCode}`
      titleRow.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      titleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0EA5E9' }
      }
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(1).height = 30

      // Add date range info row
      worksheet.mergeCells('A2:H2')
      const dateRangeRow = worksheet.getCell('A2')
      dateRangeRow.value = `Period: ${periodLabel} | Date Range: ${dateRangeText}`
      dateRangeRow.font = { size: 11, italic: true }
      dateRangeRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(2).height = 20

      // Add salesman info
      worksheet.mergeCells('A3:H3')
      const salesmanRow = worksheet.getCell('A3')
      salesmanRow.value = `Salesman: ${orderData?.salesman?.salesman_name || 'Unknown'}`
      salesmanRow.font = { size: 10, bold: true }
      salesmanRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(3).height = 20

      // Add filter info row
      let currentRow = 4
      if (activeFilters.length > 0) {
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
        const filterRow = worksheet.getCell(`A${currentRow}`)
        filterRow.value = `Active Filters: ${activeFilters.join(' | ')}`
        filterRow.font = { size: 10, italic: true, color: { argb: 'FF1E40AF' } }
        filterRow.alignment = { vertical: 'middle', horizontal: 'center' }
        filterRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDBEAFE' }
        }
        worksheet.getRow(currentRow).height = 25
        currentRow++
      }

      // Add record count info
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
      const countRow = worksheet.getCell(`A${currentRow}`)
      countRow.value = `Total Orders: ${filteredOrders.length} orders`
      countRow.font = { size: 10, bold: true }
      countRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(currentRow).height = 20
      currentRow++

      // Add empty row
      worksheet.addRow([])
      currentRow++

      // Add header row
      const headerRow = worksheet.addRow([
        'Order #',
        'Date',
        'Customer Name',
        'Customer Code',
        'Items',
        'Total Amount (AED)',
        'Payment Method',
        'Status'
      ])

      // Style header row
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
      headerRow.height = 25

      // Add borders to header
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        }
      })

      // Add data rows
      filteredOrders.forEach((order: any, index: number) => {
        const dataRow = worksheet.addRow([
          order.orderId,
          new Date(order.date).toLocaleDateString('en-GB'),
          order.customerName,
          order.customerCode,
          order.items || 0,
          order.totalAmount || 0,
          order.paymentMethod,
          order.status
        ])

        // Format currency column
        dataRow.getCell(6).numFmt = '#,##0.00'

        // Center align specific columns
        dataRow.getCell(1).alignment = { horizontal: 'center' }
        dataRow.getCell(2).alignment = { horizontal: 'center' }
        dataRow.getCell(5).alignment = { horizontal: 'center' }
        dataRow.getCell(6).alignment = { horizontal: 'right' }
        dataRow.getCell(7).alignment = { horizontal: 'center' }
        dataRow.getCell(8).alignment = { horizontal: 'center' }

        // Add borders
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
          }
        })

        // Color code status
        const statusCell = dataRow.getCell(8)
        if (order.status === 'Paid') {
          statusCell.font = { bold: true, color: { argb: 'FF22C55E' } }
        } else if (order.status === 'Pending') {
          statusCell.font = { bold: true, color: { argb: 'FFF59E0B' } }
        } else {
          statusCell.font = { bold: true, color: { argb: 'FFEF4444' } }
        }

        // Alternate row colors
        if (index % 2 === 0) {
          dataRow.eachCell((cell, colNumber) => {
            if (colNumber !== 8) { // Don't override status color
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF9FAFB' }
              }
            }
          })
        }
      })

      // Add summary row
      worksheet.addRow([])
      const totalAmount = filteredOrders.reduce((sum: number, order: any) => sum + (order.totalAmount || 0), 0)
      const totalItems = filteredOrders.reduce((sum: number, order: any) => sum + (order.items || 0), 0)

      const summaryRow = worksheet.addRow([
        '',
        '',
        '',
        'TOTAL:',
        totalItems,
        totalAmount,
        '',
        ''
      ])

      summaryRow.font = { bold: true, size: 12 }
      summaryRow.getCell(4).alignment = { horizontal: 'right' }
      summaryRow.getCell(5).alignment = { horizontal: 'center' }
      summaryRow.getCell(6).numFmt = '#,##0.00'
      summaryRow.getCell(6).alignment = { horizontal: 'right' }

      summaryRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDBEAFE' }
        }
        cell.border = {
          top: { style: 'double', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'double', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        }
      })

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      // Build filename
      let filename = `Orders_Route_${routeCode}_${fileLabel}`
      if (statusFilter !== 'all') {
        filename += `_${statusFilter}`
      }
      filename += '.xlsx'

      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting orders to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  useEffect(() => {
    fetchOrderData()
  }, [routeCode, statusFilter, dateRange])

  const fetchOrderData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/orders/route/${routeCode}?range=${dateRange}&status=${statusFilter}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(`Expected JSON but received: ${contentType}. Response: ${text.substring(0, 200)}...`)
      }

      const result = await response.json()
      if (result.success) {
        setOrderData(result.data)
      } else {
        console.error('API returned error:', result)
        setOrderData(null)
      }
    } catch (error) {
      console.error('Failed to fetch order data:', error)
      setOrderData(null)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orderData?.orders?.filter((order: any) =>
    order.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading order details...</div>
      </div>
    )
  }

  // Show order item details view if an order is selected
  if (selectedOrderId) {
    return (
      <OrderItemDetails
        orderId={selectedOrderId}
        onBack={() => setSelectedOrderId(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">Order Details</h2>
      </div>

      {/* Salesman Info */}
      <div className="text-sm text-gray-600">
        Salesman: <span className="font-semibold text-gray-900">
          {orderData?.salesman?.salesman_name || 'Unknown'} ({routeCode}) •
          Showing {filteredOrders.length} of {orderData?.totalCount || filteredOrders.length} total orders
          {orderData?.hasMore && ' (Limited for performance)'}
        </span>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Total Orders</div>
            <div className="text-2xl font-bold">{orderData?.statistics?.actualTotalCount || orderData?.statistics?.totalOrders || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Total Sales</div>
            <div className="text-2xl font-bold">
              ${((orderData?.statistics?.totalSales || 0) / 1000).toFixed(1)}k
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Avg Order Value</div>
            <div className="text-2xl font-bold">
              ${(orderData?.statistics?.avgOrderValue || 0).toFixed(0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Paid Orders</div>
            <div className="text-2xl font-bold text-green-600">
              {orderData?.statistics?.paidOrders || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Pending</div>
            <div className="text-2xl font-bold text-yellow-600">
              {orderData?.statistics?.pendingOrders || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Order #, Customer, Invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today" disabled>Today</SelectItem>
            <SelectItem value="yesterday" disabled>Yesterday</SelectItem>
            <SelectItem value="thisWeek" disabled>This Week</SelectItem>
            <SelectItem value="thisMonth" disabled>This Month</SelectItem>
            <SelectItem value="lastMonth">Last Month</SelectItem>
            <SelectItem value="lastQuarter">Last Quarter</SelectItem>
            <SelectItem value="thisQuarter" disabled>This Quarter</SelectItem>
            <SelectItem value="thisYear" disabled>This Year</SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={exportOrdersToExcel}
          variant="outline"
          className="flex items-center gap-2 bg-green-500 text-white border-none hover:bg-green-600"
        >
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {/* Orders Table */}
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Order #</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Customer</TableHead>
                <TableHead className="font-semibold text-center">Items</TableHead>
                <TableHead className="font-semibold text-right">Total Amount</TableHead>
                <TableHead className="font-semibold">Payment</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order: any, index: number) => (
                <TableRow key={order.orderId || index} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="font-medium text-blue-600">{order.orderId}</div>
                  </TableCell>
                  <TableCell>{new Date(order.date).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell>
                    <div className="font-medium">{order.customerName}</div>
                    <div className="text-xs text-gray-500">{order.customerCode}</div>
                  </TableCell>
                  <TableCell className="text-center">{order.items || 0}</TableCell>
                  <TableCell className="text-right font-semibold">
                    ${order.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {order.paymentMethod}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        order.status === 'Paid' ? 'default' :
                        order.status === 'Pending' ? 'secondary' : 'destructive'
                      }
                      className={
                        order.status === 'Paid' ? 'bg-green-100 text-green-700' :
                        order.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : ''
                      }
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrderId(order.orderId)}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}