import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { validateApiUser } from '@/lib/apiUserValidation'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Enable ISR with 60 second revalidation
export const revalidate = 60

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Get and validate user
    const loginUserCode = searchParams.get('loginUserCode')
    const validation = await validateApiUser(loginUserCode)
    
    if (!validation.isValid) {
      return validation.response!
    }
    
    // Get allowed users for filtering
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (searchParams.has('startDate') && searchParams.has('endDate')) {
      conditions.push(`rota_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
      conditions.push(`rota_date <= $${paramIndex}`)
      params.push(searchParams.get('endDate'))
      paramIndex++
    }

    // Team Leader filter (for cascading)
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    if (searchParams.has('userCode')) {
      conditions.push(`user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Fetch hierarchy data from users API
    const hierarchyResponse = await fetch(`${request.nextUrl.origin}/api/users/hierarchy`)
    const hierarchyData = await hierarchyResponse.json()

    const [usersResult, activitiesResult] = await Promise.all([
      query(`SELECT DISTINCT user_code as "value", user_name as "label" FROM flat_rota_activities ${whereClause} ORDER BY user_name`, params),
      query(`SELECT DISTINCT activity_name as "value", activity_name as "label" FROM flat_rota_activities ${whereClause ? `${whereClause} AND` : 'WHERE'} activity_name IS NOT NULL ORDER BY activity_name`, params)
    ])

    return NextResponse.json({
      success: true,
      data: {
        users: usersResult.rows,
        activities: activitiesResult.rows,
        teamLeaders: hierarchyData.data?.teamLeaders || [],
        assistantLeaders: hierarchyData.data?.assistantLeaders || []
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('ROTA Filters API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
