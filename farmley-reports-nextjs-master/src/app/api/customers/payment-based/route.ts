import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'

// Cached data fetcher function
async function fetchPaymentBasedCustomers(limit: number) {
  await db.initialize()

    // Get top customers based on recent payment/transaction data
    // Using new_flat_transactions which has payment-related data
    const query = `
      WITH customer_payments AS (
        SELECT
          customer_code,
          customer_name,
          COUNT(DISTINCT trx_code) as payment_count,
          SUM(total_amount) as total_payments,
          AVG(total_amount) as avg_payment,
          MAX(trx_date_only) as last_payment_date,
          MIN(trx_date_only) as first_payment_date
        FROM new_flat_transactions
        WHERE total_amount > 0
          AND trx_date_only >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY customer_code, customer_name
        HAVING SUM(total_amount) > 1000
      )
      SELECT
        customer_code,
        customer_name,
        '' as route_name,
        '' as salesman_code,
        0.0 as longitude,
        0.0 as latitude,
        true as isactive,
        'Active' as status,
        payment_count as total_visits,
        last_payment_date as last_visit_date,
        total_payments as total_sales,
        payment_count as total_orders,
        avg_payment as average_order_value,
        last_payment_date
      FROM customer_payments
      ORDER BY total_payments DESC
      LIMIT $1
    `

    const result = await db.query(query, [limit])

    const customers = result.rows.map(row => ({
      customerCode: row.customer_code,
      customerName: row.customer_name,
      customerArabicName: '',
      customerType: '',
      routeCode: row.salesman_code || '',
      routeName: row.route_name || '',
      channelCode: '',
      classificationCode: '',
      creditLimit: 0,
      outstandingAmount: 0,
      lastOrderDate: row.last_payment_date ? new Date(row.last_payment_date) : (row.last_visit_date ? new Date(row.last_visit_date) : undefined),
      totalOrders: parseInt(row.total_orders || 0),
      totalSales: parseFloat(row.total_sales || 0),
      averageOrderValue: parseFloat(row.average_order_value || 0),
      status: row.status === 2 ? 'Active' : 'Inactive',
      gpsLatitude: parseFloat(row.latitude || 0),
      gpsLongitude: parseFloat(row.longitude || 0)
    }))

    return {
      success: true,
      data: customers,
      count: customers.length,
      limit,
      timestamp: new Date().toISOString()
    }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Validate limit parameter
    if (limit <= 0 || limit > 100) {
      return NextResponse.json({
        success: false,
        error: 'Invalid limit parameter. Must be between 1 and 100.'
      }, { status: 400 })
    }

    // Create cached version of the data fetcher (cache for 30 minutes)
    const getCachedData = unstable_cache(
      async () => fetchPaymentBasedCustomers(limit),
      [`payment-based-customers-${limit}`],
      {
        revalidate: 1800, // Cache for 30 minutes
        tags: [`payment-customers`, 'customers']
      }
    )

    const result = await getCachedData()

    // Create response with cache headers
    const response = NextResponse.json({
      ...result,
      cached: true
    })

    // Set cache headers for browser caching
    response.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600')
    response.headers.set('X-Cache-Duration', '1800')

    return response

  } catch (error) {
    console.error('Payment-based customers API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch payment-based customers',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}