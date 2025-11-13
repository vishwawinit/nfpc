import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Date range helper
function getDateRange(range: string) {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  switch (range) {
    case 'today':
      return {
        start: startOfToday,
        end: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1)
      }
    case 'yesterday':
      const yesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000)
      return {
        start: yesterday,
        end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
      }
    case 'thisWeek':
      const dayOfWeek = startOfToday.getDay()
      const startOfWeek = new Date(startOfToday.getTime() - dayOfWeek * 24 * 60 * 60 * 1000)
      return { start: startOfWeek, end: today }
    case 'thisMonth':
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: today
      }
    case 'lastMonth':
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)
      return { start: lastMonthStart, end: lastMonthEnd }
    case 'thisQuarter':
      const currentQuarter = Math.floor(today.getMonth() / 3)
      const quarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1)
      return { start: quarterStart, end: today }
    case 'lastQuarter':
      const lastQ = Math.floor(today.getMonth() / 3) - 1
      const lastQuarterStart = lastQ < 0
        ? new Date(today.getFullYear() - 1, 9, 1)
        : new Date(today.getFullYear(), lastQ * 3, 1)
      const lastQuarterEnd = lastQ < 0
        ? new Date(today.getFullYear() - 1, 11, 31)
        : new Date(today.getFullYear(), (lastQ + 1) * 3, 0, 23, 59, 59)
      return { start: lastQuarterStart, end: lastQuarterEnd }
    case 'thisYear':
      return {
        start: new Date(today.getFullYear(), 0, 1),
        end: today
      }
    default:
      return {
        start: new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: today
      }
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateRange = searchParams.get('range') || 'lastMonth'

    await db.initialize()

    const { start: startDate, end: endDate } = getDateRange(dateRange)
    // Format dates properly without timezone conversion issues
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

    // Get unique salesmen who actually have load/delivery data in the date range
    const salesmenQuery = `
      WITH all_salesmen AS (
        SELECT DISTINCT salesman_code
        FROM new_flat_delivery_fulfillment
        WHERE salesman_code IS NOT NULL
          AND order_date BETWEEN $1 AND $2
        UNION
        SELECT DISTINCT salesman_code
        FROM new_flat_transactions
        WHERE salesman_code IS NOT NULL
          AND trx_date_only BETWEEN $1 AND $2
      )
      SELECT DISTINCT
        a.salesman_code as code,
        (SELECT salesman_name FROM new_flat_transactions WHERE salesman_code = a.salesman_code LIMIT 1) as name
      FROM all_salesmen a
      WHERE a.salesman_code IS NOT NULL
      ORDER BY code
    `

    // Get unique routes that have load/delivery data in the date range
    // JOIN with new_flat_journey_management to get route names
    const routesQuery = `
      WITH all_routes AS (
        SELECT DISTINCT route_code
        FROM new_flat_delivery_fulfillment
        WHERE route_code IS NOT NULL
          AND order_date BETWEEN $1 AND $2
        UNION
        SELECT DISTINCT route_code
        FROM new_flat_transactions
        WHERE route_code IS NOT NULL
          AND trx_date_only BETWEEN $1 AND $2
      )
      SELECT DISTINCT
        a.route_code as code,
        COALESCE(j.route_name, a.route_code) as name
      FROM all_routes a
      LEFT JOIN (
        SELECT DISTINCT route_code, route_name
        FROM new_flat_journey_management
        WHERE route_name IS NOT NULL AND route_name != ''
      ) j ON a.route_code = j.route_code
      WHERE a.route_code IS NOT NULL
      ORDER BY code
    `

    const [salesmenResult, routesResult] = await Promise.all([
      db.query(salesmenQuery, [startDateStr, endDateStr]),
      db.query(routesQuery, [startDateStr, endDateStr])
    ])

    return NextResponse.json({
      success: true,
      salesmen: salesmenResult.rows,
      routes: routesResult.rows
    })

  } catch (error) {
    console.error('Filters API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
