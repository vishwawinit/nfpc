import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check columns in new_flat_transactions
    const transactionsColumnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_transactions'
        AND (column_name ILIKE '%region%' OR column_name ILIKE '%area%' OR column_name ILIKE '%territory%')
      ORDER BY ordinal_position
    `

    // Check columns in new_flat_journey_management
    const journeyColumnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_journey_management'
        AND (column_name ILIKE '%region%' OR column_name ILIKE '%area%' OR column_name ILIKE '%territory%')
      ORDER BY ordinal_position
    `

    // Get all columns from new_flat_transactions
    const allTransactionsColumnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_transactions'
      ORDER BY ordinal_position
    `

    // Get all columns from new_flat_journey_management
    const allJourneyColumnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_journey_management'
      ORDER BY ordinal_position
    `

    // Sample data from new_flat_transactions
    const sampleTransactionsQuery = `
      SELECT * FROM new_flat_transactions
      WHERE route_code IS NOT NULL
      LIMIT 1
    `

    // Sample data from new_flat_journey_management
    const sampleJourneyQuery = `
      SELECT * FROM new_flat_journey_management
      WHERE route_code IS NOT NULL
      LIMIT 1
    `

    const [
      transactionsRegionCols,
      journeyRegionCols,
      allTransactionsCols,
      allJourneyCols,
      sampleTransactions,
      sampleJourney
    ] = await Promise.all([
      db.query(transactionsColumnsQuery),
      db.query(journeyColumnsQuery),
      db.query(allTransactionsColumnsQuery),
      db.query(allJourneyColumnsQuery),
      db.query(sampleTransactionsQuery),
      db.query(sampleJourneyQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        regionRelatedColumns: {
          transactions: transactionsRegionCols.rows,
          journey: journeyRegionCols.rows
        },
        allColumns: {
          transactions: allTransactionsCols.rows,
          journey: allJourneyCols.rows
        },
        sampleData: {
          transaction: sampleTransactions.rows[0] || null,
          journey: sampleJourney.rows[0] || null
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Region check API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check region data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
