import { NextRequest, NextResponse } from 'next/server'
import { fetchFromJsonServer, filterByDateRange, getDateRangeFromString } from '@/lib/jsonServerClient'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'thisMonth'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''
    const route = searchParams.get('route') || 'all'
    const salesman = searchParams.get('salesman') || 'all'
    const city = searchParams.get('city') || 'all'

    // Get date range
    const { startDate, endDate } = getDateRangeFromString(range)

    // Fetch data from json-server
    const transactions = await fetchFromJsonServer<any[]>('transactions')
    const routes = await fetchFromJsonServer<any[]>('routes')
    const salesmen = await fetchFromJsonServer<any[]>('salesmen')

    // Filter transactions by date range and city
    let filteredTransactions = filterByDateRange(transactions, 'trxDate', startDate, endDate)
      .filter(t => t.trxType === 'SALE')
    
    // Apply city filter if specified
    if (city && city !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => 
        t.cityCode === city || t.cityName === city
      )
    }

    // Group by route
    const routeMap = new Map()

    // Filter routes by city if specified
    let filteredRoutes = routes
    if (city && city !== 'all') {
      filteredRoutes = routes.filter(r => 
        r.cityCode === city || r.cityName === city
      )
    }

    filteredRoutes.forEach(route => {
      const routeSalesmen = salesmen.filter(s => s.routeCode === route.routeCode)
      const routeTransactions = filteredTransactions.filter(t => t.routeCode === route.routeCode)

      const sales = routeTransactions.reduce((sum, t) => sum + t.totalAmount, 0)
      const orders = routeTransactions.length
      const uniqueCustomers = new Set(routeTransactions.map(t => t.clientCode)).size

      routeMap.set(route.routeCode, {
        routeCode: route.routeCode,
        routeName: route.routeName,
        salesmanCode: routeSalesmen[0]?.userCode || 'N/A',
        salesmanName: routeSalesmen[0]?.userName || 'Unassigned',
        totalCustomers: 10,
        activeCustomers: uniqueCustomers,
        uniqueCustomers,
        assignedSalesmen: routeSalesmen.length,
        sales,
        orders,
        totalSales30d: sales,
        totalOrders30d: orders,
        productiveVisits: 15,
        totalVisits: 20,
        avgVisitDuration: 25,
        avgOrderValue: orders > 0 ? sales / orders : 0,
        coveragePercentage: 80,
        salesPerCustomer: uniqueCustomers > 0 ? sales / uniqueCustomers : 0,
        classification: sales > 100000 ? 'Premium' : sales > 50000 ? 'High' : 'Standard',
        productivity: 75,
        targetAchievement: Math.min(100, (sales / 100000) * 100)
      })
    })

    let routesData = Array.from(routeMap.values()).sort((a, b) => b.sales - a.sales)

    // Apply filters
    if (search) {
      routesData = routesData.filter(r =>
        r.routeCode.toLowerCase().includes(search.toLowerCase()) ||
        r.salesmanName.toLowerCase().includes(search.toLowerCase())
      )
    }
    if (route && route !== 'all') {
      routesData = routesData.filter(r => r.routeCode === route)
    }
    if (salesman && salesman !== 'all') {
      const salesmanCode = salesman.split('|')[1]
      if (salesmanCode && salesmanCode !== 'N/A') {
        routesData = routesData.filter(r => r.salesmanCode === salesmanCode)
      }
    }

    // Add rank
    routesData = routesData.map((r, index) => ({ ...r, rank: index + 1 }))

    // Pagination
    const totalCount = routesData.length
    const totalPages = Math.ceil(totalCount / limit)
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedRoutes = routesData.slice(start, end)

    // Regional summary
    const regionalSummary = [
      { name: 'Dubai (01)', sales: routesData.reduce((sum, r) => sum + r.sales, 0) * 0.4, orders: routesData.reduce((sum, r) => sum + r.orders, 0) * 0.4, routes: Math.floor(routesData.length * 0.4) },
      { name: 'Abu Dhabi (03)', sales: routesData.reduce((sum, r) => sum + r.sales, 0) * 0.3, orders: routesData.reduce((sum, r) => sum + r.orders, 0) * 0.3, routes: Math.floor(routesData.length * 0.3) },
      { name: 'Sharjah (04)', sales: routesData.reduce((sum, r) => sum + r.sales, 0) * 0.2, orders: routesData.reduce((sum, r) => sum + r.orders, 0) * 0.2, routes: Math.floor(routesData.length * 0.2) },
      { name: 'Other (00)', sales: routesData.reduce((sum, r) => sum + r.sales, 0) * 0.1, orders: routesData.reduce((sum, r) => sum + r.orders, 0) * 0.1, routes: Math.floor(routesData.length * 0.1) }
    ]

    const response = NextResponse.json({
      success: true,
      data: paginatedRoutes,
      regionalSummary,
      count: paginatedRoutes.length,
      totalCount,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      timestamp: new Date().toISOString(),
      cached: true,
      source: 'json-server'
    })

    response.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600')
    response.headers.set('X-Cache-Duration', '1800')

    return response

  } catch (error) {
    console.error('Routes analysis API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch routes analysis data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
