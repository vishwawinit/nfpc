import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Enable ISR with 60 second revalidation

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // CRITICAL: Planogram uses execution_type = '1' (OSOI uses '0')
    conditions.push(`execution_type = '1'`)

    // Get hierarchy-based allowed users - ALWAYS apply if not admin
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Validate user access
    const validation = await validateApiUser(loginUserCode)
    if (!validation.isValid) {
      return validation.response!
    }
    let allowedUserCodes: string[] = []
    
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }

    // Add hierarchy filter if not admin - this restricts data to only managed users
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
      conditions.push(`field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    if (searchParams.has('startDate')) {
      conditions.push(`execution_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
    }

    if (searchParams.has('endDate')) {
      conditions.push(`execution_date <= $${paramIndex}`)
      params.push(searchParams.get('endDate'))
      paramIndex++
    }

    if (searchParams.has('userCode')) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    if (searchParams.has('storeCode')) {
      conditions.push(`store_code = $${paramIndex}`)
      params.push(searchParams.get('storeCode'))
      paramIndex++
    }

    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    if (searchParams.has('chainCode')) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(searchParams.get('chainCode'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = parseInt(searchParams.get('limit') || '100000')

    // Check if flat_planogram_executions table exists
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'flat_planogram_executions'
      ) as table_exists
    `)
    
    if (!tableCheckResult.rows[0]?.table_exists) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'Planogram execution tracking not yet configured. Table flat_planogram_executions does not exist.',
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      })
    }

    const result = await query(`
      SELECT
        execution_date as "executionDate",
        execution_id as "executionId",
        store_code as "storeCode",
        store_name as "storeName",
        chain_code as "chainCode",
        chain_name as "chainName",
        field_user_code as "userCode",
        field_user_name as "userName",
        tl_code as "teamLeaderCode",
        tl_name as "teamLeaderName",
        execution_type,
        compliance_status,
        compliance_score,
        image_path,
        created_on,
        approval_status as "approvalStatus",
        approved_by as "approvedBy",
        approved_on as "approvedOn"
      FROM flat_planogram_executions
      ${whereClause}
      ORDER BY execution_date DESC
      LIMIT $${paramIndex}
    `, [...params, limit])

    const executions = result.rows.map(row => ({
      executionDate: row.executionDate,
      executionId: row.executionId,
      storeCode: row.storeCode,
      storeName: row.storeName,
      chainCode: row.chainCode,
      chainName: row.chainName,
      regionCode: '',
      regionName: '',
      userCode: row.userCode,
      userName: row.userName,
      teamLeaderCode: row.teamLeaderCode || '',
      teamLeaderName: row.teamLeaderName || '',
      executionType: row.execution_type,
      activitiesCompleted: 0,  // Default value since column doesn't exist
      totalActivities: 0,  // Default value since column doesn't exist
      completionPercentage: 0,  // Default value since column doesn't exist
      complianceStatus: row.compliance_status || 'Non-Compliant',
      complianceScore: row.compliance_score || 0,
      locationAsPerPlanogram: '',  // Default value since column doesn't exist
      executionStatus: '',  // Default value since column doesn't exist
      remarks: '',  // Default value since column doesn't exist
      imagePath: row.image_path || '',
      createdOn: row.created_on,
      approvalStatus: row.approvalStatus || null,
      approvedBy: row.approvedBy || null,
      approvedOn: row.approvedOn || null
    }))

    return NextResponse.json({
      success: true,
      data: executions,
      count: executions.length,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Planogram API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch planogram executions',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : String(error)
    }, { status: 500 })
  }
}
