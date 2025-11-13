import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLConnection } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const pool = await getMSSQLConnection()
    
    // Query to get stored procedure parameters
    const result = await pool.request().query(`
      SELECT 
        p.name AS parameter_name,
        t.name AS data_type,
        p.max_length,
        p.is_output
      FROM sys.parameters p
      INNER JOIN sys.types t ON p.user_type_id = t.user_type_id
      WHERE object_id = OBJECT_ID('dbo.USP_UPDATE_PLANOGRAM_APPROVAL')
      ORDER BY p.parameter_id
    `)

    return NextResponse.json({
      success: true,
      procedureName: 'USP_UPDATE_PLANOGRAM_APPROVAL',
      parameters: result.recordset
    })
  } catch (error) {
    console.error('Error fetching stored procedure parameters:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
