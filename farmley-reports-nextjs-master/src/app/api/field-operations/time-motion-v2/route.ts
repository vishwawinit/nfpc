import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const salesman = searchParams.get('salesman') || 'all'

    // Get detailed visit activities for timeline
    const timelineQuery = `
      WITH visit_activities AS (
        SELECT
          cv.usercode,
          cv.clientcode,
          COALESCE(c.name, cv.clientcode) as client_name,
          cv.arrivaltime,
          cv.outtime,
          cv.totaltimeinmins,
          CASE
            WHEN cv.isproductive = 0 THEN 'productive'
            WHEN cv.typeofcall = 'NJP' AND cv.totaltimeinmins > 30 THEN 'break'
            WHEN cv.typeofcall = 'warehouse' OR cv.clientcode LIKE 'HHT%' THEN 'warehouse'
            ELSE 'travel'
          END as activity_type,
          cv.latitude,
          cv.longitude
        FROM tblcustomervisit cv
        LEFT JOIN tblcustomer c ON cv.clientcode = c.code
        WHERE DATE(cv.date) = $1::date
        ${salesman !== 'all' ? 'AND cv.usercode = $2' : ''}
        ORDER BY cv.arrivaltime
      ),
      time_categories AS (
        SELECT
          usercode,
          -- Productive time (customer visits)
          SUM(CASE WHEN activity_type = 'productive' THEN totaltimeinmins ELSE 0 END) as productive_minutes,
          COUNT(CASE WHEN activity_type = 'productive' THEN 1 END) as productive_visits,

          -- Travel time (between visits)
          SUM(CASE WHEN activity_type = 'travel' THEN totaltimeinmins ELSE 0 END) as travel_minutes,

          -- Warehouse time
          SUM(CASE WHEN activity_type = 'warehouse' THEN totaltimeinmins ELSE 0 END) as warehouse_minutes,

          -- Break time
          SUM(CASE WHEN activity_type = 'break' THEN totaltimeinmins ELSE 0 END) as break_minutes,

          -- Total active time
          SUM(totaltimeinmins) as total_active_minutes,
          COUNT(*) as total_visits,

          MIN(arrivaltime) as first_activity,
          MAX(COALESCE(outtime, arrivaltime)) as last_activity
        FROM visit_activities
        GROUP BY usercode
      ),
      user_summary AS (
        SELECT
          tc.*,
          u.username,
          -- Calculate working day span
          EXTRACT(EPOCH FROM (last_activity - first_activity))/60 as working_span_minutes,
          -- Calculate break time as gaps in the day
          GREATEST(0, EXTRACT(EPOCH FROM (last_activity - first_activity))/60 - total_active_minutes) as actual_break_minutes
        FROM time_categories tc
        LEFT JOIN tbluser u ON tc.usercode = u.code
      )
      SELECT
        us.*,
        va.activities
      FROM user_summary us
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'time', to_char(arrivaltime, 'HH24:MI'),
            'endTime', to_char(COALESCE(outtime, arrivaltime + (totaltimeinmins || ' minutes')::interval), 'HH24:MI'),
            'duration', totaltimeinmins,
            'type', activity_type,
            'client', client_name,
            'location', CASE
              WHEN activity_type = 'productive' THEN client_name
              WHEN activity_type = 'warehouse' THEN 'Warehouse'
              ELSE 'Travel'
            END
          ) ORDER BY arrivaltime
        ) as activities
        FROM visit_activities
        WHERE usercode = us.usercode
      ) va ON true
    `

    const params = salesman !== 'all' ? [date, salesman] : [date]
    const result = await db.query(timelineQuery, params)

    // Process results for each user
    const timeMotionData = result.rows.map(row => {
      const productiveMinutes = parseFloat(row.productive_minutes || 0)
      const travelMinutes = parseFloat(row.travel_minutes || 0)
      const warehouseMinutes = parseFloat(row.warehouse_minutes || 0)
      const breakMinutes = parseFloat(row.break_minutes || 0)
      const totalDayMinutes = 720 // 12 hour work day (8 AM to 8 PM)

      // Calculate percentages
      const productivePercent = (productiveMinutes / totalDayMinutes) * 100
      const travelPercent = (travelMinutes / totalDayMinutes) * 100
      const warehousePercent = (warehouseMinutes / totalDayMinutes) * 100
      const breakPercent = (breakMinutes / totalDayMinutes) * 100

      // Build timeline blocks
      const timelineBlocks = []
      const activities = row.activities || []

      activities.forEach((activity: any, index: number) => {
        // Add travel block if there's a gap before this activity
        if (index > 0) {
          const prevActivity = activities[index - 1]
          const prevEnd = prevActivity.endTime
          const currentStart = activity.time

          // Check if there's a gap
          if (prevEnd < currentStart) {
            timelineBlocks.push({
              type: 'travel',
              label: 'TRA',
              startTime: prevEnd,
              endTime: currentStart,
              color: '#3B82F6' // Blue for travel
            })
          }
        }

        // Add the activity block
        let color = '#10B981' // Green for productive
        let label = activity.location

        if (activity.type === 'warehouse') {
          color = '#6366F1' // Indigo for warehouse
          label = 'WAR'
        } else if (activity.type === 'travel') {
          color = '#3B82F6' // Blue for travel
          label = 'TRA'
        } else {
          // Productive - use client name or abbreviation
          label = activity.client ? activity.client.substring(0, 15) : 'Customer'
        }

        timelineBlocks.push({
          type: activity.type,
          label: label,
          startTime: activity.time,
          endTime: activity.endTime,
          duration: activity.duration,
          color: color
        })

        // Add break block if it's lunch time (12-1 PM)
        const activityHour = parseInt(activity.time.split(':')[0])
        if (activityHour === 12 && index < activities.length - 1) {
          const nextActivity = activities[index + 1]
          const nextHour = parseInt(nextActivity.time.split(':')[0])
          if (nextHour >= 13) {
            timelineBlocks.push({
              type: 'break',
              label: 'BRE',
              startTime: '12:00',
              endTime: '13:00',
              color: '#F59E0B' // Amber for break
            })
          }
        }
      })

      // Create activity log
      const activityLog = activities.map((activity: any) => ({
        time: `${activity.time} - ${activity.endTime}`,
        description: activity.type === 'productive' ? 'Customer visit' :
                     activity.type === 'warehouse' ? 'Warehouse' :
                     'Travel to ' + (activity.client || 'location'),
        location: activity.location,
        duration: `${activity.duration || 0}m`,
        type: activity.type
      }))

      return {
        userCode: row.usercode,
        userName: row.username || row.usercode,

        // Time breakdown
        productiveMinutes,
        productivePercent: productivePercent.toFixed(1),

        travelMinutes,
        travelPercent: travelPercent.toFixed(1),

        breakMinutes,
        breakPercent: breakPercent.toFixed(1),

        warehouseMinutes,
        warehousePercent: warehousePercent.toFixed(1),

        // Visit counts
        totalVisits: parseInt(row.total_visits || 0),
        productiveVisits: parseInt(row.productive_visits || 0),

        // Timeline data
        timelineBlocks,
        activityLog,

        // Working hours
        firstActivity: row.first_activity ? new Date(row.first_activity).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '08:00',
        lastActivity: row.last_activity ? new Date(row.last_activity).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '18:00',

        // Productivity score
        productivityScore: Math.round((productiveMinutes / (productiveMinutes + travelMinutes + warehouseMinutes)) * 100) || 0
      }
    })

    // Get hourly productivity breakdown
    const hourlyQuery = `
      SELECT
        EXTRACT(HOUR FROM arrivaltime) as hour,
        SUM(CASE WHEN isproductive = 0 THEN totaltimeinmins ELSE 0 END) as productive_minutes,
        SUM(CASE WHEN typeofcall = 'warehouse' THEN totaltimeinmins ELSE 0 END) as warehouse_minutes,
        SUM(CASE WHEN isproductive IS NULL AND typeofcall != 'warehouse' THEN totaltimeinmins ELSE 0 END) as travel_minutes,
        COUNT(*) as visit_count
      FROM tblcustomervisit
      WHERE DATE(date) = $1::date
      ${salesman !== 'all' ? 'AND usercode = $2' : ''}
      GROUP BY EXTRACT(HOUR FROM arrivaltime)
      ORDER BY hour
    `

    const hourlyResult = await db.query(hourlyQuery, params)

    // Build hourly breakdown for chart (8 AM to 5 PM)
    const hourlyBreakdown = []
    for (let hour = 8; hour <= 17; hour++) {
      const data = hourlyResult.rows.find(row => parseInt(row.hour) === hour)

      const productive = parseFloat(data?.productive_minutes || 0)
      const travel = parseFloat(data?.travel_minutes || 0)
      const warehouse = parseFloat(data?.warehouse_minutes || 0)
      const breakTime = hour === 12 ? 60 : 0 // Lunch break at noon

      hourlyBreakdown.push({
        hour: hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`,
        productive,
        travel,
        warehouse,
        break: breakTime,
        total: productive + travel + warehouse + breakTime
      })
    }

    // Calculate overall summary
    const overallSummary = {
      totalUsers: timeMotionData.length,
      avgProductivityScore: timeMotionData.length > 0
        ? Math.round(timeMotionData.reduce((sum, user) => sum + user.productivityScore, 0) / timeMotionData.length)
        : 0,
      totalProductiveMinutes: timeMotionData.reduce((sum, user) => sum + user.productiveMinutes, 0),
      totalTravelMinutes: timeMotionData.reduce((sum, user) => sum + user.travelMinutes, 0),
      totalBreakMinutes: timeMotionData.reduce((sum, user) => sum + user.breakMinutes, 0),
      totalWarehouseMinutes: timeMotionData.reduce((sum, user) => sum + user.warehouseMinutes, 0),
      totalVisits: timeMotionData.reduce((sum, user) => sum + user.totalVisits, 0)
    }

    return NextResponse.json({
      summary: overallSummary,
      users: salesman === 'all' ? timeMotionData : timeMotionData.slice(0, 1),
      hourlyBreakdown
    })

  } catch (error) {
    console.error('Error fetching time motion data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch time motion data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}