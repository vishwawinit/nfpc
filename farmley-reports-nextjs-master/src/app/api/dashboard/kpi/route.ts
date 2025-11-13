import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Cache for KPI data to improve performance
const kpiCache = new Map<string, { data: any, timestamp: number, ttl: number }>()
const CACHE_TTL_MINUTES: Record<string, number> = {
  'today': 5,      // 5 minutes for today
  'yesterday': 60, // 1 hour for yesterday
  'thisWeek': 30,  // 30 minutes for this week
  'thisMonth': 60, // 1 hour for this month
  'lastMonth': 360, // 6 hours for last month (stable data)
  'thisQuarter': 120, // 2 hours for this quarter
  'lastQuarter': 720, // 12 hours for last quarter (stable data)
  'thisYear': 180,    // 3 hours for this year
  'custom': 15        // 15 minutes for custom dates
}

function getCacheKey(params: URLSearchParams): string {
  const sortedParams = Array.from(params.entries()).sort()
  return sortedParams.map(([key, value]) => `${key}=${value}`).join('&')
}

function getCachedData(cacheKey: string): any | null {
  const cached = kpiCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    console.log('KPI Cache HIT for key:', cacheKey)
    return cached.data
  }
  if (cached) {
    kpiCache.delete(cacheKey)
    console.log('KPI Cache EXPIRED for key:', cacheKey)
  }
  return null
}

function setCachedData(cacheKey: string, data: any, dateRange: string): void {
  const ttlMinutes = CACHE_TTL_MINUTES[dateRange] || CACHE_TTL_MINUTES['custom']
  const ttl = ttlMinutes * 60 * 1000 // Convert to milliseconds
  kpiCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl
  })
  console.log(`KPI Cache SET for key: ${cacheKey}, TTL: ${ttlMinutes}min`)
}

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Intelligent caching based on date range
function getCacheDuration(dateRange: string, hasCustomDates: boolean): number {
  // If custom dates are provided, use medium cache (15 mins)
  if (hasCustomDates) {
    return 900 // 15 minutes
  }
  
  switch(dateRange) {
    case 'today':
    case 'yesterday':
      return 600 // 10 minutes - changes frequently
    case 'thisWeek':
    case 'lastWeek':
    case 'last7Days':
      return 900 // 15 minutes - moderately dynamic
    case 'thisMonth':
    case 'last30Days':
      return 1800 // 30 minutes - changes daily
    case 'lastMonth':
    case 'thisQuarter':
    case 'lastQuarter':
    case 'thisYear':
      return 3600 // 60 minutes - historical data, stable
    default:
      return 900 // 15 minutes default
  }
}

