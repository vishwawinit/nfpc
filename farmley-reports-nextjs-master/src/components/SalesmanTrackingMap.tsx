'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { GoogleMap, Marker, DirectionsRenderer, InfoWindow } from '@react-google-maps/api'
import { colors } from '../styles/colors'
import { Car, MapPin, Building2, Clock, Navigation, CheckCircle, AlertTriangle, DollarSign, Calendar, Download } from 'lucide-react'
import { useResponsive } from '@/hooks/useResponsive'
import ExcelJS from 'exceljs'

interface Journey {
  sequence: number
  customerCode: string
  customerName: string
  latitude: number
  longitude: number
  arrivalTime: string
  departureTime: string | null
  durationMinutes: number
  visitType: string
  callType: string
  isProductive: boolean
}

interface SalesmanJourney {
  salesmanId: string
  salesmanName: string
  routeName: string
  journey: Journey[]
  plannedStartTime?: string
  plannedEndTime?: string
}

interface TrackingData {
  date: string
  salesman: string
  salesmenJourneys: SalesmanJourney[]
  currentLocations: any[]
  summary: any
}

interface SalesmanTrackingMapProps {
  salesmen: any[]
  selectedSalesman: string
  date: string
  trackingData?: any
}

const getContainerStyle = (isMobile: boolean) => ({
  width: '100%',
  height: isMobile ? '400px' : '500px'
})

// Default center will be dynamically calculated from actual customer data
const getDefaultCenter = (trackingData?: any) => {
  // Use first customer location from visits if available
  if (trackingData?.visits?.length > 0 && trackingData.visits[0].latitude && trackingData.visits[0].longitude) {
    return {
      lat: trackingData.visits[0].latitude,
      lng: trackingData.visits[0].longitude
    }
  }
  // Or use first current location
  if (trackingData?.currentLocations?.length > 0) {
    return {
      lat: trackingData.currentLocations[0].latitude,
      lng: trackingData.currentLocations[0].longitude
    }
  }
  // Fallback to Dubai center if no data
  return { lat: 25.2048, lng: 55.2708 }
}

// WARNING: Google Maps requires client-side API key in script URL
// Since domain restrictions are not available, this key is exposed to clients
// Consider: 1) Enabling domain restrictions on the Google Cloud Console
//           2) Setting up usage quotas and alerts to prevent abuse
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

// Global Google Maps loading state management to prevent "already presented" errors
interface GoogleMapsGlobal {
  loadingPromise: Promise<void> | null
  isLoaded: boolean
  isLoading: boolean
  loadAttempts: number
}

// Extend window type for global state
declare global {
  interface Window {
    __GOOGLE_MAPS_STATE__?: GoogleMapsGlobal
  }
}

// Initialize global state
const getGoogleMapsState = (): GoogleMapsGlobal => {
  if (typeof window === 'undefined') {
    return { loadingPromise: null, isLoaded: false, isLoading: false, loadAttempts: 0 }
  }

  if (!window.__GOOGLE_MAPS_STATE__) {
    window.__GOOGLE_MAPS_STATE__ = {
      loadingPromise: null,
      isLoaded: false,
      isLoading: false,
      loadAttempts: 0
    }
  }

  return window.__GOOGLE_MAPS_STATE__
}

// Professional API Key Validation
if (typeof window !== 'undefined' && !GOOGLE_MAPS_API_KEY) {
  console.error('🚫 Google Maps API Key not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.')
}

// Enhanced Google Maps loading check with retry mechanism
const checkGoogleMapsLoaded = (): boolean => {
  const isLoaded = typeof window !== 'undefined' &&
                  window.google &&
                  window.google.maps &&
                  window.google.maps.Map &&
                  window.google.maps.Marker &&
                  window.google.maps.DirectionsService &&
                  window.google.maps.DirectionsRenderer

  if (isLoaded) {
    const state = getGoogleMapsState()
    state.isLoaded = true
    state.isLoading = false
  }

  return isLoaded
}

