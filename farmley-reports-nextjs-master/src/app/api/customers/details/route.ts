import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { mockDataService } from '@/services/mockDataService'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

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
    start: startDate,
    end: endDate
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateRange = searchParams.get('range') || 'thisMonth'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const sortBy = searchParams.get('sortBy') || 'net_sales'
    const sortOrder = searchParams.get('sortOrder') || 'DESC'
    const search = searchParams.get('search') || ''

    // Get filter parameters
    const regionCode = searchParams.get('regionCode')
    const salesmanCode = searchParams.get('salesmanCode')
    const routeCode = searchParams.get('routeCode')
    const customerCode = searchParams.get('customerCode')
    const channelCode = searchParams.get('channelCode')
    const territoryCode = searchParams.get('territoryCode')
    const classification = searchParams.get('classification')
    const activity = searchParams.get('activity')
    const customerType = searchParams.get('customerType')

    const filters = {
      regionCode,
      salesmanCode,
      routeCode,
      customerCode,
      channelCode,
      territoryCode,
      classification,
      activity,
      customerType,
      search,
      page,
      limit,
      sortBy,
      sortOrder
    }

    // Check if we should use mock data
    if (process.env.USE_MOCK_DATA === 'true') {
      return await getMockCustomerDetails(dateRange, filters)
    }

    const { start: startDate, end: endDate } = getDateRangeFromString(dateRange)
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Build filter conditions
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // Always filter by transaction type (invoices only)
    conditions.push(`trx_type = 1`)

    // Date conditions
    conditions.push(`trx_date_only >= $${paramIndex}`)
    params.push(startDateStr)
    paramIndex++
    conditions.push(`trx_date_only <= $${paramIndex}`)
    params.push(endDateStr)
    paramIndex++

    // Search condition
    if (search) {
      conditions.push(`(store_name ILIKE $${paramIndex} OR store_code ILIKE $${paramIndex})`)
      params.push(`%${search}%`)
      paramIndex++
    }

    // Region filter
    if (regionCode) {
      conditions.push(`region_code = $${paramIndex}`)
      params.push(regionCode)
      paramIndex++
    }

    // Salesman filter
    if (salesmanCode) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(salesmanCode)
      paramIndex++
    }

    // Route filter
    if (routeCode) {
      conditions.push(`user_route_code = $${paramIndex}`)
      params.push(routeCode)
      paramIndex++
    }

    // Customer filter
    if (customerCode) {
      conditions.push(`store_code = $${paramIndex}`)
      params.push(customerCode)
      paramIndex++
    }

    // Channel Code filter
    if (channelCode) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(channelCode)
      paramIndex++
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Calculate offset for pagination
    const offset = (page - 1) * limit

    // Get customer details with pagination
    const customerDetailsQuery = `
      SELECT
        store_code as customer_code,
        MAX(store_name) as customer_name,
        MAX(user_route_code) as territory,
        MAX(region_code) as region,
        MAX(region_name) as region_name,
        MAX(city_code) as city,
        MAX(chain_code) as channel_code,
        MAX(chain_name) as chain_name,
        'Active' as status,
        SUM(net_amount) as total_sales,
        COUNT(DISTINCT trx_code) as total_orders,
        CASE 
          WHEN COUNT(DISTINCT trx_code) > 0 
          THEN SUM(net_amount) / COUNT(DISTINCT trx_code)
          ELSE 0 
        END as avg_order_value,
        'AED' as currency_code,
        MAX(trx_date_only) as last_order_date,
        COUNT(DISTINCT field_user_code) as assigned_salesmen
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY store_code
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    params.push(limit)
    params.push(offset)

    const customerResult = await query(customerDetailsQuery, params)

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT store_code) as total_count
      FROM flat_sales_transactions
      ${whereClause}
    `

    const countResult = await query(countQuery, params.slice(0, -2)) // Remove limit and offset params
    const totalCount = parseInt(countResult.rows[0].total_count || '0')

    // Format customer data
    const customers = customerResult.rows.map(customer => ({
      customerCode: customer.customer_code,
      customerName: customer.customer_name,
      territory: customer.territory,
      region: customer.region,
      regionName: customer.region_name,
      city: customer.city,
      channelCode: customer.channel_code,
      chainName: customer.chain_name,
      totalSales: parseFloat(customer.total_sales || '0'),
      totalOrders: parseInt(customer.total_orders || '0'),
      avgOrderValue: parseFloat(customer.avg_order_value || '0'),
      status: customer.status,
      lastOrderDate: customer.last_order_date,
      assignedSalesmen: parseInt(customer.assigned_salesmen || '0'),
      currencyCode: customer.currency_code || 'AED'
    }))

    // Calculate days since last order
    const customersWithDaysSince = customers.map(customer => {
      const daysSince = customer.lastOrderDate 
        ? Math.floor((new Date().getTime() - new Date(customer.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        ...customer,
        daysSinceLastOrder: daysSince
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        customers: customersWithDaysSince,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          pageSize: limit,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1
        },
        summary: {
          totalCustomers: totalCount,
          totalGrossSales: customers.reduce((sum, c) => sum + c.grossSales, 0),
          totalGrossOrders: customers.reduce((sum, c) => sum + c.grossOrders, 0),
          totalNetSales: customers.reduce((sum, c) => sum + c.netSales, 0),
          avgOrderValue: customers.reduce((sum, c) => sum + c.grossOrders, 0) > 0 
            ? customers.reduce((sum, c) => sum + c.grossSales, 0) / customers.reduce((sum, c) => sum + c.grossOrders, 0)
            : 0
        }
      },
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table'
    })

  } catch (error) {
    console.error('Customer details API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch customer details',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Mock data implementation
async function getMockCustomerDetails(dateRange: string, filters: any) {
  const { start: startDate, end: endDate } = getDateRangeFromString(dateRange)
  
  // Get customer analytics from mock data
  const customers = await mockDataService.getCustomerAnalytics({
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    ...filters
  })

  // Apply filters
  let filteredCustomers = customers

  if (filters.regionCode) {
    filteredCustomers = filteredCustomers.filter(c => c.regionCode === filters.regionCode)
  }
  if (filters.salesmanCode) {
    filteredCustomers = filteredCustomers.filter(c => c.userCode === filters.salesmanCode)
  }
  if (filters.routeCode) {
    filteredCustomers = filteredCustomers.filter(c => c.routeCode === filters.routeCode)
  }
  if (filters.channelCode) {
    filteredCustomers = filteredCustomers.filter(c => c.chainCode === filters.channelCode)
  }
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filteredCustomers = filteredCustomers.filter(c => 
      c.customerName.toLowerCase().includes(searchLower) ||
      c.customerCode.toLowerCase().includes(searchLower)
    )
  }

  // Sort customers
  filteredCustomers.sort((a, b) => {
    const aValue = filters.sortBy === 'total_sales' ? a.totalSales : 
                   filters.sortBy === 'total_orders' ? a.totalOrders :
                   filters.sortBy === 'avg_order_value' ? a.averageOrderValue :
                   a.customerName
    const bValue = filters.sortBy === 'total_sales' ? b.totalSales : 
                   filters.sortBy === 'total_orders' ? b.totalOrders :
                   filters.sortBy === 'avg_order_value' ? b.averageOrderValue :
                   b.customerName

    if (filters.sortOrder === 'ASC') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  // Pagination
  const totalCount = filteredCustomers.length
  const startIndex = (filters.page - 1) * filters.limit
  const endIndex = startIndex + filters.limit
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex)

  // Add days since last order
  const customersWithDaysSince = paginatedCustomers.map(customer => {
    const daysSinceLastOrder = customer.lastOrderDate 
      ? Math.floor((new Date().getTime() - new Date(customer.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
      : null

    return {
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      territory: customer.routeCode,
      region: customer.regionCode,
      regionName: customer.regionName,
      city: customer.cityCode,
      channelCode: customer.chainCode,
      chainName: customer.chainName,
      totalSales: customer.totalSales || 0,
      totalOrders: customer.totalOrders || 0,
      avgOrderValue: customer.averageOrderValue || 0,
      status: 'Active',
      lastOrderDate: customer.lastOrderDate,
      assignedSalesmen: 1,
      currencyCode: 'AED',
      daysSinceLastOrder
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      customers: customersWithDaysSince,
      pagination: {
        currentPage: filters.page,
        totalPages: Math.ceil(totalCount / filters.limit),
        totalCount,
        pageSize: filters.limit,
        hasNextPage: filters.page < Math.ceil(totalCount / filters.limit),
        hasPrevPage: filters.page > 1
      },
      summary: {
        totalCustomers: totalCount,
        totalGrossSales: filteredCustomers.reduce((sum, c) => sum + (c.totalSales || 0), 0),
        totalGrossOrders: filteredCustomers.reduce((sum, c) => sum + (c.totalOrders || 0), 0),
        totalNetSales: filteredCustomers.reduce((sum, c) => sum + (c.totalSales || 0), 0),
        avgOrderValue: filteredCustomers.reduce((sum, c) => sum + (c.totalOrders || 0), 0) > 0 
          ? filteredCustomers.reduce((sum, c) => sum + (c.totalSales || 0), 0) / filteredCustomers.reduce((sum, c) => sum + (c.totalOrders || 0), 0)
          : 0
      }
    },
    timestamp: new Date().toISOString(),
    source: 'mock-data'
  })
}