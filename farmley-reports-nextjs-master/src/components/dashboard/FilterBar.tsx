import React, { useState } from 'react'
import { Search, Calendar, Filter, X } from 'lucide-react'
import { FilterOptions } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  onFilterChange: (filters: Partial<FilterOptions>) => void
  onSearchChange: (searchTerm: string) => void
  className?: string
}

export const FilterBar: React.FC<FilterBarProps> = ({
  onFilterChange,
  onSearchChange,
  className
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  })
  const [selectedRoute, setSelectedRoute] = useState<string>('')
  const [selectedCustomerType, setSelectedCustomerType] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [activeFilters, setActiveFilters] = useState<string[]>([])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    onSearchChange(value)
  }

  const handleDateChange = (type: 'from' | 'to', date: Date | undefined) => {
    const newDateRange = { ...dateRange, [type]: date }
    setDateRange(newDateRange)

    if (newDateRange.from && newDateRange.to) {
      onFilterChange({
        startDate: newDateRange.from,
        endDate: newDateRange.to
      })
      updateActiveFilters('dateRange', true)
    }
  }

  const handleRouteChange = (value: string) => {
    setSelectedRoute(value)
    onFilterChange({ routeCode: value || undefined })
    updateActiveFilters('route', !!value)
  }

  const handleCustomerTypeChange = (value: string) => {
    setSelectedCustomerType(value)
    onFilterChange({ customerType: value || undefined })
    updateActiveFilters('customerType', !!value)
  }

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value)
    onFilterChange({ productCategory: value || undefined })
    updateActiveFilters('category', !!value)
  }

  const updateActiveFilters = (filterName: string, isActive: boolean) => {
    setActiveFilters(prev => {
      if (isActive && !prev.includes(filterName)) {
        return [...prev, filterName]
      } else if (!isActive && prev.includes(filterName)) {
        return prev.filter(f => f !== filterName)
      }
      return prev
    })
  }

  const clearAllFilters = () => {
    setSearchTerm('')
    setDateRange({ from: undefined, to: undefined })
    setSelectedRoute('')
    setSelectedCustomerType('')
    setSelectedCategory('')
    setActiveFilters([])
    onSearchChange('')
    onFilterChange({})
  }

  const removeFilter = (filterName: string) => {
    switch(filterName) {
      case 'dateRange':
        setDateRange({ from: undefined, to: undefined })
        onFilterChange({ startDate: undefined, endDate: undefined })
        break
      case 'route':
        setSelectedRoute('')
        onFilterChange({ routeCode: undefined })
        break
      case 'customerType':
        setSelectedCustomerType('')
        onFilterChange({ customerType: undefined })
        break
      case 'category':
        setSelectedCategory('')
        onFilterChange({ productCategory: undefined })
        break
    }
    updateActiveFilters(filterName, false)
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search customers, products, orders..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>

        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal text-xs sm:text-sm w-full sm:w-auto",
                !dateRange.from && "text-gray-500"
              )}
            >
              <Calendar className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM dd, yyyy")} -{" "}
                      {format(dateRange.to, "MMM dd, yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM dd, yyyy")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex flex-col sm:flex-row">
              <CalendarComponent
                mode="single"
                selected={dateRange.from}
                onSelect={(date) => handleDateChange('from', date)}
                initialFocus
              />
              <CalendarComponent
                mode="single"
                selected={dateRange.to}
                onSelect={(date) => handleDateChange('to', date)}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Filter Toggle Button */}
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          className="text-xs sm:text-sm w-full sm:w-auto"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFilters.length > 0 && (
            <span className="ml-2 bg-white text-primary rounded-full px-2 py-0.5 text-xs">
              {activeFilters.length}
            </span>
          )}
        </Button>

        {/* Clear Filters Button */}
        {activeFilters.length > 0 && (
          <Button
            variant="ghost"
            onClick={clearAllFilters}
            className="text-gray-500 text-xs sm:text-sm w-full sm:w-auto"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Expandable Filter Section */}
      {showFilters && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Route Filter */}
            <div>
              <label className="text-sm font-medium mb-1 block">Route</label>
              <Select value={selectedRoute} onValueChange={handleRouteChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Routes</SelectItem>
                  <SelectItem value="R001">Downtown</SelectItem>
                  <SelectItem value="R002">Uptown</SelectItem>
                  <SelectItem value="R003">Suburbs</SelectItem>
                  <SelectItem value="R004">Industrial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer Type Filter */}
            <div>
              <label className="text-sm font-medium mb-1 block">Customer Type</label>
              <Select value={selectedCustomerType} onValueChange={handleCustomerTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Wholesale">Wholesale</SelectItem>
                  <SelectItem value="Distributor">Distributor</SelectItem>
                  <SelectItem value="Chain">Chain Store</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Product Category Filter */}
            <div>
              <label className="text-sm font-medium mb-1 block">Product Category</label>
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  <SelectItem value="Beverages">Beverages</SelectItem>
                  <SelectItem value="Snacks">Snacks</SelectItem>
                  <SelectItem value="Dairy">Dairy</SelectItem>
                  <SelectItem value="Bakery">Bakery</SelectItem>
                  <SelectItem value="Personal Care">Personal Care</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Tags */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map(filter => {
            let label = ''
            let value = ''

            switch(filter) {
              case 'dateRange':
                label = 'Date'
                value = dateRange.from && dateRange.to
                  ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
                  : ''
                break
              case 'route':
                label = 'Route'
                value = selectedRoute
                break
              case 'customerType':
                label = 'Customer'
                value = selectedCustomerType
                break
              case 'category':
                label = 'Category'
                value = selectedCategory
                break
            }

            return (
              <div
                key={filter}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm"
              >
                <span className="font-medium">{label}:</span>
                <span>{value}</span>
                <button
                  onClick={() => removeFilter(filter)}
                  className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}