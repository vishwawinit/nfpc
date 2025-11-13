import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    console.log('=== LMTD Secondary Sales Test Route ===')
    
    // Test 1: Check if flat_sales_transactions table has data
    const salesCheck = await query(`
      SELECT 
        COUNT(*) as total_records,
        MIN(trx_date_only) as oldest_date,
        MAX(trx_date_only) as newest_date,
        COUNT(DISTINCT product_code) as unique_products,
        COUNT(DISTINCT store_code) as unique_stores,
        COUNT(DISTINCT field_user_code) as unique_users
      FROM flat_sales_transactions
    `)
    
    console.log('Sales Table Stats:', salesCheck.rows[0])
    
    // Test 2: Check if flat_stock_checks table has data
    const stockCheck = await query(`
      SELECT 
        COUNT(*) as total_records,
        MIN(check_date) as oldest_date,
        MAX(check_date) as newest_date,
        COUNT(DISTINCT product_code) as unique_products,
        COUNT(DISTINCT store_code) as unique_stores
      FROM flat_stock_checks
    `)
    
    console.log('Stock Table Stats:', stockCheck.rows[0])
    
    // Test 3: Sample some actual sales data
    const sampleSales = await query(`
      SELECT 
        trx_date_only,
        product_code,
        product_name,
        store_code,
        store_name,
        field_user_code,
        field_user_name,
        net_amount,
        quantity,
        tl_code,
        tl_name,
        chain_name,
        city_code
      FROM flat_sales_transactions
      WHERE net_amount IS NOT NULL
      ORDER BY trx_date_only DESC
      LIMIT 5
    `)
    
    console.log('Sample Sales Records:', sampleSales.rows)
    
    // Test 4: Sample some stock data
    const sampleStock = await query(`
      SELECT 
        check_date,
        product_code,
        product_name,
        store_code,
        store_name,
        store_quantity,
        field_user_code,
        field_user_name
      FROM flat_stock_checks
      WHERE store_quantity IS NOT NULL
      ORDER BY check_date DESC
      LIMIT 5
    `)
    
    console.log('Sample Stock Records:', sampleStock.rows)
    
    // Test 5: Test MTD calculation for current month
    const currentDate = new Date().toISOString().split('T')[0]
    const mtdStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    
    const mtdTest = await query(`
      SELECT 
        COUNT(*) as transaction_count,
        SUM(net_amount) as total_amount,
        SUM(quantity) as total_quantity
      FROM flat_sales_transactions
      WHERE trx_date_only >= $1::date 
        AND trx_date_only <= $2::date
    `, [mtdStart, currentDate])
    
    console.log('MTD Test Results:', {
      period: { start: mtdStart, end: currentDate },
      results: mtdTest.rows[0]
    })
    
    // Test 6: Test LMTD calculation
    const lastMonthDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, new Date().getDate())
    const lmtdStart = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1).toISOString().split('T')[0]
    const lmtdEnd = lastMonthDate.toISOString().split('T')[0]
    
    const lmtdTest = await query(`
      SELECT 
        COUNT(*) as transaction_count,
        SUM(net_amount) as total_amount,
        SUM(quantity) as total_quantity
      FROM flat_sales_transactions
      WHERE trx_date_only >= $1::date 
        AND trx_date_only <= $2::date
    `, [lmtdStart, lmtdEnd])
    
    console.log('LMTD Test Results:', {
      period: { start: lmtdStart, end: lmtdEnd },
      results: lmtdTest.rows[0]
    })
    
    // Test 7: Test dimension groupings
    const productDimTest = await query(`
      SELECT 
        product_code,
        MAX(product_name) as product_name,
        COUNT(*) as transaction_count,
        SUM(net_amount) as total_amount
      FROM flat_sales_transactions
      WHERE trx_date_only >= $1::date
      GROUP BY product_code
      ORDER BY total_amount DESC
      LIMIT 5
    `, [mtdStart])
    
    console.log('Product Dimension Test (Top 5):', productDimTest.rows)
    
    // Test 8: Check for NULL values in critical columns
    const nullCheck = await query(`
      SELECT 
        SUM(CASE WHEN net_amount IS NULL THEN 1 ELSE 0 END) as null_amounts,
        SUM(CASE WHEN quantity IS NULL THEN 1 ELSE 0 END) as null_quantities,
        SUM(CASE WHEN product_code IS NULL THEN 1 ELSE 0 END) as null_products,
        SUM(CASE WHEN store_code IS NULL THEN 1 ELSE 0 END) as null_stores,
        SUM(CASE WHEN field_user_code IS NULL THEN 1 ELSE 0 END) as null_users,
        COUNT(*) as total_records
      FROM flat_sales_transactions
      WHERE trx_date_only >= $1::date
    `, [lmtdStart])
    
    console.log('NULL Value Check:', nullCheck.rows[0])
    
    return NextResponse.json({
      success: true,
      tests: {
        salesTableStats: salesCheck.rows[0],
        stockTableStats: stockCheck.rows[0],
        sampleSalesRecords: sampleSales.rows,
        sampleStockRecords: sampleStock.rows,
        mtdTest: {
          period: { start: mtdStart, end: currentDate },
          results: mtdTest.rows[0]
        },
        lmtdTest: {
          period: { start: lmtdStart, end: lmtdEnd },
          results: lmtdTest.rows[0]
        },
        productDimensionTest: productDimTest.rows,
        nullValueCheck: nullCheck.rows[0]
      },
      message: 'Test completed successfully. Check console logs for details.'
    })
    
  } catch (error) {
    console.error('Test Route Error:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : '')
    
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.toString() : 'Unknown error'
    }, { status: 500 })
  }
}
