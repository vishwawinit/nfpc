import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Intelligent caching based on date range
function getCacheDuration(dateRange: string, hasCustomDates: boolean): number {
  if (hasCustomDates) return 900 // 15 minutes for custom dates
  
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
      return 3600 // 60 minutes - historical data
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
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const dateRange = searchParams.get('range') || ''

    // Get filter parameters
    const regionCode = searchParams.get('regionCode')
    const cityCode = searchParams.get('city') || searchParams.get('cityCode')
    const teamLeaderCode = searchParams.get('teamLeaderCode')
    const fieldUserRole = searchParams.get('fieldUserRole')
    const userCode = searchParams.get('userCode')
    const customStartDate = searchParams.get('startDate')
    const customEndDate = searchParams.get('endDate')

    // If a specific date range is provided, use it; otherwise use days parameter
    const rangeToUse = dateRange || 'last30Days'

    // Get date range - prioritize custom dates
    let startDate: string, endDate: string
    if (customStartDate && customEndDate) {
      startDate = customStartDate
      endDate = customEndDate
    } else {
      const dateRangeResult = getDateRangeFromString(rangeToUse)
      startDate = dateRangeResult.startDate
      endDate = dateRangeResult.endDate
    }

    // Build WHERE conditions
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Build date filtering based on range - cast transaction_date to date
    conditions.push(`t.transaction_date::date >= $${paramIndex}`)
    params.push(startDate)
    paramIndex++
    conditions.push(`t.transaction_date::date <= $${paramIndex}`)
    params.push(endDate)
    paramIndex++

    // Region filter - use state from customers master
    if (regionCode) {
      conditions.push(`c.state = $${paramIndex}`)
      params.push(regionCode)
      paramIndex++
    }

    // City filter
    if (cityCode) {
      conditions.push(`c.city = $${paramIndex}`)
      params.push(cityCode)
      paramIndex++
    }

    // Team Leader filter - using sales_person_code
    if (teamLeaderCode) {
      conditions.push(`c.sales_person_code = $${paramIndex}`)
      params.push(teamLeaderCode)
      paramIndex++
    }

    // Field User Role filter - using sales_person_code
    if (fieldUserRole) {
      conditions.push(`c.sales_person_code = $${paramIndex}`)
      params.push(fieldUserRole)
      paramIndex++
    }

    // User filter
    if (userCode) {
      conditions.push(`t.user_code = $${paramIndex}`)
      params.push(userCode)
      paramIndex++
    }

    // Chain filter
    const chainName = searchParams.get('chainName')
    if (chainName) {
      conditions.push(`c.customer_type = $${paramIndex}`)
      params.push(chainName)
      paramIndex++
    }

    // Store filter
    const storeCode = searchParams.get('storeCode')
    if (storeCode) {
      conditions.push(`t.customer_code = $${paramIndex}`)
      params.push(storeCode)
      paramIndex++
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Determine grouping and aggregation based on actual day span
    let dateGrouping = ''
    let orderBy = ''

    const start = new Date(startDate)
    const end = new Date(endDate)
    const msInDay = 24 * 60 * 60 * 1000
    const daySpan = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msInDay) + 1)

    if (daySpan <= 14) {
      // Daily aggregation for up to ~2 weeks
      dateGrouping = `DATE(t.transaction_date)`
      orderBy = `DATE(t.transaction_date)`
    } else if (daySpan <= 92) {
      // Weekly aggregation for ~2 weeks to ~3 months
      dateGrouping = `DATE_TRUNC('week', t.transaction_date)`
      orderBy = `DATE_TRUNC('week', t.transaction_date)`
    } else {
      // Monthly aggregation for longer ranges
      dateGrouping = `DATE_TRUNC('month', t.transaction_date)`
      orderBy = `DATE_TRUNC('month', t.transaction_date)`
    }

    // Log the query for debugging
    console.log('Sales trend query params:', { startDate, endDate, daySpan, dateGrouping, conditions: conditions.length })
    
    // Fetch sales trend data from flat_transactions with filters
    const result = await query(`
      SELECT
        ${dateGrouping}::date as date,
        COALESCE(SUM(CASE WHEN t.net_amount >= 0 THEN t.net_amount ELSE 0 END), 0) as sales,
        COUNT(DISTINCT CASE WHEN t.net_amount >= 0 THEN t.transaction_code END) as orders,
        COUNT(DISTINCT CASE WHEN t.net_amount >= 0 THEN t.customer_code END) as customers,
        COALESCE(ABS(SUM(CASE WHEN t.net_amount < 0 THEN t.net_amount ELSE 0 END)), 0) as returns
      FROM flat_transactions t
      LEFT JOIN flat_customers_master c ON t.customer_code = c.customer_code
      ${whereClause}
      GROUP BY ${dateGrouping}
      ORDER BY ${orderBy} ASC
    `, params)

    const trendData = result.rows.map(row => ({
      date: row.date,
      sales: parseFloat(row.sales || '0'),
      orders: parseInt(row.orders || '0'),
      customers: parseInt(row.customers || '0'),
      returns: parseFloat(row.returns || '0')
    }))

    // Determine aggregation type for frontend
    let aggregation = 'daily'
    if (rangeToUse === 'thisYear') {
      aggregation = 'monthly'
    } else if (rangeToUse === 'thisQuarter' || rangeToUse === 'lastQuarter') {
      aggregation = 'weekly'
    }

    // Calculate cache duration
    const hasCustomDates = !!(customStartDate && customEndDate)
    const cacheDuration = getCacheDuration(rangeToUse, hasCustomDates)
    const staleWhileRevalidate = cacheDuration * 2

    return NextResponse.json({
      success: true,
      data: trendData,
      dateRange: rangeToUse,
      aggregation,
      days,
      startDate,
      endDate,
      currentDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      cached: true,
      cacheInfo: {
        duration: cacheDuration,
        dateRange: rangeToUse,
        hasCustomDates
      },
      source: 'postgresql-flat-table'
    }, {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheDuration}, stale-while-revalidate=${staleWhileRevalidate}`
      }
    })

  } catch (error) {
    console.error('Sales trend API error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sales trend data',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 })
  }
}