import React from 'react'
import { businessColors } from '@/styles/businessColors'

interface BulletChartProps {
  title: string
  actual: number
  target: number
  lastYear?: number
  zones?: {
    threshold: number // as percentage of target
    color: string
    label: string
  }[]
}

export const BulletChart: React.FC<BulletChartProps> = ({
  title,
  actual,
  target,
  lastYear,
  zones = [
    { threshold: 80, color: businessColors.error.light, label: 'Poor' },
    { threshold: 100, color: businessColors.warning.light, label: 'Fair' },
    { threshold: 120, color: businessColors.success.light, label: 'Good' }
  ]
}) => {
  const maxValue = Math.max(actual, target, lastYear || 0) * 1.2
  const actualPercent = (actual / maxValue) * 100
  const targetPercent = (target / maxValue) * 100
  const lastYearPercent = lastYear ? (lastYear / maxValue) * 100 : 0
  const achievementPercent = (actual / target) * 100

  // Determine background color zones
  const getColor = () => {
    const sorted = [...zones].sort((a, b) => a.threshold - b.threshold)
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (achievementPercent >= sorted[i].threshold) {
        return sorted[i].color
      }
    }
    return sorted[0]?.color || businessColors.error.light
  }

  return (
    <div className="py-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className="text-sm font-medium text-gray-600">
          {achievementPercent.toFixed(1)}% achieved
        </span>
      </div>

      {/* Bullet chart visualization */}
      <div className="relative h-12 bg-gray-100 rounded">
        {/* Background zones */}
        <div className="absolute inset-0 flex">
          {zones.map((zone, idx) => {
            const prevThreshold = idx > 0 ? zones[idx - 1].threshold : 0
            const zoneWidth = ((zone.threshold - prevThreshold) / 120) * 100
            return (
              <div
                key={idx}
                style={{
                  width: `${zoneWidth}%`,
                  backgroundColor: zone.color
                }}
                className="h-full first:rounded-l last:rounded-r"
              />
            )
          })}
        </div>

        {/* Last year performance (if provided) */}
        {lastYear && (
          <div
            className="absolute top-0 h-full flex items-center"
            style={{ left: `${lastYearPercent}%` }}
          >
            <div className="w-0.5 h-8 bg-gray-400" title={`Last Year: ${lastYear.toLocaleString()}`} />
          </div>
        )}

        {/* Target marker */}
        <div
          className="absolute top-0 h-full flex items-center"
          style={{ left: `${targetPercent}%` }}
        >
          <div className="w-1 h-full bg-gray-700" title={`Target: ${target.toLocaleString()}`} />
        </div>

        {/* Actual bar */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-6 rounded"
          style={{
            width: `${actualPercent}%`,
            backgroundColor: businessColors.primary[600]
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex justify-between items-center mt-2 text-xs text-gray-600">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: businessColors.primary[600] }} />
            <span>Actual: {actual.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-4 bg-gray-700" />
            <span>Target: {target.toLocaleString()}</span>
          </div>
          {lastYear && (
            <div className="flex items-center gap-1">
              <div className="w-0.5 h-4 bg-gray-400" />
              <span>Last Year: {lastYear.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
