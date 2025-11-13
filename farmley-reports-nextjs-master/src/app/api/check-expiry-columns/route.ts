import { NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET() {
  try {
    // Get column information
    const columnsResult = await query(`
      SELECT 
        column_name, 
        data_type,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'flat_expiry_checks'
      ORDER BY ordinal_position
    `)

    // Get sample data from first row
    const sampleResult = await query(`
      SELECT * FROM flat_expiry_checks 
      ORDER BY visited_date DESC 
      LIMIT 1
    `)

    // Check for NULL percentages
    const nullCheckResult = await query(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(user_role) as user_role_filled,
        COUNT(route_code) as route_code_filled,
        COUNT(near_expiry_id) as near_expiry_id_filled,
        COUNT(created_by) as created_by_filled,
        COUNT(modified_by) as modified_by_filled,
        COUNT(attribute1) as attribute1_filled,
        COUNT(attribute2) as attribute2_filled,
        COUNT(attribute3) as attribute3_filled,
        COUNT(attribute4) as attribute4_filled,
        COUNT(attribute5) as attribute5_filled
      FROM flat_expiry_checks
    `)

    return NextResponse.json({
      success: true,
      columns: columnsResult.rows,
      sampleData: sampleResult.rows[0] || null,
      nullAnalysis: nullCheckResult.rows[0]
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
