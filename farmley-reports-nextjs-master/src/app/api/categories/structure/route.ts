import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check columns for category performance table
    const categoryColumnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'flat_category_performance'
      ORDER BY ordinal_position
    `

    const categoryColumns = await db.query(categoryColumnsQuery)

    // Get sample data if exists
    const sampleDataQuery = `
      SELECT COUNT(*) as row_count
      FROM flat_category_performance
    `

    const sampleResult = await db.query(sampleDataQuery)

    // Get sample records
    const sampleRecordsQuery = `
      SELECT *
      FROM flat_category_performance
      LIMIT 5
    `

    const sampleRecords = await db.query(sampleRecordsQuery)

    return NextResponse.json({
      success: true,
      categoryColumns: categoryColumns.rows,
      categoryRowCount: sampleResult.rows[0].row_count,
      sampleCategoryData: sampleRecords.rows
    })

  } catch (error) {
    console.error('Check category structure error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check category structure',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}