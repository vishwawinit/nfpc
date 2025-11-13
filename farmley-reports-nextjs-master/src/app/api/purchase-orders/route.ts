import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getCacheControlHeader } from '@/lib/cache-utils'
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

    console.log('PO API - Received params:', Object.fromEntries(searchParams.entries()))

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

    if (searchParams.has('poStatus')) {
      conditions.push(`po_status_name = $${paramIndex}`)
      params.push(searchParams.get('poStatus'))
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

    if (searchParams.has('productCategory')) {
      conditions.push(`product_category = $${paramIndex}`)
      params.push(searchParams.get('productCategory'))
      paramIndex++
    }

    if (searchParams.has('deliveryStatus')) {
      conditions.push(`delivery_status = $${paramIndex}`)
      params.push(searchParams.get('deliveryStatus'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = parseInt(searchParams.get('limit') || '5000')

    console.log('PO API - WHERE clause:', whereClause)
    console.log('PO API - Query params:', params)
    console.log('PO API - Limit:', limit)

    const result = await query(`
      SELECT
        po_date as "poDate",
        po_created_datetime as "poCreatedDateTime",
        field_user_code as "userCode",
        field_user_name as "userName",
        tl_code as "teamLeaderCode",
        tl_name as "teamLeaderName",
        store_code as "storeCode",
        store_name as "storeName",
        chain_code as "chainCode",
        chain_name as "chainName",
        trx_code as "trxCode",
        po_number as "poNumber",
        po_status_name as "poStatus",
        po_total_amount as "totalAmount",
        product_code as "productCode",
        product_name as "productName",
        product_category as "productCategory",
        po_quantity as "quantity",
        received_quantity as "receivedQuantity",
        pending_quantity as "pendingQuantity",
        unit_price as "unitPrice",
        line_amount as "lineAmount",
        delivery_status as "deliveryStatus",
        po_image_path as "poImagePath"
      FROM flat_purchase_orders
      ${whereClause}
      ORDER BY po_date DESC, po_created_datetime DESC
      LIMIT $${paramIndex}
    `, [...params, limit])

    console.log('PO API - Query returned:', result.rows.length, 'rows')

    const orders = result.rows.map(row => ({
      poDate: row.poDate,
      poCreatedDateTime: row.poCreatedDateTime,
      userCode: row.userCode,
      userName: row.userName,
      teamLeaderCode: row.teamLeaderCode,
      teamLeaderName: row.teamLeaderName,
      storeCode: row.storeCode,
      storeName: row.storeName,
      chainCode: row.chainCode,
      chainName: row.chainName,
      trxCode: row.trxCode,
      poNumber: row.poNumber,
      poStatus: row.poStatus,
      totalAmount: parseFloat(row.totalAmount || '0'),
      productCode: row.productCode,
      productName: row.productName,
      productCategory: row.productCategory,
      quantity: parseFloat(row.quantity || '0'),
      receivedQuantity: parseFloat(row.receivedQuantity || '0'),
      pendingQuantity: parseFloat(row.pendingQuantity || '0'),
      unitPrice: parseFloat(row.unitPrice || '0'),
      lineAmount: parseFloat(row.lineAmount || '0'),
      deliveryStatus: row.deliveryStatus,
      poImagePath: row.poImagePath
    }))

    // Calculate cache duration based on date range span
    const startDate = new Date(searchParams.get('startDate')!)
    const endDate = new Date(searchParams.get('endDate')!)
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    let cacheDuration: number
    if (daysDiff <= 2) cacheDuration = 600
    else if (daysDiff <= 7) cacheDuration = 900
    else if (daysDiff <= 31) cacheDuration = 1800
    else cacheDuration = 3600

    return NextResponse.json({
      success: true,
      data: orders,
      count: orders.length,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table',
      cached: true,
      cacheInfo: {
        duration: cacheDuration,
        dateRangeDays: daysDiff
      }
    }, {
      headers: {
        'Cache-Control': getCacheControlHeader(cacheDuration)
      }
    })
  } catch (error) {
    console.error('Purchase Orders API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch purchase orders',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
