import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'

// Date range calculation helper
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
      return {
        start: startOfWeek,
        end: today
      }
    case 'thisMonth':
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: today
      }
    case 'lastMonth':
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)
      return {
        start: lastMonthStart,
        end: lastMonthEnd
      }
    case 'lastQuarter':
      // Get the previous quarter (last 3 months)
      const currentQuarter = Math.floor(today.getMonth() / 3)
      const lastQuarterStartMonth = currentQuarter === 0 ? 9 : (currentQuarter - 1) * 3 // Previous quarter start month
      const lastQuarterYear = currentQuarter === 0 ? today.getFullYear() - 1 : today.getFullYear()
      const lastQuarterStart = new Date(lastQuarterYear, lastQuarterStartMonth, 1)
      const lastQuarterEnd = new Date(lastQuarterYear, lastQuarterStartMonth + 3, 0, 23, 59, 59, 999)
      return {
        start: lastQuarterStart,
        end: lastQuarterEnd
      }
    case 'thisYear':
      return {
        start: new Date(today.getFullYear(), 0, 1),
        end: today
      }
    case 'last30Days':
    default:
      return {
        start: new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: today
      }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const dateRange = searchParams.get('range') || 'thisMonth'
    const customerCode = searchParams.get('customerCode') // New customer filter parameter

    // Validate limit parameter
    if (limit <= 0 || limit > 100) {
      return NextResponse.json({
        success: false,
        error: 'Invalid limit parameter. Must be between 1 and 100.'
      }, { status: 400 })
    }

    // Initialize database connection
    await db.initialize()

    console.log(`[Categories API] Fetching data for dateRange: ${dateRange}, customerCode: ${customerCode || 'all'}`)

    // Calculate date boundaries using new_flat_transactions table
    const { start: startDate, end: endDate } = getDateRange(dateRange)
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    console.log(`[Categories API] Date range: ${startDateStr} to ${endDateStr}`)

    // Build customer filter clause
    const customerFilter = customerCode ? 'AND customer_code = $4' : ''
    const queryParams = customerCode ? [limit, startDateStr, endDateStr, customerCode] : [limit, startDateStr, endDateStr]

    // Query using new_flat_transactions table (same as Products API)
    const query = `
      WITH category_stats AS (
        SELECT
          category_name,
          category_code,
          SUM(total_amount) as revenue,
          SUM(quantity) as units_sold,
          COUNT(*) as transactions,
          COUNT(DISTINCT customer_code) as unique_customers,
          CASE WHEN SUM(quantity) > 0 THEN SUM(total_amount) / SUM(quantity) ELSE 0 END as avg_price
        FROM new_flat_transactions
        WHERE trx_date_only >= $2
          AND trx_date_only <= $3
          AND category_name IS NOT NULL
          AND total_amount > 0
          AND quantity > 0
          ${customerFilter}
        GROUP BY category_name, category_code
        HAVING SUM(total_amount) > 0
      ),
      total_stats AS (
        SELECT SUM(revenue) as total_revenue FROM category_stats
      )
      SELECT
        cs.category_name,
        cs.category_code,
        cs.revenue,
        cs.units_sold,
        cs.transactions,
        cs.unique_customers,
        cs.avg_price,
        CASE WHEN ts.total_revenue > 0 THEN (cs.revenue / ts.total_revenue * 100) ELSE 0 END as market_share,
        0 as growth_rate,
        CASE
          WHEN cs.revenue > 100000 THEN 'High'
          WHEN cs.revenue > 10000 THEN 'Medium'
          ELSE 'Standard'
        END as performance_class
      FROM category_stats cs, total_stats ts
      ORDER BY cs.revenue DESC
      LIMIT $1
    `

    // Determine cache duration based on date range
    const getCacheDuration = (range: string): number => {
      switch(range) {
        case 'thisWeek':
        case 'lastWeek':
          return 900 // 15 minutes for weekly data
        case 'thisMonth':
        case 'lastMonth':
          return 1800 // 30 minutes for monthly data
        case 'thisQuarter':
        case 'lastQuarter':
          return 3600 // 1 hour for quarterly data
        case 'thisYear':
        case 'lastYear':
          return 7200 // 2 hours for yearly data
        default:
          return 1800 // 30 minutes default
      }
    }

    const cacheDuration = getCacheDuration(dateRange)
    const cacheKey = `category-performance-${limit}-${dateRange}${customerCode ? `-${customerCode}` : ''}`

    // Create cached version of the query
    const getCachedCategoryData = unstable_cache(
      async () => {
        return await db.query(query, queryParams)
      },
      [`category-performance-data-${cacheKey}`],
      {
        revalidate: cacheDuration,
        tags: [`categories-${dateRange}`, 'category-performance']
      }
    )

    const result = await getCachedCategoryData()

    // Format the response data - using data from new_flat_transactions with actual category codes
    const categories = result.rows.map(row => ({
      category: row.category_name || 'Unknown Category',
      name: row.category_name || 'Unknown Category',
      code: row.category_code || 'UNKNOWN', // Use actual category code from database
      subcategory: row.category_code || 'UNKNOWN', // Use actual category code from database
      totalRevenue: parseFloat(row.revenue || 0),
      revenue: parseFloat(row.revenue || 0),
      unitsSold: parseFloat(row.units_sold || 0),
      transactions: parseInt(row.transactions || 0),
      uniqueCustomers: parseInt(row.unique_customers || 0),
      avgPrice: parseFloat(row.avg_price || 0),
      percentage: parseFloat(row.market_share || 0),
      marketShare: parseFloat(row.market_share || 0),
      growthRate: parseFloat(row.growth_rate || 0),
      performanceClass: row.performance_class || 'Standard'
    }))

    // Calculate totals
    const totals = categories.reduce((acc, cat) => ({
      totalRevenue: acc.totalRevenue + cat.revenue,
      totalUnits: acc.totalUnits + cat.unitsSold,
      totalTransactions: acc.totalTransactions + cat.transactions,
      totalCustomers: acc.totalCustomers + cat.uniqueCustomers
    }), { totalRevenue: 0, totalUnits: 0, totalTransactions: 0, totalCustomers: 0 })

    // Create response with cache headers
    const response = NextResponse.json({
      success: true,
      data: categories,
      summary: totals,
      total: categories.length,
      limit,
      dateRange,
      timestamp: new Date().toISOString(),
      cached: true
    })

    // Set cache headers for browser caching
    response.headers.set('Cache-Control', `public, s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`)
    response.headers.set('X-Cache-Duration', cacheDuration.toString())

    return response

  } catch (error) {
    console.error('Category performance API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch category performance',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

