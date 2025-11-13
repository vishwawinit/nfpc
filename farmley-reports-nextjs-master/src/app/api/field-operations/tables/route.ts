import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Get all tables and their structure
    const tables = await db.getAllTables()

    // Get detailed info for relevant tables
    const relevantTables = []

    for (const tableName of tables) {
      // Check for field operations related tables
      if (
        tableName.toLowerCase().includes('visit') ||
        tableName.toLowerCase().includes('journey') ||
        tableName.toLowerCase().includes('route') ||
        tableName.toLowerCase().includes('salesman') ||
        tableName.toLowerCase().includes('salesmen') ||
        tableName.toLowerCase().includes('user') ||
        tableName.toLowerCase().includes('employee') ||
        tableName.toLowerCase().includes('field') ||
        tableName.toLowerCase().includes('tracking') ||
        tableName.toLowerCase().includes('location') ||
        tableName.toLowerCase().includes('check') ||
        tableName.toLowerCase().includes('attendance')
      ) {
        const schema = await db.getTableSchema(tableName)
        const rowCount = await db.getTableRowCount(tableName)

        relevantTables.push({
          tableName,
          rowCount,
          columns: schema
        })
      }
    }

    // Also get transaction and customer tables for reference
    const additionalTables = ['transactions', 'customers', 'flattransactions', 'flatcustomers', 'flatsalesmen', 'flatroutes', 'flatvisits']

    for (const tableName of additionalTables) {
      if (tables.includes(tableName)) {
        const schema = await db.getTableSchema(tableName)
        const rowCount = await db.getTableRowCount(tableName)

        relevantTables.push({
          tableName,
          rowCount,
          columns: schema
        })
      }
    }

    return NextResponse.json({
      allTables: tables,
      relevantTables,
      message: 'Database tables for Field Operations'
    })

  } catch (error) {
    console.error('Error fetching database tables:', error)
    return NextResponse.json(
      { error: 'Failed to fetch database tables', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}