import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Check if table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'flat_planogram_executions'
      ) as table_exists
    `)
    
    if (!tableCheck.rows[0]?.table_exists) {
      return NextResponse.json({
        success: false,
        error: 'Table flat_planogram_executions does not exist'
      })
    }

    // Get all columns
    const columnsResult = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'flat_planogram_executions'
      ORDER BY ordinal_position
    `)

    // Get sample data
    const sampleData = await query(`
      SELECT *
      FROM flat_planogram_executions
      WHERE execution_type = '1'
      ORDER BY execution_date DESC
      LIMIT 2
    `)

    // Get row count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM flat_planogram_executions
      WHERE execution_type = '1'
    `)

    return NextResponse.json({
      success: true,
      table: 'flat_planogram_executions',
      columns: columnsResult.rows,
      sampleData: sampleData.rows,
      totalRows: countResult.rows[0].total,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Schema test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
