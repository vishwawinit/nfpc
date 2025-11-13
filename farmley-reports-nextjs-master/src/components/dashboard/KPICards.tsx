import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Users, ShoppingCart, DollarSign, Target } from 'lucide-react'
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils'
import { DashboardKPI } from '@/types'

interface KPICardsProps {
  data: DashboardKPI
  loading?: boolean
}

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  subtitle?: string
  loading?: boolean
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, icon, subtitle, loading }) => {
  const isPositive = change && change > 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-4">
        <CardTitle className="text-xs sm:text-sm font-medium">
          {title}
        </CardTitle>
        <div className="text-gray-500 flex-shrink-0">
          {icon}
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
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">
                {subtitle}
              </p>
            )}
            {change !== undefined && (
              <div className={`flex items-center text-xs mt-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? <TrendingUp className="h-3 w-3 mr-1 flex-shrink-0" /> : <TrendingDown className="h-3 w-3 mr-1 flex-shrink-0" />}
                <span>{formatPercentage(Math.abs(change))}</span>
                <span className="text-gray-500 ml-1 hidden sm:inline">from yesterday</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export const KPICards: React.FC<KPICardsProps> = ({ data, loading = false }) => {
  const kpiCards = [
    {
      title: "Today's Sales",
      value: formatCurrency(data.todaySales),
      change: data.growthPercentage,
      icon: <DollarSign className="h-4 w-4" />,
      subtitle: `${formatNumber(data.todayOrders)} orders`
    },
    {
      title: "Active Customers",
      value: formatNumber(data.todayCustomers),
      icon: <Users className="h-4 w-4" />,
      subtitle: "Visited today"
    },
    {
      title: "Average Order Value",
      value: formatCurrency(data.averageOrderValue),
      icon: <ShoppingCart className="h-4 w-4" />,
      subtitle: "Per transaction"
    },
    {
      title: "Conversion Rate",
      value: formatPercentage(data.conversionRate, 1),
      icon: <Target className="h-4 w-4" />,
      subtitle: "Productive visits"
    },
    {
      title: "MTD Sales",
      value: formatCurrency(data.mtdSales),
      icon: <DollarSign className="h-4 w-4" />,
      subtitle: "Month to date"
    },
    {
      title: "YTD Sales",
      value: formatCurrency(data.ytdSales),
      icon: <DollarSign className="h-4 w-4" />,
      subtitle: "Year to date"
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpiCards.map((kpi, index) => (
        <KPICard
          key={index}
          title={kpi.title}
          value={kpi.value}
          change={kpi.change}
          icon={kpi.icon}
          subtitle={kpi.subtitle}
          loading={loading}
        />
      ))}
    </div>
  )
}