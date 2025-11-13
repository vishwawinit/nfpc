import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Disable caching during development
export const dynamic = 'force-dynamic'

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
          FROM flat_store_visits
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

    // Date filters (optional for filter loading)
    if (searchParams.has('startDate') && searchParams.has('endDate')) {
      conditions.push(`visit_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
      conditions.push(`visit_date <= $${paramIndex}`)
      params.push(searchParams.get('endDate'))
      paramIndex++
    }

    // Team Leader filter (for cascading)
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    console.log('OGP Filters - WHERE clause:', whereClause)
    console.log('OGP Filters - Params:', params)

    // First, check if we have any data at all
    const countResult = await query(`
      SELECT COUNT(*) as total FROM flat_store_visits ${whereClause}
    `, params)
    console.log('OGP Filters - Total records matching criteria:', countResult.rows[0].total)

    // Get distinct users, cities, and regions from flat_store_visits (filtered by hierarchy)
    const [usersResult, citiesResult, regionsResult] = await Promise.all([
      query(`
        SELECT DISTINCT 
          field_user_code as "value", 
          field_user_code || ' - ' || COALESCE(field_user_name, 'Unknown User') as "label"
        FROM flat_store_visits 
        ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} field_user_code IS NOT NULL
        ORDER BY field_user_code
        LIMIT 1000
      `, params),
      query(`
        SELECT DISTINCT 
          city_code as "value", 
          city_code as "label"
        FROM flat_store_visits 
        ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} city_code IS NOT NULL
        ORDER BY city_code
        LIMIT 1000
      `, params),
      query(`
        SELECT DISTINCT 
          region_code as "value", 
          region_code as "label"
        FROM flat_store_visits 
        ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} region_code IS NOT NULL
        ORDER BY region_code
        LIMIT 1000
      `, params)
    ])

    console.log('OGP Filters - Users count:', usersResult.rows.length)
    console.log('OGP Filters - Cities count:', citiesResult.rows.length)
    console.log('OGP Filters - Regions count:', regionsResult.rows.length)
    
    // Debug: Log first few results to check format
    if (usersResult.rows.length > 0) {
      console.log('OGP Filters - Sample user:', usersResult.rows[0])
    }
    if (citiesResult.rows.length > 0) {
      console.log('OGP Filters - Sample city:', citiesResult.rows[0])
    }
    if (regionsResult.rows.length > 0) {
      console.log('OGP Filters - Sample region:', regionsResult.rows[0])
    }

    // Get team leaders directly from flat_store_visits table (filtered by hierarchy)
    // Note: Team leaders are filtered via the field_user_code in WHERE clause
    const teamLeadersResult = await query(`
      SELECT DISTINCT 
        tl_code as "value",
        tl_code || ' - ' || COALESCE(tl_name, 'Unknown TL') as "label"
      FROM flat_store_visits
      ${whereClause}
      ${whereClause ? 'AND' : 'WHERE'} tl_code IS NOT NULL
      ORDER BY tl_code
      LIMIT 1000
    `, params)
    
    const teamLeaders = teamLeadersResult.rows
    console.log('OGP Filters - Team leaders count:', teamLeaders.length)
    if (teamLeaders.length > 0) {
      console.log('OGP Filters - Sample team leader:', teamLeaders[0])
    }

    const responseData = {
      success: true,
      data: {
        users: usersResult.rows,
        cities: citiesResult.rows,
        regions: regionsResult.rows,
        teamLeaders
      },
      timestamp: new Date().toISOString()
    }
    
    console.log('OGP Filters - Final response data counts:', {
      users: responseData.data.users.length,
      cities: responseData.data.cities.length,
      regions: responseData.data.regions.length,
      teamLeaders: responseData.data.teamLeaders.length
    })
    
    return NextResponse.json(responseData)
  } catch (error) {
    console.error('=== OGP FILTERS API ERROR ===')
    console.error('Error:', error)
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error')
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

