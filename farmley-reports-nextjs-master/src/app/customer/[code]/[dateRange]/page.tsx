'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { 
  ArrowLeft, Download, MapPin, Phone, Mail, Store, Calendar, 
  Package, DollarSign, ShoppingCart, TrendingUp, User
} from 'lucide-react'
import * as ExcelJS from 'exceljs'

interface CustomerDetail {
  customerCode: string
  customerName: string
  address: string
  city: string
  region: string
  phone: string
  email: string
  chain: string
  classification: string
  isActive: boolean
}

interface Transaction {
  transactionId: string
  transactionDate: string
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  totalAmount: number
  discount: number
  netAmount: number
  orderType: string
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
  return new Intl.NumberFormat('en-AE').format(value)
}

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const customerCode = params.code as string
  const dateRange = params.dateRange as string
  
  const [loading, setLoading] = useState(true)
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<any>(null)
  
  useEffect(() => {
    fetchCustomerData()
  }, [customerCode, dateRange])
  
  const fetchCustomerData = async () => {
    try {
      setLoading(true)
      
      // Fetch customer details
      const detailResponse = await fetch(`/api/customers/${customerCode}/details`)
      const detailResult = await detailResponse.json()
      
      if (detailResult.success) {
        setCustomerDetail(detailResult.data)
      }
      
      // Fetch customer transactions
      const transResponse = await fetch(`/api/customers/${customerCode}/transactions?range=${dateRange}`)
      const transResult = await transResponse.json()
      
      if (transResult.success) {
        setTransactions(transResult.data.transactions)
        setSummary(transResult.data.summary)
      }
    } catch (error) {
      console.error('Error fetching customer data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const exportToExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Customer Transactions')
      
      // Add customer info header
      worksheet.addRow(['Customer Code:', customerCode])
      worksheet.addRow(['Customer Name:', customerDetail?.customerName || 'N/A'])
      worksheet.addRow(['Date Range:', dateRange])
      worksheet.addRow(['Total Sales:', formatCurrency(summary?.totalSales || 0)])
      worksheet.addRow(['Total Orders:', summary?.totalOrders || 0])
      worksheet.addRow([])
      
      // Add transaction headers
      const headers = [
        'Transaction ID', 'Date', 'Product Code', 'Product Name', 
        'Quantity', 'Unit Price', 'Total Amount', 'Discount', 'Net Amount'
      ]
      worksheet.addRow(headers)
      
      // Add transaction data
      transactions.forEach(trans => {
        worksheet.addRow([
          trans.transactionId,
          new Date(trans.transactionDate).toLocaleDateString(),
          trans.productCode,
          trans.productName,
          trans.quantity,
          trans.unitPrice,
          trans.totalAmount,
          trans.discount,
          trans.netAmount
        ])
      })
      
      // Style the worksheet
      worksheet.getRow(7).font = { bold: true }
      worksheet.columns.forEach(column => {
        column.alignment = { vertical: 'middle', horizontal: 'left' }
      })
      
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `customer-${customerCode}-transactions-${dateRange}.xlsx`
      link.click()
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data')
    }
  }
  
  const getDateRangeLabel = (range: string) => {
    const labels: any = {
      today: 'Today',
      yesterday: 'Yesterday',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      lastMonth: 'Last Month',
      thisQuarter: 'This Quarter',
      lastQuarter: 'Last Quarter'
    }
    return labels[range] || range
  }
  
  if (loading) {
    return <LoadingBar />
  }
  
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold">Customer Details</h1>
          </div>
          <Button
            onClick={exportToExcel}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Transactions
          </Button>
        </div>
      </div>
      
      {/* Customer Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Customer Code</p>
              <p className="font-semibold text-lg">{customerCode}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Customer Name</p>
              <p className="font-semibold text-lg">{customerDetail?.customerName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <Badge variant={customerDetail?.isActive ? 'default' : 'secondary'}>
                {customerDetail?.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Address</p>
                <p className="font-medium">{customerDetail?.address || 'N/A'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">City</p>
              <p className="font-medium">{customerDetail?.city || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Region</p>
              <p className="font-medium">{customerDetail?.region || 'N/A'}</p>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{customerDetail?.phone || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-gray-500 mt-1" />
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{customerDetail?.email || 'N/A'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Chain</p>
              <p className="font-medium">{customerDetail?.chain || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.totalSales)}</p>
                  <p className="text-xs text-gray-500 mt-1">{getDateRangeLabel(dateRange)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold">{formatNumber(summary.totalOrders)}</p>
                  <p className="text-xs text-gray-500 mt-1">{getDateRangeLabel(dateRange)}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Avg Order Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.avgOrderValue)}</p>
                  <p className="text-xs text-gray-500 mt-1">{getDateRangeLabel(dateRange)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Unique Products</p>
                  <p className="text-2xl font-bold">{formatNumber(summary.uniqueProducts)}</p>
                  <p className="text-xs text-gray-500 mt-1">{getDateRangeLabel(dateRange)}</p>
                </div>
                <Package className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Transactions - {getDateRangeLabel(dateRange)}
          </CardTitle>
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
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Net Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length > 0 ? (
                  transactions.map((trans, index) => (
                    <TableRow key={`${trans.transactionId}-${index}`}>
                      <TableCell className="font-medium">{trans.transactionId}</TableCell>
                      <TableCell>{new Date(trans.transactionDate).toLocaleDateString()}</TableCell>
                      <TableCell>{trans.productCode}</TableCell>
                      <TableCell>{trans.productName}</TableCell>
                      <TableCell>{formatNumber(trans.quantity)}</TableCell>
                      <TableCell>{formatCurrency(trans.unitPrice)}</TableCell>
                      <TableCell>{formatCurrency(trans.totalAmount)}</TableCell>
                      <TableCell>{formatCurrency(trans.discount)}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(trans.netAmount)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
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
  )
}
