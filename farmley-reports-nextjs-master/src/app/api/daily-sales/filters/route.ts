import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { FILTERS_CACHE_DURATION, getCacheControlHeader } from '@/lib/cache-utils'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Get selected filter values
    const selectedRegion = searchParams.get('regionCode')
    const selectedCity = searchParams.get('cityCode')
    const selectedFieldUserRole = searchParams.get('fieldUserRole')
    const selectedTeamLeader = searchParams.get('teamLeaderCode')
    const selectedUser = searchParams.get('userCode')
    const selectedChain = searchParams.get('chainName')
    const selectedStore = searchParams.get('storeCode')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Get loginUserCode for hierarchy-based filtering
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Fetch child users if loginUserCode is provided
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
          ${startDate && endDate ? `AND trx_date_only >= '${startDate}'::date AND trx_date_only <= '${endDate}'::date` : ''}
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
    }

    // Build dynamic where clause for availability counts
    const buildAvailabilityWhere = (excludeField?: string) => {
      const conditions = []

      // Exclude DEMO data
      conditions.push(`UPPER(COALESCE(field_user_code, '')) NOT LIKE '%DEMO%'`)
      conditions.push(`UPPER(COALESCE(region_code, '')) NOT LIKE '%DEMO%'`)

      // Add date range if provided
      if (startDate && endDate) {
        conditions.push(`trx_date_only >= '${startDate}'::date`)
        conditions.push(`trx_date_only <= '${endDate}'::date`)
      }
      
      // Add user hierarchy filter (if not admin)
      if (allowedUserCodes.length > 0) {
        const userCodesStr = allowedUserCodes.map(code => `'${code}'`).join(', ')
        conditions.push(`field_user_code IN (${userCodesStr})`)
      }

      // Add other filters (excluding the field being fetched)
      if (selectedRegion && excludeField !== 'region') {
        conditions.push(`region_code = '${selectedRegion}'`)
      }
      if (selectedCity && excludeField !== 'city') {
        conditions.push(`(city_code = '${selectedCity}' OR city_name = '${selectedCity}')`)
      }
      if (selectedFieldUserRole && excludeField !== 'fieldUserRole') {
        conditions.push(`COALESCE(user_role, 'Field User') = '${selectedFieldUserRole}'`)
      }
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

      return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    }

    // Fetch all filter options in parallel
    const [
      regionsResult,
      citiesResult,
      fieldUserRolesResult,
      teamLeadersResult,
      fieldUsersResult,
      chainsResult,
      storesResult,
      dateRangeResult
    ] = await Promise.all([
      // Get ALL regions with counts based on other filters
      query(`
        SELECT
          r.region_code as "value",
          r.region_code as "label",
          COALESCE(counts.transaction_count, 0) as "transactionCount"
        FROM (
          SELECT DISTINCT region_code
          FROM flat_sales_transactions
          WHERE region_code IS NOT NULL
          AND UPPER(region_code) NOT LIKE '%DEMO%'
          ${allowedUserCodes.length > 0 ? `AND field_user_code IN (${allowedUserCodes.map(c => `'${c}'`).join(', ')})` : ''}
        ) r
        LEFT JOIN (
          SELECT
            region_code,
            COUNT(*) as transaction_count
          FROM flat_sales_transactions
          ${buildAvailabilityWhere('region')}
          GROUP BY region_code
        ) counts ON r.region_code = counts.region_code
        ORDER BY r.region_code
      `),

      // Get cities
      query(`
        SELECT
          c.city_value as "value",
          c.city_label as "label",
          COALESCE(counts.transaction_count, 0) as "transactionCount",
          COALESCE(counts.store_count, 0) as "storeCount"
        FROM (
          SELECT DISTINCT
            COALESCE(
              city_name,
              CASE
                WHEN city_code LIKE '%_%' THEN SUBSTRING(city_code FROM POSITION('_' IN city_code) + 1)
                ELSE city_code
              END
            ) as city_value,
            COALESCE(
              city_name,
              CASE
                WHEN city_code LIKE '%_%' THEN SUBSTRING(city_code FROM POSITION('_' IN city_code) + 1)
                ELSE city_code
              END
            ) as city_label
          FROM flat_sales_transactions
          WHERE (city_name IS NOT NULL OR city_code IS NOT NULL)
          AND UPPER(COALESCE(city_name, city_code)) NOT LIKE '%DEMO%'
          ${allowedUserCodes.length > 0 ? `AND field_user_code IN (${allowedUserCodes.map(c => `'${c}'`).join(', ')})` : ''}
        ) c
        LEFT JOIN (
          SELECT
            COALESCE(
              city_name,
              CASE
                WHEN city_code LIKE '%_%' THEN SUBSTRING(city_code FROM POSITION('_' IN city_code) + 1)
                ELSE city_code
              END
            ) as city_value,
            COUNT(*) as transaction_count,
            COUNT(DISTINCT store_code) as store_count
          FROM flat_sales_transactions
          ${buildAvailabilityWhere('city')}
          GROUP BY city_value
        ) counts ON c.city_value = counts.city_value
        WHERE c.city_value IS NOT NULL
        AND c.city_value != ''
        ORDER BY c.city_label
      `),

      // Get field user roles (excluding Team Leader)
      query(`
        SELECT
          r.role as "value",
          CASE r.role
            WHEN 'ATL' THEN 'Asst. Team Leader'
            ELSE r.role
          END as "label",
          COALESCE(counts.transaction_count, 0) as "transactionCount"
        FROM (
          SELECT DISTINCT COALESCE(user_role, 'Field User') as role
          FROM flat_sales_transactions
          WHERE field_user_code IS NOT NULL
          AND UPPER(field_user_code) NOT LIKE '%DEMO%'
          AND COALESCE(user_role, 'Field User') != 'Team Leader'
        ) r
        LEFT JOIN (
          SELECT
            COALESCE(user_role, 'Field User') as role,
            COUNT(*) as transaction_count
          FROM flat_sales_transactions
          ${buildAvailabilityWhere('fieldUserRole')}
          AND COALESCE(user_role, 'Field User') != 'Team Leader'
          GROUP BY user_role
        ) counts ON r.role = counts.role
        ORDER BY
          CASE r.role
            WHEN 'ATL' THEN 1
            WHEN 'Promoter' THEN 2
            WHEN 'Merchandiser' THEN 3
            WHEN 'Field User' THEN 4
            ELSE 5
          END
      `),

      // Get Team Leaders
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
          ${buildAvailabilityWhere('teamLeader') || 'WHERE 1=1'}
          AND tl_code IS NOT NULL
          GROUP BY tl_code
        )
        SELECT
          tl.code as "value",
          tl.name || ' (' || tl.code || ')' as "label",
          COALESCE(ft.transaction_count, 0) as "transactionCount"
        FROM all_team_leaders tl
        LEFT JOIN filtered_transactions ft ON tl.code = ft.tl_code
        ORDER BY tl.name
      `),

      // Get field users
      query(`
        SELECT
          fu.field_user_code as "value",
          fu.field_user_name || ' (' || fu.field_user_code || ')' as "label",
          fu.role as "role",
          COALESCE(counts.transaction_count, 0) as "transactionCount"
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
          ${buildAvailabilityWhere('user')}
          GROUP BY field_user_code
        ) counts ON fu.field_user_code = counts.field_user_code
        ORDER BY fu.field_user_name
      `),

      // Get chains/channels
      query(`
        SELECT
          c.chain_name as "value",
          c.chain_name as "label",
          COALESCE(counts.transaction_count, 0) as "transactionCount",
          COALESCE(counts.store_count, 0) as "storeCount"
        FROM (
          SELECT DISTINCT COALESCE(chain_name, 'Unknown') as chain_name
          FROM flat_sales_transactions
          WHERE chain_name IS NOT NULL
          ${allowedUserCodes.length > 0 ? `AND field_user_code IN (${allowedUserCodes.map(c => `'${c}'`).join(', ')})` : ''}
        ) c
        LEFT JOIN (
          SELECT
            COALESCE(chain_name, 'Unknown') as chain_name,
            COUNT(*) as transaction_count,
            COUNT(DISTINCT store_code) as store_count
          FROM flat_sales_transactions
          ${buildAvailabilityWhere('chain')}
          GROUP BY chain_name
        ) counts ON c.chain_name = counts.chain_name
        ORDER BY c.chain_name
      `),

      // Get stores/customers
      query(`
        SELECT
          s.store_code as "value",
          s.store_name || ' (' || s.store_code || ')' as "label",
          s.chain_name as "chainName",
          COALESCE(counts.transaction_count, 0) as "transactionCount"
        FROM (
          SELECT DISTINCT
            store_code,
            store_name,
            COALESCE(chain_name, 'Unknown') as chain_name
          FROM flat_sales_transactions
          WHERE store_code IS NOT NULL
          AND store_name IS NOT NULL
          ${allowedUserCodes.length > 0 ? `AND field_user_code IN (${allowedUserCodes.map(c => `'${c}'`).join(', ')})` : ''}
        ) s
        LEFT JOIN (
          SELECT
            store_code,
            COUNT(*) as transaction_count
          FROM flat_sales_transactions
          ${buildAvailabilityWhere('store')}
          GROUP BY store_code
        ) counts ON s.store_code = counts.store_code
        ORDER BY s.store_name
      `),

      // Get date range
      query(`
        SELECT
          MIN(trx_date_only) as "minDate",
          MAX(trx_date_only) as "maxDate",
          COUNT(DISTINCT trx_date_only) as "daysWithData"
        FROM flat_sales_transactions
        ${buildAvailabilityWhere()}
      `)
    ])

    // Format results - ONLY SHOW OPTIONS WITH TRANSACTIONS (or currently selected)
    const regions = regionsResult.rows
      .map(row => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.transactionCount) || 0
      }))
      .filter(r => r.available > 0 || r.value === selectedRegion)

    const cities = citiesResult.rows
      .map(row => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.transactionCount) || 0,
        storeCount: parseInt(row.storeCount) || 0
      }))
      .filter(c => c.available > 0 || c.value === selectedCity)

    const fieldUserRoles = fieldUserRolesResult.rows
      .map(row => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.transactionCount) || 0
      }))
      .filter(r => r.available > 0 || r.value === selectedFieldUserRole)

    const teamLeaders = teamLeadersResult.rows
      .map(row => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.transactionCount) || 0
      }))
      .filter(tl => {
        // If hierarchy filtering is active, show ALL team leaders in hierarchy
        if (allowedTeamLeaders.length > 0) return true
        // Otherwise only show those with transactions
        return tl.available > 0 || tl.value === selectedTeamLeader
      })

    const fieldUsers = fieldUsersResult.rows
      .map(row => ({
        value: row.value,
        label: row.label,
        role: row.role,
        available: parseInt(row.transactionCount) || 0
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
        available: parseInt(row.transactionCount) || 0,
        storeCount: parseInt(row.storeCount) || 0
      }))
      .filter(c => c.available > 0 || c.value === selectedChain)

    const stores = storesResult.rows
      .map(row => ({
        value: row.value,
        label: row.label,
        chainName: row.chainName,
        available: parseInt(row.transactionCount) || 0
      }))
      .filter(s => s.available > 0 || s.value === selectedStore)

    // Get date range info
    const dateRange = dateRangeResult.rows[0] || {}

    // Calculate summary statistics
    const summary = {
      totalRegions: regions.length,
      totalUsers: fieldUsers.length,
      totalTeamLeaders: teamLeaders.length,
      totalChains: chains.length,
      totalStores: stores.length,
      dateRange: {
        min: dateRange.minDate,
        max: dateRange.maxDate,
        daysWithData: dateRange.daysWithData || 0
      }
    }

    return NextResponse.json({
      regions,
      cities,
      fieldUserRoles,
      teamLeaders,
      fieldUsers,
      chains,
      stores,
      summary,
      cached: true,
      cacheInfo: { duration: FILTERS_CACHE_DURATION }
    }, {
      headers: {
        'Cache-Control': getCacheControlHeader(FILTERS_CACHE_DURATION)
      }
    })

  } catch (error) {
    console.error('Daily Sales Filters API error:', error)
    return NextResponse.json({
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
