'use client'

import React from 'react'

interface Option {
  value: string
  label: string
  [key: string]: any
}

interface CustomSelectProps {
  value: string | null
  onChange: (value: string | null) => void
  options: Option[]
  placeholder?: string
  icon?: React.ReactNode
  label?: string
  disabled?: boolean
  formatOptionLabel?: (option: Option) => string
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  icon,
  label,
  disabled = false,
  formatOptionLabel
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    onChange(newValue === '' ? null : newValue)
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {icon && <span className="inline-block mr-1">{icon}</span>}
          {label}
        </label>
      )}
      <select
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {options.map((option, index) => (
          <option key={`${option.value}-${index}`} value={option.value}>
            {formatOptionLabel ? formatOptionLabel(option) : option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
