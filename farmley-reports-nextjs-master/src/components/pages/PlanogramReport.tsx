'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Layout, RefreshCw, TrendingUp, Target, ClipboardCheck, Store, Download, Calendar, Filter, Maximize, Minimize, BarChart3, PieChart as PieChartIcon, Users, Building2, Eye, X, CheckCircle, XCircle, SkipForward, ChevronDown, ChevronRight } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ImageViewer } from '@/components/ui/ImageViewer'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { CustomDatePicker } from '@/components/ui/CustomDatePicker'
import * as XLSX from 'xlsx'
import { getAssetBaseUrl } from '@/lib/utils'

interface PlanogramExecution {
  executionDate: string
  executionId: string
  storeCode: string
  storeName: string
  chainCode: string
  chainName: string
  regionCode: string
  regionName: string
  userCode: string
  userName: string
  teamLeaderCode: string
  teamLeaderName: string
  activitiesCompleted: number
  totalActivities: number
  completionPercentage: number
  complianceStatus: string
  complianceScore: number
  locationAsPerPlanogram: string
  executionStatus: string
  remarks: string
  imagePath: string
  approvalStatus?: string | null
  approvedBy?: string | null
  approvedOn?: string | null
}

interface FilterOption {
  value: string
  label: string
}

interface FilterOptions {
  teamLeaders: FilterOption[]
  users: FilterOption[]
  stores: FilterOption[]
  chains: FilterOption[]
}

