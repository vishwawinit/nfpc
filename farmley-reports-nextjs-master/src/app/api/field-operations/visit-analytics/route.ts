import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Cached data fetcher function using new_flat_transactions
async function fetchVisitAnalytics(dateRange: string, salesmanCode?: string) {
  await db.initialize()

  // Build date filter
  let dateFilter = ''

  // Check if dateRange is a specific date (YYYY-MM-DD format)
  if (dateRange && dateRange.match(/^\d{4}-\d{2}-\d{2}$/)) {
    dateFilter = `trx_date_only = '${dateRange}'::date`
  } else {
    // Otherwise treat as a range
    switch(dateRange) {
      case 'today':
        dateFilter = `trx_date_only = CURRENT_DATE`
        break
      case 'yesterday':
        dateFilter = `trx_date_only = CURRENT_DATE - INTERVAL '1 day'`
        break
      case 'thisWeek':
        dateFilter = `trx_date_only >= CURRENT_DATE - INTERVAL '6 days' AND trx_date_only <= CURRENT_DATE`
        break
      case 'thisMonth':
        dateFilter = `trx_date_only >= DATE_TRUNC('month', CURRENT_DATE) AND trx_date_only <= CURRENT_DATE`
        break
      case 'lastMonth':
        dateFilter = `trx_date_only >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND trx_date_only < DATE_TRUNC('month', CURRENT_DATE)`
        break
      default:
        dateFilter = `trx_date_only = CURRENT_DATE`
    }
  }

  // Build salesman filter
  const salesmanFilter = salesmanCode && salesmanCode !== 'all'
    ? `AND salesman_code = '${salesmanCode}'`
    : ''

  // FIXED LOGIC: Customer classification based on OVERALL sales history, not just selected date
  const customerTypeQuery = `
    WITH customer_sales AS (
      SELECT
        t.customer_code,
        t.customer_name,
        SUM(t.total_amount) as customer_sales
      FROM new_flat_transactions t
      WHERE t.customer_code IS NOT NULL
        ${salesmanFilter}
      GROUP BY t.customer_code, t.customer_name
    ),
    classified AS (
      SELECT
        customer_code,
        customer_name,
        customer_sales,
        CASE
          WHEN customer_sales >= 100000 THEN 'VIP Account'
          WHEN customer_sales >= 50000 THEN 'Key Account'
          WHEN customer_sales >= 20000 THEN 'A Class'
          WHEN customer_sales >= 10000 THEN 'B Class'
          WHEN customer_sales >= 5000 THEN 'C Class'
          ELSE 'New Customer'
        END as classification
      FROM customer_sales
    ),
    customer_visits_classified AS (
      SELECT
        cv.customer_code,
        cv.duration_minutes,
        cv.is_productive,
        COALESCE(c.classification, 'New Customer') as customer_type
      FROM new_flat_customer_visits cv
      LEFT JOIN classified c ON cv.customer_code = c.customer_code
      WHERE ${dateFilter.replace('trx_date_only', 'visit_date')}
        ${salesmanFilter}
        AND cv.salesman_code IS NOT NULL
        AND cv.duration_minutes IS NOT NULL
        AND cv.duration_minutes > 0
    ),
    customer_type_stats AS (
      SELECT
        customer_type,
        AVG(duration_minutes) as avg_duration,
        COUNT(*) as visit_count,
        COUNT(DISTINCT customer_code) as unique_customers
      FROM customer_visits_classified
      WHERE customer_type IS NOT NULL
      GROUP BY customer_type
    ),
    all_types AS (
      SELECT 'VIP Account' as customer_type, 1 as sort_order
      UNION ALL SELECT 'Key Account', 2
      UNION ALL SELECT 'A Class', 3
      UNION ALL SELECT 'B Class', 4
      UNION ALL SELECT 'C Class', 5
      UNION ALL SELECT 'New Customer', 6
    )
    SELECT
      at.customer_type,
      COALESCE(ROUND(cts.avg_duration, 0), 0) as avg_duration,
      COALESCE(cts.visit_count, 0) as visit_count,
      COALESCE(cts.unique_customers, 0) as unique_customers,
      at.sort_order
    FROM all_types at
    LEFT JOIN customer_type_stats cts ON at.customer_type = cts.customer_type
    ORDER BY at.sort_order
  `

  const customerTypeResult = await db.query(customerTypeQuery)

  const customerTypeAnalytics = customerTypeResult.rows.map(row => ({
    type: row.customer_type || 'Unknown',
    visitCount: parseInt(row.visit_count || 0),
    productiveVisits: parseInt(row.visit_count || 0), // Use visit count as productive
    avgDuration: Math.round(parseFloat(row.avg_duration || 0)),
    uniqueCustomers: parseInt(row.unique_customers || 0),
    conversionRate: row.visit_count > 0 ? 100 : 0
  }))

  // Get best visiting times with conversion rates
  const timeSlotQuery = `
    WITH visit_times AS (
      SELECT
        cv.visit_id,
        cv.customer_code,
        cv.arrival_time,
        CASE
          WHEN EXTRACT(HOUR FROM cv.arrival_time) >= 6 AND EXTRACT(HOUR FROM cv.arrival_time) < 9 THEN '6:00-9:00 AM'
          WHEN EXTRACT(HOUR FROM cv.arrival_time) >= 9 AND EXTRACT(HOUR FROM cv.arrival_time) < 10 THEN '9:00-10:00 AM'
          WHEN EXTRACT(HOUR FROM cv.arrival_time) >= 10 AND EXTRACT(HOUR FROM cv.arrival_time) < 11 THEN '10:00-11:00 AM'
          WHEN EXTRACT(HOUR FROM cv.arrival_time) >= 11 AND EXTRACT(HOUR FROM cv.arrival_time) < 12 THEN '11:00-12:00 PM'
          WHEN EXTRACT(HOUR FROM cv.arrival_time) >= 12 AND EXTRACT(HOUR FROM cv.arrival_time) < 14 THEN '12:00-2:00 PM'
          WHEN EXTRACT(HOUR FROM cv.arrival_time) >= 14 AND EXTRACT(HOUR FROM cv.arrival_time) < 15 THEN '2:00-3:00 PM'
          WHEN EXTRACT(HOUR FROM cv.arrival_time) >= 15 AND EXTRACT(HOUR FROM cv.arrival_time) < 16 THEN '3:00-4:00 PM'
          WHEN EXTRACT(HOUR FROM cv.arrival_time) >= 16 AND EXTRACT(HOUR FROM cv.arrival_time) < 17 THEN '4:00-5:00 PM'
          WHEN EXTRACT(HOUR FROM cv.arrival_time) >= 17 AND EXTRACT(HOUR FROM cv.arrival_time) < 18 THEN '5:00-6:00 PM'
          ELSE 'After Hours'
        END as time_slot,
        EXTRACT(HOUR FROM cv.arrival_time) as hour_num,
        CASE WHEN t.customer_code IS NOT NULL THEN 1 ELSE 0 END as has_transaction
      FROM new_flat_customer_visits cv
      LEFT JOIN (
        SELECT DISTINCT customer_code
        FROM new_flat_transactions
        WHERE ${dateFilter}
      ) t ON cv.customer_code = t.customer_code
      WHERE ${dateFilter.replace('trx_date_only', 'visit_date')}
        ${salesmanFilter}
        AND cv.salesman_code IS NOT NULL
        AND cv.arrival_time IS NOT NULL
    )
    SELECT
      time_slot,
      MIN(hour_num) as sort_order,
      COUNT(*) as total_visits,
      SUM(has_transaction) as productive_visits,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((SUM(has_transaction)::numeric / COUNT(*)) * 100, 0)
        ELSE 0
      END as conversion_rate
    FROM visit_times
    GROUP BY time_slot
    ORDER BY sort_order
  `

  const timeSlotResult = await db.query(timeSlotQuery)

  const bestVisitingTimes = timeSlotResult.rows.map(row => ({
    timeSlot: row.time_slot,
    totalVisits: parseInt(row.total_visits || 0),
    productiveVisits: parseInt(row.productive_visits || 0),
    conversionRate: parseFloat(row.conversion_rate || 0)
  }))

  // Get field activity summary from new_flat_customer_visits
  const summaryQuery = `
    SELECT
      COUNT(DISTINCT salesman_code) as total_salesmen,
      COUNT(DISTINCT customer_code) as total_customers,
      COUNT(*) as total_visits,
      COUNT(CASE WHEN is_productive = true THEN 1 END) as productive_visits,
      AVG(duration_minutes) as avg_visit_duration,
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(CASE WHEN is_productive = true THEN 1 END)::numeric / COUNT(*)) * 100, 1)
        ELSE 0
      END as conversion_rate
    FROM new_flat_customer_visits
    WHERE ${dateFilter.replace('trx_date_only', 'visit_date')}
      ${salesmanFilter}
      AND salesman_code IS NOT NULL
  `

  const summaryResult = await db.query(summaryQuery)
  const summary = summaryResult.rows[0] || {}

  // Get performance trend
  let trendQuery = ''
  const isSpecificDate = dateRange && dateRange.match(/^\d{4}-\d{2}-\d{2}$/)

  if (isSpecificDate || dateRange === 'today' || dateRange === 'yesterday') {
    // Hourly trend from new_flat_customer_visits
    trendQuery = `
      WITH hourly_data AS (
        SELECT
          DATE_TRUNC('hour', arrival_time) as period,
          COUNT(*) as visits,
          COUNT(CASE WHEN is_productive = true THEN 1 END) as productive,
          AVG(duration_minutes) as avg_duration
        FROM new_flat_customer_visits
        WHERE ${dateFilter.replace('trx_date_only', 'visit_date')}
          ${salesmanFilter}
          AND salesman_code IS NOT NULL
          AND arrival_time IS NOT NULL
        GROUP BY DATE_TRUNC('hour', arrival_time)
      )
      SELECT
        TO_CHAR(period, 'HH24:00') as period_label,
        visits,
        productive,
        ROUND(avg_duration, 1) as avg_duration,
        CASE WHEN visits > 0
          THEN ROUND((productive::numeric / visits) * 100, 1)
          ELSE 0
        END as conversion_rate
      FROM hourly_data
      ORDER BY period
    `
  } else {
    // Daily trend from new_flat_customer_visits
    trendQuery = `
      WITH daily_data AS (
        SELECT
          visit_date as period,
          COUNT(*) as visits,
          COUNT(CASE WHEN is_productive = true THEN 1 END) as productive,
          AVG(duration_minutes) as avg_duration
        FROM new_flat_customer_visits
        WHERE ${dateFilter.replace('trx_date_only', 'visit_date')}
          ${salesmanFilter}
          AND salesman_code IS NOT NULL
        GROUP BY visit_date
      )
      SELECT
        TO_CHAR(period, 'Mon DD') as period_label,
        visits,
        productive,
        ROUND(avg_duration, 1) as avg_duration,
        CASE WHEN visits > 0
          THEN ROUND((productive::numeric / visits) * 100, 1)
          ELSE 0
        END as conversion_rate
      FROM daily_data
      ORDER BY period
    `
  }

  const trendResult = await db.query(trendQuery)
  const performanceTrend = trendResult.rows.map(row => ({
    period: row.period_label,
    visits: parseInt(row.visits || 0),
    productive: parseInt(row.productive || 0),
    avgDuration: parseFloat(row.avg_duration || 0),
    conversionRate: parseFloat(row.conversion_rate || 0)
  }))

  return {
    summary: {
      totalSalesmen: parseInt(summary.total_salesmen || 0),
      totalVisits: parseInt(summary.total_visits || 0),
      productiveVisits: parseInt(summary.productive_visits || 0),
      avgVisitDuration: Math.round(parseFloat(summary.avg_visit_duration || 0)),
      uniqueCustomers: parseInt(summary.total_customers || 0),
      conversionRate: parseFloat(summary.conversion_rate || 0)
    },
    customerTypeAnalytics,
    bestVisitingTimes,
    performanceTrend,
    dateRange,
    salesmanCode: salesmanCode || 'all'
  }
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
      async () => fetchVisitAnalytics(dateRange, salesmanCode),
      [`field-visit-analytics-${dateRange}-${salesmanCode || 'all'}-v11`],
      {
        revalidate: 180, // Cache for 3 minutes
        tags: [`field-analytics`, `field-data-${dateRange}`]
      }
    )

    const data = await getCachedData()

    // Create response with cache headers
    const response = NextResponse.json({
      success: true,
      data
    })
    response.headers.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360')
    response.headers.set('X-Cache-Duration', '180')

    return response

  } catch (error) {
    console.error('Error fetching visit analytics:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch visit analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}