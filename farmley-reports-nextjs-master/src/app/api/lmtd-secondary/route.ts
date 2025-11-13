import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export const revalidate = 60 // Revalidate every 60 seconds

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Get parameters
    const currentDate = searchParams.get('currentDate') || new Date().toISOString().split('T')[0]
    const startDate = searchParams.get('startDate') 
    const endDate = searchParams.get('endDate')
    const teamLeaderCode = searchParams.get('teamLeaderCode')
    const userCode = searchParams.get('userCode')
    const storeCode = searchParams.get('storeCode')
    const chainName = searchParams.get('chainName')
    const productCategory = searchParams.get('productCategory')
    const productCode = searchParams.get('productCode')
    const limit = parseInt(searchParams.get('limit') || '10000')
    
    // Get loginUserCode for hierarchy-based filtering
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Validate user access
    const validation = await validateApiUser(loginUserCode)
    if (!validation.isValid) {
      return validation.response!
    }
    
    // Fetch child users if loginUserCode is provided and not admin
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
      console.log('LMTD Secondary Sales API - Hierarchy filtering:', {
        loginUserCode,
        allowedUserCount: allowedUserCodes.length
      })
    }

    // Calculate date ranges
    // Use endDate if provided, otherwise use current date
    const selectedEndDate = endDate || currentDate
    const [year, month, day] = selectedEndDate.split('-').map(Number)
    
    // MTD: Always from 1st of current month (based on endDate) to the endDate
    const mtdStart = `${year}-${String(month).padStart(2, '0')}-01`
    const mtdEnd = selectedEndDate

    // LMTD: Always the entire previous month relative to the endDate
    // Calculate previous month and year
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    
    // Get the last day of previous month
    const lastDayOfPrevMonth = new Date(year, month - 1, 0).getDate()
    
    const lmtdStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    const lmtdEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDayOfPrevMonth).padStart(2, '0')}`

    console.log('LMTD Secondary Sales API - Date Ranges:', {
      mtdPeriod: { start: mtdStart, end: mtdEnd },
      lmtdPeriod: { start: lmtdStart, end: lmtdEnd }
    })

    // Build filter conditions
    let filterConditions = []
    let params = []
    let paramIndex = 5 // Starting after the 4 date parameters

    // User hierarchy filter (if not admin)
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
      filterConditions.push(`field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    if (teamLeaderCode) {
      filterConditions.push(`tl_code = $${paramIndex}`)
      params.push(teamLeaderCode)
      paramIndex++
    }

    if (userCode) {
      filterConditions.push(`field_user_code = $${paramIndex}`)
      params.push(userCode)
      paramIndex++
    }

    if (storeCode) {
      filterConditions.push(`store_code = $${paramIndex}`)
      params.push(storeCode)
      paramIndex++
    }

    if (chainName) {
      filterConditions.push(`chain_name = $${paramIndex}`)
      params.push(chainName)
      paramIndex++
    }

    if (productCategory) {
      filterConditions.push(`product_category = $${paramIndex}`)
      params.push(productCategory)
      paramIndex++
    }

    if (productCode) {
      filterConditions.push(`product_code = $${paramIndex}`)
      params.push(productCode)
      paramIndex++
    }

    const whereClause = filterConditions.length > 0 
      ? 'AND ' + filterConditions.join(' AND ') 
      : ''

    // Main query - get detailed transaction data
    const queryText = `
      WITH mtd_sales AS (
        -- Current month sales aggregated by date, user, store, product
        SELECT
          trx_date_only as sale_date,
          tl_code,
          tl_name,
          field_user_code,
          field_user_name,
          store_code,
          store_name,
          chain_name,
          product_code,
          product_name,
          SUM(quantity) as mtd_quantity,
          SUM(net_amount) as mtd_amount
        FROM flat_sales_transactions
        WHERE trx_date_only >= $1::date 
          AND trx_date_only <= $2::date
          ${whereClause}
        GROUP BY 
          trx_date_only, tl_code, tl_name, 
          field_user_code, field_user_name,
          store_code, store_name, chain_name,
          product_code, product_name
      ),
      lmtd_sales AS (
        -- Last month sales aggregated by date, user, store, product
        SELECT
          trx_date_only as sale_date,
          tl_code,
          tl_name,
          field_user_code,
          field_user_name,
          store_code,
          store_name,
          chain_name,
          product_code,
          product_name,
          SUM(quantity) as lmtd_quantity,
          SUM(net_amount) as lmtd_amount
        FROM flat_sales_transactions
        WHERE trx_date_only >= $3::date 
          AND trx_date_only <= $4::date
          ${whereClause}
        GROUP BY 
          trx_date_only, tl_code, tl_name,
          field_user_code, field_user_name,
          store_code, store_name, chain_name,
          product_code, product_name
      )
      SELECT
        COALESCE(m.sale_date, l.sale_date) as "date",
        COALESCE(m.tl_code, l.tl_code) as "tlCode",
        COALESCE(m.tl_name, l.tl_name) as "tlName",
        COALESCE(m.field_user_code, l.field_user_code) as "fieldUserCode",
        COALESCE(m.field_user_name, l.field_user_name) as "fieldUserName",
        COALESCE(m.store_code, l.store_code) as "storeCode",
        COALESCE(m.store_name, l.store_name) as "storeName",
        COALESCE(m.chain_name, l.chain_name) as "chainName",
        COALESCE(m.product_code, l.product_code) as "productCode",
        COALESCE(m.product_name, l.product_name) as "productName",
        COALESCE(m.mtd_quantity, 0) as "secondarySalesCurrentMonth",
        COALESCE(m.mtd_amount, 0) as "secondarySalesRevenueCurrentMonth",
        COALESCE(l.lmtd_quantity, 0) as "secondarySalesLastMonth",
        COALESCE(l.lmtd_amount, 0) as "secondarySalesRevenueLastMonth",
        COALESCE(m.mtd_quantity, 0) - COALESCE(l.lmtd_quantity, 0) as "secondarySalesDiff",
        COALESCE(m.mtd_amount, 0) - COALESCE(l.lmtd_amount, 0) as "secondarySalesRevenueDiff",
        CASE 
          WHEN COALESCE(l.lmtd_amount, 0) = 0 THEN 
            CASE WHEN COALESCE(m.mtd_amount, 0) > 0 THEN 100 ELSE 0 END
          ELSE ROUND(((COALESCE(m.mtd_amount, 0) - COALESCE(l.lmtd_amount, 0)) / l.lmtd_amount * 100)::numeric, 2)
        END as "revenueVariancePercent",
        CASE 
          WHEN COALESCE(l.lmtd_quantity, 0) = 0 THEN 
            CASE WHEN COALESCE(m.mtd_quantity, 0) > 0 THEN 100 ELSE 0 END
          ELSE ROUND(((COALESCE(m.mtd_quantity, 0) - COALESCE(l.lmtd_quantity, 0)) / l.lmtd_quantity * 100)::numeric, 2)
        END as "quantityVariancePercent"
      FROM mtd_sales m
      FULL OUTER JOIN lmtd_sales l ON 
        m.field_user_code = l.field_user_code
        AND m.store_code = l.store_code
        AND m.product_code = l.product_code
      WHERE COALESCE(m.mtd_amount, 0) > 0 OR COALESCE(l.lmtd_amount, 0) > 0
      ORDER BY 
        COALESCE(m.sale_date, l.sale_date) DESC,
        COALESCE(m.tl_code, l.tl_code),
        COALESCE(m.field_user_code, l.field_user_code),
        COALESCE(m.store_code, l.store_code),
        COALESCE(m.product_code, l.product_code)
      LIMIT ${limit}
    `

    console.log('Executing LMTD detailed query...')
    const result = await query(queryText, [mtdStart, mtdEnd, lmtdStart, lmtdEnd, ...params])
    
    console.log('LMTD Query Result:', {
      rowCount: result.rows.length,
      sampleRow: result.rows[0]
    })

    // Parse the results
    const detailedData = result.rows.map(row => ({
      date: row.date,
      tlCode: row.tlCode || '',
      tlName: row.tlName || '',
      fieldUserCode: row.fieldUserCode || '',
      fieldUserName: row.fieldUserName || '',
      storeCode: row.storeCode || '',
      storeName: row.storeName || '',
      chainName: row.chainName || '',
      productCode: row.productCode || '',
      productName: row.productName || '',
      secondarySalesCurrentMonth: parseFloat(row.secondarySalesCurrentMonth || '0'),
      secondarySalesRevenueCurrentMonth: parseFloat(row.secondarySalesRevenueCurrentMonth || '0'),
      secondarySalesLastMonth: parseFloat(row.secondarySalesLastMonth || '0'),
      secondarySalesRevenueLastMonth: parseFloat(row.secondarySalesRevenueLastMonth || '0'),
      secondarySalesDiff: parseFloat(row.secondarySalesDiff || '0'),
      secondarySalesRevenueDiff: parseFloat(row.secondarySalesRevenueDiff || '0'),
      revenueVariancePercent: parseFloat(row.revenueVariancePercent || '0'),
      quantityVariancePercent: parseFloat(row.quantityVariancePercent || '0')
    }))

    // Calculate summary statistics
    const summary: any = {
      totalMtdQuantity: detailedData.reduce((sum, d) => sum + d.secondarySalesCurrentMonth, 0),
      totalMtdRevenue: detailedData.reduce((sum, d) => sum + d.secondarySalesRevenueCurrentMonth, 0),
      totalLmtdQuantity: detailedData.reduce((sum, d) => sum + d.secondarySalesLastMonth, 0),
      totalLmtdRevenue: detailedData.reduce((sum, d) => sum + d.secondarySalesRevenueLastMonth, 0),
      totalQuantityDiff: detailedData.reduce((sum, d) => sum + d.secondarySalesDiff, 0),
      totalRevenueDiff: detailedData.reduce((sum, d) => sum + d.secondarySalesRevenueDiff, 0),
      uniqueStores: new Set(detailedData.map(d => d.storeCode)).size,
      uniqueProducts: new Set(detailedData.map(d => d.productCode)).size,
      uniqueUsers: new Set(detailedData.map(d => d.fieldUserCode)).size,
      uniqueTeamLeaders: new Set(detailedData.map(d => d.tlCode)).size,
      transactionCount: detailedData.length
    }

    // Calculate variance percentages for summary
    summary.revenueVariancePercent = summary.totalLmtdRevenue > 0 
      ? parseFloat(((summary.totalMtdRevenue - summary.totalLmtdRevenue) / summary.totalLmtdRevenue * 100).toFixed(2))
      : summary.totalMtdRevenue > 0 ? 100 : 0

    summary.quantityVariancePercent = summary.totalLmtdQuantity > 0
      ? parseFloat(((summary.totalMtdQuantity - summary.totalLmtdQuantity) / summary.totalLmtdQuantity * 100).toFixed(2))
      : summary.totalMtdQuantity > 0 ? 100 : 0

    return NextResponse.json({
      success: true,
      data: detailedData,
      summary,
      count: detailedData.length,
      periods: {
        mtd: { start: mtdStart, end: mtdEnd },
        lmtd: { start: lmtdStart, end: lmtdEnd }
      },
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-tables (flat_sales_transactions)'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30'
      }
    })

  } catch (error) {
    console.error('LMTD Secondary Sales API error:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : '')

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch LMTD secondary sales data',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.toString() : 'Unknown error'
    }, { status: 500 })
  }
}
