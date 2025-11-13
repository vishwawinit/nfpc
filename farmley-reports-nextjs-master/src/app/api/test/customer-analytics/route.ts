import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    await db.initialize()

    // Check flat_customer_analytics structure
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'flat_customer_analytics'
      ORDER BY ordinal_position
    `
    const columns = await db.query(columnsQuery)

    // Get sample data
    const sampleQuery = `
      SELECT * FROM flat_customer_analytics
      LIMIT 5
    `
    const sample = await db.query(sampleQuery)

    // Get summary statistics
    const statsQuery = `
      SELECT
        COUNT(DISTINCT customer_code) as total_customers,
        COUNT(DISTINCT channel_code) as total_channels,
        COUNT(DISTINCT classification_code) as total_classifications,
        SUM(total_sales) as grand_total_sales,
        AVG(average_order_value) as avg_order_value,
        MAX(last_order_date) as latest_order
      FROM flat_customer_analytics
      WHERE total_sales > 0
    `
    const stats = await db.query(statsQuery)

    // Get unique channels
    const channelsQuery = `
      SELECT DISTINCT channel_code, COUNT(*) as customer_count
      FROM flat_customer_analytics
      WHERE channel_code IS NOT NULL
      GROUP BY channel_code
      ORDER BY customer_count DESC
    `
    const channels = await db.query(channelsQuery)

    // Get unique classifications
    const classificationsQuery = `
      SELECT DISTINCT classification_code, COUNT(*) as customer_count
      FROM flat_customer_analytics
      WHERE classification_code IS NOT NULL
      GROUP BY classification_code
      ORDER BY customer_count DESC
    `
    const classifications = await db.query(classificationsQuery)

    return NextResponse.json({
      success: true,
      columns: columns.rows,
      sampleData: sample.rows,
      stats: stats.rows[0],
      channels: channels.rows,
      classifications: classifications.rows,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Customer analytics check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}