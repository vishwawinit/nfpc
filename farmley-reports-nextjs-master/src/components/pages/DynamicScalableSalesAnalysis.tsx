import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { RefreshCw, TrendingUp, Package, Users, DollarSign, Target, Search, BarChart3, ChevronLeft, ChevronRight, Trophy, AlertTriangle, Loader2, Download } from 'lucide-react'
import OrderDetails from './OrderDetails'
import { useResponsive } from '@/hooks/useResponsive'
import ExcelJS from 'exceljs'

function DynamicScalableSalesAnalysis() {
  // Component for sales analysis
  const { isMobile, styles } = useResponsive()
  const [timeRange, setTimeRange] = useState('lastMonth')
  const [activeView, setActiveView] = useState('summary')
  const [searchTerm, setSearchTerm] = useState('')
  const [routeFilter, setRouteFilter] = useState('all')
  const [salesmanFilter, setSalesmanFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [performanceFilter, setPerformanceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('sales')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedRouteCode, setSelectedRouteCode] = useState<string | null>(null)
  const [showOrderDetails, setShowOrderDetails] = useState(false)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)

  const [salesData, setSalesData] = useState<any>(null)
  const [routeData, setRouteData] = useState<any>(null)
  const [regionalData, setRegionalData] = useState<any[]>([])
  const [salesmenData, setSalesmenData] = useState<any>(null)
  const [allRoutes, setAllRoutes] = useState<any[]>([]) // Store unfiltered routes for dropdowns
  const [allSalesmen, setAllSalesmen] = useState<any[]>([]) // Store unfiltered salesmen for dropdowns
  const [cityOptions, setCityOptions] = useState<Array<{ value: string; label: string }>>([])
  const [loading, setLoading] = useState(false)
  const [dropdownLoading, setDropdownLoading] = useState(false) // Loading state for dropdowns
  const [error, setError] = useState<string | null>(null)

  // Fetch unfiltered data for dropdowns (only once)
  const fetchDropdownData = async () => {
    setDropdownLoading(true)
    try {
      // Fetch all routes and salesmen without filters for dropdown population
      const allRoutesResponse = await fetch(`/api/routes/analysis?range=${timeRange}&page=1&limit=1000&search=&route=all&salesman=all&performance=all`)
      const allRoutesResult = await allRoutesResponse.json()

      // Fetch city options from dashboard filters API
      const citiesResponse = await fetch('/api/dashboard/filters')
      const citiesResult = await citiesResponse.json()

      if (allRoutesResult.success && allRoutesResult.data) {
        // Extract unique routes
        const uniqueRoutes = [...new Set(allRoutesResult.data.map((r: any) => r.routeCode))]

        // Extract unique salesmen (using Map to handle objects)
        const salesmenMap = new Map()
        allRoutesResult.data.forEach((r: any) => {
          const key = `${r.salesmanName}|${r.salesmanCode || 'N/A'}`
          if (!salesmenMap.has(key)) {
            salesmenMap.set(key, {
              code: r.salesmanCode || 'N/A',
              name: r.salesmanName,
              combined: key
            })
          }
        })
        const uniqueSalesmen = Array.from(salesmenMap.values())

        setAllRoutes(uniqueRoutes)
        setAllSalesmen(uniqueSalesmen)
      }

      if (citiesResult.success && citiesResult.data.cities) {
        setCityOptions(citiesResult.data.cities.map((city: any) => ({
          value: city.value,
          label: city.label
        })))
      }
    } catch (err) {
      console.error('Error fetching dropdown data:', err)
    } finally {
      setDropdownLoading(false)
    }
  }

  // Fetch all required data for the Sales Force Analysis
  const fetchSalesData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch sales performance data
      const salesResponse = await fetch(`/api/sales/performance?range=${timeRange}`)
      const salesResult = await salesResponse.json()
      console.log('Sales API Response:', salesResult)

      // Fetch route analysis data with pagination parameters
      const routeResponse = await fetch(`/api/routes/analysis?range=${timeRange}&page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(searchTerm)}&route=${routeFilter}&salesman=${salesmanFilter}&city=${cityFilter}&performance=${performanceFilter}`)
      const routeResult = await routeResponse.json()
      console.log('Route API Response:', routeResult)

      // Fetch salesman performance data
      const salesmenResponse = await fetch(`/api/salesmen/performance?range=${timeRange}`)
      const salesmenResult = await salesmenResponse.json()
      console.log('Salesmen API Response:', salesmenResult)

      if (salesResult.success) {
        setSalesData(salesResult.data)
        console.log('Sales data set:', salesResult.data)
      }

      if (routeResult.success) {
        setRouteData(routeResult.data)
        const regionalSummaryData = routeResult.regionalSummary || []
        setRegionalData(regionalSummaryData)
        // Update pagination metadata
        setTotalCount(routeResult.totalCount || 0)
        setTotalPages(routeResult.totalPages || 0)
        setHasNextPage(routeResult.hasNextPage || false)
        setHasPreviousPage(routeResult.hasPreviousPage || false)
      } else {
        console.error('Route API failed:', routeResult)
        setRouteData([])
        setRegionalData([])
        setTotalCount(0)
        setTotalPages(0)
        setHasNextPage(false)
        setHasPreviousPage(false)
      }

      if (salesmenResult.success) {
        setSalesmenData(salesmenResult.data.all || salesmenResult.data)
        console.log('Salesmen data set:', salesmenResult.data.all || salesmenResult.data)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Sales analysis error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch dropdown data only when time range changes
  useEffect(() => {
    fetchDropdownData()
  }, [timeRange])

  useEffect(() => {
    fetchSalesData()
  }, [timeRange, currentPage, itemsPerPage, searchTerm, routeFilter, salesmanFilter, cityFilter, performanceFilter])

  // Regional data is now provided directly from the API (not processed from paginated data)

  // Process filtered route data for detailed view
  // Client-side sorting for the paginated data from API
  const sortedRouteData = React.useMemo(() => {
    if (!routeData || !Array.isArray(routeData)) return []

    return routeData.sort((a: any, b: any) => {
      const aVal = a[sortBy] || 0
      const bVal = b[sortBy] || 0
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
    })
  }, [routeData, sortBy, sortOrder])

  // Use sorted paginated data from API
  const paginatedRouteData = sortedRouteData

  // Reset current page when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, routeFilter, salesmanFilter, cityFilter, performanceFilter])

  // Get top and bottom performers
  const topPerformers = React.useMemo(() => {
    if (!salesmenData || !Array.isArray(salesmenData)) return []
    return salesmenData
      .sort((a: any, b: any) => (b.totalSales30d || 0) - (a.totalSales30d || 0))
      .slice(0, 20)
  }, [salesmenData])

  const needAttention = React.useMemo(() => {
    if (!salesmenData || !Array.isArray(salesmenData)) return []
    return salesmenData
      .sort((a: any, b: any) => (a.totalSales30d || 0) - (b.totalSales30d || 0))
      .slice(0, 20)
  }, [salesmenData])

  const refresh = () => {
    fetchSalesData()
  }

  // Helper function to get actual date range details
  const getDateRangeDetails = (range: string) => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-indexed

    let startDate: Date
    let endDate: Date
    let periodLabel: string
    let fileLabel: string

    switch (range) {
      case 'lastMonth':
        // Previous month
        startDate = new Date(currentYear, currentMonth - 1, 1)
        endDate = new Date(currentYear, currentMonth, 0) // Last day of previous month
        periodLabel = `${startDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`
        fileLabel = `${startDate.toLocaleString('en-US', { month: 'short' })}_${startDate.getFullYear()}`
        break

      case 'lastQuarter':
        // Previous quarter
        const currentQuarter = Math.floor(currentMonth / 3)
        const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1
        const quarterYear = currentQuarter === 0 ? currentYear - 1 : currentYear

        startDate = new Date(quarterYear, lastQuarter * 3, 1)
        endDate = new Date(quarterYear, (lastQuarter + 1) * 3, 0)

        const quarterName = `Q${lastQuarter + 1}`
        const month1 = new Date(quarterYear, lastQuarter * 3, 1).toLocaleString('en-US', { month: 'short' })
        const month2 = new Date(quarterYear, lastQuarter * 3 + 1, 1).toLocaleString('en-US', { month: 'short' })
        const month3 = new Date(quarterYear, lastQuarter * 3 + 2, 1).toLocaleString('en-US', { month: 'short' })

        periodLabel = `${quarterName} ${quarterYear} (${month1}, ${month2}, ${month3})`
        fileLabel = `${quarterName}_${quarterYear}`
        break

      default:
        startDate = new Date(currentYear, currentMonth - 1, 1)
        endDate = new Date(currentYear, currentMonth, 0)
        periodLabel = `${startDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`
        fileLabel = `${startDate.toLocaleString('en-US', { month: 'short' })}_${startDate.getFullYear()}`
    }

    const dateRangeText = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

    return { periodLabel, dateRangeText, fileLabel, startDate, endDate }
  }

  // Excel Export Function for Top Performers
  const exportTopPerformersToExcel = async () => {
    if (!topPerformers || topPerformers.length === 0) {
      alert('No top performers data available to export')
      return
    }

    try {
      const { periodLabel, dateRangeText, fileLabel } = getDateRangeDetails(timeRange)

      // Create a new workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Top 20 Performers')

      // Set column widths
      worksheet.columns = [
        { key: 'rank', width: 10 },
        { key: 'name', width: 30 },
        { key: 'code', width: 20 },
        { key: 'routeCode', width: 15 },
        { key: 'routeName', width: 25 },
        { key: 'sales', width: 20 }
      ]

      // Add title row
      worksheet.mergeCells('A1:F1')
      const titleRow = worksheet.getCell('A1')
      titleRow.value = 'Top 20 Performers Report'
      titleRow.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      titleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0EA5E9' }
      }
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(1).height = 30

      // Add date range info row
      worksheet.mergeCells('A2:F2')
      const dateRangeRow = worksheet.getCell('A2')
      dateRangeRow.value = `Period: ${periodLabel} | Date Range: ${dateRangeText}`
      dateRangeRow.font = { size: 11, italic: true }
      dateRangeRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(2).height = 20

      // Add empty row
      worksheet.addRow([])

      // Add header row
      const headerRow = worksheet.addRow([
        'Rank',
        'Salesman Name',
        'Salesman Code',
        'Route Code',
        'Route Name',
        'Total Sales (AED)'
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
      topPerformers.forEach((salesman, index) => {
        const dataRow = worksheet.addRow([
          `#${index + 1}`,
          salesman.salesmanName || 'Unknown',
          salesman.salesmanCode || 'N/A',
          salesman.routeCode || 'N/A',
          salesman.routeName || 'N/A',
          salesman.totalSales30d || 0
        ])

        // Format currency column
        dataRow.getCell(6).numFmt = '#,##0.00'

        // Center align rank, codes
        dataRow.getCell(1).alignment = { horizontal: 'center' }
        dataRow.getCell(3).alignment = { horizontal: 'center' }
        dataRow.getCell(4).alignment = { horizontal: 'center' }

        // Right align sales
        dataRow.getCell(6).alignment = { horizontal: 'right' }

        // Add borders
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
          }
        })

        // Highlight top 3 with gold, silver, bronze backgrounds
        if (index === 0) {
          dataRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } } // Gold
            cell.font = { bold: true }
          })
        } else if (index === 1) {
          dataRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0C0C0' } } // Silver
            cell.font = { bold: true }
          })
        } else if (index === 2) {
          dataRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCD7F32' } } // Bronze
            cell.font = { bold: true }
          })
        } else if (index % 2 === 0) {
          // Alternate row colors for others
          dataRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
          })
        }
      })

      // Add summary row
      worksheet.addRow([])
      const totalSales = topPerformers.reduce((sum, s) => sum + (s.totalSales30d || 0), 0)
      const avgSales = totalSales / topPerformers.length

      worksheet.addRow([
        '',
        '',
        '',
        '',
        'TOTAL:',
        totalSales
      ])

      const totalRow = worksheet.lastRow
      if (totalRow) {
        totalRow.font = { bold: true, size: 12 }
        totalRow.getCell(5).alignment = { horizontal: 'right' }
        totalRow.getCell(6).numFmt = '#,##0.00'
        totalRow.getCell(6).alignment = { horizontal: 'right' }

        totalRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
          cell.border = {
            top: { style: 'double', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'double', color: { argb: 'FF000000' } },
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
      link.download = `Top_20_Performers_${fileLabel}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting top performers to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  // Excel Export Function for Detailed View (Route Analysis)
  const exportDetailedViewToExcel = async () => {
    if (!paginatedRouteData || paginatedRouteData.length === 0) {
      alert('No route data available to export')
      return
    }

    try {
      // Fetch ALL filtered records (not just current page)
      const allDataResponse = await fetch(`/api/routes/analysis?range=${timeRange}&page=1&limit=10000&search=${encodeURIComponent(searchTerm)}&route=${routeFilter}&salesman=${salesmanFilter}&city=${cityFilter}&performance=${performanceFilter}`)
      const allDataResult = await allDataResponse.json()

      if (!allDataResult.success || !allDataResult.data || allDataResult.data.length === 0) {
        alert('No data available to export')
        return
      }

      // Use the full dataset for export
      const allFilteredData = allDataResult.data

      // Apply the same client-side sorting as the UI
      const sortedExportData = allFilteredData.sort((a: any, b: any) => {
        let aValue: number
        let bValue: number

        switch (sortBy) {
          case 'sales':
            aValue = a.totalSales30d || 0
            bValue = b.totalSales30d || 0
            break
          case 'orders':
            aValue = a.totalOrders30d || 0
            bValue = b.totalOrders30d || 0
            break
          case 'productivity':
            aValue = a.productivity || 0
            bValue = b.productivity || 0
            break
          case 'customers':
            aValue = a.uniqueCustomers || 0
            bValue = b.uniqueCustomers || 0
            break
          case 'avgOrderValue':
            aValue = a.totalOrders30d && a.totalOrders30d > 0 ? (a.totalSales30d || 0) / a.totalOrders30d : 0
            bValue = b.totalOrders30d && b.totalOrders30d > 0 ? (b.totalSales30d || 0) / b.totalOrders30d : 0
            break
          default:
            aValue = a.totalSales30d || 0
            bValue = b.totalSales30d || 0
        }

        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue
      })

      const { periodLabel, dateRangeText, fileLabel } = getDateRangeDetails(timeRange)

      // Build filter descriptions
      const activeFilters: string[] = []
      if (searchTerm) {
        activeFilters.push(`Search: "${searchTerm}"`)
      }
      if (cityFilter !== 'all') {
        const cityLabel = cityOptions.find(c => c.value === cityFilter)?.label || cityFilter
        activeFilters.push(`City: ${cityLabel}`)
      }
      if (routeFilter !== 'all') {
        activeFilters.push(`Route: ${routeFilter}`)
      }
      if (salesmanFilter !== 'all') {
        const salesmanName = salesmanFilter.split('|')[0]
        activeFilters.push(`Salesman: ${salesmanName}`)
      }
      if (performanceFilter !== 'all') {
        const perfLabels: { [key: string]: string } = {
          'high': 'Top Performers (>50K AED)',
          'medium': 'Average Performers (10K-50K AED)',
          'low': 'Need Support (<10K AED)',
          'active': 'Active Routes Only',
          'productive': 'High Productivity (>80%)'
        }
        activeFilters.push(`Performance: ${perfLabels[performanceFilter] || performanceFilter}`)
      }

      const sortLabels: { [key: string]: string } = {
        'sales': 'Total Sales Revenue',
        'orders': 'Number of Orders',
        'productivity': 'Visit Productivity %',
        'customers': 'Unique Customers',
        'avgOrderValue': 'Average Order Value'
      }
      const sortOrderLabel = sortOrder === 'desc' ? 'Best Performance First' : 'Needs Attention First'
      activeFilters.push(`Sort: ${sortLabels[sortBy]} - ${sortOrderLabel}`)

      // Create a new workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Route Analysis')

      // Set column widths
      worksheet.columns = [
        { key: 'routeCode', width: 15 },
        { key: 'routeName', width: 25 },
        { key: 'salesmanName', width: 25 },
        { key: 'salesmanCode', width: 18 },
        { key: 'sales', width: 18 },
        { key: 'orders', width: 15 },
        { key: 'productiveVisits', width: 18 },
        { key: 'totalVisits', width: 15 },
        { key: 'uniqueCustomers', width: 18 },
        { key: 'productivity', width: 15 }
      ]

      // Add title row
      worksheet.mergeCells('A1:J1')
      const titleRow = worksheet.getCell('A1')
      titleRow.value = 'Route Analysis - Detailed View'
      titleRow.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      titleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0EA5E9' }
      }
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(1).height = 30

      // Add date range info row
      worksheet.mergeCells('A2:J2')
      const dateRangeRow = worksheet.getCell('A2')
      dateRangeRow.value = `Period: ${periodLabel} | Date Range: ${dateRangeText}`
      dateRangeRow.font = { size: 11, italic: true }
      dateRangeRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(2).height = 20

      // Add filter info row(s)
      let currentRow = 3
      if (activeFilters.length > 0) {
        worksheet.mergeCells(`A${currentRow}:J${currentRow}`)
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
      worksheet.mergeCells(`A${currentRow}:J${currentRow}`)
      const countRow = worksheet.getCell(`A${currentRow}`)
      countRow.value = `Total Routes with Data: ${sortedExportData.length} routes${activeFilters.length > 0 ? ' (with active filters applied)' : ''}`
      countRow.font = { size: 10, bold: true }
      countRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(currentRow).height = 20
      currentRow++

      // Add empty row
      worksheet.addRow([])
      currentRow++

      // Add header row
      const headerRow = worksheet.addRow([
        'Route Code',
        'Route Name',
        'Salesman Name',
        'Salesman Code',
        'Total Sales (AED)',
        'Total Orders',
        'Productive Visits',
        'Total Visits',
        'Unique Customers',
        'Productivity %'
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
      sortedExportData.forEach((route, index) => {
        const dataRow = worksheet.addRow([
          route.routeCode,
          route.routeName || route.routeCode || 'N/A',
          route.salesmanName,
          route.salesmanCode || 'N/A',
          route.totalSales30d || 0,
          route.totalOrders30d || 0,
          route.productiveVisits || 0,
          route.totalVisits || 0,
          route.uniqueCustomers || 0,
          route.productivity || 0
        ])

        // Format currency column (Total Sales is now column 5)
        dataRow.getCell(5).numFmt = '#,##0.00'

        // Format percentage column (Productivity is now column 10)
        dataRow.getCell(10).numFmt = '0.0"%"'
        dataRow.getCell(10).value = (route.productivity || 0) / 100

        // Center align specific columns
        dataRow.getCell(1).alignment = { horizontal: 'center' } // Route Code
        dataRow.getCell(4).alignment = { horizontal: 'center' } // Salesman Code
        dataRow.getCell(6).alignment = { horizontal: 'center' } // Total Orders
        dataRow.getCell(7).alignment = { horizontal: 'center' } // Productive Visits
        dataRow.getCell(8).alignment = { horizontal: 'center' } // Total Visits
        dataRow.getCell(9).alignment = { horizontal: 'center' } // Unique Customers
        dataRow.getCell(10).alignment = { horizontal: 'center' } // Productivity

        // Right align sales
        dataRow.getCell(5).alignment = { horizontal: 'right' }

        // Add borders
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
          }
        })

        // Color code productivity
        const prodCell = dataRow.getCell(10)
        if (route.productivity >= 80) {
          prodCell.font = { bold: true, color: { argb: 'FF22C55E' } }
        } else if (route.productivity >= 60) {
          prodCell.font = { bold: true, color: { argb: 'FFF59E0B' } }
        } else {
          prodCell.font = { bold: true, color: { argb: 'FFEF4444' } }
        }

        // Alternate row colors
        if (index % 2 === 0) {
          dataRow.eachCell((cell, colNumber) => {
            if (colNumber !== 11) { // Don't override productivity color
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
      const totalSales = sortedExportData.reduce((sum, r) => sum + (r.totalSales30d || 0), 0)
      const totalOrders = sortedExportData.reduce((sum, r) => sum + (r.totalOrders30d || 0), 0)
      const totalProductiveVisits = sortedExportData.reduce((sum, r) => sum + (r.productiveVisits || 0), 0)
      const totalAllVisits = sortedExportData.reduce((sum, r) => sum + (r.totalVisits || 0), 0)
      const totalUniqueCustomers = sortedExportData.reduce((sum, r) => sum + (r.uniqueCustomers || 0), 0)
      const avgProductivity = totalAllVisits > 0 ? (totalProductiveVisits / totalAllVisits) * 100 : 0

      worksheet.addRow([
        '',
        '',
        '',
        '',
        'TOTAL:',
        totalSales,
        totalOrders,
        totalProductiveVisits,
        totalAllVisits,
        totalUniqueCustomers,
        avgProductivity / 100
      ])

      const totalRow = worksheet.lastRow
      if (totalRow) {
        totalRow.font = { bold: true, size: 12 }
        totalRow.getCell(5).alignment = { horizontal: 'right' }
        totalRow.getCell(6).numFmt = '#,##0.00'
        totalRow.getCell(6).alignment = { horizontal: 'right' }
        totalRow.getCell(7).alignment = { horizontal: 'center' }
        totalRow.getCell(8).alignment = { horizontal: 'center' }
        totalRow.getCell(9).alignment = { horizontal: 'center' }
        totalRow.getCell(10).alignment = { horizontal: 'center' }
        totalRow.getCell(11).numFmt = '0.0"%"'
        totalRow.getCell(11).alignment = { horizontal: 'center' }

        totalRow.eachCell((cell) => {
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
      }

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      // Build filename with filter info
      let filename = `Route_Analysis_${fileLabel}`
      if (cityFilter !== 'all') {
        const cityLabel = cityOptions.find(c => c.value === cityFilter)?.label || cityFilter
        filename += `_${cityLabel.replace(/\s+/g, '_')}`
      }
      if (routeFilter !== 'all') {
        filename += `_Route_${routeFilter}`
      }
      if (performanceFilter !== 'all') {
        filename += `_${performanceFilter}`
      }
      filename += '.xlsx'

      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting detailed view to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  // Excel Export Function for Need Attention (Bottom 20)
  const exportNeedAttentionToExcel = async () => {
    if (!needAttention || needAttention.length === 0) {
      alert('No need attention data available to export')
      return
    }

    try {
      const { periodLabel, dateRangeText, fileLabel } = getDateRangeDetails(timeRange)

      // Create a new workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Need Attention (Bottom 20)')

      // Set column widths
      worksheet.columns = [
        { key: 'rank', width: 10 },
        { key: 'name', width: 30 },
        { key: 'code', width: 20 },
        { key: 'routeCode', width: 15 },
        { key: 'routeName', width: 25 },
        { key: 'sales', width: 20 }
      ]

      // Add title row
      worksheet.mergeCells('A1:F1')
      const titleRow = worksheet.getCell('A1')
      titleRow.value = 'Need Attention (Bottom 20) Report'
      titleRow.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      titleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEF4444' }
      }
      titleRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(1).height = 30

      // Add date range info row
      worksheet.mergeCells('A2:F2')
      const dateRangeRow = worksheet.getCell('A2')
      dateRangeRow.value = `Period: ${periodLabel} | Date Range: ${dateRangeText}`
      dateRangeRow.font = { size: 11, italic: true }
      dateRangeRow.alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(2).height = 20

      // Add empty row
      worksheet.addRow([])

      // Add header row
      const headerRow = worksheet.addRow([
        'Rank',
        'Salesman Name',
        'Salesman Code',
        'Route Code',
        'Route Name',
        'Total Sales (AED)'
      ])

      // Style header row
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF97316' }
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
      needAttention.forEach((salesman, index) => {
        const dataRow = worksheet.addRow([
          `#${index + 1}`,
          salesman.salesmanName || `Salesman ${index + 1}`,
          salesman.salesmanCode || 'N/A',
          salesman.routeCode || 'N/A',
          salesman.routeName || 'N/A',
          salesman.totalSales30d || 0
        ])

        // Format currency column
        dataRow.getCell(6).numFmt = '#,##0.00'

        // Center align rank, codes
        dataRow.getCell(1).alignment = { horizontal: 'center' }
        dataRow.getCell(3).alignment = { horizontal: 'center' }
        dataRow.getCell(4).alignment = { horizontal: 'center' }

        // Right align sales
        dataRow.getCell(6).alignment = { horizontal: 'right' }

        // Add borders
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
          }
        })

        // Highlight bottom 3 with red shades
        if (index === 0) {
          dataRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } }
            cell.font = { bold: true, color: { argb: 'FF991B1B' } }
          })
        } else if (index === 1) {
          dataRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7AA' } }
            cell.font = { bold: true, color: { argb: 'FF9A3412' } }
          })
        } else if (index === 2) {
          dataRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
            cell.font = { bold: true, color: { argb: 'FF92400E' } }
          })
        } else if (index % 2 === 0) {
          // Alternate row colors for others
          dataRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
          })
        }
      })

      // Add summary row
      worksheet.addRow([])
      const totalSales = needAttention.reduce((sum, s) => sum + (s.totalSales30d || 0), 0)

      worksheet.addRow([
        '',
        '',
        '',
        '',
        'TOTAL:',
        totalSales
      ])

      const totalRow = worksheet.lastRow
      if (totalRow) {
        totalRow.font = { bold: true, size: 12 }
        totalRow.getCell(5).alignment = { horizontal: 'right' }
        totalRow.getCell(6).numFmt = '#,##0.00'
        totalRow.getCell(6).alignment = { horizontal: 'right' }

        totalRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7AA' } }
          cell.border = {
            top: { style: 'double', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'double', color: { argb: 'FF000000' } },
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
      link.download = `Need_Attention_Bottom_20_${fileLabel}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting need attention data to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  // Show Order Details view if a route is selected
  if (showOrderDetails && selectedRouteCode) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6">
          <OrderDetails
            routeCode={selectedRouteCode}
            onBack={() => {
              setShowOrderDetails(false)
              setSelectedRouteCode(null)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`${isMobile ? 'p-4' : 'p-6'} space-y-6`}>
        {/* Header */}
        <div className={`flex ${isMobile ? 'flex-col' : 'justify-between'} ${isMobile ? 'gap-4' : 'items-start'}`}>
          <div>
            <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>Sales Force Analysis</h1>
            <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''} mt-2`}>
              Analyzing performance across {totalCount || 0} routes and sales representatives
            </p>
          </div>

          <div className={`flex items-center gap-3 ${isMobile ? 'w-full flex-col' : ''}`}>
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className={isMobile ? 'w-full' : 'w-[200px]'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" disabled>Today</SelectItem>
                <SelectItem value="yesterday" disabled>Yesterday</SelectItem>
                <SelectItem value="thisWeek" disabled>This Week</SelectItem>
                <SelectItem value="thisMonth" disabled>This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="lastQuarter">Last Quarter (3 Months)</SelectItem>
                <SelectItem value="thisYear" disabled>This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={refresh}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-4 text-gray-600">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span>Loading sales data...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
            Error loading data: {error}
          </div>
        )}

        {/* KPI Cards with Sales and Orders Breakdown */}
        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'} gap-4`}>
          {/* Net Sales - Highlighted/Larger */}
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg">
            <CardContent className={isMobile ? 'p-4' : 'p-6'}>
              <div className="text-sm font-semibold text-blue-100 mb-2">NET SALES</div>
              <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-white mb-1`}>
                AED {(salesData?.summary?.netSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-blue-100 font-medium">After returns</div>
            </CardContent>
          </Card>

          {/* Total Sales */}
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className={isMobile ? 'p-4' : 'p-6'}>
              <div className="text-sm font-medium text-gray-600 mb-2">Total Sales</div>
              <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 mb-1`}>
                AED {(salesData?.summary?.totalSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-gray-500">{totalCount || 0} routes</div>
            </CardContent>
          </Card>

          {/* Return Sales */}
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className={isMobile ? 'p-4' : 'p-6'}>
              <div className="text-sm font-medium text-gray-600 mb-2">Return Sales</div>
              <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-red-600 mb-1`}>
                AED {(salesData?.summary?.returnSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-gray-500">Returns & wastage</div>
            </CardContent>
          </Card>

          {/* Net Orders - Highlighted/Larger */}
          <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0 shadow-lg">
            <CardContent className={isMobile ? 'p-4' : 'p-6'}>
              <div className="text-sm font-semibold text-green-100 mb-2">NET ORDERS</div>
              <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-white mb-1`}>
                {(salesData?.summary?.netOrders || 0).toLocaleString()}
              </div>
              <div className="text-sm text-green-100 font-medium">Successful orders</div>
            </CardContent>
          </Card>

          {/* Total Orders */}
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className={isMobile ? 'p-4' : 'p-6'}>
              <div className="text-sm font-medium text-gray-600 mb-2">Total Orders</div>
              <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 mb-1`}>
                {(salesData?.summary?.totalOrders || 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">All orders placed</div>
            </CardContent>
          </Card>

          {/* Return Orders */}
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className={isMobile ? 'p-4' : 'p-6'}>
              <div className="text-sm font-medium text-gray-600 mb-2">Return Orders</div>
              <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-red-600 mb-1`}>
                {(salesData?.summary?.returnOrders || 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Returned items</div>
            </CardContent>
          </Card>

          {/* Avg Productivity */}
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className={isMobile ? 'p-4' : 'p-6'}>
              <div className="text-sm font-medium text-gray-600 mb-2">Avg Productivity</div>
              <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold mb-1 ${
                (salesData?.summary?.avgProductivity || 0) >= 80
                  ? 'text-green-600'
                  : (salesData?.summary?.avgProductivity || 0) >= 60
                    ? 'text-blue-600'
                    : 'text-yellow-600'
              }`}>
                {salesData?.summary?.avgProductivity || 0}%
              </div>
              <div className="text-sm text-gray-500">Visit efficiency</div>
            </CardContent>
          </Card>

          {/* Target Achievement */}
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className={isMobile ? 'p-4' : 'p-6'}>
              <div className="text-sm font-medium text-gray-600 mb-2">Target Achievement</div>
              <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold mb-1 ${
                (salesData?.summary?.targetAchievement || 0) >= 100
                  ? 'text-green-600'
                  : (salesData?.summary?.targetAchievement || 0) >= 80
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}>
                {Math.round(salesData?.summary?.targetAchievement || 0)}%
              </div>
              <div className={`text-sm font-medium ${
                (salesData?.summary?.targetAchievement || 0) >= 100
                  ? 'text-green-500'
                  : (salesData?.summary?.targetAchievement || 0) >= 80
                    ? 'text-yellow-500'
                    : 'text-red-500'
              }`}>
                {(salesData?.summary?.targetAchievement || 0) >= 100
                  ? 'On track'
                  : (salesData?.summary?.targetAchievement || 0) >= 80
                    ? 'Good progress'
                    : 'Needs attention'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Tabs */}
        <div className="flex gap-1 bg-white rounded-lg p-1 w-fit">
          <Button
            variant={activeView === 'summary' ? 'default' : 'ghost'}
            onClick={() => setActiveView('summary')}
            className={`px-6 py-2 rounded-md text-sm font-medium ${
              activeView === 'summary'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Summary View
          </Button>
          <Button
            variant={activeView === 'detailed' ? 'default' : 'ghost'}
            onClick={() => setActiveView('detailed')}
            className={`px-6 py-2 rounded-md text-sm font-medium ${
              activeView === 'detailed'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Detailed View
          </Button>
        </div>

        {activeView === 'summary' ? (
          <>
            {/* Regional Performance Overview Chart */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900">Regional Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                {regionalData && Array.isArray(regionalData) && regionalData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={regionalData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 14, fill: '#6b7280' }}
                      />
                      <YAxis
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickFormatter={(value) => `${value / 1000}k`}
                        label={{ value: 'Sales (AED k)', angle: -90, position: 'insideLeft' }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        label={{ value: 'Orders & Customers', angle: 90, position: 'insideRight' }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          name === 'Sales' ? `AED ${value.toLocaleString()}` : value.toLocaleString(),
                          name
                        ]}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="rect"
                        payload={[
                          { value: 'Orders', type: 'rect', color: '#10b981' },
                          { value: 'Customers', type: 'rect', color: '#8b5cf6' },
                          { value: 'Sales', type: 'rect', color: '#3b82f6' }
                        ]}
                      />
                      <Bar yAxisId="right" dataKey="orders" fill="#10b981" name="Orders" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="routes" fill="#8b5cf6" name="Customers" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="left" dataKey="sales" fill="#3b82f6" name="Sales" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[400px]">
                    <div className="text-center">
                      <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <div className="text-xl font-semibold text-gray-700 mb-2">No Regional Data Available</div>
                      <div className="text-gray-500">No data available for the selected {timeRange} period</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Performers and Need Attention */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 10 Performers */}
              <Card className="bg-white border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900">Top 20 Performers</CardTitle>
                  {topPerformers.length > 0 && (
                    <Button
                      onClick={exportTopPerformersToExcel}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 bg-green-500 text-white border-none hover:bg-green-600"
                    >
                      <Download className="h-4 w-4" />
                      Export to Excel
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {topPerformers.length > 0 ? (
                    <div className="space-y-3">
                      {topPerformers.map((salesman: any, index: number) => (
                        <div key={salesman.salesmanCode} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">
                              {index + 1}
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">{salesman.salesmanName || 'Unknown'}</span>
                              <div className="text-xs text-gray-500">
                                Code: {salesman.salesmanCode || salesman.routeCode || 'N/A'}
                                {salesman.routeCode && salesman.routeCode !== 'N/A' && (
                                  <span className="ml-2">| Route: {salesman.routeCode}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              AED {(salesman.totalSales30d || 0).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[200px]">
                      <div className="text-center">
                        <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <div className="text-gray-600">No performance data available</div>
                        <div className="text-sm text-gray-500 mt-1">for {timeRange}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Need Attention (Bottom 10) */}
              <Card className="bg-white border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-lg font-semibold text-gray-900">Need Attention (Bottom 20)</CardTitle>
                  {needAttention.length > 0 && (
                    <Button
                      onClick={exportNeedAttentionToExcel}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 bg-orange-500 text-white border-none hover:bg-orange-600"
                    >
                      <Download className="h-4 w-4" />
                      Export to Excel
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {needAttention.length > 0 ? (
                    <div className="space-y-3">
                      {needAttention.map((salesman: any, index: number) => (
                        <div key={salesman.salesmanCode} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-sm font-semibold">
                              {index + 1}
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">{salesman.salesmanName || `Salesman ${index + 1}`}</span>
                              <div className="text-xs text-gray-500">
                                Code: {salesman.salesmanCode || salesman.routeCode || 'N/A'}
                                {salesman.routeCode && salesman.routeCode !== 'N/A' && (
                                  <span className="ml-2">| Route: {salesman.routeCode}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-700">
                              AED {(salesman.totalSales30d || 0).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[200px]">
                      <div className="text-center">
                        <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <div className="text-gray-600">No data to analyze</div>
                        <div className="text-sm text-gray-500 mt-1">for {timeRange}</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <>
            {/* Detailed View */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Detailed Route Analysis</h2>
                  {paginatedRouteData && paginatedRouteData.length > 0 && (
                    <Button
                      onClick={exportDetailedViewToExcel}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 bg-blue-500 text-white border-none hover:bg-blue-600"
                    >
                      <Download className="h-4 w-4" />
                      Export Filtered Data
                    </Button>
                  )}
                </div>
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Understanding the Metrics:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-blue-800">Productivity %:</span>
                      <span className="text-blue-700"> (Productive Visits ÷ Total Visits) × 100</span>
                      <p className="text-blue-600 mt-1">Measures how many visits resulted in orders</p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800">Unique Customers:</span>
                      <span className="text-blue-700"> Number of distinct customers on the route</span>
                      <p className="text-blue-600 mt-1">Different from orders (one customer can place multiple orders)</p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-800">Visits:</span>
                      <span className="text-blue-700"> Productive/Total format</span>
                      <p className="text-blue-600 mt-1">Shows successful visits vs all customer visits</p>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by name or code..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={cityFilter} onValueChange={setCityFilter} disabled={dropdownLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={dropdownLoading ? "Loading..." : "All Cities"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all">All Cities</SelectItem>
                      {cityOptions.map((city) => (
                        <SelectItem key={city.value} value={city.value}>
                          {city.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={routeFilter} onValueChange={setRouteFilter} disabled={dropdownLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={dropdownLoading ? "Loading routes..." : "All Routes"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {dropdownLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="text-sm text-gray-600">Loading routes...</span>
                        </div>
                      ) : (
                        <>
                          <SelectItem value="all">All Routes</SelectItem>
                          {/* Route codes populated from unfiltered data */}
                          {allRoutes.length > 0 ? (
                            allRoutes.map((routeCode: string) => (
                              <SelectItem key={routeCode} value={routeCode}>{routeCode}</SelectItem>
                            ))
                          ) : (
                            <div className="py-2 px-3 text-sm text-gray-500">No routes available</div>
                          )}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <Select value={salesmanFilter} onValueChange={setSalesmanFilter} disabled={dropdownLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={dropdownLoading ? "Loading salesmen..." : "All Salesmen"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {dropdownLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="text-sm text-gray-600">Loading salesmen...</span>
                        </div>
                      ) : (
                        <>
                          <SelectItem value="all">All Salesmen</SelectItem>
                          {/* Salesmen populated from unfiltered data */}
                          {allSalesmen.length > 0 ? (
                            allSalesmen.map((salesman: any) => (
                              <SelectItem key={salesman.combined} value={salesman.combined}>
                                {salesman.name} ({salesman.code})
                              </SelectItem>
                            ))
                          ) : (
                            <div className="py-2 px-3 text-sm text-gray-500">No salesmen available</div>
                          )}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Performance" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all">All Performance Levels</SelectItem>
                      <SelectItem value="high">Top Performers (&gt;50K AED)</SelectItem>
                      <SelectItem value="medium">Average Performers (10K-50K AED)</SelectItem>
                      <SelectItem value="low">Need Support (&lt;10K AED)</SelectItem>
                      <SelectItem value="active">Active Routes Only</SelectItem>
                      <SelectItem value="productive">High Productivity (&gt;80%)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="sales">Total Sales Revenue</SelectItem>
                      <SelectItem value="orders">Number of Orders</SelectItem>
                      <SelectItem value="productivity">Visit Productivity %</SelectItem>
                      <SelectItem value="customers">Unique Customers</SelectItem>
                      <SelectItem value="avgOrderValue">Average Order Value</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortOrder} onValueChange={setSortOrder}>
                    <SelectTrigger>
                      <SelectValue placeholder="Order" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="desc">Best Performance First</SelectItem>
                      <SelectItem value="asc">Needs Attention First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  Showing {((currentPage - 1) * itemsPerPage) + 1}-{((currentPage - 1) * itemsPerPage) + (paginatedRouteData?.length || 0)} of {totalCount} routes
                  {searchTerm || routeFilter !== 'all' || salesmanFilter !== 'all' || cityFilter !== 'all' || performanceFilter !== 'all' ? (
                    <span className="text-gray-400"> (filtered)</span>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Route Code</TableHead>
                        <TableHead>Route Name</TableHead>
                        <TableHead>Salesman Name</TableHead>
                        <TableHead>Salesman Code</TableHead>
                        <TableHead>Sales</TableHead>
                        <TableHead>Total Orders</TableHead>
                        <TableHead>Visits (Productive/Total)</TableHead>
                        <TableHead>Unique Customers</TableHead>
                        <TableHead>Productivity (% Productive)</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRouteData.map((route: any, index: number) => (
                        <TableRow key={`${route.routeCode}-${route.salesmanCode}-${index}`}>
                          <TableCell className="font-medium text-blue-600">
                            {route.routeCode}
                          </TableCell>
                          <TableCell className="font-medium">
                            {route.routeName || route.routeCode || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {route.salesmanName}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {route.salesmanCode || 'N/A'}
                          </TableCell>
                          <TableCell className="font-semibold">
                            AED {(route.totalSales30d || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>{route.totalOrders30d || 0}</TableCell>
                          <TableCell>
                            <span className="text-green-600 font-medium">
                              {route.productiveVisits || 0}/{route.totalVisits || 0}
                            </span>
                          </TableCell>
                          <TableCell>{route.uniqueCustomers || 0}</TableCell>
                          <TableCell>
                            <Badge variant={
                              route.productivity >= 80 ? 'default' :
                              route.productivity >= 60 ? 'secondary' : 'destructive'
                            }>
                              {route.productivity || 0}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRouteCode(route.routeCode)
                                setShowOrderDetails(true)
                              }}
                            >
                              View Orders
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 px-4 py-3 border-t">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-700">Show</span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(value) => {
                          setItemsPerPage(Number(value))
                          setCurrentPage(1)
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-gray-700">per page</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>

                      <span className="text-sm text-gray-700">
                        Page {currentPage} of {totalPages}
                      </span>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

export default DynamicScalableSalesAnalysis