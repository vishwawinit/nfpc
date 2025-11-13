// Attendance Service - Database version using flat_attendance_daily
// Provides data access functions that query PostgreSQL flat_attendance_daily table

import { query, queryOne, queryAll } from '../lib/database'

// Helper function to parse date range string
const getDateRangeFromString = (dateRange: string, currentDate: string = new Date().toISOString().split('T')[0]) => {
  const current = new Date(currentDate)
  let startDate: Date
  let endDate: Date = new Date(current)

  switch(dateRange) {
    case 'today':
      startDate = new Date(current)
      endDate = new Date(current)
      break
    case 'yesterday':
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 1)
      endDate = new Date(startDate)
      break
    case 'thisWeek':
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 6)
      break
    case 'lastWeek':
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 13)
      endDate = new Date(current)
      endDate.setDate(endDate.getDate() - 7)
      break
    case 'thisMonth':
      startDate = new Date(current.getFullYear(), current.getMonth(), 1)
      break
    case 'lastMonth':
      startDate = new Date(current.getFullYear(), current.getMonth() - 1, 1)
      endDate = new Date(current.getFullYear(), current.getMonth(), 0)
      break
    case 'thisQuarter':
      const currentQuarter = Math.floor(current.getMonth() / 3)
      startDate = new Date(current.getFullYear(), currentQuarter * 3, 1)
      break
    case 'lastQuarter':
      const lastQuarter = Math.floor(current.getMonth() / 3) - 1
      startDate = new Date(current.getFullYear(), lastQuarter * 3, 1)
      endDate = new Date(current.getFullYear(), (lastQuarter + 1) * 3, 0)
      break
    case 'thisYear':
      startDate = new Date(current.getFullYear(), 0, 1)
      break
    case 'last30Days':
    case 'last30days':
    default:
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 29)
  }

  return { startDate, endDate }
}

/**
 * Get all users from flat_attendance_daily
 */
export const getUsers = async () => {
  const result = await query(`
    SELECT DISTINCT
      user_code as "userCode",
      user_name as "userName",
      user_role as role,
      user_role as department
    FROM flat_attendance_daily
    WHERE user_code IS NOT NULL AND user_name IS NOT NULL
    ORDER BY user_name
  `)
  return result.rows
}

/**
 * Get attendance records with filters
 */
export const getAttendance = async (filters: any = {}) => {
  let sql = `
    SELECT
      attendance_date as date,
      user_code as "userCode",
      user_name as "userName",
      user_role as role,
      user_role as department,
      attendance_status as status,
      leave_type as "leaveType",
      journey_start_time as "checkIn",
      journey_end_time as "checkOut",
      total_working_hours as "workingHours",
      CONCAT(start_latitude, ',', start_longitude) as location,
      remarks
    FROM flat_attendance_daily
    WHERE 1=1
  `
  const params: any[] = []
  let paramCount = 1

  // Filter by date range
  if (filters.startDate && filters.endDate) {
    sql += ` AND attendance_date >= $${paramCount} AND attendance_date <= $${paramCount + 1}`
    params.push(filters.startDate, filters.endDate)
    paramCount += 2
  }

  // Filter by user
  if (filters.userCode) {
    sql += ` AND user_code = $${paramCount}`
    params.push(filters.userCode)
    paramCount++
  }

  // Filter by role
  if (filters.role && filters.role !== 'all') {
    sql += ` AND user_role = $${paramCount}`
    params.push(filters.role)
    paramCount++
  }

  // Filter by status
  if (filters.status && filters.status !== 'all') {
    sql += ` AND attendance_status = $${paramCount}`
    params.push(filters.status)
    paramCount++
  }

  sql += ` ORDER BY attendance_date DESC, user_name`

  const result = await query(sql, params)
  return result.rows
}

/**
 * Get attendance summary for a user
 */
export const getUserAttendanceSummary = async (userCode: string, filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : getDateRangeFromString('thisMonth')

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  const result = await query(`
    SELECT
      COUNT(*) as total_days,
      COUNT(*) FILTER (WHERE attendance_status = 'Present') as present_days,
      COUNT(*) FILTER (WHERE attendance_status = 'Absent') as absent_days,
      COUNT(*) FILTER (WHERE leave_type IS NOT NULL) as leave_days,
      COALESCE(SUM(total_working_hours), 0) as total_working_hours,
      COALESCE(AVG(total_working_hours) FILTER (WHERE total_working_hours > 0), 0) as avg_working_hours
    FROM flat_attendance_daily
    WHERE user_code = $1 AND attendance_date >= $2 AND attendance_date <= $3
  `, [userCode, startDateStr, endDateStr])

  const stats = result.rows[0]
  const totalDays = parseInt(stats.total_days)
  const presentDays = parseInt(stats.present_days)
  const absentDays = parseInt(stats.absent_days)
  const leaveDays = parseInt(stats.leave_days)
  const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0

  return {
    userCode,
    totalDays,
    presentDays,
    absentDays,
    leaveDays,
    attendancePercentage,
    totalWorkingHours: parseFloat(stats.total_working_hours),
    totalProductiveHours: parseFloat(stats.total_working_hours), // Same as working hours
    totalFieldHours: 0, // Not available in flat table
    totalOfficeHours: 0, // Not available in flat table
    totalOvertimeHours: 0, // Not available in flat table
    totalCustomerVisits: 0, // Not available in flat table
    totalSalesAmount: 0, // Not available in flat table
    avgEfficiency: attendancePercentage, // Use attendance % as proxy
    avgWorkingHours: parseFloat(stats.avg_working_hours)
  }
}

