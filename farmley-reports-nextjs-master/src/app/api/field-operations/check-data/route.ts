import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Check available dates with data
    const dateQuery = `
      SELECT
        operation_date,
        COUNT(DISTINCT usercode) as user_count,
        SUM(completed_visits) as total_visits,
        SUM(productive_visits) as productive_visits
      FROM flat_field_operations
      WHERE operation_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY operation_date
      ORDER BY operation_date DESC
      LIMIT 10
    `

    const dateResult = await db.query(dateQuery)

    // Get sample of user data with names
    const userQuery = `
      SELECT DISTINCT
        fo.usercode,
        fo.user_name,
        sp.salesman_name,
        COUNT(DISTINCT fo.operation_date) as active_days
      FROM flat_field_operations fo
      LEFT JOIN flat_salesman_performance sp ON fo.usercode = sp.salesman_code
      GROUP BY fo.usercode, fo.user_name, sp.salesman_name
      LIMIT 20
    `

    const userResult = await db.query(userQuery)

    // Get the most recent date with actual data
    const latestQuery = `
      SELECT
        MAX(operation_date) as latest_date,
        MAX(CASE WHEN completed_visits > 0 THEN operation_date END) as latest_active_date
      FROM flat_field_operations
    `

    const latestResult = await db.query(latestQuery)

    return NextResponse.json({
      availableDates: dateResult.rows,
      sampleUsers: userResult.rows,
      latestData: latestResult.rows[0]
    })

  } catch (error) {
    console.error('Error checking data:', error)
    return NextResponse.json(
      { error: 'Failed to check data' },
      { status: 500 }
    )
  }
}