import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // 1. First, get a specific salesman with a September 2025 target
    const targetSalesmanQuery = `
      SELECT salesmancode, amount as target_amount, year, month, timeframe
      FROM tblcommontarget
      WHERE year = 2025 AND month = 9
        AND isactive = true
        AND timeframe = 'M'
      ORDER BY amount DESC
      LIMIT 1
    `
    const targetSalesman = await db.query(targetSalesmanQuery)

    if (targetSalesman.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No salesmen found with September 2025 targets"
      })
    }

    const selectedSalesman = targetSalesman.rows[0]
    const salesmanCode = selectedSalesman.salesmancode

    // 2. Check ALL transactions for this salesman in the database (to see date range)
    const allTransactionsQuery = `
      SELECT
        MIN(trx_date_only) as earliest_transaction,
        MAX(trx_date_only) as latest_transaction,
        COUNT(DISTINCT trx_date_only) as unique_dates,
        COUNT(*) as total_line_items,
        COUNT(DISTINCT trx_code) as unique_transactions,
        SUM(total_amount) as total_all_time_sales
      FROM new_flat_transactions
      WHERE salesman_code = $1
        AND total_amount > 0
    `
    const allTransactions = await db.query(allTransactionsQuery, [salesmanCode])

    // 3. Check ONLY September 2025 transactions for this salesman
    const septTransactionsQuery = `
      SELECT
        trx_date_only,
        COUNT(*) as line_items_on_date,
        COUNT(DISTINCT trx_code) as transactions_on_date,
        SUM(total_amount) as sales_on_date
      FROM new_flat_transactions
      WHERE salesman_code = $1
        AND month = 9 AND year = 2025
        AND total_amount > 0
      GROUP BY trx_date_only
      ORDER BY trx_date_only
    `
    const septTransactions = await db.query(septTransactionsQuery, [salesmanCode])

    // 4. Get the correct aggregated September sales (transaction-level)
    const septAggregatedQuery = `
      WITH transaction_totals AS (
        SELECT
          trx_code,
          trx_date_only,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE salesman_code = $1
          AND month = 9 AND year = 2025
          AND total_amount > 0
        GROUP BY trx_code, trx_date_only
      )
      SELECT
        COUNT(*) as unique_transactions,
        SUM(transaction_total) as correct_september_sales,
        MIN(trx_date_only) as first_sept_date,
        MAX(trx_date_only) as last_sept_date
      FROM transaction_totals
    `
    const septAggregated = await db.query(septAggregatedQuery, [salesmanCode])

    // 5. Calculate the correct achievement percentage
    const targetAmount = parseFloat(selectedSalesman.target_amount)
    const actualSeptSales = parseFloat(septAggregated.rows[0]?.correct_september_sales || 0)
    const correctPercentage = targetAmount > 0 ? (actualSeptSales / targetAmount * 100).toFixed(2) : 0

    // 6. Check what the current API calculation returns for comparison
    const currentAPIQuery = `
      WITH transaction_totals AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE month = 9 AND year = 2025
          AND total_amount > 0
          AND salesman_code = $1
        GROUP BY trx_code, salesman_code
      ),
      salesman_sales AS (
        SELECT
          salesman_code,
          SUM(transaction_total) as total_sales
        FROM transaction_totals
        GROUP BY salesman_code
      )
      SELECT total_sales
      FROM salesman_sales
      WHERE salesman_code = $1
    `
    const currentAPI = await db.query(currentAPIQuery, [salesmanCode])

    return NextResponse.json({
      success: true,
      direct_database_analysis: {
        selected_salesman: {
          code: salesmanCode,
          september_target: targetAmount,
          target_details: selectedSalesman
        },
        all_time_data: allTransactions.rows[0],
        september_daily_breakdown: septTransactions.rows,
        september_aggregated: septAggregated.rows[0],
        calculations: {
          target_amount: targetAmount,
          actual_september_sales: actualSeptSales,
          current_api_calculation: parseFloat(currentAPI.rows[0]?.total_sales || 0),
          correct_achievement_percentage: correctPercentage,
          days_of_september_data: septTransactions.rows.length
        },
        verification: {
          date_filtering_working: septAggregated.rows[0]?.first_sept_date && septAggregated.rows[0]?.last_sept_date,
          september_date_range: `${septAggregated.rows[0]?.first_sept_date} to ${septAggregated.rows[0]?.last_sept_date}`,
          is_percentage_realistic: parseFloat(correctPercentage) <= 50 ? "YES - Under 50%" : "NO - Too high for partial month"
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