import React, { useEffect, useState } from 'react'
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { X, Package, TrendingDown, ShoppingCart, DollarSign, Calendar, User, MapPin, Hash, Download } from 'lucide-react'
import { useResponsive } from '@/hooks/useResponsive'
import ExcelJS from 'exceljs'

interface OrderDetailsModalProps {
  orderId: string
  isOpen: boolean
  onClose: () => void
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ orderId, isOpen, onClose }) => {
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(false)
  const [orderData, setOrderData] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])

  const getCurrency = () => orderData?.currencyCode || orderData?.summary?.currencyCode || 'AED'

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails()
    }
  }, [isOpen, orderId])

  const fetchOrderDetails = async () => {
    if (!orderId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/orders/details?orderId=${orderId}`)
      const result = await response.json()

      if (result.success) {
        setOrderData(result.data.order)
        setItems(result.data.items || [])
      }
    } catch (error) {
      console.error('Error fetching order details:', error)
      setOrderData(null)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
      case 'completed':
      case 'paid':
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const exportToExcel = async () => {
    if (!orderData || !items || items.length === 0) {
      alert('No order data to export')
      return
    }

    try {
      // Create workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Order Details')

      // Set column widths
      worksheet.columns = [
        { width: 8 },  // Line No
        { width: 18 }, // Product Code
        { width: 35 }, // Product Name
        { width: 25 }, // Product Arabic Name
        { width: 20 }, // Category
        { width: 18 }, // Brand
        { width: 12 }, // Quantity
        { width: 15 }, // Unit Price
        { width: 15 }  // Line Total
      ]

      let currentRow = 1

      // Title
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`)
      const titleCell = worksheet.getCell(`A${currentRow}`)
      titleCell.value = 'Order Details Report'
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF1E40AF' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7FF' }
      }
      worksheet.getRow(currentRow).height = 30
      currentRow++

      // Order ID
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`)
      const orderIdCell = worksheet.getCell(`A${currentRow}`)
      orderIdCell.value = `Order ID: ${orderData.orderId}`
      orderIdCell.font = { size: 12, bold: true }
      orderIdCell.alignment = { horizontal: 'center', vertical: 'middle' }
      orderIdCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Empty row
      currentRow++

      // Order Information Section
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`)
      const infoTitleCell = worksheet.getCell(`A${currentRow}`)
      infoTitleCell.value = 'Order Information'
      infoTitleCell.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } }
      infoTitleCell.alignment = { horizontal: 'left', vertical: 'middle' }
      infoTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Order Info - First Row
      worksheet.getCell(`A${currentRow}`).value = 'Order Date'
      worksheet.getCell(`A${currentRow}`).font = { bold: true }
      worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`B${currentRow}`).value = new Date(orderData.orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
      worksheet.getCell(`B${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`C${currentRow}`).value = 'Customer'
      worksheet.getCell(`C${currentRow}`).font = { bold: true }
      worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`D${currentRow}`).value = orderData.customerName
      worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`E${currentRow}`).value = 'Customer Code'
      worksheet.getCell(`E${currentRow}`).font = { bold: true }
      worksheet.getCell(`E${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`F${currentRow}`).value = orderData.customerCode
      worksheet.getCell(`F${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getRow(currentRow).height = 20
      currentRow++

      // Order Info - Second Row
      worksheet.getCell(`A${currentRow}`).value = 'Salesman'
      worksheet.getCell(`A${currentRow}`).font = { bold: true }
      worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`B${currentRow}`).value = orderData.salesmanName
      worksheet.getCell(`B${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`C${currentRow}`).value = 'Salesman Code'
      worksheet.getCell(`C${currentRow}`).font = { bold: true }
      worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`D${currentRow}`).value = orderData.salesmanCode
      worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`E${currentRow}`).value = 'Route Code'
      worksheet.getCell(`E${currentRow}`).font = { bold: true }
      worksheet.getCell(`E${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`F${currentRow}`).value = orderData.routeCode || 'N/A'
      worksheet.getCell(`F${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getRow(currentRow).height = 20
      currentRow++

      // Empty rows
      currentRow++

      // Summary Section
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`)
      const summaryTitleCell = worksheet.getCell(`A${currentRow}`)
      summaryTitleCell.value = 'Order Summary'
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
      const currency = getCurrency()
      worksheet.getCell(`A${currentRow}`).value = 'Total Amount'
      worksheet.getCell(`A${currentRow}`).font = { bold: true }
      worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`B${currentRow}`).value = `${currency} ${(orderData.summary?.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      worksheet.getCell(`B${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF2563EB' } }
      worksheet.getCell(`B${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`C${currentRow}`).value = 'Total Items'
      worksheet.getCell(`C${currentRow}`).font = { bold: true }
      worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`D${currentRow}`).value = orderData.summary?.totalItems || 0
      worksheet.getCell(`D${currentRow}`).font = { bold: true, size: 12 }
      worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`E${currentRow}`).value = 'Unique Products'
      worksheet.getCell(`E${currentRow}`).font = { bold: true }
      worksheet.getCell(`E${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`F${currentRow}`).value = orderData.summary?.uniqueProducts || 0
      worksheet.getCell(`F${currentRow}`).font = { bold: true, size: 12 }
      worksheet.getCell(`F${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`G${currentRow}`).value = 'Total Quantity'
      worksheet.getCell(`G${currentRow}`).font = { bold: true }
      worksheet.getCell(`G${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`H${currentRow}`).value = orderData.summary?.totalQuantity || 0
      worksheet.getCell(`H${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF059669' } }
      worksheet.getCell(`H${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getRow(currentRow).height = 20
      currentRow++

      // Empty rows
      currentRow++
      currentRow++

      // Items Table Header
      const headerRow = worksheet.getRow(currentRow)
      headerRow.values = [
        'Line',
        'Product Code',
        'Product Name',
        'Product Arabic Name',
        'Category',
        'Brand',
        'Quantity',
        `Unit Price (${currency})`,
        `Line Total (${currency})`
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
      items.forEach((item, index) => {
        const row = worksheet.getRow(currentRow)
        row.values = [
          item.lineNo || index + 1,
          item.productCode,
          item.productName,
          item.productArabicName || '',
          item.categoryName || 'N/A',
          (item.brand && item.brand !== 'Unknown') ? item.brand : 'N/A',
          parseFloat(item.quantity).toFixed(2),
          parseFloat(item.unitPrice).toFixed(2),
          parseFloat(item.lineTotal).toFixed(2)
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
          if (colNumber === 1 || colNumber === 7 || colNumber === 8 || colNumber === 9) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          }

          // Special formatting for amounts
          if (colNumber === 9) {
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
        '',
        '',
        '',
        '',
        '',
        'TOTAL',
        orderData.summary?.totalQuantity || 0,
        '',
        (orderData.summary?.totalAmount || 0).toFixed(2)
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
        if (colNumber >= 6) {
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
      link.download = `Order_Details_${orderData.orderId}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  if (!orderId) return null

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className={`fixed z-[60] grid gap-3 sm:gap-4 border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 bg-white ${
          isMobile
            ? 'inset-0 w-full h-full overflow-y-auto p-4'
            : 'left-[50%] top-[50%] w-[95vw] max-w-5xl max-h-[95vh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] p-6 sm:p-8 rounded-lg data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'
        }`}>
          <DialogPrimitive.Title className="sr-only">Order Details</DialogPrimitive.Title>

          {loading ? (
            <div className="flex items-center justify-center h-[400px]">
              <span className="text-gray-500 text-sm sm:text-base">Loading order details...</span>
            </div>
          ) : orderData ? (
            <>
              {/* Header */}
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-2xl font-bold truncate">Order Details</h2>
                  <div className="mt-1 sm:mt-2">
                    <span className="text-xs sm:text-sm text-gray-600">Order ID: <strong className="break-all">{orderData.orderId}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={exportToExcel}
                    disabled={!items || items.length === 0}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Export Excel
                  </button>
                  <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-md transition-colors">
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              </div>

              {/* Order Information Cards */}
              <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'} gap-3 sm:gap-4 mt-4 sm:mt-6`}>
                <Card>
                  <CardContent className={isMobile ? "p-3" : "p-4"}>
                    <div className={`flex items-center gap-2 text-gray-600 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      <Calendar className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                      <span>Order Date</span>
                    </div>
                    <div className={`font-bold ${isMobile ? 'text-sm' : ''}`}>{formatDate(orderData.orderDate)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className={isMobile ? "p-3" : "p-4"}>
                    <div className={`flex items-center gap-2 text-gray-600 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      <User className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                      <span>Customer</span>
                    </div>
                    <div className={`font-bold truncate ${isMobile ? 'text-sm' : ''}`} title={orderData.customerName}>
                      {orderData.customerName}
                    </div>
                    <div className="text-xs text-gray-500">#{orderData.customerCode}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className={isMobile ? "p-3" : "p-4"}>
                    <div className={`flex items-center gap-2 text-gray-600 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      <User className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                      <span>Salesman</span>
                    </div>
                    <div className={`font-bold truncate ${isMobile ? 'text-sm' : ''}`} title={orderData.salesmanName}>
                      {orderData.salesmanName}
                    </div>
                    <div className="text-xs text-gray-500">#{orderData.salesmanCode}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className={isMobile ? "p-3" : "p-4"}>
                    <div className={`flex items-center gap-2 text-gray-600 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      <MapPin className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                      <span>Route</span>
                    </div>
                    <div className={`font-bold ${isMobile ? 'text-sm' : ''}`}>{orderData.routeCode || 'N/A'}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Order Summary Cards */}
              <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'} gap-3 sm:gap-4 mt-3 sm:mt-4`}>
                <Card>
                  <CardContent className={isMobile ? "p-3" : "p-4"}>
                    <div className={`flex items-center gap-2 text-gray-600 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      <DollarSign className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                      <span>Total Amount</span>
                    </div>
                    <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{formatCurrency(orderData.summary?.totalAmount || 0)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className={isMobile ? "p-3" : "p-4"}>
                    <div className={`flex items-center gap-2 text-gray-600 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      <Package className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                      <span>Total Items</span>
                    </div>
                    <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{formatNumber(orderData.summary?.totalItems || 0)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className={isMobile ? "p-3" : "p-4"}>
                    <div className={`flex items-center gap-2 text-gray-600 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      <ShoppingCart className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                      <span>Unique Products</span>
                    </div>
                    <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{orderData.summary?.uniqueProducts || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className={isMobile ? "p-3" : "p-4"}>
                    <div className={`flex items-center gap-2 text-gray-600 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      <Hash className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                      <span>Total Quantity</span>
                    </div>
                    <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{formatNumber(orderData.summary?.totalQuantity || 0)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className={isMobile ? "p-3" : "p-4"}>
                    <div className={`flex items-center gap-2 text-gray-600 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      <TrendingDown className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                      <span>Avg Item Price</span>
                    </div>
                    <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{formatCurrency(orderData.summary?.avgItemPrice || 0)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Order Items Table */}
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-3">Order Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-600 border-b bg-gray-50">
                        <th className="p-2">#</th>
                        <th className="p-2">Product Code</th>
                        <th className="p-2">Product Name</th>
                        <th className="p-2">Category</th>
                        <th className="p-2">Brand</th>
                        <th className="p-2 text-right">Quantity</th>
                        <th className="p-2 text-right">Unit Price</th>
                        <th className="p-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => {
                        // Create a truly unique key combining all identifying fields
                        const uniqueKey = `${orderId}-line${item.lineNo || index}-${item.productCode || 'unknown'}-${index}`
                        return (
                          <tr key={uniqueKey} className="border-b hover:bg-gray-50">
                            <td className="p-2">{item.lineNo || index + 1}</td>
                            <td className="p-2 font-mono text-xs">{item.productCode}</td>
                            <td className="p-2">
                            <div>
                              <div className="font-medium">{item.productName}</div>
                              {item.productArabicName && (
                                <div className="text-xs text-gray-500">{item.productArabicName}</div>
                              )}
                            </div>
                          </td>
                            <td className="p-2">
                              <Badge className="bg-purple-100 text-purple-800">
                                {item.categoryName || 'N/A'}
                              </Badge>
                            </td>
                            <td className="p-2">{item.brand && item.brand !== 'Unknown' ? item.brand : 'N/A'}</td>
                            <td className="p-2 text-right font-medium">{formatNumber(item.quantity)}</td>
                            <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="p-2 text-right font-bold">{formatCurrency(item.lineTotal)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-bold">
                        <td colSpan={6} className="p-2 text-right">Grand Total:</td>
                        <td className="p-2 text-right">{formatNumber(orderData.summary?.totalQuantity || 0)}</td>
                        <td className="p-2 text-right text-lg">{formatCurrency(orderData.summary?.totalAmount || 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[400px]">
              <div className="text-center">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <span className="text-gray-500">Order details not found</span>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default OrderDetailsModal