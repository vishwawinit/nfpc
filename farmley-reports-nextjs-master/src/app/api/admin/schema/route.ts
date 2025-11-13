import { NextRequest, NextResponse } from 'next/server'
import { SchemaInspector, inspectAndReport } from '@/utils/schemaInspector'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'inspect'

    switch (action) {
      case 'inspect':
        const inspection = await inspectAndReport()
        return NextResponse.json({
          success: true,
          data: inspection,
          timestamp: new Date().toISOString()
        })

      case 'sales-tables':
        const salesTables = await SchemaInspector.findSalesRelatedTables()
        return NextResponse.json({
          success: true,
          data: salesTables,
          timestamp: new Date().toISOString()
        })

      case 'sales-data':
        const salesData = await SchemaInspector.inspectSalesData()
        return NextResponse.json({
          success: true,
          data: salesData,
          timestamp: new Date().toISOString()
        })

      case 'create-statements':
        const statements = await SchemaInspector.generateCreateStatements()
        return NextResponse.json({
          success: true,
          data: statements,
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: inspect, sales-tables, sales-data, or create-statements'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Schema inspection API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to inspect database schema',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}