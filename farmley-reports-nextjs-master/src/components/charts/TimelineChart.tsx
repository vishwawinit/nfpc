import React from 'react'

interface TimelineEvent {
  date: string
  category: string
  label: string
  details?: string
}

interface TimelineChartProps {
  data: TimelineEvent[]
  height?: number
  colorMap?: Record<string, string>
}

export function TimelineChart({ data, height = 300, colorMap }: TimelineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-gray-500">No timeline data available</p>
      </div>
    )
  }

  // Get unique categories for Y-axis
  const categories = Array.from(new Set(data.map(d => d.category)))
  
  // Get date range for X-axis
  const dates = data.map(d => new Date(d.date).getTime())
  const minDate = Math.min(...dates)
  const maxDate = Math.max(...dates)
  const dateRange = maxDate - minDate || 1

  const rowHeight = height / (categories.length + 1)
  const padding = { left: 150, right: 40, top: 30, bottom: 50 }
  const chartWidth = 800
  const chartHeight = height - padding.top - padding.bottom

  const getX = (date: string) => {
    const timestamp = new Date(date).getTime()
    const position = ((timestamp - minDate) / dateRange) * (chartWidth - padding.left - padding.right)
    return padding.left + position
  }

  const getY = (category: string) => {
    const index = categories.indexOf(category)
    return padding.top + (index + 0.5) * rowHeight
  }

  const defaultColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ]

  const getColor = (category: string, index: number) => {
    if (colorMap && colorMap[category]) return colorMap[category]
    return defaultColors[index % defaultColors.length]
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
      {/* Grid lines */}
      {categories.map((cat, i) => (
        <line
          key={`grid-${i}`}
          x1={padding.left}
          y1={getY(cat)}
          x2={chartWidth - padding.right}
          y2={getY(cat)}
          stroke="#e5e7eb"
          strokeWidth="1"
          strokeDasharray="3,3"
        />
      ))}

      {/* Y-axis labels */}
      {categories.map((cat, i) => (
        <text
          key={`label-${i}`}
          x={padding.left - 10}
          y={getY(cat) + 5}
          textAnchor="end"
          fontSize="12"
          fill="#374151"
        >
          {cat.length > 20 ? cat.substring(0, 18) + '...' : cat}
        </text>
      ))}

      {/* Timeline events */}
      {data.map((event, i) => {
        const x = getX(event.date)
        const y = getY(event.category)
        const color = getColor(event.category, categories.indexOf(event.category))

        return (
          <g key={`event-${i}`}>
            <circle
              cx={x}
              cy={y}
              r="6"
              fill={color}
              stroke="white"
              strokeWidth="2"
            />
            <title>{`${event.label}\n${event.date}\n${event.details || ''}`}</title>
          </g>
        )
      })}

      {/* X-axis */}
      <line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={chartWidth - padding.right}
        y2={height - padding.bottom}
        stroke="#9ca3af"
        strokeWidth="2"
      />

      {/* X-axis labels (dates) */}
      {[0, 0.25, 0.5, 0.75, 1].map((position, i) => {
        const timestamp = minDate + dateRange * position
        const date = new Date(timestamp)
        const x = padding.left + position * (chartWidth - padding.left - padding.right)
        return (
          <text
            key={`date-${i}`}
            x={x}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fontSize="11"
            fill="#6b7280"
          >
            {date.toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </text>
        )
      })}

      {/* Title */}
      <text
        x={chartWidth / 2}
        y={20}
        textAnchor="middle"
        fontSize="14"
        fontWeight="600"
        fill="#111827"
      >
        Timeline View
      </text>
    </svg>
  )
}
