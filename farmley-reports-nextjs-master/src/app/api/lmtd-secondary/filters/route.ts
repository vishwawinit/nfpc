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
    
    // Get date parameters
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const currentDate = endDate || new Date().toISOString().split('T')[0]
    
    // Calculate selectedEndDate early for hierarchy queries
    const selectedEndDate = endDate || currentDate
    
    // Get loginUserCode for hierarchy-based filtering
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Validate user access
    const validation = await validateApiUser(loginUserCode)
    if (!validation.isValid) {
      return validation.response!
    }
    
    // Fetch child users if loginUserCode is provided and not admin
    let allowedUserCodes: string[] = []
    let userIsTeamLeader = false
    let allowedTeamLeaders: string[] = []
    let allowedFieldUsers: string[] = []
    
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
      
      // Query to determine which of the allowed users are Team Leaders vs Field Users
      if (allowedUserCodes.length > 0) {
        const userCodesStr = allowedUserCodes.map(code => `'${code}'`).join(', ')
        
        // Get team leaders from the allowed codes
        const tlResult = await query(`
          SELECT DISTINCT tl_code
          FROM flat_sales_transactions
          WHERE tl_code IN (${userCodesStr})
          ${startDate && endDate ? `AND trx_date_only >= '${selectedEndDate}'::date` : ''}
        `)
        allowedTeamLeaders = tlResult.rows.map(r => r.tl_code).filter(Boolean)
        
        // Check if the logged-in user is a team leader
        userIsTeamLeader = allowedTeamLeaders.includes(loginUserCode)
        
        // If user is a TL, only they should appear in TL filter
        if (userIsTeamLeader) {
          allowedTeamLeaders = [loginUserCode]
        }
        
        // Field users are all allowed codes
        allowedFieldUsers = allowedUserCodes
      }
      
      console.log('LMTD Filters API - Hierarchy filtering:', {
        loginUserCode,
        allowedUserCount: allowedUserCodes.length,
        isTeamLeader: userIsTeamLeader,
        allowedTeamLeaders: allowedTeamLeaders.length,
        allowedFieldUsers: allowedFieldUsers.length
      })
    }
    
    // Calculate date ranges
    // selectedEndDate already declared above for hierarchy queries
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

    console.log('LMTD Filters API - Date Ranges:', {
      mtdPeriod: { start: mtdStart, end: mtdEnd },
      lmtdPeriod: { start: lmtdStart, end: lmtdEnd }
    })

    // Get selected filter values for cascading
    const selectedTeamLeader = searchParams.get('teamLeaderCode')
    const selectedUser = searchParams.get('userCode')
    const selectedChain = searchParams.get('chainName')
    const selectedStore = searchParams.get('storeCode')
    const selectedCategory = searchParams.get('productCategory')

    // Build where clause for cascading filters
    const buildWhereClause = (excludeField?: string) => {
      const conditions = []
      
      // Always use date range that covers both MTD and LMTD
      conditions.push(`trx_date_only >= '${lmtdStart}'::date`)
      conditions.push(`trx_date_only <= '${mtdEnd}'::date`)
      
      // User hierarchy filter (if not admin)
      if (allowedUserCodes.length > 0) {
        const userCodesStr = allowedUserCodes.map(code => `'${code}'`).join(', ')
        conditions.push(`field_user_code IN (${userCodesStr})`)
      }
      
      // Add cascading filters
      if (selectedTeamLeader && excludeField !== 'teamLeader') {
        conditions.push(`tl_code = '${selectedTeamLeader}'`)
      }
      if (selectedUser && excludeField !== 'user') {
        conditions.push(`field_user_code = '${selectedUser}'`)
      }
      if (selectedChain && excludeField !== 'chain') {
        conditions.push(`chain_name = '${selectedChain}'`)
      }
      if (selectedStore && excludeField !== 'store') {
        conditions.push(`store_code = '${selectedStore}'`)
      }
      if (selectedCategory && excludeField !== 'category') {
        conditions.push(`product_category = '${selectedCategory}'`)
      }
      
      return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    }

    // Fetch all filter options
    const [
      teamLeadersResult,
      usersResult,
      chainsResult,
      storesResult,
      categoriesResult,
      productsResult
    ] = await Promise.all([
      // Team Leaders - filtered by hierarchy
      query(`
        WITH all_team_leaders AS (
          SELECT DISTINCT
            tl_code as code,
            tl_name as name
          FROM flat_sales_transactions
          WHERE tl_code IS NOT NULL
          AND UPPER(COALESCE(tl_code, '')) NOT LIKE '%DEMO%'
          ${allowedTeamLeaders.length > 0 ? `AND tl_code IN (${allowedTeamLeaders.map(c => `'${c}'`).join(', ')})` : ''}
        ),
        filtered_transactions AS (
          SELECT
            tl_code,
            COUNT(*) as transaction_count
          FROM flat_sales_transactions
          ${buildWhereClause('teamLeader') || 'WHERE 1=1'}
          AND tl_code IS NOT NULL
          GROUP BY tl_code
        )
        SELECT
          tl.code as "value",
          tl.name || ' (' || tl.code || ')' as "label",
          COALESCE(ft.transaction_count, 0) as "count"
        FROM all_team_leaders tl
        LEFT JOIN filtered_transactions ft ON tl.code = ft.tl_code
        ORDER BY tl.name
      `),
      
      // Field Users - filtered by hierarchy
      query(`
        SELECT
          fu.field_user_code as "value",
          fu.field_user_name || ' (' || fu.field_user_code || ')' as "label",
          fu.role as "role",
          COALESCE(counts.transaction_count, 0) as "count"
        FROM (
          SELECT DISTINCT
            field_user_code,
            field_user_name,
            COALESCE(user_role, 'Field User') as role
          FROM flat_sales_transactions
          WHERE field_user_code IS NOT NULL
          AND COALESCE(user_role, 'Field User') != 'Team Leader'
          AND UPPER(field_user_code) NOT LIKE '%DEMO%'
          ${allowedFieldUsers.length > 0 ? `AND field_user_code IN (${allowedFieldUsers.map(c => `'${c}'`).join(', ')})` : ''}
        ) fu
        LEFT JOIN (
          SELECT
            field_user_code,
            COUNT(*) as transaction_count
          FROM flat_sales_transactions
          ${buildWhereClause('user')}
          GROUP BY field_user_code
        ) counts ON fu.field_user_code = counts.field_user_code
        ORDER BY fu.field_user_name
      `),
      
      // Chains
      query(`
        SELECT
          c.chain_name as "value",
          c.chain_name as "label",
          COALESCE(counts.transaction_count, 0) as "count"
        FROM (
          SELECT DISTINCT COALESCE(chain_name, 'Unknown') as chain_name
          FROM flat_sales_transactions
          WHERE chain_name IS NOT NULL
          AND UPPER(chain_name) NOT LIKE '%DEMO%'
          ${allowedUserCodes.length > 0 ? `AND field_user_code IN (${allowedUserCodes.map(c => `'${c}'`).join(', ')})` : ''}
        ) c
        LEFT JOIN (
          SELECT
            COALESCE(chain_name, 'Unknown') as chain_name,
            COUNT(*) as transaction_count
          FROM flat_sales_transactions
          ${buildWhereClause('chain')}
          GROUP BY chain_name
        ) counts ON c.chain_name = counts.chain_name
        ORDER BY c.chain_name
      `),
      
      // Stores
      query(`
        SELECT
          s.store_code as "value",
          s.store_name || ' (' || s.store_code || ')' as "label",
          COALESCE(counts.transaction_count, 0) as "count"
        FROM (
          SELECT DISTINCT
            store_code,
            store_name
          FROM flat_sales_transactions
          WHERE store_code IS NOT NULL
          AND store_name IS NOT NULL
          AND UPPER(store_code) NOT LIKE '%DEMO%'
          ${allowedUserCodes.length > 0 ? `AND field_user_code IN (${allowedUserCodes.map(c => `'${c}'`).join(', ')})` : ''}
        ) s
        LEFT JOIN (
          SELECT
            store_code,
            COUNT(*) as transaction_count
          FROM flat_sales_transactions
          ${buildWhereClause('store')}
          GROUP BY store_code
        ) counts ON s.store_code = counts.store_code
        ORDER BY s.store_name
        LIMIT 500
      `),
      
      // Product Categories
      query(`
        SELECT
          c.product_category as "value",
          c.product_category as "label",
          COALESCE(counts.transaction_count, 0) as "count"
        FROM (
          SELECT DISTINCT product_category
          FROM flat_sales_transactions
          WHERE product_category IS NOT NULL
          ${allowedUserCodes.length > 0 ? `AND field_user_code IN (${allowedUserCodes.map(c => `'${c}'`).join(', ')})` : ''}
        ) c
        LEFT JOIN (
          SELECT
            product_category,
            COUNT(*) as transaction_count
          FROM flat_sales_transactions
          ${buildWhereClause('category')}
          GROUP BY product_category
        ) counts ON c.product_category = counts.product_category
        ORDER BY c.product_category
      `),
      
      // Top Products (for reference)
      query(`
        SELECT DISTINCT
          product_code as "value",
          product_code || ' - ' || COALESCE(product_name, 'Unknown Product') as "label",
          SUM(net_amount) as "totalAmount"
        FROM flat_sales_transactions
        ${buildWhereClause()}
        GROUP BY product_code, product_name
        HAVING product_code IS NOT NULL
        ORDER BY "totalAmount" DESC
        LIMIT 100
      `)
    ])

    console.log('LMTD Filters API - Results:', {
      teamLeaders: teamLeadersResult.rows.length,
      users: usersResult.rows.length,
      chains: chainsResult.rows.length,
      stores: storesResult.rows.length,
      categories: categoriesResult.rows.length,
      products: productsResult.rows.length
    })

    // Format results - ONLY SHOW OPTIONS WITH TRANSACTIONS
    const teamLeaders = teamLeadersResult.rows
      .map(row => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.count) || 0
      }))
      .filter(tl => {
        // If hierarchy filtering is active, show ALL team leaders in hierarchy
        if (allowedTeamLeaders.length > 0) return true
        // Otherwise only show those with transactions
        return tl.available > 0 || tl.value === selectedTeamLeader
      })

    const users = usersResult.rows
      .map(row => ({
        value: row.value,
        label: row.label,
        role: row.role,
        available: parseInt(row.count) || 0
      }))
      .filter(u => {
        // If hierarchy filtering is active, show ALL field users in hierarchy
        if (allowedFieldUsers.length > 0) return true
        // Otherwise only show those with transactions
        return u.available > 0 || u.value === selectedUser
      })

    const chains = chainsResult.rows
      .map(row => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.count) || 0
      }))
      .filter(c => c.available > 0 || c.value === selectedChain)

    const stores = storesResult.rows
      .map(row => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.count) || 0
      }))
      .filter(s => s.available > 0 || s.value === selectedStore)

    const categories = categoriesResult.rows
      .map(row => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.count) || 0
      }))
      .filter(c => c.available > 0 || c.value === selectedCategory)

    const products = productsResult.rows
      .map(row => ({
        value: row.value,
        label: row.label,
        available: parseFloat(row.totalAmount) || 0
      }))
      .slice(0, 100) // Keep top 100 products

    return NextResponse.json({
      success: true,
      filters: {
        teamLeaders,
        users,
        chains,
        stores,
        categories,
        products
      },
      hierarchy: {
        loginUserCode: loginUserCode || null,
        isTeamLeader: userIsTeamLeader,
        allowedUserCount: allowedUserCodes.length,
        allowedTeamLeaderCount: allowedTeamLeaders.length,
        allowedFieldUserCount: allowedFieldUsers.length
      },
      periods: {
        mtd: { start: mtdStart, end: mtdEnd },
        lmtd: { start: lmtdStart, end: lmtdEnd }
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30'
      }
    })
    
  } catch (error) {
    console.error('LMTD Filters API error:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : '')
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
