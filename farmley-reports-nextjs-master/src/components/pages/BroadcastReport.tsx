'use client'

import { useState, useEffect } from 'react'
import { Radio, RefreshCw, Users, Store, TrendingUp, Download, Calendar, Filter, Image as ImageIcon, PieChart, LineChart, Maximize, Minimize, Building2 } from 'lucide-react'
import { LineChart as RechartsLine, Line, BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell } from 'recharts'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ImageViewer } from '@/components/ui/ImageViewer'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { CustomDatePicker } from '@/components/ui/CustomDatePicker'
import { exportToExcel, formatExportDate, collectFilterInfo } from '@/utils/excelExport'
import * as XLSX from 'xlsx'

interface BroadcastInitiative {
  initiativeDate: string
  storeCode: string
  storeName: string
  userCode: string
  userName: string
  teamLeaderCode: string
  teamLeaderName: string
  mobileNumber: string
  initiativeType: string
  gender: string
  customerName: string
  imagePath: string
  chainCode: string
  chainName: string
  campaignName: string
  messageSent: string
  responseReceived: string
  remarks: string
  createdDateTime: string
}

interface FilterOption {
  value: string
  label: string
}

interface FilterOptions {
  teamLeaders: FilterOption[]
  users: FilterOption[]
  stores: FilterOption[]
  chains: FilterOption[]
  initiativeTypes: FilterOption[]
}

interface BroadcastReportProps {
  loginUserCode?: string
}

