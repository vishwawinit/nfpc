import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getMSSQLConnection } from '@/lib/mssql'
import sql from 'mssql'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { executionId } = body

    // Get from PostgreSQL first
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
      return NextResponse.json({ error: 'Not found in PostgreSQL' })
    }

    const pgData = pgResult.rows[0]
    const pool = await getMSSQLConnection()
    
    // 1. Check if ANY record exists for this user/customer
    const anyRecord = await pool.request()
      .query(`
        SELECT TOP 5 * FROM tblPlanogramExecution
        WHERE UserCode = '${pgData.field_user_code}'
        AND CustomerCode = '${pgData.store_code}'
        ORDER BY PerformedOn DESC
      `)
    
    // 2. Check records on the specific date
    const dateRecords = await pool.request()
      .input('UserCode', sql.VarChar, pgData.field_user_code)
      .input('CustomerCode', sql.VarChar, pgData.store_code)
      .query(`
        SELECT 
          UserCode,
          CustomerCode,
          PerformedOn,
          CAST(PerformedOn AS DATE) as DateOnly,
          LocationAsPerPlanogram,
          CategoryCode,
          CapturedPostImage,
          ApprovalStatus,
          ApprovedBy
        FROM tblPlanogramExecution
        WHERE UserCode = @UserCode
        AND CustomerCode = @CustomerCode
        AND CAST(PerformedOn AS DATE) = CAST('${new Date(pgData.execution_date).toISOString().split('T')[0]}' AS DATE)
      `)
    
    // 3. Check what dates exist for this user/customer
    const allDates = await pool.request()
      .query(`
        SELECT DISTINCT 
          CAST(PerformedOn AS DATE) as DateOnly,
          COUNT(*) as RecordCount
        FROM tblPlanogramExecution
        WHERE UserCode = '${pgData.field_user_code}'
        AND CustomerCode = '${pgData.store_code}'
        GROUP BY CAST(PerformedOn AS DATE)
        ORDER BY DateOnly DESC
      `)

    // 4. Check if the image path exists anywhere
    const imageCheck = await pool.request()
      .query(`
        SELECT TOP 5 
          UserCode,
          CustomerCode,
          PerformedOn,
          CapturedPostImage
        FROM tblPlanogramExecution
        WHERE CapturedPostImage LIKE '%${pgData.image_path?.split('\\').pop()?.split('/').pop() || 'NOIMAGE'}%'
      `)

    return NextResponse.json({
      success: true,
      postgresData: {
        executionId: pgData.execution_id,
        userCode: pgData.field_user_code,
        storeCode: pgData.store_code,
        executionDate: pgData.execution_date,
        executionDateFormatted: new Date(pgData.execution_date).toISOString(),
        executionDateOnly: new Date(pgData.execution_date).toISOString().split('T')[0],
        imagePath: pgData.image_path,
        executionType: pgData.execution_type
      },
      mssqlData: {
        anyRecordsForUserStore: {
          found: anyRecord.recordset.length > 0,
          count: anyRecord.recordset.length,
          records: anyRecord.recordset
        },
        recordsOnSpecificDate: {
          found: dateRecords.recordset.length > 0,
          count: dateRecords.recordset.length,
          records: dateRecords.recordset
        },
        allDatesForUserStore: {
          count: allDates.recordset.length,
          dates: allDates.recordset
        },
        imagePathCheck: {
          found: imageCheck.recordset.length > 0,
          count: imageCheck.recordset.length,
          records: imageCheck.recordset
        }
      }
    })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}
