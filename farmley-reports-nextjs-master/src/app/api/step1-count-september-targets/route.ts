import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Step 1: Count ALL targets for September 2025 with different filters

    // Method 1: Basic count for September 2025
    const basicCountQuery = `
      SELECT COUNT(*) as basic_count
      FROM tblcommontarget
      WHERE year = 2025 AND month = 9
    `
    const basicCount = await db.query(basicCountQuery)

    // Method 2: Count only active targets
    const activeCountQuery = `
      SELECT COUNT(*) as active_count
      FROM tblcommontarget
      WHERE year = 2025 AND month = 9
        AND isactive = true
    `
    const activeCount = await db.query(activeCountQuery)

    // Method 3: Count only monthly timeframe targets
    const monthlyActiveCountQuery = `
      SELECT COUNT(*) as monthly_active_count
      FROM tblcommontarget
      WHERE year = 2025 AND month = 9
        AND isactive = true
        AND timeframe = 'M'
    `
    const monthlyActiveCount = await db.query(monthlyActiveCountQuery)

    // Method 4: Count with non-null salesmancode
    const validSalesmanCountQuery = `
      SELECT COUNT(*) as valid_salesman_count
      FROM tblcommontarget
      WHERE year = 2025 AND month = 9
        AND isactive = true
        AND timeframe = 'M'
        AND salesmancode IS NOT NULL
    `
    const validSalesmanCount = await db.query(validSalesmanCountQuery)

    // Method 5: Get actual list of salesmen with targets
    const salesmenListQuery = `
      SELECT
        salesmancode,
        amount,
        startdate,
        enddate,
        isactive,
        timeframe
      FROM tblcommontarget
      WHERE year = 2025 AND month = 9
        AND isactive = true
        AND timeframe = 'M'
        AND salesmancode IS NOT NULL
      ORDER BY salesmancode
    `
    const salesmenList = await db.query(salesmenListQuery)

    // Method 6: Check for any inactive or different timeframe targets
    const otherTargetsQuery = `
      SELECT
        isactive,
        timeframe,
        COUNT(*) as count
      FROM tblcommontarget
      WHERE year = 2025 AND month = 9
      GROUP BY isactive, timeframe
      ORDER BY isactive, timeframe
    `
    const otherTargets = await db.query(otherTargetsQuery)

    // Step 2: Calculate total target amount
    const totalTargetAmount = salesmenList.rows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0)

    return NextResponse.json({
      success: true,
      september_2025_target_analysis: {
        counting_methods: {
          basic_count: parseInt(basicCount.rows[0]?.basic_count || 0),
          active_only: parseInt(activeCount.rows[0]?.active_count || 0),
          monthly_active: parseInt(monthlyActiveCount.rows[0]?.monthly_active_count || 0),
          valid_salesman_count: parseInt(validSalesmanCount.rows[0]?.valid_salesman_count || 0)
        },
        breakdown_by_status: otherTargets.rows,
        actual_salesmen_with_targets: {
          count: salesmenList.rows.length,
          total_target_amount: totalTargetAmount,
          salesmen_codes: salesmenList.rows.map(r => r.salesmancode),
          sample_records: salesmenList.rows.slice(0, 5) // Show first 5 for verification
        },
        verification: {
          user_claimed: "30 salesmen",
          my_previous_claim: "21 salesmen",
          actual_count: salesmenList.rows.length,
          who_is_correct: salesmenList.rows.length === 30 ? "User is correct" :
                          salesmenList.rows.length === 21 ? "My previous claim was correct" :
                          `Neither - actual count is ${salesmenList.rows.length}`
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