'use client'

import React, { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ComposedChart, Area } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  PackageX, AlertTriangle, RefreshCw, Loader2,
  AlertCircle, BarChart3, Calendar, DollarSign, FileText, HelpCircle, Download, ListFilter
} from 'lucide-react'
import { businessColors } from '@/styles/businessColors'
import { useResponsive } from '@/hooks/useResponsive'
import ExcelJS from 'exceljs'

export function ReturnsWastage() {
  const [activeTab, setActiveTab] = useState('return-reasons')
  const [dateRange, setDateRange] = useState('lastMonth')
  const [selectedRegion, setSelectedRegion] = useState('all')
  const [selectedSalesman, setSelectedSalesman] = useState('all')
  const [selectedRoute, setSelectedRoute] = useState('all')
  const { isMobile} = useResponsive()

  // State for data
  const [data, setData] = useState<any>(null)
  const [filters, setFilters] = useState<any>({ regions: [], salesmen: [], routes: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Pagination state for SKU Return % table
  const [skuCurrentPage, setSkuCurrentPage] = useState(1)
  const skuItemsPerPage = 20

  // Pagination state for Return on Sales by Salesman table
  const [rosCurrentPage, setRosCurrentPage] = useState(1)
  const rosItemsPerPage = 20

  // Pagination state for Good Returns Detail table
  const [goodReturnsCurrentPage, setGoodReturnsCurrentPage] = useState(1)
  const goodReturnsItemsPerPage = 20

  // Pagination state for Bad Returns Detail table
  const [badReturnsCurrentPage, setBadReturnsCurrentPage] = useState(1)
  const badReturnsItemsPerPage = 20

  // Fetch filter options when date range changes
  useEffect(() => {
    fetchFilters()
    setSelectedRegion('all')
    setSelectedSalesman('all')
    setSelectedRoute('all')
  }, [dateRange])

  // Fetch filter options when region changes (cascading filter)
  useEffect(() => {
    if (selectedRegion !== 'all') {
      fetchFilters()
      setSelectedSalesman('all')
      setSelectedRoute('all')
    }
  }, [selectedRegion])

  // Fetch data when filters change
  useEffect(() => {
    fetchData()
  }, [dateRange, selectedRegion, selectedSalesman, selectedRoute])

  // Reset SKU pagination when data changes
  useEffect(() => {
    setSkuCurrentPage(1)
  }, [data])

  // Reset ROS pagination when data changes
  useEffect(() => {
    setRosCurrentPage(1)
  }, [data])

  const fetchFilters = async () => {
    try {
      const params = new URLSearchParams({
        range: dateRange,
        region: selectedRegion
      })
      const response = await fetch(`/api/returns-wastage/filters?${params}`, {
        // Enable Next.js caching for filter options
        next: {
          revalidate: 300, // Cache for 5 minutes
          tags: ['returns-wastage-filters']
        }
      })
      const result = await response.json()
      if (result.success) {
        setFilters({
          regions: result.regions || [],
          salesmen: result.salesmen || [],
          routes: result.routes || []
        })
      }
    } catch (error) {
      console.error('Error fetching filters:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        range: dateRange,
        region: selectedRegion,
        salesman: selectedSalesman,
        route: selectedRoute
      })

      const response = await fetch(`/api/returns-wastage?${params}`, {
        // Enable Next.js caching for data
        next: {
          revalidate: 300, // Cache for 5 minutes
          tags: ['returns-wastage']
        }
      })
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    // Invalidate cache and refetch
    await fetch('/api/returns-wastage', {
      method: 'POST',
      cache: 'no-store' // Don't cache the POST request
    })
    // Force fresh data fetch by adding cache-busting timestamp
    const timestamp = Date.now()
    const params = new URLSearchParams({
      range: dateRange,
      region: selectedRegion,
      salesman: selectedSalesman,
      route: selectedRoute,
      _t: timestamp.toString()
    })
    const response = await fetch(`/api/returns-wastage?${params}`, {
      cache: 'no-store' // Force fresh fetch on manual refresh
    })
    const result = await response.json()
    if (result.success) {
      setData(result.data)
    }
    setRefreshing(false)
  }

  const formatCurrency = (value: number, currencyCode: string = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2
    }).format(value)
  }

  // Helper to get region full name from code
  const getRegionName = (code: string): string => {
    const regionNames: { [key: string]: string } = {
      'AUH': 'Abu Dhabi',
      'DXB': 'Dubai',
      'SHJ': 'Sharjah',
      'RAK': 'Ras Al Khaimah',
      'FUJ': 'Fujairah',
      'AJM': 'Ajman',
      'AIN': 'Al Ain',
      'UAQ': 'Umm Al Quwain',
      'all': 'All Regions'
    }
    return regionNames[code] || code
  }

  // Helper to get currency code from data
  const getCurrency = () => {
    return data?.returnReasons?.summary?.currency_code ||
           data?.periodReturns?.summary?.currency_code ||
           data?.skuReturnPercentage?.summary?.currency_code ||
           data?.returnOnSales?.summary?.currency_code ||
           'AED'
  }

  // Wrapper that automatically uses the data's currency
  const formatValue = (value: number) => {
    return formatCurrency(value, getCurrency())
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  const exportToExcel = async () => {
    if (!data?.returnReasons?.byProduct) return

    const currency = getCurrency()
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Top Returned Products')

    // Set column widths
    worksheet.columns = [
      { width: 10 },  // Rank
      { width: 12 },  // Category
      { width: 15 },  // Product Code
      { width: 35 },  // Product Name
      { width: 25 },  // Reason
      { width: 12 },  // Count
      { width: 18 },  // Value
      { width: 12 }   // Quantity
    ]

    let currentRow = 1

    // Add title row
    const titleRow = worksheet.addRow(['Returns & Wastage Analysis - Top 20 Returned Products'])
    titleRow.font = { size: 16, bold: true, color: { argb: 'FF1F2937' } }
    titleRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
    titleRow.height = 35
    titleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' }
    }
    currentRow++

    // Add date and filter info
    const dateRangeLabels: { [key: string]: string } = {
      'today': 'Today',
      'yesterday': 'Yesterday',
      'thisWeek': 'This Week',
      'thisMonth': 'This Month',
      'lastMonth': 'Last Month',
      'thisQuarter': 'This Quarter',
      'thisYear': 'This Year'
    }

    const selectedSalesmanName = selectedSalesman === 'all' ? 'All Salesmen' :
      filters.salesmen.find((s: any) => s.code === selectedSalesman)?.name || selectedSalesman
    const selectedRouteName = selectedRoute === 'all' ? 'All Routes' :
      filters.routes.find((r: any) => r.code === selectedRoute)?.name || selectedRoute
    const selectedRegionName = getRegionName(selectedRegion)

    const infoRow1 = worksheet.addRow([`Date Range: ${dateRangeLabels[dateRange] || dateRange}`, '', '', '', '', '', '', `Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`])
    infoRow1.font = { size: 10, italic: true }
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`)
    worksheet.mergeCells(`E${currentRow}:H${currentRow}`)
    infoRow1.getCell(8).alignment = { horizontal: 'right' }
    currentRow++

    const infoRow2 = worksheet.addRow([`Region: ${selectedRegionName}`, '', '', '', `Salesman: ${selectedSalesmanName}`])
    infoRow2.font = { size: 10, italic: true }
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`)
    worksheet.mergeCells(`E${currentRow}:H${currentRow}`)
    currentRow++

    const infoRow3 = worksheet.addRow([`Route: ${selectedRouteName}`])
    infoRow2.font = { size: 10, italic: true }
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`)
    worksheet.mergeCells(`E${currentRow}:H${currentRow}`)
    currentRow++

    // Add empty row
    worksheet.addRow([])
    currentRow++

    // Add Summary Section Header
    const summaryHeaderRow = worksheet.addRow(['RETURNS SUMMARY'])
    summaryHeaderRow.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    summaryHeaderRow.alignment = { horizontal: 'center' }
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
    summaryHeaderRow.height = 25
    summaryHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    }
    currentRow++

    // Calculate percentages
    const goodPercent = ((parseFloat(data?.returnReasons?.summary?.good_return_count || 0) / parseFloat(data?.returnReasons?.summary?.total_return_count || 1)) * 100).toFixed(1)
    const badPercent = ((parseFloat(data?.returnReasons?.summary?.bad_return_count || 0) / parseFloat(data?.returnReasons?.summary?.total_return_count || 1)) * 100).toFixed(1)
    const goodValuePercent = ((parseFloat(data?.returnReasons?.summary?.good_return_value || 0) / parseFloat(data?.returnReasons?.summary?.total_return_value || 1)) * 100).toFixed(1)
    const badValuePercent = ((parseFloat(data?.returnReasons?.summary?.bad_return_value || 0) / parseFloat(data?.returnReasons?.summary?.total_return_value || 1)) * 100).toFixed(1)

    // Good Returns Summary
    const goodSummaryRow = worksheet.addRow([
      'GOOD RETURNS (Sellable)',
      '',
      `Count: ${formatNumber(data?.returnReasons?.summary?.good_return_count || 0)}`,
      `(${goodPercent}%)`,
      `Value: ${formatValue(data?.returnReasons?.summary?.good_return_value || 0)}`,
      `(${goodValuePercent}%)`,
      `Qty: ${formatNumber(data?.returnReasons?.summary?.good_return_qty || 0)}`
    ])
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`)
    goodSummaryRow.font = { bold: true }
    goodSummaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD1FAE5' }
    }
    goodSummaryRow.getCell(1).font = { bold: true, color: { argb: 'FF047857' } }
    currentRow++

    // Bad Returns Summary
    const badSummaryRow = worksheet.addRow([
      'BAD RETURNS (Wastage)',
      '',
      `Count: ${formatNumber(data?.returnReasons?.summary?.bad_return_count || 0)}`,
      `(${badPercent}%)`,
      `Value: ${formatValue(data?.returnReasons?.summary?.bad_return_value || 0)}`,
      `(${badValuePercent}%)`,
      `Qty: ${formatNumber(data?.returnReasons?.summary?.bad_return_qty || 0)}`
    ])
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`)
    badSummaryRow.font = { bold: true }
    badSummaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFECACA' }
    }
    badSummaryRow.getCell(1).font = { bold: true, color: { argb: 'FFDC2626' } }
    currentRow++

    // Total Returns Summary
    const totalSummaryRow = worksheet.addRow([
      'TOTAL RETURNS',
      '',
      `Count: ${formatNumber(data?.returnReasons?.summary?.total_return_count || 0)}`,
      '(100%)',
      `Value: ${formatValue(data?.returnReasons?.summary?.total_return_value || 0)}`,
      '(100%)',
      `Qty: ${formatNumber(data?.returnReasons?.summary?.total_return_qty || 0)}`
    ])
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`)
    totalSummaryRow.font = { bold: true }
    totalSummaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' }
    }
    totalSummaryRow.getCell(1).font = { bold: true, color: { argb: 'FF1F2937' } }
    currentRow++

    // Add empty rows
    worksheet.addRow([])
    currentRow++
    worksheet.addRow([])
    currentRow++

    // Add header row
    const headers = ['Rank', 'Category', 'Product Code', 'Product Name', 'Reason', 'Count', `Value (${currency})`, 'Quantity']
    const headerRow = worksheet.addRow(headers)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
    headerRow.height = 25

    // Add data rows
    data.returnReasons.byProduct.forEach((item: any, idx: number) => {
      const row = worksheet.addRow([
        idx + 1,
        item.return_category,
        item.product_code,
        item.product_name,
        item.reason,
        parseInt(item.return_count),
        parseFloat(item.return_value),
        parseFloat(item.return_qty)
      ])

      // Style based on category
      if (item.return_category === 'GOOD') {
        row.getCell(2).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1FAE5' }
        }
        row.getCell(2).font = { color: { argb: 'FF047857' }, bold: true }
      } else {
        row.getCell(2).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFECACA' }
        }
        row.getCell(2).font = { color: { argb: 'FFDC2626' }, bold: true }
      }

      // Format value column as currency
      row.getCell(7).numFmt = '#,##0.00'
      row.getCell(7).alignment = { horizontal: 'right' }

      // Format count and quantity columns as numbers
      row.getCell(6).numFmt = '#,##0'
      row.getCell(6).alignment = { horizontal: 'right' }
      row.getCell(8).numFmt = '#,##0'
      row.getCell(8).alignment = { horizontal: 'right' }

      // Center rank and category
      row.getCell(1).alignment = { horizontal: 'center' }
      row.getCell(2).alignment = { horizontal: 'center' }

      // Medal colors for top 3
      if (idx === 0) {
        row.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF59E0B' } // Gold
        }
        row.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      } else if (idx === 1) {
        row.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF9CA3AF' } // Silver
        }
        row.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      } else if (idx === 2) {
        row.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEA580C' } // Bronze
        }
        row.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      }
    })

    // Add borders to summary and data sections
    worksheet.eachRow((row, rowNumber) => {
      // Add borders to summary section (rows 5-8) and data section (from currentRow onwards)
      if ((rowNumber >= 5 && rowNumber <= 8) || rowNumber >= currentRow) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        })
      }
    })

    // Generate and download file
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // Create descriptive filename
    const salesmanPart = selectedSalesman === 'all' ? 'AllSalesmen' : selectedSalesman
    const routePart = selectedRoute === 'all' ? 'AllRoutes' : selectedRoute
    link.download = `Returns_Analysis_${dateRangeLabels[dateRange]?.replace(/\s+/g, '')}_${salesmanPart}_${routePart}_${new Date().toISOString().split('T')[0]}.xlsx`

    link.click()
    window.URL.revokeObjectURL(url)
  }

  const exportPeriodReturnsToExcel = async () => {
    try {
      console.log('Starting Period Returns Excel export...')

      if (!data?.periodReturns) {
        console.error('No period returns data available')
        alert('No data available to export. Please ensure the report has loaded.')
        return
      }

      console.log('Data available:', {
        byProduct: data.periodReturns.byProduct?.length || 0,
        byCategory: data.periodReturns.byCategory?.length || 0,
        dailyTrend: data.periodReturns.dailyTrend?.length || 0
      })

      const currency = getCurrency()
      const workbook = new ExcelJS.Workbook()

    // ============ SHEET 1: PERIOD SUMMARY ============
    const summarySheet = workbook.addWorksheet('Period Summary')
    summarySheet.columns = [
      { width: 30 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 }
    ]

    let row = 1

    // Title
    const titleRow = summarySheet.addRow(['Period Returns Analysis - Summary'])
    titleRow.font = { size: 16, bold: true, color: { argb: 'FF1F2937' } }
    titleRow.alignment = { horizontal: 'center' }
    summarySheet.mergeCells(`A${row}:E${row}`)
    titleRow.height = 35
    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    row++

    // Date and filter info
    const dateRangeLabels: { [key: string]: string } = {
      'today': 'Today', 'yesterday': 'Yesterday', 'thisWeek': 'This Week',
      'thisMonth': 'This Month', 'lastMonth': 'Last Month', 'thisQuarter': 'This Quarter',
      'lastQuarter': 'Last Quarter', 'thisYear': 'This Year'
    }

    const selectedSalesmanName = selectedSalesman === 'all' ? 'All Salesmen' :
      filters.salesmen.find((s: any) => s.code === selectedSalesman)?.name || selectedSalesman
    const selectedRouteName = selectedRoute === 'all' ? 'All Routes' :
      filters.routes.find((r: any) => r.code === selectedRoute)?.name || selectedRoute
    const selectedRegionName = getRegionName(selectedRegion)

    const infoRow1 = summarySheet.addRow([`Date Range: ${dateRangeLabels[dateRange] || dateRange}`, '', '', '', `Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`])
    infoRow1.font = { size: 10, italic: true }
    summarySheet.mergeCells(`A${row}:C${row}`)
    summarySheet.mergeCells(`D${row}:E${row}`)
    infoRow1.getCell(5).alignment = { horizontal: 'right' }
    row++

    const infoRow2 = summarySheet.addRow([`Region: ${selectedRegionName}`, '', '', `Salesman: ${selectedSalesmanName}`])
    infoRow2.font = { size: 10, italic: true }
    summarySheet.mergeCells(`A${row}:C${row}`)
    summarySheet.mergeCells(`D${row}:E${row}`)
    row++

    const infoRow3 = summarySheet.addRow([`Route: ${selectedRouteName}`])
    infoRow2.font = { size: 10, italic: true }
    summarySheet.mergeCells(`A${row}:C${row}`)
    summarySheet.mergeCells(`D${row}:E${row}`)
    row++

    summarySheet.addRow([])
    row++

    // Sales vs Returns Section
    const salesVsHeader = summarySheet.addRow(['SALES VS RETURNS ANALYSIS'])
    salesVsHeader.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    salesVsHeader.alignment = { horizontal: 'center' }
    summarySheet.mergeCells(`A${row}:E${row}`)
    salesVsHeader.height = 25
    salesVsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    row++

    const salesData = [
      ['Total Sales', formatValue(data?.periodReturns?.summary?.sale_value || 0), '', '', ''],
      ['Total Returns', formatValue(data?.periodReturns?.summary?.return_value || 0), '', '', ''],
      ['Net Sales', formatValue(data?.periodReturns?.summary?.net_sales_value || 0), '', '', ''],
      ['Return Rate', `${data?.periodReturns?.summary?.return_percentage || 0}%`, '', '', '']
    ]
    salesData.forEach((rowData) => {
      const r = summarySheet.addRow(rowData)
      r.font = { bold: true }
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
      r.getCell(2).alignment = { horizontal: 'right' }
      r.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      }
      row++
    })

    summarySheet.addRow([])
    row++

    // Good vs Bad Returns Section
    const goodBadHeader = summarySheet.addRow(['GOOD VS BAD RETURNS BREAKDOWN'])
    goodBadHeader.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    goodBadHeader.alignment = { horizontal: 'center' }
    summarySheet.mergeCells(`A${row}:E${row}`)
    goodBadHeader.height = 25
    goodBadHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    row++

    const summary = data?.periodReturns?.summary || {}

    const goodRow = summarySheet.addRow([
      'GOOD RETURNS (Sellable)',
      `Count: ${formatNumber(summary.good_return_count || 0)}`,
      `Value: ${formatValue(summary.good_return_value || 0)}`,
      `Qty: ${formatNumber(summary.return_qty || 0)}`,
      ''
    ])
    goodRow.font = { bold: true }
    goodRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
    goodRow.getCell(1).font = { bold: true, color: { argb: 'FF047857' } }
    row++

    const badRow = summarySheet.addRow([
      'BAD RETURNS (Wastage)',
      `Count: ${formatNumber(summary.bad_return_count || 0)}`,
      `Value: ${formatValue(summary.bad_return_value || 0)}`,
      `Qty: ${formatNumber(summary.return_qty || 0)}`,
      ''
    ])
    badRow.font = { bold: true }
    badRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } }
    badRow.getCell(1).font = { bold: true, color: { argb: 'FFDC2626' } }
    row++

    const totalRow = summarySheet.addRow([
      'TOTAL RETURNS',
      `Count: ${formatNumber(summary.return_count || 0)}`,
      `Value: ${formatValue(summary.return_value || 0)}`,
      `Qty: ${formatNumber(summary.return_qty || 0)}`,
      ''
    ])
    totalRow.font = { bold: true }
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
    totalRow.getCell(1).font = { bold: true, color: { argb: 'FF1F2937' } }

    console.log('✓ Sheet 1 (Period Summary) created')

    // ============ SHEET 2: TOP 20 PRODUCTS ============
    const productsSheet = workbook.addWorksheet('Top 20 Products')
    productsSheet.columns = [
      { width: 8 },   // Rank
      { width: 30 },  // Product
      { width: 18 },  // Brand
      { width: 18 },  // Category
      { width: 12 },  // Qty
      { width: 15 },  // Total Value
      { width: 15 },  // Good Value
      { width: 12 },  // Good Txns
      { width: 15 },  // Bad Value
      { width: 12 },  // Bad Txns
      { width: 10 }   // Transactions
    ]

    row = 1

    const prodTitleRow = productsSheet.addRow(['Top 20 Returned Products - Good vs Bad Breakdown'])
    prodTitleRow.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } }
    prodTitleRow.alignment = { horizontal: 'center' }
    productsSheet.mergeCells(`A${row}:K${row}`)
    prodTitleRow.height = 30
    prodTitleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    row++

    productsSheet.addRow([])
    row++

    const prodHeaders = ['Rank', 'Product Name', 'Brand', 'Category', 'Qty Returned', 'Total Value', 'Good Value', 'Good Txns', 'Bad Value', 'Bad Txns', 'Total Txns']
    const prodHeaderRow = productsSheet.addRow(prodHeaders)
    prodHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    prodHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    prodHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' }
    prodHeaderRow.height = 25
    row++

    data.periodReturns.byProduct?.forEach((item: any, idx: number) => {
      const dataRow = productsSheet.addRow([
        idx + 1,
        item.product_name,
        item.brand || 'N/A',
        item.category_name || 'N/A',
        parseInt(item.return_qty),
        parseFloat(item.return_value),
        parseFloat(item.good_return_value || 0),
        parseInt(item.good_return_count || 0),
        parseFloat(item.bad_return_value || 0),
        parseInt(item.bad_return_count || 0),
        parseInt(item.return_count)
      ])

      // Format numbers
      dataRow.getCell(5).numFmt = '#,##0'
      dataRow.getCell(5).alignment = { horizontal: 'right' }
      dataRow.getCell(6).numFmt = '#,##0.00'
      dataRow.getCell(6).alignment = { horizontal: 'right' }
      dataRow.getCell(7).numFmt = '#,##0.00'
      dataRow.getCell(7).alignment = { horizontal: 'right' }
      dataRow.getCell(8).numFmt = '#,##0'
      dataRow.getCell(8).alignment = { horizontal: 'right' }
      dataRow.getCell(9).numFmt = '#,##0.00'
      dataRow.getCell(9).alignment = { horizontal: 'right' }
      dataRow.getCell(10).numFmt = '#,##0'
      dataRow.getCell(10).alignment = { horizontal: 'right' }
      dataRow.getCell(11).numFmt = '#,##0'
      dataRow.getCell(11).alignment = { horizontal: 'right' }

      // Color Good/Bad columns
      dataRow.getCell(7).font = { color: { argb: 'FF047857' }, bold: true }
      dataRow.getCell(8).font = { color: { argb: 'FF047857' } }
      dataRow.getCell(9).font = { color: { argb: 'FFDC2626' }, bold: true }
      dataRow.getCell(10).font = { color: { argb: 'FFDC2626' } }

      // Medal colors for top 3
      if (idx === 0) {
        dataRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } }
        dataRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      } else if (idx === 1) {
        dataRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9CA3AF' } }
        dataRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      } else if (idx === 2) {
        dataRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } }
        dataRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      }

      dataRow.getCell(1).alignment = { horizontal: 'center' }

      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        }
      })
    })

    console.log('✓ Sheet 2 (Top 20 Products) created with', data.periodReturns.byProduct?.length || 0, 'products')

    // ============ SHEET 3: RETURNS BY CATEGORY ============
    const categorySheet = workbook.addWorksheet('Returns by Category')
    categorySheet.columns = [
      { width: 20 },  // Category
      { width: 12 },  // Qty
      { width: 15 },  // Total Value
      { width: 15 },  // Good Value
      { width: 12 },  // Good Txns
      { width: 15 },  // Bad Value
      { width: 12 },  // Bad Txns
      { width: 12 },  // Transactions
      { width: 12 }   // % of Total
    ]

    row = 1

    const catTitleRow = categorySheet.addRow(['Returns by Category - Good vs Bad Breakdown'])
    catTitleRow.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } }
    catTitleRow.alignment = { horizontal: 'center' }
    categorySheet.mergeCells(`A${row}:I${row}`)
    catTitleRow.height = 30
    catTitleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    row++

    categorySheet.addRow([])
    row++

    const catHeaders = ['Category', 'Qty Returned', 'Total Value', 'Good Value', 'Good Txns', 'Bad Value', 'Bad Txns', 'Total Txns', '% of Total']
    const catHeaderRow = categorySheet.addRow(catHeaders)
    catHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    catHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    catHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' }
    catHeaderRow.height = 25
    row++

    const totalReturnValue = data.periodReturns.byCategory?.reduce((sum: number, item: any) => sum + parseFloat(item.return_value || 0), 0) || 1

    data.periodReturns.byCategory?.forEach((item: any) => {
      const percentage = ((parseFloat(item.return_value || 0) / totalReturnValue) * 100).toFixed(1)
      const dataRow = categorySheet.addRow([
        item.category_name,
        parseInt(item.return_qty),
        parseFloat(item.return_value),
        parseFloat(item.good_return_value || 0),
        parseInt(item.good_return_count || 0),
        parseFloat(item.bad_return_value || 0),
        parseInt(item.bad_return_count || 0),
        parseInt(item.return_count),
        `${percentage}%`
      ])

      // Format numbers
      dataRow.getCell(2).numFmt = '#,##0'
      dataRow.getCell(2).alignment = { horizontal: 'right' }
      dataRow.getCell(3).numFmt = '#,##0.00'
      dataRow.getCell(3).alignment = { horizontal: 'right' }
      dataRow.getCell(4).numFmt = '#,##0.00'
      dataRow.getCell(4).alignment = { horizontal: 'right' }
      dataRow.getCell(5).numFmt = '#,##0'
      dataRow.getCell(5).alignment = { horizontal: 'right' }
      dataRow.getCell(6).numFmt = '#,##0.00'
      dataRow.getCell(6).alignment = { horizontal: 'right' }
      dataRow.getCell(7).numFmt = '#,##0'
      dataRow.getCell(7).alignment = { horizontal: 'right' }
      dataRow.getCell(8).numFmt = '#,##0'
      dataRow.getCell(8).alignment = { horizontal: 'right' }
      dataRow.getCell(9).alignment = { horizontal: 'right' }

      // Color Good/Bad columns
      dataRow.getCell(4).font = { color: { argb: 'FF047857' }, bold: true }
      dataRow.getCell(5).font = { color: { argb: 'FF047857' } }
      dataRow.getCell(6).font = { color: { argb: 'FFDC2626' }, bold: true }
      dataRow.getCell(7).font = { color: { argb: 'FFDC2626' } }

      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        }
      })
    })

    console.log('✓ Sheet 3 (Returns by Category) created with', data.periodReturns.byCategory?.length || 0, 'categories')

    // ============ SHEET 4: DAILY TREND ============
    const trendSheet = workbook.addWorksheet('Daily Trend')
    trendSheet.columns = [
      { width: 12 },  // Date
      { width: 15 },  // Good Count
      { width: 15 },  // Bad Count
      { width: 15 },  // Total Value
      { width: 15 }   // Total Qty
    ]

    row = 1

    const trendTitleRow = trendSheet.addRow(['Daily Return Trend - Good vs Bad'])
    trendTitleRow.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } }
    trendTitleRow.alignment = { horizontal: 'center' }
    trendSheet.mergeCells(`A${row}:E${row}`)
    trendTitleRow.height = 30
    trendTitleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    row++

    trendSheet.addRow([])
    row++

    const trendHeaders = ['Date', 'Good Returns Count', 'Bad Returns Count', `Total Value (${currency})`, 'Total Quantity']
    const trendHeaderRow = trendSheet.addRow(trendHeaders)
    trendHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    trendHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    trendHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' }
    trendHeaderRow.height = 25
    row++

    data.periodReturns.dailyTrend?.forEach((item: any) => {
      const dataRow = trendSheet.addRow([
        item.date,
        parseInt(item.good_return_count || 0),
        parseInt(item.bad_return_count || 0),
        parseFloat(item.return_value || 0),
        parseInt(item.return_qty || 0)
      ])

      dataRow.getCell(2).numFmt = '#,##0'
      dataRow.getCell(2).alignment = { horizontal: 'right' }
      dataRow.getCell(2).font = { color: { argb: 'FF047857' } }
      dataRow.getCell(3).numFmt = '#,##0'
      dataRow.getCell(3).alignment = { horizontal: 'right' }
      dataRow.getCell(3).font = { color: { argb: 'FFDC2626' } }
      dataRow.getCell(4).numFmt = '#,##0.00'
      dataRow.getCell(4).alignment = { horizontal: 'right' }
      dataRow.getCell(5).numFmt = '#,##0'
      dataRow.getCell(5).alignment = { horizontal: 'right' }

      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        }
      })
    })

    console.log('✓ Sheet 4 (Daily Trend) created with', data.periodReturns.dailyTrend?.length || 0, 'days')

      // Generate and download
      console.log('Generating Excel workbook with', workbook.worksheets.length, 'sheets')
      console.log('Sheet names:', workbook.worksheets.map(ws => ws.name))

      const buffer = await workbook.xlsx.writeBuffer()
      console.log('Excel buffer generated, size:', buffer.byteLength, 'bytes')

      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      const salesmanPart = selectedSalesman === 'all' ? 'AllSalesmen' : selectedSalesman
      const routePart = selectedRoute === 'all' ? 'AllRoutes' : selectedRoute
      const dateLabel = dateRangeLabels[dateRange]?.replace(/\s+/g, '') || 'Custom'
      const filename = `Period_Returns_${dateLabel}_${salesmanPart}_${routePart}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.download = filename

      console.log('Downloading file:', filename)
      link.click()
      window.URL.revokeObjectURL(url)
      console.log('Excel export completed successfully!')

    } catch (error) {
      console.error('Error exporting Period Returns to Excel:', error)
      alert(`Failed to export Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const exportWeeklyHistoryToExcel = async () => {
    try {
      console.log('Starting Weekly History Excel export...')

      if (!data?.weeklyHistory?.data || data.weeklyHistory.data.length === 0) {
        console.error('No weekly history data available')
        alert('No data available to export. Please ensure the report has loaded.')
        return
      }

      console.log('Data available:', {
        weeks: data.weeklyHistory.data.length
      })

      const currency = getCurrency()
      const workbook = new ExcelJS.Workbook()

      // ============ SHEET 1: SUMMARY ============
      const summarySheet = workbook.addWorksheet('Summary')
      summarySheet.columns = [
        { width: 30 },
        { width: 18 },
        { width: 18 },
        { width: 18 }
      ]

      let row = 1

      // Title
      const titleRow = summarySheet.addRow(['Weekly Returns History - Summary'])
      titleRow.font = { size: 16, bold: true, color: { argb: 'FF1F2937' } }
      titleRow.alignment = { horizontal: 'center' }
      summarySheet.mergeCells(`A${row}:D${row}`)
      titleRow.height = 35
      titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      row++

      // Date and filter info
      const dateRangeLabels: { [key: string]: string } = {
        'today': 'Today', 'yesterday': 'Yesterday', 'thisWeek': 'This Week',
        'thisMonth': 'This Month', 'lastMonth': 'Last Month', 'thisQuarter': 'This Quarter',
        'lastQuarter': 'Last Quarter', 'thisYear': 'This Year'
      }

      const selectedSalesmanName = selectedSalesman === 'all' ? 'All Salesmen' :
        filters.salesmen.find((s: any) => s.code === selectedSalesman)?.name || selectedSalesman
      const selectedRouteName = selectedRoute === 'all' ? 'All Routes' :
        filters.routes.find((r: any) => r.code === selectedRoute)?.name || selectedRoute
      const selectedRegionName = getRegionName(selectedRegion)

      const infoRow1 = summarySheet.addRow([`Date Range: ${dateRangeLabels[dateRange] || dateRange}`, '', '', `Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`])
      infoRow1.font = { size: 10, italic: true }
      summarySheet.mergeCells(`A${row}:B${row}`)
      summarySheet.mergeCells(`C${row}:D${row}`)
      infoRow1.getCell(3).alignment = { horizontal: 'right' }
      row++

      const infoRow2 = summarySheet.addRow([`Region: ${selectedRegionName}`, '', `Salesman: ${selectedSalesmanName}`])
      infoRow2.font = { size: 10, italic: true }
      summarySheet.mergeCells(`A${row}:B${row}`)
      summarySheet.mergeCells(`C${row}:D${row}`)
      row++

      const infoRow3 = summarySheet.addRow([`Route: ${selectedRouteName}`])
      infoRow3.font = { size: 10, italic: true }
      summarySheet.mergeCells(`A${row}:B${row}`)
      summarySheet.mergeCells(`C${row}:D${row}`)
      row++

      summarySheet.addRow([])
      row++

      // Calculate summary statistics - Convert string values to numbers
      const weeks = data.weeklyHistory.data
      const totalWeeks = weeks.length
      const totalReturnValue = weeks.reduce((sum: number, w: any) => sum + Number(w.return_value || 0), 0)
      const avgWeeklyReturns = totalWeeks > 0 ? totalReturnValue / totalWeeks : 0
      const peakWeek = weeks.reduce((max: any, w: any) => Number(w.return_value || 0) > Number(max.return_value || 0) ? w : max, weeks[0] || {})
      const totalGoodReturns = weeks.reduce((sum: number, w: any) => sum + Number(w.good_return_value || 0), 0)
      const totalBadReturns = weeks.reduce((sum: number, w: any) => sum + Number(w.bad_return_value || 0), 0)

      // Key Metrics Section
      const metricsHeader = summarySheet.addRow(['KEY METRICS'])
      metricsHeader.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
      metricsHeader.alignment = { horizontal: 'center' }
      summarySheet.mergeCells(`A${row}:D${row}`)
      metricsHeader.height = 25
      metricsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
      row++

      const metricsData = [
        ['Total Weeks Tracked', totalWeeks.toString(), '', ''],
        ['Average Weekly Returns', formatValue(avgWeeklyReturns), '', ''],
        ['Peak Week Returns', formatValue(peakWeek.return_value || 0), `Week of ${peakWeek.week_start || 'N/A'}`, '']
      ]
      metricsData.forEach((rowData) => {
        const r = summarySheet.addRow(rowData)
        r.font = { bold: true }
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
        r.getCell(2).alignment = { horizontal: 'right' }
        r.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        }
        row++
      })

      summarySheet.addRow([])
      row++

      // Good vs Bad Returns Section
      const goodBadHeader = summarySheet.addRow(['GOOD VS BAD RETURNS BREAKDOWN'])
      goodBadHeader.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
      goodBadHeader.alignment = { horizontal: 'center' }
      summarySheet.mergeCells(`A${row}:D${row}`)
      goodBadHeader.height = 25
      goodBadHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
      row++

      const goodRow = summarySheet.addRow([
        'GOOD RETURNS (Sellable)',
        formatValue(totalGoodReturns),
        `${(totalReturnValue > 0 ? (totalGoodReturns / totalReturnValue) * 100 : 0).toFixed(1)}% of Total`,
        ''
      ])
      goodRow.font = { bold: true }
      goodRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
      goodRow.getCell(1).font = { bold: true, color: { argb: 'FF047857' } }
      row++

      const badRow = summarySheet.addRow([
        'BAD RETURNS (Wastage)',
        formatValue(totalBadReturns),
        `${(totalReturnValue > 0 ? (totalBadReturns / totalReturnValue) * 100 : 0).toFixed(1)}% of Total`,
        ''
      ])
      badRow.font = { bold: true }
      badRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } }
      badRow.getCell(1).font = { bold: true, color: { argb: 'FFDC2626' } }
      row++

      const totalRow = summarySheet.addRow([
        'TOTAL RETURNS',
        formatValue(totalReturnValue),
        '100% of Total',
        ''
      ])
      totalRow.font = { bold: true }
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
      totalRow.getCell(1).font = { bold: true, color: { argb: 'FF1F2937' } }

      console.log('✓ Sheet 1 (Summary) created')

      // ============ SHEET 2: WEEKLY DATA ============
      const weeklySheet = workbook.addWorksheet('Weekly Data')
      weeklySheet.columns = [
        { width: 12 },  // Week Start
        { width: 12 },  // Week End
        { width: 14 },  // Total Returns
        { width: 12 },  // Return Qty
        { width: 14 },  // Good Returns
        { width: 12 },  // Good Count
        { width: 14 },  // Bad Returns
        { width: 12 },  // Bad Count
        { width: 12 },  // Transactions
        { width: 12 },  // Products
        { width: 12 }   // Salesmen
      ]

      row = 1

      // Title
      const weeklyTitleRow = weeklySheet.addRow(['Weekly Returns Data'])
      weeklyTitleRow.font = { size: 16, bold: true, color: { argb: 'FF1F2937' } }
      weeklyTitleRow.alignment = { horizontal: 'center' }
      weeklySheet.mergeCells(`A${row}:K${row}`)
      weeklyTitleRow.height = 35
      weeklyTitleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      row++

      // Date and filter info
      const weeklyInfoRow1 = weeklySheet.addRow([`Date Range: ${dateRangeLabels[dateRange] || dateRange}`, '', '', '', '', '', '', '', '', '', `Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`])
      weeklyInfoRow1.font = { size: 10, italic: true }
      weeklySheet.mergeCells(`A${row}:E${row}`)
      weeklySheet.mergeCells(`F${row}:K${row}`)
      weeklyInfoRow1.getCell(6).alignment = { horizontal: 'right' }
      row++

      const weeklyInfoRow2 = weeklySheet.addRow([`Salesman: ${selectedSalesmanName}`, '', '', '', '', `Route: ${selectedRouteName}`])
      weeklyInfoRow2.font = { size: 10, italic: true }
      weeklySheet.mergeCells(`A${row}:E${row}`)
      weeklySheet.mergeCells(`F${row}:K${row}`)
      row++

      weeklySheet.addRow([])
      row++

      // Header row
      const headerRow = weeklySheet.addRow([
        'Week Start',
        'Week End',
        'Total Returns',
        'Return Qty',
        'Good Returns',
        'Good Txns',
        'Bad Returns',
        'Bad Txns',
        'Total Txns',
        'Products',
        'Salesmen'
      ])
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25
      row++

      // Data rows - Convert string values to numbers
      weeks.forEach((week: any) => {
        const dataRow = weeklySheet.addRow([
          week.week_start || '',
          week.week_end || '',
          Number(week.return_value || 0),
          Number(week.return_qty || 0),
          Number(week.good_return_value || 0),
          Number(week.good_return_count || 0),
          Number(week.bad_return_value || 0),
          Number(week.bad_return_count || 0),
          Number(week.return_count || 0),
          Number(week.unique_products || 0),
          Number(week.unique_salesmen || 0)
        ])

        // Format currency columns
        dataRow.getCell(3).numFmt = '#,##0.00'
        dataRow.getCell(5).numFmt = '#,##0.00'
        dataRow.getCell(7).numFmt = '#,##0.00'

        // Color code Good/Bad columns
        dataRow.getCell(5).font = { color: { argb: 'FF047857' } }
        dataRow.getCell(6).font = { color: { argb: 'FF047857' } }
        dataRow.getCell(7).font = { color: { argb: 'FFDC2626' } }
        dataRow.getCell(8).font = { color: { argb: 'FFDC2626' } }

        // Align numbers to right
        for (let i = 3; i <= 11; i++) {
          dataRow.getCell(i).alignment = { horizontal: 'right' }
        }

        // Zebra striping
        if (row % 2 === 0) {
          dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
        }

        row++
      })

      console.log('✓ Sheet 2 (Weekly Data) created with', weeks.length, 'weeks')

      // Generate and download
      console.log('Generating Excel workbook with', workbook.worksheets.length, 'sheets')
      console.log('Sheet names:', workbook.worksheets.map(ws => ws.name))

      const buffer = await workbook.xlsx.writeBuffer()
      console.log('Excel buffer generated, size:', buffer.byteLength, 'bytes')

      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      const salesmanPart = selectedSalesman === 'all' ? 'AllSalesmen' : selectedSalesman
      const routePart = selectedRoute === 'all' ? 'AllRoutes' : selectedRoute
      const dateLabel = dateRangeLabels[dateRange]?.replace(/\s+/g, '') || 'Custom'
      const filename = `Weekly_History_${dateLabel}_${salesmanPart}_${routePart}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.download = filename

      console.log('Downloading file:', filename)
      link.click()
      window.URL.revokeObjectURL(url)
      console.log('Excel export completed successfully!')

    } catch (error) {
      console.error('Error exporting Weekly History to Excel:', error)
      alert(`Failed to export Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const exportSKUReturnToExcel = async () => {
    try {
      console.log('Starting SKU Return % Excel export...')

      if (!data?.skuReturnPercentage?.data || data.skuReturnPercentage.data.length === 0) {
        console.error('No SKU return data available')
        alert('No data available to export. Please ensure the report has loaded.')
        return
      }

      console.log('Data available:', {
        products: data.skuReturnPercentage.data.length
      })

      const workbook = new ExcelJS.Workbook()

      // ============ SHEET 1: SUMMARY ============
      const summarySheet = workbook.addWorksheet('Summary')
      summarySheet.columns = [
        { width: 30 },
        { width: 18 },
        { width: 18 },
        { width: 18 }
      ]

      let row = 1

      // Title
      const titleRow = summarySheet.addRow(['SKU Return % Analysis - Summary'])
      titleRow.font = { size: 16, bold: true, color: { argb: 'FF1F2937' } }
      titleRow.alignment = { horizontal: 'center' }
      summarySheet.mergeCells(`A${row}:D${row}`)
      titleRow.height = 35
      titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      row++

      // Date and filter info
      const dateRangeLabels: { [key: string]: string } = {
        'today': 'Today', 'yesterday': 'Yesterday', 'thisWeek': 'This Week',
        'thisMonth': 'This Month', 'lastMonth': 'Last Month', 'thisQuarter': 'This Quarter',
        'lastQuarter': 'Last Quarter', 'thisYear': 'This Year'
      }

      const selectedSalesmanName = selectedSalesman === 'all' ? 'All Salesmen' :
        filters.salesmen.find((s: any) => s.code === selectedSalesman)?.name || selectedSalesman
      const selectedRouteName = selectedRoute === 'all' ? 'All Routes' :
        filters.routes.find((r: any) => r.code === selectedRoute)?.name || selectedRoute
      const selectedRegionName = getRegionName(selectedRegion)

      const infoRow1 = summarySheet.addRow([`Date Range: ${dateRangeLabels[dateRange] || dateRange}`, '', '', `Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`])
      infoRow1.font = { size: 10, italic: true }
      summarySheet.mergeCells(`A${row}:B${row}`)
      summarySheet.mergeCells(`C${row}:D${row}`)
      infoRow1.getCell(3).alignment = { horizontal: 'right' }
      row++

      const infoRow2 = summarySheet.addRow([`Region: ${selectedRegionName}`, '', `Salesman: ${selectedSalesmanName}`])
      infoRow2.font = { size: 10, italic: true }
      summarySheet.mergeCells(`A${row}:B${row}`)
      summarySheet.mergeCells(`C${row}:D${row}`)
      row++

      const infoRow3 = summarySheet.addRow([`Route: ${selectedRouteName}`])
      infoRow3.font = { size: 10, italic: true }
      summarySheet.mergeCells(`A${row}:B${row}`)
      summarySheet.mergeCells(`C${row}:D${row}`)
      row++

      summarySheet.addRow([])
      row++

      const summary = data.skuReturnPercentage.summary || {}

      // Key Metrics Section
      const metricsHeader = summarySheet.addRow(['KEY METRICS'])
      metricsHeader.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
      metricsHeader.alignment = { horizontal: 'center' }
      summarySheet.mergeCells(`A${row}:D${row}`)
      metricsHeader.height = 25
      metricsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
      row++

      const metricsData = [
        ['Return Rate (Units)', `${summary.overall_return_percentage || 0}%`, '', ''],
        ['Net Sales Value', formatValue(summary.net_sales_value || 0), '', ''],
        ['Total Units Returned', formatNumber(summary.total_returned || 0), '', ''],
        ['Total Return Value', formatValue(summary.total_return_value || 0), '', '']
      ]
      metricsData.forEach((rowData) => {
        const r = summarySheet.addRow(rowData)
        r.font = { bold: true }
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
        r.getCell(2).alignment = { horizontal: 'right' }
        r.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        }
        row++
      })

      summarySheet.addRow([])
      row++

      // Good vs Bad Returns Section
      const goodBadHeader = summarySheet.addRow(['GOOD VS BAD RETURNS BREAKDOWN'])
      goodBadHeader.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
      goodBadHeader.alignment = { horizontal: 'center' }
      summarySheet.mergeCells(`A${row}:D${row}`)
      goodBadHeader.height = 25
      goodBadHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
      row++

      const goodRow = summarySheet.addRow([
        'GOOD RETURNS (Sellable)',
        `${formatNumber(summary.good_returned || 0)} units`,
        formatValue(summary.good_return_value || 0),
        ''
      ])
      goodRow.font = { bold: true }
      goodRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
      goodRow.getCell(1).font = { bold: true, color: { argb: 'FF047857' } }
      row++

      const badRow = summarySheet.addRow([
        'BAD RETURNS (Wastage)',
        `${formatNumber(summary.bad_returned || 0)} units`,
        formatValue(summary.bad_return_value || 0),
        ''
      ])
      badRow.font = { bold: true }
      badRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } }
      badRow.getCell(1).font = { bold: true, color: { argb: 'FFDC2626' } }
      row++

      const totalRow = summarySheet.addRow([
        'TOTAL RETURNS',
        `${formatNumber(summary.total_returned || 0)} units`,
        formatValue(summary.total_return_value || 0),
        ''
      ])
      totalRow.font = { bold: true }
      totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
      totalRow.getCell(1).font = { bold: true, color: { argb: 'FF1F2937' } }

      console.log('✓ Sheet 1 (Summary) created')

      // ============ SHEET 2: PRODUCTS DATA ============
      const productsSheet = workbook.addWorksheet('Products Data')
      productsSheet.columns = [
        { width: 15 },  // Product Code
        { width: 35 },  // Product Name
        { width: 20 },  // Category
        { width: 12 },  // Sold
        { width: 12 },  // Returned
        { width: 10 },  // Return %
        { width: 14 },  // Good Returns
        { width: 14 },  // Good Value
        { width: 14 },  // Bad Returns
        { width: 14 },  // Bad Value
        { width: 14 }   // Total Value
      ]

      row = 1

      // Title
      const productsTitleRow = productsSheet.addRow(['SKU Return % - Products Data'])
      productsTitleRow.font = { size: 16, bold: true, color: { argb: 'FF1F2937' } }
      productsTitleRow.alignment = { horizontal: 'center' }
      productsSheet.mergeCells(`A${row}:K${row}`)
      productsTitleRow.height = 35
      productsTitleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      row++

      // Date and filter info
      const productsInfoRow1 = productsSheet.addRow([`Date Range: ${dateRangeLabels[dateRange] || dateRange}`, '', '', '', '', '', '', '', '', '', `Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`])
      productsInfoRow1.font = { size: 10, italic: true }
      productsSheet.mergeCells(`A${row}:E${row}`)
      productsSheet.mergeCells(`F${row}:K${row}`)
      productsInfoRow1.getCell(6).alignment = { horizontal: 'right' }
      row++

      const productsInfoRow2 = productsSheet.addRow([`Salesman: ${selectedSalesmanName}`, '', '', '', '', `Route: ${selectedRouteName}`])
      productsInfoRow2.font = { size: 10, italic: true }
      productsSheet.mergeCells(`A${row}:E${row}`)
      productsSheet.mergeCells(`F${row}:K${row}`)
      row++

      productsSheet.addRow([])
      row++

      // Header row
      const headerRow = productsSheet.addRow([
        'Product Code',
        'Product Name',
        'Category',
        'Sold (Units)',
        'Returned',
        'Return %',
        'Good Returns',
        'Good Value',
        'Bad Returns',
        'Bad Value',
        'Total Value'
      ])
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25
      row++

      // Data rows - Convert string values to numbers
      const products = data.skuReturnPercentage.data
      products.forEach((product: any) => {
        const dataRow = productsSheet.addRow([
          product.product_code || '',
          product.product_name || '',
          product.category_name || '',
          Number(product.total_sold || 0),
          Number(product.total_returned || 0),
          Number(product.return_percentage || 0),
          Number(product.good_returned || 0),
          Number(product.good_return_value || 0),
          Number(product.bad_returned || 0),
          Number(product.bad_return_value || 0),
          Number(product.return_value || 0)
        ])

        // Format currency columns
        dataRow.getCell(8).numFmt = '#,##0.00'
        dataRow.getCell(10).numFmt = '#,##0.00'
        dataRow.getCell(11).numFmt = '#,##0.00'

        // Color code Good/Bad columns
        dataRow.getCell(7).font = { color: { argb: 'FF047857' } }
        dataRow.getCell(8).font = { color: { argb: 'FF047857' } }
        dataRow.getCell(9).font = { color: { argb: 'FFDC2626' } }
        dataRow.getCell(10).font = { color: { argb: 'FFDC2626' } }

        // Align numbers to right
        for (let i = 4; i <= 11; i++) {
          dataRow.getCell(i).alignment = { horizontal: 'right' }
        }

        // Zebra striping
        if (row % 2 === 0) {
          dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
        }

        row++
      })

      console.log('✓ Sheet 2 (Products Data) created with', products.length, 'products')

      // Generate and download
      console.log('Generating Excel workbook with', workbook.worksheets.length, 'sheets')
      console.log('Sheet names:', workbook.worksheets.map(ws => ws.name))

      const buffer = await workbook.xlsx.writeBuffer()
      console.log('Excel buffer generated, size:', buffer.byteLength, 'bytes')

      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      const salesmanPart = selectedSalesman === 'all' ? 'AllSalesmen' : selectedSalesman
      const routePart = selectedRoute === 'all' ? 'AllRoutes' : selectedRoute
      const dateLabel = dateRangeLabels[dateRange]?.replace(/\s+/g, '') || 'Custom'
      const filename = `SKU_Return_Percentage_${dateLabel}_${salesmanPart}_${routePart}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.download = filename

      console.log('Downloading file:', filename)
      link.click()
      window.URL.revokeObjectURL(url)
      console.log('Excel export completed successfully!')

    } catch (error) {
      console.error('Error exporting SKU Return % to Excel:', error)
      alert(`Failed to export Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const exportReturnOnSalesToExcel = async () => {
    try {
      if (!data?.returnOnSales?.data || data.returnOnSales.data.length === 0) {
        alert('No data available to export.')
        return
      }

      const currency = getCurrency()
      const workbook = new ExcelJS.Workbook()
      const salesmen = data.returnOnSales.data // Use full dataset, bypass pagination
      const summary = data.returnOnSales.summary

      // ===== SHEET 1: SUMMARY =====
      const summarySheet = workbook.addWorksheet('Summary')
      summarySheet.columns = [
        { key: 'metric', width: 35 },
        { key: 'value', width: 20 },
        { key: 'percentage', width: 20 },
        { key: 'count', width: 15 }
      ]

      // Date and filter info
      const dateRangeLabels: { [key: string]: string } = {
        'today': 'Today', 'yesterday': 'Yesterday', 'thisWeek': 'This Week',
        'thisMonth': 'This Month', 'lastMonth': 'Last Month', 'thisQuarter': 'This Quarter',
        'lastQuarter': 'Last Quarter', 'thisYear': 'This Year'
      }

      const selectedSalesmanName = selectedSalesman === 'all' ? 'All Salesmen' :
        filters.salesmen.find((s: any) => s.code === selectedSalesman)?.name || selectedSalesman
      const selectedRouteName = selectedRoute === 'all' ? 'All Routes' :
        filters.routes.find((r: any) => r.code === selectedRoute)?.name || selectedRoute
      const selectedRegionName = getRegionName(selectedRegion)

      summarySheet.addRow(['Generated:', new Date().toLocaleString()])
      summarySheet.addRow(['Date Range:', dateRangeLabels[dateRange] || dateRange])
      summarySheet.addRow(['Region:', selectedRegionName])
      summarySheet.addRow(['Salesman Filter:', selectedSalesmanName])
      summarySheet.addRow(['Route Filter:', selectedRouteName])
      summarySheet.addRow([])

      // Key Metrics - Convert string values to numbers
      summarySheet.addRow(['KEY METRICS', '', '', ''])
      summarySheet.addRow(['Total Sales', formatValue(summary?.total_sales || 0), '', ''])
      summarySheet.addRow(['Total Returns', formatValue(summary?.total_returns || 0), '', ''])
      summarySheet.addRow(['Net Sales', formatValue(summary?.net_sales || 0), '', ''])
      summarySheet.addRow(['Overall Return Rate', '', `${Number(summary?.return_percentage || 0).toFixed(2)}%`, ''])
      summarySheet.addRow(['Salesmen with Returns', '', '', salesmen.length])
      summarySheet.addRow([])

      // Good vs Bad Returns Breakdown - Convert string values to numbers
      summarySheet.addRow(['GOOD VS BAD RETURNS BREAKDOWN', '', '', ''])
      const totalReturns = Number(summary?.total_returns || 0)
      const goodReturns = Number(summary?.good_return_value || 0)
      const badReturns = Number(summary?.bad_return_value || 0)
      const goodCount = Number(summary?.good_return_count || 0)
      const badCount = Number(summary?.bad_return_count || 0)

      summarySheet.addRow([
        'GOOD RETURNS (Sellable)',
        formatValue(goodReturns),
        `${(totalReturns > 0 ? (goodReturns / totalReturns) * 100 : 0).toFixed(1)}% of Total`,
        `${goodCount} transactions`
      ])
      summarySheet.addRow([
        'BAD RETURNS (Wastage)',
        formatValue(badReturns),
        `${(totalReturns > 0 ? (badReturns / totalReturns) * 100 : 0).toFixed(1)}% of Total`,
        `${badCount} transactions`
      ])
      summarySheet.addRow([
        'TOTAL RETURNS',
        formatValue(totalReturns),
        '100% of Total',
        ''
      ])

      summarySheet.addRow([])

      // Important Note about Negative Net Sales
      summarySheet.addRow(['IMPORTANT NOTE: UNDERSTANDING NEGATIVE NET SALES', '', '', ''])
      summarySheet.addRow([
        'What does negative net sales mean?',
        'Negative net sales occur when returns processed in the selected period exceed sales in that same period.',
        '',
        ''
      ])
      summarySheet.addRow([
        'Why does this happen?',
        'This is normal when customers return items that were purchased in previous months.',
        '',
        ''
      ])
      summarySheet.addRow([
        'Example:',
        `If a salesman had ${currency} 77,936 in sales during September but processed ${currency} 289,043 in returns (from items sold in July/August), their net sales will be -${currency} 211,107.`,
        '',
        ''
      ])
      summarySheet.addRow([
        'Key Point:',
        'This report shows sales and returns PROCESSED in the selected period, not necessarily from items sold in that period.',
        '',
        ''
      ])

      // Style the summary sheet
      summarySheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FFFFFF' } }
      summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EA580C' } }
      summarySheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' }

      summarySheet.getRow(8).font = { bold: true, size: 12, color: { argb: 'FFFFFF' } }
      summarySheet.getRow(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '64748B' } }

      // Highlight good/bad returns
      summarySheet.getRow(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } }
      summarySheet.getRow(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } }
      summarySheet.getRow(11).font = { bold: true }

      // Style the Important Note section
      const noteHeaderRow = summarySheet.getRow(13)
      noteHeaderRow.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } }
      noteHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F59E0B' } }
      summarySheet.mergeCells('A13:D13')

      // Style note content rows with amber background
      for (let i = 14; i <= 17; i++) {
        const row = summarySheet.getRow(i)
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } }
        row.getCell(1).font = { bold: true }
        summarySheet.mergeCells(`B${i}:D${i}`)
        row.getCell(2).alignment = { wrapText: true, vertical: 'top' }
      }

      // ===== SHEET 2: SALESMAN DATA =====
      const dataSheet = workbook.addWorksheet('Salesman Data')
      dataSheet.columns = [
        { header: 'Salesman Code', key: 'salesman_code', width: 15 },
        { header: 'Salesman Name', key: 'salesman_name', width: 25 },
        { header: 'Route Code', key: 'route_code', width: 12 },
        { header: `Total Sales (${currency})`, key: 'total_sales', width: 18 },
        { header: `Good Returns (${currency})`, key: 'good_return_value', width: 18 },
        { header: 'Good Return Count', key: 'good_return_count', width: 18 },
        { header: `Bad Returns (${currency})`, key: 'bad_return_value', width: 18 },
        { header: 'Bad Return Count', key: 'bad_return_count', width: 18 },
        { header: `Total Returns (${currency})`, key: 'total_returns', width: 18 },
        { header: `Net Sales (${currency})`, key: 'net_sales', width: 18 },
        { header: 'Return %', key: 'return_percentage', width: 12 }
      ]

      // Add all salesmen data (bypassing pagination) - Convert string values to numbers
      salesmen.forEach((salesman: any) => {
        dataSheet.addRow({
          salesman_code: salesman.salesman_code || '',
          salesman_name: salesman.salesman_name || '',
          route_code: salesman.route_code || '',
          total_sales: Number(salesman.total_sales || 0),
          good_return_value: Number(salesman.good_return_value || 0),
          good_return_count: Number(salesman.good_return_count || 0),
          bad_return_value: Number(salesman.bad_return_value || 0),
          bad_return_count: Number(salesman.bad_return_count || 0),
          total_returns: Number(salesman.total_returns || 0),
          net_sales: Number(salesman.net_sales || 0),
          return_percentage: Number(salesman.return_percentage || 0)
        })
      })

      // Format currency columns
      dataSheet.getColumn('total_sales').numFmt = '#,##0.00'
      dataSheet.getColumn('good_return_value').numFmt = '#,##0.00'
      dataSheet.getColumn('bad_return_value').numFmt = '#,##0.00'
      dataSheet.getColumn('total_returns').numFmt = '#,##0.00'
      dataSheet.getColumn('net_sales').numFmt = '#,##0.00'
      dataSheet.getColumn('return_percentage').numFmt = '0.00"%"'

      // Style header row
      const headerRow = dataSheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EA580C' } }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
      headerRow.height = 25

      // Add borders to all cells
      dataSheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'CCCCCC' } },
            left: { style: 'thin', color: { argb: 'CCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
            right: { style: 'thin', color: { argb: 'CCCCCC' } }
          }
          if (rowNumber > 1) {
            cell.alignment = { vertical: 'middle', horizontal: rowNumber === 1 ? 'center' : 'left' }
          }
        })
      })

      // Generate and download the file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Return_on_Sales_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      console.log('Excel export completed successfully!')

    } catch (error) {
      console.error('Error exporting Return on Sales to Excel:', error)
      alert(`Failed to export Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Excel export for Good Returns (Sellable products)
  const exportGoodReturnsToExcel = async () => {
    try {
      if (!data?.goodReturnsDetail?.data || data.goodReturnsDetail.data.length === 0) {
        alert('No good returns data available to export.')
        return
      }

      const currency = getCurrency()
      const workbook = new ExcelJS.Workbook()
      const transactions = data.goodReturnsDetail.data

      // Calculate summary metrics
      const totalQty = transactions.reduce((sum: number, row: any) => sum + (Number(row.quantity) || 0), 0)
      const totalValue = transactions.reduce((sum: number, row: any) => sum + (Number(row.return_value) || 0), 0)
      const uniqueSalesmen = new Set(transactions.map((r: any) => r.salesman_code)).size
      const uniqueCustomers = new Set(transactions.map((r: any) => r.customer_code)).size
      const uniqueProducts = new Set(transactions.map((r: any) => r.product_code)).size

      // ===== SHEET 1: SUMMARY =====
      const summarySheet = workbook.addWorksheet('Summary')
      summarySheet.columns = [
        { key: 'metric', width: 40 },
        { key: 'value', width: 25 }
      ]

      // Title
      const titleRow = summarySheet.addRow(['GOOD RETURNS (SELLABLE) - SUMMARY REPORT'])
      titleRow.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      titleRow.alignment = { horizontal: 'center' }
      titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
      titleRow.height = 35
      summarySheet.mergeCells('A1:B1')

      // Filter info
      const dateRangeLabels: { [key: string]: string } = {
        'today': 'Today', 'yesterday': 'Yesterday', 'thisWeek': 'This Week',
        'thisMonth': 'This Month', 'lastMonth': 'Last Month', 'thisQuarter': 'This Quarter',
        'lastQuarter': 'Last Quarter', 'thisYear': 'This Year'
      }
      const selectedSalesmanName = selectedSalesman === 'all' ? 'All Salesmen' :
        filters.salesmen.find((s: any) => s.code === selectedSalesman)?.name || selectedSalesman
      const selectedRouteName = selectedRoute === 'all' ? 'All Routes' :
        filters.routes.find((r: any) => r.code === selectedRoute)?.name || selectedRoute
      const selectedRegionName = getRegionName(selectedRegion)

      summarySheet.addRow(['Generated:', new Date().toLocaleString()])
      summarySheet.addRow(['Date Range:', dateRangeLabels[dateRange] || dateRange])
      summarySheet.addRow(['Region:', selectedRegionName])
      summarySheet.addRow(['Salesman Filter:', selectedSalesmanName])
      summarySheet.addRow(['Route Filter:', selectedRouteName])
      summarySheet.addRow([])

      // Key Metrics
      const metricsHeader = summarySheet.addRow(['KEY METRICS', ''])
      metricsHeader.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
      metricsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
      metricsHeader.height = 25

      summarySheet.addRow(['Total Transactions', formatNumber(transactions.length)])
      summarySheet.addRow(['Total Quantity Returned', formatNumber(totalQty) + ' units'])
      summarySheet.addRow(['Total Return Value', formatCurrency(totalValue, currency)])
      summarySheet.addRow(['Average Return per Transaction', formatCurrency(totalValue / transactions.length, currency)])
      summarySheet.addRow(['Unique Salesmen', formatNumber(uniqueSalesmen)])
      summarySheet.addRow(['Unique Customers', formatNumber(uniqueCustomers)])
      summarySheet.addRow(['Unique Products', formatNumber(uniqueProducts)])

      // Add note
      summarySheet.addRow([])
      const noteRow = summarySheet.addRow(['NOTE: Good returns are sellable products that can be restocked and resold.'])
      noteRow.font = { italic: true, color: { argb: 'FF059669' } }
      noteRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
      summarySheet.mergeCells(`A${noteRow.number}:B${noteRow.number}`)

      // ===== SHEET 2: DETAILED TRANSACTIONS =====
      const detailSheet = workbook.addWorksheet('Good Returns Transactions')
      detailSheet.columns = [
        { header: 'Transaction Code', key: 'trx_code', width: 18 },
        { header: 'Date', key: 'trx_date', width: 14 },
        { header: 'Salesman Code', key: 'salesman_code', width: 14 },
        { header: 'Salesman Name', key: 'salesman_name', width: 25 },
        { header: 'Route Code', key: 'route_code', width: 12 },
        { header: 'Customer Code', key: 'customer_code', width: 14 },
        { header: 'Customer Name', key: 'customer_name', width: 30 },
        { header: 'Product Code', key: 'product_code', width: 14 },
        { header: 'Product Name', key: 'product_name', width: 35 },
        { header: 'Category', key: 'category_name', width: 20 },
        { header: 'Brand', key: 'brand', width: 20 },
        { header: 'Return Reason', key: 'return_reason', width: 30 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: `Value (${currency})`, key: 'return_value', width: 15 }
      ]

      // Style header row
      const headerRow = detailSheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25

      // Add data
      transactions.forEach((row: any) => {
        detailSheet.addRow({
          trx_code: row.trx_code || '',
          trx_date: row.trx_date || '',
          salesman_code: row.salesman_code || '',
          salesman_name: row.salesman_name || '',
          route_code: row.route_code || '',
          customer_code: row.customer_code || '',
          customer_name: row.customer_name || '',
          product_code: row.product_code || '',
          product_name: row.product_name || '',
          category_name: row.category_name || '',
          brand: row.brand || '',
          return_reason: row.return_reason || 'No Reason Specified',
          quantity: Number(row.quantity) || 0,
          return_value: Number(row.return_value) || 0
        })
      })

      // Format number columns
      detailSheet.getColumn('quantity').numFmt = '#,##0'
      detailSheet.getColumn('return_value').numFmt = '#,##0.00'

      // Add borders to all cells
      detailSheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
          }
        })
      })

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Good_Returns_Sellable_${dateRange}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)

      console.log('Good Returns Excel export completed successfully!')

    } catch (error) {
      console.error('Error exporting Good Returns to Excel:', error)
      alert(`Failed to export Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Excel export for Bad Returns (Wastage)
  const exportBadReturnsToExcel = async () => {
    try {
      if (!data?.badReturnsDetail?.data || data.badReturnsDetail.data.length === 0) {
        alert('No bad returns data available to export.')
        return
      }

      const currency = getCurrency()
      const workbook = new ExcelJS.Workbook()
      const transactions = data.badReturnsDetail.data

      // Calculate summary metrics
      const totalQty = transactions.reduce((sum: number, row: any) => sum + (Number(row.quantity) || 0), 0)
      const totalValue = transactions.reduce((sum: number, row: any) => sum + (Number(row.return_value) || 0), 0)
      const uniqueSalesmen = new Set(transactions.map((r: any) => r.salesman_code)).size
      const uniqueCustomers = new Set(transactions.map((r: any) => r.customer_code)).size
      const uniqueProducts = new Set(transactions.map((r: any) => r.product_code)).size

      // ===== SHEET 1: SUMMARY =====
      const summarySheet = workbook.addWorksheet('Summary')
      summarySheet.columns = [
        { key: 'metric', width: 40 },
        { key: 'value', width: 25 }
      ]

      // Title
      const titleRow = summarySheet.addRow(['BAD RETURNS (WASTAGE) - SUMMARY REPORT'])
      titleRow.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      titleRow.alignment = { horizontal: 'center' }
      titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }
      titleRow.height = 35
      summarySheet.mergeCells('A1:B1')

      // Filter info
      const dateRangeLabels: { [key: string]: string } = {
        'today': 'Today', 'yesterday': 'Yesterday', 'thisWeek': 'This Week',
        'thisMonth': 'This Month', 'lastMonth': 'Last Month', 'thisQuarter': 'This Quarter',
        'lastQuarter': 'Last Quarter', 'thisYear': 'This Year'
      }
      const selectedSalesmanName = selectedSalesman === 'all' ? 'All Salesmen' :
        filters.salesmen.find((s: any) => s.code === selectedSalesman)?.name || selectedSalesman
      const selectedRouteName = selectedRoute === 'all' ? 'All Routes' :
        filters.routes.find((r: any) => r.code === selectedRoute)?.name || selectedRoute
      const selectedRegionName = getRegionName(selectedRegion)

      summarySheet.addRow(['Generated:', new Date().toLocaleString()])
      summarySheet.addRow(['Date Range:', dateRangeLabels[dateRange] || dateRange])
      summarySheet.addRow(['Region:', selectedRegionName])
      summarySheet.addRow(['Salesman Filter:', selectedSalesmanName])
      summarySheet.addRow(['Route Filter:', selectedRouteName])
      summarySheet.addRow([])

      // Key Metrics
      const metricsHeader = summarySheet.addRow(['KEY METRICS', ''])
      metricsHeader.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
      metricsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }
      metricsHeader.height = 25

      summarySheet.addRow(['Total Transactions', formatNumber(transactions.length)])
      summarySheet.addRow(['Total Quantity Wasted', formatNumber(totalQty) + ' units'])
      summarySheet.addRow(['Total Wastage Value', formatCurrency(totalValue, currency)])
      summarySheet.addRow(['Average Wastage per Transaction', formatCurrency(totalValue / transactions.length, currency)])
      summarySheet.addRow(['Unique Salesmen', formatNumber(uniqueSalesmen)])
      summarySheet.addRow(['Unique Customers', formatNumber(uniqueCustomers)])
      summarySheet.addRow(['Unique Products', formatNumber(uniqueProducts)])

      // Add note
      summarySheet.addRow([])
      const noteRow = summarySheet.addRow(['WARNING: Bad returns are damaged/expired products that cannot be resold. This represents direct loss.'])
      noteRow.font = { italic: true, bold: true, color: { argb: 'FFDC2626' } }
      noteRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } }
      summarySheet.mergeCells(`A${noteRow.number}:B${noteRow.number}`)

      // ===== SHEET 2: DETAILED TRANSACTIONS =====
      const detailSheet = workbook.addWorksheet('Bad Returns Transactions')
      detailSheet.columns = [
        { header: 'Transaction Code', key: 'trx_code', width: 18 },
        { header: 'Date', key: 'trx_date', width: 14 },
        { header: 'Salesman Code', key: 'salesman_code', width: 14 },
        { header: 'Salesman Name', key: 'salesman_name', width: 25 },
        { header: 'Route Code', key: 'route_code', width: 12 },
        { header: 'Customer Code', key: 'customer_code', width: 14 },
        { header: 'Customer Name', key: 'customer_name', width: 30 },
        { header: 'Product Code', key: 'product_code', width: 14 },
        { header: 'Product Name', key: 'product_name', width: 35 },
        { header: 'Category', key: 'category_name', width: 20 },
        { header: 'Brand', key: 'brand', width: 20 },
        { header: 'Return Reason', key: 'return_reason', width: 30 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: `Value (${currency})`, key: 'return_value', width: 15 }
      ]

      // Style header row
      const headerRow = detailSheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25

      // Add data
      transactions.forEach((row: any) => {
        detailSheet.addRow({
          trx_code: row.trx_code || '',
          trx_date: row.trx_date || '',
          salesman_code: row.salesman_code || '',
          salesman_name: row.salesman_name || '',
          route_code: row.route_code || '',
          customer_code: row.customer_code || '',
          customer_name: row.customer_name || '',
          product_code: row.product_code || '',
          product_name: row.product_name || '',
          category_name: row.category_name || '',
          brand: row.brand || '',
          return_reason: row.return_reason || 'No Reason Specified',
          quantity: Number(row.quantity) || 0,
          return_value: Number(row.return_value) || 0
        })
      })

      // Format number columns
      detailSheet.getColumn('quantity').numFmt = '#,##0'
      detailSheet.getColumn('return_value').numFmt = '#,##0.00'

      // Add borders to all cells
      detailSheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
          }
        })
      })

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Bad_Returns_Wastage_${dateRange}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)

      console.log('Bad Returns Excel export completed successfully!')

    } catch (error) {
      console.error('Error exporting Bad Returns to Excel:', error)
      alert(`Failed to export Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const tabs = [
    { id: 'return-reasons', label: 'Return Reasons', icon: FileText },
    { id: 'mtd-returns', label: 'Period Returns', icon: PackageX },
    { id: 'weekly-history', label: 'Weekly History', icon: Calendar },
    { id: 'sku-return', label: 'SKU Return %', icon: BarChart3 },
    { id: 'return-on-sales', label: 'Return on Sales', icon: DollarSign },
    { id: 'good-bad-details', label: 'Good/Bad Returns Details', icon: ListFilter }
  ]

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 max-md:p-4 max-sm:p-3">
      {/* Header */}
      <div className="mb-6 max-md:mb-4">
        <div className="flex items-center justify-between gap-4 mb-6 max-md:flex-col max-md:items-start max-md:gap-3 max-md:mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2 max-md:text-2xl max-sm:text-xl">
              <AlertTriangle className="w-7 h-7 text-orange-600 max-sm:w-6 max-sm:h-6" />
              Returns & Wastage
            </h1>
            <p className="text-base text-slate-600 mt-1 max-sm:text-sm">Track product returns and potential wastage</p>
          </div>

          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-orange-600 hover:bg-orange-700 text-white max-md:w-full"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Filters</h3>
            {loading && (
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Loading data...</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Region <span className="text-xs text-slate-500 font-normal">(Available: {filters.regions.length})</span>
              </label>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  <SelectItem value="all">All Regions</SelectItem>
                  {filters.regions.map((r: any, idx: number) => (
                    <SelectItem key={`region-${r.code}-${idx}`} value={r.code}>
                      {getRegionName(r.code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-full">
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

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Salesman <span className="text-xs text-slate-500 font-normal">(Available: {filters.salesmen.length})</span>
              </label>
              <Select value={selectedSalesman} onValueChange={setSelectedSalesman}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  <SelectItem value="all">All Salesmen</SelectItem>
                  {filters.salesmen.map((s: any, idx: number) => (
                    <SelectItem key={`salesman-${s.code}-${idx}`} value={s.code}>
                      {s.code} - {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Route <span className="text-xs text-slate-500 font-normal">(Available: {filters.routes.length})</span>
              </label>
              <Select value={selectedRoute} onValueChange={setSelectedRoute}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  <SelectItem value="all">All Routes</SelectItem>
                  {filters.routes.map((r: any, idx: number) => (
                    <SelectItem key={`route-${r.code}-${idx}`} value={r.code}>
                      {r.code === r.name ? r.code : `${r.code} - ${r.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex gap-3 flex-wrap w-full h-auto bg-white p-4 rounded-lg shadow-sm mb-6 max-md:grid max-md:grid-cols-2 max-md:gap-3 max-md:mb-4 max-sm:gap-2 max-sm:p-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-3 py-4 px-8 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 font-semibold transition-all text-lg whitespace-nowrap max-md:flex-col max-md:py-5 max-md:px-4 max-md:min-h-[90px] max-md:text-sm max-sm:py-4 max-sm:px-2 max-sm:min-h-[80px] max-sm:text-xs"
              >
                <Icon className="w-7 h-7 max-md:mb-1 max-sm:w-6 max-sm:h-6" />
                <span className="max-md:text-center max-md:leading-tight">{tab.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* Return Reasons Analysis - NEW FIRST TAB */}
        <TabsContent value="return-reasons">
          <div className="space-y-6 max-md:space-y-4">
            {/* Consolidated Summary Cards */}
            <TooltipProvider>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Good Returns Card */}
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500 text-white">GOOD</Badge>
                      Sellable Returns
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold">GOOD Returns (Sellable)</p>
                          <p><strong>What it means:</strong> Products returned in sellable condition (collection_type = 1). These can be restocked and resold.</p>
                          <p><strong>Calculation:</strong></p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>Count: {formatNumber(data?.returnReasons?.summary?.good_return_count || 0)} return transactions where collection_type = 1</li>
                            <li>Value: Sum of all GOOD return amounts = {formatValue(data?.returnReasons?.summary?.good_return_value || 0)}</li>
                            <li>Percentage: {formatNumber(data?.returnReasons?.summary?.good_return_count || 0)} ÷ {formatNumber(data?.returnReasons?.summary?.total_return_count || 1)} × 100 = {((parseFloat(data?.returnReasons?.summary?.good_return_count || 0) / parseFloat(data?.returnReasons?.summary?.total_return_count || 1)) * 100).toFixed(1)}%</li>
                          </ul>
                          <p><strong>Measured by:</strong> Transaction COUNT (not money value)</p>
                          <p className="text-green-600">✓ No financial loss - can be resold</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-green-600 max-sm:text-2xl">
                      {formatNumber(data?.returnReasons?.summary?.good_return_count || 0)}
                    </div>
                    <p className="text-xs text-slate-500">return transactions</p>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-lg font-semibold text-slate-700">
                      {formatValue(data?.returnReasons?.summary?.good_return_value || 0)}
                    </div>
                    <p className="text-xs text-slate-500">total value</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {((parseFloat(data?.returnReasons?.summary?.good_return_count || 0) /
                         parseFloat(data?.returnReasons?.summary?.total_return_count || 1)) * 100).toFixed(1)}% of all returns
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatNumber(data?.returnReasons?.summary?.good_return_qty || 0)} units returned
                  </div>
                </CardContent>
              </Card>

              {/* Bad Returns Card */}
              <Card className="border-l-4 border-l-red-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-500 text-white">BAD</Badge>
                      Damaged/Expired
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold">BAD Returns (Wastage)</p>
                          <p><strong>What it means:</strong> Products returned damaged, expired, or unsellable (collection_type = 0). These result in financial loss.</p>
                          <p><strong>Calculation:</strong></p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>Count: {formatNumber(data?.returnReasons?.summary?.bad_return_count || 0)} return transactions where collection_type = 0</li>
                            <li>Wastage Value: Sum of all BAD return amounts = {formatValue(data?.returnReasons?.summary?.bad_return_value || 0)}</li>
                            <li>Percentage by COUNT: {formatNumber(data?.returnReasons?.summary?.bad_return_count || 0)} ÷ {formatNumber(data?.returnReasons?.summary?.total_return_count || 1)} × 100 = {((parseFloat(data?.returnReasons?.summary?.bad_return_count || 0) / parseFloat(data?.returnReasons?.summary?.total_return_count || 1)) * 100).toFixed(1)}%</li>
                            <li>Percentage by VALUE: {formatValue(data?.returnReasons?.summary?.bad_return_value || 0)} ÷ {formatValue(data?.returnReasons?.summary?.total_return_value || 0)} × 100 = {((parseFloat(data?.returnReasons?.summary?.bad_return_value || 0) / parseFloat(data?.returnReasons?.summary?.total_return_value || 1)) * 100).toFixed(1)}%</li>
                          </ul>
                          <p><strong>Measured by:</strong> Transaction COUNT ({((parseFloat(data?.returnReasons?.summary?.bad_return_count || 0) / parseFloat(data?.returnReasons?.summary?.total_return_count || 1)) * 100).toFixed(1)}%), but wastage VALUE is {((parseFloat(data?.returnReasons?.summary?.bad_return_value || 0) / parseFloat(data?.returnReasons?.summary?.total_return_value || 1)) * 100).toFixed(1)}%</p>
                          <p className="text-red-600">⚠ Direct financial loss - cannot be resold</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-red-600 max-sm:text-2xl">
                      {formatNumber(data?.returnReasons?.summary?.bad_return_count || 0)}
                    </div>
                    <p className="text-xs text-slate-500">return transactions</p>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-lg font-semibold text-slate-700">
                      {formatValue(data?.returnReasons?.summary?.bad_return_value || 0)}
                    </div>
                    <p className="text-xs text-slate-500">wastage value</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {((parseFloat(data?.returnReasons?.summary?.bad_return_count || 0) /
                         parseFloat(data?.returnReasons?.summary?.total_return_count || 1)) * 100).toFixed(1)}% of all returns
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatNumber(data?.returnReasons?.summary?.bad_return_qty || 0)} units wasted
                  </div>
                </CardContent>
              </Card>

              {/* Total Returns Card */}
              <Card className="border-l-4 border-l-indigo-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-500 text-white">TOTAL</Badge>
                      All Returns
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold">Total Returns Summary</p>
                          <p><strong>What it means:</strong> All products returned regardless of condition (trx_type = 4). Includes both GOOD and BAD returns.</p>
                          <p><strong>Calculation:</strong></p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>Total Count: {formatNumber(data?.returnReasons?.summary?.good_return_count || 0)} (GOOD) + {formatNumber(data?.returnReasons?.summary?.bad_return_count || 0)} (BAD) = {formatNumber(data?.returnReasons?.summary?.total_return_count || 0)}</li>
                            <li>Total Value: {formatValue(data?.returnReasons?.summary?.good_return_value || 0)} + {formatValue(data?.returnReasons?.summary?.bad_return_value || 0)} = {formatValue(data?.returnReasons?.summary?.total_return_value || 0)}</li>
                            <li>Wastage Impact: {formatValue(data?.returnReasons?.summary?.bad_return_value || 0)} ÷ {formatValue(data?.returnReasons?.summary?.total_return_value || 0)} × 100 = {((parseFloat(data?.returnReasons?.summary?.bad_return_value || 0) / parseFloat(data?.returnReasons?.summary?.total_return_value || 1)) * 100).toFixed(1)}%</li>
                          </ul>
                          <p><strong>Wastage Impact explained:</strong> Of all return value, {((parseFloat(data?.returnReasons?.summary?.bad_return_value || 0) / parseFloat(data?.returnReasons?.summary?.total_return_value || 1)) * 100).toFixed(1)}% is direct financial loss (BAD returns that cannot be resold).</p>
                          <p className="text-indigo-600">ℹ This is the complete picture of all returns</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-indigo-600 max-sm:text-2xl">
                      {formatNumber(data?.returnReasons?.summary?.total_return_count || 0)}
                    </div>
                    <p className="text-xs text-slate-500">return transactions</p>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-lg font-semibold text-slate-700">
                      {formatValue(data?.returnReasons?.summary?.total_return_value || 0)}
                    </div>
                    <p className="text-xs text-slate-500">total return value</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-orange-600 font-medium">
                      Wastage: {((parseFloat(data?.returnReasons?.summary?.bad_return_value || 0) /
                         parseFloat(data?.returnReasons?.summary?.total_return_value || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatNumber(data?.returnReasons?.summary?.total_return_qty || 0)} total units
                  </div>
                </CardContent>
              </Card>
            </div>
            </TooltipProvider>

            {/* Charts Row */}
            <TooltipProvider>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pie Chart - Good vs Bad */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold max-sm:text-base">Good vs Bad Returns</CardTitle>
                      <p className="text-xs text-slate-500 mt-1">By transaction count (not by value)</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-5 w-5 text-slate-400 cursor-help flex-shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold">Pie Chart: Good vs Bad Returns</p>
                          <p><strong>What it shows:</strong> Distribution of return TRANSACTIONS by count (not money value).</p>
                          <p><strong>Data displayed:</strong></p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>Good Returns: {formatNumber(data?.returnReasons?.summary?.good_return_count || 0)} transactions ({((parseFloat(data?.returnReasons?.summary?.good_return_count || 0) / parseFloat(data?.returnReasons?.summary?.total_return_count || 1)) * 100).toFixed(1)}%)</li>
                            <li>Bad Returns: {formatNumber(data?.returnReasons?.summary?.bad_return_count || 0)} transactions ({((parseFloat(data?.returnReasons?.summary?.bad_return_count || 0) / parseFloat(data?.returnReasons?.summary?.total_return_count || 1)) * 100).toFixed(1)}%)</li>
                          </ul>
                          <p><strong>Note:</strong> If you measured by VALUE instead of COUNT, it would be {((parseFloat(data?.returnReasons?.summary?.good_return_value || 0) / parseFloat(data?.returnReasons?.summary?.total_return_value || 1)) * 100).toFixed(1)}% Good and {((parseFloat(data?.returnReasons?.summary?.bad_return_value || 0) / parseFloat(data?.returnReasons?.summary?.total_return_value || 1)) * 100).toFixed(1)}% Bad.</p>
                          <p className="text-blue-600">ℹ This chart matches the percentage in the cards above</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: 'Good Returns',
                            value: parseFloat(data?.returnReasons?.summary?.good_return_count || 0),
                            amount: parseFloat(data?.returnReasons?.summary?.good_return_value || 0),
                            fill: '#10b981'
                          },
                          {
                            name: 'Bad Returns',
                            value: parseFloat(data?.returnReasons?.summary?.bad_return_count || 0),
                            amount: parseFloat(data?.returnReasons?.summary?.bad_return_value || 0),
                            fill: '#ef4444'
                          }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name.split(' ')[0]}: ${(percent * 100).toFixed(1)}%`}
                        outerRadius={isMobile ? 80 : 100}
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: any, name: any, props: any) => {
                          const count = props.payload.value
                          const amount = props.payload.amount
                          const total = parseFloat(data?.returnReasons?.summary?.total_return_count || 1)
                          const percentage = ((count / total) * 100).toFixed(1)
                          return [
                            <div key="tooltip" className="space-y-1">
                              <div><strong>Count:</strong> {formatNumber(count)} transactions ({percentage}%)</div>
                              <div><strong>Value:</strong> {formatValue(amount)}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                Avg: {formatValue(amount / count)} per transaction
                              </div>
                            </div>,
                            name
                          ]
                        }}
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '8px 12px' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: isMobile ? '11px' : '13px' }}
                        formatter={(value: any, entry: any) => {
                          const count = entry.payload.value
                          const amount = entry.payload.amount
                          const total = parseFloat(data?.returnReasons?.summary?.total_return_count || 1)
                          const percentage = ((count / total) * 100).toFixed(1)
                          return `${value}: ${percentage}% (${formatNumber(count)} txns, ${formatValue(amount)})`
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Bar Chart - Return Reasons Comparison */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold max-sm:text-base">Top Return Reasons</CardTitle>
                      <p className="text-xs text-slate-500 mt-1">Top 3 GOOD + Top 3 BAD by transaction count</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-5 w-5 text-slate-400 cursor-help flex-shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold">Bar Chart: Top Return Reasons</p>
                          <p><strong>What it shows:</strong> Most frequent return reasons by NUMBER of transactions (not by value).</p>
                          <p><strong>Chart includes:</strong></p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li><span className="text-green-600 font-semibold">Green bars</span>: Top 3 GOOD return reasons (sellable - collection_type = 1)</li>
                            <li><span className="text-red-600 font-semibold">Red bars</span>: Top 3 BAD return reasons (wastage - collection_type = 0)</li>
                          </ul>
                          <p><strong>Y-axis shows:</strong> Transaction COUNT (how many return orders had this reason)</p>
                          <p><strong>Example:</strong> If "Sellable" shows 1,438, it means 1,438 return transactions had the reason "Sellable".</p>
                          <p className="text-blue-600">ℹ This helps identify which specific reasons cause the most returns</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                    <BarChart
                      data={[
                        ...(data?.returnReasons?.goodReasons || []).map((r: any) => ({
                          reason: r.reason.length > 20 ? r.reason.substring(0, 20) + '...' : r.reason,
                          fullReason: r.reason,
                          count: parseInt(r.count),
                          value: parseFloat(r.value || 0),
                          category: 'GOOD',
                          fill: '#10b981'
                        })),
                        ...(data?.returnReasons?.badReasons || []).map((r: any) => ({
                          reason: r.reason.length > 20 ? r.reason.substring(0, 20) + '...' : r.reason,
                          fullReason: r.reason,
                          count: parseInt(r.count),
                          value: parseFloat(r.value || 0),
                          category: 'BAD',
                          fill: '#ef4444'
                        }))
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="reason"
                        tick={(props: any) => {
                          const { x, y, payload, index } = props
                          const chartData = [
                            ...(data?.returnReasons?.goodReasons || []).map((r: any) => ({ category: 'GOOD' })),
                            ...(data?.returnReasons?.badReasons || []).map((r: any) => ({ category: 'BAD' }))
                          ]
                          const category = chartData[index]?.category
                          const fill = category === 'GOOD' ? '#10b981' : '#ef4444'
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text
                                x={0}
                                y={0}
                                dy={16}
                                textAnchor="end"
                                fill={fill}
                                transform="rotate(-45)"
                                fontSize={isMobile ? 10 : 12}
                                fontWeight="500"
                              >
                                {payload.value}
                              </text>
                            </g>
                          )
                        }}
                        height={100}
                      />
                      <YAxis
                        label={{ value: 'Transaction Count', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
                        tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }}
                      />
                      <RechartsTooltip
                        formatter={(value: any, name: any, props: any) => {
                          const { count, value: amount, category, fullReason } = props.payload
                          return [
                            <div key="tooltip" className="space-y-1">
                              <div className="font-semibold">{fullReason}</div>
                              <div><strong>Category:</strong> <span className={category === 'GOOD' ? 'text-green-600' : 'text-red-600'}>{category}</span></div>
                              <div><strong>Count:</strong> {formatNumber(count)} return transactions</div>
                              <div><strong>Value:</strong> {formatValue(amount)}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                Avg: {formatValue(amount / count)} per return
                              </div>
                            </div>,
                            ''
                          ]
                        }}
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '8px 12px' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: isMobile ? '12px' : '14px' }}
                        content={() => (
                          <div style={{ textAlign: 'center', fontSize: isMobile ? '12px' : '14px', paddingTop: '10px' }}>
                            <span className="text-green-600 font-semibold">●</span> GOOD (Sellable) |
                            <span className="text-red-600 font-semibold ml-2">●</span> BAD (Wastage)
                          </div>
                        )}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {[
                          ...(data?.returnReasons?.goodReasons || []).map((r: any) => ({
                            ...r,
                            category: 'GOOD'
                          })),
                          ...(data?.returnReasons?.badReasons || []).map((r: any) => ({
                            ...r,
                            category: 'BAD'
                          }))
                        ].map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.category === 'GOOD' ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            </TooltipProvider>

            {/* Good Return Reasons Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold max-sm:text-base flex items-center gap-2">
                  <Badge className="bg-green-500">GOOD</Badge>
                  Sellable Return Reasons
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">Items that can be resold</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Reason</TableHead>
                        <TableHead className="text-right min-w-[100px]">Count</TableHead>
                        <TableHead className="text-right min-w-[120px]">Value</TableHead>
                        <TableHead className="text-right min-w-[100px]">Quantity</TableHead>
                        <TableHead className="text-right min-w-[80px]">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.returnReasons?.goodReasons?.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                GOOD
                              </Badge>
                              <span className="font-medium text-sm max-sm:text-xs">{item.reason}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.count)}</TableCell>
                          <TableCell className="text-right font-medium text-green-600 text-sm max-sm:text-xs">
                            {formatValue(item.value)}
                          </TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.qty)}</TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">
                            <Badge variant="secondary">{item.percentage}%</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Bad Return Reasons Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold max-sm:text-base flex items-center gap-2">
                  <Badge className="bg-red-500">BAD</Badge>
                  Damaged/Expired Return Reasons
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">Items that cannot be resold (wastage)</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Reason</TableHead>
                        <TableHead className="text-right min-w-[100px]">Count</TableHead>
                        <TableHead className="text-right min-w-[120px]">Value</TableHead>
                        <TableHead className="text-right min-w-[100px]">Quantity</TableHead>
                        <TableHead className="text-right min-w-[80px]">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.returnReasons?.badReasons?.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                BAD
                              </Badge>
                              <span className="font-medium text-sm max-sm:text-xs">{item.reason}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.count)}</TableCell>
                          <TableCell className="text-right font-medium text-red-600 text-sm max-sm:text-xs">
                            {formatValue(item.value)}
                          </TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.qty)}</TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">
                            <Badge variant="secondary">{item.percentage}%</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Top Products by Return Reason */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold max-sm:text-base">Top 20 Returned Products by Reason</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">Highest value returns with categorization</p>
                  </div>
                  <Button
                    onClick={exportToExcel}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2 hover:bg-green-50 hover:border-green-500"
                  >
                    <Download className="h-4 w-4" />
                    <span className="max-sm:hidden">Export Excel</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow>
                          <TableHead className="min-w-[50px] text-center">Rank</TableHead>
                          <TableHead className="min-w-[100px]">Category</TableHead>
                          <TableHead className="min-w-[200px]">Product</TableHead>
                          <TableHead className="min-w-[150px]">Reason</TableHead>
                          <TableHead className="text-right min-w-[100px]">Count</TableHead>
                          <TableHead className="text-right min-w-[120px]">Value</TableHead>
                          <TableHead className="text-right min-w-[100px]">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.returnReasons?.byProduct?.map((item: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="text-center">
                              <Badge
                                variant={idx < 3 ? "default" : "outline"}
                                className={`text-xs font-bold ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-600' : ''}`}
                              >
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={item.return_category === 'GOOD'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                                }
                              >
                                {item.return_category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm max-sm:text-xs">{item.product_name}</div>
                              <div className="text-xs text-slate-500">{item.product_code}</div>
                            </TableCell>
                            <TableCell className="text-sm max-sm:text-xs">{item.reason}</TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.return_count)}</TableCell>
                            <TableCell className={`text-right font-medium text-sm max-sm:text-xs ${item.return_category === 'GOOD' ? 'text-green-600' : 'text-red-600'}`}>
                              {formatValue(item.return_value)}
                            </TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.return_qty)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Period Returns Summary */}
        <TabsContent value="mtd-returns">
          <div className="space-y-6 max-md:space-y-4">
            {/* Export Button Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 max-sm:text-base">Period Returns Analysis</h3>
                <p className="text-xs text-slate-500 mt-1">Comprehensive breakdown with Good vs Bad returns</p>
              </div>
              <Button
                onClick={exportPeriodReturnsToExcel}
                size="sm"
                variant="outline"
                className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-500"
              >
                <Download className="h-4 w-4" />
                <span className="max-sm:hidden">Export Excel</span>
              </Button>
            </div>

            {/* Consolidated Period Summary Cards */}
            <TooltipProvider>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Sales Card */}
              <Card className="border-l-4 border-l-emerald-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500 text-white">SALES</Badge>
                      Total Sales
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold">Total Sales (Gross)</p>
                          <p><strong>What it means:</strong> All sales transactions before deducting returns (trx_type = 1).</p>
                          <p><strong>Calculation:</strong></p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>Sales Value: Sum of all sale amounts = {formatValue(data?.periodReturns?.summary?.sale_value || 0)}</li>
                            <li>Order Count: Total number of sale orders = {formatNumber(data?.periodReturns?.summary?.sale_count || 0)}</li>
                          </ul>
                          <p><strong>Important:</strong> This is GROSS sales. To get actual revenue, use NET Sales (Gross Sales - Returns).</p>
                          <p className="text-emerald-600">ℹ Starting point before returns impact</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-emerald-600 max-sm:text-2xl">
                      {formatValue(data?.periodReturns?.summary?.sale_value || 0)}
                    </div>
                    <p className="text-xs text-slate-500">gross sales value</p>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-lg font-semibold text-slate-700">
                      {formatNumber(data?.periodReturns?.summary?.sale_count || 0)}
                    </div>
                    <p className="text-xs text-slate-500">total orders</p>
                  </div>
                  <div className="text-xs text-slate-500">
                    Before returns deduction
                  </div>
                </CardContent>
              </Card>

              {/* Total Returns Card with Good/Bad Breakdown */}
              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-500 text-white">RETURNS</Badge>
                      Total Returns
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold">Total Returns with Breakdown</p>
                          <p><strong>What it means:</strong> All products returned (trx_type = 4), split into GOOD (sellable) and BAD (wastage).</p>
                          <p><strong>Calculation:</strong></p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>Total Returns: {formatValue(data?.periodReturns?.summary?.good_return_value || 0)} (GOOD) + {formatValue(data?.periodReturns?.summary?.bad_return_value || 0)} (BAD) = {formatValue(data?.periodReturns?.summary?.return_value || 0)}</li>
                            <li>Return Orders: {formatNumber(data?.periodReturns?.summary?.return_count || 0)} transactions</li>
                            <li>Return %: {formatValue(data?.periodReturns?.summary?.return_value || 0)} ÷ {formatValue(data?.periodReturns?.summary?.sale_value || 0)} × 100 = {data?.periodReturns?.summary?.return_percentage || 0}%</li>
                          </ul>
                          <p><strong>GOOD Returns:</strong> Can be restocked (collection_type = 1)</p>
                          <p><strong>BAD Returns:</strong> Direct loss - damaged/expired (collection_type = 0)</p>
                          <p className="text-orange-600">⚠ Reduces gross sales to get net revenue</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-orange-600 max-sm:text-2xl">
                      {formatValue(data?.periodReturns?.summary?.return_value || 0)}
                    </div>
                    <p className="text-xs text-slate-500">return value</p>
                  </div>
                  <div className="pt-2 border-t space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600">Good:</span>
                      <span className="font-semibold">{formatValue(data?.periodReturns?.summary?.good_return_value || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-red-600">Bad:</span>
                      <span className="font-semibold">{formatValue(data?.periodReturns?.summary?.bad_return_value || 0)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatNumber(data?.periodReturns?.summary?.return_count || 0)} return orders • {data?.periodReturns?.summary?.return_percentage || 0}% of sales
                  </div>
                </CardContent>
              </Card>

              {/* Net Sales Card */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500 text-white">NET</Badge>
                      Net Sales
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2 text-xs">
                          <p className="font-semibold">Net Sales (Actual Revenue)</p>
                          <p><strong>What it means:</strong> Final revenue after deducting all returns. This is your ACTUAL sales performance.</p>
                          <p><strong>Calculation:</strong></p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>Net Sales Value: {formatValue(data?.periodReturns?.summary?.sale_value || 0)} (Gross Sales) - {formatValue(data?.periodReturns?.summary?.return_value || 0)} (Returns) = {formatValue(data?.periodReturns?.summary?.net_sales_value || 0)}</li>
                            <li>Net Orders: {formatNumber(data?.periodReturns?.summary?.sale_count || 0)} (Total Orders) - {formatNumber(data?.periodReturns?.summary?.return_count || 0)} (Return Orders) = {formatNumber(data?.periodReturns?.summary?.net_order_count || 0)}</li>
                          </ul>
                          <p><strong>Products Affected:</strong> {formatNumber(data?.periodReturns?.summary?.products_affected || 0)} unique products had at least one return</p>
                          <p><strong>Use this for:</strong> Financial reporting, revenue targets, performance evaluation</p>
                          <p className="text-blue-600">✓ This is your real business performance</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-blue-600 max-sm:text-2xl">
                      {formatValue(data?.periodReturns?.summary?.net_sales_value || 0)}
                    </div>
                    <p className="text-xs text-slate-500">after returns</p>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-lg font-semibold text-slate-700">
                      {formatNumber(data?.periodReturns?.summary?.net_order_count || 0)}
                    </div>
                    <p className="text-xs text-slate-500">net orders</p>
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatNumber(data?.periodReturns?.summary?.products_affected || 0)} products affected by returns
                  </div>
                </CardContent>
              </Card>
            </div>
            </TooltipProvider>

            {/* Daily Return Trend with Good/Bad Breakdown */}
            <TooltipProvider>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold max-sm:text-base">Daily Return Trend - Good vs Bad</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">Stacked view showing sellable vs wastage returns</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="ml-2 p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <HelpCircle className="h-4 w-4 text-slate-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <div className="space-y-2 text-xs">
                        <p><strong>Daily Return Trend Explained:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong className="text-green-600">Good Returns (Green):</strong> Sellable products that can be resold - minimal financial loss</li>
                          <li><strong className="text-red-600">Bad Returns (Red):</strong> Expired/damaged items - direct wastage and financial loss</li>
                          <li><strong className="text-purple-600">Total Value Line (Purple):</strong> Combined return value in {getCurrency()} for the day</li>
                        </ul>
                        <p><strong>Why Stacked?</strong> Shows proportion of Good vs Bad returns each day, helping identify wastage patterns</p>
                        <p><strong>Goal:</strong> Maximize green (sellable), minimize red (wastage)</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                  <ComposedChart data={data?.periodReturns?.dailyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis yAxisId="left" label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#6b7280' }} tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: getCurrency(), angle: 90, position: 'insideRight', fill: '#6b7280' }} tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }} />
                    <Legend
                      wrapperStyle={{ fontSize: isMobile ? '12px' : '14px' }}
                      content={() => (
                        <div style={{ textAlign: 'center', fontSize: isMobile ? '12px' : '14px', paddingTop: '10px' }}>
                          <span className="text-green-600 font-semibold">●</span> Good Returns |
                          <span className="text-red-600 font-semibold ml-2">●</span> Bad Returns |
                          <span className="text-purple-600 font-semibold ml-2">—</span> Total Value
                        </div>
                      )}
                    />
                    <Bar yAxisId="left" dataKey="good_return_count" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar yAxisId="left" dataKey="bad_return_count" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="return_value" stroke="#8b5cf6" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            </TooltipProvider>

            {/* Top Returned Products */}
            <TooltipProvider>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold max-sm:text-base">Top 20 Returned Products</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">Scroll to view all 20 products</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="ml-2 p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <HelpCircle className="h-4 w-4 text-slate-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <div className="space-y-2 text-xs">
                        <p><strong>Top 20 Returned Products Explained:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Ranked by Return Value:</strong> Products sorted by total {getCurrency()} value returned (not just quantity)</li>
                          <li><strong>Brand & Category:</strong> Helps identify patterns - is one brand or category being returned more?</li>
                          <li><strong>Qty Returned:</strong> Total units returned in the selected period</li>
                          <li><strong>Transactions:</strong> How many separate return transactions for this product</li>
                        </ul>
                        <p><strong>Why this matters:</strong> High-value returns indicate products needing quality review or better customer education</p>
                        <p><strong>Action:</strong> Focus on top 5 products to reduce wastage</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 md:mx-0">
                  <div className="max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow>
                          <TableHead className="min-w-[50px] text-center">Rank</TableHead>
                          <TableHead className="min-w-[200px]">Product</TableHead>
                          <TableHead className="min-w-[120px]">Brand</TableHead>
                          <TableHead className="min-w-[120px]">Category</TableHead>
                          <TableHead className="text-right min-w-[100px]">Qty Returned</TableHead>
                          <TableHead className="text-right min-w-[110px]">Total Return Value</TableHead>
                          <TableHead className="text-right min-w-[110px] text-green-700">Good Returns</TableHead>
                          <TableHead className="text-right min-w-[110px] text-red-700">Bad Returns</TableHead>
                          <TableHead className="text-right min-w-[100px]">Transactions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.periodReturns?.byProduct?.map((item: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="text-center">
                              <Badge
                                variant={idx < 3 ? "default" : "outline"}
                                className={`text-xs font-bold ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-600' : ''}`}
                              >
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm max-sm:text-xs">{item.product_name}</div>
                              <div className="text-xs text-slate-500">{item.product_code}</div>
                            </TableCell>
                            <TableCell className="text-sm max-sm:text-xs">
                              <Badge variant="outline" className="text-xs font-normal">{item.brand}</Badge>
                            </TableCell>
                            <TableCell className="text-sm max-sm:text-xs">{item.category_name}</TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.return_qty)}</TableCell>
                            <TableCell className="text-right font-medium text-blue-600 text-sm max-sm:text-xs">
                              {formatValue(item.return_value)}
                            </TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">
                              <div className="text-green-600 font-medium">{formatValue(item.good_return_value || 0)}</div>
                              <div className="text-xs text-green-500">{formatNumber(item.good_return_count || 0)} txns</div>
                            </TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">
                              <div className="text-red-600 font-medium">{formatValue(item.bad_return_value || 0)}</div>
                              <div className="text-xs text-red-500">{formatNumber(item.bad_return_count || 0)} txns</div>
                            </TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">
                              <Badge variant="secondary" className="text-xs">{item.return_count}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
            </TooltipProvider>

            {/* Returns by Category */}
            <TooltipProvider>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold max-sm:text-base">Returns by Category Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Category Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-blue-700 font-medium">Categories Affected</div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="p-0.5 hover:bg-blue-200 rounded-full transition-colors">
                              <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs"><strong>Categories Affected:</strong> Number of different product categories that have returns in this period. More categories = broader return issue.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-2xl font-bold text-blue-900 mt-1">
                        {data?.periodReturns?.byCategory?.length || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-indigo-700 font-medium">Total Units Returned</div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="p-0.5 hover:bg-indigo-200 rounded-full transition-colors">
                              <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs"><strong>Total Units Returned:</strong> Sum of all product quantities returned across all categories. Includes both Good (sellable) and Bad (wastage) returns.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-2xl font-bold text-indigo-900 mt-1">
                        {formatNumber(data?.periodReturns?.byCategory?.reduce((sum: number, cat: any) => sum + (Number(cat.return_qty) || 0), 0) || 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-blue-700 font-medium">Total Return Value</div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="p-0.5 hover:bg-blue-200 rounded-full transition-colors">
                              <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs"><strong>Total Return Value:</strong> Combined {getCurrency()} value of all returns across all categories. This represents potential revenue loss or inventory recovery value.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-2xl font-bold text-blue-900 mt-1">
                        {formatValue(data?.periodReturns?.byCategory?.reduce((sum: number, cat: any) => sum + (Number(cat.return_value) || 0), 0) || 0)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Combined Chart */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-sm font-semibold text-slate-700">Category-wise Returns Distribution</h4>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-0.5 hover:bg-slate-200 rounded-full transition-colors">
                          <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <div className="space-y-2 text-xs">
                          <p><strong>Category-wise Distribution Explained:</strong></p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong className="text-green-600">Green Bars:</strong> Good returns (sellable) - can be resold, minimal loss</li>
                            <li><strong className="text-red-600">Red Bars:</strong> Bad returns (wastage) - expired/damaged, direct financial loss</li>
                            <li><strong>Stacked View:</strong> Total height shows combined return value per category</li>
                            <li><strong className="text-blue-600">Blue Line:</strong> Total quantity of units returned</li>
                          </ul>
                          <p><strong>Why this matters:</strong> Identifies which categories have high wastage (red) vs recoverable returns (green)</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                    <ComposedChart data={data?.periodReturns?.byCategory || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="category_name"
                        tick={{ fontSize: isMobile ? 9 : 11, fill: '#6b7280' }}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis
                        yAxisId="left"
                        label={{ value: `${getCurrency()} Value`, angle: -90, position: 'insideLeft', fill: '#6b7280' }}
                        tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        label={{ value: 'Units', angle: 90, position: 'insideRight', fill: '#6b7280' }}
                        tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }}
                      />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}
                        formatter={(value: any, name: any, props: any) => {
                          if (name === `Good Returns (${getCurrency()})`) return [formatValue(value), 'Good Returns (Sellable)']
                          if (name === `Bad Returns (${getCurrency()})`) return [formatValue(value), 'Bad Returns (Wastage)']
                          if (name === 'Quantity Returned') return [formatNumber(value) + ' units', 'Total Quantity']
                          return [value, name]
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: isMobile ? '11px' : '13px' }} />
                      <Bar
                        yAxisId="left"
                        dataKey="good_return_value"
                        stackId="a"
                        fill="#10b981"
                        name={`Good Returns (${getCurrency()})`}
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="bad_return_value"
                        stackId="a"
                        fill="#ef4444"
                        name={`Bad Returns (${getCurrency()})`}
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="return_qty"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', r: 5 }}
                        name="Quantity Returned"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Detailed Category Table */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-sm font-semibold text-slate-700">Detailed Breakdown</h4>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-0.5 hover:bg-slate-200 rounded-full transition-colors">
                          <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <div className="space-y-2 text-xs">
                          <p><strong>Detailed Breakdown Explained:</strong></p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong>% of Total:</strong> Percentage of total return value attributed to this category</li>
                            <li>Formula: (Category Return Value ÷ Total Return Value) × 100</li>
                            <li>Higher percentages indicate categories contributing most to returns</li>
                          </ul>
                          <p><strong>Use this to:</strong> Prioritize which categories need attention for return reduction</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="overflow-x-auto -mx-6 md:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[150px]">Category</TableHead>
                          <TableHead className="text-right min-w-[120px]">Qty Returned (Units)</TableHead>
                          <TableHead className="text-right min-w-[130px]">Total Return Value</TableHead>
                          <TableHead className="text-right min-w-[110px] text-green-700">Good Returns</TableHead>
                          <TableHead className="text-right min-w-[110px] text-red-700">Bad Returns</TableHead>
                          <TableHead className="text-right min-w-[100px]">Transactions</TableHead>
                          <TableHead className="text-right min-w-[100px]">% of Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.periodReturns?.byCategory?.map((item: any, idx: number) => {
                          const totalValue = data.periodReturns.byCategory.reduce((sum: number, cat: any) => sum + (Number(cat.return_value) || 0), 0);
                          const percentage = totalValue > 0 ? ((Number(item.return_value) / totalValue) * 100).toFixed(1) : '0.0';

                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium text-sm max-sm:text-xs">{item.category_name}</TableCell>
                              <TableCell className="text-right text-sm max-sm:text-xs">
                                <Badge variant="secondary" className="text-xs">{formatNumber(item.return_qty)}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium text-blue-600 text-sm max-sm:text-xs">
                                {formatValue(item.return_value)}
                              </TableCell>
                              <TableCell className="text-right text-sm max-sm:text-xs">
                                <div className="text-green-600 font-medium">{formatValue(item.good_return_value || 0)}</div>
                                <div className="text-xs text-green-500">{formatNumber(item.good_return_count || 0)} txns</div>
                              </TableCell>
                              <TableCell className="text-right text-sm max-sm:text-xs">
                                <div className="text-red-600 font-medium">{formatValue(item.bad_return_value || 0)}</div>
                                <div className="text-xs text-red-500">{formatNumber(item.bad_return_count || 0)} txns</div>
                              </TableCell>
                              <TableCell className="text-right text-sm max-sm:text-xs">{item.return_count}</TableCell>
                              <TableCell className="text-right text-sm max-sm:text-xs">
                                <Badge variant="outline" className="text-xs">{percentage}%</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
            </TooltipProvider>
          </div>
        </TabsContent>

        {/* Weekly Return History */}
        <TabsContent value="weekly-history">
          <div className="space-y-6 max-md:space-y-4">
            {/* Export Button Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 max-sm:text-base">Weekly Returns Trend</h3>
                <p className="text-xs text-slate-500 mt-1">Track return patterns week-over-week with Good vs Bad breakdown</p>
              </div>
              <Button
                onClick={exportWeeklyHistoryToExcel}
                size="sm"
                variant="outline"
                className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-500"
              >
                <Download className="h-4 w-4" />
                <span className="max-sm:hidden">Export Excel</span>
              </Button>
            </div>

            {/* Weekly History Summary Cards */}
            <TooltipProvider>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-blue-700 font-medium">Total Weeks Tracked</div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-0.5 hover:bg-blue-200 rounded-full transition-colors">
                          <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs"><strong>Total Weeks Tracked:</strong> Number of weeks in the selected date range with return activity. Each week runs from Sunday to Saturday.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-2xl font-bold text-blue-900 mt-1">
                    {data?.weeklyHistory?.data?.length || 0}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-indigo-700 font-medium">Avg Weekly Returns</div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-0.5 hover:bg-indigo-200 rounded-full transition-colors">
                          <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs"><strong>Average Weekly Returns:</strong> Average return value per week. Helps identify if return levels are consistent or volatile.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-2xl font-bold text-indigo-900 mt-1">
                    {formatValue(data?.weeklyHistory?.data?.reduce((sum: number, w: any) => sum + parseFloat(w.return_value || 0), 0) / (data?.weeklyHistory?.data?.length || 1))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-purple-700 font-medium">Peak Week Returns</div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-0.5 hover:bg-purple-200 rounded-full transition-colors">
                          <HelpCircle className="h-3.5 w-3.5 text-purple-500" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs"><strong>Peak Week Returns:</strong> Highest weekly return value in the period. Identifies problematic weeks requiring investigation.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="text-2xl font-bold text-purple-900 mt-1">
                    {formatValue(Math.max(...(data?.weeklyHistory?.data?.map((w: any) => parseFloat(w.return_value || 0)) || [0])))}
                  </div>
                </CardContent>
              </Card>
            </div>
            </TooltipProvider>

            <TooltipProvider>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold max-sm:text-base">Weekly Sales Return History</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">Stacked view showing sellable vs wastage returns</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="ml-2 p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <HelpCircle className="h-4 w-4 text-slate-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <div className="space-y-2 text-xs">
                        <p><strong>Weekly Return Trend Explained:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong className="text-green-600">Good Returns (Green bars):</strong> Sellable products that can be resold</li>
                          <li><strong className="text-red-600">Bad Returns (Red bars):</strong> Wastage - expired/damaged items</li>
                          <li><strong className="text-purple-600">Transaction Line (Purple):</strong> Number of return transactions</li>
                        </ul>
                        <p><strong>Why Track Weekly?</strong> Helps identify seasonal patterns, problematic weeks, and trends over time</p>
                        <p><strong>Goal:</strong> Reduce total returns and minimize wastage (red)</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                  <ComposedChart data={data?.weeklyHistory?.data || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="week_label" label={{ value: 'Week Period', position: 'insideBottom', offset: -5, fill: '#6b7280' }} tick={{ fontSize: isMobile ? 9 : 11, fill: '#6b7280', angle: -45, textAnchor: 'end' }} height={80} />
                    <YAxis yAxisId="left" label={{ value: 'Units / Transactions', angle: -90, position: 'insideLeft', fill: '#6b7280' }} tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: `${getCurrency()} Value`, angle: 90, position: 'insideRight', fill: '#6b7280' }} tick={{ fontSize: isMobile ? 10 : 12, fill: '#6b7280' }} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}
                      formatter={(value: any, name: any) => {
                        if (name === `Good Returns (${getCurrency()})`) return [formatValue(value), 'Good Returns (Sellable)']
                        if (name === `Bad Returns (${getCurrency()})`) return [formatValue(value), 'Bad Returns (Wastage)']
                        if (name === 'Return Transactions (Count)') return [formatNumber(value), 'Return Count']
                        return [value, name]
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: isMobile ? '12px' : '14px' }} />
                    <Bar
                      yAxisId="right"
                      dataKey="good_return_value"
                      stackId="value"
                      fill="#10b981"
                      name={`Good Returns (${getCurrency()})`}
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="bad_return_value"
                      stackId="value"
                      fill="#ef4444"
                      name={`Bad Returns (${getCurrency()})`}
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="return_count"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', r: 4 }}
                      name="Return Transactions (Count)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            </TooltipProvider>

            <TooltipProvider>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold max-sm:text-base">Weekly Return Details</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">Detailed breakdown with Good vs Bad returns</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="ml-2 p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <HelpCircle className="h-4 w-4 text-slate-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <div className="space-y-2 text-xs">
                        <p><strong>Weekly Details Explained:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Week Period:</strong> Date range for each week (Sunday to Saturday)</li>
                          <li><strong>Good Returns:</strong> Value + transaction count of sellable returns</li>
                          <li><strong>Bad Returns:</strong> Value + transaction count of wastage</li>
                          <li><strong>Products:</strong> Number of unique products returned that week</li>
                          <li><strong>Salesmen:</strong> Number of salesmen with returns that week</li>
                        </ul>
                        <p><strong>Use this to:</strong> Compare week-over-week performance and identify trends</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[80px]">Week</TableHead>
                        <TableHead className="min-w-[180px]">Period</TableHead>
                        <TableHead className="text-right min-w-[100px]">Returns</TableHead>
                        <TableHead className="text-right min-w-[110px]">Qty Returned</TableHead>
                        <TableHead className="text-right min-w-[120px]">Total Return Value</TableHead>
                        <TableHead className="text-right min-w-[110px] text-green-700">Good Returns</TableHead>
                        <TableHead className="text-right min-w-[110px] text-red-700">Bad Returns</TableHead>
                        <TableHead className="text-right min-w-[100px]">Products</TableHead>
                        <TableHead className="text-right min-w-[100px]">Salesmen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.weeklyHistory?.data?.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{item.week_label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(item.week_start).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {new Date(item.week_end).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.return_count)}</TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.return_qty)}</TableCell>
                          <TableCell className="text-right font-medium text-blue-600 text-sm max-sm:text-xs">
                            {formatValue(item.return_value)}
                          </TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">
                            <div className="text-green-600 font-medium">{formatValue(item.good_return_value || 0)}</div>
                            <div className="text-xs text-green-500">{formatNumber(item.good_return_count || 0)} txns</div>
                          </TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">
                            <div className="text-red-600 font-medium">{formatValue(item.bad_return_value || 0)}</div>
                            <div className="text-xs text-red-500">{formatNumber(item.bad_return_count || 0)} txns</div>
                          </TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.unique_products)}</TableCell>
                          <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.unique_salesmen)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            </TooltipProvider>
          </div>
        </TabsContent>

        {/* SKU-wise Return % */}
        <TabsContent value="sku-return">
          <div className="space-y-6 max-md:space-y-4">
            {/* Export Button Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 max-sm:text-base">SKU Return % Analysis</h3>
                <p className="text-xs text-slate-500 mt-1">Product-level return rates with Good vs Bad breakdown</p>
              </div>
              <Button
                onClick={exportSKUReturnToExcel}
                size="sm"
                variant="outline"
                className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-500"
              >
                <Download className="h-4 w-4" />
                <span className="max-sm:hidden">Export Excel</span>
              </Button>
            </div>

            <TooltipProvider>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">Return Rate (Units)</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                          <HelpCircle className="h-4 w-4 text-slate-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs"><strong>Return Rate:</strong> Percentage of sold units that were returned. Lower is better. Good returns are sellable, Bad returns are wastage.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-600 max-sm:text-xl">
                    {data?.skuReturnPercentage?.summary?.overall_return_percentage || 0}%
                  </div>
                  <p className="text-xs text-slate-500 mt-1">% of units sold returned</p>
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-green-600 font-medium">Good (Sellable):</span>
                      <span className="text-green-700">{formatNumber(data?.skuReturnPercentage?.summary?.good_returned || 0)} units</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-red-600 font-medium">Bad (Wastage):</span>
                      <span className="text-red-700">{formatNumber(data?.skuReturnPercentage?.summary?.bad_returned || 0)} units</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">Net Sales Value</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                          <HelpCircle className="h-4 w-4 text-slate-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs"><strong>Net Sales Value:</strong> Total sales minus all returns (both Good and Bad). This is your actual revenue after accounting for returns.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 max-sm:text-xl">
                    {formatValue(data?.skuReturnPercentage?.summary?.net_sales_value || 0)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">After returns</p>
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Total Sales:</span>
                      <span className="text-slate-700 font-medium">{formatValue(data?.skuReturnPercentage?.summary?.total_sales_value || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-600">Total Returns:</span>
                      <span className="text-blue-700">-{formatValue(data?.skuReturnPercentage?.summary?.total_return_value || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">Total Returned</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                          <HelpCircle className="h-4 w-4 text-slate-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs"><strong>Total Returned:</strong> Total units and value of all returned products. Good returns can be resold, Bad returns are lost inventory (wastage).</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xl font-bold text-indigo-600 max-sm:text-lg">
                        {formatNumber(data?.skuReturnPercentage?.summary?.total_returned || 0)} Units
                      </div>
                      <p className="text-xs text-slate-500">Products returned</p>
                    </div>
                    <div className="border-t pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-green-600 font-medium">Good Returns:</div>
                        <div>
                          <div className="text-sm font-bold text-green-700">{formatValue(data?.skuReturnPercentage?.summary?.good_return_value || 0)}</div>
                          <div className="text-xs text-green-500 text-right">{formatNumber(data?.skuReturnPercentage?.summary?.good_returned || 0)} units</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-red-600 font-medium">Bad Returns:</div>
                        <div>
                          <div className="text-sm font-bold text-red-700">{formatValue(data?.skuReturnPercentage?.summary?.bad_return_value || 0)}</div>
                          <div className="text-xs text-red-500 text-right">{formatNumber(data?.skuReturnPercentage?.summary?.bad_returned || 0)} units</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            </TooltipProvider>

            {/* Top 10 Returned Products Chart */}
            <TooltipProvider>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold max-sm:text-base">Top 10 Most Returned Products</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">Products with highest return value (Good vs Bad breakdown)</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <HelpCircle className="h-4 w-4 text-slate-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs"><strong>Top 10 Returned Products:</strong> Shows the 10 products with highest return value. Green bars show Good returns (sellable), Red bars show Bad returns (wastage). Focus on reducing bad returns.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] max-sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.skuReturnPercentage?.data || []}
                      layout="vertical"
                      margin={{ top: 5, right: isMobile ? 10 : 30, left: isMobile ? 10 : 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => formatValue(value)} fontSize={isMobile ? 10 : 12} />
                      <YAxis
                        type="category"
                        dataKey="product_name"
                        width={isMobile ? 120 : 180}
                        fontSize={isMobile ? 9 : 11}
                        tick={(props) => {
                          const { x, y, payload } = props
                          const maxLength = isMobile ? 20 : 30
                          const text = payload.value.length > maxLength
                            ? payload.value.substring(0, maxLength) + '...'
                            : payload.value
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={0} dy={4} textAnchor="end" fill="#666" fontSize={isMobile ? 9 : 11}>
                                {text}
                              </text>
                            </g>
                          )
                        }}
                      />
                      <RechartsTooltip
                        formatter={(value: any, name: any) => {
                          if (name === `Good Return Value (${getCurrency()})`) return [formatValue(value), 'Good Returns (Sellable)']
                          if (name === `Bad Return Value (${getCurrency()})`) return [formatValue(value), 'Bad Returns (Wastage)']
                          return [value, name]
                        }}
                        contentStyle={{ fontSize: isMobile ? '11px' : '13px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: isMobile ? '11px' : '13px' }} />
                      <Bar dataKey="good_return_value" stackId="returns" fill="#10b981" name={`Good Return Value (${getCurrency()})`} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="bad_return_value" stackId="returns" fill="#ef4444" name={`Bad Return Value (${getCurrency()})`} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            </TooltipProvider>

            <TooltipProvider>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold max-sm:text-base">SKU-wise Return Percentage</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      Showing {data?.skuReturnPercentage?.data?.length || 0} products with returns
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <HelpCircle className="h-4 w-4 text-slate-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <div className="space-y-2 text-xs">
                        <p><strong>SKU-wise Return Analysis Explained:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Sold:</strong> Total units of this product sold</li>
                          <li><strong>Returned:</strong> Total units returned</li>
                          <li><strong>Return %:</strong> (Returned / Sold) × 100</li>
                          <li><strong className="text-green-600">Good Returns:</strong> Sellable units that can be resold</li>
                          <li><strong className="text-red-600">Bad Returns:</strong> Wastage - damaged/expired units</li>
                        </ul>
                        <p><strong>Action:</strong> Focus on products with high return % and high bad returns</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Product</TableHead>
                        <TableHead className="min-w-[150px]">Category</TableHead>
                        <TableHead className="text-right min-w-[100px]">Sold</TableHead>
                        <TableHead className="text-right min-w-[100px]">Returned</TableHead>
                        <TableHead className="text-right min-w-[100px]">Return %</TableHead>
                        <TableHead className="text-right min-w-[110px] text-green-700">Good Returns</TableHead>
                        <TableHead className="text-right min-w-[110px] text-red-700">Bad Returns</TableHead>
                        <TableHead className="text-right min-w-[120px]">Return Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const skuData = data?.skuReturnPercentage?.data || []
                        const startIndex = (skuCurrentPage - 1) * skuItemsPerPage
                        const endIndex = startIndex + skuItemsPerPage
                        const paginatedData = skuData.slice(startIndex, endIndex)

                        return paginatedData.map((item: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <div className="font-medium text-sm max-sm:text-xs">{item.product_name}</div>
                              <div className="text-xs text-slate-500">{item.product_code}</div>
                            </TableCell>
                            <TableCell className="text-sm max-sm:text-xs">{item.category_name}</TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.total_sold)}</TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">{formatNumber(item.total_returned)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={item.return_percentage > 10 ? 'destructive' : item.return_percentage > 5 ? 'default' : 'secondary'} className="text-xs">
                                {item.return_percentage}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">
                              <div className="text-green-600 font-medium">{formatNumber(item.good_returned || 0)} units</div>
                              <div className="text-xs text-green-500">{formatValue(item.good_return_value || 0)}</div>
                            </TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">
                              <div className="text-red-600 font-medium">{formatNumber(item.bad_returned || 0)} units</div>
                              <div className="text-xs text-red-500">{formatValue(item.bad_return_value || 0)}</div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-blue-600 text-sm max-sm:text-xs">
                              {formatValue(item.return_value)}
                            </TableCell>
                          </TableRow>
                        ))
                      })()}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {data?.skuReturnPercentage?.data && data.skuReturnPercentage.data.length > skuItemsPerPage && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t max-sm:flex-col max-sm:gap-3">
                    <div className="text-sm text-slate-600 max-sm:text-xs max-sm:text-center">
                      Showing {((skuCurrentPage - 1) * skuItemsPerPage) + 1} to {Math.min(skuCurrentPage * skuItemsPerPage, data.skuReturnPercentage.data.length)} of {data.skuReturnPercentage.data.length} products
                    </div>
                    <div className="flex gap-2 max-sm:w-full max-sm:justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSkuCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={skuCurrentPage === 1}
                        className="max-sm:text-xs"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center px-3 text-sm max-sm:text-xs max-sm:px-2">
                        Page {skuCurrentPage} of {Math.ceil(data.skuReturnPercentage.data.length / skuItemsPerPage)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSkuCurrentPage(prev => Math.min(Math.ceil(data.skuReturnPercentage.data.length / skuItemsPerPage), prev + 1))}
                        disabled={skuCurrentPage >= Math.ceil(data.skuReturnPercentage.data.length / skuItemsPerPage)}
                        className="max-sm:text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </TooltipProvider>
          </div>
        </TabsContent>

        {/* Return on Sales Report */}
        <TabsContent value="return-on-sales">
          <div className="space-y-6 max-md:space-y-4">
            <TooltipProvider>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">Total Sales</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                          <HelpCircle className="h-4 w-4 text-slate-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs"><strong>Total Sales:</strong> Gross sales value before any returns. This is the revenue generated from all sales transactions.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900 max-sm:text-xl">
                    {formatValue(data?.returnOnSales?.summary?.total_sales || 0)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Gross sales</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">Total Returns</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                          <HelpCircle className="h-4 w-4 text-slate-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs"><strong>Total Returns:</strong> Total value of all returned products. Includes both Good returns (sellable) and Bad returns (wastage). Lower is better.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600 max-sm:text-xl">
                    {formatValue(data?.returnOnSales?.summary?.total_returns || 0)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Return impact</p>
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-green-600 font-medium">Good (Sellable):</span>
                      <span className="text-green-700">{formatValue(data?.returnOnSales?.summary?.good_return_value || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-red-600 font-medium">Bad (Wastage):</span>
                      <span className="text-red-700">{formatValue(data?.returnOnSales?.summary?.bad_return_value || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">Net Sales</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                          <HelpCircle className="h-4 w-4 text-slate-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs"><strong>Net Sales:</strong> Sales minus returns. This is your actual revenue after accounting for all returns (Good + Bad).</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 max-sm:text-xl">
                    {formatValue(data?.returnOnSales?.summary?.net_sales || 0)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">After returns</p>
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Gross Sales:</span>
                      <span className="text-slate-700 font-medium">{formatValue(data?.returnOnSales?.summary?.total_sales || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-600">Total Returns:</span>
                      <span className="text-blue-700">-{formatValue(data?.returnOnSales?.summary?.total_returns || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-600">Return Rate (Value)</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                          <HelpCircle className="h-4 w-4 text-slate-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs"><strong>Return Rate (Value):</strong> Percentage of sales revenue lost to returns. Calculated as (Total Returns / Total Sales) × 100. Lower is better.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-600 max-sm:text-xl">
                    {data?.returnOnSales?.summary?.return_percentage || 0}%
                  </div>
                  <p className="text-xs text-slate-500 mt-1">% of sales revenue lost</p>
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-green-600">Good %:</span>
                      <span className="text-green-700">{((data?.returnOnSales?.summary?.good_return_value || 0) / (data?.returnOnSales?.summary?.total_sales || 1) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-red-600">Bad %:</span>
                      <span className="text-red-700">{((data?.returnOnSales?.summary?.bad_return_value || 0) / (data?.returnOnSales?.summary?.total_sales || 1) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            </TooltipProvider>

            {/* Top Performers Chart */}
            <TooltipProvider>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold max-sm:text-base">Top 10 Salesmen by Return Impact</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">Salesmen with highest return value (Good vs Bad breakdown)</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <HelpCircle className="h-4 w-4 text-slate-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs"><strong>Top 10 Salesmen by Return Impact:</strong> Shows the 10 salesmen with highest return value. Green bars show Good returns (sellable), Red bars show Bad returns (wastage). Focus on coaching salesmen with high wastage.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] max-sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data?.returnOnSales?.data || []}
                      layout="vertical"
                      margin={{ top: 5, right: isMobile ? 10 : 30, left: isMobile ? 10 : 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => formatValue(value)} fontSize={isMobile ? 10 : 12} />
                      <YAxis
                        type="category"
                        dataKey="salesman_name"
                        width={isMobile ? 120 : 180}
                        fontSize={isMobile ? 9 : 11}
                        tick={(props) => {
                          const { x, y, payload } = props
                          const maxLength = isMobile ? 18 : 25
                          const text = payload.value.length > maxLength
                            ? payload.value.substring(0, maxLength) + '...'
                            : payload.value
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={0} dy={4} textAnchor="end" fill="#666" fontSize={isMobile ? 9 : 11}>
                                {text}
                              </text>
                            </g>
                          )
                        }}
                      />
                      <RechartsTooltip
                        formatter={(value: any, name: any) => {
                          if (name === `Good Returns (${getCurrency()})`) return [formatValue(value), 'Good Returns (Sellable)']
                          if (name === `Bad Returns (${getCurrency()})`) return [formatValue(value), 'Bad Returns (Wastage)']
                          return [value, name]
                        }}
                        contentStyle={{ fontSize: isMobile ? '11px' : '13px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: isMobile ? '11px' : '13px' }} />
                      <Bar dataKey="good_return_value" stackId="returns" fill="#10b981" name={`Good Returns (${getCurrency()})`} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="bad_return_value" stackId="returns" fill="#ef4444" name={`Bad Returns (${getCurrency()})`} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            </TooltipProvider>

            <TooltipProvider>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold max-sm:text-base">Return on Sales by Salesman</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      Showing {data?.returnOnSales?.data?.length || 0} salesmen with returns
                    </p>
                  </div>
                  <Button
                    onClick={exportReturnOnSalesToExcel}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-500"
                  >
                    <Download className="h-4 w-4" />
                    <span className="max-sm:hidden">Excel</span>
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                        <HelpCircle className="h-4 w-4 text-slate-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <div className="space-y-2 text-xs">
                        <p><strong>Return on Sales by Salesman Explained:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Sales:</strong> Total sales value in the selected period</li>
                          <li><strong>Returns:</strong> Total returns processed in the selected period (Good + Bad)</li>
                          <li><strong>Net Sales:</strong> Sales minus Returns</li>
                          <li><strong className="text-green-600">Good Returns:</strong> Sellable returns</li>
                          <li><strong className="text-red-600">Bad Returns:</strong> Wastage</li>
                          <li><strong>Return %:</strong> (Returns / Sales) × 100</li>
                        </ul>
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                          <p className="font-semibold text-amber-900">⚠️ About Negative Net Sales:</p>
                          <p className="mt-1">Negative net sales can occur when returns processed in the period exceed sales in that same period. This happens when customers return items purchased in previous months.</p>
                          <p className="mt-1"><strong>Example:</strong> If a salesman had {getCurrency()} 50K sales in September but processed {getCurrency()} 100K in returns (from items sold in July/August), their net sales will be -{getCurrency()} 50K.</p>
                        </div>
                        <p className="mt-2"><strong>Action:</strong> Identify salesmen with high return rates and investigate the cause</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Warning Banner about Negative Net Sales */}
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                      <p className="font-semibold text-amber-900">Understanding Net Sales Values</p>
                      <p className="text-amber-800 mt-1">
                        This report shows <strong>sales and returns processed in the selected period</strong>. Negative net sales occur when returns exceed sales in that period, which is normal when customers return items purchased in previous months.
                      </p>
                      <p className="text-amber-800 mt-1">
                        <strong>Example:</strong> A salesman with {getCurrency()} 77K sales and {getCurrency()} 289K returns shows -{getCurrency()} 211K net sales because most returns were for items sold in earlier periods.
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">Salesman</TableHead>
                        <TableHead className="min-w-[100px]">Route</TableHead>
                        <TableHead className="text-right min-w-[120px]">Sales</TableHead>
                        <TableHead className="text-right min-w-[120px]">Returns</TableHead>
                        <TableHead className="text-right min-w-[110px] text-green-700">Good Returns</TableHead>
                        <TableHead className="text-right min-w-[110px] text-red-700">Bad Returns</TableHead>
                        <TableHead className="text-right min-w-[120px]">
                          <div className="flex items-center justify-end gap-1">
                            <span>Net Sales</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs"><strong>Net Sales = Sales - Returns</strong></p>
                                <p className="text-xs mt-1">Can be negative when returns processed in the period exceed sales in that period (returns from previous months)</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                        <TableHead className="text-right min-w-[100px]">Return %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const rosData = data?.returnOnSales?.data || []
                        const startIndex = (rosCurrentPage - 1) * rosItemsPerPage
                        const endIndex = startIndex + rosItemsPerPage
                        const paginatedData = rosData.slice(startIndex, endIndex)

                        return paginatedData.map((item: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <div className="font-medium text-sm max-sm:text-xs">{item.salesman_name}</div>
                              <div className="text-xs text-slate-500">{item.salesman_code}</div>
                            </TableCell>
                            <TableCell className="text-sm max-sm:text-xs">{item.route_code}</TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">{formatValue(item.total_sales)}</TableCell>
                            <TableCell className="text-right text-blue-600 text-sm max-sm:text-xs">{formatValue(item.total_returns)}</TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">
                              <div className="text-green-600 font-medium">{formatValue(item.good_return_value || 0)}</div>
                              <div className="text-xs text-green-500">{formatNumber(item.good_return_count || 0)} txns</div>
                            </TableCell>
                            <TableCell className="text-right text-sm max-sm:text-xs">
                              <div className="text-red-600 font-medium">{formatValue(item.bad_return_value || 0)}</div>
                              <div className="text-xs text-red-500">{formatNumber(item.bad_return_count || 0)} txns</div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm max-sm:text-xs">
                              {Number(item.net_sales) < 0 ? (
                                <div className="flex items-center justify-end gap-1 text-red-600">
                                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span>{formatValue(item.net_sales)}</span>
                                </div>
                              ) : (
                                <span className="text-green-600">{formatValue(item.net_sales)}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={item.return_percentage > 10 ? 'destructive' : item.return_percentage > 5 ? 'default' : 'secondary'} className="text-xs">
                                {item.return_percentage}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      })()}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {data?.returnOnSales?.data && data.returnOnSales.data.length > rosItemsPerPage && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t max-sm:flex-col max-sm:gap-3">
                    <div className="text-sm text-slate-600 max-sm:text-xs max-sm:text-center">
                      Showing {((rosCurrentPage - 1) * rosItemsPerPage) + 1} to {Math.min(rosCurrentPage * rosItemsPerPage, data.returnOnSales.data.length)} of {data.returnOnSales.data.length} salesmen
                    </div>
                    <div className="flex gap-2 max-sm:w-full max-sm:justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRosCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={rosCurrentPage === 1}
                        className="max-sm:text-xs"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center px-3 text-sm max-sm:text-xs max-sm:px-2">
                        Page {rosCurrentPage} of {Math.ceil(data.returnOnSales.data.length / rosItemsPerPage)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRosCurrentPage(prev => Math.min(Math.ceil(data.returnOnSales.data.length / rosItemsPerPage), prev + 1))}
                        disabled={rosCurrentPage >= Math.ceil(data.returnOnSales.data.length / rosItemsPerPage)}
                        className="max-sm:text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </TooltipProvider>
          </div>
        </TabsContent>

        {/* Good/Bad Returns Details - NEW TAB */}
        <TabsContent value="good-bad-details">
          <div className="space-y-6 max-md:space-y-4">
            {/* Section Header */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Detailed Returns Transactions</h2>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-green-600">Good Returns (Sellable):</span> Products that can be resold or restocked.
                <span className="mx-2">|</span>
                <span className="font-semibold text-red-600">Bad Returns (Wastage):</span> Damaged or expired products that cannot be resold.
              </p>
            </div>

            {/* Two Side-by-Side Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-md:gap-4">
              {/* Good Returns Table */}
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-bold text-green-700">Good Returns (Sellable)</CardTitle>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        {data?.goodReturnsDetail?.data?.length || 0} transactions
                      </Badge>
                    </div>
                    <Button
                      onClick={exportGoodReturnsToExcel}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                    </div>
                  ) : !data?.goodReturnsDetail?.data || data.goodReturnsDetail.data.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <PackageX className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p>No good returns data available</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs whitespace-nowrap">Date</TableHead>
                              <TableHead className="text-xs whitespace-nowrap">Salesman</TableHead>
                              <TableHead className="text-xs whitespace-nowrap">Customer</TableHead>
                              <TableHead className="text-xs whitespace-nowrap">Product</TableHead>
                              <TableHead className="text-xs whitespace-nowrap">Reason</TableHead>
                              <TableHead className="text-xs text-right whitespace-nowrap">Qty</TableHead>
                              <TableHead className="text-xs text-right whitespace-nowrap">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.goodReturnsDetail.data
                              .slice(
                                (goodReturnsCurrentPage - 1) * goodReturnsItemsPerPage,
                                goodReturnsCurrentPage * goodReturnsItemsPerPage
                              )
                              .map((row: any, index: number) => (
                                <TableRow key={index}>
                                  <TableCell className="text-xs whitespace-nowrap">
                                    {row.trx_date ? new Date(row.trx_date).toLocaleDateString() : '-'}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="max-w-[120px] truncate" title={row.salesman_name || '-'}>
                                      {row.salesman_name || '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="max-w-[120px] truncate" title={row.customer_name || '-'}>
                                      {row.customer_name || '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="max-w-[150px] truncate" title={row.product_name || '-'}>
                                      {row.product_name || '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="max-w-[100px] truncate" title={row.return_reason || '-'}>
                                      {row.return_reason || '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-right">
                                    {formatNumber(row.quantity || 0)}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-semibold text-green-600">
                                    {formatValue(row.return_value || 0)}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination for Good Returns */}
                      {data.goodReturnsDetail.data.length > goodReturnsItemsPerPage && (
                        <div className="flex items-center justify-between pt-4 border-t">
                          <p className="text-sm text-slate-600">
                            Showing {((goodReturnsCurrentPage - 1) * goodReturnsItemsPerPage) + 1} to{' '}
                            {Math.min(goodReturnsCurrentPage * goodReturnsItemsPerPage, data.goodReturnsDetail.data.length)} of{' '}
                            {data.goodReturnsDetail.data.length} transactions
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setGoodReturnsCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={goodReturnsCurrentPage === 1}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setGoodReturnsCurrentPage(prev => prev + 1)}
                              disabled={goodReturnsCurrentPage * goodReturnsItemsPerPage >= data.goodReturnsDetail.data.length}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bad Returns Table */}
              <Card className="border-l-4 border-l-red-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-bold text-red-700">Bad Returns (Wastage)</CardTitle>
                      <Badge variant="secondary" className="bg-red-100 text-red-700">
                        {data?.badReturnsDetail?.data?.length || 0} transactions
                      </Badge>
                    </div>
                    <Button
                      onClick={exportBadReturnsToExcel}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                    </div>
                  ) : !data?.badReturnsDetail?.data || data.badReturnsDetail.data.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <PackageX className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p>No bad returns data available</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs whitespace-nowrap">Date</TableHead>
                              <TableHead className="text-xs whitespace-nowrap">Salesman</TableHead>
                              <TableHead className="text-xs whitespace-nowrap">Customer</TableHead>
                              <TableHead className="text-xs whitespace-nowrap">Product</TableHead>
                              <TableHead className="text-xs whitespace-nowrap">Reason</TableHead>
                              <TableHead className="text-xs text-right whitespace-nowrap">Qty</TableHead>
                              <TableHead className="text-xs text-right whitespace-nowrap">Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.badReturnsDetail.data
                              .slice(
                                (badReturnsCurrentPage - 1) * badReturnsItemsPerPage,
                                badReturnsCurrentPage * badReturnsItemsPerPage
                              )
                              .map((row: any, index: number) => (
                                <TableRow key={index}>
                                  <TableCell className="text-xs whitespace-nowrap">
                                    {row.trx_date ? new Date(row.trx_date).toLocaleDateString() : '-'}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="max-w-[120px] truncate" title={row.salesman_name || '-'}>
                                      {row.salesman_name || '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="max-w-[120px] truncate" title={row.customer_name || '-'}>
                                      {row.customer_name || '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="max-w-[150px] truncate" title={row.product_name || '-'}>
                                      {row.product_name || '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="max-w-[100px] truncate" title={row.return_reason || '-'}>
                                      {row.return_reason || '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-right">
                                    {formatNumber(row.quantity || 0)}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-semibold text-red-600">
                                    {formatValue(row.return_value || 0)}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination for Bad Returns */}
                      {data.badReturnsDetail.data.length > badReturnsItemsPerPage && (
                        <div className="flex items-center justify-between pt-4 border-t">
                          <p className="text-sm text-slate-600">
                            Showing {((badReturnsCurrentPage - 1) * badReturnsItemsPerPage) + 1} to{' '}
                            {Math.min(badReturnsCurrentPage * badReturnsItemsPerPage, data.badReturnsDetail.data.length)} of{' '}
                            {data.badReturnsDetail.data.length} transactions
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBadReturnsCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={badReturnsCurrentPage === 1}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBadReturnsCurrentPage(prev => prev + 1)}
                              disabled={badReturnsCurrentPage * badReturnsItemsPerPage >= data.badReturnsDetail.data.length}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
