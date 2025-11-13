import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getMSSQLConnection } from '@/lib/mssql'
import sql from 'mssql'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { executionId } = body

    if (!executionId) {
      return NextResponse.json({
        success: false,
        error: 'Missing executionId'
      }, { status: 400 })
    }

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
      return NextResponse.json({
        success: false,
        error: 'Execution not found in PostgreSQL'
      }, { status: 404 })
    }

    const execution = pgResult.rows[0]
    const isOSOI = execution.execution_type === '0' || execution.execution_type === 0 || String(execution.execution_type) === '0'
    const type = isOSOI ? 0 : 1

    // Query MSSQL to find matching records
    const pool = await getMSSQLConnection()
    
    // First, check exact match
    const exactMatch = await pool.request()
      .input('UserCode', sql.VarChar(250), execution.field_user_code)
      .input('CustomerCode', sql.VarChar(250), execution.store_code)
      .input('PerformedOn', sql.DateTime, new Date(execution.execution_date))
      .input('Type', sql.Int, type)
      .input('ImageUrl', sql.VarChar(500), execution.image_path || null)
      .query(`
        SELECT TOP 5
          UserCode,
          CustomerCode,
          PerformedOn,
          LocationAsPerPlanogram,
          CategoryCode,
          CapturedPostImage,
          ApprovalStatus,
          ApprovedBy,
          ApprovedOn
        FROM tblPlanogramExecution
        WHERE UserCode = @UserCode
          AND CustomerCode = @CustomerCode
          AND CAST(PerformedOn AS DATE) = CAST(@PerformedOn AS DATE)
          AND LocationAsPerPlanogram = @Type
          AND (@ImageUrl IS NULL OR CapturedPostImage = @ImageUrl)
      `)

    // Also check without image filter
    const withoutImage = await pool.request()
      .input('UserCode', sql.VarChar(250), execution.field_user_code)
      .input('CustomerCode', sql.VarChar(250), execution.store_code)
      .input('PerformedOn', sql.DateTime, new Date(execution.execution_date))
      .input('Type', sql.Int, type)
      .query(`
        SELECT TOP 5
          UserCode,
          CustomerCode,
          PerformedOn,
          LocationAsPerPlanogram,
          CategoryCode,
          CapturedPostImage,
          ApprovalStatus,
          ApprovedBy,
          ApprovedOn
        FROM tblPlanogramExecution
        WHERE UserCode = @UserCode
          AND CustomerCode = @CustomerCode
          AND CAST(PerformedOn AS DATE) = CAST(@PerformedOn AS DATE)
          AND LocationAsPerPlanogram = @Type
      `)

    // Check just by user and customer (broader search)
    const broader = await pool.request()
      .input('UserCode', sql.VarChar(250), execution.field_user_code)
      .input('CustomerCode', sql.VarChar(250), execution.store_code)
      .query(`
        SELECT TOP 10
          UserCode,
          CustomerCode,
          PerformedOn,
          LocationAsPerPlanogram,
          CategoryCode,
          CapturedPostImage,
          ApprovalStatus,
          ApprovedBy,
          ApprovedOn
        FROM tblPlanogramExecution
        WHERE UserCode = @UserCode
          AND CustomerCode = @CustomerCode
        ORDER BY PerformedOn DESC
      `)

    return NextResponse.json({
      success: true,
      postgresExecution: {
        executionId: execution.execution_id,
        executionType: execution.execution_type,
        userCode: execution.field_user_code,
        storeCode: execution.store_code,
        executionDate: execution.execution_date,
        imagePath: execution.image_path,
        calculatedType: type,
        isOSOI
      },
      mssqlResults: {
        exactMatchCount: exactMatch.recordset.length,
        exactMatch: exactMatch.recordset,
        withoutImageCount: withoutImage.recordset.length,
        withoutImage: withoutImage.recordset,
        broaderSearchCount: broader.recordset.length,
        broaderSearch: broader.recordset
      }
    })

  } catch (error) {
    console.error('Verify API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    }, { status: 500 })
  }
}
