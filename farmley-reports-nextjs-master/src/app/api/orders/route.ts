import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Intelligent caching based on date range
function getCacheDuration(dateRange: string, hasCustomDates: boolean): number {
  if (hasCustomDates) return 900
  switch(dateRange) {
    case 'today':
    case 'yesterday':
      return 600
    case 'thisWeek':
      return 900
    case 'thisMonth':
      return 1800
    case 'lastMonth':
    case 'thisQuarter':
    case 'lastQuarter':
      return 3600
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
    endStr: endDate.toISOString().split('T')[0]
  }
}

export async function GET(request: NextRequest) {
  try {
    await db.initialize()
    
    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || 'thisMonth'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    
    // Filters
    const regionFilter = searchParams.get('region')
    const cityFilter = searchParams.get('city')
    const chainFilter = searchParams.get('chain')
    const customerFilter = searchParams.get('customer')
    const salesmanFilter = searchParams.get('salesman')
    const teamLeaderFilter = searchParams.get('teamLeader')
    const categoryFilter = searchParams.get('category')
    const searchQuery = searchParams.get('search')
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Get hierarchy-based allowed users
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }
    
    let startDate: string, endDate: string
    
    if (startDateParam && endDateParam) {
      startDate = startDateParam
      endDate = endDateParam
    } else {
      const dateResult = getDateRange(range)
      startDate = dateResult.startStr
      endDate = dateResult.endStr
    }
    
    // Build WHERE clause
    let whereConditions = [`trx_type = 5`, `trx_date_only >= '${startDate}'`, `trx_date_only <= '${endDate}'`]
    
    // Add hierarchy filter if not admin
    if (allowedUserCodes.length > 0) {
      const userCodesStr = allowedUserCodes.map(code => `'${code}'`).join(', ')
      whereConditions.push(`field_user_code IN (${userCodesStr})`)
    }
    
    if (regionFilter && regionFilter !== 'all') {
      whereConditions.push(`region_code = '${regionFilter}'`)
    }
    if (cityFilter && cityFilter !== 'all') {
      whereConditions.push(`city_code = '${cityFilter}'`)
    }
    if (chainFilter && chainFilter !== 'all') {
      whereConditions.push(`chain_code = '${chainFilter}'`)
    }
    if (customerFilter && customerFilter !== 'all') {
      whereConditions.push(`store_code = '${customerFilter}'`)
    }
    if (salesmanFilter && salesmanFilter !== 'all') {
      whereConditions.push(`field_user_code = '${salesmanFilter}'`)
    }
    if (teamLeaderFilter && teamLeaderFilter !== 'all') {
      whereConditions.push(`tl_code = '${teamLeaderFilter}'`)
    }
    if (categoryFilter && categoryFilter !== 'all') {
      whereConditions.push(`product_group = '${categoryFilter}'`)
    }
    if (searchQuery) {
      whereConditions.push(`(
        store_code ILIKE '%${searchQuery}%' OR 
        store_name ILIKE '%${searchQuery}%' OR 
        trx_code ILIKE '%${searchQuery}%' OR
        product_name ILIKE '%${searchQuery}%'
      )`)
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    
    // Get summary metrics
    const metricsQuery = `
      SELECT 
        COUNT(DISTINCT trx_code) as "totalOrders",
        COUNT(DISTINCT store_code) as "totalCustomers",
        COUNT(DISTINCT product_code) as "totalProducts",
        SUM(net_amount) as "totalSales",
        AVG(net_amount) as "avgOrderValue",
        SUM(quantity) as "totalQuantity"
      FROM flat_sales_transactions
      ${whereClause}
    `
    
    const metricsResult = await query(metricsQuery, [])
    const metrics = metricsResult.rows[0]
    
    // Get orders grouped by transaction
    const ordersQuery = `
      SELECT 
        trx_code as "orderCode",
        trx_date_only as "orderDate",
        store_code as "customerCode",
        store_name as "customerName",
        COALESCE(region_name, 'Unknown') as "region",
        COALESCE(city_name, 'Unknown') as "city",
        COALESCE(chain_name, 'Unknown') as "chain",
        COALESCE(field_user_name, 'Unknown') as "salesman",
        field_user_code as "salesmanCode",
        COALESCE(tl_name, 'Unknown') as "teamLeader",
        tl_code as "teamLeaderCode",
        COUNT(DISTINCT product_code) as "itemCount",
        SUM(quantity) as "totalQuantity",
        SUM(net_amount) as "orderTotal"
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY 
        trx_code, trx_date_only, store_code, store_name, 
        region_name, city_name, chain_name, 
        field_user_name, field_user_code, tl_name, tl_code
      ORDER BY trx_date_only DESC, trx_code DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    
    const ordersResult = await query(ordersQuery, [])
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT trx_code) as total
      FROM flat_sales_transactions
      ${whereClause}
    `
    
    const countResult = await query(countQuery, [])
    const totalOrders = parseInt(countResult.rows[0].total)
    
    // Get region-wise data for chart
    const regionWiseQuery = `
      SELECT 
        COALESCE(region_name, 'Unknown') as "region",
        COUNT(DISTINCT trx_code) as "orderCount",
        SUM(net_amount) as "totalSales"
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY region_name
      ORDER BY "totalSales" DESC
      LIMIT 10
    `
    
    const regionWiseResult = await query(regionWiseQuery, [])
    
    // Get city-wise data for chart
    const cityWiseQuery = `
      SELECT 
        COALESCE(city_name, 'Unknown') as "city",
        COUNT(DISTINCT trx_code) as "orderCount",
        SUM(net_amount) as "totalSales"
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY city_name
      ORDER BY "totalSales" DESC
      LIMIT 10
    `
    
    const cityWiseResult = await query(cityWiseQuery, [])
    
    // Get chain-wise data for chart
    const chainWiseQuery = `
      SELECT 
        COALESCE(chain_name, 'Unknown') as "chain",
        COUNT(DISTINCT trx_code) as "orderCount",
        SUM(net_amount) as "totalSales"
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY chain_name
      ORDER BY "totalSales" DESC
      LIMIT 10
    `
    
    const chainWiseResult = await query(chainWiseQuery, [])
    
    // Get top customers by orders
    const topCustomersQuery = `
      SELECT 
        store_code as "customerCode",
        store_name as "customerName",
        COUNT(DISTINCT trx_code) as "orderCount",
        SUM(net_amount) as "totalSales"
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY store_code, store_name
      ORDER BY "orderCount" DESC
      LIMIT 10
    `
    
    const topCustomersResult = await query(topCustomersQuery, [])
    
    // Get top products by sales
    const topProductsQuery = `
      SELECT 
        product_code as "productCode",
        product_name as "productName",
        COALESCE(product_group, 'Others') as "category",
        COUNT(DISTINCT trx_code) as "orderCount",
        SUM(quantity) as "totalQuantity",
        SUM(net_amount) as "totalSales"
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY product_code, product_name, product_group
      ORDER BY "totalSales" DESC
      LIMIT 10
    `
    
    const topProductsResult = await query(topProductsQuery, [])
    
    // Get category-wise data
    const categoryWiseQuery = `
      SELECT 
        COALESCE(product_group, 'Others') as "category",
        COUNT(DISTINCT trx_code) as "orderCount",
        SUM(net_amount) as "totalSales"
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY product_group
      HAVING SUM(net_amount) > 0
      ORDER BY "totalSales" DESC
    `
    
    const categoryWiseResult = await query(categoryWiseQuery, [])
    console.log('Category-wise data:', categoryWiseResult.rows)
    
    // Ensure numeric values are properly parsed for chart data
    const categoryWiseData = categoryWiseResult.rows.map((row: any) => ({
      category: row.category || 'Others',
      orderCount: parseInt(row.orderCount || '0'),
      totalSales: parseFloat(row.totalSales || '0')
    }))
    
    return NextResponse.json({
      success: true,
      data: {
        orders: ordersResult.rows,
        metrics: {
          totalOrders: parseInt(metrics.totalOrders || '0'),
          totalCustomers: parseInt(metrics.totalCustomers || '0'),
          totalProducts: parseInt(metrics.totalProducts || '0'),
          totalSales: parseFloat(metrics.totalSales || '0'),
          avgOrderValue: parseFloat(metrics.avgOrderValue || '0'),
          totalQuantity: parseInt(metrics.totalQuantity || '0')
        },
        charts: {
          regionWise: regionWiseResult.rows,
          cityWise: cityWiseResult.rows,
          chainWise: chainWiseResult.rows,
          topCustomers: topCustomersResult.rows,
          topProducts: topProductsResult.rows,
          categoryWise: categoryWiseData
        },
        pagination: {
          page,
          limit,
          total: totalOrders,
          totalPages: Math.ceil(totalOrders / limit),
          hasNextPage: page < Math.ceil(totalOrders / limit),
          hasPrevPage: page > 1,
          showing: `${offset + 1}-${Math.min(offset + limit, totalOrders)} of ${totalOrders} orders`
        }
      },
      dateRange: {
        start: startDate,
        end: endDate,
        label: range
      },
      cached: true,
      cacheInfo: {
        duration: getCacheDuration(range, !!(searchParams.get('startDate') && searchParams.get('endDate'))),
        dateRange: range
      }
    }, {
      headers: {
        'Cache-Control': `public, s-maxage=${getCacheDuration(range, !!(searchParams.get('startDate') && searchParams.get('endDate')))}, stale-while-revalidate=${getCacheDuration(range, !!(searchParams.get('startDate') && searchParams.get('endDate'))) * 2}`
      }
    })
    
  } catch (error) {
    console.error('Orders API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
