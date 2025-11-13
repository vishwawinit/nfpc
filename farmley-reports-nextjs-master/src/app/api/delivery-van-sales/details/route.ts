import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Date range helper
function getDateRange(range: string) {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  switch (range) {
    case 'lastMonth':
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)
      return { start: lastMonthStart, end: lastMonthEnd }
    case 'lastQuarter':
      const lastQ = Math.floor(today.getMonth() / 3) - 1
      const lastQuarterStart = lastQ < 0
        ? new Date(today.getFullYear() - 1, 9, 1)
        : new Date(today.getFullYear(), lastQ * 3, 1)
      const lastQuarterEnd = lastQ < 0
        ? new Date(today.getFullYear() - 1, 11, 31)
        : new Date(today.getFullYear(), (lastQ + 1) * 3, 0, 23, 59, 59)
      return { start: lastQuarterStart, end: lastQuarterEnd }
    default:
      return {
        start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        end: new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)
      }
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const salesmanCode = searchParams.get('salesmanCode')
    const routeCode = searchParams.get('routeCode')
    const dateRange = searchParams.get('range') || 'lastMonth'

    if (!salesmanCode) {
      return NextResponse.json({
        success: false,
        error: 'Salesman code is required'
      }, { status: 400 })
    }

    await db.initialize()

    const { start: startDate, end: endDate } = getDateRange(dateRange)
    // Format dates properly without timezone conversion issues
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

    // Build filter clauses
    const routeFilter = routeCode && routeCode !== 'all' ? `AND route_code = $4` : ''
    const params = routeFilter
      ? [startDateStr, endDateStr, salesmanCode, routeCode]
      : [startDateStr, endDateStr, salesmanCode]

    // Get product-level breakdown for this salesman
    const productDetailsQuery = `
      WITH loads AS (
        SELECT
          d.product_code,
          d.product_name,
          (SELECT category_name FROM new_flat_transactions t WHERE t.product_code = d.product_code LIMIT 1) as category_name,
          (SELECT brand FROM new_flat_transactions t WHERE t.product_code = d.product_code LIMIT 1) as brand,
          SUM(d.qty_loaded) as qty_loaded,
          SUM(d.qty_returned) as qty_returned,
          SUM(d.qty_loaded * COALESCE((SELECT unit_price FROM new_flat_transactions t WHERE t.product_code = d.product_code LIMIT 1), 0)) as load_value,
          SUM(d.qty_returned * COALESCE((SELECT unit_price FROM new_flat_transactions t WHERE t.product_code = d.product_code LIMIT 1), 0)) as return_value
        FROM new_flat_delivery_fulfillment d
        WHERE order_date BETWEEN $1 AND $2
          AND salesman_code = $3
          ${routeFilter}
        GROUP BY d.product_code, d.product_name
      ),
      sales AS (
        SELECT
          product_code,
          product_name,
          category_name,
          brand,
          SUM(quantity::numeric) as qty_sold,
          SUM(total_amount::numeric) as sales_value
        FROM new_flat_transactions
        WHERE trx_date_only BETWEEN $1 AND $2
          AND salesman_code = $3
          ${routeFilter}
        GROUP BY product_code, product_name, category_name, brand
      )
      SELECT
        COALESCE(l.product_code, s.product_code) as product_code,
        COALESCE(l.product_name, s.product_name) as product_name,
        COALESCE(l.category_name, s.category_name) as category_name,
        COALESCE(l.brand, s.brand) as brand,
        COALESCE(l.qty_loaded, 0) as qty_loaded,
        COALESCE(s.qty_sold, 0) as qty_sold,
        COALESCE(l.qty_returned, 0) as qty_returned,
        COALESCE(l.load_value, 0) as load_value,
        COALESCE(s.sales_value, 0) as sales_value,
        COALESCE(l.return_value, 0) as return_value,
        CASE
          WHEN COALESCE(l.qty_loaded, 0) > 0 THEN
            (COALESCE(s.qty_sold, 0) * 100.0 / l.qty_loaded)
          ELSE 0
        END as sell_through_pct
      FROM loads l
      FULL OUTER JOIN sales s ON l.product_code = s.product_code
      WHERE COALESCE(l.qty_loaded, 0) > 0 OR COALESCE(s.qty_sold, 0) > 0 OR COALESCE(l.qty_returned, 0) > 0
      ORDER BY COALESCE(s.sales_value, 0) DESC
    `

    // Get summary for this salesman
    const summaryQuery = `
      WITH loads AS (
        SELECT
          d.salesman_code,
          (SELECT salesman_name FROM new_flat_transactions WHERE salesman_code = d.salesman_code LIMIT 1) as salesman_name,
          d.route_code,
          COUNT(DISTINCT d.product_code) as total_products,
          SUM(d.qty_loaded) as total_loaded,
          SUM(d.qty_returned) as total_returned,
          SUM(d.qty_loaded * COALESCE((SELECT unit_price FROM new_flat_transactions t WHERE t.product_code = d.product_code LIMIT 1), 0)) as total_load_value,
          SUM(d.qty_returned * COALESCE((SELECT unit_price FROM new_flat_transactions t WHERE t.product_code = d.product_code LIMIT 1), 0)) as total_return_value
        FROM new_flat_delivery_fulfillment d
        WHERE order_date BETWEEN $1 AND $2
          AND salesman_code = $3
          ${routeFilter}
        GROUP BY d.salesman_code, d.route_code
      ),
      sales AS (
        SELECT
          SUM(quantity::numeric) as total_sold,
          SUM(total_amount::numeric) as total_sales_value
        FROM new_flat_transactions
        WHERE trx_date_only BETWEEN $1 AND $2
          AND salesman_code = $3
          ${routeFilter}
      )
      SELECT
        l.salesman_code,
        l.salesman_name,
        l.route_code,
        l.total_products,
        l.total_loaded,
        COALESCE(s.total_sold, 0) as total_sold,
        l.total_returned,
        l.total_load_value,
        COALESCE(s.total_sales_value, 0) as total_sales_value,
        l.total_return_value
      FROM loads l, sales s
    `

    const [productDetailsResult, summaryResult] = await Promise.all([
      db.query(productDetailsQuery, params),
      db.query(summaryQuery, params)
    ])

    return NextResponse.json({
      success: true,
      summary: summaryResult.rows[0] || null,
      products: productDetailsResult.rows
    })

  } catch (error) {
    console.error('Delivery details API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch delivery details',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
