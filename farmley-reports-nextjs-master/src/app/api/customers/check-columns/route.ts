import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check what columns actually exist in the table
    const columnQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'flat_sales_transactions' 
      ORDER BY ordinal_position
    `
    
    const columnsResult = await query(columnQuery, [])
    
    // Get a sample record to see actual data
    const sampleQuery = `
      SELECT * 
      FROM flat_sales_transactions 
      WHERE trx_type = 1 
      LIMIT 1
    `
    
    const sampleResult = await query(sampleQuery, [])
    
    // Get distinct values for common columns we think exist
    const distinctQueries: any = {}
    
    // Try common column names
    const columnsToCheck = [
      'store_code', 'store_name',
      'region_code', 'region', 'region_name',
      'city_code', 'city', 'city_name',
      'chain_code', 'chain', 'chain_name',
      'route_code', 'route', 'route_name',
      'salesman_code', 'salesman', 'salesman_name',
      'field_user_code', 'field_user', 'field_user_name',
      'channel_code', 'channel', 'channel_name'
    ]
    
    for (const col of columnsToCheck) {
      try {
        const checkQuery = `
          SELECT DISTINCT ${col}, COUNT(*) as count 
          FROM flat_sales_transactions 
          WHERE trx_type = 1 
          AND ${col} IS NOT NULL
          GROUP BY ${col}
          ORDER BY count DESC
          LIMIT 5
        `
        const result = await query(checkQuery, [])
        if (result.rows && result.rows.length > 0) {
          distinctQueries[col] = result.rows
        }
      } catch (e) {
        // Column doesn't exist, skip
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tableColumns: columnsResult.rows.map(row => ({
        name: row.column_name,
        type: row.data_type
      })),
      sampleRecord: sampleResult.rows[0],
      existingColumnsWithValues: distinctQueries,
      columnCount: columnsResult.rows.length
    })
    
  } catch (error) {
    console.error('Column check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
