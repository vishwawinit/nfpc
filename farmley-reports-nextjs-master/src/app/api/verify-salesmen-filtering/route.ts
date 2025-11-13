import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // 1. Get salesmen with September 2025 targets
    const targetedSalesmenQuery = `
      SELECT DISTINCT salesmancode
      FROM tblcommontarget
      WHERE year = 2025 AND month = 9
        AND isactive = true
        AND timeframe = 'M'
      ORDER BY salesmancode
    `
    const targetedSalesmen = await db.query(targetedSalesmenQuery)
    const salesmenWithTargets = targetedSalesmen.rows.map(r => r.salesmancode)

    // 2. All salesmen who have transactions in September
    const allTransactionSalesmenQuery = `
      SELECT DISTINCT salesman_code
      FROM new_flat_transactions
      WHERE month = 9 AND year = 2025
        AND total_amount > 0
        AND salesman_code IS NOT NULL
      ORDER BY salesman_code
    `
    const allTransactionSalesmen = await db.query(allTransactionSalesmenQuery)
    const allSalesmen = allTransactionSalesmen.rows.map(r => r.salesman_code)

    // 3. Sales from ONLY targeted salesmen (what API uses)
    const targetedSalesQuery = `
      WITH transaction_totals AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE month = 9 AND year = 2025
          AND total_amount > 0
          AND salesman_code = ANY($1)
        GROUP BY trx_code, salesman_code
      )
      SELECT
        COUNT(*) as unique_transactions,
        SUM(transaction_total) as total_sales
      FROM transaction_totals
    `
    const targetedSales = await db.query(targetedSalesQuery, [salesmenWithTargets])

    // 4. Sales from ALL salesmen (what database comparison shows)
    const allSalesQuery = `
      WITH transaction_totals AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE month = 9 AND year = 2025
          AND total_amount > 0
        GROUP BY trx_code, salesman_code
      )
      SELECT
        COUNT(*) as unique_transactions,
        SUM(transaction_total) as total_sales
      FROM transaction_totals
    `
    const allSales = await db.query(allSalesQuery)

    // 5. Sales from salesmen WITHOUT targets
    const nonTargetedSalesmenQuery = `
      WITH transaction_totals AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE month = 9 AND year = 2025
          AND total_amount > 0
          AND salesman_code NOT IN (${salesmenWithTargets.map((_, i) => `$${i + 1}`).join(', ')})
        GROUP BY trx_code, salesman_code
      )
      SELECT
        COUNT(*) as unique_transactions,
        SUM(transaction_total) as total_sales,
        COUNT(DISTINCT salesman_code) as unique_salesmen
      FROM transaction_totals
    `
    const nonTargetedSales = await db.query(nonTargetedSalesmenQuery, salesmenWithTargets)

    // 6. Calculate the difference
    const targetedAmount = parseFloat(targetedSales.rows[0]?.total_sales || 0)
    const allAmount = parseFloat(allSales.rows[0]?.total_sales || 0)
    const nonTargetedAmount = parseFloat(nonTargetedSales.rows[0]?.total_sales || 0)
    const exclusionRatio = targetedAmount > 0 ? (allAmount / targetedAmount).toFixed(1) : 0

    return NextResponse.json({
      success: true,
      salesmen_filtering_analysis: {
        targeted_salesmen: {
          count: salesmenWithTargets.length,
          codes: salesmenWithTargets,
          sales_data: targetedSales.rows[0]
        },
        all_transaction_salesmen: {
          count: allSalesmen.length,
          sales_data: allSales.rows[0]
        },
        non_targeted_salesmen: {
          data: nonTargetedSales.rows[0],
          excluded_amount: nonTargetedAmount
        },
        comparison: {
          api_shows: targetedAmount,
          database_total: allAmount,
          difference: allAmount - targetedAmount,
          ratio: `API shows only 1/${exclusionRatio} of total sales`,
          explanation: salesmenWithTargets.length < allSalesmen.length ?
            "API correctly filters to only salesmen with targets" :
            "No filtering difference - issue elsewhere"
        },
        conclusion: {
          is_filtering_the_issue: allAmount > targetedAmount * 2,
          recommendation: allAmount > targetedAmount * 2 ?
            "The API correctly excludes salesmen without targets - this explains the difference" :
            "Filtering is not the main issue - check other logic"
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