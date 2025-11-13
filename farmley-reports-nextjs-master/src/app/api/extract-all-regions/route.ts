import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Extract regions using comprehensive pattern matching
    const regionExtractionQuery = `
      WITH route_regions AS (
        SELECT DISTINCT
          route_code,
          route_name,
          CASE
            -- First try to extract from brackets [REGION]
            WHEN route_name ~ '\\[([A-Z]+)\\]' THEN
              SUBSTRING(route_name FROM '\\[([A-Z]+)\\]')
            -- Try to match common city codes in route names
            WHEN route_name ILIKE '%AUH%' OR route_name ILIKE '%ABU DHABI%' THEN 'AUH'
            WHEN route_name ILIKE '%DXB%' OR route_name ILIKE '%DUBAI%' OR route_name ILIKE '%DEIRA%' THEN 'DXB'
            WHEN route_name ILIKE '%SHJ%' OR route_name ILIKE '%SHARJAH%' THEN 'SHJ'
            WHEN route_name ILIKE '%RAK%' THEN 'RAK'
            WHEN route_name ILIKE '%FUJ%' OR route_name ILIKE '%FUJAIRAH%' THEN 'FUJ'
            WHEN route_name ILIKE '%AJM%' OR route_name ILIKE '%AJMAN%' THEN 'AJM'
            WHEN route_name ILIKE '%AL AIN%' OR route_name ILIKE '%ALAIN%' THEN 'AIN'
            WHEN route_name ILIKE '%UMM%' OR route_name ILIKE '%UAQ%' THEN 'UAQ'
            ELSE 'OTHER'
          END as region
        FROM new_flat_journey_management
        WHERE route_name IS NOT NULL AND route_name != ''
      )
      SELECT
        region,
        COUNT(DISTINCT route_code) as unique_routes,
        COUNT(*) as total_entries,
        ARRAY_AGG(DISTINCT route_name ORDER BY route_name) FILTER (WHERE route_name IS NOT NULL) as sample_route_names
      FROM route_regions
      GROUP BY region
      ORDER BY total_entries DESC
    `

    // Get routes with regions for returns data specifically
    const returnsRoutesWithRegionsQuery = `
      WITH route_regions AS (
        SELECT DISTINCT
          t.route_code,
          j.route_name,
          CASE
            WHEN j.route_name ~ '\\[([A-Z]+)\\]' THEN
              SUBSTRING(j.route_name FROM '\\[([A-Z]+)\\]')
            WHEN j.route_name ILIKE '%AUH%' OR j.route_name ILIKE '%ABU DHABI%' THEN 'AUH'
            WHEN j.route_name ILIKE '%DXB%' OR j.route_name ILIKE '%DUBAI%' OR j.route_name ILIKE '%DEIRA%' THEN 'DXB'
            WHEN j.route_name ILIKE '%SHJ%' OR j.route_name ILIKE '%SHARJAH%' THEN 'SHJ'
            WHEN j.route_name ILIKE '%RAK%' THEN 'RAK'
            WHEN j.route_name ILIKE '%FUJ%' OR j.route_name ILIKE '%FUJAIRAH%' THEN 'FUJ'
            WHEN j.route_name ILIKE '%AJM%' OR j.route_name ILIKE '%AJMAN%' THEN 'AJM'
            WHEN j.route_name ILIKE '%AL AIN%' OR j.route_name ILIKE '%ALAIN%' THEN 'AIN'
            WHEN j.route_name ILIKE '%UMM%' OR j.route_name ILIKE '%UAQ%' THEN 'UAQ'
            ELSE 'OTHER'
          END as region
        FROM new_flat_transactions t
        LEFT JOIN (
          SELECT DISTINCT route_code, route_name
          FROM new_flat_journey_management
          WHERE route_name IS NOT NULL AND route_name != ''
        ) j ON t.route_code = j.route_code
        WHERE t.trx_type = 4
          AND t.trx_date_only >= CURRENT_DATE - INTERVAL '3 months'
      )
      SELECT
        region,
        COUNT(DISTINCT route_code) as route_count
      FROM route_regions
      WHERE region IS NOT NULL
      GROUP BY region
      ORDER BY route_count DESC
    `

    const [allRegions, returnsRegions] = await Promise.all([
      db.query(regionExtractionQuery),
      db.query(returnsRoutesWithRegionsQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        allRegions: allRegions.rows.map(row => ({
          region: row.region,
          uniqueRoutes: parseInt(row.unique_routes),
          totalEntries: parseInt(row.total_entries),
          sampleRouteNames: row.sample_route_names?.slice(0, 5) || []
        })),
        returnsRegions: returnsRegions.rows,
        regionMapping: {
          'AUH': 'Abu Dhabi',
          'DXB': 'Dubai',
          'SHJ': 'Sharjah',
          'RAK': 'Ras Al Khaimah',
          'FUJ': 'Fujairah',
          'AJM': 'Ajman',
          'AIN': 'Al Ain',
          'UAQ': 'Umm Al Quwain',
          'OTHER': 'Other/Unclassified'
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Extract regions API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to extract regions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
