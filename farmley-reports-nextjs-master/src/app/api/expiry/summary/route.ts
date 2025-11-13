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

    console.log('Expiry Summary API - Received params:', Object.fromEntries(searchParams.entries()))

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

    console.log('Expiry Summary API - WHERE clause:', whereClause)

    // Calculate metrics in the database
    const summaryResult = await query(`
      SELECT 
        COUNT(*) as "totalChecks",
        SUM(CASE WHEN items_expired = 1 THEN quantity ELSE 0 END) as "totalExpiredItems",
        SUM(quantity) as "totalItemsChecked",
        COUNT(DISTINCT CASE WHEN items_expired = 1 THEN customer_code END) as "storesWithExpiry",
        COUNT(CASE WHEN (expiry_date - CURRENT_DATE)::INTEGER <= 0 THEN 1 END) as "expired",
        COUNT(CASE WHEN (expiry_date - CURRENT_DATE)::INTEGER > 0 AND (expiry_date - CURRENT_DATE)::INTEGER <= 30 THEN 1 END) as "nearExpiry",
        COUNT(CASE WHEN (expiry_date - CURRENT_DATE)::INTEGER > 30 THEN 1 END) as "safe"
      FROM flat_expiry_checks
      ${whereClause}
    `, params)

    // Get top 10 stores by expired items
    const topStoresResult = await query(`
      SELECT 
        customer_code as "storeCode",
        customer_name as "storeName",
        SUM(CASE WHEN items_expired = 1 THEN quantity ELSE 0 END) as count
      FROM flat_expiry_checks
      ${whereClause} AND items_expired = 1
      GROUP BY customer_code, customer_name
      ORDER BY count DESC
      LIMIT 10
    `, params)

    const summary = summaryResult.rows[0]
    const totalChecks = parseInt(summary.totalChecks) || 0
    const totalExpiredItems = parseFloat(summary.totalExpiredItems) || 0
    const totalItemsChecked = parseFloat(summary.totalItemsChecked) || 0
    const storesWithExpiry = parseInt(summary.storesWithExpiry) || 0
    const expiryRate = totalItemsChecked > 0 ? ((totalExpiredItems / totalItemsChecked) * 100).toFixed(2) : '0.00'

    const topStores = topStoresResult.rows.map(row => ({
      storeCode: row.storeCode,
      storeName: row.storeName.substring(0, 20),
      count: parseFloat(row.count) || 0
    }))

    const statusData = [
      { name: 'Expired', value: parseInt(summary.expired) || 0, color: '#ef4444' },
      { name: 'Near Expiry', value: parseInt(summary.nearExpiry) || 0, color: '#f59e0b' },
      { name: 'Safe', value: parseInt(summary.safe) || 0, color: '#10b981' }
    ].filter(s => s.value > 0)

    console.log('Expiry Summary API - Calculated metrics:', {
      totalChecks,
      totalExpiredItems,
      totalItemsChecked,
      storesWithExpiry,
      expiryRate
    })

    return NextResponse.json({
      success: true,
      data: {
        totalChecks,
        totalExpiredItems,
        totalItemsChecked,
        storesWithExpiry,
        expiryRate,
        topStores,
        statusData
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Expiry Summary API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch expiry summary',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
