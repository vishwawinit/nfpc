import { NextRequest, NextResponse } from 'next/server'
import { fetchFromJsonServer, filterByDateRange, getDateRangeFromString } from '@/lib/jsonServerClient'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateRange = searchParams.get('range') || 'thisMonth'
    const cityCode = searchParams.get('city') || 'all'

    // Get date range
    const { startDate, endDate } = getDateRangeFromString(dateRange)

    // Fetch data from json-server
    const transactions = await fetchFromJsonServer<any[]>('transactions')
    const dailySales = await fetchFromJsonServer<any[]>('dailySales')
    const salesmen = await fetchFromJsonServer<any[]>('salesmen')
    const products = await fetchFromJsonServer<any[]>('products')

    // Filter transactions by date range and city
    let filteredTransactions = filterByDateRange(transactions, 'trxDate', startDate, endDate)
      .filter(t => t.trxType === 'SALE')
    
    // Apply city filter if specified
    if (cityCode && cityCode !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => 
        t.cityCode === cityCode || t.cityName === cityCode
      )
    }

    // Calculate summary
    const totalSales = filteredTransactions.reduce((sum, t) => sum + t.totalAmount, 0)
    const totalOrders = filteredTransactions.length
    const uniqueCustomers = new Set(filteredTransactions.map(t => t.clientCode)).size
    const activeSalesmen = new Set(filteredTransactions.map(t => t.userCode)).size
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

    // Calculate growth percentage (compare with previous period)
    const periodLength = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const prevStartDate = new Date(startDate)
    prevStartDate.setDate(prevStartDate.getDate() - periodLength)
    const prevEndDate = new Date(endDate)
    prevEndDate.setDate(prevEndDate.getDate() - periodLength)

    const prevTransactions = filterByDateRange(transactions, 'trxDate', prevStartDate, prevEndDate)
      .filter(t => t.trxType === 'SALE')
    const prevTotalSales = prevTransactions.reduce((sum, t) => sum + t.totalAmount, 0)
    const growthPercentage = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales * 100) : 0

    // Get trend data
    let filteredDailySales = filterByDateRange(dailySales, 'saleDate', startDate, endDate)
    
    // Apply city filter to daily sales if specified
    if (cityCode && cityCode !== 'all') {
      filteredDailySales = filteredDailySales.filter(ds => 
        ds.cityCode === cityCode || ds.cityName === cityCode
      )
    }
    
    const trend = filteredDailySales.map(ds => ({
      period: ds.sale_date,
      date: ds.sale_date,
      sales: ds.totalSales,
      orders: ds.totalTransactions,
      salesmen: ds.activeSalesmen || 1
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate top salesmen
    const salesmanStats: any = {}
    salesmen.forEach(salesman => {
      const salesmanTrx = filteredTransactions.filter(t => t.userCode === salesman.userCode)
      const salesmanSales = salesmanTrx.reduce((sum, t) => sum + t.totalAmount, 0)
      const salesmanOrders = salesmanTrx.length

      salesmanStats[salesman.userCode] = {
        empNo: salesman.userCode,
        name: salesman.userName,
        orders: salesmanOrders,
        totalSales: salesmanSales,
        avgOrder: salesmanOrders > 0 ? salesmanSales / salesmanOrders : 0
      }
    })

    const topSalesmen = Object.values(salesmanStats)
      .sort((a: any, b: any) => b.totalSales - a.totalSales)
      .slice(0, 5)

    // Calculate category performance
    const categoryStats: any = {}
    filteredTransactions.forEach(t => {
      t.items.forEach((item: any) => {
        const product = products.find(p => p.productCode === item.productCode)
        const category = product?.category || 'Unknown'

        if (!categoryStats[category]) {
          categoryStats[category] = {
            name: category,
            transactions: 0,
            unitsSold: 0,
            revenue: 0
          }
        }
        categoryStats[category].transactions += 1
        categoryStats[category].unitsSold += item.quantity
        categoryStats[category].revenue += item.total
      })
    })

    const categoryPerformance = Object.values(categoryStats)
      .sort((a: any, b: any) => b.revenue - a.revenue)

    const performanceData = {
      summary: {
        totalSales,
        totalOrders,
        uniqueCustomers,
        activeSalesmen,
        avgOrderValue,
        growthPercentage,
        periodStart: startDate.toISOString().split('T')[0],
        periodEnd: endDate.toISOString().split('T')[0]
      },
      trend,
      topSalesmen,
      categoryPerformance
    }

    return NextResponse.json({
      success: true,
      data: performanceData,
      dateRange,
      timestamp: new Date().toISOString(),
      source: 'json-server'
    })

  } catch (error) {
    console.error('Sales performance API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sales performance',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
