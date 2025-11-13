'use client'

import React, { useState, useRef, useEffect } from 'react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import '@/styles/calendar.css'
import { Calendar as CalendarIcon } from 'lucide-react'

type Value = Date | null

interface CustomDatePickerProps {
  value: string // YYYY-MM-DD format
  onChange: (date: string) => void
  label?: string
  placeholder?: string
  className?: string
}

export function CustomDatePicker({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  className = ''
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Convert string date to Date object
  const dateValue = value ? new Date(value + 'T00:00:00') : null

  // Handle click outside to close calendar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleDateChange = (value: any) => {
    if (value && value instanceof Date) {
      const year = value.getFullYear()
      const month = String(value.getMonth() + 1).padStart(2, '0')
      const day = String(value.getDate()).padStart(2, '0')
      onChange(`${year}-${month}-${day}`)
      setIsOpen(false)
    }
  }

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
          <CalendarIcon className="w-4 h-4 inline mr-1" />
          {label}
        </label>
      )}
      
      {/* Clickable Input Container - Matches SelectTrigger styling */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-within:outline-none focus-within:ring-2 focus-within:ring-slate-950 focus-within:ring-offset-2 cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <span className={value ? 'text-slate-900' : 'text-slate-500'}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <CalendarIcon className="h-4 w-4 opacity-50" />
      </div>

      {/* Calendar Popup - Matches SelectContent styling */}
      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md animate-in fade-in-0 zoom-in-95 translate-y-1">
          <Calendar
            onChange={handleDateChange}
            value={dateValue}
            locale="en-GB"
            className="border-0"
          />
        </div>
      )}
    </div>
  )
}
