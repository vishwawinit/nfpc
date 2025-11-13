import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    await db.initialize()

    const results = {
      created_tables: [],
      errors: []
    }

    // 1. Fix and create flat_customer_journey
    console.log('Creating flat_customer_journey with corrected columns...')
    try {
      // First check actual column names
      const checkColumnsQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'tbljourney'
        AND table_schema = 'public'
      `
      const columnsResult = await db.query(checkColumnsQuery)
      console.log('tbljourney columns:', columnsResult.rows.map(r => r.column_name).join(', '))

      const createCustomerJourneyQuery = `
        DROP TABLE IF EXISTS flat_customer_journey CASCADE;

        CREATE TABLE flat_customer_journey AS
        WITH journey_data AS (
          -- Get journey plan data - using actual route column name
          SELECT
            j.usercode,
            j.routecode, -- This column should exist
            j.clientcode,
            j.date as journey_date
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
            CASE
              WHEN cv.checkout IS NOT NULL AND cv.checkin IS NOT NULL
              THEN EXTRACT(EPOCH FROM (cv.checkout - cv.checkin))/60
              ELSE 0
            END as visit_duration_minutes
          FROM tblcustomervisit cv
          WHERE cv.date >= '2025-08-01' AND cv.date < '2025-09-01'
        ),
        sales_data AS (
          -- Get sales data from flat_transactions
          SELECT
            user_code as usercode,
            client_code as clientcode,
            DATE(trx_date) as sale_date,
            SUM(total_amount) as day_sales,
            COUNT(DISTINCT trx_code) as day_orders
          FROM flat_transactions
          WHERE trx_date >= '2025-08-01' AND trx_date < '2025-09-01'
          GROUP BY user_code, client_code, DATE(trx_date)
        )
        SELECT
          COALESCE(j.usercode, v.usercode, s.usercode) as salesman_code,
          COALESCE(j.routecode, v.routecode) as route_code,
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
          CASE WHEN s.day_sales > 0 THEN true ELSE false END as was_productive,

          -- Compliance metrics
          CASE
            WHEN j.clientcode IS NOT NULL AND v.clientcode IS NOT NULL THEN 'Completed'
            WHEN j.clientcode IS NOT NULL AND v.clientcode IS NULL THEN 'Missed'
            WHEN j.clientcode IS NULL AND v.clientcode IS NOT NULL THEN 'Unplanned'
            WHEN s.day_sales > 0 THEN 'Sale Only'
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

          CURRENT_TIMESTAMP as last_updated
        FROM journey_data j
        FULL OUTER JOIN visit_data v
          ON j.usercode = v.usercode
          AND j.clientcode = v.clientcode
          AND j.journey_date = v.visit_date
        FULL OUTER JOIN sales_data s
          ON COALESCE(j.usercode, v.usercode) = s.usercode
          AND COALESCE(j.clientcode, v.clientcode) = s.clientcode
          AND COALESCE(j.journey_date, v.visit_date) = s.sale_date
        WHERE COALESCE(j.journey_date, v.visit_date, s.sale_date) IS NOT NULL
          AND COALESCE(j.journey_date, v.visit_date, s.sale_date) >= '2025-08-01'
          AND COALESCE(j.journey_date, v.visit_date, s.sale_date) < '2025-09-01';

        -- Create highly optimized indexes
        CREATE INDEX idx_fcj_salesman_date ON flat_customer_journey(salesman_code, activity_date DESC);
        CREATE INDEX idx_fcj_route_date ON flat_customer_journey(route_code, activity_date DESC);
        CREATE INDEX idx_fcj_customer_date ON flat_customer_journey(customer_code, activity_date DESC);
        CREATE INDEX idx_fcj_compliance ON flat_customer_journey(compliance_status, activity_date DESC);
        CREATE INDEX idx_fcj_productive ON flat_customer_journey(was_productive, sales_amount DESC);
      `

      await db.query(createCustomerJourneyQuery)

      const verifyQuery = `
        SELECT
          COUNT(*) as total_records,
          COUNT(DISTINCT salesman_code) as unique_salesmen,
          SUM(CASE WHEN was_productive THEN 1 ELSE 0 END) as productive_visits,
          SUM(sales_amount) as total_sales,
          COUNT(CASE WHEN compliance_status = 'Completed' THEN 1 END) as completed_visits
        FROM flat_customer_journey
      `
      const verifyResult = await db.query(verifyQuery)

      results.created_tables.push({
        table: 'flat_customer_journey',
        records: verifyResult.rows[0].total_records,
        unique_salesmen: verifyResult.rows[0].unique_salesmen,
        productive_visits: verifyResult.rows[0].productive_visits,
        total_sales: verifyResult.rows[0].total_sales,
        completed_visits: verifyResult.rows[0].completed_visits,
        status: 'SUCCESS'
      })
      console.log(`✅ Created flat_customer_journey with ${verifyResult.rows[0].total_records} records`)

    } catch (error) {
      results.errors.push(`Failed to create flat_customer_journey: ${error}`)
      console.error('Error:', error)
    }

    // 2. Fix and create flat_product_inventory
    console.log('Creating flat_product_inventory with corrected columns...')
    try {
      const createInventoryQuery = `
        DROP TABLE IF EXISTS flat_product_inventory CASCADE;

        CREATE TABLE flat_product_inventory AS
        WITH inventory_movements AS (
          -- Aggregate all movements by product
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
            SUM(CASE
              WHEN md.createdon >= CURRENT_DATE - INTERVAL '30 days' AND md.quantitylevel1 > 0
              THEN md.quantitylevel1 ELSE 0
            END) as inbound_30d,
            SUM(CASE
              WHEN md.createdon >= CURRENT_DATE - INTERVAL '30 days' AND md.quantitylevel1 < 0
              THEN ABS(md.quantitylevel1) ELSE 0
            END) as outbound_30d,
            COUNT(DISTINCT DATE(md.createdon)) as active_days,
            AVG(ABS(md.quantitylevel1)) as avg_movement_quantity
          FROM tblmovementdetail md
          WHERE md.status IN (2, 3)
            AND md.itemcode IS NOT NULL
            AND md.itemcode != ''
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
            i.isactive as is_active
          FROM tblitem i
          WHERE i.code IS NOT NULL
        ),
        sales_data AS (
          -- Calculate sales from transaction details - fixed column reference
          SELECT
            td.itemcode as product_code,
            COUNT(DISTINCT td.trxcode) as transaction_count,
            SUM(td.finalbu) as total_quantity_sold,
            AVG(td.finalbu) as avg_quantity_per_transaction,
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

          -- Dates
          im.last_inbound_date,
          im.last_outbound_date,
          im.last_movement_date,
          sd.last_sale_date,

          -- Sales metrics
          COALESCE(sd.total_quantity_sold, 0) as quantity_sold_30d,
          COALESCE(sd.transaction_count, 0) as sales_transactions_30d,
          COALESCE(sd.avg_quantity_per_transaction, 0) as avg_sale_quantity,

          -- Velocity metrics
          COALESCE(im.avg_movement_quantity, 0) as avg_movement_quantity,
          COALESCE(im.active_days, 0) as movement_active_days,

          -- Inventory calculations
          CASE
            WHEN sd.total_quantity_sold > 0 AND sd.total_quantity_sold / 30 > 0
            THEN ROUND((COALESCE(im.current_stock_level, 0) / (sd.total_quantity_sold / 30))::numeric, 1)
            ELSE CASE WHEN im.current_stock_level > 0 THEN 999999 ELSE 0 END
          END as days_of_stock,

          -- Stock status classification
          CASE
            WHEN COALESCE(im.current_stock_level, 0) <= 0 THEN 'Out of Stock'
            WHEN COALESCE(sd.total_quantity_sold, 0) = 0 AND im.current_stock_level > 0 THEN 'No Movement'
            WHEN im.current_stock_level > 0 AND sd.total_quantity_sold > 0 THEN
              CASE
                WHEN im.current_stock_level / (sd.total_quantity_sold / 30) < 7 THEN 'Low Stock'
                WHEN im.current_stock_level / (sd.total_quantity_sold / 30) < 30 THEN 'Adequate Stock'
                WHEN im.current_stock_level / (sd.total_quantity_sold / 30) < 90 THEN 'High Stock'
                ELSE 'Overstock'
              END
            ELSE 'Unknown'
          END as stock_status,

          -- Movement classification
          CASE
            WHEN im.outbound_30d > 0 AND im.inbound_30d > 0 THEN 'Active'
            WHEN im.outbound_30d > 0 THEN 'Depleting'
            WHEN im.inbound_30d > 0 THEN 'Accumulating'
            ELSE 'Stagnant'
          END as movement_status,

          CURRENT_TIMESTAMP as last_updated

        FROM product_info p
        LEFT JOIN inventory_movements im ON p.product_code = im.product_code
        LEFT JOIN sales_data sd ON p.product_code = sd.product_code;

        -- Create highly optimized indexes
        CREATE INDEX idx_fpi_product ON flat_product_inventory(product_code);
        CREATE INDEX idx_fpi_stock_status ON flat_product_inventory(stock_status, current_stock DESC);
        CREATE INDEX idx_fpi_movement_status ON flat_product_inventory(movement_status, last_movement_date DESC);
        CREATE INDEX idx_fpi_category ON flat_product_inventory(category_code, current_stock DESC);
        CREATE INDEX idx_fpi_low_stock ON flat_product_inventory(days_of_stock) WHERE days_of_stock < 7;
      `

      await db.query(createInventoryQuery)

      const verifyInventoryQuery = `
        SELECT
          COUNT(*) as total_products,
          COUNT(CASE WHEN current_stock > 0 THEN 1 END) as products_in_stock,
          COUNT(CASE WHEN stock_status = 'Low Stock' THEN 1 END) as low_stock_products,
          COUNT(CASE WHEN stock_status = 'Out of Stock' THEN 1 END) as out_of_stock,
          COUNT(CASE WHEN movement_status = 'Active' THEN 1 END) as active_products
        FROM flat_product_inventory
      `
      const inventoryResult = await db.query(verifyInventoryQuery)

      results.created_tables.push({
        table: 'flat_product_inventory',
        total_products: inventoryResult.rows[0].total_products,
        in_stock: inventoryResult.rows[0].products_in_stock,
        low_stock: inventoryResult.rows[0].low_stock_products,
        out_of_stock: inventoryResult.rows[0].out_of_stock,
        active_products: inventoryResult.rows[0].active_products,
        status: 'SUCCESS'
      })
      console.log(`✅ Created flat_product_inventory with ${inventoryResult.rows[0].total_products} products`)

    } catch (error) {
      results.errors.push(`Failed to create flat_product_inventory: ${error}`)
      console.error('Error:', error)
    }

    // Final summary
    const summary = {
      success: results.errors.length === 0,
      created_count: results.created_tables.length,
      message: results.errors.length === 0 ?
        'All remaining flat tables created successfully!' :
        `Created ${results.created_tables.length} tables`
    }

    return NextResponse.json({
      ...results,
      summary,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Table creation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create remaining tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}