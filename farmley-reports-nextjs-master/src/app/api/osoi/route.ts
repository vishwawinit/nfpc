import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Mark as dynamic route (uses search params)
export const dynamic = 'force-dynamic'
// Enable ISR with 60 second revalidation
export const revalidate = 60

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

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

    // Build WHERE clause
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1
    
    // Add hierarchy filter if not admin - this restricts data to only managed users
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
      conditions.push(`field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    // OSOI Filter: Use flat_planogram_executions with execution_type = '0'
    conditions.push(`execution_type = '0'`)

    // Date filters
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

    // Team Leader filter
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    // User filter
    if (searchParams.has('userCode')) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    // Store filter
    if (searchParams.has('storeCode')) {
      conditions.push(`store_code = $${paramIndex}`)
      params.push(searchParams.get('storeCode'))
      paramIndex++
    }
    
    // Chain filter
    if (searchParams.has('chainCode')) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(searchParams.get('chainCode'))
      paramIndex++
    }

    // Out of Stock boolean filter (always true in this query, but allow filtering)
    if (searchParams.has('outOfStock') && searchParams.get('outOfStock') === 'false') {
      // If user filters for NOT out of stock, return empty results
      // since this endpoint specifically queries for out-of-stock items
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'Filtered for non-out-of-stock items',
        timestamp: new Date().toISOString(),
        source: 'postgresql-flat-stock-checks'
      })
    }

    // Out of Index filter (not yet tracked, so filtering returns empty)
    if (searchParams.has('outOfIndex') && searchParams.get('outOfIndex') === 'true') {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'Out of Index tracking not yet implemented',
        timestamp: new Date().toISOString(),
        source: 'postgresql-flat-stock-checks'
      })
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get limit
    const limit = parseInt(searchParams.get('limit') || '100000')

    // Query flat_planogram_executions for OSOI (execution_type = 0)
    const result = await query(`
      SELECT
        execution_date as "checkDate",
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

    // Map to OSOI interface
    const osoiReports = result.rows.map((row, index) => ({
      executionDate: row.checkDate,
      executionId: row.executionId || `OSOI-${row.storeCode}-${index}`,
      storeCode: row.storeCode,
      storeName: row.storeName,
      chainCode: row.chainCode,
      chainName: row.chainName,
      userCode: row.userCode,
      userName: row.userName,
      teamLeaderCode: row.teamLeaderCode || '',
      teamLeaderName: row.teamLeaderName || '',
      executionType: row.execution_type,  // Should always be '0' for OSOI
      activitiesCompleted: 0,  // Default value - column doesn't exist
      totalActivities: 0,  // Default value - column doesn't exist
      completionPercentage: 0,  // Default value - column doesn't exist
      complianceStatus: row.compliance_status || 'Non-Compliant',
      complianceScore: row.compliance_score || 0,
      executionStatus: '',  // Default value - column doesn't exist
      remarks: '',  // Default value - column doesn't exist
      imagePath: row.image_path || '',
      createdOn: row.created_on,
      approvalStatus: row.approvalStatus || null,
      approvedBy: row.approvedBy || null,
      approvedOn: row.approvedOn || null
    }))

    return NextResponse.json({
      success: true,
      data: osoiReports,
      count: osoiReports.length,
      message: 'OSOI data from flat_planogram_executions (execution_type = 0)',
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-planogram-executions'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })

  } catch (error) {
    console.error('OSOI API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch OSOI reports',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
