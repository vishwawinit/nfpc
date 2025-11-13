import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { businessColors } from '@/styles/businessColors'

interface WaterfallData {
  name: string
  value: number
  isTotal?: boolean
}

interface WaterfallChartProps {
  data: WaterfallData[]
  height?: number
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({ 
  data,
  height = 400 
}) => {
  const chartData = useMemo(() => {
    let cumulative = 0
    const result = []

    for (let i = 0; i < data.length; i++) {
      const item = data[i]
      
      if (item.isTotal) {
        // Total bar starts from 0
        result.push({
          name: item.name,
          value: item.value,
          start: 0,
          color: businessColors.primary[600],
          isTotal: true
        })
        cumulative = item.value
      } else {
        // Regular bar
        const isPositive = item.value >= 0
        result.push({
          name: item.name,
          value: Math.abs(item.value),
          start: isPositive ? cumulative : cumulative + item.value,
          color: isPositive ? businessColors.success.main : businessColors.error.main,
          isTotal: false,
          rawValue: item.value
        })
        cumulative += item.value
      }
    }

    return result
  }, [data])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm">
            {data.isTotal ? 'Total: ' : data.rawValue >= 0 ? 'Increase: +' : 'Decrease: '}
            {data.isTotal ? data.value.toLocaleString() : Math.abs(data.rawValue).toLocaleString()}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
        <YAxis />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        
        {/* Invisible bar for positioning */}
        <Bar dataKey="start" stackId="a" fill="transparent" />
        
        {/* Visible bar */}
        <Bar dataKey="value" stackId="a" name="Value">
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
