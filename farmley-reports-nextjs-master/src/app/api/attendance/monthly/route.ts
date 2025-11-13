import { NextResponse } from 'next/server'
import { getMonthlyAttendanceSummary } from '@/services/attendanceService'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('dateRange') || 'thisYear'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const filters: any = {}
    if (startDate && endDate) {
      filters.startDate = startDate
      filters.endDate = endDate
    } else {
      filters.dateRange = dateRange
    }

    const data = await getMonthlyAttendanceSummary(filters)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in monthly attendance API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monthly attendance' },
      { status: 500 }
    )
  }
}
