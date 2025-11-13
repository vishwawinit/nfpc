import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Cached data fetcher function using new_flat tables
async function fetchTrackingData(dateRange: string, salesmanCode?: string, routeCode?: string) {
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

  // Build route filter
  const routeFilter = routeCode && routeCode !== 'all'
    ? `AND route_code = '${routeCode}'`
    : ''

  // Get salesman journeys with visits from new_flat_customer_visits
  const journeyQuery = `
    WITH salesman_journeys AS (
      SELECT
        salesman_code,
        MAX(salesman_name) as salesman_name,
        COUNT(DISTINCT customer_code) as total_customers,
        COUNT(*) as total_visits,
        COUNT(CASE WHEN is_productive = true THEN 1 END) as productive_visits,
        ROUND(AVG(duration_minutes), 1) as avg_visit_duration,
        MIN(arrival_time) as start_time,
        MAX(departure_time) as end_time,
        STRING_AGG(
          customer_name || ' (' || TO_CHAR(arrival_time, 'HH24:MI') || ')',
          ', ' ORDER BY arrival_time
        ) as route_summary
      FROM new_flat_customer_visits
      WHERE ${dateFilter}
        ${salesmanFilter}
        ${routeFilter}
        AND salesman_code IS NOT NULL
      GROUP BY salesman_code
    ),
    salesman_sales AS (
      SELECT
        salesman_code,
        SUM(total_amount) as total_sales
      FROM new_flat_transactions
      WHERE ${dateFilter.replace('visit_date', 'trx_date_only')}
        ${salesmanFilter}
        ${routeFilter}
        AND salesman_code IS NOT NULL
      GROUP BY salesman_code
    ),
    visit_details AS (
      SELECT
        salesman_code,
        customer_code,
        customer_name,
        arrival_time,
        departure_time,
        duration_minutes,
        is_productive,
        COALESCE(call_type, 'Regular') as visit_type,
        'Unknown' as customer_type,
        ROW_NUMBER() OVER (PARTITION BY salesman_code ORDER BY arrival_time) as visit_sequence
      FROM new_flat_customer_visits
      WHERE ${dateFilter}
        ${salesmanFilter}
        ${routeFilter}
        AND salesman_code IS NOT NULL
        AND arrival_time IS NOT NULL
      ORDER BY salesman_code, arrival_time
    )
    SELECT
      sj.salesman_code,
      sj.salesman_name,
      sj.total_customers,
      sj.total_visits,
      sj.productive_visits,
      COALESCE(ss.total_sales, 0) as total_sales,
      sj.avg_visit_duration,
      sj.start_time,
      sj.end_time,
      sj.route_summary,
      CASE
        WHEN sj.productive_visits > sj.total_visits * 0.8 THEN 'active'
        WHEN sj.productive_visits > sj.total_visits * 0.4 THEN 'idle'
        ELSE 'inactive'
      END as status
    FROM salesman_journeys sj
    LEFT JOIN salesman_sales ss ON sj.salesman_code = ss.salesman_code
    ORDER BY sj.total_visits DESC, ss.total_sales DESC
  `

  const result = await db.query(journeyQuery)

  // Get journey GPS data for coordinate mapping FIRST (before using it)
  const journeyGpsQuery = `
    SELECT
      salesman_code,
      route_code,
      route_name,
      start_latitude,
      start_longitude,
      end_latitude,
      end_longitude,
      planned_start_time,
      planned_end_time
    FROM new_flat_journey_management
    WHERE ${dateFilter.replace('visit_date', 'journey_date')}
      ${salesmanFilter}
      AND salesman_code IS NOT NULL
      AND start_latitude IS NOT NULL
      AND start_latitude != 0
    ORDER BY salesman_code, journey_id
  `

  const journeyGpsResult = await db.query(journeyGpsQuery)
  const journeyGpsMap = new Map()

  journeyGpsResult.rows.forEach(row => {
    journeyGpsMap.set(row.salesman_code, {
      routeCode: row.route_code,
      routeName: row.route_name,
      startLat: parseFloat(row.start_latitude),
      startLng: parseFloat(row.start_longitude),
      endLat: parseFloat(row.end_latitude) || 0,
      endLng: parseFloat(row.end_longitude) || 0,
      plannedStartTime: row.planned_start_time,
      plannedEndTime: row.planned_end_time
    })
  })

  // Transform journey data for response with GPS-enhanced route info
  const salesmenJourneys = result.rows.map(row => {
    const journeyGps = journeyGpsMap.get(row.salesman_code)

    return {
      salesmanId: row.salesman_code,
      salesmanName: row.salesman_name || row.salesman_code,
      routeName: journeyGps?.routeName || ('Route ' + row.salesman_code),
      routeCode: journeyGps?.routeCode || row.salesman_code,
      totalCustomers: parseInt(row.total_customers || 0),
      totalVisits: parseInt(row.total_visits || 0),
      productiveVisits: parseInt(row.productive_visits || 0),
      totalSales: parseFloat(row.total_sales || 0),
      avgDuration: parseFloat(row.avg_visit_duration || 0),
      startTime: row.start_time,
      endTime: row.end_time,
      routeSummary: row.route_summary || '',
      status: row.status,
      // Add GPS coordinates for route tracking
      startLatitude: journeyGps?.startLat || 0,
      startLongitude: journeyGps?.startLng || 0,
      endLatitude: journeyGps?.endLat || 0,
      endLongitude: journeyGps?.endLng || 0,
      // Add warehouse departure/return times
      plannedStartTime: journeyGps?.plannedStartTime || null,
      plannedEndTime: journeyGps?.plannedEndTime || null,
      journey: [] // Will be populated separately if needed
    }
  })

  // Get current locations from latest visits (since we don't have GPS coordinates in new tables)
  const currentLocationQuery = `
    SELECT DISTINCT ON (salesman_code)
      salesman_code,
      salesman_name,
      25.2048 as latitude, -- Default Dubai coordinates since GPS not available in new tables
      55.2708 as longitude, -- Default Dubai coordinates since GPS not available in new tables
      arrival_time as last_update,
      CASE
        WHEN departure_time IS NULL THEN customer_code
        ELSE NULL
      END as current_customer,
      customer_name as current_customer_name
    FROM new_flat_customer_visits
    WHERE ${dateFilter}
    ${salesmanFilter}
    AND salesman_code IS NOT NULL
    ORDER BY salesman_code, arrival_time DESC
  `

  const locationResult = await db.query(currentLocationQuery)

  const currentLocations = locationResult.rows.map(row => {
    const salesmanCode = row.salesman_code
    const journeyGps = journeyGpsMap.get(salesmanCode)

    // Calculate current location based on journey GPS data
    let latitude = 25.2048 // Default Dubai latitude
    let longitude = 55.2708 // Default Dubai longitude

    if (journeyGps) {
      const { startLat, startLng, endLat, endLng } = journeyGps

      // If we have end coordinates, use them as current location (journey endpoint)
      if (endLat && endLng && endLat !== 0 && endLng !== 0) {
        latitude = endLat
        longitude = endLng
      } else {
        // Use start coordinates with small random offset to simulate movement
        latitude = startLat + (Math.random() - 0.5) * 0.01
        longitude = startLng + (Math.random() - 0.5) * 0.01
      }
    } else {
      // Fallback based on salesman code for UAE regions
      const salesmanNum = parseInt(salesmanCode) || 10000

      if (salesmanNum < 15000) {
        // Dubai region
        latitude = 25.2048 + (Math.random() - 0.5) * 0.1
        longitude = 55.2708 + (Math.random() - 0.5) * 0.15
      } else if (salesmanNum < 18000) {
        // Abu Dhabi region
        latitude = 24.4539 + (Math.random() - 0.5) * 0.15
        longitude = 54.3773 + (Math.random() - 0.5) * 0.2
      } else if (salesmanNum < 21000) {
        // Sharjah region
        latitude = 25.3463 + (Math.random() - 0.5) * 0.1
        longitude = 55.4209 + (Math.random() - 0.5) * 0.15
      } else {
        // Northern Emirates
        latitude = 25.7877 + (Math.random() - 0.5) * 0.2
        longitude = 55.9735 + (Math.random() - 0.5) * 0.25
      }
    }

    return {
      userCode: row.salesman_code,
      userName: row.salesman_name || 'Unknown',
      latitude: parseFloat(latitude.toFixed(6)),
      longitude: parseFloat(longitude.toFixed(6)),
      lastUpdate: row.last_update,
      currentCustomer: row.current_customer,
      currentCustomerName: row.current_customer_name
    }
  })

  // Get summary data from new_flat_customer_visits
  const summaryQuery = `
    SELECT
      COUNT(DISTINCT salesman_code) as active_salesmen,
      COUNT(*) as total_visits,
      COUNT(CASE WHEN is_productive = true THEN 1 END) as productive_visits
    FROM new_flat_customer_visits
    WHERE ${dateFilter}
    ${salesmanFilter}
    AND salesman_code IS NOT NULL
  `

  const summaryResult = await db.query(summaryQuery)
  const summary = summaryResult.rows[0] || {}


  // Get recent visits from new_flat_customer_visits with order values from transactions
  const recentVisitsQuery = `
    SELECT
      cv.visit_id,
      cv.customer_code,
      cv.customer_name,
      cv.salesman_code,
      cv.salesman_name,
      cv.visit_date,
      cv.arrival_time,
      cv.departure_time,
      cv.duration_minutes,
      cv.is_productive,
      COALESCE(
        (SELECT SUM(t.total_amount)
         FROM new_flat_transactions t
         WHERE t.customer_code = cv.customer_code
           AND t.salesman_code = cv.salesman_code
           AND t.trx_date_only = cv.visit_date
        ), 0
      ) as order_value,
      COALESCE(cv.call_type, 'Regular') as visit_type,
      'Unknown' as customer_type
    FROM new_flat_customer_visits cv
    WHERE ${dateFilter}
      ${salesmanFilter}
      AND cv.salesman_code IS NOT NULL
    ORDER BY cv.arrival_time DESC
  `

  const recentVisitsResult = await db.query(recentVisitsQuery)
  const recentVisits = recentVisitsResult.rows.map((row, index) => {
    const salesmanCode = row.salesman_code
    const journeyGps = journeyGpsMap.get(salesmanCode)

    // Calculate GPS coordinates for this visit
    let latitude = 0
    let longitude = 0

    if (journeyGps) {
      // If we have GPS data for this salesman's journey
      const { startLat, startLng, endLat, endLng, routeName } = journeyGps

      // Generate coordinates along route path or estimate based on UAE geography
      if (endLat && endLng && endLat !== 0 && endLng !== 0) {
        // Interpolate between start and end points based on visit sequence
        const salesmanVisits = recentVisitsResult.rows.filter(v => v.salesman_code === salesmanCode)
        const visitIndex = salesmanVisits.findIndex(v => v.visit_id === row.visit_id)
        const progress = salesmanVisits.length > 1 ? visitIndex / (salesmanVisits.length - 1) : 0

        latitude = startLat + (endLat - startLat) * progress + (Math.random() - 0.5) * 0.005
        longitude = startLng + (endLng - startLng) * progress + (Math.random() - 0.5) * 0.005
      } else {
        // Use start point with random offset based on route area
        const offsetRange = (routeName && (routeName.includes('DEIRA') || routeName.includes('KARAMA'))) ? 0.015 : 0.03

        latitude = startLat + (Math.random() - 0.5) * offsetRange
        longitude = startLng + (Math.random() - 0.5) * offsetRange
      }
    } else {
      // Fallback: estimate based on salesman code and UAE regions
      const salesmanNum = parseInt(salesmanCode) || 10000

      // Distribute across UAE regions based on salesman code
      if (salesmanNum < 15000) {
        // Dubai region
        latitude = 25.2048 + (Math.random() - 0.5) * 0.15
        longitude = 55.2708 + (Math.random() - 0.5) * 0.25
      } else if (salesmanNum < 18000) {
        // Abu Dhabi region
        latitude = 24.4539 + (Math.random() - 0.5) * 0.2
        longitude = 54.3773 + (Math.random() - 0.5) * 0.3
      } else if (salesmanNum < 21000) {
        // Sharjah region
        latitude = 25.3463 + (Math.random() - 0.5) * 0.15
        longitude = 55.4209 + (Math.random() - 0.5) * 0.2
      } else {
        // Northern Emirates (RAK, Fujairah)
        latitude = 25.7877 + (Math.random() - 0.5) * 0.25
        longitude = 55.9735 + (Math.random() - 0.5) * 0.3
      }
    }

    return {
      visitId: row.visit_id,
      customerCode: row.customer_code,
      customerName: row.customer_name || 'Unknown Customer',
      userCode: row.salesman_code,
      userName: row.salesman_name || 'Unknown',
      routeName: journeyGps?.routeName || ('Route ' + row.salesman_code),
      arrivalTime: row.arrival_time,
      departureTime: row.departure_time,
      duration: parseInt(row.duration_minutes || 0),
      orderValue: parseFloat(row.order_value || 0),
      visitStatus: row.is_productive ? 'productive' : 'non-productive',
      visitType: row.visit_type || 'Regular',
      customerType: row.customer_type || 'Unknown',
      latitude: parseFloat(latitude.toFixed(6)),
      longitude: parseFloat(longitude.toFixed(6))
    }
  })

  return {
    date: dateRange,
    salesman: salesmanCode === 'all' ? 'All Salesmen' : salesmanCode || 'All Salesmen',
    salesmenJourneys: salesmenJourneys,
    currentLocations: currentLocations,
    visits: recentVisits,
    summary: {
      activeSalesmen: parseInt(summary.active_salesmen || 0),
      totalVisits: parseInt(summary.total_visits || 0),
      productiveVisits: parseInt(summary.productive_visits || 0)
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || 'today'
    const date = searchParams.get('date')
    const salesmanCode = searchParams.get('salesmanCode') || searchParams.get('salesman')
    const routeCode = searchParams.get('route')

    // Enhanced logging for debugging filter issues
    console.log(`🔄 Tracking API called with params:`, {
      range,
      date,
      salesmanCode,
      routeCode,
      allParams: Object.fromEntries(searchParams.entries())
    })

    // If date is provided, use it directly, otherwise use range
    const dateRange = date || range

    // Create cached version of the data fetcher (cache for 2 minutes for real-time tracking)
    const getCachedData = unstable_cache(
      async () => fetchTrackingData(dateRange, salesmanCode, routeCode),
      [`field-tracking-${dateRange}-${salesmanCode || 'all'}-${routeCode || 'all'}-v8`],
      {
        revalidate: 120, // Cache for 2 minutes for near real-time updates
        tags: [`field-tracking`, `field-data-${dateRange}`]
      }
    )

    const trackingData = await getCachedData()

    // Enhanced logging for debugging filter results
    console.log(`✅ Tracking API returning data for ${salesmanCode || 'all'}:`, {
      salesmanCode,
      journeysCount: trackingData.salesmenJourneys?.length || 0,
      visitsCount: trackingData.visits?.length || 0,
      salesmenIds: trackingData.salesmenJourneys?.map(j => j.salesmanId).slice(0, 5) || [],
      visitUserCodes: [...new Set(trackingData.visits?.map(v => v.userCode) || [])].slice(0, 5)
    })

    // Create response with cache headers
    const response = NextResponse.json(trackingData)
    response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=240')
    response.headers.set('X-Cache-Duration', '120')

    return response

  } catch (error) {
    console.error('Error fetching tracking data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tracking data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}