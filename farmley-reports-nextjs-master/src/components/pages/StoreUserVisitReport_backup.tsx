'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { MapPin, Clock, User, Building2, TrendingUp, Download, BarChart3, CheckCircle, AlertTriangle, Maximize, Minimize, Calendar, Filter, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
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
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

// Global Google Maps loading state management
interface GoogleMapsGlobal {
  loadingPromise: Promise<void> | null
  isLoaded: boolean
  isLoading: boolean
  loadAttempts: number
}

declare global {
  interface Window {
    __GOOGLE_MAPS_STATE__?: GoogleMapsGlobal
  }
}

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

const checkGoogleMapsLoaded = (): boolean => {
  const isLoaded = typeof window !== 'undefined' &&
                  window.google &&
                  window.google.maps &&
                  window.google.maps.Map &&
                  window.google.maps.Marker

  if (isLoaded) {
    const state = getGoogleMapsState()
    state.isLoaded = true
    state.isLoading = false
  }

  return isLoaded
}

const loadGoogleMapsGlobally = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const state = getGoogleMapsState()

    if (state.isLoaded || checkGoogleMapsLoaded()) {
      state.isLoaded = true
      state.isLoading = false
      resolve()
      return
    }

    if (state.loadingPromise) {
      state.loadingPromise.then(resolve).catch(reject)
      return
    }

    if (state.loadAttempts >= 3) {
      reject(new Error('Maximum Google Maps load attempts exceeded'))
      return
    }

    state.isLoading = true
    state.loadAttempts++

    state.loadingPromise = new Promise<void>((innerResolve, innerReject) => {
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)

      if (existingScript) {
        const checkInterval = setInterval(() => {
          if (checkGoogleMapsLoaded()) {
            clearInterval(checkInterval)
            state.isLoaded = true
            state.isLoading = false
            innerResolve()
          }
        }, 100)

        setTimeout(() => {
          clearInterval(checkInterval)
          if (!state.isLoaded) {
            state.isLoading = false
            innerReject(new Error('Google Maps loading timeout'))
          }
        }, 10000)

        return
      }

      const script = document.createElement('script')
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&loading=async`
      script.async = true
      script.defer = true

      script.onload = () => {
        if (checkGoogleMapsLoaded()) {
          state.isLoaded = true
          state.isLoading = false
          innerResolve()
        } else {
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
        state.isLoading = false
        document.head.removeChild(script)
        innerReject(new Error('Google Maps script failed to load'))
      }

      document.head.appendChild(script)
    })

    state.loadingPromise
      .then(() => {
        state.loadingPromise = null
        resolve()
      })
      .catch((error) => {
        state.loadingPromise = null
        state.isLoading = false
        reject(error)
      })
  })
}

export function StoreUserVisitReport() {
  const [visits, setVisits] = useState<StoreVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    users: [],
    stores: [],
    cities: [],
    purposes: [],
    outcomes: [],
    teamLeaders: [],
    assistantLeaders: []
  })

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedTeamLeader, setSelectedTeamLeader] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedPurpose, setSelectedPurpose] = useState('')
  const [selectedOutcome, setSelectedOutcome] = useState('')

  // View mode changed from 'overview' | 'analysis' to 'summary' | 'detailed'
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Google Maps state
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState<boolean>(false)
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null)
  const [mapLoaded, setMapLoaded] = useState<boolean>(false)
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null)
  const [multipleDirections, setMultipleDirections] = useState<google.maps.DirectionsResult[]>([])
  const [directionsStatus, setDirectionsStatus] = useState<string>('loading')
  const [selectedMarker, setSelectedMarker] = useState<any>(null)

  // Initialize Google Maps
  useEffect(() => {
    const initializeGoogleMaps = async () => {
      try {
        if (checkGoogleMapsLoaded()) {
          setGoogleMapsLoaded(true)
          setGoogleMapsError(null)
          return
        }

        await loadGoogleMapsGlobally()
        setGoogleMapsLoaded(true)
        setGoogleMapsError(null)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown Google Maps error'
        setGoogleMapsError(errorMessage)
        setGoogleMapsLoaded(false)
      }
    }

    initializeGoogleMaps()
  }, [])

  useEffect(() => {
    fetchFilterOptions()
  }, [startDate, endDate, selectedTeamLeader])

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, selectedTeamLeader, selectedUser, selectedStore, selectedCity, selectedPurpose, selectedOutcome])

  const fetchFilterOptions = async () => {
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(selectedTeamLeader && { teamLeaderCode: selectedTeamLeader })
      })

      const response = await fetch(`/api/store-visits/filters?${params}`)
      const result = await response.json()

      if (result.success) {
        setFilterOptions(result.data)
      }
    } catch (err) {
      console.error('Error fetching filter options:', err)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(selectedTeamLeader && { teamLeaderCode: selectedTeamLeader }),
        ...(selectedUser && { userCode: selectedUser }),
        ...(selectedStore && { storeCode: selectedStore }),
        ...(selectedCity && { cityCode: selectedCity }),
        ...(selectedPurpose && { visitPurpose: selectedPurpose }),
        ...(selectedOutcome && { visitOutcome: selectedOutcome })
      })

      const response = await fetch(`/api/store-visits?${params}`)
      const result = await response.json()

      if (result.success) {
        setVisits(result.data)
      } else {
        setError(result.error || 'Failed to fetch store visits')
      }
    } catch (err) {
      console.error('Error fetching store visits:', err)
      setError('Failed to fetch store visits')
    } finally {
      setLoading(false)
    }
  }

  // Calculated metrics
  const metrics = useMemo(() => {
    const totalVisits = visits.length
    const uniqueUsers = new Set(visits.map(v => v.userCode)).size
    const uniqueStores = new Set(visits.map(v => v.storeCode)).size
    const avgDuration = visits.length > 0
      ? Math.round(visits.reduce((sum, v) => sum + v.durationMinutes, 0) / visits.length)
      : 0

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

    // Average duration by user
    const userDurations = visits.reduce((acc, visit) => {
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

    // Regional analysis
    const regionalVisits = visits.reduce((acc, visit) => {
      const region = visit.regionCode || 'Unknown'
      if (!acc[region]) {
        acc[region] = { count: 0, totalDuration: 0 }
      }
      acc[region].count += 1
      acc[region].totalDuration += visit.durationMinutes
      return acc
    }, {} as Record<string, { count: number; totalDuration: number }>)

    const regionalData = Object.entries(regionalVisits)
      .map(([region, data]) => ({
        region,
        visits: data.count,
        avgDuration: Math.round(data.totalDuration / data.count)
      }))
      .sort((a, b) => b.visits - a.visits)

    // Store class analysis
    const storeClassVisits = visits.reduce((acc, visit) => {
      const storeClass = visit.storeClass || 'Unknown'
      if (!acc[storeClass]) {
        acc[storeClass] = { count: 0, totalDuration: 0 }
      }
      acc[storeClass].count += 1
      acc[storeClass].totalDuration += visit.durationMinutes
      return acc
    }, {} as Record<string, { count: number; totalDuration: number }>)

    const storeClassData = Object.entries(storeClassVisits)
      .map(([storeClass, data]) => ({
        storeClass,
        visits: data.count,
        avgDuration: Math.round(data.totalDuration / data.count)
      }))
      .sort((a, b) => b.visits - a.visits)

    return {
      totalVisits,
      uniqueUsers,
      uniqueStores,
      avgDuration,
      top20Users,
      bottom20Users,
      dailyTrend,
      outcomeData,
      avgDurationByUser,
      regionalData,
      storeClassData
    }
  }, [visits])

  // Process visits for map visualization (chronologically sorted with GPS data)
  const visitJourney = useMemo(() => {
    return visits
      .filter(v => v.latitude && v.longitude)
      .sort((a, b) => {
        const dateCompare = new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()
        if (dateCompare !== 0) return dateCompare
        return new Date(`2000-01-01T${a.arrivalTime}`).getTime() - new Date(`2000-01-01T${b.arrivalTime}`).getTime()
      })
      .map((visit, index) => ({
        ...visit,
        sequence: index + 1
      }))
  }, [visits])

  // Calculate map center
  const mapCenter = useMemo(() => {
    if (visitJourney.length === 0) {
      return { lat: 28.7041, lng: 77.1025 } // Default: Delhi
    }

    const avgLat = visitJourney.reduce((sum, v) => sum + (v.latitude || 0), 0) / visitJourney.length
    const avgLng = visitJourney.reduce((sum, v) => sum + (v.longitude || 0), 0) / visitJourney.length

    return { lat: avgLat, lng: avgLng }
  }, [visitJourney])

  // Calculate route with DirectionsService
  useEffect(() => {
    if (!mapLoaded || !visitJourney.length || viewMode !== 'summary') {
      setDirectionsResponse(null)
      setMultipleDirections([])
      setDirectionsStatus('no-data')
      return
    }

    setDirectionsStatus('loading')

    if (typeof google === 'undefined' || !google.maps?.DirectionsService) {
      setDirectionsStatus('api-error')
      return
    }

    const directionsService = new google.maps.DirectionsService()
    const maxWaypoints = 23

    if (visitJourney.length === 1) {
      setDirectionsResponse(null)
      setMultipleDirections([])
      setDirectionsStatus('single-visit')
      return
    }

    if (visitJourney.length <= maxWaypoints + 2) {
      const origin = visitJourney[0]
      const destination = visitJourney[visitJourney.length - 1]
      const waypoints = visitJourney.slice(1, -1).map(v => ({
        location: { lat: v.latitude!, lng: v.longitude! },
        stopover: true
      }))

      setMultipleDirections([])

      directionsService.route(
        {
          origin: { lat: origin.latitude!, lng: origin.longitude! },
          destination: { lat: destination.latitude!, lng: destination.longitude! },
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false
        },
        (result, status) => {
          if (status === 'OK' && result) {
            setDirectionsResponse(result)
            setDirectionsStatus('success')
          } else {
            setDirectionsResponse(null)
            setDirectionsStatus(`failed-${status}`)
          }
        }
      )
    } else {
      // Handle 25+ visits with overlapping segments
      setDirectionsResponse(null)

      const chunks: typeof visitJourney[] = []
      let startIndex = 0
      const pointsPerSegment = maxWaypoints + 2

      while (startIndex < visitJourney.length) {
        const remainingVisits = visitJourney.length - startIndex

        if (remainingVisits <= pointsPerSegment) {
          chunks.push(visitJourney.slice(startIndex))
          break
        } else {
          chunks.push(visitJourney.slice(startIndex, startIndex + pointsPerSegment))
          startIndex += pointsPerSegment - 1
        }
      }

      const routePromises = chunks.map((chunk) => {
        return new Promise<google.maps.DirectionsResult | null>((resolve) => {
          const origin = chunk[0]
          const destination = chunk[chunk.length - 1]
          const waypoints = chunk.slice(1, -1).map(v => ({
            location: { lat: v.latitude!, lng: v.longitude! },
            stopover: true
          }))

          directionsService.route(
            {
              origin: { lat: origin.latitude!, lng: origin.longitude! },
              destination: { lat: destination.latitude!, lng: destination.longitude! },
              waypoints,
              travelMode: google.maps.TravelMode.DRIVING,
              optimizeWaypoints: false
            },
            (result, status) => {
              if (status === 'OK' && result) {
                resolve(result)
              } else {
                resolve(null)
              }
            }
          )
        })
      })

      Promise.all(routePromises).then((results) => {
        const validResults = results.filter(r => r !== null) as google.maps.DirectionsResult[]
        setMultipleDirections(validResults)
        setDirectionsStatus('success-multiple')
      })
    }
  }, [visitJourney, mapLoaded, viewMode])

  const formatTime = (time: string) => {
    if (!time) return '-'
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getMarkerIcon = (visit: typeof visitJourney[0]) => {
    const sequence = visit.sequence
    const isProductive = visit.visitOutcome?.toLowerCase().includes('success')

    const backgroundColor = isProductive ? '#10b981' : '#f59e0b'
    const borderColor = isProductive ? '#047857' : '#b45309'

    const svg = encodeURIComponent(`
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="16" fill="${backgroundColor}" stroke="${borderColor}" stroke-width="3"/>
        <text x="20" y="24" text-anchor="middle" fill="white" font-size="14" font-weight="bold">${sequence}</text>
      </svg>
    `)
    return `data:image/svg+xml;charset=utf-8,${svg}`
  }

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ['Store User Visit Report'],
      ['Period', `${startDate} to ${endDate}`],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary Metrics'],
      ['Total Visits', metrics.totalVisits],
      ['Unique Users', metrics.uniqueUsers],
      ['Unique Stores', metrics.uniqueStores],
      ['Average Duration (minutes)', metrics.avgDuration],
      [],
      ['Filters Applied'],
      ['Team Leader', selectedTeamLeader || 'All'],
      ['User', selectedUser || 'All'],
      ['Store', selectedStore || 'All'],
      ['City', selectedCity || 'All'],
      ['Purpose', selectedPurpose || 'All'],
      ['Outcome', selectedOutcome || 'All']
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    // All Visits sheet
    const visitsData = visits.map(v => ({
      'Date': v.visitDate,
      'User': v.userName,
      'User Code': v.userCode,
      'User Type': v.userType,
      'Store': v.storeName,
      'Store Code': v.storeCode,
      'Store Class': v.storeClass,
      'City': v.cityCode,
      'Region': v.regionCode,
      'Team Leader': v.teamLeaderCode,
      'Arrival': v.arrivalTime,
      'Departure': v.departureTime,
      'Duration (mins)': v.durationMinutes,
      'Purpose': v.visitPurpose || '',
      'Outcome': v.visitOutcome || '',
      'Remarks': v.remarks || ''
    }))
    const visitsSheet = XLSX.utils.json_to_sheet(visitsData)
    XLSX.utils.book_append_sheet(wb, visitsSheet, 'All Visits')

    // Export
    XLSX.writeFile(wb, `store-visits-report-${startDate}-${endDate}.xlsx`)
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

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Leader
            </label>
            <select
              value={selectedTeamLeader}
              onChange={(e) => {
                setSelectedTeamLeader(e.target.value)
                setSelectedUser('')
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Team Leaders (Available: {filterOptions.teamLeaders.length})</option>
              {filterOptions.teamLeaders.map(tl => (
                <option key={tl.value} value={tl.value}>{tl.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Users (Available: {filterOptions.users.length})</option>
              {filterOptions.users.map(user => (
                <option key={user.value} value={user.value}>{user.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Store
            </label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Stores (Available: {filterOptions.stores.length})</option>
              {filterOptions.stores.map(store => (
                <option key={store.value} value={store.value}>{store.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Cities (Available: {filterOptions.cities.length})</option>
              {filterOptions.cities.map(city => (
                <option key={city.value} value={city.value}>{city.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Visit Purpose
            </label>
            <select
              value={selectedPurpose}
              onChange={(e) => setSelectedPurpose(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Purposes (Available: {filterOptions.purposes.length})</option>
              {filterOptions.purposes.map(purpose => (
                <option key={purpose.value} value={purpose.value}>{purpose.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Visit Outcome
            </label>
            <select
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Outcomes (Available: {filterOptions.outcomes.length})</option>
              {filterOptions.outcomes.map(outcome => (
                <option key={outcome.value} value={outcome.value}>{outcome.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="text-blue-600" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Total Visits</p>
                  <p className="text-2xl font-bold text-gray-800">{metrics.totalVisits}</p>
                </div>
              </div>
              <InfoTooltip content="Total number of store visits recorded in the selected period" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="text-green-600" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Unique Users</p>
                  <p className="text-2xl font-bold text-gray-800">{metrics.uniqueUsers}</p>
                </div>
              </div>
              <InfoTooltip content="Number of distinct field users who made store visits" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="text-purple-600" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Unique Stores</p>
                  <p className="text-2xl font-bold text-gray-800">{metrics.uniqueStores}</p>
                </div>
              </div>
              <InfoTooltip content="Number of distinct stores that were visited" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="text-orange-600" size={24} />
                <div>
                  <p className="text-sm text-gray-600">Avg Duration</p>
                  <p className="text-2xl font-bold text-gray-800">{formatDuration(metrics.avgDuration)}</p>
                </div>
              </div>
              <InfoTooltip content="Average time spent per store visit" />
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
      ) : viewMode === 'summary' ? (
        <div className="space-y-6">
          {/* Google Maps with Route Visualization */}
          {visitJourney.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <MapPin size={24} className="text-blue-600" />
                  Store Visit Route Map
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Showing {visitJourney.length} visits with GPS coordinates
                </p>
              </div>

              <div style={{ height: '500px', position: 'relative' }}>
                {googleMapsError ? (
                  <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-red-600 p-10">
                    <div className="text-5xl mb-4">🚫</div>
                    <h3 className="text-lg font-semibold mb-3">Google Maps Loading Failed</h3>
                    <p className="text-sm text-gray-600 text-center mb-5">{googleMapsError}</p>
                  </div>
                ) : !googleMapsLoaded ? (
                  <div className="h-full flex flex-col items-center justify-center bg-gray-50">
                    <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-5"></div>
                    <p className="text-gray-600 font-medium">Loading Google Maps...</p>
                  </div>
                ) : (
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={mapCenter}
                    zoom={12}
                    options={{
                      zoomControl: true,
                      streetViewControl: false,
                      mapTypeControl: true,
                      fullscreenControl: true
                    }}
                    onLoad={(map) => setMapLoaded(true)}
                  >
                    {/* Visit Markers */}
                    {visitJourney.map((visit, index) => (
                      <Marker
                        key={`visit-marker-${visit.sequence}-${index}`}
                        position={{ lat: visit.latitude!, lng: visit.longitude! }}
                        icon={window.google?.maps?.Size ? {
                          url: getMarkerIcon(visit),
                          scaledSize: new window.google.maps.Size(40, 40),
                          anchor: new window.google.maps.Point(20, 20)
                        } : {
                          url: getMarkerIcon(visit)
                        }}
                        title={`Stop #${visit.sequence}: ${visit.storeName}`}
                        onClick={() => setSelectedMarker(visit)}
                      />
                    ))}

                    {/* Single route */}
                    {directionsResponse && (
                      <DirectionsRenderer
                        directions={directionsResponse}
                        options={{
                          suppressMarkers: true,
                          polylineOptions: {
                            strokeColor: '#1e40af',
                            strokeWeight: 6,
                            strokeOpacity: 0.9
                          }
                        }}
                      />
                    )}

                    {/* Multiple routes for 25+ visits */}
                    {multipleDirections.map((directions, index) => (
                      <DirectionsRenderer
                        key={`route-${index}`}
                        directions={directions}
                        options={{
                          suppressMarkers: true,
                          polylineOptions: {
                            strokeColor: '#1e40af',
                            strokeWeight: 6,
                            strokeOpacity: 0.9
                          }
                        }}
                      />
                    ))}

                    {/* Info Window */}
                    {selectedMarker && (
                      <InfoWindow
                        position={{ lat: selectedMarker.latitude!, lng: selectedMarker.longitude! }}
                        onCloseClick={() => setSelectedMarker(null)}
                      >
                        <div className="p-3 max-w-xs">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="bg-blue-600 text-white rounded-full px-3 py-1 text-sm font-bold">
                              #{selectedMarker.sequence}
                            </span>
                            <h3 className="text-lg font-semibold">{selectedMarker.storeName}</h3>
                          </div>
                          <div className="space-y-2 text-sm">
                            <p><strong>User:</strong> {selectedMarker.userName}</p>
                            <p><strong>Date:</strong> {new Date(selectedMarker.visitDate).toLocaleDateString()}</p>
                            <p><strong>Time:</strong> {formatTime(selectedMarker.arrivalTime)} - {formatTime(selectedMarker.departureTime)}</p>
                            <p><strong>Duration:</strong> {formatDuration(selectedMarker.durationMinutes)}</p>
                            <p><strong>Purpose:</strong> {selectedMarker.visitPurpose || '-'}</p>
                            <p><strong>Outcome:</strong> {selectedMarker.visitOutcome || '-'}</p>
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </GoogleMap>
                )}
              </div>
            </div>
          )}

          {/* Charts Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 size={24} className="text-blue-600" />
              Visit Analytics
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 10 Users by Visits */}
              <div>
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
              <div>
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

              {/* Visit Outcome Distribution */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Visit Outcome Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metrics.outcomeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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

              {/* Average Duration by User */}
              <div>
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
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

            {/* Store Class Analysis */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Building2 size={20} className="text-blue-600" />
                Store Class Analysis
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Store Class</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Visits</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Avg Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {metrics.storeClassData.map((storeClass) => (
                      <tr key={storeClass.storeClass} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{storeClass.storeClass}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{storeClass.visits}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatDuration(storeClass.avgDuration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Detailed View - Table with export button in card header
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Detailed Visit Data</h2>
              <p className="text-sm text-gray-600 mt-1">Showing {visits.length} store visits</p>
            </div>
            <button
              onClick={exportToExcel}
              disabled={visits.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              Export Excel
            </button>
          </div>
          <div className={isFullscreen ? "overflow-x-auto max-h-[calc(100vh-350px)] relative" : "overflow-x-auto max-h-[600px] relative"}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Arrival</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departure</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outcome</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visits.map((visit, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {new Date(visit.visitDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{visit.userName}</div>
                        <div className="text-gray-500 text-xs">{visit.userType}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{visit.storeName}</div>
                        <div className="text-gray-500 text-xs">{visit.storeCode}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{visit.cityCode || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatTime(visit.arrivalTime)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatTime(visit.departureTime)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDuration(visit.durationMinutes)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{visit.visitPurpose || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        visit.visitOutcome?.toLowerCase().includes('success')
                          ? 'bg-green-100 text-green-800'
                          : visit.visitOutcome?.toLowerCase().includes('pending')
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {visit.visitOutcome || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
