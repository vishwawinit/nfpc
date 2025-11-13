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

    // Date filters
    if (searchParams.has('startDate')) {
      conditions.push(`initiative_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
    }

    if (searchParams.has('endDate')) {
      conditions.push(`initiative_date <= $${paramIndex}`)
      params.push(searchParams.get('endDate'))
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

    // Initiative type filter
    if (searchParams.has('initiativeType')) {
      conditions.push(`initiative_type = $${paramIndex}`)
      params.push(searchParams.get('initiativeType'))
      paramIndex++
    }

    // Campaign name filter
    if (searchParams.has('campaignName')) {
      conditions.push(`campaign_name = $${paramIndex}`)
      params.push(searchParams.get('campaignName'))
      paramIndex++
    }

    // Team Leader filter
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    // Chain filter
    if (searchParams.has('chainCode')) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(searchParams.get('chainCode'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get limit
    const limit = parseInt(searchParams.get('limit') || '100000')

    // Check if flat_broadcast_initiatives table exists
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'flat_broadcast_initiatives'
      ) as table_exists
    `)
    
    if (!tableCheckResult.rows[0]?.table_exists) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'Broadcast initiatives tracking not yet configured. Table flat_broadcast_initiatives does not exist.',
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      })
    }

    // First, get the actual schema of the table
    const schemaResult = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'flat_broadcast_initiatives'
      ORDER BY ordinal_position
    `)
    
    const availableColumns = schemaResult.rows.map((r: any) => r.column_name)
    console.log('Available columns in flat_broadcast_initiatives:', availableColumns)
    
    // Query flat table directly - all data is already denormalized
    const result = await query(`
      SELECT
        initiative_date as "initiativeDate",
        store_code as "storeCode",
        store_name as "storeName",
        field_user_code as "userCode",
        field_user_name as "userName",
        mobile_number as "mobileNumber",
        initiative_type as "initiativeType",
        end_customer_name as "customerName",
        gender as "gender",
        image_path as "imagePath",
        created_datetime as "createdDateTime",
        COALESCE(tl_code, '') as "teamLeaderCode",
        COALESCE(tl_name, '') as "teamLeaderName",
        COALESCE(chain_code, '') as "chainCode",
        COALESCE(chain_name, '') as "chainName"
      FROM flat_broadcast_initiatives
      ${whereClause}
      ORDER BY initiative_date DESC
      LIMIT $${paramIndex}
    `, [...params, limit])

    const initiatives = result.rows.map(row => ({
      initiativeDate: row.initiativeDate,
      storeCode: row.storeCode,
      storeName: row.storeName,
      userCode: row.userCode,
      userName: row.userName,
      teamLeaderCode: row.teamLeaderCode || '',
      teamLeaderName: row.teamLeaderName || '',
      mobileNumber: row.mobileNumber || '',
      initiativeType: row.initiativeType || '',
      gender: row.gender || '',
      customerName: row.customerName || '',
      imagePath: row.imagePath || '',
      chainCode: row.chainCode || '',
      chainName: row.chainName || '',
      campaignName: '',  // Not available in current table version
      messageSent: '',  // Not available in current table version
      responseReceived: '',  // Not available in current table version
      remarks: '',  // Not available in current table version
      createdDateTime: row.createdDateTime
    }))

    return NextResponse.json({
      success: true,
      data: initiatives,
      count: initiatives.length,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })

  } catch (error) {
    console.error('Broadcast Initiative API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch broadcast initiatives',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
