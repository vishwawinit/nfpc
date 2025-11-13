import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // 1. Get all tables and their record counts
    const allTablesQuery = `
      SELECT
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    const allTablesResult = await db.query(allTablesQuery)

    // 2. Analyze each table for record count and data quality
    const tableAnalysis = []

    for (const table of allTablesResult.rows) {
      const tableName = table.table_name

      try {
        // Get basic stats
        const countQuery = `SELECT COUNT(*) as record_count FROM ${tableName}`
        const countResult = await db.query(countQuery)

        // Get sample data to check quality
        const sampleQuery = `SELECT * FROM ${tableName} LIMIT 5`
        const sampleResult = await db.query(sampleQuery)

        // Check for columns with mostly null/empty values
        const columnsQuery = `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = '${tableName}'
          ORDER BY ordinal_position
        `
        const columnsResult = await db.query(columnsQuery)

        // Analyze null percentages for key columns (first 5)
        const nullAnalysis = []
        for (const col of columnsResult.rows.slice(0, 5)) {
          try {
            const nullQuery = `
              SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN ${col.column_name} IS NULL THEN 1 END) as null_count,
                COUNT(CASE WHEN CAST(${col.column_name} AS TEXT) = '' THEN 1 END) as empty_count,
                COUNT(CASE WHEN LOWER(CAST(${col.column_name} AS TEXT)) IN ('unassigned', 'unknown', 'n/a') THEN 1 END) as unassigned_count
              FROM ${tableName}
            `
            const nullResult = await db.query(nullQuery)
            const stats = nullResult.rows[0]

            if (stats.total > 0) {
              const nullPercent = (stats.null_count / stats.total) * 100
              const emptyPercent = (stats.empty_count / stats.total) * 100
              const unassignedPercent = (stats.unassigned_count / stats.total) * 100

              nullAnalysis.push({
                column: col.column_name,
                null_percent: Math.round(nullPercent),
                empty_percent: Math.round(emptyPercent),
                unassigned_percent: Math.round(unassignedPercent),
                data_quality: (nullPercent + emptyPercent + unassignedPercent) < 20 ? 'GOOD' : 'POOR'
              })
            }
          } catch (e) {
            // Skip column if analysis fails
          }
        }

        // Check if table has date columns for August 2025 data
        let hasAugust2025Data = false
        const dateColumns = columnsResult.rows.filter(c =>
          c.data_type.includes('date') || c.data_type.includes('timestamp')
        )

        for (const dateCol of dateColumns) {
          try {
            const augustQuery = `
              SELECT COUNT(*) as august_count
              FROM ${tableName}
              WHERE ${dateCol.column_name} >= '2025-08-01'
                AND ${dateCol.column_name} < '2025-09-01'
            `
            const augustResult = await db.query(augustQuery)
            if (augustResult.rows[0].august_count > 0) {
              hasAugust2025Data = true
              break
            }
          } catch (e) {
            // Skip if date check fails
          }
        }

        tableAnalysis.push({
          table: tableName,
          type: tableName.startsWith('flat_') ? 'FLAT_TABLE' :
                tableName.startsWith('tbl') ? 'SOURCE_TABLE' : 'OTHER',
          record_count: parseInt(countResult.rows[0].record_count),
          column_count: columnsResult.rows.length,
          null_analysis: nullAnalysis,
          has_august_2025_data: hasAugust2025Data,
          sample_data_available: sampleResult.rows.length > 0,
          status: countResult.rows[0].record_count > 0 ? 'HAS_DATA' : 'EMPTY'
        })

      } catch (error) {
        tableAnalysis.push({
          table: tableName,
          error: error instanceof Error ? error.message : 'Failed to analyze',
          status: 'ERROR'
        })
      }
    }

    // 3. Categorize tables
    const flatTables = tableAnalysis.filter(t => t.type === 'FLAT_TABLE')
    const sourceTables = tableAnalysis.filter(t => t.type === 'SOURCE_TABLE')
    const emptyTables = tableAnalysis.filter(t => t.status === 'EMPTY')
    const problematicTables = tableAnalysis.filter(t => {
      if (t.null_analysis) {
        return t.null_analysis.some(col => col.data_quality === 'POOR')
      }
      return false
    })

    // 4. Generate specific recommendations
    const recommendations = {
      tables_to_delete: [],
      tables_to_fix: [],
      new_flat_tables_needed: [],
      optimization_opportunities: []
    }

    // Tables to delete (empty or unused)
    emptyTables.forEach(table => {
      recommendations.tables_to_delete.push({
        table: table.table,
        reason: 'Empty table with no records',
        action: 'DELETE if not needed'
      })
    })

    // Tables with data quality issues
    problematicTables.forEach(table => {
      if (table.type === 'FLAT_TABLE') {
        recommendations.tables_to_fix.push({
          table: table.table,
          issues: table.null_analysis?.filter(c => c.data_quality === 'POOR').map(c => c.column),
          action: 'Fix data pipeline to populate correctly'
        })
      }
    })

    // Identify heavily used source tables that need flat tables
    const heavyUsageTables = [
      { source: 'tbltrxheader', usage: 'Used in 8+ APIs' },
      { source: 'tbltrxdetail', usage: 'Used in product APIs' },
      { source: 'tblcustomervisit', usage: 'Used in 6+ field APIs' },
      { source: 'tbljourney', usage: 'Used in compliance APIs' }
    ]

    heavyUsageTables.forEach(tableInfo => {
      const sourceTable = sourceTables.find(t => t.table === tableInfo.source)
      if (sourceTable && sourceTable.record_count > 50000) {
        // Check if flat table already exists
        const flatExists = flatTables.some(f =>
          f.table.includes(tableInfo.source.replace('tbl', ''))
        )

        if (!flatExists) {
          recommendations.new_flat_tables_needed.push({
            source: tableInfo.source,
            suggested_name: `flat_${tableInfo.source.replace('tbl', '')}_analytics`,
            records: sourceTable.record_count,
            reason: `High volume (${sourceTable.record_count} records) and ${tableInfo.usage}`,
            benefit: 'Pre-aggregate for 70%+ faster queries'
          })
        }
      }
    })

    // Specific optimization opportunities based on current API patterns
    recommendations.optimization_opportunities = [
      {
        name: 'flat_customer_journey',
        source_tables: ['tblcustomervisit', 'tbljourney', 'tbltrxheader'],
        purpose: 'Combine visit, journey, and sales data',
        benefit: 'Eliminate 3-way JOINs in field operations APIs',
        estimated_improvement: '80% faster journey compliance queries'
      },
      {
        name: 'flat_product_inventory',
        source_tables: ['tblmovementdetail', 'tblitem'],
        purpose: 'Pre-calculate stock levels and movements',
        benefit: 'Real-time inventory without complex aggregations',
        estimated_improvement: '60% faster stock queries'
      },
      {
        name: 'flat_salesman_daily_performance',
        source_tables: ['tbltrxheader', 'tblcustomervisit', 'tbluser'],
        purpose: 'Daily salesman metrics pre-calculated',
        benefit: 'Instant salesman dashboards',
        estimated_improvement: '90% faster performance reports'
      }
    ]

    // 5. Summary statistics
    const summary = {
      total_tables: tableAnalysis.length,
      flat_tables: flatTables.length,
      source_tables: sourceTables.length,
      empty_tables: emptyTables.length,
      tables_with_issues: problematicTables.length,
      tables_with_august_data: tableAnalysis.filter(t => t.has_august_2025_data).length,
      largest_tables: tableAnalysis
        .filter(t => t.record_count)
        .sort((a, b) => b.record_count - a.record_count)
        .slice(0, 10)
        .map(t => ({ table: t.table, records: t.record_count }))
    }

    return NextResponse.json({
      success: true,
      summary,
      recommendations,
      detailed_analysis: {
        flat_tables: flatTables.sort((a, b) => (b.record_count || 0) - (a.record_count || 0)),
        source_tables: sourceTables.sort((a, b) => (b.record_count || 0) - (a.record_count || 0)),
        empty_tables: emptyTables,
        problematic_tables: problematicTables
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Database analysis error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze database',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}