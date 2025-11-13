import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Find dates with actual visit data
    const query = `
      WITH visit_dates AS (
        SELECT
          DATE(date) as visit_date,
          COUNT(DISTINCT usercode) as users,
          COUNT(*) as visits,
          COUNT(CASE WHEN isproductive = 1 THEN 1 END) as productive
        FROM tblcustomervisit
        WHERE date >= '2024-01-01'
        GROUP BY DATE(date)
        HAVING COUNT(*) > 0
        ORDER BY DATE(date) DESC
        LIMIT 30
      ),
      journey_dates AS (
        SELECT
          DATE(date) as journey_date,
          COUNT(DISTINCT usercode) as journeys
        FROM tbljourney
        WHERE date >= '2024-01-01'
        GROUP BY DATE(date)
        HAVING COUNT(*) > 0
        ORDER BY DATE(date) DESC
        LIMIT 30
      )
      SELECT
        COALESCE(v.visit_date, j.journey_date) as date,
        COALESCE(v.users, 0) as users,
        COALESCE(v.visits, 0) as visits,
        COALESCE(v.productive, 0) as productive,
        COALESCE(j.journeys, 0) as journeys
      FROM visit_dates v
      FULL OUTER JOIN journey_dates j ON v.visit_date = j.journey_date
      ORDER BY date DESC
    `

    const result = await db.query(query)

    return NextResponse.json({
      availableDates: result.rows,
      latestDate: result.rows[0]?.date || '2024-08-15',
      totalRecords: result.rows.length
    })

  } catch (error) {
    console.error('Error checking data range:', error)
    return NextResponse.json(
      { error: 'Failed to check data range' },
      { status: 500 }
    )
  }
}