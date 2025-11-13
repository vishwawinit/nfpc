import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // 1. Check what tables exist
    const tablesQuery = `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `
    const tablesResult = await db.query(tablesQuery)
    console.log('Available tables:', tablesResult.rows.map(r => r.tablename))

    // 2. Check all columns in new_flat_transactions
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_transactions'
      ORDER BY ordinal_position
    `
    const columnsResult = await db.query(columnsQuery)
    console.log('Columns in new_flat_transactions:', columnsResult.rows)

    // 3. Check actual route_code values and their patterns
    const routeCodesQuery = `
      SELECT DISTINCT route_code
      FROM new_flat_transactions
      WHERE route_code IS NOT NULL AND route_code != ''
      ORDER BY route_code
      LIMIT 50
    `
    const routeCodesResult = await db.query(routeCodesQuery)
    console.log('Actual route codes:', routeCodesResult.rows)

    // 4. Sample data to understand structure
    const sampleDataQuery = `
      SELECT *
      FROM new_flat_transactions
      WHERE route_code IS NOT NULL AND route_code != ''
      LIMIT 5
    `
    const sampleResult = await db.query(sampleDataQuery)
    console.log('Sample data:', sampleResult.rows)

    // 5. Check if there are any geographic columns
    const geoColumnsQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'new_flat_transactions'
        AND (column_name ILIKE '%region%'
             OR column_name ILIKE '%area%'
             OR column_name ILIKE '%territory%'
             OR column_name ILIKE '%zone%'
             OR column_name ILIKE '%location%'
             OR column_name ILIKE '%city%'
             OR column_name ILIKE '%state%')
      ORDER BY column_name
    `
    const geoResult = await db.query(geoColumnsQuery)
    console.log('Geographic columns:', geoResult.rows)

    // 6. Route code statistics
    const routeStatsQuery = `
      SELECT
        LEFT(route_code, 1) as prefix,
        COUNT(DISTINCT route_code) as unique_routes,
        COUNT(*) as total_transactions,
        SUM(total_amount) as total_sales,
        MIN(route_code) as first_route,
        MAX(route_code) as last_route
      FROM new_flat_transactions
      WHERE route_code IS NOT NULL AND route_code != ''
      GROUP BY LEFT(route_code, 1)
      ORDER BY COUNT(DISTINCT route_code) DESC
    `
    const routeStatsResult = await db.query(routeStatsQuery)
    console.log('Route statistics by prefix:', routeStatsResult.rows)

    // 7. Check customer table structure if it exists
    let customerTableInfo = { exists: false, columns: [], sample: [], city_data: [] }
    try {
      const customerColumnsQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'new_flat_customer_master'
        ORDER BY ordinal_position
      `
      const customerColumnsResult = await db.query(customerColumnsQuery)

      if (customerColumnsResult.rows.length > 0) {
        customerTableInfo.exists = true
        customerTableInfo.columns = customerColumnsResult.rows

        const customerSampleQuery = `
          SELECT *
          FROM new_flat_customer_master
          LIMIT 5
        `
        const customerSampleResult = await db.query(customerSampleQuery)
        customerTableInfo.sample = customerSampleResult.rows

        // Check city data distribution
        const cityDataQuery = `
          SELECT
            city,
            COUNT(*) as customer_count
          FROM new_flat_customer_master
          WHERE city IS NOT NULL
          GROUP BY city
          ORDER BY customer_count DESC
          LIMIT 20
        `
        const cityDataResult = await db.query(cityDataQuery)
        customerTableInfo.city_data = cityDataResult.rows
      }
    } catch (e) {
      console.log('Customer table error:', e)
    }

    // 8. Check visits table structure
    let visitsTableInfo = { exists: false, columns: [], sample: [] }
    try {
      const visitsColumnsQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'new_flat_customer_visits'
        ORDER BY ordinal_position
      `
      const visitsColumnsResult = await db.query(visitsColumnsQuery)

      if (visitsColumnsResult.rows.length > 0) {
        visitsTableInfo.exists = true
        visitsTableInfo.columns = visitsColumnsResult.rows

        const visitsSampleQuery = `
          SELECT *
          FROM new_flat_customer_visits
          LIMIT 3
        `
        const visitsSampleResult = await db.query(visitsSampleQuery)
        visitsTableInfo.sample = visitsSampleResult.rows
      }
    } catch (e) {
      console.log('Visits table does not exist or has different name')
    }

    // 9. Check new_flat_category_performance table structure
    let categoryPerformanceInfo = { exists: false, columns: [], sample: [] }
    try {
      const categoryColumnsQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'new_flat_category_performance'
        ORDER BY ordinal_position
      `
      const categoryColumnsResult = await db.query(categoryColumnsQuery)

      if (categoryColumnsResult.rows.length > 0) {
        categoryPerformanceInfo.exists = true
        categoryPerformanceInfo.columns = categoryColumnsResult.rows

        const categorySampleQuery = `
          SELECT *
          FROM new_flat_category_performance
          LIMIT 5
        `
        const categorySampleResult = await db.query(categorySampleQuery)
        categoryPerformanceInfo.sample = categorySampleResult.rows
      }
    } catch (e) {
      console.log('Category performance table error:', e)
    }

    // 10. Check for any table that might contain city data
    let cityDataSearch = { tables_with_city_columns: [], customer_tables: [] }
    try {
      // Search for any table with city-like columns
      const cityTablesQuery = `
        SELECT DISTINCT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (column_name ILIKE '%city%'
               OR column_name ILIKE '%region%'
               OR column_name ILIKE '%area%'
               OR column_name ILIKE '%location%')
        ORDER BY table_name, column_name
      `
      const cityTablesResult = await db.query(cityTablesQuery)
      cityDataSearch.tables_with_city_columns = cityTablesResult.rows

      // Search for any customer-related tables
      const customerTablesQuery = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name ILIKE '%customer%'
        ORDER BY table_name
      `
      const customerTablesResult = await db.query(customerTablesQuery)
      cityDataSearch.customer_tables = customerTablesResult.rows
    } catch (e) {
      console.log('Error searching for city/customer tables:', e)
    }

    // 11. Check for duplicate transactions in September 2025
    let duplicateCheck = { total_records: 0, unique_transactions: 0, potential_duplicates: 0 }
    try {
      const duplicateQuery = `
        SELECT
          COUNT(*) as total_records,
          COUNT(DISTINCT transaction_id) as unique_transactions,
          COUNT(*) - COUNT(DISTINCT transaction_id) as potential_duplicates,
          -- Also check for same trx_code, salesman, customer, product, amount duplicates
          (SELECT COUNT(*)
           FROM (
             SELECT trx_code, salesman_code, customer_code, product_code, total_amount, COUNT(*)
             FROM new_flat_transactions
             WHERE EXTRACT(MONTH FROM trx_date_only) = 9
               AND EXTRACT(YEAR FROM trx_date_only) = 2025
             GROUP BY trx_code, salesman_code, customer_code, product_code, total_amount
             HAVING COUNT(*) > 1
           ) dups
          ) as business_logic_duplicates
        FROM new_flat_transactions
        WHERE EXTRACT(MONTH FROM trx_date_only) = 9
          AND EXTRACT(YEAR FROM trx_date_only) = 2025
      `
      const duplicateResult = await db.query(duplicateQuery)
      if (duplicateResult.rows.length > 0) {
        duplicateCheck = duplicateResult.rows[0]
      }
    } catch (e) {
      console.log('Duplicate check error:', e)
    }

    // 12. More detailed duplicate and data analysis
    let detailedAnalysis = {
      thisMonth: {},
      lastQuarter: {},
      duplicateTypes: {},
      transactionStructure: {}
    }

    try {
      // Check thisMonth detailed breakdown
      const thisMonthQuery = `
        WITH raw_data AS (
          SELECT COUNT(*) as raw_count, SUM(total_amount) as raw_amount
          FROM new_flat_transactions
          WHERE EXTRACT(MONTH FROM trx_date_only) = 9 AND EXTRACT(YEAR FROM trx_date_only) = 2025
        ),
        dedup_transactions AS (
          SELECT COUNT(*) as dedup_count, SUM(total_amount) as dedup_amount
          FROM (
            SELECT DISTINCT trx_code, salesman_code, customer_code, product_code, total_amount
            FROM new_flat_transactions
            WHERE EXTRACT(MONTH FROM trx_date_only) = 9 AND EXTRACT(YEAR FROM trx_date_only) = 2025
          ) deduped
        ),
        unique_transactions AS (
          SELECT COUNT(DISTINCT trx_code) as unique_trx_codes
          FROM new_flat_transactions
          WHERE EXTRACT(MONTH FROM trx_date_only) = 9 AND EXTRACT(YEAR FROM trx_date_only) = 2025
        )
        SELECT rd.*, dd.*, ut.*
        FROM raw_data rd, dedup_transactions dd, unique_transactions ut
      `

      // Check last quarter date range
      const lastQuarterQuery = `
        WITH quarter_check AS (
          SELECT
            EXTRACT(QUARTER FROM CURRENT_DATE) as current_q,
            EXTRACT(YEAR FROM CURRENT_DATE) as current_year,
            CASE
              WHEN EXTRACT(QUARTER FROM CURRENT_DATE) = 1 THEN 4
              ELSE EXTRACT(QUARTER FROM CURRENT_DATE) - 1
            END as last_q,
            CASE
              WHEN EXTRACT(QUARTER FROM CURRENT_DATE) = 1 THEN EXTRACT(YEAR FROM CURRENT_DATE) - 1
              ELSE EXTRACT(YEAR FROM CURRENT_DATE)
            END as last_q_year
        ),
        last_quarter_data AS (
          SELECT COUNT(*) as records, MIN(trx_date_only) as min_date, MAX(trx_date_only) as max_date
          FROM new_flat_transactions t, quarter_check qc
          WHERE EXTRACT(QUARTER FROM t.trx_date_only) = qc.last_q
            AND EXTRACT(YEAR FROM t.trx_date_only) = qc.last_q_year
        ),
        last_quarter_targets AS (
          SELECT COUNT(*) as target_records, SUM(amount) as target_amount
          FROM tblcommontarget t, quarter_check qc
          WHERE t.year = qc.last_q_year
            AND t.month IN (
              CASE qc.last_q
                WHEN 1 THEN 1 WHEN 2 THEN 4 WHEN 3 THEN 7 WHEN 4 THEN 10
              END,
              CASE qc.last_q
                WHEN 1 THEN 2 WHEN 2 THEN 5 WHEN 3 THEN 8 WHEN 4 THEN 11
              END,
              CASE qc.last_q
                WHEN 1 THEN 3 WHEN 2 THEN 6 WHEN 3 THEN 9 WHEN 4 THEN 12
              END
            )
            AND t.isactive = true
        )
        SELECT qc.*, lqd.*, lqt.*
        FROM quarter_check qc, last_quarter_data lqd, last_quarter_targets lqt
      `

      // Check for different types of duplicates
      const duplicateTypesQuery = `
        SELECT
          'same_transaction_id' as dup_type,
          COUNT(*) - COUNT(DISTINCT transaction_id) as dup_count
        FROM new_flat_transactions
        WHERE EXTRACT(MONTH FROM trx_date_only) = 9 AND EXTRACT(YEAR FROM trx_date_only) = 2025
        UNION ALL
        SELECT
          'same_trx_code_only' as dup_type,
          COUNT(*) - COUNT(DISTINCT trx_code) as dup_count
        FROM new_flat_transactions
        WHERE EXTRACT(MONTH FROM trx_date_only) = 9 AND EXTRACT(YEAR FROM trx_date_only) = 2025
        UNION ALL
        SELECT
          'line_items_per_transaction' as dup_type,
          ROUND(AVG(line_count)) as dup_count
        FROM (
          SELECT trx_code, COUNT(*) as line_count
          FROM new_flat_transactions
          WHERE EXTRACT(MONTH FROM trx_date_only) = 9 AND EXTRACT(YEAR FROM trx_date_only) = 2025
          GROUP BY trx_code
        ) line_stats
      `

      const [thisMonthResult, lastQuarterResult, duplicateTypesResult] = await Promise.all([
        db.query(thisMonthQuery),
        db.query(lastQuarterQuery),
        db.query(duplicateTypesQuery)
      ])

      detailedAnalysis.thisMonth = thisMonthResult.rows[0] || {}
      detailedAnalysis.lastQuarter = lastQuarterResult.rows[0] || {}
      detailedAnalysis.duplicateTypes = duplicateTypesResult.rows || []

    } catch (e) {
      console.log('Detailed analysis error:', e)
    }

    return NextResponse.json({
      success: true,
      database_analysis: {
        tables: tablesResult.rows,
        transactions_columns: columnsResult.rows,
        route_codes_sample: routeCodesResult.rows.slice(0, 20),
        route_codes_count: routeCodesResult.rows.length,
        sample_transactions: sampleResult.rows,
        geographic_columns: geoResult.rows,
        route_statistics: routeStatsResult.rows,
        customer_table: customerTableInfo,
        visits_table: visitsTableInfo,
        category_performance_table: categoryPerformanceInfo,
        duplicate_check: duplicateCheck,
        detailed_analysis: detailedAnalysis,
        city_data_search: cityDataSearch
      }
    })
  } catch (error) {
    console.error('Database examination error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}