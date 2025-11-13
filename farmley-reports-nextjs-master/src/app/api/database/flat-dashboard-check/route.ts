import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check flat_dashboard_kpi table structure and data
    const dataQuery = `
      SELECT
        calculation_date,
        today_sales,
        today_orders,
        today_customers,
        growth_percentage,
        mtd_sales,
        ytd_sales,
        average_order_value,
        conversion_rate,
        last_updated
      FROM flat_dashboard_kpi
      ORDER BY calculation_date DESC
      LIMIT 10
    `

    // Count total records
    const countQuery = `SELECT COUNT(*) as total_records FROM flat_dashboard_kpi`

    // Get latest data
    const latestQuery = `
      SELECT
        MAX(calculation_date) as latest_date,
        COUNT(DISTINCT calculation_date) as total_days,
        SUM(today_sales) as total_sales_recorded,
        MAX(last_updated) as last_data_update
      FROM flat_dashboard_kpi
    `

    // Compare with current flat_transactions today's data
    const currentTodayQuery = `
      SELECT
        COUNT(*) as orders,
        SUM(total_amount) as sales,
        COUNT(DISTINCT client_code) as customers,
        CASE
          WHEN COUNT(*) > 0 THEN SUM(total_amount) / COUNT(*)
          ELSE 0
        END as avg_order_value
      FROM flat_transactions
      WHERE DATE(trx_date) = CURRENT_DATE
        AND total_amount > 0
    `

    const [dataResult, countResult, latestResult, currentResult] = await Promise.all([
      db.query(dataQuery),
      db.query(countQuery),
      db.query(latestQuery),
      db.query(currentTodayQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        sampleData: dataResult.rows,
        totalRecords: countResult.rows[0].total_records,
        latestInfo: latestResult.rows[0],
        currentTodayData: currentResult.rows[0],
        comparison: {
          flatTableHasData: dataResult.rows.length > 0,
          currentHasTodayData: currentResult.rows[0].orders > 0
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Flat dashboard KPI check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check flat_dashboard_kpi table',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}