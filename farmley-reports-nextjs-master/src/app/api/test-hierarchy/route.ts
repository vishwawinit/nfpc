import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const [hierarchyAnalysis, teamLeaderDetails, atlAnalysis, promoterAnalysis] = await Promise.all([
      // Get complete hierarchy with role relationships
      query(`
        WITH supervisor_info AS (
          SELECT DISTINCT
            field_user_code,
            field_user_name,
            COALESCE(user_role, 'Field User') as role,
            tl_code
          FROM flat_sales_transactions
          WHERE UPPER(field_user_code) NOT LIKE '%DEMO%'
        )
        SELECT
          s.role as subordinate_role,
          sup.role as supervisor_role,
          COUNT(DISTINCT s.field_user_code) as subordinate_count,
          COUNT(DISTINCT s.tl_code) as unique_supervisors,
          array_agg(DISTINCT s.tl_code) as supervisor_codes
        FROM supervisor_info s
        INNER JOIN supervisor_info sup ON s.tl_code = sup.field_user_code
        WHERE s.tl_code IS NOT NULL
        GROUP BY s.role, sup.role
        ORDER BY
          CASE s.role
            WHEN 'Team Leader' THEN 1
            WHEN 'ATL' THEN 2
            WHEN 'Promoter' THEN 3
            WHEN 'Merchandiser' THEN 4
            ELSE 5
          END
      `),

      // Get each Team Leader with their subordinates breakdown
      query(`
        WITH supervisor_info AS (
          SELECT DISTINCT
            field_user_code,
            field_user_name,
            COALESCE(user_role, 'Field User') as role,
            tl_code
          FROM flat_sales_transactions
          WHERE UPPER(field_user_code) NOT LIKE '%DEMO%'
        )
        SELECT
          tl.field_user_code as team_leader_code,
          tl.field_user_name as team_leader_name,
          COUNT(DISTINCT CASE WHEN sub.role = 'ATL' THEN sub.field_user_code END) as atl_count,
          COUNT(DISTINCT CASE WHEN sub.role = 'Promoter' THEN sub.field_user_code END) as promoter_count,
          COUNT(DISTINCT CASE WHEN sub.role = 'Merchandiser' THEN sub.field_user_code END) as merchandiser_count,
          COUNT(DISTINCT CASE WHEN sub.role = 'Team Leader' THEN sub.field_user_code END) as team_leader_count,
          COUNT(DISTINCT sub.field_user_code) as total_subordinates,
          array_agg(DISTINCT sub.field_user_name || ' (' || sub.role || ')') as subordinate_details
        FROM supervisor_info tl
        INNER JOIN supervisor_info sub ON sub.tl_code = tl.field_user_code
        WHERE tl.role = 'Team Leader'
        GROUP BY tl.field_user_code, tl.field_user_name
        ORDER BY total_subordinates DESC
      `),

      // Check if ATLs supervise anyone
      query(`
        WITH supervisor_info AS (
          SELECT DISTINCT
            field_user_code,
            field_user_name,
            COALESCE(user_role, 'Field User') as role,
            tl_code
          FROM flat_sales_transactions
          WHERE UPPER(field_user_code) NOT LIKE '%DEMO%'
        )
        SELECT
          atl.field_user_code as atl_code,
          atl.field_user_name as atl_name,
          atl.tl_code as atl_reports_to,
          tl.field_user_name as team_leader_name,
          COUNT(DISTINCT sub.field_user_code) as subordinates_count,
          array_agg(DISTINCT sub.field_user_name || ' (' || sub.role || ')') as subordinates
        FROM supervisor_info atl
        LEFT JOIN supervisor_info sub ON sub.tl_code = atl.field_user_code
        LEFT JOIN supervisor_info tl ON atl.tl_code = tl.field_user_code
        WHERE atl.role = 'ATL'
        GROUP BY atl.field_user_code, atl.field_user_name, atl.tl_code, tl.field_user_name
        ORDER BY subordinates_count DESC
      `),

      // Check if Promoters supervise anyone
      query(`
        WITH supervisor_info AS (
          SELECT DISTINCT
            field_user_code,
            field_user_name,
            COALESCE(user_role, 'Field User') as role,
            tl_code
          FROM flat_sales_transactions
          WHERE UPPER(field_user_code) NOT LIKE '%DEMO%'
        )
        SELECT
          p.field_user_code as promoter_code,
          p.field_user_name as promoter_name,
          p.tl_code as promoter_reports_to,
          tl.field_user_name as supervisor_name,
          tl.role as supervisor_role,
          COUNT(DISTINCT sub.field_user_code) as subordinates_count,
          array_agg(DISTINCT sub.field_user_name || ' (' || sub.role || ')') as subordinates
        FROM supervisor_info p
        LEFT JOIN supervisor_info sub ON sub.tl_code = p.field_user_code
        LEFT JOIN supervisor_info tl ON p.tl_code = tl.field_user_code
        WHERE p.role = 'Promoter'
        GROUP BY p.field_user_code, p.field_user_name, p.tl_code, tl.field_user_name, tl.role
        HAVING COUNT(DISTINCT sub.field_user_code) > 0
        ORDER BY subordinates_count DESC
      `)
    ])

    // Determine hierarchy structure
    const hierarchyLevels = {
      level1: 'Team Leader',
      level2: [],
      level3: []
    }

    // Check if ATLs have subordinates
    const atlsWithSubordinates = atlAnalysis.rows.filter(row => parseInt(row.subordinates_count) > 0)
    const promotersWithSubordinates = promoterAnalysis.rows.filter(row => parseInt(row.subordinates_count) > 0)

    return NextResponse.json({
      success: true,
      data: {
        hierarchyStructure: hierarchyAnalysis.rows,
        teamLeaderBreakdown: teamLeaderDetails.rows,
        atlsWithSubordinates: atlsWithSubordinates,
        promotersWithSubordinates: promotersWithSubordinates,
        summary: {
          totalTeamLeaders: teamLeaderDetails.rows.length,
          atlsWhoSupervise: atlsWithSubordinates.length,
          promotersWhoSupervise: promotersWithSubordinates.length,
          hierarchyType: atlsWithSubordinates.length > 0 ? 'Multi-level (TL > ATL > Others)' : 'Single-level (TL > All)',
        }
      }
    })
  } catch (error) {
    console.error('Test hierarchy API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
