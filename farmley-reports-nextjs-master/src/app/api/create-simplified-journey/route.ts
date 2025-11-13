import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    await db.initialize()

    // Create simplified flat_customer_journey using only visit and sales data
    const createQuery = `
      DROP TABLE IF EXISTS flat_customer_journey CASCADE;

      CREATE TABLE flat_customer_journey AS
      WITH visit_data AS (
        -- Get actual visit data for August 2025
        SELECT
          cv.usercode as salesman_code,
          cv.routecode as route_code,
          cv.clientcode as customer_code,
          DATE(cv.date) as activity_date,
          cv.checkin,
          cv.checkout,
          cv.latitude,
          cv.longitude,
          CASE
            WHEN cv.checkout IS NOT NULL AND cv.checkin IS NOT NULL
            THEN EXTRACT(EPOCH FROM (cv.checkout - cv.checkin))/60
            ELSE 0
          END as visit_duration_minutes
        FROM tblcustomervisit cv
        WHERE cv.date >= '2025-08-01' AND cv.date < '2025-09-01'
          AND cv.usercode IS NOT NULL
          AND cv.clientcode IS NOT NULL
      ),
      sales_data AS (
        -- Get sales data from flat_transactions for August 2025
        SELECT
          user_code as salesman_code,
          route_code,
          client_code as customer_code,
          DATE(trx_date) as activity_date,
          SUM(total_amount) as day_sales,
          COUNT(DISTINCT trx_code) as day_orders,
          AVG(total_amount) as avg_order_value,
          MAX(total_amount) as max_order_value
        FROM flat_transactions
        WHERE trx_date >= '2025-08-01' AND trx_date < '2025-09-01'
          AND user_code IS NOT NULL
          AND client_code IS NOT NULL
        GROUP BY user_code, route_code, client_code, DATE(trx_date)
      )
      SELECT
        COALESCE(v.salesman_code, s.salesman_code) as salesman_code,
        COALESCE(v.route_code, s.route_code) as route_code,
        COALESCE(v.customer_code, s.customer_code) as customer_code,
        COALESCE(v.activity_date, s.activity_date) as activity_date,

        -- Visit details
        v.checkin as check_in_time,
        v.checkout as check_out_time,
        v.visit_duration_minutes,
        v.latitude as visit_latitude,
        v.longitude as visit_longitude,
        CASE WHEN v.customer_code IS NOT NULL THEN true ELSE false END as was_visited,

        -- Sales results
        COALESCE(s.day_sales, 0) as sales_amount,
        COALESCE(s.day_orders, 0) as order_count,
        COALESCE(s.avg_order_value, 0) as avg_order_value,
        COALESCE(s.max_order_value, 0) as max_order_value,
        CASE WHEN s.day_sales > 0 THEN true ELSE false END as was_productive,

        -- Activity classification
        CASE
          WHEN v.customer_code IS NOT NULL AND s.day_sales > 0 THEN 'Productive Visit'
          WHEN v.customer_code IS NOT NULL AND s.day_sales = 0 THEN 'Non-Productive Visit'
          WHEN v.customer_code IS NULL AND s.day_sales > 0 THEN 'Direct Sale (No Visit)'
          ELSE 'No Activity'
        END as activity_type,

        -- Performance classification
        CASE
          WHEN s.day_sales > 10000 THEN 'High Value'
          WHEN s.day_sales > 1000 THEN 'Medium Value'
          WHEN s.day_sales > 0 THEN 'Low Value'
          ELSE 'No Sale'
        END as value_category,

        -- Visit duration classification
        CASE
          WHEN v.visit_duration_minutes > 60 THEN 'Long Visit (>60 min)'
          WHEN v.visit_duration_minutes > 30 THEN 'Normal Visit (30-60 min)'
          WHEN v.visit_duration_minutes > 15 THEN 'Quick Visit (15-30 min)'
          WHEN v.visit_duration_minutes > 0 THEN 'Very Quick (<15 min)'
          ELSE 'No Visit Data'
        END as visit_duration_category,

        -- Productivity metrics
        CASE
          WHEN v.visit_duration_minutes > 0 AND s.day_sales > 0
          THEN ROUND((s.day_sales / v.visit_duration_minutes)::numeric, 2)
          ELSE 0
        END as sales_per_minute,

        CURRENT_TIMESTAMP as last_updated
      FROM visit_data v
      FULL OUTER JOIN sales_data s
        ON v.salesman_code = s.salesman_code
        AND v.customer_code = s.customer_code
        AND v.activity_date = s.activity_date
      WHERE COALESCE(v.activity_date, s.activity_date) IS NOT NULL;

      -- Create highly optimized indexes for ultra-fast queries
      CREATE INDEX idx_fcj_salesman_date ON flat_customer_journey(salesman_code, activity_date DESC);
      CREATE INDEX idx_fcj_route_date ON flat_customer_journey(route_code, activity_date DESC);
      CREATE INDEX idx_fcj_customer_date ON flat_customer_journey(customer_code, activity_date DESC);
      CREATE INDEX idx_fcj_activity ON flat_customer_journey(activity_type, activity_date DESC);
      CREATE INDEX idx_fcj_productive ON flat_customer_journey(was_productive, sales_amount DESC);
      CREATE INDEX idx_fcj_date ON flat_customer_journey(activity_date DESC);
      CREATE INDEX idx_fcj_value ON flat_customer_journey(value_category, sales_amount DESC);

      -- Covering index for dashboard queries
      CREATE INDEX idx_fcj_dashboard ON flat_customer_journey(
        activity_date DESC,
        was_productive,
        sales_amount,
        salesman_code,
        customer_code
      );
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
        SUM(CASE WHEN was_productive THEN 1 ELSE 0 END) as productive_activities,
        SUM(CASE WHEN was_visited THEN 1 ELSE 0 END) as total_visits,
        SUM(sales_amount) as total_sales,
        AVG(CASE WHEN visit_duration_minutes > 0 THEN visit_duration_minutes END) as avg_visit_duration,
        MAX(sales_amount) as max_single_sale
      FROM flat_customer_journey
    `
    const verifyResult = await db.query(verifyQuery)

    // Get activity type breakdown
    const activityQuery = `
      SELECT
        activity_type,
        COUNT(*) as count,
        SUM(sales_amount) as total_sales,
        AVG(CASE WHEN sales_amount > 0 THEN sales_amount END) as avg_sale
      FROM flat_customer_journey
      GROUP BY activity_type
      ORDER BY count DESC
    `
    const activityResult = await db.query(activityQuery)

    // Get value category breakdown
    const valueQuery = `
      SELECT
        value_category,
        COUNT(*) as count,
        SUM(sales_amount) as total_sales
      FROM flat_customer_journey
      GROUP BY value_category
      ORDER BY
        CASE value_category
          WHEN 'High Value' THEN 1
          WHEN 'Medium Value' THEN 2
          WHEN 'Low Value' THEN 3
          ELSE 4
        END
    `
    const valueResult = await db.query(valueQuery)

    return NextResponse.json({
      success: true,
      table: 'flat_customer_journey',
      statistics: verifyResult.rows[0],
      activity_breakdown: activityResult.rows,
      value_breakdown: valueResult.rows,
      message: `✅ Successfully created flat_customer_journey with ${verifyResult.rows[0].total_records} records!`,
      details: {
        unique_salesmen: verifyResult.rows[0].unique_salesmen,
        unique_customers: verifyResult.rows[0].unique_customers,
        productive_rate: Math.round((verifyResult.rows[0].productive_activities / verifyResult.rows[0].total_records) * 100) + '%',
        total_sales: 'AED ' + Math.round(verifyResult.rows[0].total_sales).toLocaleString()
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