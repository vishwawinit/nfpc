import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Enable ISR with 60 second revalidation
export const revalidate = 60

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    console.log('Filters API - Received params:', Object.fromEntries(searchParams.entries()))

    // Always require date range to prevent full table scan
    if (!searchParams.has('startDate') || !searchParams.has('endDate')) {
      return NextResponse.json({
        success: false,
        error: 'Date range required',
        message: 'startDate and endDate parameters are required'
      }, { status: 400 })
    }

    // Get hierarchy-based allowed users - ALWAYS apply if not admin
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Validate user access
    const validation = await validateApiUser(loginUserCode)
    if (!validation.isValid) {
      return validation.response!
    }
    let allowedUserCodes: string[] = []
    
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }

    // Add hierarchy filter if not admin - this restricts data to only managed users
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
      conditions.push(`field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    conditions.push(`po_date >= $${paramIndex}`)
    params.push(searchParams.get('startDate'))
    paramIndex++
    conditions.push(`po_date <= $${paramIndex}`)
    params.push(searchParams.get('endDate'))
    paramIndex++

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

    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    if (searchParams.has('chainCode')) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(searchParams.get('chainCode'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    console.log('Filters API - WHERE clause:', whereClause)
    console.log('Filters API - Params:', params)

    const [usersResult, storesResult, statusResult, chainsResult, categoriesResult, deliveryStatusResult] = await Promise.all([
      query(`SELECT DISTINCT field_user_code as "value", field_user_name as "label" FROM flat_purchase_orders ${whereClause} ORDER BY field_user_name LIMIT 500`, params),
      query(`SELECT DISTINCT store_code as "value", store_name as "label" FROM flat_purchase_orders ${whereClause} ORDER BY store_name LIMIT 500`, params),
      query(`SELECT DISTINCT po_status_name as "value", po_status_name as "label" FROM flat_purchase_orders ${whereClause}${whereClause ? ' AND' : ' WHERE'} po_status_name IS NOT NULL ORDER BY po_status_name LIMIT 100`, params),
      query(`SELECT DISTINCT chain_code as "value", chain_name as "label" FROM flat_purchase_orders ${whereClause}${whereClause ? ' AND' : ' WHERE'} chain_code IS NOT NULL ORDER BY chain_name LIMIT 100`, params),
      query(`SELECT DISTINCT product_category as "value", product_category as "label" FROM flat_purchase_orders ${whereClause}${whereClause ? ' AND' : ' WHERE'} product_category IS NOT NULL ORDER BY product_category LIMIT 100`, params),
      query(`SELECT DISTINCT delivery_status as "value", delivery_status as "label" FROM flat_purchase_orders ${whereClause}${whereClause ? ' AND' : ' WHERE'} delivery_status IS NOT NULL ORDER BY delivery_status LIMIT 50`, params)
    ])

    console.log('Filters API - Query results:', {
      users: usersResult.rows.length,
      stores: storesResult.rows.length,
      statuses: statusResult.rows.length,
      chains: chainsResult.rows.length
    })

    // Get hierarchy filter options from the users hierarchy API
    let teamLeaders: any[] = []
    let assistantLeaders: any[] = []
    
    try {
      // Fetch hierarchy data from the users hierarchy API using dynamic origin
      const hierarchyResponse = await fetch(`${request.nextUrl.origin}/api/users/hierarchy`)
      if (hierarchyResponse.ok) {
        const hierarchyData = await hierarchyResponse.json()

        teamLeaders = hierarchyData.data.teamLeaders.map((leader: any) => ({
          value: leader.code,
          label: leader.name,
          role: leader.role
        }))

        assistantLeaders = hierarchyData.data.assistantLeaders.map((leader: any) => ({
          value: leader.code,
          label: leader.name,
          role: leader.role
        }))
      }
    } catch (error) {
      console.warn('Failed to fetch hierarchy data:', error)
      // Continue without hierarchy data if there's an error
    }

    return NextResponse.json({
      success: true,
      data: {
        users: usersResult.rows,
        stores: storesResult.rows,
        statuses: statusResult.rows,
        chains: chainsResult.rows,
        categories: categoriesResult.rows,
        deliveryStatuses: deliveryStatusResult.rows,
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
    console.error('Purchase Orders Filters API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
