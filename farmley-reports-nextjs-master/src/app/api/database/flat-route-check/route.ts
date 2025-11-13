import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check flat_route_analysis table structure and sample data
    const dataQuery = `
      SELECT
        route_code,
        route_name,
        total_customers,
        active_customers,
        assigned_salesmen,
        total_visits_all_time,
        avg_visit_duration,
        total_sales_30d,
        total_orders_30d,
        active_days_30d,
        avg_order_value_30d,
        coverage_percentage,
        sales_per_customer,
        route_classification,
        route_rank
      FROM flat_route_analysis
      ORDER BY route_rank
      LIMIT 10
    `

    // Count total routes
    const countQuery = `SELECT COUNT(*) as total_routes FROM flat_route_analysis`

    // Check data availability
    const dataAvailabilityQuery = `
      SELECT
        COUNT(*) as total_routes,
        COUNT(CASE WHEN total_sales_30d > 0 THEN 1 END) as routes_with_sales,
        SUM(total_sales_30d) as total_sales,
        AVG(total_sales_30d) as avg_sales_per_route,
        MAX(total_sales_30d) as max_route_sales,
        MIN(total_sales_30d) as min_route_sales
      FROM flat_route_analysis
    `

    const [dataResult, countResult, availabilityResult] = await Promise.all([
      db.query(dataQuery),
      db.query(countQuery),
      db.query(dataAvailabilityQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        sampleRoutes: dataResult.rows,
        totalRoutes: countResult.rows[0].total_routes,
        dataAvailability: availabilityResult.rows[0]
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Flat route analysis check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check flat_route_analysis table',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}