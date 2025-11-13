import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Get all table names in the database
    const tablesQuery = `
      SELECT tablename, schemaname
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `

    const tablesResult = await db.query(tablesQuery)

    // Get detailed column information for all tables
    const columnsQuery = `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `

    const columnsResult = await db.query(columnsQuery)

    // Group columns by table
    const tableColumns = {}
    columnsResult.rows.forEach(row => {
      if (!tableColumns[row.table_name]) {
        tableColumns[row.table_name] = []
      }
      tableColumns[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable,
        default: row.column_default
      })
    })

    // Separate flat tables from regular tables
    const tables = tablesResult.rows.map(row => row.tablename)
    const flatTables = tables.filter(table => table.startsWith('flat_'))
    const regularTables = tables.filter(table => !table.startsWith('flat_') && !table.startsWith('tbl'))
    const tblTables = tables.filter(table => table.startsWith('tbl'))

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalTables: tables.length,
          flatTables: flatTables.length,
          tblTables: tblTables.length,
          otherTables: regularTables.length
        },
        tables: {
          flat: flatTables,
          tbl: tblTables,
          other: regularTables
        },
        tableColumns
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Database tables check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check database tables',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}