import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const regionCode = searchParams.get('regionCode')
    const teamLeaderCode = searchParams.get('teamLeaderCode')
    const userRole = searchParams.get('userRole')

    let whereClause = '1=1'
    const params: any[] = []
    let paramCount = 1

    if (startDate && endDate) {
      whereClause += ` AND attendance_date >= $${paramCount} AND attendance_date <= $${paramCount + 1}`
      params.push(startDate, endDate)
      paramCount += 2
    }

    if (regionCode) {
      whereClause += ` AND region_code = $${paramCount}`
      params.push(regionCode)
      paramCount++
    }

    if (teamLeaderCode) {
      whereClause += ` AND tl_code = $${paramCount}`
      params.push(teamLeaderCode)
      paramCount++
    }

    if (userRole) {
      whereClause += ` AND user_role = $${paramCount}`
      params.push(userRole)
      paramCount++
    }

    // Get field user roles with user counts
    const rolesQuery = `
      SELECT 
        user_role as value,
        user_role as label,
        COUNT(DISTINCT user_code) as user_count,
        COUNT(*) as record_count
      FROM flat_attendance_daily
      WHERE ${whereClause} AND user_role IS NOT NULL
      GROUP BY user_role
      ORDER BY user_count DESC
    `

    // Get team leaders with their team sizes
    const teamLeadersQuery = `
      SELECT 
        tl_code as value,
        TRIM(tl_name) || ' (' || tl_code || ')' as label,
        tl_name,
        tl_code,
        COUNT(DISTINCT user_code) as subordinate_count,
        COUNT(*) as record_count
      FROM flat_attendance_daily
      WHERE ${whereClause} AND tl_code IS NOT NULL AND tl_name IS NOT NULL
      GROUP BY tl_code, tl_name
      ORDER BY subordinate_count DESC, tl_name
    `

    // Get field users
    const usersQuery = `
      SELECT 
        user_code as value,
        user_name || ' (' || user_code || ')' as label,
        user_name,
        user_code,
        user_role,
        tl_code,
        COUNT(*) as record_count
      FROM flat_attendance_daily
      WHERE ${whereClause} AND user_code IS NOT NULL AND user_name IS NOT NULL
      GROUP BY user_code, user_name, user_role, tl_code
      ORDER BY user_name
    `

    const [roles, teamLeaders, users] = await Promise.all([
      db.query(rolesQuery, params),
      db.query(teamLeadersQuery, params),
      db.query(usersQuery, params)
    ])

    return NextResponse.json({
      roles: roles.rows.map((r: any) => ({
        value: r.value,
        label: r.label,
        userCount: parseInt(r.user_count || 0),
        available: parseInt(r.record_count || 0)
      })),
      teamLeaders: teamLeaders.rows.map((t: any) => ({
        value: t.value,
        label: t.label,
        subordinateCount: parseInt(t.subordinate_count || 0),
        available: parseInt(t.record_count || 0)
      })),
      users: users.rows.map((u: any) => ({
        value: u.value,
        label: u.label,
        role: u.user_role,
        teamLeaderCode: u.tl_code,
        available: parseInt(u.record_count || 0)
      }))
    })
  } catch (error) {
    console.error('Error fetching attendance filter options:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filter options', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
