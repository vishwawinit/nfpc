import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Get flat_targets table schema
    const schemaQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'flat_targets'
      ORDER BY ordinal_position
    `

    // Get sample data to understand the structure
    const sampleQuery = `
      SELECT * FROM flat_targets
      LIMIT 3
    `

    const [schemaResult, sampleResult] = await Promise.all([
      db.query(schemaQuery),
      db.query(sampleQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        schema: schemaResult.rows,
        sampleData: sampleResult.rows
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Targets schema API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get targets schema',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}