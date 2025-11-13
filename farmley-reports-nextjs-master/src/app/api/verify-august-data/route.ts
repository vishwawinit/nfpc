import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // 1. Check flat_dashboard_kpi for August 2025 data
    const dashboardKpiQuery = `
      SELECT
        calculation_date,
        DATE(calculation_date) as date_only,
        today_sales,
        today_orders,
        today_customers,
        growth_percentage,
        mtd_sales,
        ytd_sales,
        last_updated
      FROM flat_dashboard_kpi
      WHERE DATE(calculation_date) >= '2025-08-01'
        AND DATE(calculation_date) <= '2025-08-31'
      ORDER BY calculation_date
    `

    // 2. Check flat_salesman_performance for August 2025 data
    const salesmanPerfQuery = `
      SELECT
        COUNT(*) as total_records,
        MIN(last_updated) as earliest_update,
        MAX(last_updated) as latest_update,
        COUNT(CASE WHEN total_sales_30d > 0 THEN 1 END) as salesmen_with_sales,
        SUM(total_sales_30d) as total_sales_sum
      FROM flat_salesman_performance
      WHERE last_updated >= '2025-08-01'
        OR total_sales_30d > 0
    `

    // 3. Check flat_route_analysis for August 2025 data
    const routeAnalysisQuery = `
      SELECT
        COUNT(*) as total_routes,
        COUNT(DISTINCT route_code) as unique_route_codes,
        COUNT(CASE WHEN route_code = 'UNASSIGNED' THEN 1 END) as unassigned_routes,
        COUNT(CASE WHEN total_sales_30d > 0 THEN 1 END) as routes_with_sales,
        SUM(total_sales_30d) as total_sales_sum,
        array_agg(DISTINCT route_code ORDER BY route_code) FILTER (WHERE route_code IS NOT NULL) as sample_route_codes
      FROM flat_route_analysis
    `

    // 4. For comparison - check actual transaction data for August 2025
    const transactionDataQuery = `
      SELECT
        COUNT(*) as total_transactions,
        COUNT(DISTINCT user_code) as unique_salesmen,
        COUNT(DISTINCT route_code) as unique_routes,
        SUM(total_amount) as total_sales,
        MIN(trx_date) as earliest_date,
        MAX(trx_date) as latest_date
      FROM flat_transactions
      WHERE DATE(trx_date) >= '2025-08-01'
        AND DATE(trx_date) <= '2025-08-31'
        AND total_amount > 0
    `

    const [dashboardResult, salesmanResult, routeResult, transactionResult] = await Promise.all([
      db.query(dashboardKpiQuery),
      db.query(salesmanPerfQuery),
      db.query(routeAnalysisQuery),
      db.query(transactionDataQuery)
    ])

    return NextResponse.json({
      success: true,
      august2025Analysis: {
        dashboardKpi: {
          recordCount: dashboardResult.rows.length,
          records: dashboardResult.rows,
          issue: dashboardResult.rows.length === 0 ? "No August 2025 data found" : "Limited data available"
        },
        salesmanPerformance: {
          summary: salesmanResult.rows[0],
          issue: salesmanResult.rows[0].total_records === "0" ? "Table is completely empty" : "Some data exists"
        },
        routeAnalysis: {
          summary: routeResult.rows[0],
          issue: routeResult.rows[0].unique_route_codes === "1" && routeResult.rows[0].sample_route_codes[0] === "UNASSIGNED"
            ? "All routes aggregated into UNASSIGNED instead of individual routes"
            : "Route data looks normal"
        },
        actualTransactionData: {
          summary: transactionResult.rows[0],
          note: "This is the real August 2025 data for comparison"
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('August 2025 verification error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to verify August 2025 data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}