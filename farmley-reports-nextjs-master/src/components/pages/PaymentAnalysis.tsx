'use client'
import { businessColors } from '@/styles/businessColors'
import React, { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { useResponsive } from '@/hooks/useResponsive'
import {
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  CreditCard,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Banknote,
  Receipt,
  FileText,
  Building,
  UserCheck,
  X,
  User,
  Phone,
  MapPin,
  Hash,
  CalendarDays,
  Wallet,
  FileCheck,
  Download
} from 'lucide-react'
import ExcelJS from 'exceljs'

// Color palette for charts
const CHART_COLORS = {
  primary: '#00b4d8',
  secondary: '#0077b6',
  accent: '#90e0ef',
  warning: '#ffd60a',
  danger: '#ef476f',
  success: '#06ffa5',
  info: '#118ab2',
  purple: '#9b5de5',
  orange: '#fb8500'
}

const PAYMENT_MODE_COLORS = {
  'CASH': '#06ffa5',
  'CHEQUE': '#00b4d8',
  'Unknown': '#718096'
}

interface PaymentData {
  paymentId: number
  receiptNumber: string
  paymentDate: string
  customerCode: string
  customerName: string
  paymentMode: string
  paymentType: string
  totalAmount: number
  bankName: string | null
  chequeNumber: string | null
  chequeDate: string | null
  invoiceNumbers: string | null
  invoiceCount: number | null
  paymentStatus: string | null
  approvalStatus: string | null
  salesmanCode: string | null
  salesmanName: string | null
  createdDate: string | null
}

// Custom tooltip for currency formatting
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-medium text-sm">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.name.includes('amount') || entry.name.includes('Amount') ? formatCurrency(entry.value) : formatNumber(entry.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export const PaymentAnalysis: React.FC = () => {
  // Responsive hook
  const { isMobile, styles } = useResponsive()

  // State management
  const [selectedPeriod, setSelectedPeriod] = useState('lastMonth')
  const [activeView, setActiveView] = useState<'summary' | 'details'>('summary')
  const [searchQuery, setSearchQuery] = useState('')
  const [paymentModeFilter, setPaymentModeFilter] = useState('all')
  const [salesmanFilter, setSalesmanFilter] = useState('all')
  const [sortBy, setSortBy] = useState('payment_date')
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<PaymentData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Fetch payment data from API
  const fetchPaymentData = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        period: selectedPeriod,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortBy,
        sortOrder
      })

      if (paymentModeFilter !== 'all') params.append('paymentMode', paymentModeFilter)
      if (salesmanFilter !== 'all') params.append('salesman', salesmanFilter)
      if (searchQuery) params.append('search', searchQuery)

      const response = await fetch(`/api/payments/analytics?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || 'Failed to fetch payment data')
      }
    } catch (err) {
      console.error('Error fetching payment data:', err)
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchPaymentData()
  }, [selectedPeriod, currentPage, itemsPerPage, sortBy, sortOrder, paymentModeFilter, salesmanFilter])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery || searchQuery === '') {
        setCurrentPage(1)
        fetchPaymentData()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedPeriod, paymentModeFilter, salesmanFilter, itemsPerPage])

  // Calculate summary metrics
  const summaryCards = useMemo(() => {
    if (!data?.summary) return []

    const summary = data.summary

    return [
      {
        title: 'Total Collections',
        value: formatCurrency(summary.totalCollected),
        icon: DollarSign,
        color: businessColors.success.main
      },
      {
        title: 'Total Payments',
        value: formatNumber(summary.totalPayments),
        icon: Receipt,
        color: businessColors.primary[600]
      },
      {
        title: 'Average Payment',
        value: formatCurrency(summary.avgPayment),
        icon: CreditCard,
        color: businessColors.warning.main
      },
      {
        title: 'Unique Customers',
        value: formatNumber(summary.uniqueCustomers),
        icon: Users,
        color: businessColors.primary[700]
      }
    ]
  }, [data])

  // Get dynamic chart title based on selected period
  const getChartTitle = () => {
    switch (selectedPeriod) {
      case 'thisMonth': return 'This Month Collection Trend'
      case 'lastMonth': return 'Last Month Collection Trend'
      case 'thisQuarter': return 'This Quarter Collection Trend'
      case 'lastQuarter': return 'Last Quarter Collection Trend'
      case 'thisYear': return 'This Year Collection Trend'
      case 'thisWeek': return 'This Week Collection Trend'
      case 'lastWeek': return 'Last Week Collection Trend'
      case 'today': return 'Today Collection Trend'
      case 'yesterday': return 'Yesterday Collection Trend'
      default: return 'Collection Trend'
    }
  }

  // Get dynamic chart description based on selected period
  const getChartDescription = () => {
    switch (selectedPeriod) {
      case 'thisMonth':
      case 'lastMonth':
        return 'Daily payment collections showing amount received and number of payments processed'
      case 'thisQuarter':
      case 'lastQuarter':
        return 'Bi-weekly payment collections grouped by periods within the quarter'
      case 'thisYear':
        return 'Monthly payment collections throughout the year'
      case 'thisWeek':
      case 'lastWeek':
        return 'Daily payment collections for the selected week'
      case 'today':
      case 'yesterday':
        return 'Payment collection details for the selected day'
      default:
        return 'Payment collections over the selected time period'
    }
  }

  // Transform daily trend data based on selected period
  const trendChartData = useMemo(() => {
    if (!data?.trends?.daily || data.trends.daily.length === 0) return []

    const dailyData = data.trends.daily

    switch (selectedPeriod) {
      case 'thisMonth':
      case 'thisWeek':
      case 'lastWeek':
      case 'today':
      case 'yesterday':
        // Show daily data as-is
        return dailyData.map((item: any) => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          amount: item.amount,
          count: item.count,
          customers: item.customers,
          fullDate: item.date
        }))

      case 'lastMonth':
        // Group every 3 days to get approximately 10 points
        const lastMonthGrouped = []
        for (let i = 0; i < dailyData.length; i += 3) {
          const group = dailyData.slice(i, i + 3)
          const totalAmount = group.reduce((sum, item) => sum + item.amount, 0)
          const totalCount = group.reduce((sum, item) => sum + item.count, 0)
          const totalCustomers = group.reduce((sum, item) => sum + item.customers, 0)

          const startDate = new Date(group[0].date)
          const endDate = new Date(group[group.length - 1].date)

          lastMonthGrouped.push({
            date: `${startDate.getDate()}-${endDate.getDate()}`,
            amount: totalAmount,
            count: totalCount,
            customers: totalCustomers,
            fullDate: group[0].date
          })
        }
        return lastMonthGrouped

      case 'thisQuarter':
      case 'lastQuarter':
        // Group by bi-weekly periods (approximately 6 points for a quarter)
        const quarterGrouped = []
        const groupSize = Math.ceil(dailyData.length / 6) // Aim for 6 groups

        for (let i = 0; i < dailyData.length; i += groupSize) {
          const group = dailyData.slice(i, i + groupSize)
          if (group.length === 0) continue

          const totalAmount = group.reduce((sum, item) => sum + item.amount, 0)
          const totalCount = group.reduce((sum, item) => sum + item.count, 0)
          const totalCustomers = group.reduce((sum, item) => sum + item.customers, 0)

          const startDate = new Date(group[0].date)
          const endDate = new Date(group[group.length - 1].date)

          quarterGrouped.push({
            date: `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${Math.floor(i / groupSize) + 1}`,
            amount: totalAmount,
            count: totalCount,
            customers: totalCustomers,
            fullDate: group[0].date
          })
        }
        return quarterGrouped

      case 'thisYear':
        // Group by months
        const monthlyGrouped = new Map()

        dailyData.forEach((item: any) => {
          const date = new Date(item.date)
          const monthKey = `${date.getFullYear()}-${date.getMonth()}`
          const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

          if (!monthlyGrouped.has(monthKey)) {
            monthlyGrouped.set(monthKey, {
              date: monthLabel,
              amount: 0,
              count: 0,
              customers: 0,
              fullDate: item.date
            })
          }

          const existing = monthlyGrouped.get(monthKey)
          existing.amount += item.amount
          existing.count += item.count
          existing.customers += item.customers
        })

        return Array.from(monthlyGrouped.values()).sort((a, b) =>
          new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()
        )

      default:
        // Default to daily view
        return dailyData.map((item: any) => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          amount: item.amount,
          count: item.count,
          customers: item.customers,
          fullDate: item.date
        }))
    }
  }, [data, selectedPeriod])

  // Format payment modes data for pie chart
  const paymentModesData = useMemo(() => {
    if (!data?.distributions?.paymentModes) return []

    return data.distributions.paymentModes.map((mode: any) => ({
      name: mode.mode,
      value: mode.total,
      count: mode.count,
      percentage: parseFloat(mode.percentage)
    }))
  }, [data])

  // Format hourly distribution data
  const hourlyData = useMemo(() => {
    if (!data?.trends?.hourly || data.trends.hourly.length === 0) return []

    // Fill in missing hours with 0 values
    const hourMap = new Map(data.trends.hourly.map((h: any) => [h.hour, h]))
    const fullHourly = []

    for (let hour = 0; hour < 24; hour++) {
      const hourData = hourMap.get(hour)
      fullHourly.push({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count: hourData?.count || 0,
        amount: hourData?.amount || 0
      })
    }

    return fullHourly
  }, [data])

  // Get ALL salesmen for filter from the API response
  const uniqueSalesmen = useMemo(() => {
    if (!data?.allSalesmen) return []
    // Use allSalesmen which contains ALL salesmen with payment data for the period
    return data.allSalesmen.map((s: any) => ({
      code: s.code,
      name: s.name,
      paymentCount: s.paymentCount,
      totalCollected: s.totalCollected
    }))
  }, [data])

  const handlePaymentClick = (payment: PaymentData) => {
    setSelectedPayment(payment)
    setIsModalOpen(true)
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')
    } else {
      setSortBy(column)
      setSortOrder('DESC')
    }
  }

  // Print function that only prints the receipt modal
  const handlePrintReceipt = () => {
    // Create a print-specific element
    const printContent = document.getElementById('payment-receipt-modal')
    if (!printContent) return

    // Create a new window for printing
    const printWindow = window.open('', 'PRINT', 'height=600,width=800')
    if (!printWindow) return

    // Write the HTML content with proper styles
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${selectedPayment?.receiptNumber}</title>
          <style>
            @media print {
              body { margin: 0; font-family: Arial, sans-serif; }
              .no-print { display: none !important; }
            }
            body { font-family: Arial, sans-serif; padding: 20px; }
            .receipt-header { background: linear-gradient(to right, #3b82f6, #2563eb); color: white; padding: 24px; margin-bottom: 24px; }
            .receipt-title { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
            .receipt-number { color: #dbeafe; }
            .section { background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
            .section-title { font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .field { margin-bottom: 8px; }
            .label { font-size: 14px; color: #6b7280; margin-bottom: 4px; }
            .value { font-weight: 500; }
            .amount { font-size: 24px; font-weight: bold; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 14px; }
            .badge-cash { background: #06ffa5; color: #064e3b; }
            .badge-cheque { background: #00b4d8; color: white; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()

    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  // Export Top 20 Collectors to Excel
  const exportCollectorsToExcel = async () => {
    if (!data?.rankings?.topSalesmen || data.rankings.topSalesmen.length === 0) {
      alert('No collectors data available to export')
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Top 20 Collectors')

      // Set column widths
      worksheet.columns = [
        { width: 10 },  // Rank
        { width: 20 },  // Code
        { width: 30 },  // Name
        { width: 18 },  // Total Collected
        { width: 15 },  // Payment Count
        { width: 18 },  // Unique Customers
        { width: 18 }   // Avg Payment
      ]

      let currentRow = 1

      // Title
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`)
      const titleCell = worksheet.getCell(`A${currentRow}`)
      titleCell.value = 'Top 20 Collectors'
      titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4788' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      currentRow++

      // Period Info
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`)
      const periodCell = worksheet.getCell(`A${currentRow}`)
      const periodLabel = selectedPeriod === 'lastMonth' ? 'Last Month' : selectedPeriod === 'lastQuarter' ? 'Last Quarter' : selectedPeriod
      periodCell.value = `Period: ${periodLabel}`
      periodCell.font = { size: 12, bold: true }
      periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      periodCell.alignment = { horizontal: 'center', vertical: 'middle' }
      currentRow++

      currentRow++

      // Summary Statistics
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`)
      const summaryTitleCell = worksheet.getCell(`A${currentRow}`)
      summaryTitleCell.value = 'Summary Statistics'
      summaryTitleCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
      summaryTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7030A0' } }
      summaryTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      currentRow++

      const topCollectors = data.rankings.topSalesmen.slice(0, 20)
      const totalCollected = topCollectors.reduce((sum, s) => sum + parseFloat(s.totalCollected || 0), 0)
      const totalPayments = topCollectors.reduce((sum, s) => sum + parseInt(s.paymentCount || 0), 0)
      const totalCustomers = topCollectors.reduce((sum, s) => sum + parseInt(s.uniqueCustomers || 0), 0)

      const summaryStats = [
        ['Total Collectors:', topCollectors.length.toLocaleString(), 'Total Collections:', `AED ${(totalCollected / 1000).toFixed(2)}k`],
        ['Total Payments:', totalPayments.toLocaleString(), 'Total Customers:', totalCustomers.toLocaleString()]
      ]

      summaryStats.forEach(stats => {
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`)
        worksheet.getCell(`A${currentRow}`).value = stats[0]
        worksheet.getCell(`A${currentRow}`).font = { bold: true }
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        worksheet.mergeCells(`C${currentRow}:D${currentRow}`)
        worksheet.getCell(`C${currentRow}`).value = stats[1]
        worksheet.getCell(`C${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
        worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        worksheet.mergeCells(`E${currentRow}:F${currentRow}`)
        worksheet.getCell(`E${currentRow}`).value = stats[2]
        worksheet.getCell(`E${currentRow}`).font = { bold: true }
        worksheet.getCell(`E${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        worksheet.getCell(`G${currentRow}`).value = stats[3]
        worksheet.getCell(`G${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
        worksheet.getCell(`G${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        currentRow++
      })

      currentRow++

      // Table Header
      const headers = ['Rank', 'Code', 'Name', 'Total Collected (AED)', 'Payment Count', 'Unique Customers', 'Avg Payment (AED)']
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1)
        cell.value = header
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4788' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
      currentRow++

      // Data Rows
      topCollectors.forEach((salesman, index) => {
        const row = worksheet.getRow(currentRow)

        row.getCell(1).value = index + 1
        row.getCell(2).value = salesman.code || ''
        row.getCell(3).value = salesman.name || ''
        row.getCell(4).value = parseFloat(salesman.totalCollected || 0)
        row.getCell(4).numFmt = '#,##0.00'
        row.getCell(5).value = parseInt(salesman.paymentCount || 0)
        row.getCell(5).numFmt = '#,##0'
        row.getCell(6).value = parseInt(salesman.uniqueCustomers || 0)
        row.getCell(6).numFmt = '#,##0'
        row.getCell(7).value = parseFloat(salesman.avgPayment || 0)
        row.getCell(7).numFmt = '#,##0.00'

        // Alternating row colors
        const fillColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA'
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
          cell.alignment = { vertical: 'middle' }
        })

        // Highlight top 3
        if (index < 3) {
          row.getCell(1).font = { bold: true, color: { argb: index === 0 ? 'FFD4AF37' : index === 1 ? 'FFC0C0C0' : 'FFCD7F32' } }
          row.getCell(3).font = { bold: true }
        }

        currentRow++
      })

      // Footer with totals
      currentRow++
      worksheet.mergeCells(`A${currentRow}:C${currentRow}`)
      const footerCell = worksheet.getCell(`A${currentRow}`)
      footerCell.value = `Total: ${topCollectors.length} collectors`
      footerCell.font = { bold: true, size: 12 }
      footerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      footerCell.alignment = { horizontal: 'center', vertical: 'middle' }

      worksheet.getCell(`D${currentRow}`).value = totalCollected
      worksheet.getCell(`D${currentRow}`).numFmt = '#,##0.00'
      worksheet.getCell(`D${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
      worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      worksheet.getCell(`D${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' }

      worksheet.getCell(`E${currentRow}`).value = totalPayments
      worksheet.getCell(`E${currentRow}`).numFmt = '#,##0'
      worksheet.getCell(`E${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
      worksheet.getCell(`E${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      worksheet.getCell(`E${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' }

      worksheet.getCell(`F${currentRow}`).value = totalCustomers
      worksheet.getCell(`F${currentRow}`).numFmt = '#,##0'
      worksheet.getCell(`F${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
      worksheet.getCell(`F${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' }

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Top_20_Collectors_${periodLabel.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting collectors to Excel:', error)
      alert('Failed to export collectors. Please try again.')
    }
  }

  // Export Top 20 Paying Customers to Excel
  const exportPayingCustomersToExcel = async () => {
    if (!data?.rankings?.topCustomers || data.rankings.topCustomers.length === 0) {
      alert('No customers data available to export')
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Top 20 Paying Customers')

      // Set column widths
      worksheet.columns = [
        { width: 10 },  // Rank
        { width: 20 },  // Code
        { width: 35 },  // Name
        { width: 18 },  // Total Paid
        { width: 15 },  // Payment Count
        { width: 15 },  // Payment Days
        { width: 20 }   // Payment Modes
      ]

      let currentRow = 1

      // Title
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`)
      const titleCell = worksheet.getCell(`A${currentRow}`)
      titleCell.value = 'Top 20 Paying Customers'
      titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4788' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      currentRow++

      // Period Info
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`)
      const periodCell = worksheet.getCell(`A${currentRow}`)
      const periodLabel = selectedPeriod === 'lastMonth' ? 'Last Month' : selectedPeriod === 'lastQuarter' ? 'Last Quarter' : selectedPeriod
      periodCell.value = `Period: ${periodLabel}`
      periodCell.font = { size: 12, bold: true }
      periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      periodCell.alignment = { horizontal: 'center', vertical: 'middle' }
      currentRow++

      currentRow++

      // Summary Statistics
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`)
      const summaryTitleCell = worksheet.getCell(`A${currentRow}`)
      summaryTitleCell.value = 'Summary Statistics'
      summaryTitleCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
      summaryTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7030A0' } }
      summaryTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      currentRow++

      const topCustomers = data.rankings.topCustomers.slice(0, 20)
      const totalPaid = topCustomers.reduce((sum, c) => sum + parseFloat(c.totalPaid || 0), 0)
      const totalPayments = topCustomers.reduce((sum, c) => sum + parseInt(c.paymentCount || 0), 0)
      const totalDays = topCustomers.reduce((sum, c) => sum + parseInt(c.paymentDays || 0), 0)

      const summaryStats = [
        ['Total Customers:', topCustomers.length.toLocaleString(), 'Total Paid:', `AED ${(totalPaid / 1000).toFixed(2)}k`],
        ['Total Payments:', totalPayments.toLocaleString(), 'Total Payment Days:', totalDays.toLocaleString()]
      ]

      summaryStats.forEach(stats => {
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`)
        worksheet.getCell(`A${currentRow}`).value = stats[0]
        worksheet.getCell(`A${currentRow}`).font = { bold: true }
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        worksheet.mergeCells(`C${currentRow}:D${currentRow}`)
        worksheet.getCell(`C${currentRow}`).value = stats[1]
        worksheet.getCell(`C${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
        worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        worksheet.mergeCells(`E${currentRow}:F${currentRow}`)
        worksheet.getCell(`E${currentRow}`).value = stats[2]
        worksheet.getCell(`E${currentRow}`).font = { bold: true }
        worksheet.getCell(`E${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        worksheet.getCell(`G${currentRow}`).value = stats[3]
        worksheet.getCell(`G${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
        worksheet.getCell(`G${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        currentRow++
      })

      currentRow++

      // Table Header
      const headers = ['Rank', 'Code', 'Name', 'Total Paid (AED)', 'Payment Count', 'Payment Days', 'Payment Modes']
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1)
        cell.value = header
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4788' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
      currentRow++

      // Data Rows
      topCustomers.forEach((customer, index) => {
        const row = worksheet.getRow(currentRow)

        row.getCell(1).value = index + 1
        row.getCell(2).value = customer.code || ''
        row.getCell(3).value = customer.name || ''
        row.getCell(4).value = parseFloat(customer.totalPaid || 0)
        row.getCell(4).numFmt = '#,##0.00'
        row.getCell(5).value = parseInt(customer.paymentCount || 0)
        row.getCell(5).numFmt = '#,##0'
        row.getCell(6).value = parseInt(customer.paymentDays || 0)
        row.getCell(6).numFmt = '#,##0'
        row.getCell(7).value = customer.paymentModes || ''

        // Alternating row colors
        const fillColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA'
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
          cell.alignment = { vertical: 'middle' }
        })

        // Highlight top 3
        if (index < 3) {
          row.getCell(1).font = { bold: true, color: { argb: index === 0 ? 'FFD4AF37' : index === 1 ? 'FFC0C0C0' : 'FFCD7F32' } }
          row.getCell(3).font = { bold: true }
        }

        currentRow++
      })

      // Footer with totals
      currentRow++
      worksheet.mergeCells(`A${currentRow}:C${currentRow}`)
      const footerCell = worksheet.getCell(`A${currentRow}`)
      footerCell.value = `Total: ${topCustomers.length} customers`
      footerCell.font = { bold: true, size: 12 }
      footerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      footerCell.alignment = { horizontal: 'center', vertical: 'middle' }

      worksheet.getCell(`D${currentRow}`).value = totalPaid
      worksheet.getCell(`D${currentRow}`).numFmt = '#,##0.00'
      worksheet.getCell(`D${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
      worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      worksheet.getCell(`D${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' }

      worksheet.getCell(`E${currentRow}`).value = totalPayments
      worksheet.getCell(`E${currentRow}`).numFmt = '#,##0'
      worksheet.getCell(`E${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
      worksheet.getCell(`E${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      worksheet.getCell(`E${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' }

      worksheet.getCell(`F${currentRow}`).value = totalDays
      worksheet.getCell(`F${currentRow}`).numFmt = '#,##0'
      worksheet.getCell(`F${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
      worksheet.getCell(`F${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' }

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Top_20_Paying_Customers_${periodLabel.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting customers to Excel:', error)
      alert('Failed to export customers. Please try again.')
    }
  }

  // Export Payment Details to Excel
  const exportPaymentDetailsToExcel = async () => {
    try {
      // Fetch ALL payments with current filters (bypass pagination)
      const params = new URLSearchParams({
        period: selectedPeriod,
        page: '1',
        limit: '100000', // Get all records
        sortBy,
        sortOrder
      })

      if (paymentModeFilter !== 'all') params.append('paymentMode', paymentModeFilter)
      if (salesmanFilter !== 'all') params.append('salesman', salesmanFilter)
      if (searchQuery) params.append('search', searchQuery)

      const response = await fetch(`/api/payments/analytics?${params}`)
      const result = await response.json()

      if (!result.success || !result.data.payments) {
        alert('No payment data available to export')
        return
      }

      const allPayments = result.data.payments
      const totalAmount = allPayments.reduce((sum: number, p: PaymentData) => sum + parseFloat(p.totalAmount?.toString() || '0'), 0)

      // Create workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Payment Details')

      // Set column widths
      worksheet.columns = [
        { width: 15 },  // Date
        { width: 18 },  // Receipt Number
        { width: 30 },  // Customer Name
        { width: 15 },  // Customer Code
        { width: 12 },  // Payment Mode
        { width: 12 },  // Payment Type
        { width: 15 },  // Total Amount
        { width: 20 },  // Bank Name
        { width: 18 },  // Cheque Number
        { width: 15 },  // Cheque Date
        { width: 12 },  // Invoice Count
        { width: 25 },  // Salesman Name
        { width: 15 }   // Salesman Code
      ]

      let currentRow = 1

      // Title
      worksheet.mergeCells(`A${currentRow}:M${currentRow}`)
      const titleCell = worksheet.getCell(`A${currentRow}`)
      titleCell.value = 'Payment Details Report'
      titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4788' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      currentRow++

      // Period Info
      worksheet.mergeCells(`A${currentRow}:M${currentRow}`)
      const periodCell = worksheet.getCell(`A${currentRow}`)
      const periodLabel = selectedPeriod === 'lastMonth' ? 'Last Month' : selectedPeriod === 'lastQuarter' ? 'Last Quarter' : selectedPeriod
      periodCell.value = `Period: ${periodLabel}`
      periodCell.font = { size: 12, bold: true }
      periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      periodCell.alignment = { horizontal: 'center', vertical: 'middle' }
      currentRow++

      // Active Filters Section
      const activeFilters = []
      if (searchQuery) activeFilters.push(`Search: "${searchQuery}"`)
      if (paymentModeFilter !== 'all') activeFilters.push(`Payment Mode: ${paymentModeFilter}`)
      if (salesmanFilter !== 'all') {
        const salesmanName = uniqueSalesmen.find((s: any) => s.code === salesmanFilter)?.name || salesmanFilter
        activeFilters.push(`Salesman: ${salesmanName}`)
      }

      if (activeFilters.length > 0) {
        worksheet.mergeCells(`A${currentRow}:M${currentRow}`)
        const filtersCell = worksheet.getCell(`A${currentRow}`)
        filtersCell.value = 'Active Filters: ' + activeFilters.join(' | ')
        filtersCell.font = { size: 10, italic: true, color: { argb: 'FF0066CC' } }
        filtersCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBE5F1' } }
        filtersCell.alignment = { horizontal: 'left', vertical: 'middle' }
        currentRow++
      }

      currentRow++

      // Summary Statistics
      worksheet.mergeCells(`A${currentRow}:M${currentRow}`)
      const summaryTitleCell = worksheet.getCell(`A${currentRow}`)
      summaryTitleCell.value = 'Summary Statistics'
      summaryTitleCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
      summaryTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7030A0' } }
      summaryTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      currentRow++

      const avgPayment = allPayments.length > 0 ? totalAmount / allPayments.length : 0

      const summaryStats = [
        ['Total Payments:', allPayments.length.toLocaleString(), 'Total Amount:', `AED ${(totalAmount / 1000).toFixed(2)}k`],
        ['Average Payment:', `AED ${avgPayment.toFixed(2)}`, 'Date Exported:', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })]
      ]

      summaryStats.forEach(stats => {
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`)
        worksheet.getCell(`A${currentRow}`).value = stats[0]
        worksheet.getCell(`A${currentRow}`).font = { bold: true }
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        worksheet.mergeCells(`D${currentRow}:F${currentRow}`)
        worksheet.getCell(`D${currentRow}`).value = stats[1]
        worksheet.getCell(`D${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
        worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        worksheet.mergeCells(`G${currentRow}:I${currentRow}`)
        worksheet.getCell(`G${currentRow}`).value = stats[2]
        worksheet.getCell(`G${currentRow}`).font = { bold: true }
        worksheet.getCell(`G${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        worksheet.mergeCells(`J${currentRow}:M${currentRow}`)
        worksheet.getCell(`J${currentRow}`).value = stats[3]
        worksheet.getCell(`J${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
        worksheet.getCell(`J${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        currentRow++
      })

      currentRow++

      // Table Header
      const headers = ['Date', 'Receipt Number', 'Customer Name', 'Customer Code', 'Payment Mode', 'Payment Type', 'Total Amount (AED)', 'Bank Name', 'Cheque Number', 'Cheque Date', 'Invoice Count', 'Salesman Name', 'Salesman Code']
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1)
        cell.value = header
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4788' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
      currentRow++

      // Data Rows
      allPayments.forEach((payment: PaymentData, index: number) => {
        const row = worksheet.getRow(currentRow)

        // Format date
        const paymentDate = payment.paymentDate ? new Date(payment.paymentDate + 'T12:00:00').toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) : '-'

        const chequeDate = payment.chequeDate ? new Date(payment.chequeDate + 'T12:00:00').toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) : '-'

        row.getCell(1).value = paymentDate
        row.getCell(2).value = payment.receiptNumber || ''
        row.getCell(3).value = payment.customerName || ''
        row.getCell(4).value = payment.customerCode || ''
        row.getCell(5).value = payment.paymentMode || ''
        row.getCell(6).value = payment.paymentType || ''
        row.getCell(7).value = parseFloat(payment.totalAmount?.toString() || '0')
        row.getCell(7).numFmt = '#,##0.00'
        row.getCell(8).value = payment.bankName || '-'
        row.getCell(9).value = payment.chequeNumber || '-'
        row.getCell(10).value = chequeDate
        row.getCell(11).value = payment.invoiceCount || 0
        row.getCell(12).value = payment.salesmanName || '-'
        row.getCell(13).value = payment.salesmanCode || '-'

        // Alternating row colors
        const fillColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA'
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
          cell.alignment = { vertical: 'middle' }
        })

        currentRow++
      })

      // Footer with totals
      currentRow++
      worksheet.mergeCells(`A${currentRow}:F${currentRow}`)
      const footerCell = worksheet.getCell(`A${currentRow}`)
      footerCell.value = `Total: ${allPayments.length} payments`
      footerCell.font = { bold: true, size: 12 }
      footerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      footerCell.alignment = { horizontal: 'center', vertical: 'middle' }

      worksheet.getCell(`G${currentRow}`).value = totalAmount
      worksheet.getCell(`G${currentRow}`).numFmt = '#,##0.00'
      worksheet.getCell(`G${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
      worksheet.getCell(`G${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      worksheet.getCell(`G${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' }

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Payment_Details_Report_${periodLabel.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting payment details to Excel:', error)
      alert('Failed to export payment details. Please try again.')
    }
  }

  return (
    <div className={`${isMobile ? 'p-4' : 'p-6'} space-y-6 bg-gray-50`}>
      {/* Header Section */}
      <div className={`flex ${isMobile ? 'flex-col gap-4' : 'justify-between items-center'}`}>
        <div>
          <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>Payment Analytics</h1>
          <p className={`text-gray-500 ${isMobile ? 'text-sm' : ''} mt-1`}>Track and analyze payment collections</p>
        </div>
        <div className={`flex gap-2 ${isMobile ? 'w-full flex-col' : ''}`}>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className={isMobile ? 'w-full' : 'w-40'}>
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" disabled>Today</SelectItem>
              <SelectItem value="yesterday" disabled>Yesterday</SelectItem>
              <SelectItem value="thisWeek" disabled>This Week</SelectItem>
              <SelectItem value="lastWeek" disabled>Last Week</SelectItem>
              <SelectItem value="thisMonth" disabled>This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="thisQuarter" disabled>This Quarter</SelectItem>
              <SelectItem value="lastQuarter">Last Quarter</SelectItem>
              <SelectItem value="thisYear" disabled>This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchPaymentData} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="details">Payment Details</TabsTrigger>
        </TabsList>

        {/* Summary View */}
        <TabsContent value="summary" className="space-y-6">
          {/* Summary Cards */}
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'} gap-4`}>
            {summaryCards.map((card, index) => {
              const Icon = card.icon
              return (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      {card.title}
                    </CardTitle>
                    <Icon className="h-4 w-4" style={{ color: card.color }} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{card.value}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Charts Row 1 */}
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-6`}>
            {/* Dynamic Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{getChartTitle()}</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {getChartDescription()}
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      iconType="line"
                      wrapperStyle={{ paddingBottom: '20px' }}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="amount"
                      stroke={businessColors.primary[600]}
                      fill={CHART_COLORS.accent}
                      strokeWidth={2}
                      name="Collection Amount (AED)"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="count"
                      stroke={businessColors.success.main}
                      fill="transparent"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Number of Payments"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-2 bg-gradient-to-r from-sky-200 to-sky-500 rounded"></div>
                    <span className="text-gray-600">Collection Amount (Left Axis)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-green-500 rounded" style={{borderTop: '2px dashed #06ffa5'}}></div>
                    <span className="text-gray-600">Payment Count (Right Axis)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Modes Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Modes Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentModesData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ percentage }) => `${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {paymentModesData.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PAYMENT_MODE_COLORS[entry.name as keyof typeof PAYMENT_MODE_COLORS] || businessColors.primary[400]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-6`}>
            {/* Top Salesmen - Show 20 */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Top 20 Collectors</CardTitle>
                  <Button
                    onClick={exportCollectorsToExcel}
                    disabled={!data?.rankings?.topSalesmen || data.rankings.topSalesmen.length === 0}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {data?.rankings?.topSalesmen?.slice(0, 20).map((salesman: any, index: number) => (
                    <div key={salesman.code} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          index === 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          index === 1 ? 'bg-slate-50 text-slate-700 border border-slate-200' :
                          index === 2 ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                          'bg-gray-50 text-gray-600 border border-gray-200'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{salesman.name}</p>
                          <p className="text-xs text-gray-500">{salesman.paymentCount} payments • {salesman.uniqueCustomers} customers</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{formatCurrency(salesman.totalCollected)}</p>
                        <p className="text-xs text-gray-500">Avg: {formatCurrency(salesman.avgPayment)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Customers - Show 20 */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Top 20 Paying Customers</CardTitle>
                  <Button
                    onClick={exportPayingCustomersToExcel}
                    disabled={!data?.rankings?.topCustomers || data.rankings.topCustomers.length === 0}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {data?.rankings?.topCustomers?.slice(0, 20).map((customer: any, index: number) => (
                    <div key={customer.code} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          index === 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          index === 1 ? 'bg-slate-50 text-slate-700 border border-slate-200' :
                          index === 2 ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                          'bg-gray-50 text-gray-600 border border-gray-200'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm truncate">{customer.name}</p>
                          <p className="text-xs text-gray-500">{customer.paymentCount} payments • {customer.paymentDays} days</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{formatCurrency(customer.totalPaid)}</p>
                        <Badge variant="outline" className="text-xs">
                          {customer.paymentModes}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hourly Distribution (if available) */}
          {hourlyData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Hourly Payment Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="amount" fill={businessColors.primary[600]} name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Payment Details View */}
        <TabsContent value="details" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by customer, receipt, cheque..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={paymentModeFilter} onValueChange={setPaymentModeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Payment Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={salesmanFilter} onValueChange={setSalesmanFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Salesman" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    <SelectItem value="all">All Salesmen ({uniqueSalesmen.length})</SelectItem>
                    {uniqueSalesmen.length > 0 ? (
                      uniqueSalesmen.map((s: any) => (
                        <SelectItem key={s.code} value={s.code} title={`${s.paymentCount} payments - ${formatCurrency(s.totalCollected)}`}>
                          <div className="flex items-center justify-between w-full">
                            <span className="truncate mr-2">{s.name}</span>
                            <span className="text-xs text-gray-500">({s.paymentCount})</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No salesmen found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(parseInt(v))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={exportPaymentDetailsToExcel}
                  disabled={!data?.payments || data.payments.length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payments Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('payment_date')}>
                        Date {sortBy === 'payment_date' && (sortOrder === 'DESC' ? '↓' : '↑')}
                      </TableHead>
                      <TableHead>Receipt #</TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('customer_name')}>
                        Customer {sortBy === 'customer_name' && (sortOrder === 'DESC' ? '↓' : '↑')}
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-gray-50" onClick={() => handleSort('total_amount')}>
                        Amount {sortBy === 'total_amount' && (sortOrder === 'DESC' ? '↓' : '↑')}
                      </TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Salesman</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                            Loading payments...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : error ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-red-500">
                          {error}
                        </TableCell>
                      </TableRow>
                    ) : data?.payments?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          No payments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.payments?.map((payment: PaymentData) => (
                        <TableRow key={payment.paymentId} className="hover:bg-gray-50">
                          <TableCell>
                            {payment.paymentDate ? new Date(payment.paymentDate + 'T12:00:00').toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : '-'}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{payment.receiptNumber}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{payment.customerName}</p>
                              <p className="text-xs text-gray-500">{payment.customerCode}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold">
                            {formatCurrency(payment.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="font-medium"
                              style={{
                                borderColor: PAYMENT_MODE_COLORS[payment.paymentMode as keyof typeof PAYMENT_MODE_COLORS] || '#718096',
                                color: PAYMENT_MODE_COLORS[payment.paymentMode as keyof typeof PAYMENT_MODE_COLORS] || '#718096'
                              }}
                            >
                              {payment.paymentMode || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {payment.salesmanName ? (
                              <div>
                                <p className="text-sm">{payment.salesmanName}</p>
                                <p className="text-xs text-gray-500">{payment.salesmanCode}</p>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePaymentClick(payment)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {data?.pagination && (
                <div className="flex items-center justify-between p-4 border-t">
                  <div className="text-sm text-gray-500">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, data.pagination.totalCount)} of {data.pagination.totalCount} payments
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={!data.pagination.hasPrev}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                        const pageNum = currentPage - 2 + i
                        if (pageNum < 1 || pageNum > data.pagination.totalPages) return null
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === currentPage ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        )
                      }).filter(Boolean)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(data.pagination.totalPages, p + 1))}
                      disabled={!data.pagination.hasNext}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Professional Payment Details Modal */}
      {isModalOpen && selectedPayment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden border border-gray-200">
            <div id="payment-receipt-modal">
              {/* Enhanced Modal Header */}
              <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-4 text-white receipt-header relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-4 right-4 w-32 h-32 border border-white/20 rounded-full"></div>
                  <div className="absolute bottom-4 left-4 w-24 h-24 border border-white/20 rounded-full"></div>
                </div>
                <div className="relative flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                      <Receipt className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold mb-1 tracking-tight">Payment Receipt</h2>
                      <p className="text-slate-200 text-base font-medium">#{selectedPayment.receiptNumber}</p>
                      <p className="text-slate-300 text-xs mt-1">
                        {selectedPayment.paymentDate ? new Date(selectedPayment.paymentDate + 'T12:00:00').toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : '-'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                    className="text-white hover:bg-white/20 no-print transition-all duration-200 rounded-xl"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

            {/* Enhanced Modal Body */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(85vh-160px)]">

              {/* Payment Summary Card - Prominent */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-xl">
                      <DollarSign className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Payment Summary</h3>
                  </div>
                  <Badge
                    variant="default"
                    className="text-sm px-4 py-2 font-semibold rounded-full"
                    style={{
                      backgroundColor: PAYMENT_MODE_COLORS[selectedPayment.paymentMode as keyof typeof PAYMENT_MODE_COLORS] || '#718096',
                    }}
                  >
                    {selectedPayment.paymentMode || 'Unknown'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-sm">
                    <p className="text-sm font-medium text-emerald-600 mb-2">Total Amount</p>
                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(selectedPayment.totalAmount)}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-emerald-100 shadow-sm">
                    <p className="text-sm font-medium text-emerald-600 mb-2">Payment Date</p>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-5 h-5 text-emerald-500" />
                      <div>
                        <p className="font-bold text-gray-900">
                          {selectedPayment.paymentDate ? new Date(selectedPayment.paymentDate + 'T12:00:00').toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : '-'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {selectedPayment.paymentDate ? new Date(selectedPayment.paymentDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedPayment.paymentType && selectedPayment.paymentType !== 'Standard' && (
                  <div className="mt-3 bg-white rounded-xl p-3 border border-emerald-100 shadow-sm">
                    <p className="text-sm font-medium text-emerald-600 mb-1">Payment Type</p>
                    <p className="font-semibold text-gray-900">{selectedPayment.paymentType}</p>
                  </div>
                )}
              </div>

              {/* Customer Information */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-100 p-2 rounded-xl">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Customer Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-3 border border-blue-100 shadow-sm">
                    <p className="text-sm font-medium text-blue-600 mb-2">Customer Name</p>
                    <p className="text-lg font-bold text-gray-900">{selectedPayment.customerName}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-blue-100 shadow-sm">
                    <p className="text-sm font-medium text-blue-600 mb-2">Customer Code</p>
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-blue-500" />
                      <p className="font-mono text-lg font-bold text-gray-900">{selectedPayment.customerCode}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cheque Details (if applicable) */}
              {selectedPayment.paymentMode === 'CHEQUE' && (
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-amber-100 p-2 rounded-xl">
                      <FileCheck className="w-6 h-6 text-amber-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Cheque Details</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-3 border border-amber-100 shadow-sm">
                      <p className="text-sm font-medium text-amber-600 mb-2">Cheque Number</p>
                      <p className="font-mono text-lg font-bold text-gray-900">{selectedPayment.chequeNumber || 'N/A'}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-amber-100 shadow-sm">
                      <p className="text-sm font-medium text-amber-600 mb-2">Cheque Date</p>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-amber-500" />
                        <p className="font-bold text-gray-900">
                          {selectedPayment.chequeDate
                            ? new Date(selectedPayment.chequeDate + 'T12:00:00').toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="col-span-1 md:col-span-2 bg-white rounded-xl p-3 border border-amber-100 shadow-sm">
                      <p className="text-sm font-medium text-amber-600 mb-2">Bank Name</p>
                      <div className="flex items-center gap-2">
                        <Building className="w-5 h-5 text-amber-500" />
                        <p className="text-lg font-bold text-gray-900">{selectedPayment.bankName || 'Not Specified'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Invoice Information */}
              {selectedPayment.invoiceNumbers && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-green-100 p-2 rounded-xl">
                      <FileText className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Invoice Details</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl p-3 border border-green-100 shadow-sm">
                      <p className="text-sm font-medium text-green-600 mb-3">Invoice Numbers</p>
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <p className="font-mono text-sm font-medium text-gray-900 break-all">
                          {selectedPayment.invoiceNumbers}
                        </p>
                      </div>
                    </div>
                    {selectedPayment.invoiceCount && (
                      <div className="bg-white rounded-xl p-3 border border-green-100 shadow-sm">
                        <p className="text-sm font-medium text-green-600 mb-2">Invoice Count</p>
                        <Badge variant="secondary" className="px-4 py-2 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                          {selectedPayment.invoiceCount} Invoice{selectedPayment.invoiceCount > 1 ? 's' : ''}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Collection By */}
              {selectedPayment.salesmanName && (
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-purple-100 p-2 rounded-xl">
                      <UserCheck className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Collected By</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-3 border border-purple-100 shadow-sm">
                      <p className="text-sm font-medium text-purple-600 mb-2">Salesman Name</p>
                      <p className="text-lg font-bold text-gray-900">{selectedPayment.salesmanName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Hash className="w-4 h-4 text-purple-500" />
                        <p className="font-mono text-sm text-gray-600">{selectedPayment.salesmanCode}</p>
                      </div>
                    </div>
                    {selectedPayment.createdDate && (
                      <div className="bg-white rounded-xl p-3 border border-purple-100 shadow-sm">
                        <p className="text-sm font-medium text-purple-600 mb-2">Recorded Date</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-purple-500" />
                          <div>
                            <p className="font-bold text-gray-900">
                              {new Date(selectedPayment.createdDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(selectedPayment.createdDate).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            </div>

            {/* Enhanced Modal Footer */}
            <div className="border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 p-4 flex justify-between items-center no-print">
              <div className="text-sm text-gray-500">
                <p>Receipt generated on {new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 font-medium border-gray-300 text-gray-700 hover:bg-gray-50 transition-all duration-200 rounded-xl"
                >
                  Close
                </Button>
                <Button
                  onClick={handlePrintReceipt}
                  className="px-6 py-2 font-medium bg-slate-800 hover:bg-slate-900 text-white transition-all duration-200 rounded-xl shadow-lg hover:shadow-xl"
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Print Receipt
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}