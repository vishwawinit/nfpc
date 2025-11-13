import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    // First check if the table exists and has data
    const tableCheck = await query(`
      SELECT 
        COUNT(*) as total_rows,
        MIN(visit_date) as min_date,
        MAX(visit_date) as max_date,
        COUNT(DISTINCT field_user_code) as unique_users,
        COUNT(DISTINCT store_code) as unique_stores,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_gps
      FROM flat_store_visits
    `)

    // Get sample data
    const sampleData = await query(`
      SELECT *
      FROM flat_store_visits
      LIMIT 5
    `)

    // Get distinct values for filters
    const regions = await query(`
      SELECT DISTINCT region_code 
      FROM flat_store_visits 
      WHERE region_code IS NOT NULL 
      ORDER BY region_code
      LIMIT 10
    `)

    const chains = await query(`
      SELECT DISTINCT chain_name 
      FROM flat_store_visits 
      WHERE chain_name IS NOT NULL 
      ORDER BY chain_name
      LIMIT 10
    `)

    const users = await query(`
      SELECT DISTINCT field_user_code, field_user_name
      FROM flat_store_visits 
      WHERE field_user_code IS NOT NULL 
      ORDER BY field_user_name
      LIMIT 10
    `)

    const teamLeaders = await query(`
      SELECT DISTINCT tl_code, tl_name
      FROM flat_store_visits 
      WHERE tl_code IS NOT NULL 
      ORDER BY tl_name
      LIMIT 10
    `)

    return NextResponse.json({
      success: true,
      tableStats: tableCheck.rows[0],
      sampleData: sampleData.rows,
      filterOptions: {
        regions: regions.rows,
        chains: chains.rows,
        users: users.rows,
        teamLeaders: teamLeaders.rows
      },
      message: 'Debug info retrieved successfully'
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
