import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts'
import { SalesTrendData } from '@/types'
import { formatCurrency, formatNumber, formatDateShort } from '@/lib/utils'

interface SalesChartProps {
  data: SalesTrendData[]
  loading?: boolean
  chartType?: 'line' | 'bar' | 'area' | 'composed'
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium">{formatDateShort(label)}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {
              entry.dataKey === 'sales'
                ? formatCurrency(entry.value)
                : formatNumber(entry.value)
            }
          </p>
        ))}
      </div>
    )
  }
  return null
}

export const SalesChart: React.FC<SalesChartProps> = ({
  data,
  loading = false,
  chartType = 'composed'
}) => {
  const [timeRange, setTimeRange] = React.useState<'7d' | '30d' | '90d'>('30d')

  const filteredData = React.useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    return data.slice(-days)
  }, [data, timeRange])

  const chartColors = {
    sales: '#3b82f6',
    orders: '#10b981',
    customers: '#f59e0b',
    returns: '#ef4444'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Trend</CardTitle>
          <CardDescription>Daily sales performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] bg-gray-200 animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  const renderChart = () => {
    const commonProps = {
      data: filteredData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    }

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDateShort(value)}
              tick={{ fontSize: 14 }}
              height={50}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(value) => `AED ${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 14 }}
              width={80}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 14 }}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} iconSize={14} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="sales"
              stroke={chartColors.sales}
              strokeWidth={2}
              dot={false}
              name="Sales"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="orders"
              stroke={chartColors.orders}
              strokeWidth={2}
              dot={false}
              name="Orders"
            />
          </LineChart>
        )

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDateShort(value)}
              tick={{ fontSize: 14 }}
              height={50}
            />
            <YAxis
              tickFormatter={(value) => `AED ${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 14 }}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} iconSize={14} />
            <Bar
              dataKey="sales"
              fill={chartColors.sales}
              name="Sales"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        )

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDateShort(value)}
              tick={{ fontSize: 14 }}
              height={50}
            />
            <YAxis
              tickFormatter={(value) => `AED ${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 14 }}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} iconSize={14} />
            <Area
              type="monotone"
              dataKey="sales"
              stroke={chartColors.sales}
              fill={chartColors.sales}
              fillOpacity={0.3}
              strokeWidth={2}
              name="Sales"
            />
          </AreaChart>
        )

      case 'composed':
      default:
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDateShort(value)}
              tick={{ fontSize: 14 }}
              height={50}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(value) => `AED ${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 14 }}
              width={80}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 14 }}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} iconSize={14} />
            <Bar
              yAxisId="left"
              dataKey="sales"
              fill={chartColors.sales}
              name="Sales"
              radius={[4, 4, 0, 0]}
              fillOpacity={0.8}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="orders"
              stroke={chartColors.orders}
              strokeWidth={2}
              dot={false}
              name="Orders"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="customers"
              stroke={chartColors.customers}
              strokeWidth={2}
              dot={false}
              name="Customers"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="returns"
              stroke={chartColors.returns}
              strokeWidth={2}
              dot={false}
              name="Returns"
            />
          </ComposedChart>
        )
    }
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg">Sales Trend</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Daily sales, orders, customers, and returns</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={timeRange === '7d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('7d')}
              className="text-xs sm:text-sm"
            >
              7D
            </Button>
            <Button
              variant={timeRange === '30d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('30d')}
              className="text-xs sm:text-sm"
            >
              30D
            </Button>
            <Button
              variant={timeRange === '90d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('90d')}
              className="text-xs sm:text-sm"
            >
              90D
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
        <ResponsiveContainer width="100%" height={300} className="sm:h-[350px]">
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}