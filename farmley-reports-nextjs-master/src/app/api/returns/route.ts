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

    // Team Leader filter
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
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

    // Product Category filter
    if (searchParams.has('productCategory')) {
      conditions.push(`product_category = $${paramIndex}`)
      params.push(searchParams.get('productCategory'))
      paramIndex++
    }

    // Return Type filter
    if (searchParams.has('returnType')) {
      const returnType = searchParams.get('returnType')
      if (returnType === 'returned') {
        conditions.push('is_returned = true')
      } else if (returnType === 'cancelled') {
        conditions.push('is_cancelled = true')
      }
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`
    const limit = parseInt(searchParams.get('limit') || '100000')

    const result = await query(`
      SELECT
        trx_date_only as "transactionDate",
        trx_code as "transactionCode",
        trx_type_name as "transactionType",
        field_user_code as "userCode",
        field_user_name as "userName",
        tl_code as "teamLeaderCode",
        tl_name as "teamLeaderName",
        store_code as "storeCode",
        store_name as "storeName",
        chain_code as "chainCode",
        chain_name as "chainName",
        city_code as "cityCode",
        city_name as "cityName",
        region_code as "regionCode",
        region_name as "regionName",
        product_code as "productCode",
        product_name as "productName",
        product_category as "productCategory",
        product_brand as "productBrand",
        quantity as "quantity",
        unit_price as "unitPrice",
        line_amount as "lineAmount",
        net_amount as "netAmount",
        total_amount as "totalAmount",
        is_returned as "isReturned",
        is_cancelled as "isCancelled",
        trx_status_name as "transactionStatus",
        remarks
      FROM flat_sales_transactions
      ${whereClause}
      ORDER BY trx_date_only DESC, trx_code DESC
      LIMIT $${paramIndex}
    `, [...params, limit])

    const transactions = result.rows.map(row => ({
      transactionDate: row.transactionDate,
      transactionCode: row.transactionCode,
      transactionType: row.transactionType,
      userCode: row.userCode,
      userName: row.userName,
      teamLeaderCode: row.teamLeaderCode || '',
      teamLeaderName: row.teamLeaderName || '',
      storeCode: row.storeCode,
      storeName: row.storeName,
      chainCode: row.chainCode,
      chainName: row.chainName,
      cityCode: row.cityCode,
      cityName: row.cityName,
      regionCode: row.regionCode,
      regionName: row.regionName,
      productCode: row.productCode,
      productName: row.productName,
      productCategory: row.productCategory,
      productBrand: row.productBrand,
      quantity: parseFloat(row.quantity || '0'),
      unitPrice: parseFloat(row.unitPrice || '0'),
      lineAmount: parseFloat(row.lineAmount || '0'),
      netAmount: parseFloat(row.netAmount || '0'),
      totalAmount: parseFloat(row.totalAmount || '0'),
      isReturned: row.isReturned,
      isCancelled: row.isCancelled,
      transactionStatus: row.transactionStatus,
      remarks: row.remarks
    }))

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })

  } catch (error) {
    console.error('Returns API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch returns data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
