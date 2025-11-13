import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

/**
 * API Endpoint: GET /api/products/top
 * Description: Fetches top products by sales amount
 * Query Parameters:
 *   - limit: Number of products to return (default: 10)
 *   - range: Date range filter (thisMonth, lastMonth, thisQuarter, etc.)
 * Returns: Array of top products with their sales data
 */

// Intelligent caching based on date range
function getCacheDuration(dateRange: string, hasCustomDates: boolean): number {
  if (hasCustomDates) return 900
  switch(dateRange) {
    case 'today':
    case 'yesterday':
      return 600
    case 'thisWeek':
    case 'lastWeek':
    case 'last7Days':
      return 900
    case 'thisMonth':
    case 'last30Days':
      return 1800
    case 'lastMonth':
    case 'thisQuarter':
    case 'lastQuarter':
    case 'thisYear':
      return 3600
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
    
    // Authentication removed - no user hierarchy filtering

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

    // Date range filter - cast transaction_date to date
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

    // Fetch top products from flat_transactions joined with flat_products_master
    const result = await query(`
      SELECT
        t.product_code as "productCode",
        COALESCE(p.product_name, MAX(t.product_name)) as "productName",
        p.product_description as "productDescription",
        p.category_name as "categoryName",
        p.subcategory_name as "subcategoryName",
        p.brand_name as "brandName",
        p.product_type as "productType",
        p.base_uom as "baseUom",
        p.mrp as "mrp",
        p.selling_price as "sellingPrice",
        p.gst_rate as "gstRate",
        p.hsn_code as "hsnCode",
        COALESCE(SUM(t.quantity_bu), 0) as "quantitySold",
        COALESCE(SUM(t.net_amount), 0) as "salesAmount",
        COALESCE(AVG(t.base_price), 0) as "averagePrice",
        COUNT(DISTINCT t.transaction_code) as "totalOrders",
        COUNT(DISTINCT t.customer_code) as "uniqueCustomers",
        MAX(t.transaction_date) as "lastSoldDate",
        MIN(t.transaction_date) as "firstSoldDate"
      FROM flat_transactions t
      LEFT JOIN flat_products_master p ON t.product_code = p.product_code
      LEFT JOIN flat_customers_master c ON t.customer_code = c.customer_code
      ${whereClause}
      GROUP BY 
        t.product_code, p.product_name, p.product_description,
        p.category_name, p.subcategory_name, p.brand_name,
        p.product_type, p.base_uom, p.mrp, p.selling_price,
        p.gst_rate, p.hsn_code
      ORDER BY "salesAmount" DESC
      LIMIT ${limitParam}
    `, params)

    const topProducts = result.rows.map(row => ({
      productCode: row.productCode,
      productName: row.productName,
      productDescription: row.productDescription || '',
      category: row.categoryName || 'Unknown',
      subcategory: row.subcategoryName || 'Unknown',
      brand: row.brandName || 'Unknown',
      productType: row.productType || 'Unknown',
      baseUom: row.baseUom || 'PCS',
      pricing: {
        mrp: parseFloat(row.mrp || '0'),
        sellingPrice: parseFloat(row.sellingPrice || '0'),
        averagePrice: parseFloat(row.averagePrice || '0'),
        gstRate: parseFloat(row.gstRate || '0')
      },
      hsnCode: row.hsnCode || '',
      metrics: {
        quantitySold: parseFloat(row.quantitySold || '0'),
        salesAmount: parseFloat(row.salesAmount || '0'),
        totalOrders: parseInt(row.totalOrders || '0'),
        uniqueCustomers: parseInt(row.uniqueCustomers || '0'),
        lastSoldDate: row.lastSoldDate,
        firstSoldDate: row.firstSoldDate
      }
    }))

    // Calculate cache duration
    const hasCustomDates = !!(customStartDate && customEndDate)
    const cacheDuration = getCacheDuration(dateRange, hasCustomDates)

    return NextResponse.json({
      success: true,
      data: topProducts,
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
        'Cache-Control': `public, s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`
      }
    })

  } catch (error) {
    console.error('Top products API error:', error)
    const isDev = process.env.NODE_ENV === 'development'
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch top products',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: isDev ? error : undefined
    }, { status: 500 })
  }
}
