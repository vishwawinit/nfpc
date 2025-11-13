'use client'

import { useState, useEffect, useMemo } from 'react'
import { MapPin, TrendingUp, Calendar, Download, Filter, BarChart3, Users, Store, Maximize, Minimize, RefreshCw, ChevronLeft, ChevronRight, Navigation, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, ScatterChart, Scatter, ZAxis } from 'recharts'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { CustomDatePicker } from '@/components/ui/CustomDatePicker'
import * as XLSX from 'xlsx'

interface VisitData {
  visitDate: string
  tlCode: string | null
  tlName: string | null
  userCode: string
  userName: string
  userRole: string | null
  firstCheckIn: string
  lastCheckOut: string | null
  totalTimeMinutes: number
  totalStoresVisited: number
  firstLat: number
  firstLon: number
  lastLat: number
  lastLon: number
  distanceKm: number
}

interface FilterOptions {
  users: Array<{ value: string; label: string }>
  teamLeaders: Array<{ value: string; label: string }>
  cities: Array<{ value: string; label: string }>
  regions: Array<{ value: string; label: string }>
}

interface Summary {
  totalVisitDays: number
  totalFieldUsers: number
  totalStoresVisited: number
  avgStoresPerDay: number
  totalDistanceCovered: number
  avgDistancePerDay: number
  avgTimeSpentPerDay: number
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

interface OGPReportProps {
  loginUserCode?: string
}

export function OGPReport({ loginUserCode = 'admin' }: OGPReportProps) {
  const [visits, setVisits] = useState<VisitData[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    users: [],
    teamLeaders: [],
    cities: [],
    regions: []
  })

