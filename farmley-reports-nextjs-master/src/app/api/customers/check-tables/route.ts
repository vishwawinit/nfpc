import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Find all tables that might contain customer data
    const customerTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name LIKE '%customer%' 
        OR table_name LIKE '%store%'
        OR table_name LIKE '%client%'
        OR table_name LIKE '%account%'
      )
      ORDER BY table_name
    `
    
    const customerTables = await query(customerTablesQuery, [])
    
    // Find all tables that might contain sales/transaction data
    const salesTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name LIKE '%sales%' 
        OR table_name LIKE '%transaction%'
        OR table_name LIKE '%order%'
        OR table_name LIKE '%invoice%'
      )
      ORDER BY table_name
    `
    
    const salesTables = await query(salesTablesQuery, [])
    
    // Check each potential customer table for data
    const customerDataChecks: any = {}
    for (const table of customerTables.rows) {
      try {
        const checkQuery = `SELECT COUNT(*) as count FROM ${table.table_name} LIMIT 1`
        const result = await query(checkQuery, [])
        
        // Get columns for tables with data
        if (result.rows[0].count > 0) {
          const columnsQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '${table.table_name}'
            ORDER BY ordinal_position
            LIMIT 20
          `
          const columns = await query(columnsQuery, [])
          
          // Get sample data
          const sampleQuery = `SELECT * FROM ${table.table_name} LIMIT 2`
          const sample = await query(sampleQuery, [])
          
          customerDataChecks[table.table_name] = {
            count: result.rows[0].count,
            columns: columns.rows.map(c => `${c.column_name} (${c.data_type})`),
            sample: sample.rows
          }
        }
      } catch (e) {
        // Table might not be accessible
      }
    }
    
    // Check each potential sales table for data
    const salesDataChecks: any = {}
    for (const table of salesTables.rows) {
      try {
        const checkQuery = `SELECT COUNT(*) as count FROM ${table.table_name} LIMIT 1`
        const result = await query(checkQuery, [])
        
        // Get columns for tables with data
        if (result.rows[0].count > 0) {
          const columnsQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '${table.table_name}'
            ORDER BY ordinal_position
            LIMIT 20
          `
          const columns = await query(columnsQuery, [])
          
          // Get sample data
          const sampleQuery = `SELECT * FROM ${table.table_name} LIMIT 2`
          const sample = await query(sampleQuery, [])
          
          salesDataChecks[table.table_name] = {
            count: result.rows[0].count,
            columns: columns.rows.map(c => `${c.column_name} (${c.data_type})`),
            sample: sample.rows
          }
        }
      } catch (e) {
        // Table might not be accessible
      }
    }
    
    return NextResponse.json({
      success: true,
      customerTables: customerTables.rows.map(r => r.table_name),
      salesTables: salesTables.rows.map(r => r.table_name),
      customerData: customerDataChecks,
      salesData: salesDataChecks,
      message: "Found the following tables with data"
    })
    
  } catch (error) {
    console.error('Check tables error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
