'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Search } from 'lucide-react'

interface Option {
  value: string
  label: string
  [key: string]: any
}

interface SearchableSelectProps {
  value: string | null
  onChange: (value: string | null) => void
  options: Option[]
  placeholder?: string
  icon?: React.ReactNode
  label?: string
  disabled?: boolean
  formatOptionLabel?: (option: Option) => string
  renderOption?: (option: Option) => React.ReactNode
  className?: string
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  icon,
  label,
  disabled = false,
  formatOptionLabel,
  renderOption,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter options based on search term
  // Always use option.label for searching (it's always a string)
  // formatOptionLabel might return JSX which can't be converted to lowercase
  const filteredOptions = options.filter(option => {
    const searchableText = option.label || ''
    return searchableText.toString().toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Get selected option label (always use option.label for display in button)
  const selectedOption = options.find(opt => opt.value === value)
  const selectedLabel = selectedOption ? selectedOption.label : placeholder

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue === value ? null : optionValue)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
          {icon && <span className="inline-block mr-1.5">{icon}</span>}
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full flex items-center justify-between px-3 py-2.5 text-sm
            border border-gray-300 rounded-lg bg-white
            hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            transition-all duration-150
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
            ${value ? 'text-gray-900 font-medium' : 'text-gray-500'}
          `}
        >
          <span className="truncate flex-1 text-left">
            {selectedLabel}
          </span>
          <div className="flex items-center gap-1 ml-2">
            {value && !disabled && (
              <div
                onClick={handleClear}
                className="p-0.5 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                role="button"
                aria-label="Clear selection"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </div>
            )}
            <ChevronDown
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-[300px] flex flex-col">
            {/* Search input */}
            <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Options list */}
            <div className="overflow-y-auto flex-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-gray-500">
                  No options found
                </div>
              ) : (
                <>
                  {/* Clear selection option */}
                  <button
                    type="button"
                    onClick={() => handleSelect('')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors border-b border-gray-100"
                  >
                    <span className="text-gray-500 italic">{placeholder}</span>
                  </button>

                  {filteredOptions.map((option) => {
                    const isSelected = option.value === value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        className={`
                          w-full px-3 py-2.5 text-left text-sm transition-colors
                          hover:bg-blue-50
                          ${isSelected ? 'bg-blue-100 text-blue-900 font-medium' : 'text-gray-900'}
                        `}
                      >
                        <div className="flex items-center justify-between">
                          {renderOption ? (
                            <div className="flex-1">{renderOption(option)}</div>
                          ) : (
                            <span className="truncate">{option.label}</span>
                          )}
                          {isSelected && (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-2 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </>
              )}
            </div>

            {/* Footer with count */}
            {filteredOptions.length > 0 && (
              <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
                {filteredOptions.length} option{filteredOptions.length !== 1 ? 's' : ''} available
                {searchTerm && ` (filtered from ${options.length})`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
