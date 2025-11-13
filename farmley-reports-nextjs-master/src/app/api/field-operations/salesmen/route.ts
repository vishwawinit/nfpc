import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Cached data fetcher function using new_flat tables
async function fetchSalesmenData(dateRange: string, salesmanCode?: string) {
  await db.initialize()

  // Build date filter based on range or specific date
  let dateFilter = ''

  // Check if dateRange is a specific date (YYYY-MM-DD format)
  if (dateRange && dateRange.match(/^\d{4}-\d{2}-\d{2}$/)) {
    dateFilter = `visit_date = '${dateRange}'::date`
  } else {
    switch(dateRange) {
      case 'today':
        dateFilter = `visit_date = CURRENT_DATE`
        break
      case 'yesterday':
        dateFilter = `visit_date = CURRENT_DATE - INTERVAL '1 day'`
        break
      case 'thisWeek':
        dateFilter = `visit_date >= CURRENT_DATE - INTERVAL '6 days' AND visit_date <= CURRENT_DATE`
        break
      case 'thisMonth':
        dateFilter = `visit_date >= DATE_TRUNC('month', CURRENT_DATE) AND visit_date <= CURRENT_DATE`
        break
      case 'lastMonth':
        dateFilter = `visit_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND visit_date < DATE_TRUNC('month', CURRENT_DATE)`
        break
      case 'thisYear':
        dateFilter = `visit_date >= DATE_TRUNC('year', CURRENT_DATE) AND visit_date <= CURRENT_DATE`
        break
      default:
        dateFilter = `visit_date = CURRENT_DATE`
    }
  }

  // Build salesman filter
  const salesmanFilter = salesmanCode && salesmanCode !== 'all'
    ? `AND salesman_code = '${salesmanCode}'`
    : ''

  // Query to get salesmen data from new_flat_customer_visits
  const query = `
    WITH salesman_visits AS (
      SELECT
        salesman_code as code,
        MAX(salesman_name) as name,
        COUNT(*) as total_visits,
        COUNT(CASE WHEN is_productive = true THEN 1 END) as productive_visits,
        AVG(duration_minutes) as avg_duration,
        MIN(arrival_time) as first_visit,
        MAX(departure_time) as last_visit
      FROM new_flat_customer_visits cv
      WHERE ${dateFilter.replace(/visit_date/g, 'cv.visit_date')}
        ${salesmanFilter.replace('salesman_code', 'cv.salesman_code')}
        AND cv.salesman_code IS NOT NULL
      GROUP BY salesman_code
    ),
    salesman_sales AS (
      SELECT
        salesman_code,
        COUNT(DISTINCT trx_code) as orders,
        SUM(total_amount) as total_sales,
        AVG(total_amount) as avg_order_value
      FROM new_flat_transactions t
      WHERE ${dateFilter.replace(/visit_date/g, 't.trx_date_only')}
        ${salesmanFilter.replace('salesman_code', 't.salesman_code')}
        AND t.salesman_code IS NOT NULL
      GROUP BY salesman_code
    )
    SELECT
      sv.code,
      sv.name,
      sv.total_visits as visits,
      sv.productive_visits,
      COALESCE(ss.orders, 0) as orders,
      COALESCE(ss.total_sales, 0) as sales,
      COALESCE(ss.avg_order_value, 0) as avg_order_value,
      sv.avg_duration,
      sv.first_visit,
      sv.last_visit,
      CASE
        WHEN sv.total_visits > 0
        THEN ROUND((sv.productive_visits::numeric / sv.total_visits) * 100, 1)
        ELSE 0
      END as productivity,
      CASE
        WHEN sv.productive_visits > sv.total_visits * 0.7 THEN 'active'
        WHEN sv.productive_visits > sv.total_visits * 0.3 THEN 'idle'
        ELSE 'inactive'
      END as status,
      CASE
        WHEN (sv.productive_visits::numeric / NULLIF(sv.total_visits, 0)) >= 0.8 THEN 'Excellent'
        WHEN (sv.productive_visits::numeric / NULLIF(sv.total_visits, 0)) >= 0.6 THEN 'Good'
        WHEN (sv.productive_visits::numeric / NULLIF(sv.total_visits, 0)) >= 0.4 THEN 'Average'
        ELSE 'Poor'
      END as performance_status
    FROM salesman_visits sv
    LEFT JOIN salesman_sales ss ON sv.code = ss.salesman_code
    ORDER BY sv.total_visits DESC, ss.total_sales DESC
  `

  const result = await db.query(query)

  return result.rows.map(row => ({
    code: row.code,
    id: row.code, // Add id field for compatibility
    name: row.name || 'Unknown',
    route: 'Route', // Default route since we don't have route data
    status: row.status,
    visits: parseInt(row.visits || 0),
    productiveVisits: parseInt(row.productive_visits || 0),
    orders: parseInt(row.orders || 0),
    sales: parseFloat(row.sales || 0),
    avgOrderValue: parseFloat(row.avg_order_value || 0),
    avgDuration: Math.round(parseFloat(row.avg_duration || 0)),
    productivity: parseFloat(row.productivity || 0),
    performanceStatus: row.performance_status,
    firstVisit: row.first_visit,
    lastVisit: row.last_visit
  }))
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || 'today'
    const date = searchParams.get('date')
    const salesmanCode = searchParams.get('salesmanCode')

    // If date is provided, use it directly, otherwise use range
    const dateRange = date || range

    // Create cached version of the data fetcher (cache for 3 minutes)
    const getCachedData = unstable_cache(
      async () => fetchSalesmenData(dateRange, salesmanCode),
      [`field-salesmen-${dateRange}-${salesmanCode || 'all'}-v7`],
      {
        revalidate: 180, // Cache for 3 minutes
        tags: [`field-salesmen`, `field-data-${dateRange}`]
      }
    )

    const salesmen = await getCachedData()

    // Create response with cache headers
    const response = NextResponse.json(salesmen)
    response.headers.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360')
    response.headers.set('X-Cache-Duration', '180')

    return response

  } catch (error) {
    console.error('Error fetching salesmen data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch salesmen data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}