'use client'
import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { colors, CHART_COLORS } from '../styles/colors'
import { useResponsive } from '@/hooks/useResponsive'

interface TimeMotionAnalysisProps {
  salesmen: any[]
  selectedSalesman: string
  date: string
}

export const TimeMotionAnalysis: React.FC<TimeMotionAnalysisProps> = ({
  salesmen,
  selectedSalesman,
  date
}) => {
  const { isMobile, styles } = useResponsive()
  const [timeMotionData, setTimeMotionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTimeMotionData()
  }, [date, selectedSalesman])

  const fetchTimeMotionData = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/field-operations/time-motion-v2?date=${date}&salesman=${selectedSalesman}`
      )
      if (response.ok) {
        const data = await response.json()
        setTimeMotionData(data)
      }
    } catch (error) {
      console.error('Error fetching time motion data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: colors.gray[500] }}>
        Loading time & motion data...
      </div>
    )
  }

  if (!timeMotionData || !timeMotionData.users || timeMotionData.users.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: colors.gray[500] }}>
        No time & motion data available for the selected date
      </div>
    )
  }

  const selectedUser = selectedSalesman === 'all'
    ? timeMotionData.summary
    : timeMotionData.users.find((user: any) => user.userCode === selectedSalesman) || timeMotionData.users[0]

  const displayUser = selectedSalesman === 'all' ? null : selectedUser

  // Format time helper
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}h ${mins}m`
  }

  // Time distribution data for pie chart
  const timeDistribution = displayUser ? [
    { name: 'Productive', value: displayUser.productiveMinutes, color: '#10B981' },
    { name: 'Travel', value: displayUser.travelMinutes, color: '#3B82F6' },
    { name: 'Break', value: displayUser.breakMinutes, color: '#F59E0B' },
    { name: 'Warehouse', value: displayUser.warehouseMinutes, color: '#6366F1' }
  ].filter(item => item.value > 0) : []

  return (
    <div>
      <h3 style={{ ...styles.heading('18px', '16px'), marginBottom: isMobile ? '16px' : '20px', color: colors.gray[900] }}>
        Time & Motion Analysis - {new Date(date).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        })}
      </h3>

      {displayUser && (
        <div style={{ ...styles.fontSize('14px', '13px'), color: colors.gray[600], marginBottom: isMobile ? '16px' : '24px' }}>
          Analyzing: {displayUser.userName}
        </div>
      )}

      {/* Time breakdown cards */}
      <div style={{ ...styles.gridTemplate(4, 2), marginBottom: isMobile ? '16px' : '24px' }}>
        {/* Productive */}
        <div style={{
          padding: '20px',
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981'
            }} />
            <span style={{ fontSize: '14px', color: colors.gray[700] }}>Productive</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.gray[900] }}>
            {displayUser ? formatTime(displayUser.productiveMinutes) : formatTime(timeMotionData.summary.totalProductiveMinutes)}
          </div>
          <div style={{ fontSize: '12px', color: colors.gray[500] }}>
            {displayUser ? `${displayUser.productivePercent}% of day` : `Total across all users`}
          </div>
        </div>

        {/* Travel */}
        <div style={{
          padding: '20px',
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#3B82F6'
            }} />
            <span style={{ fontSize: '14px', color: colors.gray[700] }}>Travel</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.gray[900] }}>
            {displayUser ? formatTime(displayUser.travelMinutes) : formatTime(timeMotionData.summary.totalTravelMinutes)}
          </div>
          <div style={{ fontSize: '12px', color: colors.gray[500] }}>
            {displayUser ? `${displayUser.travelPercent}% of day` : `Total across all users`}
          </div>
        </div>

        {/* Break */}
        <div style={{
          padding: '20px',
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#F59E0B'
            }} />
            <span style={{ fontSize: '14px', color: colors.gray[700] }}>Break</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.gray[900] }}>
            {displayUser ? formatTime(displayUser.breakMinutes) : formatTime(timeMotionData.summary.totalBreakMinutes)}
          </div>
          <div style={{ fontSize: '12px', color: colors.gray[500] }}>
            {displayUser ? `${displayUser.breakPercent}% of day` : `Total across all users`}
          </div>
        </div>

        {/* Warehouse */}
        <div style={{
          padding: '20px',
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#6366F1'
            }} />
            <span style={{ fontSize: '14px', color: colors.gray[700] }}>Warehouse</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.gray[900] }}>
            {displayUser ? formatTime(displayUser.warehouseMinutes) : formatTime(timeMotionData.summary.totalWarehouseMinutes)}
          </div>
          <div style={{ fontSize: '12px', color: colors.gray[500] }}>
            {displayUser ? `${displayUser.warehousePercent}% of day` : `Total across all users`}
          </div>
        </div>
      </div>

      {/* Daily Timeline */}
      {displayUser && (
        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`,
          marginBottom: isMobile ? '16px' : '24px'
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: colors.gray[800] }}>
            Daily Timeline
          </h4>
          <div style={{
            height: '60px',
            backgroundColor: colors.gray[100],
            borderRadius: '4px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {displayUser.timelineBlocks && displayUser.timelineBlocks.length > 0 ? (
              displayUser.timelineBlocks.map((block: any, index: number) => (
                <div
                  key={index}
                  style={{
                    position: 'absolute',
                    height: '100%',
                    backgroundColor: block.color,
                    left: `${((new Date(`2025-01-01 ${block.startTime}`).getHours() - 8) * 60 + new Date(`2025-01-01 ${block.startTime}`).getMinutes()) / 720 * 100}%`,
                    width: `${(block.duration || 30) / 720 * 100}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '600',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                  }}
                  title={`${block.label} (${block.startTime} - ${block.endTime})`}
                >
                  {block.label}
                </div>
              ))
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.gray[500]
              }}>
                No activity data available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Log */}
      {displayUser && displayUser.activityLog && displayUser.activityLog.length > 0 && (
        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`,
          marginBottom: isMobile ? '16px' : '24px'
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: colors.gray[800] }}>
            Activity Log
          </h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {displayUser.activityLog.map((activity: any, index: number) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: index < displayUser.activityLog.length - 1 ? `1px solid ${colors.gray[100]}` : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: activity.type === 'productive' ? '#10B981' :
                                     activity.type === 'warehouse' ? '#6366F1' :
                                     activity.type === 'break' ? '#F59E0B' : '#3B82F6'
                  }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: colors.gray[900] }}>
                      {activity.time}
                    </div>
                    <div style={{ fontSize: '12px', color: colors.gray[600] }}>
                      {activity.description}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: colors.gray[500] }}>
                    {activity.location}
                  </div>
                  <div style={{ fontSize: '11px', color: colors.gray[400] }}>
                    {activity.duration}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div style={{ ...styles.gridTemplate(2, 1), marginBottom: isMobile ? '16px' : '24px' }}>
        {/* Time Distribution Pie Chart */}
        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '20px', color: colors.gray[800] }}>
            Time Distribution
          </h4>
          {timeDistribution.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={timeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {timeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ marginTop: '16px' }}>
                {timeDistribution.map((item, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '2px',
                        backgroundColor: item.color
                      }} />
                      <span style={{ fontSize: '12px', color: colors.gray[600] }}>
                        {item.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: colors.gray[800], fontWeight: '600' }}>
                      {((item.value / 720) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.gray[500] }}>
              No time distribution data
            </div>
          )}
        </div>

        {/* Hourly Productivity Breakdown */}
        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '20px', color: colors.gray[800] }}>
            Hourly Productivity Breakdown
          </h4>
          {timeMotionData.hourlyBreakdown && timeMotionData.hourlyBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={timeMotionData.hourlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.gray[200]} />
                <XAxis dataKey="hour" stroke={colors.gray[400]} tick={{ fill: colors.gray[500], fontSize: 11 }} />
                <YAxis stroke={colors.gray[400]} tick={{ fill: colors.gray[500], fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.background.primary,
                    border: `1px solid ${colors.gray[200]}`,
                    borderRadius: '6px'
                  }}
                />
                <Bar dataKey="productive" stackId="a" fill="#10B981" name="Productive" />
                <Bar dataKey="travel" stackId="a" fill="#3B82F6" name="Travel" />
                <Bar dataKey="warehouse" stackId="a" fill="#6366F1" name="Warehouse" />
                <Bar dataKey="break" stackId="a" fill="#F59E0B" name="Break" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.gray[500] }}>
              No hourly data available
            </div>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div style={{
        ...styles.gridTemplate(3, 1),
        marginBottom: isMobile ? '16px' : '24px'
      }}>
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ fontSize: '13px', color: colors.gray[600], marginBottom: '8px' }}>
            Productivity Score
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: displayUser?.productivityScore > 70 ? colors.success.main : displayUser?.productivityScore > 50 ? colors.warning.main : colors.error.main }}>
            {displayUser ? displayUser.productivityScore : timeMotionData.summary.avgProductivityScore}%
          </div>
        </div>

        <div style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ fontSize: '13px', color: colors.gray[600], marginBottom: '8px' }}>
            Customer Visits
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.primary[500] }}>
            {displayUser ? displayUser.totalVisits : timeMotionData.summary.totalVisits}
          </div>
          <div style={{ fontSize: '11px', color: colors.gray[500], marginTop: '4px' }}>
            Total visits today
          </div>
        </div>

        <div style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ fontSize: '13px', color: colors.gray[600], marginBottom: '8px' }}>
            Travel Time
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.primary[500] }}>
            {displayUser ? formatTime(displayUser.travelMinutes) : formatTime(timeMotionData.summary.totalTravelMinutes)}
          </div>
          <div style={{ fontSize: '11px', color: colors.gray[500], marginTop: '4px' }}>
            Total travel duration
          </div>
        </div>
      </div>
    </div>
  )
}