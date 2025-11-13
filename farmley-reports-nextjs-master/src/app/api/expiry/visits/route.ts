import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'

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

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = (page - 1) * limit

    console.log('Expiry Visits API - Received params:', Object.fromEntries(searchParams.entries()))
    console.log('Expiry Visits API - Pagination:', { page, limit, offset })

    // Always require date range
    if (!searchParams.has('startDate') || !searchParams.has('endDate')) {
      return NextResponse.json({
        success: false,
        error: 'Date range required',
        message: 'startDate and endDate parameters are required'
      }, { status: 400 })
    }

    // Get hierarchy-based allowed users - ALWAYS apply if not admin
    const loginUserCode = searchParams.get('loginUserCode')
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

    conditions.push(`visited_date >= $${paramIndex}`)
    params.push(searchParams.get('startDate'))
    paramIndex++
    conditions.push(`visited_date <= $${paramIndex}`)
    params.push(searchParams.get('endDate'))
    paramIndex++

    if (searchParams.has('fieldUserCode')) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(searchParams.get('fieldUserCode'))
      paramIndex++
    }

    if (searchParams.has('customerCode')) {
      conditions.push(`customer_code = $${paramIndex}`)
      params.push(searchParams.get('customerCode'))
      paramIndex++
    }

    if (searchParams.has('chainCode')) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(searchParams.get('chainCode'))
      paramIndex++
    }

    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    if (searchParams.has('productCategory')) {
      conditions.push(`product_category = $${paramIndex}`)
      params.push(searchParams.get('productCategory'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    console.log('Expiry Visits API - WHERE clause:', whereClause)

    // Get grouped visits (one row per customer per date per user)
    const result = await query(`
      SELECT 
        visited_date as "visitedDate",
        tl_code as "tlCode",
        tl_name as "tlName",
        field_user_code as "fieldUserCode",
        field_user_name as "fieldUserName",
        customer_code as "customerCode",
        customer_name as "customerName",
        chain_code as "chainCode",
        chain_name as "chainName",
        COUNT(*) as "productCount",
        SUM(CASE WHEN items_expired = 1 THEN quantity ELSE 0 END) as "expiredQuantity",
        SUM(quantity) as "totalQuantity"
      FROM flat_expiry_checks
      ${whereClause}
      GROUP BY 
        visited_date,
        tl_code,
        tl_name,
        field_user_code,
        field_user_name,
        customer_code,
        customer_name,
        chain_code,
        chain_name
      ORDER BY visited_date DESC, customer_code
      LIMIT ${limit} OFFSET ${offset}
    `, params)

    // Get total count for pagination
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM (
        SELECT 
          visited_date,
          tl_code,
          field_user_code,
          customer_code
        FROM flat_expiry_checks
        ${whereClause}
        GROUP BY 
          visited_date,
          tl_code,
          field_user_code,
          customer_code
      ) grouped_visits
    `, params)

    const totalCount = parseInt(countResult.rows[0].total)
    const totalPages = Math.ceil(totalCount / limit)

    console.log('Expiry Visits API - Query returned:', result.rows.length, 'grouped visits')

    const visits = result.rows.map(row => ({
      visitedDate: row.visitedDate,
      tlCode: row.tlCode || '',
      tlName: row.tlName || '',
      fieldUserCode: row.fieldUserCode || '',
      fieldUserName: row.fieldUserName || '',
      customerCode: row.customerCode || '',
      customerName: row.customerName || '',
      chainCode: row.chainCode || '',
      chainName: row.chainName || '',
      productCount: parseInt(row.productCount) || 0,
      expiredQuantity: parseFloat(row.expiredQuantity) || 0,
      totalQuantity: parseFloat(row.totalQuantity) || 0
    }))

    return NextResponse.json({
      success: true,
      data: visits,
      count: visits.length,
      totalCount: totalCount,
      page: page,
      totalPages: totalPages,
      limit: limit,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table-grouped'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Expiry Visits API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch expiry visits',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

