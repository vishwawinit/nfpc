import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Debug lastMonth (August) which shows 1557% - this should be impossible

    // Step 1: Get August targets (what API thinks)
    const augustTargetsQuery = `
      SELECT
        COUNT(*) as target_count,
        SUM(amount) as total_target_amount,
        MIN(startdate) as period_start,
        MAX(enddate) as period_end
      FROM tblcommontarget
      WHERE year = 2025 AND month = 8
        AND isactive = true
        AND timeframe = 'M'
        AND salesmancode IS NOT NULL
    `
    const augustTargets = await db.query(augustTargetsQuery)

    // Step 2: Get August salesmen codes
    const augustSalesmenQuery = `
      SELECT salesmancode
      FROM tblcommontarget
      WHERE year = 2025 AND month = 8
        AND isactive = true
        AND timeframe = 'M'
        AND salesmancode IS NOT NULL
    `
    const augustSalesmen = await db.query(augustSalesmenQuery)
    const augustSalesmenCodes = augustSalesmen.rows.map(r => r.salesmancode)

    // Step 3: Check what date filter lastMonth uses
    const lastMonthDateQuery = `
      SELECT
        DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') as last_month_start,
        DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day' as last_month_end,
        CURRENT_DATE as today
    `
    const lastMonthDate = await db.query(lastMonthDateQuery)

    // Step 4: Get sales using API's date filter (what API calculates)
    const apiSalesQuery = `
      WITH transaction_totals AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          AND total_amount > 0
          AND salesman_code = ANY($1)
        GROUP BY trx_code, salesman_code
      )
      SELECT
        COUNT(*) as unique_transactions,
        SUM(transaction_total) as total_sales_api_method,
        COUNT(DISTINCT tt.salesman_code) as active_salesmen,
        MIN(nft.trx_date_only) as first_date,
        MAX(nft.trx_date_only) as last_date
      FROM new_flat_transactions nft
      JOIN transaction_totals tt ON nft.trx_code = tt.trx_code AND nft.salesman_code = tt.salesman_code
      WHERE DATE_TRUNC('month', nft.trx_date_only) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    `
    const apiSales = await db.query(apiSalesQuery, [augustSalesmenCodes])

    // Step 5: Get sales using month/year filter (alternative method)
    const monthYearSalesQuery = `
      WITH transaction_totals AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE month = 8 AND year = 2025
          AND total_amount > 0
          AND salesman_code = ANY($1)
        GROUP BY trx_code, salesman_code
      )
      SELECT
        COUNT(*) as unique_transactions,
        SUM(transaction_total) as total_sales_month_year,
        COUNT(DISTINCT salesman_code) as active_salesmen
      FROM transaction_totals
    `
    const monthYearSales = await db.query(monthYearSalesQuery, [augustSalesmenCodes])

    // Step 6: Get ALL sales for August (including non-targeted salesmen)
    const allAugustSalesQuery = `
      WITH transaction_totals AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE month = 8 AND year = 2025
          AND total_amount > 0
        GROUP BY trx_code, salesman_code
      )
      SELECT
        COUNT(*) as unique_transactions,
        SUM(transaction_total) as total_sales_all_salesmen,
        COUNT(DISTINCT salesman_code) as all_salesmen_count
      FROM transaction_totals
    `
    const allAugustSales = await db.query(allAugustSalesQuery)

    // Calculate percentages
    const targetAmount = parseFloat(augustTargets.rows[0]?.total_target_amount || 0)
    const apiSalesAmount = parseFloat(apiSales.rows[0]?.total_sales_api_method || 0)
    const monthYearSalesAmount = parseFloat(monthYearSales.rows[0]?.total_sales_month_year || 0)
    const allSalesAmount = parseFloat(allAugustSales.rows[0]?.total_sales_all_salesmen || 0)

    const apiPercentage = targetAmount > 0 ? (apiSalesAmount / targetAmount * 100).toFixed(1) : 0
    const monthYearPercentage = targetAmount > 0 ? (monthYearSalesAmount / targetAmount * 100).toFixed(1) : 0
    const allSalesPercentage = targetAmount > 0 ? (allSalesAmount / targetAmount * 100).toFixed(1) : 0

    return NextResponse.json({
      success: true,
      august_calculation_debug: {
        august_targets_info: augustTargets.rows[0],
        salesmen_with_targets: {
          count: augustSalesmenCodes.length,
          codes: augustSalesmenCodes.slice(0, 10) // Show first 10
        },
        date_filter_info: lastMonthDate.rows[0],
        sales_calculations: {
          api_method: {
            filter: "DATE_TRUNC('month', trx_date_only) = lastMonth AND targeted_salesmen",
            total_sales: apiSalesAmount,
            achievement_percentage: parseFloat(apiPercentage),
            details: apiSales.rows[0]
          },
          month_year_method: {
            filter: "month = 8 AND year = 2025 AND targeted_salesmen",
            total_sales: monthYearSalesAmount,
            achievement_percentage: parseFloat(monthYearPercentage),
            details: monthYearSales.rows[0]
          },
          all_salesmen_method: {
            filter: "month = 8 AND year = 2025 AND ALL_salesmen",
            total_sales: allSalesAmount,
            achievement_percentage: parseFloat(allSalesPercentage),
            details: allAugustSales.rows[0]
          }
        },
        bug_analysis: {
          api_reports: "1556.8%",
          manual_calculation_targeted: `${monthYearPercentage}%`,
          manual_calculation_all: `${allSalesPercentage}%`,
          which_matches_api: apiSalesAmount === 71533655.6605 ? "API method matches" :
                            monthYearSalesAmount === 71533655.6605 ? "Month/year method matches" :
                            allSalesAmount === 71533655.6605 ? "All salesmen method matches" :
                            "None match - calculation error",
          potential_bug: parseFloat(apiPercentage) > 200 ? "YES - Over 200% is suspicious" : "NO - Seems reasonable"
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