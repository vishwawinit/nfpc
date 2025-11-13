import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerCode = searchParams.get('customerCode')
    const date = searchParams.get('date')
    const regionCode = searchParams.get('regionCode')
    const routeCode = searchParams.get('routeCode')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!customerCode || !date) {
      return NextResponse.json({
        success: false,
        error: 'Customer code and date are required'
      }, { status: 400 })
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit

    // Get customer info
    const customerInfoQuery = `
      SELECT
        store_code as customer_code,
        MAX(store_name) as customer_name,
        MAX(user_route_code) as territory,
        MAX(region_code) as region,
        MAX(city_code) as city,
        'Active' as status
      FROM flat_sales_transactions
      WHERE store_code = $1
      GROUP BY store_code
      LIMIT 1
    `
    const customerInfoResult = await query(customerInfoQuery, [customerCode])
    
    if (customerInfoResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Customer not found'
      }, { status: 404 })
    }

    const customerInfo = customerInfoResult.rows[0]

    // Get historical summary (all-time data for this customer)
    const historicalSummaryQuery = `
      SELECT
        SUM(CASE WHEN trx_type = 1 THEN net_amount ELSE 0 END) as total_invoices,
        COUNT(DISTINCT CASE WHEN trx_type = 1 THEN trx_code END) as invoice_count,
        'AED' as currency_code
      FROM flat_sales_transactions
      WHERE store_code = $1
    `
    const historicalSummaryResult = await query(historicalSummaryQuery, [customerCode])
    const historicalSummary = historicalSummaryResult.rows[0]

    // Get selected date activity
    const selectedDateQuery = `
      SELECT
        SUM(CASE WHEN trx_type = 1 THEN net_amount ELSE 0 END) as invoices_amount,
        COUNT(DISTINCT CASE WHEN trx_type = 1 THEN trx_code END) as invoices_count,
        'AED' as currency_code
      FROM flat_sales_transactions
      WHERE store_code = $1 AND trx_date_only = $2
    `
    const selectedDateResult = await query(selectedDateQuery, [customerCode, date])
    const selectedDateSummary = selectedDateResult.rows[0]

    // Get transactions for selected date
    const transactionsQuery = `
      SELECT
        trx_code as transaction_code,
        trx_type as type,
        product_code,
        product_name,
        quantity,
        unit_price,
        net_amount as amount,
        user_route_code as route,
        field_user_code as salesman,
        trx_date_only as transaction_date,
        'AED' as currency_code
      FROM flat_sales_transactions
      WHERE store_code = $1 AND trx_date_only = $2
      ORDER BY trx_code, line_number
      LIMIT $3 OFFSET $4
    `

    const transactionsResult = await query(transactionsQuery, [customerCode, date, limit, offset])

    // Get total transaction count for pagination
    const transactionCountQuery = `
      SELECT COUNT(*) as total_count
      FROM flat_sales_transactions
      WHERE store_code = $1 AND trx_date_only = $2
    `
    const transactionCountResult = await query(transactionCountQuery, [customerCode, date])
    const totalTransactions = parseInt(transactionCountResult.rows[0].total_count || '0')

    // Format transaction data
    const transactions = transactionsResult.rows.map(transaction => ({
      transactionCode: transaction.transaction_code,
      type: transaction.type === 1 ? 'Invoice' : 'Other',
      productCode: transaction.product_code,
      productName: transaction.product_name,
      quantity: parseInt(transaction.quantity || '0'),
      unitPrice: parseFloat(transaction.unit_price || '0'),
      amount: parseFloat(transaction.amount || '0'),
      route: transaction.route,
      salesman: transaction.salesman,
      transactionDate: transaction.transaction_date,
      currencyCode: transaction.currency_code || 'AED'
    }))

    // Get purchase aging pattern (last 90 days)
    const agingPatternQuery = `
      WITH daily_sales AS (
        SELECT
          trx_date_only,
          SUM(CASE WHEN trx_type = 1 THEN net_amount ELSE 0 END) as daily_amount
        FROM flat_sales_transactions
        WHERE store_code = $1
          AND trx_date_only >= CURRENT_DATE - INTERVAL '90 days'
          AND trx_date_only <= CURRENT_DATE
        GROUP BY trx_date_only
        ORDER BY trx_date_only DESC
      ),
      aging_buckets AS (
        SELECT
          CASE
            WHEN trx_date_only >= CURRENT_DATE - INTERVAL '30 days' THEN '0-30 days ago'
            WHEN trx_date_only >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60 days ago'
            WHEN trx_date_only >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90 days ago'
            ELSE '90+ days ago'
          END as aging_bucket,
          SUM(daily_amount) as bucket_amount
        FROM daily_sales
        GROUP BY aging_bucket
      )
      SELECT aging_bucket, bucket_amount
      FROM aging_buckets
      ORDER BY 
        CASE aging_bucket
          WHEN '0-30 days ago' THEN 1
          WHEN '31-60 days ago' THEN 2
          WHEN '61-90 days ago' THEN 3
          WHEN '90+ days ago' THEN 4
        END
    `
    const agingPatternResult = await query(agingPatternQuery, [customerCode])
    const agingPattern = agingPatternResult.rows.map(row => ({
      period: row.aging_bucket,
      amount: parseFloat(row.bucket_amount || '0')
    }))

      return NextResponse.json({
        success: true,
        data: {
        customerInfo: {
          customerCode: customerInfo.customer_code,
          customerName: customerInfo.customer_name,
          territory: customerInfo.territory,
          channel: customerInfo.channel,
          region: customerInfo.region,
          city: customerInfo.city,
          status: customerInfo.status
        },
          historicalSummary: {
          totalInvoices: parseFloat(historicalSummary.total_invoices || '0'),
          invoiceCount: parseInt(historicalSummary.invoice_count || '0'),
          currencyCode: historicalSummary.currency_code || 'AED'
        },
          selectedDateSummary: {
          invoicesAmount: parseFloat(selectedDateSummary.invoices_amount || '0'),
          invoicesCount: parseInt(selectedDateSummary.invoices_count || '0'),
          currencyCode: selectedDateSummary.currency_code || 'AED'
        },
        transactions: {
          data: transactions,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalTransactions / limit),
            totalCount: totalTransactions,
            pageSize: limit,
            hasNextPage: page < Math.ceil(totalTransactions / limit),
            hasPrevPage: page > 1
          }
        },
        agingPattern
      },
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table'
    })

  } catch (error) {
    console.error('Customer day-wise ledger API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch customer day-wise ledger',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}