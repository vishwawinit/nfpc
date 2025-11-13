import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Check subordinate relationships for all roles
    const [roleSubordinates, promoterExample, allSupervisors] = await Promise.all([
      // Count subordinates by supervisor role
      query(`
        SELECT
          COALESCE(supervisor.user_role, 'Field User') as supervisor_role,
          COUNT(DISTINCT subordinate.field_user_code) as subordinate_count,
          COUNT(DISTINCT supervisor.field_user_code) as supervisor_count
        FROM flat_sales_transactions subordinate
        INNER JOIN flat_sales_transactions supervisor
          ON subordinate.tl_code = supervisor.field_user_code
        WHERE subordinate.tl_code IS NOT NULL
        AND UPPER(subordinate.field_user_code) NOT LIKE '%DEMO%'
        AND UPPER(supervisor.field_user_code) NOT LIKE '%DEMO%'
        GROUP BY supervisor.user_role
        ORDER BY subordinate_count DESC
      `),

      // Get example of promoters with subordinates
      query(`
        SELECT
          supervisor.field_user_code as supervisor_code,
          supervisor.field_user_name as supervisor_name,
          COALESCE(supervisor.user_role, 'Field User') as supervisor_role,
          COUNT(DISTINCT subordinate.field_user_code) as subordinate_count,
          array_agg(DISTINCT subordinate.field_user_name) as subordinate_names
        FROM flat_sales_transactions subordinate
        INNER JOIN flat_sales_transactions supervisor
          ON subordinate.tl_code = supervisor.field_user_code
        WHERE supervisor.user_role = 'Promoter'
        AND UPPER(subordinate.field_user_code) NOT LIKE '%DEMO%'
        AND UPPER(supervisor.field_user_code) NOT LIKE '%DEMO%'
        GROUP BY supervisor.field_user_code, supervisor.field_user_name, supervisor.user_role
        HAVING COUNT(DISTINCT subordinate.field_user_code) > 0
        ORDER BY subordinate_count DESC
        LIMIT 10
      `),

      // Get all supervisors with subordinate counts
      query(`
        SELECT
          tl_code as supervisor_code,
          COUNT(DISTINCT field_user_code) as subordinate_count
        FROM flat_sales_transactions
        WHERE tl_code IS NOT NULL
        AND UPPER(field_user_code) NOT LIKE '%DEMO%'
        AND UPPER(tl_code) NOT LIKE '%DEMO%'
        GROUP BY tl_code
        ORDER BY subordinate_count DESC
        LIMIT 20
      `)
    ])

    return NextResponse.json({
      success: true,
      data: {
        subordinatesByRole: roleSubordinates.rows,
        promoterExamples: promoterExample.rows,
        topSupervisors: allSupervisors.rows
      }
    })
  } catch (error) {
    console.error('Test subordinates API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
