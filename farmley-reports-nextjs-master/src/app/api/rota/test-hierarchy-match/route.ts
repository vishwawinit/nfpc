import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const loginUserCode = searchParams.get('loginUserCode') || 'TB0500'

    // Get hierarchy users
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }

    // Check which hierarchy users exist in ROTA as user_code
    const matchCheck = await query(`
      SELECT 
        user_code,
        user_name,
        COUNT(*) as activity_count
      FROM flat_rota_activities
      WHERE user_code = ANY($1::varchar[])
      GROUP BY user_code, user_name
      ORDER BY activity_count DESC
    `, [allowedUserCodes])

    // Get all users in ROTA table
    const allRotaUsers = await query(`
      SELECT user_code, user_name, COUNT(*) as activity_count
      FROM flat_rota_activities
      GROUP BY user_code, user_name
      ORDER BY activity_count DESC
      LIMIT 10
    `)

    return NextResponse.json({
      success: true,
      data: {
        loginUserCode,
        hierarchyUsers: allowedUserCodes,
        hierarchyCount: allowedUserCodes.length,
        matchedInRota: matchCheck.rows,
        matchedCount: matchCheck.rows.length,
        totalActivitiesFromMatches: matchCheck.rows.reduce((sum, r) => sum + parseInt(r.activity_count), 0),
        sampleRotaUsers: allRotaUsers.rows,
        analysis: {
          hierarchyReturnsUsers: allowedUserCodes.length > 0,
          anyMatchesInRota: matchCheck.rows.length > 0,
          percentageMatched: allowedUserCodes.length > 0 
            ? ((matchCheck.rows.length / allowedUserCodes.length) * 100).toFixed(1) + '%'
            : '0%'
        }
      }
    })
  } catch (error) {
    console.error('Test hierarchy match error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test hierarchy match',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
