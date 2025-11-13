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
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // CRITICAL: Planogram uses execution_type = '1' (OSOI uses '0')
    conditions.push(`execution_type = '1'`)

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

    if (searchParams.has('startDate') && searchParams.has('endDate')) {
      conditions.push(`execution_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
      conditions.push(`execution_date <= $${paramIndex}`)
      params.push(searchParams.get('endDate'))
      paramIndex++
    }

    if (searchParams.has('userCode')) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    if (searchParams.has('storeCode')) {
      conditions.push(`store_code = $${paramIndex}`)
      params.push(searchParams.get('storeCode'))
      paramIndex++
    }

    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    if (searchParams.has('chainCode')) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(searchParams.get('chainCode'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const [usersResult, storesResult, chainsResult, teamLeadersResult] = await Promise.all([
      query(`
        SELECT DISTINCT 
          field_user_code as "value", 
          field_user_code || ' - ' || COALESCE(field_user_name, 'Unknown User') as "label"
        FROM flat_planogram_executions 
        ${whereClause ? `${whereClause} AND` : 'WHERE'} field_user_code IS NOT NULL
        ORDER BY field_user_code
      `, params),
      query(`
        SELECT DISTINCT 
          store_code as "value", 
          store_code || ' - ' || COALESCE(store_name, 'Unknown Store') as "label"
        FROM flat_planogram_executions 
        ${whereClause ? `${whereClause} AND` : 'WHERE'} store_code IS NOT NULL
        ORDER BY store_code
      `, params),
      query(`
        SELECT DISTINCT 
          chain_code as "value", 
          chain_code || ' - ' || COALESCE(chain_name, 'Unknown Chain') as "label"
        FROM flat_planogram_executions 
        ${whereClause ? `${whereClause} AND` : 'WHERE'} chain_code IS NOT NULL
        ORDER BY chain_code
      `, params),
      query(`
        SELECT DISTINCT 
          tl_code as "value", 
          tl_code || ' - ' || COALESCE(tl_name, 'Unknown TL') as "label"
        FROM flat_planogram_executions 
        ${whereClause ? `${whereClause} AND` : 'WHERE'} tl_code IS NOT NULL
        ORDER BY tl_code
      `, params)
    ])

    return NextResponse.json({
      success: true,
      data: {
        users: usersResult.rows,
        stores: storesResult.rows,
        categories: [],  // Categories don't exist in this table
        chains: chainsResult.rows,
        teamLeaders: teamLeadersResult.rows
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Planogram Filters API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
