import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    await db.initialize()

    // Get table structure
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'flat_attendance_daily'
      ORDER BY ordinal_position
    `
    
    // Get sample data (10 users with their recent attendance)
    const sampleQuery = `
      SELECT *
      FROM flat_attendance_daily
      ORDER BY attendance_date DESC, user_name
      LIMIT 50
    `

    // Get unique statuses
    const statusQuery = `
      SELECT DISTINCT attendance_status, COUNT(*) as count
      FROM flat_attendance_daily
      WHERE attendance_status IS NOT NULL
      GROUP BY attendance_status
      ORDER BY count DESC
    `

    // Get date range
    const dateRangeQuery = `
      SELECT 
        MIN(attendance_date) as min_date,
        MAX(attendance_date) as max_date,
        COUNT(DISTINCT user_code) as total_users,
        COUNT(*) as total_records
      FROM flat_attendance_daily
    `

    const [structure, sample, statuses, dateRange] = await Promise.all([
      db.query(structureQuery),
      db.query(sampleQuery),
      db.query(statusQuery),
      db.query(dateRangeQuery)
    ])

    return NextResponse.json({
      structure: structure.rows,
      sample: sample.rows,
      statuses: statuses.rows,
      dateRange: dateRange.rows[0]
    })
  } catch (error) {
    console.error('Error examining attendance table:', error)
    return NextResponse.json(
      { error: 'Failed to examine table', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
