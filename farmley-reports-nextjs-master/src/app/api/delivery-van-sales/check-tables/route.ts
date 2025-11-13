import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check new_flat_delivery_fulfillment columns
    const deliveryColumns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_delivery_fulfillment'
      ORDER BY ordinal_position
    `)

    // Check new_flat_stock_movements columns
    const stockColumns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_stock_movements'
      ORDER BY ordinal_position
    `)

    // Check new_flat_store_compliance columns
    const storeColumns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_store_compliance'
      ORDER BY ordinal_position
    `)

    // Get sample data count
    const deliveryCount = await db.query(`SELECT COUNT(*) as count FROM new_flat_delivery_fulfillment`)
    const stockCount = await db.query(`SELECT COUNT(*) as count FROM new_flat_stock_movements`)
    const storeCount = await db.query(`SELECT COUNT(*) as count FROM new_flat_store_compliance`)

    // Get sample row from each table
    const deliverySample = await db.query(`SELECT * FROM new_flat_delivery_fulfillment LIMIT 1`)
    const stockSample = await db.query(`SELECT * FROM new_flat_stock_movements LIMIT 1`)
    const storeSample = await db.query(`SELECT * FROM new_flat_store_compliance LIMIT 1`)

    return NextResponse.json({
      success: true,
      tables: {
        delivery_fulfillment: {
          rowCount: deliveryCount.rows[0].count,
          columns: deliveryColumns.rows,
          sample: deliverySample.rows[0]
        },
        stock_movements: {
          rowCount: stockCount.rows[0].count,
          columns: stockColumns.rows,
          sample: stockSample.rows[0]
        },
        store_compliance: {
          rowCount: storeCount.rows[0].count,
          columns: storeColumns.rows,
          sample: storeSample.rows[0]
        }
      }
    })

  } catch (error) {
    console.error('Table check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
