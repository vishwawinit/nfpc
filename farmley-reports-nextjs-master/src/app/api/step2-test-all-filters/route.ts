import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    const filters = ['thisMonth', 'lastMonth', 'thisQuarter', 'lastQuarter', 'thisYear']
    const results = {}

    for (const filter of filters) {
      try {
        // Test each filter by calling the actual API using dynamic origin
        const response = await fetch(`${request.nextUrl.origin}/api/targets/achievement?range=${filter}`)
        const data = await response.json()

        if (data.success) {
          results[filter] = {
            success: true,
            summary: data.data.summary,
            dateRange: data.dateRange,
            timestamp: data.timestamp,
            monthly_data_count: data.data.monthlyData?.length || 0,
            top_performers_count: data.data.topPerformers?.length || 0
          }
        } else {
          results[filter] = {
            success: false,
            error: data.error || 'Unknown error'
          }
        }
      } catch (error) {
        results[filter] = {
          success: false,
          error: error.message
        }
      }
    }

    // Get current date context
    const currentDateQuery = `
      SELECT
        CURRENT_DATE as today,
        EXTRACT(MONTH FROM CURRENT_DATE) as current_month,
        EXTRACT(YEAR FROM CURRENT_DATE) as current_year,
        EXTRACT(QUARTER FROM CURRENT_DATE) as current_quarter
    `
    const currentDate = await db.query(currentDateQuery)

    // Analyze the results
    const analysis = {
      filters_tested: filters.length,
      successful_filters: Object.values(results).filter(r => r.success).length,
      failed_filters: Object.values(results).filter(r => !r.success).length,
      achievement_percentages: {},
      realistic_check: {}
    }

    // Extract achievement percentages and check if realistic
    for (const [filter, result] of Object.entries(results)) {
      if (result.success) {
        const percentage = result.summary?.avgAchievementPercentage || 0
        analysis.achievement_percentages[filter] = percentage

        // Realistic check based on time period
        let expectedRange = ''
        let isRealistic = false

        switch (filter) {
          case 'thisMonth':
            // September: we have ~8 days out of 30, expect ~27%
            expectedRange = '20-40% (partial month)'
            isRealistic = percentage >= 20 && percentage <= 200
            break
          case 'lastMonth':
            // August: full month, expect 80-120%
            expectedRange = '80-120% (full month)'
            isRealistic = percentage >= 50 && percentage <= 150
            break
          case 'thisQuarter':
            // Q3: July, August (full) + September (partial)
            expectedRange = '60-100% (2+ months)'
            isRealistic = percentage >= 50 && percentage <= 150
            break
          case 'lastQuarter':
            // Q2: April, May, June (all full months)
            expectedRange = '80-120% (full quarter)'
            isRealistic = percentage >= 70 && percentage <= 130
            break
          case 'thisYear':
            // Full year data
            expectedRange = '80-120% (multiple months)'
            isRealistic = percentage >= 60 && percentage <= 140
            break
        }

        analysis.realistic_check[filter] = {
          percentage,
          expected_range: expectedRange,
          is_realistic: isRealistic,
          concern_level: percentage > 500 ? 'HIGH - Over 500%' :
                       percentage > 200 ? 'MEDIUM - Over 200%' :
                       percentage < 50 ? 'LOW - Under 50%' : 'NORMAL'
        }
      }
    }

    return NextResponse.json({
      success: true,
      systematic_filter_testing: {
        current_date_context: currentDate.rows[0],
        filter_results: results,
        analysis,
        step_2_summary: {
          all_filters_tested: analysis.filters_tested === 5,
          any_unrealistic_percentages: Object.values(analysis.realistic_check).some(r => !r.is_realistic),
          highest_concern: Object.entries(analysis.realistic_check)
            .sort((a, b) => b[1].percentage - a[1].percentage)[0]
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