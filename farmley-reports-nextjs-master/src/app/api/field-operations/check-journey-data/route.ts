import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || '2025-09-08'

    // Check journey management data
    const journeyQuery = `
      SELECT
        journey_code,
        salesman_code,
        salesman_name,
        route_code,
        route_name,
        start_latitude,
        start_longitude,
        end_latitude,
        end_longitude,
        planned_duration_minutes,
        actual_duration_minutes,
        customers_planned,
        customers_visited,
        customers_completed,
        planned_sales,
        actual_sales,
        achievement_percentage,
        completion_percentage,
        journey_status
      FROM new_flat_journey_management
      WHERE journey_date = $1
      ORDER BY salesman_code, journey_code
      LIMIT 10
    `

    const journeyResult = await db.query(journeyQuery, [date])

    // Check route performance data
    const routeQuery = `
      SELECT
        route_code,
        route_name,
        km_travelled,
        avg_trip_duration,
        fuel_efficiency,
        total_trips
      FROM new_flat_route_performance
      LIMIT 5
    `

    const routeResult = await db.query(routeQuery)

    return NextResponse.json({
      date,
      journeyManagement: {
        count: journeyResult.rows.length,
        sample: journeyResult.rows
      },
      routePerformance: {
        count: routeResult.rows.length,
        sample: routeResult.rows
      }
    })

  } catch (error) {
    console.error('Error checking journey data:', error)
    return NextResponse.json(
      { error: 'Failed to check journey data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}