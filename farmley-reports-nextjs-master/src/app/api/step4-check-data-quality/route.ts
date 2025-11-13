import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Check August data quality issues

    // Step 1: Check if targets are unrealistically low
    const augustTargetAnalysisQuery = `
      SELECT
        salesmancode,
        amount as target_amount,
        CASE
          WHEN amount < 10000 THEN 'Very Low (<10K)'
          WHEN amount < 50000 THEN 'Low (10K-50K)'
          WHEN amount < 200000 THEN 'Normal (50K-200K)'
          WHEN amount < 500000 THEN 'High (200K-500K)'
          ELSE 'Very High (>500K)'
        END as target_category
      FROM tblcommontarget
      WHERE year = 2025 AND month = 8
        AND isactive = true
        AND timeframe = 'M'
        AND salesmancode IS NOT NULL
      ORDER BY amount
    `
    const augustTargetAnalysis = await db.query(augustTargetAnalysisQuery)

    // Step 2: Check for massive transactions in August
    const augustLargeTransactionsQuery = `
      WITH transaction_totals AS (
        SELECT
          trx_code,
          salesman_code,
          customer_name,
          trx_date_only,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE month = 8 AND year = 2025
          AND total_amount > 0
        GROUP BY trx_code, salesman_code, customer_name, trx_date_only
      )
      SELECT
        trx_code,
        salesman_code,
        customer_name,
        trx_date_only,
        transaction_total,
        CASE
          WHEN transaction_total > 1000000 THEN 'Massive (>1M)'
          WHEN transaction_total > 500000 THEN 'Very Large (>500K)'
          WHEN transaction_total > 100000 THEN 'Large (>100K)'
          WHEN transaction_total > 50000 THEN 'Medium (>50K)'
          ELSE 'Normal'
        END as size_category
      FROM transaction_totals
      WHERE transaction_total > 50000
      ORDER BY transaction_total DESC
      LIMIT 20
    `
    const augustLargeTransactions = await db.query(augustLargeTransactionsQuery)

    // Step 3: Check average transaction size vs target amounts
    const salesmenPerformanceQuery = `
      WITH salesman_targets AS (
        SELECT salesmancode, amount as target_amount
        FROM tblcommontarget
        WHERE year = 2025 AND month = 8
          AND isactive = true
          AND timeframe = 'M'
          AND salesmancode IS NOT NULL
      ),
      salesman_sales AS (
        SELECT
          salesman_code,
          COUNT(DISTINCT trx_code) as transaction_count,
          SUM(total_amount) as total_sales,
          AVG(total_amount) as avg_line_amount,
          MAX(total_amount) as max_line_amount
        FROM new_flat_transactions
        WHERE month = 8 AND year = 2025
          AND total_amount > 0
        GROUP BY salesman_code
      )
      SELECT
        st.salesmancode,
        st.target_amount,
        COALESCE(ss.total_sales, 0) as actual_sales,
        COALESCE(ss.transaction_count, 0) as transaction_count,
        COALESCE(ss.avg_line_amount, 0) as avg_line_amount,
        COALESCE(ss.max_line_amount, 0) as max_line_amount,
        CASE
          WHEN st.target_amount > 0 THEN ROUND((COALESCE(ss.total_sales, 0) / st.target_amount) * 100, 1)
          ELSE 0
        END as achievement_percentage
      FROM salesman_targets st
      LEFT JOIN salesman_sales ss ON st.salesmancode = ss.salesman_code
      ORDER BY achievement_percentage DESC
      LIMIT 10
    `
    const salesmenPerformance = await db.query(salesmenPerformanceQuery)

    // Step 4: Check for potential duplicate transactions
    const duplicateCheckQuery = `
      SELECT
        trx_code,
        COUNT(DISTINCT trx_date_only) as different_dates,
        COUNT(DISTINCT salesman_code) as different_salesmen,
        SUM(total_amount) as total_amount_all_lines
      FROM new_flat_transactions
      WHERE month = 8 AND year = 2025
        AND total_amount > 0
      GROUP BY trx_code
      HAVING COUNT(DISTINCT trx_date_only) > 1 OR COUNT(DISTINCT salesman_code) > 1
      ORDER BY total_amount_all_lines DESC
      LIMIT 10
    `
    const duplicateCheck = await db.query(duplicateCheckQuery)

    // Step 5: Summary analysis
    const totalTargets = augustTargetAnalysis.rows.reduce((sum, row) => sum + parseFloat(row.target_amount), 0)
    const totalSales = 71533655.6605 // From previous step
    const avgTargetAmount = totalTargets / augustTargetAnalysis.rows.length
    const avgSalesPerSalesman = totalSales / augustTargetAnalysis.rows.length

    return NextResponse.json({
      success: true,
      august_data_quality_analysis: {
        target_analysis: {
          total_salesmen: augustTargetAnalysis.rows.length,
          total_target_amount: totalTargets,
          average_target_per_salesman: avgTargetAmount,
          target_distribution: augustTargetAnalysis.rows.reduce((acc, row) => {
            acc[row.target_category] = (acc[row.target_category] || 0) + 1
            return acc
          }, {}),
          sample_targets: augustTargetAnalysis.rows.slice(0, 5)
        },
        large_transactions: {
          count_over_50k: augustLargeTransactions.rows.length,
          largest_transactions: augustLargeTransactions.rows.slice(0, 10),
          size_distribution: augustLargeTransactions.rows.reduce((acc, row) => {
            acc[row.size_category] = (acc[row.size_category] || 0) + 1
            return acc
          }, {})
        },
        top_performers: salesmenPerformance.rows,
        potential_duplicates: {
          count: duplicateCheck.rows.length,
          suspicious_transactions: duplicateCheck.rows
        },
        summary_analysis: {
          average_target_per_salesman: avgTargetAmount,
          average_sales_per_salesman: avgSalesPerSalesman,
          ratio_sales_to_target: (avgSalesPerSalesman / avgTargetAmount).toFixed(1) + "x",
          data_quality_issues: {
            targets_too_low: avgTargetAmount < 50000 ? "YES - Targets under 50K seem low" : "NO",
            massive_transactions: augustLargeTransactions.rows.filter(t => parseFloat(t.transaction_total) > 1000000).length > 0 ? "YES - Transactions over 1M found" : "NO",
            potential_duplicates: duplicateCheck.rows.length > 0 ? "YES - Found transactions on multiple dates/salesmen" : "NO"
          },
          conclusion: avgTargetAmount < 50000 && augustLargeTransactions.rows.length > 5 ?
            "LOW TARGETS + LARGE TRANSACTIONS = Inflated percentages" :
            avgTargetAmount < 50000 ? "Targets may be too low" :
            augustLargeTransactions.rows.length > 10 ? "Large transactions skewing results" :
            "Data seems normal - calculation may be correct"
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