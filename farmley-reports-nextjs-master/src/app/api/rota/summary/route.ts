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
    
    // Get loginUserCode for hierarchy-based filtering
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Validate user access
    const validation = await validateApiUser(loginUserCode)
    if (!validation.isValid) {
      return validation.response!
    }
    
    // Fetch ALL descendant users recursively
    let allowedUserCodes: string[] = []
    let allowedTLCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
      
      // Also query for field users whose TL is in the hierarchy
      // This handles cases where loginUser is senior manager and ROTA users report to mid-level TLs
      if (allowedUserCodes.length > 0) {
        const tlCheckResult = await query(`
          SELECT DISTINCT tl_code
          FROM flat_rota_activities
          WHERE tl_code = ANY($1::varchar[])
        `, [allowedUserCodes])
        
        allowedTLCodes = tlCheckResult.rows.map(r => r.tl_code)
        console.log('🔐 ROTA - Hierarchy TLs found in ROTA:', allowedTLCodes.length, 'TLs')
      }
      
      console.log('🔐 ROTA - Hierarchy users for', loginUserCode, ':', allowedUserCodes)
    }
    
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

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

    if (searchParams.has('activityName')) {
      conditions.push(`activity_name = $${paramIndex}`)
      params.push(searchParams.get('activityName'))
      paramIndex++
    }

    // Hierarchy filter - filter on user_code OR tl_code
    // This allows senior managers to see activities from their entire org tree
    if (allowedUserCodes.length > 0) {
      if (allowedTLCodes.length > 0) {
        // Some hierarchy users are TLs in ROTA - filter by TL
        const tlPlaceholders = allowedTLCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
        conditions.push(`tl_code IN (${tlPlaceholders})`)
        params.push(...allowedTLCodes)
        paramIndex += allowedTLCodes.length
        console.log('🔐 ROTA Summary - Filtering by TL codes:', allowedTLCodes.length, 'TLs')
      } else {
        // Fallback: filter by user_code directly
        const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
        conditions.push(`user_code IN (${placeholders})`)
        params.push(...allowedUserCodes)
        paramIndex += allowedUserCodes.length
        console.log('🔐 ROTA Summary - Filtering by user codes:', allowedUserCodes.length, 'users')
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    
    console.log('📊 ROTA Summary Query:')
    console.log('  WHERE clause:', whereClause)
    console.log('  Param count:', params.length)
    console.log('  Params:', params)
    console.log('  Conditions:', conditions)

    // Check if table exists
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
        message: 'ROTA activities table does not exist.',
        timestamp: new Date().toISOString()
      })
    }

    // Check total records in table for debugging
    const totalCountResult = await query('SELECT COUNT(*) as total FROM flat_rota_activities')
    console.log('📊 Total records in flat_rota_activities:', totalCountResult.rows[0]?.total)
    
    // Check date range in table
    const dateRangeResult = await query(`
      SELECT 
        MIN(rota_date) as min_date,
        MAX(rota_date) as max_date,
        COUNT(DISTINCT user_code) as unique_users
      FROM flat_rota_activities
    `)
    console.log('📅 Date range in table:', dateRangeResult.rows[0])
    
    // Check if any of the allowed users exist in table (as user or TL)
    if (allowedUserCodes.length > 0) {
      const userCheckPlaceholders = allowedUserCodes.map((_, i) => `$${i + 1}`).join(', ')
      const tlCheckPlaceholders = allowedUserCodes.map((_, i) => `$${i + 1 + allowedUserCodes.length}`).join(', ')
      const userCheckResult = await query(`
        SELECT 
          'user' as role_type,
          user_code as code,
          user_name as name,
          COUNT(*) as activity_count
        FROM flat_rota_activities
        WHERE user_code IN (${userCheckPlaceholders})
        GROUP BY user_code, user_name
        UNION ALL
        SELECT 
          'team_leader' as role_type,
          tl_code as code,
          tl_name as name,
          COUNT(*) as activity_count
        FROM flat_rota_activities
        WHERE tl_code IN (${tlCheckPlaceholders})
        GROUP BY tl_code, tl_name
      `, [...allowedUserCodes, ...allowedUserCodes])
      console.log('👥 Allowed users/TLs found in table:', userCheckResult.rows)
    }

    // Get summary grouped by user
    const summaryQuery = `
      SELECT 
        user_code as "userCode",
        user_name as "userName",
        COALESCE(tl_code, '') as "teamLeaderCode",
        COALESCE(tl_name, '') as "teamLeaderName",
        COUNT(*) as "totalActivities",
        MAX(rota_date) as "lastActivityDate",
        MAX(created_on) as "lastCreatedOn",
        MAX(created_by) as "createdBy"
      FROM flat_rota_activities
      ${whereClause}
      GROUP BY user_code, user_name, COALESCE(tl_code, ''), COALESCE(tl_name, '')
      ORDER BY MAX(rota_date) DESC, COUNT(*) DESC
    `

    const result = await query(summaryQuery, params)
    
    console.log('✅ ROTA Summary Query Result:', {
      rowCount: result.rows.length,
      sampleData: result.rows.length > 0 ? result.rows[0] : null
    })

    const summary = result.rows.map(row => ({
      userCode: row.userCode,
      userName: row.userName,
      teamLeaderCode: row.teamLeaderCode || null,
      teamLeaderName: row.teamLeaderName || null,
      totalActivities: parseInt(row.totalActivities),
      lastActivityDate: row.lastActivityDate,
      lastCreatedOn: row.lastCreatedOn,
      createdBy: row.createdBy || null
    }))

    return NextResponse.json({
      success: true,
      data: summary,
      count: summary.length,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('ROTA Summary API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch rota summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
