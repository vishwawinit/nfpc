import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerCode = searchParams.get('customerCode')
    const dateRange = searchParams.get('range') || 'lastMonth'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '30')
    const offset = (page - 1) * limit

    if (!customerCode) {
      return NextResponse.json({
        success: false,
        error: 'Customer code is required'
      }, { status: 400 })
    }

    await db.initialize()

    // Calculate date range filter
    const today = new Date()
    let startDate: Date
    let endDate = today

    switch(dateRange) {
      case 'today':
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        endDate = today
        break
      case 'yesterday':
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
        break
      case 'thisWeek':
        const dayOfWeek = today.getDay()
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek)
        endDate = today
        break
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        endDate = today
        break
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        endDate = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'lastQuarter':
        const currentQuarter = Math.floor(today.getMonth() / 3)
        const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1
        const lastQuarterYear = currentQuarter === 0 ? today.getFullYear() - 1 : today.getFullYear()
        startDate = new Date(lastQuarterYear, lastQuarter * 3, 1)
        endDate = new Date(lastQuarterYear, (lastQuarter + 1) * 3, 0)
        break
      case 'thisYear':
        startDate = new Date(today.getFullYear(), 0, 1)
        endDate = today
        break
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    }

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Get daily transaction summary
    // This query aggregates all transactions by date and type
    const dailyTransactionsQuery = `
      WITH daily_summary AS (
        SELECT
          trx_date_only as transaction_date,
          -- Sales (trx_type = 1)
          SUM(CASE WHEN trx_type = 1 THEN total_amount ELSE 0 END) as sales_amount,
          COUNT(DISTINCT CASE WHEN trx_type = 1 THEN trx_code END) as sales_count,
          SUM(CASE WHEN trx_type = 1 THEN quantity ELSE 0 END) as sales_quantity,

          -- Returns/Collections (trx_type = 4)
          -- Good returns (trx_type = 4 AND collection_type = 1)
          SUM(CASE WHEN trx_type = 4 AND collection_type = 1 THEN total_amount ELSE 0 END) as good_returns_amount,
          COUNT(DISTINCT CASE WHEN trx_type = 4 AND collection_type = 1 THEN trx_code END) as good_returns_count,
          SUM(CASE WHEN trx_type = 4 AND collection_type = 1 THEN quantity ELSE 0 END) as good_returns_quantity,

          -- Bad returns/Wastage (trx_type = 4 AND collection_type = 0)
          SUM(CASE WHEN trx_type = 4 AND collection_type = 0 THEN total_amount ELSE 0 END) as bad_returns_amount,
          COUNT(DISTINCT CASE WHEN trx_type = 4 AND collection_type = 0 THEN trx_code END) as bad_returns_count,
          SUM(CASE WHEN trx_type = 4 AND collection_type = 0 THEN quantity ELSE 0 END) as bad_returns_quantity,

          -- Deliveries/Stock In (trx_type = 3)
          SUM(CASE WHEN trx_type = 3 THEN total_amount ELSE 0 END) as delivery_amount,
          COUNT(DISTINCT CASE WHEN trx_type = 3 THEN trx_code END) as delivery_count,
          SUM(CASE WHEN trx_type = 3 THEN quantity ELSE 0 END) as delivery_quantity,

          -- Get currency
          MAX(currency_code) as currency_code
        FROM new_flat_transactions
        WHERE customer_code = $1
          AND trx_date_only BETWEEN $2 AND $3
        GROUP BY trx_date_only
        ORDER BY trx_date_only DESC
      )
      SELECT
        transaction_date,
        sales_amount,
        sales_count,
        sales_quantity,
        good_returns_amount,
        good_returns_count,
        good_returns_quantity,
        bad_returns_amount,
        bad_returns_count,
        bad_returns_quantity,
        delivery_amount,
        delivery_count,
        delivery_quantity,
        currency_code,
        -- Calculate net amount (sales - returns + deliveries)
        (sales_amount - COALESCE(good_returns_amount, 0) - COALESCE(bad_returns_amount, 0) + COALESCE(delivery_amount, 0)) as net_amount
      FROM daily_summary
      LIMIT $4 OFFSET $5
    `

    // Get count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT trx_date_only) as total_days
      FROM new_flat_transactions
      WHERE customer_code = $1
        AND trx_date_only BETWEEN $2 AND $3
    `

    const [transactionsResult, countResult] = await Promise.all([
      db.query(dailyTransactionsQuery, [customerCode, startDateStr, endDateStr, limit, offset]),
      db.query(countQuery, [customerCode, startDateStr, endDateStr])
    ])

    const totalDays = parseInt(countResult.rows[0]?.total_days || 0)

    // Get customer info
    const customerQuery = `
      SELECT
        customer_code,
        customer_name,
        route_code,
        city,
        is_active
      FROM new_flat_customer_master
      WHERE customer_code = $1
      LIMIT 1
    `

    const customerResult = await db.query(customerQuery, [customerCode])
    const currency = transactionsResult.rows[0]?.currency_code || 'AED'

    // Calculate totals
    const totals = {
      salesAmount: transactionsResult.rows.reduce((sum, row) => sum + parseFloat(row.sales_amount || 0), 0),
      salesCount: transactionsResult.rows.reduce((sum, row) => sum + parseInt(row.sales_count || 0), 0),
      salesQuantity: transactionsResult.rows.reduce((sum, row) => sum + parseFloat(row.sales_quantity || 0), 0),
      goodReturnsAmount: transactionsResult.rows.reduce((sum, row) => sum + parseFloat(row.good_returns_amount || 0), 0),
      goodReturnsCount: transactionsResult.rows.reduce((sum, row) => sum + parseInt(row.good_returns_count || 0), 0),
      goodReturnsQuantity: transactionsResult.rows.reduce((sum, row) => sum + parseFloat(row.good_returns_quantity || 0), 0),
      badReturnsAmount: transactionsResult.rows.reduce((sum, row) => sum + parseFloat(row.bad_returns_amount || 0), 0),
      badReturnsCount: transactionsResult.rows.reduce((sum, row) => sum + parseInt(row.bad_returns_count || 0), 0),
      badReturnsQuantity: transactionsResult.rows.reduce((sum, row) => sum + parseFloat(row.bad_returns_quantity || 0), 0),
      deliveryAmount: transactionsResult.rows.reduce((sum, row) => sum + parseFloat(row.delivery_amount || 0), 0),
      deliveryCount: transactionsResult.rows.reduce((sum, row) => sum + parseInt(row.delivery_count || 0), 0),
      deliveryQuantity: transactionsResult.rows.reduce((sum, row) => sum + parseFloat(row.delivery_quantity || 0), 0),
      netAmount: transactionsResult.rows.reduce((sum, row) => sum + parseFloat(row.net_amount || 0), 0)
    }

    return NextResponse.json({
      success: true,
      data: {
        customer: customerResult.rows[0] || null,
        currencyCode: currency,
        transactions: transactionsResult.rows.map(row => ({
          date: row.transaction_date,
          sales: {
            amount: parseFloat(row.sales_amount || 0),
            count: parseInt(row.sales_count || 0),
            quantity: parseFloat(row.sales_quantity || 0)
          },
          goodReturns: {
            amount: parseFloat(row.good_returns_amount || 0),
            count: parseInt(row.good_returns_count || 0),
            quantity: parseFloat(row.good_returns_quantity || 0)
          },
          badReturns: {
            amount: parseFloat(row.bad_returns_amount || 0),
            count: parseInt(row.bad_returns_count || 0),
            quantity: parseFloat(row.bad_returns_quantity || 0)
          },
          deliveries: {
            amount: parseFloat(row.delivery_amount || 0),
            count: parseInt(row.delivery_count || 0),
            quantity: parseFloat(row.delivery_quantity || 0)
          },
          netAmount: parseFloat(row.net_amount || 0),
          currencyCode: currency
        })),
        totals
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalDays / limit),
        totalCount: totalDays,
        pageSize: limit,
        hasNextPage: page < Math.ceil(totalDays / limit),
        hasPrevPage: page > 1
      }
    })

  } catch (error) {
    console.error('Customer daily transactions API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch customer daily transactions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
