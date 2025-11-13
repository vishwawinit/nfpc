import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    await db.initialize()

    // Check if table exists and has data
    const checkQuery = `
      SELECT COUNT(*) as count FROM flat_product_inventory
    `
    let tableExists = false
    try {
      const result = await db.query(checkQuery)
      if (result.rows[0].count > 0) {
        tableExists = true
      }
    } catch (e) {
      // Table doesn't exist
    }

    if (tableExists) {
      const verifyQuery = `
        SELECT
          COUNT(*) as total_products,
          COUNT(DISTINCT product_code) as unique_products,
          COUNT(CASE WHEN current_stock > 0 THEN 1 END) as products_in_stock,
          COUNT(CASE WHEN stock_status = 'Out of Stock' THEN 1 END) as out_of_stock
        FROM flat_product_inventory
      `
      const verifyResult = await db.query(verifyQuery)

      return NextResponse.json({
        success: true,
        message: 'flat_product_inventory already exists with data',
        stats: verifyResult.rows[0],
        action: 'No action taken - table already has complete data'
      })
    }

    // If table doesn't exist or is empty, create it
    console.log('Creating flat_product_inventory with duplicate handling...')

    // First ensure the table is dropped
    await db.query('DROP TABLE IF EXISTS flat_product_inventory CASCADE')

    const createQuery = `
      CREATE TABLE flat_product_inventory AS
      WITH inventory_movements AS (
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
        -- Handle duplicates by taking the first occurrence of each product
        SELECT DISTINCT ON (i.code)
          i.code as product_code,
          i.description as product_name,
          i.altdescription as product_arabic_name,
          i.grouplevel1 as category_code,
          i.grouplevel2 as subcategory_code,
          i.baseuom as unit_of_measure,
          i.isactive as is_active
        FROM tblitem i
        WHERE i.code IS NOT NULL AND i.code != ''
        ORDER BY i.code, i.description
      ),
      sales_data AS (
        SELECT
          td.itemcode as product_code,
          COUNT(DISTINCT td.trxcode) as total_transaction_count,
          SUM(td.finalbu) as total_quantity_sold,
          AVG(td.finalbu) as avg_quantity_per_transaction,
          MAX(th.trxdate) as last_sale_date,
          MIN(th.trxdate) as first_sale_date,
          -- Recent 30 day metrics
          SUM(CASE WHEN th.trxdate >= CURRENT_DATE - INTERVAL '30 days' THEN td.finalbu ELSE 0 END) as quantity_sold_30d,
          COUNT(DISTINCT CASE WHEN th.trxdate >= CURRENT_DATE - INTERVAL '30 days' THEN td.trxcode END) as transactions_30d
        FROM tbltrxdetail td
        JOIN tbltrxheader th ON td.trxcode = th.trxcode
        WHERE td.itemcode IS NOT NULL AND td.itemcode != ''
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
        COALESCE(sd.quantity_sold_30d, 0) as quantity_sold_last_30d,
        COALESCE(sd.transactions_30d, 0) as transactions_last_30d,

        -- Velocity metrics
        COALESCE(im.avg_movement_quantity, 0) as avg_movement_quantity,
        COALESCE(im.active_days, 0) as movement_active_days,

        -- Days of stock calculation
        CASE
          WHEN sd.quantity_sold_30d > 0 AND sd.quantity_sold_30d / 30 > 0
          THEN ROUND((COALESCE(im.current_stock_level, 0) / (sd.quantity_sold_30d / 30))::numeric, 1)
          ELSE CASE WHEN im.current_stock_level > 0 THEN 999999 ELSE 0 END
        END as days_of_stock,

        -- Stock status classification
        CASE
          WHEN COALESCE(im.current_stock_level, 0) <= 0 THEN 'Out of Stock'
          WHEN COALESCE(sd.total_quantity_sold, 0) = 0 AND im.current_stock_level > 0 THEN 'No Sales History'
          WHEN im.current_stock_level > 0 AND sd.quantity_sold_30d > 0 THEN
            CASE
              WHEN im.current_stock_level / (sd.quantity_sold_30d / 30) < 7 THEN 'Low Stock'
              WHEN im.current_stock_level / (sd.quantity_sold_30d / 30) < 30 THEN 'Adequate Stock'
              WHEN im.current_stock_level / (sd.quantity_sold_30d / 30) < 90 THEN 'High Stock'
              ELSE 'Overstock'
            END
          WHEN im.current_stock_level > 0 THEN 'In Stock'
          ELSE 'Unknown'
        END as stock_status,

        -- Movement classification
        CASE
          WHEN im.last_movement_date > CURRENT_DATE - INTERVAL '7 days' THEN 'Very Active'
          WHEN im.last_movement_date > CURRENT_DATE - INTERVAL '30 days' THEN 'Active'
          WHEN im.last_movement_date > CURRENT_DATE - INTERVAL '90 days' THEN 'Slow Moving'
          WHEN im.last_movement_date > CURRENT_DATE - INTERVAL '180 days' THEN 'Very Slow'
          WHEN im.last_movement_date IS NOT NULL THEN 'Inactive'
          ELSE 'Never Moved'
        END as movement_status,

        CURRENT_TIMESTAMP as last_updated

      FROM product_info p
      LEFT JOIN inventory_movements im ON p.product_code = im.product_code
      LEFT JOIN sales_data sd ON p.product_code = sd.product_code;

      -- Create indexes (not unique on product_code since we handled duplicates in the query)
      CREATE INDEX idx_fpi_product ON flat_product_inventory(product_code);
      CREATE INDEX idx_fpi_stock_status ON flat_product_inventory(stock_status, current_stock DESC);
      CREATE INDEX idx_fpi_movement_status ON flat_product_inventory(movement_status, last_movement_date DESC);
      CREATE INDEX idx_fpi_category ON flat_product_inventory(category_code, current_stock DESC);
      CREATE INDEX idx_fpi_low_stock ON flat_product_inventory(days_of_stock) WHERE days_of_stock < 7;
      CREATE INDEX idx_fpi_active ON flat_product_inventory(movement_status) WHERE movement_status IN ('Very Active', 'Active');
    `

    await db.query(createQuery)

    // Verify the created table
    const verifyQuery = `
      SELECT
        COUNT(*) as total_products,
        COUNT(DISTINCT product_code) as unique_products,
        COUNT(CASE WHEN current_stock > 0 THEN 1 END) as products_in_stock,
        COUNT(CASE WHEN stock_status = 'Out of Stock' THEN 1 END) as out_of_stock,
        COUNT(CASE WHEN stock_status = 'Low Stock' THEN 1 END) as low_stock,
        COUNT(CASE WHEN movement_status IN ('Very Active', 'Active') THEN 1 END) as active_products,
        MIN(first_sale_date) as earliest_sale,
        MAX(last_sale_date) as latest_sale
      FROM flat_product_inventory
    `
    const verifyResult = await db.query(verifyQuery)

    // Check for any remaining duplicates
    const duplicateCheckQuery = `
      SELECT product_code, COUNT(*) as count
      FROM flat_product_inventory
      GROUP BY product_code
      HAVING COUNT(*) > 1
    `
    const duplicateResult = await db.query(duplicateCheckQuery)

    return NextResponse.json({
      success: true,
      message: 'Successfully created flat_product_inventory with ALL historical data',
      statistics: verifyResult.rows[0],
      duplicate_check: {
        has_duplicates: duplicateResult.rows.length > 0,
        duplicate_count: duplicateResult.rows.length,
        message: duplicateResult.rows.length === 0 ?
          'NO DUPLICATES - Each product appears exactly once' :
          `Found ${duplicateResult.rows.length} duplicate product codes`
      },
      details: {
        total_products: verifyResult.rows[0].total_products,
        unique_products: verifyResult.rows[0].unique_products,
        in_stock: verifyResult.rows[0].products_in_stock,
        out_of_stock: verifyResult.rows[0].out_of_stock,
        low_stock: verifyResult.rows[0].low_stock,
        active_products: verifyResult.rows[0].active_products,
        date_range: `${verifyResult.rows[0].earliest_sale} to ${verifyResult.rows[0].latest_sale}`
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error creating flat_product_inventory:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create flat_product_inventory',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}