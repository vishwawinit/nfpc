'use client'

import { useState, useEffect, useMemo } from 'react'
import { ClipboardList, RefreshCw, Users, Store, DollarSign, Download, Calendar, Filter, Package, PieChart as PieChartIcon, BarChart3, Maximize, Minimize, ZoomIn, ZoomOut, X, User, Building2, Boxes, ShoppingCart, TrendingUp, AlertCircle, Eye } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, LineChart, Line } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { CustomDatePicker } from '@/components/ui/CustomDatePicker'
import * as XLSX from 'xlsx'
import { getAssetBaseUrl } from '@/lib/utils'

interface PurchaseOrder {
  poDate: string
  poCreatedDateTime: string
  userCode: string
  userName: string
  teamLeaderCode: string
  teamLeaderName: string
  storeCode: string
  storeName: string
  chainName: string
  chainCode: string
  trxCode: string
  poNumber: string
  poStatus: string
  totalAmount: number
  productCode: string
  productName: string
  productCategory: string
  quantity: number
  receivedQuantity: number
  pendingQuantity: number
  unitPrice: number
  lineAmount: number
  deliveryStatus: string
  poImagePath?: string
  po_image_path?: string
  imagePath?: string
  image_path?: string
  image?: string
  photo?: string
  photoPath?: string
  latitude?: number
  longitude?: number
}

interface FilterOption {
  value: string
  label: string
}

