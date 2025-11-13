'use client'
import React, { useState, useEffect } from 'react'
import { colors } from '../../styles/colors'
import { JourneyCompliance } from '../JourneyCompliance'
import { LiveTrackingView } from '../LiveTrackingView'
import { AnalyticsDashboard } from '../AnalyticsDashboard'
import { Search, MapPin, BarChart3, AlertTriangle, ChevronLeft } from 'lucide-react'

export const FieldOperations: React.FC = () => {
  const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview')
  const [detailTab, setDetailTab] = useState<'map' | 'analytics'>('map')
  const [selectedSalesmanData, setSelectedSalesmanData] = useState<any>(null)
  // Use September 8, 2025 as default since that's where we have real data
  const [selectedDate, setSelectedDate] = useState(() => {
    // Start with date that has data available
    return '2025-09-08'
  })
  const [selectedSalesman, setSelectedSalesman] = useState('all')
  const [selectedRoute, setSelectedRoute] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [salesmen, setSalesmen] = useState<any[]>([])
  const [routes, setRoutes] = useState<{ code: string; name: string }[]>([])
  const [trackingData, setTrackingData] = useState<any>(null)
  const [fieldMetrics, setFieldMetrics] = useState({
    activeFieldForce: 0,
    avgCompliance: 0,
    totalVisitsToday: 0,
    productiveVisits: 0,
    totalDistanceCovered: 0
  })
  const [loading, setLoading] = useState(true)
  const [visitAnalytics, setVisitAnalytics] = useState<any>(null)

  // Tabs only shown in detail view
  const detailTabs = [
    { id: 'map', label: 'Live Tracking', icon: MapPin },
    { id: 'analytics', label: 'Visit Analytics', icon: BarChart3 }
  ]

  // Fetch salesmen data
  useEffect(() => {
    fetchSalesmen()
  }, [selectedDate])

  // CRITICAL FIX: Fetch field metrics AND tracking data when filters change
  useEffect(() => {
    fetchFieldMetrics()
    fetchTrackingData() // Re-fetch tracking data for selected filters
  }, [selectedDate, selectedSalesman, selectedRoute])

  // Reset view mode when changing date
  useEffect(() => {
    setViewMode('overview')
    setSelectedSalesmanData(null)
    setDetailTab('map')
  }, [selectedDate])

  const fetchSalesmen = async () => {
    try {
      console.log(`🔄 Fetching salesmen data for ${selectedDate}`)

      // Get salesmen from tracking API to ensure they have actual visits on this date
      const response = await fetch(`/api/field-operations/tracking?date=${selectedDate}&salesman=all`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Production-grade data validation
      if (!data || !Array.isArray(data.salesmenJourneys) || !Array.isArray(data.visits)) {
        console.error('❌ Invalid tracking data structure:', {
          hasData: !!data,
          hasJourneys: Array.isArray(data.salesmenJourneys),
          hasVisits: Array.isArray(data.visits),
          journeysCount: data.salesmenJourneys?.length || 0,
          visitsCount: data.visits?.length || 0
        })
        setSalesmen([])
        return
      }

      // CRITICAL: Only include salesmen with ACTUAL visits > 0
      const salesmenWithVisits = data.salesmenJourneys
        .filter((journey: any) => {
          // Validate journey data structure
          if (!journey.salesmanId || !journey.salesmanName || typeof journey.totalVisits !== 'number') {
            console.warn('⚠️ Invalid journey data structure:', journey)
            return false
          }

          const hasVisits = journey.totalVisits > 0
          const hasVisitsInArray = data.visits.some((visit: any) =>
            String(visit.userCode) === String(journey.salesmanId) &&
            visit.customerCode &&
            visit.arrivalTime
          )

          // Debug logging for mismatches
          if (hasVisits && !hasVisitsInArray) {
            console.warn(`⚠️ Mismatch for ${journey.salesmanName}: totalVisits=${journey.totalVisits} but no visits in array with userCode=${journey.salesmanId}`)
          }

          // Only include if BOTH conditions are true for production safety
          return hasVisits && hasVisitsInArray
        })
        .map((journey: any) => ({
          code: journey.salesmanId,
          id: journey.salesmanId,
          name: journey.salesmanName || 'Unknown Salesman',
          visits: journey.totalVisits || 0,
          routeName: journey.routeName || 'Unknown Route',
          routeCode: journey.routeCode || journey.salesmanId
        }))

      // Extract unique routes with codes for filtering
      const routeMap = new Map<string, { code: string; name: string }>()
      salesmenWithVisits.forEach(s => {
        if (s.routeName) {
          const key = `${s.routeCode}-${s.routeName}`
          if (!routeMap.has(key)) {
            routeMap.set(key, { code: s.routeCode, name: s.routeName })
          }
        }
      })
      const uniqueRoutes = Array.from(routeMap.values()).sort((a, b) => a.code.localeCompare(b.code))

      setRoutes(uniqueRoutes)

      console.log(`📋 PRODUCTION FILTER: Found ${salesmenWithVisits.length}/${data.salesmenJourneys.length} salesmen with REAL visits on ${selectedDate}`)

      // Production-grade logging for debugging
      if (salesmenWithVisits.length === 0 && data.salesmenJourneys.length > 0) {
        console.warn(`⚠️ NO SALESMEN with real visits found for ${selectedDate}. Available journeys:`,
          data.salesmenJourneys.map((j: any) => `${j.salesmanName} (${j.totalVisits} visits)`).slice(0, 5)
        )
        console.warn('Available visit userCodes:', [...new Set(data.visits.map((v: any) => v.userCode))].slice(0, 10))
      }

      setSalesmen(salesmenWithVisits)

      // CRITICAL: Store the tracking data to pass down to avoid duplicate API calls
      setTrackingData(data)
      console.log('✅ FieldOperations: Stored tracking data for consistent filtering')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Error fetching salesmen with visits:', errorMessage)
      setSalesmen([])
      setTrackingData(null)
    }
  }

  // CRITICAL: Fetch tracking data for the selected salesman specifically
  const fetchTrackingData = async () => {
    try {
      console.log(`🔄 Fetching tracking data for salesman: ${selectedSalesman}, date: ${selectedDate}`)

      // Build the correct API URL with all filter parameters
      const params = new URLSearchParams({
        date: selectedDate,
        salesman: selectedSalesman === 'all' ? 'all' : selectedSalesman,
        ...(selectedRoute !== 'all' && { route: selectedRoute })
      })
      const apiUrl = `/api/field-operations/tracking?${params.toString()}`

      console.log(`📡 API Call: ${apiUrl}`)

      const response = await fetch(apiUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Production-grade data validation
      if (!data || !Array.isArray(data.salesmenJourneys) || !Array.isArray(data.visits)) {
        console.error('❌ Invalid tracking data structure for selected salesman:', {
          hasData: !!data,
          hasJourneys: Array.isArray(data.salesmenJourneys),
          hasVisits: Array.isArray(data.visits),
          selectedSalesman,
          journeysCount: data.salesmenJourneys?.length || 0,
          visitsCount: data.visits?.length || 0
        })
        setTrackingData(null)
        return
      }

      // For specific salesman, validate that data is actually filtered
      if (selectedSalesman !== 'all') {
        const salesmanJourneys = data.salesmenJourneys.filter(j => String(j.salesmanId) === String(selectedSalesman))
        const salesmanVisits = data.visits.filter(v => String(v.userCode) === String(selectedSalesman))

        console.log(`✅ Tracking data for ${selectedSalesman}: ${salesmanJourneys.length} journeys, ${salesmanVisits.length} visits`)

        // Override with properly filtered data
        const filteredData = {
          ...data,
          salesmenJourneys: salesmanJourneys,
          visits: salesmanVisits,
          summary: {
            ...data.summary,
            activeSalesmen: salesmanJourneys.length > 0 ? 1 : 0,
            totalVisits: salesmanVisits.length,
            productiveVisits: salesmanVisits.filter(v => v.visitStatus === 'productive').length
          }
        }

        setTrackingData(filteredData)
      } else {
        // For 'all' salesmen, use data as-is
        setTrackingData(data)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Error fetching tracking data for salesman:', errorMessage)
      setTrackingData(null)
    }
  }

  const fetchFieldMetrics = async () => {
    setLoading(true)
    try {
      // Build API URL with all filter parameters
      const params = new URLSearchParams({ date: selectedDate })
      if (selectedSalesman !== 'all') params.append('salesmanCode', selectedSalesman)
      if (selectedRoute !== 'all') params.append('route', selectedRoute)

      const response = await fetch(`/api/field-operations/summary?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        // Map the response to fieldMetrics structure - ONLY REAL DATA
        setFieldMetrics({
          activeFieldForce: data.activeSalesmen || 0,
          avgCompliance: data.avgCompliance || 0,
          totalVisitsToday: data.totalVisits || 0,
          productiveVisits: data.productiveVisits || 0,
          totalDistanceCovered: data.totalDistanceCovered || 0
        })
      }
    } catch (error) {
      console.error('Error fetching field metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSalesmanSelect = (salesman: any) => {
    console.log('Selected salesman for tracking:', salesman)
    setSelectedSalesmanData({
      userCode: salesman.userCode || salesman.salesmanId,
      userName: salesman.salesmanName || salesman.name,
      routeName: salesman.routeName || 'Unknown Route',
      routeCode: salesman.routeCode || salesman.salesmanId,
      journeyStatus: salesman.journeyStatus || 'completed'
    })
    setViewMode('detail')
    setDetailTab('map')
  }

  const handleBackToOverview = () => {
    setViewMode('overview')
    setSelectedSalesmanData(null)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  return (
    <div style={{ padding: '24px', backgroundColor: colors.background.secondary, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px', color: colors.gray[900] }}>
              Field Operations
            </h1>
            <p style={{ color: colors.gray[500], fontSize: '15px' }}>
              Real-time tracking and analysis of field force activities
            </p>
          </div>
        </div>

        {/* Enhanced Filters Section */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '20px',
          backgroundColor: colors.background.primary,
          borderRadius: '12px',
          marginTop: '20px',
          border: `1px solid ${colors.gray[200]}`
        }}>
          {/* Single Row - Date, Search, and Filters */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Date Selector */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1px solid ${colors.gray[300]}`,
                backgroundColor: 'white',
                fontSize: '14px',
                color: colors.gray[700],
                minWidth: '160px'
              }}
            />

            {/* Search Bar with reduced width */}
            <div style={{ width: '280px', position: 'relative' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search salesman or route..."
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 40px',
                  borderRadius: '8px',
                  border: `1px solid ${colors.gray[300]}`,
                  backgroundColor: 'white',
                  fontSize: '14px',
                  color: colors.gray[700]
                }}
              />
              <Search style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: colors.gray[400],
                width: '18px',
                height: '18px'
              }} />
            </div>

            {/* Salesman Filter */}
            <select
              value={selectedSalesman}
              onChange={(e) => setSelectedSalesman(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1px solid ${colors.gray[300]}`,
                backgroundColor: 'white',
                fontSize: '14px',
                color: colors.gray[700],
                minWidth: '200px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}
            >
              <option value="all">
                All Salesmen ({salesmen?.length || 0} available)
              </option>
              {salesmen && salesmen.length > 0 ? (
                salesmen.map((sm, index) => (
                  <option key={`salesman-${sm.code || sm.id}-${index}-${selectedDate}`} value={sm.code || sm.id}>
                    {sm.name || 'Unknown'} ({sm.visits || 0} visits)
                  </option>
                ))
              ) : (
                <option disabled>No salesmen worked on {new Date(selectedDate).toLocaleDateString()}</option>
              )}
            </select>

            {/* Route Filter */}
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1px solid ${colors.gray[300]}`,
                backgroundColor: 'white',
                fontSize: '14px',
                color: colors.gray[700],
                minWidth: '220px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}
            >
              <option value="all">
                All Routes ({routes?.length || 0} available)
              </option>
              {routes && routes.length > 0 ? (
                routes.map((route, index) => (
                  <option key={`route-${route.code}-${index}`} value={route.name}>
                    {route.code} - {route.name}
                  </option>
                ))
              ) : (
                <option disabled>No routes active on {new Date(selectedDate).toLocaleDateString()}</option>
              )}
            </select>

            {/* Quick Date Navigation */}
            {salesmen.length === 0 && !loading && (
              <button
                onClick={() => setSelectedDate('2025-09-08')}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  backgroundColor: colors.primary[500],
                  color: 'white',
                  border: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  marginLeft: 'auto'
                }}
                title="Jump to latest date with data (Sept 8, 2025)"
              >
                Latest Data (Sept 8)
              </button>
            )}
          </div>

          {/* KPI Cards - Integrated with filters */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px',
            marginTop: '8px'
          }}>
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: colors.background.secondary,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: colors.gray[900] }}>
                {formatNumber(fieldMetrics.activeFieldForce)}
              </div>
              <div style={{ fontSize: '11px', color: colors.gray[500], marginTop: '4px' }}>
                Active Field Force
              </div>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: colors.background.secondary,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: colors.success.main }}>
                {formatNumber(fieldMetrics.productiveVisits)}
              </div>
              <div style={{ fontSize: '11px', color: colors.gray[500], marginTop: '4px' }}>
                Productive Visits
              </div>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: colors.background.secondary,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: colors.gray[900] }}>
                {fieldMetrics.avgCompliance.toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: colors.gray[500], marginTop: '4px' }}>
                Journey Compliance
              </div>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: colors.background.secondary,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: colors.gray[900] }}>
                {formatNumber(fieldMetrics.totalVisitsToday)}
              </div>
              <div style={{ fontSize: '11px', color: colors.gray[500], marginTop: '4px' }}>
                Total Visits
              </div>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: colors.background.secondary,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: colors.success.main }}>
                {fieldMetrics.totalVisitsToday > 0
                  ? Math.round((fieldMetrics.productiveVisits / fieldMetrics.totalVisitsToday) * 100)
                  : 0}%
              </div>
              <div style={{ fontSize: '11px', color: colors.gray[500], marginTop: '4px' }}>
                Productive Calls
              </div>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: colors.background.secondary,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: colors.gray[900] }}>
                {formatNumber(fieldMetrics.totalDistanceCovered)}
                <span style={{ fontSize: '14px', fontWeight: '400' }}> km</span>
              </div>
              <div style={{ fontSize: '11px', color: colors.gray[500], marginTop: '4px' }}>
                Distance Covered
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* No Data Message */}
      {!loading && salesmen.length === 0 && (
        <div style={{
          padding: '16px',
          marginBottom: '16px',
          borderRadius: '8px',
          backgroundColor: colors.warning.light,
          border: `1px solid ${colors.warning.main}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ width: '20px', height: '20px', color: colors.warning.main }} />
            <span style={{ color: colors.warning.dark, fontSize: '14px', fontWeight: '500' }}>
              No salesmen worked on {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
              Only salesmen with actual visits on the selected date are shown. Try selecting a different date or click "Latest Data (Sept 8)" to view recent activity.
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'overview' ? (
        /* Journey Compliance Overview - Default View */
        <div style={{
          backgroundColor: colors.background.primary,
          borderRadius: '12px',
          padding: '24px',
          border: `1px solid ${colors.gray[200]}`,
          minHeight: '600px'
        }}>
          <JourneyCompliance
            salesmen={salesmen}
            selectedSalesman={selectedSalesman}
            date={selectedDate}
            selectedRoute={selectedRoute}
            searchQuery={searchQuery}
            onSalesmanSelect={handleSalesmanSelect}
          />
        </div>
      ) : (
        /* Salesman Detail View with Tabs */
        <div>
          {/* Header with Back Button and Salesman Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            padding: '16px 20px',
            backgroundColor: colors.background.primary,
            borderRadius: '8px',
            border: `1px solid ${colors.gray[200]}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={handleBackToOverview}
                style={{
                  padding: '8px 16px',
                  backgroundColor: colors.primary[500],
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <ChevronLeft style={{ width: '16px', height: '16px', marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
                Back to All Salesmen
              </button>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.gray[900], margin: 0 }}>
                  {selectedSalesmanData?.userName || 'Selected Salesman'}
                </h2>
                <p style={{ fontSize: '14px', color: colors.gray[600], margin: 0 }}>
                  Route: {selectedSalesmanData?.routeCode ? `${selectedSalesmanData.routeCode} - ${selectedSalesmanData?.routeName || 'Unknown Route'}` : selectedSalesmanData?.routeName || 'Unknown Route'}
                </p>
              </div>
            </div>
            <div style={{
              padding: '6px 12px',
              borderRadius: '16px',
              backgroundColor: colors.success.light,
              color: colors.success.dark,
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'capitalize'
            }}>
              {selectedSalesmanData?.journeyStatus || 'completed'}
            </div>
          </div>

          {/* Tab Navigation for Detail View */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            borderBottom: `2px solid ${colors.gray[200]}`,
            paddingBottom: '0'
          }}>
            {detailTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setDetailTab(tab.id as 'map' | 'analytics')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: detailTab === tab.id ? `2px solid ${colors.primary[500]}` : '2px solid transparent',
                  color: detailTab === tab.id ? colors.primary[500] : colors.gray[500],
                  fontWeight: detailTab === tab.id ? '600' : '400',
                  cursor: 'pointer',
                  marginBottom: '-2px',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {React.createElement(tab.icon, { size: 18 })}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{
            backgroundColor: colors.background.primary,
            borderRadius: '12px',
            padding: '24px',
            border: `1px solid ${colors.gray[200]}`,
            minHeight: '600px'
          }}>
            {detailTab === 'map' ? (
              <LiveTrackingView
                selectedSalesman={selectedSalesmanData}
                date={selectedDate}
                onBack={handleBackToOverview}
                hideHeader={true}
              />
            ) : (
              <AnalyticsDashboard
                salesmen={salesmen}
                selectedSalesman={selectedSalesmanData?.userCode || 'all'}
                date={selectedDate}
              />
            )}
          </div>
        </div>
      )}

      {/* Add CSS animation for pulse */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}