'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Download, Calendar, Filter, Users, BarChart3 } from 'lucide-react'
import { useDashboardKPI } from '@/hooks/useDataService'
import { useResponsive } from '@/hooks/useResponsive'
import ExcelJS from 'exceljs'
// Removed direct TargetService import to avoid client-side fs module issues
// Will use API calls instead

// Types
interface KPIData {
  dayTarget: number
  dayAchievement: number
  mtdTarget: number
  mtdAchievement: number
  ytdTarget?: number
  ytdAchievement?: number
  avgPercentage?: number
  isEmpty?: boolean // Flag to indicate if cell should be empty/gray
}

interface SalesmanData {
  code: string
  name: string
  routeCode?: string
  region?: string
  status: string
  hasTargets?: boolean
  kpiData: Record<string, KPIData>
}

interface CellSelection {
  row: number
  col: number
  isSelected: boolean
}

// Helper function to calculate business days (Mon-Sat) between two dates
const getBusinessDaysCount = (startDate: Date, endDate: Date): number => {
  let count = 0
  const currentDate = new Date(startDate)

  // Include the end date in the count
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay()
    // Count Monday (1) through Saturday (6), exclude Sunday (0)
    if (dayOfWeek !== 0) {
      count++
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return count
}

// KPI Names - 32 KPIs from Excel analysis
const KPI_NAMES = [
  "Sales",
  "Ach % V/s Target",
  "Ach % V/s LY",
  "Top 10 outlet Sales % Cont",
  "Top 20 outlet Sales % Cont",
  "Top 30 outlet Sales % Cont",
  "Total SKU : MSL Van",
  "Total SKU : Available in Van",
  "Total SKU : Sold",
  "Total SKU : Sales Top 10 SKU Cont",
  "Total SKU : Sales Last 5 SKU Cont",
  "JP Outlets: Planned",
  "JP Outlets: Adherance %  Vs Plan",
  "Total Outlets : Coverage(Visit)",
  "Total Outlets : Productive(Actual)",
  "Total Outlets : Productive %",
  "Total Outlets : Zero billed",
  "Prod. Outlets : Drop Size(Coverage)",
  "Prod. Outlets : Drop Size(Produ)",
  "Prod. Outlets : Average lines sold",
  "Total calls",
  "Total calls : Productive",
  "Total calls : Productive %",
  "Total calls : Zero billed",
  "Prod. calls : Drop size",
  "Prod. calls : Average lines sold",
  "First Invoice Time",
  "Last Invoice Time",
  "Customer Service(Hours)",
  "Collection Ach",
  "Bad Goods ( Value )",
  "Bad Goods %"
]

export const ExcelSheet: React.FC = () => {
  // State management
  const [selectedDate, setSelectedDate] = useState(() => {
    return '2025-09-08'
  })
  const [selectedSalesman, setSelectedSalesman] = useState('all')
  const [selectedRoute, setSelectedRoute] = useState('all')
  const [salesmen, setSalesmen] = useState<SalesmanData[]>([])
  const [availableRoutes, setAvailableRoutes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [cellSelection, setCellSelection] = useState<CellSelection | null>(null)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [showTotalRow, setShowTotalRow] = useState(false)

  // Refs for Excel functionality
  const tableRef = useRef<HTMLTableElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Hooks
  const { isMobile } = useResponsive()
  const { data: kpiData, loading: kpiLoading, refresh: refreshKPI } = useDashboardKPI(selectedDate)


  // Computed filtered data based on selections - Only show date-specific data
  const filteredSalesmen = useMemo(() => {
    let filtered = [...salesmen]

    if (selectedRoute !== 'all') {
      filtered = filtered.filter(s => s.routeCode === selectedRoute)
    }

    if (selectedSalesman !== 'all') {
      filtered = filtered.filter(s => s.code === selectedSalesman)
    }

    return filtered
  }, [salesmen, selectedRoute, selectedSalesman])

  // Check if any filter is active (not showing all salesmen)
  const isFilterActive = selectedSalesman !== 'all' || selectedRoute !== 'all'

  // Simplified filter logic
  const handleRouteChange = (route: string) => {
    setSelectedRoute(route)
    // Since route:salesman is 1:1, automatically select that salesman
    if (route !== 'all') {
      const salesman = salesmen.find(s => s.routeCode === route)
      if (salesman) {
        setSelectedSalesman(salesman.code)
      } else {
        setSelectedSalesman('all')
      }
    } else {
      setSelectedSalesman('all')
    }
  }

  // Fetch real salesmen and KPI data from PostgreSQL using specific date filters
  useEffect(() => {
    const fetchRealData = async () => {
      setLoading(true)
      try {
        // Use consolidated API for 10x better performance - ONE CALL instead of 7!
        const dateParam = selectedDate
        console.log('🚀 ExcelSheet: Fetching consolidated data for:', dateParam)

        const response = await fetch(`/api/excel-sheet-data?date=${dateParam}`)
        const result = await response.json()

        if (!result.success) {
          throw new Error(result.message || 'Failed to fetch consolidated data')
        }

        const salesmenData = result.data.salesmen || []
        const routesData = { data: result.data.routes || [] }
        const summaryData = result.data.summary || {}

        // Update available filters - only show date-specific routes and salesmen
        setAvailableRoutes(routesData.data || [])

        console.log('✅ ExcelSheet: Consolidated data loaded successfully')
        console.log('📊 Salesmen:', salesmenData?.length || 0, 'with complete KPI data')
        console.log('🛣️ Routes:', routesData?.data?.length || 0, 'found')
        console.log('💰 Sales Summary:', summaryData ? 'Available' : 'No data')

        // 🎯 Fetch actual targets from database using API
        console.log('🎯 ExcelSheet: Fetching targets from tblcommontarget...')
        const salesmanCodes = salesmenData.map((s: any) => s.code)

        let monthlyTargetsMap = new Map<string, number>()
        let dailyTargetsMap = new Map<string, number>()

        try {
          const targetsResponse = await fetch(`/api/targets?salesmanCodes=${salesmanCodes.join(',')}&date=${selectedDate}`)
          const targetsResult = await targetsResponse.json()

          if (targetsResult.success) {
            // Convert objects back to Maps
            Object.entries(targetsResult.data.monthly).forEach(([key, value]) => {
              monthlyTargetsMap.set(key, value as number)
            })
            Object.entries(targetsResult.data.daily).forEach(([key, value]) => {
              dailyTargetsMap.set(key, value as number)
            })

            console.log('✅ Targets loaded:', {
              monthlyTargets: monthlyTargetsMap.size,
              dailyTargets: dailyTargetsMap.size,
              sampleMonthlyTarget: Array.from(monthlyTargetsMap.values())[0] || 'No data'
            })
          } else {
            console.warn('⚠️ Failed to fetch targets:', targetsResult.error)
          }
        } catch (error) {
          console.error('❌ Error fetching targets:', error)
        }

        // Process consolidated data into KPI format - with actual targets!
        const processedSalesmen = salesmenData.map((salesman: any) => {
          // Get actual targets for this salesman from database
          const monthlyTarget = monthlyTargetsMap.get(salesman.code) || 0
          const dailyTargetFromDB = dailyTargetsMap.get(salesman.code) || 0

          // Use ONLY actual targets from tblcommontarget database - NO FALLBACKS
          const actualDailyTarget = dailyTargetFromDB // Only real daily target from DB
          const actualMonthlyTarget = monthlyTarget // Only real monthly target from DB

          console.log(`📊 Targets for ${salesman.name} (${salesman.code}):`, {
            monthly: actualMonthlyTarget,
            daily: actualDailyTarget,
            sales: salesman.sales
          })

          // Generate KPI data using actual targets from database!
          const kpiData: Record<string, KPIData> = {}

          KPI_NAMES.forEach((kpiName) => {
            let dayTarget = 0, dayAchievement = 0, mtdTarget = 0, mtdAchievement = 0, avgPercentage = 0

            // KPI-specific calculations with REAL TARGETS from database
            switch(kpiName) {
              // SALES KPIs - MATCH EXCEL EXACTLY (Day and MTD targets are DIFFERENT)
              case 'Sales':
                // Excel Row 5: Sales - Shows Day Target, Day Ach, MTD Target, MTD Ach, Average
                const dailySalesValue = parseFloat(salesman.sales || 0) // Daily sales only
                const mtdSalesValue = parseFloat(salesman.mtdSales || 0) // Month-to-date cumulative sales

                // Debug logging to verify MTD data
                if (salesman.code === salesmenData[0]?.code) { // Log first salesman only
                  console.log(`📊 Sales Data for ${salesman.name}:`, {
                    dailySales: dailySalesValue,
                    mtdSales: mtdSalesValue,
                    dailyTarget: actualDailyTarget,
                    monthlyTarget: actualMonthlyTarget,
                    hasTargets: salesman.hasTargets
                  })
                }


                // Day and MTD targets MUST be different (like Excel shows 12,331 vs 382,273)
                dayTarget = actualDailyTarget || 0 // Real daily target from DB
                mtdTarget = actualMonthlyTarget || 0 // Real monthly target from DB (DIFFERENT!)
                dayAchievement = dailySalesValue // DAILY sales only
                mtdAchievement = mtdSalesValue // MTD cumulative sales (DIFFERENT!)
                avgPercentage = mtdTarget > 0 ? (mtdSalesValue / mtdTarget) * 100 : 0 // Use MTD for percentage
                break

              case 'Ach % V/s Target':
                // Excel Row 6: Ach % V/s Target - TARGETS ARE EMPTY, only show achievement %
                const currentDailySales = parseFloat(salesman.sales || 0)
                const currentMtdSales = parseFloat(salesman.mtdSales || 0)

                // Excel pattern: Day Target=EMPTY, Day Ach=%, MTD Target=EMPTY, MTD Ach=%, Average=EMPTY
                dayTarget = null // EMPTY in Excel - will show as '-'
                mtdTarget = null // EMPTY in Excel - will show as '-'
                avgPercentage = null // EMPTY in Excel - will show as '-'

                // Only show achievement percentages if we have targets
                if (actualDailyTarget > 0) {
                  dayAchievement = (currentDailySales / actualDailyTarget) * 100
                } else {
                  dayAchievement = 0 // No target = no percentage
                }

                if (actualMonthlyTarget > 0) {
                  mtdAchievement = (currentMtdSales / actualMonthlyTarget) * 100
                } else {
                  mtdAchievement = 0 // No target = no percentage
                }
                break

              case 'Ach % V/s LY':
                // Excel Row 7: Day columns EMPTY, MTD Target shows LY value, MTD Ach shows % variance
                dayTarget = null // EMPTY in Excel
                dayAchievement = null // EMPTY in Excel
                // MTD Target would show last year's MTD value (not available in current data)
                mtdTarget = 0 // Last year's MTD sales (not available)
                // MTD Ach would show % variance vs LY
                mtdAchievement = 0 // Variance % (not available without LY data)
                avgPercentage = null // EMPTY in Excel
                break

              // CUSTOMER/OUTLET CONTRIBUTION KPIs - Excel Row 9-11
              case 'Top 10 outlet Sales % Cont':
              case 'Top 20 outlet Sales % Cont':
              case 'Top 30 outlet Sales % Cont':
                // Excel pattern: All Target columns EMPTY, only Ach columns have percentages
                dayTarget = null // EMPTY in Excel
                dayAchievement = null // EMPTY in Excel for Day
                mtdTarget = null // EMPTY in Excel
                // Would need customer-level sales analysis for real calculation
                mtdAchievement = 0 // Should be percentage of top N customers
                avgPercentage = null // EMPTY in Excel
                break

              // SKU/PRODUCT KPIs - Excel Row 13-17
              case 'Total SKU : MSL Van':
                // Excel Row 13: Should be empty - we don't have MSL data
                dayTarget = null // No MSL data available
                dayAchievement = null // No MSL data available
                mtdTarget = null // No MSL data available
                mtdAchievement = null // No MSL data available
                avgPercentage = null // EMPTY in Excel
                break

              case 'Total SKU : Available in Van':
                // Excel Row 14: Should be empty - we don't have van inventory data
                dayTarget = null // No van inventory data
                dayAchievement = null // No van inventory data
                mtdTarget = null // No van inventory data
                mtdAchievement = null // No van inventory data
                avgPercentage = null // EMPTY in Excel
                break

              case 'Total SKU : Sold':
                // Excel Row 15: Should show unique SKUs sold (counts, not values)
                const dailySkuSold = parseInt(salesman.uniqueProducts || 0)
                const mtdSkuSold = parseInt(salesman.mtdUniqueProducts || 0)
                dayTarget = null // No target data available
                dayAchievement = dailySkuSold // Actual SKUs sold today (count)
                mtdTarget = null // No target data available
                mtdAchievement = mtdSkuSold // Actual SKUs sold MTD (count)
                avgPercentage = mtdSkuSold > 0 && dailySkuSold > 0 ? (mtdSkuSold / dailySkuSold * 100) : 0
                break

              case 'Total SKU : Sales Top 10 SKU Cont':
                // Excel Row 16: Targets EMPTY, achievements show Top 10 SKU contribution %
                const dayTop10 = parseFloat(salesman.top10SKUContribution || 0)
                const mtdTop10 = parseFloat(salesman.mtdTop10SKUContribution || 0)
                dayTarget = null // EMPTY in Excel
                dayAchievement = dayTop10 // Day Top 10 SKU contribution %
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdTop10 // MTD Top 10 SKU contribution %
                avgPercentage = null // EMPTY in Excel
                break

              case 'Total SKU : Sales Last 5 SKU Cont':
                // Excel Row 17: Targets EMPTY, achievements show Last 5 SKU contribution %
                const dayLast5 = parseFloat(salesman.last5SKUContribution || 0)
                const mtdLast5 = parseFloat(salesman.mtdLast5SKUContribution || 0)

                // Debug logging for salesman 21331
                if (salesman.code === '21331') {
                  console.log(`🔍 Frontend SKU Data for ${salesman.code}:`, {
                    dayLast5Raw: salesman.last5SKUContribution,
                    mtdLast5Raw: salesman.mtdLast5SKUContribution,
                    dayLast5Parsed: dayLast5,
                    mtdLast5Parsed: mtdLast5,
                    dayTop10Raw: salesman.top10SKUContribution,
                    mtdTop10Raw: salesman.mtdTop10SKUContribution
                  })
                }

                dayTarget = null // EMPTY in Excel
                dayAchievement = dayLast5 // Day Last 5 SKU contribution %
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdLast5 // MTD Last 5 SKU contribution %
                avgPercentage = null // EMPTY in Excel
                break

              // JOURNEY PLAN KPIs - MATCH EXCEL PATTERN
              case 'JP Outlets: Planned':
                // Excel Row 12: Shows planned outlets for journey
                const plannedOutlets = parseInt(salesman.routePlannedCustomers || 0)
                const actualVisited = parseInt(salesman.customersVisited || 0)
                const mtdActualVisited = parseInt(salesman.mtdUniqueCustomers || 0)

                // Day shows planned vs actual for today
                dayTarget = plannedOutlets // Planned outlets for day
                dayAchievement = actualVisited // Actual visited today
                // MTD shows cumulative planned vs actual
                // Calculate actual working days from start of month to selected date
                const selectedDateForCalc = new Date(selectedDate)
                const startOfMonthForCalc = new Date(selectedDateForCalc.getFullYear(), selectedDateForCalc.getMonth(), 1)
                const workingDaysSoFar = getBusinessDaysCount(startOfMonthForCalc, selectedDateForCalc)
                const avgDailyPlan = plannedOutlets // Daily plan
                mtdTarget = avgDailyPlan * workingDaysSoFar // Realistic MTD target
                mtdAchievement = mtdActualVisited // Actual MTD visited
                avgPercentage = plannedOutlets > 0 ? (actualVisited / plannedOutlets * 100) : 0
                break

              case 'JP Outlets: Adherance %  Vs Plan':
                // Excel Row 13: Shows adherence percentage
                const totalPlanned = parseInt(salesman.routePlannedCustomers || 0)
                const actuallyVisited = parseInt(salesman.customersVisited || 0)
                // Calculate actual working days from start of month to selected date
                const selectedDateForAdherence = new Date(selectedDate)
                const startOfMonthForAdherence = new Date(selectedDateForAdherence.getFullYear(), selectedDateForAdherence.getMonth(), 1)
                const workingDays = getBusinessDaysCount(startOfMonthForAdherence, selectedDateForAdherence)
                const mtdPlanned = totalPlanned * workingDays // Realistic MTD plan
                const mtdVisitedForAdherence = parseInt(salesman.mtdUniqueCustomers || 0)

                // Calculate adherence percentages separately for Day and MTD
                const dayAdherence = totalPlanned > 0 ? Math.min((actuallyVisited / totalPlanned) * 100, 100) : 0
                const mtdAdherence = mtdPlanned > 0 ? Math.min((mtdVisitedForAdherence / mtdPlanned) * 100, 100) : 0

                dayTarget = null // EMPTY in Excel
                mtdTarget = null // EMPTY in Excel
                dayAchievement = dayAdherence // Day adherence %
                mtdAchievement = mtdAdherence // MTD adherence %
                avgPercentage = (dayAdherence + mtdAdherence) / 2
                break

              // VISIT/OUTLET KPIs - Excel Row 22-28
              case 'Total Outlets : Coverage(Visit)':
                // Excel Row 22: Targets EMPTY, only achievements have values
                const totalVisited = parseInt(salesman.customersVisited || 0)
                const mtdTotalVisited = parseInt(salesman.mtdCustomersVisited || 0) // Use real MTD visited
                dayTarget = null // EMPTY in Excel
                dayAchievement = totalVisited // Day visited count
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdTotalVisited // MTD visited count
                avgPercentage = null // EMPTY in Excel
                break

              case 'Total Outlets : Productive(Actual)':
                // Excel Row 23: Targets EMPTY, only achievements have values
                const productiveOutlets = parseInt(salesman.uniqueCustomers || 0) // Customers who bought
                // For MTD, use unique customers with sales
                const mtdProductiveOutlets = parseInt(salesman.mtdUniqueCustomers || 0)
                dayTarget = null // EMPTY in Excel
                dayAchievement = productiveOutlets // Day productive
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdProductiveOutlets // MTD productive
                avgPercentage = null // EMPTY in Excel
                break

              case 'Total Outlets : Productive %':
                // Excel Row 24: Targets EMPTY, achievements show percentages
                // CORRECT CALCULATION: customers who made purchases / customers visited * 100
                const customersVisitedCount = parseInt(salesman.customersVisited || 0)
                const customersWithSales = parseInt(salesman.uniqueCustomers || 0) // Customers who actually bought

                // Productivity = customers who bought / customers visited
                const outletProductivity = customersVisitedCount > 0 ? (customersWithSales / customersVisitedCount) * 100 : 0

                // MTD calculation with real data
                const mtdCustomersVisitedCount = parseInt(salesman.mtdCustomersVisited || 0)
                const mtdCustomersWithSales = parseInt(salesman.mtdUniqueCustomers || 0)
                const mtdOutletProductivity = mtdCustomersVisitedCount > 0 ? (mtdCustomersWithSales / mtdCustomersVisitedCount) * 100 : 0

                dayTarget = null // EMPTY in Excel
                dayAchievement = Math.min(outletProductivity, 100) // Cap at 100%
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = Math.min(mtdOutletProductivity, 100) // Real MTD productivity
                avgPercentage = null // EMPTY in Excel
                break

              case 'Total Outlets : Zero billed':
                // Excel Row 17: Zero billed outlets (visited but no purchase)
                // IMPORTANT: This is customers visited but didn't buy
                const visitedCustomers = parseInt(salesman.customersVisited || 0)
                const customersWhoBought = parseInt(salesman.uniqueCustomers || 0)
                const zeroBilledOutlets = Math.max(0, visitedCustomers - customersWhoBought)

                // For MTD: Use real MTD visit data from API
                const mtdVisitedCustomers = parseInt(salesman.mtdCustomersVisited || 0)
                const mtdCustomersWhoBought = parseInt(salesman.mtdUniqueCustomers || 0)
                const mtdZeroBilledOutlets = Math.max(0, mtdVisitedCustomers - mtdCustomersWhoBought)

                dayTarget = null // EMPTY in Excel
                dayAchievement = zeroBilledOutlets // Day zero billed
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdZeroBilledOutlets // MTD zero billed
                avgPercentage = null // EMPTY in Excel
                break


              case 'Prod. Outlets : Drop Size(Coverage)':
                // Excel Row 18: Average sales per VISITED outlet (including zero sales)
                const totalSalesAmount = parseFloat(salesman.sales || 0)
                const outletsVisited = parseInt(salesman.customersVisited || 0)
                const coverageDropSize = outletsVisited > 0 ? totalSalesAmount / outletsVisited : 0

                const mtdSalesAmount = parseFloat(salesman.mtdSales || 0)
                // Use real MTD customers visited from API
                const mtdOutletsVisited = parseInt(salesman.mtdCustomersVisited || 0)
                const mtdCoverageDropSize = mtdOutletsVisited > 0 ? mtdSalesAmount / mtdOutletsVisited : 0

                dayTarget = null // EMPTY in Excel
                dayAchievement = coverageDropSize
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdCoverageDropSize
                avgPercentage = null // EMPTY in Excel
                break

              case 'Prod. Outlets : Drop Size(Produ)':
                // Excel Row 19: Average sales per PRODUCTIVE outlet only
                const productiveSales = parseFloat(salesman.sales || 0)
                // Use uniqueCustomers (those who bought) not productiveVisits
                const productiveOutletCount = parseInt(salesman.uniqueCustomers || 0)
                const productiveDropSize = productiveOutletCount > 0 ? productiveSales / productiveOutletCount : 0

                const mtdProductiveSales = parseFloat(salesman.mtdSales || 0)
                const mtdProductiveOutletCount = parseInt(salesman.mtdUniqueCustomers || 0)
                const mtdProductiveDropSize = mtdProductiveOutletCount > 0 ? mtdProductiveSales / mtdProductiveOutletCount : 0

                dayTarget = null // EMPTY in Excel
                dayAchievement = productiveDropSize
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdProductiveDropSize
                avgPercentage = null // EMPTY in Excel
                break

              case 'Prod. Outlets : Average lines sold':
                // Excel Row 28: Targets EMPTY, achievements show average lines
                const dayLines = parseInt(salesman.uniqueProducts || 0)
                const mtdLines = parseInt(salesman.mtdUniqueProducts || 0)

                dayTarget = null // EMPTY in Excel
                dayAchievement = dayLines // Show unique products sold
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdLines // Show MTD unique products
                avgPercentage = null // EMPTY in Excel
                break

              // CALL KPIs - Excel Row 30-35
              case 'Total calls':
                // Excel Row 30: Targets EMPTY, achievements show call counts
                const totalCallsCount = parseInt(salesman.visits || 0)
                // Use real MTD visits from API
                const mtdTotalCallsCount = parseInt(salesman.mtdVisits || 0)
                dayTarget = null // EMPTY in Excel
                dayAchievement = totalCallsCount
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdTotalCallsCount
                avgPercentage = null // EMPTY in Excel
                break

              case 'Total calls : Productive':
                // Excel Row 31: Targets EMPTY, achievements show productive calls
                const productiveCallCount = parseInt(salesman.productiveVisits || 0)
                // Use real MTD productive visits from API
                const mtdProductiveCallCount = parseInt(salesman.mtdProductiveVisits || 0)
                dayTarget = null // EMPTY in Excel
                dayAchievement = productiveCallCount
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdProductiveCallCount
                avgPercentage = null // EMPTY in Excel
                break

              case 'Total calls : Productive %':
                // Excel Row 32: Targets EMPTY, achievements show percentages
                // CORRECT CALCULATION: productive calls / total calls * 100
                const totalCallsForProductivity = parseInt(salesman.visits || 0)
                const productiveCallsForProductivity = parseInt(salesman.productiveVisits || 0)
                const correctCallProductivity = totalCallsForProductivity > 0 ? (productiveCallsForProductivity / totalCallsForProductivity) * 100 : 0

                // MTD calculation with real data
                const mtdTotalCalls = parseInt(salesman.mtdVisits || 0)
                const mtdProductiveCallsForPercentage = parseInt(salesman.mtdProductiveVisits || 0)
                const mtdCallProductivity = mtdTotalCalls > 0 ? (mtdProductiveCallsForPercentage / mtdTotalCalls) * 100 : 0

                dayTarget = null // EMPTY in Excel
                dayAchievement = Math.min(correctCallProductivity, 100) // Cap at 100% maximum
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = Math.min(mtdCallProductivity, 100) // Real MTD productivity
                avgPercentage = null // EMPTY in Excel
                break

              case 'Total calls : Zero billed':
                // Excel Row 33: Targets EMPTY, can have negative values
                const totalCallsForZeroBilled = parseInt(salesman.visits || 0)
                const productiveCallsForZeroBilled = parseInt(salesman.productiveVisits || 0)
                const zeroBilledCalls = totalCallsForZeroBilled - productiveCallsForZeroBilled

                // For MTD: Use real MTD visit data
                const mtdTotalCallsReal = parseInt(salesman.mtdVisits || 0)
                const mtdProductiveCallsReal = parseInt(salesman.mtdProductiveVisits || 0)
                const mtdZeroBilledCalls = mtdTotalCallsReal - mtdProductiveCallsReal

                dayTarget = null // EMPTY in Excel
                dayAchievement = zeroBilledCalls
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdZeroBilledCalls
                avgPercentage = null // EMPTY in Excel
                break

              case 'Prod. calls : Drop size':
                // Excel Row 34: Targets EMPTY, achievements show average sales per call
                const avgOrderVal = parseFloat(salesman.avgOrderValue || 0)
                const mtdAvgOrderVal = parseFloat(salesman.mtdAvgOrderValue || 0)
                dayTarget = null // EMPTY in Excel
                dayAchievement = avgOrderVal
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdAvgOrderVal
                avgPercentage = null // EMPTY in Excel
                break

              case 'Prod. calls : Average lines sold':
                // Excel Row 35: Targets EMPTY, achievements show average lines
                const dayAvgLines = parseInt(salesman.uniqueProducts || 0)
                const mtdAvgLines = parseInt(salesman.mtdUniqueProducts || 0)
                dayTarget = null // EMPTY in Excel
                dayAchievement = dayAvgLines
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdAvgLines
                avgPercentage = null // EMPTY in Excel
                break

              // TIME-BASED KPIs - Excel Row 37-39
              case 'First Invoice Time':
                // Excel Row 37: Targets EMPTY, achievements show time in HH:MM format
                const firstTransactionTime = salesman.firstTransaction
                let firstTimeValue = null
                if (firstTransactionTime) {
                  const firstDate = new Date(firstTransactionTime)
                  // Convert to decimal hours for proper time formatting (e.g., 7.38 for 07:23)
                  firstTimeValue = firstDate.getHours() + (firstDate.getMinutes() / 60)
                }

                // MTD First Invoice Time
                const mtdFirstTransactionTime = salesman.mtdFirstTransaction
                let mtdFirstTimeValue = null
                if (mtdFirstTransactionTime) {
                  const mtdFirstDate = new Date(mtdFirstTransactionTime)
                  mtdFirstTimeValue = mtdFirstDate.getHours() + (mtdFirstDate.getMinutes() / 60)
                }

                dayTarget = null // EMPTY in Excel
                dayAchievement = firstTimeValue // Day first invoice time
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdFirstTimeValue // MTD first invoice time (earliest across MTD)
                avgPercentage = null // EMPTY in Excel
                break

              case 'Last Invoice Time':
                // Excel Row 38: Targets EMPTY, achievements show time in HH:MM format
                const lastTransactionTime = salesman.lastTransaction
                let lastTimeValue = null
                if (lastTransactionTime) {
                  const lastDate = new Date(lastTransactionTime)
                  // Convert to decimal hours for proper time formatting (e.g., 16.45 for 16:27)
                  lastTimeValue = lastDate.getHours() + (lastDate.getMinutes() / 60)
                }

                // MTD Last Invoice Time
                const mtdLastTransactionTime = salesman.mtdLastTransaction
                let mtdLastTimeValue = null
                if (mtdLastTransactionTime) {
                  const mtdLastDate = new Date(mtdLastTransactionTime)
                  mtdLastTimeValue = mtdLastDate.getHours() + (mtdLastDate.getMinutes() / 60)
                }

                dayTarget = null // EMPTY in Excel
                dayAchievement = lastTimeValue // Day last invoice time
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdLastTimeValue // MTD last invoice time (latest across MTD)
                avgPercentage = null // EMPTY in Excel
                break

              case 'Customer Service(Hours)':
                // Excel Row 39: Targets EMPTY, achievements show working hours as decimal
                const firstTime = salesman.firstTransaction ? new Date(salesman.firstTransaction) : null
                const lastTime = salesman.lastTransaction ? new Date(salesman.lastTransaction) : null
                let serviceHours = null

                if (firstTime && lastTime) {
                  // Calculate working hours as decimal (e.g., 8.5 hours)
                  serviceHours = (lastTime.getTime() - firstTime.getTime()) / (1000 * 60 * 60)
                  // Keep as decimal for proper display (don't round to integer)
                  serviceHours = Math.round(serviceHours * 10) / 10 // Round to 1 decimal place
                }

                // MTD Customer Service Hours
                const mtdFirstTime = salesman.mtdFirstTransaction ? new Date(salesman.mtdFirstTransaction) : null
                const mtdLastTime = salesman.mtdLastTransaction ? new Date(salesman.mtdLastTransaction) : null
                let mtdServiceHours = null

                if (mtdFirstTime && mtdLastTime) {
                  // Calculate MTD working hours span
                  mtdServiceHours = (mtdLastTime.getTime() - mtdFirstTime.getTime()) / (1000 * 60 * 60)
                  mtdServiceHours = Math.round(mtdServiceHours * 10) / 10
                }

                dayTarget = null // EMPTY in Excel
                dayAchievement = serviceHours // Day working hours
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdServiceHours // MTD working hours (first to last transaction in month)
                avgPercentage = null // EMPTY in Excel
                break

              // COLLECTION KPIs - Excel Row 40
              case 'Collection Ach':
                // Excel Row 40: Targets EMPTY, achievements show collection amounts
                // Now using proper separate Day and MTD collection fields from API
                const dailyCollectionsAmount = parseFloat(salesman.totalCollected || 0) // Daily collections only
                const mtdCollectionsAmount = parseFloat(salesman.mtdTotalCollected || 0) // MTD cumulative collections

                dayTarget = null // EMPTY in Excel
                dayAchievement = dailyCollectionsAmount // Day collection amount (daily only)
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = mtdCollectionsAmount // MTD collection amount (cumulative)
                avgPercentage = null // EMPTY in Excel
                break

              // BAD GOODS KPIs - Excel Row 41-42
              case 'Bad Goods ( Value )':
                // Excel Row 41: Targets EMPTY, achievements show bad goods value
                dayTarget = null // EMPTY in Excel
                dayAchievement = 0 // Bad goods value (no data available)
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = 0 // Bad goods MTD value
                avgPercentage = null // EMPTY in Excel
                break

              case 'Bad Goods %':
                // Excel Row 42: Targets EMPTY, achievements show percentages
                dayTarget = null // EMPTY in Excel
                dayAchievement = 0 // Bad goods % (no data available)
                mtdTarget = null // EMPTY in Excel
                mtdAchievement = 0 // Bad goods MTD %
                avgPercentage = null // EMPTY in Excel
                break

              // Default case for any unmapped KPIs
              default:
                dayTarget = 0
                dayAchievement = 0
                mtdTarget = 0
                mtdAchievement = 0
                avgPercentage = 0
                break
            }

            // Determine if this KPI should be empty/gray - only for KPIs that truly have no data
            let shouldBeEmpty = false

            // Only mark as empty if ALL values are actually zero/null/undefined
            const hasAnyValue = dayTarget > 0 || dayAchievement > 0 || mtdTarget > 0 || mtdAchievement > 0 || avgPercentage !== 0
            shouldBeEmpty = !hasAnyValue

            // Mark KPIs as empty if no real data/targets available from database
            const noDataKPIs = [
              'Total SKU : MSL Van',
              'Total SKU : Available in Van',
              'Top 10 outlet Sales % Cont',
              'Top 20 outlet Sales % Cont',
              'Top 30 outlet Sales % Cont',
              'Bad Goods ( Value )',
              'Bad Goods %'
            ]

            if (noDataKPIs.includes(kpiName) || (dayTarget === 0 && dayAchievement === 0 && mtdTarget === 0 && mtdAchievement === 0)) {
              shouldBeEmpty = true
            }

            kpiData[kpiName] = {
              dayTarget,
              dayAchievement,
              mtdTarget,
              mtdAchievement,
              avgPercentage,
              isEmpty: shouldBeEmpty // Add flag to indicate empty cells
            }
          })

          return {
            code: salesman.code,
            name: salesman.name,
            routeCode: salesman.routeCode || '',
            region: salesman.region || '',
            status: salesman.status || 'active',
            hasTargets: salesman.hasTargets || false,
            kpiData
          }
        })

        // Debug first salesman's raw data
        if (salesmenData.length > 0) {
          console.log('🔎 First salesman raw data:', {
            code: salesmenData[0].code,
            sales: salesmenData[0].sales,
            mtdSales: salesmenData[0].mtdSales,
            hasTargets: salesmenData[0].hasTargets
          })
        }

        setSalesmen(processedSalesmen)
      } catch (error) {
        console.error('Error fetching real data:', error)
        setSalesmen([])
      } finally {
        setLoading(false)
      }
    }

    fetchRealData()
  }, [selectedDate])

  // Calculate total row data using ALL salesmen (not filtered!)
  // Total Performance should ALWAYS show totals for ALL salesmen regardless of filters
  const totalRowData = useMemo(() => {
    const totals: Record<string, KPIData> = {}

    KPI_NAMES.forEach(kpiName => {
      let dayTargetSum = 0
      let dayAchievementSum = 0
      let mtdTargetSum = 0
      let mtdAchievementSum = 0
      let count = 0

      // Special handling for percentage KPIs that don't have targets
      const isPercentageKPI = kpiName.includes('%') || kpiName.includes('Productive') || kpiName.includes('Adherance') || kpiName.includes('Cont') // SKU Contribution KPIs

      // Special handling for time-based KPIs that should be averaged, not summed
      const isTimeKPI = kpiName.includes('Invoice Time') || kpiName.includes('Customer Service')

      // IMPORTANT: Use ALL salesmen, not filtered ones!
      salesmen.forEach(salesman => {
        if (salesman.kpiData[kpiName]) {
          const data = salesman.kpiData[kpiName]

          // For percentage KPIs with null targets, don't sum them up - that's wrong!
          if (isPercentageKPI && (data.dayTarget === null || data.mtdTarget === null)) {
            // Just count valid achievement values for averaging
            if (typeof data.dayAchievement === 'number' && data.dayAchievement > 0) {
              dayAchievementSum += data.dayAchievement
              count++
            }
            if (typeof data.mtdAchievement === 'number' && data.mtdAchievement > 0) {
              mtdAchievementSum += data.mtdAchievement
            }
          } else if (isTimeKPI) {
            // For time-based KPIs, sum for averaging but don't sum targets (they're null anyway)
            if (typeof data.dayAchievement === 'number' && data.dayAchievement !== null) {
              dayAchievementSum += data.dayAchievement
              count++
            }
            if (typeof data.mtdAchievement === 'number' && data.mtdAchievement !== null) {
              mtdAchievementSum += data.mtdAchievement
            }
            // Don't sum targets for time KPIs (they're null)
          } else {
            // For regular KPIs with targets, sum normally
            dayTargetSum += data.dayTarget || 0
            dayAchievementSum += data.dayAchievement || 0
            mtdTargetSum += data.mtdTarget || 0
            mtdAchievementSum += data.mtdAchievement || 0
            count++
          }
        }
      })

      // Calculate average percentage correctly
      let avgPercentage = 0
      if (count > 0) {
        if (isPercentageKPI) {
          // For percentage KPIs, calculate average percentage (not sum/target)
          avgPercentage = dayAchievementSum / count
        } else {
          // For regular KPIs, calculate percentage from sums
          avgPercentage = dayTargetSum > 0 ? (dayAchievementSum / dayTargetSum) * 100 : 0
        }
      }

      totals[kpiName] = {
        dayTarget: (isPercentageKPI || isTimeKPI) ? null : dayTargetSum, // Show null for percentage and time KPIs
        dayAchievement: (isPercentageKPI || isTimeKPI) ? (count > 0 ? dayAchievementSum / count : 0) : dayAchievementSum,
        mtdTarget: (isPercentageKPI || isTimeKPI) ? null : mtdTargetSum, // Show null for percentage and time KPIs
        mtdAchievement: (isPercentageKPI || isTimeKPI) ? (count > 0 ? mtdAchievementSum / count : 0) : mtdAchievementSum,
        avgPercentage: avgPercentage
      }
    })

    return totals
  }, [salesmen]) // Use salesmen, not filteredSalesmen!

  // Cell formatting helpers - Show '-' for empty cells, proper values for data
  const formatCellValue = (value: number | null | undefined, type: 'currency' | 'percentage' | 'number' | 'time' = 'number', isEmpty?: boolean) => {
    // ALWAYS return dash for gray/empty cells - NO DATA SHOWN
    if (isEmpty) return '-'

    // Return dash for null/undefined values - these are INTENTIONALLY EMPTY cells
    if (value === null || value === undefined) return '-'

    // Return dash for zero values in certain contexts
    if (value === 0) {
      // For percentages, 0% is meaningful
      if (type === 'percentage') {
        return '0.0%'
      }
      // For numbers that should show zeros (like counts)
      if (type === 'number') {
        return '0'
      }
      // For currency, show dash instead of AED 0
      return '-'
    }

    switch (type) {
      case 'currency':
        return `AED ${value.toLocaleString()}`
      case 'percentage':
        return `${value.toFixed(1)}%`
      case 'time':
        // Convert decimal hours to HH:MM format
        const hours = Math.floor(value)
        const minutes = Math.round((value - hours) * 60)
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      default:
        return value.toLocaleString()
    }
  }

  // Helper function to check if a value should be considered "empty" and styled gray
  const isEmptyValue = (value: any): boolean => {
    if (value === null || value === undefined || value === '') return true
    if (value === 0 || value === '0') return true
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed === '-' || trimmed === '0%' || trimmed === '0.0%' || trimmed === '0.00') return true
      // Check for percentage values that are essentially 0
      if (trimmed.endsWith('%')) {
        const numPart = parseFloat(trimmed.replace('%', ''))
        if (!isNaN(numPart) && numPart === 0) return true
      }
    }
    if (typeof value === 'number' && value === 0) return true
    return false
  }

  // Helper function to check if a section separator should be added after this KPI index
  const shouldAddSeparator = (kpiIndex: number): boolean => {
    // Add separator after these KPI indices
    const separatorIndices = [2, 5, 10, 12, 19, 25]
    return separatorIndices.includes(kpiIndex)
  }

  const getCellStatus = (value: any, isEmpty?: boolean) => {
    // STRICT gray styling for empty cells - must be visibly different
    if (isEmpty || isEmptyValue(value)) return 'bg-gray-200 text-gray-500'

    // Clean white background for all data cells - no status colors
    return 'bg-white text-gray-900'
  }

  // Cell selection handlers
  const handleCellClick = (rowIndex: number, colIndex: number, event: React.MouseEvent) => {
    const cellKey = `${rowIndex}-${colIndex}`

    if (event.ctrlKey || event.metaKey) {
      // Multi-select with Ctrl/Cmd
      const newSelected = new Set(selectedCells)
      if (newSelected.has(cellKey)) {
        newSelected.delete(cellKey)
      } else {
        newSelected.add(cellKey)
      }
      setSelectedCells(newSelected)
    } else {
      // Single select
      setSelectedCells(new Set([cellKey]))
    }

    setCellSelection({ row: rowIndex, col: colIndex, isSelected: true })
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!cellSelection) return

      const { row, col } = cellSelection
      let newRow = row
      let newCol = col

      switch (event.key) {
        case 'ArrowUp':
          newRow = Math.max(0, row - 1)
          event.preventDefault()
          break
        case 'ArrowDown':
          newRow = Math.min(salesmen.length, row + 1)
          event.preventDefault()
          break
        case 'ArrowLeft':
          newCol = Math.max(0, col - 1)
          event.preventDefault()
          break
        case 'ArrowRight':
          const totalCols = 6 + (filteredSalesmen.length * 5)
          newCol = Math.min(totalCols - 1, col + 1)
          event.preventDefault()
          break
        case 'Escape':
          setCellSelection(null)
          setSelectedCells(new Set())
          event.preventDefault()
          break
      }

      if (newRow !== row || newCol !== col) {
        setCellSelection({ row: newRow, col: newCol, isSelected: true })
        setSelectedCells(new Set([`${newRow}-${newCol}`]))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [cellSelection, salesmen.length])

  // Export functionality - Export to Excel (.xlsx) format with professional styling
  const exportToExcel = async () => {
    // Create workbook and worksheet with ExcelJS
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('KPI Performance Matrix')

    // UI colors matching Tailwind CSS classes (ARGB format: FF + RGB)
    const colors = {
      headerGray: 'FFF3F4F6',      // bg-gray-100 for Description header
      emptyGray: 'FFE5E7EB',       // bg-gray-200 for empty cells (light gray)
      headerBlue: 'FFDBEAFE',      // bg-blue-100 for salesman headers
      subHeaderBlue: 'FFEFF6FF'    // bg-blue-50 for sub-headers
    }

    // Build header rows
    const headerRow1 = worksheet.addRow(['', ...Array(4).fill('Total'), ...filteredSalesmen.flatMap(s => [`${s.name} (${s.code})`, '', '', '', ''])])
    const headerRow2 = worksheet.addRow(['Description', 'Day', '', 'MTD', '', ...filteredSalesmen.flatMap(() => ['Day', '', 'MTD', '', 'Average'])])
    const headerRow3 = worksheet.addRow(['', 'Target', 'Ach', 'Target', 'Ach', ...filteredSalesmen.flatMap(() => ['Target', 'Ach', 'Target', 'Ach', '%'])])

    // Style header row 1
    headerRow1.height = 25
    headerRow1.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 11 }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }

      // Apply colors
      if (colNumber === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerGray } }
      } else if (colNumber >= 2 && colNumber <= 5) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.subHeaderBlue } }
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerBlue } }
      }
    })

    // Style header row 2
    headerRow2.height = 20
    headerRow2.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 10 }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }

      if (colNumber === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerGray } }
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.subHeaderBlue } }
      }
    })

    // Style header row 3
    headerRow3.height = 20
    headerRow3.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 10 }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }

      if (colNumber === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerGray } }
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.subHeaderBlue } }
      }
    })

    // Merge header cells
    worksheet.mergeCells('B1:E1') // Total
    filteredSalesmen.forEach((_, index) => {
      const startCol = 6 + (index * 5)
      const endCol = startCol + 4
      worksheet.mergeCells(1, startCol, 1, endCol) // Salesman name
      worksheet.mergeCells(2, startCol, 2, startCol + 1) // Day
      worksheet.mergeCells(2, startCol + 2, 2, startCol + 3) // MTD
    })
    worksheet.mergeCells('B2:C2') // Total Day
    worksheet.mergeCells('D2:E2') // Total MTD

    // Helper function to check if a value should be considered "empty"
    const isEmptyValue = (value: any): boolean => {
      if (value === null || value === undefined || value === '') return true
      if (value === 0 || value === '0') return true
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed === '-' || trimmed === '0%' || trimmed === '0.0%' || trimmed === '0.00') return true
        // Check for percentage values that are essentially 0
        if (trimmed.endsWith('%')) {
          const numPart = parseFloat(trimmed.replace('%', ''))
          if (!isNaN(numPart) && numPart === 0) return true
        }
      }
      if (typeof value === 'number' && value === 0) return true
      return false
    }

    // Add KPI data rows
    KPI_NAMES.forEach((kpiName, kpiIndex) => {
      const rowData: any[] = [kpiName]

      // Total Performance data
      const totalData = totalRowData[kpiName] || {
        dayTarget: 0,
        dayAchievement: 0,
        mtdTarget: 0,
        mtdAchievement: 0,
        avgPercentage: 0
      }

      rowData.push(
        totalData.dayTarget !== null ? totalData.dayTarget : '',
        totalData.dayAchievement !== null ? Number(totalData.dayAchievement.toFixed(2)) : '',
        totalData.mtdTarget !== null ? totalData.mtdTarget : '',
        totalData.mtdAchievement !== null ? Number(totalData.mtdAchievement.toFixed(2)) : ''
      )

      // Each salesman's data
      filteredSalesmen.forEach((salesman, salesmanIndex) => {
        const salesmanData = salesman.kpiData[kpiName] || {
          dayTarget: 0,
          dayAchievement: 0,
          mtdTarget: 0,
          mtdAchievement: 0,
          avgPercentage: 0,
          isEmpty: true
        }

        if (salesmanData.isEmpty) {
          rowData.push('', '', '', '', '')
        } else {
          rowData.push(
            salesmanData.dayTarget !== null && salesmanData.dayTarget !== undefined ? salesmanData.dayTarget : '',
            salesmanData.dayAchievement !== null && salesmanData.dayAchievement !== undefined ? Number(salesmanData.dayAchievement.toFixed(2)) : '',
            salesmanData.mtdTarget !== null && salesmanData.mtdTarget !== undefined ? salesmanData.mtdTarget : '',
            salesmanData.mtdAchievement !== null && salesmanData.mtdAchievement !== undefined ? Number(salesmanData.mtdAchievement.toFixed(2)) : '',
            salesmanData.avgPercentage !== null && salesmanData.avgPercentage !== undefined ? `${salesmanData.avgPercentage.toFixed(1)}%` : ''
          )
        }
      })

      const row = worksheet.addRow(rowData)

      // Style data row - iterate through ALL columns explicitly (not just cells with values)
      row.height = 18
      const totalColumns = 1 + 4 + (filteredSalesmen.length * 5)

      for (let colIndex = 1; colIndex <= totalColumns; colIndex++) {
        const cell = row.getCell(colIndex)

        // Ensure cell has a value (even if empty string) for styling to work
        if (cell.value === null || cell.value === undefined) {
          cell.value = ''
        }

        cell.alignment = {
          horizontal: colIndex === 1 ? 'left' : 'center',
          vertical: 'middle'
        }
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
        cell.font = { size: 10 }

        // Apply gray background to "empty" cells (0, 0%, 0.0%, -, or empty string)
        // Skip the first column (KPI name)
        if (colIndex > 1 && isEmptyValue(cell.value)) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.emptyGray } }
        }
      }

      // Add section separator after certain KPIs
      const separatorIndices = [2, 5, 10, 12, 19, 25]
      if (separatorIndices.includes(kpiIndex)) {
        const separatorRow = worksheet.addRow([''])
        separatorRow.height = 8 // Small height for visual separator

        // Merge all columns for the separator
        const totalCols = 1 + 4 + (filteredSalesmen.length * 5)
        worksheet.mergeCells(separatorRow.number, 1, separatorRow.number, totalCols)

        // Style the separator row with blue background
        const separatorCell = separatorRow.getCell(1)
        separatorCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.subHeaderBlue } }
        separatorCell.border = {} // No borders
      }
    })

    // Set column widths
    worksheet.getColumn(1).width = 35 // Description
    for (let i = 2; i <= 1 + 4 + (filteredSalesmen.length * 5); i++) {
      worksheet.getColumn(i).width = 12
    }

    // Generate Excel file and download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kpi-performance-matrix-${selectedDate}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  // Refresh all data
  const refreshAll = () => {
    refreshKPI()
    // Re-fetch salesmen data
    const event = new Event('refresh')
    window.dispatchEvent(event)
  }

  // If mobile, show blocking message
  if (isMobile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
        <div className="max-w-sm w-full">
          {/* Icon Circle */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-30 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-full p-6 shadow-2xl">
                <BarChart3 className="w-16 h-16 text-white" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-100">
            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
              Desktop Required
            </h2>

            {/* Description */}
            <p className="text-base text-gray-600 mb-6 text-center leading-relaxed">
              This page is not suitable for mobile devices. Please open it on a desktop, laptop, or larger screen for the best experience.
            </p>

            {/* Info Box */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-blue-900 text-center">
                📊 KPI Performance Matrix requires a minimum screen width of 1024px to display all data properly.
              </p>
            </div>

            {/* Requirements List */}
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Desktop/Laptop</p>
                  <p className="text-xs text-gray-500">Recommended for full experience</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Tablet (Landscape)</p>
                  <p className="text-xs text-gray-500">Rotate to landscape mode</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Mobile Phones</p>
                  <p className="text-xs text-gray-500">Not supported</p>
                </div>
              </div>
            </div>

            {/* Action Hint */}
            <div className="text-center pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Please switch to a larger device to continue
              </p>
            </div>
          </div>

          {/* Bottom Hint */}
          <p className="text-center text-xs text-gray-400 mt-4">
            This restriction ensures optimal data visualization
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-gray-50 relative">

      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">KPI Performance Matrix</h1>
              <p className="text-sm text-gray-500">Comprehensive performance tracking across all KPIs</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={refreshAll}
              disabled={loading || kpiLoading}
              className="flex items-center gap-2"
              variant="outline"
            >
              <RefreshCw className={`w-4 h-4 ${(loading || kpiLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={exportToExcel}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Enhanced Filter Controls - Using individual date filters instead of predefined ranges */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-100">

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>


          {/* Route Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <Select value={selectedRoute} onValueChange={handleRouteChange}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Route" />
              </SelectTrigger>
              <SelectContent className="max-h-64 overflow-y-auto">
                <SelectItem value="all">All Routes</SelectItem>
                {availableRoutes.map((route, index) => (
                  <SelectItem key={`route-${route.route_code}-${index}`} value={route.route_code}>
                    {route.route_name || route.route_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Salesman Filter - 2x wider as requested */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <Select value={selectedSalesman} onValueChange={setSelectedSalesman}>
              <SelectTrigger className="w-96">
                <SelectValue placeholder="Select salesman" />
              </SelectTrigger>
              <SelectContent className="max-h-64 overflow-y-auto">
                <SelectItem value="all">All Salesmen</SelectItem>
                {/* Show ALL salesmen in dropdown, not filtered ones! */}
                {salesmen.map((salesman, index) => (
                  <SelectItem key={`salesman-${salesman.code}-${index}`} value={salesman.code}>
                    <div className="flex items-center gap-2">
                      <span>{salesman.name} ({salesman.code})</span>
                      {salesman.hasTargets && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800">
                          Has Target
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Availability Counters */}
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              {availableRoutes.length} Routes Today
            </Badge>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              {filteredSalesmen.length} Salesmen Selected
            </Badge>
            <Badge variant="outline" className="text-xs">
              {KPI_NAMES.length} KPIs
            </Badge>
          </div>
        </div>
      </div>


      {/* Loading State */}
      {(loading || kpiLoading) && (
        <div className="flex items-center justify-center h-64 bg-white mx-6 mt-6 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-lg text-gray-600">Loading KPI performance data...</span>
          </div>
        </div>
      )}

      {/* Excel-style Table */}
      {!loading && !kpiLoading && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden relative mx-6 mt-6">
          <div
            ref={containerRef}
            className="overflow-auto"
            style={{
              maxHeight: 'calc(100vh - 300px)',
              width: '100%',
              overflowX: 'auto',
              overflowY: 'auto'
            }}
          >
            <table
              ref={tableRef}
              className="w-full border-collapse text-sm"
              style={{
                minWidth: '1200px',
                width: '100%'
              }}
            >
              <thead className="sticky top-0 bg-gray-100 z-10">
                {/* Main Headers Row */}
                <tr>
                  <th rowSpan={3} className="border border-gray-300 px-3 py-3 text-center font-semibold bg-gray-100 sticky left-0 z-20 min-w-[50px]">
                    #
                  </th>
                  <th rowSpan={3} className="border border-gray-300 px-4 py-3 text-left font-semibold bg-gray-100 sticky left-[50px] z-20 min-w-[300px]">
                    KPI Description
                  </th>

                  {/* Show Total Performance ONLY when viewing all salesmen (no filter active) */}
                  {!isFilterActive && (
                    <th colSpan={4} className="border border-gray-300 px-4 py-3 text-center font-semibold bg-yellow-100 min-w-[240px]">
                      <div className="flex items-center justify-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        TOTAL PERFORMANCE
                      </div>
                    </th>
                  )}

                  {/* Show individual salesman columns - always when filtered, always when showing all */}
                  {filteredSalesmen.map((salesman, index) => (
                    <th key={`header-salesman-${salesman.code}-${index}`} colSpan={5} className="border border-gray-300 px-4 py-3 text-center font-semibold bg-blue-100 min-w-[300px]">
                      <div className="flex flex-col items-center justify-center">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>{salesman.name}</span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Code: {salesman.code} | Route: {salesman.routeCode || 'N/A'}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>

                {/* Period Headers Row */}
                <tr>
                  {/* Total Performance period headers - only when no filter */}
                  {!isFilterActive && (
                    <>
                      <th colSpan={2} className="border border-gray-300 px-2 py-2 text-center font-medium text-sm bg-yellow-50">Day</th>
                      <th colSpan={2} className="border border-gray-300 px-2 py-2 text-center font-medium text-sm bg-yellow-50">MTD</th>
                    </>
                  )}

                  {/* Individual salesman period headers - always show */}
                  {filteredSalesmen.map((salesman, index) => (
                    <React.Fragment key={`periods-${salesman.code}-${index}`}>
                      <th colSpan={2} className="border border-gray-300 px-2 py-2 text-center font-medium text-sm bg-blue-50">Day</th>
                      <th colSpan={2} className="border border-gray-300 px-2 py-2 text-center font-medium text-sm bg-blue-50">MTD</th>
                      <th className="border border-gray-300 px-2 py-2 text-center font-medium text-sm bg-blue-50">Average %</th>
                    </React.Fragment>
                  ))}
                </tr>

                {/* Target/Achievement Headers Row */}
                <tr>
                  {/* Total Performance target/ach headers - only when no filter */}
                  {!isFilterActive && (
                    <>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-medium text-gray-700 bg-yellow-50">Target</th>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-medium text-gray-700 bg-yellow-50">Ach</th>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-medium text-gray-700 bg-yellow-50">Target</th>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-medium text-gray-700 bg-yellow-50">Ach</th>
                    </>
                  )}

                  {/* Individual salesman target/ach headers - always show */}
                  {filteredSalesmen.map((salesman, index) => (
                    <React.Fragment key={`headers-${salesman.code}-${index}`}>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-medium text-gray-700 bg-blue-50">Target</th>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-medium text-gray-700 bg-blue-50">Ach</th>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-medium text-gray-700 bg-blue-50">Target</th>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-medium text-gray-700 bg-blue-50">Ach</th>
                      <th className="border border-gray-300 px-2 py-2 text-center text-xs font-medium text-gray-700 bg-blue-50">%</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>

                {/* KPI Rows */}
                {KPI_NAMES.map((kpiName, rowIndex) => {
                  const data = totalRowData[kpiName] || {
                    dayTarget: 0,
                    dayAchievement: 0,
                    mtdTarget: 0,
                    mtdAchievement: 0,
                    avgPercentage: 0
                  }

                  return (
                    <React.Fragment key={kpiName}>
                      <tr
                        className="hover:bg-gray-50 transition-colors duration-150"
                      >
                      <td
                        className="border border-gray-300 px-3 py-3 text-center text-gray-500 bg-gray-50 sticky left-0 z-10"
                        onClick={(e) => handleCellClick(rowIndex, 0, e)}
                      >
                        {rowIndex + 1}
                      </td>
                      <td
                        className="border border-gray-300 px-4 py-3 font-medium bg-gray-50 sticky left-[50px] z-10 cursor-pointer hover:bg-gray-100"
                        onClick={(e) => handleCellClick(rowIndex, 1, e)}
                      >
                        <span>{kpiName}</span>
                      </td>


                      {/* TOTAL PERFORMANCE columns - Only show when viewing all salesmen (no filter) */}
                      {!isFilterActive && (
                        <>
                          <td
                            className={`border border-gray-300 px-4 py-3 text-center cursor-pointer hover:bg-blue-50 ${getCellStatus(data.dayTarget)} ${selectedCells.has(`${rowIndex}-2`) ? 'ring-2 ring-blue-400' : ''}`}
                            onClick={(e) => handleCellClick(rowIndex, 2, e)}
                          >
                            {formatCellValue(
                              data.dayTarget,
                              kpiName.toLowerCase().includes('sales') || kpiName.includes('Drop Size') || kpiName.includes('Collection') ? 'currency' :
                              kpiName.includes('Invoice Time') || kpiName.includes('Customer Service') ? 'time' :
                              kpiName.includes('%') || kpiName.includes('Ach %') ? 'percentage' : 'number'
                            )}
                          </td>

                          <td
                            className={`border border-gray-300 px-4 py-3 text-center cursor-pointer hover:bg-blue-50 ${getCellStatus(data.dayAchievement)} ${selectedCells.has(`${rowIndex}-3`) ? 'ring-2 ring-blue-400' : ''}`}
                            onClick={(e) => handleCellClick(rowIndex, 3, e)}
                          >
                            {formatCellValue(
                              data.dayAchievement,
                              kpiName.includes('Cont') || kpiName.includes('%') || kpiName.includes('Productive %') || kpiName.includes('Ach %') || kpiName.includes('Adherance') ? 'percentage' :
                              kpiName.toLowerCase().includes('sales') || kpiName.includes('Drop Size') || kpiName.includes('Collection') ? 'currency' :
                              kpiName.includes('Invoice Time') || kpiName.includes('Customer Service') ? 'time' : 'number'
                            )}
                          </td>

                          <td
                            className={`border border-gray-300 px-4 py-3 text-center cursor-pointer hover:bg-blue-50 ${getCellStatus(data.mtdTarget)} ${selectedCells.has(`${rowIndex}-4`) ? 'ring-2 ring-blue-400' : ''}`}
                            onClick={(e) => handleCellClick(rowIndex, 4, e)}
                          >
                            {formatCellValue(
                              data.mtdTarget,
                              kpiName.toLowerCase().includes('sales') || kpiName.includes('Drop Size') || kpiName.includes('Collection') || kpiName === 'Ach % V/s LY' ? 'currency' :
                              kpiName.includes('Invoice Time') || kpiName.includes('Customer Service') ? 'time' :
                              kpiName.includes('%') || kpiName.includes('Ach %') ? 'percentage' : 'number'
                            )}
                          </td>

                          <td
                            className={`border border-gray-300 px-4 py-3 text-center cursor-pointer hover:bg-blue-50 ${getCellStatus(data.mtdAchievement)} ${selectedCells.has(`${rowIndex}-5`) ? 'ring-2 ring-blue-400' : ''}`}
                            onClick={(e) => handleCellClick(rowIndex, 5, e)}
                          >
                            {formatCellValue(
                              data.mtdAchievement,
                              kpiName.includes('Cont') || kpiName.includes('%') || kpiName.includes('Productive %') || kpiName.includes('Ach %') || kpiName.includes('Adherance') || kpiName === 'Ach % V/s LY' ? 'percentage' :
                              kpiName.toLowerCase().includes('sales') || kpiName.includes('Drop Size') || kpiName.includes('Collection') ? 'currency' :
                              kpiName.includes('Invoice Time') || kpiName.includes('Customer Service') ? 'time' : 'number'
                            )}
                          </td>
                        </>
                      )}

                      {/* Individual Salesman columns - Always show (both when filtered and when showing all) */}
                      {filteredSalesmen.map((salesman, salesmanIndex) => {
                        const salesmanData = salesman.kpiData[kpiName] || {
                          dayTarget: 0,
                          dayAchievement: 0,
                          mtdTarget: 0,
                          mtdAchievement: 0,
                          avgPercentage: 0
                        }

                        const baseColIndex = 6 + (salesmanIndex * 5) // Start after total columns (0-5)

                        return (
                          <React.Fragment key={`kpi-${salesman.code}-${kpiName}-${salesmanIndex}`}>
                            {/* Day Target */}
                            <td
                              className={`border border-gray-300 px-4 py-3 text-center cursor-pointer hover:bg-blue-50 ${getCellStatus(salesmanData.dayTarget, salesmanData.isEmpty)} ${selectedCells.has(`${rowIndex}-${baseColIndex}`) ? 'ring-2 ring-blue-400' : ''}`}
                              onClick={(e) => handleCellClick(rowIndex, baseColIndex, e)}
                            >
                              {formatCellValue(
                          salesmanData.dayTarget,
                          kpiName.toLowerCase().includes('sales') || kpiName.includes('Drop Size') || kpiName.includes('Collection') ? 'currency' :
                          kpiName.includes('Invoice Time') || kpiName.includes('Customer Service') ? 'time' :
                          kpiName.includes('%') || kpiName.includes('Ach %') ? 'percentage' : 'number',
                          salesmanData.isEmpty
                        )}
                            </td>

                            {/* Day Achievement */}
                            <td
                              className={`border border-gray-300 px-4 py-3 text-center cursor-pointer hover:bg-blue-50 ${getCellStatus(salesmanData.dayAchievement, salesmanData.isEmpty)} ${selectedCells.has(`${rowIndex}-${baseColIndex + 1}`) ? 'ring-2 ring-blue-400' : ''}`}
                              onClick={(e) => handleCellClick(rowIndex, baseColIndex + 1, e)}
                            >
                              {formatCellValue(
                          salesmanData.dayAchievement,
                          kpiName.includes('Cont') || kpiName.includes('%') || kpiName.includes('Productive %') || kpiName.includes('Ach %') || kpiName.includes('Adherance') ? 'percentage' :
                          kpiName.toLowerCase().includes('sales') || kpiName.includes('Drop Size') || kpiName.includes('Collection') ? 'currency' :
                          kpiName.includes('Invoice Time') || kpiName.includes('Customer Service') ? 'time' : 'number',
                          salesmanData.isEmpty
                        )}
                            </td>

                            {/* MTD Target */}
                            <td
                              className={`border border-gray-300 px-4 py-3 text-center cursor-pointer hover:bg-blue-50 ${getCellStatus(salesmanData.mtdTarget, salesmanData.isEmpty)} ${selectedCells.has(`${rowIndex}-${baseColIndex + 2}`) ? 'ring-2 ring-blue-400' : ''}`}
                              onClick={(e) => handleCellClick(rowIndex, baseColIndex + 2, e)}
                            >
                              {formatCellValue(
                          salesmanData.mtdTarget,
                          kpiName.toLowerCase().includes('sales') || kpiName.includes('Drop Size') || kpiName.includes('Collection') ? 'currency' :
                          kpiName.includes('Invoice Time') || kpiName.includes('Customer Service') ? 'time' :
                          kpiName.includes('%') || kpiName.includes('Ach %') ? 'percentage' : 'number',
                          salesmanData.isEmpty
                        )}
                            </td>

                            {/* MTD Achievement */}
                            <td
                              className={`border border-gray-300 px-4 py-3 text-center cursor-pointer hover:bg-blue-50 ${getCellStatus(salesmanData.mtdAchievement, salesmanData.isEmpty)} ${selectedCells.has(`${rowIndex}-${baseColIndex + 3}`) ? 'ring-2 ring-blue-400' : ''}`}
                              onClick={(e) => handleCellClick(rowIndex, baseColIndex + 3, e)}
                            >
                              {formatCellValue(
                          salesmanData.mtdAchievement,
                          kpiName.includes('Cont') || kpiName.includes('%') || kpiName.includes('Productive %') || kpiName.includes('Ach %') || kpiName.includes('Adherance') ? 'percentage' :
                          kpiName.toLowerCase().includes('sales') || kpiName.includes('Drop Size') || kpiName.includes('Collection') ? 'currency' :
                          kpiName.includes('Invoice Time') || kpiName.includes('Customer Service') ? 'time' : 'number',
                          salesmanData.isEmpty
                        )}
                            </td>

                            {/* Average % */}
                            <td
                              className={`border border-gray-300 px-4 py-3 text-center font-semibold cursor-pointer hover:bg-blue-50 ${getCellStatus(salesmanData.avgPercentage || 0, salesmanData.isEmpty)} ${selectedCells.has(`${rowIndex}-${baseColIndex + 4}`) ? 'ring-2 ring-blue-400' : ''}`}
                              onClick={(e) => handleCellClick(rowIndex, baseColIndex + 4, e)}
                            >
                              {formatCellValue(salesmanData.avgPercentage || 0, 'percentage', salesmanData.isEmpty)}
                            </td>
                          </React.Fragment>
                        )
                      })}
                      </tr>

                      {/* Section Separator - Blue empty row for visual grouping */}
                      {shouldAddSeparator(rowIndex) && (
                        <tr className="h-2">
                          <td colSpan={isFilterActive ? 2 + (filteredSalesmen.length * 5) : 2 + 4 + (filteredSalesmen.length * 5)} className="bg-blue-100 border-none p-0"></td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
            <div className="text-xs text-gray-500 text-center">
              Use Ctrl+Click for multi-select | Arrow keys for navigation
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExcelSheet