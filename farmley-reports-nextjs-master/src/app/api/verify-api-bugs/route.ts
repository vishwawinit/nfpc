import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Test 1: Current API target selection logic
    const currentTargetLogicQuery = `
      SELECT DISTINCT salesmancode
      FROM tblcommontarget
      WHERE isactive = true
        AND timeframe = 'M'
        AND year = 2025
        AND month = 9
        AND salesmancode IS NOT NULL
    `
    const currentTargetLogic = await db.query(currentTargetLogicQuery)

    // Test 2: CORRECT target selection logic (using date ranges)
    const correctTargetLogicQuery = `
      SELECT DISTINCT salesmancode
      FROM tblcommontarget
      WHERE isactive = true
        AND timeframe = 'M'
        AND CURRENT_DATE BETWEEN startdate AND enddate
        AND salesmancode IS NOT NULL
    `
    const correctTargetLogic = await db.query(correctTargetLogicQuery)

    // Test 3: Current API transaction filtering for thisMonth
    const currentTransactionFilterQuery = `
      SELECT
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_sales,
        MIN(trx_date_only) as first_date,
        MAX(trx_date_only) as last_date
      FROM new_flat_transactions
      WHERE DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', CURRENT_DATE)
        AND total_amount > 0
    `
    const currentTransactionFilter = await db.query(currentTransactionFilterQuery)

    // Test 4: CORRECT transaction filtering (using actual target period)
    const correctTransactionFilterQuery = `
      WITH target_period AS (
        SELECT MIN(startdate) as period_start, MAX(enddate) as period_end
        FROM tblcommontarget
        WHERE isactive = true
          AND timeframe = 'M'
          AND CURRENT_DATE BETWEEN startdate AND enddate
      )
      SELECT
        COUNT(*) as transaction_count,
        SUM(total_amount) as total_sales,
        MIN(trx_date_only) as first_date,
        MAX(trx_date_only) as last_date
      FROM new_flat_transactions, target_period
      WHERE trx_date_only BETWEEN target_period.period_start AND target_period.period_end
        AND total_amount > 0
    `
    const correctTransactionFilter = await db.query(correctTransactionFilterQuery)

    // Test 5: Check if August 31st data is being excluded by current API
    const august31DataQuery = `
      SELECT
        COUNT(*) as august31_transactions,
        SUM(total_amount) as august31_sales
      FROM new_flat_transactions
      WHERE trx_date_only = '2025-08-31'::date
        AND total_amount > 0
    `
    const august31Data = await db.query(august31DataQuery)

    // Test 6: Check current date
    const currentDateQuery = `
      SELECT
        CURRENT_DATE as today,
        DATE_TRUNC('month', CURRENT_DATE) as current_month_start
    `
    const currentDate = await db.query(currentDateQuery)

    // Calculate the impact
    const currentAPITotalSales = parseFloat(currentTransactionFilter.rows[0]?.total_sales || 0)
    const correctAPITotalSales = parseFloat(correctTransactionFilter.rows[0]?.total_sales || 0)
    const august31Sales = parseFloat(august31Data.rows[0]?.august31_sales || 0)
    const missingSales = correctAPITotalSales - currentAPITotalSales

    return NextResponse.json({
      success: true,
      api_bug_verification: {
        current_date_info: currentDate.rows[0],
        target_selection_comparison: {
          current_api_finds: `${currentTargetLogic.rows.length} salesmen using year/month filter`,
          correct_logic_finds: `${correctTargetLogic.rows.length} salesmen using date range filter`,
          are_same: currentTargetLogic.rows.length === correctTargetLogic.rows.length ? "YES" : "NO - Different results"
        },
        transaction_filtering_comparison: {
          current_api: {
            filter: "DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', CURRENT_DATE)",
            results: currentTransactionFilter.rows[0]
          },
          correct_logic: {
            filter: "trx_date_only BETWEEN startdate AND enddate",
            results: correctTransactionFilter.rows[0]
          }
        },
        august_31_data_loss: {
          transactions_lost: parseInt(august31Data.rows[0]?.august31_transactions || 0),
          sales_lost: august31Sales,
          is_significant: august31Sales > 100000 ? "YES - Major data loss" : "NO - Minor impact"
        },
        impact_summary: {
          current_api_total: currentAPITotalSales,
          correct_total: correctAPITotalSales,
          missing_sales: missingSales,
          percentage_underreported: correctAPITotalSales > 0 ?
            ((missingSales / correctAPITotalSales) * 100).toFixed(1) + "%" : "0%"
        },
        bugs_confirmed: {
          bug_1_target_selection: currentTargetLogic.rows.length !== correctTargetLogic.rows.length,
          bug_2_transaction_filtering: Math.abs(missingSales) > 1000,
          requires_fix: Math.abs(missingSales) > 1000 || currentTargetLogic.rows.length !== correctTargetLogic.rows.length
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