/**
 * Get attendance analytics for all users
 */
export const getAttendanceAnalytics = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : getDateRangeFromString(filters.dateRange || 'thisMonth')

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  const result = await query(`
    SELECT
      user_code as "userCode",
      MAX(user_name) as "userName",
      MAX(user_role) as role,
      MAX(user_role) as department,
      COUNT(*) as total_days,
      COUNT(*) FILTER (WHERE attendance_status = 'Present') as present_days,
      COUNT(*) FILTER (WHERE attendance_status = 'Absent') as absent_days,
      COUNT(*) FILTER (WHERE leave_type IS NOT NULL) as leave_days,
      COALESCE(SUM(total_working_hours), 0) as total_working_hours,
      COALESCE(AVG(total_working_hours) FILTER (WHERE total_working_hours > 0), 0) as avg_working_hours,
      (COUNT(*) FILTER (WHERE attendance_status = 'Present')::float / NULLIF(COUNT(*), 0) * 100) as attendance_percentage
    FROM flat_attendance_daily
    WHERE attendance_date >= $1 AND attendance_date <= $2
    GROUP BY user_code
    ORDER BY attendance_percentage DESC
  `, [startDateStr, endDateStr])

  return result.rows.map((row: any) => ({
    userCode: row.userCode,
    userName: row.userName,
    role: row.role,
    department: row.department,
    totalDays: parseInt(row.total_days),
    presentDays: parseInt(row.present_days),
    absentDays: parseInt(row.absent_days),
    leaveDays: parseInt(row.leave_days),
    attendancePercentage: parseFloat(row.attendance_percentage || 0),
    totalWorkingHours: parseFloat(row.total_working_hours),
    totalProductiveHours: parseFloat(row.total_working_hours),
    totalFieldHours: 0,
    totalOfficeHours: 0,
    totalOvertimeHours: 0,
    totalCustomerVisits: 0,
    totalSalesAmount: 0,
    avgEfficiency: parseFloat(row.attendance_percentage || 0),
    avgWorkingHours: parseFloat(row.avg_working_hours || 0)
  }))
}

/**
 * Get weekly attendance summary
 */
export const getWeeklyAttendanceSummary = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : getDateRangeFromString(filters.dateRange || 'thisMonth')

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  const result = await query(`
    SELECT
      DATE_TRUNC('week', attendance_date) as week_start,
      COUNT(*) FILTER (WHERE attendance_status = 'Present') as total_present,
      COUNT(*) FILTER (WHERE attendance_status = 'Absent') as total_absent,
      COUNT(*) FILTER (WHERE leave_type IS NOT NULL) as total_leave,
      COUNT(*) as total_working,
      COALESCE(SUM(total_working_hours), 0) as total_working_hours,
      COALESCE(SUM(total_working_hours), 0) as total_productive_hours,
      0 as total_overtime_hours
    FROM flat_attendance_daily
    WHERE attendance_date >= $1 AND attendance_date <= $2
    GROUP BY DATE_TRUNC('week', attendance_date)
    ORDER BY week_start
  `, [startDateStr, endDateStr])

  return result.rows.map((row: any) => ({
    weekStart: row.week_start,
    totalPresent: parseInt(row.total_present),
    totalAbsent: parseInt(row.total_absent),
    totalLeave: parseInt(row.total_leave),
    totalWorking: parseInt(row.total_working),
    totalWorkingHours: parseFloat(row.total_working_hours),
    totalProductiveHours: parseFloat(row.total_productive_hours),
    totalOvertimeHours: 0
  }))
}

/**
 * Get monthly attendance summary
 */
export const getMonthlyAttendanceSummary = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : getDateRangeFromString(filters.dateRange || 'thisYear')

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  const result = await query(`
    SELECT
      TO_CHAR(attendance_date, 'YYYY-MM') as month,
      COUNT(*) FILTER (WHERE attendance_status = 'Present') as total_present,
      COUNT(*) FILTER (WHERE attendance_status = 'Absent') as total_absent,
      COUNT(*) FILTER (WHERE leave_type IS NOT NULL) as total_leave,
      COUNT(*) as total_working,
      COALESCE(SUM(total_working_hours), 0) as total_working_hours,
      COALESCE(SUM(total_working_hours), 0) as total_productive_hours,
      0 as total_overtime_hours,
      0 as total_sales_amount
    FROM flat_attendance_daily
    WHERE attendance_date >= $1 AND attendance_date <= $2
    GROUP BY TO_CHAR(attendance_date, 'YYYY-MM')
    ORDER BY month
  `, [startDateStr, endDateStr])

  return result.rows.map((row: any) => ({
    month: row.month,
    totalPresent: parseInt(row.total_present),
    totalAbsent: parseInt(row.total_absent),
    totalLeave: parseInt(row.total_leave),
    totalWorking: parseInt(row.total_working),
    totalWorkingHours: parseFloat(row.total_working_hours),
    totalProductiveHours: parseFloat(row.total_productive_hours),
    totalOvertimeHours: 0,
    totalSalesAmount: 0
  }))
}

export const attendanceService = {
  getUsers,
  getAttendance,
  getUserAttendanceSummary,
  getAttendanceAnalytics,
  getWeeklyAttendanceSummary,
  getMonthlyAttendanceSummary
}

export default attendanceService
