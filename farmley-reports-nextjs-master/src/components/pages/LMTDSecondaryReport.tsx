'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  TrendingUp, TrendingDown, Download, BarChart3, Package, 
  Users, Store, Maximize, Minimize, RefreshCw, Filter, ChevronLeft, 
  ChevronRight, IndianRupee, DollarSign, X, Info, Calendar
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { CustomDatePicker } from '@/components/ui/CustomDatePicker'
import * as XLSX from 'xlsx'

interface DetailedData {
  date: string
  tlCode: string
  tlName: string
  fieldUserCode: string
  fieldUserName: string
  storeCode: string
  storeName: string
  chainName: string
  productCode: string
  productName: string
  secondarySalesCurrentMonth: number
  secondarySalesRevenueCurrentMonth: number
  secondarySalesLastMonth: number
  secondarySalesRevenueLastMonth: number
  secondarySalesDiff: number
  secondarySalesRevenueDiff: number
  revenueVariancePercent: number
  quantityVariancePercent: number
}

interface Summary {
  totalMtdQuantity: number
  totalMtdRevenue: number
  totalLmtdQuantity: number
  totalLmtdRevenue: number
  totalQuantityDiff: number
  totalRevenueDiff: number
  uniqueStores: number
  uniqueProducts: number
  uniqueUsers: number
  uniqueTeamLeaders: number
  transactionCount: number
  revenueVariancePercent: number
  quantityVariancePercent: number
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1']

interface LMTDSecondaryReportProps {
  loginUserCode?: string
}

export function LMTDSecondaryReport({ loginUserCode = 'admin' }: LMTDSecondaryReportProps) {
  const [data, setData] = useState<DetailedData[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periods, setPeriods] = useState<any>(null)
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [teamLeaderCode, setTeamLeaderCode] = useState<string | null>(null)
  const [userCode, setUserCode] = useState<string | null>(null)
  const [storeCode, setStoreCode] = useState<string | null>(null)
  const [chainName, setChainName] = useState<string | null>(null)
  const [productCategory, setProductCategory] = useState<string | null>(null)
  const [productCode, setProductCode] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  
  // Filter options
  const [filterOptions, setFilterOptions] = useState<any>({
    teamLeaders: [],
    users: [],
    chains: [],
    stores: [],
    categories: [],
    products: []
  })
  
  // View states
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary')
  
  // Pagination for detailed view
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(100)

  // Load filter options only on initial mount
  useEffect(() => {
    fetchFilterOptions()
  }, [])

  // Load data when filters change
  useEffect(() => {
    fetchData()
  }, [startDate, endDate, teamLeaderCode, userCode, storeCode, chainName, productCategory, productCode])

  const fetchFilterOptions = async () => {
    try {
      const params = new URLSearchParams({
        startDate: startDate,
        endDate: endDate,
        ...(teamLeaderCode && { teamLeaderCode }),
        ...(userCode && { userCode }),
        ...(chainName && { chainName }),
        ...(storeCode && { storeCode }),
        ...(productCategory && { productCategory }),
        ...(loginUserCode && { loginUserCode })
      })

      const response = await fetch(`/api/lmtd-secondary/filters?${params}`)
      
      if (!response.ok) {
        console.error('Failed to fetch filter options:', response.status)
        return
      }
      
      const result = await response.json()

      if (result.success) {
        setFilterOptions(result.filters)
      }
    } catch (err) {
      console.error('Error fetching filter options:', err)
      // Don't block the component if filter options fail - use empty arrays
      setFilterOptions({
        teamLeaders: [],
        users: [],
        chains: [],
        stores: [],
        categories: [],
        products: []
      })
    }
  }

  const fetchData = async (retryCount = 0) => {
    try {
      if (retryCount === 0) {
        setLoading(true)
        setError(null)
        // Add a small delay on initial load to prevent race condition with filter options
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(teamLeaderCode && { teamLeaderCode }),
        ...(userCode && { userCode }),
        ...(storeCode && { storeCode }),
        ...(chainName && { chainName }),
        ...(productCategory && { productCategory }),
        ...(productCode && { productCode }),
        ...(loginUserCode && { loginUserCode }),
        limit: '999999' // Remove limit to get all data
      })

      const response = await fetch(`/api/lmtd-secondary?${params}`, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()

      if (result.success) {
        setData(result.data || [])
        setSummary(result.summary)
        setPeriods(result.periods)
        setCurrentPage(1)
        setLoading(false)
      } else {
        throw new Error(result.error || result.message || 'Failed to fetch data')
      }
    } catch (err) {
      console.error('Error fetching LMTD data:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      
      // Retry once automatically on first failure
      if (retryCount === 0) {
        console.log('Retrying data fetch after error...')
        // Keep loading state active during retry
        setTimeout(() => fetchData(1), 500)
        return
      }
      
      setError(`Failed to fetch data: ${errorMessage}`)
      setLoading(false)
    }
  }

  // Pagination logic
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return data.slice(startIndex, endIndex)
  }, [data, currentPage, itemsPerPage])

