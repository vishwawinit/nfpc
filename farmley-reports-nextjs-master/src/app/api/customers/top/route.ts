import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

/**
 * API Endpoint: GET /api/customers/top
 * Description: Fetches top customers by total sales amount
 * Query Parameters:
 *   - limit: Number of customers to return (default: 10)
 *   - range: Date range filter (thisMonth, lastMonth, thisQuarter, etc.)
 * Returns: Array of top customers with their sales data
 */

// Intelligent caching based on date range
function getCacheDuration(dateRange: string, hasCustomDates: boolean): number {
  if (hasCustomDates) return 900 // 15 minutes for custom dates
  
  switch(dateRange) {
    case 'today':
    case 'yesterday':
      return 600 // 10 minutes
    case 'thisWeek':
    case 'lastWeek':
    case 'last7Days':
      return 900 // 15 minutes
    case 'thisMonth':
    case 'last30Days':
      return 1800 // 30 minutes
    case 'lastMonth':
    case 'thisQuarter':
    case 'lastQuarter':
    case 'thisYear':
      return 3600 // 60 minutes
    default:
      return 900
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
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10')
    const dateRange = searchParams.get('range') || 'thisMonth'

    // Get filter parameters
    const regionCode = searchParams.get('regionCode')
    const cityCode = searchParams.get('city') || searchParams.get('cityCode')
    const teamLeaderCode = searchParams.get('teamLeaderCode')
    const fieldUserRole = searchParams.get('fieldUserRole')
    const userCode = searchParams.get('userCode')
    const customStartDate = searchParams.get('startDate')
    const customEndDate = searchParams.get('endDate')
    
    // Get loginUserCode for hierarchy-based filtering
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Fetch child users if loginUserCode is provided
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }

    // Get date range - prioritize custom dates
    let startDate: string, endDate: string
    if (customStartDate && customEndDate) {
      startDate = customStartDate
      endDate = customEndDate
    } else {
      const dateRangeResult = getDateRangeFromString(dateRange)
      startDate = dateRangeResult.startDate
      endDate = dateRangeResult.endDate
    }

    // Build WHERE conditions
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Date range filter
    if (startDate && endDate) {
      conditions.push(`t.transaction_date::date >= $${paramIndex}`)
      params.push(startDate)
      paramIndex++
      conditions.push(`t.transaction_date::date <= $${paramIndex}`)
      params.push(endDate)
      paramIndex++
    }

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

    // Chain filter - using customer_type
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

    // Add limit param
    params.push(limit)
    const limitParam = `$${paramIndex}`

    // Log for debugging
    console.log('Top customers query params:', { startDate, endDate, limit, conditions: conditions.length })

    // Fetch top customers with enriched data from master table
    const result = await query(`
      SELECT
        t.customer_code as "customerCode",
        COALESCE(c.customer_name, MAX(t.customer_name)) as "customerName",
        c.customer_type as "customerType",
        c.customer_category as "customerCategory",
        c.customer_group as "customerGroup",
        c.city as "city",
        c.state as "state",
        c.country as "country",
        c.sales_person_name as "salesPerson",
        c.credit_limit as "creditLimit",
        c.credit_days as "creditDays",
        c.phone_number as "phone",
        c.mobile_number as "mobile",
        c.email as "email",
        COALESCE(SUM(t.net_amount), 0) as "totalSales",
        COUNT(DISTINCT t.transaction_code) as "totalOrders",
        COUNT(DISTINCT t.product_code) as "uniqueProducts",
        AVG(t.net_amount) as "avgOrderValue",
        MAX(t.transaction_date) as "lastOrderDate",
        MIN(t.transaction_date) as "firstOrderDate"
      FROM flat_transactions t
      LEFT JOIN flat_customers_master c ON t.customer_code = c.customer_code
      ${whereClause}
      GROUP BY 
        t.customer_code, c.customer_name, c.customer_type, 
        c.customer_category, c.customer_group, c.city, c.state, 
        c.country, c.sales_person_name, c.credit_limit, c.credit_days,
        c.phone_number, c.mobile_number, c.email
      ORDER BY "totalSales" DESC
      LIMIT ${limitParam}
    `, params)

    const customers = result.rows.map(row => ({
      customerCode: row.customerCode,
      customerName: row.customerName,
      totalSales: parseFloat(row.totalSales || '0'),
      customerType: row.customerType || 'Unknown',
      customerCategory: row.customerCategory || 'Unknown',
      customerGroup: row.customerGroup || 'Unknown',
      location: {
        city: row.city || 'Unknown',
        state: row.state || 'Unknown',
        country: row.country || 'Unknown'
      },
      salesPerson: row.salesPerson || 'Unknown',
      creditInfo: {
        creditLimit: parseFloat(row.creditLimit || '0'),
        creditDays: parseInt(row.creditDays || '0')
      },
      contact: {
        phone: row.phone || '',
        mobile: row.mobile || '',
        email: row.email || ''
      },
      metrics: {
        totalSales: parseFloat(row.totalSales || '0'),
        totalOrders: parseInt(row.totalOrders || '0'),
        uniqueProducts: parseInt(row.uniqueProducts || '0'),
        avgOrderValue: parseFloat(row.avgOrderValue || '0'),
        lastOrderDate: row.lastOrderDate,
        firstOrderDate: row.firstOrderDate
      }
    }))

    // Calculate cache duration
    const hasCustomDates = !!(customStartDate && customEndDate)
    const cacheDuration = getCacheDuration(dateRange, hasCustomDates)
    const staleWhileRevalidate = cacheDuration * 2

    return NextResponse.json({
      success: true,
      data: customers,
      timestamp: new Date().toISOString(),
      cached: true,
      cacheInfo: {
        duration: cacheDuration,
        dateRange,
        hasCustomDates
      },
      source: 'postgresql-flat-table'
    }, {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheDuration}, stale-while-revalidate=${staleWhileRevalidate}`
      }
    })

  } catch (error) {
    console.error('Top customers API error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch top customers',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 })
  }
}
