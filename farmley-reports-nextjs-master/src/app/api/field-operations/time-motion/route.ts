import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const salesman = searchParams.get('salesman') || 'all'

    // Get time and motion analysis data with productive/non-productive breakdown
    const query = `
      WITH user_time_data AS (
        SELECT
          cv.usercode,
          COALESCE(u.username, cv.usercode) as user_name,
          COUNT(*) as total_visits,
          COUNT(CASE WHEN cv.isproductive = 0 THEN 1 END) as productive_visits,
          COUNT(CASE WHEN cv.isproductive IS NULL THEN 1 END) as non_productive_visits,
          SUM(COALESCE(cv.totaltimeinmins, 0)) as total_active_minutes,
          SUM(CASE WHEN cv.isproductive = 0 THEN COALESCE(cv.totaltimeinmins, 0) ELSE 0 END) as productive_minutes,
          SUM(CASE WHEN cv.isproductive IS NULL THEN COALESCE(cv.totaltimeinmins, 0) ELSE 0 END) as non_productive_minutes,
          MIN(cv.arrivaltime)::time as first_visit_time,
          MAX(cv.arrivaltime)::time as last_visit_time,
          AVG(COALESCE(cv.totaltimeinmins, 0)) as avg_visit_duration
        FROM tblcustomervisit cv
        LEFT JOIN tbluser u ON cv.usercode = u.code
        WHERE DATE(cv.date) = $1::date
        ${salesman !== 'all' ? 'AND cv.usercode = $2' : ''}
        GROUP BY cv.usercode, u.username
      ),
      journey_data AS (
        SELECT
          usercode,
          MIN(starttime) as journey_start,
          MAX(endtime) as journey_end,
          CASE
            WHEN MAX(odometerreadingend) ~ '^[0-9]+$' AND MIN(odometerreadingstart) ~ '^[0-9]+$'
            THEN CAST(MAX(odometerreadingend) AS INTEGER) - CAST(MIN(odometerreadingstart) AS INTEGER)
            ELSE 0
          END as distance_covered
        FROM tbljourney
        WHERE DATE(date) = $1::date
        ${salesman !== 'all' ? 'AND usercode = $2' : ''}
        GROUP BY usercode
      )
      SELECT
        utd.*,
        COALESCE(jd.journey_start, utd.first_visit_time::text, '08:00') as journey_start,
        COALESCE(jd.journey_end, utd.last_visit_time::text, '18:00') as journey_end,
        COALESCE(jd.distance_covered, 0) as distance_traveled,
        CASE
          WHEN utd.last_visit_time IS NOT NULL AND utd.first_visit_time IS NOT NULL
          THEN EXTRACT(EPOCH FROM (utd.last_visit_time - utd.first_visit_time))/60
          ELSE 600
        END as total_working_minutes
      FROM user_time_data utd
      LEFT JOIN journey_data jd ON utd.usercode = jd.usercode
      WHERE utd.total_visits > 0 AND utd.total_active_minutes > 0
      ORDER BY utd.total_active_minutes DESC
    `

    const params = salesman !== 'all' ? [date, salesman] : [date]
    const result = await db.query(query, params)

    // Calculate summary statistics
    const totalActiveMinutes = result.rows.reduce((sum, row) => sum + parseFloat(row.total_active_minutes || 0), 0)
    const totalProductiveMinutes = result.rows.reduce((sum, row) => sum + parseFloat(row.productive_minutes || 0), 0)
    const totalNonProductiveMinutes = result.rows.reduce((sum, row) => sum + parseFloat(row.non_productive_minutes || 0), 0)
    const totalVisits = result.rows.reduce((sum, row) => sum + parseInt(row.total_visits || 0), 0)
    const productiveVisits = result.rows.reduce((sum, row) => sum + parseInt(row.productive_visits || 0), 0)
    const productivityScore = totalActiveMinutes > 0 ? Math.round((totalProductiveMinutes / totalActiveMinutes) * 100) : 0

    // Get top performers by productive time
    const topPerformers = result.rows
      .filter(row => parseFloat(row.productive_minutes || 0) > 0)
      .sort((a, b) => parseFloat(b.productive_minutes) - parseFloat(a.productive_minutes))
      .slice(0, 5)
      .map(row => ({
        name: row.user_name,
        activeTime: parseFloat(row.total_active_minutes || 0),
        productiveTime: parseFloat(row.productive_minutes || 0)
      }))

    const timeMotionData = result.rows.map(row => ({
      userCode: row.usercode,
      userName: row.user_name || 'Unknown',
      firstVisit: row.first_visit_time,
      lastVisit: row.last_visit_time,
      journeyStart: row.journey_start,
      journeyEnd: row.journey_end,
      totalActiveMinutes: parseFloat(row.total_active_minutes || 0),
      productiveMinutes: parseFloat(row.productive_minutes || 0),
      nonProductiveMinutes: parseFloat(row.non_productive_minutes || 0),
      totalWorkingMinutes: parseFloat(row.total_working_minutes || 0),
      avgVisitDuration: parseFloat(row.avg_visit_duration || 0),
      completedVisits: parseInt(row.total_visits || 0),
      productiveVisits: parseInt(row.productive_visits || 0),
      nonProductiveVisits: parseInt(row.non_productive_visits || 0),
      timeUtilization: row.total_active_minutes > 0 ?
        Math.round((parseFloat(row.productive_minutes || 0) / parseFloat(row.total_active_minutes)) * 100) : 0,
      distanceTraveled: parseFloat(row.distance_traveled || 0)
    }))

    // Get hourly breakdown with productive/non-productive split
    const hourlyQuery = `
      SELECT
        EXTRACT(HOUR FROM arrivaltime) as hour,
        COUNT(*) as visit_count,
        COUNT(CASE WHEN isproductive = 0 THEN 1 END) as productive_count,
        COUNT(CASE WHEN isproductive IS NULL THEN 1 END) as non_productive_count,
        SUM(COALESCE(totaltimeinmins, 0)) as total_minutes,
        SUM(CASE WHEN isproductive = 0 THEN COALESCE(totaltimeinmins, 0) ELSE 0 END) as productive_minutes,
        SUM(CASE WHEN isproductive IS NULL THEN COALESCE(totaltimeinmins, 0) ELSE 0 END) as non_productive_minutes,
        AVG(COALESCE(totaltimeinmins, 0)) as avg_duration
      FROM tblcustomervisit
      WHERE DATE(date) = $1::date
      ${salesman !== 'all' ? 'AND usercode = $2' : ''}
      AND totaltimeinmins > 0
      GROUP BY EXTRACT(HOUR FROM arrivaltime)
      ORDER BY hour
    `

    const hourlyResult = await db.query(hourlyQuery, params)

    // Build hourly data for 8 AM to 8 PM
    const hourlyBreakdown = []
    for (let hour = 8; hour <= 20; hour++) {
      const data = hourlyResult.rows.find(row => parseInt(row.hour) === hour)
      hourlyBreakdown.push({
        hour: `${hour}:00`,
        visits: parseInt(data?.visit_count || 0),
        productive: parseInt(data?.productive_count || 0),
        nonProductive: parseInt(data?.non_productive_count || 0),
        totalMinutes: parseFloat(data?.total_minutes || 0),
        productiveMinutes: parseFloat(data?.productive_minutes || 0),
        nonProductiveMinutes: parseFloat(data?.non_productive_minutes || 0),
        avgDuration: parseFloat(data?.avg_duration || 0)
      })
    }

    return NextResponse.json({
      summary: {
        totalActiveTime: totalActiveMinutes,
        productiveTime: totalProductiveMinutes,
        nonProductiveTime: totalNonProductiveMinutes,
        totalVisits: totalVisits,
        productiveVisits: productiveVisits,
        productivityScore: productivityScore,
        totalUsers: result.rows.length
      },
      timeMotion: timeMotionData,
      hourlyBreakdown: hourlyBreakdown,
      topPerformers: topPerformers
    })

  } catch (error) {
    console.error('Error fetching time motion data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch time motion data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}