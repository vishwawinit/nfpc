import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Simple check - Get 5 records from customer master
    const customerQuery = `
      SELECT * FROM flat_customers_master LIMIT 5
    `
    const customers = await query(customerQuery, [])
    
    // Simple check - Get 5 records from sales transactions
    const salesQuery = `
      SELECT * FROM flat_sales_transactions LIMIT 5
    `
    const sales = await query(salesQuery, [])
    
    // Check if any sales in recent months
    const recentSalesQuery = `
      SELECT 
        DATE_TRUNC('month', trx_date_only) as month,
        COUNT(*) as count
      FROM flat_sales_transactions
      GROUP BY DATE_TRUNC('month', trx_date_only)
      ORDER BY month DESC
      LIMIT 6
    `
    const recentSales = await query(recentSalesQuery, [])
    
    return NextResponse.json({
      success: true,
      customers: {
        count: customers.rows.length,
        firstRecord: customers.rows[0]
      },
      sales: {
        count: sales.rows.length,
        firstRecord: sales.rows[0]
      },
      recentSalesMonths: recentSales.rows,
      message: "Simple check complete"
    })
    
  } catch (error) {
    console.error('Simple check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
