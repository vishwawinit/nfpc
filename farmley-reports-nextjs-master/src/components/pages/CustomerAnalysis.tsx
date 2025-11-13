'use client'
import { businessColors } from '@/styles/businessColors'
import React, { useState, useMemo, useCallback } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LabelList } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCustomerAnalytics } from '@/hooks/useDataService'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { CustomerDetailsModal } from '@/components/CustomerDetailsModal'
import { CustomerOrdersModal } from '@/components/CustomerOrdersModal'
import { DaywiseLedger } from '@/components/DaywiseLedger'
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, Download, HelpCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useResponsive } from '@/hooks/useResponsive'
import ExcelJS from 'exceljs'

// Color palette for charts
const CHART_COLORS = {
  primary: '#00b4d8',
  secondary: '#0077b6',
  accent: '#90e0ef',
  warning: '#ffd60a',
  danger: '#ef476f',
  success: '#06ffa5',
  info: '#118ab2'
}

const CLASSIFICATION_COLORS = {
  'VIP Account': '#1d4ed8',      // Royal blue - professional & prestigious (highest sales tier)
  'Key Account': '#9333ea',      // Rich purple for Key accounts
  'A Class': '#0ea5e9',         // Sky blue for A Class
  'B Class': '#10b981',         // Green for B Class
  'C Class': '#ef4444',         // Red for C Class
  'New Customer': '#94a3b8'     // Slate for New
}

