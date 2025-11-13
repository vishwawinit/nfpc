import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Enable ISR with 60 second revalidation
export const revalidate = 60

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Validate user access
    const validation = await validateApiUser(loginUserCode)
    if (!validation.isValid) {
      return validation.response!
    }
    
    // Get hierarchy-based allowed users
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }
    
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1
    
    // Add hierarchy filter if not admin
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
      conditions.push(`t.field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    if (searchParams.has('year')) {
      conditions.push(`t.target_year = $${paramIndex}`)
      params.push(parseInt(searchParams.get('year')!))
      paramIndex++
    }

    if (searchParams.has('month')) {
      conditions.push(`t.target_month = $${paramIndex}`)
      params.push(parseInt(searchParams.get('month')!))
      paramIndex++
    }

    if (searchParams.has('userCode')) {
      conditions.push(`t.field_user_code = $${paramIndex}`)
      params.push(searchParams.get('userCode'))
      paramIndex++
    }

    if (searchParams.has('customerCode')) {
      conditions.push(`t.customer_code = $${paramIndex}`)
      params.push(searchParams.get('customerCode'))
      paramIndex++
    }

    // Team Leader filter
    if (searchParams.has('teamLeaderCode')) {
      conditions.push(`t.tl_code = $${paramIndex}`)
      params.push(searchParams.get('teamLeaderCode'))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    // No limit - get ALL data for comprehensive reporting
    const limit = parseInt(searchParams.get('limit') || '100000')

    // Query to get targets with achievement data from sales transactions
    // NOTE: achieved_value and achievement_percentage are NULL in DB, so we calculate from flat_sales_transactions
    const result = await query(`
      SELECT
        t.target_year as "targetYear",
        t.target_month as "targetMonth",
        t.target_period as "targetPeriod",
        t.field_user_code as "userCode",
        t.field_user_name as "userName",
        t.tl_code as "teamLeaderCode",
        t.tl_name as "teamLeaderName",
        t.user_role as "userRole",
        t.customer_code as "customerCode",
        t.customer_name as "customerName",
        t.customer_level as "customerLevel",
        t.chain_code as "chainCode",
        t.target_amount as "targetAmount",
        t.target_quantity as "targetQuantity",
        t.target_volume as "targetVolume",
        t.currency_code as "currencyCode",
        t.uom as "uom",
        t.sales_org_code as "salesOrgCode",
        t.sales_org_name as "salesOrgName",
        t.product_category as "productCategory",
        t.product_brand as "productBrand",
        t.target_type as "targetType",
        t.target_level as "targetLevel",
        t.target_frequency as "targetFrequency",
        t.target_status as "targetStatus",
        t.is_active as "isActive",
        t.is_approved as "isApproved",
        t.remarks as "remarks",
        t.created_by as "createdBy",
        t.created_on as "createdOn",
        t.modified_by as "modifiedBy",
        t.modified_on as "modifiedOn",
        -- Calculate achievement from flat_sales_transactions (trx_type = 5 for Sales Orders)
        COALESCE(
          SUM(CASE 
            WHEN s.trx_type = 5 
              AND EXTRACT(YEAR FROM s.trx_date_only) = t.target_year 
              AND EXTRACT(MONTH FROM s.trx_date_only) = t.target_month
            THEN s.net_amount 
            ELSE 0 
          END), 
          0
        ) as "achievementAmount",
        -- Calculate achievement percentage
        CASE 
          WHEN t.target_amount = 0 OR t.target_amount IS NULL THEN 0
          ELSE ROUND(
            (COALESCE(
              SUM(CASE 
                WHEN s.trx_type = 5 
                  AND EXTRACT(YEAR FROM s.trx_date_only) = t.target_year 
                  AND EXTRACT(MONTH FROM s.trx_date_only) = t.target_month
                THEN s.net_amount 
                ELSE 0 
              END), 
              0
            ) / NULLIF(t.target_amount, 0)) * 100, 
            2
          )
        END as "achievementPercentage"
      FROM flat_targets t
      LEFT JOIN flat_sales_transactions s
        ON t.field_user_code = s.field_user_code
        AND t.customer_code = s.store_code
      ${whereClause}
      GROUP BY 
        t.target_year, t.target_month, t.target_period, t.field_user_code, t.field_user_name,
        t.tl_code, t.tl_name, t.user_role, t.customer_code, t.customer_name, t.customer_level,
        t.chain_code, t.target_amount, t.target_quantity, t.target_volume, t.currency_code, t.uom,
        t.sales_org_code, t.sales_org_name, t.product_category, t.product_brand,
        t.target_type, t.target_level, t.target_frequency, t.target_status,
        t.is_active, t.is_approved, t.remarks, t.created_by, t.created_on, t.modified_by, t.modified_on
      ORDER BY t.target_year DESC, t.target_month DESC, t.field_user_name ASC
      LIMIT $${paramIndex}
    `, [...params, limit])

    const targets = result.rows.map(row => ({
      targetYear: row.targetYear,
      targetMonth: row.targetMonth,
      targetPeriod: row.targetPeriod,
      userCode: row.userCode,
      userName: row.userName,
      teamLeaderCode: row.teamLeaderCode,
      teamLeaderName: row.teamLeaderName,
      userRole: row.userRole,
      customerCode: row.customerCode,
      customerName: row.customerName,
      customerLevel: row.customerLevel,
      chainCode: row.chainCode,
      targetAmount: parseFloat(row.targetAmount || '0'),
      targetQuantity: parseFloat(row.targetQuantity || '0'),
      targetVolume: parseFloat(row.targetVolume || '0'),
      achievementAmount: parseFloat(row.achievementAmount || '0'),
      achievementPercentage: parseFloat(row.achievementPercentage || '0'),
      currencyCode: row.currencyCode,
      uom: row.uom,
      salesOrgCode: row.salesOrgCode,
      salesOrgName: row.salesOrgName,
      productCategory: row.productCategory,
      productBrand: row.productBrand,
      targetType: row.targetType,
      targetLevel: row.targetLevel,
      targetFrequency: row.targetFrequency,
      targetStatus: row.targetStatus,
      isActive: row.isActive,
      isApproved: row.isApproved,
      remarks: row.remarks,
      createdBy: row.createdBy,
      createdOn: row.createdOn,
      modifiedBy: row.modifiedBy,
      modifiedOn: row.modifiedOn
    }))

    // Calculate summary statistics
    const summary = {
      totalTargets: targets.length,
      totalTargetAmount: targets.reduce((sum, t) => sum + t.targetAmount, 0),
      totalAchievement: targets.reduce((sum, t) => sum + t.achievementAmount, 0),
      overallAchievementPercentage: 0,
      targetsAchieved: targets.filter(t => t.achievementPercentage >= 100).length,
      targetsNotAchieved: targets.filter(t => t.achievementPercentage < 100).length
    }

    if (summary.totalTargetAmount > 0) {
      summary.overallAchievementPercentage = parseFloat(
        ((summary.totalAchievement / summary.totalTargetAmount) * 100).toFixed(2)
      )
    }

    return NextResponse.json({
      success: true,
      data: targets,
      summary,
      count: targets.length,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-tables (flat_targets + flat_sales_transactions)'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Targets API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch targets',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
