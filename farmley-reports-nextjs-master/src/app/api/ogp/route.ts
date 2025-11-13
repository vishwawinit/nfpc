import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Validate date parameters
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters',
        message: 'Both startDate and endDate are required'
      }, { status: 400 })
    }

    // Get hierarchy-based allowed users - ALWAYS apply if not admin
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Validate user access
    const validation = await validateApiUser(loginUserCode)
    if (!validation.isValid) {
      return validation.response!
    }
    let allowedUserCodes: string[] = []
    
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }

    // Build WHERE clause
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1
    
    // Add hierarchy filter if not admin - this restricts data to only managed users
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
      conditions.push(`field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    // Date filters
    conditions.push(`visit_date >= $${paramIndex}`)
    params.push(startDate)
    paramIndex++

    conditions.push(`visit_date <= $${paramIndex}`)
    params.push(endDate)
    paramIndex++

    // Store filter
    if (searchParams.has('storeCode')) {
      conditions.push(`store_code = $${paramIndex}`)
      params.push(searchParams.get('storeCode'))
      paramIndex++
    }

    // City filter
    if (searchParams.has('cityCode')) {
      conditions.push(`city_code = $${paramIndex}`)
      params.push(searchParams.get('cityCode'))
      paramIndex++
    }

    // Region filter
    if (searchParams.has('regionCode')) {
      conditions.push(`region_code = $${paramIndex}`)
      params.push(searchParams.get('regionCode'))
      paramIndex++
    }

    // Team Leader filter
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    // Field User filter
    if (searchParams.has('userCode')) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // No limit - get ALL visit data for comprehensive reporting
    const limit = parseInt(searchParams.get('limit') || '100000')

    // Fetch daily visit summary with GPS distance calculations (OGP Report)
    // Following the old procedure: USP_STORE_USER_VISIT_REPORT_WITH_DISTANCE
    const result = await query(`
      WITH daily_visits AS (
        SELECT
          visit_date,
          field_user_code,
          field_user_name,
          tl_code,
          tl_name,
          user_role,
          -- First check-in of the day (TIME only)
          MIN(arrival_time) as first_check_in_time,
          -- Last check-out of the day (TIME only)
          MAX(CASE WHEN out_time IS NOT NULL THEN out_time ELSE NULL END) as last_check_out_time,
          -- Total stores visited
          COUNT(DISTINCT store_code) as total_stores_visited,
          -- Coordinates for first check-in
          (ARRAY_AGG(latitude ORDER BY arrival_time ASC))[1] as first_lat,
          (ARRAY_AGG(longitude ORDER BY arrival_time ASC))[1] as first_lon,
          -- Coordinates for last check-out (where out_time is not null)
          (ARRAY_AGG(latitude ORDER BY CASE WHEN out_time IS NOT NULL THEN out_time ELSE '00:00:00'::time END DESC))[1] as last_lat,
          (ARRAY_AGG(longitude ORDER BY CASE WHEN out_time IS NOT NULL THEN out_time ELSE '00:00:00'::time END DESC))[1] as last_lon
        FROM flat_store_visits
        ${whereClause}
        GROUP BY visit_date, field_user_code, field_user_name, tl_code, tl_name, user_role
      )
      SELECT
        visit_date as "visitDate",
        tl_code as "tlCode",
        tl_name as "tlName",
        field_user_code as "userCode",
        field_user_name as "userName",
        user_role as "userRole",
        -- Combine date with time to create full timestamps (handle NULL properly)
        CASE 
          WHEN first_check_in_time IS NOT NULL 
          THEN (visit_date::text || ' ' || first_check_in_time::text)::timestamp 
          ELSE NULL 
        END as "firstCheckIn",
        CASE 
          WHEN last_check_out_time IS NOT NULL 
          THEN (visit_date::text || ' ' || last_check_out_time::text)::timestamp 
          ELSE NULL 
        END as "lastCheckOut",
        -- Calculate total time spent (in minutes)
        CASE
          WHEN first_check_in_time IS NOT NULL AND last_check_out_time IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (last_check_out_time - first_check_in_time)) / 60
          ELSE 0
        END as "totalTimeMinutes",
        total_stores_visited as "totalStoresVisited",
        first_lat as "firstLat",
        first_lon as "firstLon",
        last_lat as "lastLat",
        last_lon as "lastLon",
        -- Calculate distance traveled in KM using Haversine formula (approximation)
        CASE
          WHEN first_lat IS NOT NULL AND first_lon IS NOT NULL 
               AND last_lat IS NOT NULL AND last_lon IS NOT NULL
               AND (first_lat != last_lat OR first_lon != last_lon)
          THEN 
            -- Simplified Haversine formula: 111.045 km per degree * pythagorean distance
            111.045 * SQRT(
              POWER(last_lat - first_lat, 2) +
              POWER((last_lon - first_lon) * COS(RADIANS(first_lat)), 2)
            )
          ELSE 0
        END as "distanceKm"
      FROM daily_visits
      ORDER BY visit_date DESC, field_user_name ASC
      LIMIT $${paramIndex}
    `, [...params, limit])

    // Map and validate data
    const visitData = result.rows.map(row => ({
      visitDate: row.visitDate,
      tlCode: row.tlCode || null,
      tlName: row.tlName || null,
      userCode: row.userCode,
      userName: row.userName,
      userRole: row.userRole || null,
      firstCheckIn: row.firstCheckIn,
      lastCheckOut: row.lastCheckOut,
      totalTimeMinutes: row.totalTimeMinutes ? parseFloat(row.totalTimeMinutes) : 0,
      totalStoresVisited: row.totalStoresVisited ? parseInt(row.totalStoresVisited) : 0,
      firstLat: row.firstLat ? parseFloat(row.firstLat) : 0,
      firstLon: row.firstLon ? parseFloat(row.firstLon) : 0,
      lastLat: row.lastLat ? parseFloat(row.lastLat) : 0,
      lastLon: row.lastLon ? parseFloat(row.lastLon) : 0,
      distanceKm: row.distanceKm ? parseFloat(row.distanceKm) : 0
    }))

    // Validate we have data
    if (visitData.length === 0) {
      console.log(`No OGP data found for date range: ${startDate} to ${endDate}`)
    }

    // Calculate summary statistics
    const summary = {
      totalVisitDays: visitData.length,
      totalFieldUsers: new Set(visitData.map(v => v.userCode)).size,
      totalStoresVisited: visitData.reduce((sum, v) => sum + v.totalStoresVisited, 0),
      avgStoresPerDay: visitData.length > 0
        ? visitData.reduce((sum, v) => sum + v.totalStoresVisited, 0) / visitData.length
        : 0,
      totalDistanceCovered: visitData.reduce((sum, v) => sum + v.distanceKm, 0),
      avgDistancePerDay: visitData.length > 0
        ? visitData.reduce((sum, v) => sum + v.distanceKm, 0) / visitData.length
        : 0,
      avgTimeSpentPerDay: visitData.length > 0
        ? visitData.reduce((sum, v) => sum + v.totalTimeMinutes, 0) / visitData.length
        : 0
    }

    // Calculate cache duration based on date range span
    const start = new Date(startDate)
    const end = new Date(endDate)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    let cacheDuration: number
    if (daysDiff <= 2) cacheDuration = 600
    else if (daysDiff <= 7) cacheDuration = 900
    else if (daysDiff <= 31) cacheDuration = 1800
    else cacheDuration = 3600
    const staleWhileRevalidate = cacheDuration * 2

    return NextResponse.json({
      success: true,
      data: visitData,
      summary,
      count: visitData.length,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table (flat_store_visits)',
      reportName: 'OGP Report - Outlet Growth Plan (Store User Visit with Distance)',
      cached: true,
      cacheInfo: {
        duration: cacheDuration,
        dateRangeDays: daysDiff
      }
    }, {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheDuration}, stale-while-revalidate=${staleWhileRevalidate}`
      }
    })

  } catch (error) {
    console.error('OGP API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch OGP data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
