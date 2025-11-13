'use client'

import { useState, useEffect, useMemo } from 'react'
import { Eye, RefreshCw, Users, Store, Download, Filter, BarChart3, PieChart as PieChartIcon, Maximize, Minimize, Calendar, ChevronLeft, ChevronRight, DollarSign, Package, Building2, Image as ImageIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, LineChart, Line } from 'recharts'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { CustomDatePicker } from '@/components/ui/CustomDatePicker'
import * as XLSX from 'xlsx'
import { getAssetBaseUrl } from '@/lib/utils'

interface CompetitorObservation {
  observationDate: string
  storeCode: string
  storeName: string
  userCode: string
  userName: string
  teamLeaderCode: string
  teamLeaderName: string
  userRole: string
  chainCode: string
  chainName: string
  competitorBrand: string
  productName: string
  mrp: number
  sellingPrice: string
  sizeOfSku: string
  competitorPrice: number
  companyName: string
  promotionType: string
  imagePath: string
  createdDateTime: string
}

interface FilterOptions {
  users: Array<{ value: string; label: string }>
  stores: Array<{ value: string; label: string }>
  competitorBrands: Array<{ value: string; label: string }>
  products: Array<{ value: string; label: string }>
  chains: Array<{ value: string; label: string }>
  teamLeaders: Array<{ value: string; label: string }>
}

