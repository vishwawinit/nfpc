import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    const searchParams = request.nextUrl.searchParams
    const userCode = searchParams.get('userCode')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const loginUserCode = searchParams.get('loginUserCode')

    if (!userCode) {
      return NextResponse.json(
        { error: 'userCode is required' },
        { status: 400 }
      )
    }

    // Get hierarchy-based allowed users
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
      
      // Check if the requested userCode is in the allowed list
      if (allowedUserCodes.length > 0 && !allowedUserCodes.includes(userCode)) {
        return NextResponse.json(
          { error: 'Access denied: User not in your hierarchy' },
          { status: 403 }
        )
      }
    }

    let whereClause = 'user_code = $1'
    const params: any[] = [userCode]
    let paramCount = 2

    if (startDate && endDate) {
      whereClause += ` AND attendance_date >= $${paramCount} AND attendance_date <= $${paramCount + 1}`
      params.push(startDate, endDate)
      paramCount += 2
    }

    // Get day-wise attendance details for the user
    // Calculate attendance status based on valid journey_start_time
    const query = `
      SELECT
        attendance_date,
        user_code,
        user_name,
        user_username,
        user_role,
        tl_code,
        tl_name,
        profile_pic,
        -- Determine attendance status based on journey_start_time validity
        CASE 
          WHEN holiday_name IS NOT NULL THEN 'Holiday'
          WHEN leave_type IS NOT NULL THEN 'Leave'
          WHEN journey_start_time IS NOT NULL AND EXTRACT(YEAR FROM journey_start_time) >= 2000 THEN 'Present'
          ELSE 'Absent'
        END as attendance_status,
        attendance_type,
        attendance_marked_by,
        attendance_marked_on,
        journey_start_time,
        journey_end_time,
        -- Calculate working minutes from timestamps, handle invalid data
        CASE 
          WHEN journey_start_time IS NOT NULL 
               AND journey_end_time IS NOT NULL
               AND EXTRACT(YEAR FROM journey_end_time) >= 2000
               AND journey_end_time > journey_start_time
          THEN EXTRACT(EPOCH FROM (journey_end_time - journey_start_time))/60
          ELSE 0
        END as total_working_minutes,
        total_working_hours,
        journey_code,
        journey_status,
        start_latitude,
        start_longitude,
        end_latitude,
        end_longitude,
        remarks,
        reason,
        leave_type,
        holiday_name,
        attendance_image,
        created_on,
        modified_on
      FROM flat_attendance_daily
      WHERE ${whereClause}
      ORDER BY attendance_date DESC
    `

    const result = await db.query(query, params)

    const attendanceDetails = result.rows.map((row: any) => ({
      attendanceDate: row.attendance_date,
      userCode: row.user_code,
      userName: row.user_name,
      userUsername: row.user_username,
      userRole: row.user_role,
      tlCode: row.tl_code,
      tlName: row.tl_name ? row.tl_name.trim() : null,
      profilePic: row.profile_pic,
      attendanceStatus: row.attendance_status || 'N/A',
      attendanceType: row.attendance_type,
      attendanceMarkedBy: row.attendance_marked_by,
      attendanceMarkedOn: row.attendance_marked_on,
      journeyStartTime: row.journey_start_time,
      journeyEndTime: row.journey_end_time,
      totalWorkingMinutes: parseInt(row.total_working_minutes || 0),
      totalWorkingHours: parseFloat(row.total_working_hours || 0),
      journeyCode: row.journey_code,
      journeyStatus: row.journey_status,
      startLatitude: row.start_latitude ? parseFloat(row.start_latitude) : null,
      startLongitude: row.start_longitude ? parseFloat(row.start_longitude) : null,
      endLatitude: row.end_latitude ? parseFloat(row.end_latitude) : null,
      endLongitude: row.end_longitude ? parseFloat(row.end_longitude) : null,
      remarks: row.remarks,
      reason: row.reason,
      leaveType: row.leave_type,
      holidayName: row.holiday_name,
      attendanceImage: row.attendance_image,
      createdOn: row.created_on,
      modifiedOn: row.modified_on
    }))

    return NextResponse.json({
      userCode,
      attendance: attendanceDetails,
      totalRecords: attendanceDetails.length
    })
  } catch (error) {
    console.error('Error fetching user attendance details:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch attendance details', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
