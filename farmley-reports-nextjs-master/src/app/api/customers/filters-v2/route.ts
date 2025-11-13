import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || 'thisMonth'
    
    // Get date range
    const current = new Date()
    let startDate: Date = new Date(current)
    let endDate: Date = new Date(current)

    switch(range) {
      case 'lastMonth':
        startDate = new Date(current.getFullYear(), current.getMonth() - 1, 1)
        endDate = new Date(current.getFullYear(), current.getMonth(), 0)
        break
      case 'thisMonth':
        startDate = new Date(current.getFullYear(), current.getMonth(), 1)
        endDate = new Date(current)
        break
      case 'thisQuarter':
        const quarter = Math.floor(current.getMonth() / 3)
        startDate = new Date(current.getFullYear(), quarter * 3, 1)
        endDate = new Date(current)
        break
      case 'lastQuarter':
        const lastQuarter = Math.floor(current.getMonth() / 3) - 1
        startDate = new Date(current.getFullYear(), lastQuarter * 3, 1)
        endDate = new Date(current.getFullYear(), lastQuarter * 3 + 3, 0)
        break
      default:
        startDate = new Date(current)
        startDate.setDate(startDate.getDate() - 29)
        endDate = new Date(current)
    }

    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]
    
    await db.initialize()

    const whereClause = `
      WHERE trx_type = 5 
      AND trx_date_only >= '${startStr}'
      AND trx_date_only <= '${endStr}'
    `

    // Get total records count for debugging
    const totalCountQuery = `
      SELECT COUNT(*) as total
      FROM flat_sales_transactions
      ${whereClause}
    `

    // Get distinct regions
    const regionsQuery = `
      SELECT
        region_code as value,
        region_code || ' - ' || COALESCE(region_name, 'Unknown') as label,
        COUNT(DISTINCT store_code) as count
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
        city_code || ' - ' || COALESCE(city_name, 'Unknown City') as label,
        COUNT(DISTINCT store_code) as count
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
        COALESCE(chain_name, 'Unknown Chain') as label,
        COUNT(DISTINCT store_code) as count
      FROM flat_sales_transactions
      ${whereClause}
      AND chain_code IS NOT NULL
      GROUP BY chain_code, chain_name
      ORDER BY chain_name
    `

    // Get distinct salesmen
    const salesmenQuery = `
      SELECT
        field_user_code as value,
        field_user_code || ' - ' || COALESCE(field_user_name, 'Unknown User') as label,
        COUNT(DISTINCT store_code) as count
      FROM flat_sales_transactions
      ${whereClause}
      AND field_user_code IS NOT NULL
      GROUP BY field_user_code, field_user_name
      ORDER BY field_user_code
    `

    // Get distinct routes
    const routesQuery = `
      SELECT
        user_route_code as value,
        user_route_code as label,
        COUNT(DISTINCT store_code) as count
      FROM flat_sales_transactions
      ${whereClause}
      AND user_route_code IS NOT NULL
      GROUP BY user_route_code
      ORDER BY user_route_code
    `

    // Execute all queries
    const [totalCountResult, regionsResult, citiesResult, chainsResult, salesmenResult, routesResult] = await Promise.all([
      query(totalCountQuery, []),
      query(regionsQuery, []),
      query(citiesQuery, []),
      query(chainsQuery, []),
      query(salesmenQuery, []),
      query(routesQuery, [])
    ])

    // Log results for debugging
    console.log('Customer Filters V2 - Date Range:', { startStr, endStr, range })
    console.log('Customer Filters V2 - Total Records:', totalCountResult.rows?.[0]?.total || 0)
    console.log('Customer Filters V2 - Results Count:', {
      regions: regionsResult.rows?.length || 0,
      cities: citiesResult.rows?.length || 0,
      chains: chainsResult.rows?.length || 0,
      salesmen: salesmenResult.rows?.length || 0,
      routes: routesResult.rows?.length || 0
    })
    console.log('Customer Filters V2 - Sample Region:', regionsResult.rows?.[0])
    console.log('Customer Filters V2 - Sample City:', citiesResult.rows?.[0])
    console.log('Customer Filters V2 - Sample Chain:', chainsResult.rows?.[0])

    return NextResponse.json({
      success: true,
      filters: {
        regions: regionsResult.rows || [],
        cities: citiesResult.rows || [],
        chains: chainsResult.rows || [],
        salesmen: salesmenResult.rows || [],
        routes: routesResult.rows || []
      },
      dateRange: {
        start: startStr,
        end: endStr,
        label: range
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Customer filters API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
