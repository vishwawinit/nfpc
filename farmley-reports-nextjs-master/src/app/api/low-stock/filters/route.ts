import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { validateApiUser } from '@/lib/apiUserValidation'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Enable ISR with 60 second revalidation
export const revalidate = 60

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Get and validate user
    const loginUserCode = searchParams.get('loginUserCode')
    const validation = await validateApiUser(loginUserCode)
    
    if (!validation.isValid) {
      return validation.response!
    }
    
    // Get allowed users for filtering
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Date filters
    if (searchParams.has('startDate') && searchParams.has('endDate')) {
      conditions.push(`check_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
      conditions.push(`check_date <= $${paramIndex}`)
      params.push(searchParams.get('endDate'))
      paramIndex++
    }

    // Get field users under selected team leader (from hierarchy, not from data)
    let fieldUsersUnderTL: string[] = []
    if (searchParams.has('teamLeaderCode')) {
      try {
        const hierarchyResponse = await fetch(`${request.nextUrl.origin}/api/users/hierarchy`)
        if (hierarchyResponse.ok) {
          const hierarchyData = await hierarchyResponse.json()
          const selectedTL = searchParams.get('teamLeaderCode')
          
          // Find field users under this TL
          const tlData = hierarchyData.data.teamLeaders.find((tl: any) => tl.code === selectedTL)
          if (tlData && tlData.fieldUsers && tlData.fieldUsers.length > 0) {
            fieldUsersUnderTL = tlData.fieldUsers.map((fu: any) => fu.code)
            // Filter by these field users
            conditions.push(`field_user_code = ANY($${paramIndex}::text[])`)
            params.push(fieldUsersUnderTL)
            paramIndex++
          } else {
            // If no field users found, filter by TL code as fallback
            conditions.push(`tl_code = $${paramIndex}`)
            params.push(selectedTL)
            paramIndex++
          }
        }
      } catch (error) {
        console.warn('Failed to fetch hierarchy for team leader filter:', error)
        // Fallback to filtering by tl_code
        conditions.push(`tl_code = $${paramIndex}`)
        params.push(searchParams.get('teamLeaderCode'))
        paramIndex++
      }
    }

    if (searchParams.has('userRole')) {
      conditions.push(`user_role = $${paramIndex}`)
      params.push(searchParams.get('userRole'))
      paramIndex++
    }

    if (searchParams.has('userCode')) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    if (searchParams.has('storeCode')) {
      conditions.push(`store_code = $${paramIndex}`)
      params.push(searchParams.get('storeCode'))
      paramIndex++
    }

    if (searchParams.has('chainName')) {
      conditions.push(`chain_name = $${paramIndex}`)
      params.push(searchParams.get('chainName'))
      paramIndex++
    }

    if (searchParams.has('cityCode')) {
      conditions.push(`city_code = $${paramIndex}`)
      params.push(searchParams.get('cityCode'))
      paramIndex++
    }

    if (searchParams.has('regionCode')) {
      conditions.push(`region_code = $${paramIndex}`)
      params.push(searchParams.get('regionCode'))
      paramIndex++
    }

    if (searchParams.has('productCode')) {
      conditions.push(`product_code = $${paramIndex}`)
      params.push(searchParams.get('productCode'))
      paramIndex++
    }

    if (searchParams.has('productGroup')) {
      conditions.push(`product_group = $${paramIndex}`)
      params.push(searchParams.get('productGroup'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get distinct users, stores, categories, cities, and stock statuses
    const [usersResult, userRolesResult, storesResult, chainsResult, citiesResult, regionsResult, productsResult, productGroupsResult, statusesResult] = await Promise.all([
      query(`
        SELECT DISTINCT
          field_user_code as value,
          field_user_name as label
        FROM flat_stock_checks ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} field_user_code IS NOT NULL
        ORDER BY field_user_name, field_user_code
      `, params),
      query(`
        SELECT DISTINCT
          user_role as value,
          user_role as label
        FROM flat_stock_checks ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} user_role IS NOT NULL
        ORDER BY user_role
      `, params),
      query(`
        SELECT DISTINCT
          store_code as value,
          store_name as label
        FROM flat_stock_checks ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} store_code IS NOT NULL
        ORDER BY store_name, store_code
      `, params),
      query(`
        SELECT DISTINCT
          chain_name as value,
          chain_name as label
        FROM flat_stock_checks ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} chain_name IS NOT NULL AND TRIM(chain_name) <> ''
        ORDER BY chain_name
      `, params),
      query(`
        SELECT DISTINCT
          city_code as value,
          COALESCE(NULLIF(city_name, ''), city_code) as label
        FROM flat_stock_checks ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} city_code IS NOT NULL
        ORDER BY COALESCE(NULLIF(city_name, ''), city_code)
      `, params),
      query(`
        SELECT DISTINCT
          region_code as value,
          region_code as label
        FROM flat_stock_checks ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} region_code IS NOT NULL
        ORDER BY region_code
      `, params),
      query(`
        SELECT DISTINCT
          product_code as value,
          product_name as label
        FROM flat_stock_checks ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} product_code IS NOT NULL
        ORDER BY product_name, product_code
      `, params),
      query(`
        SELECT DISTINCT
          product_group as value,
          product_group as label
        FROM flat_stock_checks ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} product_group IS NOT NULL AND TRIM(product_group) <> ''
        ORDER BY product_group
      `, params),
      query(`
        SELECT DISTINCT
          check_status as value,
          check_status as label
        FROM flat_stock_checks ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} check_status IS NOT NULL
        ORDER BY check_status
      `, params)
    ])

    // Get hierarchy filter options from the users hierarchy API
    let teamLeaders: any[] = []
    let assistantLeaders: any[] = []
    let hierarchyFieldUsers: any[] = []

    try {
      // Fetch hierarchy data from the users hierarchy API using dynamic origin
      const hierarchyResponse = await fetch(`${request.nextUrl.origin}/api/users/hierarchy`)
      if (hierarchyResponse.ok) {
        const hierarchyData = await hierarchyResponse.json()

        teamLeaders = hierarchyData.data.teamLeaders.map((leader: any) => ({
          value: leader.code,
          label: `${leader.name} (${leader.code})`,
          role: leader.role,
          fieldUsers: leader.fieldUsers || []
        }))

        assistantLeaders = hierarchyData.data.assistantLeaders.map((leader: any) => ({
          value: leader.code,
          label: `${leader.name} (${leader.code})`,
          role: leader.role
        }))

        // If a team leader is selected, get their field users from hierarchy
        if (searchParams.has('teamLeaderCode')) {
          const selectedTL = searchParams.get('teamLeaderCode')
          const tlData = hierarchyData.data.teamLeaders.find((tl: any) => tl.code === selectedTL)
          if (tlData && tlData.fieldUsers) {
            hierarchyFieldUsers = tlData.fieldUsers.map((fu: any) => ({
              value: fu.code,
              label: `${fu.name} (${fu.code})`,
              role: fu.role
            }))
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch hierarchy data:', error)
      // Continue without hierarchy data if there's an error
    }

    // If team leader is selected, use hierarchy field users instead of data-based users
    const finalUsers = searchParams.has('teamLeaderCode') && hierarchyFieldUsers.length > 0
      ? hierarchyFieldUsers
      : usersResult.rows.map((row: any) => ({ value: row.value, label: row.label ? `${row.label} (${row.value})` : row.value }))

    return NextResponse.json({
      success: true,
      data: {
        users: finalUsers,
        userRoles: userRolesResult.rows,
        stores: storesResult.rows.map((row: any) => ({ value: row.value, label: row.label ? `${row.label} (${row.value})` : row.value })),
        chains: chainsResult.rows,
        cities: citiesResult.rows,
        regions: regionsResult.rows,
        products: productsResult.rows.map((row: any) => ({ value: row.value, label: row.label ? `${row.label} (${row.value})` : row.value })),
        productGroups: productGroupsResult.rows,
        statuses: statusesResult.rows,
        teamLeaders,
        assistantLeaders
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Low Stock Filters API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
