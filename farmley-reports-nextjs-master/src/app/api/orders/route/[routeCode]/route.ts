import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'

// Determine cache duration based on date range
const getCacheDuration = (range: string): number => {
  switch(range) {
    case 'today':
      return 300 // 5 minutes for today's data
    case 'thisWeek':
      return 1800 // 30 minutes for weekly data
    case 'thisMonth':
      return 3600 // 1 hour for monthly data
    case 'thisYear':
      return 7200 // 2 hours for yearly data
    case 'all':
      return 14400 // 4 hours for all time
    default:
      return 1800 // 30 minutes default
  }
}

// Cached data fetcher function
async function fetchRouteOrders(routeCode: string, range: string, status: string) {
  await db.initialize()

    // Calculate date range based on filter
    let dateCondition = ""

    switch(range) {
      case 'today':
        dateCondition = "AND t.trx_date_only >= CURRENT_DATE"
        break
      case 'thisWeek':
        dateCondition = "AND t.trx_date_only >= date_trunc('week', CURRENT_DATE)"
        break
      case 'thisMonth':
        dateCondition = "AND t.trx_date_only >= date_trunc('month', CURRENT_DATE)"
        break
      case 'lastMonth':
        dateCondition = "AND t.trx_date_only >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND t.trx_date_only < date_trunc('month', CURRENT_DATE)"
        break
      case 'thisYear':
        dateCondition = "AND t.trx_date_only >= date_trunc('year', CURRENT_DATE)"
        break
      case 'all':
        dateCondition = ""
        break
      default:
        dateCondition = ""
        break
    }

    // Get salesman info using route_code
    const salesmanQuery = `
      SELECT DISTINCT
        t.route_code,
        t.salesman_code,
        t.salesman_name
      FROM new_flat_transactions t
      WHERE t.route_code = $1
        AND t.route_code IS NOT NULL
        AND t.route_code != ''
        ${dateCondition}
      LIMIT 1
    `

    const salesmanResult = await db.query(salesmanQuery, [routeCode])
    const salesman = salesmanResult.rows[0] || { salesman_code: routeCode, salesman_name: `Route ${routeCode}` }

    // Get total count of orders using route_code
    const countQuery = `
      SELECT COUNT(DISTINCT t.trx_code) as total_count
      FROM new_flat_transactions t
      WHERE t.route_code = $1
        AND t.route_code IS NOT NULL
        AND t.route_code != ''
        AND t.total_amount > 0
        ${dateCondition}
    `

    const countResult = await db.query(countQuery, [routeCode])
    const totalOrderCount = parseInt(countResult.rows[0]?.total_count || 0)

    // Get orders - display payment_type and trx_status directly from transactions table
    const ordersQuery = `
      SELECT
        t.trx_code as order_id,
        '' as invoice_number,
        t.trx_date_only as date,
        t.customer_code,
        t.customer_name,
        SUM(t.total_amount) as total_amount,
        COUNT(*) as item_count,
        SUM(t.discount) as discount,
        SUM(t.tax) as tax,
        MAX(t.payment_type) as payment_method,
        MAX(t.trx_status)::text as payment_status
      FROM new_flat_transactions t
      WHERE t.route_code = $1
        AND t.route_code IS NOT NULL
        AND t.route_code != ''
        AND t.total_amount > 0
        ${dateCondition}
      GROUP BY t.trx_code, t.trx_date_only, t.customer_code, t.customer_name
      ORDER BY t.trx_date_only DESC
    `

    const ordersResult = await db.query(ordersQuery, [routeCode])

    // Filter by status if needed
    let orders = ordersResult.rows
    if (status !== 'all') {
      const statusMap: any = {
        'paid': 'Paid',
        'pending': 'Pending',
        'cancelled': 'Cancelled'
      }
      const filterStatus = statusMap[status.toLowerCase()]
      if (filterStatus) {
        orders = orders.filter((o: any) => o.payment_status === filterStatus)
      }
    }

    // Calculate statistics
    const totalOrders = orders.length
    const totalSales = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0)
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
    const paidOrders = orders.filter(o => o.payment_status === 'Paid').length
    const pendingOrders = orders.filter(o => o.payment_status === 'Pending').length

    // Format orders for display
    const formattedOrders = orders.map(order => ({
      orderId: order.order_id,
      invoiceNumber: order.order_id, // Use trx_code as invoice number (no INV- prefix)
      date: order.date,
      customerCode: order.customer_code,
      customerName: order.customer_name || 'Unknown Customer',
      items: parseInt(order.item_count || 0), // Use actual item count from database
      totalAmount: parseFloat(order.total_amount || 0),
      discount: parseFloat(order.discount || 0),
      tax: parseFloat(order.tax || 0),
      paymentMethod: order.payment_method,
      status: order.payment_status
    }))

    return {
      success: true,
      data: {
        salesman,
        statistics: {
          totalOrders,
          totalSales,
          avgOrderValue,
          paidOrders,
          pendingOrders,
          actualTotalCount: totalOrderCount
        },
        orders: formattedOrders,
        displayedCount: formattedOrders.length,
        totalCount: totalOrderCount,
        hasMore: totalOrderCount > formattedOrders.length
      },
      routeCode,
      dateRange: range,
      timestamp: new Date().toISOString()
    }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ routeCode: string }> }
) {
  try {
    const { routeCode } = await params
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'all'
    const status = searchParams.get('status') || 'all'

    const cacheDuration = getCacheDuration(range)
    const cacheKey = `route-orders-v11-route-code-${routeCode}-${range}-${status}`

    // Create cached version of the data fetcher
    const getCachedData = unstable_cache(
      async () => fetchRouteOrders(routeCode, range, status),
      [`route-orders-data-${cacheKey}`],
      {
        revalidate: cacheDuration,
        tags: [`orders-${routeCode}`, `orders-${range}`, 'route-orders']
      }
    )

    const result = await getCachedData()

    // Create response with cache headers
    const response = NextResponse.json({
      ...result,
      cached: true
    })

    // Set cache headers for browser caching
    response.headers.set('Cache-Control', `public, s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`)
    response.headers.set('X-Cache-Duration', cacheDuration.toString())

    return response

  } catch (error) {
    console.error('Orders API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch orders',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}