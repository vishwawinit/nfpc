import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

/**
 * API Endpoint: GET /api/transactions/recent
 * Description: Fetches recent transactions with optional date filtering
 * Query Parameters:
 *   - limit: Number of transactions to return (default: 20, max: 100)
 *   - startDate: Start date filter (format: YYYY-MM-DD)
 *   - endDate: End date filter (format: YYYY-MM-DD)
 * Returns: Array of recent transactions ordered by date (newest first)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Default 20, max 100
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Get filter parameters
    const regionCode = searchParams.get('regionCode')
    const teamLeaderCode = searchParams.get('teamLeaderCode')
    const fieldUserRole = searchParams.get('fieldUserRole')
    const userCode = searchParams.get('userCode')

    // Build WHERE clause with all filters
    const conditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    // Date filters
    if (startDate && endDate) {
      conditions.push(`trx_date_only >= $${paramIndex}`)
      queryParams.push(startDate)
      paramIndex++
      conditions.push(`trx_date_only <= $${paramIndex}`)
      queryParams.push(endDate)
      paramIndex++
    } else if (startDate) {
      conditions.push(`trx_date_only >= $${paramIndex}`)
      queryParams.push(startDate)
      paramIndex++
    } else if (endDate) {
      conditions.push(`trx_date_only <= $${paramIndex}`)
      queryParams.push(endDate)
      paramIndex++
    }

    // Region filter
    if (regionCode) {
      conditions.push(`region_code = $${paramIndex}`)
      queryParams.push(regionCode)
      paramIndex++
    }

    // Team Leader filter
    if (teamLeaderCode) {
      conditions.push(`tl_code = $${paramIndex}`)
      queryParams.push(teamLeaderCode)
      paramIndex++
    }

    // Field User Role filter
    if (fieldUserRole) {
      conditions.push(`COALESCE(user_role, 'Field User') = $${paramIndex}`)
      queryParams.push(fieldUserRole)
      paramIndex++
    }

    // Field User filter
    if (userCode) {
      conditions.push(`field_user_code = $${paramIndex}`)
      queryParams.push(userCode)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Add limit parameter
    queryParams.push(limit)

    // Fetch recent transactions from flat_sales_transactions with enhanced details
    const result = await query(`
      SELECT
        trx_code as "trxCode",
        trx_date_only as "trxDate",
        store_code as "clientCode",
        store_name as "clientName",
        trx_type as "trxType",
        trx_type_name as "trxTypeName",
        net_amount as "totalAmount",
        'Completed' as status
      FROM flat_sales_transactions
      ${whereClause}
      ORDER BY trx_date_only DESC, trx_code DESC
      LIMIT $${paramIndex}
    `, queryParams)

    const recentTransactions = result.rows.map(row => ({
      trxCode: row.trxCode || 'N/A',
      trxDate: row.trxDate,
      clientCode: row.clientCode || '',
      clientName: row.clientName || 'Unknown',
      trxType: row.trxType || 0,
      trxTypeName: row.trxTypeName || 'Sale',
      totalAmount: parseFloat(row.totalAmount || '0'),
      status: row.status || 'Completed'
    }))

    return NextResponse.json({
      success: true,
      data: recentTransactions,
      count: recentTransactions.length,
      limit: limit,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        regionCode: regionCode || null,
        teamLeaderCode: teamLeaderCode || null,
        fieldUserRole: fieldUserRole || null,
        userCode: userCode || null
      },
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table'
    })

  } catch (error) {
    console.error('Recent transactions API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch recent transactions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