interface FilterOptions {
  users: FilterOption[]
  stores: FilterOption[]
  statuses: FilterOption[]
  chains: FilterOption[]
  categories: FilterOption[]
  deliveryStatuses: FilterOption[]
  teamLeaders: FilterOption[]
  assistantLeaders: FilterOption[]
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

type ViewMode = 'summary' | 'detailed'

interface POStatusReportProps {
  loginUserCode?: string
}

export function POStatusReport({ loginUserCode = 'admin' }: POStatusReportProps) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    users: [],
    stores: [],
    statuses: [],
    chains: [],
    categories: [],
    deliveryStatuses: [],
    teamLeaders: [],
    assistantLeaders: []
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
  const [selectedUserCode, setSelectedUserCode] = useState('')
  const [selectedStoreCode, setSelectedStoreCode] = useState('')
  const [selectedChainName, setSelectedChainName] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedDeliveryStatus, setSelectedDeliveryStatus] = useState('')
  const [showFilters, setShowFilters] = useState(true)
  
  const [viewMode, setViewMode] = useState<ViewMode>('summary')
  const [isTableFullscreen, setIsTableFullscreen] = useState(false)
  
  // Dialog state
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Fetch filter options - cascading filters
  const fetchFilterOptions = async () => {
    try {
      const params = new URLSearchParams()
      params.append('startDate', startDate)
      params.append('endDate', endDate)
      params.append('loginUserCode', loginUserCode)
      if (selectedTeamLeader) params.append('teamLeaderCode', selectedTeamLeader)
      if (selectedUserCode) params.append('userCode', selectedUserCode)
      if (selectedStoreCode) params.append('storeCode', selectedStoreCode)
      if (selectedChainName) params.append('chainCode', selectedChainName)

      const response = await fetch(`/api/purchase-orders/filters?${params}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Filters API Error:', errorData)
        throw new Error(`Filters API error ${response.status}: ${errorData.message || 'Unknown error'}`)
      }
      const result = await response.json()

      if (result.success) {
        setFilterOptions(result.data)
      } else {
        console.error('Filter API returned error:', result.error, result.message)
        setError(`Filter error: ${result.message || result.error}`)
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load filters'
      setError(errorMessage)
    }
  }

  // Fetch PO data
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.append('startDate', startDate)
      params.append('endDate', endDate)
      params.append('loginUserCode', loginUserCode)
      if (selectedTeamLeader) params.append('teamLeaderCode', selectedTeamLeader)
      if (selectedUserCode) params.append('userCode', selectedUserCode)
      if (selectedStoreCode) params.append('storeCode', selectedStoreCode)
      if (selectedChainName) params.append('chainCode', selectedChainName)
      if (selectedStatus) params.append('poStatus', selectedStatus)
      if (selectedDeliveryStatus) params.append('deliveryStatus', selectedDeliveryStatus)

      const response = await fetch(`/api/purchase-orders?${params}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error ${response.status}: ${errorText}`)
      }
      
      const result = await response.json()

      if (result.success) {
        const data = result.data || []
        console.log('PO Data sample:', data[0]) // Debug: Log first item to see structure
        console.log('Available fields:', data[0] ? Object.keys(data[0]) : 'No data')
        console.log('Image field value:', data[0]?.poImagePath) // Debug: Check specific field
        setOrders(data)
      } else {
        setError(result.error || 'Failed to fetch data')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch purchase orders'
      setError(errorMessage)
      console.error('PO fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch filters when any filter changes
  useEffect(() => {
    fetchFilterOptions()
  }, [
    startDate,
    endDate,
    selectedTeamLeader,
    selectedUserCode,
    selectedStoreCode,
    selectedChainName
  ])

  // Fetch data when filters change
  useEffect(() => {
    fetchData()
  }, [
    startDate,
    endDate,
    selectedTeamLeader,
    selectedUserCode,
    selectedStoreCode,
    selectedChainName,
    selectedStatus,
    selectedDeliveryStatus
  ])

  // Calculate metrics
  const metrics = useMemo(() => {
    // Unique POs (by trxCode)
    const totalPOs = new Set(orders.map(o => o.trxCode)).size
    
    // Group orders by PO to get unique PO totals
    const poMap = new Map<string, PurchaseOrder[]>()
    orders.forEach(order => {
      if (!poMap.has(order.trxCode)) {
        poMap.set(order.trxCode, [])
      }
      poMap.get(order.trxCode)!.push(order)
    })

    // Total amount and units
    const totalAmount = Array.from(poMap.values()).reduce((sum, poOrders) => {
      return sum + (poOrders[0]?.totalAmount || 0)
    }, 0)

    const totalUnits = orders.reduce((sum, o) => sum + o.quantity, 0)
    const uniqueStores = new Set(orders.map(o => o.storeCode)).size
    const uniqueUsers = new Set(orders.map(o => o.userCode)).size
    const uniqueProducts = new Set(orders.map(o => o.productCode)).size

    // Status breakdown
    const statusCounts = Array.from(poMap.values()).reduce((acc: Record<string, number>, poOrders) => {
      const status = poOrders[0]?.poStatus || 'Unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    // Delivery status breakdown
    const deliveryStatusCounts = orders.reduce((acc: Record<string, number>, order) => {
      const status = order.deliveryStatus || 'Unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    // Top stores by PO count
    const storeMap = new Map<string, { storeName: string; storeCode: string; poCount: number; totalAmount: number }>()
    Array.from(poMap.entries()).forEach(([trxCode, poOrders]) => {
      const storeCode = poOrders[0].storeCode
      const storeName = poOrders[0].storeName
      const amount = poOrders[0].totalAmount
      
      if (!storeMap.has(storeCode)) {
        storeMap.set(storeCode, { storeName, storeCode, poCount: 0, totalAmount: 0 })
      }
      const store = storeMap.get(storeCode)!
      store.poCount += 1
      store.totalAmount += amount
    })

    const topStores = Array.from(storeMap.values())
      .sort((a, b) => b.poCount - a.poCount)
      .slice(0, 10)

    // Top users by PO count
    const userMap = new Map<string, { userName: string; userCode: string; poCount: number; totalAmount: number }>()
    Array.from(poMap.entries()).forEach(([trxCode, poOrders]) => {
      const userCode = poOrders[0].userCode
      const userName = poOrders[0].userName
      const amount = poOrders[0].totalAmount
      
      if (!userMap.has(userCode)) {
        userMap.set(userCode, { userName, userCode, poCount: 0, totalAmount: 0 })
      }
      const user = userMap.get(userCode)!
      user.poCount += 1
      user.totalAmount += amount
    })

    const topUsers = Array.from(userMap.values())
      .sort((a, b) => b.poCount - a.poCount)
      .slice(0, 10)

    // Daily trend
    const dailyMap = new Map<string, { date: string; poCount: number; amount: number; units: number }>()
    Array.from(poMap.entries()).forEach(([trxCode, poOrders]) => {
      const date = new Date(poOrders[0].poDate).toLocaleDateString('en-GB')
      const amount = poOrders[0].totalAmount
      const units = poOrders.reduce((sum, o) => sum + o.quantity, 0)
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { date, poCount: 0, amount: 0, units: 0 })
      }
      const day = dailyMap.get(date)!
      day.poCount += 1
      day.amount += amount
      day.units += units
    })

    const dailyTrend = Array.from(dailyMap.values())
      .sort((a, b) => new Date(a.date.split('/').reverse().join('-')).getTime() - new Date(b.date.split('/').reverse().join('-')).getTime())

    return {
      totalPOs,
      totalAmount,
      totalUnits,
      uniqueStores,
      uniqueUsers,
      uniqueProducts,
      statusCounts,
      deliveryStatusCounts,
      topStores,
      topUsers,
      dailyTrend
    }
  }, [orders])

  // Excel export
  const handleExport = () => {
    const wb = XLSX.utils.book_new()

    // Summary Sheet
    const summaryData = [
      ['Purchase Order Report - Summary'],
      ['Generated:', new Date().toLocaleString()],
      ['Date Range:', `${startDate} to ${endDate}`],
      [],
      ['Key Metrics'],
      ['Total POs', metrics.totalPOs],
      ['Total Amount', `AED${metrics.totalAmount.toFixed(2)}`],
      ['Total Units', metrics.totalUnits],
      ['Unique Stores', metrics.uniqueStores],
      ['Unique Users', metrics.uniqueUsers],
      ['Unique Products', metrics.uniqueProducts],
      [],
      ['Filters Applied'],
      ['Team Leader', selectedTeamLeader || 'All'],
      ['Field User', selectedUserCode || 'All'],
      ['Store', selectedStoreCode || 'All'],
      ['Chain', selectedChainName || 'All'],
      ['PO Status', selectedStatus || 'All'],
      ['Delivery Status', selectedDeliveryStatus || 'All']
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    // Detailed Data Sheet (matches detailed view table)
    const detailedData = orders.map(order => ({
      'Date': new Date(order.poDate).toLocaleDateString('en-GB'),
      'TL Code': order.teamLeaderCode || '—',
      'TL Name': order.teamLeaderName || '—',
      'Field User Code': order.userCode,
      'Field User Name': order.userName,
      'Store Code': order.storeCode,
      'Store Name': order.storeName,
      'Chain Name': order.chainName || '—',
      'PO Number': order.poNumber || order.trxCode,
      'PO Units': order.quantity,
      'Product Code': order.productCode,
      'Product Name': order.productName,
      'Amount': order.lineAmount.toFixed(2),
      'PO Status': order.poStatus,
      'Delivery Status': order.deliveryStatus
    }))
    const detailedSheet = XLSX.utils.json_to_sheet(detailedData)
    XLSX.utils.book_append_sheet(wb, detailedSheet, 'PO Details')

    // Export
    XLSX.writeFile(wb, `PO-Report-${startDate}-${endDate}.xlsx`)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-cyan-600" />
            PO Status Report
          </h1>
          <p className="text-sm text-slate-600 mt-1">Purchase order tracking and analysis</p>
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
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            <RefreshCw size={18} />
            Refresh
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
              <span className="text-xs text-slate-500">Configure the data set before analysis</span>
            </div>
            <button
              onClick={() => {
                const date = new Date()
                date.setDate(date.getDate() - 30)
                setStartDate(date.toISOString().split('T')[0])
                setEndDate(new Date().toISOString().split('T')[0])
                setSelectedTeamLeader('')
                setSelectedUserCode('')
                setSelectedStoreCode('')
                setSelectedChainName('')
                setSelectedStatus('')
                setSelectedDeliveryStatus('')
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
              type="button"
            >
              Reset Filters
            </button>
          </div>

          <div className="space-y-4">
            {/* Date Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>

            {/* Main Filters - Using SearchableSelect */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Team Leader */}
              <SearchableSelect
                value={selectedTeamLeader || null}
                onChange={(value) => {
                  setSelectedTeamLeader(value || '')
                  setSelectedUserCode('')
                }}
                options={filterOptions.teamLeaders}
                placeholder={`All Team Leaders (Available: ${filterOptions.teamLeaders.length})`}
                icon={<User className="w-4 h-4 text-gray-500" />}
                label="Team Leader"
                formatOptionLabel={(option) => option.label}
              />

              {/* Field User */}
              <SearchableSelect
                value={selectedUserCode || null}
                onChange={(value) => setSelectedUserCode(value || '')}
                options={filterOptions.users}
                placeholder={`All Users (Available: ${filterOptions.users.length})`}
                icon={<User className="w-4 h-4 text-gray-500" />}
                label="Field User"
                formatOptionLabel={(option) => option.label}
              />

              {/* Chain */}
              <SearchableSelect
                value={selectedChainName || null}
                onChange={(value) => setSelectedChainName(value || '')}
                options={filterOptions.chains}
                placeholder={`All Chains (Available: ${filterOptions.chains.length})`}
                icon={<Building2 className="w-4 h-4 text-gray-500" />}
                label="Chain / Channel"
                formatOptionLabel={(option) => option.label}
              />

              {/* Store */}
              <SearchableSelect
                value={selectedStoreCode || null}
                onChange={(value) => setSelectedStoreCode(value || '')}
                options={filterOptions.stores}
                placeholder={`All Stores (Available: ${filterOptions.stores.length})`}
                icon={<Store className="w-4 h-4 text-gray-500" />}
                label="Store"
                formatOptionLabel={(option) => option.label}
              />

              {/* PO Status */}
              <SearchableSelect
                value={selectedStatus || null}
                onChange={(value) => setSelectedStatus(value || '')}
                options={filterOptions.statuses}
                placeholder={`All Statuses (Available: ${filterOptions.statuses.length})`}
                icon={<ClipboardList className="w-4 h-4 text-gray-500" />}
                label="PO Status"
                formatOptionLabel={(option) => option.label}
              />

              {/* Delivery Status */}
              <SearchableSelect
                value={selectedDeliveryStatus || null}
                onChange={(value) => setSelectedDeliveryStatus(value || '')}
                options={filterOptions.deliveryStatuses}
                placeholder={`All Statuses (Available: ${filterOptions.deliveryStatuses.length})`}
                icon={<Package className="w-4 h-4 text-gray-500" />}
                label="Delivery Status"
                formatOptionLabel={(option) => option.label}
              />
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {!loading && !error && orders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Total POs</p>
                <InfoTooltip content="Total number of unique purchase orders created in the selected period" />
              </div>
              <ClipboardList className="w-8 h-8 text-cyan-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{metrics.totalPOs.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{metrics.totalUnits.toLocaleString()} total units</p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Total Amount</p>
                <InfoTooltip content="Total value of all purchase orders. Represents total ordering commitment." />
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">AED{metrics.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-gray-500 mt-1">Order value</p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Unique Stores</p>
                <InfoTooltip content="Number of unique stores with purchase orders in the selected period" />
              </div>
              <Store className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-600">{metrics.uniqueStores}</p>
            <p className="text-xs text-gray-500 mt-1">Ordering locations</p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Unique Users</p>
                <InfoTooltip content="Number of unique field users who created purchase orders" />
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-600">{metrics.uniqueUsers}</p>
            <p className="text-xs text-gray-500 mt-1">{metrics.uniqueProducts} unique products</p>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      {!loading && !error && orders.length > 0 && (
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

      {/* Summary View - Analytics & Charts */}
      {viewMode === 'summary' && !loading && !error && orders.length > 0 && (
        <div className="space-y-6">
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 10 Stores by PO Count */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Store className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">Top 10 Stores</h3>
                <InfoTooltip content="Stores with the highest number of purchase orders" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.topStores}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="storeCode" angle={-45} textAnchor="end" height={80} />
                  <YAxis label={{ value: 'POs', angle: -90, position: 'insideLeft' }} />
                  <RechartsTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-white p-2 border border-gray-200 rounded shadow-sm">
                            <p className="font-semibold">{data.storeName}</p>
                            <p className="text-sm">Code: {data.storeCode}</p>
                            <p className="text-sm">POs: {data.poCount}</p>
                            <p className="text-sm">Amount: AED{data.totalAmount.toLocaleString()}</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend />
                  <Bar dataKey="poCount" name="PO Count" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top 10 Users by PO Count */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Top 10 Field Users</h3>
                <InfoTooltip content="Field users who created the most purchase orders" />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.topUsers}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="userCode" angle={-45} textAnchor="end" height={80} />
                  <YAxis label={{ value: 'POs', angle: -90, position: 'insideLeft' }} />
                  <RechartsTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-white p-2 border border-gray-200 rounded shadow-sm">
                            <p className="font-semibold">{data.userName}</p>
                            <p className="text-sm">Code: {data.userCode}</p>
                            <p className="text-sm">POs: {data.poCount}</p>
                            <p className="text-sm">Amount: AED{data.totalAmount.toLocaleString()}</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend />
                  <Bar dataKey="poCount" name="PO Count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Trend */}
            {metrics.dailyTrend.length > 1 && (
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Daily PO Trend</h3>
                  <InfoTooltip content="Purchase order activity over time" />
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" label={{ value: 'PO Count', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Amount (AED)', angle: 90, position: 'insideRight' }} />
                    <RechartsTooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'amount') return [`AED${value.toLocaleString()}`, 'Amount']
                        if (name === 'units') return [value.toLocaleString(), 'Units']
                        return [value, name]
                      }}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="poCount" stroke="#3b82f6" name="PO Count" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="amount" stroke="#10b981" name="Amount" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed View - Data Table */}
      {viewMode === 'detailed' && !loading && !error && orders.length > 0 && (
      <div className={isTableFullscreen ? "fixed inset-0 z-50 bg-white p-6 overflow-y-auto" : ""}>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Purchase Order Details</h2>
              <p className="text-sm text-gray-600 mt-1">Showing {orders.length} PO line item{orders.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setIsTableFullscreen(!isTableFullscreen)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                title={isTableFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isTableFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                {isTableFullscreen ? "Exit" : "Fullscreen"}
              </button>
              <button
                onClick={handleExport}
                disabled={orders.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </button>
            </div>
          </div>
          <div className={isTableFullscreen ? "overflow-x-auto max-h-[calc(100vh-150px)]" : "overflow-x-auto max-h-[700px]"}>
          {loading ? (
            <LoadingBar message="Loading purchase orders..." />
          ) : error ? (
            <div className="text-center py-12 text-red-600">{error}</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No purchase orders found. Try adjusting your filters.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">TL Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">TL Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">User Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">User Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Store Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Store Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Chain Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">PO Number</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">PO Units</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Image(s)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((item, index) => (
                  <tr key={index} className="hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(item.poDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">
                      {item.teamLeaderCode || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.teamLeaderName || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">
                      {item.userCode}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.userName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">
                      {item.storeCode}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.storeName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.chainName || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-blue-600">
                      {item.poNumber || item.trxCode}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const imageField = item.poImagePath || item.po_image_path || item.imagePath || item.image_path || item.image || item.photo || item.photoPath
                        console.log('Item:', item.id, 'Image field:', imageField) // Debug: Log each item
                        return imageField ? (
                          <button
                            onClick={() => {
                              setSelectedPO(item)
                              setIsDialogOpen(true)
                            }}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1 mx-auto"
                          >
                            <Eye size={14} />
                            View
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
          <div className="px-6 py-3 border-t bg-gray-50">
            <p className="text-xs text-gray-600">
              Showing all {orders.length} PO line items from {metrics.totalPOs} unique purchase orders
            </p>
          </div>
        </div>
      </div>
      )}

      {/* PO Image & Details Dialog */}
      {isDialogOpen && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Dialog Header - Dark Blue */}
            <div className="px-6 py-4 bg-blue-800 text-white flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold">PO Image & Details</h2>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Image Display Area */}
              <div className="bg-black rounded-lg p-4 relative">
                <img
                  src={getImageUrl(selectedPO.poImagePath || selectedPO.po_image_path || selectedPO.imagePath || selectedPO.image_path || selectedPO.image || selectedPO.photo || selectedPO.photoPath || '')}
                  alt="PO Image"
                  className="w-full h-auto max-h-96 object-contain rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden text-center text-white py-8">
                  <Eye size={48} className="mx-auto mb-2" />
                  <p>Image not available</p>
                </div>
                
                {/* Image Metadata - Bottom Right */}
                <div className="absolute bottom-4 right-4 text-white text-sm">
                  <div>Date: {new Date(selectedPO.poCreatedDateTime || selectedPO.poDate).toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</div>
                  {selectedPO.latitude && (
                    <div>Latitude: {selectedPO.latitude}</div>
                  )}
                  {selectedPO.longitude && (
                    <div>Longitude: {selectedPO.longitude}</div>
                  )}
                </div>
              </div>

              {/* PO Status Details Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">PO Status Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Product Name</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">PO Qty</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">PO Price</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">PO Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-200">
                        <td className="px-4 py-3 text-sm text-gray-900">{selectedPO.productName}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-900">{selectedPO.quantity}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-900">AED{selectedPO.unitPrice}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-900">AED{selectedPO.lineAmount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading and Error States */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <LoadingBar message="Loading purchase order data..." />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-semibold">{error}</p>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium text-lg mb-2">No Purchase Orders Found</p>
          <p className="text-gray-500 text-sm">Try adjusting your filters or date range to see results</p>
        </div>
      )}
    </div>
  )
}
