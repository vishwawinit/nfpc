import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const flatTables = [
      'flat_field_operations',
      'flat_journey_performance',
      'flat_route_analysis',
      'flat_salesman_performance'
    ]

    const tableDetails = {}

    for (const tableName of flatTables) {
      try {
        const schema = await db.getTableSchema(tableName)
        const rowCount = await db.getTableRowCount(tableName)

        // Get sample data
        const sampleQuery = `SELECT * FROM ${tableName} LIMIT 2`
        const sampleResult = await db.query(sampleQuery)

        tableDetails[tableName] = {
          columns: schema.map(col => col.column_name),
          rowCount,
          sampleData: sampleResult.rows
        }
      } catch (error) {
        tableDetails[tableName] = {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    return NextResponse.json(tableDetails)

  } catch (error) {
    console.error('Error checking flat tables:', error)
    return NextResponse.json(
      { error: 'Failed to check flat tables' },
      { status: 500 }
    )
  }
}