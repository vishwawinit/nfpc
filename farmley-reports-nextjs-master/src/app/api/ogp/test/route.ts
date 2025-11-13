import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

/**
 * Test endpoint to verify OGP Report data integrity
 * Usage: GET /api/ogp/test
 */
export async function GET(request: NextRequest) {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: []
    }

    // Test 1: Check table exists
    console.log('Test 1: Checking if flat_store_visits table exists...')
    const tableCheckResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'flat_store_visits'
      ) as exists
    `)
    results.tests.push({
      name: 'Table Exists',
      passed: tableCheckResult.rows[0].exists,
      message: tableCheckResult.rows[0].exists ? 'flat_store_visits table exists' : 'flat_store_visits table NOT found'
    })

    if (!tableCheckResult.rows[0].exists) {
      return NextResponse.json({
        success: false,
        error: 'flat_store_visits table does not exist',
        results
      }, { status: 500 })
    }

    // Test 2: Check required columns exist
    console.log('Test 2: Checking required columns...')
    const requiredColumns = [
      'visit_date', 'field_user_code', 'field_user_name',
      'tl_code', 'tl_name', 'user_role',
      'arrival_time', 'out_time',
      'latitude', 'longitude',
      'city_code', 'region_code', 'store_code'
    ]

    const columnCheckResult = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'flat_store_visits'
    `)
    
    const existingColumns = columnCheckResult.rows.map((r: any) => r.column_name)
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col))
    
    results.tests.push({
      name: 'Required Columns',
      passed: missingColumns.length === 0,
      message: missingColumns.length === 0 
        ? 'All required columns exist' 
        : `Missing columns: ${missingColumns.join(', ')}`,
      details: {
        required: requiredColumns,
        existing: existingColumns,
        missing: missingColumns
      }
    })

    // Test 3: Check data availability
    console.log('Test 3: Checking data availability...')
    const dataCheckResult = await query(`
      SELECT 
        COUNT(*) as total_records,
        MIN(visit_date) as earliest_date,
        MAX(visit_date) as latest_date,
        COUNT(DISTINCT field_user_code) as unique_users,
        COUNT(DISTINCT store_code) as unique_stores,
        COUNT(DISTINCT CASE WHEN tl_code IS NOT NULL THEN tl_code END) as records_with_tl,
        COUNT(DISTINCT CASE WHEN user_role IS NOT NULL THEN user_role END) as records_with_role,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as records_with_gps
      FROM flat_store_visits
      WHERE visit_date >= CURRENT_DATE - INTERVAL '30 days'
    `)

    const dataStats = dataCheckResult.rows[0]
    results.tests.push({
      name: 'Data Availability (Last 30 days)',
      passed: parseInt(dataStats.total_records) > 0,
      message: parseInt(dataStats.total_records) > 0 
        ? `Found ${dataStats.total_records} records` 
        : 'No data found in last 30 days',
      details: {
        totalRecords: parseInt(dataStats.total_records),
        dateRange: `${dataStats.earliest_date} to ${dataStats.latest_date}`,
        uniqueUsers: parseInt(dataStats.unique_users),
        uniqueStores: parseInt(dataStats.unique_stores),
        recordsWithTL: parseInt(dataStats.records_with_tl),
        recordsWithRole: parseInt(dataStats.records_with_role),
        recordsWithGPS: parseInt(dataStats.records_with_gps),
        dataQuality: {
          tlCoverage: dataStats.total_records > 0 
            ? ((parseInt(dataStats.records_with_tl) / parseInt(dataStats.total_records)) * 100).toFixed(1) + '%'
            : '0%',
          roleCoverage: dataStats.total_records > 0
            ? ((parseInt(dataStats.records_with_role) / parseInt(dataStats.total_records)) * 100).toFixed(1) + '%'
            : '0%',
          gpsCoverage: dataStats.total_records > 0
            ? ((parseInt(dataStats.records_with_gps) / parseInt(dataStats.total_records)) * 100).toFixed(1) + '%'
            : '0%'
        }
      }
    })

    // Test 4: Test OGP aggregation query
    console.log('Test 4: Testing OGP aggregation query...')
    const testDate = new Date()
    testDate.setDate(testDate.getDate() - 7)
    const startDate = testDate.toISOString().split('T')[0]
    const endDate = new Date().toISOString().split('T')[0]

    const ogpResult = await query(`
      WITH daily_visits AS (
        SELECT
          visit_date,
          field_user_code,
          field_user_name,
          tl_code,
          tl_name,
          user_role,
          MIN(arrival_time) as first_check_in,
          MAX(CASE WHEN out_time IS NOT NULL THEN out_time ELSE NULL END) as last_check_out,
          COUNT(DISTINCT store_code) as total_stores_visited,
          (ARRAY_AGG(latitude ORDER BY arrival_time ASC))[1] as first_lat,
          (ARRAY_AGG(longitude ORDER BY arrival_time ASC))[1] as first_lon,
          (ARRAY_AGG(latitude ORDER BY CASE WHEN out_time IS NOT NULL THEN out_time ELSE '1900-01-01'::timestamp END DESC))[1] as last_lat,
          (ARRAY_AGG(longitude ORDER BY CASE WHEN out_time IS NOT NULL THEN out_time ELSE '1900-01-01'::timestamp END DESC))[1] as last_lon
        FROM flat_store_visits
        WHERE visit_date >= $1 AND visit_date <= $2
        GROUP BY visit_date, field_user_code, field_user_name, tl_code, tl_name, user_role
      )
      SELECT
        COUNT(*) as visit_days,
        COUNT(DISTINCT field_user_code) as unique_users,
        SUM(total_stores_visited) as total_stores,
        AVG(total_stores_visited) as avg_stores_per_day,
        COUNT(CASE WHEN tl_code IS NOT NULL THEN 1 END) as days_with_tl,
        COUNT(CASE WHEN user_role IS NOT NULL THEN 1 END) as days_with_role,
        COUNT(CASE WHEN first_lat IS NOT NULL AND first_lon IS NOT NULL THEN 1 END) as days_with_gps
      FROM daily_visits
    `, [startDate, endDate])

    const ogpStats = ogpResult.rows[0]
    results.tests.push({
      name: 'OGP Aggregation Query',
      passed: parseInt(ogpStats.visit_days) > 0,
      message: parseInt(ogpStats.visit_days) > 0 
        ? `Query executed successfully - ${ogpStats.visit_days} visit days found` 
        : 'No data returned from aggregation',
      details: {
        dateRange: `${startDate} to ${endDate}`,
        visitDays: parseInt(ogpStats.visit_days),
        uniqueUsers: parseInt(ogpStats.unique_users),
        totalStores: parseInt(ogpStats.total_stores),
        avgStoresPerDay: parseFloat(ogpStats.avg_stores_per_day).toFixed(2),
        daysWithTL: parseInt(ogpStats.days_with_tl),
        daysWithRole: parseInt(ogpStats.days_with_role),
        daysWithGPS: parseInt(ogpStats.days_with_gps)
      }
    })

    // Test 5: Sample data quality check
    console.log('Test 5: Checking sample data quality...')
    const sampleResult = await query(`
      SELECT 
        visit_date,
        field_user_code,
        field_user_name,
        tl_code,
        tl_name,
        user_role,
        city_code,
        region_code,
        arrival_time,
        out_time,
        latitude,
        longitude
      FROM flat_store_visits
      WHERE visit_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY visit_date DESC, arrival_time DESC
      LIMIT 5
    `)

    results.tests.push({
      name: 'Sample Data Quality',
      passed: sampleResult.rows.length > 0,
      message: sampleResult.rows.length > 0 
        ? `Retrieved ${sampleResult.rows.length} sample records` 
        : 'No sample data available',
      sampleData: sampleResult.rows.map(row => ({
        date: row.visit_date,
        user: `${row.field_user_name} (${row.field_user_code})`,
        teamLeader: row.tl_name ? `${row.tl_name} (${row.tl_code})` : 'Not assigned',
        role: row.user_role || 'Not specified',
        arrivalTime: row.arrival_time,
        outTime: row.out_time,
        location: `${row.city_code || 'N/A'} / ${row.region_code || 'N/A'}`,
        hasGPS: !!(row.latitude && row.longitude),
        hasCheckOut: !!row.out_time
      }))
    })

    // Summary
    const passedTests = results.tests.filter((t: any) => t.passed).length
    const totalTests = results.tests.length
    const allPassed = passedTests === totalTests

    return NextResponse.json({
      success: allPassed,
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        status: allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'
      },
      results
    })

  } catch (error) {
    console.error('OGP Test API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

