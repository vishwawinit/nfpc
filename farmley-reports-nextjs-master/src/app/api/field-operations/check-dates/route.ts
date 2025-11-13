import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Get unique dates from flat_field_operations
    const fieldDatesQuery = `
      SELECT
        DATE(operation_date) as date,
        COUNT(*) as records,
        SUM(completed_visits) as total_visits
      FROM flat_field_operations
      GROUP BY DATE(operation_date)
      ORDER BY date DESC
      LIMIT 10
    `

    const fieldDates = await db.query(fieldDatesQuery)

    // Get unique dates from flat_journey_performance
    const journeyDatesQuery = `
      SELECT
        DATE(journey_date) as date,
        COUNT(*) as records
      FROM flat_journey_performance
      GROUP BY DATE(journey_date)
      ORDER BY date DESC
      LIMIT 10
    `

    const journeyDates = await db.query(journeyDatesQuery)

    return NextResponse.json({
      fieldOperationsDates: fieldDates.rows,
      journeyPerformanceDates: journeyDates.rows
    })

  } catch (error) {
    console.error('Check dates error:', error)
    return NextResponse.json(
      { error: 'Check dates failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}