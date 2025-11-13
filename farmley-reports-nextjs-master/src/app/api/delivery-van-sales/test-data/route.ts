import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check ALL delivery data - entire table
    const summaryQuery = `
      SELECT
        COUNT(*) as total_records,
        COUNT(CASE WHEN delivery_date IS NOT NULL THEN 1 END) as has_delivery_date,
        COUNT(CASE WHEN delivery_date IS NULL THEN 1 END) as missing_delivery_date,

        -- Check delivery timing by day differences
        COUNT(CASE WHEN delivery_date::date = order_date::date THEN 1 END) as same_day,
        COUNT(CASE WHEN delivery_date::date = order_date::date + 1 THEN 1 END) as next_day,
        COUNT(CASE WHEN (delivery_date::date - order_date::date) = 2 THEN 1 END) as two_days,
        COUNT(CASE WHEN (delivery_date::date - order_date::date) = 3 THEN 1 END) as three_days,
        COUNT(CASE WHEN (delivery_date::date - order_date::date) > 3 THEN 1 END) as more_than_3_days,

        -- Average days calculation
        ROUND(AVG((delivery_date::date - order_date::date)::numeric), 2) as avg_days,
        MIN(delivery_date::date - order_date::date) as min_days,
        MAX(delivery_date::date - order_date::date) as max_days,

        -- Data quality checks
        COUNT(CASE WHEN delivery_date::date < order_date::date THEN 1 END) as delivered_before_ordered,

        -- Date range in data
        MIN(order_date) as earliest_order,
        MAX(order_date) as latest_order

      FROM new_flat_delivery_fulfillment
      WHERE delivery_date IS NOT NULL
    `

    // Get sample records with actual dates to verify
    const sampleQuery = `
      SELECT
        order_date,
        delivery_date,
        (delivery_date::date - order_date::date) as days_to_deliver,
        salesman_code,
        customer_code,
        qty_requested,
        qty_delivered
      FROM new_flat_delivery_fulfillment
      WHERE delivery_date IS NOT NULL
      ORDER BY (delivery_date::date - order_date::date) DESC
      LIMIT 20
    `

    // Get distribution of delivery days
    const distributionQuery = `
      SELECT
        (delivery_date::date - order_date::date) as days_difference,
        COUNT(*) as count
      FROM new_flat_delivery_fulfillment
      WHERE delivery_date IS NOT NULL
      GROUP BY days_difference
      ORDER BY days_difference
    `

    const [summaryResult, sampleResult, distributionResult] = await Promise.all([
      db.query(summaryQuery),
      db.query(sampleQuery),
      db.query(distributionQuery)
    ])

    return NextResponse.json({
      success: true,
      summary: summaryResult.rows[0],
      sampleRecords: sampleResult.rows,
      dayDistribution: distributionResult.rows
    })

  } catch (error) {
    console.error('Test data API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch test data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
