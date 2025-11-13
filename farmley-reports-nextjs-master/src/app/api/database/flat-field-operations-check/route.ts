import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check flat_field_operations table structure
    const structureQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'flat_field_operations'
      ORDER BY ordinal_position
    `

    // Get sample data from whatever columns exist
    const dataQuery = `
      SELECT *
      FROM flat_field_operations
      LIMIT 10
    `

    // Count total field operations records
    const countQuery = `SELECT COUNT(*) as total_records FROM flat_field_operations`

    // Basic data availability check
    const dataAvailabilityQuery = `
      SELECT
        COUNT(*) as total_records
      FROM flat_field_operations
    `

    const [structureResult, dataResult, countResult, availabilityResult] = await Promise.all([
      db.query(structureQuery),
      db.query(dataQuery),
      db.query(countQuery),
      db.query(dataAvailabilityQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        tableStructure: structureResult.rows,
        sampleFieldOps: dataResult.rows,
        totalRecords: countResult.rows[0].total_records,
        dataAvailability: availabilityResult.rows[0],
        comparison: {
          flatTableRecords: dataResult.rows.length
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Flat field operations check error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check flat_field_operations table',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}