import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check routes with sales in flat_route_analysis
    const flatRoutesQuery = `
      SELECT
        route_code,
        route_name,
        total_sales_30d,
        total_orders_30d,
        route_classification
      FROM flat_route_analysis
      WHERE total_sales_30d > 0
      ORDER BY total_sales_30d DESC
      LIMIT 10
    `

    // Check current active routes from flat_transactions (last month)
    const activeRoutesQuery = `
      SELECT
        route_code,
        route_name,
        COUNT(*) as orders,
        SUM(total_amount) as sales,
        COUNT(DISTINCT client_code) as customers
      FROM flat_transactions
      WHERE trx_date >= CURRENT_DATE - INTERVAL '30 days'
        AND total_amount > 0
        AND route_code IS NOT NULL
      GROUP BY route_code, route_name
      ORDER BY sales DESC
      LIMIT 10
    `

    const [flatResult, activeResult] = await Promise.all([
      db.query(flatRoutesQuery),
      db.query(activeRoutesQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        flatTableActiveRoutes: flatResult.rows,
        currentActiveRoutes: activeResult.rows,
        comparison: {
          flatTableCount: flatResult.rows.length,
          currentActiveCount: activeResult.rows.length
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Active routes check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check active routes',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}