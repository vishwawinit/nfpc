import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // First, check what columns exist
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_transactions'
      ORDER BY ordinal_position
    `

    // Check return transaction types and collection types
    const returnTypesQuery = `
      SELECT
        trx_type,
        collection_type,
        COUNT(*) as count,
        SUM(ABS(total_amount)) as total_value,
        SUM(ABS(quantity)) as total_qty
      FROM new_flat_transactions
      WHERE trx_type = 4
      GROUP BY trx_type, collection_type
      ORDER BY collection_type
    `

    // Get reasons for BAD returns
    const badReasonsQuery = `
      SELECT
        line_reason,
        COUNT(*) as count,
        SUM(ABS(total_amount)) as value
      FROM new_flat_transactions
      WHERE trx_type = 4 AND collection_type = 0
      GROUP BY line_reason
      ORDER BY count DESC
    `

    // Get reasons for GOOD returns
    const goodReasonsQuery = `
      SELECT
        line_reason,
        COUNT(*) as count,
        SUM(ABS(total_amount)) as value
      FROM new_flat_transactions
      WHERE trx_type = 4 AND collection_type = 1
      GROUP BY line_reason
      ORDER BY count DESC
    `

    // Check route names - need to join
    const routeNamesQuery = `
      SELECT DISTINCT route_code
      FROM new_flat_transactions
      WHERE trx_type = 4 AND route_code IS NOT NULL
      ORDER BY route_code
      LIMIT 20
    `

    // Check for region/area/city columns
    const filterColumnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_transactions'
      AND (
        column_name ILIKE '%region%' OR
        column_name ILIKE '%area%' OR
        column_name ILIKE '%city%' OR
        column_name ILIKE '%customer%' OR
        column_name ILIKE '%salesman%' OR
        column_name ILIKE '%route%'
      )
      ORDER BY column_name
    `

    // Get sample salesman and customer codes
    const salesmenQuery = `
      SELECT DISTINCT salesman_code, salesman_name
      FROM new_flat_transactions
      WHERE trx_type = 4 AND salesman_code IS NOT NULL
      ORDER BY salesman_code
      LIMIT 10
    `

    const customersQuery = `
      SELECT DISTINCT customer_code, customer_name
      FROM new_flat_transactions
      WHERE trx_type = 4 AND customer_code IS NOT NULL
      ORDER BY customer_code
      LIMIT 10
    `

    const [columns, returnTypes, badReasons, goodReasons, routes, filterColumns, salesmen, customers] = await Promise.all([
      db.query(columnsQuery),
      db.query(returnTypesQuery),
      db.query(badReasonsQuery),
      db.query(goodReasonsQuery),
      db.query(routeNamesQuery),
      db.query(filterColumnsQuery),
      db.query(salesmenQuery),
      db.query(customersQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        columnCount: columns.rows.length,
        returnTypes: returnTypes.rows,
        badReasons: badReasons.rows,
        goodReasons: goodReasons.rows,
        routes: routes.rows,
        filterColumns: filterColumns.rows,
        salesmen: salesmen.rows,
        customers: customers.rows
      }
    })

  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
