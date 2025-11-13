'use client'

import React from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FilterOption {
  value: string
  label: string
  code?: string
}

interface MultiSelectFilterProps {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  placeholder?: string
  showCodes?: boolean
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select...',
  showCodes = true
}) => {
  const selectedOption = options.find(opt => opt.value === value)

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('all')
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      <div className="relative">
        <Select value={value || 'all'} onValueChange={onChange}>
          <SelectTrigger className="w-full h-10">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem key="__select_all__" value="all">All {label}</SelectItem>
            {options.map((option, index) => (
              <SelectItem
                key={option.value ? `option_${option.value}` : `option_idx_${index}`}
                value={option.value || `undefined_${index}`}
              >
                {showCodes && option.code
                  ? `${option.label.split(' (')[0]} (${option.code})`
                  : option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear button */}
        {value && value !== 'all' && (
          <button
            onClick={handleClear}
            className="absolute right-8 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            aria-label="Clear selection"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
