import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Get a sample of actual data
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
        user_route_name,
        field_user_code,
        field_user_name,
        SUM(net_amount) as total_sales,
        COUNT(*) as transactions
      FROM flat_sales_transactions
      WHERE trx_type = 5
      AND trx_date_only >= CURRENT_DATE - INTERVAL '30 days'
      AND store_code IS NOT NULL
      GROUP BY 
        store_code, store_name, region_code, region_name,
        city_code, city_name, chain_code, chain_name,
        user_route_code, user_route_name, field_user_code, field_user_name
      ORDER BY total_sales DESC
      LIMIT 10
    `

    const result = await query(sampleQuery, [])
    
    // Check how many NULL values we have
    const nullCheckQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN region_name IS NULL OR region_name = '' THEN 1 END) as null_region_name,
        COUNT(CASE WHEN city_name IS NULL OR city_name = '' THEN 1 END) as null_city_name,
        COUNT(CASE WHEN chain_name IS NULL OR chain_name = '' THEN 1 END) as null_chain_name,
        COUNT(CASE WHEN user_route_name IS NULL OR user_route_name = '' THEN 1 END) as null_route_name,
        COUNT(CASE WHEN field_user_name IS NULL OR field_user_name = '' THEN 1 END) as null_salesman_name
      FROM flat_sales_transactions
      WHERE trx_type = 5
      AND trx_date_only >= CURRENT_DATE - INTERVAL '30 days'
    `
    
    const nullCheck = await query(nullCheckQuery, [])
    
    return NextResponse.json({
      success: true,
      message: 'Test data from flat_sales_transactions',
      sampleData: result.rows.map(row => ({
        customerCode: row.store_code || 'NO_CODE',
        customerName: row.store_name || 'NO_NAME', 
        region: row.region_name || row.region_code || 'NO_REGION',
        city: row.city_name || row.city_code || 'NO_CITY',
        chain: row.chain_name || row.chain_code || 'NO_CHAIN',
        route: row.user_route_name || row.user_route_code || 'NO_ROUTE',
        salesman: row.field_user_name || row.field_user_code || 'NO_SALESMAN',
        totalSales: parseFloat(row.total_sales || '0'),
        transactions: parseInt(row.transactions || '0')
      })),
      nullStatistics: nullCheck.rows[0],
      rawSample: result.rows[0] // Show one raw record to see actual values
    })
  } catch (error) {
    console.error('Test data error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
