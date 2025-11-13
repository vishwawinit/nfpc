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

    // Build WHERE clause
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

    // Date filters
    if (searchParams.has('startDate')) {
      conditions.push(`observation_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
    }

    if (searchParams.has('endDate')) {
      conditions.push(`observation_date <= $${paramIndex}`)
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

    // Competitor brand filter
    if (searchParams.has('competitorBrand')) {
      conditions.push(`competition_brand_name = $${paramIndex}`)
      params.push(searchParams.get('competitorBrand'))
      paramIndex++
    }

    // Product name filter
    if (searchParams.has('productName')) {
      conditions.push(`product_name ILIKE $${paramIndex}`)
      params.push(`%${searchParams.get('productName')}%`)
      paramIndex++
    }

    // Chain filter
    if (searchParams.has('chainCode')) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(searchParams.get('chainCode'))
      paramIndex++
    }

    // Team Leader filter
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get limit - default to large number to get all data
    const limit = parseInt(searchParams.get('limit') || '100000')

    // Check if flat_competitor_observations table exists, if not return empty result
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'flat_competitor_observations'
      ) as table_exists
    `)
    
    if (!tableCheckResult.rows[0]?.table_exists) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'Competition observation tracking not yet configured. Table flat_competitor_observations does not exist.',
        timestamp: new Date().toISOString(),
        source: 'postgresql-flat-table'
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      })
    }

    const columnsResult = await query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'flat_competitor_observations'
    `)

    const columnSet = new Set(columnsResult.rows.map(row => row.column_name))
    const hasColumn = (name: string) => columnSet.has(name)

    // Team Leader filter
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    const selectFields = [
      `observation_date as "observationDate"`,
      `store_code as "storeCode"`,
      `store_name as "storeName"`,
      `field_user_code as "userCode"`,
      `field_user_name as "userName"`,
      hasColumn('tl_code') ? `tl_code as "teamLeaderCode"` : `NULL::text as "teamLeaderCode"`,
      hasColumn('tl_name') ? `tl_name as "teamLeaderName"` : `NULL::text as "teamLeaderName"`,
      hasColumn('user_role') ? `user_role as "userRole"` : `NULL::text as "userRole"`,
      hasColumn('chain_code') ? `chain_code as "chainCode"` : `NULL::text as "chainCode"`,
      hasColumn('chain_name') ? `chain_name as "chainName"` : `NULL::text as "chainName"`,
      hasColumn('competition_brand_name') ? `competition_brand_name as "competitorBrand"` : `NULL::text as "competitorBrand"`,
      hasColumn('product_name') ? `product_name as "productName"` : `NULL::text as "productName"`,
      // MRP - using competitor_price as MRP since mrp column is usually NULL
      hasColumn('competitor_price') ? `competitor_price as "mrp"` : `NULL::numeric as "mrp"`,
      // Selling Price - using company_name which holds the selling price value
      hasColumn('company_name') ? `company_name as "sellingPrice"` : `NULL::text as "sellingPrice"`,
      // Size of SKU - using promotion_type which holds the size value  
      hasColumn('promotion_type') ? `promotion_type as "sizeOfSku"` : `NULL::text as "sizeOfSku"`,
      hasColumn('competitor_price') ? `competitor_price as "competitorPrice"` : `NULL::numeric as "competitorPrice"`,
      hasColumn('company_name') ? `company_name as "companyName"` : `NULL::text as "companyName"`,
      hasColumn('promotion_type') ? `promotion_type as "promotionType"` : `NULL::text as "promotionType"`,
      hasColumn('image_path') ? `image_path as "imagePath"` : `NULL::text as "imagePath"`,
      hasColumn('created_datetime') ? `created_datetime as "createdDateTime"` : `NOW() as "createdDateTime"`
    ]

    // Fetch competitor observations
    const result = await query(`
      SELECT
        ${selectFields.join(',\n        ')}
      FROM flat_competitor_observations
      ${whereClause}
      ORDER BY observation_date DESC, created_datetime DESC
      LIMIT $${paramIndex}
    `, [...params, limit])

    const observations = result.rows.map(row => ({
      observationDate: row.observationDate,
      storeCode: row.storeCode,
      storeName: row.storeName,
      userCode: row.userCode,
      userName: row.userName,
      teamLeaderCode: row.teamLeaderCode || '',
      teamLeaderName: row.teamLeaderName || '',
      userRole: row.userRole || '',
      chainCode: row.chainCode || '',
      chainName: row.chainName || '',
      competitorBrand: row.competitorBrand || '',
      productName: row.productName || '',
      mrp: row.mrp ? parseFloat(row.mrp) : 0,
      sellingPrice: row.sellingPrice || '',
      sizeOfSku: row.sizeOfSku || '',
      competitorPrice: row.competitorPrice ? parseFloat(row.competitorPrice) : 0,
      companyName: row.companyName || '',
      promotionType: row.promotionType || '',
      imagePath: row.imagePath || '',
      createdDateTime: row.createdDateTime
    }))

    // Calculate summary statistics
    const summary = {
      totalObservations: observations.length,
      uniqueCompetitors: new Set(observations.map(o => o.competitorBrand).filter(Boolean)).size,
      uniqueStores: new Set(observations.map(o => o.storeCode)).size,
      uniqueProducts: new Set(observations.map(o => o.productName).filter(Boolean)).size,
      avgCompetitorPrice: observations.length > 0
        ? observations.reduce((sum, o) => sum + (o.competitorPrice || 0), 0) / observations.filter(o => o.competitorPrice > 0).length
        : 0,
      withPromotions: observations.filter(o => o.promotionType && o.promotionType !== '').length
    }

    return NextResponse.json({
      success: true,
      data: observations,
      summary,
      count: observations.length,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table (flat_competitor_observations)'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })

  } catch (error) {
    console.error('Competition Observation API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch competitor observations',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

