import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Intelligent caching based on date range
function getCacheDuration(dateRange: string, hasCustomDates: boolean): number {
  if (hasCustomDates) return 900 // 15 minutes for custom dates
  
  switch(dateRange) {
    case 'today':
    case 'yesterday':
      return 600 // 10 minutes
    case 'thisWeek':
      return 900 // 15 minutes
    case 'thisMonth':
      return 1800 // 30 minutes
    case 'lastMonth':
    case 'thisQuarter':
    case 'lastQuarter':
      return 3600 // 60 minutes - historical data
    default:
      return 900
  }
}

// Date range helper
function getDateRange(rangeStr: string) {
  const now = new Date()
  let startDate: Date, endDate: Date
  
  switch (rangeStr) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0))
      endDate = new Date(now.setHours(23, 59, 59, 999))
      break
    case 'yesterday':
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      startDate = new Date(yesterday.setHours(0, 0, 0, 0))
      endDate = new Date(yesterday.setHours(23, 59, 59, 999))
      break
    case 'thisWeek':
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      startDate = new Date(weekStart.setHours(0, 0, 0, 0))
      endDate = new Date(now)
      break
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now)
      break
    case 'lastMonth':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      endDate = new Date(now.getFullYear(), now.getMonth(), 0)
      break
    case 'thisQuarter':
      const quarter = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), quarter * 3, 1)
      endDate = new Date(now)
      break
    case 'lastQuarter':
      const lastQuarter = Math.floor(now.getMonth() / 3) - 1
      startDate = new Date(now.getFullYear(), lastQuarter * 3, 1)
      endDate = new Date(now.getFullYear(), lastQuarter * 3 + 3, 0)
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now)
  }
  
  return {
    startStr: startDate.toISOString().split('T')[0],
    endStr: endDate.toISOString().split('T')[0],
    label: rangeStr
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateRange = searchParams.get('range') || 'thisMonth'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const customer = searchParams.get('customer')
    const region = searchParams.get('region')
    const city = searchParams.get('city')
    const chain = searchParams.get('chain')
    const salesman = searchParams.get('salesman')
    const teamLeader = searchParams.get('teamLeader')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Get hierarchy-based allowed users
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }
    
    // Handle custom date range vs preset range
    let startDate: string
    let endDate: string
    let label: string
    
    if (startDateParam && endDateParam) {
      // Custom date range
      startDate = startDateParam
      endDate = endDateParam
      label = 'custom'
    } else {
      // Preset date range
      const dateResult = getDateRange(dateRange)
      startDate = dateResult.startStr
      endDate = dateResult.endStr
      label = dateResult.label
    }
    
    await db.initialize()

    // Build WHERE clause
    let whereConditions: string[] = [
      `trx_type = 5`,  // Sales Orders
      `trx_date_only >= '${startDate}'`,
      `trx_date_only <= '${endDate}'`
    ]
    
    // Add hierarchy filter if not admin
    if (allowedUserCodes.length > 0) {
      const userCodesStr = allowedUserCodes.map(code => `'${code}'`).join(', ')
      whereConditions.push(`field_user_code IN (${userCodesStr})`)
    }

    if (customer) {
      whereConditions.push(`store_code = '${customer}'`)
    }
    
    if (region) {
      whereConditions.push(`region_code = '${region}'`)
    }
    
    if (city) {
      whereConditions.push(`city_code = '${city}'`)
    }
    
    if (chain) {
      whereConditions.push(`chain_code = '${chain}'`)
    }
    
    if (salesman) {
      whereConditions.push(`field_user_code = '${salesman}'`)
    }
    
    if (teamLeader) {
      whereConditions.push(`tl_code = '${teamLeader}'`)
    }
    
    if (category) {
      whereConditions.push(`product_group = '${category}'`)
    }
    
    if (search) {
      whereConditions.push(`(
        LOWER(store_code) LIKE LOWER('%${search}%') OR 
        LOWER(store_name) LIKE LOWER('%${search}%')
      )`)
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`

    // Get overall metrics
    const metricsQuery = `
      WITH customer_data AS (
        SELECT
          store_code,
          store_name,
          SUM(net_amount) as total_sales,
          COUNT(DISTINCT trx_code) as order_count,
          MAX(trx_date_only) as last_order_date
        FROM flat_sales_transactions
        ${whereClause}
        GROUP BY store_code, store_name
      )
      SELECT
        COUNT(DISTINCT store_code) as total_customers,
        COUNT(DISTINCT CASE WHEN last_order_date >= CURRENT_DATE - INTERVAL '30 days' THEN store_code END) as active_customers,
        COALESCE(SUM(total_sales), 0) as total_sales,
        COALESCE(SUM(order_count), 0) as total_orders,
        CASE 
          WHEN SUM(order_count) > 0 THEN SUM(total_sales) / SUM(order_count)
          ELSE 0
        END as avg_order_value
      FROM customer_data
    `
    
    const metricsResult = await query(metricsQuery, [])
    const metrics = {
      totalCustomers: parseInt(metricsResult.rows[0]?.total_customers || '0'),
      activeCustomers: parseInt(metricsResult.rows[0]?.active_customers || '0'),
      totalSales: parseFloat(metricsResult.rows[0]?.total_sales || '0'),
      totalOrders: parseInt(metricsResult.rows[0]?.total_orders || '0'),
      avgOrderValue: parseFloat(metricsResult.rows[0]?.avg_order_value || '0'),
      currencyCode: 'INR'
    }

    // Sales by Region
    const salesByRegionQuery = `
      SELECT
        region_code,
        COALESCE(region_name, region_code) as region,
        SUM(net_amount) as sales,
        COUNT(DISTINCT store_code) as customer_count,
        COUNT(DISTINCT trx_code) as order_count
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY region_code, region_name
      ORDER BY sales DESC
      LIMIT 10
    `
    
    const regionResult = await query(salesByRegionQuery, [])
    const salesByRegion = regionResult.rows.map(row => ({
      region: row.region || 'Unknown',
      sales: parseFloat(row.sales || '0'),
      customerCount: parseInt(row.customer_count || '0'),
      orderCount: parseInt(row.order_count || '0')
    }))

    // Sales by City
    const salesByCityQuery = `
      SELECT
        city_code,
        COALESCE(city_name, city_code) as city,
        SUM(net_amount) as sales,
        COUNT(DISTINCT store_code) as customer_count,
        COUNT(DISTINCT trx_code) as order_count
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY city_code, city_name
      ORDER BY sales DESC
      LIMIT 10
    `
    
    const cityResult = await query(salesByCityQuery, [])
    const salesByCity = cityResult.rows.map(row => ({
      city: row.city || 'Unknown',
      sales: parseFloat(row.sales || '0'),
      customerCount: parseInt(row.customer_count || '0'),
      orderCount: parseInt(row.order_count || '0')
    }))

    // Sales by Product Category
    const salesByCategoryQuery = `
      SELECT
        COALESCE(product_group, 'Others') as category,
        SUM(net_amount) as sales,
        COUNT(DISTINCT product_code) as product_count,
        SUM(quantity) as units_sold
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY product_group
      ORDER BY sales DESC
      LIMIT 10
    `
    
    const categoryResult = await query(salesByCategoryQuery, [])
    const salesByCategory = categoryResult.rows.map(row => ({
      name: row.category,
      value: parseFloat(row.sales || '0'),
      productCount: parseInt(row.product_count || '0'),
      unitsSold: parseInt(row.units_sold || '0')
    }))

    // Get top customers with pagination
    const offset = (page - 1) * limit

    const customersQuery = `
      WITH customer_data AS (
        SELECT
          store_code,
          MAX(store_name) as store_name,
          MAX(region_code) as region_code,
          MAX(region_name) as region_name,
          MAX(city_code) as city_code,
          MAX(city_name) as city_name,
          MAX(chain_code) as chain_code,
          MAX(chain_name) as chain_name,
          MAX(user_route_code) as route_code,
          MAX(field_user_code) as salesman_code,
          MAX(field_user_name) as salesman_name,
          MAX(tl_code) as tl_code,
          MAX(tl_name) as tl_name,
          SUM(net_amount) as total_sales,
          COUNT(DISTINCT trx_code) as order_count,
          SUM(quantity) as total_quantity,
          AVG(net_amount) as avg_order_value,
          MAX(trx_date_only) as last_order_date,
          CURRENT_DATE - MAX(trx_date_only) as days_since_last_order
        FROM flat_sales_transactions
        ${whereClause}
        GROUP BY store_code
      ),
      counted AS (
        SELECT COUNT(*) as total_count FROM customer_data
      )
      SELECT 
        customer_data.*,
        counted.total_count
      FROM customer_data
      CROSS JOIN counted
      ORDER BY customer_data.total_sales DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const customersResult = await query(customersQuery, [])
    const totalCount = customersResult.rows[0]?.total_count || 0
    const totalPages = Math.ceil(totalCount / limit)

    const topCustomers = customersResult.rows.map(row => ({
      customerCode: row.store_code,
      customerName: row.store_name || 'Unknown',
      region: row.region_name || row.region_code || 'Unknown',
      city: row.city_name || row.city_code || 'Unknown',
      chain: row.chain_name || row.chain_code || 'Unknown',
      routeCode: row.route_code,
      salesmanCode: row.salesman_code,
      salesmanName: row.salesman_name || 'Unknown',
      tlCode: row.tl_code,
      tlName: row.tl_name || 'Unknown',
      totalSales: parseFloat(row.total_sales || '0'),
      orderCount: parseInt(row.order_count || '0'),
      totalQuantity: parseFloat(row.total_quantity || '0'),
      avgOrderValue: parseFloat(row.avg_order_value || '0'),
      lastOrderDate: row.last_order_date,
      daysSinceLastOrder: parseInt(row.days_since_last_order || '0')
    }))

    // Calculate cache duration
    const hasCustomDates = !!(searchParams.get('startDate') && searchParams.get('endDate'))
    const cacheDuration = getCacheDuration(dateRange, hasCustomDates)

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        salesByRegion,
        salesByCity,
        salesByCategory,
        topCustomers,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          showing: `${Math.min((page - 1) * limit + 1, totalCount)} to ${Math.min(page * limit, totalCount)} of ${totalCount}`
        }
      },
      dateRange: {
        start: startDate,
        end: endDate,
        label
      },
      cached: true,
      cacheInfo: {
        duration: cacheDuration,
        dateRange,
        hasCustomDates
      }
    }, {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`
      }
    })
    
  } catch (error) {
    console.error('Customer analytics V3 API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
