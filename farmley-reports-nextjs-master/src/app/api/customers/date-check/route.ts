import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check what date ranges have data
    const dateRangeQuery = `
      SELECT 
        MIN(trx_date_only) as earliest_date,
        MAX(trx_date_only) as latest_date,
        COUNT(*) as total_records,
        COUNT(DISTINCT store_code) as unique_stores
      FROM flat_sales_transactions
      WHERE trx_type = 1
    `
    
    const dateResult = await query(dateRangeQuery, [])
    
    // Check data by month
    const monthlyQuery = `
      SELECT 
        DATE_TRUNC('month', trx_date_only) as month,
        COUNT(*) as transactions,
        COUNT(DISTINCT store_code) as unique_stores,
        SUM(net_amount) as total_sales
      FROM flat_sales_transactions
      WHERE trx_type = 1
      GROUP BY DATE_TRUNC('month', trx_date_only)
      ORDER BY month DESC
      LIMIT 12
    `
    
    const monthlyResult = await query(monthlyQuery, [])
    
    // Get sample of most recent data
    const recentQuery = `
      SELECT 
        trx_date_only,
        store_code,
        store_name,
        region_name,
        city_name,
        chain_name,
        net_amount
      FROM flat_sales_transactions
      WHERE trx_type = 1
      ORDER BY trx_date_only DESC
      LIMIT 10
    `
    
    const recentResult = await query(recentQuery, [])
    
    return NextResponse.json({
      success: true,
      currentDate: new Date().toISOString().split('T')[0],
      dataAvailability: dateResult.rows[0],
      monthlyData: monthlyResult.rows.map(row => ({
        month: row.month,
        transactions: parseInt(row.transactions),
        stores: parseInt(row.unique_stores),
        sales: parseFloat(row.total_sales)
      })),
      recentRecords: recentResult.rows,
      message: "Date range analysis complete"
    })
    
  } catch (error) {
    console.error('Date check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
