import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'
import { unstable_cache } from 'next/cache'
import { getCacheDuration, getCacheControlHeader } from '@/lib/cache-utils'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Helper function to parse date range string
const getDateRangeFromString = (dateRange: string) => {
  const current = new Date()
  let startDate: Date = new Date(current)
  let endDate: Date = new Date(current)

  switch(dateRange) {
    case 'today':
      startDate = new Date(current)
      endDate = new Date(current)
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
      endDate = new Date(current)
      break
    case 'last30Days':
    case 'thisMonth':
      startDate = new Date(current.getFullYear(), current.getMonth(), 1)
      endDate = new Date(current)
      break
    case 'lastMonth':
      startDate = new Date(current.getFullYear(), current.getMonth() - 1, 1)
      endDate = new Date(current.getFullYear(), current.getMonth(), 0)
      break
    case 'thisQuarter':
      const quarter = Math.floor(current.getMonth() / 3)
      startDate = new Date(current.getFullYear(), quarter * 3, 1)
      endDate = new Date(current)
      break
    case 'lastQuarter':
      const lastQuarter = Math.floor(current.getMonth() / 3) - 1
      startDate = new Date(current.getFullYear(), lastQuarter * 3, 1)
      endDate = new Date(current.getFullYear(), lastQuarter * 3 + 3, 0)
      break
    case 'thisYear':
      startDate = new Date(current.getFullYear(), 0, 1)
      endDate = new Date(current)
      break
    default:
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 29)
      endDate = new Date(current)
  }

  return {
    start: startDate,
    end: endDate
  }
}

