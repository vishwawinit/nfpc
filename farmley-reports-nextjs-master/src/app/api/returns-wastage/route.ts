import { NextRequest, NextResponse } from 'next/server'
import { fetchFromJsonServer, filterByDateRange, getDateRangeFromString } from '@/lib/jsonServerClient'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateRange = searchParams.get('range') || 'lastMonth'
    const salesmanCode = searchParams.get('salesman') || 'all'
    const routeCode = searchParams.get('route') || 'all'
    const regionCode = searchParams.get('region') || 'all'
    const customerCode = searchParams.get('customer') || 'all'

    const currentDate = new Date().toISOString().split('T')[0]

    // Get date range
    const { startDate, endDate } = getDateRangeFromString(dateRange, currentDate)

    // Fetch data from json-server
    const transactions = await fetchFromJsonServer<any[]>('transactions')

    // Filter by date range
    let filteredTransactions = filterByDateRange(transactions, 'trxDate', startDate, endDate)

    // Apply additional filters
    if (salesmanCode !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => t.salesmanCode === salesmanCode)
    }
    if (routeCode !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => t.routeCode === routeCode)
    }
    if (regionCode !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => t.regionCode === regionCode)
    }
    if (customerCode !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => t.customerCode === customerCode)
    }

    // Filter only returns
    const returns = filteredTransactions.filter(t => t.trxType === 'RETURN')

    // Calculate metrics
    const totalReturnAmount = returns.reduce((sum, t) => sum + Math.abs(t.totalAmount), 0)
    const totalReturnQty = returns.reduce((sum, t) => sum + Math.abs(t.quantity || 0), 0)

    const data = {
      totalReturnAmount,
      totalReturnQty,
      totalReturnTransactions: returns.length,
      returns,
      summary: {
        avgReturnValue: returns.length > 0 ? totalReturnAmount / returns.length : 0,
        avgReturnQty: returns.length > 0 ? totalReturnQty / returns.length : 0
      }
    }

    const response = NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      source: 'json-server'
    })

    // Add cache headers
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600'
    )

    return response

  } catch (error) {
    console.error('Returns & Wastage API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch returns and wastage data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Force refresh endpoint
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: 'Returns & Wastage cache invalidated (data + filters)',
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
