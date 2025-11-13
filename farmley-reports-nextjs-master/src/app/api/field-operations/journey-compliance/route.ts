import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Cached data fetcher function using new_flat tables
async function fetchJourneyCompliance(dateRange: string, salesmanCode?: string) {
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

  // Build salesman filter with proper table prefixes
  const salesmanFilter = salesmanCode && salesmanCode !== 'all'
    ? salesmanCode
    : ''

  // Get REAL journey data - ONLY salesmen with actual journey records (no mock data)
  // Calculate warehouse departure/return times based on actual customer visits + travel time estimates
  const query = `
    WITH journey_data AS (
      SELECT DISTINCT ON (jm.salesman_code)
        jm.salesman_code,
        jm.salesman_name,
        jm.route_name,
        jm.journey_date,
        jm.planned_start_time,
        jm.planned_end_time,
        jm.customers_planned,
        jm.journey_status,
        jm.planned_sales
      FROM new_flat_journey_management jm
      WHERE jm.journey_date = '${dateRange}'::date
        ${salesmanFilter ? `AND jm.salesman_code = '${salesmanFilter}'` : ''}
        AND jm.salesman_code IS NOT NULL
      ORDER BY jm.salesman_code, jm.journey_id DESC
    ),
    actual_visits AS (
      SELECT
        cv.salesman_code,
        COUNT(*) as total_visits,
        COUNT(CASE WHEN cv.is_productive = true THEN 1 END) as productive_visits,
        COUNT(DISTINCT cv.customer_code) as unique_customers,
        MIN(cv.arrival_time) as first_visit_time,
        MAX(cv.departure_time) as last_visit_time
      FROM new_flat_customer_visits cv
      WHERE ${dateFilter}
        ${salesmanFilter ? `AND cv.salesman_code = '${salesmanFilter}'` : ''}
        AND cv.salesman_code IS NOT NULL
      GROUP BY cv.salesman_code
    ),
    salesman_sales AS (
      SELECT
        t.salesman_code,
        SUM(t.total_amount) as total_sales,
        COUNT(DISTINCT t.trx_code) as total_orders
      FROM new_flat_transactions t
      WHERE ${dateFilter.replace('visit_date', 'trx_date_only')}
        ${salesmanFilter ? `AND t.salesman_code = '${salesmanFilter}'` : ''}
        AND t.salesman_code IS NOT NULL
      GROUP BY t.salesman_code
    )
    SELECT
      jd.salesman_code as user_code,
      jd.salesman_name as user_name,
      jd.route_name as route_name,
      '${dateRange}' as journey_date,
      -- Journey start time = first customer arrival
      COALESCE(
        TO_CHAR(av.first_visit_time, 'HH24:MI:SS'),
        jd.planned_start_time::text,
        '--:--'
      ) as start_time,
      -- Journey end time = last customer departure
      COALESCE(
        TO_CHAR(COALESCE(av.last_visit_time, av.first_visit_time), 'HH24:MI:SS'),
        jd.planned_end_time::text,
        '--:--'
      ) as end_time,
      TO_CHAR(av.first_visit_time, 'HH24:MI:SS') as first_customer_time,
      TO_CHAR(av.last_visit_time, 'HH24:MI:SS') as last_customer_time,
      CASE
        WHEN jd.customers_planned > 0 THEN jd.customers_planned
        ELSE COALESCE(av.total_visits, 0)
      END as planned_visits,
      COALESCE(av.total_visits, 0) as completed_visits,
      COALESCE(av.productive_visits, 0) as productive_visits,
      COALESCE(av.unique_customers, 0) as unique_customers,
      COALESCE(ss.total_sales, 0) as total_sales,
      COALESCE(ss.total_orders, 0) as total_orders,
      jd.journey_status as journey_status
    FROM journey_data jd
    INNER JOIN actual_visits av ON jd.salesman_code = av.salesman_code
    LEFT JOIN salesman_sales ss ON jd.salesman_code = ss.salesman_code
    WHERE av.total_visits > 0
    ORDER BY ss.total_sales DESC, av.total_visits DESC
  `

  const result = await db.query(query)

  const complianceData = result.rows.map(row => ({
    userCode: row.user_code,
    userName: row.user_name || 'Unknown',
    routeName: row.route_name || 'Unassigned',
    journeyDate: row.journey_date,
    startTime: row.start_time || '--:--',
    endTime: row.end_time || '--:--',
    firstCustomerTime: row.first_customer_time || '--:--',
    lastCustomerTime: row.last_customer_time || '--:--',
    plannedVisits: parseInt(row.planned_visits || 0),
    completedVisits: parseInt(row.completed_visits || 0),
    productiveVisits: parseInt(row.productive_visits || 0),
    uniqueCustomers: parseInt(row.unique_customers || 0),
    totalSales: parseFloat(row.total_sales || 0),
    totalOrders: parseInt(row.total_orders || 0),
    journeyStatus: row.journey_status
  }))

  // Get REAL summary statistics from actual data
  const summaryQuery = `
    WITH journey_summary AS (
      SELECT
        COUNT(DISTINCT jm.salesman_code) as total_salesmen,
        SUM(CASE
          WHEN jm.customers_planned > 0 THEN jm.customers_planned
          ELSE 0
        END) as total_planned_from_journey
      FROM new_flat_journey_management jm
      WHERE jm.journey_date = '${dateRange}'::date
        ${salesmanFilter ? `AND jm.salesman_code = '${salesmanFilter}'` : ''}
    ),
    journey_visits_summary AS (
      SELECT
        COUNT(*) as total_visited,
        COUNT(CASE WHEN cv.is_productive = true THEN 1 END) as productive_visits
      FROM new_flat_customer_visits cv
      INNER JOIN new_flat_journey_management jm
        ON cv.salesman_code = jm.salesman_code
        AND cv.visit_date = jm.journey_date
      WHERE ${dateFilter}
        ${salesmanFilter ? `AND cv.salesman_code = '${salesmanFilter}'` : ''}
        AND jm.journey_date = '${dateRange}'::date
    ),
    journey_sales_summary AS (
      SELECT
        SUM(t.total_amount) as total_daily_sales
      FROM new_flat_transactions t
      INNER JOIN new_flat_journey_management jm
        ON t.salesman_code = jm.salesman_code
        AND ${dateFilter.replace('visit_date', 't.trx_date_only')}
      WHERE jm.journey_date = '${dateRange}'::date
        ${salesmanFilter ? `AND t.salesman_code = '${salesmanFilter}'` : ''}
    )
    SELECT
      js.total_salesmen as total_salesmen,
      CASE
        WHEN js.total_planned_from_journey > 0 THEN js.total_planned_from_journey
        ELSE jvs.total_visited
      END as total_planned,
      jvs.total_visited,
      jvs.productive_visits,
      COALESCE(jss.total_daily_sales, 0) as total_daily_sales
    FROM journey_summary js
    CROSS JOIN journey_visits_summary jvs
    CROSS JOIN journey_sales_summary jss
  `

  const summaryResult = await db.query(summaryQuery)
  const summary = summaryResult.rows[0]

  return {
    compliance: complianceData,
    summary: {
      totalSalesmen: parseInt(summary?.total_salesmen || 0),
      totalPlanned: parseInt(summary?.total_planned || 0),
      totalVisited: parseInt(summary?.total_visited || 0),
      productiveVisits: parseInt(summary?.productive_visits || 0),
      totalDailySales: parseFloat(summary?.total_daily_sales || 0)
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || 'today'
    const date = searchParams.get('date')
    const salesmanCode = searchParams.get('salesmanCode') || searchParams.get('salesman')

    // If date is provided, use it directly, otherwise use range
    const dateRange = date || range

    // Create cached version of the data fetcher (cache for 3 minutes)
    const getCachedData = unstable_cache(
      async () => fetchJourneyCompliance(dateRange, salesmanCode),
      [`field-journey-compliance-${dateRange}-${salesmanCode || 'all'}-v11`],
      {
        revalidate: 180, // Cache for 3 minutes
        tags: [`field-journey-compliance`, `field-data-${dateRange}`]
      }
    )

    const data = await getCachedData()

    // Create response with cache headers
    const response = NextResponse.json(data)
    response.headers.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360')
    response.headers.set('X-Cache-Duration', '180')

    return response

  } catch (error) {
    console.error('Error fetching journey compliance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch journey compliance data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}