// Safe Google Maps loader with global state management
const loadGoogleMapsGlobally = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const state = getGoogleMapsState()

    // If already loaded, resolve immediately
    if (state.isLoaded || checkGoogleMapsLoaded()) {
      console.log('✅ Google Maps already loaded globally')
      state.isLoaded = true
      state.isLoading = false
      resolve()
      return
    }

    // If already loading, wait for existing promise
    if (state.loadingPromise) {
      console.log('⏳ Google Maps loading in progress, waiting...')
      state.loadingPromise.then(resolve).catch(reject)
      return
    }

    // Check retry limit
    if (state.loadAttempts >= 3) {
      console.error('❌ Max Google Maps load attempts reached')
      reject(new Error('Maximum Google Maps load attempts exceeded'))
      return
    }

    // Start new loading process
    state.isLoading = true
    state.loadAttempts++

    console.log(`🔄 Loading Google Maps (attempt ${state.loadAttempts}/3)...`)

    // Create loading promise
    state.loadingPromise = new Promise<void>((innerResolve, innerReject) => {
      // Check if script already exists
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)

      if (existingScript) {
        console.log('📜 Google Maps script already in DOM, waiting for load...')

        // Wait for existing script to load
        const checkInterval = setInterval(() => {
          if (checkGoogleMapsLoaded()) {
            clearInterval(checkInterval)
            state.isLoaded = true
            state.isLoading = false
            console.log('✅ Google Maps loaded via existing script')
            innerResolve()
          }
        }, 100)

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval)
          if (!state.isLoaded) {
            console.error('⏰ Google Maps loading timeout')
            state.isLoading = false
            innerReject(new Error('Google Maps loading timeout'))
          }
        }, 10000)

        return
      }

      // Create new script element - NO LoadScript, direct script injection
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,places&loading=async`
      script.async = true
      script.defer = true

      script.onload = () => {
        console.log('✅ Google Maps script loaded successfully')

        // Double-check everything is available
        if (checkGoogleMapsLoaded()) {
          state.isLoaded = true
          state.isLoading = false
          innerResolve()
        } else {
          console.warn('⚠️ Google Maps script loaded but APIs not ready, retrying...')
          setTimeout(() => {
            if (checkGoogleMapsLoaded()) {
              state.isLoaded = true
              state.isLoading = false
              innerResolve()
            } else {
              state.isLoading = false
              innerReject(new Error('Google Maps APIs not available after script load'))
            }
          }, 1000)
        }
      }

      script.onerror = (error) => {
        console.error('❌ Google Maps script failed to load:', error)
        state.isLoading = false
        document.head.removeChild(script)
        innerReject(new Error('Google Maps script failed to load'))
      }

      document.head.appendChild(script)
    })

    // Resolve main promise when inner promise resolves
    state.loadingPromise
      .then(() => {
        state.loadingPromise = null // Clear promise after success
        resolve()
      })
      .catch((error) => {
        state.loadingPromise = null // Clear promise after failure
        state.isLoading = false
        reject(error)
      })
  })
}

export const SalesmanTrackingMap: React.FC<SalesmanTrackingMapProps> = ({
  salesmen,
  selectedSalesman,
  date,
  trackingData: parentTrackingData
}) => {
  const { isMobile, styles } = useResponsive()
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMarker, setSelectedMarker] = useState<any>(null)
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null)
  const [multipleDirections, setMultipleDirections] = useState<google.maps.DirectionsResult[]>([])
  const [selectedJourneyIndex, setSelectedJourneyIndex] = useState(0)
  const [directionsStatus, setDirectionsStatus] = useState<string>('loading')
  const [mapLoaded, setMapLoaded] = useState<boolean>(false)
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState<boolean>(false)
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null)

  // Initialize Google Maps with global state management
  useEffect(() => {
    const initializeGoogleMaps = async () => {
      try {
        // Check if already loaded
        if (checkGoogleMapsLoaded()) {
          console.log('✅ Google Maps already available')
          setGoogleMapsLoaded(true)
          setGoogleMapsError(null)
          return
        }

        console.log('🔄 Initializing Google Maps for SalesmanTrackingMap...')

        // Use global loader to prevent conflicts
        await loadGoogleMapsGlobally()

        setGoogleMapsLoaded(true)
        setGoogleMapsError(null)
        console.log('✅ Google Maps successfully initialized')

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown Google Maps error'
        console.error('❌ Google Maps initialization failed:', errorMessage)
        setGoogleMapsError(errorMessage)
        setGoogleMapsLoaded(false)
      }
    }

    initializeGoogleMaps()
  }, [])

  useEffect(() => {
    // CRITICAL FIX: Use parent tracking data if available to prevent inconsistency
    if (parentTrackingData) {
      console.log('✅ SalesmanTrackingMap: Using parent tracking data (CONSISTENT with FieldOperations filter)')
      setTrackingData(parentTrackingData)
      setLoading(false)
    } else {
      console.log('⚠️ SalesmanTrackingMap: No parent data, fetching independently (potential inconsistency)')
      fetchTrackingData()
    }
  }, [date, selectedSalesman, parentTrackingData])

  const fetchTrackingData = async () => {
    setLoading(true)
    try {
      console.log(`🔄 Fetching tracking data: date=${date}, salesman=${selectedSalesman}`)

      // CRITICAL FIX: Use correct parameter name based on selection
      const apiUrl = selectedSalesman === 'all'
        ? `/api/field-operations/tracking?date=${date}&salesman=all`
        : `/api/field-operations/tracking?date=${date}&salesmanCode=${selectedSalesman}`

      console.log(`📡 SalesmanTrackingMap API Call: ${apiUrl}`)

      const response = await fetch(apiUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Production-grade data validation
      if (!data) {
        console.warn('⚠️ Empty response from tracking API')
        setTrackingData(null)
        return
      }

      // Validate required data structure
      const isValidData = (
        Array.isArray(data.salesmenJourneys) &&
        Array.isArray(data.visits)
      )

      if (!isValidData) {
        console.error('❌ Invalid data structure from tracking API:', {
          journeysCount: Array.isArray(data.salesmenJourneys) ? data.salesmenJourneys.length : 'not array',
          visitsCount: Array.isArray(data.visits) ? data.visits.length : 'not array'
        })
        setTrackingData(null)
        return
      }

      // Additional production validation
      const validatedData = {
        ...data,
        salesmenJourneys: data.salesmenJourneys.filter(journey =>
          journey.salesmanId &&
          journey.salesmanName &&
          typeof journey.totalVisits === 'number'
        ),
        visits: data.visits.filter(visit =>
          visit.userCode &&
          visit.customerCode &&
          visit.latitude &&
          visit.longitude &&
          visit.arrivalTime
        )
      }

      console.log(`✅ Validated tracking data: ${validatedData.salesmenJourneys.length} journeys, ${validatedData.visits.length} visits`)
      setTrackingData(validatedData)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Error fetching tracking data:', errorMessage)
      setTrackingData(null)
    } finally {
      setLoading(false)
    }
  }

  // Calculate map center and bounds using customer visit data
  const mapCenter = useMemo(() => {
    if (!trackingData) return getDefaultCenter()

    const allPoints = []

    // Add all customer visit coordinates (GPS data from database)
    if (trackingData.visits?.length > 0) {
      trackingData.visits.forEach(visit => {
        if (visit.latitude && visit.longitude) {
          allPoints.push({
            lat: visit.latitude,
            lng: visit.longitude
          })
        }
      })
    }

    if (allPoints.length === 0) return getDefaultCenter(trackingData)

    // Calculate optimal center based on all real GPS coordinates
    const avgLat = allPoints.reduce((sum, point) => sum + point.lat, 0) / allPoints.length
    const avgLng = allPoints.reduce((sum, point) => sum + point.lng, 0) / allPoints.length

    return { lat: avgLat, lng: avgLng }
  }, [trackingData])

  // Calculate REAL travel time from actual timestamps
  // Travel Time = Current Visit Arrival - Previous Visit Departure
  const calculateTravelTime = (prevVisit: any, currentVisit: any) => {
    if (!prevVisit || !prevVisit.departureTime || !currentVisit.arrivalTime) {
      return 0
    }

    // REAL travel time = current arrival - previous departure
    const prevDeparture = new Date(prevVisit.departureTime || prevVisit.arrivalTime)
    const currentArrival = new Date(currentVisit.arrivalTime)

    const travelMinutes = Math.round((currentArrival.getTime() - prevDeparture.getTime()) / (1000 * 60))

    // Return 0 if negative (data issue)
    return travelMinutes > 0 ? travelMinutes : 0
  }

  // Get current journey for route visualization with proper chronological sequencing
  const currentJourney = useMemo(() => {
    if (!trackingData?.salesmenJourneys?.length) return null

    let journey = null
    if (selectedSalesman === 'all') {
      journey = trackingData.salesmenJourneys[selectedJourneyIndex] || trackingData.salesmenJourneys[0]
    } else {
      // Find journey matching the selected salesman (ensure string comparison)
      journey = trackingData.salesmenJourneys.find(j => String(j.salesmanId) === String(selectedSalesman))

      if (!journey) {
        console.error(`❌ No journey found for salesman ${selectedSalesman}`)

        // PRODUCTION DEBUG: Show available salesmen to help troubleshoot
        const availableSalesmen = trackingData.salesmenJourneys.map(j => `${j.salesmanName} (${j.salesmanId})`)
        console.error(`Available salesmen in tracking data: ${availableSalesmen.join(', ')}`)

        // PRODUCTION FIX: Check if salesman exists in visits data (alternative source)
        const salesmanInVisits = trackingData.visits?.find(v => String(v.userCode) === String(selectedSalesman))
        if (salesmanInVisits) {
          console.warn(`🔄 FALLBACK: Salesman ${selectedSalesman} found in visits but not in journeys, creating synthetic journey`)

          // Create a synthetic journey from visits data as fallback
          const salesmanVisits = trackingData.visits.filter(v => String(v.userCode) === String(selectedSalesman))

          journey = {
            salesmanId: selectedSalesman,
            salesmanName: salesmanVisits[0]?.userName || `Salesman ${selectedSalesman}`,
            routeName: salesmanVisits[0]?.routeName || `Route ${selectedSalesman}`,
            totalVisits: salesmanVisits.length,
            productiveVisits: salesmanVisits.filter(v => v.visitStatus === 'productive').length,
            totalSales: 0,
            avgDuration: 0,
            startTime: salesmanVisits[0]?.arrivalTime,
            endTime: salesmanVisits[salesmanVisits.length - 1]?.departureTime,
            status: 'active'
          }

          console.log(`✅ Created synthetic journey for ${journey.salesmanName} with ${salesmanVisits.length} visits`)
        } else {
          console.warn(`⚠️ Salesman ${selectedSalesman} not found in visits data - no activity for this date`)

          // CRITICAL FIX: Create empty journey placeholder to prevent crash
          console.log(`🛠️ Creating empty journey placeholder for salesman ${selectedSalesman}`)

          // Try to find salesman name from salesmen prop if available
          const salesmanInfo = salesmen?.find(s => String(s.code || s.id) === String(selectedSalesman))

          journey = {
            salesmanId: selectedSalesman,
            salesmanName: salesmanInfo?.name || `Salesman ${selectedSalesman}`,
            routeName: 'No Route',
            totalVisits: 0,
            productiveVisits: 0,
            totalSales: 0,
            avgDuration: 0,
            startTime: null,
            endTime: null,
            status: 'inactive',
            journey: [] // Empty journey array
          }

          // Return early with empty journey
          return journey
        }
      }
    }

    console.log(`📊 Processing journey for ${journey.salesmanName} (ID: ${journey.salesmanId}), Total visits in journey: ${journey.totalVisits}`)
    console.log(`📊 Visits array has ${trackingData.visits?.length || 0} entries`)

    // Always process visits if we have them
    let salesmanVisits = []

    if (trackingData.visits && trackingData.visits.length > 0) {
      if (selectedSalesman === 'all') {
        // For 'all', filter by the current journey's salesman ID
        salesmanVisits = trackingData.visits
          .filter(v => String(v.userCode) === String(journey.salesmanId))
      } else {
        // For specific salesman, the API already returns ONLY that salesman's visits
        // No additional filtering needed - use all visits from the response
        salesmanVisits = trackingData.visits
      }

      console.log(`📊 Found ${salesmanVisits.length} visits for salesman ${journey.salesmanName} (ID: ${journey.salesmanId})`)

      if (salesmanVisits.length === 0 && trackingData.visits.length > 0) {
        // Debug: Check what userCodes are in the visits
        const userCodes = [...new Set(trackingData.visits.map(v => v.userCode))];
        console.warn(`⚠️ No visits matched! Visit userCodes in data: ${userCodes.join(', ')}. Looking for: ${journey.salesmanId}`)
      }
    } else {
      console.warn(`⚠️ No visits data available in trackingData`)
    }

    // Sort chronologically and map to journey format
    const processedVisits = salesmanVisits
      .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime())
      .map((visit, index) => ({
        sequence: index + 1,
        customerCode: visit.customerCode,
        customerName: visit.customerName,
        latitude: visit.latitude,
        longitude: visit.longitude,
        arrivalTime: visit.arrivalTime,
        departureTime: visit.departureTime,
        durationMinutes: visit.duration,
        visitType: visit.visitType,
        callType: visit.visitType,
        isProductive: visit.visitStatus === 'productive',
        orderValue: visit.orderValue || 0
      }))

    console.log(`✅ Journey for ${journey.salesmanName}: ${processedVisits.length} visits processed`)

    // Journey start time = first customer arrival, end time = last customer departure
    let journeyStartTime = journey.startTime
    let journeyEndTime = journey.endTime

    if (processedVisits.length > 0) {
      const firstVisit = processedVisits[0]
      const lastVisit = processedVisits[processedVisits.length - 1]

      journeyStartTime = firstVisit.arrivalTime
      journeyEndTime = lastVisit.departureTime || lastVisit.arrivalTime
    }

    // Calculate total journey duration (first customer to last customer) in minutes
    let totalJourneyDuration = processedVisits.reduce((sum, visit) => sum + (visit.durationMinutes || 0), 0)

    if (journeyStartTime && journeyEndTime) {
      const startDate = new Date(journeyStartTime)
      const endDate = new Date(journeyEndTime)
      totalJourneyDuration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
    }

    // Always return journey with the visits array (even if empty)
    return {
      ...journey,
      journey: processedVisits,
      totalDuration: totalJourneyDuration,
      journeyStartTime,
      journeyEndTime
    }
  }, [trackingData, selectedSalesman, selectedJourneyIndex])

  // Professional Google Maps Directions Integration - Customer to Customer Route
  useEffect(() => {
    if (!mapLoaded || !currentJourney?.journey?.length) {
      setDirectionsResponse(null)
      setMultipleDirections([])
      setDirectionsStatus('no-data')
      return
    }

    setDirectionsStatus('loading')

    // Validate Google Maps API availability
    if (typeof google === 'undefined' || !google.maps?.DirectionsService) {
      console.error('Google Maps API not properly loaded. Please check API key and billing.')
      setDirectionsStatus('api-error')
      return
    }

    const directionsService = new google.maps.DirectionsService()
    const journey = currentJourney.journey

    // Google allows max 25 waypoints (23 waypoints + origin + destination)
    const maxWaypoints = 23

    if (journey.length === 1) {
      // Single customer - no route needed
      setDirectionsResponse(null)
      setMultipleDirections([])
      setDirectionsStatus('single-customer')
      return
    }

    if (journey.length <= maxWaypoints + 2) {
      // ✅ Single route: First Customer → All Middle Customers → Last Customer
      const firstCustomer = journey[0]
      const lastCustomer = journey[journey.length - 1]
      const middleCustomers = journey.slice(1, -1)

      const waypoints = middleCustomers.map(visit => ({
        location: { lat: visit.latitude, lng: visit.longitude },
        stopover: true
      }))

      console.log(`🗺️ Customer Journey: ${firstCustomer.customerName} → ${journey.length - 2} stops → ${lastCustomer.customerName}`)

      setMultipleDirections([]) // Clear multiple directions

      directionsService.route(
        {
          origin: { lat: firstCustomer.latitude, lng: firstCustomer.longitude },
          destination: { lat: lastCustomer.latitude, lng: lastCustomer.longitude },
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
          provideRouteAlternatives: false,
          avoidHighways: false,
          avoidTolls: false
        },
        (result, status) => {
          if (status === 'OK' && result) {
            setDirectionsResponse(result)
            setDirectionsStatus('success')
            console.log(`✅ Customer route loaded: ${journey.length} customers`)
          } else {
            console.error(`❌ Route failed: ${status}`)
            setDirectionsResponse(null)
            setDirectionsStatus(`failed-${status}`)
          }
        }
      )
    } else {
      // ✅ Multiple routes for 25+ customers: OVERLAPPING segments for perfect polyline connections
      // Google allows max 25 points: 1 origin + 23 waypoints + 1 destination
      console.log(`🗺️ ${journey.length} customers - creating OVERLAPPING route segments for seamless polylines`)

      setDirectionsResponse(null) // Clear single direction

      // Create OVERLAPPING chunks: each segment's last customer = next segment's first customer
      const chunks: typeof journey[] = []
      let startIndex = 0
      const pointsPerSegment = maxWaypoints + 2 // 23 waypoints + origin + destination = 25 total

      while (startIndex < journey.length) {
        const remainingCustomers = journey.length - startIndex

        if (remainingCustomers <= pointsPerSegment) {
          // Last segment - take all remaining customers
          chunks.push(journey.slice(startIndex))
          break
        } else {
          // Take pointsPerSegment customers, next segment will start at the last customer (overlap)
          chunks.push(journey.slice(startIndex, startIndex + pointsPerSegment))
          startIndex += pointsPerSegment - 1 // Move to last customer of this segment (which becomes first of next)
        }
      }

      console.log(`   📍 Created ${chunks.length} OVERLAPPING segments:`)
      chunks.forEach((chunk, idx) => {
        console.log(`      Segment ${idx + 1}: ${chunk[0].customerName} → ${chunk[chunk.length - 1].customerName} (${chunk.length} stops)`)
      })

      // Make parallel API calls for all segments
      const routePromises = chunks.map((chunk, chunkIndex) => {
        return new Promise<google.maps.DirectionsResult | null>((resolve) => {
          const origin = chunk[0]
          const destination = chunk[chunk.length - 1]
          const waypoints = chunk.slice(1, -1).map(visit => ({
            location: { lat: visit.latitude, lng: visit.longitude },
            stopover: true
          }))

          console.log(`   🔄 Requesting segment ${chunkIndex + 1}: origin + ${waypoints.length} waypoints + destination = ${waypoints.length + 2} points`)

          directionsService.route(
            {
              origin: { lat: origin.latitude, lng: origin.longitude },
              destination: { lat: destination.latitude, lng: destination.longitude },
              waypoints,
              travelMode: google.maps.TravelMode.DRIVING,
              optimizeWaypoints: false, // CRITICAL: maintain exact order for seamless connection
              provideRouteAlternatives: false,
              avoidHighways: false,
              avoidTolls: false
            },
            (result, status) => {
              if (status === 'OK' && result) {
                console.log(`   ✅ Segment ${chunkIndex + 1}/${chunks.length} loaded successfully`)
                resolve(result)
              } else {
                console.error(`   ❌ Segment ${chunkIndex + 1} failed: ${status}`)
                resolve(null)
              }
            }
          )
        })
      })

      // Wait for all segments to load
      Promise.all(routePromises).then((results) => {
        const validResults = results.filter(r => r !== null) as google.maps.DirectionsResult[]
        setMultipleDirections(validResults)
        setDirectionsStatus('success-multiple')
        console.log(`   ✅ All ${validResults.length}/${chunks.length} segments loaded - polylines connected at overlap points!`)
      })
    }
  }, [currentJourney, trackingData, mapLoaded])

  const formatTime = (timeString: string) => {
    if (!timeString) return '--:--'
    try {
      const date = new Date(timeString)
      // Format in UAE timezone (Asia/Dubai = GMT+4)
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Dubai'
      })
    } catch {
      return timeString
    }
  }

  // Calculate time by adding/subtracting minutes from timestamp
  const calculateTimeOffset = (timeString: string, minutesOffset: number): string => {
    if (!timeString) return '--:--'
    try {
      // Parse the timestamp (which is in UTC from database)
      const date = new Date(timeString)

      // Add or subtract minutes
      date.setMinutes(date.getMinutes() + minutesOffset)

      // Format to HH:MM:SS in UAE timezone
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Dubai'
      })

      return timeFormatter.format(date)
    } catch {
      return '--:--'
    }
  }

  // Professional Enterprise-Level SVG Markers
  const getMarkerIcon = (type: 'customer' | 'current', visitData?: any, totalVisits?: number) => {
    if (type === 'current') {
      return 'https://maps.google.com/mapfiles/ms/icons/green-pushpin.png'
    }

    if (type === 'customer') {
      // ALWAYS use custom SVG markers with sequence numbers - even for 30+ visits
      const sequence = visitData?.sequence || 1
      const isProductive = visitData?.isProductive
      const duration = visitData?.durationMinutes || 0

      // Color scheme based on productivity and duration
      let backgroundColor, borderColor
      if (!isProductive) {
        backgroundColor = '#dc2626' // Red for non-productive
        borderColor = '#991b1b'
      } else if (duration >= 10) {
        backgroundColor = '#059669' // Green for long productive visits
        borderColor = '#047857'
      } else if (duration >= 5) {
        backgroundColor = '#d97706' // Orange for medium visits
        borderColor = '#b45309'
      } else {
        backgroundColor = '#7c3aed' // Purple for quick visits
        borderColor = '#5b21b6'
      }

      // Optimize SVG size for performance with many markers (30+)
      const markerSize = totalVisits > 20 ? 32 : 40
      const circleRadius = totalVisits > 20 ? 12 : 16
      const fontSize = totalVisits > 20 ? (sequence >= 10 ? '10' : '12') : '14'
      const strokeWidth = totalVisits > 20 ? 2 : 3

      const svg = encodeURIComponent(`
        <svg width="${markerSize}" height="${markerSize}" viewBox="0 0 ${markerSize} ${markerSize}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow${sequence}">
              <feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.3"/>
            </filter>
          </defs>
          <circle cx="${markerSize/2}" cy="${markerSize/2}" r="${circleRadius}" fill="${backgroundColor}" stroke="${borderColor}" stroke-width="${strokeWidth}" filter="url(#shadow${sequence})"/>
          <text x="${markerSize/2}" y="${markerSize/2 + (fontSize === '10' ? 3 : 4)}" text-anchor="middle" fill="white" font-size="${fontSize}" font-weight="bold">${sequence}</text>
          <circle cx="${markerSize - 4}" cy="6" r="3" fill="${isProductive ? '#10b981' : '#ef4444'}"/>
        </svg>
      `)
      return `data:image/svg+xml;charset=utf-8,${svg}`
    }

    return 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
  }

  // Get marker size based on total visit count for optimal performance
  const getMarkerSize = (totalVisits: number) => {
    // Optimize size based on total number of visits for better map performance
    if (totalVisits > 20) return { width: 32, height: 32 } // Smaller for many visits
    return { width: 40, height: 40 } // Standard size for fewer visits
  }

  // Format duration for display
  const formatDuration = (minutes: number) => {
    if (minutes === 0) return 'Quick visit'
    if (minutes < 60) return `${minutes}min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  // Export Journey Timeline to Excel using ExcelJS
  const exportJourneyToExcel = async () => {
    if (!currentJourney) return

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Journey Timeline')

      // Set column widths
      worksheet.columns = [
        { width: 12 },  // Sequence
        { width: 18 },  // Customer Code
        { width: 30 },  // Customer Name
        { width: 15 },  // Arrival Time
        { width: 15 },  // Departure Time
        { width: 15 },  // Duration
        { width: 18 },  // Status
        { width: 15 }   // Order Value
      ]

      let currentRow = 1

      // Title
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
      const titleCell = worksheet.getCell(`A${currentRow}`)
      titleCell.value = 'Journey Timeline Report'
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF1E40AF' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7FF' }
      }
      worksheet.getRow(currentRow).height = 30
      currentRow++

      // Salesman Details
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
      const detailsCell = worksheet.getCell(`A${currentRow}`)
      detailsCell.value = `Salesman: ${currentJourney.salesmanName} (${currentJourney.salesmanId}) | Route: ${currentJourney.routeName} | Date: ${date}`
      detailsCell.font = { size: 12, bold: true }
      detailsCell.alignment = { horizontal: 'center', vertical: 'middle' }
      detailsCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Summary Stats
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
      const summaryCell = worksheet.getCell(`A${currentRow}`)
      summaryCell.value = `Start: ${formatTime(currentJourney.journeyStartTime)} | End: ${formatTime(currentJourney.journeyEndTime)} | Total Visits: ${currentJourney.journey.length} | Total Duration: ${formatDuration(currentJourney.totalDuration)}`
      summaryCell.font = { size: 11, bold: true }
      summaryCell.alignment = { horizontal: 'center', vertical: 'middle' }
      summaryCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      worksheet.getRow(currentRow).height = 22
      currentRow++

      currentRow++ // Empty row

      // Customer Visits Header
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
      const visitsHeaderCell = worksheet.getCell(`A${currentRow}`)
      visitsHeaderCell.value = '📍 CUSTOMER VISITS'
      visitsHeaderCell.font = { size: 12, bold: true, color: { argb: 'FF1E40AF' } }
      visitsHeaderCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      worksheet.getRow(currentRow).height = 22
      currentRow++

      // Table Headers
      const headerRow = worksheet.getRow(currentRow)
      headerRow.values = [
        'Seq',
        'Customer Code',
        'Customer Name',
        'Arrival Time',
        'Departure Time',
        'Duration',
        'Status',
        'Order Value'
      ]
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF1E40AF' } },
          left: { style: 'thin', color: { argb: 'FF1E40AF' } },
          bottom: { style: 'thin', color: { argb: 'FF1E40AF' } },
          right: { style: 'thin', color: { argb: 'FF1E40AF' } }
        }
      })
      currentRow++

      // Customer Visit Rows
      currentJourney.journey.forEach((visit, index) => {
        const row = worksheet.getRow(currentRow)
        row.values = [
          visit.sequence,
          visit.customerCode,
          visit.customerName,
          formatTime(visit.arrivalTime),
          visit.departureTime ? formatTime(visit.departureTime) : 'In Progress',
          `${visit.durationMinutes} min`,
          visit.isProductive ? 'Productive' : 'Non-Productive',
          visit.orderValue ? `AED ${visit.orderValue.toFixed(2)}` : 'AED 0.00'
        ]

        // Alternating row colors
        const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB'
        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          }
          cell.alignment = { vertical: 'middle' }

          // Center align specific columns (Seq, Duration, Order Value)
          if (colNumber === 1 || colNumber === 6 || colNumber === 8) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          }

          // Status column coloring (now column 7)
          if (colNumber === 7) {
            if (visit.isProductive) {
              cell.font = { color: { argb: 'FF059669' }, bold: true }
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD1FAE5' }
              }
            } else {
              cell.font = { color: { argb: 'FFDC2626' }, bold: true }
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFECACA' }
              }
            }
          }

          // Order value formatting (now column 8)
          if (colNumber === 8) {
            cell.font = { color: { argb: 'FF1E40AF' }, bold: true }
          }
        })
        row.height = 20
        currentRow++
      })

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Journey_Timeline_${currentJourney.salesmanName.replace(/\s+/g, '_')}_${date}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Failed to export journey timeline. Please try again.')
    }
  }

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: isMobile ? '400px' : '500px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.gray[100],
        borderRadius: '8px',
        border: `1px solid ${colors.gray[200]}`
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: `3px solid ${colors.gray[200]}`,
            borderTop: `3px solid ${colors.primary[500]}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: colors.gray[600], ...styles.fontSize('14px', '13px'), fontWeight: '500' }}>
            Loading GPS tracking data...
          </p>
        </div>
      </div>
    )
  }

  if (!trackingData?.salesmenJourneys?.length) {
    return (
      <div style={{
        width: '100%',
        height: isMobile ? '400px' : '500px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.gray[100],
        borderRadius: '8px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '12px' }}><MapPin size={isMobile ? 40 : 48} style={{ color: '#6b7280' }} /></div>
          <p style={{ color: colors.gray[600], ...styles.fontSize('14px', '13px') }}>No tracking data available for {date}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Journey Selector and Route Status */}
      <div style={{ display: 'flex', ...styles.flexDirection('row', 'column'), justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-end', marginBottom: isMobile ? '12px' : '16px', ...styles.gap('16px', '12px') }}>
        {selectedSalesman === 'all' && trackingData?.salesmenJourneys?.length > 1 && (
          <div>
            <label style={{
              display: 'block',
              ...styles.fontSize('14px', '13px'),
              fontWeight: '500',
              color: colors.gray[700],
              marginBottom: '8px'
            }}>
              Select Salesman Journey:
            </label>
            <select
              value={selectedJourneyIndex}
              onChange={(e) => setSelectedJourneyIndex(Number(e.target.value))}
              style={{
                ...styles.padding('8px 12px', '6px 10px'),
                borderRadius: '6px',
                border: `1px solid ${colors.gray[300]}`,
                ...styles.fontSize('14px', '13px'),
                backgroundColor: colors.background.primary,
                width: isMobile ? '100%' : 'auto'
              }}
            >
              {/* CRITICAL FIX: Only show journeys that have actual visits */}
              {trackingData.salesmenJourneys
                .map((journey, index) => {
                  // Count actual visits for this salesman
                  const visitCount = trackingData.visits?.filter(v => String(v.userCode) === String(journey.salesmanId)).length || 0

                  // PRODUCTION FIX: Only show salesmen who actually worked (have real visits)
                  const hasRealVisits = visitCount > 0

                  if (!hasRealVisits) {
                    console.log(`🚫 Hiding ${journey.salesmanName} (${journey.salesmanId}) - 0 visits means didn't work on ${date}`)
                    return null
                  }

                  // Only include salesmen with actual visits
                  return {
                    journey,
                    index,
                    visitCount
                  }
                })
                .filter(item => item !== null)
                .map((item) => (
                  <option key={`journey-selector-${item.journey.salesmanId}-${item.index}-${date}`} value={item.index}>
                    {item.journey.salesmanName} ({item.visitCount} visits)
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Professional Routing Status Indicator */}
        {currentJourney?.journey?.length > 0 && (
          <div style={{
            padding: '8px 16px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600',
            backgroundColor: (directionsStatus === 'success' || directionsStatus === 'success-multiple') ? '#dbeafe' :
                            directionsStatus === 'loading' ? '#f3f4f6' : '#fee2e2',
            color: (directionsStatus === 'success' || directionsStatus === 'success-multiple') ? '#1e40af' :
                   directionsStatus === 'loading' ? '#6b7280' : '#dc2626',
            border: `2px solid ${(directionsStatus === 'success' || directionsStatus === 'success-multiple') ? '#3b82f6' :
                                 directionsStatus === 'loading' ? '#d1d5db' : '#f87171'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {directionsStatus === 'loading' && (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #d1d5db',
                  borderTop: '2px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Loading Google Maps Route...
              </>
            )}
            {(directionsStatus === 'success' || directionsStatus === 'success-multiple') && (
              <>
                <Navigation size={16} style={{ marginRight: '4px' }} />
                Complete Journey: Warehouse → {currentJourney?.journey?.length || 0} visits → Warehouse ✓
              </>
            )}
            {directionsStatus.startsWith('failed') && (
              <>
                <AlertTriangle size={16} style={{ marginRight: '4px' }} /> Google Directions Error: {directionsStatus.replace('failed-', '').toUpperCase()}
              </>
            )}
            {directionsStatus === 'api-error' && (
              <>
                🚫 Google Maps API Configuration Error
              </>
            )}
            {directionsStatus === 'no-data' && (
              <>
                <MapPin size={16} style={{ marginRight: '4px' }} /> No Route Data Available
              </>
            )}
          </div>
        )}
      </div>

      {/* Map Container with Enhanced Error Handling */}
      <div style={{ borderRadius: '8px', overflow: 'hidden', border: `1px solid ${colors.gray[200]}` }}>
        {googleMapsError ? (
          <div style={{
            height: '500px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.gray[50],
            color: colors.error.main,
            padding: '40px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: colors.error.main }}>
              Google Maps Loading Failed
            </h3>
            <p style={{ fontSize: '14px', color: colors.gray[600], textAlign: 'center', marginBottom: '20px' }}>
              {googleMapsError}
            </p>
            <button
              onClick={() => {
                setGoogleMapsError(null)
                setGoogleMapsLoaded(false)
                // Reset global state for retry
                if (typeof window !== 'undefined' && window.__GOOGLE_MAPS_STATE__) {
                  window.__GOOGLE_MAPS_STATE__.loadAttempts = 0
                  window.__GOOGLE_MAPS_STATE__.isLoaded = false
                  window.__GOOGLE_MAPS_STATE__.isLoading = false
                  window.__GOOGLE_MAPS_STATE__.loadingPromise = null
                }
                // Retry initialization
                loadGoogleMapsGlobally()
                  .then(() => {
                    setGoogleMapsLoaded(true)
                    setGoogleMapsError(null)
                  })
                  .catch((error) => {
                    setGoogleMapsError(error instanceof Error ? error.message : 'Retry failed')
                  })
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: colors.primary[500],
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Retry Loading Maps
            </button>
          </div>
        ) : !googleMapsLoaded ? (
          <div style={{
            height: '500px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.gray[50],
            color: colors.gray[600]
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: `4px solid ${colors.gray[200]}`,
              borderTop: `4px solid ${colors.primary[500]}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '20px'
            }}></div>
            <p style={{ fontSize: '16px', fontWeight: '500' }}>Loading Google Maps...</p>
            <p style={{ fontSize: '13px', color: colors.gray[500] }}>Initializing enterprise mapping services</p>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={getContainerStyle(isMobile)}
            center={mapCenter}
            zoom={isMobile ? 11 : 12}
            options={{
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
              styles: [
                // Professional map styling
                {
                  featureType: 'poi.business',
                  stylers: [{ visibility: 'simplified' }]
                },
                {
                  featureType: 'road',
                  elementType: 'labels',
                  stylers: [{ visibility: 'on' }]
                }
              ]
            }}
            onLoad={(map) => {
              console.log('✅ Map instance loaded')
              setMapLoaded(true)
            }}
          >
            {/* Professional Customer Visit Markers with Enterprise-Level Design */}
            {currentJourney?.journey.map((visit, index) => {
              const prevVisit = index === 0 ? null : currentJourney.journey[index - 1]

              const travelTime = calculateTravelTime(prevVisit, visit)
              const customIconUrl = getMarkerIcon('customer', visit, currentJourney.journey.length)

              // Debug logging for high visit counts
              if (index < 3 || currentJourney.journey.length > 20) {
                console.log(`🗺️ Rendering marker ${index + 1}/${currentJourney.journey.length}: ${visit.customerName} at (${visit.latitude.toFixed(6)}, ${visit.longitude.toFixed(6)}) - Sequence #${visit.sequence} - Using ${currentJourney.journey.length > 20 ? 'optimized' : 'standard'} size markers`)
              }

              return (
                <Marker
                  key={`marker-${currentJourney.salesmanId}-${visit.sequence}-${index}-${visit.customerCode}-${visit.arrivalTime}`}
                  position={{
                    lat: visit.latitude,
                    lng: visit.longitude
                  }}
                  icon={window.google?.maps?.Size ? {
                    url: customIconUrl,
                    scaledSize: new window.google.maps.Size(
                      getMarkerSize(currentJourney.journey.length).width,
                      getMarkerSize(currentJourney.journey.length).height
                    ),
                    anchor: new window.google.maps.Point(
                      getMarkerSize(currentJourney.journey.length).width / 2,
                      getMarkerSize(currentJourney.journey.length).height / 2
                    )
                  } : {
                    url: customIconUrl
                  }}
                  title={`Stop #${visit.sequence}: ${visit.customerName}`}
                  onClick={() => setSelectedMarker({
                    type: 'customer',
                    data: {
                      ...visit,
                      travelTime,
                      prevLocation: index === 0 ? 'Journey Start' : currentJourney.journey[index - 1].customerName
                    },
                    sequence: visit.sequence
                  })}
                  zIndex={1000 - index} // Higher priority for earlier visits
                />
              )
            })}

            {/* Professional Google Maps Directions Rendering - Single route (≤24 customers) */}
            {directionsResponse && googleMapsLoaded && window.google?.maps?.SymbolPath && (
              <DirectionsRenderer
                directions={directionsResponse}
                options={{
                  suppressMarkers: true, // We use professional custom markers
                  polylineOptions: {
                    strokeColor: '#1e40af', // Professional enterprise blue
                    strokeWeight: 6,
                    strokeOpacity: 0.9,
                    geodesic: true,
                    icons: [
                      {
                        icon: {
                          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                          scale: 4,
                          fillColor: '#1e40af',
                          fillOpacity: 1.0,
                          strokeWeight: 1,
                          strokeColor: '#1e3a8a'
                        },
                        offset: '0%',
                        repeat: '100px' // Professional spacing for arrows
                      },
                      {
                        icon: {
                          path: 'M 0,-2 0,2',
                          strokeOpacity: 1,
                          scale: 2,
                          strokeColor: '#3b82f6',
                          strokeWeight: 3
                        },
                        offset: '0',
                        repeat: '30px' // Dash pattern for professional appearance
                      }
                    ]
                  },
                  preserveViewport: false,
                  draggable: false
                }}
              />
            )}

            {/* ✅ Multiple route segments (25+ customers) - ALL on REAL ROADS */}
            {multipleDirections.length > 0 && googleMapsLoaded && window.google?.maps?.SymbolPath && multipleDirections.map((directions, index) => (
              <DirectionsRenderer
                key={`route-segment-${index}`}
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor: '#1e40af',
                    strokeWeight: 6,
                    strokeOpacity: 0.9,
                    geodesic: true,
                    icons: [
                      {
                        icon: {
                          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                          scale: 4,
                          fillColor: '#1e40af',
                          fillOpacity: 1.0,
                          strokeWeight: 1,
                          strokeColor: '#1e3a8a'
                        },
                        offset: '0%',
                        repeat: '100px'
                      }
                    ]
                  },
                  preserveViewport: false,
                  draggable: false
                }}
              />
            ))}

            {/* Info Window */}
            {selectedMarker && selectedMarker.type === 'customer' && (
              <InfoWindow
                position={{
                  lat: selectedMarker.data.latitude,
                  lng: selectedMarker.data.longitude
                }}
                onCloseClick={() => setSelectedMarker(null)}
              >
                <div style={{ padding: '12px', maxWidth: '320px' }}>
                  {(
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 16px 0' }}>
                        <span style={{
                          backgroundColor: selectedMarker.data.isProductive ? '#10b981' : '#f59e0b',
                          color: 'white',
                          borderRadius: '50%',
                          padding: '4px 8px',
                          fontSize: '14px',
                          fontWeight: '700',
                          marginRight: '12px',
                          minWidth: '28px',
                          textAlign: 'center'
                        }}>
                          {selectedMarker.sequence}
                        </span>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0', color: '#1f2937' }}>
                          {selectedMarker.data.customerName}
                        </h3>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Travel Information */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px',
                          backgroundColor: '#eff6ff',
                          borderRadius: '8px',
                          border: '1px solid #bfdbfe'
                        }}>
                          <Car size={16} style={{ color: '#2563eb', marginRight: '8px' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '600', marginBottom: '2px' }}>
                              Travel from {selectedMarker.data.prevLocation}
                            </div>
                            <div style={{ fontSize: '11px', color: '#1e40af' }}>
                              Travel Time: {selectedMarker.data.travelTime} min
                            </div>
                          </div>
                        </div>

                        {/* Visit Timing Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: '12px',
                          padding: '12px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                              <Clock size={14} style={{ color: '#059669', marginRight: '4px' }} />
                              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>Arrival</span>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#059669' }}>
                              {formatTime(selectedMarker.data.arrivalTime)}
                            </div>
                          </div>

                          <div style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                              <Clock size={14} style={{ color: selectedMarker.data.durationMinutes >= 5 ? '#059669' : selectedMarker.data.durationMinutes >= 2 ? '#d97706' : '#dc2626', marginRight: '4px' }} />
                              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>Duration</span>
                            </div>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: selectedMarker.data.durationMinutes >= 5 ? '#059669' :
                                     selectedMarker.data.durationMinutes >= 2 ? '#d97706' : '#dc2626'
                            }}>
                              {formatDuration(selectedMarker.data.durationMinutes)}
                            </div>
                          </div>

                          <div style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                              <Clock size={14} style={{ color: '#dc2626', marginRight: '4px' }} />
                              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>Departure</span>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#dc2626' }}>
                              {selectedMarker.data.departureTime ? formatTime(selectedMarker.data.departureTime) : 'In Progress'}
                            </div>
                          </div>
                        </div>

                        {/* Visit Status & Order Value */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px',
                          backgroundColor: selectedMarker.data.isProductive ? '#f0fdf4' : '#fefce8',
                          borderRadius: '8px',
                          border: `1px solid ${selectedMarker.data.isProductive ? '#bbf7d0' : '#fef3c7'}`
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {selectedMarker.data.isProductive ? (
                              <CheckCircle size={16} style={{ color: '#059669', marginRight: '8px' }} />
                            ) : (
                              <AlertTriangle size={16} style={{ color: '#d97706', marginRight: '8px' }} />
                            )}
                            <span style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              color: selectedMarker.data.isProductive ? '#166534' : '#92400e'
                            }}>
                              {selectedMarker.data.isProductive ? 'PRODUCTIVE VISIT' : 'NON-PRODUCTIVE VISIT'}
                            </span>
                          </div>

                          {selectedMarker.data.orderValue > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <span style={{ fontSize: '13px', fontWeight: '600', color: '#059669', marginRight: '4px' }}>
                                AED
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: '600', color: '#059669' }}>
                                {selectedMarker.data.orderValue.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
      </div>

      {/* Professional Error Messages for Google Maps Issues */}
      {directionsStatus.startsWith('failed') && currentJourney?.journey?.length > 0 && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          border: '1px solid #fecaca',
          borderLeft: '4px solid #ef4444'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div><AlertTriangle size={20} style={{ color: '#dc2626' }} /></div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#dc2626', margin: '0 0 4px 0' }}>
                Google Maps Routing Issue
              </h4>
              <p style={{ fontSize: '14px', color: '#7f1d1d', margin: '0 0 8px 0' }}>
                Google Directions API returned: <strong>{directionsStatus.replace('failed-', '').toUpperCase()}</strong>
              </p>
              <p style={{ fontSize: '13px', color: '#991b1b', margin: '0' }}>
                • Check your Google Maps API key configuration<br/>
                • Verify billing is enabled for Directions API<br/>
                • Ensure API quotas are not exceeded<br/>
                • Check that all coordinates are valid
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Journey Timeline */}
      {currentJourney && currentJourney.journey.length > 0 && (
        <div style={{
          marginTop: isMobile ? '16px' : '20px',
          ...styles.padding('20px', '12px'),
          backgroundColor: colors.background.primary,
          borderRadius: '12px',
          border: `1px solid ${colors.gray[200]}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '16px' : '20px' }}>
            <h4 style={{ ...styles.heading('18px', '16px'), color: colors.gray[800], margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', ...styles.gap('8px', '6px') }}>
                <MapPin size={isMobile ? 14 : 16} />
                Journey Timeline - {currentJourney.salesmanName}
              </div>
            </h4>

            {/* Export to Excel Button */}
            <button
              onClick={exportJourneyToExcel}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: isMobile ? '8px 12px' : '10px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: isMobile ? '13px' : '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#059669'
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#10b981'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)'
              }}
            >
              <Download size={isMobile ? 14 : 16} />
              {isMobile ? 'Export' : 'Export to Excel'}
            </button>
          </div>

          {/* Timeline Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', color: colors.gray[600] }}>
              <strong>Start:</strong> {formatTime(currentJourney.journeyStartTime)} |
              <strong> End:</strong> {formatTime(currentJourney.journeyEndTime)} |
              <strong> Total Visits:</strong> {currentJourney.journey.length}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: colors.primary[600] }}>
              Total Duration: {formatDuration(currentJourney.totalDuration)}
            </div>
          </div>

          {/* Timeline Items */}
          <div style={{ position: 'relative' }}>
            {/* Customer Visits */}
            {currentJourney.journey.map((visit, index) => {
              const prevVisit = index === 0 ? null : currentJourney.journey[index - 1]

              const travelTime = calculateTravelTime(prevVisit, visit)
              const visitDuration = visit.durationMinutes || 0

              return (
                <div key={`journey-timeline-${currentJourney.salesmanId}-${visit.sequence}-${index}-${visit.customerCode}-${visit.arrivalTime}`} style={{ marginBottom: '12px' }}>
                  {/* Travel Line - only show for visits after the first one */}
                  {index > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '6px',
                      marginBottom: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                          <Car size={14} style={{ marginRight: '8px' }} />
                          Travel Time: {travelTime} min
                        </div>
                      <div style={{
                        flex: 1,
                        height: '2px',
                        background: `linear-gradient(to right, ${colors.primary[300]} 0%, ${colors.primary[500]} 100%)`,
                        margin: '0 12px',
                        position: 'relative'
                      }}>
                        <div style={{
                          position: 'absolute',
                          right: '0',
                          top: '-3px',
                          width: '8px',
                          height: '8px',
                          backgroundColor: colors.primary[500],
                          borderRadius: '50%'
                        }}></div>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Visit Details */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '16px',
                      backgroundColor: visit.isProductive ? '#f0fdf4' : '#fefce8',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${visit.isProductive ? '#10b981' : '#f59e0b'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => setSelectedMarker({
                      type: 'customer',
                      data: { ...visit, travelTime, prevLocation: index === 0 ? 'Journey Start' : currentJourney.journey[index - 1].customerName },
                      sequence: visit.sequence
                    })}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = visit.isProductive ? '#dcfce7' : '#fef3c7'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = visit.isProductive ? '#f0fdf4' : '#fefce8'
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: visit.isProductive ? '#10b981' : '#f59e0b',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      marginRight: '16px'
                    }}>
                      {visit.sequence}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '15px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                            {visit.customerName}
                          </div>
                          <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '4px' }}>
                            {formatTime(visit.arrivalTime)} - {visit.departureTime ? formatTime(visit.departureTime) : 'In Progress'}
                          </div>
                          {visit.orderValue > 0 && (
                            <div style={{
                              fontSize: '13px',
                              fontWeight: '600',
                              color: '#1e40af'
                            }}>
                              💰 AED {visit.orderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: '700',
                            color: visitDuration >= 5 ? '#059669' : visitDuration >= 2 ? '#d97706' : '#dc2626',
                            marginBottom: '4px'
                          }}>
                            {formatDuration(visitDuration)}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            color: visit.isProductive ? '#166534' : '#92400e'
                          }}>
                            {visit.isProductive ? 'PRODUCTIVE' : 'NON-PRODUCTIVE'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}