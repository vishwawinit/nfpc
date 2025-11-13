import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Enable ISR with 60 second revalidation
export const revalidate = 60

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Get hierarchy-based allowed users
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Validate user access
    const validation = await validateApiUser(loginUserCode)
    if (!validation.isValid) {
      return validation.response!
    }
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
      console.log(`[Sampling Filters API] Login User: ${loginUserCode}, Is Admin: false, Allowed Users Count: ${allowedUserCodes.length}`)
    } else {
      console.log(`[Sampling Filters API] Login User: ${loginUserCode}, Is Admin: ${loginUserCode ? isAdmin(loginUserCode) : 'N/A'}`)
    }

    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Date filters
    if (searchParams.has('startDate') && searchParams.has('endDate')) {
      conditions.push(`sampling_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
      conditions.push(`sampling_date <= $${paramIndex}`)
      params.push(searchParams.get('endDate'))
      paramIndex++
    }

    // Team Leader filter (for cascading)
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    // User filter
    if (searchParams.has('userCode')) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    // Store filter
    if (searchParams.has('storeCode')) {
      conditions.push(`store_code = $${paramIndex}`)
      params.push(searchParams.get('storeCode'))
      paramIndex++
    }

    // Hierarchy filter - filter on field_user_code only (same pattern as Daily Sales)
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, i) => `$${paramIndex + i}`).join(', ')
      conditions.push(`field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get distinct users, stores, SKUs, and chains
    const [usersResult, storesResult, skusResult, chainsResult] = await Promise.all([
      query(`
        SELECT DISTINCT 
          field_user_code as "value", 
          field_user_code || ' - ' || COALESCE(field_user_name, 'Unknown User') as "label",
          field_user_name
        FROM flat_product_sampling ${whereClause}
        ORDER BY field_user_name
      `, params),
      query(`
        SELECT DISTINCT 
          store_code as "value", 
          store_code || ' - ' || COALESCE(store_name, 'Unknown Store') as "label",
          store_name
        FROM flat_product_sampling ${whereClause}
        ORDER BY store_name
      `, params),
      query(`
        SELECT DISTINCT sku_code as "value", sku_name as "label"
        FROM flat_product_sampling ${whereClause ? `${whereClause} AND` : 'WHERE'} sku_code IS NOT NULL AND sku_code != ''
        ORDER BY sku_name
      `, params),
      query(`
        SELECT DISTINCT 
          chain_code as "value", 
          chain_code || ' - ' || COALESCE(chain_name, 'Unknown Chain') as "label",
          chain_name
        FROM flat_product_sampling ${whereClause ? `${whereClause} AND` : 'WHERE'} chain_code IS NOT NULL AND chain_code != ''
        ORDER BY chain_name
      `, params)
    ])

    // Get team leaders directly from the data based on date range
    const teamLeadersResult = await query(`
      SELECT DISTINCT 
        tl_code as "value",
        tl_code || ' - ' || COALESCE(tl_name, 'Unknown TL') as "label",
        tl_name
      FROM flat_product_sampling
      ${whereClause ? `${whereClause} AND` : 'WHERE'} tl_code IS NOT NULL AND tl_code != ''
      ORDER BY tl_name
    `, params)

    // Get assistant leaders if needed
    let assistantLeaders: any[] = []

    return NextResponse.json({
      success: true,
      data: {
        users: usersResult.rows,
        stores: storesResult.rows,
        skus: skusResult.rows,
        chains: chainsResult.rows,
        teamLeaders: teamLeadersResult.rows,
        assistantLeaders
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Sampling Filters API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
