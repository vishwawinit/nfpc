import { NextRequest, NextResponse } from 'next/server'
import { fetchFromJsonServer, filterByDateRange, getDateRangeFromString } from '@/lib/jsonServerClient'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || 'today'
    const date = searchParams.get('date')
    const salesmanCode = searchParams.get('salesmanCode')

    // If date is provided, use it directly, otherwise use range
    const dateRange = date || range
    const currentDate = new Date().toISOString().split('T')[0]

    // Get date range
    const { startDate, endDate } = getDateRangeFromString(dateRange, currentDate)

    // Fetch data from json-server
    const journeys = await fetchFromJsonServer<any[]>('journeys')
    const visits = await fetchFromJsonServer<any[]>('visits')

    // Filter by date range
    let filteredJourneys = filterByDateRange(journeys, 'date', startDate, endDate)
    let filteredVisits = filterByDateRange(visits, 'date', startDate, endDate)

    // Filter by salesman if provided
    if (salesmanCode) {
      filteredJourneys = filteredJourneys.filter(j => j.salesmanCode === salesmanCode)
      filteredVisits = filteredVisits.filter(v => v.salesmanCode === salesmanCode)
    }

    // Calculate summary metrics
    const totalJourneys = filteredJourneys.length
    const totalVisits = filteredVisits.length
    const completedVisits = filteredVisits.filter(v => v.status === 'completed').length
    const avgVisitsPerJourney = totalJourneys > 0 ? totalVisits / totalJourneys : 0

    const summary = {
      success: true,
      data: {
        totalJourneys,
        totalVisits,
        completedVisits,
        pendingVisits: totalVisits - completedVisits,
        avgVisitsPerJourney,
        journeys: filteredJourneys,
        visits: filteredVisits
      },
      timestamp: new Date().toISOString(),
      source: 'json-server'
    }

    // Create response with cache headers
    const response = NextResponse.json(summary)
    response.headers.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=360')
    response.headers.set('X-Cache-Duration', '180')

    return response

  } catch (error) {
    console.error('Error fetching field operations summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch field operations summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
