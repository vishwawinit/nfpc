import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Get ALL people and check who supervises whom at ALL levels
    const fullHierarchy = await query(`
      WITH RECURSIVE supervisor_chain AS (
        -- Get all distinct users with their immediate supervisor
        SELECT DISTINCT
          field_user_code,
          field_user_name,
          COALESCE(user_role, 'Field User') as role,
          tl_code as immediate_supervisor,
          1 as level
        FROM flat_sales_transactions
        WHERE UPPER(field_user_code) NOT LIKE '%DEMO%'
      ),
      subordinate_counts AS (
        -- For each person, count how many people report to them
        SELECT
          s.tl_code as supervisor_code,
          COUNT(DISTINCT s.field_user_code) as direct_reports
        FROM flat_sales_transactions s
        WHERE s.tl_code IS NOT NULL
        AND UPPER(s.field_user_code) NOT LIKE '%DEMO%'
        GROUP BY s.tl_code
      )
      SELECT
        sc.field_user_code,
        sc.field_user_name,
        sc.role,
        sc.immediate_supervisor,
        sup.field_user_name as supervisor_name,
        sup.role as supervisor_role,
        COALESCE(sub.direct_reports, 0) as people_supervised,
        CASE
          WHEN sc.immediate_supervisor IS NULL THEN 'Top Level'
          WHEN COALESCE(sub.direct_reports, 0) > 0 THEN 'Middle Manager'
          ELSE 'Individual Contributor'
        END as hierarchy_position
      FROM supervisor_chain sc
      LEFT JOIN supervisor_chain sup ON sc.immediate_supervisor = sup.field_user_code
      LEFT JOIN subordinate_counts sub ON sc.field_user_code = sub.supervisor_code
      ORDER BY
        COALESCE(sub.direct_reports, 0) DESC,
        sc.role,
        sc.field_user_name
    `)

    // Get detailed breakdown for each Team Leader's subordinates
    const teamLeaderSubordinates = await query(`
      WITH tl_subordinates AS (
        SELECT DISTINCT
          s.tl_code as team_leader_code,
          tl.field_user_name as team_leader_name,
          s.field_user_code as subordinate_code,
          s.field_user_name as subordinate_name,
          COALESCE(s.user_role, 'Field User') as subordinate_role
        FROM flat_sales_transactions s
        INNER JOIN flat_sales_transactions tl
          ON s.tl_code = tl.field_user_code
          AND tl.user_role = 'Team Leader'
        WHERE s.tl_code IS NOT NULL
        AND UPPER(s.field_user_code) NOT LIKE '%DEMO%'
      ),
      subordinate_reports AS (
        -- Check if each subordinate also supervises others
        SELECT
          sub.field_user_code as supervisor_code,
          COUNT(DISTINCT s.field_user_code) as their_subordinate_count,
          array_agg(DISTINCT s.field_user_name) as their_subordinates
        FROM flat_sales_transactions s
        INNER JOIN flat_sales_transactions sub ON s.tl_code = sub.field_user_code
        WHERE s.tl_code IS NOT NULL
        GROUP BY sub.field_user_code
      )
      SELECT
        tls.team_leader_code,
        tls.team_leader_name,
        tls.subordinate_code,
        tls.subordinate_name,
        tls.subordinate_role,
        COALESCE(sr.their_subordinate_count, 0) as subordinates_they_supervise,
        sr.their_subordinates as who_they_supervise
      FROM tl_subordinates tls
      LEFT JOIN subordinate_reports sr ON tls.subordinate_code = sr.supervisor_code
      ORDER BY
        tls.team_leader_name,
        sr.their_subordinate_count DESC NULLS LAST,
        tls.subordinate_role,
        tls.subordinate_name
    `)

    // Get people who supervise but aren't Team Leaders
    const nonTLSupervisors = await query(`
      WITH all_supervisors AS (
        SELECT DISTINCT tl_code as supervisor_code
        FROM flat_sales_transactions
        WHERE tl_code IS NOT NULL
      ),
      supervisor_details AS (
        SELECT DISTINCT
          field_user_code,
          field_user_name,
          COALESCE(user_role, 'Field User') as role
        FROM flat_sales_transactions
        WHERE UPPER(field_user_code) NOT LIKE '%DEMO%'
      )
      SELECT
        sd.field_user_code,
        sd.field_user_name,
        sd.role,
        COUNT(DISTINCT s.field_user_code) as subordinate_count,
        array_agg(DISTINCT s.field_user_name) as subordinates
      FROM supervisor_details sd
      INNER JOIN all_supervisors sup ON sd.field_user_code = sup.supervisor_code
      INNER JOIN flat_sales_transactions s ON s.tl_code = sd.field_user_code
      WHERE sd.role != 'Team Leader'
      GROUP BY sd.field_user_code, sd.field_user_name, sd.role
      ORDER BY subordinate_count DESC
    `)

    // Analyze hierarchy levels
    const hierarchyAnalysis = fullHierarchy.rows

    const topLevel = hierarchyAnalysis.filter(p => p.immediate_supervisor === null)
    const middleManagers = hierarchyAnalysis.filter(p => parseInt(p.people_supervised) > 0)
    const individualContributors = hierarchyAnalysis.filter(p => parseInt(p.people_supervised) === 0 && p.immediate_supervisor !== null)

    // Group middle managers by role
    const middleManagersByRole = middleManagers.reduce((acc: any, person: any) => {
      if (!acc[person.role]) {
        acc[person.role] = []
      }
      acc[person.role].push({
        code: person.field_user_code,
        name: person.field_user_name,
        supervises: parseInt(person.people_supervised),
        reportsTo: person.supervisor_name
      })
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        fullHierarchy: hierarchyAnalysis,
        teamLeaderSubordinates: teamLeaderSubordinates.rows,
        nonTeamLeaderSupervisors: nonTLSupervisors.rows,
        summary: {
          totalPeople: hierarchyAnalysis.length,
          topLevelPeople: topLevel.length,
          totalMiddleManagers: middleManagers.length,
          middleManagersByRole: middleManagersByRole,
          individualContributors: individualContributors.length,
          hierarchyLevels: {
            level1: 'Top Level (no supervisor)',
            level2: 'Middle Managers (have subordinates)',
            level3: 'Individual Contributors (no subordinates)'
          }
        }
      }
    })
  } catch (error) {
    console.error('Full hierarchy API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
