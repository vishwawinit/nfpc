import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check variance_qty column data quality
    const varianceCheckQuery = `
      SELECT
        COUNT(*) as total_records,
        COUNT(CASE WHEN variance_qty IS NOT NULL THEN 1 END) as has_variance,
        COUNT(CASE WHEN variance_qty != 0 THEN 1 END) as non_zero_variance,
        COUNT(CASE WHEN variance_qty = 0 THEN 1 END) as zero_variance,
        MIN(variance_qty) as min_variance,
        MAX(variance_qty) as max_variance,
        AVG(variance_qty) as avg_variance,
        SUM(variance_qty) as total_variance
      FROM new_flat_stock_movements
    `

    // Get sample records with variance
    const varianceSamplesQuery = `
      SELECT
        salesman_code,
        salesman_name,
        movement_date,
        product_code,
        qty_loaded,
        qty_returned,
        variance_qty,
        opening_stock,
        closing_stock,
        is_van_load,
        is_return
      FROM new_flat_stock_movements
      WHERE variance_qty != 0
      LIMIT 20
    `

    // Get calculated variance (loaded vs sold)
    const calculatedVarianceQuery = `
      WITH loads AS (
        SELECT
          salesman_code,
          salesman_name,
          route_code,
          SUM(CASE WHEN is_van_load = true THEN qty_loaded ELSE 0 END) as total_loaded,
          SUM(CASE WHEN is_return = true THEN qty_returned ELSE 0 END) as total_returned
        FROM new_flat_stock_movements
        WHERE movement_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY salesman_code, salesman_name, route_code
      ),
      sales AS (
        SELECT
          salesman_code,
          route_code,
          SUM(quantity::numeric) as total_sold
        FROM new_flat_transactions
        WHERE trx_date_only >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY salesman_code, route_code
      )
      SELECT
        l.salesman_code,
        l.salesman_name,
        l.route_code,
        l.total_loaded,
        COALESCE(s.total_sold, 0) as total_sold,
        l.total_returned,
        (l.total_loaded - COALESCE(s.total_sold, 0) - l.total_returned) as calculated_stock_variance,
        ABS(l.total_loaded - COALESCE(s.total_sold, 0) - l.total_returned) as abs_variance
      FROM loads l
      LEFT JOIN sales s ON l.salesman_code = s.salesman_code AND l.route_code = s.route_code
      WHERE (l.total_loaded - COALESCE(s.total_sold, 0) - l.total_returned) != 0
      ORDER BY ABS(l.total_loaded - COALESCE(s.total_sold, 0) - l.total_returned) DESC
      LIMIT 20
    `

    const [checkResult, samplesResult, calculatedResult] = await Promise.all([
      db.query(varianceCheckQuery),
      db.query(varianceSamplesQuery),
      db.query(calculatedVarianceQuery)
    ])

    return NextResponse.json({
      success: true,
      varianceColumnCheck: checkResult.rows[0],
      varianceSamples: samplesResult.rows,
      calculatedVariances: calculatedResult.rows
    })

  } catch (error) {
    console.error('Variance test API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test variance data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
