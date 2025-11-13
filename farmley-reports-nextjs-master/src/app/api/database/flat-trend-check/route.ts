import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check flat_sales_trend_optimized table
    const trendDataQuery = `
      SELECT
        trend_date,
        date_string,
        sales,
        orders,
        customers,
        salesmen,
        moving_avg_7d,
        moving_avg_30d,
        morning_sales,
        afternoon_sales,
        evening_sales,
        sales_week_ago,
        sales_month_ago
      FROM flat_sales_trend_optimized
      ORDER BY trend_date DESC
      LIMIT 10
    `

    // Count records and date range
    const trendStatsQuery = `
      SELECT
        COUNT(*) as total_records,
        MIN(trend_date) as earliest_date,
        MAX(trend_date) as latest_date,
        SUM(sales) as total_sales,
        AVG(sales) as avg_daily_sales
      FROM flat_sales_trend_optimized
    `

    // Compare with current sales trend from flat_transactions
    const currentTrendQuery = `
      SELECT
        DATE(trx_date) as date,
        SUM(total_amount) as sales,
        COUNT(*) as orders,
        COUNT(DISTINCT client_code) as customers
      FROM flat_transactions
      WHERE trx_date >= CURRENT_DATE - INTERVAL '7 days'
        AND total_amount > 0
      GROUP BY DATE(trx_date)
      ORDER BY date DESC
    `

    const [trendResult, statsResult, currentResult] = await Promise.all([
      db.query(trendDataQuery),
      db.query(trendStatsQuery),
      db.query(currentTrendQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        sampleTrendData: trendResult.rows,
        trendStats: statsResult.rows[0],
        currentWeekTrend: currentResult.rows,
        comparison: {
          flatTableDays: trendResult.rows.length,
          currentActiveDays: currentResult.rows.length,
          hasEnhancedData: trendResult.rows.some(row => row.morning_sales > 0)
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Flat sales trend check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check flat_sales_trend_optimized table',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}