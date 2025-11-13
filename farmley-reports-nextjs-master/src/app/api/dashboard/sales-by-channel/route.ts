import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Intelligent caching - longer cache for data with date filters (30 mins default)
const DEFAULT_CACHE_DURATION = 1800 // 30 minutes

/**
 * API Endpoint: GET /api/dashboard/sales-by-channel
 * Description: Fetches sales distribution by channel (chain_name)
 * Query Parameters:
 *   - startDate: Start date filter (format: YYYY-MM-DD)
 *   - endDate: End date filter (format: YYYY-MM-DD)
 *   - regionCode: Filter by region
 *   - teamLeaderCode: Filter by team leader
 *   - fieldUserRole: Filter by field user role
 *   - userCode: Filter by field user
 * Returns: Array of channels with their sales and percentage contribution
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Get filter parameters
    const regionCode = searchParams.get('regionCode')
    const teamLeaderCode = searchParams.get('teamLeaderCode')
    const fieldUserRole = searchParams.get('fieldUserRole')
    const userCode = searchParams.get('userCode')
    const customStartDate = searchParams.get('startDate')
    const customEndDate = searchParams.get('endDate')

    // Get date range - prioritize custom dates
    const startDate = customStartDate || null
    const endDate = customEndDate || null

    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Date filters - cast transaction_date to date for comparison
    if (startDate && endDate) {
      conditions.push(`t.transaction_date::date >= $${paramIndex}`)
      params.push(startDate)
      paramIndex++
      conditions.push(`t.transaction_date::date <= $${paramIndex}`)
      params.push(endDate)
      paramIndex++
    }

    // Region filter - use state from customers master
    if (regionCode) {
      conditions.push(`c.state = $${paramIndex}`)
      params.push(regionCode)
      paramIndex++
    }

    // City filter
    const cityCode = searchParams.get('cityCode')
    if (cityCode) {
      conditions.push(`c.city = $${paramIndex}`)
      params.push(cityCode)
      paramIndex++
    }

    // Team Leader filter - using sales_person_code
    if (teamLeaderCode) {
      conditions.push(`c.sales_person_code = $${paramIndex}`)
      params.push(teamLeaderCode)
      paramIndex++
    }

    // Field User Role filter - using sales_person_code
    if (fieldUserRole) {
      conditions.push(`c.sales_person_code = $${paramIndex}`)
      params.push(fieldUserRole)
      paramIndex++
    }

    // User filter
    if (userCode) {
      conditions.push(`t.user_code = $${paramIndex}`)
      params.push(userCode)
      paramIndex++
    }

    // Chain filter - using customer_type
    const chainName = searchParams.get('chainName')
    if (chainName) {
      conditions.push(`c.customer_type = $${paramIndex}`)
      params.push(chainName)
      paramIndex++
    }

    // Store filter
    const storeCode = searchParams.get('storeCode')
    if (storeCode) {
      conditions.push(`t.customer_code = $${paramIndex}`)
      params.push(storeCode)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Log for debugging
    console.log('Sales by customer type query params:', { startDate, endDate, conditions: conditions.length, whereClause, params })

    // Fetch sales by customer type using master table
    const result = await query(`
      SELECT
        COALESCE(c.customer_type, 'Direct') as channel,
        COALESCE(SUM(CASE WHEN t.net_amount >= 0 THEN t.net_amount ELSE 0 END), 0) as sales,
        COUNT(DISTINCT t.transaction_code) as orders,
        COUNT(DISTINCT t.customer_code) as customers,
        AVG(t.net_amount) as avg_order_value,
        SUM(t.quantity_bu) as total_quantity
      FROM flat_transactions t
      LEFT JOIN flat_customers_master c ON t.customer_code = c.customer_code
      ${whereClause}
      GROUP BY c.customer_type
      ORDER BY sales DESC
    `, params)

    // Calculate total sales for percentage
    const totalSales = result.rows.reduce((sum, row) => sum + parseFloat(row.sales || '0'), 0)

    const channelData = result.rows.map(row => {
      const sales = parseFloat(row.sales || '0')
      const percentage = totalSales > 0 ? ((sales / totalSales) * 100) : 0

      return {
        channel: row.channel,
        channelType: 'Customer Type',
        sales: parseFloat(sales.toFixed(2)),
        orders: parseInt(row.orders || '0'),
        customers: parseInt(row.customers || '0'),
        avgOrderValue: parseFloat(row.avg_order_value || '0'),
        totalQuantity: parseFloat(row.total_quantity || '0'),
        percentage: parseFloat(percentage.toFixed(2))
      }
    })

    return NextResponse.json({
      success: true,
      data: channelData,
      totalSales: parseFloat(totalSales.toFixed(2)),
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        regionCode: regionCode || null,
        teamLeaderCode: teamLeaderCode || null,
        fieldUserRole: fieldUserRole || null,
        userCode: userCode || null
      },
      timestamp: new Date().toISOString(),
      cached: true,
      cacheInfo: {
        duration: DEFAULT_CACHE_DURATION
      },
      source: 'postgresql-flat-table'
    }, {
      headers: {
        'Cache-Control': `public, s-maxage=${DEFAULT_CACHE_DURATION}, stale-while-revalidate=${DEFAULT_CACHE_DURATION * 2}`
      }
    })

  } catch (error) {
    console.error('Sales by channel API error:', error)
    const isDev = process.env.NODE_ENV === 'development'
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sales by channel',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: isDev ? error : undefined
    }, { status: 500 })
  }
}
