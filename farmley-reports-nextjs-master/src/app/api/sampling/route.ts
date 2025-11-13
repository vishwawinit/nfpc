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

    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Add hierarchy filter first if not admin - this restricts data to only managed users
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
      conditions.push(`field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    if (searchParams.has('startDate')) {
      conditions.push(`sampling_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
    }

    if (searchParams.has('endDate')) {
      conditions.push(`sampling_date <= $${paramIndex}`)
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

    if (searchParams.has('skuCode')) {
      conditions.push(`sku_code = $${paramIndex}`)
      params.push(searchParams.get('skuCode'))
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

    // Check if flat_product_sampling table exists
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'flat_product_sampling'
      ) as table_exists
    `)
    
    if (!tableCheckResult.rows[0]?.table_exists) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'Product sampling tracking not yet configured. Table flat_product_sampling does not exist.',
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      })
    }

    const result = await query(`
      SELECT
        sampling_date as "samplingDate",
        store_code as "storeCode",
        store_name as "storeName",
        field_user_code as "userCode",
        field_user_name as "userName",
        tl_code as "teamLeaderCode",
        tl_name as "teamLeaderName",
        user_role as "userRole",
        chain_code as "chainCode",
        chain_name as "chainName",
        sku_code as "skuCode",
        sku_name as "skuName",
        product_code as "productCode",
        product_name as "productName",
        selling_price as "sellingPrice",
        units_used as "unitsUsed",
        units_sold as "unitsSold",
        customers_approached as "customersApproached",
        image_path as "imagePath",
        created_datetime as "createdDateTime"
      FROM flat_product_sampling
      ${whereClause}
      ORDER BY sampling_date DESC, created_datetime DESC
      LIMIT $${paramIndex}
    `, [...params, limit])

    const samplings = result.rows.map(row => ({
      samplingDate: row.samplingDate,
      storeCode: row.storeCode,
      storeName: row.storeName,
      userCode: row.userCode,
      userName: row.userName,
      teamLeaderCode: row.teamLeaderCode || '',
      teamLeaderName: row.teamLeaderName || '',
      userRole: row.userRole || '',
      chainCode: row.chainCode || '',
      chainName: row.chainName || '',
      skuCode: row.skuCode,
      skuName: row.skuName,
      productCode: row.productCode || row.skuCode,
      productName: row.productName || row.skuName,
      sellingPrice: parseFloat(row.sellingPrice || '0'),
      unitsUsed: parseInt(row.unitsUsed || '0'),
      unitsSold: parseInt(row.unitsSold || '0'),
      customersApproached: parseInt(row.customersApproached || '0'),
      conversionRate: parseInt(row.customersApproached || '0') > 0
        ? (parseInt(row.unitsSold || '0') / parseInt(row.customersApproached || '0')) * 100
        : 0,
      imagePath: row.imagePath,
      createdDateTime: row.createdDateTime
    }))

    // Calculate summary statistics
    const summary = {
      totalSamplings: samplings.length,
      totalUnitsUsed: samplings.reduce((sum, s) => sum + s.unitsUsed, 0),
      totalUnitsSold: samplings.reduce((sum, s) => sum + s.unitsSold, 0),
      totalCustomersApproached: samplings.reduce((sum, s) => sum + s.customersApproached, 0),
      overallConversionRate: 0,
      uniqueStores: new Set(samplings.map(s => s.storeCode)).size,
      uniqueProducts: new Set(samplings.map(s => s.skuCode)).size,
      uniqueUsers: new Set(samplings.map(s => s.userCode)).size
    }

    if (summary.totalCustomersApproached > 0) {
      summary.overallConversionRate = parseFloat(
        ((summary.totalUnitsSold / summary.totalCustomersApproached) * 100).toFixed(2)
      )
    }

    return NextResponse.json({
      success: true,
      data: samplings,
      summary,
      count: samplings.length,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table (flat_product_sampling)'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Sampling API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sampling data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
