import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('Testing database tables and relationships...')
    
    // Test 1: Check flat_transactions
    const transactionsTest = await query(`
      SELECT 
        COUNT(*) as total_records,
        MIN(transaction_date::date) as first_date,
        MAX(transaction_date::date) as last_date,
        COUNT(DISTINCT customer_code) as unique_customers,
        COUNT(DISTINCT product_code) as unique_products
      FROM flat_transactions
      WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days'
    `)
    
    // Test 2: Check flat_customers_master
    const customersTest = await query(`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(DISTINCT customer_category) as categories,
        COUNT(DISTINCT customer_type) as types,
        COUNT(DISTINCT city) as cities,
        COUNT(DISTINCT state) as states
      FROM flat_customers_master
      WHERE is_active = true OR is_active IS NULL
    `)
    
    // Test 3: Check flat_products_master
    const productsTest = await query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(DISTINCT category_name) as categories,
        COUNT(DISTINCT subcategory_name) as subcategories,
        COUNT(DISTINCT brand_name) as brands,
        COUNT(DISTINCT product_type) as types
      FROM flat_products_master
      WHERE is_active = true OR is_active IS NULL
    `)
    
    // Test 4: Test JOIN between transactions and customers
    const customerJoinTest = await query(`
      SELECT 
        COUNT(*) as matched_records,
        COUNT(DISTINCT t.customer_code) as customers_with_transactions
      FROM flat_transactions t
      INNER JOIN flat_customers_master c ON t.customer_code = c.customer_code
      WHERE t.transaction_date >= CURRENT_DATE - INTERVAL '30 days'
    `)
    
    // Test 5: Test JOIN between transactions and products
    const productJoinTest = await query(`
      SELECT 
        COUNT(*) as matched_records,
        COUNT(DISTINCT t.product_code) as products_with_transactions
      FROM flat_transactions t
      INNER JOIN flat_products_master p ON t.product_code = p.product_code
      WHERE t.transaction_date >= CURRENT_DATE - INTERVAL '30 days'
    `)
    
    // Test 6: Get sample channel data
    const channelSample = await query(`
      SELECT 
        COALESCE(c.customer_category, c.customer_type, 'Unknown') as channel,
        COUNT(DISTINCT t.customer_code) as customers,
        SUM(t.net_amount) as total_sales
      FROM flat_transactions t
      LEFT JOIN flat_customers_master c ON t.customer_code = c.customer_code
      WHERE t.transaction_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY COALESCE(c.customer_category, c.customer_type, 'Unknown')
      ORDER BY total_sales DESC NULLS LAST
      LIMIT 10
    `)
    
    // Test 7: Get sample product categories
    const productCategorySample = await query(`
      SELECT 
        COALESCE(p.category_name, 'Unknown') as category,
        COUNT(DISTINCT t.product_code) as products,
        SUM(t.net_amount) as total_sales
      FROM flat_transactions t
      LEFT JOIN flat_products_master p ON t.product_code = p.product_code
      WHERE t.transaction_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY COALESCE(p.category_name, 'Unknown')
      ORDER BY total_sales DESC NULLS LAST
      LIMIT 10
    `)
    
    return NextResponse.json({
      success: true,
      tests: {
        flat_transactions: transactionsTest.rows[0],
        flat_customers_master: customersTest.rows[0],
        flat_products_master: productsTest.rows[0],
        customer_joins: customerJoinTest.rows[0],
        product_joins: productJoinTest.rows[0],
        channels: channelSample.rows,
        product_categories: productCategorySample.rows
      },
      message: 'All table tests completed successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Tables check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 })
  }
}