// Helper function to convert any image path to full URL
const getImageUrl = (imagePath: string): string => {
  if (!imagePath) return ''
  
  const baseUrl = getAssetBaseUrl()
  
  // Remove leading ../ if present
  let cleanPath = imagePath.replace(/^\.\.\//, '')
  
  // Remove leading / if present
  cleanPath = cleanPath.replace(/^\//, '')
  
  // For Android local paths, extract just the filename
  // Example: /storage/emulated/0/Android/data/com.winit.farmley/files/Pictures/JPEG_1760081525705_892995600042698
  if (cleanPath.includes('storage/emulated') || cleanPath.includes('Android/data')) {
    // Extract just the filename from Android path
    const parts = cleanPath.split('/')
    cleanPath = parts[parts.length - 1]
  }
  
  // Prepend base URL
  return baseUrl + cleanPath
}

interface PlanogramReportProps {
  loginUserCode?: string
}

export function PlanogramReport({ loginUserCode = 'admin' }: PlanogramReportProps) {
  const [executions, setExecutions] = useState<PlanogramExecution[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    teamLeaders: [],
    users: [],
    stores: [],
    chains: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters - Default to current month (1st to today)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedTeamLeader, setSelectedTeamLeader] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedChain, setSelectedChain] = useState('')
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary')
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Dialog state
  const [selectedExecution, setSelectedExecution] = useState<PlanogramExecution | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  
  // Expanded rows state (for grouping)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const fetchFilterOptions = async () => {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      params.append('loginUserCode', loginUserCode)

      const response = await fetch(`/api/planogram/filters?${params}`)
      const result = await response.json()
      if (result.success) setFilterOptions(result.data)
    } catch (err) {
      console.error('Failed to fetch filter options:', err)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      params.append('loginUserCode', loginUserCode)
      if (selectedTeamLeader) params.append('teamLeaderCode', selectedTeamLeader)
      if (selectedUser) params.append('userCode', selectedUser)
      if (selectedStore) params.append('storeCode', selectedStore)
      if (selectedChain) params.append('chainCode', selectedChain)

      const response = await fetch(`/api/planogram?${params}`)
      const result = await response.json()

      if (result.success) {
        setExecutions(result.data)
      } else {
        const errorMsg = result.details || result.message || result.error || 'Failed to fetch data'
        setError(errorMsg)
        console.error('API Error:', result)
      }
    } catch (err) {
      setError('Failed to fetch planogram executions')
      console.error('Fetch Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (executionId: string, status: 'approved' | 'rejected' | 'skipped') => {
    try {
      setIsApproving(true)
      const response = await fetch('/api/planogram/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          executionId,
          approvalStatus: status,
          approvedBy: loginUserCode
        })
      })

      const result = await response.json()
      
      if (result.success) {
        // Update the local state
        setExecutions(prev => prev.map(exec => 
          exec.executionId === executionId 
            ? { 
                ...exec, 
                approvalStatus: status,
                approvedBy: loginUserCode,
                approvedOn: new Date().toISOString()
              }
            : exec
        ))
        
        // Update selected execution if it's the one being approved
        if (selectedExecution?.executionId === executionId) {
          setSelectedExecution({
            ...selectedExecution,
            approvalStatus: status,
            approvedBy: loginUserCode,
            approvedOn: new Date().toISOString()
          })
        }
        
        alert(`Successfully ${status} the execution!`)
      } else {
        alert(`Failed to ${status} execution: ${result.error}`)
      }
    } catch (error) {
      console.error('Approval error:', error)
      alert(`Error ${status} execution. Please try again.`)
    } finally {
      setIsApproving(false)
    }
  }

  useEffect(() => {
    fetchFilterOptions()
  }, [startDate, endDate, selectedTeamLeader])

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, selectedTeamLeader, selectedUser, selectedStore, selectedChain])

  // Filter executions by approval status
  const filteredExecutions = useMemo(() => {
    if (!selectedApprovalStatus) return executions
    
    if (selectedApprovalStatus === 'pending') {
      return executions.filter(e => !e.approvalStatus || 
                                   e.approvalStatus === '' || 
                                   e.approvalStatus.toLowerCase() === 'pending')
    }
    
    // Case-insensitive comparison for approved/rejected/skipped
    return executions.filter(e => e.approvalStatus && 
                                  e.approvalStatus.toLowerCase() === selectedApprovalStatus.toLowerCase())
  }, [executions, selectedApprovalStatus])

  const totalExecutions = filteredExecutions.length
  const uniqueStores = new Set(filteredExecutions.map(e => e.storeCode)).size
  
  // Group executions by common fields (for detailed view)
  const groupedExecutions = useMemo(() => {
    const groups = new Map<string, PlanogramExecution[]>()
    
    filteredExecutions.forEach(exec => {
      // Create a unique key based on common fields (excluding executionId and imagePath)
      const groupKey = `${exec.teamLeaderCode}-${exec.userCode}-${exec.storeCode}-${new Date(exec.executionDate).toLocaleDateString('en-GB')}`
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(exec)
    })
    
    return Array.from(groups.entries()).map(([key, executions]) => ({
      key,
      executions,
      // Use the first execution's data as representative for the group
      representative: executions[0]
    }))
  }, [filteredExecutions])
  
  const toggleGroupExpansion = (groupKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey)
      } else {
        newSet.add(groupKey)
      }
      return newSet
    })
  }

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new()

    // Summary Sheet
    const uniqueUsers = new Set(filteredExecutions.map(e => e.userCode)).size
    const days = new Set(filteredExecutions.map(e => new Date(e.executionDate).toLocaleDateString())).size
    const dailyAverage = days > 0 ? Math.round(totalExecutions / days) : 0
    
    const summaryData = [
      ['Planogram Execution Report'],
      ['Period', `${startDate} to ${endDate}`],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary Metrics'],
      ['Total Executions', totalExecutions],
      ['Unique Stores', uniqueStores],
      ['Field Users', uniqueUsers],
      ['Daily Average', dailyAverage],
      [],
      ['Filters Applied'],
      ['Team Leader', selectedTeamLeader || 'All'],
      ['Field User', selectedUser || 'All'],
      ['Store', selectedStore || 'All'],
      ['Chain', selectedChain || 'All']
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    // Detailed Data Sheet - Include all individual rows with images
    const detailedData = filteredExecutions.map((item, index) => ({
      '#': index + 1,
      'Date': new Date(item.executionDate).toLocaleDateString('en-GB'),
      'TL Code': item.teamLeaderCode || '',
      'TL Name': item.teamLeaderName || '',
      'User Code': item.userCode,
      'User Name': item.userName,
      'Store Code': item.storeCode,
      'Store Name': item.storeName,
      'Chain Name': item.chainName || '',
      'Execution ID': item.executionId || '',
      'Approval Status': item.approvalStatus || 'Pending',
      'Approved By': item.approvedBy || '',
      'Approved On': item.approvedOn ? new Date(item.approvedOn).toLocaleDateString('en-GB') : '',
      'Image URL': item.imagePath ? getImageUrl(item.imagePath) : ''
    }))
    const detailedSheet = XLSX.utils.json_to_sheet(detailedData)
    
    // Add hyperlinks to image URLs
    detailedData.forEach((row, idx) => {
      if (row['Image URL']) {
        const cellAddress = XLSX.utils.encode_cell({ r: idx + 1, c: 13 }) // Column N (0-indexed: 13)
        if (!detailedSheet[cellAddress]) return
        detailedSheet[cellAddress].l = { Target: row['Image URL'], Tooltip: 'Click to view image' }
      }
    })
    
    XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Data')

    XLSX.writeFile(wb, `planogram-execution-${startDate}-${endDate}.xlsx`)
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-white p-6 space-y-6 overflow-y-auto" : "p-4 md:p-6 space-y-4 md:space-y-6"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Layout className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Planogram Execution Report</h1>
            <p className="text-sm text-gray-600 mt-1">Track planogram execution compliance and monitoring</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-slate-700 bg-white rounded-lg hover:bg-gray-50"
          >
            <Filter size={18} />
            Filters
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={18} />
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
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">Filter Controls</h2>
            </div>
            <button
              onClick={() => {
                const date = new Date()
                date.setDate(date.getDate() - 30)
                setStartDate(date.toISOString().split('T')[0])
                setEndDate(new Date().toISOString().split('T')[0])
                setSelectedTeamLeader('')
                setSelectedUser('')
                setSelectedStore('')
                setSelectedChain('')
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
              type="button"
            >
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Start Date */}
            <div>
              <CustomDatePicker
                value={startDate}
                onChange={setStartDate}
                label="Start Date"
                placeholder="Select start date"
              />
            </div>

            {/* End Date */}
            <div>
              <CustomDatePicker
                value={endDate}
                onChange={setEndDate}
                label="End Date"
                placeholder="Select end date"
              />
            </div>

            {/* Chain */}
            <SearchableSelect
              value={selectedChain || null}
              onChange={(value) => setSelectedChain(value || '')}
              options={filterOptions.chains}
              placeholder={`All Chains (Available: ${filterOptions.chains.length})`}
              icon={<Building2 className="w-4 h-4 text-gray-500" />}
              label="Chain / Channel"
              formatOptionLabel={(option) => option.label}
            />

            {/* Store */}
            <SearchableSelect
              value={selectedStore || null}
              onChange={(value) => setSelectedStore(value || '')}
              options={filterOptions.stores}
              placeholder={`All Stores (Available: ${filterOptions.stores.length})`}
              icon={<Store className="w-4 h-4 text-gray-500" />}
              label="Store"
              formatOptionLabel={(option) => option.label}
            />

            {/* Team Leader */}
            <SearchableSelect
              value={selectedTeamLeader || null}
              onChange={(value) => {
                setSelectedTeamLeader(value || '')
                setSelectedUser('')
              }}
              options={filterOptions.teamLeaders}
              placeholder={`All Team Leaders (Available: ${filterOptions.teamLeaders.length})`}
              icon={<Users className="w-4 h-4 text-gray-500" />}
              label="Team Leader"
              formatOptionLabel={(option) => option.label}
            />

            {/* Field User */}
            <SearchableSelect
              value={selectedUser || null}
              onChange={(value) => setSelectedUser(value || '')}
              options={filterOptions.users}
              placeholder={`All Field Users (Available: ${filterOptions.users.length})`}
              icon={<Users className="w-4 h-4 text-gray-500" />}
              label="Field User"
              formatOptionLabel={(option) => option.label}
            />

            {/* Approval Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                <CheckCircle className="w-4 h-4 inline mr-1" />
                Approval Status
              </label>
              <select
                value={selectedApprovalStatus}
                onChange={(e) => setSelectedApprovalStatus(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                <option value="">All Status</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="skipped">Skipped</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && !error && filteredExecutions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Total Executions</p>
                <InfoTooltip content="Total number of planogram execution activities" />
              </div>
              <Layout className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalExecutions}</p>
            <p className="text-xs text-gray-500 mt-1">In selected period</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Unique Stores</p>
                <InfoTooltip content="Number of unique stores with planogram executions" />
              </div>
              <Store className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900">{uniqueStores}</p>
            <p className="text-xs text-gray-500 mt-1">Stores visited</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Field Users</p>
                <InfoTooltip content="Number of unique field users performing executions" />
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-900">{new Set(filteredExecutions.map(e => e.userCode)).size}</p>
            <p className="text-xs text-gray-500 mt-1">Active users</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Daily Average</p>
                <InfoTooltip content="Average number of executions per day" />
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-orange-900">
              {(() => {
                const days = new Set(filteredExecutions.map(e => new Date(e.executionDate).toLocaleDateString())).size
                return days > 0 ? Math.round(totalExecutions / days) : 0
              })()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Executions per day</p>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      {!loading && !error && filteredExecutions.length > 0 && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'summary'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Summary View
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'detailed'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Detailed View
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingBar message="Loading planogram execution data..." />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      ) : filteredExecutions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Layout className="mx-auto text-gray-400" size={48} />
          <p className="mt-4 text-gray-600">No planogram executions found for the selected period</p>
        </div>
      ) : viewMode === 'summary' ? (
        /* SUMMARY VIEW - Charts and Analytics */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Execution Trend */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Daily Execution Trend</h3>
              <InfoTooltip content="Number of planogram executions per day" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(() => {
                const daily = filteredExecutions.reduce((acc: any, e) => {
                  const date = new Date(e.executionDate).toLocaleDateString('en-GB')
                  if (!acc[date]) acc[date] = { date, count: 0 }
                  acc[date].count++
                  return acc
                }, {})
                return Object.values(daily).sort((a: any, b: any) => {
                  const dateA = a.date.split('/').reverse().join('-')
                  const dateB = b.date.split('/').reverse().join('-')
                  return dateA.localeCompare(dateB)
                }).slice(-14) // Last 14 days
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} fontSize={11} />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#8b5cf6" name="Executions" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Stores by Executions */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top Stores by Executions</h3>
              <InfoTooltip content="Stores with the most planogram execution activities" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(() => {
                const stores = filteredExecutions.reduce((acc: any, e) => {
                  const key = `${e.storeCode} - ${e.storeName.substring(0, 20)}`
                  acc[key] = (acc[key] || 0) + 1
                  return acc
                }, {})
                return Object.entries(stores)
                  .map(([store, count]) => ({ store, count }))
                  .sort((a: any, b: any) => b.count - a.count)
                  .slice(0, 10)
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="store" angle={-45} textAnchor="end" height={100} fontSize={10} />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#10b981" name="Executions" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Distribution by Team Leader */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Executions by Team Leader</h3>
              <InfoTooltip content="Distribution of executions across team leaders" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie 
                  data={(() => {
                    const tls = filteredExecutions.reduce((acc: any, e) => {
                      const tlName = e.teamLeaderName || e.teamLeaderCode || 'Unassigned'
                      acc[tlName] = (acc[tlName] || 0) + 1
                      return acc
                    }, {})
                    return Object.entries(tls)
                      .map(([name, value]) => ({ name: name.substring(0, 20), value }))
                      .sort((a: any, b: any) => b.value - a.value)
                      .slice(0, 8)
                  })()} 
                  cx="50%" 
                  cy="50%" 
                  labelLine={false} 
                  label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100} 
                  dataKey="value"
                >
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'].map((color, i) => (
                    <Cell key={`cell-${i}`} fill={color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Distribution by Chain */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Executions by Chain</h3>
              <InfoTooltip content="Distribution of executions across retail chains" />
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(() => {
                const chains = filteredExecutions.reduce((acc: any, e) => {
                  const chain = e.chainName || 'Independent'
                  acc[chain] = (acc[chain] || 0) + 1
                  return acc
                }, {})
                return Object.entries(chains)
                  .map(([chain, count]) => ({ chain: chain.substring(0, 15), count }))
                  .sort((a: any, b: any) => b.count - a.count)
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="chain" angle={-45} textAnchor="end" height={80} fontSize={11} />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#f97316" name="Executions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* DETAILED VIEW - Data Table */
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Detailed Planogram Execution Data</h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing {filteredExecutions.length} execution{filteredExecutions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={exportToExcel}
              disabled={filteredExecutions.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              Export Excel
            </button>
          </div>

          <div className={isFullscreen ? "overflow-x-auto max-h-[calc(100vh-300px)]" : "overflow-x-auto max-h-[600px]"}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[50px]"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[90px]">TL Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">TL Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">User Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">User Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">Store Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[200px]">Store Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">Chain Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]">Execution Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupedExecutions.map((group) => {
                  const isExpanded = expandedGroups.has(group.key)
                  const { representative } = group
                  
                  return (
                    <React.Fragment key={group.key}>
                      {/* Main Group Row */}
                      <tr 
                        className="hover:bg-blue-50 transition-colors cursor-pointer"
                        onClick={() => toggleGroupExpansion(group.key)}
                      >
                        <td className="px-4 py-3 text-center">
                          <button className="p-1 hover:bg-gray-200 rounded">
                            {isExpanded ? (
                              <ChevronDown size={16} className="text-gray-600" />
                            ) : (
                              <ChevronRight size={16} className="text-gray-600" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{representative.teamLeaderCode || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{representative.teamLeaderName || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{representative.userCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{representative.userName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{representative.storeCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{representative.storeName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{representative.chainName || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {new Date(representative.executionDate).toLocaleDateString('en-GB')}
                          {group.executions.length > 1 && (
                            <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
                              {group.executions.length} activities
                            </span>
                          )}
                        </td>
                      </tr>
                      
                      {/* Expanded Sub-Rows */}
                      {isExpanded && (
                        <>
                          {/* Sub-header for expanded section */}
                          <tr className="bg-gray-100">
                            <th className="px-4 py-2"></th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase" colSpan={3}>Activity</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Approval Status</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Approved By</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Approved On</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                          </tr>
                          
                          {group.executions.map((item, idx) => (
                            <tr 
                              key={item.executionId || item.imagePath || `${group.key}-${idx}`} 
                              className="bg-gray-50 hover:bg-purple-50 transition-colors border-l-4 border-purple-400"
                            >
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3 text-sm text-gray-700" colSpan={3}>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">#{idx + 1}</span>
                                  <span>Planogram Activity</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {item.approvalStatus && 
                                 item.approvalStatus !== '' && 
                                 item.approvalStatus.toLowerCase() !== 'pending' ? (
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    item.approvalStatus.toLowerCase() === 'approved' ? 'bg-green-100 text-green-800' :
                                    item.approvalStatus.toLowerCase() === 'rejected' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {item.approvalStatus.charAt(0).toUpperCase() + item.approvalStatus.slice(1).toLowerCase()}
                                  </span>
                                ) : (
                                  <div className="flex gap-1.5 flex-wrap">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleApproval(item.executionId, 'approved')
                                      }}
                                      disabled={isApproving}
                                      className="px-2 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Approve"
                                    >
                                      <CheckCircle size={12} />
                                      Approve
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleApproval(item.executionId, 'rejected')
                                      }}
                                      disabled={isApproving}
                                      className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Reject"
                                    >
                                      <XCircle size={12} />
                                      Reject
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleApproval(item.executionId, 'skipped')
                                      }}
                                      disabled={isApproving}
                                      className="px-2 py-1 bg-gray-600 text-white text-xs font-medium rounded hover:bg-gray-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Skip"
                                    >
                                      <SkipForward size={12} />
                                      Skip
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{item.approvedBy || '—'}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                {item.approvedOn ? new Date(item.approvedOn).toLocaleDateString('en-GB') : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {item.imagePath ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedExecution(item)
                                      setIsDialogOpen(true)
                                    }}
                                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1 mx-auto"
                                  >
                                    <Eye size={14} />
                                    View
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Image Details Dialog */}
      {isDialogOpen && selectedExecution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Dialog Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-800">Details</h2>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* User and Store Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-semibold text-gray-600">User Code:</span>
                    <span className="ml-2 text-gray-900">{selectedExecution.userCode}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-gray-600">User Name:</span>
                    <span className="ml-2 text-gray-900">{selectedExecution.userName}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-gray-600">Store Code:</span>
                    <span className="ml-2 text-gray-900">{selectedExecution.storeCode}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-semibold text-gray-600">Store Name:</span>
                    <span className="ml-2 text-gray-900">{selectedExecution.storeName}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-gray-600">Chain Name:</span>
                    <span className="ml-2 text-gray-900">{selectedExecution.chainName || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Recommended Image Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Recommended Image</h3>
                <div className="border border-gray-200 rounded-lg p-4">
                  <img
                    src={getImageUrl(selectedExecution.imagePath)}
                    alt="Planogram Image"
                    className="w-full h-auto max-h-96 object-contain rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden text-center text-gray-500 py-8">
                    <Eye size={48} className="mx-auto mb-2" />
                    <p>Image not available</p>
                  </div>
                </div>
              </div>

              {/* Activities Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Activities</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Activity Type</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Image</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-200">
                        <td className="px-4 py-3 text-sm text-gray-900">Endcap</td>
                        <td className="px-4 py-3 text-center">
                          {selectedExecution.imagePath ? (
                            <button
                              onClick={() => {
                                const imageUrl = getImageUrl(selectedExecution.imagePath)
                                window.open(imageUrl, '_blank', 'noopener,noreferrer')
                              }}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                            >
                              View Image
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">No Image</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {selectedExecution.approvalStatus && 
                           selectedExecution.approvalStatus !== '' && 
                           selectedExecution.approvalStatus.toLowerCase() !== 'pending' ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              selectedExecution.approvalStatus.toLowerCase() === 'approved' ? 'bg-green-100 text-green-800' :
                              selectedExecution.approvalStatus.toLowerCase() === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedExecution.approvalStatus.charAt(0).toUpperCase() + selectedExecution.approvalStatus.slice(1).toLowerCase()}
                            </span>
                          ) : (
                            <div className="flex gap-2 justify-center flex-wrap">
                              <button 
                                onClick={() => handleApproval(selectedExecution.executionId, 'approved')}
                                disabled={isApproving}
                                className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                title="Approve this execution"
                              >
                                <CheckCircle size={15} />
                                Approve
                              </button>
                              <button 
                                onClick={() => handleApproval(selectedExecution.executionId, 'rejected')}
                                disabled={isApproving}
                                className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                title="Reject this execution"
                              >
                                <XCircle size={15} />
                                Reject
                              </button>
                              <button 
                                onClick={() => handleApproval(selectedExecution.executionId, 'skipped')}
                                disabled={isApproving}
                                className="px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-md hover:bg-gray-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                title="Skip this execution"
                              >
                                <SkipForward size={15} />
                                Skip
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
