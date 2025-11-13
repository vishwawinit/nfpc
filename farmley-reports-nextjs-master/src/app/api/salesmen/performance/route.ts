import { NextRequest, NextResponse } from 'next/server'
import { fetchFromJsonServer, filterByDateRange, getDateRangeFromString } from '@/lib/jsonServerClient'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'thisMonth'
    const limit = parseInt(searchParams.get('limit') || '20')
    const currentDate = new Date().toISOString().split('T')[0]

    // Get date range
    const { startDate, endDate } = getDateRangeFromString(range, currentDate)

    // Fetch data from json-server
    const transactions = await fetchFromJsonServer<any[]>('transactions')
    const salesmen = await fetchFromJsonServer<any[]>('salesmen')

    // Filter transactions by date range
    const filteredTransactions = filterByDateRange(transactions, 'trxDate', startDate, endDate)
    const salesTransactions = filteredTransactions.filter(t => t.trxType === 'SALE')

    // Calculate metrics per salesman
    const salesmanMetrics = salesmen.map((salesman: any) => {
      const salesmanTransactions = salesTransactions.filter(t => t.salesmanCode === salesman.salesmanCode)
      const totalSales = salesmanTransactions.reduce((sum, t) => sum + t.totalAmount, 0)
      const totalOrders = salesmanTransactions.length
      const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
      const bestOrder = salesmanTransactions.length > 0 ? Math.max(...salesmanTransactions.map(t => t.totalAmount)) : 0

      return {
        salesmanCode: salesman.salesmanCode,
        salesmanName: salesman.salesmanName,
        totalSales,
        totalOrders,
        avgOrderValue,
        bestOrder
      }
    })

    // Sort by total sales and add ranking
    let salesmenData = salesmanMetrics
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, limit)
      .map((salesman: any, index: number) => ({
        rank: `#${index + 1}`,
        salesmanCode: salesman.salesmanCode,
        salesmanName: salesman.salesmanName,
        totalSales: salesman.totalSales,
        totalSales30d: salesman.totalSales,
        totalOrders: salesman.totalOrders,
        avgOrderValue: salesman.avgOrderValue,
        bestOrder: salesman.bestOrder,
        activeDays: 20,
        achievementPercentage: Math.min(100, (salesman.totalSales / 100000) * 100),
        performanceStatus: salesman.totalSales > 80000 ? 'Achieved' : salesman.totalSales > 50000 ? 'Good' : 'Average',
        targetAmount: 100000,
        lastUpdated: new Date().toISOString()
      }))

    // Separate top performers and need attention
    const topPerformers = salesmenData.filter((p: any) => p.achievementPercentage >= 80).slice(0, 20)
    const needAttention = salesmenData.filter((p: any) => p.achievementPercentage < 60).slice(0, 20)

    const response = NextResponse.json({
      success: true,
      data: {
        all: salesmenData,
        topPerformers,
        needAttention
      },
      count: salesmenData.length,
      timestamp: new Date().toISOString(),
      cached: true,
      source: 'json-server'
    })

    response.headers.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600')
    response.headers.set('X-Cache-Duration', '1800')

    return response

  } catch (error) {
    console.error('Salesmen performance API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch salesmen performance data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
