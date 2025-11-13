'use client'

import React, { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus, HelpCircle, AlertCircle, Info } from 'lucide-react'
import { businessColors } from '@/styles/businessColors'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: {
    value: number
    label: string
    isPositive?: boolean
  }
  tooltip?: {
    title: string
    description: string
    calculation?: string
  }
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  format?: 'number' | 'currency' | 'percentage' | 'custom'
  loading?: boolean
  className?: string
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  tooltip,
  variant = 'default',
  format = 'custom',
  loading = false,
  className = ''
}: MetricCardProps) {
  // Format value based on type
  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val

    switch (format) {
      case 'number':
        return val.toLocaleString()
      case 'currency':
        return `AED${val.toLocaleString('en-IN')}`
      case 'percentage':
        return `${val}%`
      default:
        return val.toString()
    }
  }

  // Get colors based on variant
  const getVariantColors = () => {
    switch (variant) {
      case 'success':
        return {
          bg: businessColors.success.light,
          text: businessColors.success.dark,
          icon: businessColors.success.main
        }
      case 'warning':
        return {
          bg: businessColors.warning.light,
          text: businessColors.warning.dark,
          icon: businessColors.warning.main
        }
      case 'error':
        return {
          bg: businessColors.error.light,
          text: businessColors.error.dark,
          icon: businessColors.error.main
        }
      case 'info':
        return {
          bg: businessColors.info.light,
          text: businessColors.info.dark,
          icon: businessColors.info.main
        }
      default:
        return {
          bg: businessColors.background.secondary,
          text: businessColors.gray[900],
          icon: businessColors.primary[600]
        }
    }
  }

  const colors = getVariantColors()

  // Trend icon component
  const TrendIcon = () => {
    if (!trend) return null

    if (trend.value === 0) {
      return <Minus className="w-4 h-4" style={{ color: businessColors.gray[500] }} />
    }

    const isPositive = trend.isPositive !== undefined ? trend.isPositive : trend.value > 0
    const Icon = trend.value > 0 ? TrendingUp : TrendingDown
    const color = isPositive ? businessColors.success.main : businessColors.error.main

    return <Icon className="w-4 h-4" style={{ color }} />
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
                        bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-4 rounded-lg shadow-lg"
             style={{
               backgroundColor: businessColors.gray[900],
               color: 'white'
             }}>
          <div className="flex items-start gap-2 mb-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: businessColors.primary[400] }} />
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">{tooltip.title}</h4>
              <p className="text-xs opacity-90">{tooltip.description}</p>
              {tooltip.calculation && (
                <div className="mt-2 pt-2 border-t" style={{ borderColor: businessColors.gray[700] }}>
                  <p className="text-xs font-mono opacity-80">
                    <span className="font-semibold">Calculation:</span><br />
                    {tooltip.calculation}
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4"
                 style={{ borderTopColor: businessColors.gray[900] }}></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`p-6 rounded-lg border transition-all hover:shadow-md ${className}`}
      style={{
        backgroundColor: businessColors.card.background,
        borderColor: businessColors.card.border,
      }}
    >
      {loading ? (
        <div className="animate-pulse">
          <div className="h-4 rounded w-1/2 mb-3" style={{ backgroundColor: businessColors.gray[200] }}></div>
          <div className="h-8 rounded w-3/4 mb-2" style={{ backgroundColor: businessColors.gray[200] }}></div>
          <div className="h-3 rounded w-1/3" style={{ backgroundColor: businessColors.gray[200] }}></div>
        </div>
      ) : (
        <>
          {/* Header with title and tooltip */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <p className="text-sm font-medium" style={{ color: businessColors.gray[600] }}>
                {title}
              </p>
              <TooltipContent />
            </div>
            {icon && (
              <div className="p-2 rounded-lg flex items-center justify-center">
                <div style={{ color: colors.icon }}>
                  {icon}
                </div>
              </div>
            )}
          </div>

          {/* Main value */}
          <div className="mb-2">
            <p className="text-3xl font-bold" style={{ color: businessColors.gray[900] }}>
              {formatValue(value)}
            </p>
          </div>

          {/* Subtitle and trend */}
          <div className="flex items-center justify-between">
            {subtitle && (
              <p className="text-xs" style={{ color: businessColors.gray[500] }}>
                {subtitle}
              </p>
            )}

            {trend && (
              <div className="flex items-center gap-1">
                <TrendIcon />
                <span className="text-xs font-medium"
                      style={{
                        color: trend.value > 0
                          ? (trend.isPositive !== false ? businessColors.success.main : businessColors.error.main)
                          : trend.value < 0
                          ? (trend.isPositive !== false ? businessColors.error.main : businessColors.success.main)
                          : businessColors.gray[500]
                      }}>
                  {Math.abs(trend.value)}% {trend.label}
                </span>
              </div>
            )}
          </div>

          {/* Alert indicator for critical metrics */}
          {variant === 'error' && (
            <div className="mt-3 pt-3 border-t flex items-center gap-2"
                 style={{ borderColor: businessColors.error.light }}>
              <AlertCircle className="w-4 h-4" style={{ color: businessColors.error.main }} />
              <span className="text-xs font-medium" style={{ color: businessColors.error.main }}>
                Requires immediate attention
              </span>
            </div>
          )}

          {variant === 'warning' && (
            <div className="mt-3 pt-3 border-t flex items-center gap-2"
                 style={{ borderColor: businessColors.warning.light }}>
              <AlertCircle className="w-4 h-4" style={{ color: businessColors.warning.main }} />
              <span className="text-xs font-medium" style={{ color: businessColors.warning.main }}>
                Monitor closely
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}