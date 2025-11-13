'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { businessColors } from '@/styles/businessColors'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { RefreshCw, Users, Clock, TrendingUp, UserCheck, ChevronDown, MapPin, DollarSign, Maximize, Minimize } from 'lucide-react'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import { MultiSelectFilter } from '@/components/shared/MultiSelectFilter'
import { ExportExcelButton } from '@/components/shared/ExportExcelButton'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { LoadingBar } from '@/components/ui/LoadingBar'

export const UserAttendanceReport: React.FC = () => {
  const [filterRole, setFilterRole] = useState('all')
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [filterUser, setFilterUser] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1) // First day of current month
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [viewMode, setViewMode] = useState('summary') // summary, detailed, weekly, monthly
  const [loading, setLoading] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Attendance analytics data
  const [attendanceData, setAttendanceData] = useState<any[]>([])
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  // Load data
  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  const handleDateRangeChange = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
  }

  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams()
      queryParams.append('startDate', startDate)
      queryParams.append('endDate', endDate)
      if (filterRole !== 'all') queryParams.append('role', filterRole)
      if (filterUser !== 'all') queryParams.append('userCode', filterUser)
      window.location.href = `/api/attendance/export?${queryParams.toString()}`
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams()
      queryParams.append('startDate', startDate)
      queryParams.append('endDate', endDate)

      const [analyticsRes, weeklyRes, monthlyRes, usersRes] = await Promise.all([
        fetch(`/api/attendance/analytics?${queryParams.toString()}`),
        fetch(`/api/attendance/weekly?${queryParams.toString()}`),
        fetch(`/api/attendance/monthly?${queryParams.toString()}`),
        fetch('/api/attendance/users')
      ])

      const [analytics, weekly, monthly, allUsers] = await Promise.all([
        analyticsRes.json(),
        weeklyRes.json(),
        monthlyRes.json(),
        usersRes.json()
      ])

      setAttendanceData(analytics)
      setWeeklyData(weekly)
      setMonthlyData(monthly)
      setUsers(allUsers)
    } catch (error) {
      console.error('Error loading attendance data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get unique roles and departments
  const roles = useMemo(() => {
    const uniqueRoles = new Set(users.map(u => u.role))
    return Array.from(uniqueRoles)
  }, [users])

  const departments = useMemo(() => {
    const uniqueDepts = new Set(users.map(u => u.department))
    return Array.from(uniqueDepts)
  }, [users])

  // Filter users
  const filteredUsers = useMemo(() => {
    let filtered = attendanceData

    if (filterRole !== 'all') {
      filtered = filtered.filter(u => u.role === filterRole)
    }

    if (filterDepartment !== 'all') {
      filtered = filtered.filter(u => u.department === filterDepartment)
    }

    if (filterUser !== 'all') {
      filtered = filtered.filter(u => u.userCode === filterUser)
    }

    if (searchQuery) {
      filtered = filtered.filter(u =>
        u.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.userCode.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }, [attendanceData, filterRole, filterDepartment, filterUser, searchQuery])

  // Calculate overall metrics
  const overallMetrics = useMemo(() => {
    if (filteredUsers.length === 0) return {
      totalUsers: 0,
      avgAttendance: 0,
      totalWorkingHours: 0,
      totalProductiveHours: 0,
      totalFieldHours: 0,
      totalCustomerVisits: 0,
      totalSalesAmount: 0,
      avgEfficiency: 0,
      totalPresentDays: 0,
      totalAbsentDays: 0,
      totalLeaveDays: 0,
      totalOvertimeHours: 0
    }

    return {
      totalUsers: filteredUsers.length,
      avgAttendance: filteredUsers.reduce((sum, u) => sum + (u.attendancePercentage || 0), 0) / filteredUsers.length,
      totalWorkingHours: filteredUsers.reduce((sum, u) => sum + (u.totalWorkingHours || 0), 0),
      totalProductiveHours: filteredUsers.reduce((sum, u) => sum + (u.totalProductiveHours || 0), 0),
      totalFieldHours: filteredUsers.reduce((sum, u) => sum + (u.totalFieldHours || 0), 0),
      totalCustomerVisits: filteredUsers.reduce((sum, u) => sum + (u.totalCustomerVisits || 0), 0),
      totalSalesAmount: filteredUsers.reduce((sum, u) => sum + (u.totalSalesAmount || 0), 0),
      avgEfficiency: filteredUsers.reduce((sum, u) => sum + (u.avgEfficiency || 0), 0) / filteredUsers.length,
      totalPresentDays: filteredUsers.reduce((sum, u) => sum + (u.presentDays || 0), 0),
      totalAbsentDays: filteredUsers.reduce((sum, u) => sum + (u.absentDays || 0), 0),
      totalLeaveDays: filteredUsers.reduce((sum, u) => sum + (u.leaveDays || 0), 0),
      totalOvertimeHours: filteredUsers.reduce((sum, u) => sum + (u.totalOvertimeHours || 0), 0)
    }
  }, [filteredUsers])

  // Attendance status badge
  const getStatusBadge = (percentage: number) => {
    if (percentage >= 95) return <Badge variant="default" className="bg-emerald-600">Excellent</Badge>
    if (percentage >= 85) return <Badge variant="default" className="bg-sky-600">Good</Badge>
    if (percentage >= 75) return <Badge variant="default" className="bg-amber-600">Average</Badge>
    return <Badge variant="destructive">Poor</Badge>
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-white p-6 space-y-6 overflow-y-auto" : "min-h-screen bg-slate-50 p-4 md:p-6"}>
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              User Attendance Report
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Comprehensive attendance tracking with working hours and productivity metrics
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadData} disabled={loading} variant="outline" size="sm" className="sm:size-default">
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              onClick={() => setIsFullscreen(!isFullscreen)}
              variant="outline"
              size="sm"
              className="sm:size-default"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
            <ExportExcelButton onClick={handleExport} mobileFloating />
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="cursor-pointer md:cursor-default hover:bg-slate-50 transition-colors"
        >
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Filters</CardTitle>
            <ChevronDown className={`h-5 w-5 text-slate-500 md:hidden transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
          </div>
        </CardHeader>
        <CardContent className={`${filtersOpen ? 'block' : 'hidden'} md:block pt-4`}>
          <div className="space-y-4">
            {/* Date Range */}
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={handleDateRangeChange}
              label="Date Range"
            />

            {/* Search Box */}
            <div>
              <Label className="text-sm font-medium text-slate-700">Search User</Label>
              <Input
                placeholder="Search by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mt-2"
              />
            </div>

            {/* Other Filters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MultiSelectFilter
                label="Role"
                value={filterRole}
                options={[
                  { value: 'Team Leader', label: 'Team Leader' },
                  { value: 'Assistant Team Leader', label: 'Assistant Team Leader' },
                  { value: 'Sales Executive', label: 'Sales Executive' },
                  { value: 'Operations Executive', label: 'Operations Executive' },
                  { value: 'HR Manager', label: 'HR Manager' },
                  { value: 'Finance Manager', label: 'Finance Manager' }
                ]}
                onChange={setFilterRole}
                showCodes={false}
              />

              <MultiSelectFilter
                label="Department"
                value={filterDepartment}
                options={departments.map(dept => ({ value: dept, label: dept }))}
                onChange={setFilterDepartment}
                showCodes={false}
              />

              <MultiSelectFilter
                label="View Mode"
                value={viewMode}
                options={[
                  { value: 'summary', label: 'Summary View' },
                  { value: 'detailed', label: 'Detailed View' },
                  { value: 'weekly', label: 'Weekly Trend' },
                  { value: 'monthly', label: 'Monthly Trend' }
                ]}
                onChange={setViewMode}
                showCodes={false}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <LoadingBar message="Loading attendance data..." />
      )}

      {/* Key Metrics */}
      {!loading && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <InfoTooltip content="Total number of active employees in the system for the selected date range. This includes all roles and departments that have attendance records during this period." />
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMetrics.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Active employees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
              <InfoTooltip content="Average attendance percentage across all users in the selected period. Calculated as (Total Present Days ÷ Total Expected Working Days) × 100. Shows breakdown of present vs absent days to assess workforce reliability and punctuality." />
            </div>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMetrics.avgAttendance.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {overallMetrics.totalPresentDays} present / {overallMetrics.totalAbsentDays} absent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Working Hours</CardTitle>
              <InfoTooltip content="Total working hours logged by all employees during the period. Productive Hours represent time spent on billable or value-generating activities excluding breaks, idle time, and administrative tasks. Helps measure workforce utilization." />
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMetrics.totalWorkingHours.toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">
              {overallMetrics.totalProductiveHours.toFixed(0)}h productive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Field Hours</CardTitle>
              <InfoTooltip content="Total hours spent by field personnel on-site at customer locations, stores, or external venues. Customer Visits shows the number of unique client/store interactions. Measures field team engagement and customer-facing time investment." />
            </div>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMetrics.totalFieldHours.toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">
              {overallMetrics.totalCustomerVisits} customer visits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <InfoTooltip content="Total revenue generated from field operations during the selected period. This represents sales attributed to field users' customer visits and activities. Links attendance and field presence to actual business outcomes and revenue generation." />
            </div>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">AED {(overallMetrics.totalSalesAmount / 1000).toFixed(1)}K</div>
            <p className="text-xs text-muted-foreground">
              From field operations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Avg Efficiency</CardTitle>
              <InfoTooltip content="Average employee efficiency percentage calculated as (Productive Hours ÷ Total Working Hours) × 100. Shows how effectively employees are utilizing their time. Overtime Hours indicates extra hours worked beyond standard schedules, impacting both productivity and operational costs." />
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallMetrics.avgEfficiency.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {overallMetrics.totalOvertimeHours.toFixed(0)}h overtime
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Charts */}
      {!loading && viewMode === 'weekly' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Weekly Attendance Trend</CardTitle>
            <CardDescription>Weekly attendance and working hours</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="weekStart"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="totalPresent" stroke={businessColors.success.main} name="Present" />
                <Line type="monotone" dataKey="totalAbsent" stroke={businessColors.error.main} name="Absent" />
                <Line type="monotone" dataKey="totalLeave" stroke={businessColors.warning.main} name="Leave" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {!loading && viewMode === 'monthly' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Monthly Attendance Trend</CardTitle>
            <CardDescription>Monthly working hours and productivity</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalWorkingHours" fill={businessColors.primary[600]} name="Working Hours" />
                <Bar dataKey="totalProductiveHours" fill={businessColors.success.main} name="Productive Hours" />
                <Bar dataKey="totalOvertimeHours" fill={businessColors.warning.main} name="Overtime" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* User Details Table */}
      {!loading && (
      <Card>
        <CardHeader>
          <CardTitle>
            {viewMode === 'detailed' ? 'Detailed Attendance Records' : 'User Attendance Summary'}
          </CardTitle>
          <CardDescription>
            Showing {filteredUsers.length} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={isFullscreen ? "overflow-x-auto max-h-[calc(100vh-250px)] relative" : "overflow-x-auto max-h-[600px] relative"}>
            <Table>
              <TableHeader className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Attendance %</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Leaves</TableHead>
                  {viewMode === 'detailed' && (
                    <>
                      <TableHead>Working Hrs</TableHead>
                      <TableHead>Productive Hrs</TableHead>
                      <TableHead>Field Hrs</TableHead>
                      <TableHead>Visits</TableHead>
                      <TableHead>Sales</TableHead>
                      <TableHead>Efficiency %</TableHead>
                    </>
                  )}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.userCode}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.userName}</div>
                        <div className="text-xs text-gray-500">{user.userCode}</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.department}</TableCell>
                    <TableCell>
                      <div className="font-semibold">{user.attendancePercentage.toFixed(1)}%</div>
                    </TableCell>
                    <TableCell>{user.presentDays}</TableCell>
                    <TableCell>{user.absentDays}</TableCell>
                    <TableCell>{user.leaveDays}</TableCell>
                    {viewMode === 'detailed' && (
                      <>
                        <TableCell>{user.totalWorkingHours.toFixed(1)}h</TableCell>
                        <TableCell>{user.totalProductiveHours.toFixed(1)}h</TableCell>
                        <TableCell>{user.totalFieldHours.toFixed(1)}h</TableCell>
                        <TableCell>{user.totalCustomerVisits}</TableCell>
                        <TableCell>AED {user.totalSalesAmount.toFixed(0)}</TableCell>
                        <TableCell>{user.avgEfficiency.toFixed(1)}%</TableCell>
                      </>
                    )}
                    <TableCell>{getStatusBadge(user.attendancePercentage)}</TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={viewMode === 'detailed' ? 14 : 9} className="text-center text-gray-500">
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
    </div>
  )
}

export default UserAttendanceReport
