import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Filters cache for 15 minutes - they don't change frequently
const FILTERS_CACHE_DURATION = 900 // 15 minutes

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || 'thisMonth'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Get hierarchy-based allowed users
    let allowedUserCodes: string[] = []
    let userIsTeamLeader = false
    let allowedTeamLeaders: string[] = []
    let allowedFieldUsers: string[] = []
    
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
      
      // Query to determine which of the allowed users are Team Leaders vs Field Users
      if (allowedUserCodes.length > 0) {
        const userCodesStr = allowedUserCodes.map(code => `'${code}'`).join(', ')
        
        // Get team leaders from the allowed codes
        const tlResult = await query(`
          SELECT DISTINCT tl_code
          FROM flat_sales_transactions
          WHERE tl_code IN (${userCodesStr})
          AND trx_type = 5
        `, [])
        allowedTeamLeaders = tlResult.rows.map(r => r.tl_code).filter(Boolean)
        
        // Check if the logged-in user is a team leader
        userIsTeamLeader = allowedTeamLeaders.includes(loginUserCode)
        
        // If user is a TL, only they should appear in TL filter
        if (userIsTeamLeader) {
          allowedTeamLeaders = [loginUserCode]
        }
        
        // Field users are all allowed codes
        allowedFieldUsers = allowedUserCodes
      }
    }
    
    // Get date range
    const current = new Date()
    let startDate: Date, endDate: Date
    
    // Check for custom date range first
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam)
      endDate = new Date(endDateParam)
    } else {
      switch (range) {
      case 'today':
        startDate = new Date(current.setHours(0, 0, 0, 0))
        endDate = new Date(current.setHours(23, 59, 59, 999))
        break
      case 'yesterday':
        const yesterday = new Date(current)
        yesterday.setDate(yesterday.getDate() - 1)
        startDate = new Date(yesterday.setHours(0, 0, 0, 0))
        endDate = new Date(yesterday.setHours(23, 59, 59, 999))
        break
      case 'thisWeek':
        const weekStart = new Date(current)
        weekStart.setDate(current.getDate() - current.getDay())
        startDate = new Date(weekStart.setHours(0, 0, 0, 0))
        endDate = new Date(current)
        break
      case 'thisMonth':
        startDate = new Date(current.getFullYear(), current.getMonth(), 1)
        endDate = new Date(current)
        break
      case 'lastMonth':
        startDate = new Date(current.getFullYear(), current.getMonth() - 1, 1)
        endDate = new Date(current.getFullYear(), current.getMonth(), 0)
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
        startDate = new Date(current.getFullYear(), current.getMonth(), 1)
        endDate = new Date(current)
      }
    }

    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]
    
    await db.initialize()

    // Build WHERE clause with hierarchy filtering
    let whereClause = `
      WHERE trx_type = 5 
      AND trx_date_only >= '${startStr}'
      AND trx_date_only <= '${endStr}'
    `
    
    // Add hierarchy filter if not admin
    if (allowedUserCodes.length > 0) {
      const userCodesStr = allowedUserCodes.map(code => `'${code}'`).join(', ')
      whereClause += ` AND field_user_code IN (${userCodesStr})`
    }

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
        city_code || ' - ' || COALESCE(city_name, 'Unknown') as label,
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

    // Get distinct salesmen (filtered by hierarchy)
    const salesmenQuery = `
      SELECT
        field_user_code as value,
        field_user_code || ' - ' || COALESCE(field_user_name, 'Unknown User') as label,
        COUNT(DISTINCT store_code) as count
      FROM flat_sales_transactions
      ${whereClause}
      AND field_user_code IS NOT NULL
      ${allowedFieldUsers.length > 0 ? `AND field_user_code IN (${allowedFieldUsers.map(c => `'${c}'`).join(', ')})` : ''}
      GROUP BY field_user_code, field_user_name
      ORDER BY field_user_code
    `

    // Get distinct team leaders (filtered by hierarchy)
    const teamLeadersQuery = `
      SELECT
        tl_code as value,
        tl_code || ' - ' || COALESCE(tl_name, 'Unknown') as label,
        COUNT(DISTINCT field_user_code) as salesman_count
      FROM flat_sales_transactions
      ${whereClause}
      AND tl_code IS NOT NULL
      ${allowedTeamLeaders.length > 0 ? `AND tl_code IN (${allowedTeamLeaders.map(c => `'${c}'`).join(', ')})` : ''}
      GROUP BY tl_code, tl_name
      ORDER BY tl_code
    `

    // Get distinct product categories
    const categoriesQuery = `
      SELECT
        COALESCE(product_group, 'Others') as value,
        COALESCE(product_group, 'Others') as label,
        COUNT(DISTINCT product_code) as product_count,
        COUNT(DISTINCT store_code) as customer_count
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY product_group
      ORDER BY product_count DESC
    `

    // Execute all queries
    const [customersResult, regionsResult, citiesResult, chainsResult, salesmenResult, teamLeadersResult, categoriesResult] = await Promise.all([
      query(customersQuery, []),
      query(regionsQuery, []),
      query(citiesQuery, []),
      query(chainsQuery, []),
      query(salesmenQuery, []),
      query(teamLeadersQuery, []),
      query(categoriesQuery, [])
    ])

    return NextResponse.json({
      success: true,
      filters: {
        customers: customersResult.rows || [],
        regions: regionsResult.rows || [],
        cities: citiesResult.rows || [],
        chains: chainsResult.rows || [],
        salesmen: salesmenResult.rows || [],
        teamLeaders: teamLeadersResult.rows || [],
        productCategories: categoriesResult.rows || []
      },
      dateRange: {
        start: startStr,
        end: endStr,
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
    console.error('Customer filters V3 API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
