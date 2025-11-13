import { NextRequest, NextResponse } from 'next/server'
import { getAttendanceAnalytics } from '@/services/attendanceService'
import { exportAttendanceReport } from '@/lib/excelExport'

export async function GET(request: NextRequest) {
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

    // Fetch attendance analytics
    const analytics = await getAttendanceAnalytics(filters)

    // Format filters for display
    const appliedFilters: Record<string, any> = {}
    if (startDate && endDate) {
      appliedFilters['Date Range'] = `${startDate} to ${endDate}`
    } else {
      appliedFilters['Period'] = dateRange
    }

    // Generate Excel file
    const buffer = await exportAttendanceReport({
      analytics,
      filters: appliedFilters
    })

    // Create filename
    const dateStr = startDate && endDate
      ? `${startDate}_to_${endDate}`
      : dateRange
    const filename = `Attendance_Report_${dateStr}.xlsx`

    // Return as downloadable file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Attendance Export API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export attendance report',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
