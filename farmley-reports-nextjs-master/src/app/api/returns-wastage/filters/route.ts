import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'

// Date range helper
function getDateRange(range: string) {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  switch (range) {
    case 'today':
      return {
        start: startOfToday,
        end: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1)
      }
    case 'yesterday':
      const yesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000)
      return {
        start: yesterday,
        end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
      }
    case 'thisWeek':
      const dayOfWeek = startOfToday.getDay()
      const startOfWeek = new Date(startOfToday.getTime() - dayOfWeek * 24 * 60 * 60 * 1000)
      return { start: startOfWeek, end: today }
    case 'thisMonth':
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: today
      }
    case 'lastMonth':
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)
      return { start: lastMonthStart, end: lastMonthEnd }
    case 'thisQuarter':
      const currentQuarter = Math.floor(today.getMonth() / 3)
      const quarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1)
      return { start: quarterStart, end: today }
    case 'lastQuarter':
      const lastQ = Math.floor(today.getMonth() / 3) - 1
      const lastQuarterStart = lastQ < 0
        ? new Date(today.getFullYear() - 1, 9, 1)
        : new Date(today.getFullYear(), lastQ * 3, 1)
      const lastQuarterEnd = lastQ < 0
        ? new Date(today.getFullYear() - 1, 11, 31)
        : new Date(today.getFullYear(), (lastQ + 1) * 3, 0, 23, 59, 59)
      return { start: lastQuarterStart, end: lastQuarterEnd }
    case 'thisYear':
      return {
        start: new Date(today.getFullYear(), 0, 1),
        end: today
      }
    default:
      return {
        start: new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: today
      }
  }
}

// Cached filter data fetcher
const getCachedFilters = unstable_cache(
  async (dateRange: string, regionCode?: string) => {
    const { start: startDate, end: endDate } = getDateRange(dateRange)
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

    await db.initialize()

    // Build region filter for routes
    const regionFilter = regionCode && regionCode !== 'all' ? `
      AND t.route_code IN (
        SELECT DISTINCT route_code
        FROM new_flat_journey_management
        WHERE route_name IS NOT NULL
          AND (
            route_name ~ '\\[${regionCode}\\]'
            OR (route_name ILIKE '%${regionCode}%')
            ${regionCode === 'AUH' ? "OR route_name ILIKE '%ABU DHABI%'" : ''}
            ${regionCode === 'DXB' ? "OR route_name ILIKE '%DUBAI%' OR route_name ILIKE '%DEIRA%'" : ''}
            ${regionCode === 'SHJ' ? "OR route_name ILIKE '%SHARJAH%'" : ''}
            ${regionCode === 'FUJ' ? "OR route_name ILIKE '%FUJAIRAH%'" : ''}
            ${regionCode === 'AJM' ? "OR route_name ILIKE '%AJMAN%'" : ''}
            ${regionCode === 'AIN' ? "OR route_name ILIKE '%AL AIN%' OR route_name ILIKE '%ALAIN%'" : ''}
          )
      )
    ` : ''

    // Get unique regions from routes with returns data
    const regionsQuery = `
      WITH route_regions AS (
        SELECT DISTINCT
          t.route_code,
          j.route_name,
          CASE
            WHEN j.route_name ~ '\\[([A-Z]+)\\]' THEN
              SUBSTRING(j.route_name FROM '\\[([A-Z]+)\\]')
            WHEN j.route_name ILIKE '%AUH%' OR j.route_name ILIKE '%ABU DHABI%' THEN 'AUH'
            WHEN j.route_name ILIKE '%DXB%' OR j.route_name ILIKE '%DUBAI%' OR j.route_name ILIKE '%DEIRA%' THEN 'DXB'
            WHEN j.route_name ILIKE '%SHJ%' OR j.route_name ILIKE '%SHARJAH%' THEN 'SHJ'
            WHEN j.route_name ILIKE '%RAK%' THEN 'RAK'
            WHEN j.route_name ILIKE '%FUJ%' OR j.route_name ILIKE '%FUJAIRAH%' THEN 'FUJ'
            WHEN j.route_name ILIKE '%AJM%' OR j.route_name ILIKE '%AJMAN%' THEN 'AJM'
            WHEN j.route_name ILIKE '%AL AIN%' OR j.route_name ILIKE '%ALAIN%' THEN 'AIN'
            WHEN j.route_name ILIKE '%UMM%' OR j.route_name ILIKE '%UAQ%' THEN 'UAQ'
            ELSE 'OTHER'
          END as region
        FROM new_flat_transactions t
        LEFT JOIN (
          SELECT DISTINCT route_code, route_name
          FROM new_flat_journey_management
          WHERE route_name IS NOT NULL AND route_name != ''
        ) j ON t.route_code = j.route_code
        WHERE t.trx_type = 4
          AND t.trx_date BETWEEN $1 AND $2
      )
      SELECT
        region as code,
        region as name,
        COUNT(DISTINCT route_code) as route_count
      FROM route_regions
      WHERE region IS NOT NULL AND region != 'OTHER'
      GROUP BY region
      ORDER BY route_count DESC
    `

    // Get unique salesmen who actually have returns data in the date range
    // ONLY show salesmen who have actual returns, not just transactions
    // Filter by region if selected
    const salesmenQuery = `
      SELECT DISTINCT
        t.salesman_code as code,
        MAX(t.salesman_name) as name
      FROM new_flat_transactions t
      WHERE t.trx_type = 4
        AND t.salesman_code IS NOT NULL
        AND t.trx_date BETWEEN $1 AND $2
        ${regionFilter}
      GROUP BY t.salesman_code
      ORDER BY code
    `

    // Get unique routes that have returns data in the date range
    // ONLY show routes with actual returns
    // JOIN with new_flat_journey_management to get route names
    // Filter by region if selected
    const routesQuery = `
      SELECT DISTINCT
        t.route_code as code,
        COALESCE(j.route_name, t.route_code) as name
      FROM new_flat_transactions t
      LEFT JOIN (
        SELECT DISTINCT route_code, route_name
        FROM new_flat_journey_management
        WHERE route_name IS NOT NULL AND route_name != ''
      ) j ON t.route_code = j.route_code
      WHERE t.trx_type = 4
        AND t.route_code IS NOT NULL
        AND t.trx_date BETWEEN $1 AND $2
        ${regionFilter}
      ORDER BY code
    `

    const [regionsResult, salesmenResult, routesResult] = await Promise.all([
      db.query(regionsQuery, [startDateStr, endDateStr]),
      db.query(salesmenQuery, [startDateStr, endDateStr]),
      db.query(routesQuery, [startDateStr, endDateStr])
    ])

    return {
      regions: regionsResult.rows,
      salesmen: salesmenResult.rows,
      routes: routesResult.rows
    }
  },
  (dateRange: string, regionCode?: string) => ['returns-wastage-filters', dateRange, regionCode || 'all'],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ['returns-wastage-filters']
  }
)

// Route segment config for optimal caching
export const dynamic = 'force-dynamic'
export const revalidate = 300 // Revalidate every 5 minutes

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateRange = searchParams.get('range') || 'lastMonth'
    const regionCode = searchParams.get('region') || 'all'

    const data = await getCachedFilters(dateRange, regionCode)

    const response = NextResponse.json({
      success: true,
      ...data,
      timestamp: new Date().toISOString()
    })

    // Add cache headers
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

    return response

  } catch (error) {
    console.error('Returns filters API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
