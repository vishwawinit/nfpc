import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Count total distinct routes
    const totalQuery = `
      SELECT COUNT(DISTINCT route_code) as total_routes
      FROM flat_transactions
      WHERE route_code IS NOT NULL
        AND route_code != ''
        AND route_code != 'null'
    `

    // Count routes with data in last month
    const lastMonthQuery = `
      SELECT COUNT(DISTINCT route_code) as active_routes_last_month
      FROM flat_transactions
      WHERE route_code IS NOT NULL
        AND route_code != ''
        AND route_code != 'null'
        AND trx_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
        AND trx_date < date_trunc('month', CURRENT_DATE)
        AND total_amount > 0
    `

    // Count routes with data in current month
    const thisMonthQuery = `
      SELECT COUNT(DISTINCT route_code) as active_routes_this_month
      FROM flat_transactions
      WHERE route_code IS NOT NULL
        AND route_code != ''
        AND route_code != 'null'
        AND trx_date >= date_trunc('month', CURRENT_DATE)
        AND total_amount > 0
    `

    const [totalResult, lastMonthResult, thisMonthResult] = await Promise.all([
      db.query(totalQuery),
      db.query(lastMonthQuery),
      db.query(thisMonthQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        totalRoutes: parseInt(totalResult.rows[0]?.total_routes || 0),
        activeRoutesLastMonth: parseInt(lastMonthResult.rows[0]?.active_routes_last_month || 0),
        activeRoutesThisMonth: parseInt(thisMonthResult.rows[0]?.active_routes_this_month || 0)
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Route count API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to count routes',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}