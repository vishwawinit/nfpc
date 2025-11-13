'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { MapPin, Clock, User, Building2, TrendingUp, Download, BarChart3, Maximize, Minimize, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { GoogleMap, Marker, InfoWindow, DirectionsRenderer, useJsApiLoader } from '@react-google-maps/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'
import { useDashboardFilters } from '@/hooks/useDashboardFilters'
import * as XLSX from 'xlsx'

interface StoreVisit {
  visitDate: string
  storeCode: string
  storeName: string
  storeClass?: string
  chainCode?: string
  chainName?: string
  cityCode?: string
  regionCode?: string
  userCode: string
  userName: string
  userType?: string
  userRole?: string
  teamLeaderCode?: string
  teamLeaderName?: string
  tlCode?: string
  tlName?: string
  arrivalTime: string
  departureTime?: string
  durationMinutes: number
  visitPurpose?: string
  visitOutcome?: string
  visitStatus?: string
  salesGenerated?: number
  productsOrdered?: number
  remarks?: string
  latitude?: number | null
  longitude?: number | null
  sequence?: number
  travelTime?: number
  prevLocation?: string
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

interface StoreUserVisitReportProps {
  loginUserCode?: string
}

export function StoreUserVisitReport({ loginUserCode = 'admin' }: StoreUserVisitReportProps) {
  const [visits, setVisits] = useState<StoreVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDateRange, setSelectedDateRange] = useState('thisMonth')
  const [isInitialized, setIsInitialized] = useState(false)

  // Use the dashboard filters hook with loginUserCode - same as other reports
  const {
    filters,
    filterOptions,
    loading: filtersLoading,
    error: filtersError,
    updateFilter,
    setDateRange,
    resetFilters,
    getQueryParams
  } = useDashboardFilters(loginUserCode)

