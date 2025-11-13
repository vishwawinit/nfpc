'use client'
import React, { useState, useEffect } from 'react'
import { colors } from '../styles/colors'
import { SalesmanTrackingMap } from './SalesmanTrackingMap'
import { ChevronLeft, MapPin, CheckCircle, Car, Clock, TrendingUp, DollarSign, Route, Calendar } from 'lucide-react'
import { useResponsive } from '@/hooks/useResponsive'

interface LiveTrackingViewProps {
  selectedSalesman: {
    userCode: string
    userName: string
    routeName: string
    journeyStatus: string
  }
  date: string
  onBack: () => void
  hideHeader?: boolean
}

interface JourneyDetail {
  startTime: string
  endTime: string
  plannedVisits: number
  completedVisits: number
  productiveVisits: number
  totalSales: number
  routeName: string
  journeyStatus: string
}

interface TimelineEntry {
  time: string
  activity: string
  location: string
  duration: number
  type: 'arrival' | 'departure' | 'productive' | 'travel'
}

export const LiveTrackingView: React.FC<LiveTrackingViewProps> = ({
  selectedSalesman,
  date,
  onBack,
  hideHeader = false
}) => {
  const { isMobile, styles } = useResponsive()
  const [journeyDetail, setJourneyDetail] = useState<JourneyDetail | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJourneyDetails()
    fetchTimeline()
  }, [selectedSalesman.userCode, date])

  const fetchJourneyDetails = async () => {
    try {
      // Fetch from tracking API to get actual visit data
      const trackingResponse = await fetch(
        `/api/field-operations/tracking?date=${date}&salesman=${selectedSalesman.userCode}`
      )

      if (trackingResponse.ok) {
        const trackingData = await trackingResponse.json()
        const salesmanJourney = trackingData.salesmenJourneys?.find(
          (j: any) => String(j.salesmanId) === String(selectedSalesman.userCode)
        )

        if (salesmanJourney) {
          // Get visits for this salesman
          const visits = trackingData.visits?.filter(
            (v: any) => String(v.userCode) === String(selectedSalesman.userCode)
          ).sort((a: any, b: any) => {
            return new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime()
          }) || []

          // Journey start = first customer arrival, end = last customer departure
          let startTime = '--:--'
          let endTime = '--:--'

          if (visits.length > 0) {
            const firstVisit = visits[0]
            const lastVisit = visits[visits.length - 1]

            // Journey starts at first customer arrival
            startTime = firstVisit.arrivalTime

            // Journey ends at last customer departure (or arrival if no departure)
            endTime = lastVisit.departureTime || lastVisit.arrivalTime
          }

          setJourneyDetail({
            startTime,
            endTime,
            plannedVisits: salesmanJourney.totalVisits || 0,
            completedVisits: visits.length,
            productiveVisits: visits.filter((v: any) => v.visitStatus === 'productive').length,
            totalSales: visits.reduce((sum: number, v: any) => sum + (v.orderValue || 0), 0),
            routeName: salesmanJourney.routeName || 'Unknown Route',
            journeyStatus: salesmanJourney.status || 'active'
          })
        }
      }
    } catch (error) {
      console.error('Error fetching journey details:', error)
    }
  }

  const fetchTimeline = async () => {
    setLoading(true)
    try {
      // Fetch customer visits for timeline
      const response = await fetch(
        `/api/field-operations/tracking?date=${date}&salesman=${selectedSalesman.userCode}`
      )
      if (response.ok) {
        const data = await response.json()

        // Convert visits to timeline entries
        const visits = data.visits || []
        const timelineEntries: TimelineEntry[] = []

        visits.forEach((visit: any) => {
          // Add arrival entry
          timelineEntries.push({
            time: visit.arrivalTime || visit.arrival_time,
            activity: `Arrived at ${visit.customerName || visit.customer_name}`,
            location: visit.customerName || visit.customer_name,
            duration: visit.duration || 0,
            type: 'arrival'
          })

          // Add departure entry if available
          if (visit.departureTime || visit.departure_time) {
            timelineEntries.push({
              time: visit.departureTime || visit.departure_time,
              activity: visit.isProductive ? 'Completed productive visit' : 'Completed visit',
              location: visit.customerName || visit.customer_name,
              duration: visit.duration || 0,
              type: visit.isProductive ? 'productive' : 'departure'
            })
          }
        })

        // Sort by time
        timelineEntries.sort((a, b) => {
          const timeA = new Date(`2025-01-01 ${a.time}`).getTime()
          const timeB = new Date(`2025-01-01 ${b.time}`).getTime()
          return timeA - timeB
        })

        setTimeline(timelineEntries)
      }
    } catch (error) {
      console.error('Error fetching timeline:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'completed': return colors.success.main
      case 'in progress': return colors.warning.main
      default: return colors.gray[600]
    }
  }

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'arrival': return MapPin
      case 'productive': return CheckCircle
      case 'departure': return Car
      default: return Clock
    }
  }

  const formatTime = (timeString: string) => {
    if (!timeString) return '--:--'
    try {
      if (timeString.includes('T') || timeString.includes(' ')) {
        const time = new Date(timeString)
        return time.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Dubai'
        })
      }
      // If it's already in HH:MM:SS format, convert to 12-hour AM/PM
      const parts = timeString.split(':')
      if (parts.length >= 2) {
        const hour = parseInt(parts[0])
        const minute = parts[1]
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const hour12 = hour % 12 || 12
        return `${hour12}:${minute} ${ampm}`
      }
      return timeString
    } catch {
      return '--:--'
    }
  }

  const calculateJourneyDuration = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return '--'

    try {
      let startDate: Date
      let endDate: Date

      // Handle different time formats
      if (startTime.includes('T') || startTime.includes(' ')) {
        startDate = new Date(startTime)
        endDate = new Date(endTime)
      } else {
        // If it's just time format like "11:17:24", use today's date
        const today = new Date().toDateString()
        startDate = new Date(`${today} ${startTime}`)
        endDate = new Date(`${today} ${endTime}`)

        // Handle case where end time is next day (past midnight)
        if (endDate < startDate) {
          endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
        }
      }

      const durationMs = endDate.getTime() - startDate.getTime()
      const durationMinutes = Math.floor(durationMs / (1000 * 60))

      const hours = Math.floor(durationMinutes / 60)
      const minutes = durationMinutes % 60

      if (hours === 0) {
        return `${minutes}mins`
      } else if (minutes === 0) {
        return `${hours}hrs`
      } else {
        return `${hours}hrs ${minutes}mins`
      }
    } catch (error) {
      console.error('Error calculating journey duration:', error)
      return '--'
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with back button - only show if not hidden */}
      {!hideHeader && (
      <div style={{
        display: 'flex',
        ...styles.flexDirection('row', 'column'),
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        marginBottom: isMobile ? '16px' : '20px',
        ...styles.padding('16px 20px', '12px'),
        backgroundColor: colors.background.secondary,
        borderRadius: '8px',
        border: `1px solid ${colors.gray[200]}`,
        ...styles.gap('16px', '12px')
      }}>
        <div style={{ display: 'flex', alignItems: 'center', ...styles.gap('16px', '12px'), flexWrap: 'wrap' }}>
          <button
            onClick={onBack}
            style={{
              ...styles.padding('8px 16px', '6px 12px'),
              backgroundColor: colors.primary[500],
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              ...styles.fontSize('14px', '13px'),
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <ChevronLeft style={{ width: '16px', height: '16px', marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
            Back to Overview
          </button>
          <div>
            <h2 style={{ ...styles.heading('18px', '16px'), color: colors.gray[900], margin: 0 }}>
              Live Tracking - {selectedSalesman.userName}
            </h2>
            <p style={{ ...styles.fontSize('14px', '13px'), color: colors.gray[600], margin: 0 }}>
              Route: {selectedSalesman.routeName}
            </p>
          </div>
        </div>
        <div style={{
          padding: '6px 12px',
          borderRadius: '16px',
          backgroundColor: getStatusColor(selectedSalesman.journeyStatus),
          color: 'white',
          ...styles.fontSize('12px', '11px'),
          fontWeight: '600',
          textTransform: 'capitalize',
          alignSelf: isMobile ? 'flex-start' : 'center'
        }}>
          {selectedSalesman.journeyStatus}
        </div>
      </div>
      )}

      {/* Map Section */}
      <div style={{
        backgroundColor: colors.background.secondary,
        borderRadius: '8px',
        border: `1px solid ${colors.gray[200]}`,
        marginBottom: '20px',
        overflow: 'hidden'
      }}>
        <SalesmanTrackingMap
          salesmen={[selectedSalesman]}
          selectedSalesman={selectedSalesman.userCode}
          date={date}
        />
      </div>

      {/* Enterprise Journey Summary */}
      {journeyDetail && (
        <div style={{
          marginTop: isMobile ? '16px' : '20px',
          ...styles.padding('24px', '16px'),
          backgroundColor: colors.background.secondary,
          borderRadius: '12px',
          border: `1px solid ${colors.gray[200]}`,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
        }}>
          <div style={{
            display: 'flex',
            ...styles.flexDirection('row', 'column'),
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            marginBottom: isMobile ? '16px' : '24px',
            ...styles.gap('16px', '12px')
          }}>
            <h3 style={{
              ...styles.heading('18px', '16px'),
              fontWeight: '700',
              color: colors.gray[900],
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <TrendingUp size={isMobile ? 18 : 20} />
              Journey Performance Metrics
            </h3>
            <div style={{
              padding: '4px 12px',
              borderRadius: '20px',
              backgroundColor: colors.success.light,
              color: colors.success.dark,
              ...styles.fontSize('12px', '11px'),
              fontWeight: '600'
            }}>
              {Math.round((journeyDetail.completedVisits / journeyDetail.plannedVisits) * 100)}% Completion Rate
            </div>
          </div>

          {/* KPI Grid */}
          <div style={{
            ...styles.gridTemplate(4, 1),
            gap: isMobile ? '12px' : '20px'
          }}>
            {/* Journey Time Card */}
            <div style={{
              ...styles.cardPadding(),
              backgroundColor: colors.background.primary,
              borderRadius: '8px',
              border: `1px solid ${colors.gray[100]}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', ...styles.gap('12px', '8px') }}>
                <div style={{
                  ...(isMobile ? { width: '36px', height: '36px' } : { width: '40px', height: '40px' }),
                  borderRadius: '8px',
                  backgroundColor: colors.primary[100],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Clock size={isMobile ? 18 : 20} color={colors.primary[500]} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500], marginBottom: '4px' }}>Journey Duration</div>
                  <div style={{ ...styles.fontSize('16px', '14px'), fontWeight: '700', color: colors.gray[900], marginBottom: '2px' }}>
                    {formatTime(journeyDetail.startTime)} - {formatTime(journeyDetail.endTime)}
                  </div>
                  <div style={{ ...styles.fontSize('13px', '12px'), fontWeight: '600', color: colors.primary[600] }}>
                    ({calculateJourneyDuration(journeyDetail.startTime, journeyDetail.endTime)})
                  </div>
                </div>
              </div>
            </div>

            {/* Visits Progress Card */}
            <div style={{
              ...styles.cardPadding(),
              backgroundColor: colors.background.primary,
              borderRadius: '8px',
              border: `1px solid ${colors.gray[100]}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', ...styles.gap('12px', '8px') }}>
                <div style={{
                  ...(isMobile ? { width: '36px', height: '36px' } : { width: '40px', height: '40px' }),
                  borderRadius: '8px',
                  backgroundColor: colors.success.light,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CheckCircle size={isMobile ? 18 : 20} color={colors.success.main} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500], marginBottom: '4px' }}>Visit Progress</div>
                  <div style={{ ...styles.fontSize('16px', '14px'), fontWeight: '700', color: colors.gray[900] }}>
                    {journeyDetail.completedVisits}/{journeyDetail.plannedVisits} Completed
                  </div>
                  <div style={{
                    marginTop: '6px',
                    height: '4px',
                    backgroundColor: colors.gray[200],
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(journeyDetail.completedVisits / journeyDetail.plannedVisits) * 100}%`,
                      height: '100%',
                      backgroundColor: colors.success.main,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Productive Visits Card */}
            <div style={{
              ...styles.cardPadding(),
              backgroundColor: colors.background.primary,
              borderRadius: '8px',
              border: `1px solid ${colors.gray[100]}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', ...styles.gap('12px', '8px') }}>
                <div style={{
                  ...(isMobile ? { width: '36px', height: '36px' } : { width: '40px', height: '40px' }),
                  borderRadius: '8px',
                  backgroundColor: colors.warning.light,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <TrendingUp size={isMobile ? 18 : 20} color={colors.warning.main} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500], marginBottom: '4px' }}>Productivity Rate</div>
                  <div style={{ ...styles.fontSize('16px', '14px'), fontWeight: '700', color: colors.gray[900] }}>
                    {journeyDetail.productiveVisits} Productive
                  </div>
                  <div style={{ ...styles.fontSize('12px', '11px'), color: colors.success.main, fontWeight: '600' }}>
                    {journeyDetail.completedVisits > 0
                      ? `${Math.round((journeyDetail.productiveVisits / journeyDetail.completedVisits) * 100)}%`
                      : '0%'
                    } Success Rate
                  </div>
                </div>
              </div>
            </div>

            {/* Total Sales Card */}
            <div style={{
              ...styles.cardPadding(),
              backgroundColor: colors.background.primary,
              borderRadius: '8px',
              border: `1px solid ${colors.gray[100]}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', ...styles.gap('12px', '8px') }}>
                <div style={{
                  ...(isMobile ? { width: '36px', height: '36px' } : { width: '40px', height: '40px' }),
                  borderRadius: '8px',
                  backgroundColor: colors.primary[100],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <DollarSign size={isMobile ? 18 : 20} color={colors.primary[500]} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500], marginBottom: '4px' }}>Total Sales</div>
                  <div style={{ ...styles.fontSize('20px', '16px'), fontWeight: '700', color: colors.primary[600] }}>
                    AED {journeyDetail.totalSales.toLocaleString()}
                  </div>
                  <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500] }}>
                    {journeyDetail.productiveVisits > 0
                      ? `Avg: AED ${Math.round(journeyDetail.totalSales / journeyDetail.productiveVisits).toLocaleString()}`
                      : 'No sales'
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Route Information */}
          <div style={{
            marginTop: isMobile ? '16px' : '20px',
            ...styles.padding('12px 16px', '10px 12px'),
            backgroundColor: colors.gray[50],
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            ...styles.gap('8px', '6px')
          }}>
            <Route size={16} color={colors.gray[600]} />
            <span style={{ ...styles.fontSize('14px', '13px'), color: colors.gray[700] }}>
              <strong>Route:</strong> {journeyDetail.routeName} | <strong>Status:</strong> {journeyDetail.journeyStatus || 'Completed'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}