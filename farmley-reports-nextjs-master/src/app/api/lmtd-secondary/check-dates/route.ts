import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Get all available months with data
    const monthlyData = await query(`
      SELECT 
        DATE_TRUNC('month', trx_date_only) as month,
        COUNT(*) as record_count,
        MIN(trx_date_only) as first_date,
        MAX(trx_date_only) as last_date,
        SUM(quantity) as total_quantity,
        SUM(net_amount) as total_revenue,
        COUNT(DISTINCT store_code) as unique_stores,
        COUNT(DISTINCT product_code) as unique_products,
        COUNT(DISTINCT field_user_code) as unique_users,
        COUNT(DISTINCT tl_code) as unique_tls
      FROM flat_sales_transactions
      WHERE trx_date_only IS NOT NULL
      GROUP BY DATE_TRUNC('month', trx_date_only)
      ORDER BY month DESC
      LIMIT 24
    `)

    // Get the date range of all data
    const dateRange = await query(`
      SELECT 
        MIN(trx_date_only) as earliest_date,
        MAX(trx_date_only) as latest_date,
        COUNT(*) as total_records
      FROM flat_sales_transactions
    `)

    // Get sample of latest 20 transactions
    const latestTransactions = await query(`
      SELECT 
        trx_date_only,
        tl_code,
        tl_name,
        field_user_code,
        field_user_name,
        store_code,
        store_name,
        chain_name,
        product_code,
        product_name,
        quantity,
        net_amount
      FROM flat_sales_transactions
      WHERE trx_date_only IS NOT NULL
      ORDER BY trx_date_only DESC
      LIMIT 20
    `)

    return NextResponse.json({
      success: true,
      dateRange: dateRange.rows[0],
      monthlyData: monthlyData.rows,
      latestTransactions: latestTransactions.rows,
      message: 'Date range analysis completed'
    })
  } catch (error: any) {
    console.error('Date Check Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
