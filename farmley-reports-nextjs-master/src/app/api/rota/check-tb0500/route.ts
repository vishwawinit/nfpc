import { NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers } from '@/lib/mssql'

export async function GET() {
  try {
    // Get TB0500's hierarchy
    const tb0500Hierarchy = await getChildUsers('TB0500')
    
    // Check if any hierarchy users exist as TL in ROTA
    const tlMatch = await query(`
      SELECT 
        tl_code,
        tl_name,
        COUNT(*) as activity_count,
        COUNT(DISTINCT user_code) as unique_users
      FROM flat_rota_activities
      WHERE tl_code = ANY($1::varchar[])
      GROUP BY tl_code, tl_name
      ORDER BY activity_count DESC
    `, [tb0500Hierarchy])
    
    // Check if any hierarchy users exist as user_code in ROTA
    const userMatch = await query(`
      SELECT 
        user_code,
        user_name,
        COUNT(*) as activity_count
      FROM flat_rota_activities
      WHERE user_code = ANY($1::varchar[])
      GROUP BY user_code, user_name
      ORDER BY activity_count DESC
    `, [tb0500Hierarchy])
    
    // Get ALL TLs in ROTA with their activity counts
    const allTLs = await query(`
      SELECT 
        tl_code,
        tl_name,
        COUNT(*) as activity_count,
        COUNT(DISTINCT user_code) as field_users_count,
        MIN(rota_date) as first_date,
        MAX(rota_date) as last_date
      FROM flat_rota_activities
      WHERE tl_code IS NOT NULL
      GROUP BY tl_code, tl_name
      ORDER BY activity_count DESC
    `)
    
    // Calculate total if TB0500 had access
    const totalActivitiesForTB0500TLs = tlMatch.rows.reduce((sum, row) => 
      sum + parseInt(row.activity_count), 0
    )
    
    const totalActivitiesForTB0500Users = userMatch.rows.reduce((sum, row) => 
      sum + parseInt(row.activity_count), 0
    )
    
    return NextResponse.json({
      success: true,
      data: {
        tb0500Analysis: {
          hierarchyUsers: tb0500Hierarchy,
          hierarchyCount: tb0500Hierarchy.length,
          matchedAsTL: tlMatch.rows,
          matchedAsTLCount: tlMatch.rows.length,
          totalActivitiesViaTL: totalActivitiesForTB0500TLs,
          matchedAsUser: userMatch.rows,
          matchedAsUserCount: userMatch.rows.length,
          totalActivitiesAsUser: totalActivitiesForTB0500Users,
          shouldSeeData: totalActivitiesForTB0500TLs > 0 || totalActivitiesForTB0500Users > 0,
          dataSource: totalActivitiesForTB0500TLs > 0 ? 'via TL hierarchy' : 
                     totalActivitiesForTB0500Users > 0 ? 'as direct user' : 'NO DATA'
        },
        allTLsInROTA: allTLs.rows,
        recommendation: {
          testWithTheseUsers: allTLs.rows.slice(0, 3).map(tl => ({
            code: tl.tl_code,
            name: tl.tl_name,
            activities: tl.activity_count,
            fieldUsers: tl.field_users_count
          })),
          message: allTLs.rows.length > 0 
            ? `Try logging in with these TL codes to see ROTA data: ${allTLs.rows.slice(0, 3).map(r => r.tl_code).join(', ')}`
            : 'No TL data found in ROTA table'
        }
      }
    })
  } catch (error) {
    console.error('Check TB0500 error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check TB0500',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
