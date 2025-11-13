import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    await db.initialize()

    // Create basic flat_customer_journey using only flat_transactions data
    // This ensures we have at least this critical optimization table
    const createQuery = `
      DROP TABLE IF EXISTS flat_customer_journey CASCADE;

      CREATE TABLE flat_customer_journey AS
      WITH daily_activity AS (
        -- Aggregate daily activity per salesman-customer combination
        SELECT
          user_code as salesman_code,
          route_code,
          client_code as customer_code,
          DATE(trx_date) as activity_date,
          SUM(total_amount) as sales_amount,
          COUNT(DISTINCT trx_code) as order_count,
          AVG(total_amount) as avg_order_value,
          MAX(total_amount) as max_order_value,
          MIN(total_amount) as min_order_value,
          COUNT(*) as transaction_count
        FROM flat_transactions
        WHERE trx_date >= '2025-08-01' AND trx_date < '2025-09-01'
          AND user_code IS NOT NULL
          AND client_code IS NOT NULL
          AND total_amount > 0
        GROUP BY user_code, route_code, client_code, DATE(trx_date)
      )
      SELECT
        salesman_code,
        route_code,
        customer_code,
        activity_date,

        -- Sales metrics
        sales_amount,
        order_count,
        transaction_count,
        avg_order_value,
        max_order_value,
        min_order_value,

        -- Performance classification
        CASE
          WHEN sales_amount > 10000 THEN 'High Value'
          WHEN sales_amount > 5000 THEN 'Medium-High Value'
          WHEN sales_amount > 1000 THEN 'Medium Value'
          WHEN sales_amount > 500 THEN 'Low-Medium Value'
          ELSE 'Low Value'
        END as value_category,

        -- Order size classification
        CASE
          WHEN avg_order_value > 5000 THEN 'Large Orders'
          WHEN avg_order_value > 1000 THEN 'Medium Orders'
          ELSE 'Small Orders'
        END as order_size_category,

        -- Day of week analysis
        EXTRACT(DOW FROM activity_date) as day_of_week,
        TO_CHAR(activity_date, 'Day') as day_name,

        CURRENT_TIMESTAMP as last_updated
      FROM daily_activity;

      -- Create highly optimized indexes
      CREATE INDEX idx_fcj_salesman_date ON flat_customer_journey(salesman_code, activity_date DESC);
      CREATE INDEX idx_fcj_route_date ON flat_customer_journey(route_code, activity_date DESC);
      CREATE INDEX idx_fcj_customer_date ON flat_customer_journey(customer_code, activity_date DESC);
      CREATE INDEX idx_fcj_date ON flat_customer_journey(activity_date DESC);
      CREATE INDEX idx_fcj_value ON flat_customer_journey(value_category, sales_amount DESC);
      CREATE INDEX idx_fcj_sales ON flat_customer_journey(sales_amount DESC);

      -- Composite indexes for common queries
      CREATE INDEX idx_fcj_salesman_customer ON flat_customer_journey(salesman_code, customer_code, activity_date DESC);
      CREATE INDEX idx_fcj_route_value ON flat_customer_journey(route_code, value_category, sales_amount DESC);
    `

    await db.query(createQuery)

    // Verify the created table
    const verifyQuery = `
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT salesman_code) as unique_salesmen,
        COUNT(DISTINCT customer_code) as unique_customers,
        COUNT(DISTINCT route_code) as unique_routes,
        COUNT(DISTINCT activity_date) as days_with_activity,
        SUM(sales_amount) as total_sales,
        AVG(sales_amount) as avg_daily_sales,
        MAX(sales_amount) as max_daily_sales,
        SUM(order_count) as total_orders
      FROM flat_customer_journey
    `
    const verifyResult = await db.query(verifyQuery)

    // Get value category breakdown
    const valueQuery = `
      SELECT
        value_category,
        COUNT(*) as activities,
        SUM(sales_amount) as total_sales,
        AVG(sales_amount) as avg_sale
      FROM flat_customer_journey
      GROUP BY value_category
      ORDER BY
        CASE value_category
          WHEN 'High Value' THEN 1
          WHEN 'Medium-High Value' THEN 2
          WHEN 'Medium Value' THEN 3
          WHEN 'Low-Medium Value' THEN 4
          ELSE 5
        END
    `
    const valueResult = await db.query(valueQuery)

    // Get day of week analysis
    const dayQuery = `
      SELECT
        day_name,
        COUNT(*) as activities,
        SUM(sales_amount) as total_sales,
        AVG(sales_amount) as avg_sale
      FROM flat_customer_journey
      GROUP BY day_name, day_of_week
      ORDER BY day_of_week
    `
    const dayResult = await db.query(dayQuery)

    return NextResponse.json({
      success: true,
      table: 'flat_customer_journey',
      statistics: verifyResult.rows[0],
      value_breakdown: valueResult.rows,
      day_of_week_analysis: dayResult.rows,
      message: `✅ Successfully created flat_customer_journey with ${verifyResult.rows[0].total_records} activity records!`,
      details: {
        unique_salesmen: verifyResult.rows[0].unique_salesmen,
        unique_customers: verifyResult.rows[0].unique_customers,
        unique_routes: verifyResult.rows[0].unique_routes,
        days_covered: verifyResult.rows[0].days_with_activity,
        total_sales: 'AED ' + Math.round(verifyResult.rows[0].total_sales).toLocaleString(),
        total_orders: verifyResult.rows[0].total_orders
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error creating flat_customer_journey:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create flat_customer_journey',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}