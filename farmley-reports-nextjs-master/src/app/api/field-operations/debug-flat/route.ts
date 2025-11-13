import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const date = '2025-08-17'

    // Check flat_field_operations data
    const fieldOpsQuery = `
      SELECT
        operation_date,
        COUNT(*) as record_count,
        SUM(completed_visits) as total_visits,
        SUM(productive_visits) as total_productive
      FROM flat_field_operations
      WHERE DATE(operation_date) = $1::date
      GROUP BY operation_date
    `

    const fieldResult = await db.query(fieldOpsQuery, [date])

    // Check flat_journey_performance data
    const journeyQuery = `
      SELECT
        journey_date,
        COUNT(*) as record_count,
        SUM(total_visits) as total_visits
      FROM flat_journey_performance
      WHERE DATE(journey_date) = $1::date
      GROUP BY journey_date
    `

    const journeyResult = await db.query(journeyQuery, [date])

    // Get some sample rows
    const sampleQuery = `
      SELECT * FROM flat_field_operations
      WHERE DATE(operation_date) = $1::date
      LIMIT 5
    `

    const sampleResult = await db.query(sampleQuery, [date])

    return NextResponse.json({
      fieldOperations: fieldResult.rows,
      journeyPerformance: journeyResult.rows,
      sampleData: sampleResult.rows,
      testDate: date
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: 'Debug failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}