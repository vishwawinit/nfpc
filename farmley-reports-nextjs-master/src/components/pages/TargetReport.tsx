'use client'

import { useState, useEffect, useMemo } from 'react'
import { Target, RefreshCw, Users, DollarSign, Download, Filter, TrendingUp, TrendingDown, Calendar, BarChart3, PieChart as PieChartIcon, Maximize, Minimize, ChevronLeft, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, LineChart, Line } from 'recharts'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import * as XLSX from 'xlsx'

interface TargetData {
  targetYear: number
  targetMonth: number
  targetPeriod: string
  userCode: string
  userName: string
  teamLeaderCode: string
  teamLeaderName: string
  userRole: string
  customerCode: string
  customerName: string
  customerLevel: string
  chainCode: string
  targetAmount: number
  targetQuantity: number
  targetVolume: number
  achievementAmount: number
  achievementPercentage: number
  currencyCode: string
  uom: string
  salesOrgCode: string
  salesOrgName: string
  productCategory: string
  productBrand: string
  targetType: string
  targetLevel: string
  targetFrequency: string
  targetStatus: string
  isActive: boolean
  isApproved: boolean
  remarks: string
  createdBy: string
  createdOn: string
  modifiedBy: string
  modifiedOn: string
}

interface FilterOption {
  value: string | number
  label: string
}

interface FilterOptions {
  users: FilterOption[]
  customers: FilterOption[]
  years: FilterOption[]
  months: FilterOption[]
  teamLeaders: FilterOption[]
  chains: FilterOption[]
  brands: FilterOption[]
  categories: FilterOption[]
  targetTypes: FilterOption[]
  targetStatus: FilterOption[]
  targetLevels: FilterOption[]
  salesOrgs: FilterOption[]
  userRoles: FilterOption[]
}

interface Summary {
  totalTargets: number
  totalTargetAmount: number
  totalAchievement: number
  overallAchievementPercentage: number
  targetsAchieved: number
  targetsNotAchieved: number
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316']

interface TargetReportProps {
  loginUserCode?: string
}

export function TargetReport({ loginUserCode = 'admin' }: TargetReportProps) {
  const [targets, setTargets] = useState<TargetData[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    users: [],
    customers: [],
    years: [],
    months: [],
    teamLeaders: [],
    chains: [],
    brands: [],
    categories: [],
    targetTypes: [],
    targetStatus: [],
    targetLevels: [],
    salesOrgs: [],
    userRoles: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString())
  const [selectedMonth, setSelectedMonth] = useState(() => (new Date().getMonth() + 1).toString())
  const [selectedTeamLeader, setSelectedTeamLeader] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  // View states
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary')
  
  // Pagination (for detailed view only)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50)

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const fetchFilterOptions = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedYear) params.append('year', selectedYear)
      if (selectedMonth) params.append('month', selectedMonth)
      if (selectedTeamLeader) params.append('teamLeaderCode', selectedTeamLeader)
      if (selectedUser) params.append('userCode', selectedUser)
      
      // Add loginUserCode for hierarchy filtering
      if (loginUserCode) params.append('loginUserCode', loginUserCode)

      const response = await fetch(`/api/targets/filters?${params}`)
      const result = await response.json()

      if (result.success) {
        setFilterOptions(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (selectedYear) params.append('year', selectedYear)
      if (selectedMonth) params.append('month', selectedMonth)
      if (selectedTeamLeader) params.append('teamLeaderCode', selectedTeamLeader)
      if (selectedUser) params.append('userCode', selectedUser)
      if (selectedCustomer) params.append('customerCode', selectedCustomer)
      
      // Add loginUserCode for hierarchy filtering
      if (loginUserCode) params.append('loginUserCode', loginUserCode)

      const response = await fetch(`/api/targets?${params}`)
      const result = await response.json()

      if (result.success) {
        setTargets(result.data)
        setSummary(result.summary)
        setCurrentPage(1) // Reset to first page on data change
      } else {
        setError(result.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError('Failed to fetch targets')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFilterOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, selectedTeamLeader])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, selectedTeamLeader, selectedUser, selectedCustomer])

