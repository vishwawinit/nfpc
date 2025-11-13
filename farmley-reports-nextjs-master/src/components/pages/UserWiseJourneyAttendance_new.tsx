'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Users, Calendar, UserCheck, Clock, Download, X, FileSpreadsheet, ChartPie } from 'lucide-react'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'
import { useDashboardFilters } from '@/hooks/useDashboardFilters'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import * as XLSX from 'xlsx'

interface UserSummary {
  userCode: string
  userName: string
  userUsername?: string
  userRole: string
  tlCode: string | null
  tlName: string | null
  profilePic?: string | null
  totalDays: number
  presentDays: number
  absentDays: number
  leaveDays: number
  holidayDays: number
  weekoffDays: number
  actualWorkingDays: number
  attendancePercentage: number
  totalWorkingMinutes: number
  avgWorkingMinutes: number
  journeyDays: number
}

interface AttendanceDetail {
  attendanceDate: string
  userCode: string
  userName: string
  userUsername?: string
  tlCode: string | null
  tlName: string | null
  profilePic?: string | null
  attendanceStatus: string
  leaveType: string | null
  holidayName: string | null
  journeyStartTime: string | null
  journeyEndTime: string | null
  totalWorkingMinutes: number
  remarks?: string | null
  reason?: string | null
}

