import { NextResponse } from 'next/server'
import { getAttendanceAnalytics } from '@/services/attendanceService'
import { getCacheDuration, getCacheControlHeader } from '@/lib/cache-utils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('dateRange') || 'thisMonth'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const filters: any = {}
    if (startDate && endDate) {
      filters.startDate = startDate
      filters.endDate = endDate
    } else {
      filters.dateRange = dateRange
    }

    const data = await getAttendanceAnalytics(filters)
    
    // Calculate cache duration based on date range
    const hasCustomDates = !!(startDate && endDate)
    const cacheDuration = getCacheDuration(dateRange, hasCustomDates)
    
    return NextResponse.json({
      ...data,
      cached: true,
      cacheInfo: {
        duration: cacheDuration,
        dateRange,
        hasCustomDates
      }
    }, {
      headers: {
        'Cache-Control': getCacheControlHeader(cacheDuration)
      }
    })
  } catch (error) {
    console.error('Error in attendance analytics API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attendance analytics' },
      { status: 500 }
    )
  }
}
