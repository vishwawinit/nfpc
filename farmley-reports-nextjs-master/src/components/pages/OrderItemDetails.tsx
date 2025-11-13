'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import ExcelJS from 'exceljs'

interface OrderItemDetailsProps {
  orderId: string
  onBack: () => void
}

export default function OrderItemDetails({ orderId, onBack }: OrderItemDetailsProps) {
  const [orderData, setOrderData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrderDetails()
  }, [orderId])

  const fetchOrderDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/orders/${orderId}`)
      const result = await response.json()
      if (result.success) {
        setOrderData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportOrderToExcel = async () => {
    if (!orderData) {
      alert('No order data available to export')
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Order Details')

      // Set column widths
      worksheet.columns = [
        { key: 'col1', width: 15 },
        { key: 'col2', width: 20 },
        { key: 'col3', width: 35 },
        { key: 'col4', width: 20 },
        { key: 'col5', width: 12 },
        { key: 'col6', width: 10 },
        { key: 'col7', width: 15 },
        { key: 'col8', width: 12 },
        { key: 'col9', width: 15 },
        { key: 'col10', width: 15 },
      ]

      // Add title row
      worksheet.mergeCells('A1:J1')
      const titleRow = worksheet.getCell('A1')
      titleRow.value = `Order Details - ${orderData.orderId}`
      titleRow.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      titleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0EA5E9' }
      }
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(1).height = 30

      // Add invoice info row
      worksheet.mergeCells('A2:J2')
      const invoiceRow = worksheet.getCell('A2')
      invoiceRow.value = `Invoice: ${orderData.invoiceNumber}`
      invoiceRow.font = { size: 11, bold: true }
      invoiceRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(2).height = 20

      // Add status row
      worksheet.mergeCells('A3:J3')
      const statusRow = worksheet.getCell('A3')
      statusRow.value = `Status: ${orderData.status}`
      statusRow.font = { size: 11, bold: true, color: { argb: orderData.status === 'Paid' ? 'FF22C55E' : 'FFF59E0B' } }
      statusRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(3).height = 20

      // Add empty row
      worksheet.addRow([])

      // Add customer info section header
      worksheet.mergeCells('A5:J5')
      const customerHeaderRow = worksheet.getCell('A5')
      customerHeaderRow.value = 'ORDER INFORMATION'
      customerHeaderRow.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
      customerHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      }
      customerHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(5).height = 25

      // Add order details in a grid format
      const detailsStartRow = 6

      // Row 1: Customer
      worksheet.mergeCells(`A${detailsStartRow}:B${detailsStartRow}`)
      const customerLabelCell = worksheet.getCell(`A${detailsStartRow}`)
      customerLabelCell.value = 'Customer:'
      customerLabelCell.font = { bold: true }
      customerLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }

      worksheet.mergeCells(`C${detailsStartRow}:J${detailsStartRow}`)
      const customerValueCell = worksheet.getCell(`C${detailsStartRow}`)
      customerValueCell.value = `${orderData.customer?.name} - ${orderData.customer?.code}`

      // Row 2: Order Date
      worksheet.mergeCells(`A${detailsStartRow + 1}:B${detailsStartRow + 1}`)
      const orderDateLabelCell = worksheet.getCell(`A${detailsStartRow + 1}`)
      orderDateLabelCell.value = 'Order Date:'
      orderDateLabelCell.font = { bold: true }
      orderDateLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }

      worksheet.mergeCells(`C${detailsStartRow + 1}:E${detailsStartRow + 1}`)
      const orderDateValueCell = worksheet.getCell(`C${detailsStartRow + 1}`)
      orderDateValueCell.value = new Date(orderData.orderDate).toLocaleDateString('en-GB')

      // Delivery Date
      worksheet.mergeCells(`F${detailsStartRow + 1}:G${detailsStartRow + 1}`)
      const deliveryDateLabelCell = worksheet.getCell(`F${detailsStartRow + 1}`)
      deliveryDateLabelCell.value = 'Delivery Date:'
      deliveryDateLabelCell.font = { bold: true }
      deliveryDateLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }

      worksheet.mergeCells(`H${detailsStartRow + 1}:J${detailsStartRow + 1}`)
      const deliveryDateValueCell = worksheet.getCell(`H${detailsStartRow + 1}`)
      deliveryDateValueCell.value = new Date(orderData.deliveryDate).toLocaleDateString('en-GB')

      // Row 3: Payment Type
      worksheet.mergeCells(`A${detailsStartRow + 2}:B${detailsStartRow + 2}`)
      const paymentLabelCell = worksheet.getCell(`A${detailsStartRow + 2}`)
      paymentLabelCell.value = 'Payment Type:'
      paymentLabelCell.font = { bold: true }
      paymentLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }

      worksheet.mergeCells(`C${detailsStartRow + 2}:J${detailsStartRow + 2}`)
      const paymentValueCell = worksheet.getCell(`C${detailsStartRow + 2}`)
      paymentValueCell.value = orderData.paymentType

      // Add borders to all info cells
      for (let row = detailsStartRow; row <= detailsStartRow + 2; row++) {
        const currentRow = worksheet.getRow(row)
        currentRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
          }
        })
      }

      // Add empty rows
      worksheet.addRow([])
      worksheet.addRow([])

      // Add line items section header
      const lineItemsHeaderRow = detailsStartRow + 5
      worksheet.mergeCells(`A${lineItemsHeaderRow}:J${lineItemsHeaderRow}`)
      const lineItemsHeader = worksheet.getCell(`A${lineItemsHeaderRow}`)
      lineItemsHeader.value = `ORDER LINE ITEMS (${orderData.lineItems?.length || 0} items)`
      lineItemsHeader.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
      lineItemsHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      }
      lineItemsHeader.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(lineItemsHeaderRow).height = 25

      // Add line items table header
      const tableHeaderRow = worksheet.addRow([
        '#',
        'Product Code',
        'Product Name',
        'Category',
        'Quantity',
        'UOM',
        'Unit Price',
        'Discount %',
        'Line Total',
        'Status'
      ])

      tableHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      tableHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      }
      tableHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' }
      tableHeaderRow.height = 25

      tableHeaderRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        }
      })

      // Add line items data
      orderData.lineItems?.forEach((item: any, index: number) => {
        const dataRow = worksheet.addRow([
          item.id,
          item.productCode,
          item.productName,
          item.category,
          item.quantity,
          item.uom,
          item.unitPrice,
          item.discountPercentage > 0 ? item.discountPercentage : '-',
          item.lineTotal,
          item.status
        ])

        // Format currency columns
        dataRow.getCell(7).numFmt = '$#,##0.00'
        dataRow.getCell(9).numFmt = '$#,##0.00'

        // Alignments
        dataRow.getCell(1).alignment = { horizontal: 'center' }
        dataRow.getCell(2).alignment = { horizontal: 'center' }
        dataRow.getCell(5).alignment = { horizontal: 'center' }
        dataRow.getCell(6).alignment = { horizontal: 'center' }
        dataRow.getCell(7).alignment = { horizontal: 'right' }
        dataRow.getCell(8).alignment = { horizontal: 'center' }
        dataRow.getCell(9).alignment = { horizontal: 'right' }
        dataRow.getCell(10).alignment = { horizontal: 'center' }

        // Add borders
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
          }
        })

        // Alternate row colors
        if (index % 2 === 0) {
          dataRow.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF9FAFB' }
            }
          })
        }

        // Color code status
        const statusCell = dataRow.getCell(10)
        if (item.status === 'Delivered') {
          statusCell.font = { bold: true, color: { argb: 'FF22C55E' } }
        } else if (item.status === 'Pending') {
          statusCell.font = { bold: true, color: { argb: 'FFF59E0B' } }
        }
      })

      // Add empty row
      worksheet.addRow([])

      // Add summary section
      worksheet.mergeCells(`A${worksheet.lastRow.number + 1}:H${worksheet.lastRow.number + 1}`)
      const subtotalLabelCell = worksheet.getCell(`A${worksheet.lastRow.number}`)
      subtotalLabelCell.value = 'Subtotal:'
      subtotalLabelCell.font = { bold: true, size: 11 }
      subtotalLabelCell.alignment = { horizontal: 'right' }

      worksheet.mergeCells(`I${worksheet.lastRow.number}:J${worksheet.lastRow.number}`)
      const subtotalValueCell = worksheet.getCell(`I${worksheet.lastRow.number}`)
      subtotalValueCell.value = orderData.summary?.subtotal || 0
      subtotalValueCell.numFmt = '$#,##0.00'
      subtotalValueCell.alignment = { horizontal: 'right' }
      subtotalValueCell.font = { bold: true, size: 11 }

      // Add discount row if there is a discount
      if (orderData.summary?.totalDiscount > 0) {
        worksheet.addRow([])
        worksheet.mergeCells(`A${worksheet.lastRow.number}:H${worksheet.lastRow.number}`)
        const discountLabelCell = worksheet.getCell(`A${worksheet.lastRow.number}`)
        discountLabelCell.value = 'Total Discount:'
        discountLabelCell.font = { bold: true, size: 11, color: { argb: 'FFEF4444' } }
        discountLabelCell.alignment = { horizontal: 'right' }

        worksheet.mergeCells(`I${worksheet.lastRow.number}:J${worksheet.lastRow.number}`)
        const discountValueCell = worksheet.getCell(`I${worksheet.lastRow.number}`)
        discountValueCell.value = -orderData.summary?.totalDiscount
        discountValueCell.numFmt = '$#,##0.00'
        discountValueCell.alignment = { horizontal: 'right' }
        discountValueCell.font = { bold: true, size: 11, color: { argb: 'FFEF4444' } }
      }

      // Add total row
      worksheet.addRow([])
      worksheet.mergeCells(`A${worksheet.lastRow.number}:H${worksheet.lastRow.number}`)
      const totalLabelCell = worksheet.getCell(`A${worksheet.lastRow.number}`)
      totalLabelCell.value = 'TOTAL:'
      totalLabelCell.font = { bold: true, size: 13 }
      totalLabelCell.alignment = { horizontal: 'right' }
      totalLabelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }

      worksheet.mergeCells(`I${worksheet.lastRow.number}:J${worksheet.lastRow.number}`)
      const totalValueCell = worksheet.getCell(`I${worksheet.lastRow.number}`)
      totalValueCell.value = orderData.summary?.total || 0
      totalValueCell.numFmt = '$#,##0.00'
      totalValueCell.alignment = { horizontal: 'right' }
      totalValueCell.font = { bold: true, size: 13, color: { argb: 'FF3B82F6' } }
      totalValueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }

      // Add borders to summary section
      const summaryStartRow = worksheet.lastRow.number - (orderData.summary?.totalDiscount > 0 ? 2 : 1)
      for (let row = summaryStartRow; row <= worksheet.lastRow.number; row++) {
        const currentRow = worksheet.getRow(row)
        currentRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          }
        })
      }

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Order_${orderData.orderId}_${orderData.invoiceNumber}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting order to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading order details...</div>
      </div>
    )
  }

  if (!orderData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Order not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to List
        </Button>
        <Button
          onClick={exportOrderToExcel}
          variant="outline"
          className="flex items-center gap-2 bg-green-500 text-white border-none hover:bg-green-600"
        >
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {/* Order Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{orderData.orderId}</h1>
            <p className="text-sm text-gray-500">Invoice: {orderData.invoiceNumber}</p>
          </div>
          <Badge
            className={
              orderData.status === 'Paid'
                ? 'bg-green-100 text-green-700 px-3 py-1'
                : 'bg-yellow-100 text-yellow-700 px-3 py-1'
            }
          >
            {orderData.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">Customer</p>
            <p className="font-semibold">{orderData.customer?.name}</p>
            <p className="text-sm text-gray-500">{orderData.customer?.code}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Order Date</p>
            <p className="font-semibold">
              {new Date(orderData.orderDate).toLocaleDateString('en-GB')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Delivery Date</p>
            <p className="font-semibold">
              {new Date(orderData.deliveryDate).toLocaleDateString('en-GB')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Payment Type</p>
            <p className="font-semibold">{orderData.paymentType}</p>
          </div>
        </div>
      </div>

      {/* Order Line Items */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">
            Order Line Items ({orderData.lineItems?.length || 0} items)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[50px] text-center font-semibold">#</TableHead>
                <TableHead className="font-semibold">Product Code</TableHead>
                <TableHead className="font-semibold">Product Name</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="text-center font-semibold">Quantity</TableHead>
                <TableHead className="text-center font-semibold">UOM</TableHead>
                <TableHead className="text-right font-semibold">Unit Price</TableHead>
                <TableHead className="text-center font-semibold">Discount %</TableHead>
                <TableHead className="text-right font-semibold">Line Total</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderData.lineItems?.map((item: any) => (
                <TableRow key={item.id} className="hover:bg-gray-50">
                  <TableCell className="text-center text-gray-500">{item.id}</TableCell>
                  <TableCell>
                    <span className="font-medium text-blue-600">{item.productCode}</span>
                  </TableCell>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {item.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-center text-gray-600">
                    {item.uom}
                  </TableCell>
                  <TableCell className="text-right">
                    ${item.unitPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.discountPercentage > 0 && (
                      <span className="text-orange-600 font-medium">
                        {item.discountPercentage}%
                      </span>
                    )}
                    {item.discountPercentage === 0 && '-'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ${item.lineTotal.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={item.status === 'Delivered' ? 'default' : 'secondary'}
                      className={
                        item.status === 'Delivered'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : ''
                      }
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Order Summary */}
          <div className="border-t bg-gray-50 p-6">
            <div className="max-w-sm ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">${orderData.summary?.subtotal?.toFixed(2)}</span>
              </div>
              {orderData.summary?.totalDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Discount:</span>
                  <span className="font-medium text-red-600">
                    -${orderData.summary?.totalDiscount?.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span className="text-blue-600">${orderData.summary?.total?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}