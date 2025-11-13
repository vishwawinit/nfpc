import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    const today = new Date()
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)
    const startDateStr = lastMonthStart.toISOString().split('T')[0]
    const endDateStr = lastMonthEnd.toISOString().split('T')[0]

    // DIRECT SQL - Check VISHNU's stock movements
    const vishnuStockQuery = `
      SELECT
        salesman_code,
        salesman_name,
        movement_date,
        product_code,
        qty_loaded,
        qty_returned,
        opening_stock,
        closing_stock,
        variance_qty,
        is_van_load,
        is_return
      FROM new_flat_stock_movements
      WHERE salesman_code = '20659'
        AND movement_date BETWEEN $1 AND $2
      ORDER BY movement_date, product_code
    `

    // DIRECT SQL - Check VISHNU's transactions
    const vishnuSalesQuery = `
      SELECT
        salesman_code,
        trx_date_only,
        product_code,
        quantity
      FROM new_flat_transactions
      WHERE salesman_code = '20659'
        AND trx_date_only BETWEEN $1 AND $2
      ORDER BY trx_date_only, product_code
    `

    // Aggregated summary for VISHNU
    const vishnuSummaryQuery = `
      WITH loads AS (
        SELECT
          SUM(CASE WHEN is_van_load = true THEN qty_loaded ELSE 0 END) as total_loaded,
          SUM(CASE WHEN is_return = true THEN qty_returned ELSE 0 END) as total_returned,
          SUM(opening_stock) as total_opening,
          SUM(closing_stock) as total_closing,
          SUM(variance_qty) as total_variance_qty,
          COUNT(*) as movement_records
        FROM new_flat_stock_movements
        WHERE salesman_code = '20659'
          AND movement_date BETWEEN $1 AND $2
      ),
      sales AS (
        SELECT
          SUM(quantity::numeric) as total_sold,
          COUNT(*) as transaction_records
        FROM new_flat_transactions
        WHERE salesman_code = '20659'
          AND trx_date_only BETWEEN $1 AND $2
      )
      SELECT
        l.total_loaded,
        s.total_sold,
        l.total_returned,
        l.total_opening,
        l.total_closing,
        l.total_variance_qty,
        (l.total_loaded - COALESCE(s.total_sold, 0) - l.total_returned) as calculated_variance,
        l.movement_records,
        s.transaction_records
      FROM loads l, sales s
    `

    // Check date ranges in database
    const dateRangeQuery = `
      SELECT
        'stock_movements' as table_name,
        MIN(movement_date) as min_date,
        MAX(movement_date) as max_date,
        COUNT(*) as total_records
      FROM new_flat_stock_movements
      WHERE salesman_code = '20659'
      UNION ALL
      SELECT
        'transactions' as table_name,
        MIN(trx_date_only),
        MAX(trx_date_only),
        COUNT(*)
      FROM new_flat_transactions
      WHERE salesman_code = '20659'
    `

    // Company-wide totals
    const companyTotalsQuery = `
      WITH loads AS (
        SELECT
          SUM(CASE WHEN is_van_load = true THEN qty_loaded ELSE 0 END) as total_loaded,
          SUM(CASE WHEN is_return = true THEN qty_returned ELSE 0 END) as total_returned
        FROM new_flat_stock_movements
        WHERE movement_date BETWEEN $1 AND $2
      ),
      sales AS (
        SELECT
          SUM(quantity::numeric) as total_sold
        FROM new_flat_transactions
        WHERE trx_date_only BETWEEN $1 AND $2
      )
      SELECT
        l.total_loaded,
        s.total_sold,
        l.total_returned,
        (l.total_loaded - COALESCE(s.total_sold, 0) - l.total_returned) as net_variance
      FROM loads l, sales s
    `

    const [
      vishnuStockResult,
      vishnuSalesResult,
      vishnuSummaryResult,
      dateRangeResult,
      companyTotalsResult
    ] = await Promise.all([
      db.query(vishnuStockQuery, [startDateStr, endDateStr]),
      db.query(vishnuSalesQuery, [startDateStr, endDateStr]),
      db.query(vishnuSummaryQuery, [startDateStr, endDateStr]),
      db.query(dateRangeQuery),
      db.query(companyTotalsQuery, [startDateStr, endDateStr])
    ])

    return NextResponse.json({
      success: true,
      dateRange: {
        start: startDateStr,
        end: endDateStr,
        label: 'Last Month (September 2025)'
      },
      vishnu: {
        stockMovements: vishnuStockResult.rows,
        transactions: vishnuSalesResult.rows,
        summary: vishnuSummaryResult.rows[0],
        dateRanges: dateRangeResult.rows
      },
      companyTotals: companyTotalsResult.rows[0]
    })

  } catch (error) {
    console.error('Stock verification API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to verify stock data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
