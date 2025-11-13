import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Mark as dynamic route (uses search params)
export const dynamic = 'force-dynamic'
// Enable ISR with 60 second revalidation
export const revalidate = 60

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Build WHERE clause for filtering options based on selected filters
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

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

    // Add hierarchy filter if not admin - this restricts data to only managed users
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
      conditions.push(`field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    // Date filters (primary filter for cascading)
    if (searchParams.has('startDate')) {
      conditions.push(`initiative_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
    }

    if (searchParams.has('endDate')) {
      conditions.push(`initiative_date <= $${paramIndex}`)
      params.push(searchParams.get('endDate'))
      paramIndex++
    }

    // Team Leader filter
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    // User filter (for cascading to stores)
    if (searchParams.has('userCode')) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    // Store filter (for cascading to users)
    if (searchParams.has('storeCode')) {
      conditions.push(`store_code = $${paramIndex}`)
      params.push(searchParams.get('storeCode'))
      paramIndex++
    }

    // Chain filter
    if (searchParams.has('chainCode')) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(searchParams.get('chainCode'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Fetch all filter options from flat table (data is already denormalized)
    const [teamLeadersResult, usersResult, storesResult, chainsResult, typesResult] = await Promise.all([
      // Team Leaders
      query(`
        SELECT DISTINCT 
          tl_code as "value", 
          tl_code || ' - ' || COALESCE(tl_name, 'Unknown TL') as "label"
        FROM flat_broadcast_initiatives
        ${whereClause ? `${whereClause} AND` : 'WHERE'} tl_code IS NOT NULL AND tl_code != ''
        ORDER BY tl_code
      `, params),
      
      // Field Users
      query(`
        SELECT DISTINCT
          field_user_code as "value",
          field_user_code || ' - ' || COALESCE(field_user_name, 'Unknown User') as "label"
        FROM flat_broadcast_initiatives
        ${whereClause ? `${whereClause} AND` : 'WHERE'} field_user_code IS NOT NULL AND field_user_code != ''
        ORDER BY field_user_code
      `, params),
      
      // Stores
      query(`
        SELECT DISTINCT
          store_code as "value",
          store_code || ' - ' || COALESCE(store_name, 'Unknown Store') as "label"
        FROM flat_broadcast_initiatives
        ${whereClause ? `${whereClause} AND` : 'WHERE'} store_code IS NOT NULL AND store_code != ''
        ORDER BY store_code
      `, params),
      
      // Chains
      query(`
        SELECT DISTINCT
          chain_code as "value",
          chain_code as "label"
        FROM flat_broadcast_initiatives
        ${whereClause ? `${whereClause} AND` : 'WHERE'} chain_code IS NOT NULL AND chain_code != ''
        ORDER BY chain_code
      `, params),
      
      // Initiative Types
      query(`
        SELECT DISTINCT
          initiative_type as "value",
          initiative_type as "label"
        FROM flat_broadcast_initiatives
        ${whereClause ? `${whereClause} AND` : 'WHERE'} initiative_type IS NOT NULL AND initiative_type != ''
        ORDER BY initiative_type
      `, params)
    ])

    return NextResponse.json({
      success: true,
      data: {
        teamLeaders: teamLeadersResult.rows,
        users: usersResult.rows,
        stores: storesResult.rows,
        chains: chainsResult.rows,
        initiativeTypes: typesResult.rows
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })

  } catch (error) {
    console.error('Broadcast Initiative Filters API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
