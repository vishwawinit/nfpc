'use client'

import { useState, useEffect, useMemo } from 'react'
import { Package, RefreshCw, Filter, AlertTriangle, TrendingDown, Maximize, Minimize, Download, Store, PieChart as PieChartIcon, LineChart as LineChartIcon, MapPin, Building2, Boxes, Users, User } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { CustomDatePicker } from '@/components/ui/CustomDatePicker'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import * as XLSX from 'xlsx'

interface LowStockItem {
  storeCheckId: number | null
  checkDate: string
  checkDateTime: string | null
  createdOn: string | null
  storeCode: string
  storeName: string
  chainName: string | null
  cityCode: string
  cityName: string | null
  regionCode: string
  userCode: string
  userName: string
  userType: string
  teamLeaderCode: string
  teamLeaderName: string
  productCode: string
  productName: string
  productGroup: string | null
  productCategory: string
  productBrand: string | null
  productImagePath: string | null
  onHandQty: number
  onOrderQty: number
  minStockLevel: number | null
  maxStockLevel: number | null
  reorderLevel: number | null
  shelfPresence: string
  stockStatus: string
  avgDailySales?: number
  requiredStock35Days?: number
  stockShortage?: number
}

interface FilterOptions {
  users: Array<{ value: string; label: string }>
  userRoles: Array<{ value: string; label: string }>
  stores: Array<{ value: string; label: string }>
  chains: Array<{ value: string; label: string }>
  cities: Array<{ value: string; label: string }>
  regions: Array<{ value: string; label: string }>
  products: Array<{ value: string; label: string }>
  productGroups: Array<{ value: string; label: string }>
  statuses: Array<{ value: string; label: string }>
  teamLeaders: Array<{ value: string; label: string; role: string }>
  assistantLeaders: Array<{ value: string; label: string; role: string }>
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

type SummaryViewMode = 'summary' | 'detailed'
type StockViewType = 'lowStock' | 'healthyStock'

interface StockMetricToggleProps {
  view: StockViewType
  onChange: (view: StockViewType) => void
  disableHealthy?: boolean
  className?: string
}

const StockMetricToggle = ({ view, onChange, disableHealthy = false, className = '' }: StockMetricToggleProps) => {
  return (
    <div className={`inline-flex rounded-md border border-gray-200 bg-white p-0.5 ${className}`}>
      <button
        type="button"
        onClick={() => onChange('lowStock')}
        className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
          view === 'lowStock' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Low Stock
      </button>
      <button
        type="button"
        onClick={() => !disableHealthy && onChange('healthyStock')}
        disabled={disableHealthy}
        className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
          view === 'healthyStock' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
        } ${disableHealthy ? 'opacity-50 cursor-not-allowed hover:text-gray-600' : ''}`}
        title={disableHealthy ? 'Healthy stock data unavailable for current selection' : ''}
      >
        Healthy Stock
      </button>
    </div>
  )
}

export function LowStockReport({ loginUserCode }: { loginUserCode?: string }) {
  const [items, setItems] = useState<LowStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stockSummary, setStockSummary] = useState<any>(null)
  const [stockTrendData, setStockTrendData] = useState<any[]>([])
  const [productStockData, setProductStockData] = useState<any[]>([])
  const [storeStockData, setStoreStockData] = useState<any[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    users: [],
    userRoles: [],
    stores: [],
    chains: [],
    cities: [],
    regions: [],
    products: [],
    productGroups: [],
    statuses: [],
    teamLeaders: [],
    assistantLeaders: []
  })

  // Filters - Default to THIS MONTH
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedTeamLeader, setSelectedTeamLeader] = useState('')
  const [selectedUserRole, setSelectedUserRole] = useState('')
  const [selectedUserCode, setSelectedUserCode] = useState('')
  const [selectedStoreCode, setSelectedStoreCode] = useState('')
  const [selectedChainName, setSelectedChainName] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedProductCode, setSelectedProductCode] = useState('')
  const [selectedProductGroup, setSelectedProductGroup] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // View mode for analysis
  const [viewMode, setViewMode] = useState<SummaryViewMode>('summary')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isTableFullscreen, setIsTableFullscreen] = useState(false)
  const [stockViewType, setStockViewType] = useState<StockViewType>('lowStock')
  const [detailViewLoading, setDetailViewLoading] = useState(false)
  
  // Pagination for detailed view
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(100)

  // Fetch filter options whenever ANY filter changes (cascading)
  useEffect(() => {
    fetchFilterOptions()
  }, [
    startDate,
    endDate,
    selectedTeamLeader,
    selectedUserRole,
    selectedUserCode,
    selectedStoreCode,
    selectedChainName,
    selectedCity,
    selectedRegion,
    selectedProductCode,
    selectedProductGroup,
    loginUserCode
  ])

  // Fetch data whenever filters change
  useEffect(() => {
    fetchData()
  }, [
    startDate,
    endDate,
    selectedTeamLeader,
    selectedUserRole,
    selectedUserCode,
    selectedStoreCode,
    selectedChainName,
    selectedCity,
    selectedRegion,
    selectedProductCode,
    selectedProductGroup,
    loginUserCode
  ])

  const fetchFilterOptions = async () => {
    try {
      // Pass ALL selected filters for cascading (each filter shows only available options)
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(selectedTeamLeader && { teamLeaderCode: selectedTeamLeader }),
        ...(selectedUserRole && { userRole: selectedUserRole }),
        ...(selectedUserCode && { userCode: selectedUserCode }),
        ...(selectedStoreCode && { storeCode: selectedStoreCode }),
        ...(selectedChainName && { chainName: selectedChainName }),
        ...(selectedCity && { cityCode: selectedCity }),
        ...(selectedRegion && { regionCode: selectedRegion }),
        ...(selectedProductCode && { productCode: selectedProductCode }),
        ...(selectedProductGroup && { productGroup: selectedProductGroup })
      })

      console.log('🔍 Fetching filter options from:', `/api/low-stock/filters?${params}`)
      const response = await fetch(`/api/low-stock/filters?${params}`)
      console.log('📡 Filter API Response status:', response.status)
      const result = await response.json()
      console.log('📊 Filter API Result:', result)

      if (result.success) {
        console.log('✅ Setting filter options:', result.data)
        console.log('  - Users:', result.data.users?.length)
        console.log('  - Stores:', result.data.stores?.length)
        console.log('  - Products:', result.data.products?.length)
        console.log('  - Team Leaders:', result.data.teamLeaders?.length)
        setFilterOptions(result.data)
      } else {
        console.error('❌ Filter API returned error:', result.error)
      }
    } catch (err) {
      console.error('❌ Error fetching filter options:', err)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(selectedTeamLeader && { teamLeaderCode: selectedTeamLeader }),
        ...(selectedUserRole && { userRole: selectedUserRole }),
        ...(selectedUserCode && { userCode: selectedUserCode }),
        ...(selectedStoreCode && { storeCode: selectedStoreCode }),
        ...(selectedChainName && { chainName: selectedChainName }),
        ...(selectedCity && { cityCode: selectedCity }),
        ...(selectedRegion && { regionCode: selectedRegion }),
        ...(selectedProductCode && { productCode: selectedProductCode }),
        ...(selectedProductGroup && { productGroup: selectedProductGroup }),
        ...(loginUserCode && { loginUserCode })
      })

      const [lowStockResponse, stockSummaryResponse, stockTrendResponse, productStockResponse, storeStockResponse] = await Promise.all([
        fetch(`/api/low-stock?${params}`),
        fetch(`/api/daily-stock/summary?${params}`),
        fetch(`/api/daily-stock/trend?${params}`),
        fetch(`/api/daily-stock/products?${params}`),
        fetch(`/api/daily-stock/stores?${params}`)
      ])

      const [lowStockResult, stockSummaryResult, stockTrendResult, productStockResult, storeStockResult] = await Promise.all([
        lowStockResponse.json(),
        stockSummaryResponse.json(),
        stockTrendResponse.json(),
        productStockResponse.json(),
        storeStockResponse.json()
      ])

      if (lowStockResult.success) {
        setItems(lowStockResult.data)
      } else {
        setError(lowStockResult.error || 'Failed to fetch low stock data')
      }

      const resolvedSummary = stockSummaryResult?.data ?? stockSummaryResult
      const resolvedTrend = Array.isArray(stockTrendResult)
        ? stockTrendResult
        : stockTrendResult?.data ?? []
      const resolvedProductStock = Array.isArray(productStockResult)
        ? productStockResult
        : productStockResult?.data ?? []
      const resolvedStoreStock = Array.isArray(storeStockResult)
        ? storeStockResult
        : storeStockResult?.data ?? []

      setStockSummary(resolvedSummary)
      setStockTrendData(resolvedTrend)
      setProductStockData(resolvedProductStock)
      setStoreStockData(resolvedStoreStock)
    } catch (err) {
      console.error('Error fetching low stock data:', err)
      setError('Failed to fetch low stock data')
    } finally {
      setLoading(false)
      setDetailViewLoading(false)
    }
  }

  // Calculated metrics
  const metrics = useMemo(() => {
    const totalLowStock = stockSummary?.lowStockCount ?? items.length
    const outOfStockCount = items.filter(i => i.stockStatus === 'Out of Stock' || i.onHandQty === 0).length
    const affectedStores = new Set(items.map(i => i.storeCode)).size
    const affectedProducts = new Set(items.map(i => i.productCode)).size

    console.log('📊 Low Stock Metrics Calculated:', {
      itemsCount: items.length,
      affectedStores,
      affectedProducts,
      filterStoresCount: filterOptions.stores.length,
      filterProductsCount: filterOptions.products.length
    })

    // Top 20 Affected Stores
    const storeLowStockRecords = items.reduce((acc, item) => {
      const key = `${item.storeCode}|${item.storeName}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topStores = Object.entries(storeLowStockRecords)
      .map(([key, count]) => {
        const [code, name] = key.split('|')
        return { storeCode: code, storeName: name, lowStockCount: count }
      })
      .sort((a, b) => b.lowStockCount - a.lowStockCount)

    const top20Stores = topStores.slice(0, 20)
    const bottom20Stores = topStores.slice(-20).reverse()

    // Top 20 Affected Products
    const productLowStockRecords = items.reduce((acc, item) => {
      const key = `${item.productCode}|${item.productName}|${item.productCategory}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topProducts = Object.entries(productLowStockRecords)
      .map(([key, count]) => {
        const [code, name, category] = key.split('|')
        return { productCode: code, productName: name, productCategory: category, lowStockCount: count }
      })
      .sort((a, b) => b.lowStockCount - a.lowStockCount)

    const top20Products = topProducts.slice(0, 20)
    const bottom20Products = topProducts.slice(-20).reverse()

    // Category breakdown
    const categoryBreakdown = items.reduce((acc, item) => {
      const category = item.productCategory || 'Unknown'
      if (!acc[category]) {
        acc[category] = { total: 0, outOfStock: 0 }
      }
      acc[category].total += 1
      if (item.stockStatus === 'Out of Stock' || item.onHandQty === 0) {
        acc[category].outOfStock += 1
      }
      return acc
    }, {} as Record<string, { total: number; outOfStock: number }>)

    const categoryData = Object.entries(categoryBreakdown)
      .map(([category, data]) => ({
        category,
        total: data.total,
        outOfStock: data.outOfStock,
        outOfStockRate: data.total ? (data.outOfStock / data.total) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)

    // Regional analysis
    const regionalBreakdown = items.reduce((acc, item) => {
      const region = item.regionCode || 'Unknown'
      if (!acc[region]) {
        acc[region] = { total: 0, outOfStock: 0, stores: new Set() }
      }
      acc[region].total += 1
      if (item.stockStatus === 'Out of Stock' || item.onHandQty === 0) {
        acc[region].outOfStock += 1
      }
      acc[region].stores.add(item.storeCode)
      return acc
    }, {} as Record<string, { total: number; outOfStock: number; stores: Set<string> }>)

    const regionalData = Object.entries(regionalBreakdown)
      .map(([region, data]) => ({
        region,
        total: data.total,
        outOfStock: data.outOfStock,
        affectedStores: data.stores.size
      }))
      .sort((a, b) => b.total - a.total)

    // Daily trend
    const channelBreakdown = items.reduce((acc, item) => {
      const channel = item.chainName || 'Unclassified'
      if (!acc[channel]) {
        acc[channel] = {
          total: 0,
          outOfStock: 0,
          healthy: 0,
          low: 0
        }
      }
      acc[channel].total += 1
      if (item.stockStatus === 'Out of Stock' || item.onHandQty === 0) {
        acc[channel].outOfStock += 1
      } else if (item.stockStatus === 'Healthy Stock') {
        acc[channel].healthy += 1
      } else {
        acc[channel].low += 1
      }
      return acc
    }, {} as Record<string, {
      total: number;
      outOfStock: number;
      healthy: number;
      low: number;
    }>)

    const channelData = Object.entries(channelBreakdown)
      .map(([channel, data]) => ({
        channel,
        total: data.total,
        outOfStock: data.outOfStock,
        healthy: data.healthy,
        low: data.low
      }))
      .sort((a, b) => b.total - a.total)

    // Daily trend
    const dailyTrend = items.reduce((acc, item) => {
      const date = new Date(item.checkDate).toLocaleDateString('en-GB')
      if (!acc[date]) {
        acc[date] = { lowStock: 0, outOfStock: 0, healthyStock: 0 }
      }
      if (item.stockStatus === 'Out of Stock' || item.onHandQty === 0) {
        acc[date].outOfStock += 1
      } else if (item.stockStatus === 'Healthy Stock') {
        acc[date].healthyStock += 1
      } else if (item.onHandQty > 0) {
        acc[date].lowStock += 1
      }
      return acc
    }, {} as Record<string, { lowStock: number; outOfStock: number; healthyStock: number }>)

    const trendData = Object.entries(dailyTrend)
      .map(([date, data]) => ({
        date,
        lowStock: data.lowStock,
        outOfStock: data.outOfStock,
        healthyStock: data.healthyStock
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Product group breakdown
    const productGroupBreakdown = items.reduce((acc, item) => {
      const group = item.productGroup || 'Unassigned'
      if (!acc[group]) {
        acc[group] = { total: 0, outOfStock: 0 }
      }
      acc[group].total += 1
      if (item.stockStatus === 'Out of Stock' || item.onHandQty === 0) {
        acc[group].outOfStock += 1
      }
      return acc
    }, {} as Record<string, { total: number; outOfStock: number }>)

    const productGroupData = Object.entries(productGroupBreakdown)
      .map(([group, data]) => ({
        productGroup: group,
        total: data.total,
        outOfStock: data.outOfStock,
        outOfStockRate: data.total ? (data.outOfStock / data.total) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)

    const trendTotals = (Array.isArray(stockTrendData) ? stockTrendData : []).reduce(
      (acc, entry) => {
        const healthy = Number(entry.healthyStock ?? entry.healthy_stock ?? 0)
        const low = Number(entry.lowStock ?? entry.low_stock ?? 0)
        const out = Number(entry.outOfStock ?? entry.out_of_stock ?? 0)
        acc.healthy += Number.isFinite(healthy) ? healthy : 0
        acc.low += Number.isFinite(low) ? low : 0
        acc.out += Number.isFinite(out) ? out : 0
        return acc
      },
      { healthy: 0, low: 0, out: 0 }
    )

    // Calculate status counts directly from items array
    const healthyStockCount = items.filter(i => i.stockStatus === 'Healthy Stock').length
    const lowStockCount = items.filter(i => i.stockStatus === 'Low Stock').length
    const outOfStockSummaryCount = items.filter(i => i.onHandQty === 0).length
    const noSalesDataCount = items.filter(i => i.stockStatus === 'No Sales Data' && i.onHandQty > 0).length
    
    const statusData = [
      { name: 'Healthy Stock', value: healthyStockCount },
      { name: 'Low Stock', value: lowStockCount },
      { name: 'Out of Stock', value: outOfStockSummaryCount },
      { name: 'No Sales Data', value: noSalesDataCount }
    ].filter(item => item.value > 0)

    return {
      totalLowStock,
      outOfStockCount,
      affectedStores,
      affectedProducts,
      top20Stores,
      bottom20Stores,
      top20Products,
      bottom20Products,
      categoryData,
      regionalData,
      channelData,
      productGroupData,
      statusData,
      trendData
    }
  }, [items, stockSummary, stockTrendData])

  const totalStatusChecks = useMemo(() => {
    return metrics.statusData.reduce((sum: number, entry: { value: number }) => sum + entry.value, 0)
  }, [metrics.statusData])

  const summaryTrendData = useMemo(() => {
    if (!stockTrendData || stockTrendData.length === 0) {
      return metrics.trendData
    }

    return stockTrendData.map((entry: any) => ({
      date: new Date(entry.date).toLocaleDateString('en-GB'),
      healthyStock: entry.healthyStock ?? 0,
      lowStock: entry.lowStock ?? 0,
      outOfStock: entry.outOfStock ?? 0
    }))
  }, [stockTrendData, metrics.trendData])

  const chartData = useMemo(() => {
    const sortAndSlice = (arr: any[], key: string, limit = 10) => {
      const withValues = arr
        .filter(item => Number(item?.[key] ?? 0) > 0)
        .sort((a, b) => Number(b?.[key] ?? 0) - Number(a?.[key] ?? 0))

      if (withValues.length > 0) {
        return withValues.slice(0, limit)
      }

      return [...arr]
        .sort((a, b) => Number(b?.[key] ?? 0) - Number(a?.[key] ?? 0))
        .slice(0, limit)
    }

    const storeRecords = Array.isArray(storeStockData)
      ? storeStockData.map((store: any) => ({
          storeName: store.storeName || store.storeCode || 'Unknown Store',
          storeCode: store.storeCode || '',
          chain: store.storeClass || 'Unclassified',
          region: store.regionCode || 'Unknown',
          lowCount: Number(store.lowStockItems ?? 0),
          healthyCount: Number(store.healthyStockItems ?? 0),
          outCount: Number(store.outOfStockItems ?? 0),
          lowStoreCount: Number(store.lowStockItems ?? 0) > 0 ? 1 : 0,
          healthyStoreCount: Number(store.healthyStockItems ?? 0) > 0 ? 1 : 0
        }))
      : []

    const fallbackStoreRecords = metrics.top20Stores.map((store: any) => ({
      storeName: store.storeName,
      storeCode: store.storeCode,
      chain: '—',
      region: '—',
      lowCount: Number(store.lowStockCount ?? 0),
      healthyCount: 0,
      outCount: 0,
      lowStoreCount: Number(store.lowStockCount ?? 0) > 0 ? 1 : 0,
      healthyStoreCount: 0
    }))

    const storeData = storeRecords.length > 0 ? storeRecords : fallbackStoreRecords

    const productRecords = Array.isArray(productStockData)
      ? productStockData.map((product: any) => ({
          productName: product.productName || product.productCode || 'Unknown Product',
          productCode: product.productCode || '',
          productGroup: product.productGroup || 'Unassigned',
          category: product.productCategory || 'Unclassified',
          lowCount: Number(product.lowStockStores ?? 0),
          healthyCount: Number(product.healthyStockStores ?? 0),
          outCount: Number(product.outOfStockStores ?? 0)
        }))
      : []

    const fallbackProductRecords = metrics.top20Products.map((product: any) => ({
      productName: product.productName,
      productCode: product.productCode,
      productGroup: product.productCategory,
      category: product.productCategory,
      lowCount: Number(product.lowStockCount ?? 0),
      healthyCount: 0,
      outCount: 0
    }))

    const productData = productRecords.length > 0 ? productRecords : fallbackProductRecords

    const productGroupMap = new Map<string, {
      productGroup: string
      lowCount: number
      healthyCount: number
      outCount: number
    }>()

    productData.forEach(record => {
      const key = record.productGroup || 'Unassigned'
      const existing = productGroupMap.get(key) || {
        productGroup: key,
        lowCount: 0,
        healthyCount: 0,
        outCount: 0
      }

      existing.lowCount += Number(record.lowCount ?? 0)
      existing.healthyCount += Number(record.healthyCount ?? 0)
      existing.outCount += Number(record.outCount ?? 0)

      productGroupMap.set(key, existing)
    })

    let productGroupData = Array.from(productGroupMap.values())

    if (productGroupData.length === 0) {
      productGroupData = metrics.productGroupData.map((group: any) => ({
        productGroup: group.productGroup,
        lowCount: Number(group.total ?? 0),
        healthyCount: 0,
        outCount: Number(group.outOfStock ?? 0)
      }))
    }

    const regionAccumulator = new Map<string, {
      region: string
      lowCount: number
      healthyCount: number
      outCount: number
      lowStores: Set<string>
      healthyStores: Set<string>
    }>()

    storeData.forEach(record => {
      const key = record.region || 'Unknown'
      const existing = regionAccumulator.get(key) || {
        region: key,
        lowCount: 0,
        healthyCount: 0,
        outCount: 0,
        lowStores: new Set<string>(),
        healthyStores: new Set<string>()
      }

      existing.lowCount += Number(record.lowCount ?? 0)
      existing.healthyCount += Number(record.healthyCount ?? 0)
      existing.outCount += Number(record.outCount ?? 0)
      if (record.lowCount > 0 && record.storeCode) {
        existing.lowStores.add(record.storeCode)
      }
      if (record.healthyCount > 0 && record.storeCode) {
        existing.healthyStores.add(record.storeCode)
      }

      regionAccumulator.set(key, existing)
    })

    let regionData = Array.from(regionAccumulator.values()).map(entry => ({
      region: entry.region,
      lowCount: entry.lowCount,
      healthyCount: entry.healthyCount,
      outCount: entry.outCount,
      lowStoreCount: entry.lowStores.size,
      healthyStoreCount: entry.healthyStores.size
    }))

    if (regionData.length === 0) {
      regionData = metrics.regionalData.map((region: any) => ({
        region: region.region,
        lowCount: Number(region.total ?? 0),
        healthyCount: 0,
        outCount: Number(region.outOfStock ?? 0),
        lowStoreCount: Number(region.affectedStores ?? 0),
        healthyStoreCount: 0
      }))
    }

    const channelAccumulator = new Map<string, {
      channel: string
      lowCount: number
      healthyCount: number
      outCount: number
    }>()

    storeData.forEach(record => {
      const key = record.chain || 'Unclassified'
      const existing = channelAccumulator.get(key) || {
        channel: key,
        lowCount: 0,
        healthyCount: 0,
        outCount: 0
      }

      existing.lowCount += Number(record.lowCount ?? 0)
      existing.healthyCount += Number(record.healthyCount ?? 0)
      existing.outCount += Number(record.outCount ?? 0)

      channelAccumulator.set(key, existing)
    })

    let channelData = Array.from(channelAccumulator.values())

    if (channelData.length === 0) {
      channelData = metrics.channelData.map((channel: any) => ({
        channel: channel.channel,
        lowCount: Number(channel.low ?? channel.lowStock ?? channel.lowStockCount ?? channel.low ?? 0),
        healthyCount: Number(channel.healthy ?? channel.healthyStock ?? channel.healthyStockCount ?? 0),
        outCount: Number(channel.outOfStock ?? channel.out ?? 0)
      }))
    }

    const hasHealthyStores = storeData.some(record => Number(record.healthyCount ?? 0) > 0)
    const hasHealthyProducts = productData.some(record => Number(record.healthyCount ?? 0) > 0)
    const hasHealthyGroups = productGroupData.some(record => Number(record.healthyCount ?? 0) > 0)
    const hasHealthyRegions = regionData.some(record => Number(record.healthyCount ?? 0) > 0)
    const hasHealthyChannels = channelData.some(record => Number(record.healthyCount ?? 0) > 0)

    return {
      stores: {
        low: sortAndSlice(storeData, 'lowCount'),
        healthy: sortAndSlice(storeData, 'healthyCount'),
        hasHealthy: hasHealthyStores
      },
      products: {
        low: sortAndSlice(productData, 'lowCount'),
        healthy: sortAndSlice(productData, 'healthyCount'),
        hasHealthy: hasHealthyProducts
      },
      productGroups: {
        low: sortAndSlice(productGroupData, 'lowCount'),
        healthy: sortAndSlice(productGroupData, 'healthyCount'),
        hasHealthy: hasHealthyGroups
      },
      regions: {
        low: sortAndSlice(regionData, 'lowCount'),
        healthy: sortAndSlice(regionData, 'healthyCount'),
        hasHealthy: hasHealthyRegions
      },
      channels: {
        low: sortAndSlice(channelData, 'lowCount'),
        healthy: sortAndSlice(channelData, 'healthyCount'),
        hasHealthy: hasHealthyChannels
      }
    }
  }, [storeStockData, productStockData, metrics.top20Stores, metrics.top20Products, metrics.productGroupData, metrics.regionalData, metrics.channelData])

  const stockMetricLabel = stockViewType === 'lowStock' ? 'Low Stock Checks' : 'Healthy Stock Checks'
  const stockMetricColor = stockViewType === 'lowStock' ? '#10b981' : '#3b82f6'
  const stockMetricKey = stockViewType === 'lowStock' ? 'lowCount' : 'healthyCount'

  const storeChartData = stockViewType === 'lowStock' ? chartData.stores.low : chartData.stores.healthy
  const productChartData = stockViewType === 'lowStock' ? chartData.products.low : chartData.products.healthy
  const productGroupChartData = stockViewType === 'lowStock' ? chartData.productGroups.low : chartData.productGroups.healthy
  const regionChartData = stockViewType === 'lowStock' ? chartData.regions.low : chartData.regions.healthy
  const channelChartData = stockViewType === 'lowStock' ? chartData.channels.low : chartData.channels.healthy

  const hasAnyHealthyData =
    chartData.stores.hasHealthy ||
    chartData.products.hasHealthy ||
    chartData.productGroups.hasHealthy ||
    chartData.regions.hasHealthy ||
    chartData.channels.hasHealthy

  // Pagination logic for detailed view
  const totalPages = Math.ceil(items.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = items.slice(startIndex, endIndex)

  useEffect(() => {
    if (stockViewType === 'healthyStock' && !hasAnyHealthyData) {
      setStockViewType('lowStock')
    }
  }, [stockViewType, hasAnyHealthyData])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [
    startDate,
    endDate,
    selectedTeamLeader,
    selectedUserRole,
    selectedUserCode,
    selectedStoreCode,
    selectedChainName,
    selectedCity,
    selectedRegion,
    selectedProductCode,
    selectedProductGroup
  ])

  useEffect(() => {
    if (viewMode === 'detailed' && detailViewLoading) {
      const timer = setTimeout(() => {
        setDetailViewLoading(false)
      }, 1500)

      return () => clearTimeout(timer)
    }

    if (viewMode === 'summary' && detailViewLoading) {
      setDetailViewLoading(false)
    }
  }, [viewMode, detailViewLoading])

  const handleViewModeChange = (mode: SummaryViewMode) => {
    if (mode === 'detailed') {
      setDetailViewLoading(true)
    } else {
      setDetailViewLoading(false)
    }
    setViewMode(mode)
  }

  const exportToExcel = () => {
    // Create workbook
    const wb = XLSX.utils.book_new()

    // Calculate breakdown counts
    const healthyCount = items.filter(i => i.stockStatus === 'Healthy Stock').length
    const lowStockCount = items.filter(i => i.stockStatus === 'Low Stock').length
    const noSalesDataCount = items.filter(i => i.stockStatus === 'No Sales Data').length

    // Sheet 1: Summary
    const summaryData = [
      ['Stock Analysis Report - Detailed View'],
      ['Period', `${startDate} to ${endDate}`],
      ['Generated', new Date().toLocaleString()],
      ['Calculation Method', '35-day coverage: Last 7 days avg sales × 35 - Current stock'],
      [],
      ['Summary Metrics'],
      ['Total Stock Items', items.length],
      ['Healthy Stock Items', healthyCount],
      ['Low Stock Items', lowStockCount],
      ['No Sales Data Items', noSalesDataCount],
      ['Affected Stores', metrics.affectedStores],
      ['Affected Products', metrics.affectedProducts],
      [],
      ['Filters Applied'],
      ['Team Leader', selectedTeamLeader || 'All'],
      ['User Role', selectedUserRole || 'All'],
      ['Field User', selectedUserCode || 'All'],
      ['Store', selectedStoreCode || 'All'],
      ['Channel', selectedChainName || 'All'],
      ['City', selectedCity || 'All'],
      ['Region', selectedRegion || 'All'],
      ['Product', selectedProductCode || 'All'],
      ['Product Group', selectedProductGroup || 'All']
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    // Sheet 2: Detailed Stock Analysis (matches table view exactly)
    const itemsData = items.map(item => ({
      'Date': new Date(item.checkDate).toLocaleDateString('en-GB'),
      'TL Code': item.teamLeaderCode || '—',
      'TL Name': item.teamLeaderName || '—',
      'Field User Code': item.userCode,
      'Field User Name': item.userName,
      'Store Code': item.storeCode,
      'Store Name': item.storeName,
      'Chain Name': item.chainName || '—',
      'Product Code': item.productCode,
      'Product Name': item.productName,
      'Opening Stock': item.onHandQty,
      'Avg Daily Sales (7d)': item.avgDailySales?.toFixed(2) ?? '0.00',
      'Required Stock (35d)': item.requiredStock35Days?.toFixed(0) ?? '0',
      'Stock Difference': item.stockShortage ? `-${item.stockShortage.toFixed(0)}` : '0',
      'Stock Status': item.stockStatus
    }))
    const itemsSheet = XLSX.utils.json_to_sheet(itemsData)
    XLSX.utils.book_append_sheet(wb, itemsSheet, 'Detailed Stock Analysis')

    // Sheet 3: Top 20 Stores - Detailed Analysis
    const storeGroups = new Map<string, typeof items>()
    items.forEach(item => {
      const key = `${item.storeCode}|${item.storeName}`
      if (!storeGroups.has(key)) {
        storeGroups.set(key, [])
      }
      storeGroups.get(key)!.push(item)
    })
    
    const storeBreakdownData = Array.from(storeGroups.entries())
      .map(([key, storeItems]) => {
        const [storeCode, storeName] = key.split('|')
        const totalItems = storeItems.length
        const healthyItems = storeItems.filter(i => i.stockStatus === 'Healthy Stock').length
        const lowStockItems = storeItems.filter(i => i.stockStatus === 'Low Stock').length
        const totalOpeningStock = storeItems.reduce((sum, i) => sum + i.onHandQty, 0)
        const avgDailySales = storeItems.reduce((sum, i) => sum + (i.avgDailySales || 0), 0) / totalItems
        const totalRequiredStock = storeItems.reduce((sum, i) => sum + (i.requiredStock35Days || 0), 0)
        const totalShortage = storeItems.reduce((sum, i) => sum + (i.stockShortage || 0), 0)
        
        return {
          'Store Code': storeCode,
          'Store Name': storeName,
          'Chain': storeItems[0].chainName || '—',
          'Total Items': totalItems,
          'Healthy Count': healthyItems,
          'Low Stock Count': lowStockItems,
          'Healthy %': ((healthyItems / totalItems) * 100).toFixed(1) + '%',
          'Low Stock %': ((lowStockItems / totalItems) * 100).toFixed(1) + '%',
          'Total Opening Stock': totalOpeningStock,
          'Avg Daily Sales': avgDailySales.toFixed(2),
          'Total Required (35d)': totalRequiredStock.toFixed(0),
          'Total Shortage': totalShortage.toFixed(0),
          'Unique Products': new Set(storeItems.map(i => i.productCode)).size
        }
      })
      .sort((a, b) => b['Low Stock Count'] - a['Low Stock Count'])
      .slice(0, 20)
    
    const top20StoresSheet = XLSX.utils.json_to_sheet(storeBreakdownData)
    XLSX.utils.book_append_sheet(wb, top20StoresSheet, 'Top 20 Stores')

    // Sheet 4: Top 20 Products - Detailed Analysis
    const productGroups = new Map<string, typeof items>()
    items.forEach(item => {
      const key = `${item.productCode}|${item.productName}`
      if (!productGroups.has(key)) {
        productGroups.set(key, [])
      }
      productGroups.get(key)!.push(item)
    })
    
    const productBreakdownData = Array.from(productGroups.entries())
      .map(([key, productItems]) => {
        const [productCode, productName] = key.split('|')
        const totalItems = productItems.length
        const healthyItems = productItems.filter(i => i.stockStatus === 'Healthy Stock').length
        const lowStockItems = productItems.filter(i => i.stockStatus === 'Low Stock').length
        const totalOpeningStock = productItems.reduce((sum, i) => sum + i.onHandQty, 0)
        const avgDailySales = productItems.reduce((sum, i) => sum + (i.avgDailySales || 0), 0) / totalItems
        const totalRequiredStock = productItems.reduce((sum, i) => sum + (i.requiredStock35Days || 0), 0)
        const totalShortage = productItems.reduce((sum, i) => sum + (i.stockShortage || 0), 0)
        
        return {
          'Product Code': productCode,
          'Product Name': productName,
          'Total Stores': totalItems,
          'Healthy Count': healthyItems,
          'Low Stock Count': lowStockItems,
          'Healthy %': ((healthyItems / totalItems) * 100).toFixed(1) + '%',
          'Low Stock %': ((lowStockItems / totalItems) * 100).toFixed(1) + '%',
          'Total Opening Stock': totalOpeningStock,
          'Avg Daily Sales': avgDailySales.toFixed(2),
          'Total Required (35d)': totalRequiredStock.toFixed(0),
          'Total Shortage': totalShortage.toFixed(0),
          'Unique Stores': new Set(productItems.map(i => i.storeCode)).size
        }
      })
      .sort((a, b) => b['Low Stock Count'] - a['Low Stock Count'])
      .slice(0, 20)
    
    const top20ProductsSheet = XLSX.utils.json_to_sheet(productBreakdownData)
    XLSX.utils.book_append_sheet(wb, top20ProductsSheet, 'Top 20 Products')

    // Sheet 5: Chain Breakdown - Detailed Analysis by Chain
    const chainBreakdownData: any[] = []
    const chainGroups = new Map<string, typeof items>()
    
    // Group items by chain
    items.forEach(item => {
      const chain = item.chainName || 'Unclassified'
      if (!chainGroups.has(chain)) {
        chainGroups.set(chain, [])
      }
      chainGroups.get(chain)!.push(item)
    })
    
    // Create detailed breakdown for each chain
    chainGroups.forEach((chainItems, chainName) => {
      const totalItems = chainItems.length
      const healthyItems = chainItems.filter(i => i.stockStatus === 'Healthy Stock').length
      const lowStockItems = chainItems.filter(i => i.stockStatus === 'Low Stock').length
      const totalOpeningStock = chainItems.reduce((sum, i) => sum + i.onHandQty, 0)
      const avgDailySales = chainItems.reduce((sum, i) => sum + (i.avgDailySales || 0), 0) / totalItems
      const totalRequiredStock = chainItems.reduce((sum, i) => sum + (i.requiredStock35Days || 0), 0)
      const totalShortage = chainItems.reduce((sum, i) => sum + (i.stockShortage || 0), 0)
      
      chainBreakdownData.push({
        'Chain/Channel': chainName,
        'Total Items': totalItems,
        'Healthy Stock Count': healthyItems,
        'Low Stock Count': lowStockItems,
        'Healthy %': ((healthyItems / totalItems) * 100).toFixed(1) + '%',
        'Low Stock %': ((lowStockItems / totalItems) * 100).toFixed(1) + '%',
        'Total Opening Stock': totalOpeningStock,
        'Avg Daily Sales': avgDailySales.toFixed(2),
        'Total Required Stock (35d)': totalRequiredStock.toFixed(0),
        'Total Stock Shortage': totalShortage.toFixed(0),
        'Unique Stores': new Set(chainItems.map(i => i.storeCode)).size,
        'Unique Products': new Set(chainItems.map(i => i.productCode)).size
      })
    })
    
    const chainSheet = XLSX.utils.json_to_sheet(chainBreakdownData)
    XLSX.utils.book_append_sheet(wb, chainSheet, 'Chain Breakdown')

    // Sheet 6: Regional Analysis - Detailed Breakdown
    const regionGroups = new Map<string, typeof items>()
    items.forEach(item => {
      const region = item.regionCode || 'Unknown'
      if (!regionGroups.has(region)) {
        regionGroups.set(region, [])
      }
      regionGroups.get(region)!.push(item)
    })
    
    const regionBreakdownData = Array.from(regionGroups.entries())
      .map(([region, regionItems]) => {
        const totalItems = regionItems.length
        const healthyItems = regionItems.filter(i => i.stockStatus === 'Healthy Stock').length
        const lowStockItems = regionItems.filter(i => i.stockStatus === 'Low Stock').length
        const totalOpeningStock = regionItems.reduce((sum, i) => sum + i.onHandQty, 0)
        const avgDailySales = regionItems.reduce((sum, i) => sum + (i.avgDailySales || 0), 0) / totalItems
        const totalRequiredStock = regionItems.reduce((sum, i) => sum + (i.requiredStock35Days || 0), 0)
        const totalShortage = regionItems.reduce((sum, i) => sum + (i.stockShortage || 0), 0)
        
        return {
          'Region': region,
          'Total Items': totalItems,
          'Healthy Count': healthyItems,
          'Low Stock Count': lowStockItems,
          'Healthy %': ((healthyItems / totalItems) * 100).toFixed(1) + '%',
          'Low Stock %': ((lowStockItems / totalItems) * 100).toFixed(1) + '%',
          'Total Opening Stock': totalOpeningStock,
          'Avg Daily Sales': avgDailySales.toFixed(2),
          'Total Required (35d)': totalRequiredStock.toFixed(0),
          'Total Shortage': totalShortage.toFixed(0),
          'Unique Stores': new Set(regionItems.map(i => i.storeCode)).size,
          'Unique Products': new Set(regionItems.map(i => i.productCode)).size
        }
      })
      .sort((a, b) => b['Low Stock Count'] - a['Low Stock Count'])
    
    const regionalSheet = XLSX.utils.json_to_sheet(regionBreakdownData)
    XLSX.utils.book_append_sheet(wb, regionalSheet, 'Regional Analysis')

    // Export
    XLSX.writeFile(wb, `low-stock-report-${startDate}-${endDate}.xlsx`)
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-white p-6 space-y-6 overflow-y-auto" : "p-4 md:p-6 space-y-4 md:space-y-6"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-800">Low Stock Callout Report</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor inventory levels and stock alerts with focused insights</p>
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
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-slate-700 bg-white rounded-lg hover:bg-gray-50"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
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
                setStartDate(() => {
                  const date = new Date('2025-10-10')
                  date.setDate(date.getDate() - 7)
                  return date.toISOString().split('T')[0]
                })
                setEndDate('2025-10-10')
                setSelectedTeamLeader('')
                setSelectedUserRole('')
                setSelectedUserCode('')
                setSelectedStoreCode('')
                setSelectedChainName('')
                setSelectedCity('')
                setSelectedRegion('')
                setSelectedProductCode('')
                setSelectedProductGroup('')
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Calculation Method</p>
                <p className="text-xs text-blue-700 mt-1">35-day coverage based on 7-day average sales</p>
                <p className="text-xs text-blue-600 mt-1">Low stock = Current stock {'<'} (Avg daily sales × 35 days)</p>
              </div>
            </div>

            {/* Main Filters - Ordered by Business Hierarchy */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* 1. Region (Broadest Geographic) */}
              <SearchableSelect
                value={selectedRegion || null}
                onChange={(value) => setSelectedRegion(value || '')}
                options={filterOptions.regions}
                placeholder={`All Regions (Available: ${filterOptions.regions.length})`}
                icon={<MapPin className="w-4 h-4 text-gray-500" />}
                label="Region"
                formatOptionLabel={(option) => option.label}
              />

              {/* 2. City (Narrower Geographic) */}
              <SearchableSelect
                value={selectedCity || null}
                onChange={(value) => setSelectedCity(value || '')}
                options={filterOptions.cities}
                placeholder={`All Cities (Available: ${filterOptions.cities.length})`}
                icon={<MapPin className="w-4 h-4 text-gray-500" />}
                label="City"
                formatOptionLabel={(option) => option.label}
              />

              {/* 3. Product Group/Category */}
              <SearchableSelect
                value={selectedProductGroup || null}
                onChange={(value) => setSelectedProductGroup(value || '')}
                options={filterOptions.productGroups}
                placeholder={`All Product Groups (Available: ${filterOptions.productGroups.length})`}
                icon={<Boxes className="w-4 h-4 text-gray-500" />}
                label="Product Group"
                formatOptionLabel={(option) => option.label}
              />

              {/* 4. Product (Specific Product - Code shown below name) */}
              <SearchableSelect
                value={selectedProductCode || null}
                onChange={(value) => setSelectedProductCode(value || '')}
                options={filterOptions.products}
                placeholder={`All Products (Available: ${filterOptions.products.length})`}
                icon={<Package className="w-4 h-4 text-gray-500" />}
                label="Product"
                formatOptionLabel={(option) => {
                  // For search - use full text with code
                  const match = option.label.match(/^(.+?)\s*\(([^)]+)\)$/)
                  if (match) {
                    return `${match[1]} ${match[2]}`
                  }
                  return option.label
                }}
                renderOption={(option) => {
                  // For display - show name above, code below in smaller font
                  const match = option.label.match(/^(.+?)\s*\(([^)]+)\)$/)
                  if (match) {
                    return (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{match[1]}</span>
                        <span className="text-xs text-gray-500 mt-0.5">Code: {match[2]}</span>
                      </div>
                    )
                  }
                  return <span>{option.label}</span>
                }}
              />

              {/* 5. Chain/Channel */}
              <SearchableSelect
                value={selectedChainName || null}
                onChange={(value) => setSelectedChainName(value || '')}
                options={filterOptions.chains}
                placeholder={`All Channels (Available: ${filterOptions.chains.length})`}
                icon={<Building2 className="w-4 h-4 text-gray-500" />}
                label="Chain / Channel"
                formatOptionLabel={(option) => option.label}
              />

              {/* 6. Store (Specific Store) */}
              <SearchableSelect
                value={selectedStoreCode || null}
                onChange={(value) => setSelectedStoreCode(value || '')}
                options={filterOptions.stores}
                placeholder={`All Stores (Available: ${filterOptions.stores.length})`}
                icon={<Store className="w-4 h-4 text-gray-500" />}
                label="Store"
                formatOptionLabel={(option) => option.label}
              />

              {/* 7. Field User Role */}
              <SearchableSelect
                value={selectedUserRole || null}
                onChange={(value) => setSelectedUserRole(value || '')}
                options={filterOptions.userRoles}
                placeholder={`All Roles (Available: ${filterOptions.userRoles.length})`}
                icon={<Users className="w-4 h-4 text-gray-500" />}
                label="Field User Role"
                formatOptionLabel={(option) => option.label}
              />

              {/* 8. Field User (Specific Person) */}
              <SearchableSelect
                value={selectedUserCode || null}
                onChange={(value) => setSelectedUserCode(value || '')}
                options={filterOptions.users}
                placeholder={`All Users (Available: ${filterOptions.users.length})`}
                icon={<User className="w-4 h-4 text-gray-500" />}
                label="Field User"
                formatOptionLabel={(option) => option.label}
              />

              {/* 9. Team Leader (Supervisor) */}
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
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: Overall Stock Health Summary */}
      {!loading && !error && items.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Package className="text-blue-600" size={24} />
              Stock Health Summary
            </h2>
            <p className="text-sm text-gray-600 mt-1">Complete overview of all stock checks across your inventory</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Product-Store Checks Logged</p>
                <InfoTooltip content="Number of stock verification records (product-store combinations) captured in the selected period" />
              </div>
              <p className="text-3xl font-bold text-blue-600">{items.length.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">{items.length} product-store check rows • {metrics.affectedStores} stores • {metrics.affectedProducts} products</p>
            </div>

            <div className="bg-white rounded-lg p-4 shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Checks Rated Healthy (35-day coverage)</p>
                <InfoTooltip content="Count of product-store checks where current stock meets or exceeds 35-day coverage requirement based on 7-day average sales" />
              </div>
              <p className="text-3xl font-bold text-green-600">{items.filter(i => i.stockStatus === 'Healthy Stock').length.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Represents product-store rows with sufficient 35-day coverage. {items.length > 0 ? `${((items.filter(i => i.stockStatus === 'Healthy Stock').length / items.length) * 100).toFixed(1)}%` : '0%'} of all checks.</p>
            </div>
              <div className="bg-white rounded-lg p-4 shadow">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-orange-50 p-2 text-orange-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700 mr-10">Low Stock Checks</p>
                    <InfoTooltip content="Each row represents one product checked at one store. Low stock = current stock is insufficient for 35 days based on average daily sales from the last 7 days." />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 ml-2">Product-store rows with insufficient 35-day coverage</p>
                  <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{items.filter(i => i.stockStatus === 'Low Stock').length.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-gray-500 ml-2">
                    {items.length > 0
                      ? `${((items.filter(i => i.stockStatus === 'Low Stock').length / items.length) * 100).toFixed(1)}% of all checks`
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-red-50 p-2 text-red-600">
                      <TrendingDown className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700 mr-10">Out-of-Stock Checks</p>
                    <InfoTooltip content="Number of product-store check rows that reported zero on-hand quantity." />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 ml-2">Product-store rows reporting zero on-hand</p>
                  <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{items.filter(i => i.onHandQty === 0).length.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-gray-500 ml-2">
                    {items.length > 0
                      ? `${((items.filter(i => i.onHandQty === 0).length / items.length) * 100).toFixed(1)}% of all checks`
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-blue-50 p-2 text-blue-600">
                      <Store className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700 mr-10">Impacted Stores</p>
                    <InfoTooltip content="Distinct store codes that had at least one product with insufficient 35-day coverage." />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 ml-2">Distinct store codes with low-stock entries</p>
                  <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{metrics.affectedStores}</p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-purple-50 p-2 text-purple-600">
                      <Package className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700 mr-10">Impacted Products</p>
                    <InfoTooltip content="Distinct product codes that appeared in at least one low-stock product-store check row." />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 ml-2">Distinct product codes with low-stock entries</p>
                  <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{metrics.affectedProducts}</p>
                </div>
              </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      {!loading && !error && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
            <button
              onClick={() => handleViewModeChange('summary')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'summary'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Summary View
            </button>
            <button
              onClick={() => handleViewModeChange('detailed')}
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
        <LoadingBar message="Loading low stock data..." />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Package className="mx-auto text-gray-400" size={48} />
          <p className="mt-4 text-gray-600">No low stock items found for the selected period</p>
        </div>
      ) : viewMode === 'summary' ? (
        /* SUMMARY VIEW - Analytics and Charts Only */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Top 10 Stores */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200 h-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <BarChart size={24} className="text-orange-600" />
                  Top 10 Stores by {stockMetricLabel}
                </h2>
                <p className="text-xs text-gray-500 mt-1">Toggle to compare stores by low-stock and healthy-stock check volumes.</p>
              </div>
              <StockMetricToggle
                view={stockViewType}
                onChange={setStockViewType}
                disableHealthy={!hasAnyHealthyData}
              />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={storeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="storeName" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <Tooltip formatter={(value: number) => [Number(value).toLocaleString(), stockMetricLabel]} />
                <Bar dataKey={stockMetricKey} fill={stockMetricColor} name={stockMetricLabel} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stock Status Distribution */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200 h-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <PieChartIcon size={24} className="text-purple-600" />
              Stock Status Distribution (product-store checks)
            </h2>
            <p className="text-xs text-gray-500 mb-4">Breakdown of all product-store check rows by their recorded stock status.</p>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={metrics.statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.name}: ${totalStatusChecks > 0 ? ((entry.value / totalStatusChecks) * 100).toFixed(0) : 0}%`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metrics.statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top 10 Products */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200 h-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <BarChart size={24} className="text-indigo-600" />
                  Top 10 Products by {stockMetricLabel}
                </h2>
                <p className="text-xs text-gray-500 mt-1">Evaluate product coverage by switching between low and healthy check counts.</p>
              </div>
              <StockMetricToggle
                view={stockViewType}
                onChange={setStockViewType}
                disableHealthy={!hasAnyHealthyData}
              />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={productChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="productName" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <Tooltip formatter={(value: number) => [Number(value).toLocaleString(), stockMetricLabel]} />
                <Bar dataKey={stockMetricKey} fill={stockMetricColor} name={stockMetricLabel} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Low Stock Trend */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200 h-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <LineChartIcon size={24} className="text-orange-600" />
              Daily low-stock check volume trend
            </h2>
            <p className="text-xs text-gray-500 mb-4">Tracks the number of product-store check rows marked healthy, low, or out of stock for each day in the selected range.</p>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={summaryTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <Tooltip formatter={(value: number, name: string) => [value.toLocaleString(), name]} />
                <Legend />
                <Line type="monotone" dataKey="healthyStock" stroke="#10b981" strokeWidth={2} name="Healthy Stock" />
                <Line type="monotone" dataKey="lowStock" stroke="#f59e0b" strokeWidth={2} name="Low Stock" />
                <Line type="monotone" dataKey="outOfStock" stroke="#ef4444" strokeWidth={2} name="Out-of-Stock" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Regional Analysis Chart */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200 h-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <MapPin size={24} className="text-purple-600" />
                  Top regions by {stockMetricLabel.toLowerCase()}
                </h2>
                <p className="text-xs text-gray-500 mt-1">Use the toggle to review regional trends for low versus healthy stock checks.</p>
              </div>
              <StockMetricToggle
                view={stockViewType}
                onChange={setStockViewType}
                disableHealthy={!hasAnyHealthyData}
              />
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={regionChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="region" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <Tooltip formatter={(value: number) => [Number(value).toLocaleString(), stockMetricLabel]} />
                <Legend />
                <Bar dataKey={stockMetricKey} fill={stockMetricColor} name={stockMetricLabel} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Channel Impact */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200 h-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Building2 size={24} className="text-blue-600" />
                  Channel impact ({stockMetricLabel.toLowerCase()})
                </h2>
                <p className="text-xs text-gray-500 mt-1">Switch to highlight either low-stock or healthy-stock check totals by channel.</p>
              </div>
              <StockMetricToggle
                view={stockViewType}
                onChange={setStockViewType}
                disableHealthy={!hasAnyHealthyData}
              />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={channelChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="channel" angle={-30} textAnchor="end" height={80} fontSize={12} />
                <YAxis />
                <Tooltip formatter={(value: number) => [Number(value).toLocaleString(), stockMetricLabel]} />
                <Legend />
                <Bar dataKey={stockMetricKey} fill={stockMetricColor} name={stockMetricLabel} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Product Group Exposure */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200 h-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Boxes size={24} className="text-violet-600" />
                  Product-group exposure ({stockMetricLabel.toLowerCase()})
                </h2>
                <p className="text-xs text-gray-500 mt-1">Compare how many checks per product group fell into each stock band.</p>
              </div>
              <StockMetricToggle
                view={stockViewType}
                onChange={setStockViewType}
                disableHealthy={!hasAnyHealthyData}
              />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={productGroupChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="productGroup" angle={-30} textAnchor="end" height={80} fontSize={12} />
                <YAxis />
                <Tooltip formatter={(value: number) => [Number(value).toLocaleString(), stockMetricLabel]} />
                <Legend />
                <Bar dataKey={stockMetricKey} fill={stockMetricColor} name={stockMetricLabel} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* DETAILED VIEW - Single Comprehensive Data Table */
        <div className={isTableFullscreen ? "fixed inset-0 z-50 bg-white p-6 overflow-y-auto" : ""}>
          {items.length > 0 ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Stock Analysis - Detailed Report</h2>
                  <p className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {Math.min(endIndex, items.length)} of {items.length} items • 
                    Page {currentPage} of {totalPages}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setIsTableFullscreen(!isTableFullscreen)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    title={isTableFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                  >
                    {isTableFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    {isTableFullscreen ? "Exit" : "Fullscreen"}
                  </button>
                  <button
                    onClick={exportToExcel}
                    disabled={items.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={18} />
                    Export Excel
                  </button>
                </div>
              </div>
              <div className={isTableFullscreen ? "overflow-x-auto max-h-[calc(100vh-150px)]" : "overflow-x-auto max-h-[700px]"}>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[140px]">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[140px]">TL Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[200px]">TL Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[160px]">Field User Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[200px]">Field User Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[140px]">Store Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[250px]">Store Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[180px]">Chain Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[140px]">Product Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[250px]">Product Name</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">Opening Stock</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[180px]">Avg Daily Sales (7d)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[180px]">Required Stock (35d)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[160px]">Stock Difference</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[140px]">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedItems.map((item, index) => (
                      <tr key={`${item.storeCheckId}-${index}`} className="hover:bg-gray-50 transition-colors">
                        {/* Date */}
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {new Date(item.checkDate).toLocaleDateString('en-GB')}
                        </td>
                        
                        {/* TL Code */}
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap font-medium">
                          {item.teamLeaderCode || '—'}
                        </td>
                        
                        {/* TL Name */}
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.teamLeaderName || '—'}
                        </td>
                        
                        {/* Field User Code */}
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap font-medium">
                          {item.userCode}
                        </td>
                        
                        {/* Field User Name */}
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.userName}
                        </td>
                        
                        {/* Store Code */}
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap font-medium">
                          {item.storeCode}
                        </td>
                        
                        {/* Store Name */}
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.storeName}
                        </td>
                        
                        {/* Chain Name */}
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.chainName || '—'}
                        </td>
                        
                        {/* Product Code */}
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap font-medium">
                          {item.productCode}
                        </td>
                        
                        {/* Product Name */}
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.productName}
                        </td>
                        
                        {/* Opening Stock (On Hand Qty) */}
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          <span className={item.onHandQty === 0 ? 'text-red-600' : item.onHandQty < 10 ? 'text-orange-600' : 'text-gray-900'}>
                            {item.onHandQty}
                          </span>
                        </td>
                        
                        {/* Avg Daily Sales (7 days) */}
                        <td className="px-4 py-3 text-sm text-right text-blue-600 font-medium">
                          {item.avgDailySales?.toFixed(2) ?? '0.00'}
                        </td>
                        
                        {/* Required Stock (35 days) */}
                        <td className="px-4 py-3 text-sm text-right text-purple-600 font-medium">
                          {item.requiredStock35Days?.toFixed(0) ?? '0'}
                        </td>
                        
                        {/* Stock Difference (Shortage) */}
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          <span className={item.stockShortage && item.stockShortage > 0 ? 'text-red-600' : 'text-green-600'}>
                            {item.stockShortage ? `-${item.stockShortage.toFixed(0)}` : '0'}
                          </span>
                        </td>
                        
                        {/* Stock Status */}
                        <td className="px-4 py-3 text-center">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                            item.stockStatus === 'Low Stock'
                              ? 'bg-orange-100 text-orange-800'
                              : item.stockStatus === 'Healthy Stock'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {item.stockStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                  <div className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {Math.min(endIndex, items.length)} of {items.length} items
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              
              {/* Footer Info */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Total {items.length} stock items • {items.filter(i => i.stockStatus === 'Healthy Stock').length} Healthy • {items.filter(i => i.stockStatus === 'Low Stock').length} Low Stock • 35-day coverage calculation
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Stock Items Found</h3>
              <p className="text-sm text-gray-500">Try adjusting your filters or date range to see data</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
