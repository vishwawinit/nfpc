import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Pagination parameters - only use if explicitly provided
    const usePagination = searchParams.has('page') && searchParams.has('limit')
    const page = usePagination ? parseInt(searchParams.get('page') || '1') : 1
    const limit = usePagination ? parseInt(searchParams.get('limit') || '100') : 0
    const offset = usePagination && limit > 0 ? (page - 1) * limit : 0

    console.log('Expiry API - Received params:', Object.fromEntries(searchParams.entries()))
    console.log('Expiry API - Pagination:', { usePagination, page, limit, offset })

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

    if (searchParams.has('expiryStatus')) {
      const status = searchParams.get('expiryStatus')
      if (status === 'expired') {
        conditions.push(`(items_expired > 0 OR quantity > 0)`)
      } else if (status === 'safe') {
        conditions.push(`(COALESCE(items_expired, 0) = 0 AND COALESCE(quantity, 0) = 0)`)
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    console.log('Expiry API - WHERE clause:', whereClause)
    console.log('Expiry API - Query params:', params)

    const result = await query(`
      SELECT 
        expiry_check_id as "expiryCheckId",
        visited_date as "visitedDate",
        customer_code as "customerCode",
        customer_name as "customerName",
        chain_code as "chainCode",
        chain_name as "chainName",
        product_code as "productCode",
        product_name as "productName",
        product_category as "productCategory",
        category,
        expiry_date as "expiryDate",
        (expiry_date - CURRENT_DATE)::INTEGER as "daysToExpiry",
        items_checked as "itemsChecked",
        items_expired as "itemsExpired",
        quantity,
        field_user_code as "fieldUserCode",
        field_user_name as "fieldUserName",
        user_role as "userRole",
        tl_code as "tlCode",
        tl_name as "tlName",
        image_path as "imagePath",
        created_by as "createdBy",
        city_code as "cityCode",
        city_name as "cityName",
        region_code as "regionCode",
        check_status as "checkStatus",
        remarks,
        uom,
        created_on as "createdOn",
        visited_datetime as "visitedDatetime"
      FROM flat_expiry_checks
      ${whereClause}
      ORDER BY visited_date DESC, expiry_check_id DESC
      ${usePagination ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    `, params)

    // Get total count for pagination - only when needed
    let totalCount = 0
    if (usePagination) {
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM flat_expiry_checks
        ${whereClause}
      `, params)
      totalCount = parseInt(countResult.rows[0].total)
    } else {
      totalCount = result.rows.length
    }

    console.log('Expiry API - Query returned:', result.rows.length, 'rows')
    
    // Log first row to see which columns have data
    if (result.rows.length > 0) {
      console.log('First row columns:', {
        items_expired: result.rows[0].itemsExpired,
        items_checked: result.rows[0].itemsChecked,
        quantity: result.rows[0].quantity
      })
    }

    const totalPages = usePagination && limit ? Math.ceil(totalCount / limit) : 1

    // Use REAL data from database - NO manipulation, just NULL safety
    const checks = result.rows.map(row => ({
      expiryCheckId: row.expiryCheckId,
      visitedDate: row.visitedDate,
      visitedDatetime: row.visitedDatetime || null,
      customerCode: row.customerCode || '',
      customerName: row.customerName || '',
      chainCode: row.chainCode || '',
      chainName: row.chainName || '',
      productCode: row.productCode || '',
      productName: row.productName || '',
      productCategory: row.productCategory || '',
      category: row.category || '',
      expiryDate: row.expiryDate || null,
      daysToExpiry: parseInt(row.daysToExpiry) || 0,
      itemsChecked: parseInt(row.itemsChecked) || 0,
      itemsExpired: parseInt(row.itemsExpired) || 0,
      quantity: parseFloat(row.quantity) || 0,
      uom: row.uom || '',
      fieldUserCode: row.fieldUserCode || '',
      fieldUserName: row.fieldUserName || '',
      userRole: row.userRole || '',
      tlCode: row.tlCode || '',
      tlName: row.tlName || '',
      cityCode: row.cityCode || '',
      cityName: row.cityName || '',
      regionCode: row.regionCode || '',
      checkStatus: row.checkStatus || '',
      remarks: row.remarks || '',
      imagePath: row.imagePath || '',
      createdBy: row.createdBy || '',
      createdOn: row.createdOn || null
    }))

    // Calculate cache duration based on date range span
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const startDate = new Date(startDateStr!)
    const endDate = new Date(endDateStr!)
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    let cacheDuration: number
    if (daysDiff <= 2) cacheDuration = 600
    else if (daysDiff <= 7) cacheDuration = 900
    else if (daysDiff <= 31) cacheDuration = 1800
    else cacheDuration = 3600
    const staleWhileRevalidate = cacheDuration * 2

    return NextResponse.json({
      success: true,
      data: checks,
      count: checks.length,
      totalCount: totalCount,
      page: page,
      totalPages: totalPages,
      limit: limit,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table',
      cached: true,
      cacheInfo: {
        duration: cacheDuration,
        dateRangeDays: daysDiff
      }
    }, {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheDuration}, stale-while-revalidate=${staleWhileRevalidate}`
      }
    })
  } catch (error) {
    console.error('Expiry API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch expiry checks',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
