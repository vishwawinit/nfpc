import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getMSSQLConnection } from '@/lib/mssql'
import sql from 'mssql'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { executionId } = body

    // Get execution details from PostgreSQL
    const pgResult = await query(`
      SELECT 
        execution_id,
        execution_type,
        field_user_code,
        store_code,
        execution_date,
        image_path
      FROM flat_planogram_executions 
      WHERE execution_id = $1
    `, [executionId])

    if (pgResult.rowCount === 0) {
      return NextResponse.json({ error: 'Execution not found' })
    }

    const execution = pgResult.rows[0]
    const isOSOI = execution.execution_type === '0' || execution.execution_type === 0 || String(execution.execution_type) === '0'
    const type = isOSOI ? 0 : 1

    // Parse and convert date to IST
    const executionDate = new Date(execution.execution_date)
    const istOffset = 5.5 * 60 * 60 * 1000
    const istDate = new Date(executionDate.getTime() + istOffset)
    const istDateString = istDate.toISOString().split('T')[0]

    // Format image path with backslashes
    let imagePath = execution.image_path
    if (imagePath) {
      imagePath = imagePath.replace(/\//g, '\\')
    }

    const pool = await getMSSQLConnection()

    // 1. First check what's actually in the database
    const checkQuery = `
      SELECT 
        UserCode,
        CustomerCode,
        PerformedOn,
        CAST(PerformedOn AS DATE) as DateOnly,
        LocationAsPerPlanogram,
        CategoryCode,
        CapturedPostImage,
        ApprovalStatus,
        ApprovedBy,
        ApprovedOn
      FROM tblPlanogramExecution
      WHERE UserCode = '${execution.field_user_code}'
        AND CustomerCode = '${execution.store_code}'
        AND CAST(PerformedOn AS DATE) = '${istDateString}'
        AND LocationAsPerPlanogram = ${type}
    `
    
    const checkResult = await pool.request().query(checkQuery)

    // 2. Now test the exact stored procedure parameters
    const testResult = await pool.request()
      .input('UserCode', sql.VarChar(250), execution.field_user_code)
      .input('CustomerCode', sql.VarChar(250), execution.store_code)
      .input('PerformedOn', sql.DateTime, new Date(istDateString + 'T00:00:00'))
      .input('ApprovalStatus', sql.VarChar(20), 'Approved')
      .input('ApprovedBy', sql.VarChar(250), 'admin')
      .input('Type', sql.Int, type)
      .input('CategoryCode', sql.VarChar(250), null)
      .input('ImageUrl', sql.VarChar(500), imagePath)
      .execute('USP_UPDATE_PLANOGRAM_APPROVAL')

    // Get the stored procedure result
    const spResult = testResult.recordset?.[0]

    return NextResponse.json({
      success: true,
      testParameters: {
        UserCode: execution.field_user_code,
        CustomerCode: execution.store_code,
        PerformedOn_UTC: execution.execution_date,
        PerformedOn_IST_String: istDateString,
        Type: type,
        ImagePath_Original: execution.image_path,
        ImagePath_Formatted: imagePath
      },
      mssqlRecordsFound: {
        count: checkResult.recordset.length,
        records: checkResult.recordset.map(r => ({
          UserCode: r.UserCode,
          CustomerCode: r.CustomerCode,
          DateOnly: r.DateOnly,
          PerformedOn: r.PerformedOn,
          LocationAsPerPlanogram: r.LocationAsPerPlanogram,
          CapturedPostImage: r.CapturedPostImage,
          ApprovalStatus: r.ApprovalStatus,
          ApprovedBy: r.ApprovedBy
        }))
      },
      storedProcedureResult: {
        status: spResult?.Status,
        message: spResult?.Message,
        fullResult: testResult.recordset
      },
      sqlQuery: checkQuery
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}
