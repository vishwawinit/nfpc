import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    await db.initialize()

    // Get distinct route names to see region pattern
    const routeNamesQuery = `
      SELECT DISTINCT
        route_code,
        route_name,
        COUNT(*) as usage_count
      FROM new_flat_journey_management
      WHERE route_name IS NOT NULL AND route_name != ''
      GROUP BY route_code, route_name
      ORDER BY usage_count DESC
      LIMIT 100
    `

    // Check if route_name contains region in brackets [REGION]
    const regionExtractionQuery = `
      SELECT DISTINCT
        route_code,
        route_name,
        CASE
          WHEN route_name ~ '\\[([A-Z]+)\\]' THEN
            SUBSTRING(route_name FROM '\\[([A-Z]+)\\]')
          ELSE NULL
        END as extracted_region
      FROM new_flat_journey_management
      WHERE route_name IS NOT NULL AND route_name != ''
      ORDER BY route_code
      LIMIT 200
    `

    // Get unique extracted regions
    const uniqueRegionsQuery = `
      SELECT DISTINCT
        SUBSTRING(route_name FROM '\\[([A-Z]+)\\]') as region,
        COUNT(*) as route_count
      FROM new_flat_journey_management
      WHERE route_name ~ '\\[([A-Z]+)\\]'
        AND route_name IS NOT NULL
      GROUP BY region
      ORDER BY route_count DESC
    `

    const [routeNames, regionExtraction, uniqueRegions] = await Promise.all([
      db.query(routeNamesQuery),
      db.query(regionExtractionQuery),
      db.query(uniqueRegionsQuery)
    ])

    return NextResponse.json({
      success: true,
      data: {
        sampleRouteNames: routeNames.rows,
        regionExtractionSamples: regionExtraction.rows.slice(0, 50),
        uniqueRegions: uniqueRegions.rows,
        totalRoutesChecked: regionExtraction.rows.length
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Route regions check API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check route regions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