export const CustomerAnalysis: React.FC = () => {
  // Responsive hook
  const { isMobile, styles } = useResponsive()

  // Date range and view state
  const [selectedPeriod, setSelectedPeriod] = useState('lastMonth')
  const [activeView, setActiveView] = useState<'summary' | 'detailed' | 'daywise'>('summary')

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [classificationFilter, setClassificationFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Sorting state
  const [sortBy, setSortBy] = useState('sales')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Modal state
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [ordersModalOpen, setOrdersModalOpen] = useState(false)
  const [selectedCustomerForOrders, setSelectedCustomerForOrders] = useState<any>(null)

  // Filter options state
  const [filterOptions, setFilterOptions] = useState<{
    regions: Array<{ code: string; name: string }>;
    salesmen: Array<{ code: string; name: string }>;
    routes: Array<{ code: string; name: string }>;
  }>({
    regions: [],
    salesmen: [],
    routes: []
  })

  // Debounced search to avoid too many API calls
  const [debouncedSearch, setDebouncedSearch] = useState('')

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch filter options when date range or region changes
  React.useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const params = new URLSearchParams()
        params.append('range', selectedPeriod)
        if (regionFilter !== 'all') {
          params.append('region', regionFilter)
        }

        const response = await fetch(`/api/customers/filters?${params.toString()}`)
        const result = await response.json()

        if (result.success) {
          setFilterOptions({
            regions: result.regions || [],
            salesmen: result.salesmen || [],
            routes: result.routes || []
          })
        }
      } catch (error) {
        console.error('Error fetching filter options:', error)
      }
    }

    fetchFilterOptions()
  }, [selectedPeriod, regionFilter])

  // Build filters object for API
  const apiFilters = useMemo(() => ({
    classification: classificationFilter !== 'all' ? classificationFilter : undefined,
    region: regionFilter !== 'all' ? regionFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: debouncedSearch || undefined,
  }), [classificationFilter, regionFilter, typeFilter, statusFilter, debouncedSearch])

  // Fetch real customer analytics data from API with all filters and pagination
  const { data: analyticsData, loading, error, refresh } = useCustomerAnalytics(
    selectedPeriod,
    apiFilters,
    { page: currentPage, limit: itemsPerPage }
  )

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [selectedPeriod, classificationFilter, regionFilter, typeFilter, statusFilter, debouncedSearch, itemsPerPage])

  // Process and filter customer data
  const processedData = useMemo(() => {
    if (!analyticsData) {
      return {
        metrics: {
          totalCustomers: 0,
          activeCustomers: 0,
          totalSales: 0,
          totalOrders: 0,
          avgOrderValue: 0,
          totalOutstanding: 0
        },
        salesByChannel: [],
        customerClassification: [],
        abcAnalysis: [],
        topCustomers: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 0,
          pageSize: 25,
          hasNextPage: false,
          hasPrevPage: false,
          showing: '0 results'
        }
      }
    }

    // Apply client-side sorting to topCustomers
    const sortedCustomers = (analyticsData.topCustomers || []).slice().sort((a, b) => {
      let aValue, bValue

      switch (sortBy) {
        case 'sales':
          aValue = a.totalSales || 0
          bValue = b.totalSales || 0
          break
        case 'orders':
          aValue = a.orderCount || 0
          bValue = b.orderCount || 0
          break
        case 'aov':
          aValue = a.avgOrderValue || 0
          bValue = b.avgOrderValue || 0
          break
        case 'outstanding':
          aValue = a.outstandingAmount || (a.totalSales * 0.15) || 0
          bValue = b.outstandingAmount || (b.totalSales * 0.15) || 0
          break
        default:
          aValue = a.totalSales || 0
          bValue = b.totalSales || 0
      }

      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue
    })

    return {
      metrics: analyticsData.metrics || {},
      salesByChannel: analyticsData.salesByChannel || [],
      customerClassification: analyticsData.customerClassification || [],
      abcAnalysis: analyticsData.abcAnalysis || [],
      topCustomers: sortedCustomers,
      pagination: analyticsData.pagination || {
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        pageSize: 25,
        hasNextPage: false,
        hasPrevPage: false,
        showing: '0 results'
      }
    }
  }, [analyticsData, sortBy, sortOrder])

  // Get currency code from API data
  const getCurrency = () => {
    return processedData.metrics?.currencyCode || 'AED'
  }

  const formatValue = (value: number, currencyCode?: string) => {
    const currency = currencyCode || getCurrency()
    if (value >= 1000000) return `${currency} ${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${currency} ${(value / 1000).toFixed(0)}k`
    return `${currency} ${value.toFixed(0)}`
  }

  // Convert classification data for pie chart - FIXED to show sales contribution %
  const pieChartData = useMemo(() => {
    if (!processedData.customerClassification.length) return []

    const totalSales = processedData.customerClassification.reduce((sum, item) => sum + item.totalSales, 0)

    return processedData.customerClassification.map(item => ({
      name: item.classification,
      value: totalSales > 0 ? (item.totalSales / totalSales * 100) : 0,  // FIXED: Now shows sales contribution %
      count: item.customerCount,
      sales: item.totalSales
    }))
  }, [processedData.customerClassification])

  // Customer aging/recency analysis data
  const customerAgingData = useMemo(() => {
    if (!processedData.topCustomers || processedData.topCustomers.length === 0) {
      return []
    }

    const categories = {
      'No Orders': { count: 0, totalSales: 0, customers: [] as any[] },
      'Active (≤7 days)': { count: 0, totalSales: 0, customers: [] as any[] },
      'Regular (7-30 days)': { count: 0, totalSales: 0, customers: [] as any[] },
      'At-Risk (30-60 days)': { count: 0, totalSales: 0, customers: [] as any[] },
      'Dormant (>60 days)': { count: 0, totalSales: 0, customers: [] as any[] }
    }

    processedData.topCustomers.forEach(customer => {
      const days = customer.daysSinceLastOrder

      if (days === null || days === undefined || customer.orderCount === 0) {
        categories['No Orders'].count++
        categories['No Orders'].totalSales += customer.totalSales || 0
        categories['No Orders'].customers.push(customer)
      } else if (days <= 7) {
        categories['Active (≤7 days)'].count++
        categories['Active (≤7 days)'].totalSales += customer.totalSales || 0
        categories['Active (≤7 days)'].customers.push(customer)
      } else if (days <= 30) {
        categories['Regular (7-30 days)'].count++
        categories['Regular (7-30 days)'].totalSales += customer.totalSales || 0
        categories['Regular (7-30 days)'].customers.push(customer)
      } else if (days <= 60) {
        categories['At-Risk (30-60 days)'].count++
        categories['At-Risk (30-60 days)'].totalSales += customer.totalSales || 0
        categories['At-Risk (30-60 days)'].customers.push(customer)
      } else {
        categories['Dormant (>60 days)'].count++
        categories['Dormant (>60 days)'].totalSales += customer.totalSales || 0
        categories['Dormant (>60 days)'].customers.push(customer)
      }
    })

    // Calculate total customers for percentage
    const totalCustomers = processedData.topCustomers.length

    return Object.entries(categories).map(([category, data]) => ({
      category,
      count: data.count,
      percentage: totalCustomers > 0 ? (data.count / totalCustomers * 100) : 0,
      totalSales: data.totalSales,
      avgSales: data.count > 0 ? data.totalSales / data.count : 0
    }))
  }, [processedData.topCustomers])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setClassificationFilter('all')
    setRegionFilter('all')
    setTypeFilter('all')
    setStatusFilter('all')
  }, [])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return searchQuery ||
           classificationFilter !== 'all' ||
           regionFilter !== 'all' ||
           typeFilter !== 'all' ||
           statusFilter !== 'all'
  }, [searchQuery, classificationFilter, regionFilter, typeFilter, statusFilter])

  // Export all customers to Excel (fetch without pagination)
  const exportToExcel = async () => {
    try {
      // Build API URL to fetch ALL customers (no pagination limit)
      const params = new URLSearchParams({
        range: selectedPeriod,
        page: '1',
        limit: '100000', // Fetch all customers
      })

      // Add filters to URL
      if (classificationFilter !== 'all') params.append('classification', classificationFilter)
      if (regionFilter !== 'all') params.append('region', regionFilter)
      if (typeFilter !== 'all') params.append('type', typeFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (debouncedSearch) params.append('search', debouncedSearch)

      // Fetch all customers
      const response = await fetch(`/api/customers/analytics?${params.toString()}`)
      const result = await response.json()

      if (!result.success || !result.data || !result.data.topCustomers) {
        alert('No data available to export')
        return
      }

      const allCustomers = result.data.topCustomers

      if (allCustomers.length === 0) {
        alert('No customers match the selected filters')
        return
      }

      // Create workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Customer Analysis')

      // Set column widths
      worksheet.columns = [
        { width: 18 },  // Customer Code
        { width: 40 },  // Customer Name
        { width: 18 },  // Classification
        { width: 20 },  // Region
        { width: 18 },  // Total Sales
        { width: 12 },  // Orders
        { width: 15 },  // AOV
        { width: 12 },  // Status
        { width: 25 }   // Route
      ]

      let currentRow = 1

      // Title
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`)
      const titleCell = worksheet.getCell(`A${currentRow}`)
      titleCell.value = 'Customer Analysis Report'
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF1E40AF' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7FF' }
      }
      worksheet.getRow(currentRow).height = 30
      currentRow++

      // Date/Period header
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`)
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
      dateCell.value = `Period: ${periodLabels[selectedPeriod] || selectedPeriod} | Generated: ${new Date().toLocaleString('en-GB')}`
      dateCell.font = { size: 12, bold: true }
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
      dateCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Empty row
      currentRow++

      // Filters Section (if any filters are active)
      if (hasActiveFilters) {
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`)
        const filterTitleCell = worksheet.getCell(`A${currentRow}`)
        filterTitleCell.value = 'Active Filters'
        filterTitleCell.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } }
        filterTitleCell.alignment = { horizontal: 'left', vertical: 'middle' }
        filterTitleCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDBEAFE' }
        }
        worksheet.getRow(currentRow).height = 25
        currentRow++

        // Show each active filter
        const filterLabels: {[key: string]: {[key: string]: string}} = {
          classification: {
            'vip': 'VIP Account',
            'key': 'Key Account',
            'a': 'A Class',
            'b': 'B Class',
            'c': 'C Class',
            'new': 'New Customer'
          },
          region: {
            '01': 'Dubai (City 01)',
            '02': 'Al Ain (City 02)',
            '03': 'Abu Dhabi (City 03)',
            '04': 'Sharjah (City 04)',
            '05': 'Ajman (City 05)',
            '06': 'Ras Al Khaimah (City 06)',
            '07': 'Fujairah (City 07)',
            '08': 'Northern Emirates (City 08)'
          },
          type: {
            'active': 'Active',
            'inactive': 'Inactive',
            'vip': 'VIP (High Volume)'
          },
          status: {
            'active': 'Recent Activity',
            'inactive': 'Low Activity',
            'blocked': 'Blocked'
          }
        }

        if (searchQuery) {
          worksheet.getCell(`A${currentRow}`).value = 'Search:'
          worksheet.getCell(`A${currentRow}`).font = { bold: true }
          worksheet.getCell(`B${currentRow}`).value = searchQuery
          worksheet.getRow(currentRow).height = 20
          currentRow++
        }

        if (classificationFilter !== 'all') {
          worksheet.getCell(`A${currentRow}`).value = 'Classification:'
          worksheet.getCell(`A${currentRow}`).font = { bold: true }
          worksheet.getCell(`B${currentRow}`).value = filterLabels.classification[classificationFilter] || classificationFilter
          worksheet.getRow(currentRow).height = 20
          currentRow++
        }

        if (regionFilter !== 'all') {
          worksheet.getCell(`A${currentRow}`).value = 'Region:'
          worksheet.getCell(`A${currentRow}`).font = { bold: true }
          worksheet.getCell(`B${currentRow}`).value = filterLabels.region[regionFilter] || regionFilter
          worksheet.getRow(currentRow).height = 20
          currentRow++
        }

        if (typeFilter !== 'all') {
          worksheet.getCell(`A${currentRow}`).value = 'Type:'
          worksheet.getCell(`A${currentRow}`).font = { bold: true }
          worksheet.getCell(`B${currentRow}`).value = filterLabels.type[typeFilter] || typeFilter
          worksheet.getRow(currentRow).height = 20
          currentRow++
        }

        if (statusFilter !== 'all') {
          worksheet.getCell(`A${currentRow}`).value = 'Activity:'
          worksheet.getCell(`A${currentRow}`).font = { bold: true }
          worksheet.getCell(`B${currentRow}`).value = filterLabels.status[statusFilter] || statusFilter
          worksheet.getRow(currentRow).height = 20
          currentRow++
        }

        // Empty row after filters
        currentRow++
      }

      // Summary stats
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`)
      const summaryTitleCell = worksheet.getCell(`A${currentRow}`)
      summaryTitleCell.value = 'Summary'
      summaryTitleCell.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } }
      summaryTitleCell.alignment = { horizontal: 'left', vertical: 'middle' }
      summaryTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Summary row
      worksheet.getCell(`A${currentRow}`).value = 'Total Customers'
      worksheet.getCell(`A${currentRow}`).font = { bold: true }
      worksheet.getCell(`B${currentRow}`).value = allCustomers.length
      worksheet.getCell(`B${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF2563EB' } }

      const totalSales = allCustomers.reduce((sum, c) => sum + (c.totalSales || 0), 0)
      const currency = getCurrency()
      worksheet.getCell(`C${currentRow}`).value = 'Total Sales'
      worksheet.getCell(`C${currentRow}`).font = { bold: true }
      worksheet.getCell(`D${currentRow}`).value = `${currency} ${totalSales.toLocaleString()}`
      worksheet.getCell(`D${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF059669' } }

      const totalOrders = allCustomers.reduce((sum, c) => sum + (c.orderCount || 0), 0)
      worksheet.getCell(`E${currentRow}`).value = 'Total Orders'
      worksheet.getCell(`E${currentRow}`).font = { bold: true }
      worksheet.getCell(`F${currentRow}`).value = totalOrders
      worksheet.getCell(`F${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF2563EB' } }

      worksheet.getRow(currentRow).height = 20
      currentRow++

      // Empty rows
      currentRow++
      currentRow++

      // Table Header
      const headerRow = worksheet.getRow(currentRow)
      headerRow.values = [
        'Customer Code',
        'Customer Name',
        'Classification',
        'Region',
        'Total Sales',
        'Orders',
        'Avg Order Value',
        'Status',
        'Route'
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

      // Helper function to determine classification
      const getClassification = (sales: number) => {
        if (sales >= 100000) return 'VIP Account'
        if (sales >= 50000) return 'Key Account'
        if (sales >= 20000) return 'A Class'
        if (sales >= 10000) return 'B Class'
        if (sales >= 5000) return 'C Class'
        return 'New Customer'
      }

      // Data rows
      allCustomers.forEach((customer, index) => {
        const row = worksheet.getRow(currentRow)
        const classification = getClassification(customer.totalSales || 0)

        row.values = [
          customer.customerCode || '',
          customer.customerName || '',
          classification,
          customer.region || 'Unknown',
          customer.totalSales || 0,
          customer.orderCount || 0,
          customer.avgOrderValue || 0,
          customer.status || 'Active',
          customer.routeName || customer.routeCode || 'Unknown'
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

          // Format sales columns as currency
          if (colNumber === 5 || colNumber === 7) {
            cell.numFmt = '#,##0.00'
            cell.font = { color: { argb: 'FF059669' }, bold: true }
          }

          // Format orders column
          if (colNumber === 6) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          }

          // Classification colors
          if (colNumber === 3) {
            const classColors: {[key: string]: string} = {
              'VIP Account': 'FFEF4444',
              'Key Account': 'FF9333EA',
              'A Class': 'FF0EA5E9',
              'B Class': 'FF10B981',
              'C Class': 'FFFBBF24',
              'New Customer': 'FF94A3B8'
            }
            if (classColors[classification]) {
              cell.font = { color: { argb: classColors[classification] }, bold: true }
            }
          }

          // Status badge-like formatting
          if (colNumber === 8) {
            const statusValue = customer.status?.toLowerCase()
            if (statusValue === 'active') {
              cell.font = { color: { argb: 'FF059669' }, bold: true }
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD1FAE5' }
              }
            } else if (statusValue === 'blocked') {
              cell.font = { color: { argb: 'FFDC2626' }, bold: true }
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFECACA' }
              }
            }
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
        `${allCustomers.length} Customers`,
        '',
        '',
        totalSales,
        totalOrders,
        totalOrders > 0 ? totalSales / totalOrders : 0,
        '',
        ''
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
        if (colNumber === 5 || colNumber === 7) {
          cell.numFmt = '#,##0.00'
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
      link.download = `Customer_Analysis_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  return (
    <div className={`${isMobile ? 'p-4' : 'p-6'} space-y-6`}>
      {/* Header */}
      <div className={`flex ${isMobile ? 'flex-col gap-4' : 'justify-between items-center'}`}>
        <div>
          <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold`}>Customer Analysis</h1>
          <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''} mt-1`}>
            {loading ? 'Loading customer data...' :
             error ? 'Error loading customer data' :
             processedData.metrics.totalCustomers > 0 ?
             `Analyzing ${formatNumber(processedData.metrics.totalCustomers)} customers${hasActiveFilters ? ' (filtered)' : ''}` :
             'No customer data available for selected criteria'}
          </p>
        </div>
        <div className={`flex gap-3 items-center ${isMobile ? 'w-full flex-col' : ''}`}>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className={`flex items-center gap-2 ${isMobile ? 'w-full' : ''}`}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className={isMobile ? 'w-full' : 'w-48'}>
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
      </div>

      {/* KPI Cards */}
      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-5'} gap-4`}>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-1">Total Customers</div>
            <div className="text-2xl font-bold">{formatNumber(processedData.metrics.totalCustomers)}</div>
            <div className="text-sm text-green-600 mt-1">
              {formatNumber(processedData.metrics.activeCustomers)} active
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-1">Total Sales</div>
            <div className="text-2xl font-bold">{formatValue(processedData.metrics.totalSales)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-1">Total Orders</div>
            <div className="text-2xl font-bold">
              {processedData.metrics.totalOrders >= 1000
                ? `${(processedData.metrics.totalOrders / 1000).toFixed(0)}K`
                : formatNumber(processedData.metrics.totalOrders)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-1">Avg Order Value</div>
            <div className="text-2xl font-bold">{getCurrency()} {processedData.metrics.avgOrderValue.toFixed(0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-1">Outstanding</div>
            <div className="text-2xl font-bold text-yellow-600">
              {formatValue(processedData.metrics.totalOutstanding)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex space-x-2">
        <Button
          variant={activeView === 'summary' ? 'default' : 'outline'}
          onClick={() => setActiveView('summary')}
        >
          Summary View
        </Button>
        <Button
          variant={activeView === 'detailed' ? 'default' : 'outline'}
          onClick={() => setActiveView('detailed')}
        >
          Detailed View
        </Button>
        <Button
          variant={activeView === 'daywise' ? 'default' : 'outline'}
          onClick={() => setActiveView('daywise')}
        >
          Day-wise Ledger
        </Button>
      </div>

      {activeView === 'daywise' ? (
        <DaywiseLedger />
      ) : activeView === 'summary' ? (
        <>
          {/* Charts Row - Sales by Customer Type and Customer Classification */}
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-5'} gap-6`}>
            {/* Sales by Customer Type - Takes 3 of 5 columns (60% width) */}
            <Card className={isMobile ? '' : 'lg:col-span-3'}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Sales by Customer Type</CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="font-semibold mb-2">Sales by Customer Classification</p>
                        <p className="text-xs mb-2">Customers are classified based on total sales amount:</p>
                        <ul className="text-xs space-y-1">
                          <li><strong>VIP Account:</strong> ≥ 100,000 {getCurrency()}</li>
                          <li><strong>Key Account:</strong> 50,000 - 99,999 {getCurrency()}</li>
                          <li><strong>A Class:</strong> 20,000 - 49,999 {getCurrency()}</li>
                          <li><strong>B Class:</strong> 10,000 - 19,999 {getCurrency()}</li>
                          <li><strong>C Class:</strong> 5,000 - 9,999 {getCurrency()}</li>
                          <li><strong>New Customer:</strong> &lt; 5,000 {getCurrency()}</li>
                        </ul>
                        <p className="text-xs mt-2 italic">Shows total sales value per classification</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={isMobile ? 300 : 350}>
                  <BarChart
                    data={[...processedData.customerClassification].sort((a, b) => b.totalSales - a.totalSales)}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="classification"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      interval={0}
                    />
                    <YAxis tickFormatter={(value) => `${getCurrency()} ${(value / 1000).toFixed(0)}k`} />
                    <RechartsTooltip formatter={(value: number) => formatValue(value)} />
                    <Bar dataKey="totalSales">
                      {/* Apply classification colors to each bar */}
                      {[...processedData.customerClassification].sort((a, b) => b.totalSales - a.totalSales).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CLASSIFICATION_COLORS[entry.classification as keyof typeof CLASSIFICATION_COLORS] || businessColors.primary[600]} />
                      ))}
                      {/* Add data labels on top of bars */}
                      <LabelList
                        dataKey="totalSales"
                        position="top"
                        formatter={(value: number) => `${(value / 1000).toFixed(0)}k`}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Customer Classification - Takes 2 of 5 columns (40% width) */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Customer Classification</CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="font-semibold mb-2">Sales Contribution by Customer Type</p>
                        <p className="text-xs mb-2">Pie chart shows the percentage of total sales contributed by each customer classification.</p>
                        <p className="text-xs font-mono text-blue-600">
                          % = (Classification Sales / Total Sales) × 100
                        </p>
                        <p className="text-xs mt-2 italic">Helps identify which customer segments drive the most revenue</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, value }) => `${name} (${value.toFixed(1)}%)`}
                      labelLine={false}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CLASSIFICATION_COLORS[entry.name as keyof typeof CLASSIFICATION_COLORS] || businessColors.primary[600]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={50}
                      iconType="circle"
                      wrapperStyle={{
                        paddingTop: '20px',
                        fontSize: '12px',
                        lineHeight: '20px'
                      }}
                      layout="horizontal"
                      align="center"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Customer Classification by Sales Volume - Detailed Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Volume Classification - Customer Segments</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Customers grouped by sales volume ranges (same data as pie chart above)
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {processedData.customerClassification.map((item, index) => {
                  const totalSales = processedData.customerClassification.reduce((sum, c) => sum + c.totalSales, 0)
                  const contribution = totalSales > 0 ? (item.totalSales / totalSales * 100) : 0

                  // Add descriptions for each classification
                  const getDescription = (classification: string) => {
                    switch(classification) {
                      case 'VIP Account':
                        return 'Premium customers (≥100K sales)'
                      case 'Key Account':
                        return 'Strategic customers (50K-100K)'
                      case 'A Class':
                        return 'High-value customers (20K-50K)'
                      case 'B Class':
                        return 'Medium-value customers (10K-20K)'
                      case 'C Class':
                        return 'Low-value customers (5K-10K)'
                      case 'New Customer':
                        return 'Small customers (<5K)'
                      default:
                        return ''
                    }
                  }

                  return (
                    <div
                      key={index}
                      className="border-l-4 pl-4 py-2"
                      style={{ borderColor: CLASSIFICATION_COLORS[item.classification as keyof typeof CLASSIFICATION_COLORS] || businessColors.primary[600] }}
                    >
                      <div className="font-semibold text-lg">{item.classification}</div>
                      <div className="text-xs text-gray-500 mb-1">{getDescription(item.classification)}</div>
                      <div className="text-sm text-gray-600">Customers: {formatNumber(item.customerCount)}</div>
                      <div className="text-sm text-gray-600">Sales: {formatValue(item.totalSales)}</div>
                      <div className="text-sm font-semibold text-green-600">
                        Contribution: {contribution.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Avg Sales: {formatValue(item.avgSales)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Detailed View with Working Filters */
        <Card>
          <CardHeader>
            <div className="space-y-4">
              {/* Filter Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  <span className="font-semibold">Filters</span>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="text-xs"
                    >
                      Clear All
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {processedData.pagination.totalCount > 0 && (
                    <>
                      <div className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-md border border-gray-300">
                        Total: <span className="font-bold text-gray-900">{processedData.pagination.totalCount.toLocaleString()}</span> customers
                      </div>
                      <div className="text-sm font-medium text-blue-700 bg-blue-50 px-3 py-1 rounded-md border border-blue-300">
                        Showing: <span className="font-bold">{processedData.pagination.showing || `${processedData.topCustomers.length} results`}</span>
                      </div>
                      <div className="text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-md border border-green-300">
                        Page: <span className="font-bold">{currentPage} of {processedData.pagination.totalPages || 1}</span>
                      </div>
                      <Button
                        onClick={exportToExcel}
                        disabled={processedData.topCustomers.length === 0}
                        className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        size="sm"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                      </Button>
                    </>
                  )}
                  {loading && (
                    <Badge variant="secondary">Updating...</Badge>
                  )}
                </div>
              </div>

              {/* Search Filter */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by customer name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full max-w-md"
                />
              </div>

              {/* Filter Row */}
              <div className="flex flex-wrap gap-3">
                <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Classification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    <SelectItem value="vip">VIP Account</SelectItem>
                    <SelectItem value="key">Key Account</SelectItem>
                    <SelectItem value="a">A Class</SelectItem>
                    <SelectItem value="b">B Class</SelectItem>
                    <SelectItem value="c">C Class</SelectItem>
                    <SelectItem value="new">New Customer</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {filterOptions.regions.map(region => (
                      <SelectItem key={region.code} value={region.code}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="vip">VIP (High Volume)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Activity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activity</SelectItem>
                    <SelectItem value="active">Recent Activity</SelectItem>
                    <SelectItem value="inactive">Low Activity</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort controls */}
              <div className="flex gap-4 items-center">
                <span className="text-sm text-gray-600">Sort By</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="orders">Orders</SelectItem>
                    <SelectItem value="aov">AOV</SelectItem>
                    <SelectItem value="outstanding">Outstanding</SelectItem>
                  </SelectContent>
                </Select>

                <span className="text-sm text-gray-600">Order</span>
                <Select value={sortOrder} onValueChange={(v: 'asc' | 'desc') => setSortOrder(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Highest First</SelectItem>
                    <SelectItem value="asc">Lowest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Code</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">AOV</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedData.topCustomers.map((customer, index) => {
                  // Determine classification based on sales - MUST MATCH API LOGIC EXACTLY
                  const getClassification = (sales: number) => {
                    if (sales >= 100000) return 'VIP Account'      // Fixed: Added VIP tier
                    if (sales >= 50000) return 'Key Account'       // Fixed: >= instead of >
                    if (sales >= 20000) return 'A Class'           // Fixed: >= instead of >
                    if (sales >= 10000) return 'B Class'           // Fixed: >= instead of >
                    if (sales >= 5000) return 'C Class'            // Fixed: >= instead of >
                    return 'New Customer'
                  }

                  // Use real region data from API (comes from database city codes)
                  const region = customer.region || 'Unknown'

                  const classification = getClassification(customer.totalSales || 0)

                  const handleRowClick = () => {
                    setSelectedCustomer({
                      ...customer,
                      classification,
                      region
                    })
                    setIsModalOpen(true)
                  }

                  return (
                    <TableRow
                      key={customer.customerCode || index}
                      onClick={handleRowClick}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <TableCell className="font-medium text-blue-600">
                        {customer.customerCode}
                      </TableCell>
                      <TableCell>{customer.customerName}</TableCell>
                      <TableCell>
                        <Badge className={`${classification === 'VIP Account' ? 'bg-red-600 text-white font-bold' :
                                          classification === 'Key Account' ? 'bg-purple-600 text-white' :
                                          classification === 'A Class' ? 'bg-sky-100 text-sky-800' :
                                          classification === 'B Class' ? 'bg-green-100 text-green-800' :
                                          classification === 'C Class' ? 'bg-amber-100 text-amber-800' :
                                          'bg-slate-100 text-slate-700'}`}>
                          {classification}
                        </Badge>
                      </TableCell>
                      <TableCell>{region}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(customer.totalSales || 0)}
                      </TableCell>
                      <TableCell className="text-right">{customer.orderCount || 0}</TableCell>
                      <TableCell className="text-right">
                        {getCurrency()} {customer.avgOrderValue?.toFixed(0) || '0'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge className={customer.status === 'Active' ? 'bg-green-100 text-green-800' :
                                           customer.status === 'Blocked' ? 'bg-red-100 text-red-800' :
                                           'bg-gray-100 text-gray-800'}>
                            {customer.status || 'Active'}
                          </Badge>
                          {customer.daysSinceLastOrder !== null && customer.daysSinceLastOrder !== undefined && (
                            <Badge
                              className={
                                customer.daysSinceLastOrder === 0 || customer.orderCount === 0 ? 'bg-red-100 text-red-800' :
                                customer.daysSinceLastOrder > 60 ? 'bg-red-100 text-red-800' :
                                customer.daysSinceLastOrder > 30 ? 'bg-orange-100 text-orange-800' :
                                customer.daysSinceLastOrder > 7 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }
                            >
                              {customer.orderCount === 0 ? 'No Orders' : `${customer.daysSinceLastOrder}d ago`}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedCustomerForOrders(customer)
                              setOrdersModalOpen(true)
                            }}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                          >
                            Orders
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {/* Pagination Controls - Always visible when there's data */}
            {processedData.topCustomers.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 border-t-2">
                <div className="flex items-center justify-between">

                  {/* Page Size Control */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Show</span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value))
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-600">entries</span>
                  </div>

                  {/* Navigation Controls */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    <div className="px-3 py-1 bg-white border rounded">
                      <span className="text-sm font-medium">
                        Page {processedData.pagination.currentPage || currentPage} of {processedData.pagination.totalPages || 1}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={(processedData.pagination.totalPages && currentPage >= processedData.pagination.totalPages) || loading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Results Summary */}
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-semibold">{processedData.pagination.showing || `${processedData.topCustomers.length} results`}</span> of <span className="font-semibold">{processedData.pagination.totalCount?.toLocaleString() || '0'}</span> entries
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Customer Details Modal */}
      <CustomerDetailsModal
        customer={selectedCustomer}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedCustomer(null)
        }}
        dateRange={selectedPeriod}
      />

      {/* Customer Orders Modal */}
      <CustomerOrdersModal
        customer={selectedCustomerForOrders}
        isOpen={ordersModalOpen}
        onClose={() => {
          setOrdersModalOpen(false)
          setSelectedCustomerForOrders(null)
        }}
        dateRange={selectedPeriod}
      />
    </div>
  )
}