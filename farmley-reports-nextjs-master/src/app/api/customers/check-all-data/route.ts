import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check ALL data without any filters
    const allDataQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT trx_type) as unique_trx_types,
        MIN(trx_date_only) as earliest_date,
        MAX(trx_date_only) as latest_date
      FROM flat_sales_transactions
    `
    
    const allDataResult = await query(allDataQuery, [])
    
    // Check what trx_type values exist
    const trxTypesQuery = `
      SELECT 
        trx_type,
        COUNT(*) as count
      FROM flat_sales_transactions
      GROUP BY trx_type
      ORDER BY count DESC
    `
    
    const trxTypesResult = await query(trxTypesQuery, [])
    
    // Get a few sample records
    const sampleQuery = `
      SELECT 
        trx_type,
        trx_date_only,
        store_code,
        store_name,
        net_amount
      FROM flat_sales_transactions
      LIMIT 10
    `
    
    const sampleResult = await query(sampleQuery, [])
    
    // Check other potential sales tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name LIKE '%sales%' 
        OR table_name LIKE '%customer%' 
        OR table_name LIKE '%transaction%'
        OR table_name LIKE '%order%'
      )
      ORDER BY table_name
    `
    
    const tablesResult = await query(tablesQuery, [])
    
    return NextResponse.json({
      success: true,
      allData: allDataResult.rows[0],
      trxTypes: trxTypesResult.rows,
      sampleRecords: sampleResult.rows,
      relatedTables: tablesResult.rows.map(r => r.table_name),
      message: "Complete data check"
    })
    
  } catch (error) {
    console.error('Check all data error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