export const UserWiseJourneyAttendance: React.FC = () => {
  const [selectedDateRange, setSelectedDateRange] = useState('lastMonth')
  const [isInitialized, setIsInitialized] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Use the dashboard filters hook - same as Store User Visit Report
  const {
    filters,
    filterOptions,
    loading: filtersLoading,
    error: filtersError,
    updateFilter,
    setDateRange,
    resetFilters,
    getQueryParams
  } = useDashboardFilters()
  
  // Data states
  const [users, setUsers] = useState<UserSummary[]>([])
  const [stats, setStats] = useState<any>(null)
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null)
  const [userDetails, setUserDetails] = useState<AttendanceDetail[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

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
      filters.teamLeaderCode, filters.userCode])

  // Load data when filters change
  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      loadData()
    }
  }, [queryParams, filters.startDate, filters.endDate])

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.teamLeaderCode) params.append('teamLeaderCode', filters.teamLeaderCode)
      if (filters.fieldUserRole) params.append('role', filters.fieldUserRole)
      if (filters.userCode) params.append('userCode', filters.userCode)
      if (filters.regionCode) params.append('regionCode', filters.regionCode)

      const response = await fetch(`/api/user-attendance-summary?${params}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
        setStats(data.stats || {})
      }
    } catch (error) {
      console.error('Error loading attendance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUserDetails = async (user: UserSummary) => {
    setSelectedUser(user)
    setDialogOpen(true)
    setLoadingDetails(true)
    
    try {
      const params = new URLSearchParams()
      params.append('userCode', user.userCode)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const response = await fetch(`/api/user-attendance-details?${params}`)
      if (response.ok) {
        const data = await response.json()
        setUserDetails(data.attendance || [])
      }
    } catch (error) {
      console.error('Error loading user details:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.teamLeaderCode) params.append('teamLeaderCode', filters.teamLeaderCode)
    if (filters.fieldUserRole) params.append('role', filters.fieldUserRole)
    if (filters.userCode) params.append('userCode', filters.userCode)
    
    window.location.href = `/api/attendance/export?${params.toString()}`
  }

  const handleExportUserDetails = () => {
    if (!selectedUser || !userDetails.length) return

    // Prepare data for Excel export - only essential columns
    const excelData = userDetails.map(detail => ({
      'Date': formatDate(detail.attendanceDate),
      'TL Code': detail.tlCode || '-',
      'TL Name': detail.tlName || '-',
      'Username': detail.userName,
      'User Code': detail.userCode,
      'Start Time': formatTime(detail.journeyStartTime),
      'End Time': formatTime(detail.journeyEndTime),
      'Working Hours': formatMinutesToHours(detail.totalWorkingMinutes),
      'Attendance Status': detail.holidayName ? 'Holiday' : detail.leaveType ? 'Leave' : detail.attendanceStatus
    }))

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 10 }, // TL Code
      { wch: 20 }, // TL Name
      { wch: 20 }, // Username
      { wch: 12 }, // User Code
      { wch: 12 }, // Start Time
      { wch: 12 }, // End Time
      { wch: 15 }, // Working Hours
      { wch: 15 }  // Attendance Status
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Details')

    // Generate filename
    const fileName = `${selectedUser.userName}_${selectedUser.userCode}_Attendance_${filters.startDate}_to_${filters.endDate}.xlsx`

    // Download file
    XLSX.writeFile(wb, fileName)
  }

  const formatMinutesToHours = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0h 0m'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const formatTime = (dateTime: string | null) => {
    if (!dateTime) return '-'
    try {
      const date = new Date(dateTime)
      if (isNaN(date.getTime()) || date.getFullYear() < 2000) return '-'
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    } catch {
      return '-'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    } catch {
      return dateString
    }
  }

  // Get company working days from API stats
  const companyWorkingDays = stats?.companyWorkingDays || 0
  const totalDaysInRange = stats?.totalDaysInRange || 0

  // Pie chart colors
  const COLORS = {
    present: '#10b981',
    absent: '#ef4444',
    leave: '#f97316',
    holiday: '#8b5cf6',
    weekoff: '#6366f1'
  }

  // Summary visualization data - SHOW ALL statuses including weekoff
  const summaryChartData = useMemo(() => {
    if (!stats) return []
    
    // Always show all categories, even if zero (important for completeness)
    const allData = [
      { name: 'Present', value: stats.totalPresentDays || 0, color: COLORS.present },
      { name: 'Absent', value: stats.totalAbsentDays || 0, color: COLORS.absent },
      { name: 'Leave', value: stats.totalLeaveDays || 0, color: COLORS.leave },
      { name: 'Holiday', value: stats.totalHolidayDays || 0, color: COLORS.holiday },
      { name: 'Weekoff', value: stats.totalWeekoffDays || 0, color: COLORS.weekoff }
    ]
    
    // Only filter out if value is 0 AND it's not a significant category
    // But always show Present and Absent since they're primary
    return allData.filter(item => item.value > 0 || item.name === 'Present' || item.name === 'Absent')
  }, [stats])

  // User-specific pie chart data
  const getUserPieData = (user: UserSummary) => [
    { name: 'Present', value: user.presentDays, color: COLORS.present },
    { name: 'Absent', value: user.absentDays, color: COLORS.absent },
    { name: 'Leave', value: user.leaveDays, color: COLORS.leave },
    { name: 'Holiday', value: user.holidayDays, color: COLORS.holiday },
    { name: 'Weekoff', value: user.weekoffDays, color: COLORS.weekoff }
  ].filter(item => item.value > 0)

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              User Journey Attendance Reports
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Field user attendance tracking with day-wise journey details
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Dashboard Filters - Same as Store User Visit Report */}
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

      {/* Loading State */}
      {loading && <LoadingBar message="Loading attendance data..." />}

      {/* Summary Cards - Clear and Accurate */}
      {!loading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-blue-50 p-2 text-blue-600">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mr-10">Total Field Users</p>
                <InfoTooltip content="Number of distinct field users who have attendance records in the selected date range" />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{stats.totalUsers || 0}</p>
              <p className="mt-1 text-xs text-gray-500 ml-2">Users with attendance</p>

            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-purple-50 p-2 text-purple-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mr-10">Total Days in Period</p>
                <InfoTooltip content={`Full calendar days from ${formatDate(filters.startDate || '')} to ${formatDate(filters.endDate || '')}. Includes all days: weekdays, weekends, and holidays.`} />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{totalDaysInRange}</p>
              <p className="mt-1 text-xs text-gray-500 ml-2">{companyWorkingDays} weekdays, {totalDaysInRange - companyWorkingDays} weekends</p>

            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-emerald-50 p-2 text-emerald-600">
                  <UserCheck className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mr-10">Total Present Days</p>
                <InfoTooltip content="Total count of days when users marked attendance as Present across all users. Each user-day counted separately." />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{stats.totalPresentDays || 0}</p>
              <p className="mt-1 text-xs text-gray-500 ml-2">Out of {(stats.totalPresentDays || 0) + (stats.totalAbsentDays || 0)} working days</p>

            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-orange-50 p-2 text-orange-600">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mr-10">Total Working Hours</p>
                <InfoTooltip content="Sum of all hours worked by all field users combined during the selected period. Calculated from journey start and end times." />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{stats.totalWorkingHours || 0}h</p>
              <p className="mt-1 text-xs text-gray-500 ml-2">Avg: {stats.totalUsers > 0 ? Math.round(stats.totalWorkingHours / stats.totalUsers) : 0}h per user</p>

            </div>
          </div>
        </div>
      )}

      {/* Visualization Charts */}
      {!loading && summaryChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Overall Attendance Distribution
                    <InfoTooltip content="Complete breakdown of all attendance days by status: Present, Absent, Leave, Holiday, and Weekoff. Shows the total count of days and percentage for each type across all users in the selected date range." />
                  </CardTitle>
                  <CardDescription>
                    Total Days: {summaryChartData.reduce((sum, item) => sum + item.value, 0)} • 
                    Period: {formatDate(filters.startDate || '')} to {formatDate(filters.endDate || '')} • 
                    {summaryChartData.length} Status Categories
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={summaryChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={60}
                    label={({name, value, percent}: any) => {
                      return `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                    }}
                    labelLine={true}
                  >
                    {summaryChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        const total = summaryChartData.reduce((sum, item) => sum + item.value, 0)
                        const percentage = ((data.value / total) * 100).toFixed(2)
                        
                        return (
                          <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg">
                            <p className="font-semibold text-lg mb-2" style={{ color: data.color }}>
                              {data.name}
                            </p>
                            <div className="space-y-1 text-sm">
                              <p className="flex justify-between gap-4">
                                <span className="text-gray-600">Total Days:</span>
                                <span className="font-semibold">{data.value} days</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-gray-600">Percentage:</span>
                                <span className="font-semibold">{percentage}%</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-gray-600">Out of Total:</span>
                                <span className="font-semibold">{total} days</span>
                              </p>
                              <div className="pt-2 mt-2 border-t border-gray-200">
                                <p className="text-xs text-gray-500 italic">
                                  {data.name === 'Present' && 'Days when users were marked present and working'}
                                  {data.name === 'Absent' && 'Days when users were absent without leave or holiday'}
                                  {data.name === 'Leave' && 'Days when users were on approved leave (sick leave, casual leave, etc.)'}
                                  {data.name === 'Holiday' && 'Public holidays or company-declared holidays when no work is expected'}
                                  {data.name === 'Weekoff' && 'Weekends (Saturday/Sunday) or scheduled days off when no attendance is recorded'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string, entry: any) => {
                      const item = summaryChartData.find(d => d.name === value)
                      if (item) {
                        const total = summaryChartData.reduce((sum, d) => sum + d.value, 0)
                        const percentage = ((item.value / total) * 100).toFixed(1)
                        return `${value}: ${item.value} days (${percentage}%)`
                      }
                      return value
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Summary Stats Below Chart */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t">
                {summaryChartData.map((item, idx) => (
                  <div key={idx} className="text-center p-2 rounded-lg" style={{ backgroundColor: `${item.color}15` }}>
                    <div className="text-xs text-gray-600 mb-1">{item.name}</div>
                    <div className="text-lg font-bold" style={{ color: item.color }}>
                      {item.value}
                    </div>
                    <div className="text-xs text-gray-500">
                      {((item.value / summaryChartData.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Users by Role
                    <InfoTooltip content="Distribution of field users across different roles. Shows the number of users in each role category who have attendance records in the selected period." />
                  </CardTitle>
                  <CardDescription>
                    Total Users: {filterOptions.fieldUserRoles.reduce((sum: number, r: any) => sum + (r.userCount || 0), 0)} • 
                    {filterOptions.fieldUserRoles.length} Role Categories
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart 
                  data={filterOptions.fieldUserRoles.map((r: any) => ({
                    name: r.label,
                    users: r.userCount || 0,
                    fullData: r
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    label={{ value: 'Number of Users', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        const totalUsers = filterOptions.fieldUserRoles.reduce((sum: number, r: any) => sum + (r.userCount || 0), 0)
                        const percentage = ((data.users / totalUsers) * 100).toFixed(1)
                        
                        return (
                          <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg">
                            <p className="font-semibold text-lg mb-2 text-blue-600">
                              {data.name}
                            </p>
                            <div className="space-y-1 text-sm">
                              <p className="flex justify-between gap-4">
                                <span className="text-gray-600">User Count:</span>
                                <span className="font-semibold">{data.users} users</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-gray-600">Percentage:</span>
                                <span className="font-semibold">{percentage}%</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-gray-600">Out of Total:</span>
                                <span className="font-semibold">{totalUsers} users</span>
                              </p>
                              <div className="pt-2 mt-2 border-t border-gray-200">
                                <p className="text-xs text-gray-500 italic">
                                  Number of field users with this role who have attendance records in the selected date range
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar 
                    dataKey="users" 
                    fill="#3b82f6"
                    radius={[8, 8, 0, 0]}
                    label={{ 
                      position: 'top',
                      content: (props: any) => {
                        const { x, y, width, value } = props
                        return (
                          <text 
                            x={x + width / 2} 
                            y={y - 5} 
                            fill="#1e40af" 
                            textAnchor="middle" 
                            fontSize={12}
                            fontWeight="bold"
                          >
                            {value}
                          </text>
                        )
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
              
              {/* Role Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t">
                {filterOptions.fieldUserRoles.map((role: any, idx: number) => {
                  const totalUsers = filterOptions.fieldUserRoles.reduce((sum: number, r: any) => sum + (r.userCount || 0), 0)
                  const percentage = totalUsers > 0 ? ((role.userCount / totalUsers) * 100).toFixed(1) : '0'
                  return (
                    <div key={idx} className="text-center p-2 rounded-lg bg-blue-50">
                      <div className="text-xs text-gray-600 mb-1">{role.label}</div>
                      <div className="text-lg font-bold text-blue-600">
                        {role.userCount || 0}
                      </div>
                      <div className="text-xs text-gray-500">
                        {percentage}% of total
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Table with Sticky Headers */}
      {!loading && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>User Attendance Summary</CardTitle>
                <CardDescription>
                  Showing {users.length} users for {formatDate(filters.startDate || '')} to {formatDate(filters.endDate || '')} • Click any row to view detailed attendance
                </CardDescription>
              </div>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export Excel</span>
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>User Code</TableHead>
                    <TableHead>TL Code</TableHead>
                    <TableHead>TL Name</TableHead>

                    <TableHead className="text-center">
                      <div>Total Days</div>
                      <div className="text-xs font-normal text-gray-500">(Date Range)</div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div>Actual Working</div>
                      <div className="text-xs font-normal text-gray-500">(Present Days)</div>
                    </TableHead>
                    <TableHead className="text-center">Leaves</TableHead>
                    <TableHead className="text-center">Holiday</TableHead>
                    <TableHead className="text-center">Weekoff</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Total Working Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow 
                      key={user.userCode}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => loadUserDetails(user)}
                    >
                      <TableCell>
                        <div className="font-medium">{user.userName}</div>
                      </TableCell>
                      <TableCell>{user.userCode}</TableCell>
                      <TableCell>{user.tlCode || '-'}</TableCell>
                      <TableCell>{user.tlName || '-'}</TableCell>
                      <TableCell className="text-center font-medium">{user.totalDays}</TableCell>
                      <TableCell className="text-center text-emerald-700 font-semibold">
                        {user.presentDays}
                      </TableCell>
                      <TableCell className="text-center text-orange-700">{user.leaveDays}</TableCell>
                      <TableCell className="text-center text-purple-700">{user.holidayDays}</TableCell>
                      <TableCell className="text-center text-blue-700">{user.weekoffDays}</TableCell>
                      <TableCell className="text-center text-red-700">{user.absentDays}</TableCell>
                      <TableCell className="text-center font-mono">
                        {formatMinutesToHours(user.totalWorkingMinutes)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-gray-500 py-8">
                        No users found matching your criteria
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Details Dialog */}
      {dialogOpen && selectedUser && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => {
              setDialogOpen(false)
              setSelectedUser(null)
              setUserDetails([])
            }}
          />
          
          {/* Dialog - Larger Size */}
          <div className="fixed inset-2 md:inset-4 lg:inset-8 bg-white rounded-lg shadow-2xl z-50 flex flex-col max-h-[96vh] overflow-hidden">
            {/* Header with Profile */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  {selectedUser.profilePic ? (
                    <img 
                      src={selectedUser.profilePic} 
                      alt={selectedUser.userName}
                      className="w-16 h-16 rounded-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center text-xl font-bold text-white">
                      {selectedUser.userName?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                      {selectedUser.userName} ({selectedUser.userCode})
                    </h2>
                    <p className="text-sm text-gray-600">
                      Team Leader: {selectedUser.tlName} ({selectedUser.tlCode})
                    </p>
                    <p className="text-sm text-gray-600">
                      Period: {formatDate(filters.startDate || '')} to {formatDate(filters.endDate || '')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportUserDetails}
                    disabled={loadingDetails || userDetails.length === 0}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export day-wise attendance details for this user"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Export Excel</span>
                  </button>
                  <button
                    onClick={() => {
                      setDialogOpen(false)
                      setSelectedUser(null)
                      setUserDetails([])
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>

            {/* Pie Chart for User */}
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold mb-4">Attendance Breakdown</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={getUserPieData(selectedUser)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({name, value}) => `${name}: ${value}`}
                  >
                    {getUserPieData(selectedUser).map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Details Table */}
            <div className="flex-1 overflow-auto p-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500">Loading attendance details...</div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>TL Code</TableHead>
                      <TableHead>TL Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>User Code</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead>Attendance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userDetails.map((detail, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{formatDate(detail.attendanceDate)}</TableCell>
                        <TableCell>{detail.tlCode || '-'}</TableCell>
                        <TableCell>{detail.tlName || '-'}</TableCell>
                        <TableCell>{detail.userName}</TableCell>
                        <TableCell>{detail.userCode}</TableCell>
                        <TableCell>{formatTime(detail.journeyStartTime)}</TableCell>
                        <TableCell>{formatTime(detail.journeyEndTime)}</TableCell>
                        <TableCell>
                          {detail.holidayName ? (
                            <Badge className="bg-purple-600">Holiday</Badge>
                          ) : detail.leaveType ? (
                            <Badge className="bg-orange-600">Leave</Badge>
                          ) : detail.attendanceStatus === 'Present' ? (
                            <Badge className="bg-emerald-600">Present</Badge>
                          ) : detail.attendanceStatus === 'Absent' ? (
                            <Badge variant="destructive">Absent</Badge>
                          ) : (
                            <Badge variant="secondary">{detail.attendanceStatus}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default UserWiseJourneyAttendance
