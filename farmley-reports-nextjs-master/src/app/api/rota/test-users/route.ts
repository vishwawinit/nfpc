import { NextResponse } from 'next/server'
import { query } from '@/lib/database'

export async function GET() {
  try {
    // Check if table exists
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'flat_rota_activities'
      ) as exists
    `)
    
    if (!tableExists.rows[0]?.exists) {
      return NextResponse.json({
        success: false,
        error: 'Table does not exist'
      })
    }

    // Get all unique user codes in the table
    const allUsers = await query(`
      SELECT 
        user_code,
        user_name,
        COUNT(*) as activity_count,
        MIN(rota_date) as first_date,
        MAX(rota_date) as last_date
      FROM flat_rota_activities
      GROUP BY user_code, user_name
      ORDER BY activity_count DESC
      LIMIT 50
    `)

    // Check if specific users exist
    const checkUsers = await query(`
      SELECT 
        user_code,
        user_name,
        COUNT(*) as count
      FROM flat_rota_activities
      WHERE user_code IN ('TB0500', 'TB0704', 'TB1154', 'TB1264')
      GROUP BY user_code, user_name
    `)

    // Get sample data
    const sample = await query(`
      SELECT * FROM flat_rota_activities 
      LIMIT 5
    `)

    // Check column names
    const columns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'flat_rota_activities'
      ORDER BY ordinal_position
    `)

    return NextResponse.json({
      success: true,
      data: {
        totalRecords: allUsers.rows.reduce((sum, row) => sum + parseInt(row.activity_count), 0),
        uniqueUsers: allUsers.rows.length,
        allUsers: allUsers.rows,
        specificUsersCheck: {
          searched: ['TB0500', 'TB0704', 'TB1154', 'TB1264'],
          found: checkUsers.rows,
          foundCount: checkUsers.rows.length
        },
        sampleRecords: sample.rows,
        columns: columns.rows
      }
    })
  } catch (error) {
    console.error('Test users error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to test users',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
