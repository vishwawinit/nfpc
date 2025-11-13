import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // First, get the latest available date in the database
    const latestDateQuery = await query(`
      SELECT MAX(trx_date_only) as latest_date
      FROM flat_sales_transactions
    `)
    
    const latestDate = latestDateQuery.rows[0]?.latest_date
    if (!latestDate) {
      return NextResponse.json({
        success: false,
        error: 'No data found in flat_sales_transactions table'
      }, { status: 404 })
    }
    
    // Default to current month's dates for 2025
    const now = new Date()
    const currentMonth = `2025-${String(now.getMonth() + 1).padStart(2, '0')}`
    const startDate = searchParams.get('startDate') || `${currentMonth}-01`
    const endDate = searchParams.get('endDate') || `${currentMonth}-${String(now.getDate()).padStart(2, '0')}`
    
    // Test 1: Check data availability for October 2025 (current month)
    const octDataCheck = await query(`
      SELECT 
        COUNT(*) as total_records,
        MIN(trx_date_only) as earliest_date,
        MAX(trx_date_only) as latest_date,
        SUM(quantity) as total_quantity,
        SUM(net_amount) as total_amount,
        COUNT(DISTINCT store_code) as unique_stores,
        COUNT(DISTINCT product_code) as unique_products,
        COUNT(DISTINCT field_user_code) as unique_users
      FROM flat_sales_transactions
      WHERE trx_date_only >= '2025-10-01'::date
        AND trx_date_only <= '2025-10-21'::date
    `)

    // Test 2: Check data availability for September 2025 (last month - full month)
    const septDataCheck = await query(`
      SELECT 
        COUNT(*) as total_records,
        MIN(trx_date_only) as earliest_date,
        MAX(trx_date_only) as latest_date,
        SUM(quantity) as total_quantity,
        SUM(net_amount) as total_amount,
        COUNT(DISTINCT store_code) as unique_stores,
        COUNT(DISTINCT product_code) as unique_products,
        COUNT(DISTINCT field_user_code) as unique_users
      FROM flat_sales_transactions
      WHERE trx_date_only >= '2025-09-01'::date
        AND trx_date_only <= '2025-09-30'::date
    `)

    // Test 3: Get sample data for October 2025
    const octSampleData = await query(`
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
      WHERE trx_date_only >= '2025-10-01'::date
        AND trx_date_only <= '2025-10-21'::date
      ORDER BY trx_date_only DESC
      LIMIT 10
    `)

    // Test 4: Get sample data for September 2025
    const septSampleData = await query(`
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
      WHERE trx_date_only >= '2025-09-01'::date
        AND trx_date_only <= '2025-09-30'::date
      ORDER BY trx_date_only DESC
      LIMIT 10
    `)

    // Test 5: Check for data in current year/month
    const currentYearCheck = await query(`
      SELECT 
        EXTRACT(YEAR FROM trx_date_only) as year,
        EXTRACT(MONTH FROM trx_date_only) as month,
        COUNT(*) as record_count,
        MIN(trx_date_only) as min_date,
        MAX(trx_date_only) as max_date,
        SUM(net_amount) as total_amount
      FROM flat_sales_transactions
      WHERE trx_date_only >= '2024-01-01'::date
      GROUP BY EXTRACT(YEAR FROM trx_date_only), EXTRACT(MONTH FROM trx_date_only)
      ORDER BY year DESC, month DESC
      LIMIT 12
    `)

    // Test 6: Check for 2025 data
    const year2025Check = await query(`
      SELECT 
        EXTRACT(YEAR FROM trx_date_only) as year,
        EXTRACT(MONTH FROM trx_date_only) as month,
        COUNT(*) as record_count,
        MIN(trx_date_only) as min_date,
        MAX(trx_date_only) as max_date,
        SUM(net_amount) as total_amount
      FROM flat_sales_transactions
      WHERE trx_date_only >= '2025-01-01'::date
      GROUP BY EXTRACT(YEAR FROM trx_date_only), EXTRACT(MONTH FROM trx_date_only)
      ORDER BY year DESC, month DESC
      LIMIT 12
    `)

    return NextResponse.json({
      success: true,
      latestDataDate: latestDate,
      tests: {
        october2025Summary: octDataCheck.rows[0],
        september2025Summary: septDataCheck.rows[0],
        october2025Sample: octSampleData.rows,
        september2025Sample: septSampleData.rows,
        monthlyDataSummary2024: currentYearCheck.rows,
        monthlyDataSummary2025: year2025Check.rows
      },
      message: 'Data availability test completed'
    })
  } catch (error: any) {
    console.error('LMTD Test Data Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
