'use client'
import React, { useState, useEffect } from 'react'
import { colors } from '../styles/colors'
import { SalesmanTrackingMap } from './SalesmanTrackingMap'

interface MapPlaceholderProps {
  salesmen: any[]
  selectedSalesman: string
  date: string
  trackingData?: any
}

export const MapPlaceholder: React.FC<MapPlaceholderProps> = ({ salesmen, selectedSalesman, date, trackingData: parentTrackingData }) => {
  const [trackingData, setTrackingData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If parent provides tracking data, use it instead of fetching
    if (parentTrackingData) {
      console.log('✅ MapPlaceholder: Using parent tracking data (no duplicate API call)')
      setTrackingData(parentTrackingData)
      setLoading(false)
    } else {
      console.log('⚠️ MapPlaceholder: No parent data, fetching independently')
      fetchTrackingData()
    }
  }, [date, selectedSalesman, parentTrackingData])

  const fetchTrackingData = async () => {
    setLoading(true)
    try {
      console.log(`🔄 MapPlaceholder fetching tracking data: date=${date}, salesman=${selectedSalesman}`)

      // CRITICAL FIX: Use correct parameter name based on selection
      const apiUrl = selectedSalesman === 'all'
        ? `/api/field-operations/tracking?date=${date}&salesman=all`
        : `/api/field-operations/tracking?date=${date}&salesmanCode=${selectedSalesman}`

      console.log(`📡 MapPlaceholder API Call: ${apiUrl}`)

      const response = await fetch(apiUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Production-grade data validation for MapPlaceholder
      if (!data) {
        console.warn('⚠️ MapPlaceholder: Empty response from tracking API')
        setTrackingData(null)
        return
      }

      // Validate data structure
      const hasValidStructure = (
        data.summary &&
        Array.isArray(data.salesmenJourneys) &&
        Array.isArray(data.visits)
      )

      if (!hasValidStructure) {
        console.error('❌ MapPlaceholder: Invalid data structure:', {
          hasSummary: !!data.summary,
          journeysCount: Array.isArray(data.salesmenJourneys) ? data.salesmenJourneys.length : 'not array',
          visitsCount: Array.isArray(data.visits) ? data.visits.length : 'not array'
        })
        setTrackingData(null)
        return
      }

      // Additional validation for production safety
      const validatedData = {
        ...data,
        summary: {
          activeSalesmen: Math.max(0, parseInt(data.summary?.activeSalesmen || 0)),
          productiveVisits: Math.max(0, parseInt(data.summary?.productiveVisits || 0)),
          totalVisits: Math.max(0, parseInt(data.summary?.totalVisits || 0))
        },
        salesmenJourneys: data.salesmenJourneys.filter((journey: any) =>
          journey.salesmanId &&
          journey.salesmanName &&
          typeof journey.totalVisits === 'number'
        ),
        visits: data.visits.filter((visit: any) =>
          visit.userCode &&
          visit.customerCode &&
          visit.customerName &&
          visit.arrivalTime
        )
      }

      console.log(`✅ MapPlaceholder validated data: ${validatedData.salesmenJourneys.length} journeys, ${validatedData.visits.length} visits, ${validatedData.summary.totalVisits} total`)
      setTrackingData(validatedData)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ MapPlaceholder: Error fetching tracking data:', errorMessage)
      setTrackingData(null)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return colors.success.main
      case 'productive': return colors.primary[500]
      case 'non-productive': return colors.warning.main
      default: return colors.gray[400]
    }
  }

  const formatTime = (timeString: string) => {
    if (!timeString) return '--:--'
    try {
      const date = new Date(timeString)
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return timeString
    }
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '600px',
      backgroundColor: colors.background.secondary,
      border: `2px solid ${colors.gray[200]}`,
      borderRadius: '8px',
      padding: '24px'
    }}>
      {/* Google Maps with Real Journey Tracking */}
      <div style={{ marginBottom: '24px' }}>
        <SalesmanTrackingMap
          salesmen={salesmen}
          selectedSalesman={selectedSalesman}
          date={date}
          trackingData={trackingData}
        />
      </div>

      {/* Tracking Summary */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: '600', color: colors.gray[800], marginBottom: '16px' }}>
          Live Tracking Summary
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: colors.background.primary,
            border: `1px solid ${colors.gray[200]}`
          }}>
            <div style={{ fontSize: '20px', fontWeight: '600', color: colors.gray[900] }}>
              {trackingData?.summary?.activeSalesmen || 0}
            </div>
            <div style={{ fontSize: '12px', color: colors.gray[500] }}>Active Salesmen</div>
          </div>
          <div style={{
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: colors.background.primary,
            border: `1px solid ${colors.gray[200]}`
          }}>
            <div style={{ fontSize: '20px', fontWeight: '600', color: colors.success.main }}>
              {trackingData?.summary?.productiveVisits || 0}
            </div>
            <div style={{ fontSize: '12px', color: colors.gray[500] }}>Productive Visits</div>
          </div>
          <div style={{
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: colors.background.primary,
            border: `1px solid ${colors.gray[200]}`
          }}>
            <div style={{ fontSize: '20px', fontWeight: '600', color: colors.primary[500] }}>
              {trackingData?.summary?.totalVisits || 0}
            </div>
            <div style={{ fontSize: '12px', color: colors.gray[500] }}>Total Visits Today</div>
          </div>
        </div>
      </div>

      {/* Recent Visits Table */}
      <div>
        <h4 style={{ fontSize: '16px', fontWeight: '600', color: colors.gray[800], marginBottom: '16px' }}>
          Recent Customer Visits
        </h4>
        <div style={{
          backgroundColor: colors.background.primary,
          borderRadius: '8px',
          border: `1px solid ${colors.gray[200]}`,
          overflow: 'hidden'
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: colors.gray[500] }}>
              Loading tracking data...
            </div>
          ) : !trackingData?.visits || trackingData.visits.length === 0 ? (
            // If visits array is empty, try to use journey data
            trackingData?.salesmenJourneys && trackingData.salesmenJourneys.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${colors.gray[200]}` }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                      Salesman
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                      Customer
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                      Route
                    </th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                      Arrival
                    </th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                      Departure
                    </th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                      Duration
                    </th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trackingData.salesmenJourneys.slice(0, 5).map((journey: any, journeyIndex: number) =>
                    journey.journey.slice(-5).reverse().map((visit: any, visitIndex: number) => (
                      <tr key={`journey-${journey.salesmanId}-${journeyIndex}-visit-${visitIndex}-${visit.customerCode}-${visit.arrivalTime}-${date}`} style={{ borderBottom: `1px solid ${colors.gray[100]}` }}>
                        <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[700] }}>
                          {journey.salesmanName}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[700] }}>
                          {visit.customerName}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[600] }}>
                          {journey.routeName}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[600], textAlign: 'center' }}>
                          {formatTime(visit.arrivalTime)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[600], textAlign: 'center' }}>
                          {visit.departureTime ? formatTime(visit.departureTime) : '-'}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[600], textAlign: 'center' }}>
                          {visit.durationMinutes > 0 ? `${visit.durationMinutes} min` : '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500',
                            backgroundColor: visit.isProductive ? colors.success.light : colors.warning.light,
                            color: visit.isProductive ? colors.success.dark : colors.warning.dark
                          }}>
                            {visit.isProductive ? 'PRODUCTIVE' : 'NON-PRODUCTIVE'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ).flat().slice(0, 10)}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: colors.gray[500] }}>
                No visits recorded for the selected date
              </div>
            )
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.gray[200]}` }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                    Salesman
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                    Customer
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                    Route
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                    Arrival
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                    Departure
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                    Duration
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {trackingData.visits.slice(0, 10).map((visit: any, index: number) => (
                  <tr key={`visit-${index}-${visit.userCode}-${visit.customerCode}-${visit.arrivalTime}-${date}-${selectedSalesman}`} style={{ borderBottom: `1px solid ${colors.gray[100]}` }}>
                    <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[700] }}>
                      {visit.userName}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[700] }}>
                      {visit.customerName}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[600] }}>
                      {visit.routeName}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[600], textAlign: 'center' }}>
                      {formatTime(visit.arrivalTime)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[600], textAlign: 'center' }}>
                      {visit.departureTime ? formatTime(visit.departureTime) : '-'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[600], textAlign: 'center' }}>
                      {visit.duration > 0 ? `${visit.duration} min` : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500',
                        backgroundColor: visit.visitStatus === 'active' ? colors.success.light :
                                       visit.visitStatus === 'productive' ? colors.primary[50] :
                                       colors.warning.light,
                        color: visit.visitStatus === 'active' ? colors.success.dark :
                               visit.visitStatus === 'productive' ? colors.primary[600] :
                               colors.warning.dark
                      }}>
                        {visit.visitStatus.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}