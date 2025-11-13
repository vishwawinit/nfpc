import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { isAdmin } from '@/lib/mssql'

export async function GET(request: NextRequest) {
  const loginUserCode = 'admin'
  
  // Build the exact SQL that would be used for admin
  const fieldUsersSQL = `
    SELECT
      fu.field_user_code as "value",
      fu.field_user_name as "label",
      fu.role as "role",
      fu.tl_code as "teamLeaderCode",
      fu.region_code as "regionCode",
      fu.route_code as "routeCode",
      COALESCE(counts.transaction_count, 0) as "transactionCount"
    FROM (
      SELECT DISTINCT
        field_user_code,
        field_user_name,
        COALESCE(user_role, 'Field User') as role,
        MIN(tl_code) as tl_code,
        MIN(region_code) as region_code,
        MIN(route_code) as route_code
      FROM flat_sales_transactions
      WHERE field_user_code IS NOT NULL
      ${!loginUserCode || loginUserCode === 'admin' || isAdmin(loginUserCode) ? '' : 'AND tl_code IS NOT NULL'}
      AND COALESCE(user_role, 'Field User') != 'Team Leader'
      AND UPPER(field_user_code) NOT LIKE '%DEMO%'
      AND UPPER(field_user_name) NOT LIKE '%DEMO%'
      ${!loginUserCode || loginUserCode === 'admin' || isAdmin(loginUserCode) ? '' :
        '' /* no hierarchy filter for admin */}
      GROUP BY field_user_code, field_user_name, user_role
    ) fu
    LEFT JOIN (
      SELECT
        field_user_code,
        COUNT(*) as transaction_count
      FROM flat_sales_transactions
      WHERE UPPER(COALESCE(field_user_code, '')) NOT LIKE '%DEMO%'
      AND UPPER(COALESCE(field_user_name, '')) NOT LIKE '%DEMO%'
      AND UPPER(COALESCE(region_code, '')) NOT LIKE '%DEMO%'
      AND UPPER(COALESCE(route_code, '')) NOT LIKE '%DEMO%'
      AND trx_date_only >= '2025-10-01'::date
      AND trx_date_only <= '2025-10-28'::date
      GROUP BY field_user_code
    ) counts ON fu.field_user_code = counts.field_user_code
    ORDER BY fu.field_user_name
  `
  
  console.log('SQL for admin field users:')
  console.log(fieldUsersSQL)
  
  const result = await query(fieldUsersSQL)
  
  return NextResponse.json({
    loginUserCode,
    isAdminCheck: isAdmin(loginUserCode),
    sqlGenerated: fieldUsersSQL,
    resultCount: result.rows.length,
    sampleResults: result.rows.slice(0, 10).map(r => r.value)
  })
}
