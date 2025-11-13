import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Try to join delivery fulfillment with trip completion
    const joinTestQuery = `
      SELECT
        d.order_code,
        d.order_date,
        d.delivery_date,
        d.salesman_code,
        d.customer_code,
        t.trip_date,
        t.trip_status,
        (d.delivery_date::date - t.trip_date::date) as days_from_trip_date,
        (d.delivery_date::date - d.order_date::date) as days_from_order_date
      FROM new_flat_delivery_fulfillment d
      LEFT JOIN new_flat_trip_completion t
        ON d.salesman_code = t.salesman_code
        AND d.order_date = t.trip_date
      WHERE d.delivery_date IS NOT NULL
        AND d.order_date >= '2025-09-01'
      LIMIT 20
    `

    // Count how many can be joined
    const joinCountQuery = `
      SELECT
        COUNT(*) as total_deliveries,
        COUNT(t.trip_date) as matched_with_trip,
        COUNT(CASE WHEN t.trip_date IS NULL THEN 1 END) as no_trip_match
      FROM new_flat_delivery_fulfillment d
      LEFT JOIN new_flat_trip_completion t
        ON d.salesman_code = t.salesman_code
        AND d.order_date = t.trip_date
      WHERE d.delivery_date IS NOT NULL
        AND d.order_date >= '2025-09-01'
    `

    const [joinResult, countResult] = await Promise.all([
      db.query(joinTestQuery),
      db.query(joinCountQuery)
    ])

    return NextResponse.json({
      success: true,
      joinSamples: joinResult.rows,
      joinStats: countResult.rows[0]
    })

  } catch (error) {
    console.error('Join test API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test join',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
