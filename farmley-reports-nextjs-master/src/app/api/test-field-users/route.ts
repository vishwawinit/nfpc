import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const [allFieldUsers, supervisorRoles, fieldUsersWithoutSupervisor] = await Promise.all([
      // Get ALL field users with their supervisors and roles
      query(`
        SELECT
          fu.field_user_code,
          fu.field_user_name,
          COALESCE(fu.user_role, 'Field User') as field_user_role,
          fu.tl_code as supervisor_code,
          supervisor.field_user_name as supervisor_name,
          COALESCE(supervisor.user_role, 'Field User') as supervisor_role
        FROM (
          SELECT DISTINCT
            field_user_code,
            field_user_name,
            user_role,
            tl_code
          FROM flat_sales_transactions
          WHERE field_user_code IS NOT NULL
          AND UPPER(field_user_code) NOT LIKE '%DEMO%'
        ) fu
        LEFT JOIN (
          SELECT DISTINCT
            field_user_code,
            field_user_name,
            user_role
          FROM flat_sales_transactions
          WHERE field_user_code IS NOT NULL
        ) supervisor ON fu.tl_code = supervisor.field_user_code
        ORDER BY fu.field_user_name
        LIMIT 50
      `),

      // Get count of field users by their supervisor's role
      query(`
        SELECT
          COALESCE(supervisor.user_role, 'Field User') as supervisor_role,
          COUNT(DISTINCT fu.field_user_code) as field_user_count
        FROM (
          SELECT DISTINCT field_user_code, tl_code
          FROM flat_sales_transactions
          WHERE tl_code IS NOT NULL
          AND UPPER(field_user_code) NOT LIKE '%DEMO%'
        ) fu
        INNER JOIN (
          SELECT DISTINCT field_user_code, user_role
          FROM flat_sales_transactions
        ) supervisor ON fu.tl_code = supervisor.field_user_code
        GROUP BY supervisor.user_role
        ORDER BY field_user_count DESC
      `),

      // Get field users WITHOUT any supervisor
      query(`
        SELECT
          field_user_code,
          field_user_name,
          COALESCE(user_role, 'Field User') as role,
          COUNT(*) as transaction_count
        FROM flat_sales_transactions
        WHERE (tl_code IS NULL OR tl_code = '')
        AND UPPER(field_user_code) NOT LIKE '%DEMO%'
        GROUP BY field_user_code, field_user_name, user_role
        ORDER BY transaction_count DESC
        LIMIT 20
      `)
    ])

    // Get role distribution of ALL users
    const roleDistribution = await query(`
      SELECT
        COALESCE(user_role, 'Field User') as role,
        COUNT(DISTINCT field_user_code) as user_count,
        COUNT(DISTINCT CASE WHEN tl_code IS NOT NULL THEN field_user_code END) as users_with_supervisor,
        COUNT(DISTINCT CASE WHEN tl_code IS NULL THEN field_user_code END) as users_without_supervisor
      FROM flat_sales_transactions
      WHERE UPPER(field_user_code) NOT LIKE '%DEMO%'
      GROUP BY user_role
      ORDER BY user_count DESC
    `)

    return NextResponse.json({
      success: true,
      data: {
        sampleFieldUsers: allFieldUsers.rows,
        fieldUsersBySupervisorRole: supervisorRoles.rows,
        fieldUsersWithoutSupervisor: fieldUsersWithoutSupervisor.rows,
        roleDistribution: roleDistribution.rows,
        summary: {
          totalFieldUsersInSample: allFieldUsers.rows.length,
          supervisorRoleBreakdown: supervisorRoles.rows,
          usersWithoutSupervisorCount: fieldUsersWithoutSupervisor.rows.length
        }
      }
    })
  } catch (error) {
    console.error('Test field users API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
