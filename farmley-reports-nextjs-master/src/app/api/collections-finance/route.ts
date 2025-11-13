import { NextRequest, NextResponse } from 'next/server'
import { fetchFromJsonServer, filterByDateRange, getDateRangeFromString } from '@/lib/jsonServerClient'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'lastMonth'
    const salesmanCode = searchParams.get('salesman')
    const routeCode = searchParams.get('route')

    const currentDate = new Date().toISOString().split('T')[0]

    // Get date range
    const { startDate, endDate } = getDateRangeFromString(range, currentDate)

    // Fetch data from json-server
    const transactions = await fetchFromJsonServer<any[]>('transactions')

    // Filter by date range
    let filteredTransactions = filterByDateRange(transactions, 'trxDate', startDate, endDate)

    // Apply additional filters
    if (salesmanCode) {
      filteredTransactions = filteredTransactions.filter(t => t.salesmanCode === salesmanCode)
    }
    if (routeCode) {
      filteredTransactions = filteredTransactions.filter(t => t.routeCode === routeCode)
    }

    // Calculate collections & finance metrics
    const payments = filteredTransactions.filter(t => t.trxType === 'PAYMENT')
    const sales = filteredTransactions.filter(t => t.trxType === 'SALE')

    const totalCollections = payments.reduce((sum, t) => sum + Math.abs(t.totalAmount), 0)
    const totalSales = sales.reduce((sum, t) => sum + t.totalAmount, 0)
    const totalOutstanding = totalSales - totalCollections

    const data = {
      totalCollections,
      totalSales,
      totalOutstanding,
      collectionEfficiency: totalSales > 0 ? (totalCollections / totalSales) * 100 : 0,
      transactions: filteredTransactions,
      summary: {
        totalPayments: payments.length,
        totalSales: sales.length,
        avgPayment: payments.length > 0 ? totalCollections / payments.length : 0,
        avgSale: sales.length > 0 ? totalSales / sales.length : 0
      }
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      source: 'json-server'
    })
  } catch (error: any) {
    console.error('Error fetching collections data:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
