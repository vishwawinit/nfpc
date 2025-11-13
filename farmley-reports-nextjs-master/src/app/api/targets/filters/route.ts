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
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Validate user access
    const validation = await validateApiUser(loginUserCode)
    if (!validation.isValid) {
      return validation.response!
    }
    
    // Get hierarchy-based allowed users
    let allowedUserCodes: string[] = []
    let userIsTeamLeader = false
    let allowedTeamLeaders: string[] = []
    let allowedFieldUsers: string[] = []
    
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
      
      // Query to determine which of the allowed users are Team Leaders vs Field Users
      if (allowedUserCodes.length > 0) {
        const userCodesStr = allowedUserCodes.map(code => `'${code}'`).join(', ')
        
        // Get team leaders from the allowed codes
        const tlResult = await query(`
          SELECT DISTINCT tl_code
          FROM flat_targets
          WHERE tl_code IN (${userCodesStr})
        `, [])
        allowedTeamLeaders = tlResult.rows.map(r => r.tl_code).filter(Boolean)
        
        // Check if the logged-in user is a team leader
        userIsTeamLeader = allowedTeamLeaders.includes(loginUserCode)
        
        // If user is a TL, only they should appear in TL filter
        if (userIsTeamLeader) {
          allowedTeamLeaders = [loginUserCode]
        }
        
        // Field users are all allowed codes
        allowedFieldUsers = allowedUserCodes
      }
    }
    
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1
    
    // Add hierarchy filter if not admin
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
      conditions.push(`field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    if (searchParams.has('year')) {
      conditions.push(`target_year = $${paramIndex}`)
      params.push(parseInt(searchParams.get('year')!))
      paramIndex++
    }

    if (searchParams.has('month')) {
      conditions.push(`target_month = $${paramIndex}`)
      params.push(parseInt(searchParams.get('month')!))
      paramIndex++
    }

    // Team Leader filter (for cascading)
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    if (searchParams.has('userCode')) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    if (searchParams.has('chainCode')) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(searchParams.get('chainCode'))
      paramIndex++
    }

    if (searchParams.has('productBrand')) {
      conditions.push(`product_brand = $${paramIndex}`)
      params.push(searchParams.get('productBrand'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const [
      usersResult, 
      teamLeadersResult,
      customersResult, 
      yearsResult, 
      monthsResult, 
      chainsResult, 
      brandsResult, 
      categoriesResult,
      targetTypesResult,
      targetStatusResult,
      targetLevelResult,
      salesOrgResult,
      userRolesResult
    ] = await Promise.all([
      // Field Users (filtered by hierarchy)
      query(`SELECT DISTINCT field_user_code as "value", field_user_code || ' - ' || field_user_name as "label", field_user_code as "code", field_user_name as "name" FROM flat_targets ${whereClause} ${allowedFieldUsers.length > 0 ? (whereClause ? 'AND' : 'WHERE') + ` field_user_code IN (${allowedFieldUsers.map(c => `'${c}'`).join(', ')})` : ''} ORDER BY field_user_name`, params),
      // Team Leaders (filtered by hierarchy)
      query(`SELECT DISTINCT tl_code as "value", tl_code || ' - ' || tl_name as "label", tl_code as "code", tl_name as "name" FROM flat_targets ${whereClause ? `${whereClause} AND` : 'WHERE'} tl_code IS NOT NULL ${allowedTeamLeaders.length > 0 ? `AND tl_code IN (${allowedTeamLeaders.map(c => `'${c}'`).join(', ')})` : ''} ORDER BY tl_name`, params),
      query(`SELECT DISTINCT customer_code as "value", customer_code || ' - ' || customer_name as "label", customer_code as "code", customer_name as "name" FROM flat_targets ${whereClause} ORDER BY customer_name`, params),
      query(`SELECT DISTINCT target_year as "value", target_year::text as "label" FROM flat_targets ORDER BY target_year DESC`),
      query(`SELECT DISTINCT target_month as "value", target_month::text as "label" FROM flat_targets ORDER BY target_month`),
      query(`SELECT DISTINCT chain_code as "value", chain_code as "label" FROM flat_targets ${whereClause ? `${whereClause} AND` : 'WHERE'} chain_code IS NOT NULL ORDER BY chain_code`, params),
      query(`SELECT DISTINCT product_brand as "value", product_brand as "label" FROM flat_targets ${whereClause ? `${whereClause} AND` : 'WHERE'} product_brand IS NOT NULL ORDER BY product_brand`, params),
      query(`SELECT DISTINCT product_category as "value", product_category as "label" FROM flat_targets ${whereClause ? `${whereClause} AND` : 'WHERE'} product_category IS NOT NULL ORDER BY product_category`, params),
      query(`SELECT DISTINCT target_type as "value", target_type as "label" FROM flat_targets ${whereClause ? `${whereClause} AND` : 'WHERE'} target_type IS NOT NULL ORDER BY target_type`, params),
      query(`SELECT DISTINCT target_status as "value", target_status as "label" FROM flat_targets ${whereClause ? `${whereClause} AND` : 'WHERE'} target_status IS NOT NULL ORDER BY target_status`, params),
      query(`SELECT DISTINCT target_level as "value", target_level as "label" FROM flat_targets ${whereClause ? `${whereClause} AND` : 'WHERE'} target_level IS NOT NULL ORDER BY target_level`, params),
      query(`SELECT DISTINCT sales_org_code as "value", sales_org_code || ' - ' || sales_org_name as "label" FROM flat_targets ${whereClause ? `${whereClause} AND` : 'WHERE'} sales_org_code IS NOT NULL ORDER BY sales_org_code`, params),
      query(`SELECT DISTINCT user_role as "value", user_role as "label" FROM flat_targets ${whereClause ? `${whereClause} AND` : 'WHERE'} user_role IS NOT NULL ORDER BY user_role`, params)
    ])

    return NextResponse.json({
      success: true,
      data: {
        users: usersResult.rows,
        teamLeaders: teamLeadersResult.rows,
        customers: customersResult.rows,
        years: yearsResult.rows,
        months: monthsResult.rows,
        chains: chainsResult.rows,
        brands: brandsResult.rows,
        categories: categoriesResult.rows,
        targetTypes: targetTypesResult.rows,
        targetStatus: targetStatusResult.rows,
        targetLevels: targetLevelResult.rows,
        salesOrgs: salesOrgResult.rows,
        userRoles: userRolesResult.rows
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Targets Filters API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
