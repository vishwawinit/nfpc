import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Users, ShoppingCart, DollarSign, Target, RefreshCw, HelpCircle, Package } from 'lucide-react'
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils'
import { useDashboardKPI } from '@/hooks/useDataService'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  subtitle?: string
  loading?: boolean
  helpText?: string
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, icon, subtitle, loading, helpText }) => {
  const isPositive = change && change > 0

  return (
    <Card>
      <CardHeader className="pb-2 p-3 md:p-4">
        <div className="grid grid-cols-[1fr_24px] items-start gap-2 w-full">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight truncate">
              {title}
            </CardTitle>
            {helpText && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-gray-400 cursor-help flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">{helpText}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center justify-end text-gray-500 justify-self-end pr-1">
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-4 pt-0 md:pt-0">
        {loading ? (
          <div className="space-y-2">
            <div className="h-6 md:h-7 bg-gray-200 animate-pulse rounded" />
            <div className="h-3 md:h-4 bg-gray-200 animate-pulse rounded w-1/2" />
          </div>
        ) : (
          <>
            <div className="text-xl sm:text-2xl font-bold break-words">{value}</div>
            {change !== undefined && (
              <div className={`flex items-center text-xs mt-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                <span>{isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}% <span className="hidden sm:inline">{subtitle ? subtitle : ''}</span></span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface DynamicKPICardsProps {
  showRefreshButton?: boolean
  onError?: (error: string) => void
  dateRange?: string
  additionalParams?: URLSearchParams
}

export const DynamicKPICards: React.FC<DynamicKPICardsProps> = ({
  showRefreshButton = false,
  onError,
  dateRange = 'thisMonth',
  additionalParams
}) => {
  // Memoize params to prevent unnecessary re-renders
  const params = useMemo(() => {
    return additionalParams || new URLSearchParams()
  }, [additionalParams])
  
  const { data, loading, error, refresh } = useDashboardKPI(dateRange, {
    onError,
    additionalParams: params
  })

  // Get dynamic title and comparison text based on date range
  const getTitleAndComparison = (metric: string) => {
    switch(dateRange) {
      case 'today':
        return { title: `Today's ${metric}`, comparison: 'from yesterday' }
      case 'yesterday':
        return { title: `Yesterday's ${metric}`, comparison: 'from day before' }
      case 'thisWeek':
        return { title: `This Week's ${metric}`, comparison: 'from last week' }
      case 'lastWeek':
        return { title: `Last Week's ${metric}`, comparison: 'from previous week' }
      case 'last30Days':
        return { title: `Last 30 Days ${metric}`, comparison: 'from previous period' }
      case 'thisMonth':
        return { title: `This Month's ${metric}`, comparison: 'from last month' }
      case 'lastMonth':
        return { title: `Last Month's ${metric}`, comparison: 'from previous month' }
      case 'thisQuarter':
        return { title: `This Quarter's ${metric}`, comparison: 'from last quarter' }
      case 'thisYear':
        return { title: `This Year's ${metric}`, comparison: 'from last year' }
      default:
        return { title: metric, comparison: 'from previous period' }
    }
  }

  const handleRefresh = () => {
    refresh()
  }

  // Show error state
  if (error && !data) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="text-red-500 mb-2">Failed to load KPI data</div>
          <div className="text-sm text-gray-500 mb-4">{error}</div>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Default values for loading state or missing data
  const kpiData = data || {
    currentSales: 0,
    currentTotalSales: 0,
    currentOrders: 0,
    currentCustomers: 0,
    currentUnits: 0,
    averageOrderValue: 0,
    salesChange: 0,
    ordersChange: 0,
    customersChange: 0,
    unitsChange: 0,
    avgOrderChange: 0,
    currencyCode: 'INR',
    currencySymbol: 'AED',
    // Fallbacks for backward compatibility
    todaySales: 0,
    todayOrders: 0,
    todayCustomers: 0,
    todayUnits: 0,
    growthPercentage: 0
  }

  // Get currency symbol from API data
  const currencySymbol = kpiData.currencySymbol || 'AED'
  const currencyCode = kpiData.currencyCode || 'INR'

  // Format currency to match reference site format like ₹ 1,25,420
  const formatReferenceStyle = (value: number): string => {
    if (value === 0) return `${currencySymbol} 0`
    const formatted = Math.floor(value).toLocaleString('en-IN')
    return `${currencySymbol} ${formatted}`
  }

  const salesInfo = getTitleAndComparison('Sales')
  const ordersInfo = getTitleAndComparison('Orders')
  const customersInfo = getTitleAndComparison('Customers')
  const unitsInfo = getTitleAndComparison('Units Sold')
  const avgOrderInfo = { title: 'Avg Order Value', comparison: getTitleAndComparison('').comparison }
  const salesValue = kpiData.currentTotalSales ?? kpiData.currentSales ?? kpiData.todaySales ?? 0

  const kpiCards = [
    {
      title: salesInfo.title,
      value: formatReferenceStyle(salesValue),
      change: kpiData.salesChange || kpiData.growthPercentage,
      icon: <DollarSign className="h-4 w-4" />,
      subtitle: salesInfo.comparison,
      helpText: 'Total sales revenue for the selected period. This represents all successful transactions.'
    },
    {
      title: unitsInfo.title,
      value: formatNumber(kpiData.currentUnits || kpiData.todayUnits || 0),
      change: kpiData.unitsChange,
      icon: <Package className="h-4 w-4" />,
      subtitle: unitsInfo.comparison,
      helpText: 'Total quantity of products sold in the selected period. This is the sum of all units across all orders and products.'
    },
    {
      title: ordersInfo.title,
      value: formatNumber(kpiData.currentOrders || kpiData.todayOrders),
      change: kpiData.ordersChange,
      icon: <ShoppingCart className="h-4 w-4" />,
      subtitle: ordersInfo.comparison,
      helpText: 'Total number of orders placed in the selected period. Each transaction is counted as one order.'
    },
    {
      title: avgOrderInfo.title,
      value: formatReferenceStyle(kpiData.averageOrderValue),
      change: kpiData.avgOrderChange,
      icon: <Target className="h-4 w-4" />,
      subtitle: avgOrderInfo.comparison,
      helpText: 'Average revenue per order. Calculated as Total Sales divided by Total Orders. Shows how much revenue each order generates on average.'
    },
    {
      title: customersInfo.title,
      value: formatNumber(kpiData.currentCustomers || kpiData.todayCustomers),
      change: kpiData.customersChange,
      icon: <Users className="h-4 w-4" />,
      subtitle: customersInfo.comparison,
      helpText: 'Count of unique customers who made purchases in this period. Each customer is counted once regardless of the number of orders they placed.'
    }
  ]

  return (
    <TooltipProvider>
      <div className="space-y-3 md:space-y-4">
        {showRefreshButton && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
          <h2 className="text-base sm:text-lg font-semibold">Key Performance Indicators</h2>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-xs sm:text-sm">Refresh Data</span>
          </Button>
        </div>
      )}

      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {/* Sales Card */}
        <KPICard
          title={salesInfo.title}
          value={formatReferenceStyle(salesValue)}
          change={kpiData.salesChange || kpiData.growthPercentage}
          icon={<DollarSign className="h-4 w-4" />}
          subtitle={salesInfo.comparison}
          loading={loading}
          helpText="Total sales revenue for the selected period. This represents all successful transactions."
        />

        {/* Units Sold Card */}
        <KPICard
          title={unitsInfo.title}
          value={formatNumber(kpiData.currentUnits || kpiData.todayUnits || 0)}
          change={kpiData.unitsChange}
          icon={<Package className="h-4 w-4" />}
          subtitle={unitsInfo.comparison}
          loading={loading}
          helpText="Total quantity of products sold in the selected period. This is the sum of all units across all orders and products."
        />

        {/* Other KPI Cards */}
        {kpiCards.slice(2).map((kpi, index) => (
          <KPICard
            key={index + 2}
            title={kpi.title}
            value={kpi.value}
            change={kpi.change}
            icon={kpi.icon}
            subtitle={kpi.subtitle}
            loading={loading}
            helpText={kpi.helpText}
          />
        ))}
      </div>

      </div>
    </TooltipProvider>
  )
}

// Legacy wrapper for backward compatibility
export const KPICards: React.FC<{ loading?: boolean }> = ({ loading: legacyLoading }) => {
  return <DynamicKPICards showRefreshButton={false} />
}