import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerCode = searchParams.get('customerCode')
    const dateRange = searchParams.get('range') || 'lastQuarter'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')

    if (!customerCode) {
      return NextResponse.json({
        success: false,
        error: 'Customer code is required'
      }, { status: 400 })
    }

    // Helper function to parse date range
    const getDateRangeFromString = (dateRange: string) => {
      const current = new Date()
      let startDate: Date
      let endDate: Date = new Date(current)

      switch(dateRange) {
        case 'today':
          startDate = new Date(current)
          break
        case 'yesterday':
          startDate = new Date(current)
          startDate.setDate(startDate.getDate() - 1)
          endDate = new Date(startDate)
          break
        case 'thisWeek':
        case 'last7Days':
          startDate = new Date(current)
          startDate.setDate(startDate.getDate() - 6)
          break
        case 'last30Days':
        case 'thisMonth':
          startDate = new Date(current.getFullYear(), current.getMonth(), 1)
          break
        case 'lastMonth':
          startDate = new Date(current.getFullYear(), current.getMonth() - 1, 1)
          endDate = new Date(current.getFullYear(), current.getMonth(), 0)
          break
        case 'thisQuarter':
          const quarter = Math.floor(current.getMonth() / 3)
          startDate = new Date(current.getFullYear(), quarter * 3, 1)
          break
        case 'lastQuarter':
          const lastQuarter = Math.floor(current.getMonth() / 3) - 1
          startDate = new Date(current.getFullYear(), lastQuarter * 3, 1)
          endDate = new Date(current.getFullYear(), lastQuarter * 3 + 3, 0)
          break
        case 'thisYear':
          startDate = new Date(current.getFullYear(), 0, 1)
          break
        default:
          startDate = new Date(current)
          startDate.setDate(startDate.getDate() - 29)
      }

      return {
        startDate,
        endDate
      }
    }

    const { start: startDate, end: endDate } = getDateRangeFromString(dateRange)
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Calculate offset for pagination
    const offset = (page - 1) * limit

    // Get customer orders
    const ordersQuery = `
      SELECT
        trx_code as order_code,
        trx_date_only as order_date,
        trx_time as order_time,
        SUM(net_amount) as total_amount,
        SUM(quantity) as total_quantity,
        COUNT(*) as line_items,
        'AED' as currency_code,
        MAX(user_route_code) as route,
        MAX(field_user_code) as salesman,
        MAX(field_user_name) as salesman_name
      FROM flat_sales_transactions
      WHERE store_code = $1
        AND trx_type = 1
        AND trx_date_only BETWEEN $2 AND $3
      GROUP BY trx_code, trx_date_only, trx_time
      ORDER BY trx_date_only DESC, trx_time DESC
      LIMIT $4 OFFSET $5
    `

    const ordersResult = await query(ordersQuery, [customerCode, startDateStr, endDateStr, limit, offset])

    // Get total order count for pagination
    const orderCountQuery = `
      SELECT COUNT(DISTINCT trx_code) as total_count
      FROM flat_sales_transactions
      WHERE store_code = $1
        AND trx_type = 1
        AND trx_date_only BETWEEN $2 AND $3
    `
    const orderCountResult = await query(orderCountQuery, [customerCode, startDateStr, endDateStr])
    const totalOrders = parseInt(orderCountResult.rows[0].total_count || '0')

    // Format order data
    const orders = ordersResult.rows.map(order => ({
      orderCode: order.order_code,
      orderDate: order.order_date,
      orderTime: order.order_time,
      totalAmount: parseFloat(order.total_amount || '0'),
      totalQuantity: parseInt(order.total_quantity || '0'),
      lineItems: parseInt(order.line_items || '0'),
      currencyCode: order.currency_code || 'AED',
      route: order.route,
      salesman: order.salesman,
      salesmanName: order.salesman_name
    }))

    // Get order summary
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT trx_code) as total_orders,
        SUM(net_amount) as total_amount,
        SUM(quantity) as total_quantity,
        AVG(net_amount) as avg_order_value,
        'AED' as currency_code
      FROM flat_sales_transactions
      WHERE store_code = $1
        AND trx_type = 1
        AND trx_date_only BETWEEN $2 AND $3
    `
    const summaryResult = await query(summaryQuery, [customerCode, startDateStr, endDateStr])
    const summary = summaryResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        orders,
        summary: {
          totalOrders: parseInt(summary.total_orders || '0'),
          totalAmount: parseFloat(summary.total_amount || '0'),
          totalQuantity: parseInt(summary.total_quantity || '0'),
          avgOrderValue: parseFloat(summary.avg_order_value || '0'),
          currencyCode: summary.currency_code || 'AED'
        },
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalOrders / limit),
          totalCount: totalOrders,
          pageSize: limit,
          hasNextPage: page < Math.ceil(totalOrders / limit),
          hasPrevPage: page > 1
        },
        dateRange: {
          start: startDateStr,
          end: endDateStr,
          range: dateRange
        }
      },
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table'
    })

  } catch (error) {
    console.error('Customer orders API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch customer orders',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}