  // View mode: 'summary' | 'map' | 'detailed'
  const [viewMode, setViewMode] = useState<'summary' | 'map' | 'detailed'>('summary')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isTableFullscreen, setIsTableFullscreen] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState<any>(null)
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null)
  const [multipleDirections, setMultipleDirections] = useState<google.maps.DirectionsResult[]>([])
  const [directionsStatus, setDirectionsStatus] = useState<string>('loading')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [selectedUserForMap, setSelectedUserForMap] = useState<string>('all')
  const [selectedDateForMap, setSelectedDateForMap] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)

  const PAGE_SIZE = 100

  // Load Google Maps
  const { isLoaded: googleMapsLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['geometry', 'places']
  })

  // Handle date range preset selection - same as Daily Sales Report
  const handleDateRangeSelect = (range: string) => {
    setSelectedDateRange(range)
    
    const currentDate = new Date()
    let startDate: Date | null = null
    let endDate: Date | null = null
    
    switch(range) {
      case 'today':
        startDate = currentDate
        endDate = currentDate
        break
      case 'yesterday':
        const yesterday = new Date(currentDate)
        yesterday.setDate(yesterday.getDate() - 1)
        startDate = yesterday
        endDate = yesterday
        break
      case 'thisWeek':
        const weekStart = new Date(currentDate)
        weekStart.setDate(weekStart.getDate() - 6)
        startDate = weekStart
        endDate = currentDate
        break
      case 'thisMonth':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        endDate = currentDate
        break
      case 'lastMonth':
        const lastMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
        const lastMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0)
        startDate = lastMonthStart
        endDate = lastMonthEnd
        break
      case 'thisQuarter':
        const quarterStart = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1)
        startDate = quarterStart
        endDate = currentDate
        break
      case 'lastQuarter':
        const currentQuarterStart = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1)
        const lastQuarterStart = new Date(currentQuarterStart)
        lastQuarterStart.setMonth(lastQuarterStart.getMonth() - 3)
        startDate = lastQuarterStart
        endDate = new Date(currentQuarterStart.getTime() - 1)
        break
      case 'thisYear':
        startDate = new Date(currentDate.getFullYear(), 0, 1)
        endDate = currentDate
        break
      default:
        const thirtyDaysAgo = new Date(currentDate)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        startDate = thirtyDaysAgo
        endDate = currentDate
    }
    
    if (startDate && endDate) {
      const formatDate = (date: Date) => date.toISOString().split('T')[0]
      setDateRange(formatDate(startDate), formatDate(endDate))
    }
  }

  // Initialize date range on mount
  useEffect(() => {
    if (!isInitialized) {
      handleDateRangeSelect(selectedDateRange)
      setIsInitialized(true)
    }
  }, [isInitialized, selectedDateRange])

  // Memoize query params to prevent infinite re-renders
  const queryParams = useMemo(() => {
    const params = getQueryParams()
    return params.toString()
  }, [filters.startDate, filters.endDate, filters.regionCode, filters.fieldUserRole, 
      filters.teamLeaderCode, filters.userCode, filters.chainName, filters.storeCode])

  // Fetch data when filters change
  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      fetchData()
    }
  }, [queryParams, filters.startDate, filters.endDate])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/store-visits?${queryParams}`)
      
      // Check if response is ok before parsing JSON
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()

      if (result.success) {
        setVisits(result.data)
      } else {
        const errorMsg = result.message ? `${result.error}: ${result.message}` : result.error || 'Failed to fetch store visits'
        setError(errorMsg)
      }
    } catch (err) {
      console.error('Error fetching store visits:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch store visits')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = useMemo(() => {
    return visits.length > 0 ? Math.ceil(visits.length / PAGE_SIZE) : 1
  }, [visits.length])

  useEffect(() => {
    setCurrentPage(1)
  }, [visits])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  // Handle ESC key to exit fullscreen mode
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTableFullscreen) {
        setIsTableFullscreen(false)
      }
    }
    
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isTableFullscreen])

  const paginatedVisits = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return visits.slice(start, start + PAGE_SIZE)
  }, [visits, currentPage])

  const startIndex = useMemo(() => {
    if (visits.length === 0) return 0
    return (currentPage - 1) * PAGE_SIZE + 1
  }, [currentPage, visits.length])

  const endIndex = useMemo(() => {
    if (visits.length === 0) return 0
    return Math.min(currentPage * PAGE_SIZE, visits.length)
  }, [currentPage, visits.length])

  // Calculated metrics
  const metrics = useMemo(() => {
    const totalVisits = visits.length
    const productiveVisits = visits.filter(v => v.salesGenerated && v.salesGenerated > 0).length
    const productivityRate = totalVisits > 0 ? (productiveVisits / totalVisits) * 100 : 0
    const uniqueUsers = new Set(visits.map(v => v.userCode)).size
    const uniqueStores = new Set(visits.map(v => v.storeCode)).size
    
    // Calculate duration only from visits with valid duration (> 0)
    const visitsWithDuration = visits.filter(v => v.durationMinutes > 0)
    const totalDuration = visitsWithDuration.reduce((sum, v) => sum + v.durationMinutes, 0)
    
    // Average duration from visits with duration > 0
    const avgDuration = visitsWithDuration.length > 0
      ? Math.round(totalDuration / visitsWithDuration.length)
      : 0
    
    const totalSales = visits.reduce((sum, v) => sum + (v.salesGenerated || 0), 0)
    
    // On-time visits (before 10 AM)
    const onTimeVisits = visits.filter(v => {
      if (!v.arrivalTime) return false
      try {
        // Handle both timestamp and time-only formats
        let hour = 0
        if (v.arrivalTime.includes('T')) {
          // Full timestamp format
          const date = new Date(v.arrivalTime)
          hour = date.getHours()
        } else if (v.arrivalTime.includes(':')) {
          // Time-only format (HH:MM or HH:MM:SS)
          const time = v.arrivalTime.split(':')
          hour = parseInt(time[0]) || 0
        }
        return hour < 10
      } catch (e) {
        return false
      }
    }).length

    // User visit counts
    const userVisits = visits.reduce((acc, visit) => {
      const key = `${visit.userCode}|${visit.userName}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topUsers = Object.entries(userVisits)
      .map(([key, count]) => {
        const [code, name] = key.split('|')
        return { userCode: code, userName: name, visitCount: count }
      })
      .sort((a, b) => b.visitCount - a.visitCount)

    const top20Users = topUsers.slice(0, 20)
    const bottom20Users = topUsers.slice(-20).reverse()

    // Daily visit trend
    const dailyVisits = visits.reduce((acc, visit) => {
      const date = new Date(visit.visitDate).toLocaleDateString()
      acc[date] = (acc[date] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const dailyTrend = Object.entries(dailyVisits)
      .map(([date, count]) => ({ date, visits: count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Visit outcome distribution
    const outcomeDistribution = visits.reduce((acc, visit) => {
      const outcome = visit.visitOutcome || 'Not Specified'
      acc[outcome] = (acc[outcome] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const outcomeData = Object.entries(outcomeDistribution)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Average duration by user (using all visits with duration > 0)
    const userDurations = visitsWithDuration.reduce((acc, visit) => {
      const key = `${visit.userCode}|${visit.userName}`
      if (!acc[key]) {
        acc[key] = { total: 0, count: 0 }
      }
      acc[key].total += visit.durationMinutes
      acc[key].count += 1
      return acc
    }, {} as Record<string, { total: number; count: number }>)

    const avgDurationByUser = Object.entries(userDurations)
      .map(([key, data]) => {
        const [code, name] = key.split('|')
        return {
          userName: name,
          avgDuration: Math.round(data.total / data.count)
        }
      })
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10)

    // Regional analysis - use all visits
    const regionalVisits = visits.reduce((acc, visit) => {
      const region = visit.regionCode || 'Unknown'
      if (!acc[region]) {
        acc[region] = { count: 0, totalDuration: 0 }
      }
      acc[region].count += 1
      acc[region].totalDuration += (visit.durationMinutes || 0)
      return acc
    }, {} as Record<string, { count: number; totalDuration: number }>)

    const regionalData = Object.entries(regionalVisits)
      .map(([region, data]) => ({
        region,
        visits: data.count,
        avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0
      }))
      .sort((a, b) => b.visits - a.visits)

    // Chain analysis - use all visits
    const chainVisits = visits.reduce((acc, visit) => {
      const chain = visit.chainName || 'Unknown'
      if (!acc[chain]) {
        acc[chain] = { count: 0, totalDuration: 0, totalSales: 0 }
      }
      acc[chain].count += 1
      acc[chain].totalDuration += (visit.durationMinutes || 0)
      acc[chain].totalSales += (visit.salesGenerated || 0)
      return acc
    }, {} as Record<string, { count: number; totalDuration: number; totalSales: number }>)

    const chainData = Object.entries(chainVisits)
      .map(([chain, data]) => ({
        chain,
        visits: data.count,
        avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
        totalSales: data.totalSales
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10)
    
    return {
      totalVisits,
      productiveVisits,
      productivityRate,
      uniqueUsers,
      uniqueStores,
      avgDuration,
      totalDuration,
      totalSales,
      onTimeVisits,
      top20Users,
      bottom20Users,
      dailyTrend,
      outcomeData,
      avgDurationByUser,
      regionalData,
      chainData
    }
  }, [visits])

  // Group visits by user and date for map view
  const userDateJourneys = useMemo(() => {
    // Filter visits with valid GPS coordinates (including 0,0 as valid)
    const visitsWithGPS = visits.filter((v: StoreVisit) => 
      v.latitude !== null && v.latitude !== undefined && 
      v.longitude !== null && v.longitude !== undefined
    )
    
    const grouped: Record<string, Record<string, StoreVisit[]>> = {}
    
    visitsWithGPS.forEach((visit) => {
        const userKey = visit.userCode
        const dateKey = visit.visitDate
        
        if (!grouped[userKey]) {
          grouped[userKey] = {}
        }
        if (!grouped[userKey][dateKey]) {
          grouped[userKey][dateKey] = []
        }
        grouped[userKey][dateKey].push(visit)
      })

    // Sort each user-date combination's visits chronologically
    Object.keys(grouped).forEach(userCode => {
      Object.keys(grouped[userCode]).forEach(date => {
        grouped[userCode][date].sort((a, b) => {
          if (!a.arrivalTime || !b.arrivalTime) return 0
          const timeA = a.arrivalTime.includes('T') ? new Date(a.arrivalTime) : new Date(`2000-01-01T${a.arrivalTime}`)
          const timeB = b.arrivalTime.includes('T') ? new Date(b.arrivalTime) : new Date(`2000-01-01T${b.arrivalTime}`)
          return timeA.getTime() - timeB.getTime()
        })
        // Add sequence numbers for this day's journey
        grouped[userCode][date] = grouped[userCode][date].map((visit, index) => ({
          ...visit,
          sequence: index + 1
        }))
      })
    })

    return grouped
  }, [visits])

  // Get list of users with GPS data for selector
  const usersWithGPS = useMemo(() => {
    return Object.entries(userDateJourneys)
      .map(([userCode, dateGroups]) => {
        const totalVisits = Object.values(dateGroups).flat().length
        const firstVisit = Object.values(dateGroups).flat()[0]
        return {
          userCode,
          userName: firstVisit?.userName || userCode,
          visitCount: totalVisits
        }
      })
      .sort((a, b) => b.visitCount - a.visitCount)
  }, [userDateJourneys])

  // Get available dates for selected user
  const availableDates = useMemo(() => {
    if (!selectedUserForMap || selectedUserForMap === 'all') return []
    const userDates = userDateJourneys[selectedUserForMap]
    if (!userDates) return []
    return Object.keys(userDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  }, [selectedUserForMap, userDateJourneys])

  // Get the selected user's journey for map display (for specific date)
  const visitJourney = useMemo(() => {
    if (!selectedUserForMap || selectedUserForMap === 'all' || !selectedDateForMap) {
      return []
    }
    const userDates = userDateJourneys[selectedUserForMap]
    if (!userDates) return []
    const journey = userDates[selectedDateForMap] || []
    
    // Journey data is ready
    
    return journey
  }, [selectedUserForMap, selectedDateForMap, userDateJourneys])

  // Auto-select first user and most recent date when data loads
  useEffect(() => {
    if (usersWithGPS.length > 0 && selectedUserForMap === 'all') {
      setSelectedUserForMap(usersWithGPS[0].userCode)
    }
  }, [usersWithGPS, selectedUserForMap])

  // Auto-select most recent date when user changes
  useEffect(() => {
    if (availableDates.length > 0 && !selectedDateForMap) {
      setSelectedDateForMap(availableDates[0]) // Most recent date
    } else if (availableDates.length > 0 && !availableDates.includes(selectedDateForMap)) {
      setSelectedDateForMap(availableDates[0])
    }
  }, [availableDates, selectedDateForMap])

  // Calculate map center
  const mapCenter = useMemo(() => {
    if (visitJourney.length === 0) {
      return { lat: 20.5937, lng: 78.9629 } // Default: India center
    }

    const avgLat = visitJourney.reduce((sum: number, v: StoreVisit) => sum + (v.latitude || 0), 0) / visitJourney.length
    const avgLng = visitJourney.reduce((sum: number, v: StoreVisit) => sum + (v.longitude || 0), 0) / visitJourney.length

    return { lat: avgLat, lng: avgLng }
  }, [visitJourney])

  // Calculate travel time between two visits
  const calculateTravelTime = (prevVisit: any, currentVisit: any) => {
    if (!prevVisit) return 0
    try {
      const prevTimeStr = prevVisit.departureTime || prevVisit.arrivalTime
      const currentTimeStr = currentVisit.arrivalTime
      
      if (!prevTimeStr || !currentTimeStr) return 0
      
      // Handle both timestamp and time-only formats
      let prevTime, currentTime
      
      if (prevTimeStr.includes('T') || prevTimeStr.includes(' ')) {
        prevTime = new Date(prevTimeStr)
      } else {
        // Use previous visit's date for the previous time
        prevTime = new Date(`${prevVisit.visitDate}T${prevTimeStr}`)
      }
      
      if (currentTimeStr.includes('T') || currentTimeStr.includes(' ')) {
        currentTime = new Date(currentTimeStr)
      } else {
        currentTime = new Date(`${currentVisit.visitDate}T${currentTimeStr}`)
      }
      
      if (isNaN(prevTime.getTime()) || isNaN(currentTime.getTime())) return 0
      
      const diff = Math.round((currentTime.getTime() - prevTime.getTime()) / (1000 * 60))
      return diff > 0 ? diff : 0
    } catch (error) {
      console.error('Error calculating travel time:', error)
      return 0
    }
  }

  // Get marker color based on visit productivity
  const getMarkerColor = (visit: StoreVisit) => {
    if (visit.salesGenerated && visit.salesGenerated > 0) {
      return '#10b981' // Green for productive
    }
    return '#f59e0b' // Orange for non-productive
  }

  // Google Maps Directions for showing routes between stores
  useEffect(() => {
    if (!mapLoaded || !googleMapsLoaded || visitJourney.length === 0) {
      setDirectionsResponse(null)
      setMultipleDirections([])
      setDirectionsStatus('no-data')
      return
    }

    if (visitJourney.length === 1) {
      setDirectionsResponse(null)
      setMultipleDirections([])
      setDirectionsStatus('single-visit')
      return
    }

    setDirectionsStatus('loading')

    if (typeof google === 'undefined' || !google.maps?.DirectionsService) {
      console.error('Google Maps API not loaded')
      setDirectionsStatus('api-error')
      return
    }

    const directionsService = new google.maps.DirectionsService()
    const maxWaypoints = 23

    if (visitJourney.length <= maxWaypoints + 2) {
      // Single route for <= 25 stores
      const firstStore = visitJourney[0]
      const lastStore = visitJourney[visitJourney.length - 1]
      const middleStores = visitJourney.slice(1, -1)

      const waypoints = middleStores.map(visit => ({
        location: { lat: visit.latitude!, lng: visit.longitude! },
        stopover: true
      }))

      setMultipleDirections([])

      directionsService.route(
        {
          origin: { lat: firstStore.latitude!, lng: firstStore.longitude! },
          destination: { lat: lastStore.latitude!, lng: lastStore.longitude! },
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false
        },
        (result, status) => {
          if (status === 'OK' && result) {
            setDirectionsResponse(result)
            setDirectionsStatus('success')
            // Route loaded successfully
          } else {
            console.error(`Route failed: ${status}`)
            setDirectionsResponse(null)
            setDirectionsStatus(`failed-${status}`)
          }
        }
      )
    } else {
      // Multiple route segments for 25+ stores
      const segments: any[] = []
      for (let i = 0; i < visitJourney.length - 1; i += maxWaypoints + 1) {
        const segmentEnd = Math.min(i + maxWaypoints + 1, visitJourney.length - 1)
        segments.push({
          start: i,
          end: segmentEnd,
          stores: visitJourney.slice(i, segmentEnd + 1)
        })
      }

      setDirectionsResponse(null)
      const segmentResults: google.maps.DirectionsResult[] = []
      let completedSegments = 0

      segments.forEach((segment, segIndex) => {
        const firstStore = segment.stores[0]
        const lastStore = segment.stores[segment.stores.length - 1]
        const middleStores = segment.stores.slice(1, -1)

        const waypoints = middleStores.map((visit: any) => ({
          location: { lat: visit.latitude!, lng: visit.longitude! },
          stopover: true
        }))

        directionsService.route(
          {
            origin: { lat: firstStore.latitude!, lng: firstStore.longitude! },
            destination: { lat: lastStore.latitude!, lng: lastStore.longitude! },
            waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false
          },
          (result, status) => {
            if (status === 'OK' && result) {
              segmentResults[segIndex] = result
              completedSegments++

              if (completedSegments === segments.length) {
                setMultipleDirections(segmentResults.filter(r => r))
                setDirectionsStatus('success-multiple')
                // Multiple route segments loaded successfully
              }
            } else {
              console.error(`Segment ${segIndex} failed: ${status}`)
            }
          }
        )
      })
    }
  }, [mapLoaded, googleMapsLoaded, visitJourney])

  const formatTime = (time: string) => {
    if (!time) return '-'
    try {
      // Handle various time formats
      // If it's already a full timestamp
      if (time.includes('T') || time.includes(' ')) {
        const date = new Date(time)
        if (isNaN(date.getTime())) return '-'
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      }
      // If it's just HH:MM:SS or HH:MM format
      const date = new Date(`2000-01-01T${time}`)
      if (isNaN(date.getTime())) return '-'
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch (error) {
      console.error('Error formatting time:', time, error)
      return time.substring(0, 5) || '-' // Fallback to first 5 chars (HH:MM)
    }
  }

  const formatDuration = (minutes: number) => {
    if (minutes === 0) {
      return '-'
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const formatAggregateDuration = (minutes: number) => {
    if (minutes === 0) {
      return '-'
    }
    
    const days = Math.floor(minutes / (60 * 24))
    const remainingMinutes = minutes % (60 * 24)
    const hours = Math.floor(remainingMinutes / 60)
    const mins = remainingMinutes % 60
    
    if (days > 0) {
      return `${days}d ${hours}h ${mins}m`
    } else if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }


  const exportToExcel = () => {
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ['Store User Visit Report'],
      ['Period', `${filters.startDate} to ${filters.endDate}`],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary Metrics'],
      ['Total Visits', metrics.totalVisits],
      ['Unique Users', metrics.uniqueUsers],
      ['Unique Stores', metrics.uniqueStores],
      ['Average Duration (minutes)', metrics.avgDuration],
      [],
      ['Filters Applied'],
      ['Team Leader', filters.teamLeaderCode || 'All'],
      ['Field User', filters.userCode || 'All'],
      ['Region', filters.regionCode || 'All'],
      ['Chain', filters.chainName || 'All'],
      ['Store', filters.storeCode || 'All']
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    // All Visits sheet
    const visitsData = visits.map((v: StoreVisit) => ({
      'TL Code': v.teamLeaderCode || 'N/A',
      'TL Name': v.teamLeaderName || 'N/A',
      'Field User': v.userName,
      'Field User Code': v.userCode,
      'Store Code': v.storeCode,
      'Store Name': v.storeName,
      'Chain Name': v.chainName || '-',
      'Latitude': v.latitude?.toFixed(6) || '-',
      'Longitude': v.longitude?.toFixed(6) || '-',
      'Date': v.visitDate,
      'Check-in Time': v.arrivalTime,
      'Check-out Time': v.departureTime || '-',
      'Total Time Spent': v.durationMinutes > 0 ? `${v.durationMinutes} mins` : '-',
      'Reason': (() => {
        const reason = v.remarks || v.visitPurpose || v.visitOutcome || ''
        return (reason && reason !== '[null]' && reason !== 'null' && reason.trim() !== '') 
          ? reason 
          : 'N/A'
      })()
    }))
    const visitsSheet = XLSX.utils.json_to_sheet(visitsData)
    XLSX.utils.book_append_sheet(wb, visitsSheet, 'All Visits')

    // Export
    XLSX.writeFile(wb, `store-visits-report-${filters.startDate}-${filters.endDate}.xlsx`)
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-white p-6 space-y-6 overflow-y-auto" : "p-6 space-y-6"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Store User Visit Report</h1>
          <p className="text-gray-600 mt-1">Track field user visits to stores with comprehensive analytics</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh
          </button>
          {viewMode === 'detailed' && (
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Dashboard Filters */}
      <DashboardFilters
        filters={filters}
        filterOptions={filterOptions}
        onFilterChange={updateFilter}
        onDateRangeChange={setDateRange}
        onReset={resetFilters}
        loading={filtersLoading}
        selectedDateRange={selectedDateRange}
        onDateRangeSelect={handleDateRangeSelect}
        showChainFilter={true}
        showStoreFilter={true}
      />

      {/* Summary Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-blue-50 p-2 text-blue-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mr-10">Total Visits</p>
                <InfoTooltip content="Total number of store visits recorded in the selected period" />
              </div>
              <p className="mt-1 text-xs text-gray-500 ml-2">Across all selected filters</p>
              <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{metrics.totalVisits}</p>
              <p className="mt-1 text-xs text-gray-500 ml-2">{metrics.uniqueStores} stores visited</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-green-50 p-2 text-green-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mr-10">Productive Visits</p>
                <InfoTooltip content="Visits that resulted in sales transactions" />
              </div>
              <p className="mt-1 text-xs text-gray-500 ml-2">Sales-generating visits</p>
              <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{metrics.productiveVisits}</p>
              <p className="mt-1 text-xs font-medium text-green-600 ml-2">{metrics.productivityRate.toFixed(1)}% productivity</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-orange-50 p-2 text-orange-600">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mr-10">Avg Duration</p>
                <InfoTooltip content="Average time spent per store visit (calculated from visits with check-in and check-out times)" />
              </div>
              <p className="mt-1 text-xs text-gray-500 ml-2">Average time per visit</p>
              <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{formatDuration(metrics.avgDuration)}</p>
              <p className="mt-1 text-xs text-gray-500 ml-2">Based on visits with duration data</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-purple-50 p-2 text-purple-600">
                  <User className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mr-10">Field Users</p>
                <InfoTooltip content="Number of distinct field users who made visits" />
              </div>
              <p className="mt-1 text-xs text-gray-500 ml-2">Active in selected period</p>
              <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">{metrics.uniqueUsers}</p>
              <p className="mt-1 text-xs text-gray-500 ml-2">Tracking unique field representatives</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-emerald-50 p-2 text-emerald-600">
                  <Download className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mr-10">Sales Generated</p>
                <InfoTooltip content="Total sales generated from productive visits" />
              </div>
              <p className="mt-1 text-xs text-gray-500 ml-2">Gross sales value</p>
              <p className="mt-3 text-2xl font-bold text-gray-900 ml-2">AED{(metrics.totalSales / 1000).toFixed(1)}K</p>
              <p className="mt-1 text-xs text-gray-500 ml-2">{metrics.onTimeVisits} on-time arrivals</p>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle - Centered between KPI cards and content */}
      {!loading && !error && visits.length > 0 && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1 shadow-sm">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                viewMode === 'summary'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Summary View
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                viewMode === 'map'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Map View
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                viewMode === 'detailed'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Detailed View
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingBar message="Loading store visits..." />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      ) : visits.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <MapPin className="mx-auto text-gray-400" size={48} />
          <p className="mt-4 text-gray-600">No store visits found for the selected period</p>
        </div>
      ) : viewMode === 'map' ? (
        <div className="space-y-6">
          {/* Visit Journey Map with Google Maps */}
          {Object.keys(userDateJourneys).length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <MapPin size={24} className="text-blue-600" />
                      Field User Journey Map
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {visitJourney.length > 0 && selectedDateForMap && `Showing ${visitJourney.length} visits on ${new Date(selectedDateForMap).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </p>
                  </div>
                  
                  {/* User & Date Selector */}
                  {usersWithGPS.length > 0 && (
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Field User:</label>
                        <select
                          value={selectedUserForMap}
                          onChange={(e) => setSelectedUserForMap(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[180px]"
                        >
                          {usersWithGPS.map((user) => (
                            <option key={user.userCode} value={user.userCode}>
                              {user.userName}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Date Selector */}
                      {availableDates.length > 0 && (
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700">Date:</label>
                          <select
                            value={selectedDateForMap}
                            onChange={(e) => setSelectedDateForMap(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]"
                          >
                            {availableDates.map((date) => (
                              <option key={date} value={date}>
                                {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Route Status Indicator */}
                <div className="mt-3 flex items-center justify-between">
                  {/* Route Status Indicator */}
                  {visitJourney.length > 1 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium" style={{
                      backgroundColor: directionsStatus === 'success' || directionsStatus === 'success-multiple' ? '#dbeafe' :
                                      directionsStatus === 'loading' ? '#f3f4f6' : '#fee2e2',
                      color: directionsStatus === 'success' || directionsStatus === 'success-multiple' ? '#1e40af' :
                             directionsStatus === 'loading' ? '#6b7280' : '#dc2626',
                      border: `2px solid ${directionsStatus === 'success' || directionsStatus === 'success-multiple' ? '#3b82f6' :
                                           directionsStatus === 'loading' ? '#d1d5db' : '#f87171'}`
                    }}>
                      {directionsStatus === 'loading' && (
                        <>
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                          <span>Loading Route...</span>
                        </>
                      )}
                      {(directionsStatus === 'success' || directionsStatus === 'success-multiple') && (
                        <>
                          <MapPin size={16} />
                          <span>Route: {visitJourney.length} Stores Connected ✓</span>
                        </>
                      )}
                      {directionsStatus.startsWith('failed') && (
                        <>
                          <span>⚠️ Route Error: {directionsStatus.replace('failed-', '').toUpperCase()}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ height: '500px', position: 'relative' }}>
                {!googleMapsLoaded ? (
                  <div className="h-full flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading Google Maps...</p>
                    </div>
                  </div>
                ) : (
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={mapCenter}
                    zoom={visitJourney.length === 1 ? 15 : 6}
                    options={{
                      zoomControl: true,
                      streetViewControl: false,
                      mapTypeControl: true,
                      fullscreenControl: true
                    }}
                    onLoad={() => setMapLoaded(true)}
                  >
                    {/* Visit Markers with Sequence Numbers */}
                    {visitJourney.map((visit: StoreVisit, index: number) => {
                      const prevVisit = index === 0 ? null : visitJourney[index - 1]
                      const travelTime = calculateTravelTime(prevVisit, visit)
                      const sequence = visit.sequence || (index + 1)
                      
                      return (
                        <Marker
                          key={`visit-${visit.storeCode}-${sequence}-${index}`}
                          position={{ lat: visit.latitude!, lng: visit.longitude! }}
                          title={`Stop #${sequence}: ${visit.storeName}`}
                          onClick={() => setSelectedMarker({
                            ...visit,
                            sequence,
                            travelTime,
                            prevLocation: index === 0 ? 'Journey Start' : visitJourney[index - 1].storeName
                          })}
                          label={{
                            text: sequence.toString(),
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                          icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            fillColor: getMarkerColor(visit),
                            fillOpacity: 0.9,
                            strokeColor: '#ffffff',
                            strokeWeight: 2,
                            scale: 10
                          }}
                        />
                      )
                    })}

                    {/* Directions Renderer for routes */}
                    {directionsResponse && (
                      <DirectionsRenderer
                        directions={directionsResponse}
                        options={{
                          suppressMarkers: true,
                          polylineOptions: {
                            strokeColor: '#1e40af',
                            strokeWeight: 4,
                            strokeOpacity: 0.8
                          }
                        }}
                      />
                    )}

                    {/* Multiple route segments for 25+ stores */}
                    {multipleDirections.map((directions, index) => (
                      <DirectionsRenderer
                        key={`route-segment-${index}`}
                        directions={directions}
                        options={{
                          suppressMarkers: true,
                          polylineOptions: {
                            strokeColor: '#1e40af',
                            strokeWeight: 4,
                            strokeOpacity: 0.8
                          }
                        }}
                      />
                    ))}

                    {/* Enhanced Info Window with Travel Time */}
                    {selectedMarker && (
                      <InfoWindow
                        position={{ lat: selectedMarker.latitude!, lng: selectedMarker.longitude! }}
                        onCloseClick={() => setSelectedMarker(null)}
                      >
                        <div style={{ padding: '12px', maxWidth: '320px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                            <span style={{
                              backgroundColor: selectedMarker.salesGenerated && selectedMarker.salesGenerated > 0 ? '#10b981' : '#f59e0b',
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
                              {selectedMarker.storeName}
                            </h3>
                          </div>

                          {/* Travel Info */}
                          {selectedMarker.travelTime > 0 && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '12px',
                              backgroundColor: '#eff6ff',
                              borderRadius: '8px',
                              marginBottom: '12px',
                              border: '1px solid #bfdbfe'
                            }}>
                              <MapPin size={16} style={{ color: '#2563eb', marginRight: '8px' }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '600' }}>
                                  From {selectedMarker.prevLocation}
                                </div>
                                <div style={{ fontSize: '11px', color: '#1e40af' }}>
                                  Travel Time: {selectedMarker.travelTime} min
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Visit Details */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Clock size={14} style={{ color: '#059669' }} />
                              <span style={{ fontSize: '13px' }}><strong>Arrival:</strong> {formatTime(selectedMarker.arrivalTime)}</span>
                            </div>
                            {selectedMarker.departureTime && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={14} style={{ color: '#f59e0b' }} />
                                <span style={{ fontSize: '13px' }}><strong>Departure:</strong> {formatTime(selectedMarker.departureTime)}</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Clock size={14} style={{ color: '#f59e0b' }} />
                              <span style={{ fontSize: '13px' }}><strong>Duration:</strong> {formatDuration(selectedMarker.durationMinutes)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <User size={14} style={{ color: '#8b5cf6' }} />
                              <span style={{ fontSize: '13px' }}><strong>User:</strong> {selectedMarker.userName}</span>
                            </div>
                            {selectedMarker.salesGenerated && selectedMarker.salesGenerated > 0 && (
                              <div style={{
                                padding: '8px',
                                backgroundColor: '#d1fae5',
                                borderRadius: '6px',
                                marginTop: '4px'
                              }}>
                                <div style={{ fontSize: '13px', color: '#065f46', fontWeight: '600' }}>
                                  AED{selectedMarker.salesGenerated.toLocaleString('en-IN')} Sales
                                </div>
                                {selectedMarker.productsOrdered > 0 && (
                                  <div style={{ fontSize: '11px', color: '#047857' }}>
                                    {selectedMarker.productsOrdered} Products Ordered
                                  </div>
                                )}
                              </div>
                            )}
                            {selectedMarker.visitPurpose && (
                              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                <strong>Purpose:</strong> {selectedMarker.visitPurpose}
                              </div>
                            )}
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </GoogleMap>
                )}
              </div>
              <div className="px-6 py-3 bg-gray-50 border-t flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Productive ({visits.filter(v => v.salesGenerated && v.salesGenerated > 0).length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span>Non-Productive ({visits.filter(v => !v.salesGenerated || v.salesGenerated === 0).length})</span>
                </div>
              </div>
            </div>
          )}

          {/* Journey Timeline */}
          {visitJourney.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Clock size={24} className="text-blue-600" />
                    Journey Timeline - {visitJourney[0]?.userName}
                  </h2>
                  {selectedDateForMap && (
                    <p className="text-sm text-gray-600 mt-1 ml-8">
                      {new Date(selectedDateForMap).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>

              {/* Timeline Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div className="text-sm text-gray-600 mb-2 md:mb-0">
                  <span className="font-semibold">Start:</span> {visitJourney[0]?.arrivalTime ? formatTime(visitJourney[0].arrivalTime) : 'N/A'} |
                  <span className="font-semibold"> End:</span> {visitJourney[visitJourney.length - 1]?.departureTime ? formatTime(visitJourney[visitJourney.length - 1].departureTime!) : (visitJourney[visitJourney.length - 1]?.arrivalTime ? formatTime(visitJourney[visitJourney.length - 1].arrivalTime) : 'N/A')} |
                  <span className="font-semibold"> Total Visits:</span> {visitJourney.length}
                </div>
                <div className="text-sm font-semibold text-blue-600 flex items-center gap-4">
                  <span>Total Duration: {formatDuration(visitJourney.reduce((sum: number, v: StoreVisit) => sum + (v.durationMinutes || 0), 0))}</span>
                  <span className="text-gray-400">|</span>
                  <span>Avg Duration: {formatDuration(Math.round(visitJourney.reduce((sum: number, v: StoreVisit) => sum + (v.durationMinutes || 0), 0) / visitJourney.length))}</span>
                </div>
              </div>

              {/* Timeline Items */}
              <div className="space-y-3">
                {visitJourney.map((visit: StoreVisit, index: number) => {
                  const prevVisit = index === 0 ? null : visitJourney[index - 1]
                  const travelTime = calculateTravelTime(prevVisit, visit)
                  const sequence = visit.sequence || (index + 1)
                  const isProductive = visit.salesGenerated && visit.salesGenerated > 0

                  return (
                    <div key={`timeline-${visit.storeCode}-${sequence}`}>
                      {/* Travel Time Indicator */}
                      {index > 0 && travelTime > 0 && (
                        <div className="flex items-center gap-3 py-2 px-4 bg-gray-50 rounded-lg mb-2">
                          <MapPin size={14} className="text-blue-500" />
                          <span className="text-xs text-gray-600">Travel Time: {travelTime} min</span>
                          <div className="flex-1 h-0.5 bg-gradient-to-r from-blue-300 to-blue-500 relative">
                            <div className="absolute right-0 -top-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                          </div>
                        </div>
                      )}

                      {/* Visit Card */}
                      <div
                        className={`flex items-center p-4 rounded-lg border-l-4 cursor-pointer transition-all hover:shadow-md ${
                          isProductive
                            ? 'bg-green-50 border-green-500 hover:bg-green-100'
                            : 'bg-orange-50 border-orange-500 hover:bg-orange-100'
                        }`}
                        onClick={() => {
                          // Scroll map to this marker and open info window
                          setSelectedMarker({
                            ...visit,
                            sequence,
                            travelTime,
                            prevLocation: index === 0 ? 'Journey Start' : visitJourney[index - 1].storeName
                          })
                        }}
                      >
                        {/* Sequence Badge */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm mr-4 ${
                          isProductive ? 'bg-green-500' : 'bg-orange-500'
                        }`}>
                          {sequence}
                        </div>

                        {/* Visit Details */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900 mb-1">{visit.storeName}</div>
                              <div className="text-sm text-gray-600 mb-1">
                                {visit.arrivalTime ? formatTime(visit.arrivalTime) : 'N/A'} - {visit.departureTime ? formatTime(visit.departureTime) : 'In Progress'}
                              </div>
                              {isProductive && visit.salesGenerated && visit.salesGenerated > 0 && (
                                <div className="text-sm font-semibold text-blue-600">
                                  💰 AED{visit.salesGenerated.toLocaleString('en-IN')} {visit.productsOrdered && visit.productsOrdered > 0 ? `(${visit.productsOrdered} products)` : ''}
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              {visit.durationMinutes > 0 && (
                                <div className={`text-lg font-bold mb-1 ${
                                  visit.durationMinutes >= 30 ? 'text-green-600' :
                                  visit.durationMinutes >= 15 ? 'text-orange-600' : 'text-yellow-600'
                                }`}>
                                  {formatDuration(visit.durationMinutes)}
                                </div>
                              )}
                              <div className={`text-xs font-semibold ${
                                isProductive ? 'text-green-700' : 'text-orange-700'
                              }`}>
                                {isProductive ? 'PRODUCTIVE' : 'NON-PRODUCTIVE'}
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
      ) : viewMode === 'summary' ? (
        <div className="space-y-6">
          {/* Charts Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 size={24} className="text-blue-600" />
              Visit Analytics
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 10 Users by Visits */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Top 10 Users by Visit Count</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.top20Users.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="userName" angle={-45} textAnchor="end" height={100} fontSize={12} />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="visitCount" fill="#3b82f6" name="Visits" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Daily Visit Trend */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Daily Visit Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" height={100} fontSize={12} />
                    <YAxis />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="visits" stroke="#10b981" strokeWidth={2} name="Visits" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Visit Outcome Distribution - only show if meaningful data exists */}
              {metrics.outcomeData.length > 0 && 
               !(metrics.outcomeData.length === 1 && (metrics.outcomeData[0].name === 'Not Specified' || !metrics.outcomeData[0].name)) && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Visit Outcome Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={metrics.outcomeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {metrics.outcomeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Average Duration by User */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Top 10 Users by Avg Visit Duration</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.avgDurationByUser}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="userName" angle={-45} textAnchor="end" height={100} fontSize={12} />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="avgDuration" fill="#f59e0b" name="Avg Duration (mins)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top/Bottom 20 Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 20 Users */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-green-600" />
                Top 20 Users by Visit Count
              </h2>
              <div className="overflow-auto max-h-96 relative">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Rank</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">User</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Visits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {metrics.top20Users.map((user, index) => (
                      <tr key={user.userCode} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{index + 1}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{user.userName}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">{user.visitCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom 20 Users */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-red-600" />
                Bottom 20 Users by Visit Count
              </h2>
              <div className="overflow-auto max-h-96 relative">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Rank</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">User</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Visits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {metrics.bottom20Users.map((user, index) => (
                      <tr key={user.userCode} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{index + 1}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{user.userName}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">{user.visitCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Regional & Store Class Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Regional Analysis */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <MapPin size={20} className="text-purple-600" />
                Regional Analysis
              </h2>
              <div className="overflow-auto max-h-80 relative">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Region</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Visits</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Avg Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {metrics.regionalData.map((region) => (
                      <tr key={region.region} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{region.region}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{region.visits}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatDuration(region.avgDuration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chain Analysis */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Building2 size={20} className="text-blue-600" />
                Chain Analysis
              </h2>
              <div className="overflow-auto max-h-80 relative">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Chain</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Visits</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Avg Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {metrics.chainData.map((chainItem) => (
                      <tr key={chainItem.chain} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{chainItem.chain}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{chainItem.visits}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatDuration(chainItem.avgDuration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Detailed View - Using exact same Table components as Sales Report
        <div className={isTableFullscreen ? "fixed inset-0 z-50 bg-white overflow-y-auto" : ""} style={isTableFullscreen ? {
          padding: '24px'
        } : {
          backgroundColor: 'rgb(255, 255, 255)',
          borderRadius: '12px',
          border: '1px solid rgb(228, 228, 231)',
          boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: 'rgb(24, 24, 27)',
              margin: 0
            }}>Store Visit Details</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                onClick={() => setIsTableFullscreen(!isTableFullscreen)}
                variant="outline"
                size="sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  border: '1px solid #d1d5db'
                }}
                title={isTableFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isTableFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                {isTableFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </Button>
              <Button
                onClick={exportToExcel}
                variant="outline"
                size="sm"
                disabled={visits.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none'
                }}
              >
                <Download className="h-4 w-4" />
                Export to Excel
              </Button>
            </div>
          </div>
          <div style={{
            maxHeight: isTableFullscreen ? 'calc(100vh - 150px)' : '600px',
            overflowY: 'auto',
            borderRadius: '8px',
            border: '1px solid rgb(228, 228, 231)',
            position: 'relative'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{
                position: 'sticky',
                top: 0,
                backgroundColor: 'rgb(249, 250, 251)',
                zIndex: 10,
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}>
                <tr style={{ borderBottom: '1px solid rgb(229, 231, 235)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '100px' }}>TL Code</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '180px' }}>TL Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '180px' }}>Field User</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '120px' }}>Field User Code</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '120px' }}>Store Code</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '200px' }}>Store Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '150px' }}>Chain Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '100px' }}>Latitude</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '100px' }}>Longitude</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '120px' }}>Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '100px' }}>Check-in Time</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '100px' }}>Check-out Time</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '120px' }}>Total Time Spent</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'rgb(107, 114, 128)', whiteSpace: 'nowrap', minWidth: '200px' }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVisits.map((visit, index) => {
                  const isProductive = visit.salesGenerated && visit.salesGenerated > 0
                  return (
                    <tr key={`visit-${index}-${visit.storeCode}`} style={{
                      borderBottom: '1px solid rgb(229, 231, 235)',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(249, 250, 251)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                        <span style={{
                          backgroundColor: 'rgb(219, 234, 254)',
                          color: 'rgb(29, 78, 216)',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {visit.teamLeaderCode || 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px' }}>{visit.teamLeaderName || 'N/A'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>{visit.userName || '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                        <span style={{
                          backgroundColor: 'rgb(236, 253, 245)',
                          color: 'rgb(34, 197, 94)',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {visit.userCode || '-'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                        <span style={{
                          backgroundColor: 'rgb(254, 243, 199)',
                          color: 'rgb(161, 98, 7)',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {visit.storeCode}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>{visit.storeName}</td>
                      <td style={{ padding: '12px 16px', fontSize: '14px' }}>{visit.chainName || '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'right', color: 'rgb(107, 114, 128)', fontFamily: 'monospace' }}>
                        {visit.latitude ? visit.latitude.toFixed(6) : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'right', color: 'rgb(107, 114, 128)', fontFamily: 'monospace' }}>
                        {visit.longitude ? visit.longitude.toFixed(6) : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>
                        {new Date(visit.visitDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', textAlign: 'right', fontWeight: 500, color: 'rgb(34, 197, 94)' }}>
                        {visit.arrivalTime ? formatTime(visit.arrivalTime) : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', textAlign: 'right', fontWeight: 500, color: 'rgb(249, 115, 22)' }}>
                        {visit.departureTime ? formatTime(visit.departureTime) : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', textAlign: 'right', fontWeight: 600 }}>
                        <span style={{
                          color: visit.durationMinutes >= 30 ? 'rgb(34, 197, 94)' : 
                                 visit.durationMinutes >= 15 ? 'rgb(249, 115, 22)' : 'rgb(234, 179, 8)'
                        }}>
                          {visit.durationMinutes > 0 ? formatDuration(visit.durationMinutes) : '-'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'rgb(107, 114, 128)' }}>
                        {(() => {
                          const reason = visit.remarks || visit.visitPurpose || visit.visitOutcome || ''
                          return (reason && reason !== '[null]' && reason !== 'null' && reason.trim() !== '') 
                            ? reason 
                            : 'N/A'
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {visits.length === 0 && (
            <div style={{
              padding: '60px',
              textAlign: 'center',
              color: 'rgb(113, 113, 122)',
              backgroundColor: 'rgb(249, 250, 251)',
              borderRadius: '8px',
              marginTop: '16px'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>No Visit Data Available</div>
              <div style={{ fontSize: '14px' }}>Select a date range to view store visit details</div>
            </div>
          )}
          {visits.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgb(228, 228, 231)',
              paddingTop: '16px'
            }}>
              <div style={{ color: 'rgb(107, 114, 128)', fontSize: '14px' }}>
                Showing {startIndex}-{endIndex} of {visits.length} visits
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span style={{ color: 'rgb(63, 63, 70)', fontSize: '14px' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
