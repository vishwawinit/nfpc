import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // First check if table exists
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'flat_competitor_observations'
      ) as table_exists
    `)
    
    if (!tableCheckResult.rows[0]?.table_exists) {
      return NextResponse.json({
        success: false,
        message: 'Table flat_competitor_observations does not exist.',
        data: {
          users: [],
          stores: [],
          competitorBrands: [],
          products: [],
          chains: [],
          teamLeaders: [],
          assistantLeaders: []
        }
      })
    }

    const searchParams = request.nextUrl.searchParams

    // Build WHERE clause for filtering options based on selected filters
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Date filters (primary filter for cascading)
    if (searchParams.has('startDate')) {
      conditions.push(`observation_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
    }

    if (searchParams.has('endDate')) {
      conditions.push(`observation_date <= $${paramIndex}`)
      params.push(searchParams.get('endDate'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Test each query individually to find the issue
    const results: any = {}

    try {
      const usersResult = await query(`
        SELECT DISTINCT 
          field_user_code as "value", 
          field_user_code || ' - ' || COALESCE(field_user_name, 'Unknown User') as "label"
        FROM flat_competitor_observations
        ${whereClause}
        WHERE field_user_code IS NOT NULL
        ORDER BY field_user_name
        LIMIT 10
      `, params)
      results.users = usersResult.rows
    } catch (e) {
      results.usersError = (e as Error).message
    }

    try {
      const storesResult = await query(`
        SELECT DISTINCT 
          store_code as "value", 
          store_code || ' - ' || COALESCE(store_name, 'Unknown Store') as "label"
        FROM flat_competitor_observations
        ${whereClause}
        WHERE store_code IS NOT NULL
        ORDER BY store_name
        LIMIT 10
      `, params)
      results.stores = storesResult.rows
    } catch (e) {
      results.storesError = (e as Error).message
    }

    try {
      const teamLeadersResult = await query(`
        SELECT DISTINCT 
          tl_code as "value",
          tl_code || ' - ' || COALESCE(tl_name, 'Unknown TL') as "label"
        FROM flat_competitor_observations
        ${whereClause ? `${whereClause} AND` : 'WHERE'} tl_code IS NOT NULL AND tl_code != ''
        ORDER BY tl_name
        LIMIT 10
      `, params)
      results.teamLeaders = teamLeadersResult.rows
    } catch (e) {
      results.teamLeadersError = (e as Error).message
    }

    return NextResponse.json({
      success: true,
      whereClause,
      params,
      results
    })

  } catch (error) {
    console.error('Competition Filters Test API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to test filter options',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
