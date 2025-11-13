import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Cached data fetcher function using new_flat tables
async function fetchTimeMotionData(dateRange: string, salesmanCode?: string) {
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

  // Get REAL time and motion data with accurate travel time calculations INCLUDING warehouse travel
  const timeMotionQuery = `
    WITH salesman_time_data AS (
      SELECT
        salesman_code,
        MAX(salesman_name) as salesman_name,
        COUNT(*) as total_visits,
        COUNT(CASE WHEN is_productive = true THEN 1 END) as productive_visits,
        AVG(duration_minutes) as avg_visit_duration,
        SUM(duration_minutes) as total_customer_time_minutes,
        MIN(arrival_time) as first_visit_time,
        MAX(departure_time) as last_visit_time,
        COUNT(DISTINCT customer_code) as unique_customers,
        -- Calculate field time (first arrival to last departure)
        CASE
          WHEN MAX(departure_time) IS NOT NULL AND MIN(arrival_time) IS NOT NULL
          THEN EXTRACT(EPOCH FROM (MAX(departure_time) - MIN(arrival_time))) / 60
          ELSE 0
        END as customer_to_customer_time_minutes
      FROM new_flat_customer_visits
      WHERE ${dateFilter}
        ${salesmanFilter}
        AND salesman_code IS NOT NULL
        AND arrival_time IS NOT NULL
        AND departure_time IS NOT NULL
      GROUP BY salesman_code
    ),
    journey_times AS (
      SELECT DISTINCT ON (jm.salesman_code)
        jm.salesman_code,
        jm.planned_start_time,
        jm.planned_end_time
      FROM new_flat_journey_management jm
      WHERE jm.journey_date::date = '${dateFilter.match(/= '(\d{4}-\d{2}-\d{2})'/)?.[1] || 'CURRENT_DATE'}'::date
        ${salesmanFilter}
        AND jm.salesman_code IS NOT NULL
      ORDER BY jm.salesman_code, jm.journey_id DESC
    )
    SELECT
      std.salesman_code,
      std.salesman_name,
      std.total_visits,
      std.productive_visits,
      ROUND(std.avg_visit_duration, 1) as avg_visit_duration,
      std.total_customer_time_minutes as total_time_spent,
      -- Total field time = first customer arrival to last customer departure
      COALESCE(
        std.customer_to_customer_time_minutes,
        0
      ) as total_field_time_minutes,
      -- Journey start time = first customer arrival
      TO_CHAR(std.first_visit_time, 'HH24:MI:SS') as journey_start_time,
      -- Journey end time = last customer departure
      TO_CHAR(COALESCE(std.last_visit_time, std.first_visit_time), 'HH24:MI:SS') as journey_end_time,
      std.first_visit_time,
      std.last_visit_time,
      std.unique_customers,
      CASE WHEN std.total_visits > 0
        THEN ROUND((std.productive_visits::numeric / NULLIF(std.total_visits, 0)) * 100, 1)
        ELSE 0
      END as productivity_rate,
      -- Working hours = total field time (customer to customer)
      ROUND(
        std.customer_to_customer_time_minutes / 60.0,
        2
      ) as working_hours,
      -- Travel time = field time - customer time
      (
        std.customer_to_customer_time_minutes - std.total_customer_time_minutes
      ) as travel_time_minutes,
      -- Travel percentage
      CASE WHEN std.customer_to_customer_time_minutes > 0
        THEN ROUND(
          ((std.customer_to_customer_time_minutes - std.total_customer_time_minutes) /
           NULLIF(std.customer_to_customer_time_minutes, 0)) * 100,
          1
        )
        ELSE 0
      END as travel_percentage
    FROM salesman_time_data std
    WHERE std.total_visits > 0
    ORDER BY std.total_customer_time_minutes DESC
  `

  const result = await db.query(timeMotionQuery)

  const users = result.rows.map(row => ({
    code: row.salesman_code,
    name: row.salesman_name,
    totalVisits: parseInt(row.total_visits || 0),
    productiveVisits: parseInt(row.productive_visits || 0),
    avgVisitDuration: parseFloat(row.avg_visit_duration || 0),
    totalTimeSpent: parseInt(row.total_time_spent || 0),
    totalFieldTimeMinutes: parseInt(row.total_field_time_minutes || 0),
    journeyStartTime: row.journey_start_time || '--:--',
    journeyEndTime: row.journey_end_time || '--:--',
    firstVisitTime: row.first_visit_time,
    lastVisitTime: row.last_visit_time,
    uniqueCustomers: parseInt(row.unique_customers || 0),
    productivityRate: parseFloat(row.productivity_rate || 0),
    workingHours: parseFloat(row.working_hours || 0),
    travelTimeMinutes: parseInt(row.travel_time_minutes || 0),
    travelPercentage: parseFloat(row.travel_percentage || 0)
  }))

  // Summary calculations
  const totalUsers = users.length
  const totalVisits = users.reduce((sum, u) => sum + u.totalVisits, 0)
  const totalWorkingHours = users.reduce((sum, u) => sum + u.workingHours, 0)
  const avgProductivity = totalUsers > 0
    ? users.reduce((sum, u) => sum + u.productivityRate, 0) / totalUsers
    : 0

  // Get hourly breakdown of visits (productive vs non-productive by hour of day)
  const hourlyQuery = `
    SELECT
      EXTRACT(HOUR FROM arrival_time) as hour,
      COUNT(CASE WHEN is_productive = true THEN 1 END) as productive,
      COUNT(CASE WHEN is_productive = false OR is_productive IS NULL THEN 1 END) as nonproductive
    FROM new_flat_customer_visits
    WHERE ${dateFilter}
      ${salesmanFilter}
      AND salesman_code IS NOT NULL
      AND arrival_time IS NOT NULL
    GROUP BY EXTRACT(HOUR FROM arrival_time)
    ORDER BY hour
  `

  const hourlyResult = await db.query(hourlyQuery)

  const hourlyBreakdown = hourlyResult.rows.map(row => ({
    hour: parseInt(row.hour || 0),
    productive: parseInt(row.productive || 0),
    nonproductive: parseInt(row.nonproductive || 0)
  }))

  return {
    users: users,
    summary: {
      totalUsers,
      totalVisits,
      totalWorkingHours,
      avgProductivity: Math.round(avgProductivity * 10) / 10
    },
    hourlyBreakdown: hourlyBreakdown
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
      async () => fetchTimeMotionData(dateRange, salesmanCode),
      [`field-time-motion-${dateRange}-${salesmanCode || 'all'}-v11`],
      {
        revalidate: 180, // Cache for 3 minutes
        tags: [`field-time-motion`, `field-data-${dateRange}`]
      }
    )

    const data = await getCachedData()

    // Create response with cache headers
    const response = NextResponse.json(data)
    response.headers.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360')
    response.headers.set('X-Cache-Duration', '180')

    return response

  } catch (error) {
    console.error('Error fetching time & motion data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch time & motion data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}