interface Summary {
  totalObservations: number
  uniqueCompetitors: number
  uniqueStores: number
  uniqueProducts: number
  avgCompetitorPrice: number
  withPromotions: number
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

// Helper function to convert any image path to full URL
const getImageUrl = (imagePath: string): string => {
  if (!imagePath) return ''
  
  const baseUrl = getAssetBaseUrl()
  
  // Remove leading ../ if present
  let cleanPath = imagePath.replace(/^\.\.\//, '')
  
  // Remove leading / if present
  cleanPath = cleanPath.replace(/^\//, '')
  
  // For Android local paths, extract just the filename
  // Example: /storage/emulated/0/Android/data/com.winit.farmley/files/Pictures/JPEG_1760081525705_892995600042698
  if (cleanPath.includes('storage/emulated') || cleanPath.includes('Android/data')) {
    // Extract just the filename from Android path
    const parts = cleanPath.split('/')
    cleanPath = parts[parts.length - 1]
  }
  
  // Prepend base URL
  return baseUrl + cleanPath
}

interface CompetitionReportProps {
  loginUserCode?: string
}

export function CompetitionReport({ loginUserCode = 'admin' }: CompetitionReportProps) {
  const [observations, setObservations] = useState<CompetitorObservation[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    users: [],
    stores: [],
    competitorBrands: [],
    products: [],
    chains: [],
    teamLeaders: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters - Default to current month (1st to today)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedTeamLeader, setSelectedTeamLeader] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedChain, setSelectedChain] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // View states
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Pagination (for detailed view only)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50)

  useEffect(() => {
    fetchFilterOptions()
  }, [startDate, endDate, selectedTeamLeader, loginUserCode])

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, selectedTeamLeader, selectedUser, selectedStore, selectedChain, selectedBrand, selectedProduct, loginUserCode])

  const fetchFilterOptions = async () => {
    try {
      console.log('[Competition Report] Fetching filters with loginUserCode:', loginUserCode)
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(selectedTeamLeader && { teamLeaderCode: selectedTeamLeader }),
        ...(loginUserCode && { loginUserCode })
      })

      const response = await fetch(`/api/competition/filters?${params}`)
      const result = await response.json()

      if (result.success) {
        setFilterOptions(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('[Competition Report] Fetching data with loginUserCode:', loginUserCode)
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(selectedTeamLeader && { teamLeaderCode: selectedTeamLeader }),
        ...(selectedUser && { userCode: selectedUser }),
        ...(selectedStore && { storeCode: selectedStore }),
        ...(selectedChain && { chainCode: selectedChain }),
        ...(selectedBrand && { competitorBrand: selectedBrand }),
        ...(selectedProduct && { productName: selectedProduct }),
        ...(loginUserCode && { loginUserCode })
      })

      const response = await fetch(`/api/competition?${params}`)
      const result = await response.json()

      if (result.success) {
        setObservations(result.data)
        setSummary(result.summary)
        setCurrentPage(1) // Reset to first page
      } else {
        setError(result.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError('Failed to fetch competitor observations')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Pagination logic (for detailed view only)
  const paginatedObservations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return observations.slice(startIndex, endIndex)
  }, [observations, currentPage, itemsPerPage])

  const totalPages = Math.ceil(observations.length / itemsPerPage)

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new()

    // Summary Sheet
    const summaryData = [
      ['Competition Observation Report'],
      ['Period', `${startDate} to ${endDate}`],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary Metrics'],
      ['Total Observations', summary?.totalObservations || 0],
      ['Unique Competitors', summary?.uniqueCompetitors || 0],
      ['Unique Stores', summary?.uniqueStores || 0],
      ['Unique Products', summary?.uniqueProducts || 0],
      ['Avg Competitor Price', (summary?.avgCompetitorPrice || 0).toFixed(2)],
      ['With Promotions', summary?.withPromotions || 0],
      [],
      ['Filters Applied'],
      ['Team Leader', selectedTeamLeader || 'All'],
      ['Field User', selectedUser || 'All'],
      ['Store', selectedStore || 'All'],
      ['Chain', selectedChain || 'All'],
      ['Competitor Brand', selectedBrand || 'All'],
      ['Product', selectedProduct || 'All']
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    // Detailed Data Sheet
    const detailedData = observations.map(item => ({
      'Date': new Date(item.observationDate).toLocaleDateString('en-GB'),
      'TL Code': item.teamLeaderCode || '',
      'TL Name': item.teamLeaderName || '',
      'User Code': item.userCode,
      'User Name': item.userName,
      'Store Code': item.storeCode,
      'Store Name': item.storeName,
      'Chain Name': item.chainName || '',
      'Product Name': item.productName || '',
      'Competition Brand Name': item.competitorBrand || '',
      'MRP': item.mrp,
      'Selling Price': item.sellingPrice || '',
      'Size of SKU': item.sizeOfSku || ''
    }))
    const detailedSheet = XLSX.utils.json_to_sheet(detailedData)
    XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Data')

    XLSX.writeFile(wb, `competition-observation-${startDate}-${endDate}.xlsx`)
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-white p-6 space-y-6 overflow-y-auto" : "p-4 md:p-6 space-y-4 md:space-y-6"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Eye className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Competition Observation Report</h1>
            <p className="text-sm text-gray-600 mt-1">Track competitor products, pricing, and promotions in the market</p>
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
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
          {viewMode === 'detailed' && (
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          )}
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
                date.setDate(date.getDate() - 7)
                setStartDate(date.toISOString().split('T')[0])
                setEndDate(new Date().toISOString().split('T')[0])
                setSelectedTeamLeader('')
                setSelectedUser('')
                setSelectedStore('')
                setSelectedChain('')
                setSelectedBrand('')
                setSelectedProduct('')
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
              type="button"
            >
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Start Date */}
            <div>
              <CustomDatePicker
                value={startDate}
                onChange={setStartDate}
                label="Start Date"
                placeholder="Select start date"
              />
            </div>

            {/* End Date */}
            <div>
              <CustomDatePicker
                value={endDate}
                onChange={setEndDate}
                label="End Date"
                placeholder="Select end date"
              />
            </div>

            {/* Chain */}
            <SearchableSelect
              value={selectedChain || null}
              onChange={(value) => setSelectedChain(value || '')}
              options={filterOptions.chains}
              placeholder={`All Chains (Available: ${filterOptions.chains.length})`}
              icon={<Building2 className="w-4 h-4 text-gray-500" />}
              label="Chain / Channel"
              formatOptionLabel={(option) => option.label}
            />

            {/* Store */}
            <SearchableSelect
              value={selectedStore || null}
              onChange={(value) => setSelectedStore(value || '')}
              options={filterOptions.stores}
              placeholder={`All Stores (Available: ${filterOptions.stores.length})`}
              icon={<Store className="w-4 h-4 text-gray-500" />}
              label="Store"
              formatOptionLabel={(option) => option.label}
            />

            {/* Team Leader */}
            <SearchableSelect
              value={selectedTeamLeader || null}
              onChange={(value) => {
                setSelectedTeamLeader(value || '')
                setSelectedUser('')
              }}
              options={filterOptions.teamLeaders}
              placeholder={`All Team Leaders (Available: ${filterOptions.teamLeaders.length})`}
              icon={<Users className="w-4 h-4 text-gray-500" />}
              label="Team Leader"
              formatOptionLabel={(option) => option.label}
            />

            {/* Field User */}
            <SearchableSelect
              value={selectedUser || null}
              onChange={(value) => setSelectedUser(value || '')}
              options={filterOptions.users}
              placeholder={`All Field Users (Available: ${filterOptions.users.length})`}
              icon={<Users className="w-4 h-4 text-gray-500" />}
              label="Field User"
              formatOptionLabel={(option) => option.label}
            />

            {/* Competitor Brand */}
            <SearchableSelect
              value={selectedBrand || null}
              onChange={(value) => setSelectedBrand(value || '')}
              options={filterOptions.competitorBrands}
              placeholder={`All Brands (Available: ${filterOptions.competitorBrands.length})`}
              icon={<Eye className="w-4 h-4 text-gray-500" />}
              label="Competitor Brand"
              formatOptionLabel={(option) => option.label}
            />

            {/* Product */}
            <SearchableSelect
              value={selectedProduct || null}
              onChange={(value) => setSelectedProduct(value || '')}
              options={filterOptions.products}
              placeholder={`All Products (Available: ${filterOptions.products.length})`}
              icon={<Package className="w-4 h-4 text-gray-500" />}
              label="Product"
              formatOptionLabel={(option) => option.label}
            />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && !error && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Total Observations</p>
                <InfoTooltip content="Total number of competitor observations recorded in the selected period" />
              </div>
              <Eye className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{summary.totalObservations}</p>
            <p className="text-xs text-gray-500 mt-1">Competitor tracking records</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Unique Competitors</p>
                <InfoTooltip content="Number of distinct competitor brands observed" />
              </div>
              <Store className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-900">{summary.uniqueCompetitors}</p>
            <p className="text-xs text-gray-500 mt-1">Brands tracked</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Avg Competitor Price</p>
                <InfoTooltip content="Average price of competitor products observed" />
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900">AED{summary.avgCompetitorPrice.toFixed(0)}</p>
            <p className="text-xs text-gray-500 mt-1">Market pricing</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">With Promotions</p>
                <InfoTooltip content="Number of observations with active promotions" />
              </div>
              <Package className="w-8 h-8 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-orange-900">{summary.withPromotions}</p>
            <p className="text-xs text-gray-500 mt-1">{summary.totalObservations > 0 ? ((summary.withPromotions / summary.totalObservations) * 100).toFixed(1) : 0}% have promos</p>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      {!loading && !error && observations.length > 0 && (
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
        <LoadingBar message="Loading competitor observations..." />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      ) : observations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Eye className="mx-auto text-gray-400" size={48} />
          <p className="mt-4 text-gray-600">No competitor observations found for the selected period</p>
        </div>
      ) : viewMode === 'summary' ? (
        /* SUMMARY VIEW - Charts and Analytics */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Top Competitor Brands */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top 10 Competitor Brands by Observations</h3>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={(() => {
                const brandData = observations.reduce((acc: any, obs) => {
                  const brand = obs.competitorBrand || 'Unknown'
                  acc[brand] = (acc[brand] || 0) + 1
                  return acc
                }, {})
                return Object.entries(brandData)
                  .map(([brand, count]) => ({ 
                    brand: brand.length > 15 ? brand.substring(0, 15) + '...' : brand,
                    'Observations': count 
                  }))
                  .sort((a: any, b: any) => b.Observations - a.Observations)
                  .slice(0, 10)
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="brand" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="Observations" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Average Competitor Price by Brand */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top 10 Brands by Avg Price</h3>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={(() => {
                const brandPrices = observations.reduce((acc: any, obs) => {
                  const brand = obs.competitorBrand || 'Unknown'
                  if (!acc[brand]) {
                    acc[brand] = { total: 0, count: 0 }
                  }
                  if (obs.competitorPrice > 0) {
                    acc[brand].total += obs.competitorPrice
                    acc[brand].count += 1
                  }
                  return acc
                }, {})
                return Object.entries(brandPrices)
                  .map(([brand, data]: [string, any]) => ({
                    brand: brand.length > 15 ? brand.substring(0, 15) + '...' : brand,
                    'Avg Price': data.count > 0 ? Number((data.total / data.count).toFixed(0)) : 0
                  }))
                  .filter(d => d['Avg Price'] > 0)
                  .sort((a, b) => b['Avg Price'] - a['Avg Price'])
                  .slice(0, 10)
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="brand" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis tickFormatter={(value: number) => `AED${value}`} />
                <RechartsTooltip formatter={(value: number) => `AED${value}`} />
                <Legend />
                <Bar dataKey="Avg Price" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Observation Trend */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm xl:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Daily Observation Activity</h3>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={(() => {
                const dailyData = observations.reduce((acc: any, obs) => {
                  const date = new Date(obs.observationDate).toLocaleDateString('en-GB')
                  acc[date] = (acc[date] || 0) + 1
                  return acc
                }, {})
                return Object.entries(dailyData)
                  .map(([date, count]) => ({ date, 'Observations': count }))
                  .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="Observations" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* DETAILED VIEW - Data Table with Pagination */
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Detailed Competitor Observations</h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, observations.length)} of {observations.length} observations
              </p>
            </div>
            <button
              onClick={exportToExcel}
              disabled={observations.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              Export Excel
            </button>
          </div>

          <div className={isFullscreen ? "overflow-x-auto max-h-[calc(100vh-300px)]" : "overflow-x-auto max-h-[600px]"}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[90px]">TL Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">TL Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">User Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">User Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">Store Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[200px]">Store Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">Chain Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[200px]">Product Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[180px]">Competition Brand Name</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[80px]">MRP</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">Selling Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px]">Size of SKU</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">Image</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedObservations.map((item, index) => (
                  <tr key={index} className="hover:bg-purple-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(item.observationDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{item.teamLeaderCode || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.teamLeaderName || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{item.userCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.userName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{item.storeCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.storeName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.chainName || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.productName || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                        {item.competitorBrand || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-blue-600">
                      AED{item.mrp.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                      {item.sellingPrice ? `AED${item.sellingPrice}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.sizeOfSku || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {item.imagePath ? (
                        <a
                          href={getImageUrl(item.imagePath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block group"
                        >
                          <img
                            src={getImageUrl(item.imagePath)}
                            alt="Competitor Product"
                            className="w-20 h-20 object-cover rounded-md border border-gray-200 hover:border-purple-500 transition-all cursor-pointer shadow-sm hover:shadow-md"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden text-xs text-gray-400 mt-1">
                            <ImageIcon size={16} className="inline" /> No image
                          </div>
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
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
                Page {currentPage} of {totalPages} • {observations.length} total observations
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
