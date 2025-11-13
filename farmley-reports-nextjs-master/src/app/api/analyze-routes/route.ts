import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // First check what columns exist
    const columnCheckQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'new_flat_transactions'
      ORDER BY ordinal_position
    `
    const columnResult = await db.query(columnCheckQuery)
    console.log('Available columns:', columnResult.rows.map(r => r.column_name))

    // Analyze route codes to understand patterns
    const routeAnalysisQuery = `
      WITH route_patterns AS (
        SELECT
          route_code,
          LEFT(route_code, 1) as route_prefix,
          salesman_code,
          salesman_name,
          SUM(total_amount) as route_sales,
          COUNT(DISTINCT customer_code) as customer_count,
          COUNT(DISTINCT trx_code) as order_count
        FROM new_flat_transactions
        WHERE route_code IS NOT NULL AND route_code != ''
          AND trx_date_only >= date_trunc('month', CURRENT_DATE)
        GROUP BY route_code, salesman_code, salesman_name
      )
      SELECT
        route_prefix,
        COUNT(DISTINCT route_code) as route_count,
        (ARRAY_AGG(DISTINCT route_code ORDER BY route_code))[1:5] as sample_routes,
        SUM(route_sales) as total_sales
      FROM route_patterns
      GROUP BY route_prefix
      ORDER BY route_prefix
    `

    const patternResult = await db.query(routeAnalysisQuery)

    // Skip area query since column doesn't exist
    const areaResult = { rows: [] }

    // Get sample data to understand the structure
    const sampleQuery = `
      SELECT DISTINCT
        route_code,
        salesman_code,
        salesman_name,
        customer_name,
        customer_code
      FROM new_flat_transactions
      WHERE route_code IS NOT NULL AND route_code != ''
      ORDER BY route_code
      LIMIT 20
    `
    const sampleResult = await db.query(sampleQuery)

    // Group routes by their characteristics
    const routeGroupingQuery = `
      SELECT
        CASE
          WHEN route_code LIKE 'A%' THEN 'Area A Routes'
          WHEN route_code LIKE 'R%' THEN 'R-Routes (Regional)'
          WHEN route_code LIKE 'K%' THEN 'K-Routes (Key Accounts)'
          WHEN route_code LIKE 'L%' THEN 'L-Routes'
          WHEN route_code LIKE 'N%' THEN 'N-Routes'
          WHEN route_code LIKE 'S%' THEN 'S-Routes'
          WHEN route_code LIKE 'E%' THEN 'E-Routes'
          WHEN route_code LIKE 'W%' THEN 'W-Routes'
          ELSE 'Other Routes'
        END as route_group,
        COUNT(DISTINCT route_code) as route_count,
        COUNT(DISTINCT salesman_code) as salesman_count,
        SUM(total_amount) as total_sales
      FROM new_flat_transactions
      WHERE route_code IS NOT NULL AND route_code != ''
        AND trx_date_only >= date_trunc('month', CURRENT_DATE)
      GROUP BY CASE
        WHEN route_code LIKE 'A%' THEN 'Area A Routes'
        WHEN route_code LIKE 'R%' THEN 'R-Routes (Regional)'
        WHEN route_code LIKE 'K%' THEN 'K-Routes (Key Accounts)'
        WHEN route_code LIKE 'L%' THEN 'L-Routes'
        WHEN route_code LIKE 'N%' THEN 'N-Routes'
        WHEN route_code LIKE 'S%' THEN 'S-Routes'
        WHEN route_code LIKE 'E%' THEN 'E-Routes'
        WHEN route_code LIKE 'W%' THEN 'W-Routes'
        ELSE 'Other Routes'
      END
      ORDER BY total_sales DESC
    `
    const regionResult = await db.query(routeGroupingQuery)

    return NextResponse.json({
      success: true,
      analysis: {
        routePatterns: patternResult.rows,
        distinctAreas: areaResult.rows,
        sampleData: sampleResult.rows,
        regionByArea: regionResult.rows
      }
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}