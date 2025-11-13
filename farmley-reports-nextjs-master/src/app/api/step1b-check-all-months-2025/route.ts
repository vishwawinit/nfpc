import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check target counts for ALL months in 2025
    const allMonthsQuery = `
      SELECT
        month,
        COUNT(*) as target_count,
        SUM(amount) as total_target_amount,
        MIN(startdate) as period_start,
        MAX(enddate) as period_end
      FROM tblcommontarget
      WHERE year = 2025
        AND isactive = true
        AND timeframe = 'M'
        AND salesmancode IS NOT NULL
      GROUP BY month
      ORDER BY month
    `
    const allMonths = await db.query(allMonthsQuery)

    // Check which month has 30 targets
    const monthWith30 = allMonths.rows.find(row => parseInt(row.target_count) === 30)

    // Get August specifically (month 8) since it might have 30
    const augustDetailsQuery = `
      SELECT
        salesmancode,
        amount,
        startdate,
        enddate
      FROM tblcommontarget
      WHERE year = 2025 AND month = 8
        AND isactive = true
        AND timeframe = 'M'
        AND salesmancode IS NOT NULL
      ORDER BY salesmancode
    `
    const augustDetails = await db.query(augustDetailsQuery)

    // Current date context
    const currentDateQuery = `
      SELECT
        CURRENT_DATE as today,
        EXTRACT(MONTH FROM CURRENT_DATE) as current_month
    `
    const currentDate = await db.query(currentDateQuery)

    return NextResponse.json({
      success: true,
      all_months_2025_analysis: {
        current_date_info: currentDate.rows[0],
        monthly_target_counts: allMonths.rows,
        month_with_30_targets: monthWith30 ?
          `Month ${monthWith30.month} has ${monthWith30.target_count} targets` :
          "No month has exactly 30 targets",
        august_details: {
          count: augustDetails.rows.length,
          has_30_targets: augustDetails.rows.length === 30,
          total_amount: augustDetails.rows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0),
          period: augustDetails.rows.length > 0 ?
            `${augustDetails.rows[0].startdate} to ${augustDetails.rows[0].enddate}` :
            "No August targets"
        },
        verification: {
          september_count: allMonths.rows.find(r => parseInt(r.month) === 9)?.target_count || 0,
          august_count: allMonths.rows.find(r => parseInt(r.month) === 8)?.target_count || 0,
          user_might_have_meant: augustDetails.rows.length === 30 ?
            "August (which has 30 targets)" :
            "Unknown - no month has exactly 30 targets"
        }
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}