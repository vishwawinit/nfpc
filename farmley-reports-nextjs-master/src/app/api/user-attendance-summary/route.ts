import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const role = searchParams.get('role')
    const loginUserCode = searchParams.get('loginUserCode')

    // Validate required parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required parameters' },
        { status: 400 }
      )
    }

    // Get hierarchy-based allowed users
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }

    let whereClause = '1=1'
    const params: any[] = []
    let paramCount = 1

    if (startDate && endDate) {
      whereClause += ` AND attendance_date >= $${paramCount} AND attendance_date <= $${paramCount + 1}`
      params.push(startDate, endDate)
      paramCount += 2
    }

    if (role && role !== 'all') {
      whereClause += ` AND user_role = $${paramCount}`
      params.push(role)
      paramCount++
    }

    // Hierarchy filter - apply if allowedUserCodes is provided
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramCount + index}`).join(', ')
      whereClause += ` AND user_code IN (${placeholders})`
      params.push(...allowedUserCodes)
      paramCount += allowedUserCodes.length
    }

    // Simple query - determine presence based on valid journey_start_time
    const query = `
      SELECT
        user_code,
        MAX(user_name) as user_name,
        MAX(user_username) as user_username,
        MAX(user_role) as user_role,
        MAX(tl_code) as tl_code,
        MAX(tl_name) as tl_name,
        MAX(profile_pic) as profile_pic,
        COUNT(DISTINCT attendance_date) as records_count,
        -- Present: if journey_start_time is valid (not null and has valid year)
        COUNT(*) FILTER (WHERE journey_start_time IS NOT NULL AND EXTRACT(YEAR FROM journey_start_time) >= 2000) as present_days,
        -- Absent: no valid journey_start_time AND no leave AND no holiday
        COUNT(*) FILTER (WHERE (journey_start_time IS NULL OR EXTRACT(YEAR FROM journey_start_time) < 2000) AND leave_type IS NULL AND holiday_name IS NULL) as absent_days,
        COUNT(*) FILTER (WHERE leave_type IS NOT NULL) as leave_days,
        COUNT(*) FILTER (WHERE holiday_name IS NOT NULL) as holiday_days,
        -- Attendance percentage based on valid journey start time
        ROUND((COUNT(*) FILTER (WHERE journey_start_time IS NOT NULL AND EXTRACT(YEAR FROM journey_start_time) >= 2000)::numeric / NULLIF(COUNT(*), 0) * 100), 2) as attendance_percentage,
        -- Calculate working minutes from timestamps, ignore bad data
        COALESCE(SUM(
          CASE 
            WHEN journey_start_time IS NOT NULL 
                 AND journey_end_time IS NOT NULL
                 AND EXTRACT(YEAR FROM journey_end_time) >= 2000
                 AND journey_end_time > journey_start_time
            THEN EXTRACT(EPOCH FROM (journey_end_time - journey_start_time))/60
            ELSE 0
          END
        ), 0) as total_working_minutes,
        COALESCE(ROUND(AVG(
          CASE 
            WHEN journey_start_time IS NOT NULL 
                 AND journey_end_time IS NOT NULL
                 AND EXTRACT(YEAR FROM journey_end_time) >= 2000
                 AND journey_end_time > journey_start_time
            THEN EXTRACT(EPOCH FROM (journey_end_time - journey_start_time))/60
            ELSE NULL
          END
        ), 2), 0) as avg_working_minutes,
        COUNT(*) FILTER (WHERE journey_start_time IS NOT NULL) as journey_days,
        MIN(attendance_date) as first_attendance_date,
        MAX(attendance_date) as last_attendance_date
      FROM flat_attendance_daily f
      WHERE ${whereClause}
      GROUP BY user_code
      ORDER BY attendance_percentage DESC, user_name
    `

    const result = await db.query(query, params)

    // Calculate total days in date range
    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalDaysInRange = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    
    // Calculate weekends in range
    let weekendDays = 0
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay()
      if (day === 0 || day === 6) weekendDays++
    }

    const summaryData = result.rows.map((row: any) => {
      const presentDays = parseInt(row.present_days || 0)
      const absentDays = parseInt(row.absent_days || 0)
      const leaveDays = parseInt(row.leave_days || 0)
      const holidayDays = parseInt(row.holiday_days || 0)
      const recordsCount = parseInt(row.records_count || 0)
      
      // Weekoff = Total days - all other days (Present + Absent + Leave + Holiday)
      // If database doesn't have records for weekends, they will be counted as weekoff
      const weekoffDays = totalDaysInRange - presentDays - absentDays - leaveDays - holidayDays
      
      return {
        userCode: row.user_code,
        userName: row.user_name || 'Unknown User',
        userUsername: row.user_username,
        userRole: row.user_role || 'N/A',
        tlCode: row.tl_code,
        tlName: row.tl_name,
        profilePic: row.profile_pic,
        totalDays: totalDaysInRange,
        presentDays: presentDays,
        absentDays: absentDays,
        leaveDays: leaveDays,
        holidayDays: holidayDays,
        weekoffDays: Math.max(0, weekoffDays), // Ensure non-negative
        attendancePercentage: parseFloat(row.attendance_percentage || 0),
        totalWorkingMinutes: parseInt(row.total_working_minutes || 0),
        avgWorkingMinutes: parseFloat(row.avg_working_minutes || 0),
        journeyDays: parseInt(row.journey_days || 0),
        actualWorkingDays: presentDays, // Actual working days is present days
        firstAttendanceDate: row.first_attendance_date,
        lastAttendanceDate: row.last_attendance_date
      }
    })

    // Calculate overall stats
    const stats = {
      totalUsers: summaryData.length,
      totalDaysInRange: totalDaysInRange,
      companyWorkingDays: totalDaysInRange - weekendDays,
      avgAttendancePercentage: summaryData.length > 0
        ? (summaryData.reduce((sum, u) => sum + u.attendancePercentage, 0) / summaryData.length).toFixed(2)
        : 0,
      totalPresentDays: summaryData.reduce((sum, u) => sum + u.presentDays, 0),
      totalAbsentDays: summaryData.reduce((sum, u) => sum + u.absentDays, 0),
      totalLeaveDays: summaryData.reduce((sum, u) => sum + u.leaveDays, 0),
      totalHolidayDays: summaryData.reduce((sum, u) => sum + u.holidayDays, 0),
      totalWeekoffDays: summaryData.reduce((sum, u) => sum + u.weekoffDays, 0),
      totalWorkingHours: Math.round(summaryData.reduce((sum, u) => sum + u.totalWorkingMinutes, 0) / 60)
    }

    return NextResponse.json({
      users: summaryData,
      stats
    })
  } catch (error) {
    console.error('Error fetching user attendance summary:', error)
    
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch attendance summary', 
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.name : 'UnknownError'
      },
      { status: 500 }
    )
  }
}
