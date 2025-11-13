import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Get table columns
    const columnsResult = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'flat_expiry_checks'
      ORDER BY ordinal_position
    `)
    
    // Get sample data
    const sampleResult = await query(`
      SELECT * FROM flat_expiry_checks 
      ORDER BY visited_date DESC 
      LIMIT 5
    `)
    
    // Get data statistics
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_records,
        MIN(visited_date) as earliest_date,
        MAX(visited_date) as latest_date,
        COUNT(DISTINCT customer_code) as unique_customers,
        COUNT(DISTINCT field_user_code) as unique_users,
        COUNT(DISTINCT product_code) as unique_products,
        SUM(items_expired) as total_expired,
        SUM(items_checked) as total_checked
      FROM flat_expiry_checks
      WHERE visited_date >= CURRENT_DATE - INTERVAL '30 days'
    `)
    
    // Check which columns have data AND check for quantity columns
    const dataCheckResult = await query(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(expiry_check_id) as has_id,
        COUNT(quantity) as has_quantity,
        COUNT(quantity_near_expiry) as has_quantity_near,
        COUNT(items_checked) as has_items_checked,
        COUNT(items_expired) as has_items_expired,
        SUM(COALESCE(quantity, 0)) as sum_quantity,
        SUM(COALESCE(quantity_near_expiry, 0)) as sum_quantity_near,
        SUM(COALESCE(items_checked, 0)) as sum_items_checked,
        SUM(COALESCE(items_expired, 0)) as sum_items_expired
      FROM flat_expiry_checks
      WHERE visited_date >= CURRENT_DATE - INTERVAL '30 days'
    `)
    
    // Get ALL date ranges
    const dateRanges = await query(`
      SELECT 
        MIN(visited_date) as min_visited_date,
        MAX(visited_date) as max_visited_date,
        MIN(created_on) as min_created_on,
        MAX(created_on) as max_created_on,
        COUNT(*) as total_rows
      FROM flat_expiry_checks
    `)
    
    return NextResponse.json({
      success: true,
      columns: columnsResult.rows,
      sample_data: sampleResult.rows,
      statistics: statsResult.rows[0],
      data_availability: dataCheckResult.rows[0],
      date_ranges: dateRanges.rows[0],
      test_queries: {
        test_expiry_date: sampleResult.rows[0]?.expiry_date,
        test_visited_date: sampleResult.rows[0]?.visited_date,
        test_items_expired: sampleResult.rows[0]?.items_expired,
        test_items_checked: sampleResult.rows[0]?.items_checked
      }
    })
    
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
