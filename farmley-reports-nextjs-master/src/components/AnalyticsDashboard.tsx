'use client'
import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { colors, CHART_COLORS } from '../styles/colors'
import { useResponsive } from '@/hooks/useResponsive'

interface AnalyticsDashboardProps {
  salesmen: any[]
  selectedSalesman: string
  date: string
}

interface TimeMotionData {
  users: any[]
  hourlyBreakdown: any[]
  summary: any
}

interface VisitAnalyticsData {
  summary: any
  customerTypeAnalytics: any[]
  bestVisitingTimes: any[]
  performanceTrend: any[]
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  salesmen,
  selectedSalesman,
  date
}) => {
  const { isMobile, styles } = useResponsive()
  const [timeMotionData, setTimeMotionData] = useState<TimeMotionData | null>(null)
  const [visitAnalytics, setVisitAnalytics] = useState<VisitAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalyticsData()
  }, [date, selectedSalesman])

  const fetchAnalyticsData = async () => {
    setLoading(true)
    try {
      // Fetch both Time & Motion and Visit Analytics data in parallel
      const [timeMotionResponse, visitAnalyticsResponse] = await Promise.all([
        fetch(`/api/field-operations/time-motion-simple?date=${date}&salesman=${selectedSalesman}`),
        fetch(`/api/field-operations/visit-analytics?date=${date}&salesmanCode=${selectedSalesman}`)
      ])

      if (timeMotionResponse.ok) {
        const timeMotionResult = await timeMotionResponse.json()
        setTimeMotionData(timeMotionResult)
      }

      if (visitAnalyticsResponse.ok) {
        const visitAnalyticsResult = await visitAnalyticsResponse.json()
        setVisitAnalytics(visitAnalyticsResult.data)
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (minutes: number | undefined) => {
    if (minutes === undefined || minutes === null || isNaN(minutes)) return '0h 0m'
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}h ${mins}m`
  }

  const selectedUser = selectedSalesman === 'all'
    ? timeMotionData?.summary
    : timeMotionData?.users?.find((user: any) => user.code === selectedSalesman) || timeMotionData?.users?.[0]

  const displayUser = selectedSalesman === 'all' ? null : selectedUser

  // Time distribution data for pie chart
  const timeDistribution = displayUser ? [
    { name: 'Customer Time', value: displayUser.totalTimeSpent || 0, color: '#10B981' },
    { name: 'Travel Time', value: displayUser.travelTimeMinutes || 0, color: '#3B82F6' }
  ].filter(item => item.value > 0) : []

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        color: colors.gray[500]
      }}>
        Loading analytics data...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>

      {/* Header */}
      <div style={{
        ...styles.cardPadding(),
        backgroundColor: colors.background.secondary,
        borderRadius: '8px',
        border: `1px solid ${colors.gray[200]}`
      }}>
        <h2 style={{ ...styles.heading('20px', '18px'), color: colors.gray[900], margin: 0 }}>
          Analytics Dashboard
        </h2>
        <p style={{ ...styles.fontSize('14px', '13px'), color: colors.gray[600], margin: '4px 0 0 0' }}>
          {new Date(date).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
          })} - {selectedSalesman === 'all' ? 'All Salesmen' : displayUser?.name || 'Selected Salesman'}
        </p>
      </div>

      {/* Top Row - Key Metrics */}
      <div style={{ ...styles.gridTemplate(5, 2) }}>

        {/* Time & Motion Metrics */}
        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', ...styles.gap('8px', '6px'), marginBottom: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span style={{ ...styles.fontSize('14px', '13px'), color: colors.gray[700] }}>Customer Time</span>
          </div>
          <div style={{ ...styles.fontSize('24px', '20px'), fontWeight: '700', color: colors.gray[900] }}>
            {displayUser ? formatTime(displayUser.totalTimeSpent) : formatTime(timeMotionData?.summary?.totalWorkingHours * 60)}
          </div>
          <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500] }}>
            {displayUser ? `${displayUser.productivityRate || 100}% productive` : 'Total time'}
          </div>
        </div>

        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', ...styles.gap('8px', '6px'), marginBottom: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3B82F6' }} />
            <span style={{ ...styles.fontSize('14px', '13px'), color: colors.gray[700] }}>Travel Time</span>
          </div>
          <div style={{ ...styles.fontSize('24px', '20px'), fontWeight: '700', color: colors.gray[900] }}>
            {displayUser ? formatTime(displayUser.travelTimeMinutes || 0) : formatTime(0)}
          </div>
          <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500] }}>
            {displayUser ? `${displayUser.travelPercentage || 0}% of field time` : 'Total travel'}
          </div>
        </div>

        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', ...styles.gap('8px', '6px'), marginBottom: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
            <span style={{ ...styles.fontSize('14px', '13px'), color: colors.gray[700] }}>Working Hours</span>
          </div>
          <div style={{ ...styles.fontSize('24px', '20px'), fontWeight: '700', color: colors.gray[900] }}>
            {displayUser ? formatTime(displayUser.totalFieldTimeMinutes || 0) : formatTime((timeMotionData?.summary?.totalWorkingHours || 0) * 60)}
          </div>
          <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500] }}>
            Field time
          </div>
        </div>

        {/* Visit Analytics Metrics */}
        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', ...styles.gap('8px', '6px'), marginBottom: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366F1' }} />
            <span style={{ ...styles.fontSize('14px', '13px'), color: colors.gray[700] }}>Total Visits</span>
          </div>
          <div style={{ ...styles.fontSize('24px', '20px'), fontWeight: '700', color: colors.gray[900] }}>
            {visitAnalytics?.summary?.totalVisits || 0}
          </div>
          <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500] }}>
            {visitAnalytics?.summary?.productiveVisits || 0} productive
          </div>
        </div>

        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', ...styles.gap('8px', '6px'), marginBottom: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EC4899' }} />
            <span style={{ ...styles.fontSize('14px', '13px'), color: colors.gray[700] }}>Avg Duration</span>
          </div>
          <div style={{ ...styles.fontSize('24px', '20px'), fontWeight: '700', color: colors.gray[900] }}>
            {visitAnalytics?.summary?.avgVisitDuration || 0} min
          </div>
          <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500] }}>
            Per visit
          </div>
        </div>
      </div>

      {/* Middle Row - Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '300px 1fr',
        gap: isMobile ? '16px' : '24px'
      }}>

        {/* Time Distribution Pie Chart */}
        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <h4 style={{ ...styles.heading('16px', '15px'), marginBottom: isMobile ? '16px' : '20px', color: colors.gray[800] }}>
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
                      <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: item.color }} />
                      <span style={{ fontSize: '12px', color: colors.gray[600] }}>{item.name}</span>
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
              No time data available
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
          <h4 style={{ ...styles.heading('16px', '15px'), marginBottom: isMobile ? '16px' : '20px', color: colors.gray[800] }}>
            Hourly Activity
          </h4>
          {timeMotionData?.hourlyBreakdown && timeMotionData.hourlyBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timeMotionData.hourlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.gray[200]} />
                <XAxis dataKey="hour" tickFormatter={(value) => `${value}:00`} stroke={colors.gray[400]} tick={{ fill: colors.gray[500], fontSize: 11 }} />
                <YAxis stroke={colors.gray[400]} tick={{ fill: colors.gray[500], fontSize: 11 }} />
                <Tooltip labelFormatter={(label) => `${label}:00 - ${label}:59`} />
                <Bar dataKey="productive" fill="#10B981" name="Productive Visits" />
                <Bar dataKey="nonproductive" fill="#F59E0B" name="Non-Productive Visits" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.gray[500] }}>
              No hourly data available
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row - Customer Type Analytics */}
      <div style={{ ...styles.gridTemplate(3, 1) }}>

        {/* Customer Type Visit Duration */}
        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <h4 style={{ ...styles.heading('16px', '15px'), marginBottom: isMobile ? '16px' : '20px', color: colors.gray[800] }}>
            Visit Duration by Customer Type
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {visitAnalytics?.customerTypeAnalytics?.map((item: any, index: number) => (
              <div key={item.type} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                backgroundColor: colors.background.primary,
                borderRadius: '8px',
                border: `1px solid ${colors.gray[100]}`,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: [
                      '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#9CA3AF'
                    ][index % 6]
                  }} />
                  <span style={{ fontSize: '13px', fontWeight: '500', color: colors.gray[800] }}>
                    {item.type}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    backgroundColor: [
                      '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#9CA3AF'
                    ][index % 6],
                    color: 'white',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    minWidth: '45px',
                    textAlign: 'center'
                  }}>
                    {Math.round(item.avgDuration)} min
                  </div>
                  <span style={{ fontSize: '10px', color: colors.gray[500] }}>
                    ({item.uniqueCustomers} customers)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best Visiting Times */}
        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <h4 style={{ ...styles.heading('16px', '15px'), marginBottom: isMobile ? '16px' : '20px', color: colors.gray[800] }}>
            Best Visiting Times
          </h4>
          {visitAnalytics?.bestVisitingTimes && visitAnalytics.bestVisitingTimes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visitAnalytics.bestVisitingTimes.slice(0, 6).map((time: any, index: number) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  backgroundColor: colors.background.primary,
                  borderRadius: '6px',
                  border: `1px solid ${colors.gray[100]}`
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: colors.gray[800] }}>
                      {time.timeSlot}
                    </div>
                    <div style={{ fontSize: '11px', color: colors.gray[500] }}>
                      {time.totalVisits} visits
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    backgroundColor: time.conversionRate >= 80 ? colors.success.light : time.conversionRate >= 60 ? colors.warning.light : colors.gray[100],
                    color: time.conversionRate >= 80 ? colors.success.dark : time.conversionRate >= 60 ? colors.warning.dark : colors.gray[600],
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {time.conversionRate}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.gray[500] }}>
                No timing data available
              </div>
            </div>
          )}
        </div>

        {/* Performance Summary */}
        <div style={{
          ...styles.cardPadding(),
          borderRadius: '8px',
          backgroundColor: colors.background.secondary,
          border: `1px solid ${colors.gray[200]}`
        }}>
          <h4 style={{ ...styles.heading('16px', '15px'), marginBottom: isMobile ? '16px' : '20px', color: colors.gray[800] }}>
            Performance Summary
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              padding: '16px',
              backgroundColor: colors.background.primary,
              borderRadius: '8px',
              border: `1px solid ${colors.gray[100]}`
            }}>
              <div style={{ fontSize: '13px', color: colors.gray[600], marginBottom: '8px' }}>
                Productivity Score
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: colors.success.main }}>
                {displayUser ? (displayUser.productivityRate || 100) : (timeMotionData?.summary?.avgProductivityRate || 100)}%
              </div>
            </div>

            <div style={{
              padding: '16px',
              backgroundColor: colors.background.primary,
              borderRadius: '8px',
              border: `1px solid ${colors.gray[100]}`
            }}>
              <div style={{ fontSize: '13px', color: colors.gray[600], marginBottom: '8px' }}>
                Conversion Rate
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: colors.primary[500] }}>
                {visitAnalytics?.summary?.conversionRate || 100}%
              </div>
            </div>

            <div style={{
              padding: '16px',
              backgroundColor: colors.background.primary,
              borderRadius: '8px',
              border: `1px solid ${colors.gray[100]}`
            }}>
              <div style={{ fontSize: '13px', color: colors.gray[600], marginBottom: '8px' }}>
                Unique Customers
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: colors.chart.purple }}>
                {visitAnalytics?.summary?.uniqueCustomers || 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}