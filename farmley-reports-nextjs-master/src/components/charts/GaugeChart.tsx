import React from 'react'
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts'
import { businessColors } from '@/styles/businessColors'

interface GaugeChartProps {
  value: number // 0-100
  maxValue?: number
  title?: string
  zones?: {
    min: number
    max: number
    color: string
    label: string
  }[]
}

export const GaugeChart: React.FC<GaugeChartProps> = ({ 
  value, 
  maxValue = 100,
  title,
  zones = [
    { min: 0, max: 40, color: businessColors.error.main, label: 'Poor' },
    { min: 40, max: 70, color: businessColors.warning.main, label: 'Average' },
    { min: 70, max: 100, color: businessColors.success.main, label: 'Good' }
  ]
}) => {
  // Determine color based on zones
  const getColor = (val: number) => {
    const zone = zones.find(z => val >= z.min && val <= z.max)
    return zone?.color || businessColors.primary[500]
  }

  const getLabel = (val: number) => {
    const zone = zones.find(z => val >= z.min && val <= z.max)
    return zone?.label || ''
  }

  const color = getColor(value)
  const label = getLabel(value)
  
  const data = [
    {
      name: 'Value',
      value: value,
      fill: color
    }
  ]

  return (
    <div className="flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height={200}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="90%"
          barSize={20}
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, maxValue]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background
            dataKey="value"
            cornerRadius={10}
            fill={color}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="text-center mt-2">
        <div className="text-3xl font-bold" style={{ color }}>
          {value.toFixed(1)}%
        </div>
        {label && (
          <div className="text-sm text-gray-600 mt-1">{label}</div>
        )}
        {title && (
          <div className="text-xs text-gray-500 mt-1">{title}</div>
        )}
      </div>
    </div>
  )
}
