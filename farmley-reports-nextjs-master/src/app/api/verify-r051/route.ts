import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Get exact R051 transaction data for this month
    const transactionQuery = `
      SELECT
        route_code,
        salesman_code,
        salesman_name,
        SUM(total_amount) as total_sales,
        COUNT(DISTINCT trx_code) as total_orders,
        COUNT(DISTINCT customer_code) as purchasing_customers,
        AVG(total_amount) as avg_order_value
      FROM new_flat_transactions t
      WHERE route_code = 'R051'
        AND trx_date_only >= date_trunc('month', CURRENT_DATE)
      GROUP BY route_code, salesman_code, salesman_name
    `
    const transactionResult = await db.query(transactionQuery)

    // Get exact R051 visit data for this month by salesman_code
    const visitQuery = `
      SELECT
        cv.salesman_code,
        t.route_code,
        t.salesman_name,
        COUNT(DISTINCT cv.customer_code) as visited_customers,
        COUNT(*) as total_visits,
        SUM(CASE WHEN cv.is_productive = true THEN 1 ELSE 0 END) as productive_visits,
        AVG(cv.duration_minutes) as avg_visit_duration
      FROM new_flat_customer_visits cv
      INNER JOIN (
        SELECT DISTINCT salesman_code, route_code, salesman_name
        FROM new_flat_transactions
        WHERE route_code = 'R051'
      ) t ON cv.salesman_code = t.salesman_code
      WHERE cv.visit_date >= date_trunc('month', CURRENT_DATE)
      GROUP BY cv.salesman_code, t.route_code, t.salesman_name
    `
    const visitResult = await db.query(visitQuery)

    // Combined result showing exact data
    const combinedQuery = `
      WITH route_transactions AS (
        SELECT
          route_code,
          salesman_code,
          salesman_name,
          SUM(total_amount) as total_sales,
          COUNT(DISTINCT trx_code) as total_orders,
          COUNT(DISTINCT customer_code) as purchasing_customers,
          AVG(total_amount) as avg_order_value
        FROM new_flat_transactions t
        WHERE route_code = 'R051'
          AND trx_date_only >= date_trunc('month', CURRENT_DATE)
        GROUP BY route_code, salesman_code, salesman_name
      ),
      route_visits AS (
        SELECT
          t.route_code,
          cv.salesman_code,
          t.salesman_name,
          COUNT(DISTINCT cv.customer_code) as visited_customers,
          COUNT(*) as total_visits,
          SUM(CASE WHEN cv.is_productive = true THEN 1 ELSE 0 END) as productive_visits,
          AVG(cv.duration_minutes) as avg_visit_duration
        FROM new_flat_customer_visits cv
        INNER JOIN (
          SELECT DISTINCT salesman_code, route_code, salesman_name
          FROM new_flat_transactions
          WHERE route_code = 'R051'
        ) t ON cv.salesman_code = t.salesman_code
        WHERE cv.visit_date >= date_trunc('month', CURRENT_DATE)
        GROUP BY t.route_code, cv.salesman_code, t.salesman_name
      )
      SELECT
        COALESCE(rt.route_code, rv.route_code) as route_code,
        COALESCE(rt.salesman_code, rv.salesman_code) as salesman_code,
        COALESCE(rt.salesman_name, rv.salesman_name) as salesman_name,
        COALESCE(rt.total_sales, 0) as total_sales,
        COALESCE(rt.total_orders, 0) as total_orders,
        COALESCE(rt.purchasing_customers, 0) as purchasing_customers,
        COALESCE(rt.avg_order_value, 0) as avg_order_value,
        COALESCE(rv.visited_customers, 0) as visited_customers,
        COALESCE(rv.total_visits, 0) as total_visits,
        COALESCE(rv.productive_visits, 0) as productive_visits,
        COALESCE(rv.avg_visit_duration, 0) as avg_visit_duration,
        -- Calculate real productivity percentage
        CASE
          WHEN COALESCE(rv.total_visits, 0) > 0 THEN
            ROUND((COALESCE(rv.productive_visits, 0)::numeric / rv.total_visits) * 100, 1)
          ELSE 0
        END as productivity_percentage
      FROM route_transactions rt
      FULL OUTER JOIN route_visits rv ON rt.salesman_code = rv.salesman_code
    `
    const combinedResult = await db.query(combinedQuery)

    return NextResponse.json({
      success: true,
      exact_data: {
        transaction_data: transactionResult.rows,
        visit_data: visitResult.rows,
        combined_real_data: combinedResult.rows
      }
    })
  } catch (error) {
    console.error('R051 verification error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}