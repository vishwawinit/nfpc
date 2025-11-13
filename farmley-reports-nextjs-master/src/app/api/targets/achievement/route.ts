import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'
import { TargetService } from '@/lib/targetService'

// Helper function to create cache key
function getCacheKey(dateRange: string, userId: string | null) {
  return `targets-achievement-${dateRange}-${userId || 'all'}`
}

// Determine cache duration based on date range
const getCacheDuration = (range: string): number => {
  switch(range) {
    case 'thisMonth':
    case 'lastMonth':
      return 1800 // 30 minutes for monthly data
    case 'thisQuarter':
    case 'lastQuarter':
    case 'Q1':
    case 'Q2':
    case 'Q3':
    case 'Q4':
      return 3600 // 1 hour for quarterly data
    case 'thisYear':
    case 'lastYear':
      return 7200 // 2 hours for yearly data
    case 'last12Months':
      return 3600 // 1 hour for rolling data
    default:
      return 1800 // 30 minutes default
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('range') || 'thisYear'
    const userId = searchParams.get('userId') // Optional filter by user

    // Initialize database connection
    await db.initialize()

    // Check if we have any data for this date range first - using correct table
    const dataCheckQuery = `
      SELECT COUNT(*) as count
      FROM new_flat_transactions
      WHERE ${(() => {
        switch(dateRange) {
          case 'today':
            return `DATE_TRUNC('day', trx_date_only) = DATE_TRUNC('day', CURRENT_DATE)`
          case 'yesterday':
            return `DATE_TRUNC('day', trx_date_only) = DATE_TRUNC('day', CURRENT_DATE - INTERVAL '1 day')`
          case 'thisWeek':
            return `DATE_TRUNC('week', trx_date_only) = DATE_TRUNC('week', CURRENT_DATE)`
          case 'thisMonth':
            return `DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', CURRENT_DATE)`
          case 'lastMonth':
            return `DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`
          case 'thisQuarter':
            return `DATE_TRUNC('quarter', trx_date_only) = DATE_TRUNC('quarter', CURRENT_DATE)`
          case 'lastQuarter':
            return `DATE_TRUNC('quarter', trx_date_only) = DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')`
          case 'thisYear':
            return `DATE_TRUNC('year', trx_date_only) = DATE_TRUNC('year', CURRENT_DATE)`
          default:
            return `DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', CURRENT_DATE)`
        }
      })()} AND total_amount > 0
    `

    const dataCheck = await db.query(dataCheckQuery)
    const hasData = parseInt(dataCheck.rows[0]?.count || 0) > 0

    if (!hasData) {
      // Return empty data structure when no data exists
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalTargets: 0,
            totalTargetAmount: 0,
            totalAchievedAmount: 0,
            avgAchievementPercentage: 0,
            targetsMet: 0,
            targetsMissed: 0
          },
          monthlyData: [],
          topPerformers: [],
          periodBreakdown: []
        },
        dateRange,
        userId,
        timestamp: new Date().toISOString(),
        cached: false,
        hasData: false
      })
    }

    // Build date filter based on range - using new_flat_transactions for accurate data
    let dateFilter = ''
    switch(dateRange) {
      case 'today':
        dateFilter = `DATE_TRUNC('day', trx_date_only) = DATE_TRUNC('day', CURRENT_DATE)`
        break
      case 'yesterday':
        dateFilter = `DATE_TRUNC('day', trx_date_only) = DATE_TRUNC('day', CURRENT_DATE - INTERVAL '1 day')`
        break
      case 'thisWeek':
        dateFilter = `DATE_TRUNC('week', trx_date_only) = DATE_TRUNC('week', CURRENT_DATE)`
        break
      case 'thisMonth':
        dateFilter = `DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', CURRENT_DATE)`
        break
      case 'lastMonth':
        dateFilter = `DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`
        break
      case 'thisQuarter':
        dateFilter = `DATE_TRUNC('quarter', trx_date_only) = DATE_TRUNC('quarter', CURRENT_DATE)`
        break
      case 'lastQuarter':
        dateFilter = `DATE_TRUNC('quarter', trx_date_only) = DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')`
        break
      case 'thisYear':
        dateFilter = `DATE_TRUNC('year', trx_date_only) = DATE_TRUNC('year', CURRENT_DATE)`
        break
      case 'Q1':
        dateFilter = `DATE_TRUNC('quarter', trx_date_only) = '2025-01-01'::date`
        break
      case 'Q2':
        dateFilter = `DATE_TRUNC('quarter', trx_date_only) = '2025-04-01'::date`
        break
      case 'Q3':
        dateFilter = `DATE_TRUNC('quarter', trx_date_only) = '2025-07-01'::date`
        break
      case 'Q4':
        dateFilter = `DATE_TRUNC('quarter', trx_date_only) = '2025-10-01'::date`
        break
      default:
        dateFilter = `DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', CURRENT_DATE)`
    }

    // Add user filter if specified
    const userFilter = userId ? `AND salesman_code = '${userId}'` : ''

    // Create cached version of the queries
    const cacheDuration = getCacheDuration(dateRange)
    const cacheKey = getCacheKey(dateRange, userId)

    const getCachedTargetData = unstable_cache(
      async () => {
        // STEP 1: Get salesmen who have targets for this period
        const year = new Date().getFullYear()
        const month = new Date().getMonth() + 1
        let targetTimeframe = 'M' // Default to monthly
        let targetYear = year
        let targetMonth = month

        // Adjust year/month based on date range
        switch(dateRange) {
          case 'lastMonth':
            targetMonth = month === 1 ? 12 : month - 1
            targetYear = month === 1 ? year - 1 : year
            break
          case 'lastQuarter':
            // Current quarter: Q3 (July-Sept), so last quarter is Q2 (April-June)
            const currentQuarter = Math.ceil(month / 3)
            const lastQuarterNum = currentQuarter - 1
            if (lastQuarterNum === 0) {
              targetYear = year - 1
              // Q4 of previous year: months 10, 11, 12
              targetMonth = [10, 11, 12]
            } else {
              // Q2: months 4, 5, 6
              const startMonth = (lastQuarterNum - 1) * 3 + 1
              targetMonth = [startMonth, startMonth + 1, startMonth + 2]
            }
            break
          case 'Q1':
          case 'Q2':
          case 'Q3':
          case 'Q4':
            // For specific quarters, use fixed year 2025
            targetYear = 2025
            break
          case 'thisYear':
          case 'lastYear':
            // For yearly, we'll use all monthly targets
            targetTimeframe = 'M'
            if (dateRange === 'lastYear') targetYear = year - 1
            break
        }

        // Get salesmen with targets for this period
        let targetedSalesmenQuery = ''
        let targetedSalesmenParams = []

        if (dateRange === 'thisYear' || dateRange === 'lastYear') {
          // For yearly, get salesmen who have targets in ANY quarter (Q1, Q2, Q3, Q4)
          // This ensures consistency with quarterly calculations
          targetedSalesmenQuery = `
            SELECT DISTINCT salesmancode
            FROM tblcommontarget
            WHERE isactive = true
              AND timeframe = 'M'
              AND year = $1
              AND salesmancode IS NOT NULL
          `
          targetedSalesmenParams = [targetYear]
        } else if (dateRange === 'thisQuarter' || dateRange === 'lastQuarter' ||
                   dateRange === 'Q1' || dateRange === 'Q2' || dateRange === 'Q3' || dateRange === 'Q4') {
          // For quarters, get all salesmen who have targets for ANY month in that quarter
          const currentQuarter = Math.ceil(month / 3)
          let quarterToCheck, quarterYear

          if (dateRange === 'Q1') {
            quarterToCheck = 1
            quarterYear = 2025
          } else if (dateRange === 'Q2') {
            quarterToCheck = 2
            quarterYear = 2025
          } else if (dateRange === 'Q3') {
            quarterToCheck = 3
            quarterYear = 2025
          } else if (dateRange === 'Q4') {
            quarterToCheck = 4
            quarterYear = 2025
          } else {
            quarterToCheck = dateRange === 'lastQuarter' ?
              (currentQuarter === 1 ? 4 : currentQuarter - 1) :
              currentQuarter
            quarterYear = (dateRange === 'lastQuarter' && currentQuarter === 1) ? year - 1 : year
          }

          let startMonth, endMonth
          if (quarterToCheck === 1) {
            startMonth = 1; endMonth = 3
          } else if (quarterToCheck === 2) {
            startMonth = 4; endMonth = 6
          } else if (quarterToCheck === 3) {
            startMonth = 7; endMonth = 9
          } else {
            startMonth = 10; endMonth = 12
          }

          targetedSalesmenQuery = `
            SELECT DISTINCT salesmancode
            FROM tblcommontarget
            WHERE isactive = true
              AND timeframe = 'M'
              AND year = $1
              AND month BETWEEN $2 AND $3
              AND salesmancode IS NOT NULL
          `
          targetedSalesmenParams = [quarterYear, startMonth, endMonth]
        } else {
          targetedSalesmenQuery = `
            SELECT DISTINCT salesmancode
            FROM tblcommontarget
            WHERE isactive = true
              AND timeframe = $1
              AND year = $2
              AND month = $3
              AND salesmancode IS NOT NULL
          `
          targetedSalesmenParams = [targetTimeframe, targetYear, targetMonth]
        }

        const targetedSalesmenResult = await db.query(targetedSalesmenQuery, targetedSalesmenParams)
        const targetedSalesmenCodes = targetedSalesmenResult.rows.map(row => row.salesmancode)

        console.log(`[TARGET FIX] Date range: ${dateRange}, Year: ${targetYear}, Month: ${targetMonth || 'N/A'}`);
        console.log(`[TARGET FIX] Found ${targetedSalesmenCodes.length} salesmen with targets for ${dateRange}:`, targetedSalesmenCodes.slice(0, 10).join(', '))

        // If no targeted salesmen, return empty data
        if (targetedSalesmenCodes.length === 0) {
          return {
            success: true,
            data: {
              summary: {
                totalTargets: 0,
                totalTargetAmount: 0,
                totalAchievedAmount: 0,
                avgAchievementPercentage: 0,
                targetsMet: 0,
                targetsMissed: 0
              },
              monthlyData: [],
              topPerformers: [],
              periodBreakdown: []
            },
            hasData: false
          }
        }

        // STEP 2: Get real target data ONLY for targeted salesmen
        let aggregateTarget = 0
        if (dateRange === 'Q1' || dateRange === 'Q2' || dateRange === 'Q3' || dateRange === 'Q4') {
          // For quarterly filters, calculate targets directly from database
          let months = []
          if (dateRange === 'Q1') months = [1, 2, 3]
          else if (dateRange === 'Q2') months = [4, 5, 6]
          else if (dateRange === 'Q3') months = [7, 8, 9]
          else if (dateRange === 'Q4') months = [10, 11, 12]

          const directTargetQuery = `
            SELECT SUM(amount) as total
            FROM tblcommontarget
            WHERE isactive = true
              AND timeframe = 'M'
              AND year = 2025
              AND month IN (${months.join(', ')})
          `
          const directTargetResult = await db.query(directTargetQuery)
          aggregateTarget = parseFloat(directTargetResult.rows[0]?.total || 0)
        } else {
          aggregateTarget = await TargetService.getAggregateTarget(dateRange, new Date())
        }
        console.log(`[TARGET FIX] Aggregate target for ${dateRange}: ${aggregateTarget}`)

        // STEP 3: Calculate achievements ONLY for targeted salesmen
        const salesmenPlaceholders = targetedSalesmenCodes.map((_, i) => `$${i + 1}`).join(', ')

        // For all calculations, only include achievements from months where salesmen have targets
        let achievementFilter = dateFilter
        if (dateRange === 'thisYear' || dateRange === 'lastYear') {
          achievementFilter = `
            EXTRACT(YEAR FROM trx_date_only) = ${targetYear}
            AND salesman_code IN (
              SELECT DISTINCT salesmancode
              FROM tblcommontarget t2
              WHERE t2.isactive = true
                AND t2.timeframe = 'M'
                AND t2.year = ${targetYear}
                AND t2.month = EXTRACT(MONTH FROM trx_date_only)
                AND t2.salesmancode = salesman_code
            )
          `
        } else if (dateRange === 'Q1' || dateRange === 'Q2' || dateRange === 'Q3' || dateRange === 'Q4') {
          // For quarters, only include achievements from months where salesmen have targets
          let months = []
          if (dateRange === 'Q1') months = [1, 2, 3]
          else if (dateRange === 'Q2') months = [4, 5, 6]
          else if (dateRange === 'Q3') months = [7, 8, 9]
          else if (dateRange === 'Q4') months = [10, 11, 12]

          achievementFilter = `
            DATE_TRUNC('quarter', trx_date_only) = '2025-${months[0].toString().padStart(2, '0')}-01'::date
            AND salesman_code IN (
              SELECT DISTINCT salesmancode
              FROM tblcommontarget t2
              WHERE t2.isactive = true
                AND t2.timeframe = 'M'
                AND t2.year = 2025
                AND t2.month = EXTRACT(MONTH FROM trx_date_only)
                AND t2.salesmancode = salesman_code
            )
          `
        }

        const targetCalculationQuery = `
      WITH transaction_totals AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE ${achievementFilter} ${userFilter}
          AND total_amount > 0
          AND salesman_code = ANY($1)
        GROUP BY trx_code, salesman_code
      ),
      current_achievement AS (
        SELECT
          COUNT(DISTINCT salesman_code) as total_records,
          SUM(transaction_total) as total_achieved_amount
        FROM transaction_totals
      )
      SELECT
        ca.total_records,
        ${aggregateTarget} as total_target_amount,
        ca.total_achieved_amount,
        CASE
          WHEN ${aggregateTarget} > 0 THEN
            ROUND((ca.total_achieved_amount / ${aggregateTarget}) * 100, 1)
          ELSE 0
        END as avg_achievement_percentage,
        CASE
          WHEN ca.total_achieved_amount >= ${aggregateTarget} THEN 1
          ELSE 0
        END as targets_met,
        CASE
          WHEN ca.total_achieved_amount < ${aggregateTarget} THEN 1
          ELSE 0
        END as targets_missed
      FROM current_achievement ca
    `

        // Get monthly breakdown - calculate each month with correct salesmen
        const monthlyQuery = `
      WITH months_in_range AS (
        SELECT DISTINCT
          TO_CHAR(trx_date_only, 'Mon') as month_name,
          EXTRACT(MONTH FROM trx_date_only) as month_num,
          EXTRACT(YEAR FROM trx_date_only) as year_num
        FROM new_flat_transactions
        WHERE ${dateFilter} ${userFilter}
          AND total_amount > 0
      ),
      monthly_calculations AS (
        SELECT
          mir.month_name,
          mir.month_num,
          mir.year_num,
          -- Get achievement only for salesmen who have targets for this specific month (TRANSACTION-LEVEL)
          (
            SELECT COALESCE(SUM(tt.transaction_total), 0)
            FROM (
              SELECT
                trx_code,
                salesman_code,
                SUM(total_amount) as transaction_total
              FROM new_flat_transactions nt
              WHERE EXTRACT(MONTH FROM nt.trx_date_only) = mir.month_num
                AND EXTRACT(YEAR FROM nt.trx_date_only) = mir.year_num
                AND nt.total_amount > 0
                AND nt.salesman_code IN (
                  SELECT DISTINCT salesmancode
                  FROM tblcommontarget
                  WHERE isactive = true
                    AND timeframe = 'M'
                    AND year = mir.year_num
                    AND month = mir.month_num
                    AND salesmancode IS NOT NULL
                )
              GROUP BY trx_code, salesman_code
            ) tt
          ) as achieved,
          -- Get targets for this specific month
          (
            SELECT COALESCE(SUM(t.amount), 0)
            FROM tblcommontarget t
            WHERE t.isactive = true
              AND t.timeframe = 'M'
              AND t.year = mir.year_num
              AND t.month = mir.month_num
              AND t.salesmancode IS NOT NULL
          ) as target
        FROM months_in_range mir
      )
      SELECT
        month_name as month,
        month_num,
        ROUND(target, 2) as target,
        ROUND(achieved, 2) as achieved,
        CASE
          WHEN target > 0 THEN ROUND((achieved / target) * 100, 1)
          ELSE 0
        END as achievement_percentage
      FROM monthly_calculations
      ORDER BY month_num
    `

        // Get individual salesman performance ONLY for targeted salesmen using correct data
        const performersQuery = `
      WITH transaction_performance AS (
        SELECT
          trx_code,
          salesman_code,
          salesman_name,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE ${dateFilter} ${userFilter}
          AND total_amount > 0
          AND salesman_code IN (${salesmenPlaceholders})
        GROUP BY trx_code, salesman_code, salesman_name
      ),
      salesman_performance AS (
        SELECT
          salesman_code,
          salesman_name,
          SUM(transaction_total) as total_achieved
        FROM transaction_performance
        GROUP BY salesman_code, salesman_name
      )
      SELECT
        sp.salesman_code as user_code,
        sp.salesman_name as user_name,
        -- Individual targets will be fetched separately
        0 as total_target,
        ROUND(sp.total_achieved, 2) as total_achieved,
        0 as achievement_percentage,
        'Active' as status
      FROM salesman_performance sp
      ORDER BY sp.total_achieved DESC
      LIMIT 10
    `

        // Get period breakdown ONLY for targeted salesmen using correct data
        const periodQuery = `
      WITH transaction_period AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE ${dateFilter} ${userFilter}
          AND total_amount > 0
          AND salesman_code IN (${salesmenPlaceholders})
        GROUP BY trx_code, salesman_code
      ),
      period_data AS (
        SELECT
          'Monthly' as period_type,
          COUNT(DISTINCT salesman_code) as count,
          SUM(transaction_total) as total_achieved,
          ${aggregateTarget} as total_target
        FROM transaction_period
      )
      SELECT
        period_type,
        count,
        ROUND(COALESCE(total_target, 0), 2) as total_target,
        ROUND(total_achieved, 2) as total_achieved,
        CASE
          WHEN total_target > 0 THEN ROUND((total_achieved / total_target) * 100, 1)
          ELSE 0
        END as avg_achievement
      FROM period_data
    `

        // Execute all queries - monthly query doesn't need parameters now
        const [summaryResult, monthlyResult, performersResult, periodResult] = await Promise.all([
          db.query(targetCalculationQuery, [targetedSalesmenCodes]),
          db.query(monthlyQuery), // No parameters needed - it finds salesmen per month dynamically
          db.query(performersQuery, targetedSalesmenCodes),
          db.query(periodQuery, targetedSalesmenCodes)
        ])
        return { summaryResult, monthlyResult, performersResult, periodResult }
      },
      [`targets-achievement-data-v4-fixed-real-values-${cacheKey}`],
      {
        revalidate: cacheDuration,
        tags: [`targets-${dateRange}`, 'targets-achievement-v3-transaction-level']
      }
    )

    const { summaryResult, monthlyResult, performersResult, periodResult } = await getCachedTargetData()

    const summary = summaryResult.rows[0] || {
      total_records: 0,
      total_target_amount: 0,
      total_achieved_amount: 0,
      avg_achievement_percentage: 0,
      targets_met: 0,
      targets_missed: 0
    }

    const monthlyData = monthlyResult.rows.map(row => ({
      month: row.month,
      month_num: parseInt(row.month_num || 0),
      target: parseFloat(row.target || 0),
      achieved: parseFloat(row.achieved || 0),
      achievementPercentage: parseFloat(row.achievement_percentage || 0)
    }))

    // Get individual targets for top performers
    const salesmanCodes = performersResult.rows.map(row => row.user_code)
    const individualTargets = await TargetService.getTargetsForSalesmen(salesmanCodes, dateRange, new Date())

    const topPerformers = performersResult.rows.map(row => {
      const userCode = row.user_code
      const totalAchieved = parseFloat(row.total_achieved || 0)
      const individualTarget = individualTargets.get(userCode) || 0

      // Use fallback if no real target found
      const finalTarget = individualTarget > 0 ? individualTarget : TargetService.calculateFallbackTarget(totalAchieved, 0.15)
      const achievementPercentage = finalTarget > 0 ? (totalAchieved / finalTarget) * 100 : 0

      return {
        userCode,
        userName: row.user_name || 'Unknown User',
        totalTarget: parseFloat(finalTarget.toFixed(2)),
        totalAchieved,
        achievementPercentage: parseFloat(achievementPercentage.toFixed(1)),
        status: row.status || 'Active'
      }
    })

    const periodBreakdown = periodResult.rows.map(row => ({
      periodType: row.period_type,
      count: parseInt(row.count || 0),
      totalTarget: parseFloat(row.total_target || 0),
      totalAchieved: parseFloat(row.total_achieved || 0),
      avgAchievement: parseFloat(row.avg_achievement || 0)
    }))

    // Create response with cache headers
    const response = NextResponse.json({
      success: true,
      data: {
        summary: {
          totalTargets: parseInt(summary.total_records || 0),
          totalTargetAmount: parseFloat(summary.total_target_amount || 0),
          totalAchievedAmount: parseFloat(summary.total_achieved_amount || 0),
          avgAchievementPercentage: parseFloat(summary.avg_achievement_percentage || 0),
          targetsMet: parseInt(summary.targets_met || 0),
          targetsMissed: parseInt(summary.targets_missed || 0)
        },
        monthlyData,
        topPerformers,
        periodBreakdown
      },
      dateRange,
      userId,
      timestamp: new Date().toISOString(),
      cached: true
    })

    // Set cache headers for browser caching
    response.headers.set('Cache-Control', `public, s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`)
    response.headers.set('X-Cache-Duration', cacheDuration.toString())

    return response

  } catch (error) {
    console.error('Targets achievement API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch targets achievement data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

