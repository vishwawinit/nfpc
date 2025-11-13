'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, RefreshCw, Download, HelpCircle, Calculator, TrendingUp, TrendingDown, Package, ShoppingCart, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatCurrency, formatNumber } from '@/lib/utils'
import ExcelJS from 'exceljs'

export const DaywiseLedger: React.FC = () => {
  // State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedRegion, setSelectedRegion] = useState<string>('')
  const [selectedRoute, setSelectedRoute] = useState<string>('')
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')

  // Data state
  const [availableRegions, setAvailableRegions] = useState<any[]>([])
  const [availableRoutes, setAvailableRoutes] = useState<any[]>([])
  const [availableCustomers, setAvailableCustomers] = useState<any[]>([])
  const [customerData, setCustomerData] = useState<any>(null)
  const [currencyCode, setCurrencyCode] = useState('AED')

  // Loading state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tab state
  const [activeTab, setActiveTab] = useState('history')

  // Search and filter state for historical transactions
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: '', end: '' })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  // Fetch regions when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchRegions()
    }
  }, [selectedDate])

  // Fetch routes when region changes
  useEffect(() => {
    if (selectedDate && selectedRegion) {
      fetchRoutes()
    } else {
      setAvailableRoutes([])
      setSelectedRoute('')
    }
  }, [selectedDate, selectedRegion])

  // Fetch customers when route changes
  useEffect(() => {
    if (selectedDate && selectedRegion && selectedRoute) {
      fetchCustomers()
    } else {
      setAvailableCustomers([])
      setSelectedCustomer('')
    }
  }, [selectedDate, selectedRegion, selectedRoute])

  // Fetch customer data when customer changes
  useEffect(() => {
    if (selectedDate && selectedCustomer) {
      fetchCustomerData()
    } else {
      setCustomerData(null)
    }
  }, [selectedDate, selectedCustomer])

  const fetchRegions = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/customers/daywise-ledger?date=${selectedDate}`)
      const result = await response.json()
      if (result.success) {
        setAvailableRegions(result.data.availableRegions || [])
        setCurrencyCode(result.data.currencyCode || 'AED')
        setSelectedRegion('')
        setSelectedRoute('')
        setSelectedCustomer('')
      } else {
        setError(result.error || 'Failed to fetch regions')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch regions')
    } finally {
      setLoading(false)
    }
  }

  const fetchRoutes = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/customers/daywise-ledger?date=${selectedDate}&region=${selectedRegion}`)
      const result = await response.json()
      if (result.success) {
        setAvailableRoutes(result.data.availableRoutes || [])
        setSelectedRoute('')
        setSelectedCustomer('')
      } else {
        setError(result.error || 'Failed to fetch routes')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch routes')
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/customers/daywise-ledger?date=${selectedDate}&region=${selectedRegion}&route=${selectedRoute}`)
      const result = await response.json()
      if (result.success) {
        setAvailableCustomers(result.data.availableCustomers || [])
        setSelectedCustomer('')
      } else {
        setError(result.error || 'Failed to fetch customers')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customers')
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomerData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/customers/daywise-ledger?date=${selectedDate}&customerCode=${selectedCustomer}`)
      const result = await response.json()
      if (result.success) {
        setCustomerData(result.data)
        setCurrencyCode(result.data.currencyCode || 'AED')
      } else {
        setError(result.error || 'Failed to fetch customer data')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customer data')
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (value: number) => {
    return `${currencyCode} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const exportAllTransactions = async () => {
    if (!customerData || !filteredHistoricalTransactions.length) return

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('All Transactions')

      // Header
      worksheet.mergeCells('A1:I1')
      const titleCell = worksheet.getCell('A1')
      titleCell.value = `All Transactions - ${customerData.customer?.customer_name || ''}`
      titleCell.font = { size: 16, bold: true }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

      let currentRow = 3

      // Table Headers
      const headers = ['Date', 'Transaction Code', 'Type', 'Product Code', 'Product Name', 'Quantity', 'Amount', 'Route', 'Reason']
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1)
        cell.value = header
        cell.font = { bold: true }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E7EB' }
        }
      })
      currentRow++

      // All transactions (filtered)
      filteredHistoricalTransactions.forEach((txn: any) => {
        worksheet.getCell(`A${currentRow}`).value = formatDate(txn.date)
        worksheet.getCell(`B${currentRow}`).value = txn.code
        worksheet.getCell(`C${currentRow}`).value = txn.type
        worksheet.getCell(`D${currentRow}`).value = txn.productCode
        worksheet.getCell(`E${currentRow}`).value = txn.productName
        worksheet.getCell(`F${currentRow}`).value = txn.quantity
        worksheet.getCell(`G${currentRow}`).value = formatAmount(txn.amount)
        worksheet.getCell(`H${currentRow}`).value = `${txn.routeCode} - ${txn.routeName}`
        worksheet.getCell(`I${currentRow}`).value = txn.reason || '-'
        currentRow++
      })

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        let maxLength = 10
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10
          if (columnLength > maxLength) {
            maxLength = columnLength
          }
        })
        column.width = maxLength + 2
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `All_Transactions_${customerData.customer?.customer_code}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  const exportToExcel = async () => {
    if (!customerData) return

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Day-wise Ledger')

      // Header
      worksheet.mergeCells('A1:H1')
      const titleCell = worksheet.getCell('A1')
      titleCell.value = `Day-wise Ledger - ${customerData.customer?.customer_name || ''}`
      titleCell.font = { size: 16, bold: true }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

      worksheet.mergeCells('A2:H2')
      const dateCell = worksheet.getCell('A2')
      dateCell.value = `Date: ${selectedDate}`
      dateCell.font = { size: 12 }
      dateCell.alignment = { horizontal: 'center' }

      let currentRow = 4

      // Summary
      worksheet.getCell(`A${currentRow}`).value = 'Summary'
      worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 }
      currentRow += 1

      const summaryData = [
        ['Total Invoices', formatAmount(customerData.selectedDateSummary.totalInvoices)],
        ['Good Returns', formatAmount(customerData.selectedDateSummary.goodReturns)],
        ['Bad Returns', formatAmount(customerData.selectedDateSummary.badReturns)],
        ['Gross Returns', formatAmount(customerData.selectedDateSummary.grossReturns)],
        ['Net Sales', formatAmount(customerData.selectedDateSummary.netSales)],
        ['Deliveries', formatAmount(customerData.selectedDateSummary.deliveries)]
      ]

      summaryData.forEach(([label, value]) => {
        worksheet.getCell(`A${currentRow}`).value = label
        worksheet.getCell(`B${currentRow}`).value = value
        currentRow++
      })

      currentRow += 2

      // Transactions Table
      worksheet.getCell(`A${currentRow}`).value = 'Transactions'
      worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 }
      currentRow += 1

      const headers = ['Transaction Code', 'Type', 'Product', 'Quantity', 'Unit Price', 'Amount', 'Route', 'Reason']
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1)
        cell.value = header
        cell.font = { bold: true }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E7EB' }
        }
      })
      currentRow++

      customerData.selectedDateTransactions.forEach((txn: any) => {
        worksheet.getCell(`A${currentRow}`).value = txn.code
        worksheet.getCell(`B${currentRow}`).value = txn.type
        worksheet.getCell(`C${currentRow}`).value = txn.productName
        worksheet.getCell(`D${currentRow}`).value = txn.quantity
        worksheet.getCell(`E${currentRow}`).value = txn.unitPrice
        worksheet.getCell(`F${currentRow}`).value = txn.amount
        worksheet.getCell(`G${currentRow}`).value = `${txn.routeCode} - ${txn.routeName}`
        worksheet.getCell(`H${currentRow}`).value = txn.reason || '-'
        currentRow++
      })

      // Auto-fit columns
      worksheet.columns.forEach((column, index) => {
        let maxLength = 10
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10
          if (columnLength > maxLength) {
            maxLength = columnLength
          }
        })
        column.width = maxLength + 2
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Daywise_Ledger_${customerData.customer?.customer_code}_${selectedDate}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  // Prepare purchase aging chart data
  const purchaseAgingData = customerData?.purchaseAging || []

  // Filter and paginate historical transactions
  const historicalTransactions = customerData?.historicalTransactions || []
  const filteredHistoricalTransactions = historicalTransactions.filter((txn: any) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = !searchQuery ||
      txn.code.toLowerCase().includes(searchLower) ||
      txn.productName.toLowerCase().includes(searchLower) ||
      txn.productCode.toLowerCase().includes(searchLower)

    // Date range filter
    const txnDate = new Date(txn.date)
    const matchesDateRange = (!dateRangeFilter.start || txnDate >= new Date(dateRangeFilter.start)) &&
                             (!dateRangeFilter.end || txnDate <= new Date(dateRangeFilter.end))

    return matchesSearch && matchesDateRange
  })

  // Pagination
  const totalPages = Math.ceil(filteredHistoricalTransactions.length / itemsPerPage)
  const paginatedHistoricalTransactions = filteredHistoricalTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Day-wise Ledger</h2>
          <p className="text-sm text-gray-600 mt-1">
            View detailed customer transactions for a specific date
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Select Filters
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">Follow the steps below to view customer ledger</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Picker */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">Step 1</Badge>
                Date
                {selectedDate && (
                  <span className="text-green-600 text-xs">✓</span>
                )}
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Region Selector */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">Step 2</Badge>
                Region
                {selectedRegion && (
                  <span className="text-green-600 text-xs">✓</span>
                )}
              </label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion} disabled={!availableRegions.length || loading}>
                <SelectTrigger>
                  <SelectValue placeholder={!availableRegions.length ? "Select date first" : "Select Region"} />
                </SelectTrigger>
                <SelectContent>
                  {availableRegions.map((region) => (
                    <SelectItem key={region.code} value={region.code}>
                      {region.name} ({region.customerCount} customers)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Route Selector */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">Step 3</Badge>
                Route
                {selectedRoute && (
                  <span className="text-green-600 text-xs">✓</span>
                )}
              </label>
              <Select value={selectedRoute} onValueChange={setSelectedRoute} disabled={!availableRoutes.length || loading}>
                <SelectTrigger>
                  <SelectValue placeholder={!selectedRegion ? "Select region first" : "Select Route"} />
                </SelectTrigger>
                <SelectContent>
                  {availableRoutes.map((route) => (
                    <SelectItem key={route.code} value={route.code}>
                      {route.code} - {route.name} ({route.customerCount} customers)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer Selector */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">Step 4</Badge>
                Customer
                {selectedCustomer && (
                  <span className="text-green-600 text-xs">✓</span>
                )}
              </label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer} disabled={!availableCustomers.length || loading}>
                <SelectTrigger>
                  <SelectValue placeholder={!selectedRoute ? "Select route first" : "Select Customer"} />
                </SelectTrigger>
                <SelectContent>
                  {availableCustomers.map((customer) => (
                    <SelectItem key={customer.code} value={customer.code}>
                      {customer.code} - {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading && (
            <div className="mt-4 text-center text-sm text-gray-600">
              <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
              Loading...
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Data Display */}
      {customerData && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="history" className="text-base">Complete Transaction History</TabsTrigger>
            <TabsTrigger value="selected-date" className="text-base">Selected Date Activity</TabsTrigger>
          </TabsList>

          {/* TAB 1: COMPLETE TRANSACTION HISTORY (All-Time) */}
          <TabsContent value="history" className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-200">
              <h3 className="text-xl font-bold mb-1 text-blue-900">Complete Transaction History</h3>
              <p className="text-sm text-blue-700 mb-6">All-time data for {customerData.customer?.customer_name}</p>

            {/* Historical Summary Cards */}
            <TooltipProvider>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                {/* Total Invoices */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                      Total Invoices
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">All invoice transactions (trx_type = 1) throughout customer history</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatAmount(customerData.historicalSummary.totalInvoices)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {customerData.historicalSummary.invoiceCount} invoices
                    </div>
                  </CardContent>
                </Card>

                {/* Good Returns */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Good Returns
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Sellable returns (trx_type = 4, collection_type = 1)</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatAmount(customerData.historicalSummary.goodReturns)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {customerData.historicalSummary.goodReturnsCount} returns
                    </div>
                  </CardContent>
                </Card>

                {/* Bad Returns */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      Bad Returns
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Wastage/damaged returns (trx_type = 4, collection_type = 0)</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {formatAmount(customerData.historicalSummary.badReturns)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {customerData.historicalSummary.badReturnsCount} returns
                    </div>
                  </CardContent>
                </Card>

                {/* Delivery Orders */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4 text-purple-600" />
                      Delivery Orders
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">Completed delivery orders (trx_type = 5, status = Completed). Note: Pending orders (status = Pending) are not included.</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatAmount(customerData.historicalSummary.deliveryOrders || 0)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {customerData.historicalSummary.deliveryOrdersCount || 0} orders
                    </div>
                  </CardContent>
                </Card>

                {/* Net Sales */}
                <Card className="border-2 border-orange-500 bg-orange-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-orange-600" />
                      Net Sales
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Total Invoices - (Good Returns + Bad Returns)</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatAmount(customerData.historicalSummary.netSales)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      After all returns
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TooltipProvider>

            {/* Purchase Aging Graph */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Purchase Aging Pattern</CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md">
                        <p className="text-xs">Shows when this customer made purchases over time</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={purchaseAgingData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="period"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'amount') return [formatAmount(value as number), 'Purchase Amount']
                        if (name === 'invoiceCount') return [value, 'Invoices']
                        return value
                      }}
                    />
                    <Bar dataKey="amount" name="amount" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Historical Transactions Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All Transactions</CardTitle>
                  <Button onClick={() => exportAllTransactions()} size="sm" className="bg-green-600 hover:bg-green-700">
                    <Download className="h-4 w-4 mr-2" />
                    Export All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search and Filters */}
                <div className="mb-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by transaction code, product name, or product code..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setCurrentPage(1)
                        }}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Input
                      type="date"
                      placeholder="Start Date"
                      value={dateRangeFilter.start}
                      onChange={(e) => {
                        setDateRangeFilter({ ...dateRangeFilter, start: e.target.value })
                        setCurrentPage(1)
                      }}
                      className="w-48"
                    />
                    <Input
                      type="date"
                      placeholder="End Date"
                      value={dateRangeFilter.end}
                      onChange={(e) => {
                        setDateRangeFilter({ ...dateRangeFilter, end: e.target.value })
                        setCurrentPage(1)
                      }}
                      className="w-48"
                    />
                    {(searchQuery || dateRangeFilter.start || dateRangeFilter.end) && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchQuery('')
                          setDateRangeFilter({ start: '', end: '' })
                          setCurrentPage(1)
                        }}
                        size="sm"
                      >
                        Clear Filters
                      </Button>
                    )}
                    <div className="ml-auto text-sm text-gray-600 flex items-center">
                      Showing {paginatedHistoricalTransactions.length} of {filteredHistoricalTransactions.length} transactions
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Date
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Transaction date in DD/MM/YYYY format (from trx_date_only field)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Transaction Code
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Unique identifier for this transaction (trx_code field)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Type
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="space-y-1 text-xs">
                                    <p className="font-semibold">Transaction Types:</p>
                                    <p><strong>Invoice:</strong> trx_type = 1</p>
                                    <p><strong>Good Return:</strong> trx_type = 4, collection_type = 1 (Sellable)</p>
                                    <p><strong>Bad Return:</strong> trx_type = 4, collection_type = 0 (Wastage)</p>
                                    <p><strong>Delivery Order (Completed):</strong> trx_type = 5, status = Completed</p>
                                    <p><strong>Delivery Order (Pending):</strong> trx_type = 5, status = Pending</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Product Code
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">SKU identifier (product_code field)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Product Name
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Product description (product_name field)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Quantity
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Number of units (quantity field). Positive for invoices/deliveries, can be negative for returns.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Amount
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Total transaction value in currency (total_amount field)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Route
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Route code and name from journey_management table (joined by route_code)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Reason
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Return reason (line_reason field). Usually populated for returns, may be empty for invoices and deliveries.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedHistoricalTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                            {searchQuery || dateRangeFilter.start || dateRangeFilter.end
                              ? 'No transactions match your filters'
                              : 'No historical transactions found'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedHistoricalTransactions.map((txn: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="text-sm">{formatDate(txn.date)}</TableCell>
                            <TableCell className="font-mono text-sm">{txn.code}</TableCell>
                            <TableCell>
                              <Badge variant={
                                txn.typeCode === 1 ? 'default' :
                                txn.typeCode === 4 && txn.collectionType === 1 ? 'secondary' :
                                txn.typeCode === 4 && txn.collectionType === 0 ? 'destructive' :
                                'outline'
                              }>
                                {txn.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{txn.productCode}</TableCell>
                            <TableCell>{txn.productName}</TableCell>
                            <TableCell className="text-right">{formatNumber(txn.quantity)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatAmount(txn.amount)}</TableCell>
                            <TableCell className="text-sm">{txn.routeCode} - {txn.routeName}</TableCell>
                            <TableCell className="text-sm text-gray-600">{txn.reason || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          {/* TAB 2: SELECTED DATE ACTIVITY */}
          <TabsContent value="selected-date" className="space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border-2 border-green-200">
              <h3 className="text-xl font-bold mb-1 text-green-900">Selected Date Activity</h3>
              <p className="text-sm text-green-700 mb-6">Activity on {selectedDate} for {customerData.customer?.customer_name}</p>

            {/* Selected Date Summary Cards */}
            <TooltipProvider>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                {/* Total Invoices */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                      Invoices
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">Invoice transactions (trx_type = 1) on {selectedDate} for this customer</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatAmount(customerData.selectedDateSummary.totalInvoices)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {customerData.selectedDateSummary.invoiceCount} invoice(s)
                    </div>
                  </CardContent>
                </Card>

                {/* Good Returns */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Good Returns
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">Sellable returns (trx_type = 4, collection_type = 1) on {selectedDate}</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatAmount(customerData.selectedDateSummary.goodReturns)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {customerData.selectedDateSummary.goodReturnsCount} return(s)
                    </div>
                  </CardContent>
                </Card>

                {/* Bad Returns */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      Bad Returns
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">Wastage/damaged returns (trx_type = 4, collection_type = 0) on {selectedDate}</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {formatAmount(customerData.selectedDateSummary.badReturns)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {customerData.selectedDateSummary.badReturnsCount} return(s)
                    </div>
                  </CardContent>
                </Card>

                {/* Delivery Orders */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4 text-purple-600" />
                      Delivery Orders
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">Completed delivery orders (trx_type = 5, status = Completed) on {selectedDate}. Note: Pending orders (status = Pending) are not included.</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatAmount(customerData.selectedDateSummary.deliveryOrders)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {customerData.selectedDateSummary.deliveryOrdersCount} order(s)
                    </div>
                  </CardContent>
                </Card>

                {/* Net Sales */}
                <Card className="border-2 border-orange-500 bg-orange-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-orange-600" />
                      Net Sales
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">Invoices - (Good Returns + Bad Returns) on {selectedDate}</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatAmount(customerData.selectedDateSummary.netSales)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      After returns
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TooltipProvider>

            {/* Selected Date Transactions Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All Transactions on {selectedDate}</CardTitle>
                  <Button onClick={exportToExcel} size="sm" className="bg-green-600 hover:bg-green-700">
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Transaction Code
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Unique identifier for this transaction (trx_code field)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Type
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <div className="space-y-1 text-xs">
                                    <p className="font-semibold">Transaction Types:</p>
                                    <p><strong>Invoice:</strong> trx_type = 1</p>
                                    <p><strong>Good Return:</strong> trx_type = 4, collection_type = 1 (Sellable)</p>
                                    <p><strong>Bad Return:</strong> trx_type = 4, collection_type = 0 (Wastage)</p>
                                    <p><strong>Delivery Order (Completed):</strong> trx_type = 5, status = Completed</p>
                                    <p><strong>Delivery Order (Pending):</strong> trx_type = 5, status = Pending</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Product Code
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">SKU identifier (product_code field)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Product Name
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Product description (product_name field)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Quantity
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Number of units (quantity field)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Unit Price
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Price per unit (unit_price field)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Amount
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Total transaction value (total_amount field)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Route
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Route code and name from journey_management table</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Salesman
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Salesman who handled this transaction (salesman_name field)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            Reason
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">Return reason (line_reason field). Usually populated for returns, may be empty for invoices and deliveries.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerData.selectedDateTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                            No transactions found for this date
                          </TableCell>
                        </TableRow>
                      ) : (
                        customerData.selectedDateTransactions.map((txn: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-sm">{txn.code}</TableCell>
                            <TableCell>
                              <Badge variant={
                                txn.typeCode === 1 ? 'default' :
                                txn.typeCode === 4 && txn.collectionType === 1 ? 'secondary' :
                                txn.typeCode === 4 && txn.collectionType === 0 ? 'destructive' :
                                'outline'
                              }>
                                {txn.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{txn.productCode}</TableCell>
                            <TableCell>{txn.productName}</TableCell>
                            <TableCell className="text-right">{formatNumber(txn.quantity)}</TableCell>
                            <TableCell className="text-right">{formatAmount(txn.unitPrice)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatAmount(txn.amount)}</TableCell>
                            <TableCell className="text-sm">{txn.routeCode} - {txn.routeName}</TableCell>
                            <TableCell className="text-sm">{txn.salesman}</TableCell>
                            <TableCell className="text-sm text-gray-600">{txn.reason || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Empty State */}
      {!customerData && !loading && !error && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">Select a date and customer to view day-wise ledger</p>
              <p className="text-sm mt-2">Start by selecting a date, then choose region, route, and customer</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
