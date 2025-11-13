'use client'

import React, { ReactNode } from 'react'
import { HelpCircle, Download, Maximize2, Minimize2, TrendingUp, Info } from 'lucide-react'
import { businessColors } from '@/styles/businessColors'

interface ChartWrapperProps {
  title: string
  subtitle?: string
  children: ReactNode
  height?: number | string
  tooltip?: {
    title: string
    description: string
    interpretation?: string
  }
  legend?: {
    items: {
      label: string
      color: string
      value?: string | number
    }[]
    position?: 'top' | 'bottom' | 'right'
  }
  actions?: ReactNode
  fullscreenable?: boolean
  exportable?: boolean
  onExport?: () => void
  className?: string
  loading?: boolean
  error?: string
  insight?: {
    text: string
    type: 'positive' | 'negative' | 'neutral'
  }
}

export function ChartWrapper({
  title,
  subtitle,
  children,
  height = 300,
  tooltip,
  legend,
  actions,
  fullscreenable = false,
  exportable = false,
  onExport,
  className = '',
  loading = false,
  error,
  insight
}: ChartWrapperProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  // Get insight color based on type
  const getInsightColor = (type: 'positive' | 'negative' | 'neutral') => {
    switch (type) {
      case 'positive':
        return businessColors.success.main
      case 'negative':
        return businessColors.error.main
      case 'neutral':
      default:
        return businessColors.gray[600]
    }
  }

  // Tooltip component
  const TooltipContent = () => {
    if (!tooltip) return null

    return (
      <div className="group relative inline-block ml-2">
        <HelpCircle
          className="w-4 h-4 cursor-help transition-colors"
          style={{ color: businessColors.gray[400] }}
        />
        <div className="absolute z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        bottom-full left-0 mb-2 w-80 p-4 rounded-lg shadow-lg"
             style={{
               backgroundColor: businessColors.gray[900],
               color: 'white'
             }}>
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: businessColors.primary[400] }} />
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">{tooltip.title}</h4>
              <p className="text-xs opacity-90 mb-2">{tooltip.description}</p>
              {tooltip.interpretation && (
                <div className="pt-2 border-t" style={{ borderColor: businessColors.gray[700] }}>
                  <p className="text-xs">
                    <span className="font-semibold">How to interpret:</span><br />
                    {tooltip.interpretation}
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-6 -mt-1">
            <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4"
                 style={{ borderTopColor: businessColors.gray[900] }}></div>
          </div>
        </div>
      </div>
    )
  }

  // Legend component
  const LegendComponent = () => {
    if (!legend || legend.items.length === 0) return null

    const positionClasses = {
      top: 'flex-wrap justify-center mb-4',
      bottom: 'flex-wrap justify-center mt-4',
      right: 'flex-col ml-4'
    }

    return (
      <div className={`flex gap-3 ${positionClasses[legend.position || 'bottom']}`}>
        {legend.items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs font-medium" style={{ color: businessColors.gray[700] }}>
              {item.label}
              {item.value && (
                <span className="ml-1" style={{ color: businessColors.gray[500] }}>
                  ({typeof item.value === 'number' ? item.value.toLocaleString() : item.value})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    )
  }

  const content = (
    <div
      className={`bg-white rounded-lg border p-6 ${className} ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}
      style={{
        borderColor: businessColors.card.border,
        height: isFullscreen ? 'calc(100vh - 2rem)' : 'auto'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: businessColors.gray[900] }}>
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm mt-1" style={{ color: businessColors.gray[600] }}>
                {subtitle}
              </p>
            )}
          </div>
          <TooltipContent />
        </div>

        <div className="flex items-center gap-2">
          {actions}
          {exportable && onExport && (
            <button
              onClick={onExport}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Export chart data"
            >
              <Download className="w-4 h-4" style={{ color: businessColors.gray[600] }} />
            </button>
          )}
          {fullscreenable && (
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" style={{ color: businessColors.gray[600] }} />
              ) : (
                <Maximize2 className="w-4 h-4" style={{ color: businessColors.gray[600] }} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Top Legend */}
      {legend && legend.position === 'top' && <LegendComponent />}

      {/* Chart Container */}
      <div
        className="relative"
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          display: legend?.position === 'right' ? 'flex' : 'block'
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2"
                   style={{ borderColor: businessColors.primary[600] }}></div>
              <p className="mt-2 text-sm" style={{ color: businessColors.gray[600] }}>Loading chart...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm" style={{ color: businessColors.error.main }}>{error}</p>
            </div>
          </div>
        ) : (
          <>
            <div className={legend?.position === 'right' ? 'flex-1' : ''}>
              {children}
            </div>
            {legend && legend.position === 'right' && <LegendComponent />}
          </>
        )}
      </div>

      {/* Bottom Legend */}
      {legend && legend.position === 'bottom' && <LegendComponent />}

      {/* Insight */}
      {insight && (
        <div
          className="mt-4 p-3 rounded-lg flex items-center gap-2"
          style={{
            backgroundColor: businessColors.background.tertiary,
            borderLeft: `3px solid ${getInsightColor(insight.type)}`
          }}
        >
          <TrendingUp className="w-4 h-4" style={{ color: getInsightColor(insight.type) }} />
          <p className="text-sm" style={{ color: businessColors.gray[700] }}>
            <span className="font-medium">Insight:</span> {insight.text}
          </p>
        </div>
      )}
    </div>
  )

  // Fullscreen overlay
  if (isFullscreen) {
    return (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsFullscreen(false)} />
        {content}
      </>
    )
  }

  return content
}

// Export chart utilities
export const chartTooltipStyles = {
  contentStyle: {
    backgroundColor: businessColors.gray[900],
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '12px',
    padding: '8px 12px'
  },
  labelStyle: {
    color: 'white',
    fontWeight: 600,
    marginBottom: '4px'
  },
  itemStyle: {
    color: 'white',
    fontSize: '11px'
  }
}

export const chartAxisStyles = {
  fontSize: 12,
  fill: businessColors.gray[600]
}

export const chartGridStyles = {
  stroke: businessColors.gray[200],
  strokeDasharray: '3 3'
}