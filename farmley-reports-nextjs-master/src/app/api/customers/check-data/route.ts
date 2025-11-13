import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()
    
    // Check what columns and distinct values exist in flat_sales_transactions
    const checkQueries = {
      totalRecords: `
        SELECT COUNT(*) as count 
        FROM flat_sales_transactions 
        WHERE trx_type = 1 
        AND trx_date_only >= '2025-09-01'
      `,
      distinctRegions: `
        SELECT DISTINCT 
          region_code,
          region_name,
          COUNT(*) as count
        FROM flat_sales_transactions 
        WHERE trx_type = 1 
        AND trx_date_only >= '2025-09-01'
        GROUP BY region_code, region_name
        ORDER BY region_code
      `,
      distinctCities: `
        SELECT DISTINCT 
          city_code,
          city_name,
          COUNT(*) as count
        FROM flat_sales_transactions 
        WHERE trx_type = 1 
        AND trx_date_only >= '2025-09-01'
        AND city_code IS NOT NULL
        GROUP BY city_code, city_name
        ORDER BY city_code
      `,
      distinctChains: `
        SELECT DISTINCT 
          chain_code,
          chain_name,
          COUNT(*) as count
        FROM flat_sales_transactions 
        WHERE trx_type = 1 
        AND trx_date_only >= '2025-09-01'
        AND chain_code IS NOT NULL
        GROUP BY chain_code, chain_name
        ORDER BY chain_code
      `,
      sampleCustomers: `
        SELECT DISTINCT
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
          field_user_name
        FROM flat_sales_transactions 
        WHERE trx_type = 1 
        AND trx_date_only >= '2025-09-01'
        LIMIT 20
      `,
      topCustomersBySales: `
        SELECT 
          store_code,
          store_name,
          MAX(region_name) as region_name,
          MAX(city_name) as city_name,
          MAX(chain_name) as chain_name,
          SUM(net_amount) as total_sales,
          COUNT(DISTINCT trx_code) as order_count,
          AVG(net_amount) as avg_order_value
        FROM flat_sales_transactions 
        WHERE trx_type = 1 
        AND trx_date_only >= '2025-09-01'
        GROUP BY store_code, store_name
        ORDER BY total_sales DESC
        LIMIT 10
      `,
      nullCheck: `
        SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN store_code IS NULL THEN 1 END) as null_store_code,
          COUNT(CASE WHEN store_name IS NULL THEN 1 END) as null_store_name,
          COUNT(CASE WHEN region_code IS NULL THEN 1 END) as null_region_code,
          COUNT(CASE WHEN region_name IS NULL THEN 1 END) as null_region_name,
          COUNT(CASE WHEN city_code IS NULL THEN 1 END) as null_city_code,
          COUNT(CASE WHEN city_name IS NULL THEN 1 END) as null_city_name,
          COUNT(CASE WHEN chain_code IS NULL THEN 1 END) as null_chain_code,
          COUNT(CASE WHEN chain_name IS NULL THEN 1 END) as null_chain_name
        FROM flat_sales_transactions
        WHERE trx_type = 1 
        AND trx_date_only >= '2025-09-01'
      `
    }
    
    const results: any = {}
    
    for (const [key, sql] of Object.entries(checkQueries)) {
      try {
        const result = await query(sql, [])
        results[key] = result.rows
      } catch (error) {
        results[key] = { error: (error as Error).message }
      }
    }
    
    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Database check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check database',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
