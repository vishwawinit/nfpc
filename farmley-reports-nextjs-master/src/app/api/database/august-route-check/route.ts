import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check flat_route_analysis - this table might not have date filters, so let's check all data
    const flatRoutesAllQuery = `
      SELECT
        route_code,
        route_name,
        total_customers,
        active_customers,
        assigned_salesmen,
        total_sales_30d,
        total_orders_30d,
        avg_order_value_30d,
        route_classification,
        route_rank
      FROM flat_route_analysis
      WHERE total_sales_30d > 0
      ORDER BY total_sales_30d DESC
      LIMIT 15
    `

    // Check what actual routes exist with sales in August 2025 from flat_transactions
    const augustRoutesQuery = `
      SELECT
        route_code,
        route_name,
        COUNT(*) as orders,
        SUM(total_amount) as sales,
        COUNT(DISTINCT client_code) as customers,
        AVG(total_amount) as avg_order_value
      FROM flat_transactions
      WHERE DATE_TRUNC('month', trx_date) = '2025-08-01'::date
        AND total_amount > 0
        AND route_code IS NOT NULL
      GROUP BY route_code, route_name
      ORDER BY sales DESC
      LIMIT 15
    `

    // Check total records in flat_route_analysis
    const totalCountQuery = `
      SELECT
        COUNT(*) as total_routes,
        COUNT(CASE WHEN total_sales_30d > 0 THEN 1 END) as routes_with_sales,
        SUM(total_sales_30d) as total_sales_sum,
        MAX(total_sales_30d) as max_sales
      FROM flat_route_analysis
    `

    const [flatResult, augustResult, countResult] = await Promise.all([
      db.query(flatRoutesAllQuery),
      db.query(augustRoutesQuery),
      db.query(totalCountQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        flatTableRoutes: flatResult.rows,
        augustTransactionRoutes: augustResult.rows,
        totalStats: countResult.rows[0],
        comparison: {
          flatTableActiveRoutes: flatResult.rows.length,
          augustActiveRoutes: augustResult.rows.length,
          dataMatches: flatResult.rows.some(route =>
            augustResult.rows.some(aug => aug.route_code === route.route_code)
          )
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('August route check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check August routes',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}