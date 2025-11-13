import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'
import { unstable_cache } from 'next/cache'
import { mockDataService } from '@/services/mockDataService'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

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

// Cached customer analytics fetcher
const getCachedCustomerAnalytics = unstable_cache(
  async (dateRange: string, filters: any) => {
    const { start: startDate, end: endDate } = getDateRangeFromString(dateRange)
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    await db.initialize()

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

    // Region filter
    if (filters.regionCode) {
      conditions.push(`region_code = $${paramIndex}`)
      params.push(filters.regionCode)
      paramIndex++
    }

    // Salesman filter
    if (filters.salesmanCode) {
      conditions.push(`field_user_code = $${paramIndex}`)
      params.push(filters.salesmanCode)
      paramIndex++
    }

    // Route filter
    if (filters.routeCode) {
      conditions.push(`user_route_code = $${paramIndex}`)
      params.push(filters.routeCode)
      paramIndex++
    }

    // Channel Code filter
    if (filters.channelCode) {
      conditions.push(`chain_code = $${paramIndex}`)
      params.push(filters.channelCode)
      paramIndex++
    }

    // Customer filter
    if (filters.customerCode) {
      conditions.push(`store_code = $${paramIndex}`)
      params.push(filters.customerCode)
      paramIndex++
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Get customer summary data
    const customerSummaryQuery = `
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
        MAX(trx_date_only) as last_order_date
      FROM flat_sales_transactions
      ${whereClause}
      GROUP BY store_code
      ORDER BY total_sales DESC
    `

    const customerResult = await query(customerSummaryQuery, params)
    const customers = customerResult.rows

    // Calculate overall metrics
    const totalCustomers = customers.length
    const activeCustomers = customers.filter(c => c.status === 'Active').length
    const totalSales = customers.reduce((sum, c) => sum + parseFloat(c.total_sales || '0'), 0)
    const totalOrders = customers.reduce((sum, c) => sum + parseInt(c.total_orders || '0'), 0)
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

    // City analysis
    const cityData = customers.reduce((acc: any, customer) => {
      const city = customer.city || 'Unknown'
      if (!acc[city]) {
        acc[city] = {
          customers: 0,
          sales: 0,
          orders: 0
        }
      }
      acc[city].customers++
      acc[city].sales += parseFloat(customer.total_sales || '0')
      acc[city].orders += parseInt(customer.total_orders || '0')
      return acc
    }, {})

    const cityAnalysis = Object.entries(cityData).map(([city, data]: [string, any]) => ({
      city,
      customers: data.customers,
      sales: data.sales,
      orders: data.orders,
      contribution: totalSales > 0 ? (data.sales / totalSales * 100) : 0,
      avgSales: data.customers > 0 ? data.sales / data.customers : 0
    })).sort((a, b) => b.sales - a.sales)

    // Region analysis
    const regionData = customers.reduce((acc: any, customer) => {
      const region = customer.region_name || customer.region || 'Unknown'
      if (!acc[region]) {
        acc[region] = {
          customers: 0,
          sales: 0,
          orders: 0
        }
      }
      acc[region].customers++
      acc[region].sales += parseFloat(customer.total_sales || '0')
      acc[region].orders += parseInt(customer.total_orders || '0')
      return acc
    }, {})

    const regionAnalysis = Object.entries(regionData).map(([region, data]: [string, any]) => ({
      region,
      customers: data.customers,
      sales: data.sales,
      orders: data.orders,
      contribution: totalSales > 0 ? (data.sales / totalSales * 100) : 0,
      avgSales: data.customers > 0 ? data.sales / data.customers : 0
    })).sort((a, b) => b.sales - a.sales)

    // Channel Code analysis (GT/MT)
    const channelCodeData = customers.reduce((acc: any, customer) => {
      const channelCode = customer.channel_code || 'Unknown'
      if (!acc[channelCode]) {
        acc[channelCode] = {
          customers: 0,
          sales: 0,
          orders: 0
        }
      }
      acc[channelCode].customers++
      acc[channelCode].sales += parseFloat(customer.total_sales || '0')
      acc[channelCode].orders += parseInt(customer.total_orders || '0')
      return acc
    }, {})

    const channelCodeAnalysis = Object.entries(channelCodeData).map(([channelCode, data]: [string, any]) => ({
      channelCode,
      customers: data.customers,
      sales: data.sales,
      orders: data.orders,
      contribution: totalSales > 0 ? (data.sales / totalSales * 100) : 0
    })).sort((a, b) => b.sales - a.sales)

    // Chain Name analysis
    const chainData = customers.reduce((acc: any, customer) => {
      const chainName = customer.chain_name || 'Unknown'
      if (!acc[chainName]) {
        acc[chainName] = {
          customers: 0,
          sales: 0,
          orders: 0
        }
      }
      acc[chainName].customers++
      acc[chainName].sales += parseFloat(customer.total_sales || '0')
      acc[chainName].orders += parseInt(customer.total_orders || '0')
      return acc
    }, {})

    const chainNameAnalysis = Object.entries(chainData).map(([chainName, data]: [string, any]) => ({
      chainName,
      customers: data.customers,
      sales: data.sales,
      orders: data.orders,
      contribution: totalSales > 0 ? (data.sales / totalSales * 100) : 0
    })).sort((a, b) => b.sales - a.sales)

    return {
      metrics: {
        totalCustomers,
        activeCustomers,
        totalSales,
        totalOrders,
        avgOrderValue,
        currencyCode: customers[0]?.currency_code || 'AED'
      },
      cityAnalysis,
      regionAnalysis,
      channelCodeAnalysis,
      chainNameAnalysis,
      customers: customers.slice(0, 25) // Top 25 for initial load
    }
  },
  (dateRange: string, filters: any) => ['customer-analytics', dateRange, JSON.stringify(filters)],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ['customer-analytics']
  }
)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateRange = searchParams.get('range') || 'thisMonth'
    
    // Get filter parameters
    const regionCode = searchParams.get('regionCode')
    const salesmanCode = searchParams.get('salesmanCode')
    const routeCode = searchParams.get('routeCode')
    const customerCode = searchParams.get('customerCode')
    const territoryCode = searchParams.get('territoryCode')
    const channelCode = searchParams.get('channelCode')

    const filters = {
      regionCode,
      salesmanCode,
      routeCode,
      customerCode,
      territoryCode,
      channelCode
    }

    // Check if we should use mock data
    if (process.env.USE_MOCK_DATA === 'true') {
      return await getMockCustomerAnalytics(dateRange, filters)
    }

    const data = await getCachedCustomerAnalytics(dateRange, filters)

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table'
    })

  } catch (error) {
    console.error('Customer analytics API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch customer analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Mock data implementation
async function getMockCustomerAnalytics(dateRange: string, filters: any) {
  const { start: startDate, end: endDate } = getDateRangeFromString(dateRange)
  
  // Get customer analytics from mock data
  const customers = await mockDataService.getCustomerAnalytics({
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    ...filters
  })

  // Filter customers based on filters
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

  // Calculate metrics
  const totalCustomers = filteredCustomers.length
  const activeCustomers = filteredCustomers.filter(c => c.totalOrders > 0).length
  const totalSales = filteredCustomers.reduce((sum, c) => sum + (c.totalSales || 0), 0)
  const totalOrders = filteredCustomers.reduce((sum, c) => sum + (c.totalOrders || 0), 0)
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

  // City Analysis
  const cityAnalysis = filteredCustomers.reduce((acc: any, customer) => {
    const city = customer.cityCode || 'Unknown'
    if (!acc[city]) {
      acc[city] = { city, sales: 0, customers: 0 }
    }
    acc[city].sales += customer.totalSales || 0
    acc[city].customers += 1
    return acc
  }, {})

  // Region Analysis
  const regionAnalysis = filteredCustomers.reduce((acc: any, customer) => {
    const region = customer.regionName || customer.regionCode || 'Unknown'
    if (!acc[region]) {
      acc[region] = { region, sales: 0, customers: 0 }
    }
    acc[region].sales += customer.totalSales || 0
    acc[region].customers += 1
    return acc
  }, {})

  // Channel Code Analysis
  const channelCodeAnalysis = filteredCustomers.reduce((acc: any, customer) => {
    const channel = customer.chainCode || 'Unknown'
    if (!acc[channel]) {
      acc[channel] = { channelCode: channel, sales: 0, customers: 0 }
    }
    acc[channel].sales += customer.totalSales || 0
    acc[channel].customers += 1
    return acc
  }, {})

  // Chain Name Analysis
  const chainNameAnalysis = filteredCustomers.reduce((acc: any, customer) => {
    const chain = customer.chainName || 'Unknown'
    if (!acc[chain]) {
      acc[chain] = { chainName: chain, sales: 0, customers: 0 }
    }
    acc[chain].sales += customer.totalSales || 0
    acc[chain].customers += 1
    return acc
  }, {})

  // Calculate percentages for channel analysis
  const channelAnalysisWithPercentages = Object.values(channelCodeAnalysis).map((item: any) => ({
    ...item,
    contribution: totalSales > 0 ? (item.sales / totalSales) * 100 : 0
  }))

  return NextResponse.json({
    success: true,
    data: {
      metrics: {
        totalCustomers,
        activeCustomers,
        totalSales,
        totalOrders,
        avgOrderValue,
        currencyCode: 'AED'
      },
      cityAnalysis: Object.values(cityAnalysis).sort((a: any, b: any) => b.sales - a.sales),
      regionAnalysis: Object.values(regionAnalysis).sort((a: any, b: any) => b.sales - a.sales),
      channelCodeAnalysis: channelAnalysisWithPercentages.sort((a: any, b: any) => b.sales - a.sales),
      chainNameAnalysis: Object.values(chainNameAnalysis).sort((a: any, b: any) => b.sales - a.sales),
      customers: filteredCustomers.slice(0, 25) // Top 25 for initial load
    },
    timestamp: new Date().toISOString(),
    source: 'mock-data'
  })
}