  const totalPages = Math.ceil(data.length / itemsPerPage)

  // Chart data
  const chartData = useMemo(() => {
    if (!data.length) return { daily: [], products: [], stores: [], users: [] }

    // Daily trend
    const dailyMap = new Map()
    data.forEach(d => {
      const date = new Date(d.date).toLocaleDateString('en-GB')
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          mtdRevenue: 0,
          lmtdRevenue: 0
        })
      }
      const item = dailyMap.get(date)
      item.mtdRevenue += d.secondarySalesRevenueCurrentMonth
      item.lmtdRevenue += d.secondarySalesRevenueLastMonth
    })

    // Product data
    const productMap = new Map()
    data.forEach(d => {
      if (!productMap.has(d.productCode)) {
        productMap.set(d.productCode, {
          name: d.productName,
          mtdRevenue: 0,
          lmtdRevenue: 0
        })
      }
      const item = productMap.get(d.productCode)
      item.mtdRevenue += d.secondarySalesRevenueCurrentMonth
      item.lmtdRevenue += d.secondarySalesRevenueLastMonth
    })

    // Store data
    const storeMap = new Map()
    data.forEach(d => {
      if (!storeMap.has(d.storeCode)) {
        storeMap.set(d.storeCode, {
          name: d.storeName,
          mtdRevenue: 0,
          lmtdRevenue: 0
        })
      }
      const item = storeMap.get(d.storeCode)
      item.mtdRevenue += d.secondarySalesRevenueCurrentMonth
      item.lmtdRevenue += d.secondarySalesRevenueLastMonth
    })

    // User data
    const userMap = new Map()
    data.forEach(d => {
      if (!userMap.has(d.fieldUserCode)) {
        userMap.set(d.fieldUserCode, {
          name: d.fieldUserName,
          mtdRevenue: 0,
          lmtdRevenue: 0
        })
      }
      const item = userMap.get(d.fieldUserCode)
      item.mtdRevenue += d.secondarySalesRevenueCurrentMonth
      item.lmtdRevenue += d.secondarySalesRevenueLastMonth
    })

    return {
      daily: Array.from(dailyMap.values()),
      products: Array.from(productMap.values()).sort((a, b) => b.mtdRevenue - a.mtdRevenue).slice(0, 10),
      stores: Array.from(storeMap.values()).sort((a, b) => b.mtdRevenue - a.mtdRevenue).slice(0, 10),
      users: Array.from(userMap.values()).sort((a, b) => b.mtdRevenue - a.mtdRevenue).slice(0, 10)
    }
  }, [data])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatVariance = (variance: number) => {
    const sign = variance >= 0 ? '+' : ''
    return `${sign}${variance.toFixed(1)}%`
  }

  const getVarianceColor = (variance: number) => {
    if (variance > 10) return 'text-green-600'
    if (variance > 0) return 'text-green-500'
    if (variance < -10) return 'text-red-600'
    if (variance < 0) return 'text-red-500'
    return 'text-gray-600'
  }

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new()

    // Summary Sheet
    const summaryData = [
      ['LMTD Secondary Sales Vs MTD Report'],
      ['Date Range', `${startDate} to ${endDate}`],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Period Details'],
      ['MTD Period', `${periods?.mtd.start} to ${periods?.mtd.end}`],
      ['LMTD Period', `${periods?.lmtd.start} to ${periods?.lmtd.end}`],
      [],
      ['Summary Metrics'],
      ['MTD Revenue', summary?.totalMtdRevenue || 0],
      ['LMTD Revenue', summary?.totalLmtdRevenue || 0],
      ['Revenue Variance %', summary?.revenueVariancePercent || 0],
      ['MTD Quantity', summary?.totalMtdQuantity || 0],
      ['LMTD Quantity', summary?.totalLmtdQuantity || 0],
      ['Quantity Variance %', summary?.quantityVariancePercent || 0],
      [],
      ['Unique Stores', summary?.uniqueStores || 0],
      ['Unique Products', summary?.uniqueProducts || 0],
      ['Unique Users', summary?.uniqueUsers || 0],
      ['Transaction Count', summary?.transactionCount || 0]
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    // Detailed Data Sheet with all requested columns
    const detailedData = data.map(d => ({
      'Date': d.date ? new Date(d.date).toLocaleDateString('en-GB') : '',
      'TL Code': d.tlCode,
      'TL Name': d.tlName,
      'Field User Code': d.fieldUserCode,
      'Field User Name': d.fieldUserName,
      'Store Code': d.storeCode,
      'Store Name': d.storeName,
      'Chain Name': d.chainName,
      'Product Code': d.productCode,
      'Product Name': d.productName,
      'Secondary Sales Current Month': d.secondarySalesCurrentMonth,
      'Secondary Sales Revenue Current Month': d.secondarySalesRevenueCurrentMonth,
      'Secondary Sales Last Month': d.secondarySalesLastMonth,
      'Secondary Sales Revenue Last Month': d.secondarySalesRevenueLastMonth,
      'Secondary Sales Diff': d.secondarySalesDiff,
      'Secondary Sales Revenue Diff': d.secondarySalesRevenueDiff,
      'Revenue Variance %': d.revenueVariancePercent,
      'Quantity Variance %': d.quantityVariancePercent
    }))
    const detailedSheet = XLSX.utils.json_to_sheet(detailedData)
    XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Data')

    XLSX.writeFile(wb, `lmtd-secondary-sales-${startDate}-to-${endDate}.xlsx`)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">LMTD Secondary Sales Vs MTD Report</h1>
            <p className="text-sm text-gray-600 mt-1">Compare Month-To-Date sales with Last Month-To-Date</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-slate-700 bg-white rounded-lg hover:bg-gray-50"
          >
            <Filter size={18} />
            Filters
          </button>
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">Filter Controls</h2>
            </div>
            <button
              onClick={() => {
                const date = new Date()
                setStartDate(new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0])
                setEndDate(new Date().toISOString().split('T')[0])
                setTeamLeaderCode(null)
                setUserCode(null)
                setStoreCode(null)
                setChainName(null)
                setProductCategory(null)
                setProductCode(null)
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
              type="button"
            >
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <CustomDatePicker
              value={startDate}
              onChange={setStartDate}
              label="Start Date"
              placeholder="Select start date"
            />
            <CustomDatePicker
              value={endDate}
              onChange={setEndDate}
              label="End Date"
              placeholder="Select end date"
            />
            <SearchableSelect
              value={teamLeaderCode}
              onChange={setTeamLeaderCode}
              options={filterOptions.teamLeaders}
              placeholder={`All Team Leaders (Available: ${filterOptions.teamLeaders.length})`}
              icon={<Users className="w-4 h-4 text-gray-500" />}
              label="Team Leader"
            />
            <SearchableSelect
              value={userCode}
              onChange={setUserCode}
              options={filterOptions.users}
              placeholder={`All Field Users (Available: ${filterOptions.users.length})`}
              icon={<Users className="w-4 h-4 text-gray-500" />}
              label="Field User"
            />
            <SearchableSelect
              value={chainName}
              onChange={setChainName}
              options={filterOptions.chains}
              placeholder={`All Chains (Available: ${filterOptions.chains.length})`}
              icon={<Store className="w-4 h-4 text-gray-500" />}
              label="Chain"
            />
            <SearchableSelect
              value={storeCode}
              onChange={setStoreCode}
              options={filterOptions.stores}
              placeholder={`All Stores (Available: ${filterOptions.stores.length})`}
              icon={<Store className="w-4 h-4 text-gray-500" />}
              label="Store"
            />
            <SearchableSelect
              value={productCategory}
              onChange={setProductCategory}
              options={filterOptions.categories}
              placeholder={`All Categories (Available: ${filterOptions.categories.length})`}
              icon={<Package className="w-4 h-4 text-gray-500" />}
              label="Product Category"
            />
            <SearchableSelect
              value={productCode}
              onChange={setProductCode}
              options={filterOptions.products}
              placeholder={`All Products (Available: ${filterOptions.products.length})`}
              icon={<Package className="w-4 h-4 text-gray-500" />}
              label="Product"
            />
          </div>

          {periods && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">Period Comparison</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-blue-700">
                  <Calendar size={16} />
                  <span className="font-medium">MTD:</span>
                  <span>{new Date(periods.mtd.start).toLocaleDateString('en-GB')} - {new Date(periods.mtd.end).toLocaleDateString('en-GB')}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <Calendar size={16} />
                  <span className="font-medium">LMTD:</span>
                  <span>{new Date(periods.lmtd.start).toLocaleDateString('en-GB')} - {new Date(periods.lmtd.end).toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      {!loading && !error && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600 font-medium">MTD Revenue</p>
                  <InfoTooltip content="Month-To-Date revenue from the start of current month to selected date" />
                </div>
                <p className="text-xl font-bold text-gray-800 mt-2">{formatCurrency(summary.totalMtdRevenue)}</p>
                <p className="text-xs text-gray-500 mt-1">{summary.totalMtdQuantity.toLocaleString()} units</p>
              </div>
              <IndianRupee className="text-blue-600" size={24} />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600 font-medium">LMTD Revenue</p>
                  <InfoTooltip content="Last Month-To-Date revenue for the same period in previous month" />
                </div>
                <p className="text-xl font-bold text-gray-800 mt-2">{formatCurrency(summary.totalLmtdRevenue)}</p>
                <p className="text-xs text-gray-500 mt-1">{summary.totalLmtdQuantity.toLocaleString()} units</p>
              </div>
              <DollarSign className="text-purple-600" size={24} />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600 font-medium">Revenue Variance</p>
                  <InfoTooltip content="Percentage change: ((MTD - LMTD) ÷ LMTD) × 100. Positive = growth, Negative = decline" />
                </div>
                <p className={`text-xl font-bold mt-2 ${getVarianceColor(summary.revenueVariancePercent)}`}>
                  {formatVariance(summary.revenueVariancePercent)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatCurrency(summary.totalRevenueDiff)}
                </p>
              </div>
              {summary.revenueVariancePercent >= 0 ? (
                <TrendingUp className="text-green-600" size={24} />
              ) : (
                <TrendingDown className="text-red-600" size={24} />
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Unique Stores</p>
                <p className="text-xl font-bold text-gray-800 mt-2">{summary.uniqueStores}</p>
                <p className="text-xs text-gray-500 mt-1">Active stores</p>
              </div>
              <Store className="text-orange-600" size={24} />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Unique Products</p>
                <p className="text-xl font-bold text-gray-800 mt-2">{summary.uniqueProducts}</p>
                <p className="text-xs text-gray-500 mt-1">SKUs sold</p>
              </div>
              <Package className="text-cyan-600" size={24} />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Field Users</p>
                <p className="text-xl font-bold text-gray-800 mt-2">{summary.uniqueUsers}</p>
                <p className="text-xs text-gray-500 mt-1">{summary.uniqueTeamLeaders} TLs</p>
              </div>
              <Users className="text-indigo-600" size={24} />
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      {!loading && !error && data.length > 0 && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'summary'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Summary View
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'detailed'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Detailed View
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          <LoadingBar message="Loading LMTD secondary sales data..." />
          <div className="text-center text-sm text-gray-500">
            Comparing sales data between MTD and LMTD periods...
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-semibold text-red-800">Error Loading Data</p>
          </div>
          <p className="mt-2 text-red-700">{error}</p>
          <button
            onClick={() => fetchData()}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
          <BarChart3 className="mx-auto text-gray-400" size={48} />
          <p className="mt-4 text-gray-600 font-medium">No sales data found for comparison</p>
          <p className="mt-2 text-sm text-gray-500">
            Try adjusting the date range or filters
          </p>
          <div className="mt-4 space-y-2 text-xs text-gray-400">
            <p>Date Range: {startDate} to {endDate}</p>
            {periods && (
              <>
                <p>MTD Period: {periods.mtd.start} to {periods.mtd.end}</p>
                <p>LMTD Period: {periods.lmtd.start} to {periods.lmtd.end}</p>
              </>
            )}
          </div>
        </div>
      ) : viewMode === 'summary' ? (
        /* SUMMARY VIEW - Charts */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Daily Trend Chart */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm xl:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Daily Sales Trend</h3>
              <InfoTooltip content="Comparison of daily sales between current month (MTD) and last month (LMTD)" />
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData.daily} margin={{ top: 5, right: 30, left: 20, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  angle={-45} 
                  textAnchor="end" 
                  height={70} 
                  fontSize={11}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis 
                  tick={{ fill: '#6b7280' }}
                  fontSize={11}
                  tickFormatter={(value) => `AED${(value / 1000).toFixed(0)}K`}
                />
                <RechartsTooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                <Line 
                  type="monotone" 
                  dataKey="mtdRevenue" 
                  stroke="#3b82f6" 
                  name="MTD Revenue" 
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="lmtdRevenue" 
                  stroke="#8b5cf6" 
                  name="LMTD Revenue" 
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top 10 Products by MTD Revenue */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top 10 Products by MTD Revenue</h3>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData.products.map(d => ({
                name: d.name.length > 20 ? d.name.substring(0, 20) + '...' : d.name,
                MTD: d.mtdRevenue,
                LMTD: d.lmtdRevenue
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={10} tick={{ fill: '#6b7280' }} />
                <YAxis 
                  tick={{ fill: '#6b7280' }}
                  fontSize={11}
                  tickFormatter={(value) => value >= 1000 ? `AED${(value / 1000).toFixed(0)}K` : `AED${value}`}
                />
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="MTD" fill="#3b82f6" name="MTD" />
                <Bar dataKey="LMTD" fill="#8b5cf6" name="LMTD" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 10 Stores by MTD Revenue */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top 10 Stores by MTD Revenue</h3>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData.stores.map(d => ({
                name: d.name.length > 20 ? d.name.substring(0, 20) + '...' : d.name,
                MTD: d.mtdRevenue,
                LMTD: d.lmtdRevenue
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={10} tick={{ fill: '#6b7280' }} />
                <YAxis 
                  tick={{ fill: '#6b7280' }}
                  fontSize={11}
                  tickFormatter={(value) => value >= 1000 ? `AED${(value / 1000).toFixed(0)}K` : `AED${value}`}
                />
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="MTD" fill="#3b82f6" name="MTD" />
                <Bar dataKey="LMTD" fill="#8b5cf6" name="LMTD" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 10 Field Users by MTD Revenue */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm xl:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top 10 Field Users by MTD Revenue</h3>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData.users.map(d => ({
                name: d.name.length > 25 ? d.name.substring(0, 25) + '...' : d.name,
                MTD: d.mtdRevenue,
                LMTD: d.lmtdRevenue
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={10} tick={{ fill: '#6b7280' }} />
                <YAxis 
                  tick={{ fill: '#6b7280' }}
                  fontSize={11}
                  tickFormatter={(value) => value >= 1000 ? `AED${(value / 1000).toFixed(0)}K` : `AED${value}`}
                />
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="MTD" fill="#3b82f6" name="MTD" />
                <Bar dataKey="LMTD" fill="#8b5cf6" name="LMTD" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* DETAILED VIEW - Table with all columns */
        <div className={isFullscreen ? "fixed inset-0 z-50 bg-white flex flex-col" : "bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"}>
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Detailed Transaction-Level Comparison</h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, data.length)} of {data.length} records
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="px-3 py-2 border border-gray-300 bg-white rounded hover:bg-gray-50"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
              {isFullscreen && (
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  title="Close"
                >
                  <X size={18} />
                </button>
              )}
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200"
              >
                <Download size={18} />
                Export Excel
              </button>
            </div>
          </div>

          <div className={isFullscreen ? "flex-1 overflow-auto" : "overflow-x-auto max-h-[600px]"}>
            <table className="w-full min-w-[2000px]">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TL Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TL Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">User Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">User Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Store Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Store Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Chain Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Product Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Product Name</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Sales Current Month</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Revenue Current Month</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Sales Last Month</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Revenue Last Month</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Sales Diff</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Revenue Diff</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Revenue Var %</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Quantity Var %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.date ? new Date(item.date).toLocaleDateString('en-GB') : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.tlCode || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.tlName?.length > 20 ? `${item.tlName.substring(0, 20)}...` : item.tlName || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.fieldUserCode || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.fieldUserName?.length > 20 ? `${item.fieldUserName.substring(0, 20)}...` : item.fieldUserName || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.storeCode || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.storeName?.length > 25 ? `${item.storeName.substring(0, 25)}...` : item.storeName || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.chainName?.length > 20 ? `${item.chainName.substring(0, 20)}...` : item.chainName || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.productCode || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.productName?.length > 25 ? `${item.productName.substring(0, 25)}...` : item.productName || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {item.secondarySalesCurrentMonth?.toLocaleString() || '0'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(item.secondarySalesRevenueCurrentMonth || 0)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {item.secondarySalesLastMonth?.toLocaleString() || '0'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(item.secondarySalesRevenueLastMonth || 0)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      <span className={item.secondarySalesDiff >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {item.secondarySalesDiff?.toLocaleString() || '0'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      <span className={item.secondarySalesRevenueDiff >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(item.secondarySalesRevenueDiff || 0)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-center font-medium ${getVarianceColor(item.revenueVariancePercent || 0)}`}>
                      {formatVariance(item.revenueVariancePercent || 0)}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-center font-medium ${getVarianceColor(item.quantityVariancePercent || 0)}`}>
                      {formatVariance(item.quantityVariancePercent || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages} • {data.length} total records
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-medium">
                  {currentPage}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
