import { db } from '@/lib/database'

interface ColumnInfo {
  columnName: string
  dataType: string
  isNullable: string
  columnDefault: string | null
  characterMaximumLength: number | null
  numericPrecision: number | null
  numericScale: number | null
}

interface TableInfo {
  tableName: string
  rowCount: number
  columns: ColumnInfo[]
}

interface DatabaseSchema {
  tables: TableInfo[]
  totalTables: number
  totalRows: number
}

export class SchemaInspector {
  public static async inspectDatabase(): Promise<DatabaseSchema> {
    await db.initialize()

    // Get all table names
    const tableNames = await db.getAllTables()

    const tables: TableInfo[] = []
    let totalRows = 0

    for (const tableName of tableNames) {
      try {
        // Get table schema
        const columns = await db.getTableSchema(tableName)

        // Get row count
        const rowCount = await db.getTableRowCount(tableName)

        tables.push({
          tableName,
          rowCount,
          columns: columns.map(col => ({
            columnName: col.column_name,
            dataType: col.data_type,
            isNullable: col.is_nullable,
            columnDefault: col.column_default,
            characterMaximumLength: col.character_maximum_length,
            numericPrecision: col.numeric_precision,
            numericScale: col.numeric_scale
          }))
        })

        totalRows += rowCount
      } catch (error) {
        console.error(`Error inspecting table ${tableName}:`, error)
      }
    }

    return {
      tables,
      totalTables: tableNames.length,
      totalRows
    }
  }

  public static async generateCreateStatements(): Promise<string[]> {
    await db.initialize()

    const statements: string[] = []
    const tableNames = await db.getAllTables()

    for (const tableName of tableNames) {
      try {
        const query = `
          SELECT
            'CREATE TABLE ' || table_name || ' (' ||
            string_agg(
              column_name || ' ' || data_type ||
              case
                when character_maximum_length is not null then '(' || character_maximum_length || ')'
                when numeric_precision is not null and numeric_scale is not null then '(' || numeric_precision || ',' || numeric_scale || ')'
                when numeric_precision is not null then '(' || numeric_precision || ')'
                else ''
              end ||
              case when is_nullable = 'NO' then ' NOT NULL' else '' end ||
              case when column_default is not null then ' DEFAULT ' || column_default else '' end,
              ', '
              ORDER BY ordinal_position
            ) || ');' as create_statement
          FROM information_schema.columns
          WHERE table_name = $1
          GROUP BY table_name
        `

        const result = await db.query(query, [tableName])
        if (result.rows.length > 0) {
          statements.push(result.rows[0].create_statement)
        }
      } catch (error) {
        console.error(`Error generating CREATE statement for ${tableName}:`, error)
        statements.push(`-- Error generating CREATE statement for table: ${tableName}`)
      }
    }

    return statements
  }

  public static async findSalesRelatedTables(): Promise<string[]> {
    await db.initialize()

    const salesKeywords = [
      'transaction', 'order', 'sale', 'invoice', 'customer', 'client',
      'product', 'item', 'visit', 'journey', 'route', 'target'
    ]

    const allTables = await db.getAllTables()

    const salesTables = allTables.filter(tableName => {
      const lowerTableName = tableName.toLowerCase()
      return salesKeywords.some(keyword => lowerTableName.includes(keyword))
    })

    return salesTables
  }

  public static async inspectSalesData(): Promise<{
    transactions?: { table: string; count: number; sampleData: any[] }
    customers?: { table: string; count: number; sampleData: any[] }
    products?: { table: string; count: number; sampleData: any[] }
  }> {
    await db.initialize()

    const result: any = {}

    // Try common table name patterns
    const tablePatterns = {
      transactions: ['transactions', 'orders', 'sales', 'invoices', 'trx'],
      customers: ['customers', 'clients', 'customer_master'],
      products: ['products', 'items', 'product_master']
    }

    for (const [category, patterns] of Object.entries(tablePatterns)) {
      for (const pattern of patterns) {
        try {
          // Check if table exists
          const tables = await db.getAllTables()
          const matchingTable = tables.find(t => t.toLowerCase().includes(pattern))

          if (matchingTable) {
            // Get row count
            const count = await db.getTableRowCount(matchingTable)

            // Get sample data (first 5 rows)
            const sampleQuery = `SELECT * FROM ${matchingTable} LIMIT 5`
            const sampleResult = await db.query(sampleQuery)

            result[category] = {
              table: matchingTable,
              count,
              sampleData: sampleResult.rows
            }
            break // Found a matching table for this category
          }
        } catch (error) {
          console.error(`Error inspecting ${pattern}:`, error)
        }
      }
    }

    return result
  }

