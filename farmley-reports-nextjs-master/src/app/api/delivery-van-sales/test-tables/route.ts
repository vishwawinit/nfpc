import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Get all tables in the database
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE '%trip%'
         OR table_name LIKE '%visit%'
         OR table_name LIKE '%delivery%'
         OR table_name LIKE '%flat%'
      ORDER BY table_name
    `

    // Check new_flat_transactions for trip_date
    const transactionsSchemaQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_transactions'
      ORDER BY ordinal_position
    `

    // Sample from transactions
    const transactionsSampleQuery = `
      SELECT * FROM new_flat_transactions
      LIMIT 1
    `

    const [tablesResult, transSchemaResult, transSampleResult] = await Promise.all([
      db.query(tablesQuery),
      db.query(transactionsSchemaQuery),
      db.query(transactionsSampleQuery)
    ])

    return NextResponse.json({
      success: true,
      relevantTables: tablesResult.rows,
      transactionsSchema: transSchemaResult.rows,
      transactionsSample: transSampleResult.rows[0] || null,
      transactionsColumns: transSampleResult.rows.length > 0 ? Object.keys(transSampleResult.rows[0]) : []
    })

  } catch (error) {
    console.error('Tables test API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
