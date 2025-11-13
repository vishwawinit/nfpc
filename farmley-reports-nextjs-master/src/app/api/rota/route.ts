import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Enable ISR with 60 second revalidation

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
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
    
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Add hierarchy filter first if not admin - this restricts data to only managed users
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
      conditions.push(`user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    if (searchParams.has('startDate')) {
      conditions.push(`rota_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
    }

    if (searchParams.has('endDate')) {
      conditions.push(`rota_date <= $${paramIndex}`)
      params.push(searchParams.get('endDate'))
      paramIndex++
    }

    if (searchParams.has('userCode')) {
      conditions.push(`user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    if (searchParams.has('routeCode')) {
      conditions.push(`route_code = $${paramIndex}`)
      params.push(searchParams.get('routeCode'))
      paramIndex++
    }

    if (searchParams.has('activityName')) {
      conditions.push(`activity_name = $${paramIndex}`)
      params.push(searchParams.get('activityName'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = parseInt(searchParams.get('limit') || '100000')

    // Check if flat_rota_activities table exists
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'flat_rota_activities'
      ) as table_exists
    `)
    
    if (!tableCheckResult.rows[0]?.table_exists) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'ROTA activities tracking not yet configured. Table flat_rota_activities does not exist.',
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      })
    }

    const columnsResult = await query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'flat_rota_activities'
    `)

    const columnSet = new Set(columnsResult.rows.map(row => row.column_name))
    const hasColumn = (name: string) => columnSet.has(name)

    const selectFields = [
      `rota_date as "rotaDate"`,
      hasColumn('rota_id') ? `rota_id as "rotaId"` : `NULL::bigint as "rotaId"`,
      hasColumn('user_code') ? `user_code as "userCode"` : `NULL::text as "userCode"`,
      hasColumn('user_name') ? `user_name as "userName"` : `NULL::text as "userName"`,
      hasColumn('tl_code') ? `tl_code as "teamLeaderCode"` : hasColumn('team_leader_code') ? `team_leader_code as "teamLeaderCode"` : `NULL::text as "teamLeaderCode"`,
      hasColumn('tl_name') ? `tl_name as "teamLeaderName"` : hasColumn('team_leader_name') ? `team_leader_name as "teamLeaderName"` : `NULL::text as "teamLeaderName"`,
      hasColumn('activity_name') ? `activity_name as "activityName"` : hasColumn('activity_type') ? `activity_type as "activityName"` : `NULL::text as "activityName"`,
      hasColumn('start_time') ? `start_time as "startTime"` : `NULL::time as "startTime"`,
      hasColumn('end_time') ? `end_time as "endTime"` : `NULL::time as "endTime"`,
      hasColumn('created_by') ? `created_by as "createdBy"` : `NULL::text as "createdBy"`,
      hasColumn('created_on') ? `created_on as "createdOn"` : hasColumn('created_datetime') ? `created_datetime as "createdOn"` : `NOW() as "createdOn"`
    ]

    const orderClause = hasColumn('created_on')
      ? 'ORDER BY rota_date DESC, created_on DESC'
      : hasColumn('created_datetime')
        ? 'ORDER BY rota_date DESC, created_datetime DESC'
        : 'ORDER BY rota_date DESC'

    const result = await query(`
      SELECT
        ${selectFields.join(',\n        ')}
      FROM flat_rota_activities
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex}
    `, [...params, limit])

    const activities = result.rows.map(row => ({
      rotaDate: row.rotaDate,
      rotaId: row.rotaId,
      userCode: row.userCode,
      userName: row.userName,
      teamLeaderCode: row.teamLeaderCode,
      teamLeaderName: row.teamLeaderName,
      activityName: row.activityName,
      startTime: row.startTime,
      endTime: row.endTime,
      createdBy: row.createdBy,
      createdOn: row.createdOn
    }))

    return NextResponse.json({
      success: true,
      data: activities,
      count: activities.length,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('ROTA Activities API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch rota activities',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
