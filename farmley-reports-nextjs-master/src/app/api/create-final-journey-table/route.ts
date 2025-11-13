import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    await db.initialize()

    // First, check what columns actually exist in tbljourney
    const checkColumnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'tbljourney'
        AND table_schema = 'public'
      ORDER BY ordinal_position
    `
    const columnsResult = await db.query(checkColumnsQuery)
    console.log('Available tbljourney columns:', columnsResult.rows.map(r => r.column_name))

    // Now create the table using only existing columns
    const createQuery = `
      DROP TABLE IF EXISTS flat_customer_journey CASCADE;

      CREATE TABLE flat_customer_journey AS
      WITH journey_base AS (
        -- Get journey data with whatever columns exist
        SELECT DISTINCT
          j.usercode,
          j.clientcode,
          DATE(j.date) as journey_date
        FROM tbljourney j
        WHERE j.date >= '2025-08-01' AND j.date < '2025-09-01'
          AND j.usercode IS NOT NULL
          AND j.clientcode IS NOT NULL
      ),
      visit_data AS (
        -- Get actual visit data
        SELECT
          cv.usercode,
          cv.routecode,
          cv.clientcode,
          DATE(cv.date) as visit_date,
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
        -- Get sales data from flat_transactions
        SELECT
          user_code as usercode,
          route_code as routecode,
          client_code as clientcode,
          DATE(trx_date) as sale_date,
          SUM(total_amount) as day_sales,
          COUNT(DISTINCT trx_code) as day_orders,
          AVG(total_amount) as avg_order_value
        FROM flat_transactions
        WHERE trx_date >= '2025-08-01' AND trx_date < '2025-09-01'
          AND user_code IS NOT NULL
          AND client_code IS NOT NULL
        GROUP BY user_code, route_code, client_code, DATE(trx_date)
      )
      SELECT
        COALESCE(j.usercode, v.usercode, s.usercode) as salesman_code,
        COALESCE(v.routecode, s.routecode) as route_code,
        COALESCE(j.clientcode, v.clientcode, s.clientcode) as customer_code,
        COALESCE(j.journey_date, v.visit_date, s.sale_date) as activity_date,

        -- Journey plan status
        CASE WHEN j.clientcode IS NOT NULL THEN true ELSE false END as was_planned,

        -- Visit execution details
        v.checkin as actual_checkin,
        v.checkout as actual_checkout,
        v.visit_duration_minutes,
        v.latitude as visit_latitude,
        v.longitude as visit_longitude,
        CASE WHEN v.clientcode IS NOT NULL THEN true ELSE false END as was_visited,

        -- Sales results
        COALESCE(s.day_sales, 0) as sales_amount,
        COALESCE(s.day_orders, 0) as order_count,
        COALESCE(s.avg_order_value, 0) as avg_order_value,
        CASE WHEN s.day_sales > 0 THEN true ELSE false END as was_productive,

        -- Compliance metrics
        CASE
          WHEN j.clientcode IS NOT NULL AND v.clientcode IS NOT NULL AND s.day_sales > 0 THEN 'Completed Productive'
          WHEN j.clientcode IS NOT NULL AND v.clientcode IS NOT NULL THEN 'Completed'
          WHEN j.clientcode IS NOT NULL AND v.clientcode IS NULL THEN 'Missed'
          WHEN j.clientcode IS NULL AND v.clientcode IS NOT NULL AND s.day_sales > 0 THEN 'Unplanned Productive'
          WHEN j.clientcode IS NULL AND v.clientcode IS NOT NULL THEN 'Unplanned'
          WHEN j.clientcode IS NULL AND v.clientcode IS NULL AND s.day_sales > 0 THEN 'Direct Sale'
          ELSE 'No Activity'
        END as compliance_status,

        -- Performance classification
        CASE
          WHEN s.day_sales > 10000 THEN 'High Value'
          WHEN s.day_sales > 1000 THEN 'Medium Value'
          WHEN s.day_sales > 0 THEN 'Low Value'
          WHEN v.clientcode IS NOT NULL THEN 'Non-Productive Visit'
          WHEN j.clientcode IS NOT NULL THEN 'Missed Visit'
          ELSE 'No Activity'
        END as visit_value_category,

        -- Additional metrics
        CASE
          WHEN v.visit_duration_minutes > 60 THEN 'Long Visit'
          WHEN v.visit_duration_minutes > 30 THEN 'Normal Visit'
          WHEN v.visit_duration_minutes > 0 THEN 'Quick Visit'
          ELSE 'No Visit'
        END as visit_duration_category,

        CURRENT_TIMESTAMP as last_updated
      FROM journey_base j
      FULL OUTER JOIN visit_data v
        ON j.usercode = v.usercode
        AND j.clientcode = v.clientcode
        AND j.journey_date = v.visit_date
      FULL OUTER JOIN sales_data s
        ON COALESCE(j.usercode, v.usercode) = s.usercode
        AND COALESCE(j.clientcode, v.clientcode) = s.clientcode
        AND COALESCE(j.journey_date, v.visit_date) = s.sale_date
      WHERE COALESCE(j.journey_date, v.visit_date, s.sale_date) >= '2025-08-01'
        AND COALESCE(j.journey_date, v.visit_date, s.sale_date) < '2025-09-01';

      -- Create highly optimized indexes for lightning-fast queries
      CREATE INDEX idx_fcj_salesman_date ON flat_customer_journey(salesman_code, activity_date DESC);
      CREATE INDEX idx_fcj_route_date ON flat_customer_journey(route_code, activity_date DESC);
      CREATE INDEX idx_fcj_customer_date ON flat_customer_journey(customer_code, activity_date DESC);
      CREATE INDEX idx_fcj_compliance ON flat_customer_journey(compliance_status, activity_date DESC);
      CREATE INDEX idx_fcj_productive ON flat_customer_journey(was_productive, sales_amount DESC);
      CREATE INDEX idx_fcj_date ON flat_customer_journey(activity_date DESC);
      CREATE INDEX idx_fcj_value ON flat_customer_journey(visit_value_category, sales_amount DESC);
    `

    await db.query(createQuery)

    // Verify the created table
    const verifyQuery = `
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT salesman_code) as unique_salesmen,
        COUNT(DISTINCT customer_code) as unique_customers,
        COUNT(DISTINCT route_code) as unique_routes,
        SUM(CASE WHEN was_productive THEN 1 ELSE 0 END) as productive_activities,
        SUM(CASE WHEN was_visited THEN 1 ELSE 0 END) as total_visits,
        SUM(CASE WHEN was_planned THEN 1 ELSE 0 END) as planned_journeys,
        SUM(sales_amount) as total_sales,
        AVG(CASE WHEN visit_duration_minutes > 0 THEN visit_duration_minutes END) as avg_visit_duration
      FROM flat_customer_journey
    `
    const verifyResult = await db.query(verifyQuery)

    // Check compliance rates
    const complianceQuery = `
      SELECT
        compliance_status,
        COUNT(*) as count,
        SUM(sales_amount) as sales
      FROM flat_customer_journey
      GROUP BY compliance_status
      ORDER BY count DESC
    `
    const complianceResult = await db.query(complianceQuery)

    return NextResponse.json({
      success: true,
      table: 'flat_customer_journey',
      statistics: verifyResult.rows[0],
      compliance_breakdown: complianceResult.rows,
      message: `Successfully created flat_customer_journey with ${verifyResult.rows[0].total_records} records`,
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