  // Filters - Default to This Month
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedTeamLeader, setSelectedTeamLeader] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // View mode
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Pagination (for detailed view only)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50)

  useEffect(() => {
    fetchFilterOptions()
  }, [startDate, endDate, selectedTeamLeader])

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, selectedTeamLeader, selectedUser, selectedCity, selectedRegion])
  
  // Debug: Log when filterOptions change
  useEffect(() => {
    console.log('Filter Options Updated:', {
      users: filterOptions.users.length,
      cities: filterOptions.cities.length,
      regions: filterOptions.regions.length,
      teamLeaders: filterOptions.teamLeaders.length
    })
  }, [filterOptions])

  const fetchFilterOptions = async () => {
    try {
      const params = new URLSearchParams({
        ...(selectedCity && { cityCode: selectedCity }),
        ...(selectedTeamLeader && { teamLeaderCode: selectedTeamLeader }),
        ...(loginUserCode && { loginUserCode })
      })

      const response = await fetch(`/api/ogp/filters?${params}`)
      const result = await response.json()
      
      console.log('OGP Filters Response:', result)
      console.log('Filter counts received:', {
        users: result.data?.users?.length || 0,
        cities: result.data?.cities?.length || 0,
        regions: result.data?.regions?.length || 0,
        teamLeaders: result.data?.teamLeaders?.length || 0
      })

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

      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(selectedTeamLeader && { teamLeaderCode: selectedTeamLeader }),
        ...(selectedUser && { userCode: selectedUser }),
        ...(selectedCity && { cityCode: selectedCity }),
        ...(selectedRegion && { regionCode: selectedRegion }),
        ...(loginUserCode && { loginUserCode })
      })

      const response = await fetch(`/api/ogp?${params}`)
      const result = await response.json()

      if (result.success) {
        setVisits(result.data)
        setSummary(result.summary)
        setCurrentPage(1) // Reset to first page
      } else {
        setError(result.error || 'Failed to fetch OGP data')
      }
    } catch (err) {
      console.error('Error fetching OGP data:', err)
      setError('Failed to fetch OGP data')
    } finally {
      setLoading(false)
    }
  }

  // Pagination logic (for detailed view only)
  const paginatedVisits = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return visits.slice(startIndex, endIndex)
  }, [visits, currentPage, itemsPerPage])

  const totalPages = Math.ceil(visits.length / itemsPerPage)

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'N/A'
    try {
      const date = new Date(timeString)
      // Check if date is valid
      if (isNaN(date.getTime())) return 'N/A'
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return 'N/A'
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return `${hours}h ${mins}m`
  }

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new()

    // Summary Sheet
    const summaryData = [
      ['OGP Report - Outlet Growth Plan (Store Visit with Distance)'],
      ['Period', `${startDate} to ${endDate}`],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary Metrics'],
      ['Total Visit Days', summary?.totalVisitDays || 0],
      ['Total Field Users', summary?.totalFieldUsers || 0],
      ['Total Stores Visited', summary?.totalStoresVisited || 0],
      ['Avg Stores Per Day', (summary?.avgStoresPerDay || 0).toFixed(2)],
      ['Total Distance Covered (KM)', (summary?.totalDistanceCovered || 0).toFixed(2)],
      ['Avg Distance Per Day (KM)', (summary?.avgDistancePerDay || 0).toFixed(2)],
      ['Avg Time Spent Per Day (mins)', (summary?.avgTimeSpentPerDay || 0).toFixed(0)],
      [],
      ['Filters Applied'],
      ['Team Leader', selectedTeamLeader || 'All'],
      ['Field User', selectedUser || 'All'],
      ['City', selectedCity || 'All'],
      ['Region', selectedRegion || 'All']
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    // Detailed Data Sheet
    const detailedData = visits.map(item => ({
      'TL Code': item.tlCode || 'N/A',
      'TL Name': item.tlName || 'Not Assigned',
      'Field User Code': item.userCode,
      'Field User Name': item.userName,
      'Date': new Date(item.visitDate).toLocaleDateString('en-GB'),
      'First Check-in Time': formatTime(item.firstCheckIn),
      'Last Checkout Time': formatTime(item.lastCheckOut),
      'Total Time Spent': formatDuration(item.totalTimeMinutes),
      'Total Stores Visited': item.totalStoresVisited,
      'First Checkin Latitude': item.firstLat.toFixed(6),
      'First Checkin Longitude': item.firstLon.toFixed(6),
      'Last Checkout Latitude': item.lastLat.toFixed(6),
      'Last Checkout Longitude': item.lastLon.toFixed(6),
      'Distance in KMs': item.distanceKm.toFixed(2)
    }))
    const detailedSheet = XLSX.utils.json_to_sheet(detailedData)
    XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Visit Data')

    XLSX.writeFile(wb, `ogp-report-${startDate}-${endDate}.xlsx`)
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <MapPin className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">OGP Report - Outlet Growth Plan</h1>
            <p className="text-sm text-gray-600 mt-1">Store User Visit Report with GPS Distance Tracking</p>
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
                setSelectedCity('')
                setSelectedRegion('')
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
              type="button"
            >
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Start Date */}
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

            {/* Region */}
            <SearchableSelect
              value={selectedRegion || null}
              onChange={(value) => setSelectedRegion(value || '')}
              options={filterOptions.regions}
              placeholder={`All Regions (Available: ${filterOptions.regions.length})`}
              icon={<MapPin className="w-4 h-4 text-gray-500" />}
              label="Region"
              formatOptionLabel={(option) => option.label}
            />

            {/* City */}
            <SearchableSelect
              value={selectedCity || null}
              onChange={(value) => setSelectedCity(value || '')}
              options={filterOptions.cities}
              placeholder={`All Cities (Available: ${filterOptions.cities.length})`}
              icon={<MapPin className="w-4 h-4 text-gray-500" />}
              label="City"
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
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && !error && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Field User Visit Days</p>
                <InfoTooltip content="Total number of field user visit days across the selected date range. Each day a field user makes store visits counts as one visit day." />
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{summary.totalVisitDays}</p>
            <p className="text-xs text-gray-500 mt-1">Total Field Users: {summary.totalFieldUsers}</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Stores Visited</p>
                <InfoTooltip content="Total number of stores visited across all days and users" />
              </div>
              <Store className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900">{summary.totalStoresVisited}</p>
            <p className="text-xs text-gray-500 mt-1">Avg {summary.avgStoresPerDay.toFixed(1)} per day</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Distance Covered</p>
                <InfoTooltip content="Total distance traveled calculated using GPS coordinates (Haversine formula)" />
              </div>
              <Navigation className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-900">{summary.totalDistanceCovered.toFixed(1)} KM</p>
            <p className="text-xs text-gray-500 mt-1">Avg {summary.avgDistancePerDay.toFixed(2)} KM/day</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Avg Time Spent</p>
                <InfoTooltip content="Average time spent per day (from first check-in to last check-out)" />
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-orange-900">{formatDuration(summary.avgTimeSpentPerDay)}</p>
            <p className="text-xs text-gray-500 mt-1">Per field day</p>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      {!loading && !error && visits.length > 0 && (
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
        <LoadingBar message="Loading visit data with GPS tracking..." />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      ) : visits.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <MapPin className="mx-auto text-gray-400" size={48} />
          <p className="mt-4 text-gray-600">No visit data found for the selected period</p>
        </div>
      ) : viewMode === 'summary' ? (
        /* SUMMARY VIEW - Charts and Analytics */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Top Users by Stores Visited */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top 10 Users by Stores Visited</h3>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={(() => {
                const userData = visits.reduce((acc: any, visit) => {
                  const userKey = visit.userCode
                  if (!acc[userKey]) {
                    acc[userKey] = {
                      user: visit.userName.length > 20 ? visit.userName.substring(0, 20) + '...' : visit.userName,
                      stores: 0
                    }
                  }
                  acc[userKey].stores += visit.totalStoresVisited
                  return acc
                }, {})
                return Object.values(userData)
                  .map((d: any) => ({ user: d.user, 'Stores Visited': d.stores }))
                  .sort((a: any, b: any) => b['Stores Visited'] - a['Stores Visited'])
                  .slice(0, 10)
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="user" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="Stores Visited" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Distance Traveled by User */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Navigation className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top 10 Users by Distance Covered</h3>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={(() => {
                const userData = visits.reduce((acc: any, visit) => {
                  const userKey = visit.userCode
                  if (!acc[userKey]) {
                    acc[userKey] = {
                      user: visit.userName.length > 20 ? visit.userName.substring(0, 20) + '...' : visit.userName,
                      distance: 0
                    }
                  }
                  acc[userKey].distance += visit.distanceKm
                  return acc
                }, {})
                return Object.values(userData)
                  .map((d: any) => ({ user: d.user, 'Distance (KM)': Number(d.distance.toFixed(2)) }))
                  .sort((a: any, b: any) => b['Distance (KM)'] - a['Distance (KM)'])
                  .slice(0, 10)
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="user" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <RechartsTooltip formatter={(value: number) => `${value} KM`} />
                <Legend />
                <Bar dataKey="Distance (KM)" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Visit Trend */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm xl:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Daily Visit Activity Trend</h3>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={(() => {
                const dailyData = visits.reduce((acc: any, visit) => {
                  const date = new Date(visit.visitDate).toLocaleDateString('en-GB')
                  if (!acc[date]) {
                    acc[date] = { stores: 0, distance: 0, time: 0 }
                  }
                  acc[date].stores += visit.totalStoresVisited
                  acc[date].distance += visit.distanceKm
                  acc[date].time += visit.totalTimeMinutes
                  return acc
                }, {})
                return Object.entries(dailyData)
                  .map(([date, data]: [string, any]) => ({
                    date,
                    'Stores Visited': data.stores,
                    'Distance (KM)': Number(data.distance.toFixed(1))
                  }))
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <RechartsTooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="Stores Visited" stroke="#3b82f6" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="Distance (KM)" stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* DETAILED VIEW - Data Table with Pagination */
        <div className={isFullscreen ? "fixed inset-0 z-50 bg-white flex flex-col" : "bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"}>
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Detailed Visit Data with GPS Tracking</h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, visits.length)} of {visits.length} visit days
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
              <button
                onClick={exportToExcel}
                disabled={visits.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download size={18} />
                Export Excel
              </button>
            </div>
          </div>

          <div className={isFullscreen ? "flex-1 overflow-auto" : "overflow-x-auto max-h-[600px]"}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TL Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TL Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Field User Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Field User Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">First Check-in Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Last Checkout Time</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Time Spent</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Stores Visited</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">First Checkin Latitude</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">First Checkin Longitude</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Last Checkout Latitude</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Last Checkout Longitude</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Distance in KMs</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedVisits.map((item, index) => (
                  <tr key={index} className="hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{item.tlCode || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.tlName || 'Not Assigned'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{item.userCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.userName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(item.visitDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatTime(item.firstCheckIn)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatTime(item.lastCheckOut)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatDuration(item.totalTimeMinutes)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-blue-600">
                      {item.totalStoresVisited}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                      {item.firstLat.toFixed(6)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                      {item.firstLon.toFixed(6)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                      {item.lastLat.toFixed(6)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                      {item.lastLon.toFixed(6)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-purple-600">
                      {item.distanceKm.toFixed(2)}
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
                Page {currentPage} of {totalPages} • {visits.length} total visit days
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