  public static async suggestOptimizedQueries(tableName: string): Promise<string[]> {
    await db.initialize()

    const suggestions: string[] = []

    try {
      // Get table schema
      const columns = await db.getTableSchema(tableName)
      const columnNames = columns.map(col => col.column_name)

      // Check for common patterns and suggest indexes
      if (columnNames.includes('created_at') || columnNames.includes('trx_date')) {
        suggestions.push(`-- Consider adding an index on date column for faster date range queries`)
        suggestions.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date ON ${tableName} (COALESCE(trx_date, created_at));`)
      }

      if (columnNames.includes('customer_code') || columnNames.includes('client_code')) {
        suggestions.push(`-- Consider adding an index on customer/client reference for faster joins`)
        suggestions.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_customer ON ${tableName} (COALESCE(customer_code, client_code));`)
      }

      if (columnNames.includes('status')) {
        suggestions.push(`-- Consider adding an index on status for faster filtering`)
        suggestions.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${tableName} (status);`)
      }

      // Suggest composite indexes for common query patterns
      if (columnNames.includes('trx_date') && columnNames.includes('status')) {
        suggestions.push(`-- Composite index for date + status filtering (common in dashboards)`)
        suggestions.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_date_status ON ${tableName} (trx_date, status);`)
      }

      // Suggest partitioning for large tables
      const rowCount = await db.getTableRowCount(tableName)
      if (rowCount > 1000000) {
        suggestions.push(`-- Table has ${rowCount.toLocaleString()} rows - consider partitioning by date`)
        suggestions.push(`-- ALTER TABLE ${tableName} PARTITION BY RANGE (trx_date);`)
      }

    } catch (error) {
      console.error(`Error analyzing table ${tableName}:`, error)
      suggestions.push(`-- Error analyzing table ${tableName}: ${error}`)
    }

    return suggestions
  }

  public static formatSchemaReport(schema: DatabaseSchema): string {
    let report = '# Database Schema Report\n\n'
    report += `**Total Tables:** ${schema.totalTables}\n`
    report += `**Total Rows:** ${schema.totalRows.toLocaleString()}\n`
    report += `**Generated:** ${new Date().toISOString()}\n\n`

    report += '## Tables Overview\n\n'

    // Sort tables by row count (descending)
    const sortedTables = schema.tables.sort((a, b) => b.rowCount - a.rowCount)

    for (const table of sortedTables) {
      report += `### ${table.tableName} (${table.rowCount.toLocaleString()} rows)\n\n`

      report += '| Column | Type | Nullable | Default |\n'
      report += '|--------|------|----------|----------|\n'

      for (const col of table.columns) {
        const dataType = col.characterMaximumLength
          ? `${col.dataType}(${col.characterMaximumLength})`
          : col.numericPrecision
          ? `${col.dataType}(${col.numericPrecision}${col.numericScale ? ',' + col.numericScale : ''})`
          : col.dataType

        report += `| ${col.columnName} | ${dataType} | ${col.isNullable} | ${col.columnDefault || 'NULL'} |\n`
      }

      report += '\n'
    }

    return report
  }
}

// Utility function to run a complete database inspection
export async function inspectAndReport(): Promise<{
  schema: DatabaseSchema
  salesTables: string[]
  salesData: any
  report: string
}> {
  console.log('Starting database inspection...')

  const schema = await SchemaInspector.inspectDatabase()
  const salesTables = await SchemaInspector.findSalesRelatedTables()
  const salesData = await SchemaInspector.inspectSalesData()
  const report = SchemaInspector.formatSchemaReport(schema)

  console.log('Database inspection completed.')

  return {
    schema,
    salesTables,
    salesData,
    report
  }
}