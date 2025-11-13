import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Get actual distinct values using the correct column names
    const queries = {
      // Check distinct regions
      distinctRegions: `
        SELECT DISTINCT 
          region_code,
          region_name,
          COUNT(*) as count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        AND trx_date_only >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY region_code, region_name
        ORDER BY count DESC
        LIMIT 10
      `,
      
      // Check distinct cities
      distinctCities: `
        SELECT DISTINCT 
          city_code,
          city_name,
          COUNT(*) as count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        AND trx_date_only >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY city_code, city_name
        ORDER BY count DESC
        LIMIT 10
      `,
      
      // Check distinct chains
      distinctChains: `
        SELECT DISTINCT 
          chain_code,
          chain_name,
          COUNT(*) as count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        AND trx_date_only >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY chain_code, chain_name
        ORDER BY count DESC
        LIMIT 10
      `,
      
      // Check distinct routes (using user_route_code, not user_route_name)
      distinctRoutes: `
        SELECT DISTINCT 
          user_route_code,
          COUNT(*) as count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        AND trx_date_only >= CURRENT_DATE - INTERVAL '30 days'
        AND user_route_code IS NOT NULL
        GROUP BY user_route_code
        ORDER BY count DESC
        LIMIT 10
      `,
      
      // Check distinct salesmen
      distinctSalesmen: `
        SELECT DISTINCT 
          field_user_code,
          field_user_name,
          COUNT(*) as count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        AND trx_date_only >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY field_user_code, field_user_name
        ORDER BY count DESC
        LIMIT 10
      `,
      
      // Get raw sample data - using actual column names
      rawSampleData: `
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
        AND trx_date_only >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY trx_date_only DESC
        LIMIT 5
      `,
      
      // Top customers with aggregated data
      topCustomers: `
        SELECT 
          store_code,
          store_name,
          MAX(region_code) as region_code,
          MAX(region_name) as region_name,
          MAX(city_code) as city_code,
          MAX(city_name) as city_name,
          MAX(chain_code) as chain_code,
          MAX(chain_name) as chain_name,
          MAX(user_route_code) as route_code,
          MAX(field_user_code) as salesman_code,
          MAX(field_user_name) as salesman_name,
          SUM(net_amount) as total_sales,
          COUNT(DISTINCT trx_code) as order_count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        AND trx_date_only >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY store_code, store_name
        ORDER BY total_sales DESC
        LIMIT 10
      `
    }
    
    const results: any = {}
    
    for (const [key, sql] of Object.entries(queries)) {
      try {
        const result = await query(sql, [])
        results[key] = result.rows
      } catch (error) {
        results[key] = { 
          error: (error as Error).message,
          query: key 
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: results,
      summary: {
        message: "Actual data from flat_sales_transactions - using correct column names",
        note: "Table has user_route_code but NO user_route_name column",
        distinctRegionsCount: results.distinctRegions?.length || 0,
        distinctCitiesCount: results.distinctCities?.length || 0,
        distinctChainsCount: results.distinctChains?.length || 0,
        distinctRoutesCount: results.distinctRoutes?.length || 0,
        distinctSalesmenCount: results.distinctSalesmen?.length || 0
      }
    })
    
  } catch (error) {
    console.error('Actual data check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
