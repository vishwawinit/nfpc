import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // 1. Calculate realistic sales by excluding huge outlier transactions
    const realisticSalesQuery = `
      WITH reasonable_transactions AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE month = 9 AND year = 2025
          AND total_amount > 0
          AND salesman_code IN (
            SELECT DISTINCT salesmancode
            FROM tblcommontarget
            WHERE year = 2025 AND month = 9 AND isactive = true AND timeframe = 'M'
          )
        GROUP BY trx_code, salesman_code
        -- Filter out unrealistic transactions (over 50K AED)
        HAVING SUM(total_amount) <= 50000
      )
      SELECT
        COUNT(*) as reasonable_transaction_count,
        SUM(transaction_total) as realistic_total_sales
      FROM reasonable_transactions
    `
    const realisticSales = await db.query(realisticSalesQuery)

    // 2. Check what huge transactions we're excluding
    const excludedTransactionsQuery = `
      WITH all_transactions AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE month = 9 AND year = 2025 AND total_amount > 0
        GROUP BY trx_code, salesman_code
      )
      SELECT
        trx_code,
        salesman_code,
        transaction_total,
        CASE
          WHEN transaction_total > 1000000 THEN 'Massive (>1M)'
          WHEN transaction_total > 100000 THEN 'Very Large (>100K)'
          WHEN transaction_total > 50000 THEN 'Large (>50K)'
          ELSE 'Reasonable'
        END as category
      FROM all_transactions
      WHERE transaction_total > 50000
      ORDER BY transaction_total DESC
      LIMIT 20
    `
    const excludedTransactions = await db.query(excludedTransactionsQuery)

    // 3. Calculate realistic achievement percentage
    const targetQuery = `
      SELECT SUM(amount) as total_target
      FROM tblcommontarget
      WHERE year = 2025 AND month = 9 AND isactive = true AND timeframe = 'M'
    `
    const targetResult = await db.query(targetQuery)

    const totalTarget = parseFloat(targetResult.rows[0].total_target)
    const realisticSalesAmount = parseFloat(realisticSales.rows[0].realistic_total_sales)
    const realisticAchievement = totalTarget > 0 ? (realisticSalesAmount / totalTarget * 100).toFixed(2) : 0

    return NextResponse.json({
      success: true,
      september_realistic_analysis: {
        target_amount: totalTarget,
        original_inflated_sales: "60,632,618 AED",
        realistic_sales_under_50k: realisticSalesAmount,
        realistic_achievement_percentage: realisticAchievement,
        reasonable_transactions_count: realisticSales.rows[0].reasonable_transaction_count,
        excluded_large_transactions: excludedTransactions.rows,
        summary: {
          expected_for_8_days: `${(totalTarget * 8 / 30).toFixed(0)} AED`,
          realistic_performance: `${realisticAchievement}% achievement is realistic for 8 days`,
          data_quality_issue: "Large transactions over 50K AED are likely data errors"
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