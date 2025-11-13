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
    
    // Get loginUserCode for hierarchy-based filtering
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Validate user access
    const validation = await validateApiUser(loginUserCode)
    if (!validation.isValid) {
      return validation.response!
    }
    
    // Fetch child users if loginUserCode is provided
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }
    
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Date filters
    if (searchParams.has('startDate') && searchParams.has('endDate')) {
      conditions.push(`visit_date >= $${paramIndex}`)
      params.push(searchParams.get('startDate'))
      paramIndex++
      conditions.push(`visit_date <= $${paramIndex}`)
      params.push(searchParams.get('endDate'))
      paramIndex++
    }

    // Team Leader filter (for cascading)
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

    // Region filter
    if (searchParams.has('regionCode')) {
      conditions.push(`region_code = $${paramIndex}`)
      params.push(searchParams.get('regionCode'))
      paramIndex++
    }

    // Hierarchy filter - apply if allowedUserCodes is provided
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, index) => `$${paramIndex + index}`).join(', ')
      conditions.push(`field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    // Build dynamic WHERE clause for availability counts
    const buildAvailabilityWhere = (excludeField?: string) => {
      const availConditions = []
      let availParamIndex = 1
      const availParams: any[] = []

      // Date filters
      if (searchParams.has('startDate') && searchParams.has('endDate')) {
        availConditions.push(`visit_date >= $${availParamIndex}`)
        availParams.push(searchParams.get('startDate'))
        availParamIndex++
        availConditions.push(`visit_date <= $${availParamIndex}`)
        availParams.push(searchParams.get('endDate'))
        availParamIndex++
      }

      // Hierarchy filter
      if (allowedUserCodes.length > 0) {
        const placeholders = allowedUserCodes.map((_, index) => `$${availParamIndex + index}`).join(', ')
        availConditions.push(`field_user_code IN (${placeholders})`)
        availParams.push(...allowedUserCodes)
        availParamIndex += allowedUserCodes.length
      }

      // Add other filters (excluding the field being fetched)
      if (searchParams.has('teamLeaderCode') && excludeField !== 'teamLeader') {
        availConditions.push(`tl_code = $${availParamIndex}`)
        availParams.push(searchParams.get('teamLeaderCode'))
        availParamIndex++
      }
      if (searchParams.has('userCode') && excludeField !== 'user') {
        availConditions.push(`field_user_code = $${availParamIndex}`)
        availParams.push(searchParams.get('userCode'))
        availParamIndex++
      }
      if (searchParams.has('storeCode') && excludeField !== 'store') {
        availConditions.push(`store_code = $${availParamIndex}`)
        availParams.push(searchParams.get('storeCode'))
        availParamIndex++
      }
      if (searchParams.has('chainCode') && excludeField !== 'chain') {
        availConditions.push(`chain_code = $${availParamIndex}`)
        availParams.push(searchParams.get('chainCode'))
        availParamIndex++
      }
      if (searchParams.has('regionCode') && excludeField !== 'region') {
        availConditions.push(`region_code = $${availParamIndex}`)
        availParams.push(searchParams.get('regionCode'))
        availParamIndex++
      }

      return {
        whereClause: availConditions.length > 0 ? `WHERE ${availConditions.join(' AND ')}` : '',
        params: availParams
      }
    }

    // Get base WHERE for all options (with hierarchy)
    const baseWhere = buildAvailabilityWhere()

    // Get distinct users, stores, cities, purposes, chains, and regions with counts
    const [usersResult, storesResult, citiesResult, purposesResult, outcomesResult, chainsResult, regionsResult] = await Promise.all([
      // Users with counts
      query(`
        SELECT
          u.field_user_code as "value",
          u.field_user_name as "label",
          COALESCE(counts.visit_count, 0) as "available"
        FROM (
          SELECT DISTINCT field_user_code, field_user_name
          FROM flat_store_visits
          ${baseWhere.whereClause}
          AND field_user_code IS NOT NULL
        ) u
        LEFT JOIN (
          SELECT
            field_user_code,
            COUNT(*) as visit_count
          FROM flat_store_visits
          ${buildAvailabilityWhere('user').whereClause}
          GROUP BY field_user_code
        ) counts ON u.field_user_code = counts.field_user_code
        ORDER BY u.field_user_name
      `, baseWhere.params.concat(buildAvailabilityWhere('user').params)),
      
      // Stores with counts
      query(`
        SELECT
          s.store_code as "value",
          s.store_name as "label",
          COALESCE(counts.visit_count, 0) as "available"
        FROM (
          SELECT DISTINCT store_code, store_name
          FROM flat_store_visits
          ${baseWhere.whereClause}
          AND store_code IS NOT NULL
        ) s
        LEFT JOIN (
          SELECT
            store_code,
            COUNT(*) as visit_count
          FROM flat_store_visits
          ${buildAvailabilityWhere('store').whereClause}
          GROUP BY store_code
        ) counts ON s.store_code = counts.store_code
        ORDER BY s.store_name
      `, baseWhere.params.concat(buildAvailabilityWhere('store').params)),
      
      // Cities with counts
      query(`
        SELECT
          c.city_code as "value",
          c.city_code as "label",
          COALESCE(counts.visit_count, 0) as "available"
        FROM (
          SELECT DISTINCT city_code
          FROM flat_store_visits
          ${baseWhere.whereClause}
          AND city_code IS NOT NULL
        ) c
        LEFT JOIN (
          SELECT
            city_code,
            COUNT(*) as visit_count
          FROM flat_store_visits
          ${buildAvailabilityWhere('city').whereClause}
          GROUP BY city_code
        ) counts ON c.city_code = counts.city_code
        ORDER BY c.city_code
      `, baseWhere.params.concat(buildAvailabilityWhere('city').params)),
      
      // Purposes with counts
      query(`
        SELECT
          p.visit_purpose as "value",
          p.visit_purpose as "label",
          COALESCE(counts.visit_count, 0) as "available"
        FROM (
          SELECT DISTINCT visit_purpose
          FROM flat_store_visits
          ${baseWhere.whereClause}
          AND visit_purpose IS NOT NULL
        ) p
        LEFT JOIN (
          SELECT
            visit_purpose,
            COUNT(*) as visit_count
          FROM flat_store_visits
          ${buildAvailabilityWhere('purpose').whereClause}
          GROUP BY visit_purpose
        ) counts ON p.visit_purpose = counts.visit_purpose
        ORDER BY p.visit_purpose
      `, baseWhere.params.concat(buildAvailabilityWhere('purpose').params)),
      
      // Outcomes with counts
      query(`
        SELECT
          o.visit_status as "value",
          o.visit_status as "label",
          COALESCE(counts.visit_count, 0) as "available"
        FROM (
          SELECT DISTINCT visit_status
          FROM flat_store_visits
          ${baseWhere.whereClause}
          AND visit_status IS NOT NULL
        ) o
        LEFT JOIN (
          SELECT
            visit_status,
            COUNT(*) as visit_count
          FROM flat_store_visits
          ${buildAvailabilityWhere('outcome').whereClause}
          GROUP BY visit_status
        ) counts ON o.visit_status = counts.visit_status
        ORDER BY o.visit_status
      `, baseWhere.params.concat(buildAvailabilityWhere('outcome').params)),
      
      // Chains with counts
      query(`
        SELECT
          c.chain_code as "value",
          c.chain_name as "label",
          COALESCE(counts.visit_count, 0) as "available"
        FROM (
          SELECT DISTINCT chain_code, chain_name
          FROM flat_store_visits
          ${baseWhere.whereClause}
          AND chain_code IS NOT NULL
        ) c
        LEFT JOIN (
          SELECT
            chain_code,
            COUNT(*) as visit_count
          FROM flat_store_visits
          ${buildAvailabilityWhere('chain').whereClause}
          GROUP BY chain_code
        ) counts ON c.chain_code = counts.chain_code
        ORDER BY c.chain_name
      `, baseWhere.params.concat(buildAvailabilityWhere('chain').params)),
      
      // Regions with counts
      query(`
        SELECT
          r.region_code as "value",
          r.region_code as "label",
          COALESCE(counts.visit_count, 0) as "available"
        FROM (
          SELECT DISTINCT region_code
          FROM flat_store_visits
          ${baseWhere.whereClause}
          AND region_code IS NOT NULL
        ) r
        LEFT JOIN (
          SELECT
            region_code,
            COUNT(*) as visit_count
          FROM flat_store_visits
          ${buildAvailabilityWhere('region').whereClause}
          GROUP BY region_code
        ) counts ON r.region_code = counts.region_code
        ORDER BY r.region_code
      `, baseWhere.params.concat(buildAvailabilityWhere('region').params))
    ])

    // Get hierarchy filter options from the users hierarchy API
    let teamLeaders: any[] = []
    let assistantLeaders: any[] = []

    try {
      // Fetch hierarchy data from the users hierarchy API using dynamic origin
      const hierarchyResponse = await fetch(`${request.nextUrl.origin}/api/users/hierarchy`)
      if (hierarchyResponse.ok) {
        const hierarchyData = await hierarchyResponse.json()

        teamLeaders = hierarchyData.data.teamLeaders.map((leader: any) => ({
          value: leader.code,
          label: leader.name,
          role: leader.role
        }))

        assistantLeaders = hierarchyData.data.assistantLeaders.map((leader: any) => ({
          value: leader.code,
          label: leader.name,
          role: leader.role
        }))
      }
    } catch (error) {
      console.warn('Failed to fetch hierarchy data:', error)
      // Continue without hierarchy data if there's an error
    }

    // Format results - filter out options with 0 availability
    const users = usersResult.rows
      .map((row: any) => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.available) || 0
      }))
      .filter((u: any) => u.available > 0 || u.value === searchParams.get('userCode'))

    const stores = storesResult.rows
      .map((row: any) => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.available) || 0
      }))
      .filter((s: any) => s.available > 0 || s.value === searchParams.get('storeCode'))

    const cities = citiesResult.rows
      .map((row: any) => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.available) || 0
      }))
      .filter((c: any) => c.available > 0 || c.value === searchParams.get('cityCode'))

    const purposes = purposesResult.rows
      .map((row: any) => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.available) || 0
      }))
      .filter((p: any) => p.available > 0 || p.value === searchParams.get('visitPurpose'))

    const outcomes = outcomesResult.rows
      .map((row: any) => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.available) || 0
      }))
      .filter((o: any) => o.available > 0 || o.value === searchParams.get('visitOutcome'))

    const chains = chainsResult.rows
      .map((row: any) => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.available) || 0
      }))
      .filter((c: any) => c.available > 0 || c.value === searchParams.get('chainCode'))

    const regions = regionsResult.rows
      .map((row: any) => ({
        value: row.value,
        label: row.label,
        available: parseInt(row.available) || 0
      }))
      .filter((r: any) => r.available > 0 || r.value === searchParams.get('regionCode'))

    return NextResponse.json({
      success: true,
      data: {
        users,
        stores,
        cities,
        purposes,
        outcomes,
        chains,
        regions,
        teamLeaders,
        assistantLeaders
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Store Visits Filters API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
