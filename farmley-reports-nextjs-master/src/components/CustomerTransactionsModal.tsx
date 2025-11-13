'use client'
import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Download, RefreshCw, TrendingUp, TrendingDown, Package, ShoppingCart, HelpCircle, Calculator } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import ExcelJS from 'exceljs'

interface CustomerTransactionsModalProps {
  customer: any
  isOpen: boolean
  onClose: () => void
  dateRange: string
}

export const CustomerTransactionsModal: React.FC<CustomerTransactionsModalProps> = ({
  customer,
  isOpen,
  onClose,
  dateRange: initialDateRange
}) => {
  const [transactions, setTransactions] = useState<any[]>([])
  const [totals, setTotals] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(30)
  const [pagination, setPagination] = useState<any>(null)
  const [dateRange, setDateRange] = useState(initialDateRange)
  const [currencyCode, setCurrencyCode] = useState('AED')

  const fetchTransactions = async () => {
    if (!customer?.customerCode) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        customerCode: customer.customerCode,
        range: dateRange,
        page: currentPage.toString(),
        limit: pageSize.toString()
      })

      const response = await fetch(`/api/customers/transactions/daily?${params.toString()}`)
      const result = await response.json()

      if (result.success && result.data) {
        setTransactions(result.data.transactions || [])
        setTotals(result.data.totals || null)
        setPagination(result.pagination || null)
        setCurrencyCode(result.data.currencyCode || 'AED')
      } else {
        setError(result.error || 'Failed to fetch transactions')
      }
    } catch (err) {
      setError('An error occurred while fetching transactions')
      console.error('Error fetching transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && customer) {
      fetchTransactions()
    }
  }, [isOpen, customer, currentPage, pageSize, dateRange])

  useEffect(() => {
    setDateRange(initialDateRange)
  }, [initialDateRange])

  const formatCurrency = (value: number) => {
    return `${currencyCode} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const exportToExcel = async () => {
    try {
      // Fetch all data without pagination
      const params = new URLSearchParams({
        customerCode: customer.customerCode,
        range: dateRange,
        page: '1',
        limit: '10000'
      })

      const response = await fetch(`/api/customers/transactions/daily?${params.toString()}`)
      const result = await response.json()

      if (!result.success || !result.data) {
        alert('Failed to fetch data for export')
        return
      }

      const allTransactions = result.data.transactions
      const totals = result.data.totals

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Daily Transactions')

      // Set column widths
      worksheet.columns = [
        { width: 15 },  // Date
        { width: 15 },  // Sales Amount
        { width: 12 },  // Sales Count
        { width: 15 },  // Sales Qty
        { width: 18 },  // Good Returns Amt
        { width: 15 },  // Good Returns Cnt
        { width: 15 },  // Good Returns Qty
        { width: 18 },  // Bad Returns Amt
        { width: 15 },  // Bad Returns Cnt
        { width: 15 },  // Bad Returns Qty
        { width: 15 },  // Delivery Amt
        { width: 12 },  // Delivery Cnt
        { width: 15 },  // Delivery Qty
        { width: 15 }   // Net Amount
      ]

      let currentRow = 1

      // Title
      worksheet.mergeCells(`A${currentRow}:N${currentRow}`)
      const titleCell = worksheet.getCell(`A${currentRow}`)
      titleCell.value = 'Customer Daily Transactions Report'
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF1E40AF' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7FF' }
      }
      worksheet.getRow(currentRow).height = 30
      currentRow++

      // Customer info
      worksheet.mergeCells(`A${currentRow}:N${currentRow}`)
      const customerCell = worksheet.getCell(`A${currentRow}`)
      customerCell.value = `Customer: ${customer.customerName} (${customer.customerCode})`
      customerCell.font = { size: 12, bold: true }
      customerCell.alignment = { horizontal: 'center', vertical: 'middle' }
      customerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Period
      worksheet.mergeCells(`A${currentRow}:N${currentRow}`)
      const dateCell = worksheet.getCell(`A${currentRow}`)
      const periodLabels: {[key: string]: string} = {
        'today': 'Today',
        'yesterday': 'Yesterday',
        'thisWeek': 'This Week',
        'thisMonth': 'This Month',
        'lastMonth': 'Last Month',
        'thisQuarter': 'This Quarter',
        'lastQuarter': 'Last Quarter',
        'thisYear': 'This Year'
      }
      dateCell.value = `Period: ${periodLabels[dateRange] || dateRange} | Generated: ${new Date().toLocaleString('en-GB')}`
      dateCell.font = { size: 11 }
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
      worksheet.getRow(currentRow).height = 20
      currentRow++

      currentRow++

      // Header row
      const headerRow = worksheet.getRow(currentRow)
      headerRow.values = [
        'Date',
        'Sales Amount',
        'Sales Count',
        'Sales Qty',
        'Good Returns Amt',
        'Good Ret. Count',
        'Good Ret. Qty',
        'Bad Returns Amt',
        'Bad Ret. Count',
        'Bad Ret. Qty',
        'Delivery Amt',
        'Delivery Count',
        'Delivery Qty',
        'Net Amount'
      ]
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
        }
      })
      currentRow++

      // Data rows
      allTransactions.forEach((transaction, index) => {
        const row = worksheet.getRow(currentRow)
        row.values = [
          transaction.date,
          transaction.sales.amount,
          transaction.sales.count,
          transaction.sales.quantity,
          transaction.goodReturns.amount,
          transaction.goodReturns.count,
          transaction.goodReturns.quantity,
          transaction.badReturns.amount,
          transaction.badReturns.count,
          transaction.badReturns.quantity,
          transaction.deliveries.amount,
          transaction.deliveries.count,
          transaction.deliveries.quantity,
          transaction.netAmount
        ]

        const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB'
        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          }
          cell.alignment = { vertical: 'middle' }

          // Format currency columns
          if ([2, 5, 8, 11, 14].includes(colNumber)) {
            cell.numFmt = '#,##0.00'
            cell.font = { color: { argb: 'FF059669' } }
          }

          // Format quantity columns
          if ([4, 7, 10, 13].includes(colNumber)) {
            cell.numFmt = '#,##0.00'
          }

          // Format count columns
          if ([3, 6, 9, 12].includes(colNumber)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          }
        })

        row.height = 20
        currentRow++
      })

      // Totals row
      currentRow++
      const totalsRow = worksheet.getRow(currentRow)
      totalsRow.values = [
        'TOTALS',
        totals?.salesAmount || 0,
        totals?.salesCount || 0,
        totals?.salesQuantity || 0,
        totals?.goodReturnsAmount || 0,
        totals?.goodReturnsCount || 0,
        totals?.goodReturnsQuantity || 0,
        totals?.badReturnsAmount || 0,
        totals?.badReturnsCount || 0,
        totals?.badReturnsQuantity || 0,
        totals?.deliveryAmount || 0,
        totals?.deliveryCount || 0,
        totals?.deliveryQuantity || 0,
        totals?.netAmount || 0
      ]
      totalsRow.font = { bold: true, size: 11 }
      totalsRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      totalsRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF6B7280' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'medium', color: { argb: 'FF6B7280' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
        }
        if ([2, 5, 8, 11, 14].includes(colNumber)) {
          cell.numFmt = '#,##0.00'
        }
        if ([4, 7, 10, 13].includes(colNumber)) {
          cell.numFmt = '#,##0.00'
        }
      })
      totalsRow.height = 25

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Customer_Transactions_${customer.customerCode}_${dateRange}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  if (!customer) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Daily Transactions - {customer.customerName}</DialogTitle>
          <DialogDescription>
            Customer Code: <span className="font-semibold">{customer.customerCode}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-3 items-center">
              <Select value={dateRange} onValueChange={(value) => {
                setDateRange(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="thisWeek">This Week</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="lastQuarter">Last Quarter</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchTransactions}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            <Button
              onClick={exportToExcel}
              disabled={transactions.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>

          {/* Summary Cards */}
          {totals && (
            <TooltipProvider>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                      Total Sales
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold mb-1">Total Sales</p>
                          <p className="text-xs">Sum of all sales transactions (trx_type = 1) for this customer in the selected period.</p>
                          <p className="text-xs mt-1 text-blue-600">Formula: SUM(total_amount WHERE trx_type = 1)</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(totals.salesAmount)}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {totals.salesCount} orders • {totals.salesQuantity.toFixed(0)} items
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-green-600" />
                      Good Returns
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold mb-1">Good Returns (Sellable)</p>
                          <p className="text-xs">Returns that can be resold. Items returned in good condition.</p>
                          <p className="text-xs mt-1 text-green-600">Formula: SUM(total_amount WHERE trx_type = 4 AND collection_type = 1)</p>
                          <p className="text-xs mt-1 italic">trx_type 4 = Returns, collection_type 1 = Good/Sellable</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.goodReturnsAmount)}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {totals.goodReturnsCount} returns • {totals.goodReturnsQuantity.toFixed(0)} items
                    </div>
                  </CardContent>
                </Card>

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
                          <p className="font-semibold mb-1">Bad Returns (Wastage)</p>
                          <p className="text-xs">Returns that cannot be resold. Damaged, expired, or unsellable items.</p>
                          <p className="text-xs mt-1 text-red-600">Formula: SUM(total_amount WHERE trx_type = 4 AND collection_type = 0)</p>
                          <p className="text-xs mt-1 italic">trx_type 4 = Returns, collection_type 0 = Bad/Wastage</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(totals.badReturnsAmount)}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {totals.badReturnsCount} returns • {totals.badReturnsQuantity.toFixed(0)} items
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4 text-purple-600" />
                      Deliveries
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold mb-1">Deliveries (Stock In)</p>
                          <p className="text-xs">Products delivered to customer. Represents stock additions to customer inventory.</p>
                          <p className="text-xs mt-1 text-purple-600">Formula: SUM(total_amount WHERE trx_type = 3)</p>
                          <p className="text-xs mt-1 italic">trx_type 3 = Deliveries/Stock In</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">{formatCurrency(totals.deliveryAmount)}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {totals.deliveryCount} deliveries • {totals.deliveryQuantity.toFixed(0)} items
                    </div>
                  </CardContent>
                </Card>

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
                          <p className="font-semibold mb-1">Net Sales (Final Amount)</p>
                          <p className="text-xs">Actual sales after accounting for all returns. This is the true revenue from customer.</p>
                          <p className="text-xs mt-1 font-mono text-orange-600">
                            = Sales - Good Returns - Bad Returns + Deliveries
                          </p>
                          <p className="text-xs mt-1 font-mono">
                            = {formatCurrency(totals.salesAmount)} - {formatCurrency(totals.goodReturnsAmount)} - {formatCurrency(totals.badReturnsAmount)} + {formatCurrency(totals.deliveryAmount)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(totals.salesAmount - totals.goodReturnsAmount - totals.badReturnsAmount + totals.deliveryAmount)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Final amount after returns
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TooltipProvider>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          {/* Transactions Table */}
          {!loading && !error && (
            <>
              <div className="border rounded-lg overflow-x-auto">
                <TooltipProvider>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Sales
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Daily sales amount (trx_type = 1)</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                        <TableHead className="text-center">Orders</TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Good Returns
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Sellable returns (trx_type = 4, collection_type = 1)</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                        <TableHead className="text-center">Returns</TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Bad Returns
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Wastage (trx_type = 4, collection_type = 0)</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                        <TableHead className="text-center">Wastage</TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Deliveries
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Stock delivered (trx_type = 3)</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                        <TableHead className="text-center">Del. Count</TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            Net Amount
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-3 w-3 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs font-semibold">Sales - Good Returns - Bad Returns + Deliveries</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                          No transactions found for the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((transaction, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{formatDate(transaction.date)}</TableCell>
                          <TableCell className="text-right font-semibold text-blue-600">
                            {formatCurrency(transaction.sales.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{transaction.sales.count}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {formatCurrency(transaction.goodReturns.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{transaction.goodReturns.count}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-red-600">
                            {formatCurrency(transaction.badReturns.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{transaction.badReturns.count}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-purple-600">
                            {formatCurrency(transaction.deliveries.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{transaction.deliveries.count}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(transaction.netAmount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </TooltipProvider>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Show</span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(Number(value))
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-600">per page</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    <div className="px-3 py-1 bg-gray-100 border rounded">
                      <span className="text-sm font-medium">
                        Page {currentPage} of {pagination.totalPages}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage >= pagination.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="text-sm text-gray-600">
                    Total: {pagination.totalCount} days
                  </div>
                </div>
              )}
            </>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
