import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Get distinct values for each important column
    const queries = {
      // Check distinct region values
      distinctRegions: `
        SELECT DISTINCT 
          region_code,
          region_name,
          COUNT(*) as count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        GROUP BY region_code, region_name
        ORDER BY count DESC
        LIMIT 20
      `,
      
      // Check distinct city values
      distinctCities: `
        SELECT DISTINCT 
          city_code,
          city_name,
          COUNT(*) as count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        GROUP BY city_code, city_name
        ORDER BY count DESC
        LIMIT 20
      `,
      
      // Check distinct chain values
      distinctChains: `
        SELECT DISTINCT 
          chain_code,
          chain_name,
          COUNT(*) as count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        GROUP BY chain_code, chain_name
        ORDER BY count DESC
        LIMIT 20
      `,
      
      // Check distinct route values
      distinctRoutes: `
        SELECT DISTINCT 
          user_route_code,
          user_route_name,
          COUNT(*) as count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        GROUP BY user_route_code, user_route_name
        ORDER BY count DESC
        LIMIT 20
      `,
      
      // Check distinct salesman values
      distinctSalesmen: `
        SELECT DISTINCT 
          field_user_code,
          field_user_name,
          COUNT(*) as count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        GROUP BY field_user_code, field_user_name
        ORDER BY count DESC
        LIMIT 20
      `,
      
      // Get actual raw sample data - NO COALESCE, NO DEFAULTS
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
          user_route_name,
          field_user_code,
          field_user_name,
          net_amount,
          trx_date_only
        FROM flat_sales_transactions
        WHERE trx_type = 1
        ORDER BY trx_date_only DESC
        LIMIT 10
      `,
      
      // Count actual NULL vs NON-NULL values
      nullAnalysis: `
        SELECT 
          'region_name' as column_name,
          COUNT(*) as total,
          COUNT(region_name) as non_null,
          COUNT(*) - COUNT(region_name) as null_count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        UNION ALL
        SELECT 
          'city_name' as column_name,
          COUNT(*) as total,
          COUNT(city_name) as non_null,
          COUNT(*) - COUNT(city_name) as null_count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        UNION ALL
        SELECT 
          'chain_name' as column_name,
          COUNT(*) as total,
          COUNT(chain_name) as non_null,
          COUNT(*) - COUNT(chain_name) as null_count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        UNION ALL
        SELECT 
          'user_route_name' as column_name,
          COUNT(*) as total,
          COUNT(user_route_name) as non_null,
          COUNT(*) - COUNT(user_route_name) as null_count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        UNION ALL
        SELECT 
          'field_user_name' as column_name,
          COUNT(*) as total,
          COUNT(field_user_name) as non_null,
          COUNT(*) - COUNT(field_user_name) as null_count
        FROM flat_sales_transactions
        WHERE trx_type = 1
      `,
      
      // Get top customers with all their actual data
      topCustomers: `
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
          COUNT(DISTINCT trx_code) as order_count
        FROM flat_sales_transactions
        WHERE trx_type = 1
        AND trx_date_only >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY 
          store_code, store_name, region_code, region_name,
          city_code, city_name, chain_code, chain_name,
          user_route_code, user_route_name, field_user_code, field_user_name
        ORDER BY total_sales DESC
        LIMIT 5
      `
    }
    
    const results: any = {}
    
    for (const [key, sql] of Object.entries(queries)) {
      try {
        const result = await query(sql, [])
        results[key] = result.rows
      } catch (error) {
        results[key] = { error: (error as Error).message }
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: results,
      summary: {
        message: "Raw data analysis - no COALESCE or defaults applied",
        distinctRegionsCount: results.distinctRegions?.length || 0,
        distinctCitiesCount: results.distinctCities?.length || 0,
        distinctChainsCount: results.distinctChains?.length || 0,
        distinctRoutesCount: results.distinctRoutes?.length || 0,
        distinctSalesmenCount: results.distinctSalesmen?.length || 0
      }
    })
    
  } catch (error) {
    console.error('Distinct values check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
