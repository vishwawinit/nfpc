'use client'

import { useState, useEffect, useMemo } from 'react'
import { Activity, RefreshCw, Users, Calendar as CalendarIcon, Download, Filter, Eye, X, ChevronDown, FileSpreadsheet } from 'lucide-react'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'
import { useDashboardFilters } from '@/hooks/useDashboardFilters'
import { exportToExcel, formatExportDate, collectFilterInfo } from '@/utils/excelExport'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts'
import * as XLSX from 'xlsx'

interface RotaSummary {
  userCode: string
  userName: string
  teamLeaderCode: string | null
  teamLeaderName: string | null
  totalActivities: number
  lastActivityDate: string
  lastCreatedOn: string
  createdBy: string | null
}

interface RotaActivity {
  rotaDate: string
  rotaId: number
  userCode: string
  userName: string
  teamLeaderCode: string | null
  teamLeaderName: string | null
  activityName: string | null
  startTime: string | null
  endTime: string | null
  createdBy: string | null
  createdOn: string
}

interface ROTAReportProps {
  loginUserCode?: string
}

export function ROTAReport({ loginUserCode = 'admin' }: ROTAReportProps) {
  const [summaryData, setSummaryData] = useState<RotaSummary[]>([])
  const [detailedActivities, setDetailedActivities] = useState<RotaActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<RotaSummary | null>(null)
  const [selectedActivity, setSelectedActivity] = useState('')
  const [selectedDateRange, setSelectedDateRange] = useState('thisMonth')
  const [isInitialized, setIsInitialized] = useState(false)

  // Use the dashboard filters hook with loginUserCode - same as Store User Visit Report
  const {
    filters,
    filterOptions,
    loading: filtersLoading,
    error: filtersError,
    updateFilter,
    setDateRange,
    resetFilters,
    getQueryParams
  } = useDashboardFilters(loginUserCode)

  // Handle date range preset selection - same as Store User Visit Report
  const handleDateRangeSelect = (range: string) => {
    setSelectedDateRange(range)
    
    const currentDate = new Date()
    let startDate: Date | null = null
    let endDate: Date | null = null
    
    switch(range) {
      case 'today':
        startDate = currentDate
        endDate = currentDate
        break
      case 'yesterday':
        const yesterday = new Date(currentDate)
        yesterday.setDate(yesterday.getDate() - 1)
        startDate = yesterday
        endDate = yesterday
        break
      case 'thisWeek':
        const weekStart = new Date(currentDate)
        weekStart.setDate(weekStart.getDate() - 6)
        startDate = weekStart
        endDate = currentDate
        break
      case 'thisMonth':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        endDate = currentDate
        break
      case 'lastMonth':
        const lastMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
        const lastMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0)
        startDate = lastMonthStart
        endDate = lastMonthEnd
        break
      case 'thisQuarter':
        const quarterStart = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1)
        startDate = quarterStart
        endDate = currentDate
        break
      case 'lastQuarter':
        const currentQuarterStart = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1)
        const lastQuarterStart = new Date(currentQuarterStart)
        lastQuarterStart.setMonth(lastQuarterStart.getMonth() - 3)
        startDate = lastQuarterStart
        endDate = new Date(currentQuarterStart.getTime() - 1)
        break
      case 'thisYear':
        startDate = new Date(currentDate.getFullYear(), 0, 1)
        endDate = currentDate
        break
      default:
        const thirtyDaysAgo = new Date(currentDate)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        startDate = thirtyDaysAgo
        endDate = currentDate
    }
    
    if (startDate && endDate) {
      const formatDate = (date: Date) => date.toISOString().split('T')[0]
      setDateRange(formatDate(startDate), formatDate(endDate))
    }
  }

  const fetchSummaryData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.teamLeaderCode) params.append('teamLeaderCode', filters.teamLeaderCode)
      if (filters.userCode) params.append('userCode', filters.userCode)
      if (selectedActivity) params.append('activityName', selectedActivity)
      // Add loginUserCode for hierarchy filtering
      if (loginUserCode) params.append('loginUserCode', loginUserCode)

      console.log('🔍 ROTA Summary API Call:')
      console.log('  URL:', `/api/rota/summary?${params}`)
      console.log('  loginUserCode:', loginUserCode)
      console.log('  startDate:', filters.startDate)
      console.log('  endDate:', filters.endDate)
      console.log('  Full URL:', `/api/rota/summary?${params.toString()}`)

      const response = await fetch(`/api/rota/summary?${params}`)
      const result = await response.json()

      console.log('📦 ROTA Summary API Response:')
      console.log('  success:', result.success)
      console.log('  count:', result.count)
      console.log('  dataLength:', result.data?.length)
      console.log('  message:', result.message)
      console.log('  error:', result.error)
      console.log('  Full result:', result)

      if (result.success) {
        setSummaryData(result.data)
      } else {
        setError(result.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError('Failed to fetch ROTA summary')
      console.error('❌ ROTA Summary Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserActivities = async (userCode: string) => {
    try {
      setDetailsLoading(true)

      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      params.append('userCode', userCode)
      if (selectedActivity) params.append('activityName', selectedActivity)
      // Add loginUserCode for hierarchy filtering
      if (loginUserCode) params.append('loginUserCode', loginUserCode)

      const response = await fetch(`/api/rota?${params}`)
      const result = await response.json()

      if (result.success) {
        setDetailedActivities(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch user activities:', err)
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleViewDetails = (user: RotaSummary) => {
    setSelectedUser(user)
    setIsDialogOpen(true)
    fetchUserActivities(user.userCode)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setSelectedUser(null)
    setDetailedActivities([])
  }

  // Initialize date range on mount
  useEffect(() => {
    if (!isInitialized) {
      handleDateRangeSelect(selectedDateRange)
      setIsInitialized(true)
    }
  }, [isInitialized, selectedDateRange])

  // Memoize query params to prevent infinite re-renders
  const queryParams = useMemo(() => {
    const params = getQueryParams()
    return params.toString()
  }, [filters.startDate, filters.endDate, filters.regionCode, filters.fieldUserRole, 
      filters.teamLeaderCode, filters.userCode, getQueryParams])

  // Fetch data when filters change
  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      fetchSummaryData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams, filters.startDate, filters.endDate, selectedActivity, loginUserCode])

  const totalActivities = summaryData.reduce((sum, user) => sum + user.totalActivities, 0)
  const uniqueUsers = summaryData.length

  // Activity distribution for pie chart
  const activityDistribution = useMemo(() => {
    const activityCounts: Record<string, number> = {}
    detailedActivities.forEach(activity => {
      const name = activity.activityName || 'Unknown'
      activityCounts[name] = (activityCounts[name] || 0) + 1
    })
    return Object.entries(activityCounts).map(([name, count]) => ({ name, value: count }))
  }, [detailedActivities])

  const COLORS = {
    activity1: '#4f46e5', // indigo
    activity2: '#0891b2', // cyan
    activity3: '#059669', // emerald
    activity4: '#d97706', // amber
    activity5: '#dc2626', // red
    activity6: '#7c3aed', // violet
    activity7: '#db2777', // pink
  }

  const getActivityColor = (index: number) => {
    const colors = Object.values(COLORS)
    return colors[index % colors.length]
  }

  const handleExport = () => {
    const headers = ['User Code', 'User Name', 'Team Leader', 'Total Activities', 'Last Activity Date', 'Created By', 'Last Created On']
    const rows = summaryData.map(item => [
      item.userCode,
      item.userName,
      item.teamLeaderName || 'N/A',
      item.totalActivities.toString(),
      new Date(item.lastActivityDate).toLocaleDateString(),
      item.createdBy || 'N/A',
      new Date(item.lastCreatedOn).toLocaleString()
    ])

    const filterInfo = collectFilterInfo({
      'Start Date': filters.startDate || undefined,
      'End Date': filters.endDate || undefined,
      'Team Leader': filters.teamLeaderCode || undefined,
      'User': filters.userCode || undefined,
      'Activity': selectedActivity || undefined
    })

    exportToExcel(
      headers,
      rows,
      {
        reportName: 'ROTA Activity Report',
        exportDate: formatExportDate(),
        appliedFilters: filterInfo,
        totalRows: summaryData.length,
        additionalInfo: {
          'Total Activities': totalActivities,
          'Unique Users': uniqueUsers
        }
      },
      `rota-activities-${new Date().toISOString().split('T')[0]}.csv`
    )
  }

  const handleExportUserDetails = () => {
    if (!selectedUser || !detailedActivities.length) return

    const excelData = detailedActivities.map(detail => ({
      'Activity Name': detail.activityName || 'N/A',
      'ROTA Date': new Date(detail.rotaDate).toLocaleDateString(),
      'Start Time': detail.startTime || 'N/A',
      'End Time': detail.endTime || 'N/A',
      'Created By': detail.createdBy || 'N/A',
      'Created On': new Date(detail.createdOn).toLocaleString()
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    ws['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 20 }
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Activities')
    const fileName = `${selectedUser.userName}_${selectedUser.userCode}_Activities_${filters.startDate}_to_${filters.endDate}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">ROTA Activity Report</h1>
          <p className="text-gray-600 mt-1">Track field user schedules and work planning</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSummaryData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Dashboard Filters */}
      <DashboardFilters
        filters={filters}
        filterOptions={filterOptions}
        onFilterChange={updateFilter}
        onDateRangeChange={setDateRange}
        onReset={resetFilters}
        loading={filtersLoading}
        selectedDateRange={selectedDateRange}
        onDateRangeSelect={handleDateRangeSelect}
        showChainFilter={false}
        showStoreFilter={false}
      />

      {/* Summary Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-blue-50 p-2 text-blue-600">
                  <Activity className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mr-10">Total Activities</p>
                <InfoTooltip content="Total number of scheduled activities in the selected period" />
              </div>
              <p className="mt-1 text-xs text-gray-500 ml-2">Sum of all scheduled ROTA tasks</p>
              <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{totalActivities}</p>
              <p className="mt-1 text-xs text-gray-500 ml-2">Across all selected filters</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-green-50 p-2 text-green-600">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mr-10">Unique Users</p>
                <InfoTooltip content="Number of unique field users with scheduled activities" />
              </div>
              <p className="mt-1 text-xs text-gray-500 ml-2">Team members with at least one activity</p>
              <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{uniqueUsers}</p>
              <p className="mt-1 text-xs text-gray-500 ml-2">Field users active</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-orange-50 p-2 text-orange-600">
                  <Activity className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mr-10">Avg Activities/User</p>
                <InfoTooltip content="Average number of activities per field user" />
              </div>
              <p className="mt-1 text-xs text-gray-500 ml-2">Total activities divided by unique users</p>
              <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">
                {uniqueUsers > 0 ? (totalActivities / uniqueUsers).toFixed(1) : '0'}
              </p>
              <p className="mt-1 text-xs text-gray-500 ml-2">Average workload distribution</p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingBar message="Loading ROTA summary..." />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      ) : summaryData.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Activity className="mx-auto text-gray-400" size={48} />
          <p className="mt-4 text-gray-600">No ROTA activities found for the selected period</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-800">ROTA Summary by User</h2>
              <p className="text-sm text-gray-600 mt-1">Showing {summaryData.length} user{summaryData.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={handleExport}
              disabled={summaryData.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>
          <div className="overflow-x-auto max-h-[600px] relative">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">User Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">User Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Team Leader</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Activities</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Last Activity Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created By</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Last Created On</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {summaryData.map((item, index) => (
                  <tr key={index} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-mono text-gray-900">{item.userCode}</td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{item.userName}</td>
                    <td className="px-6 py-3 text-sm">
                      <div className="font-medium text-gray-900">{item.teamLeaderName || '-'}</div>
                      <div className="text-xs text-gray-500 font-mono">{item.teamLeaderCode || '-'}</div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                        {item.totalActivities}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(item.lastActivityDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">{item.createdBy || 'N/A'}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(item.lastCreatedOn).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => handleViewDetails(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog for Detailed Activities */}
      {isDialogOpen && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={closeDialog}></div>

            {/* Dialog */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Activities for {selectedUser.userName} ({selectedUser.userCode})
                    </h3>
                    <p className="text-sm text-blue-100 mt-1">
                      Team Leader: {selectedUser.teamLeaderName || 'N/A'} • Total Activities: {selectedUser.totalActivities}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportUserDetails}
                      disabled={detailedActivities.length === 0}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white text-blue-700 text-sm font-medium rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Export
                    </button>
                    <button
                      onClick={closeDialog}
                      className="text-white hover:text-gray-200 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Pie Chart for User's Activities */}
              {!detailsLoading && activityDistribution.length > 0 && (
                <div className="px-6 py-4 bg-gray-50 border-b">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Activity Distribution</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={activityDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({name, percent}: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {activityDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getActivityColor(index)} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Content */}
              <div className="bg-white px-6 py-4 max-h-[600px] overflow-y-auto">
                {detailsLoading ? (
                  <LoadingBar message="Loading activities..." />
                ) : detailedActivities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">No activities found</div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-blue-50 border-b-2 border-blue-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">Activity Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider whitespace-nowrap">ROTA Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">Start Time</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">End Time</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">Created By</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider whitespace-nowrap">Created On</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {detailedActivities.map((activity, idx) => (
                        <tr key={idx} className="hover:bg-blue-50">
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {activity.activityName || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {new Date(activity.rotaDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{activity.startTime || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{activity.endTime || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{activity.createdBy || 'N/A'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {new Date(activity.createdOn).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-3 flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Showing {detailedActivities.length} activit{detailedActivities.length !== 1 ? 'ies' : 'y'} for this user
                </div>
                <button
                  onClick={closeDialog}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
