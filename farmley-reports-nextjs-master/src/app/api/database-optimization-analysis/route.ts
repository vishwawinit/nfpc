import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Get all tables with their sizes and record counts
    const allTablesQuery = `
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `

    // Analyze flat tables for data quality
    const flatTableAnalysis = `
      SELECT table_name as tablename
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'flat_%'
    `

    // Check source tables that could be optimized
    const sourceTableAnalysis = `
      SELECT table_name as tablename
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'tbl%'
    `

    const [allTablesResult, flatTablesResult, sourceTablesResult] = await Promise.all([
      db.query(allTablesQuery),
      db.query(flatTableAnalysis),
      db.query(sourceTableAnalysis)
    ])

    // Analyze each flat table for data quality
    const flatTableQuality = []
    for (const table of flatTablesResult.rows) {
      const tableName = table.tablename

      try {
        // Get record count and sample data
        const analysisQuery = `
          SELECT
            COUNT(*) as total_records,
            COUNT(*) FILTER (WHERE ${tableName}::text LIKE '%unassigned%' OR ${tableName}::text LIKE '%null%') as problematic_records
          FROM ${tableName}
          LIMIT 1
        `

        // Simpler query to check basic stats
        const basicQuery = `
          SELECT COUNT(*) as total_records
          FROM ${tableName}
        `

        // Check for null/empty values in first few columns
        const columnQuery = `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = '${tableName}'
          LIMIT 5
        `

        const [basicResult, columnsResult] = await Promise.all([
          db.query(basicQuery),
          db.query(columnQuery)
        ])

        // Check null values for each column
        let nullCounts = {}
        for (const col of columnsResult.rows) {
          try {
            const nullCheckQuery = `
              SELECT
                COUNT(*) FILTER (WHERE ${col.column_name} IS NULL) as null_count,
                COUNT(*) FILTER (WHERE CAST(${col.column_name} AS TEXT) = '') as empty_count,
                COUNT(*) FILTER (WHERE LOWER(CAST(${col.column_name} AS TEXT)) = 'unassigned') as unassigned_count
              FROM ${tableName}
            `
            const nullResult = await db.query(nullCheckQuery)
            nullCounts[col.column_name] = nullResult.rows[0]
          } catch (e) {
            // Skip if column check fails
          }
        }

        flatTableQuality.push({
          table: tableName,
          total_records: basicResult.rows[0].total_records,
          columns_checked: columnsResult.rows.length,
          null_analysis: nullCounts,
          status: basicResult.rows[0].total_records > 0 ? 'HAS_DATA' : 'EMPTY'
        })

      } catch (error) {
        flatTableQuality.push({
          table: tableName,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'ERROR'
        })
      }
    }

    // Analyze source tables that are heavily used and could benefit from flat tables
    const sourceTableUsage = []
    const heavilyUsedTables = [
      'tbltrxheader',
      'tbltrxdetail',
      'tblcustomervisit',
      'tbljourney',
      'tblmovementdetail',
      'tblitem',
      'tblcustomer',
      'tbluser',
      'tblroute'
    ]

    for (const tableName of heavilyUsedTables) {
      try {
        const statsQuery = `
          SELECT
            COUNT(*) as record_count,
            pg_size_pretty(pg_total_relation_size('${tableName}')) as table_size
          FROM ${tableName}
        `
        const result = await db.query(statsQuery)
        sourceTableUsage.push({
          table: tableName,
          records: result.rows[0].record_count,
          size: result.rows[0].table_size,
          usage: getTableUsage(tableName)
        })
      } catch (error) {
        sourceTableUsage.push({
          table: tableName,
          error: 'Failed to analyze'
        })
      }
    }

    // Check for unused tables
    const unusedTablesQuery = `
      SELECT
        schemaname,
        tablename,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND n_tup_ins = 0
        AND n_tup_upd = 0
        AND n_tup_del = 0
        AND n_live_tup = 0
    `
    const unusedResult = await db.query(unusedTablesQuery)

    // Generate recommendations
    const recommendations = generateRecommendations(
      flatTableQuality,
      sourceTableUsage,
      allTablesResult.rows
    )

    return NextResponse.json({
      success: true,
      analysis: {
        total_tables: allTablesResult.rows.length,
        flat_tables: {
          count: flatTablesResult.rows.length,
          quality_analysis: flatTableQuality
        },
        source_tables: {
          count: sourceTablesResult.rows.length,
          usage_analysis: sourceTableUsage
        },
        unused_tables: unusedResult.rows,
        table_sizes: allTablesResult.rows.slice(0, 20), // Top 20 largest tables
        recommendations
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Database optimization analysis error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to analyze database',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function getTableUsage(tableName: string): string {
  const usageMap: Record<string, string> = {
    'tbltrxheader': 'Used in 8+ APIs for transaction data',
    'tbltrxdetail': 'Used in product APIs for line items',
    'tblcustomervisit': 'Used in 6+ field operations APIs',
    'tbljourney': 'Used in journey compliance API',
    'tblmovementdetail': 'Used in product details API',
    'tblitem': 'Used in product master lookups',
    'tblcustomer': 'Used in customer master lookups',
    'tbluser': 'Used in user/salesman lookups',
    'tblroute': 'Used in route lookups'
  }
  return usageMap[tableName] || 'Usage pattern unknown'
}

function generateRecommendations(
  flatTables: any[],
  sourceTables: any[],
  allTables: any[]
): any {
  const recommendations = {
    tables_to_delete: [],
    tables_to_fix: [],
    new_flat_tables_needed: [],
    optimization_opportunities: []
  }

  // Find empty or problematic flat tables
  flatTables.forEach(table => {
    if (table.status === 'EMPTY' || table.total_records === '0') {
      recommendations.tables_to_delete.push({
        table: table.table,
        reason: 'Empty table with no data',
        action: 'DELETE or FIX data pipeline'
      })
    }

    // Check for high null percentages
    if (table.null_analysis) {
      let hasIssues = false
      Object.entries(table.null_analysis).forEach(([col, stats]: [string, any]) => {
        const totalRecords = parseInt(table.total_records)
        if (totalRecords > 0) {
          const nullPercent = (stats.null_count / totalRecords) * 100
          const unassignedPercent = (stats.unassigned_count / totalRecords) * 100

          if (nullPercent > 50 || unassignedPercent > 30) {
            hasIssues = true
          }
        }
      })

      if (hasIssues) {
        recommendations.tables_to_fix.push({
          table: table.table,
          issue: 'High percentage of null/unassigned values',
          action: 'Review data pipeline and fix data quality'
        })
      }
    }
  })

  // Identify source tables that need flat table optimization
  sourceTables.forEach(table => {
    const records = parseInt(table.records || '0')

    // Large tables that could benefit from pre-aggregation
    if (records > 50000 && !table.table.includes('movement')) {
      if (table.table === 'tbltrxheader' || table.table === 'tbltrxdetail') {
        recommendations.new_flat_tables_needed.push({
          source: table.table,
          suggested_name: `flat_${table.table.replace('tbl', '')}_summary`,
          reason: `High volume table (${records} records) used in multiple APIs`,
          benefit: 'Pre-aggregate daily/monthly summaries for faster queries'
        })
      }
    }
  })

  // Specific optimization opportunities based on API usage
  recommendations.optimization_opportunities = [
    {
      opportunity: 'Create flat_visits_summary',
      source_tables: ['tblcustomervisit', 'tbljourney'],
      reason: 'Join-heavy queries in field operations APIs',
      benefit: 'Eliminate complex JOINs, improve response time by 70%'
    },
    {
      opportunity: 'Create flat_customer_360',
      source_tables: ['tblcustomer', 'flat_transactions', 'tblcustomervisit'],
      reason: 'Customer analytics require multiple table joins',
      benefit: 'Single source of truth for customer insights'
    },
    {
      opportunity: 'Create flat_inventory_movements',
      source_tables: ['tblmovementdetail'],
      reason: 'Stock movement queries are complex',
      benefit: 'Pre-calculate stock levels and movements'
    }
  ]

  // Tables that are completely unused
  allTables.forEach(table => {
    if (table.row_count === '0' && !table.tablename.includes('flat_')) {
      recommendations.tables_to_delete.push({
        table: table.tablename,
        reason: 'Source table with zero records',
        action: 'DELETE if not needed for future'
      })
    }
  })

  return recommendations
}