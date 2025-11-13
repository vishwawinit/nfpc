import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'

// Fetch data from new_flat_salesman_performance table for overall/total values
async function fetchTotalPerformanceData() {
  await db.initialize()

  try {
    // First, let's check if the table exists and what columns it has
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'new_flat_salesman_performance'
      );
    `)

    if (!tableCheck.rows[0]?.exists) {
      console.log('new_flat_salesman_performance table does not exist')
      return { success: false, data: [], message: 'Performance table not found' }
    }

    // Get column information
    const columnInfo = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'new_flat_salesman_performance'
      ORDER BY ordinal_position;
    `)

    console.log('Available columns in new_flat_salesman_performance:',
      columnInfo.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '))

    // Query the performance data
    const query = `
      SELECT *
      FROM new_flat_salesman_performance
      WHERE salesman_code IS NOT NULL
      ORDER BY total_revenue DESC NULLS LAST;
    `

    const result = await db.query(query)

    console.log(`Query executed. Rows returned: ${result.rows.length}`)

    if (result.rows.length === 0) {
      // Check if there's any data at all in the table
      const countResult = await db.query('SELECT COUNT(*) FROM new_flat_salesman_performance')
      const totalRows = parseInt(countResult.rows[0]?.count || 0)
      console.log(`Total rows in new_flat_salesman_performance: ${totalRows}`)

      if (totalRows === 0) {
        console.log('new_flat_salesman_performance table is empty')
      } else {
        console.log('Table has data but no rows match the WHERE clause')
      }

      return { success: true, data: [], message: `No performance data available (total rows: ${totalRows})` }
    }

    console.log(`Found ${result.rows.length} performance records`)

    const performanceData = result.rows.map(row => ({
      salesman_code: row.salesman_code,
      salesman_name: row.salesman_name,
      // Map the actual column names to expected names
      total_sales: parseFloat(row.total_revenue || 0),
      total_orders: parseInt(row.total_transactions || 0),
      total_visits: parseInt(row.total_visits || 0),
      total_customers: parseInt(row.total_customers || 0),
      avg_order_value: parseFloat(row.avg_transaction_value || 0),
      productivity_rate: parseFloat(row.productivity_rate || 0),
      performance_rank: parseInt(row.performance_rank || 0),
      period_start: row.period_start,
      period_end: row.period_end,
      // Overall performance data for Total calculations
      ytd_sales: parseFloat(row.total_revenue || 0), // Use total revenue as YTD
      mtd_sales: parseFloat(row.total_revenue || 0), // Use total revenue as MTD fallback
      overall_performance: parseFloat(row.productivity_rate || 0),
      productivity_percentage: parseFloat(row.productivity_rate || 0),
      // Include any other columns that might exist
      ...row
    }))

    return { success: true, data: performanceData }

  } catch (error) {
    console.error('Error querying new_flat_salesman_performance:', error)

    // If there's an error, it might be because the table doesn't exist or has different structure
    // Let's try to understand what happened
    if (error instanceof Error && error.message.includes('does not exist')) {
      return { success: false, data: [], message: 'Performance table does not exist in database' }
    }

    return { success: false, data: [], message: 'Error accessing performance data', error: error.message }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Create cached version of the data fetcher (cache for 10 minutes since this is total data)
    const getCachedData = unstable_cache(
      async () => fetchTotalPerformanceData(),
      ['salesman-performance-total-v1'],
      {
        revalidate: 600, // Cache for 10 minutes
        tags: ['salesman-performance-total']
      }
    )

    const result = await getCachedData()

    // Create response with cache headers
    const response = NextResponse.json(result.data || [])
    response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200')
    response.headers.set('X-Cache-Duration', '600')

    return response

  } catch (error) {
    console.error('Performance total API error:', error)
    return NextResponse.json(
      [],  // Return empty array for compatibility
      { status: 200 }  // Don't break the UI, just return empty data
    )
  }
}