// Helper function to parse date range string
const getDateRangeFromString = (dateRange: string) => {
  const current = new Date()
  let startDate: Date
  let endDate: Date = new Date(current)

  switch(dateRange) {
    case 'today':
      startDate = new Date(current)
      break
    case 'yesterday':
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 1)
      endDate = new Date(startDate)
      break
    case 'thisWeek':
    case 'last7Days':
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 6)
      break
    case 'last30Days':
    case 'thisMonth':
      startDate = new Date(current.getFullYear(), current.getMonth(), 1)
      break
    case 'lastMonth':
      startDate = new Date(current.getFullYear(), current.getMonth() - 1, 1)
      endDate = new Date(current.getFullYear(), current.getMonth(), 0)
      break
    case 'thisQuarter':
      const quarter = Math.floor(current.getMonth() / 3)
      startDate = new Date(current.getFullYear(), quarter * 3, 1)
      break
    case 'lastQuarter':
      const lastQuarter = Math.floor(current.getMonth() / 3) - 1
      startDate = new Date(current.getFullYear(), lastQuarter * 3, 1)
      endDate = new Date(current.getFullYear(), lastQuarter * 3 + 3, 0)
      break
    case 'thisYear':
      startDate = new Date(current.getFullYear(), 0, 1)
      break
    default:
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 29)
  }

  return {
    startDate,
    endDate
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateRange = searchParams.get('range') || 'thisMonth'
    const cacheKey = getCacheKey(searchParams)
    
    console.log('KPI API called with params:', searchParams.toString())
    console.log('Date range:', dateRange)
    
    // Check cache first
    const cachedResult = getCachedData(cacheKey)
    if (cachedResult) {
      return NextResponse.json({ success: true, data: cachedResult, cached: true })
    }

    // Get filter parameters
    const regionCode = searchParams.get('regionCode')
    const cityCode = searchParams.get('city') || searchParams.get('cityCode')
    const fieldUserRole = searchParams.get('fieldUserRole')
    const teamLeaderCode = searchParams.get('teamLeaderCode')
    const userCode = searchParams.get('userCode')
    const customStartDate = searchParams.get('startDate')
    const customEndDate = searchParams.get('endDate')

    // Get the actual current date
    const currentDate = new Date()

    // Get date range - prioritize custom dates if provided
    let startDate: Date, endDate: Date
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate)
      endDate = new Date(customEndDate)
    } else {
      const dateRangeResult = getDateRangeFromString(dateRange)
      startDate = dateRangeResult.startDate
      endDate = dateRangeResult.endDate
    }

    // Build filter conditions
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Date conditions - improved date handling
    // Handle timezone and ensure we capture full days
    conditions.push(`DATE(t.transaction_date) >= $${paramIndex}`)
    params.push(startDate.toISOString().split('T')[0])
    paramIndex++
    conditions.push(`DATE(t.transaction_date) <= $${paramIndex}`)
    params.push(endDate.toISOString().split('T')[0])
    paramIndex++
    
    console.log('Date filter applied:', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      dateRange
    })

    // Region filter - use state from customers master
    if (regionCode) {
      conditions.push(`c.state = $${paramIndex}`)
      params.push(regionCode)
      paramIndex++
      console.log('Applied region filter:', regionCode)
    }

    // City filter - from customers master
    if (cityCode) {
      conditions.push(`c.city = $${paramIndex}`)
      params.push(cityCode)
      paramIndex++
      console.log('Applied city filter:', cityCode)
    }

    // Team Leader filter - using sales_person_code
    if (teamLeaderCode) {
      conditions.push(`c.sales_person_code = $${paramIndex}`)
      params.push(teamLeaderCode)
      paramIndex++
      console.log('Applied team leader filter:', teamLeaderCode)
    }

    // Field User Role filter - using sales_person_code
    if (fieldUserRole) {
      conditions.push(`c.sales_person_code = $${paramIndex}`)
      params.push(fieldUserRole)
      paramIndex++
      console.log('Applied field user role filter:', fieldUserRole)
    }

    // User filter
    if (userCode) {
      conditions.push(`t.user_code = $${paramIndex}`)
      params.push(userCode)
      paramIndex++
      console.log('Applied user filter:', userCode)
    }

    // Chain filter - using customer_type (already extracted at top)
    const chainName = searchParams.get('chainName')
    if (chainName) {
      conditions.push(`c.customer_type = $${paramIndex}`)
      params.push(chainName)
      paramIndex++
      console.log('Applied chain filter:', chainName)
    }

    // Store filter - using customer_code (already extracted at top)
    const storeCode = searchParams.get('storeCode')
    if (storeCode) {
      conditions.push(`t.customer_code = $${paramIndex}`)
      params.push(storeCode)
      paramIndex++
      console.log('Applied store filter:', storeCode)
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    const buildAggregateQuery = (clause: string) => `
      WITH filtered AS (
        SELECT
          t.transaction_code,
          t.customer_code,
          t.user_code,
          COALESCE(t.currency_code, 'AED') as currency_code,
          COALESCE(t.quantity_bu, 0) as quantity_bu,
          COALESCE(t.net_amount, 0) as net_amount,
          COALESCE(
            t.line_amount,
            COALESCE(t.quantity_bu, 0) * COALESCE(t.price_used_level1, t.base_price, 0),
            t.net_amount
          ) as line_total
        FROM flat_transactions t
        LEFT JOIN flat_customers_master c ON t.customer_code = c.customer_code
        ${clause}
      ), transaction_totals AS (
        SELECT
          transaction_code,
          customer_code,
          user_code,
          SUM(line_total) as transaction_value,
          SUM(CASE WHEN net_amount < 0 THEN ABS(line_total) ELSE 0 END) as transaction_returns,
          SUM(CASE WHEN net_amount >= 0 THEN line_total ELSE 0 END) as transaction_sales,
          SUM(CASE WHEN net_amount >= 0 THEN quantity_bu ELSE 0 END) as transaction_quantity,
          BOOL_OR(net_amount >= 0) as has_sale,
          BOOL_OR(net_amount < 0) as has_return,
          MAX(currency_code) as currency_code
        FROM filtered
        GROUP BY transaction_code, customer_code, user_code
      )
      SELECT
        COALESCE(SUM(transaction_sales), 0) as total_sales,
        COALESCE(SUM(transaction_returns), 0) as return_sales,
        COALESCE(SUM(transaction_value), 0) as net_sales,
        COALESCE(SUM(transaction_quantity), 0) as total_quantity,
        COUNT(DISTINCT CASE WHEN has_sale THEN transaction_code END) as total_orders,
        COUNT(DISTINCT CASE WHEN has_return THEN transaction_code END) as return_orders,
        COUNT(DISTINCT CASE WHEN has_sale THEN customer_code END) as unique_customers,
        COALESCE(MAX(currency_code), 'AED') as currency_code,
        COUNT(*) as total_records
      FROM transaction_totals
    `
    
    console.log('Executing current period query with params:', params)
    const currentResult = await query(buildAggregateQuery(whereClause), params)

    const current = currentResult.rows[0] || {}
    const currentTotalSales = parseFloat(current.total_sales || '0')
    const currentReturnSales = parseFloat(current.return_sales || '0')
    const currentNetSales = parseFloat(current.net_sales || '0')
    const currentTotalOrders = parseInt(current.total_orders || '0')
    const currentReturnOrders = parseInt(current.return_orders || '0')
    const currentNetOrders = currentTotalOrders - currentReturnOrders
    const currentUniqueCustomers = parseInt(current.unique_customers || '0')
    const currentTotalUnits = parseFloat(current.total_quantity || '0')
    const currentCurrencyCode = current.currency_code || 'AED'
    const currentAvgOrder = currentNetOrders > 0 ? currentNetSales / currentNetOrders : 0
    const totalRecords = parseInt(current.total_records || '0')
    
    console.log('Current period results:', {
      totalRecords,
      currentNetSales,
      currentNetOrders,
      currentUniqueCustomers,
      dateRange,
      currencyCode: currentCurrencyCode
    })

    // Previous period stats (same duration, shifted back)
    const periodLength = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const prevStartDate = new Date(startDate)
    prevStartDate.setDate(prevStartDate.getDate() - periodLength)
    const prevEndDate = new Date(startDate)
    prevEndDate.setDate(prevEndDate.getDate() - 1)

    // Build WHERE clause for previous period
    const prevConditions: string[] = []
    const prevParams: any[] = []
    let prevParamIndex = 1

    // Date conditions for previous period
    prevConditions.push(`t.transaction_date::date >= $${prevParamIndex}`)
    prevParams.push(prevStartDate.toISOString().split('T')[0])
    prevParamIndex++
    prevConditions.push(`t.transaction_date::date <= $${prevParamIndex}`)
    prevParams.push(prevEndDate.toISOString().split('T')[0])
    prevParamIndex++

    // Add the same filters as current period
    if (regionCode) {
      prevConditions.push(`c.state = $${prevParamIndex}`)
      prevParams.push(regionCode)
      prevParamIndex++
    }
    if (cityCode) {
      prevConditions.push(`c.city = $${prevParamIndex}`)
      prevParams.push(cityCode)
      prevParamIndex++
    }
    if (teamLeaderCode) {
      prevConditions.push(`c.sales_person_code = $${prevParamIndex}`)
      prevParams.push(teamLeaderCode)
      prevParamIndex++
    }
    if (fieldUserRole) {
      prevConditions.push(`c.sales_person_code = $${prevParamIndex}`)
      prevParams.push(fieldUserRole)
      prevParamIndex++
    }
    if (userCode) {
      prevConditions.push(`t.user_code = $${prevParamIndex}`)
      prevParams.push(userCode)
      prevParamIndex++
    }
    if (chainName) {
      prevConditions.push(`c.customer_type = $${prevParamIndex}`)
      prevParams.push(chainName)
      prevParamIndex++
    }
    if (storeCode) {
      prevConditions.push(`t.customer_code = $${prevParamIndex}`)
      prevParams.push(storeCode)
      prevParamIndex++
    }

    const prevWhereClause = `WHERE ${prevConditions.join(' AND ')}`

    const prevResult = await query(buildAggregateQuery(prevWhereClause), prevParams)

    const prev = prevResult.rows[0] || {}
    const prevTotalSales = parseFloat(prev.total_sales || '0')
    const prevReturnSales = parseFloat(prev.return_sales || '0')
    const prevNetSales = parseFloat(prev.net_sales || '0')
    const prevTotalOrders = parseInt(prev.total_orders || '0')
    const prevReturnOrders = parseInt(prev.return_orders || '0')
    const prevNetOrders = prevTotalOrders - prevReturnOrders
    const prevUniqueCustomers = parseInt(prev.unique_customers || '0')
    const prevTotalUnits = parseFloat(prev.total_quantity || '0')

    // Calculate changes
    const netSalesChange = prevNetSales > 0 ? ((currentNetSales - prevNetSales) / prevNetSales * 100) : 0
    const netOrdersChange = prevNetOrders > 0 ? ((currentNetOrders - prevNetOrders) / prevNetOrders * 100) : 0
    const uniqueCustomersChange = prevUniqueCustomers > 0 ? ((currentUniqueCustomers - prevUniqueCustomers) / prevUniqueCustomers * 100) : 0
    const unitsChange = prevTotalUnits > 0 ? ((currentTotalUnits - prevTotalUnits) / prevTotalUnits * 100) : 0

    // Calculate average order value
    const prevAvgOrder = prevNetOrders > 0 ? prevNetSales / prevNetOrders : 0
    const avgOrderChange = prevAvgOrder > 0 ? ((currentAvgOrder - prevAvgOrder) / prevAvgOrder * 100) : 0

    // MTD and YTD calculations - apply same filters
    const mtdStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const mtdConditions = [`DATE(t.transaction_date) >= $1`, `DATE(t.transaction_date) <= $2`]
    const mtdParams = [mtdStartDate.toISOString().split('T')[0], currentDate.toISOString().split('T')[0]]
    let mtdParamIndex = 3
    
    // Apply the same filters to MTD
    if (regionCode) { mtdConditions.push(`c.state = $${mtdParamIndex}`); mtdParams.push(regionCode); mtdParamIndex++ }
    if (cityCode) { mtdConditions.push(`c.city = $${mtdParamIndex}`); mtdParams.push(cityCode); mtdParamIndex++ }
    if (teamLeaderCode) { mtdConditions.push(`c.sales_person_code = $${mtdParamIndex}`); mtdParams.push(teamLeaderCode); mtdParamIndex++ }
    if (fieldUserRole) { mtdConditions.push(`c.sales_person_code = $${mtdParamIndex}`); mtdParams.push(fieldUserRole); mtdParamIndex++ }
    if (userCode) { mtdConditions.push(`t.user_code = $${mtdParamIndex}`); mtdParams.push(userCode); mtdParamIndex++ }
    if (chainName) { mtdConditions.push(`c.customer_type = $${mtdParamIndex}`); mtdParams.push(chainName); mtdParamIndex++ }
    if (storeCode) { mtdConditions.push(`t.customer_code = $${mtdParamIndex}`); mtdParams.push(storeCode); mtdParamIndex++ }

    const mtdWhereClause = `WHERE ${mtdConditions.join(' AND ')}`
    const mtdResult = await query(buildAggregateQuery(mtdWhereClause), mtdParams)
    const mtdRow = mtdResult.rows[0] || {}
    const mtdSales = parseFloat(mtdRow.net_sales || '0')

    // YTD calculations with same filters
    const ytdStartDate = new Date(currentDate.getFullYear(), 0, 1)
    const ytdConditions = [`DATE(t.transaction_date) >= $1`, `DATE(t.transaction_date) <= $2`]
    const ytdParams = [ytdStartDate.toISOString().split('T')[0], currentDate.toISOString().split('T')[0]]
    let ytdParamIndex = 3
    
    // Apply the same filters to YTD
    if (regionCode) { ytdConditions.push(`c.state = $${ytdParamIndex}`); ytdParams.push(regionCode); ytdParamIndex++ }
    if (cityCode) { ytdConditions.push(`c.city = $${ytdParamIndex}`); ytdParams.push(cityCode); ytdParamIndex++ }
    if (teamLeaderCode) { ytdConditions.push(`c.sales_person_code = $${ytdParamIndex}`); ytdParams.push(teamLeaderCode); ytdParamIndex++ }
    if (fieldUserRole) { ytdConditions.push(`c.sales_person_code = $${ytdParamIndex}`); ytdParams.push(fieldUserRole); ytdParamIndex++ }
    if (userCode) { ytdConditions.push(`t.user_code = $${ytdParamIndex}`); ytdParams.push(userCode); ytdParamIndex++ }
    if (chainName) { ytdConditions.push(`c.customer_type = $${ytdParamIndex}`); ytdParams.push(chainName); ytdParamIndex++ }
    if (storeCode) { ytdConditions.push(`t.customer_code = $${ytdParamIndex}`); ytdParams.push(storeCode); ytdParamIndex++ }

    const ytdWhereClause = `WHERE ${ytdConditions.join(' AND ')}`
    const ytdResult = await query(buildAggregateQuery(ytdWhereClause), ytdParams)
    const ytdRow = ytdResult.rows[0] || {}
    const ytdSales = parseFloat(ytdRow.net_sales || '0')

    const currencyCode = current.currency_code || 'AED'

    const kpiData = {
      currentTotalSales,
      currentReturnSales,
      currentNetSales,
      currentSales: currentNetSales, // compatibility
      currentTotalOrders,
      currentReturnOrders,
      currentNetOrders,
      currentOrders: currentNetOrders, // compatibility
      currentUniqueCustomers,
      currentCustomers: currentUniqueCustomers, // compatibility
      currentTotalUnits,
      currentUnits: currentTotalUnits, // compatibility
      prevTotalSales,
      prevReturnSales,
      prevNetSales,
      prevTotalOrders,
      prevReturnOrders,
      prevNetOrders,
      prevUniqueCustomers,
      prevTotalUnits,
      averageOrderValue: currentAvgOrder,
      avgOrderChange, // compatibility
      netSalesChange,
      netOrdersChange,
      uniqueCustomersChange,
      unitsChange,
      todayOrders: currentNetOrders,
      todayCustomers: currentUniqueCustomers,
      todayUnits: currentTotalUnits,
      todaySales: currentNetSales, // compatibility
      growthPercentage: netSalesChange,
      salesChange: netSalesChange,
      ordersChange: netOrdersChange,
      customersChange: uniqueCustomersChange,
      conversionRate: currentUniqueCustomers > 0 ? (currentNetOrders / currentUniqueCustomers * 100) : 0,
      mtdSales,
      ytdSales,
      currencyCode: currentCurrencyCode,
      currencySymbol: 'AED',
      // Debug info
      debug: {
        totalRecords,
        dateRange,
        appliedFilters: {
          regionCode,
          cityCode,
          teamLeaderCode,
          fieldUserRole,
          userCode,
          chainName,
          storeCode
        }
      }
    }

    // Calculate cache duration based on date range
    const hasCustomDates = !!(customStartDate && customEndDate)
    const cacheDuration = getCacheDuration(dateRange, hasCustomDates)
    const staleWhileRevalidate = cacheDuration * 2

    // Log the response for debugging
    console.log('KPI API Response Summary:', {
      dateRange,
      currentSales: currentNetSales,
      salesChange: netSalesChange,
      totalRecords,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      cached: false
    })

    // Cache the result before returning
    setCachedData(cacheKey, kpiData, dateRange)

    return NextResponse.json({ 
      success: true, 
      data: kpiData, 
      cached: false,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table'
    }, {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`
      }
    })

  } catch (error) {
    console.error('KPI API error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch dashboard KPIs',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 })
  }
}
