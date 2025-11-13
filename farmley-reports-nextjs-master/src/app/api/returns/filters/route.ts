import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Enable ISR with 60 second revalidation
export const revalidate = 60

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const conditions: string[] = ['(is_returned = true OR is_cancelled = true)']
    const params: any[] = []
    let paramIndex = 1

    // Date filters
    if (searchParams.has('startDate') && searchParams.has('endDate')) {
      conditions.push(`trx_date_only >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
      conditions.push(`trx_date_only <= $${paramIndex}`)
      params.push(searchParams.get('endDate'))
      paramIndex++
    }

    // Team Leader filter
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    // User filter
    if (searchParams.has('userCode')) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    // Store filter
    if (searchParams.has('storeCode')) {
      conditions.push(`store_code = $${paramIndex}`)
      params.push(searchParams.get('storeCode'))
      paramIndex++
    }

    // Chain filter
    if (searchParams.has('chainCode')) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(searchParams.get('chainCode'))
      paramIndex++
    }

    // Region filter
    if (searchParams.has('regionCode')) {
      conditions.push(`region_code = $${paramIndex}`)
      params.push(searchParams.get('regionCode'))
      paramIndex++
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Fetch hierarchy data from users API
    const hierarchyResponse = await fetch(`${request.nextUrl.origin}/api/users/hierarchy`)
    const hierarchyData = await hierarchyResponse.json()

    const [usersResult, storesResult, chainsResult, regionsResult, citiesResult, categoriesResult, brandsResult] = await Promise.all([
      query(`
        SELECT DISTINCT field_user_code as "value", field_user_name as "label"
        FROM flat_sales_transactions ${whereClause}
        ORDER BY field_user_name
      `, params),
      query(`
        SELECT DISTINCT store_code as "value", store_name as "label"
        FROM flat_sales_transactions ${whereClause}
        ORDER BY store_name
      `, params),
      query(`
        SELECT DISTINCT chain_code as "value", chain_name as "label"
        FROM flat_sales_transactions ${whereClause}${whereClause ? ' AND' : ' WHERE'} chain_code IS NOT NULL
        ORDER BY chain_name
      `, params),
      query(`
        SELECT DISTINCT region_code as "value", region_name as "label"
        FROM flat_sales_transactions ${whereClause}${whereClause ? ' AND' : ' WHERE'} region_code IS NOT NULL
        ORDER BY region_name
      `, params),
      query(`
        SELECT DISTINCT city_code as "value", city_name as "label"
        FROM flat_sales_transactions ${whereClause}${whereClause ? ' AND' : ' WHERE'} city_code IS NOT NULL
        ORDER BY city_name
      `, params),
      query(`
        SELECT DISTINCT product_category as "value", product_category as "label"
        FROM flat_sales_transactions ${whereClause}${whereClause ? ' AND' : ' WHERE'} product_category IS NOT NULL
        ORDER BY product_category
      `, params),
      query(`
        SELECT DISTINCT product_brand as "value", product_brand as "label"
        FROM flat_sales_transactions ${whereClause}${whereClause ? ' AND' : ' WHERE'} product_brand IS NOT NULL
        ORDER BY product_brand
      `, params)
    ])

    return NextResponse.json({
      success: true,
      data: {
        users: usersResult.rows,
        stores: storesResult.rows,
        chains: chainsResult.rows,
        regions: regionsResult.rows,
        cities: citiesResult.rows,
        categories: categoriesResult.rows,
        brands: brandsResult.rows,
        returnTypes: [
          { value: 'all', label: 'All (Returns & Cancellations)' },
          { value: 'returned', label: 'Returns Only' },
          { value: 'cancelled', label: 'Cancellations Only' }
        ],
        teamLeaders: hierarchyData.data?.teamLeaders || [],
        assistantLeaders: hierarchyData.data?.assistantLeaders || []
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })

  } catch (error) {
    console.error('Returns Filters API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
