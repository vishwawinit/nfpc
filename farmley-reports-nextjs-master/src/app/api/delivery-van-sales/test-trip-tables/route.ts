import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check trip_completion table schema
    const tripCompletionSchemaQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_trip_completion'
      ORDER BY ordinal_position
    `

    // Check journey_management table schema
    const journeySchemaQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_journey_management'
      ORDER BY ordinal_position
    `

    // Sample from trip_completion
    const tripSampleQuery = `
      SELECT * FROM new_flat_trip_completion
      LIMIT 5
    `

    // Sample from journey_management
    const journeySampleQuery = `
      SELECT * FROM new_flat_journey_management
      LIMIT 5
    `

    const [tripSchemaResult, journeySchemaResult, tripSampleResult, journeySampleResult] = await Promise.all([
      db.query(tripCompletionSchemaQuery),
      db.query(journeySchemaQuery),
      db.query(tripSampleQuery),
      db.query(journeySampleQuery)
    ])

    return NextResponse.json({
      success: true,
      tripCompletionSchema: tripSchemaResult.rows,
      journeyManagementSchema: journeySchemaResult.rows,
      tripCompletionSample: tripSampleResult.rows,
      journeyManagementSample: journeySampleResult.rows,
      tripCompletionColumns: tripSampleResult.rows.length > 0 ? Object.keys(tripSampleResult.rows[0]) : [],
      journeyManagementColumns: journeySampleResult.rows.length > 0 ? Object.keys(journeySampleResult.rows[0]) : []
    })

  } catch (error) {
    console.error('Trip tables test API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test trip tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
