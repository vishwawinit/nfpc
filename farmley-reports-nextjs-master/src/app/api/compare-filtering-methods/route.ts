import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Method 1: Using month/year columns (business logic)
    const businessLogicQuery = `
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
        SUM(transaction_total) as total_sales,
        MIN(trx_date_only) as first_date,
        MAX(trx_date_only) as last_date,
        COUNT(DISTINCT DATE_TRUNC('day', trx_date_only)) as unique_days
      FROM new_flat_transactions nft
      JOIN transaction_totals tt ON nft.trx_code = tt.trx_code AND nft.salesman_code = tt.salesman_code
      WHERE month = 9 AND year = 2025
    `
    const businessLogic = await db.query(businessLogicQuery)

    // Method 2: Using DATE_TRUNC on trx_date_only (calendar logic)
    const calendarLogicQuery = `
      WITH transaction_totals AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', '2025-09-01'::date)
          AND total_amount > 0
        GROUP BY trx_code, salesman_code
      )
      SELECT
        COUNT(*) as unique_transactions,
        SUM(transaction_total) as total_sales,
        MIN(trx_date_only) as first_date,
        MAX(trx_date_only) as last_date,
        COUNT(DISTINCT DATE_TRUNC('day', trx_date_only)) as unique_days
      FROM new_flat_transactions nft
      JOIN transaction_totals tt ON nft.trx_code = tt.trx_code AND nft.salesman_code = tt.salesman_code
      WHERE DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', '2025-09-01'::date)
    `
    const calendarLogic = await db.query(calendarLogicQuery)

    // Method 3: What the current API actually uses (DATE_TRUNC with CURRENT_DATE)
    const currentAPIQuery = `
      WITH transaction_totals AS (
        SELECT
          trx_code,
          salesman_code,
          SUM(total_amount) as transaction_total
        FROM new_flat_transactions
        WHERE DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', CURRENT_DATE)
          AND total_amount > 0
        GROUP BY trx_code, salesman_code
      )
      SELECT
        COUNT(*) as unique_transactions,
        SUM(transaction_total) as total_sales,
        MIN(trx_date_only) as first_date,
        MAX(trx_date_only) as last_date,
        COUNT(DISTINCT DATE_TRUNC('day', trx_date_only)) as unique_days
      FROM new_flat_transactions nft
      JOIN transaction_totals tt ON nft.trx_code = tt.trx_code AND nft.salesman_code = tt.salesman_code
      WHERE DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', CURRENT_DATE)
    `
    const currentAPI = await db.query(currentAPIQuery)

    // Check what CURRENT_DATE resolves to
    const currentDateQuery = `
      SELECT
        CURRENT_DATE as today,
        DATE_TRUNC('month', CURRENT_DATE) as current_month_start,
        TO_CHAR(CURRENT_DATE, 'YYYY-MM') as current_month_str
    `
    const currentDate = await db.query(currentDateQuery)

    // Check August 31 specifically
    const aug31Query = `
      SELECT
        trx_date_only,
        month,
        year,
        COUNT(*) as record_count,
        SUM(total_amount) as total_sales
      FROM new_flat_transactions
      WHERE trx_date_only = '2025-08-31'::date
        AND total_amount > 0
      GROUP BY trx_date_only, month, year
    `
    const aug31 = await db.query(aug31Query)

    return NextResponse.json({
      success: true,
      filtering_comparison: {
        current_date_info: currentDate.rows[0],
        method_1_business_logic: {
          description: "Using month=9 AND year=2025 (includes Aug 31)",
          filter: "month = 9 AND year = 2025",
          results: businessLogic.rows[0]
        },
        method_2_calendar_logic: {
          description: "Using DATE_TRUNC on September 2025",
          filter: "DATE_TRUNC('month', trx_date_only) = '2025-09-01'",
          results: calendarLogic.rows[0]
        },
        method_3_current_api: {
          description: "Current API using CURRENT_DATE",
          filter: "DATE_TRUNC('month', trx_date_only) = DATE_TRUNC('month', CURRENT_DATE)",
          results: currentAPI.rows[0]
        },
        august_31_analysis: aug31.rows[0],
        recommendation: {
          issue: "API uses calendar filtering but business data uses business month logic",
          current_behavior: "API excludes August 31st data",
          business_expectation: "September should include August 31st",
          solution: "Use month/year columns instead of DATE_TRUNC for consistency"
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