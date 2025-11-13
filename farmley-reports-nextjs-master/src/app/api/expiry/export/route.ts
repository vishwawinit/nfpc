import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Disable caching for export
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    console.log('Expiry Export API - Received params:', Object.fromEntries(searchParams.entries()))

    // Always require date range
    if (!searchParams.has('startDate') || !searchParams.has('endDate')) {
      return NextResponse.json({
        success: false,
        error: 'Date range required',
        message: 'startDate and endDate parameters are required'
      }, { status: 400 })
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

    console.log('Expiry Export API - WHERE clause:', whereClause)
    console.log('Expiry Export API - Fetching all records for export...')

    // Get all records with only the columns needed for export
    const result = await query(`
      SELECT 
        visited_date as "visitedDate",
        tl_code as "tlCode",
        tl_name as "tlName",
        field_user_code as "fieldUserCode",
        field_user_name as "fieldUserName",
        customer_code as "customerCode",
        customer_name as "customerName",
        chain_name as "chainName",
        product_code as "productCode",
        product_name as "productName",
        expiry_date as "expiryDate",
        quantity as "expiryQuantity"
      FROM flat_expiry_checks
      ${whereClause}
      ORDER BY visited_date DESC, customer_code, product_name
    `, params)

    console.log('Expiry Export API - Query returned:', result.rows.length, 'rows for export')

    const exportData = result.rows.map(row => ({
      visitedDate: row.visitedDate,
      tlCode: row.tlCode || '',
      tlName: row.tlName || '',
      fieldUserCode: row.fieldUserCode || '',
      fieldUserName: row.fieldUserName || '',
      customerCode: row.customerCode || '',
      customerName: row.customerName || '',
      chainName: row.chainName || '',
      productCode: row.productCode || '',
      productName: row.productName || '',
      expiryDate: row.expiryDate || null,
      expiryQuantity: parseFloat(row.expiryQuantity) || 0
    }))

    return NextResponse.json({
      success: true,
      data: exportData,
      count: exportData.length,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
  } catch (error) {
    console.error('Expiry Export API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch expiry export data',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

