import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // 1. Check if table exists
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'flat_product_sampling'
      ) as table_exists
    `)
    
    if (!tableCheckResult.rows[0]?.table_exists) {
      return NextResponse.json({
        success: false,
        message: 'Table flat_product_sampling does not exist.'
      })
    }

    // 2. Get all columns and their types
    const columnsResult = await query<{ column_name: string; data_type: string }>(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'flat_product_sampling'
      ORDER BY ordinal_position
    `)

    // 3. Get row count
    const countResult = await query(`
      SELECT COUNT(*) as total_count
      FROM flat_product_sampling
    `)

    // 4. Get sample data (5 rows) to check actual data
    const sampleResult = await query(`
      SELECT *
      FROM flat_product_sampling
      ORDER BY sampling_date DESC
      LIMIT 5
    `)

    // 5. Check for specific columns we need
    const columnSet = new Set(columnsResult.rows.map(row => row.column_name))
    const requiredColumns = [
      'sampling_date',
      'tl_code',
      'tl_name',
      'field_user_code',
      'field_user_name',
      'store_code',
      'store_name',
      'chain_name',
      'sku_code',
      'sku_name',
      'selling_price',
      'units_used',
      'units_sold',
      'customers_approached'
    ]

    const missingColumns = requiredColumns.filter(col => !columnSet.has(col))
    const availableColumns = requiredColumns.filter(col => columnSet.has(col))

    // 6. Get date range of data
    const dateRangeResult = await query(`
      SELECT 
        MIN(sampling_date) as min_date,
        MAX(sampling_date) as max_date,
        COUNT(DISTINCT sampling_date) as unique_dates
      FROM flat_product_sampling
    `)

    // 7. Check for NULL values in key columns
    const nullCheckColumns = ['tl_code', 'tl_name', 'selling_price', 'units_used', 'units_sold', 'customers_approached']
    const nullChecks: any = {}
    
    for (const col of nullCheckColumns) {
      if (columnSet.has(col)) {
        const nullResult = await query(`
          SELECT COUNT(*) as null_count
          FROM flat_product_sampling
          WHERE ${col} IS NULL
        `)
        nullChecks[col] = nullResult.rows[0].null_count
      }
    }

    return NextResponse.json({
      success: true,
      tableExists: true,
      totalRows: countResult.rows[0].total_count,
      columns: columnsResult.rows,
      requiredColumnsCheck: {
        available: availableColumns,
        missing: missingColumns
      },
      dateRange: dateRangeResult.rows[0],
      nullCounts: nullChecks,
      sampleData: sampleResult.rows,
      message: 'Product Sampling table analysis complete'
    })

  } catch (error) {
    console.error('Sampling Test API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze table',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
