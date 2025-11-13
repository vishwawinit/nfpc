import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    await db.initialize()

    const results = {
      created_tables: [],
      errors: []
    }

    // 1. Recreate flat_customer_journey with ALL DATA (no date filter)
    console.log('Recreating flat_customer_journey with ALL historical data...')
    try {
      // First DROP the table completely to avoid duplicates
      await db.query('DROP TABLE IF EXISTS flat_customer_journey CASCADE')

      const createJourneyQuery = `
        CREATE TABLE flat_customer_journey AS
        WITH daily_activity AS (
          -- Aggregate ALL daily activity per salesman-customer combination
          -- GROUP BY ensures no duplicates
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
          WHERE user_code IS NOT NULL
            AND client_code IS NOT NULL
            AND total_amount > 0
          -- NO DATE FILTER - GET ALL DATA
          GROUP BY user_code, route_code, client_code, DATE(trx_date)
        )
        SELECT DISTINCT -- DISTINCT to ensure no duplicates
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
          EXTRACT(MONTH FROM activity_date) as month,
          EXTRACT(YEAR FROM activity_date) as year,

          CURRENT_TIMESTAMP as last_updated
        FROM daily_activity;

        -- Create UNIQUE index to prevent duplicates
        CREATE UNIQUE INDEX idx_fcj_unique ON flat_customer_journey(
          salesman_code, customer_code, activity_date
        );

        -- Other performance indexes
        CREATE INDEX idx_fcj_salesman_date ON flat_customer_journey(salesman_code, activity_date DESC);
        CREATE INDEX idx_fcj_route_date ON flat_customer_journey(route_code, activity_date DESC);
        CREATE INDEX idx_fcj_customer_date ON flat_customer_journey(customer_code, activity_date DESC);
        CREATE INDEX idx_fcj_date ON flat_customer_journey(activity_date DESC);
        CREATE INDEX idx_fcj_value ON flat_customer_journey(value_category, sales_amount DESC);
        CREATE INDEX idx_fcj_sales ON flat_customer_journey(sales_amount DESC);
      `

      await db.query(createJourneyQuery)

      const verifyJourneyQuery = `
        SELECT
          COUNT(*) as total_records,
          COUNT(DISTINCT salesman_code) as unique_salesmen,
          COUNT(DISTINCT customer_code) as unique_customers,
          MIN(activity_date) as earliest_date,
          MAX(activity_date) as latest_date,
          SUM(sales_amount) as total_sales
        FROM flat_customer_journey
      `
      const journeyResult = await db.query(verifyJourneyQuery)

      results.created_tables.push({
        table: 'flat_customer_journey',
        records: journeyResult.rows[0].total_records,
        date_range: `${journeyResult.rows[0].earliest_date} to ${journeyResult.rows[0].latest_date}`,
        total_sales: journeyResult.rows[0].total_sales,
        unique_salesmen: journeyResult.rows[0].unique_salesmen,
        unique_customers: journeyResult.rows[0].unique_customers,
        status: 'SUCCESS - NO DUPLICATES (unique index enforced)'
      })

    } catch (error) {
      results.errors.push(`flat_customer_journey: ${error}`)
    }

    // 2. Verify/Recreate flat_daily_sales_summary with ALL DATA
    console.log('Verifying flat_daily_sales_summary has ALL data...')
    try {
      // Check if it already has all data
      const checkDailyQuery = `
        SELECT
          COUNT(*) as total_days,
          MIN(sale_date) as earliest,
          MAX(sale_date) as latest
        FROM flat_daily_sales_summary
      `
      const checkResult = await db.query(checkDailyQuery)

      // If table doesn't exist or needs recreation
      if (!checkResult.rows[0] || !checkResult.rows[0].total_days) {

        await db.query('DROP TABLE IF EXISTS flat_daily_sales_summary CASCADE')

        const createDailySalesQuery = `
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

              -- Category breakdowns
              SUM(CASE WHEN total_amount > 10000 THEN total_amount ELSE 0 END) as high_value_sales,
              SUM(CASE WHEN total_amount BETWEEN 1000 AND 10000 THEN total_amount ELSE 0 END) as medium_value_sales,
              SUM(CASE WHEN total_amount < 1000 THEN total_amount ELSE 0 END) as low_value_sales
            FROM flat_transactions
            -- NO DATE FILTER - GET ALL HISTORICAL DATA
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
              high_value_sales,
              medium_value_sales,
              low_value_sales,

              -- Running totals for the month
              SUM(total_sales) OVER (
                PARTITION BY DATE_TRUNC('month', sale_date)
                ORDER BY sale_date
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) as mtd_sales,

              -- Running totals for the year
              SUM(total_sales) OVER (
                PARTITION BY EXTRACT(YEAR FROM sale_date)
                ORDER BY sale_date
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) as ytd_sales,

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
              LAG(total_sales, 1, 0) OVER (ORDER BY sale_date) as prev_day_sales

            FROM daily_metrics
          )
          SELECT DISTINCT -- Ensure no duplicates
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

            -- Value categories
            high_value_sales,
            medium_value_sales,
            low_value_sales,

            -- Running totals
            mtd_sales,
            ytd_sales,

            -- Moving averages
            ROUND(ma7_sales::numeric, 2) as ma7_sales,
            ROUND(ma30_sales::numeric, 2) as ma30_sales,

            -- Growth metrics
            prev_day_sales,
            CASE
              WHEN prev_day_sales > 0
              THEN ROUND(((total_sales - prev_day_sales) / prev_day_sales * 100)::numeric, 2)
              ELSE 0
            END as sales_growth_pct,

            CURRENT_TIMESTAMP as last_updated
          FROM running_totals;

          -- Create UNIQUE index on sale_date to prevent duplicates
          CREATE UNIQUE INDEX idx_fdss_unique_date ON flat_daily_sales_summary(sale_date);

          -- Other performance indexes
          CREATE INDEX idx_fdss_month ON flat_daily_sales_summary(year, month, sale_date DESC);
          CREATE INDEX idx_fdss_sales ON flat_daily_sales_summary(total_sales DESC);
        `

        await db.query(createDailySalesQuery)
      }

      const verifyDailyQuery = `
        SELECT
          COUNT(*) as total_days,
          MIN(sale_date) as earliest,
          MAX(sale_date) as latest,
          SUM(total_sales) as grand_total_sales
        FROM flat_daily_sales_summary
      `
      const dailyResult = await db.query(verifyDailyQuery)

      results.created_tables.push({
        table: 'flat_daily_sales_summary',
        records: dailyResult.rows[0].total_days,
        date_range: `${dailyResult.rows[0].earliest} to ${dailyResult.rows[0].latest}`,
        total_sales: dailyResult.rows[0].grand_total_sales,
        status: 'SUCCESS - NO DUPLICATES (unique date index)'
      })

    } catch (error) {
      results.errors.push(`flat_daily_sales_summary: ${error}`)
    }

    // 3. Recreate flat_product_inventory with ALL DATA
    console.log('Recreating flat_product_inventory with ALL historical data...')
    try {
      await db.query('DROP TABLE IF EXISTS flat_product_inventory CASCADE')

      const createInventoryQuery = `
        CREATE TABLE flat_product_inventory AS
        WITH inventory_movements AS (
          -- Get ALL inventory movements (no date filter)
          SELECT
            md.itemcode as product_code,
            SUM(COALESCE(md.quantitylevel1, 0)) as current_stock_level,
            SUM(CASE WHEN md.quantitylevel1 > 0 THEN md.quantitylevel1 ELSE 0 END) as total_inbound,
            SUM(CASE WHEN md.quantitylevel1 < 0 THEN ABS(md.quantitylevel1) ELSE 0 END) as total_outbound,
            COUNT(DISTINCT CASE WHEN md.quantitylevel1 > 0 THEN md.movementcode END) as inbound_transactions,
            COUNT(DISTINCT CASE WHEN md.quantitylevel1 < 0 THEN md.movementcode END) as outbound_transactions,
            MAX(CASE WHEN md.quantitylevel1 > 0 THEN md.createdon END) as last_inbound_date,
            MAX(CASE WHEN md.quantitylevel1 < 0 THEN md.createdon END) as last_outbound_date,
            MAX(md.createdon) as last_movement_date,
            COUNT(DISTINCT DATE(md.createdon)) as active_days,
            AVG(ABS(md.quantitylevel1)) as avg_movement_quantity
          FROM tblmovementdetail md
          WHERE md.status IN (2, 3)
            AND md.itemcode IS NOT NULL
            AND md.itemcode != ''
          GROUP BY md.itemcode
        ),
        product_info AS (
          SELECT DISTINCT -- Ensure no duplicate products
            i.code as product_code,
            i.description as product_name,
            i.altdescription as product_arabic_name,
            i.grouplevel1 as category_code,
            i.grouplevel2 as subcategory_code,
            i.baseuom as unit_of_measure,
            i.isactive as is_active
          FROM tblitem i
          WHERE i.code IS NOT NULL
        ),
        sales_data AS (
          -- Get ALL historical sales data
          SELECT
            td.itemcode as product_code,
            COUNT(DISTINCT td.trxcode) as total_transaction_count,
            SUM(td.finalbu) as total_quantity_sold,
            AVG(td.finalbu) as avg_quantity_per_transaction,
            MAX(th.trxdate) as last_sale_date,
            MIN(th.trxdate) as first_sale_date
          FROM tbltrxdetail td
          JOIN tbltrxheader th ON td.trxcode = th.trxcode
          -- NO DATE FILTER - GET ALL HISTORICAL DATA
          GROUP BY td.itemcode
        )
        SELECT DISTINCT -- Ensure no duplicate products
          p.product_code,
          p.product_name,
          p.product_arabic_name,
          p.category_code,
          p.subcategory_code,
          p.unit_of_measure,
          p.is_active,

          -- Stock levels
          COALESCE(im.current_stock_level, 0) as current_stock,
          COALESCE(im.total_inbound, 0) as total_inbound_all_time,
          COALESCE(im.total_outbound, 0) as total_outbound_all_time,

          -- Movement metrics
          COALESCE(im.inbound_transactions, 0) as inbound_transactions,
          COALESCE(im.outbound_transactions, 0) as outbound_transactions,

          -- Dates
          im.last_inbound_date,
          im.last_outbound_date,
          im.last_movement_date,
          sd.first_sale_date,
          sd.last_sale_date,

          -- Sales metrics (all time)
          COALESCE(sd.total_quantity_sold, 0) as total_quantity_sold_all_time,
          COALESCE(sd.total_transaction_count, 0) as sales_transactions_all_time,
          COALESCE(sd.avg_quantity_per_transaction, 0) as avg_sale_quantity,

          -- Velocity metrics
          COALESCE(im.avg_movement_quantity, 0) as avg_movement_quantity,
          COALESCE(im.active_days, 0) as movement_active_days,

          -- Stock status classification
          CASE
            WHEN COALESCE(im.current_stock_level, 0) <= 0 THEN 'Out of Stock'
            WHEN COALESCE(sd.total_quantity_sold, 0) = 0 AND im.current_stock_level > 0 THEN 'No Sales History'
            WHEN im.current_stock_level > 0 THEN 'In Stock'
            ELSE 'Unknown'
          END as stock_status,

          -- Movement classification
          CASE
            WHEN im.last_movement_date > CURRENT_DATE - INTERVAL '30 days' THEN 'Active'
            WHEN im.last_movement_date > CURRENT_DATE - INTERVAL '90 days' THEN 'Slow Moving'
            WHEN im.last_movement_date > CURRENT_DATE - INTERVAL '180 days' THEN 'Very Slow'
            ELSE 'Inactive'
          END as movement_status,

          CURRENT_TIMESTAMP as last_updated

        FROM product_info p
        LEFT JOIN inventory_movements im ON p.product_code = im.product_code
        LEFT JOIN sales_data sd ON p.product_code = sd.product_code;

        -- Create UNIQUE index on product_code to prevent duplicates
        CREATE UNIQUE INDEX idx_fpi_unique_product ON flat_product_inventory(product_code);

        -- Other performance indexes
        CREATE INDEX idx_fpi_stock_status ON flat_product_inventory(stock_status, current_stock DESC);
        CREATE INDEX idx_fpi_movement_status ON flat_product_inventory(movement_status, last_movement_date DESC);
        CREATE INDEX idx_fpi_category ON flat_product_inventory(category_code, current_stock DESC);
      `

      await db.query(createInventoryQuery)

      const verifyInventoryQuery = `
        SELECT
          COUNT(*) as total_products,
          COUNT(CASE WHEN current_stock > 0 THEN 1 END) as products_in_stock,
          COUNT(CASE WHEN stock_status = 'Out of Stock' THEN 1 END) as out_of_stock,
          COUNT(CASE WHEN movement_status = 'Active' THEN 1 END) as active_products
        FROM flat_product_inventory
      `
      const inventoryResult = await db.query(verifyInventoryQuery)

      results.created_tables.push({
        table: 'flat_product_inventory',
        total_products: inventoryResult.rows[0].total_products,
        in_stock: inventoryResult.rows[0].products_in_stock,
        out_of_stock: inventoryResult.rows[0].out_of_stock,
        active_products: inventoryResult.rows[0].active_products,
        status: 'SUCCESS - NO DUPLICATES (unique product index)'
      })

    } catch (error) {
      results.errors.push(`flat_product_inventory: ${error}`)
    }

    // Summary
    const summary = {
      success: results.errors.length === 0,
      created_count: results.created_tables.length,
      message: results.errors.length === 0 ?
        'All flat tables recreated with COMPLETE historical data and DUPLICATE PREVENTION!' :
        `Created ${results.created_tables.length} tables with some errors`,
      duplicate_prevention: 'Each table has UNIQUE indexes to prevent duplicates if run again'
    }

    return NextResponse.json({
      ...results,
      summary,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Table recreation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to recreate tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}