// Cached product analytics fetcher - using ONLY flat_sales_transactions (PostgreSQL)
const getCachedProductAnalytics = unstable_cache(
  async (dateRange: string, filters: any, allowedUserCodes: string[]) => {
    const { start: startDate, end: endDate } = getDateRangeFromString(dateRange)
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    await db.initialize()

    // Build filter conditions - dates apply to transactions
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Date conditions
    conditions.push(`trx_date_only >= $${paramIndex}`)
    params.push(startDateStr)
    paramIndex++
    conditions.push(`trx_date_only <= $${paramIndex}`)
    params.push(endDateStr)
    paramIndex++

    // Add hierarchy filter if not admin
    if (allowedUserCodes.length > 0) {
      const placeholders = allowedUserCodes.map((_, i) => `$${paramIndex + i}`).join(', ')
      conditions.push(`field_user_code IN (${placeholders})`)
      params.push(...allowedUserCodes)
      paramIndex += allowedUserCodes.length
    }

    // Category filter (using product_group - the actual category)
    if (filters.category) {
      conditions.push(`product_group = $${paramIndex}`)
      params.push(filters.category)
      paramIndex++
    }

    // Brand filter (product_brand is same as product_group)
    if (filters.brand) {
      conditions.push(`product_brand = $${paramIndex}`)
      params.push(filters.brand)
      paramIndex++
    }

    // Subcategory filter - skip since it's all "Farmley"
    if (filters.subcategory && filters.subcategory.toLowerCase() !== 'farmley') {
      conditions.push(`product_subcategory = $${paramIndex}`)
      params.push(filters.subcategory)
      paramIndex++
    }

    // Product code filter (for specific product search)
    if (filters.productCode) {
      conditions.push(`product_code = $${paramIndex}`)
      params.push(filters.productCode)
      paramIndex++
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Get product summary data - aggregate from flat_sales_transactions
    const productSummaryQuery = `
      SELECT
        product_code,
        MAX(product_name) as product_name,
        MAX(product_group) as category,
        MAX(product_subcategory) as subcategory,
        MAX(product_brand) as brand,
        MAX(product_base_uom) as base_uom,
        SUM(net_amount) as total_sales,
        SUM(quantity) as total_quantity,
        COUNT(DISTINCT trx_code) as total_orders,
        AVG(unit_price) as avg_price,
        CASE 
          WHEN SUM(quantity) > 1000 THEN 'Fast'
          WHEN SUM(quantity) > 100 THEN 'Medium'
          WHEN SUM(quantity) > 0 THEN 'Slow'
          ELSE 'No Sales'
        END as movement_status
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY product_code
      ORDER BY SUM(net_amount) DESC
    `

    const productResult = await query(productSummaryQuery, params)
    const products = productResult.rows

    // Calculate overall metrics
    const totalProducts = products.length
    const activeProducts = products.length // All products in sales are active
    const totalSales = products.reduce((sum, p) => sum + parseFloat(p.total_sales || '0'), 0)
    const totalQuantity = products.reduce((sum, p) => sum + parseFloat(p.total_quantity || '0'), 0)
    const fastMoving = products.filter(p => p.movement_status === 'Fast').length
    const slowMoving = products.filter(p => p.movement_status === 'Slow').length
    const noSales = products.filter(p => p.movement_status === 'No Sales').length

    // Helper function to check if value is valid
    const isValidValue = (value: string | null | undefined): boolean => {
      if (!value) return false
      const normalized = value.trim().toLowerCase()
      return normalized !== '' && 
             normalized !== 'unknown' && 
             normalized !== 'n/a' && 
             normalized !== 'null' && 
             normalized !== 'na' &&
             normalized !== 'farmley' // Exclude company name
    }

    // Brand/Category analysis (product_group is the meaningful grouping)
    const categoryData = products.reduce((acc: any, product) => {
      const category = product.category // This is product_group
      if (!isValidValue(category)) return acc
      
      if (!acc[category]) {
        acc[category] = {
          products: 0,
          sales: 0,
          quantity: 0
        }
      }
      acc[category].products++
      acc[category].sales += parseFloat(product.total_sales || '0')
      acc[category].quantity += parseFloat(product.total_quantity || '0')
      return acc
    }, {})

    const salesByBrand = Object.entries(categoryData)
      .map(([brand, data]: [string, any]) => ({
        brand,
        sales: data.sales,
        products: data.products,
        quantity: data.quantity
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10)

    const categorySalesDistribution = Object.entries(categoryData)
      .map(([category, data]: [string, any]) => ({
        category,
        sales: data.sales,
        products: data.products,
        quantity: data.quantity,
        percentage: totalSales > 0 ? (data.sales / totalSales * 100) : 0
      }))
      .sort((a, b) => b.sales - a.sales)

    // Top products
    const topProducts = products
      .filter(p => parseFloat(p.total_sales || '0') > 0)
      .slice(0, 20)
      .map(product => ({
        productCode: product.product_code,
        productName: product.product_name || 'N/A',
        category: isValidValue(product.category) ? product.category : 'Uncategorized',
        brand: isValidValue(product.brand) ? product.brand : 'No Brand',
        sales: parseFloat(product.total_sales || '0'),
        quantity: parseFloat(product.total_quantity || '0'),
        avgPrice: parseFloat(product.avg_price || '0'),
        movementStatus: product.movement_status,
        currencyCode: 'AED'
      }))

    return {
      metrics: {
        totalProducts,
        activeProducts,
        totalSales,
        totalQuantity,
        fastMoving,
        slowMoving,
        noSales,
        currencyCode: 'AED'
      },
      salesByBrand,
      categorySalesDistribution,
      topProducts
    }
  },
  ['product-analytics'],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ['product-analytics']
  }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('range') || 'thisMonth'
    const category = searchParams.get('category')
    const brand = searchParams.get('brand')
    const subcategory = searchParams.get('subcategory')
    const productCode = searchParams.get('productCode')
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Get hierarchy-based allowed users
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }

    const filters = {
      category,
      brand,
      subcategory,
      productCode
    }

    const data = await getCachedProductAnalytics(dateRange, filters, allowedUserCodes)
    
    // Calculate cache duration based on date range
    const cacheDuration = getCacheDuration(dateRange, false)

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-sales-transactions',
      cached: true,
      cacheInfo: {
        duration: cacheDuration,
        dateRange
      }
    }, {
      headers: {
        'Cache-Control': getCacheControlHeader(cacheDuration)
      }
    })

  } catch (error) {
    console.error('Product analytics API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch product analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
