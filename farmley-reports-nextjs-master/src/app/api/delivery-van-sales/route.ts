import { NextRequest, NextResponse } from 'next/server'
import { fetchFromJsonServer, filterByDateRange, getDateRangeFromString } from '@/lib/jsonServerClient'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateRange = searchParams.get('range') || 'thisMonth'
    const salesmanCode = searchParams.get('salesman') || 'all'
    const routeCode = searchParams.get('route') || 'all'

    const currentDate = new Date().toISOString().split('T')[0]

    // Get date range
    const { startDate, endDate } = getDateRangeFromString(dateRange, currentDate)

    // Fetch data from json-server
    const transactions = await fetchFromJsonServer<any[]>('transactions')
    const stockMovements = await fetchFromJsonServer<any[]>('stockMovements')

    // Filter transactions by date range
    let filteredTransactions = filterByDateRange(transactions, 'trxDate', startDate, endDate)

    // Apply additional filters
    if (salesmanCode !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => t.salesmanCode === salesmanCode)
    }
    if (routeCode !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => t.routeCode === routeCode)
    }

    // Filter stock movements by date range
    let filteredStockMovements = filterByDateRange(stockMovements, 'date', startDate, endDate)

    if (salesmanCode !== 'all') {
      filteredStockMovements = filteredStockMovements.filter(s => s.salesmanCode === salesmanCode)
    }
    if (routeCode !== 'all') {
      filteredStockMovements = filteredStockMovements.filter(s => s.routeCode === routeCode)
    }

    // Calculate metrics
    const sales = filteredTransactions.filter(t => t.trxType === 'SALE')
    const totalSales = sales.reduce((sum, t) => sum + t.totalAmount, 0)
    const totalStockValue = filteredStockMovements.reduce((sum, s) => sum + (s.quantity * s.unitPrice || 0), 0)

    const data = {
      totalSales,
      totalOrders: sales.length,
      totalStockValue,
      stockMovements: filteredStockMovements,
      sales,
      summary: {
        avgSale: sales.length > 0 ? totalSales / sales.length : 0,
        avgStockMovement: filteredStockMovements.length > 0 ? totalStockValue / filteredStockMovements.length : 0
      }
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      source: 'json-server'
    })

  } catch (error) {
    console.error('Delivery/Van Sales API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch delivery/van sales data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Force refresh endpoint
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: 'Delivery/Van Sales cache invalidated',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cache refresh error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to refresh cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
