import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check data availability for all tables used in APIs
    const tableChecks = [
      // Main transaction tables
      {
        name: 'flat_transactions',
        query: `SELECT COUNT(*) as total_records,
                       MIN(trx_date) as earliest_date,
                       MAX(trx_date) as latest_date,
                       COUNT(DISTINCT user_code) as unique_users,
                       COUNT(DISTINCT route_code) as unique_routes,
                       COUNT(DISTINCT client_code) as unique_customers
                FROM flat_transactions WHERE total_amount > 0`,
        apis_using: ['dashboard/kpi', 'dashboard/sales-trend', 'customers/top', 'transactions', 'routes/analysis', 'salesmen/performance', 'sales/analysis', 'sales/performance']
      },

      // Flat performance tables
      {
        name: 'flat_salesman_performance',
        query: `SELECT COUNT(*) as total_records,
                       MAX(last_updated) as latest_update,
                       COUNT(CASE WHEN total_sales_30d > 0 THEN 1 END) as active_salesmen
                FROM flat_salesman_performance`,
        apis_using: ['salesmen/performance (POTENTIAL)']
      },

      {
        name: 'flat_sales_trend_optimized',
        query: `SELECT COUNT(*) as total_records,
                       MIN(trend_date) as earliest_date,
                       MAX(trend_date) as latest_date,
                       AVG(sales) as avg_daily_sales
                FROM flat_sales_trend_optimized`,
        apis_using: ['dashboard/sales-trend (REPLACED)']
      },

      {
        name: 'flat_field_operations',
        query: `SELECT COUNT(*) as total_records,
                       MIN(operation_date) as earliest_date,
                       MAX(operation_date) as latest_date,
                       COUNT(DISTINCT usercode) as unique_users
                FROM flat_field_operations`,
        apis_using: ['field-operations/summary (REPLACED)']
      },

      {
        name: 'flat_route_analysis',
        query: `SELECT COUNT(*) as total_records,
                       COUNT(DISTINCT route_code) as unique_routes,
                       COUNT(CASE WHEN total_sales_30d > 0 THEN 1 END) as routes_with_sales,
                       SUM(total_sales_30d) as total_sales
                FROM flat_route_analysis`,
        apis_using: ['routes/analysis (POTENTIAL)']
      },

      {
        name: 'flat_dashboard_kpi',
        query: `SELECT COUNT(*) as total_records,
                       MIN(calculation_date) as earliest_date,
                       MAX(calculation_date) as latest_date
                FROM flat_dashboard_kpi`,
        apis_using: ['dashboard/kpi (POTENTIAL)']
      },

      {
        name: 'flat_product_sales',
        query: `SELECT COUNT(*) as total_records,
                       COUNT(CASE WHEN total_revenue > 0 THEN 1 END) as products_with_sales,
                       MAX(last_sale_date) as latest_sale
                FROM flat_product_sales`,
        apis_using: ['products/top', 'products/analytics', 'products/details']
      },

      // Source tables for field operations
      {
        name: 'tblcustomervisit',
        query: `SELECT COUNT(*) as total_records,
                       MIN(date) as earliest_date,
                       MAX(date) as latest_date,
                       COUNT(DISTINCT usercode) as unique_users
                FROM tblcustomervisit`,
        apis_using: ['field-operations/salesmen', 'field-operations/tracking', 'field-operations/visit-analytics', 'field-operations/journey-compliance', 'field-operations/time-motion']
      },

      {
        name: 'tbluser',
        query: `SELECT COUNT(*) as total_records,
                       COUNT(CASE WHEN username IS NOT NULL THEN 1 END) as users_with_names
                FROM tbluser`,
        apis_using: ['field-operations/salesmen', 'field-operations/tracking', 'field-operations/journey-compliance']
      },

      {
        name: 'tblcustomer',
        query: `SELECT COUNT(*) as total_records,
                       COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as customers_with_location
                FROM tblcustomer`,
        apis_using: ['field-operations/tracking', 'customers/analytics']
      },

      {
        name: 'tblroute',
        query: `SELECT COUNT(*) as total_records FROM tblroute`,
        apis_using: ['field-operations/salesmen', 'field-operations/tracking', 'routes/analysis']
      },

      {
        name: 'tbljourney',
        query: `SELECT COUNT(*) as total_records,
                       MIN(date) as earliest_date,
                       MAX(date) as latest_date
                FROM tbljourney`,
        apis_using: ['field-operations/summary (WAS USED)', 'field-operations/journey-compliance']
      },

      // Sales targets
      {
        name: 'flat_sales_targets',
        query: `SELECT COUNT(*) as total_records,
                       COUNT(DISTINCT target_period) as unique_periods
                FROM flat_sales_targets`,
        apis_using: ['targets/achievement']
      }
    ]

    const results = []

    for (const tableCheck of tableChecks) {
      try {
        const result = await db.query(tableCheck.query)
        results.push({
          table: tableCheck.name,
          data: result.rows[0],
          apis_using: tableCheck.apis_using,
          status: result.rows[0].total_records > 0 ? 'HAS_DATA' : 'EMPTY'
        })
      } catch (error) {
        results.push({
          table: tableCheck.name,
          data: null,
          apis_using: tableCheck.apis_using,
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Identify problematic APIs
    const emptyTables = results.filter(r => r.status === 'EMPTY')
    const errorTables = results.filter(r => r.status === 'ERROR')

    const problematicAPIs = []
    emptyTables.forEach(table => {
      table.apis_using.forEach(api => {
        if (!api.includes('POTENTIAL') && !api.includes('WAS USED')) {
          problematicAPIs.push({
            api,
            issue: `Uses empty table: ${table.table}`,
            severity: 'HIGH'
          })
        }
      })
    })

    return NextResponse.json({
      success: true,
      summary: {
        total_tables_checked: tableChecks.length,
        tables_with_data: results.filter(r => r.status === 'HAS_DATA').length,
        empty_tables: emptyTables.length,
        error_tables: errorTables.length,
        problematic_apis: problematicAPIs.length
      },
      table_analysis: results,
      problematic_apis: problematicAPIs,
      recommendations: {
        empty_tables: emptyTables.map(t => ({
          table: t.table,
          affected_apis: t.apis_using.filter(api => !api.includes('POTENTIAL')),
          recommendation: `Fix data pipeline for ${t.table} or replace with alternative table`
        })),
        safe_tables: results.filter(r => r.status === 'HAS_DATA').map(t => t.table)
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('API analysis error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze APIs',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}