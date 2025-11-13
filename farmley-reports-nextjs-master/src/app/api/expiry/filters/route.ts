import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { FILTERS_CACHE_DURATION, getCacheControlHeader } from '@/lib/cache-utils'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Filters cache for 15 minutes

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    console.log('Expiry Filters API - Received params:', Object.fromEntries(searchParams.entries()))

    // Always require date range to prevent full table scan
    if (!searchParams.has('startDate') || !searchParams.has('endDate')) {
      return NextResponse.json({
        success: false,
        error: 'Date range required',
        message: 'startDate and endDate parameters are required'
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

    // Add hierarchy filter if not admin - this restricts data to only managed users
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
      conditions.push(`field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    conditions.push(`visited_date >= $${paramIndex}`)
    params.push(searchParams.get('startDate'))
    paramIndex++
    conditions.push(`visited_date <= $${paramIndex}`)
    params.push(searchParams.get('endDate'))
    paramIndex++

    // Cascading filters support
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    if (searchParams.has('fieldUserCode')) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(searchParams.get('fieldUserCode'))
      paramIndex++
    }

    if (searchParams.has('customerCode')) {
      conditions.push(`customer_code = $${paramIndex}`)
      params.push(searchParams.get('customerCode'))
      paramIndex++
    }

    if (searchParams.has('chainCode')) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(searchParams.get('chainCode'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    console.log('Expiry Filters API - WHERE clause:', whereClause)
    console.log('Expiry Filters API - Params:', params)

    // Run queries in parallel with timeout
    const results = await Promise.allSettled([
      query(`
        SELECT DISTINCT 
          field_user_code as "value", 
          field_user_code || ' - ' || field_user_name as "label" 
        FROM flat_expiry_checks 
        ${whereClause}${whereClause ? ' AND' : ' WHERE'} field_user_code IS NOT NULL
          AND field_user_name IS NOT NULL
        ORDER BY "label"
      `, params),
      query(`
        SELECT DISTINCT 
          customer_code as "value", 
          customer_code || ' - ' || customer_name as "label" 
        FROM flat_expiry_checks 
        ${whereClause} 
        ORDER BY "label" 
        LIMIT 500
      `, params),
      query(`
        SELECT DISTINCT 
          chain_code as "value", 
          chain_name as "label" 
        FROM flat_expiry_checks 
        ${whereClause}${whereClause ? ' AND' : ' WHERE'} chain_code IS NOT NULL AND chain_name IS NOT NULL 
        ORDER BY "label" 
        LIMIT 100
      `, params),
      query(`SELECT DISTINCT product_category as "value", product_category as "label" FROM flat_expiry_checks ${whereClause}${whereClause ? ' AND' : ' WHERE'} product_category IS NOT NULL ORDER BY product_category LIMIT 100`, params)
    ])

    const usersResult = results[0].status === 'fulfilled' ? results[0].value : { rows: [] }
    const customersResult = results[1].status === 'fulfilled' ? results[1].value : { rows: [] }
    const chainsResult = results[2].status === 'fulfilled' ? results[2].value : { rows: [] }
    const categoriesResult = results[3].status === 'fulfilled' ? results[3].value : { rows: [] }
    const statusResult = { rows: [
      { value: 'expired', label: 'Expired' },
      { value: 'safe', label: 'Safe (No Expired Items)' }
    ]}

    console.log('Expiry Filters API - Query results:', {
      users: usersResult.rows.length,
      customers: customersResult.rows.length,
      chains: chainsResult.rows.length,
      categories: categoriesResult.rows.length,
      statuses: statusResult.rows.length
    })

    // Get team leaders directly from flat_expiry_checks based on date range
    const teamLeadersResult = await query(`
      SELECT DISTINCT 
        tl_code as "value",
        tl_code || ' - ' || tl_name as "label",
        'Team Leader' as "role"
      FROM flat_expiry_checks
      ${whereClause}${whereClause ? ' AND' : ' WHERE'} tl_code IS NOT NULL
        AND tl_name IS NOT NULL
      ORDER BY "label"
    `, params)
    
    const teamLeaders = teamLeadersResult.rows
    
    // Get unique user roles (ATL, Promoter, etc) from the same date range
    const assistantLeadersResult = await query(`
      SELECT DISTINCT
        field_user_code as "value",
        field_user_code || ' - ' || field_user_name as "label",
        user_role as "role"
      FROM flat_expiry_checks
      ${whereClause}${whereClause ? ' AND' : ' WHERE'} user_role = 'ATL'
        AND field_user_code IS NOT NULL
        AND field_user_name IS NOT NULL
      ORDER BY "label"
    `, params)
    
    const assistantLeaders = assistantLeadersResult.rows
    
    console.log('Team Leaders found:', teamLeaders.length, 'Assistant Leaders:', assistantLeaders.length)

    return NextResponse.json({
      success: true,
      data: {
        users: usersResult.rows,
        customers: customersResult.rows,
        chains: chainsResult.rows,
        categories: categoriesResult.rows,
        statuses: statusResult.rows,
        teamLeaders,
        assistantLeaders
      },
      timestamp: new Date().toISOString(),
      cached: true,
      cacheInfo: {
        duration: FILTERS_CACHE_DURATION
      }
    }, {
      headers: {
        'Cache-Control': getCacheControlHeader(FILTERS_CACHE_DURATION)
      }
    })
  } catch (error) {
    console.error('Expiry Filters API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
