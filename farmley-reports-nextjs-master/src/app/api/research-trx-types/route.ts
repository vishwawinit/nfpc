import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    await db.initialize()

    // Query 1: Get all distinct trx_type values with counts
    const trxTypesQuery = `
      SELECT DISTINCT trx_type, COUNT(*) as count
      FROM new_flat_transactions
      GROUP BY trx_type
      ORDER BY trx_type
    `

    // Query 2: Get trx_type and trx_sub_type combinations
    const trxSubTypesQuery = `
      SELECT DISTINCT trx_type, trx_sub_type, COUNT(*) as count
      FROM new_flat_transactions
      GROUP BY trx_type, trx_sub_type
      ORDER BY trx_type, trx_sub_type
    `

    // Query 3: Get sample transactions for each type
    const samplesQuery = `
      WITH ranked_transactions AS (
        SELECT
          trx_type,
          trx_sub_type,
          collection_type,
          trx_code,
          trx_status,
          customer_name,
          product_name,
          quantity,
          total_amount,
          line_reason,
          ROW_NUMBER() OVER (PARTITION BY trx_type ORDER BY trx_date DESC) as rn
        FROM new_flat_transactions
        WHERE trx_type IS NOT NULL
      )
      SELECT *
      FROM ranked_transactions
      WHERE rn <= 3
      ORDER BY trx_type, rn
    `

    // Query 4: Check for types 2 and 5 specifically
    const type2and5Query = `
      SELECT
        trx_type,
        trx_sub_type,
        collection_type,
        trx_code,
        trx_status,
        customer_code,
        customer_name,
        product_name,
        quantity,
        total_amount,
        line_reason,
        trx_date_only
      FROM new_flat_transactions
      WHERE trx_type IN (2, 5)
      LIMIT 10
    `

    const [typesResult, subTypesResult, samplesResult, type2and5Result] = await Promise.all([
      db.query(trxTypesQuery),
      db.query(trxSubTypesQuery),
      db.query(samplesQuery),
      db.query(type2and5Query)
    ])

    return NextResponse.json({
      success: true,
      data: {
        transactionTypes: typesResult.rows,
        transactionSubTypes: subTypesResult.rows,
        samples: samplesResult.rows,
        type2and5Samples: type2and5Result.rows
      }
    })

  } catch (error) {
    console.error('Research API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to research transaction types',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
