import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Get all columns from the table
    const columnsResult = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'flat_planogram_executions'
      ORDER BY ordinal_position
    `)

    // Get a sample row to see actual data
    const sampleResult = await query(`
      SELECT *
      FROM flat_planogram_executions
      WHERE execution_type = '1'
      LIMIT 1
    `)

    return NextResponse.json({
      success: true,
      availableColumns: columnsResult.rows.map(r => r.column_name),
      sampleData: sampleResult.rows[0] || {},
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
