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

    // Get all TL codes in ROTA table
    const tlCodes = await query(`
      SELECT DISTINCT tl_code, tl_name, COUNT(*) as activity_count
      FROM flat_rota_activities
      WHERE tl_code IS NOT NULL
      GROUP BY tl_code, tl_name
      ORDER BY activity_count DESC
    `)

    // Get all user codes in ROTA table
    const userCodes = await query(`
      SELECT DISTINCT user_code, user_name, COUNT(*) as activity_count
      FROM flat_rota_activities
      WHERE user_code IS NOT NULL
      GROUP BY user_code, user_name
      ORDER BY activity_count DESC
    `)

    // Check if hierarchy users exist as TL or user
    const hierarchyCheck = await query(`
      SELECT 
        'tl' as type,
        tl_code as code,
        tl_name as name,
        COUNT(*) as count
      FROM flat_rota_activities
      WHERE tl_code = ANY($1::varchar[])
      GROUP BY tl_code, tl_name
      UNION ALL
      SELECT 
        'user' as type,
        user_code as code,
        user_name as name,
        COUNT(*) as count
      FROM flat_rota_activities
      WHERE user_code = ANY($1::varchar[])
      GROUP BY user_code, user_name
    `, [allowedUserCodes])

    return NextResponse.json({
      success: true,
      data: {
        loginUserCode,
        hierarchyUsers: {
          codes: allowedUserCodes,
          count: allowedUserCodes.length
        },
        rotaTableTLs: tlCodes.rows,
        rotaTableUsers: userCodes.rows.slice(0, 20), // Top 20
        hierarchyMatchInRota: hierarchyCheck.rows,
        analysis: {
          hierarchyUsersInRotaAsTL: hierarchyCheck.rows.filter(r => r.type === 'tl').length,
          hierarchyUsersInRotaAsUser: hierarchyCheck.rows.filter(r => r.type === 'user').length,
          totalRotaTLs: tlCodes.rows.length,
          totalRotaUsers: userCodes.rows.length
        }
      }
    })
  } catch (error) {
    console.error('Debug hierarchy error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to debug hierarchy',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
