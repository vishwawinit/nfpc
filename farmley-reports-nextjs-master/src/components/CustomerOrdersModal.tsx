import React, { useEffect, useState } from 'react'
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { X, ChevronLeft, ChevronRight, Package, Calendar, User, Download } from 'lucide-react'
import { useResponsive } from '@/hooks/useResponsive'
import OrderDetailsModal from './OrderDetailsModal'
import ExcelJS from 'exceljs'

interface CustomerOrdersModalProps {
  customer: any
  isOpen: boolean
  onClose: () => void
  dateRange?: string
}

export const CustomerOrdersModal: React.FC<CustomerOrdersModalProps> = ({ customer, isOpen, onClose, dateRange = 'thisMonth' }) => {
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false)
  const [currencyCode, setCurrencyCode] = useState('AED')
  const [selectedDateRange, setSelectedDateRange] = useState(dateRange)

  useEffect(() => {
    if (isOpen && customer?.customerCode) {
      fetchCustomerOrders()
    }
  }, [isOpen, customer?.customerCode, currentPage, selectedDateRange])

  const fetchCustomerOrders = async () => {
    if (!customer?.customerCode) return

    setLoading(true)
    try {
      const response = await fetch(`/api/customers/orders?customerCode=${customer.customerCode}&range=${selectedDateRange}&page=${currentPage}&limit=10`)
      const result = await response.json()

      if (result.success) {
        setOrders(result.data.orders || [])
        setTotalPages(result.pagination.totalPages || 1)
        setTotalCount(result.pagination.totalCount || 0)
        // Extract currency code from API response
        if (result.data.currencyCode) {
          setCurrencyCode(result.data.currencyCode)
        }
      }
    } catch (error) {
      console.error('Error fetching customer orders:', error)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const handleOrderClick = (order: any) => {
    setSelectedOrder(order)
    setOrderDetailsOpen(true)
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const exportToExcel = async () => {
    if (!customer?.customerCode) {
      alert('No customer selected')
      return
    }

    try {
      // Fetch ALL orders for this customer (bypass pagination) with date range filter
      const response = await fetch(`/api/customers/orders?customerCode=${customer.customerCode}&range=${selectedDateRange}&page=1&limit=100000`)
      const result = await response.json()

      if (!result.success || !result.data.orders || result.data.orders.length === 0) {
        alert('No orders to export')
        return
      }

      const allOrders = result.data.orders

      // Create workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Customer Orders')

      // Set column widths
      worksheet.columns = [
        { width: 20 }, // Order ID
        { width: 20 }, // Order Date
        { width: 20 }, // Salesman Name
        { width: 15 }, // Salesman Code
        { width: 12 }, // Total Items
        { width: 15 }, // Order Total
        { width: 50 }  // Products Summary
      ]

      let currentRow = 1

      // Title
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`)
      const titleCell = worksheet.getCell(`A${currentRow}`)
      titleCell.value = 'Customer Order History'
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF1E40AF' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7FF' }
      }
      worksheet.getRow(currentRow).height = 30
      currentRow++

      // Customer Info
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`)
      const customerCell = worksheet.getCell(`A${currentRow}`)
      customerCell.value = `Customer: ${customer.customerName} (Code: ${customer.customerCode})`
      customerCell.font = { size: 12, bold: true }
      customerCell.alignment = { horizontal: 'center', vertical: 'middle' }
      customerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Empty row
      currentRow++

      // Summary Section
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`)
      const summaryTitleCell = worksheet.getCell(`A${currentRow}`)
      summaryTitleCell.value = 'Summary Statistics'
      summaryTitleCell.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } }
      summaryTitleCell.alignment = { horizontal: 'left', vertical: 'middle' }
      summaryTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Summary stats
      const totalOrders = allOrders.length
      const totalAmount = allOrders.reduce((sum, order) => sum + (parseFloat(order.orderTotal) || 0), 0)
      const totalItems = allOrders.reduce((sum, order) => sum + (parseInt(order.totalItems) || 0), 0)

      worksheet.getCell(`A${currentRow}`).value = 'Total Orders'
      worksheet.getCell(`A${currentRow}`).font = { bold: true }
      worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`B${currentRow}`).value = totalOrders
      worksheet.getCell(`B${currentRow}`).font = { bold: true, size: 12 }
      worksheet.getCell(`B${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`C${currentRow}`).value = 'Total Amount'
      worksheet.getCell(`C${currentRow}`).font = { bold: true }
      worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`D${currentRow}`).value = `${currencyCode} ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      worksheet.getCell(`D${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF2563EB' } }
      worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`E${currentRow}`).value = 'Total Items'
      worksheet.getCell(`E${currentRow}`).font = { bold: true }
      worksheet.getCell(`E${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`F${currentRow}`).value = totalItems
      worksheet.getCell(`F${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF059669' } }
      worksheet.getCell(`F${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getRow(currentRow).height = 20
      currentRow++

      // Empty rows
      currentRow++
      currentRow++

      // Table Header
      const headerRow = worksheet.getRow(currentRow)
      headerRow.values = [
        'Order ID',
        'Order Date',
        'Salesman Name',
        'Salesman Code',
        'Total Items',
        `Order Total (${currencyCode})`,
        'Products Summary'
      ]
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25

      // Add borders to header
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
      allOrders.forEach((order, index) => {
        const row = worksheet.getRow(currentRow)
        row.values = [
          order.orderId,
          new Date(order.orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          order.salesmanName,
          order.salesmanCode,
          order.totalItems,
          parseFloat(order.orderTotal).toFixed(2),
          order.productsSummary
        ]

        // Alternating row colors
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

          // Center align numeric columns
          if (colNumber === 5 || colNumber === 6) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          }

          // Special formatting for amount
          if (colNumber === 6) {
            cell.font = { color: { argb: 'FF2563EB' }, bold: true }
          }
        })

        row.height = 20
        currentRow++
      })

      // Add footer with totals
      currentRow++
      const footerRow = worksheet.getRow(currentRow)
      footerRow.values = [
        'TOTAL',
        '',
        '',
        '',
        totalItems,
        totalAmount.toFixed(2),
        `${totalOrders} orders`
      ]
      footerRow.font = { bold: true, size: 11 }
      footerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      footerRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF6B7280' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'medium', color: { argb: 'FF6B7280' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
        }
        if (colNumber >= 5) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      })
      footerRow.height = 25

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Customer_Orders_${customer.customerCode}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  if (!customer) return null

  return (
    <>
      <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className={`fixed z-50 grid gap-3 sm:gap-4 border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 bg-white ${
            isMobile
              ? 'inset-0 w-full h-full overflow-y-auto p-4'
              : 'left-[50%] top-[50%] w-[95vw] max-w-5xl max-h-[95vh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] p-6 sm:p-8 rounded-lg data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'
          }`}>
            <DialogPrimitive.Title className="sr-only">Customer Orders</DialogPrimitive.Title>

            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-2xl font-bold">Order History</h2>
                <div className="mt-1 sm:mt-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="text-xs sm:text-sm text-gray-600 truncate">Customer: <strong>{customer.customerName}</strong></span>
                  <span className="text-xs sm:text-sm text-gray-600">Code: <strong>{customer.customerCode}</strong></span>
                  <span className="text-xs sm:text-sm text-gray-600">Total Orders: <strong>{totalCount}</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportToExcel}
                  disabled={totalCount === 0}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Download className="h-4 w-4" />
                  Export Excel
                </button>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
              <select
                value={selectedDateRange}
                onChange={(e) => {
                  setSelectedDateRange(e.target.value)
                  setCurrentPage(1) // Reset to first page when filter changes
                }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="thisWeek">This Week</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="lastQuarter">Last Quarter</option>
                <option value="thisYear">This Year</option>
              </select>
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <span className="text-gray-500">Loading orders...</span>
                </div>
              ) : orders.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-gray-600 border-b">
                          <th className="pb-2">Order ID</th>
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Salesman</th>
                          <th className="pb-2">Items</th>
                          <th className="pb-2 text-right">Total</th>
                          <th className="pb-2">Products</th>
                          <th className="pb-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => (
                          <tr key={order.orderId} className="border-b hover:bg-gray-50">
                            <td className="py-3 font-medium">{order.orderId}</td>
                            <td className="py-3">{formatDate(order.orderDate)}</td>
                            <td className="py-3">
                              <div>
                                <div className="font-medium">{order.salesmanName}</div>
                                <div className="text-xs text-gray-500">#{order.salesmanCode}</div>
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1">
                                <Package className="h-4 w-4 text-gray-400" />
                                <span>{order.totalItems}</span>
                              </div>
                            </td>
                            <td className="py-3 text-right font-medium">{formatCurrency(order.orderTotal)}</td>
                            <td className="py-3">
                              <div className="max-w-[200px] truncate text-sm text-gray-600" title={order.productsSummary}>
                                {order.productsSummary}
                              </div>
                            </td>
                            <td className="py-3">
                              <button
                                onClick={() => handleOrderClick(order)}
                                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="text-center">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <span className="text-gray-500">No orders found for this customer</span>
                  </div>
                </div>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          orderId={selectedOrder.orderId}
          isOpen={orderDetailsOpen}
          onClose={() => setOrderDetailsOpen(false)}
        />
      )}
    </>
  )
}

export default CustomerOrdersModal