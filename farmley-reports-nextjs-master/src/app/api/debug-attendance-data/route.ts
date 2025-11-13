import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    await db.initialize()

    // Check for data quality issues
    const issues = await db.query(`
      SELECT 
        'Negative Working Minutes' as issue_type,
        COUNT(*) as count,
        MIN(total_working_minutes) as min_value,
        MAX(total_working_minutes) as max_value
      FROM flat_attendance_daily
      WHERE total_working_minutes < 0
      
      UNION ALL
      
      SELECT 
        'Invalid End Time (Year < 2000)' as issue_type,
        COUNT(*) as count,
        MIN(journey_end_time) as min_value,
        MAX(journey_end_time) as max_value
      FROM flat_attendance_daily
      WHERE EXTRACT(YEAR FROM journey_end_time) < 2000
      
      UNION ALL
      
      SELECT 
        'Null Start Time with Present Status' as issue_type,
        COUNT(*) as count,
        NULL as min_value,
        NULL as max_value
      FROM flat_attendance_daily
      WHERE attendance_status = 'Present' 
        AND journey_start_time IS NULL
      
      UNION ALL
      
      SELECT 
        'Valid Records' as issue_type,
        COUNT(*) as count,
        NULL as min_value,
        NULL as max_value
      FROM flat_attendance_daily
      WHERE attendance_status = 'Present'
        AND journey_start_time IS NOT NULL
        AND (journey_end_time IS NULL OR EXTRACT(YEAR FROM journey_end_time) >= 2000)
        AND (total_working_minutes IS NULL OR total_working_minutes >= 0)
    `)

    // Get sample bad records
    const badRecords = await db.query(`
      SELECT 
        attendance_date,
        user_code,
        user_name,
        attendance_status,
        journey_start_time,
        journey_end_time,
        total_working_minutes,
        EXTRACT(EPOCH FROM (journey_end_time - journey_start_time))/60 as calculated_minutes
      FROM flat_attendance_daily
      WHERE (total_working_minutes < 0 OR EXTRACT(YEAR FROM journey_end_time) < 2000)
      LIMIT 10
    `)

    // Get valid records calculation
    const validCalculation = await db.query(`
      SELECT 
        attendance_date,
        user_code,
        user_name,
        journey_start_time,
        journey_end_time,
        total_working_minutes as stored_minutes,
        CASE 
          WHEN journey_start_time IS NOT NULL AND journey_end_time IS NOT NULL 
               AND EXTRACT(YEAR FROM journey_end_time) >= 2000
          THEN EXTRACT(EPOCH FROM (journey_end_time - journey_start_time))/60
          ELSE NULL
        END as calculated_minutes
      FROM flat_attendance_daily
      WHERE attendance_status = 'Present'
        AND journey_start_time IS NOT NULL
      ORDER BY attendance_date DESC
      LIMIT 10
    `)

    return NextResponse.json({
      issues: issues.rows,
      badRecords: badRecords.rows,
      validCalculation: validCalculation.rows
    })
  } catch (error) {
    console.error('Error debugging attendance data:', error)
    return NextResponse.json(
      { error: 'Failed to debug data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
