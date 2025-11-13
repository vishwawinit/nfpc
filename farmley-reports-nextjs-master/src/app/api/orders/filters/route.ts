import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Filters cache for 15 minutes
const FILTERS_CACHE_DURATION = 900

function getDateRange(rangeStr: string) {
  const now = new Date()
  let startDate: Date, endDate: Date
  
  switch (rangeStr) {
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now)
      break
    case 'lastMonth':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      endDate = new Date(now.getFullYear(), now.getMonth(), 0)
      break
    case 'thisQuarter':
      const quarter = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), quarter * 3, 1)
      endDate = new Date(now)
      break
    case 'lastQuarter':
      const lastQuarter = Math.floor(now.getMonth() / 3) - 1
      startDate = new Date(now.getFullYear(), lastQuarter * 3, 1)
      endDate = new Date(now.getFullYear(), lastQuarter * 3 + 3, 0)
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now)
  }
  
  return {
    startStr: startDate.toISOString().split('T')[0],
    endStr: endDate.toISOString().split('T')[0]
  }
}

export async function GET(request: NextRequest) {
  try {
    await db.initialize()
    
    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || 'thisMonth'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Get hierarchy-based allowed users
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }
    
    let startDate: string, endDate: string
    
    if (startDateParam && endDateParam) {
      startDate = startDateParam
      endDate = endDateParam
    } else {
      const dateResult = getDateRange(range)
      startDate = dateResult.startStr
      endDate = dateResult.endStr
    }
    
    let whereClause = `
      WHERE trx_type = 5 
      AND trx_date_only >= '${startDate}'
      AND trx_date_only <= '${endDate}'
    `
    
    // Add hierarchy filter if not admin
    if (allowedUserCodes.length > 0) {
      const userCodesStr = allowedUserCodes.map(code => `'${code}'`).join(', ')
      whereClause += ` AND field_user_code IN (${userCodesStr})`
    }
    
    // Get distinct regions
    const regionsQuery = `
      SELECT
        region_code as value,
        region_code || ' - ' || COALESCE(region_name, 'Unknown') as label,
        COUNT(DISTINCT trx_code) as count
      FROM flat_sales_transactions
      ${whereClause}
      AND region_code IS NOT NULL
      GROUP BY region_code, region_name
      ORDER BY region_code
    `
    
    // Get distinct cities
    const citiesQuery = `
      SELECT
        city_code as value,
        city_code || ' - ' || COALESCE(city_name, 'Unknown') as label,
        COUNT(DISTINCT trx_code) as count
      FROM flat_sales_transactions
      ${whereClause}
      AND city_code IS NOT NULL
      GROUP BY city_code, city_name
      ORDER BY city_code
    `
    
    // Get distinct chains
    const chainsQuery = `
      SELECT
        chain_code as value,
        chain_code || ' - ' || COALESCE(chain_name, 'Unknown Chain') as label,
        COUNT(DISTINCT trx_code) as count
      FROM flat_sales_transactions
      ${whereClause}
      AND chain_code IS NOT NULL
      GROUP BY chain_code, chain_name
      ORDER BY chain_code
    `
    
    // Get distinct customers
    const customersQuery = `
      SELECT
        store_code as value,
        store_code || ' - ' || COALESCE(store_name, 'Unknown') as label,
        COUNT(DISTINCT trx_code) as count
      FROM flat_sales_transactions
      ${whereClause}
      AND store_code IS NOT NULL
      GROUP BY store_code, store_name
      ORDER BY count DESC
      LIMIT 100
    `
    
    // Get distinct salesmen
    const salesmenQuery = `
      SELECT
        field_user_code as value,
        field_user_code || ' - ' || COALESCE(field_user_name, 'Unknown User') as label,
        COUNT(DISTINCT trx_code) as count
      FROM flat_sales_transactions
      ${whereClause}
      AND field_user_code IS NOT NULL
      GROUP BY field_user_code, field_user_name
      ORDER BY field_user_code
    `
    
    // Get distinct team leaders
    const teamLeadersQuery = `
      SELECT
        tl_code as value,
        tl_code || ' - ' || COALESCE(tl_name, 'Unknown') as label,
        COUNT(DISTINCT trx_code) as count
      FROM flat_sales_transactions
      ${whereClause}
      AND tl_code IS NOT NULL
      GROUP BY tl_code, tl_name
      ORDER BY tl_code
    `
    
    // Get distinct product categories
    const categoriesQuery = `
      SELECT
        COALESCE(product_group, 'Others') as value,
        COALESCE(product_group, 'Others') as label,
        COUNT(DISTINCT trx_code) as count
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY product_group
      ORDER BY count DESC
    `
    
    // Execute all queries
    const [
      regionsResult,
      citiesResult,
      chainsResult,
      customersResult,
      salesmenResult,
      teamLeadersResult,
      categoriesResult
    ] = await Promise.all([
      query(regionsQuery, []),
      query(citiesQuery, []),
      query(chainsQuery, []),
      query(customersQuery, []),
      query(salesmenQuery, []),
      query(teamLeadersQuery, []),
      query(categoriesQuery, [])
    ])
    
    console.log('Orders Filters - Response counts:', {
      regions: regionsResult.rows.length,
      cities: citiesResult.rows.length,
      chains: chainsResult.rows.length,
      customers: customersResult.rows.length,
      salesmen: salesmenResult.rows.length,
      teamLeaders: teamLeadersResult.rows.length,
      categories: categoriesResult.rows.length
    })
    
    return NextResponse.json({
      success: true,
      filters: {
        regions: regionsResult.rows || [],
        cities: citiesResult.rows || [],
        chains: chainsResult.rows || [],
        customers: customersResult.rows || [],
        salesmen: salesmenResult.rows || [],
        teamLeaders: teamLeadersResult.rows || [],
        productCategories: categoriesResult.rows || []
      },
      dateRange: {
        start: startDate,
        end: endDate,
        label: range
      },
      cached: true,
      cacheInfo: {
        duration: FILTERS_CACHE_DURATION
      }
    }, {
      headers: {
        'Cache-Control': `public, s-maxage=${FILTERS_CACHE_DURATION}, stale-while-revalidate=${FILTERS_CACHE_DURATION * 2}`
      }
    })
    
  } catch (error) {
    console.error('Orders filters API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
