import { NextResponse } from 'next/server'
import { getWeeklyAttendanceSummary } from '@/services/attendanceService'

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

    const data = await getWeeklyAttendanceSummary(filters)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in weekly attendance API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weekly attendance' },
      { status: 500 }
    )
  }
}
