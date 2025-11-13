import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'
import { unstable_cache } from 'next/cache'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { getAssetBaseUrl } from '@/lib/utils'

// Cached product details fetcher - using ONLY flat_sales_transactions (PostgreSQL)
const getCachedProductDetails = unstable_cache(
  async (dateRange: string, filters: any, page: number = 1, limit: number = 25, sortBy: string = 'total_sales', sortOrder: string = 'DESC', allowedUserCodes: string[] = []) => {
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

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    await db.initialize()

    // Build filter conditions - ALL from flat_sales_transactions
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Date conditions (on transactions)
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

    // Category filter (using product_group)
    if (filters.category) {
      conditions.push(`product_group = $${paramIndex}`)
      params.push(filters.category)
      paramIndex++
    }

    // Brand filter (product_brand)
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

    // Product code filter (for specific product selection)
    if (filters.productCode) {
      conditions.push(`product_code = $${paramIndex}`)
      params.push(filters.productCode)
      paramIndex++
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Calculate offset for pagination
    const offset = (page - 1) * limit

    // Add limit and offset to params
    params.push(limit)
    params.push(offset)

    // Get product details - aggregate from flat_sales_transactions only
    const productDetailsQuery = `
      SELECT
        product_code,
        MAX(product_name) as product_name,
        MAX(product_group) as category,
        MAX(product_subcategory) as subcategory,
        MAX(product_brand) as brand,
        MAX(product_base_uom) as base_uom,
        MAX(product_image_path) as image_path,
        SUM(net_amount) as total_sales,
        SUM(quantity) as total_quantity,
        COUNT(DISTINCT trx_code) as total_orders,
        AVG(unit_price) as avg_price,
        MAX(unit_price) as maximum_price,
        MIN(unit_price) as minimum_price,
        CASE 
          WHEN SUM(quantity) > 1000 THEN 'Fast'
          WHEN SUM(quantity) > 100 THEN 'Medium'
          WHEN SUM(quantity) > 0 THEN 'Slow'
          ELSE 'No Sales'
        END as movement_status
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY product_code
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    const productResult = await query(productDetailsQuery, params)

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT product_code) as total_count
      FROM flat_sales_transactions
      ${whereClause}
    `

    const countResult = await query(countQuery, params.slice(0, -2)) // Remove limit and offset params
    const totalCount = parseInt(countResult.rows[0].total_count || '0')

    // Helper function to clean values
    const cleanValue = (value: any, defaultValue: string = '-'): string => {
      if (!value) return defaultValue
      const normalized = String(value).trim().toLowerCase()
      if (normalized === '' || normalized === 'unknown' || normalized === 'n/a' || normalized === 'null' || normalized === 'na' || normalized === 'farmley') {
        return defaultValue
      }
      return String(value).trim()
    }

    // Helper to convert image path to full URL
    const getImageUrl = (imagePath: string | null): string => {
      if (!imagePath) return ''
      const path = String(imagePath).trim()
      const base = getAssetBaseUrl().replace(/\/$/, '') + '/'
      // Convert relative paths to NFPC asset base
      if (path.startsWith('../')) {
        return base + path.substring(3)
      } else if (path.startsWith('./')) {
        return base + path.substring(2)
      } else if (path.startsWith('Data/')) {
        return base + path
      } else if (path.startsWith('/Data/')) {
        return base.replace(/\/$/, '') + path
      }
      return path
    }

    // Format product data
    const products = productResult.rows.map(product => ({
      productCode: product.product_code || '-',
      productName: cleanValue(product.product_name, 'Unnamed Product'),
      category: cleanValue(product.category, 'Uncategorized'), // This is product_group
      subcategory: cleanValue(product.subcategory, '-'),
      productGroup: cleanValue(product.category, '-'), // Same as category
      brand: cleanValue(product.brand, 'No Brand'), // This is also product_group/brand
      baseUom: cleanValue(product.base_uom, 'Unit'),
      imageUrl: getImageUrl(product.image_path),
      maxPrice: parseFloat(product.maximum_price || '0'),
      minPrice: parseFloat(product.minimum_price || '0'),
      totalSales: parseFloat(product.total_sales || '0'),
      totalQuantity: parseFloat(product.total_quantity || '0'),
      totalOrders: parseInt(product.total_orders || '0'),
      avgPrice: parseFloat(product.avg_price || '0'),
      movementStatus: product.movement_status,
      isActive: true, // All products in sales transactions are considered active
      isDelist: false,
      currencyCode: 'AED'
    }))

    return {
      products,
      pagination: {
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    }
  },
  ['product-details'],  
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ['product-details']
  }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('range') || 'thisMonth'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const sortBy = searchParams.get('sortBy') || 'total_sales'
    const sortOrder = (searchParams.get('sortOrder')?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as 'ASC' | 'DESC'
    const productCode = searchParams.get('productCode')
    const category = searchParams.get('category')
    const brand = searchParams.get('brand')
    const subcategory = searchParams.get('subcategory')
    const status = searchParams.get('status')
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Get hierarchy-based allowed users
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }

    const filters = {
      productCode,
      category,
      brand,
      subcategory,
      status
    }

    const data = await getCachedProductDetails(dateRange, filters, page, limit, sortBy, sortOrder, allowedUserCodes)

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-sales-transactions'
    })

  } catch (error) {
    console.error('Product details API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch product details',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