export function BroadcastReport({ loginUserCode = 'admin' }: BroadcastReportProps) {
  const [initiatives, setInitiatives] = useState<BroadcastInitiative[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    teamLeaders: [],
    users: [],
    stores: [],
    chains: [],
    initiativeTypes: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states with default current month
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedTeamLeader, setSelectedTeamLeader] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedChain, setSelectedChain] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary')

  // Fetch filter options (cascading based on date selection)
  const fetchFilterOptions = async () => {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      params.append('loginUserCode', loginUserCode)
      if (selectedTeamLeader) params.append('teamLeaderCode', selectedTeamLeader)
      if (selectedUser) params.append('userCode', selectedUser)
      if (selectedStore) params.append('storeCode', selectedStore)
      if (selectedChain) params.append('chainCode', selectedChain)

      const response = await fetch(`/api/broadcast/filters?${params}`)
      const result = await response.json()

      if (result.success) {
        setFilterOptions(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err)
    }
  }

  // Fetch initiatives data
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      params.append('loginUserCode', loginUserCode)
      if (selectedTeamLeader) params.append('teamLeaderCode', selectedTeamLeader)
      if (selectedUser) params.append('userCode', selectedUser)
      if (selectedStore) params.append('storeCode', selectedStore)
      if (selectedChain) params.append('chainCode', selectedChain)
      if (selectedType) params.append('initiativeType', selectedType)

      const response = await fetch(`/api/broadcast?${params}`)
      const result = await response.json()

      if (result.success) {
        setInitiatives(result.data)
      } else {
        setError(result.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError('Failed to fetch broadcast initiatives')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Initial load and filter options refresh
  useEffect(() => {
    fetchFilterOptions()
  }, [startDate, endDate, selectedTeamLeader])

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, selectedTeamLeader, selectedUser, selectedStore, selectedChain, selectedType])

  // Calculate summary stats
  const totalInitiatives = initiatives.length
  const ftbCount = initiatives.filter(i => i.initiativeType === 'FTB').length
  const rcCount = initiatives.filter(i => i.initiativeType === 'RC').length
  const uniqueCustomers = new Set(initiatives.map(i => i.mobileNumber)).size

  // Enhanced Excel export with all columns
  const handleExport = () => {
    const wb = XLSX.utils.book_new()

    // Summary Sheet
    const uniqueUsers = new Set(initiatives.map(e => e.userCode)).size
    const days = new Set(initiatives.map(e => new Date(e.initiativeDate).toLocaleDateString())).size
    const dailyAverage = days > 0 ? Math.round(totalInitiatives / days) : 0
    
    const summaryData = [
      ['Broadcast Initiative Report'],
      ['Period', `${startDate} to ${endDate}`],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary Metrics'],
      ['Total Initiatives', totalInitiatives],
      ['First Time Buyers (FTB)', ftbCount],
      ['Repeat Customers (RC)', rcCount],
      ['Unique Customers', uniqueCustomers],
      ['Field Users', uniqueUsers],
      ['Daily Average', dailyAverage],
      [],
      ['Filters Applied'],
      ['Team Leader', selectedTeamLeader || 'All'],
      ['Field User', selectedUser || 'All'],
      ['Store', selectedStore || 'All'],
      ['Chain', selectedChain || 'All'],
      ['Initiative Type', selectedType || 'All']
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    // Detailed Data Sheet
    const detailedData = initiatives.map(item => ({
      'Date': new Date(item.initiativeDate).toLocaleDateString('en-GB'),
      'TL Code': item.teamLeaderCode || '',
      'TL Name': item.teamLeaderName || '',
      'Field User Code': item.userCode,
      'Field User Name': item.userName,
      'Store Code': item.storeCode,
      'Store Name': item.storeName,
      'Chain Name': item.chainName || '',
      'End Customer Name': item.customerName,
      'Mobile Number': item.mobileNumber,
      'FTB RC': item.initiativeType
    }))
    const detailedSheet = XLSX.utils.json_to_sheet(detailedData)
    XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Data')

    XLSX.writeFile(wb, `broadcast-initiatives-${startDate}-${endDate}.xlsx`)
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-white p-6 space-y-6 overflow-y-auto" : "p-4 md:p-6 space-y-4 md:space-y-6"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Radio className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Broadcast Initiative Report</h1>
            <p className="text-sm text-gray-600 mt-1">Track marketing initiatives and customer engagement</p>
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                date.setDate(date.getDate() - 30)
                setStartDate(date.toISOString().split('T')[0])
                setEndDate(new Date().toISOString().split('T')[0])
                setSelectedTeamLeader('')
                setSelectedUser('')
                setSelectedStore('')
                setSelectedChain('')
                setSelectedType('')
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

            {/* Initiative Type (keep as regular select since it's just 2-3 options) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                Initiative Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">All Types ({filterOptions.initiativeTypes.length})</option>
                {filterOptions.initiativeTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-600">Total Initiatives</p>
              <InfoTooltip content="Total number of broadcast marketing initiatives recorded in the selected period" />
            </div>
            <Radio className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalInitiatives}</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-600">First Time Buyers (FTB)</p>
              <InfoTooltip content="Initiatives targeting customers making their first purchase. These are critical for expanding customer base." />
            </div>
            <Users className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-600">{ftbCount}</p>
          <p className="text-xs text-gray-500 mt-1">{totalInitiatives > 0 ? ((ftbCount / totalInitiatives) * 100).toFixed(1) : 0}% of total</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-600">Repeat Customers (RC)</p>
              <InfoTooltip content="Initiatives targeting existing customers for repeat purchases. Indicates customer loyalty and retention efforts." />
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-purple-600">{rcCount}</p>
          <p className="text-xs text-gray-500 mt-1">{totalInitiatives > 0 ? ((rcCount / totalInitiatives) * 100).toFixed(1) : 0}% of total</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-600">Unique Customers</p>
              <InfoTooltip content="Count of unique customers reached based on mobile numbers. Shows breadth of customer engagement." />
            </div>
            <Users className="w-8 h-8 text-orange-600" />
          </div>
          <p className="text-3xl font-bold text-orange-600">{uniqueCustomers}</p>
          <p className="text-xs text-gray-500 mt-1">Contacted via mobile</p>
        </div>
      </div>

      {/* Summary View - Graphs */}
      {viewMode === 'summary' && !loading && !error && initiatives.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Initiatives by Type</h3>
              <InfoTooltip content="Distribution of broadcast initiatives by type (FTB: First Time Buyer, RC: Repeat Customer). Shows customer acquisition vs retention focus." />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPie>
                <Pie
                  data={(() => {
                    const typeCounts = initiatives.reduce((acc: any, init) => {
                      const type = init.initiativeType === 'FTB' ? 'First Time Buyer' : 'Repeat Customer'
                      acc[type] = (acc[type] || 0) + 1
                      return acc
                    }, {})
                    return Object.entries(typeCounts)
                      .map(([type, count]) => ({
                        name: type,
                        value: count as number
                      }))
                  })()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[
                    '#10b981', '#8b5cf6', '#3b82f6', '#f59e0b'
                  ].map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number) => `${value} initiatives`} />
                <Legend />
              </RechartsPie>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <LineChart className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Initiatives Trend by Date</h3>
              <InfoTooltip content="Daily trend of broadcast initiatives over time. Shows campaign intensity and timing patterns." />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsLine data={(() => {
                const dateData = initiatives.reduce((acc: any, init) => {
                  const date = new Date(init.initiativeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  acc[date] = (acc[date] || 0) + 1
                  return acc
                }, {})
                return Object.entries(dateData)
                  .map(([date, count]) => ({
                    date,
                    'Initiatives': count as number
                  }))
                  .slice(-10)
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                <YAxis label={{ value: 'Initiatives', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="Initiatives" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </RechartsLine>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Store Performance</h3>
              <InfoTooltip content="Initiative count by store location. Shows which stores are most actively engaged in broadcast initiatives." />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsBar data={(() => {
                const storeData = initiatives.reduce((acc: any, init) => {
                  const key = init.storeCode
                  if (!acc[key]) {
                    acc[key] = { 
                      store: init.storeName.length > 15 ? init.storeName.substring(0, 15) + '...' : init.storeName,
                      fullName: `${init.storeCode} - ${init.storeName}`,
                      FTB: 0, 
                      RC: 0 
                    }
                  }
                  if (init.initiativeType === 'FTB') acc[key].FTB++
                  else if (init.initiativeType === 'RC') acc[key].RC++
                  return acc
                }, {})
                return Object.values(storeData)
                  .sort((a: any, b: any) => (b.FTB + b.RC) - (a.FTB + a.RC))
                  .slice(0, 10)
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="store" angle={-45} textAnchor="end" height={100} fontSize={11} />
                <YAxis />
                <RechartsTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                          <p className="font-semibold text-gray-900 mb-2">{data.fullName}</p>
                          {payload.map((entry: any, index: number) => (
                            <p key={index} style={{ color: entry.color }} className="text-sm">
                              {entry.name}: {entry.value}
                            </p>
                          ))}
                          <p className="text-sm text-gray-600 mt-1 pt-1 border-t">
                            Total: {data.FTB + data.RC}
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
                <Bar dataKey="FTB" stackId="a" fill="#3b82f6" name="First Time Buyer" />
                <Bar dataKey="RC" stackId="a" fill="#10b981" name="Repeat Customer" />
              </RechartsBar>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top Performing Users</h3>
              <InfoTooltip content="Field users ranked by initiative count. Identifies most active team members in broadcast campaigns." />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsBar layout="vertical" data={(() => {
                const userData = initiatives.reduce((acc: any, init) => {
                  const key = init.userCode
                  if (!acc[key]) {
                    acc[key] = { 
                      name: init.userName.length > 20 ? init.userName.substring(0, 20) + '...' : init.userName,
                      fullName: `${init.userCode} - ${init.userName}`,
                      count: 0 
                    }
                  }
                  acc[key].count++
                  return acc
                }, {})
                return Object.values(userData)
                  .sort((a: any, b: any) => b.count - a.count)
                  .slice(0, 10)
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} fontSize={11} />
                <RechartsTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                          <p className="font-semibold text-gray-900">{data.fullName}</p>
                          <p className="text-sm text-blue-600 mt-1">
                            Initiatives: {data.count}
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="count" fill="#f59e0b" name="Initiatives">
                  {Array(10).fill(0).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'][index % 7]} />
                  ))}
                </Bar>
              </RechartsBar>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed View - Data Table */}
      {viewMode === 'detailed' && (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Detailed Broadcast Initiative Data</h2>
            <p className="text-sm text-gray-600 mt-1">
              Showing {initiatives.length} initiative{initiatives.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={initiatives.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            Export Excel
          </button>
        </div>

        <div className={isFullscreen ? "overflow-x-auto max-h-[calc(100vh-300px)]" : "overflow-x-auto max-h-[600px]"}>
          {loading ? (
            <LoadingBar message="Loading broadcast initiatives..." />
          ) : error ? (
            <div className="text-center py-12 text-red-600">{error}</div>
          ) : initiatives.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No initiatives found. Try adjusting your filters.
            </div>
          ) : (
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[180px]">End Customer Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px]">Mobile Number</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[80px]">FTB RC</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {initiatives.map((item, index) => (
                  <tr key={index} className="hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(item.initiativeDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{item.teamLeaderCode || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.teamLeaderName || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{item.userCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.userName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{item.storeCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.storeName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.chainName || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.customerName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-mono">{item.mobileNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                        item.initiativeType === 'FTB'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {item.initiativeType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      )}
    </div>
  )
}
