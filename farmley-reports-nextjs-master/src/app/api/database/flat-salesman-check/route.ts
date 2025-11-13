import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check flat_salesman_performance table structure and sample data
    const dataQuery = `
      SELECT
        salesman_code,
        salesman_name,
        total_sales_30d,
        total_orders_30d,
        avg_daily_sales,
        best_day_sales,
        active_days,
        sales_rank,
        monthly_target,
        monthly_achievement_pct,
        performance_status,
        last_updated
      FROM flat_salesman_performance
      ORDER BY sales_rank
      LIMIT 10
    `

    // Count total salesmen
    const countQuery = `SELECT COUNT(*) as total_salesmen FROM flat_salesman_performance`

    // Check data availability and compare with current data
    const dataAvailabilityQuery = `
      SELECT
        COUNT(*) as total_salesmen,
        COUNT(CASE WHEN total_sales_30d > 0 THEN 1 END) as active_salesmen,
        SUM(total_sales_30d) as total_sales,
        AVG(total_sales_30d) as avg_sales_per_salesman,
        MAX(total_sales_30d) as max_salesman_sales,
        MAX(last_updated) as last_data_update
      FROM flat_salesman_performance
    `

    // Compare with current flat_transactions data
    const currentSalesmenQuery = `
      SELECT
        user_code,
        user_name,
        COUNT(*) as orders,
        SUM(total_amount) as sales
      FROM flat_transactions
      WHERE trx_date >= CURRENT_DATE - INTERVAL '30 days'
        AND total_amount > 0
        AND user_code IS NOT NULL
      GROUP BY user_code, user_name
      ORDER BY sales DESC
      LIMIT 5
    `

    const [dataResult, countResult, availabilityResult, currentResult] = await Promise.all([
      db.query(dataQuery),
      db.query(countQuery),
      db.query(dataAvailabilityQuery),
      db.query(currentSalesmenQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        sampleSalesmen: dataResult.rows,
        totalSalesmen: countResult.rows[0].total_salesmen,
        dataAvailability: availabilityResult.rows[0],
        currentTopSalesmen: currentResult.rows,
        comparison: {
          flatTableSalesmen: dataResult.rows.length,
          currentActiveSalesmen: currentResult.rows.length
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Flat salesman performance check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check flat_salesman_performance table',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}