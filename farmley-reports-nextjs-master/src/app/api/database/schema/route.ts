import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Get all column names from flat_transactions table
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'flat_transactions'
      ORDER BY ordinal_position
    `

    const result = await db.query(columnsQuery)

    // Also get a sample row to see what data looks like
    const sampleQuery = `
      SELECT * FROM flat_transactions
      WHERE route_code IS NOT NULL
      LIMIT 1
    `

    const sampleResult = await db.query(sampleQuery)

    return NextResponse.json({
      success: true,
      data: {
        columns: result.rows,
        sampleRow: sampleResult.rows[0] || null
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Schema API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get schema info',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}