import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    await db.initialize()

    // Check flat_product_analytics structure
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'flat_product_analytics'
      ORDER BY ordinal_position
    `
    const columns = await db.query(columnsQuery)

    // Get sample data
    const sampleQuery = `
      SELECT * FROM flat_product_analytics
      LIMIT 5
    `
    const sample = await db.query(sampleQuery)

    // Get summary statistics - comment out for now to check structure first
    // const statsQuery = `
    //   SELECT
    //     COUNT(DISTINCT product_code) as total_products,
    //     SUM(total_sales) as grand_total_sales,
    //     SUM(total_quantity) as total_units,
    //     AVG(margin_percentage) as avg_margin
    //   FROM flat_product_analytics
    //   WHERE total_sales > 0
    // `
    // const stats = await db.query(statsQuery)

    return NextResponse.json({
      success: true,
      columns: columns.rows,
      sampleData: sample.rows,
      // stats: stats.rows[0],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Product analytics check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}