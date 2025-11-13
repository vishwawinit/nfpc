'use client'

import { useState, useEffect, useMemo } from 'react'
import { Package, RefreshCw, Maximize, Minimize, Filter, User, Users, Store, Building2, BarChart3, Download, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { CustomDatePicker } from '@/components/ui/CustomDatePicker'
import * as XLSX from 'xlsx'

interface ExpiryVisit {
  visitedDate: string
  tlCode: string
  tlName: string
  fieldUserCode: string
  fieldUserName: string
  customerCode: string
  customerName: string
  chainCode: string
  chainName: string
  productCount: number
  expiredQuantity: number
  totalQuantity: number
}

interface ExpiryProduct {
  expiryCheckId: string
  productCode: string
  productName: string
  productCategory: string
  category: string
  batchNumber?: string
  expiryDate: string
  daysToExpiry: number
  itemsChecked: number
  itemsExpired: number
  quantity: number
  uom?: string
  actionTaken?: string
  remarks?: string
}

interface FilterOptions {
  users: Array<{ value: string; label: string }>
  customers: Array<{ value: string; label: string }>
  chains: Array<{ value: string; label: string }>
  categories: Array<{ value: string; label: string }>
  statuses: Array<{ value: string; label: string }>
  teamLeaders: Array<{ value: string; label: string; role: string }>
  assistantLeaders: Array<{ value: string; label: string; role: string }>
}

interface AgeingReportProps {
  loginUserCode?: string
}

export function AgeingReport({ loginUserCode = 'admin' }: AgeingReportProps) {
  const [visits, setVisits] = useState<ExpiryVisit[]>([])
  const [summaryMetrics, setSummaryMetrics] = useState<any>(null) // Calculated metrics from API
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary')
  const [isTableFullscreen, setIsTableFullscreen] = useState(false)
  
  // Product details modal
  const [showProductsModal, setShowProductsModal] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<ExpiryVisit | null>(null)
  const [products, setProducts] = useState<ExpiryProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 100
  
  // Filter options from API
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    users: [],
    customers: [],
    chains: [],
    categories: [],
    statuses: [],
    teamLeaders: [],
    assistantLeaders: []
  })
  
  // Filter selections
  const [selectedTeamLeader, setSelectedTeamLeader] = useState('')
  const [selectedUserCode, setSelectedUserCode] = useState('')
  const [selectedCustomerCode, setSelectedCustomerCode] = useState('')
  const [selectedChainCode, setSelectedChainCode] = useState('')
  
  // Date range - default to current month (1st to today)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  // Fetch filter options when filters change (cascading)
  useEffect(() => {
    fetchFilterOptions()
  }, [
    startDate,
    endDate,
    selectedTeamLeader,
    selectedUserCode,
    selectedCustomerCode,
    selectedChainCode
  ])

  // Fetch data when any filter changes
  useEffect(() => {
    // Reset summary metrics when filters change
    setSummaryMetrics(null)
    fetchData()
  }, [
    startDate,
    endDate,
    selectedTeamLeader,
    selectedUserCode,
    selectedCustomerCode,
    selectedChainCode,
    viewMode,
    currentPage
  ])

  const fetchFilterOptions = async () => {
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        loginUserCode,
        ...(selectedTeamLeader && { teamLeaderCode: selectedTeamLeader }),
        ...(selectedUserCode && { fieldUserCode: selectedUserCode }),
        ...(selectedCustomerCode && { customerCode: selectedCustomerCode }),
        ...(selectedChainCode && { chainCode: selectedChainCode })
      })

      const response = await fetch(`/api/expiry/filters?${params}`)
      const result = await response.json()

      if (result.success) {
        setFilterOptions(result.data)
      }
    } catch (err) {
      console.error('Error fetching filter options:', err)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Build base params
      const baseParamsObj: Record<string, string> = {
        startDate,
        endDate,
        loginUserCode
      }
      
      // Add filters
      if (selectedTeamLeader) baseParamsObj.teamLeaderCode = selectedTeamLeader
      if (selectedUserCode) baseParamsObj.fieldUserCode = selectedUserCode
      if (selectedCustomerCode) baseParamsObj.customerCode = selectedCustomerCode
      if (selectedChainCode) baseParamsObj.chainCode = selectedChainCode
      
      console.log('Frontend - fetchData called with viewMode:', viewMode)
      
      if (viewMode === 'detailed') {
        // For detailed view, fetch grouped visits (paginated)
        console.log('Frontend - Fetching grouped visits for detailed view: page=', currentPage, 'limit=', pageSize)
        const detailedParamsObj = { ...baseParamsObj }
        detailedParamsObj.page = currentPage.toString()
        detailedParamsObj.limit = pageSize.toString()
        
        const detailedParams = new URLSearchParams(detailedParamsObj)
        const detailedResponse = await fetch(`/api/expiry/visits?${detailedParams}`)
        
        if (!detailedResponse.ok) {
          throw new Error(`HTTP error! status: ${detailedResponse.status}`)
        }
        
        const detailedResult = await detailedResponse.json()
        
        if (detailedResult.success) {
          setVisits(detailedResult.data || [])
          setTotalCount(detailedResult.totalCount || 0)
          setTotalPages(detailedResult.totalPages || 1)
          console.log('Frontend - Fetched grouped visits:', detailedResult.data.length, 'visits')
          
          // Fetch summary metrics if not already loaded
          if (!summaryMetrics) {
            console.log('Frontend - Fetching summary metrics')
            const summaryParams = new URLSearchParams(baseParamsObj)
            const summaryResponse = await fetch(`/api/expiry/summary?${summaryParams}`)
            const summaryResult = await summaryResponse.json()
            
            if (summaryResult.success) {
              setSummaryMetrics(summaryResult.data)
              console.log('Frontend - Fetched summary metrics:', summaryResult.data)
            }
          }
        } else {
          setError(detailedResult.error || 'Failed to fetch expiry visits')
        }
      } else {
        // For summary view, fetch pre-calculated metrics from summary API
        console.log('Frontend - Fetching summary metrics for summary view')
        const summaryParams = new URLSearchParams(baseParamsObj)
        const summaryResponse = await fetch(`/api/expiry/summary?${summaryParams}`)
        
        if (!summaryResponse.ok) {
          throw new Error(`HTTP error! status: ${summaryResponse.status}`)
        }
        
        const summaryResult = await summaryResponse.json()
        
        if (summaryResult.success) {
          setSummaryMetrics(summaryResult.data)
          setTotalCount(summaryResult.data.totalChecks)
          console.log('Frontend - Fetched summary metrics:', summaryResult.data)
        } else {
          setError(summaryResult.error || 'Failed to fetch expiry summary')
        }
      }
    } catch (err) {
      console.error('Error fetching expiry data:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch expiry data'
      setError(errorMessage)
      setVisits([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch products for a specific visit
  const fetchProductsForVisit = async (visit: ExpiryVisit) => {
    try {
      setLoadingProducts(true)
      setSelectedVisit(visit)
      setShowProductsModal(true)
      setProducts([]) // Clear previous products
      
      // Send the FULL timestamp (not just date) to avoid timezone issues
      const visitedTimestamp = visit.visitedDate
      
      const params = new URLSearchParams({
        visitedDate: visitedTimestamp.toString(),
        customerCode: visit.customerCode,
        fieldUserCode: visit.fieldUserCode,
        loginUserCode
      })
      
      console.log('Fetching products for visit:')
      console.log('  - visitedDate (full):', visitedTimestamp)
      console.log('  - customerCode:', visit.customerCode)
      console.log('  - fieldUserCode:', visit.fieldUserCode)
      console.log('  - URL:', `/api/expiry/products?${params}`)
      
      const response = await fetch(`/api/expiry/products?${params}`)
      const result = await response.json()
      
      console.log('Products API response:')
      console.log('  - success:', result.success)
      console.log('  - count:', result.count)
      console.log('  - data length:', result.data?.length || 0)
      if (result.error) console.log('  - error:', result.error)
      if (result.message) console.log('  - message:', result.message)
      if (result.details) console.log('  - details:', result.details)
      
      if (result.success) {
        setProducts(result.data || [])
        console.log('Fetched products:', result.data?.length || 0)
      } else {
        console.error('Products API error:', result.error)
        console.error('Products API message:', result.message)
        console.error('Products API details:', result.details)
        setError(result.message || result.error || 'Failed to fetch products')
      }
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
    } finally {
      setLoadingProducts(false)
    }
  }

  // Use pre-calculated metrics from API
  const metrics = useMemo(() => {
    if (!summaryMetrics) {
      return {
        totalChecks: 0,
        totalExpiredItems: 0,
        totalItemsChecked: 0,
        storesWithExpiry: 0,
        expiryRate: '0.00',
        topStores: [],
        statusData: []
      }
    }

    return {
      totalChecks: summaryMetrics.totalChecks || 0,
      totalExpiredItems: summaryMetrics.totalExpiredItems || 0,
      totalItemsChecked: summaryMetrics.totalItemsChecked || 0,
      storesWithExpiry: summaryMetrics.storesWithExpiry || 0,
      expiryRate: summaryMetrics.expiryRate || '0.00',
      topStores: summaryMetrics.topStores || [],
      statusData: summaryMetrics.statusData || []
    }
  }, [summaryMetrics])

  const exportToExcel = async () => {
    try {
      setLoading(true)
      
      // Build params for export
      const baseParamsObj: Record<string, string> = {
        startDate,
        endDate
      }
      
      if (selectedTeamLeader) baseParamsObj.teamLeaderCode = selectedTeamLeader
      if (selectedUserCode) baseParamsObj.fieldUserCode = selectedUserCode
      if (selectedCustomerCode) baseParamsObj.customerCode = selectedCustomerCode
      if (selectedChainCode) baseParamsObj.chainCode = selectedChainCode
      
      const exportParams = new URLSearchParams(baseParamsObj)
      console.log('Exporting data with params:', exportParams.toString())
      
      const response = await fetch(`/api/expiry/export?${exportParams}`)
      const result = await response.json()
      
      if (result.success && result.data) {
        console.log('Exporting', result.data.length, 'rows to Excel')
        
    const worksheet = XLSX.utils.json_to_sheet(
          result.data.map((row: any) => ({
            'Date': new Date(row.visitedDate).toLocaleDateString('en-GB'),
            'TL Code': row.tlCode || '—',
            'TL Name': row.tlName || '—',
            'Field User Code': row.fieldUserCode || '—',
            'Field User Name': row.fieldUserName || '—',
            'Customer Code': row.customerCode || '—',
            'Customer Name': row.customerName || '—',
            'Chain Name': row.chainName || '—',
            'Product Code': row.productCode || '—',
            'Product Name': row.productName || '—',
            'Expiry Date': row.expiryDate ? new Date(row.expiryDate).toLocaleDateString('en-GB') : '—',
            'Expiry Quantity': row.expiryQuantity || 0
      }))
    )
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ageing Report')
    XLSX.writeFile(workbook, `ageing-report-${new Date().toISOString().split('T')[0]}.xlsx`)
        
        console.log('Excel export completed successfully')
      } else {
        setError(result.error || 'Failed to export data')
      }
    } catch (err) {
      console.error('Error exporting to Excel:', err)
      setError(err instanceof Error ? err.message : 'Failed to export data')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (daysToExpiry: number) => {
    if (daysToExpiry <= 0) return { label: 'Expired', color: 'bg-red-100 text-red-800' }
    if (daysToExpiry <= 30) return { label: 'Near Expiry', color: 'bg-orange-100 text-orange-800' }
    return { label: 'Safe', color: 'bg-green-100 text-green-800' }
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-slate-50 p-6 space-y-6 overflow-y-auto" : "min-h-screen bg-slate-50 p-4 md:p-6 space-y-6"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Ageing Report (Product Expiry)
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Track expired and near-expiry products across stores
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div 
          className="px-6 py-4 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setShowFilters(!showFilters)}
        >
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-600" />
            Filters
          </h2>
          <span className="text-sm text-blue-600 font-medium">
            {showFilters ? 'Hide' : 'Show'} Filters
          </span>
        </div>
        {showFilters && (
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Range */}
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

              {/* Team Leader */}
              <SearchableSelect
                value={selectedTeamLeader || null}
                onChange={(value) => {
                  setSelectedTeamLeader(value || '')
                  setSelectedUserCode('')  // Reset dependent filter
                }}
                options={filterOptions.teamLeaders}
                placeholder={`All Team Leaders (${filterOptions.teamLeaders.length})`}
                icon={<Users className="w-4 h-4 text-gray-500" />}
                label="Team Leader"
                formatOptionLabel={(option) => option.label}
              />

              {/* Field User */}
              <SearchableSelect
                value={selectedUserCode || null}
                onChange={(value) => setSelectedUserCode(value || '')}
                options={filterOptions.users}
                placeholder={`All Users (${filterOptions.users.length})`}
                icon={<User className="w-4 h-4 text-gray-500" />}
                label="Field User"
                formatOptionLabel={(option) => option.label}
              />

              {/* Store */}
              <SearchableSelect
                value={selectedCustomerCode || null}
                onChange={(value) => setSelectedCustomerCode(value || '')}
                options={filterOptions.customers}
                placeholder={`All Stores (${filterOptions.customers.length})`}
                icon={<Store className="w-4 h-4 text-gray-500" />}
                label="Store"
                formatOptionLabel={(option) => option.label}
              />

              {/* Chain */}
              <SearchableSelect
                value={selectedChainCode || null}
                onChange={(value) => setSelectedChainCode(value || '')}
                options={filterOptions.chains}
                placeholder={`All Chains (${filterOptions.chains.length})`}
                icon={<Building2 className="w-4 h-4 text-gray-500" />}
                label="Chain"
                formatOptionLabel={(option) => option.label}
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && <LoadingBar message="Loading expiry data..." />}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && !error && summaryMetrics && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Package className="text-blue-600" size={24} />
              Expiry Check Summary
            </h2>
            <p className="text-sm text-gray-600 mt-1">Overview of all expiry checks in the selected period</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Total Checks</p>
                <InfoTooltip content="Total number of expiry check records" />
              </div>
              <p className="text-3xl font-bold text-blue-600">{metrics.totalChecks.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Expired Quantity</p>
                <InfoTooltip content="Total quantity (units) of expired products" />
              </div>
              <p className="text-3xl font-bold text-red-600">{metrics.totalExpiredItems.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                <InfoTooltip content="Total quantity (units) checked for expiry" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{metrics.totalItemsChecked.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Stores with Issues</p>
                <InfoTooltip content="Number of stores with expired products" />
              </div>
              <p className="text-3xl font-bold text-orange-600">{metrics.storesWithExpiry}</p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Expiry Rate</p>
                <InfoTooltip content="Percentage of quantity expired out of total quantity checked" />
              </div>
              <p className="text-3xl font-bold text-red-600">{metrics.expiryRate}%</p>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle - Always show when not loading and no error */}
      {!loading && !error && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
            <button
              onClick={() => {
                console.log('Switching to summary view')
                setViewMode('summary')
              }}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'summary'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Summary View
            </button>
            <button
              onClick={() => {
                console.log('Switching to detailed view')
                setViewMode('detailed')
                setCurrentPage(1) // Reset to first page when entering detailed view
              }}
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

      {/* Summary View - Charts */}
      {!loading && !error && summaryMetrics && viewMode === 'summary' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Top 10 Stores Chart */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 size={24} className="text-orange-600" />
              Top 10 Stores by Expired Items
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={metrics.topStores}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="storeName" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <RechartsTooltip formatter={(value: number) => [value.toLocaleString(), 'Expired Items']} />
                <Bar dataKey="count" fill="#f59e0b" name="Expired Items" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Distribution Pie Chart */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Package size={24} className="text-purple-600" />
              Expiry Status Distribution
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={metrics.statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.name}: ${entry.value}`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metrics.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed View - Table */}
      {!loading && !error && visits.length > 0 && viewMode === 'detailed' && (
        <div className={`bg-white rounded-lg shadow border border-gray-200 ${isTableFullscreen ? 'fixed inset-4 z-50' : ''}`}>
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Customer Visits with Expiry Checks</h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} visits
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                Export to Excel
              </button>
              <button
                onClick={() => setIsTableFullscreen(!isTableFullscreen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {isTableFullscreen ? <X className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                {isTableFullscreen ? 'Close' : 'Fullscreen'}
              </button>
            </div>
          </div>
          <div className={isTableFullscreen ? "overflow-x-auto max-h-[calc(100vh-150px)]" : "overflow-x-auto max-h-[600px]"}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TL Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TL Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Field User Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Field User Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Customer Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Customer Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">Chain Name</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px]">Quantity</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visits.map((visit, index) => (
                  <tr key={`${visit.visitedDate}-${visit.customerCode}-${visit.fieldUserCode}-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(visit.visitedDate).toLocaleDateString('en-GB')}
                      </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{visit.tlCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{visit.tlName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{visit.fieldUserCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{visit.fieldUserName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{visit.customerCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{visit.customerName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{visit.chainName || '—'}</td>
                      <td className="px-4 py-3 text-sm text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold text-gray-900">{visit.totalQuantity.toLocaleString()}</span>
                        <span className="text-xs text-gray-500">{visit.productCount} items</span>
                        {visit.expiredQuantity > 0 && (
                          <span className="text-xs text-red-600 font-medium">
                            {visit.expiredQuantity.toLocaleString()} expired
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button
                        onClick={() => fetchProductsForVisit(visit)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium"
                      >
                        View
                      </button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Data State */}
      {!loading && !error && !summaryMetrics && totalCount === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Package className="mx-auto text-gray-400" size={48} />
          <p className="mt-4 text-gray-600">No expiry checks found for the selected period</p>
        </div>
      )}

      {/* Products Modal */}
      {showProductsModal && selectedVisit && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
              onClick={() => setShowProductsModal(false)}
            />

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-white">
                    <h3 className="text-lg font-bold">Product Expiry Details</h3>
                    <p className="text-sm text-blue-100 mt-1">
                      {selectedVisit.customerName} ({selectedVisit.customerCode}) - {new Date(selectedVisit.visitedDate).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowProductsModal(false)}
                    className="text-white hover:bg-blue-800 rounded-full p-2 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Visit Info */}
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Team Leader:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedVisit.tlName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Field User:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedVisit.fieldUserName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Chain:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedVisit.chainName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Quantity:</span>
                    <span className="ml-2 font-semibold text-blue-600 text-lg">{selectedVisit.totalQuantity.toLocaleString()} units</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Product Records:</span>
                    <span className="ml-2 font-semibold text-green-600 text-lg">{loadingProducts ? '...' : products.length} individual records</span>
                  </div>
                </div>
              </div>

              {/* Products Table */}
              <div className="px-6 py-4 max-h-[500px] overflow-y-auto">
                {loadingProducts ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
                    <span className="ml-3 text-gray-600">Loading products...</span>
                  </div>
                ) : products.length > 0 ? (
                  <>
                    <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase w-12">#</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Check ID</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Product Code</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Product Name</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Expiry Date</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Days to Expiry</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Quantity</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {products.map((product, index) => {
                        const status = getStatusBadge(product.daysToExpiry)
                        return (
                          <tr key={`${product.expiryCheckId}-${index}`} className="hover:bg-gray-50">
                            <td className="px-3 py-3 text-sm text-center text-gray-500 font-medium">{index + 1}</td>
                            <td className="px-3 py-3 text-sm text-gray-600 font-mono text-xs">{product.expiryCheckId}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">{product.productCode}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">{product.productName}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">
                              {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td className="px-3 py-3 text-sm text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                                {product.daysToExpiry} days
                              </span>
                            </td>
                            <td className="px-3 py-3 text-sm text-right">
                              <div className="flex flex-col items-end">
                                <div>
                                  <span className="font-semibold">{product.quantity}</span>
                                  <span className="text-gray-500 text-xs ml-1">{product.uom}</span>
                                </div>
                                {product.recordCount > 1 && (
                                  <span className="text-xs text-orange-600">
                                    ({product.recordCount} duplicates merged)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-sm text-center">
                              {product.itemsExpired === 1 ? (
                                <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                                  Expired
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                  OK
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </>
                ) : products.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="mx-auto text-gray-400 mb-4" size={48} />
                    <p className="text-gray-600 font-semibold mb-2">No products found for this visit</p>
                    <p className="text-sm text-gray-500">
                      Check the browser console for details
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowProductsModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