  // Pagination logic (for detailed view only)
  const paginatedTargets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return targets.slice(startIndex, endIndex)
  }, [targets, currentPage, itemsPerPage])

  const totalPages = Math.ceil(targets.length / itemsPerPage)

  const handleExport = () => {
    const wb = XLSX.utils.book_new()

    // Summary Sheet
    const summaryData = [
      ['Target vs Achievement Report'],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary Metrics'],
      ['Total Targets', summary?.totalTargets || 0],
      ['Total Target Amount', summary?.totalTargetAmount || 0],
      ['Total Achievement', summary?.totalAchievement || 0],
      ['Overall Achievement %', `${summary?.overallAchievementPercentage || 0}%`],
      ['Targets Achieved (>=100%)', summary?.targetsAchieved || 0],
      ['Targets Not Achieved (<100%)', summary?.targetsNotAchieved || 0],
      [],
      ['Filters Applied'],
      ['Year', selectedYear || 'All'],
      ['Month', selectedMonth || 'All'],
      ['Team Leader', selectedTeamLeader || 'All'],
      ['Field User', selectedUser || 'All'],
      ['Customer', selectedCustomer || 'All']
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

    // Detailed Data Sheet - Match exactly what's shown in the detailed view UI
    const detailedData = targets.map(item => {
      // Calculate status exactly as shown in UI
      const status = item.achievementPercentage >= 100 ? 'Achieved' :
                     item.achievementPercentage >= 75 ? 'On Track' :
                     item.achievementPercentage >= 50 ? 'At Risk' :
                     'Below Target'
      
      return {
        'Year': item.targetYear,
        'Month': monthNames[item.targetMonth - 1],
        'TL Code': item.teamLeaderCode || '',
        'TL Name': item.teamLeaderName || '',
        'Field User Code': item.userCode,
        'Field User Name': item.userName,
        'Customer Code': item.customerCode,
        'Customer Name': item.customerName,
        'Target Amount': item.targetAmount,
        'Achievement Amount': item.achievementAmount,
        'Achievement %': item.achievementPercentage.toFixed(1) + '%',
        'Status': status
      }
    })
    const detailedSheet = XLSX.utils.json_to_sheet(detailedData)
    XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Data')

    XLSX.writeFile(wb, `target-achievement-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-white p-6 space-y-6 overflow-y-auto" : "p-4 md:p-6 space-y-4 md:space-y-6"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 rounded-lg">
            <Target className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Target vs Achievement Report</h1>
            <p className="text-sm text-gray-600">Track sales targets and actual achievement performance</p>
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
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {viewMode === 'detailed' && (
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
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
                setSelectedYear(new Date().getFullYear().toString())
                setSelectedMonth((new Date().getMonth() + 1).toString())
                setSelectedTeamLeader('')
                setSelectedUser('')
                setSelectedCustomer('')
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-800"
              type="button"
            >
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Year */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                <Calendar className="w-4 h-4 inline mr-1" />
                Year
              </label>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)} 
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              >
                <option value="">All Years (Available: {filterOptions.years.length})</option>
                {filterOptions.years.map(year => (
                  <option key={year.value} value={year.value}>{year.label}</option>
                ))}
              </select>
            </div>

            {/* Month */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                <Calendar className="w-4 h-4 inline mr-1" />
                Month
              </label>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)} 
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              >
                <option value="">All Months (Available: {filterOptions.months.length})</option>
                {filterOptions.months.map(month => (
                  <option key={month.value} value={month.value}>{monthNames[Number(month.value) - 1] || month.label}</option>
                ))}
              </select>
            </div>

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
              placeholder={`All Users (Available: ${filterOptions.users.length})`}
              icon={<Users className="w-4 h-4 text-gray-500" />}
              label="Field User"
              formatOptionLabel={(option) => option.label}
            />

            {/* Customer */}
            <SearchableSelect
              value={selectedCustomer || null}
              onChange={(value) => setSelectedCustomer(value || '')}
              options={filterOptions.customers}
              placeholder={`All Customers (Available: ${filterOptions.customers.length})`}
              icon={<Users className="w-4 h-4 text-gray-500" />}
              label="Customer"
              formatOptionLabel={(option) => option.label}
            />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && !error && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Total Target Amount</p>
                <InfoTooltip content="Sum of all target amounts set for the selected period. Represents total sales goals." />
              </div>
              <DollarSign className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">AED{(summary.totalTargetAmount / 1000000).toFixed(2)}M</p>
            <p className="text-xs text-gray-500 mt-1">{summary.totalTargets} targets</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Total Achievement</p>
                <InfoTooltip content="Actual sales amount achieved against the targets from flat_sales_transactions (trx_type=5)" />
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-900">AED{(summary.totalAchievement / 1000000).toFixed(2)}M</p>
            <p className="text-xs text-gray-500 mt-1">{summary.overallAchievementPercentage.toFixed(2)}% achieved</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Overall Achievement %</p>
                <InfoTooltip content="Overall achievement percentage: (Total Achievement ÷ Total Target) × 100" />
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-600">{summary.overallAchievementPercentage.toFixed(2)}%</p>
            <p className="text-xs text-gray-500 mt-1">
              {summary.targetsAchieved} targets ≥100% • {summary.totalTargets - summary.targetsAchieved} targets &lt;100%
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">Achievement Gap</p>
                <InfoTooltip content="Remaining amount needed to reach 100% of total target" />
              </div>
              <TrendingDown className="w-8 h-8 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-orange-600">AED{((summary.totalTargetAmount - summary.totalAchievement) / 1000000).toFixed(2)}M</p>
            <p className="text-xs text-gray-500 mt-1">Shortfall to reach target</p>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      {!loading && !error && targets.length > 0 && (
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
        <LoadingBar message="Loading targets and achievement data..." />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      ) : targets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Target className="mx-auto text-gray-400" size={48} />
          <p className="mt-4 text-gray-600">No targets found for the selected period</p>
        </div>
      ) : viewMode === 'summary' ? (
        /* SUMMARY VIEW - Charts and Analytics */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Target Amount by User */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top 10 Users by Target Amount</h3>
              <InfoTooltip content="Top users by target amount. Shows sales goals assigned to each field user for performance tracking." />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={(() => {
                const userData = targets.reduce((acc: any, target) => {
                  const userKey = target.userCode || 'unknown'
                  const rawName = target.userName || 'Unknown User'
                  if (!acc[userKey]) {
                    acc[userKey] = {
                      user: rawName.length > 20 ? rawName.substring(0, 20) + '...' : rawName,
                      targetAmount: 0,
                      achievementAmount: 0
                    }
                  }
                  acc[userKey].targetAmount += target.targetAmount || 0
                  acc[userKey].achievementAmount += target.achievementAmount || 0
                  return acc
                }, {})
                return Object.values(userData)
                  .map((d: any) => ({
                    user: d.user,
                    'Target': Number((d.targetAmount / 1000).toFixed(0)),
                    'Achievement': Number((d.achievementAmount / 1000).toFixed(0))
                  }))
                  .sort((a: any, b: any) => b['Target'] - a['Target'])
                  .slice(0, 10)
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="user" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis label={{ value: 'Amount (AED K)', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip formatter={(value: number) => `AED${value}K`} />
                <Legend />
                <Bar dataKey="Target" fill="#10b981" />
                <Bar dataKey="Achievement" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Achievement Distribution */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <PieChartIcon className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Achievement Status Distribution</h3>
              <InfoTooltip content="Distribution of targets by achievement status (>=100% achieved vs <100% not achieved)" />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <RechartsPie>
                <Pie
                  data={[
                    { name: 'Achieved (>=100%)', value: summary?.targetsAchieved || 0 },
                    { name: 'Not Achieved (<100%)', value: summary?.targetsNotAchieved || 0 }
                  ].filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[{ name: 'Achieved', color: '#10b981' }, { name: 'Not Achieved', color: '#f59e0b' }].map((item, index) => (
                    <Cell key={`cell-${index}`} fill={item.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </RechartsPie>
            </ResponsiveContainer>
          </div>

          {/* Achievement Rate Distribution */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Performance Distribution</h3>
              <InfoTooltip content="Distribution of targets across performance categories. Shows how many targets fall into each achievement bracket for quick health assessment." />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={(() => {
                // Categorize targets into performance buckets
                const buckets = {
                  'Exceeded (≥100%)': 0,
                  'On Track (75-99%)': 0,
                  'At Risk (50-74%)': 0,
                  'Poor (25-49%)': 0,
                  'Critical (<25%)': 0
                }
                
                targets.forEach(target => {
                  const pct = target.achievementPercentage
                  if (pct >= 100) buckets['Exceeded (≥100%)']++
                  else if (pct >= 75) buckets['On Track (75-99%)']++
                  else if (pct >= 50) buckets['At Risk (50-74%)']++
                  else if (pct >= 25) buckets['Poor (25-49%)']++
                  else buckets['Critical (<25%)']++
                })
                
                return Object.entries(buckets).map(([category, count]) => ({
                  category,
                  'Targets by Achievement %': count
                }))
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" angle={-20} textAnchor="end" height={100} fontSize={11} />
                <YAxis label={{ value: 'Number of Targets', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="Targets by Achievement %" fill="#8b5cf6">
                  {[
                    { fill: '#10b981' }, // Green for Exceeded
                    { fill: '#3b82f6' }, // Blue for On Track
                    { fill: '#f59e0b' }, // Orange for At Risk
                    { fill: '#ef4444' }, // Red for Poor
                    { fill: '#7f1d1d' }  // Dark red for Critical
                  ].map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Achievement % Trend */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top 10 Users by Achievement %</h3>
              <InfoTooltip content="Users with highest achievement percentage against their targets" />
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={(() => {
                const userData = targets.reduce((acc: any, target) => {
                  const userKey = target.userCode || 'unknown'
                  const rawName = target.userName || 'Unknown User'
                  if (!acc[userKey]) {
                    acc[userKey] = {
                      user: rawName.length > 20 ? rawName.substring(0, 20) + '...' : rawName,
                      targetAmount: 0,
                      achievementAmount: 0
                    }
                  }
                  acc[userKey].targetAmount += target.targetAmount || 0
                  acc[userKey].achievementAmount += target.achievementAmount || 0
                  return acc
                }, {})
                return Object.values(userData)
                  .map((d: any) => ({
                    user: d.user,
                    'Achievement %': d.targetAmount > 0 ? Number(((d.achievementAmount / d.targetAmount) * 100).toFixed(2)) : 0
                  }))
                  .sort((a: any, b: any) => b['Achievement %'] - a['Achievement %'])
                  .slice(0, 10)
              })()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="user" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis label={{ value: 'Achievement %', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                <Legend />
                <Bar dataKey="Achievement %" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* DETAILED VIEW - Data Table with Pagination */
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Detailed Target vs Achievement Data</h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, targets.length)} of {targets.length} targets
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={targets.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              Export Excel
            </button>
          </div>

          <div className={isFullscreen ? "overflow-x-auto max-h-[calc(100vh-300px)]" : "overflow-x-auto max-h-[600px]"}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Year</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Month</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TL Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">TL Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Field User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Target Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Achievement</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Achievement %</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedTargets.map((item, index) => (
                  <tr key={index} className="hover:bg-emerald-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.targetYear}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{monthNames[item.targetMonth - 1]}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{item.teamLeaderCode || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.teamLeaderName || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{item.userName}</div>
                      <div className="text-xs text-gray-500 font-mono">{item.userCode}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{item.customerName}</div>
                      <div className="text-xs text-gray-500 font-mono">{item.customerCode}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">AED{item.targetAmount.toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-blue-900">AED{item.achievementAmount.toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold">
                      <span className={`${
                        item.achievementPercentage >= 100 ? 'text-green-600' :
                        item.achievementPercentage >= 75 ? 'text-blue-600' :
                        item.achievementPercentage >= 50 ? 'text-orange-600' :
                        'text-red-600'
                      }`}>
                        {item.achievementPercentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        item.achievementPercentage >= 100 ? 'bg-green-100 text-green-800' :
                        item.achievementPercentage >= 75 ? 'bg-blue-100 text-blue-800' :
                        item.achievementPercentage >= 50 ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.achievementPercentage >= 100 ? 'Achieved' :
                         item.achievementPercentage >= 75 ? 'On Track' :
                         item.achievementPercentage >= 50 ? 'At Risk' :
                         'Below Target'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
