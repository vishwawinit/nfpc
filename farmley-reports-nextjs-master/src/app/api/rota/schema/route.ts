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
        error: 'Table does not exist',
        message: 'flat_rota_activities table not found'
      })
    }

    // Get all columns
    const columns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'flat_rota_activities'
      ORDER BY ordinal_position
    `)

    // Get total count
    const countResult = await query('SELECT COUNT(*) as count FROM flat_rota_activities')

    // Get sample data
    const sample = await query('SELECT * FROM flat_rota_activities LIMIT 3')

    // Check data fill percentage for each column
    const dataAnalysis = []
    for (const col of columns.rows) {
      const nonNullResult = await query(`
        SELECT COUNT(*) as count 
        FROM flat_rota_activities 
        WHERE ${col.column_name} IS NOT NULL 
          AND CAST(${col.column_name} AS TEXT) != ''
      `)
      
      const fillCount = parseInt(nonNullResult.rows[0].count)
      const totalCount = parseInt(countResult.rows[0].count)
      const percentage = totalCount > 0 ? ((fillCount / totalCount) * 100).toFixed(1) : '0'
      
      dataAnalysis.push({
        column: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable,
        filled: fillCount,
        total: totalCount,
        percentage: `${percentage}%`
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        tableExists: true,
        totalRows: parseInt(countResult.rows[0].count),
        columns: columns.rows,
        dataAnalysis,
        sampleData: sample.rows
      }
    })
  } catch (error) {
    console.error('Schema check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check schema',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
