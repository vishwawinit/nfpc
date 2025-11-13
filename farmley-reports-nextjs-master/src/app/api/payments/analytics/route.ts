import { NextRequest, NextResponse } from 'next/server'
import { fetchFromJsonServer, filterByDateRange, getDateRangeFromString } from '@/lib/jsonServerClient'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'thisMonth'
    const dateRange = searchParams.get('dateRange')
    const paymentMode = searchParams.get('paymentMode')
    const salesman = searchParams.get('salesman')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const sortBy = searchParams.get('sortBy') || 'trxDate'
    const sortOrder = searchParams.get('sortOrder') || 'DESC'

    const currentDate = new Date().toISOString().split('T')[0]

    // Get date range
    const { startDate, endDate } = getDateRangeFromString(dateRange || period, currentDate)

    // Fetch data from json-server
    const transactions = await fetchFromJsonServer<any[]>('transactions')

    // Filter payments only
    let payments = transactions.filter(t => t.trxType === 'PAYMENT')

    // Filter by date range
    payments = filterByDateRange(payments, 'trxDate', startDate, endDate)

    // Apply additional filters
    if (paymentMode) {
      payments = payments.filter(p => p.paymentMode === paymentMode)
    }
    if (salesman) {
      payments = payments.filter(p => p.salesmanCode === salesman)
    }
    if (search) {
      const searchLower = search.toLowerCase()
      payments = payments.filter(p =>
        p.customerName?.toLowerCase().includes(searchLower) ||
        p.trxCode?.toLowerCase().includes(searchLower)
      )
    }

    // Calculate summary
    const totalPayments = payments.reduce((sum, p) => sum + Math.abs(p.totalAmount), 0)
    const avgPayment = payments.length > 0 ? totalPayments / payments.length : 0

    // Sort
    payments.sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      if (sortOrder === 'DESC') {
        return bVal > aVal ? 1 : -1
      } else {
        return aVal > bVal ? 1 : -1
      }
    })

    // Paginate
    const startIdx = (page - 1) * limit
    const endIdx = startIdx + limit
    const paginatedPayments = payments.slice(startIdx, endIdx)

    const result = {
      success: true,
      data: paginatedPayments,
      summary: {
        totalPayments,
        totalCount: payments.length,
        avgPayment
      },
      pagination: {
        page,
        limit,
        total: payments.length,
        totalPages: Math.ceil(payments.length / limit)
      },
      timestamp: new Date().toISOString(),
      source: 'json-server'
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Payment Analytics API Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch payment analytics'
      },
      { status: 500 }
    )
  }
}
