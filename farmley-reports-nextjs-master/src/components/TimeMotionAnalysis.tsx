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
        `/api/field-operations/time-motion-simple?date=${date}&salesman=${selectedSalesman}`
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
    : timeMotionData.users.find((user: any) => user.code === selectedSalesman) || timeMotionData.users[0]

  const displayUser = selectedSalesman === 'all' ? null : selectedUser

  // Format time helper
  const formatTime = (minutes: number | undefined) => {
    if (minutes === undefined || minutes === null || isNaN(minutes)) return '0h 0m'
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}h ${mins}m`
  }

  // Convert hours to minutes for display
  const convertHoursToMinutes = (hours: number | undefined) => {
    if (hours === undefined || hours === null || isNaN(hours)) return 0
    return Math.round(hours * 60)
  }

  // Time distribution data using REAL API data
  const timeDistribution = displayUser ? [
    { name: 'Customer Time', value: displayUser.totalTimeSpent || 0, color: '#10B981' },
    { name: 'Travel Time', value: displayUser.travelTimeMinutes || 0, color: '#3B82F6' }
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
          Analyzing: {displayUser.name}
        </div>
      )}

      {/* Time breakdown cards */}
      <div style={{ ...styles.gridTemplate(4, 2), marginBottom: isMobile ? '16px' : '24px' }}>
        {/* Customer Time */}
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
            <span style={{ fontSize: '14px', color: colors.gray[700] }}>Customer Time</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.gray[900] }}>
            {displayUser ? formatTime(displayUser.totalTimeSpent) : formatTime(convertHoursToMinutes(timeMotionData.summary.totalWorkingHours))}
          </div>
          <div style={{ fontSize: '12px', color: colors.gray[500] }}>
            {displayUser ? `${displayUser.productivityRate || 100}% productive visits` : `Total across all users`}
          </div>
        </div>

        {/* Travel Time */}
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
            <span style={{ fontSize: '14px', color: colors.gray[700] }}>Travel Time</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.gray[900] }}>
            {displayUser ? formatTime(displayUser.travelTimeMinutes || 0) : formatTime(0)}
          </div>
          <div style={{ fontSize: '12px', color: colors.gray[500] }}>
            {displayUser ? `${displayUser.travelPercentage || 0}% of field time` : `Total across all users`}
          </div>
        </div>

        {/* Working Hours */}
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
            <span style={{ fontSize: '14px', color: colors.gray[700] }}>Working Hours</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.gray[900] }}>
            {displayUser ? formatTime(convertHoursToMinutes(displayUser.workingHours)) : formatTime(convertHoursToMinutes(timeMotionData.summary.totalWorkingHours))}
          </div>
          <div style={{ fontSize: '12px', color: colors.gray[500] }}>
            {displayUser ? `Total hours worked` : `Total across all users`}
          </div>
        </div>

        {/* Visits */}
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
            <span style={{ fontSize: '14px', color: colors.gray[700] }}>Customer Visits</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.gray[900] }}>
            {displayUser ? displayUser.totalVisits : timeMotionData.summary.totalVisits}
          </div>
          <div style={{ fontSize: '12px', color: colors.gray[500] }}>
            {displayUser ? `${displayUser.avgVisitDuration}min avg duration` : `Total across all users`}
          </div>
        </div>
      </div>


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
                      {displayUser && displayUser.totalFieldTimeMinutes > 0 ?
                        ((item.value / displayUser.totalFieldTimeMinutes) * 100).toFixed(0) + '%' :
                        '0%'
                      }
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

        {/* Hourly Visit Activity */}
        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: colors.gray[800] }}>
            Hourly Visit Activity
          </h4>

          {/* Legend */}
          <div style={{
            display: 'flex',
            gap: '24px',
            marginBottom: '16px',
            fontSize: '12px',
            color: colors.gray[600]
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: '#10B981',
                borderRadius: '2px'
              }} />
              <span>Productive Visits</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: '#F59E0B',
                borderRadius: '2px'
              }} />
              <span>Non-Productive Visits</span>
            </div>
          </div>

          {timeMotionData.hourlyBreakdown && timeMotionData.hourlyBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={timeMotionData.hourlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.gray[200]} />
                <XAxis
                  dataKey="hour"
                  stroke={colors.gray[400]}
                  tick={{ fill: colors.gray[500], fontSize: 11 }}
                  tickFormatter={(value) => `${value}:00`}
                  label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fontSize: '10px', fill: colors.gray[500] } }}
                />
                <YAxis
                  stroke={colors.gray[400]}
                  tick={{ fill: colors.gray[500], fontSize: 11 }}
                  label={{ value: 'Number of Visits', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '10px', fill: colors.gray[500] } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.background.primary,
                    border: `1px solid ${colors.gray[200]}`,
                    borderRadius: '6px'
                  }}
                  formatter={(value, name) => [
                    `${value} visits`,
                    name === 'productive' ? 'Productive' : 'Non-Productive'
                  ]}
                  labelFormatter={(label) => `${label}:00 - ${label}:59`}
                />
                <Bar dataKey="productive" fill="#10B981" name="productive" />
                <Bar dataKey="nonproductive" fill="#F59E0B" name="nonproductive" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.gray[500] }}>
              No hourly visit data available
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
          <div style={{ fontSize: '28px', fontWeight: '700', color: (displayUser?.productivityRate || 100) > 70 ? colors.success.main : (displayUser?.productivityRate || 100) > 50 ? colors.warning.main : colors.error.main }}>
            {displayUser ? (displayUser.productivityRate || 100) : (timeMotionData.summary.avgProductivityRate || 100)}%
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
            Working Hours
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.primary[500] }}>
            {displayUser ? formatTime(convertHoursToMinutes(displayUser.workingHours)) : formatTime(convertHoursToMinutes(timeMotionData.summary.totalWorkingHours))}
          </div>
          <div style={{ fontSize: '11px', color: colors.gray[500], marginTop: '4px' }}>
            Total working duration
          </div>
        </div>
      </div>
    </div>
  )
}