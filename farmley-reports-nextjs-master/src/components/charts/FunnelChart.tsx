import React from 'react'
import { businessColors } from '@/styles/businessColors'

interface FunnelStage {
  name: string
  value: number
  color?: string
}

interface FunnelChartProps {
  data: FunnelStage[]
  showPercentage?: boolean
  showConversion?: boolean
}

export const FunnelChart: React.FC<FunnelChartProps> = ({
  data,
  showPercentage = true,
  showConversion = true
}) => {
  const maxValue = Math.max(...data.map(d => d.value), 1)
  const colors = businessColors.charts.secondary

  return (
    <div className="flex flex-col items-center py-4">
      {data.map((stage, index) => {
        const widthPercent = (stage.value / maxValue) * 100
        const color = stage.color || colors[index % colors.length]
        const conversionRate = index > 0 ? (stage.value / data[index - 1].value) * 100 : 100
        const overallPercent = (stage.value / data[0].value) * 100

        return (
          <div key={index} className="w-full mb-2">
            {/* Funnel Stage */}
            <div className="flex justify-center">
              <div
                style={{
                  width: `${widthPercent}%`,
                  minWidth: '150px',
                  backgroundColor: color,
                  clipPath: index === data.length - 1 
                    ? 'none'
                    : 'polygon(5% 0%, 95% 0%, 90% 100%, 10% 100%)'
                }}
                className="relative py-4 px-4 text-white transition-all hover:opacity-90 cursor-pointer"
              >
                <div className="text-center">
                  <div className="font-semibold text-sm">{stage.name}</div>
                  <div className="text-lg font-bold mt-1">
                    {stage.value.toLocaleString()}
                  </div>
                  {showPercentage && (
                    <div className="text-xs opacity-90 mt-1">
                      {overallPercent.toFixed(1)}% of total
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Conversion Arrow */}
            {showConversion && index < data.length - 1 && (
              <div className="flex items-center justify-center my-1">
                <div className="text-xs text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  ↓ {conversionRate.toFixed(1)}% conversion
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
