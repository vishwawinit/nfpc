import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    await db.initialize()

    // Get min and max dates, and list of months with data
    const query = `
      SELECT 
        MIN(attendance_date) as min_date,
        MAX(attendance_date) as max_date,
        TO_CHAR(attendance_date, 'YYYY-MM') as year_month,
        TO_CHAR(attendance_date, 'Month YYYY') as month_name,
        COUNT(*) as record_count,
        COUNT(DISTINCT user_code) as user_count
      FROM flat_attendance_daily
      GROUP BY TO_CHAR(attendance_date, 'YYYY-MM'), TO_CHAR(attendance_date, 'Month YYYY')
      ORDER BY TO_CHAR(attendance_date, 'YYYY-MM') DESC
    `

    const result = await db.query(query)

    // Get overall stats
    const statsQuery = `
      SELECT 
        MIN(attendance_date) as earliest_date,
        MAX(attendance_date) as latest_date,
        COUNT(DISTINCT TO_CHAR(attendance_date, 'YYYY-MM')) as months_with_data,
        COUNT(DISTINCT user_code) as total_users
      FROM flat_attendance_daily
    `

    const statsResult = await db.query(statsQuery)
    const stats = statsResult.rows[0]

    const months = result.rows.map((row: any) => ({
      yearMonth: row.year_month,
      monthName: row.month_name.trim(),
      recordCount: parseInt(row.record_count || 0),
      userCount: parseInt(row.user_count || 0)
    }))

    return NextResponse.json({
      months,
      stats: {
        earliestDate: stats.earliest_date,
        latestDate: stats.latest_date,
        monthsWithData: parseInt(stats.months_with_data || 0),
        totalUsers: parseInt(stats.total_users || 0)
      }
    })
  } catch (error) {
    console.error('Error fetching available dates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available dates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
