import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check what trx_type values exist
    const trxTypesQuery = `
      SELECT 
        trx_type,
        trx_type_name,
        COUNT(*) as count,
        MIN(trx_date_only) as earliest_date,
        MAX(trx_date_only) as latest_date,
        SUM(net_amount) as total_amount
      FROM flat_sales_transactions
      WHERE net_amount IS NOT NULL
      GROUP BY trx_type, trx_type_name
      ORDER BY count DESC
    `
    const trxTypes = await query(trxTypesQuery, [])
    
    // Check recent sales data by month for invoice type transactions
    const monthlySalesQuery = `
      SELECT 
        DATE_TRUNC('month', trx_date_only) as month,
        COUNT(*) as transaction_count,
        COUNT(DISTINCT store_code) as unique_stores,
        SUM(net_amount) as total_sales
      FROM flat_sales_transactions
      WHERE net_amount > 0
      AND trx_date_only >= '2025-06-01'
      GROUP BY DATE_TRUNC('month', trx_date_only)
      ORDER BY month DESC
    `
    const monthlySales = await query(monthlySalesQuery, [])
    
    // Get top customers based on sales
    const topCustomersQuery = `
      SELECT 
        store_code,
        store_name,
        region_name,
        city_name,
        chain_name,
        COUNT(*) as transaction_count,
        SUM(net_amount) as total_sales
      FROM flat_sales_transactions
      WHERE net_amount > 0
      AND trx_date_only >= '2025-08-01'
      GROUP BY store_code, store_name, region_name, city_name, chain_name
      ORDER BY total_sales DESC
      LIMIT 10
    `
    const topCustomers = await query(topCustomersQuery, [])
    
    return NextResponse.json({
      success: true,
      transactionTypes: trxTypes.rows,
      monthlySales: monthlySales.rows,
      topCustomers: topCustomers.rows,
      message: "Transaction types and sales data retrieved"
    })
    
  } catch (error) {
    console.error('Check trx types error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
