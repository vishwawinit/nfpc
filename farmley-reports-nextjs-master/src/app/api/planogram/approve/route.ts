import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getMSSQLConnection } from '@/lib/mssql'
import sql from 'mssql'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { executionId, approvalStatus, approvedBy = 'admin' } = body

    if (!executionId || !approvalStatus) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: executionId and approvalStatus'
      }, { status: 400 })
    }

    // Validate approval status
    const validStatuses = ['approved', 'rejected', 'skipped']
    if (!validStatuses.includes(approvalStatus.toLowerCase())) {
      return NextResponse.json({
        success: false,
        error: 'Invalid approval status. Must be: approved, rejected, or skipped'
      }, { status: 400 })
    }

    // First, get the execution details to determine the type and get all required fields for MSSQL
    const executionCheck = await query(`
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

    if (executionCheck.rowCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Execution not found'
      }, { status: 404 })
    }

    const execution = executionCheck.rows[0]
    const executionType = execution.execution_type
    // Handle both string '0' and number 0 for execution type
    const isOSOI = executionType === '0' || executionType === 0 || String(executionType) === '0'
    const reportType = isOSOI ? 'OSOI' : 'Planogram'
    
    console.log(`Processing ${reportType} approval for execution ${executionId} by ${approvedBy}`)
    console.log('Execution details:', {
      userCode: execution.field_user_code,
      storeCode: execution.store_code,
      executionDate: execution.execution_date,
      executionType: executionType,
      executionTypeType: typeof executionType,
      isOSOI: isOSOI
    })

    // Update both databases in parallel
    const updatePromises = []

    // 1. Update PostgreSQL
    const pgPromise = query(`
      UPDATE flat_planogram_executions
      SET 
        approval_status = $1,
        approved_by = $2,
        approved_on = CURRENT_TIMESTAMP
      WHERE execution_id = $3
      RETURNING *
    `, [approvalStatus.toLowerCase(), approvedBy, executionId])
    updatePromises.push(pgPromise)

    // 2. Update MSSQL using stored procedure
    // Note: USP_UPDATE_PLANOGRAM_APPROVAL uses composite key instead of execution_id
    // Parameters: UserCode, CustomerCode, PerformedOn, ApprovalStatus, ApprovedBy, Type, CategoryCode, ImageUrl
    const mssqlPromise = (async () => {
      try {
        const pool = await getMSSQLConnection()
        
        // Capitalize first letter for MSSQL (it expects 'Approved', 'Rejected', 'Skipped')
        const mssqlApprovalStatus = approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1).toLowerCase()
        
        // Type: 0 for OSOI, 1 for Planogram
        const type = isOSOI ? 0 : 1
        
        // Parse the execution date - PostgreSQL stores it as UTC timestamp
        // MSSQL stores it as IST local timestamp (no Z suffix)
        // We need to convert UTC to IST by adding 5.5 hours
        const executionDate = new Date(execution.execution_date)
        const istOffset = 5.5 * 60 * 60 * 1000 // 5.5 hours in milliseconds
        const istTimestamp = new Date(executionDate.getTime() + istOffset)
        
        // Format as IST timestamp string WITHOUT Z (local time format for MSSQL)
        // Format: "2025-10-10 00:00:00.000" (no Z at the end)
        const istDateTimeString = istTimestamp.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23)
        
        // Image path - use as-is from the database
        const imagePath = execution.image_path
        
        // Log exact parameter values being sent to MSSQL
        console.log('MSSQL Parameters being sent:', {
          UserCode: execution.field_user_code,
          CustomerCode: execution.store_code,
          PerformedOn_UTC: execution.execution_date,
          PerformedOn_IST_String: istDateTimeString,
          ApprovalStatus: mssqlApprovalStatus,
          ApprovedBy: approvedBy,
          Type: type,
          CategoryCode: null,
          ImageUrl: imagePath
        })
        
        const result = await pool.request()
          .input('UserCode', sql.VarChar(250), execution.field_user_code)
          .input('CustomerCode', sql.VarChar(250), execution.store_code)
          .input('PerformedOn', sql.VarChar(50), istDateTimeString) // Send as string in IST format (no Z)
          .input('ApprovalStatus', sql.VarChar(20), mssqlApprovalStatus)
          .input('ApprovedBy', sql.VarChar(250), approvedBy)
          .input('Type', sql.Int, type)
          .input('CategoryCode', sql.VarChar(250), null) // NULL to update all categories for this activity
          .input('ImageUrl', sql.VarChar(500), imagePath) // Use specific image path
          .execute('USP_UPDATE_PLANOGRAM_APPROVAL')
        
        // Check the stored procedure result
        const spResult = result.recordset && result.recordset.length > 0 ? result.recordset[0] : null
        const spStatus = spResult?.Status
        const spMessage = spResult?.Message
        
        console.log('MSSQL Stored Procedure Result:', { 
          status: spStatus,
          message: spMessage,
          recordset: result.recordset
        })
        
        if (spStatus !== 'Success') {
          console.error(`MSSQL stored procedure returned non-success status:`, {
            status: spStatus,
            message: spMessage,
            executionDetails: {
              userCode: execution.field_user_code,
              customerCode: execution.store_code,
              performedOn: execution.execution_date,
              approvalStatus: mssqlApprovalStatus,
              approvedBy,
              type,
              imageUrl: execution.image_path
            }
          })
          return null // Treat as failure
        }
        
        console.log(`MSSQL update VERIFIED successful for ${reportType} approval:`, { 
          userCode: execution.field_user_code,
          customerCode: execution.store_code,
          performedOn: execution.execution_date,
          approvalStatus: mssqlApprovalStatus,
          approvedBy,
          type,
          imageUrl: execution.image_path,
          rowsAffected: result.rowsAffected
        })
        return result
      } catch (mssqlError) {
        console.error(`MSSQL update failed for ${reportType} approval:`, mssqlError)
        console.error('MSSQL error details:', {
          userCode: execution.field_user_code,
          customerCode: execution.store_code,
          performedOn: execution.execution_date,
          approvalStatus: approvalStatus,
          approvedBy,
          errorMessage: mssqlError instanceof Error ? mssqlError.message : 'Unknown error'
        })
        // Don't throw - we'll continue even if MSSQL fails
        return null
      }
    })()
    updatePromises.push(mssqlPromise)

    // Wait for both updates
    const results = await Promise.all(updatePromises)
    const pgResult = results[0] // This is always QueryResult from PostgreSQL
    const mssqlResult = results[1] // This is either IProcedureResult or null

    // Log status of both database updates
    const pgSuccess = pgResult && 'rowCount' in pgResult && pgResult.rowCount !== null && pgResult.rowCount > 0
    const mssqlSuccess = mssqlResult !== null

    if (!pgSuccess) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update PostgreSQL database'
      }, { status: 500 })
    }

    // Log warning if MSSQL failed but continue
    if (!mssqlSuccess) {
      console.warn(`Warning: MSSQL update failed for ${reportType}, but PostgreSQL update succeeded`)
    }

    // Get the updated record data (pgResult is guaranteed to exist here due to pgSuccess check)
    const updatedRecord = 'rows' in pgResult ? pgResult.rows[0] : null

    return NextResponse.json({
      success: true,
      message: `Successfully ${approvalStatus} the ${reportType} execution`,
      data: {
        executionId,
        executionType: reportType,
        approvalStatus: approvalStatus.toLowerCase(),
        approvedBy,
        approvedOn: updatedRecord?.approved_on || new Date().toISOString(),
        databasesUpdated: {
          postgresql: pgSuccess,
          mssql: mssqlSuccess
        }
      }
    })

  } catch (error) {
    console.error('Approval API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update approval status',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
    }, { status: 500 })
  }
}

