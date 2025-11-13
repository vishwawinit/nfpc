import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // Get min and max dates from the table
    const result = await query(`
      SELECT 
        MIN(visited_date) as min_date,
        MAX(visited_date) as max_date,
        COUNT(*) as total_records
      FROM flat_expiry_checks
    `)
    
    // Also get a sample of dates
    const sampleResult = await query(`
      SELECT DISTINCT visited_date
      FROM flat_expiry_checks
      ORDER BY visited_date DESC
      LIMIT 10
    `)
    
    return NextResponse.json({
      success: true,
      data: {
        minDate: result.rows[0].min_date,
        maxDate: result.rows[0].max_date,
        totalRecords: result.rows[0].total_records,
        sampleDates: sampleResult.rows.map(r => r.visited_date)
      }
    })
  } catch (error) {
    console.error('Test dates API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch date range',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
