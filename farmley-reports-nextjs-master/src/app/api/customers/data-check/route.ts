import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check if there's any data at all
    const countQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT store_code) as unique_stores,
        MIN(trx_date_only) as earliest_date,
        MAX(trx_date_only) as latest_date
      FROM flat_sales_transactions
      WHERE trx_type = 1
    `
    
    const countResult = await query(countQuery, [])
    
    // Get sample data without any date filter
    const sampleQuery = `
      SELECT 
        store_code,
        store_name,
        region_code,
        region_name,
        city_code,
        city_name,
        chain_code,
        chain_name,
        user_route_code,
        field_user_code,
        field_user_name,
        net_amount,
        trx_date_only
      FROM flat_sales_transactions
      WHERE trx_type = 1
      ORDER BY trx_date_only DESC
      LIMIT 10
    `
    
    const sampleResult = await query(sampleQuery, [])
    
    // Check dates in October 2025
    const octoberQuery = `
      SELECT 
        DATE(trx_date_only) as date,
        COUNT(*) as transactions,
        COUNT(DISTINCT store_code) as stores,
        SUM(net_amount) as total_sales
      FROM flat_sales_transactions
      WHERE trx_type = 1
      AND trx_date_only >= '2025-10-01'
      AND trx_date_only <= '2025-10-31'
      GROUP BY DATE(trx_date_only)
      ORDER BY date DESC
      LIMIT 10
    `
    
    const octoberResult = await query(octoberQuery, [])
    
    // Check dates in September 2025
    const septemberQuery = `
      SELECT 
        DATE(trx_date_only) as date,
        COUNT(*) as transactions,
        COUNT(DISTINCT store_code) as stores,
        SUM(net_amount) as total_sales
      FROM flat_sales_transactions
      WHERE trx_type = 1
      AND trx_date_only >= '2025-09-01'
      AND trx_date_only <= '2025-09-30'
      GROUP BY DATE(trx_date_only)
      ORDER BY date DESC
      LIMIT 10
    `
    
    const septemberResult = await query(septemberQuery, [])
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      currentDate: new Date().toISOString().split('T')[0],
      dataSummary: countResult.rows[0],
      sampleRecords: sampleResult.rows,
      octoberData: octoberResult.rows,
      septemberData: septemberResult.rows,
      message: "Checking data availability in database"
    })
    
  } catch (error) {
    console.error('Data check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
