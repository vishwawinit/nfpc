import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    await db.initialize()

    const results = {
      deleted_tables: [],
      created_tables: [],
      errors: []
    }

    // STEP 1: Delete problematic tables
    console.log('Step 1: Deleting problematic tables...')

    const tablesToDelete = [
      'flat_route_analysis',
      'flat_dashboard_kpi',
      'flat_salesman_performance'
    ]

    for (const table of tablesToDelete) {
      try {
        await db.query(`DROP TABLE IF EXISTS ${table} CASCADE`)
        results.deleted_tables.push(table)
        console.log(`✅ Deleted: ${table}`)
      } catch (error) {
        results.errors.push(`Failed to delete ${table}: ${error}`)
      }
    }

    // STEP 2: Create new highly optimized flat tables with real data

    // 1. Create flat_customer_journey - HIGHLY OPTIMIZED
    console.log('Creating flat_customer_journey...')
    try {
      const createCustomerJourneyQuery = `
        DROP TABLE IF EXISTS flat_customer_journey CASCADE;

        CREATE TABLE flat_customer_journey AS
        WITH journey_data AS (
          -- Get journey plan data
          SELECT
            j.usercode,
            j.routecode,
            j.clientcode,
            j.date as journey_date,
            j.sequence as planned_sequence,
            j.visittype
          FROM tbljourney j
          WHERE j.date >= '2025-08-01' AND j.date < '2025-09-01'
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
            EXTRACT(EPOCH FROM (cv.checkout - cv.checkin))/60 as visit_duration_minutes
          FROM tblcustomervisit cv
          WHERE cv.date >= '2025-08-01' AND cv.date < '2025-09-01'
        ),
        sales_data AS (
          -- Get sales data
          SELECT
            th.usercode,
            th.clientcode,
            DATE(th.trxdate) as sale_date,
            SUM(th.totalamount) as day_sales,
            COUNT(DISTINCT th.trxcode) as day_orders
          FROM tbltrxheader th
          WHERE th.trxdate >= '2025-08-01' AND th.trxdate < '2025-09-01'
          GROUP BY th.usercode, th.clientcode, DATE(th.trxdate)
        )
        SELECT
          COALESCE(j.usercode, v.usercode) as salesman_code,
          COALESCE(j.routecode, v.routecode) as route_code,
          COALESCE(j.clientcode, v.clientcode) as customer_code,
          COALESCE(j.journey_date, v.visit_date) as activity_date,

          -- Journey plan details
          j.planned_sequence,
          j.visittype as planned_visit_type,
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
          CASE WHEN s.day_sales > 0 THEN true ELSE false END as was_productive,

          -- Compliance metrics
          CASE
            WHEN j.clientcode IS NOT NULL AND v.clientcode IS NOT NULL THEN 'Completed'
            WHEN j.clientcode IS NOT NULL AND v.clientcode IS NULL THEN 'Missed'
            WHEN j.clientcode IS NULL AND v.clientcode IS NOT NULL THEN 'Unplanned'
            ELSE 'No Activity'
          END as compliance_status,

          -- Performance classification
          CASE
            WHEN s.day_sales > 10000 THEN 'High Value'
            WHEN s.day_sales > 1000 THEN 'Medium Value'
            WHEN s.day_sales > 0 THEN 'Low Value'
            WHEN v.clientcode IS NOT NULL THEN 'Non-Productive'
            ELSE 'Missed'
          END as visit_value_category,

          CURRENT_TIMESTAMP as last_updated
        FROM journey_data j
        FULL OUTER JOIN visit_data v
          ON j.usercode = v.usercode
          AND j.clientcode = v.clientcode
          AND j.journey_date = v.visit_date
        LEFT JOIN sales_data s
          ON COALESCE(j.usercode, v.usercode) = s.usercode
          AND COALESCE(j.clientcode, v.clientcode) = s.clientcode
          AND COALESCE(j.journey_date, v.visit_date) = s.sale_date
        WHERE COALESCE(j.journey_date, v.visit_date) IS NOT NULL;

        -- Create highly optimized indexes for lightning-fast queries
        CREATE INDEX idx_fcj_salesman_date ON flat_customer_journey(salesman_code, activity_date DESC);
        CREATE INDEX idx_fcj_route_date ON flat_customer_journey(route_code, activity_date DESC);
        CREATE INDEX idx_fcj_customer_date ON flat_customer_journey(customer_code, activity_date DESC);
        CREATE INDEX idx_fcj_compliance ON flat_customer_journey(compliance_status, activity_date DESC);
        CREATE INDEX idx_fcj_productive ON flat_customer_journey(was_productive, sales_amount DESC);
        CREATE INDEX idx_fcj_date ON flat_customer_journey(activity_date DESC);

        -- Add composite indexes for common query patterns
        CREATE INDEX idx_fcj_salesman_compliance ON flat_customer_journey(salesman_code, compliance_status, activity_date);
        CREATE INDEX idx_fcj_route_productive ON flat_customer_journey(route_code, was_productive, sales_amount);
      `

      await db.query(createCustomerJourneyQuery)

      // Verify data was created
      const verifyJourneyQuery = `SELECT COUNT(*) as count FROM flat_customer_journey`
      const journeyResult = await db.query(verifyJourneyQuery)

      results.created_tables.push({
        table: 'flat_customer_journey',
        records: journeyResult.rows[0].count,
        status: 'SUCCESS'
      })
      console.log(`✅ Created flat_customer_journey with ${journeyResult.rows[0].count} records`)

    } catch (error) {
      results.errors.push(`Failed to create flat_customer_journey: ${error}`)
      console.error('Error creating flat_customer_journey:', error)
    }

    // 2. Create flat_daily_sales_summary - ULTRA OPTIMIZED
    console.log('Creating flat_daily_sales_summary...')
    try {
      const createDailySalesQuery = `
        DROP TABLE IF EXISTS flat_daily_sales_summary CASCADE;

        CREATE TABLE flat_daily_sales_summary AS
        WITH daily_metrics AS (
          SELECT
            DATE(trx_date) as sale_date,

            -- Overall metrics
            SUM(total_amount) as total_sales,
            COUNT(DISTINCT trx_code) as total_orders,
            COUNT(DISTINCT client_code) as unique_customers,
            COUNT(DISTINCT user_code) as active_salesmen,
            COUNT(DISTINCT route_code) as active_routes,

            -- Sales statistics
            AVG(total_amount) as avg_order_value,
            MAX(total_amount) as max_order_value,
            MIN(total_amount) as min_order_value,
            STDDEV(total_amount) as sales_std_dev,

            -- Time-based metrics
            MIN(trx_time) as first_sale_time,
            MAX(trx_time) as last_sale_time,

            -- Category breakdowns
            SUM(CASE WHEN total_amount > 10000 THEN total_amount ELSE 0 END) as high_value_sales,
            SUM(CASE WHEN total_amount BETWEEN 1000 AND 10000 THEN total_amount ELSE 0 END) as medium_value_sales,
            SUM(CASE WHEN total_amount < 1000 THEN total_amount ELSE 0 END) as low_value_sales,

            COUNT(CASE WHEN total_amount > 10000 THEN 1 END) as high_value_orders,
            COUNT(CASE WHEN total_amount BETWEEN 1000 AND 10000 THEN 1 END) as medium_value_orders,
            COUNT(CASE WHEN total_amount < 1000 THEN 1 END) as low_value_orders

          FROM flat_transactions
          WHERE trx_date >= '2025-01-01'  -- Keep more history for trends
          GROUP BY DATE(trx_date)
        ),
        running_totals AS (
          SELECT
            sale_date,
            total_sales,
            total_orders,
            unique_customers,
            active_salesmen,
            active_routes,
            avg_order_value,
            max_order_value,
            min_order_value,
            sales_std_dev,
            first_sale_time,
            last_sale_time,
            high_value_sales,
            medium_value_sales,
            low_value_sales,
            high_value_orders,
            medium_value_orders,
            low_value_orders,

            -- Running totals for the month
            SUM(total_sales) OVER (
              PARTITION BY DATE_TRUNC('month', sale_date)
              ORDER BY sale_date
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) as mtd_sales,

            SUM(total_orders) OVER (
              PARTITION BY DATE_TRUNC('month', sale_date)
              ORDER BY sale_date
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) as mtd_orders,

            -- Running totals for the year
            SUM(total_sales) OVER (
              PARTITION BY EXTRACT(YEAR FROM sale_date)
              ORDER BY sale_date
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) as ytd_sales,

            SUM(total_orders) OVER (
              PARTITION BY EXTRACT(YEAR FROM sale_date)
              ORDER BY sale_date
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) as ytd_orders,

            -- Moving averages
            AVG(total_sales) OVER (
              ORDER BY sale_date
              ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ) as ma7_sales,

            AVG(total_sales) OVER (
              ORDER BY sale_date
              ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
            ) as ma30_sales,

            -- Previous day for comparison
            LAG(total_sales, 1, 0) OVER (ORDER BY sale_date) as prev_day_sales,
            LAG(total_orders, 1, 0) OVER (ORDER BY sale_date) as prev_day_orders

          FROM daily_metrics
        )
        SELECT
          sale_date,
          EXTRACT(DOW FROM sale_date) as day_of_week,
          EXTRACT(DAY FROM sale_date) as day_of_month,
          EXTRACT(MONTH FROM sale_date) as month,
          EXTRACT(YEAR FROM sale_date) as year,

          -- Core metrics
          total_sales,
          total_orders,
          unique_customers,
          active_salesmen,
          active_routes,
          avg_order_value,
          max_order_value,
          min_order_value,
          sales_std_dev,

          -- Time metrics
          first_sale_time,
          last_sale_time,

          -- Value categories
          high_value_sales,
          medium_value_sales,
          low_value_sales,
          high_value_orders,
          medium_value_orders,
          low_value_orders,

          -- Running totals
          mtd_sales,
          mtd_orders,
          ytd_sales,
          ytd_orders,

          -- Moving averages
          ROUND(ma7_sales::numeric, 2) as ma7_sales,
          ROUND(ma30_sales::numeric, 2) as ma30_sales,

          -- Growth metrics
          prev_day_sales,
          prev_day_orders,
          CASE
            WHEN prev_day_sales > 0
            THEN ROUND(((total_sales - prev_day_sales) / prev_day_sales * 100)::numeric, 2)
            ELSE 0
          END as sales_growth_pct,

          -- Performance indicators
          CASE
            WHEN total_sales > ma30_sales * 1.2 THEN 'Above Average'
            WHEN total_sales < ma30_sales * 0.8 THEN 'Below Average'
            ELSE 'Average'
          END as performance_status,

          CURRENT_TIMESTAMP as last_updated
        FROM running_totals;

        -- Create ultra-optimized indexes
        CREATE UNIQUE INDEX idx_fdss_date ON flat_daily_sales_summary(sale_date DESC);
        CREATE INDEX idx_fdss_month ON flat_daily_sales_summary(year, month, sale_date DESC);
        CREATE INDEX idx_fdss_performance ON flat_daily_sales_summary(performance_status, sale_date DESC);
        CREATE INDEX idx_fdss_sales ON flat_daily_sales_summary(total_sales DESC);

        -- Covering index for dashboard queries
        CREATE INDEX idx_fdss_dashboard ON flat_daily_sales_summary(
          sale_date DESC,
          total_sales,
          total_orders,
          unique_customers,
          active_salesmen,
          mtd_sales,
          ytd_sales
        );
      `

      await db.query(createDailySalesQuery)

      // Verify data
      const verifyDailyQuery = `
        SELECT COUNT(*) as count,
               MIN(sale_date) as earliest,
               MAX(sale_date) as latest
        FROM flat_daily_sales_summary
      `
      const dailyResult = await db.query(verifyDailyQuery)

      results.created_tables.push({
        table: 'flat_daily_sales_summary',
        records: dailyResult.rows[0].count,
        date_range: `${dailyResult.rows[0].earliest} to ${dailyResult.rows[0].latest}`,
        status: 'SUCCESS'
      })
      console.log(`✅ Created flat_daily_sales_summary with ${dailyResult.rows[0].count} records`)

    } catch (error) {
      results.errors.push(`Failed to create flat_daily_sales_summary: ${error}`)
      console.error('Error creating flat_daily_sales_summary:', error)
    }

    // 3. Create flat_product_inventory - REAL-TIME OPTIMIZED
    console.log('Creating flat_product_inventory...')
    try {
      const createInventoryQuery = `
        DROP TABLE IF EXISTS flat_product_inventory CASCADE;

        CREATE TABLE flat_product_inventory AS
        WITH inventory_movements AS (
          -- Aggregate all movements by product
          SELECT
            md.itemcode as product_code,

            -- Current stock calculation (positive = in, negative = out)
            SUM(md.quantitylevel1) as current_stock_level,

            -- Movement statistics
            SUM(CASE WHEN md.quantitylevel1 > 0 THEN md.quantitylevel1 ELSE 0 END) as total_inbound,
            SUM(CASE WHEN md.quantitylevel1 < 0 THEN ABS(md.quantitylevel1) ELSE 0 END) as total_outbound,

            COUNT(DISTINCT CASE WHEN md.quantitylevel1 > 0 THEN md.movementcode END) as inbound_transactions,
            COUNT(DISTINCT CASE WHEN md.quantitylevel1 < 0 THEN md.movementcode END) as outbound_transactions,

            -- Recent movement tracking
            MAX(CASE WHEN md.quantitylevel1 > 0 THEN md.createdon END) as last_inbound_date,
            MAX(CASE WHEN md.quantitylevel1 < 0 THEN md.createdon END) as last_outbound_date,
            MAX(md.createdon) as last_movement_date,

            -- 30-day movements
            SUM(CASE
              WHEN md.createdon >= CURRENT_DATE - INTERVAL '30 days' AND md.quantitylevel1 > 0
              THEN md.quantitylevel1 ELSE 0
            END) as inbound_30d,
            SUM(CASE
              WHEN md.createdon >= CURRENT_DATE - INTERVAL '30 days' AND md.quantitylevel1 < 0
              THEN ABS(md.quantitylevel1) ELSE 0
            END) as outbound_30d,

            -- 7-day movements
            SUM(CASE
              WHEN md.createdon >= CURRENT_DATE - INTERVAL '7 days' AND md.quantitylevel1 > 0
              THEN md.quantitylevel1 ELSE 0
            END) as inbound_7d,
            SUM(CASE
              WHEN md.createdon >= CURRENT_DATE - INTERVAL '7 days' AND md.quantitylevel1 < 0
              THEN ABS(md.quantitylevel1) ELSE 0
            END) as outbound_7d,

            -- Movement velocity
            COUNT(DISTINCT DATE(md.createdon)) as active_days,
            AVG(ABS(md.quantitylevel1)) as avg_movement_quantity

          FROM tblmovementdetail md
          WHERE md.status IN (2, 3)  -- Valid statuses
            AND md.itemcode IS NOT NULL
          GROUP BY md.itemcode
        ),
        product_info AS (
          -- Get product master data
          SELECT
            i.code as product_code,
            i.description as product_name,
            i.altdescription as product_arabic_name,
            i.grouplevel1 as category_code,
            i.grouplevel2 as subcategory_code,
            i.baseuom as unit_of_measure,
            i.conversionfactor,
            i.isactive as is_active
          FROM tblitem i
        ),
        sales_velocity AS (
          -- Calculate sales velocity for inventory planning
          SELECT
            td.itemcode as product_code,
            AVG(td.finalbu) as avg_daily_sales,
            STDDEV(td.finalbu) as sales_volatility,
            MAX(th.trxdate) as last_sale_date
          FROM tbltrxdetail td
          JOIN tbltrxheader th ON td.trxcode = th.trxcode
          WHERE th.trxdate >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY td.itemcode
        )
        SELECT
          p.product_code,
          p.product_name,
          p.product_arabic_name,
          p.category_code,
          p.subcategory_code,
          p.unit_of_measure,
          p.is_active,

          -- Stock levels
          COALESCE(im.current_stock_level, 0) as current_stock,
          COALESCE(im.total_inbound, 0) as total_inbound,
          COALESCE(im.total_outbound, 0) as total_outbound,

          -- Movement metrics
          COALESCE(im.inbound_transactions, 0) as inbound_transactions,
          COALESCE(im.outbound_transactions, 0) as outbound_transactions,
          COALESCE(im.inbound_30d, 0) as inbound_last_30d,
          COALESCE(im.outbound_30d, 0) as outbound_last_30d,
          COALESCE(im.inbound_7d, 0) as inbound_last_7d,
          COALESCE(im.outbound_7d, 0) as outbound_last_7d,

          -- Dates
          im.last_inbound_date,
          im.last_outbound_date,
          im.last_movement_date,
          sv.last_sale_date,

          -- Velocity metrics
          COALESCE(sv.avg_daily_sales, 0) as avg_daily_sales,
          COALESCE(sv.sales_volatility, 0) as sales_volatility,
          COALESCE(im.avg_movement_quantity, 0) as avg_movement_quantity,
          COALESCE(im.active_days, 0) as movement_active_days,

          -- Inventory calculations
          CASE
            WHEN sv.avg_daily_sales > 0
            THEN ROUND((COALESCE(im.current_stock_level, 0) / sv.avg_daily_sales)::numeric, 1)
            ELSE 999999  -- Infinite days if no sales
          END as days_of_stock,

          -- Stock status classification
          CASE
            WHEN im.current_stock_level IS NULL OR im.current_stock_level = 0 THEN 'Out of Stock'
            WHEN sv.avg_daily_sales IS NULL OR sv.avg_daily_sales = 0 THEN 'No Movement'
            WHEN im.current_stock_level / NULLIF(sv.avg_daily_sales, 0) < 7 THEN 'Low Stock'
            WHEN im.current_stock_level / NULLIF(sv.avg_daily_sales, 0) < 30 THEN 'Adequate Stock'
            WHEN im.current_stock_level / NULLIF(sv.avg_daily_sales, 0) < 90 THEN 'High Stock'
            ELSE 'Overstock'
          END as stock_status,

          -- Movement classification
          CASE
            WHEN im.outbound_30d > 0 AND im.inbound_30d > 0 THEN 'Active'
            WHEN im.outbound_30d > 0 THEN 'Depleting'
            WHEN im.inbound_30d > 0 THEN 'Accumulating'
            ELSE 'Stagnant'
          END as movement_status,

          -- Reorder point (basic calculation: 7 days of average sales + 20% safety)
          CASE
            WHEN sv.avg_daily_sales > 0
            THEN ROUND((sv.avg_daily_sales * 7 * 1.2)::numeric, 0)
            ELSE 0
          END as suggested_reorder_point,

          CURRENT_TIMESTAMP as last_updated

        FROM product_info p
        LEFT JOIN inventory_movements im ON p.product_code = im.product_code
        LEFT JOIN sales_velocity sv ON p.product_code = sv.product_code
        WHERE p.is_active = true;  -- Only active products

        -- Create highly optimized indexes for real-time queries
        CREATE INDEX idx_fpi_product ON flat_product_inventory(product_code);
        CREATE INDEX idx_fpi_stock_status ON flat_product_inventory(stock_status, current_stock DESC);
        CREATE INDEX idx_fpi_movement_status ON flat_product_inventory(movement_status, last_movement_date DESC);
        CREATE INDEX idx_fpi_category ON flat_product_inventory(category_code, current_stock DESC);
        CREATE INDEX idx_fpi_low_stock ON flat_product_inventory(days_of_stock) WHERE days_of_stock < 7;
        CREATE INDEX idx_fpi_active ON flat_product_inventory(is_active, product_code) WHERE is_active = true;

        -- Composite index for inventory dashboard
        CREATE INDEX idx_fpi_dashboard ON flat_product_inventory(
          stock_status,
          movement_status,
          current_stock,
          days_of_stock,
          product_code
        );
      `

      await db.query(createInventoryQuery)

      // Verify data
      const verifyInventoryQuery = `
        SELECT
          COUNT(*) as total_products,
          COUNT(CASE WHEN current_stock > 0 THEN 1 END) as products_in_stock,
          COUNT(CASE WHEN stock_status = 'Low Stock' THEN 1 END) as low_stock_products
        FROM flat_product_inventory
      `
      const inventoryResult = await db.query(verifyInventoryQuery)

      results.created_tables.push({
        table: 'flat_product_inventory',
        records: inventoryResult.rows[0].total_products,
        in_stock: inventoryResult.rows[0].products_in_stock,
        low_stock: inventoryResult.rows[0].low_stock_products,
        status: 'SUCCESS'
      })
      console.log(`✅ Created flat_product_inventory with ${inventoryResult.rows[0].total_products} products`)

    } catch (error) {
      results.errors.push(`Failed to create flat_product_inventory: ${error}`)
      console.error('Error creating flat_product_inventory:', error)
    }

    // Final summary
    const summary = {
      success: results.errors.length === 0,
      deleted_count: results.deleted_tables.length,
      created_count: results.created_tables.length,
      total_records_created: results.created_tables.reduce((sum, t) => sum + parseInt(t.records || 0), 0),
      message: results.errors.length === 0 ?
        'All tables successfully rebuilt with optimized structure and real data' :
        'Some operations completed with errors'
    }

    return NextResponse.json({
      ...results,
      summary,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Table rebuild error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to rebuild tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}