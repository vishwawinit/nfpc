import React, { useMemo } from 'react'
import { businessColors } from '@/styles/businessColors'

interface HeatMapData {
  row: string
  column: string
  value: number
}

interface HeatMapChartProps {
  data: HeatMapData[]
  title?: string
  colorScale?: {
    min: string
    mid: string
    max: string
  }
  showValues?: boolean
  cellSize?: number
}

export const HeatMapChart: React.FC<HeatMapChartProps> = ({
  data,
  title,
  colorScale = {
    min: '#fee',
    mid: '#faa',
    max: '#c00'
  },
  showValues = true,
  cellSize = 60
}) => {
  const { rows, columns, maxValue, minValue } = useMemo(() => {
    const rowSet = new Set(data.map(d => d.row))
    const colSet = new Set(data.map(d => d.column))
    const values = data.map(d => d.value)
    
    return {
      rows: Array.from(rowSet),
      columns: Array.from(colSet),
      maxValue: Math.max(...values, 1),
      minValue: Math.min(...values, 0)
    }
  }, [data])

  const getColor = (value: number) => {
    if (maxValue === minValue) return colorScale.mid
    
    const normalized = (value - minValue) / (maxValue - minValue)
    
    if (normalized < 0.5) {
      // Interpolate between min and mid
      const factor = normalized * 2
      return interpolateColor(colorScale.min, colorScale.mid, factor)
    } else {
      // Interpolate between mid and max
      const factor = (normalized - 0.5) * 2
      return interpolateColor(colorScale.mid, colorScale.max, factor)
    }
  }

  const interpolateColor = (color1: string, color2: string, factor: number) => {
    const hex = (c: string) => parseInt(c.substring(1), 16)
    const r1 = (hex(color1) >> 16) & 0xff
    const g1 = (hex(color1) >> 8) & 0xff
    const b1 = hex(color1) & 0xff
    const r2 = (hex(color2) >> 16) & 0xff
    const g2 = (hex(color2) >> 8) & 0xff
    const b2 = hex(color2) & 0xff
    
    const r = Math.round(r1 + factor * (r2 - r1))
    const g = Math.round(g1 + factor * (g2 - g1))
    const b = Math.round(b1 + factor * (b2 - b1))
    
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
  }

  const getValue = (row: string, col: string) => {
    const cell = data.find(d => d.row === row && d.column === col)
    return cell?.value || 0
  }

  return (
    <div className="overflow-x-auto">
      {title && <h3 className="text-sm font-semibold mb-2">{title}</h3>}
      <div className="inline-block">
        <div className="flex">
          <div style={{ width: cellSize * 2 }} /> {/* Space for row labels */}
          {columns.map(col => (
            <div
              key={col}
              style={{ width: cellSize }}
              className="text-xs text-center font-medium p-1 truncate"
              title={col}
            >
              {col.length > 8 ? col.substring(0, 8) + '...' : col}
            </div>
          ))}
        </div>
        {rows.map(row => (
          <div key={row} className="flex items-center">
            <div
              style={{ width: cellSize * 2 }}
              className="text-xs text-right pr-2 font-medium truncate"
              title={row}
            >
              {row.length > 15 ? row.substring(0, 15) + '...' : row}
            </div>
            {columns.map(col => {
              const value = getValue(row, col)
              const color = getColor(value)
              return (
                <div
                  key={`${row}-${col}`}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: color
                  }}
                  className="border border-gray-200 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                  title={`${row} - ${col}: ${value}`}
                >
                  {showValues && (
                    <span className="text-xs font-semibold" style={{
                      color: value > (maxValue - minValue) * 0.7 ? 'white' : 'black'
                    }}>
                      {value}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs text-gray-600">Low</span>
        <div className="flex h-4">
          {[0, 0.25, 0.5, 0.75, 1].map((factor, idx) => (
            <div
              key={idx}
              style={{
                width: 40,
                backgroundColor: factor < 0.5 
                  ? interpolateColor(colorScale.min, colorScale.mid, factor * 2)
                  : interpolateColor(colorScale.mid, colorScale.max, (factor - 0.5) * 2)
              }}
            />
          ))}
        </div>
        <span className="text-xs text-gray-600">High</span>
        <span className="text-xs text-gray-500 ml-2">
          ({minValue} - {maxValue})
        </span>
      </div>
    </div>
  )
}
