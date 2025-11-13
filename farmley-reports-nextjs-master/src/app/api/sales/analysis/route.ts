import { NextRequest, NextResponse } from 'next/server'
import { fetchFromJsonServer, filterByDateRange, getDateRangeFromString } from '@/lib/jsonServerClient'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('range') || 'today'
    const currentDate = new Date().toISOString().split('T')[0]

    // Get date range
    const { startDate, endDate } = getDateRangeFromString(dateRange, currentDate)

    // Fetch data from json-server
    const transactions = await fetchFromJsonServer<any[]>('transactions')
    const products = await fetchFromJsonServer<any[]>('products')

    // Filter transactions by date range
    const filteredTransactions = filterByDateRange(transactions, 'trxDate', startDate, endDate)
    const sales = filteredTransactions.filter(t => t.trxType === 'SALE')

    // Calculate analysis data
    const totalSales = sales.reduce((sum, t) => sum + t.totalAmount, 0)
    const totalOrders = sales.length
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

    // Sales by product
    const salesByProduct = products.map(product => {
      const productSales = sales.filter(s => s.productCode === product.productCode)
      const productTotal = productSales.reduce((sum, s) => sum + s.totalAmount, 0)
      return {
        productCode: product.productCode,
        productName: product.productName,
        totalSales: productTotal,
        totalOrders: productSales.length
      }
    }).filter(p => p.totalSales > 0)
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10) // Top 10 products

    // Sales by category
    const salesByCategory: { [key: string]: number } = {}
    sales.forEach(sale => {
      const category = sale.categoryName || 'Unknown'
      salesByCategory[category] = (salesByCategory[category] || 0) + sale.totalAmount
    })

    const analysisData = {
      totalSales,
      totalOrders,
      avgOrderValue,
      topProducts: salesByProduct,
      salesByCategory: Object.entries(salesByCategory).map(([category, total]) => ({
        category,
        total
      })).sort((a, b) => b.total - a.total)
    }

    return NextResponse.json({
      success: true,
      data: analysisData,
      dateRange,
      timestamp: new Date().toISOString(),
      source: 'json-server'
    })

  } catch (error) {
    console.error('Sales analysis API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sales analysis data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
