import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Get roles of all supervisors
    const result = await query(`
      SELECT DISTINCT
        supervisor.field_user_code,
        supervisor.field_user_name,
        COALESCE(supervisor.user_role, 'Field User') as role,
        subordinate_counts.subordinate_count
      FROM flat_sales_transactions supervisor
      INNER JOIN (
        SELECT
          tl_code,
          COUNT(DISTINCT field_user_code) as subordinate_count
        FROM flat_sales_transactions
        WHERE tl_code IS NOT NULL
        AND UPPER(field_user_code) NOT LIKE '%DEMO%'
        GROUP BY tl_code
      ) subordinate_counts ON supervisor.field_user_code = subordinate_counts.tl_code
      WHERE UPPER(supervisor.field_user_code) NOT LIKE '%DEMO%'
      ORDER BY subordinate_counts.subordinate_count DESC
    `)

    return NextResponse.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
