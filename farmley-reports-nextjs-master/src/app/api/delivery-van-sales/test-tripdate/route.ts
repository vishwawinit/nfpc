import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check if TripDate exists in delivery fulfillment table
    const schemaCheckQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_delivery_fulfillment'
      ORDER BY ordinal_position
    `

    // Check sample data with all date fields
    const sampleDataQuery = `
      SELECT
        order_date,
        delivery_date,
        salesman_code,
        customer_code,
        qty_requested,
        qty_delivered,
        (delivery_date::date - order_date::date) as current_calculation_days
      FROM new_flat_delivery_fulfillment
      WHERE delivery_date IS NOT NULL
      LIMIT 10
    `

    // Check if there's a trip_date or planned_date field
    const allColumnsQuery = `
      SELECT * FROM new_flat_delivery_fulfillment
      LIMIT 1
    `

    const [schemaResult, sampleResult, columnsResult] = await Promise.all([
      db.query(schemaCheckQuery),
      db.query(sampleDataQuery),
      db.query(allColumnsQuery)
    ])

    return NextResponse.json({
      success: true,
      tableSchema: schemaResult.rows,
      sampleData: sampleResult.rows,
      allColumnNames: columnsResult.rows.length > 0 ? Object.keys(columnsResult.rows[0]) : [],
      firstRowData: columnsResult.rows[0] || null
    })

  } catch (error) {
    console.error('TripDate test API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test TripDate',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
