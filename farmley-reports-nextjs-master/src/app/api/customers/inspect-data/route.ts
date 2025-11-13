import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check the structure of flat_customers_master
    const customerColumnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'flat_customers_master'
      ORDER BY ordinal_position
    `
    const customerColumns = await query(customerColumnsQuery, [])
    
    // Check the structure of flat_sales_transactions
    const salesColumnsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'flat_sales_transactions'
      ORDER BY ordinal_position
    `
    const salesColumns = await query(salesColumnsQuery, [])
    
    // Get sample data from flat_customers_master
    const customerSampleQuery = `
      SELECT * FROM flat_customers_master LIMIT 3
    `
    const customerSample = await query(customerSampleQuery, [])
    
    // Get sample data from flat_sales_transactions with actual data
    const salesSampleQuery = `
      SELECT * FROM flat_sales_transactions 
      WHERE net_amount > 0
      ORDER BY trx_date_only DESC NULLS LAST
      LIMIT 3
    `
    const salesSample = await query(salesSampleQuery, [])
    
    // Check date range of sales transactions
    const dateRangeQuery = `
      SELECT 
        MIN(trx_date_only) as earliest_date,
        MAX(trx_date_only) as latest_date,
        COUNT(*) as total_records,
        COUNT(DISTINCT store_code) as unique_stores
      FROM flat_sales_transactions
      WHERE net_amount > 0
    `
    const dateRange = await query(dateRangeQuery, [])
    
    // Check if we can join the two tables
    const joinTestQuery = `
      SELECT 
        cm.store_code,
        cm.store_name,
        COUNT(st.trx_code) as transaction_count
      FROM flat_customers_master cm
      LEFT JOIN flat_sales_transactions st ON cm.store_code = st.store_code
      GROUP BY cm.store_code, cm.store_name
      ORDER BY transaction_count DESC
      LIMIT 5
    `
    const joinTest = await query(joinTestQuery, [])
    
    return NextResponse.json({
      success: true,
      customerMaster: {
        columns: customerColumns.rows.map(c => `${c.column_name} (${c.data_type})`),
        sampleData: customerSample.rows,
        columnCount: customerColumns.rows.length
      },
      salesTransactions: {
        columns: salesColumns.rows.map(c => `${c.column_name} (${c.data_type})`),
        sampleData: salesSample.rows,
        columnCount: salesColumns.rows.length,
        dateRange: dateRange.rows[0]
      },
      joinTest: {
        canJoin: joinTest.rows.length > 0,
        topCustomersByTransactions: joinTest.rows
      },
      message: "Data structure inspection complete"
    })
    
  } catch (error) {
    console.error('Inspect data error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
