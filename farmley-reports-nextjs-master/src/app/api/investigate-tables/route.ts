import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Get all actual tables in the database
    const allTablesQuery = `
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `

    // Check specific tables that APIs claim to use
    const claimedTables = [
      'flat_product_sales',
      'flat_product_performance',
      'flat_product_analytics',
      'flat_customer_analytics',
      'flat_sales_targets',
      'flat_category_performance',
      'flat_journey_performance'
    ]

    // Test each claimed table
    const tableExistenceResults = []
    for (const tableName of claimedTables) {
      try {
        const testQuery = `SELECT COUNT(*) as count FROM ${tableName} LIMIT 1`
        const result = await db.query(testQuery)
        tableExistenceResults.push({
          table: tableName,
          exists: true,
          recordCount: result.rows[0].count,
          status: 'EXISTS'
        })
      } catch (error) {
        tableExistenceResults.push({
          table: tableName,
          exists: false,
          recordCount: 0,
          status: 'DOES_NOT_EXIST',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Look for alternative tables that might exist
    const alternativeTablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE '%product%'
        OR table_name LIKE '%customer%'
        OR table_name LIKE '%target%'
        OR table_name LIKE '%category%'
      ORDER BY table_name
    `

    const [allTablesResult, alternativeTablesResult] = await Promise.all([
      db.query(allTablesQuery),
      db.query(alternativeTablesQuery)
    ])

    // Check if any flat tables exist that we haven't discovered
    const flatTablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'flat_%'
      ORDER BY table_name
    `
    const flatTablesResult = await db.query(flatTablesQuery)

    return NextResponse.json({
      success: true,
      investigation: {
        total_tables_in_db: allTablesResult.rows.length,
        claimed_table_analysis: tableExistenceResults,
        existing_tables: allTablesResult.rows.map(r => r.table_name),
        flat_tables_found: flatTablesResult.rows.map(r => r.table_name),
        alternative_tables: alternativeTablesResult.rows.map(r => r.table_name),
        missing_tables: tableExistenceResults.filter(t => !t.exists).map(t => t.table),
        existing_claimed_tables: tableExistenceResults.filter(t => t.exists)
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Table investigation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to investigate tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}