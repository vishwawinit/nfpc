import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing database connection...')
    
    // Test 1: Check if table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'flat_expiry_checks'
      )
    `)
    
    console.log('Table exists:', tableCheck.rows[0])
    
    // Test 2: Get table structure
    const columnsCheck = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'flat_expiry_checks'
      ORDER BY ordinal_position
      LIMIT 10
    `)
    
    console.log('Table columns:', columnsCheck.rows)
    
    // Test 3: Count rows
    const countCheck = await query(`
      SELECT COUNT(*) as total FROM flat_expiry_checks
    `)
    
    console.log('Total rows:', countCheck.rows[0])
    
    // Test 4: Get sample data
    const sampleData = await query(`
      SELECT * FROM flat_expiry_checks 
      ORDER BY created_on DESC 
      LIMIT 1
    `)
    
    console.log('Sample data:', sampleData.rows[0])
    
    // Test 5: Check date range of data
    const dateRange = await query(`
      SELECT 
        MIN(visited_date) as min_date,
        MAX(visited_date) as max_date,
        COUNT(*) as total_records
      FROM flat_expiry_checks
    `)
    
    console.log('Date range:', dateRange.rows[0])
    
    return NextResponse.json({
      success: true,
      tests: {
        tableExists: tableCheck.rows[0],
        columns: columnsCheck.rows,
        totalRows: countCheck.rows[0],
        sampleData: sampleData.rows[0],
        dateRange: dateRange.rows[0]
      }
    })
    
  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
