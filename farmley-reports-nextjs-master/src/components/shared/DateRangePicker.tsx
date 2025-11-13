'use client'

import React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from 'lucide-react'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onChange: (startDate: string, endDate: string) => void
  label?: string
  showPresets?: boolean
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  label = 'Date Range',
  showPresets = true
}) => {
  const [preset, setPreset] = React.useState('custom')

  const handlePresetChange = (value: string) => {
    setPreset(value)
    const today = new Date()
    let start: Date
    let end: Date = new Date(today)

    switch (value) {
      case 'today':
        start = new Date(today)
        break
      case 'yesterday':
        start = new Date(today)
        start.setDate(start.getDate() - 1)
        end = new Date(start)
        break
      case 'last7days':
        start = new Date(today)
        start.setDate(start.getDate() - 6)
        break
      case 'last30days':
        start = new Date(today)
        start.setDate(start.getDate() - 29)
        break
      case 'thisWeek':
        start = new Date(today)
        start.setDate(start.getDate() - today.getDay())
        break
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1)
        break
      case 'custom':
      default:
        return // Don't update dates for custom
    }

    onChange(start.toISOString().split('T')[0], end.toISOString().split('T')[0])
  }

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreset('custom')
    onChange(e.target.value, endDate)
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreset('custom')
    onChange(startDate, e.target.value)
  }

  return (
    <div className="space-y-3">
      {label && <Label className="text-sm font-medium text-slate-700">{label}</Label>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Quick Presets - Full width on mobile, 1/3 on desktop */}
        {showPresets && (
          <div className="sm:col-span-1">
            <Select value={preset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Quick Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom Range</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last7days">Last 7 Days</SelectItem>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
                <SelectItem value="thisWeek">This Week</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Start Date */}
        <div className={showPresets ? 'sm:col-span-1' : 'sm:col-span-1'}>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className="pl-10 h-10"
              placeholder="Start Date"
            />
          </div>
        </div>

        {/* End Date */}
        <div className={showPresets ? 'sm:col-span-1' : 'sm:col-span-1'}>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              className="pl-10 h-10"
              placeholder="End Date"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
