import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Build WHERE clause
    const conditions: string[] = []
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

    // Customer/Store filter
    if (searchParams.has('customerCode')) {
      conditions.push(`store_code = $${paramIndex}`)
      params.push(searchParams.get('customerCode'))
      paramIndex++
    }

    // User filter
    if (searchParams.has('userCode')) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    // Route filter (via user_route_code)
    if (searchParams.has('routeCode')) {
      conditions.push(`user_route_code = $${paramIndex}`)
      params.push(searchParams.get('routeCode'))
      paramIndex++
    }

    // Transaction type filter (handle both integer and string)
    if (searchParams.has('trxType')) {
      const trxType = searchParams.get('trxType')
      // Check if it's a number or string
      if (!isNaN(Number(trxType))) {
        conditions.push(`trx_type = $${paramIndex}`)
        params.push(parseInt(trxType!))
      } else {
        conditions.push(`trx_type_name = $${paramIndex}`)
        params.push(trxType)
      }
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get limit
    const limit = parseInt(searchParams.get('limit') || '100000')

    // Fetch transactions with aggregation per transaction
    const result = await query(`
      SELECT
        trx_code as "trxCode",
        trx_date_only as "trxDate",
        trx_type as "trxType",
        trx_type_name as "trxTypeName",
        store_code as "clientCode",
        MAX(store_name) as "clientName",
        MAX(field_user_code) as "userCode",
        MAX(field_user_name) as "userName",
        MAX(user_route_code) as "routeCode",
        COALESCE(SUM(net_amount), 0) as "totalAmount",
        COALESCE(SUM(quantity), 0) as "totalQuantity",
        COALESCE(SUM(total_discount_amount), 0) as "totalDiscount",
        COALESCE(SUM(tax_amount), 0) as "totalTax",
        COUNT(*) as "itemCount",
        MAX(trx_type_name) as "status"
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY trx_code, trx_date_only, trx_type, trx_type_name, store_code
      ORDER BY trx_date_only DESC, trx_code DESC
      LIMIT $${paramIndex}
    `, [...params, limit])

    const transactions = result.rows.map(row => ({
      trxCode: row.trxCode,
      trxDate: row.trxDate,
      trxType: row.trxType,
      trxTypeName: row.trxTypeName,
      clientCode: row.clientCode,
      clientName: row.clientName,
      userCode: row.userCode,
      userName: row.userName,
      routeCode: row.routeCode,
      totalAmount: parseFloat(row.totalAmount || '0'),
      totalQuantity: parseFloat(row.totalQuantity || '0'),
      totalDiscount: parseFloat(row.totalDiscount || '0'),
      totalTax: parseFloat(row.totalTax || '0'),
      itemCount: parseInt(row.itemCount || '0'),
      status: row.status || row.trxTypeName || 'Processed',
      // Add items placeholder for compatibility
      items: []
    }))

    return NextResponse.json({
      success: true,
      data: transactions,
      count: transactions.length,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table'
    })

  } catch (error) {
    console.error('Transactions API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch transactions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Note: Next.js unstable_cache will automatically handle invalidation
    // based on the revalidate time and tags. Manual invalidation is not needed.

    return NextResponse.json({
      success: true,
      message: 'Next.js cache will auto-refresh based on revalidate settings'
    })

  } catch (error) {
    console.error('Transaction POST error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to process transaction request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
