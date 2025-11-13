import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

/**
 * Simple test endpoint to verify filters API data
 * Usage: GET /api/ogp/filters/test?startDate=2025-01-01&endDate=2025-12-31
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate') || '2025-01-01'
    const endDate = searchParams.get('endDate') || '2025-12-31'

    console.log('=== FILTER TEST START ===')
    console.log('Date range:', startDate, 'to', endDate)

    // Test 1: Count total records
    const countResult = await query(`
      SELECT COUNT(*) as total FROM flat_store_visits 
      WHERE visit_date >= $1 AND visit_date <= $2
    `, [startDate, endDate])
    
    console.log('Total records:', countResult.rows[0].total)

    // Test 2: Get field users
    const usersResult = await query(`
      SELECT DISTINCT 
        field_user_code as "value", 
        field_user_code || ' - ' || COALESCE(field_user_name, 'Unknown User') as "label"
      FROM flat_store_visits 
      WHERE visit_date >= $1 AND visit_date <= $2
      AND field_user_code IS NOT NULL
      ORDER BY field_user_name, field_user_code
      LIMIT 10
    `, [startDate, endDate])

    console.log('Users found:', usersResult.rows.length)
    console.log('Sample users:', usersResult.rows.slice(0, 3))

    // Test 3: Get team leaders
    const tlResult = await query(`
      SELECT DISTINCT 
        tl_code as "value",
        tl_code || ' - ' || COALESCE(tl_name, 'Unknown TL') as "label"
      FROM flat_store_visits
      WHERE visit_date >= $1 AND visit_date <= $2
      AND tl_code IS NOT NULL
      ORDER BY tl_name, tl_code
      LIMIT 10
    `, [startDate, endDate])

    console.log('Team leaders found:', tlResult.rows.length)
    console.log('Sample TLs:', tlResult.rows.slice(0, 3))

    // Test 4: Get cities
    const citiesResult = await query(`
      SELECT DISTINCT 
        city_code as "value", 
        city_code as "label"
      FROM flat_store_visits 
      WHERE visit_date >= $1 AND visit_date <= $2
      AND city_code IS NOT NULL
      ORDER BY city_code
      LIMIT 10
    `, [startDate, endDate])

    console.log('Cities found:', citiesResult.rows.length)
    console.log('Sample cities:', citiesResult.rows.slice(0, 3))

    // Test 5: Get regions
    const regionsResult = await query(`
      SELECT DISTINCT 
        region_code as "value", 
        region_code as "label"
      FROM flat_store_visits 
      WHERE visit_date >= $1 AND visit_date <= $2
      AND region_code IS NOT NULL
      ORDER BY region_code
      LIMIT 10
    `, [startDate, endDate])

    console.log('Regions found:', regionsResult.rows.length)
    console.log('Sample regions:', regionsResult.rows.slice(0, 3))

    console.log('=== FILTER TEST END ===')

    return NextResponse.json({
      success: true,
      dateRange: { startDate, endDate },
      results: {
        totalRecords: parseInt(countResult.rows[0].total),
        users: {
          count: usersResult.rows.length,
          samples: usersResult.rows.slice(0, 5)
        },
        teamLeaders: {
          count: tlResult.rows.length,
          samples: tlResult.rows.slice(0, 5)
        },
        cities: {
          count: citiesResult.rows.length,
          samples: citiesResult.rows.slice(0, 5)
        },
        regions: {
          count: regionsResult.rows.length,
          samples: regionsResult.rows.slice(0, 5)
        }
      }
    })

  } catch (error) {
    console.error('Filter test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
