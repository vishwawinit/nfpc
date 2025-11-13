import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'
import { mockDataService } from '@/services/mockDataService'

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
      AND t.region_code = '${regionCode}'
    ` : ''

    // Get unique regions from customer data
    const regionsQuery = `
      SELECT DISTINCT
        COALESCE(region_code, 'UNKNOWN') as code,
        COALESCE(region_name, 'UNKNOWN') as name,
        COUNT(DISTINCT store_code) as route_count
      FROM flat_sales_transactions
      WHERE trx_type = 1
        AND trx_date_only BETWEEN $1 AND $2
        AND region_code IS NOT NULL
      GROUP BY region_code, region_name
      ORDER BY route_count DESC
    `

    // Get unique salesmen who actually have customer transactions in the date range
    // Filter by region if selected
    const salesmenQuery = `
      SELECT DISTINCT
        t.field_user_code as code,
        MAX(t.field_user_name) as name
      FROM flat_sales_transactions t
      WHERE t.trx_type = 1
        AND t.field_user_code IS NOT NULL
        AND t.trx_date_only BETWEEN $1 AND $2
        ${regionFilter}
      GROUP BY t.field_user_code
      ORDER BY code
    `

    // Get unique routes that have customer data in the date range
    // Filter by region if selected
    const routesQuery = `
      SELECT DISTINCT
        t.user_route_code as code,
        COALESCE(t.route_name, t.user_route_code) as name
      FROM flat_sales_transactions t
      WHERE t.trx_type = 1
        AND t.user_route_code IS NOT NULL
        AND t.trx_date_only BETWEEN $1 AND $2
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
  (dateRange: string, regionCode?: string) => ['customer-filters', dateRange, regionCode || 'all'],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ['customer-filters']
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

    // Check if we should use mock data
    if (process.env.USE_MOCK_DATA === 'true') {
      return await getMockFilters(dateRange, regionCode)
    }

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
    console.error('Customer filters API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Mock data implementation
async function getMockFilters(dateRange: string, regionCode: string) {
  // Get mock data
  const salesmen = await mockDataService.getSalesmen()
  const routes = await mockDataService.getRoutes()
  
  // Create regions from mock data
  const regions = [
    { code: 'REG001', name: 'Dubai Region', route_count: 15 },
    { code: 'REG002', name: 'Abu Dhabi Region', route_count: 12 },
    { code: 'REG003', name: 'Sharjah Region', route_count: 8 },
    { code: 'REG004', name: 'Northern Emirates', route_count: 10 }
  ]

  // Filter by region if specified
  let filteredSalesmen = salesmen
  let filteredRoutes = routes

  if (regionCode && regionCode !== 'all') {
    // Mock filtering by region
    filteredSalesmen = salesmen.filter(s => s.regionCode === regionCode)
    filteredRoutes = routes.filter(r => r.regionCode === regionCode)
  }

  return NextResponse.json({
    success: true,
    regions,
    salesmen: filteredSalesmen.map(s => ({
      code: s.userCode,
      name: s.userName
    })),
    routes: filteredRoutes.map(r => ({
      code: r.routeCode,
      name: r.routeName
    })),
    timestamp: new Date().toISOString(),
    source: 'mock-data'
  })
}
