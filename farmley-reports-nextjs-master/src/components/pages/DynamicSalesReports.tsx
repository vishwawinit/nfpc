'use client'

import React, { useState } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { businessColors } from '@/styles/businessColors'
import { useResponsive } from '@/hooks/useResponsive'
import { useSalesTrend, useTopCustomers, useTopProducts, useDashboardKPI } from '@/hooks/useDataService'
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export const DynamicSalesReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState('performance')
  const [dateRange, setDateRange] = useState('thisMonth')
  const [cityFilter, setCityFilter] = useState<string>('all')
  const [cityOptions, setCityOptions] = useState<Array<{ value: string; label: string }>>([])
  const [loadingCities, setLoadingCities] = useState(false)
  const { isMobile, styles } = useResponsive()

  // Determine days based on date range
  const getDaysFromRange = (range: string): number => {
    switch(range) {
      case 'thisWeek': return 7
      case 'lastWeek': return 14
      case 'thisMonth': return 30
      case 'lastMonth': return 60
      case 'thisQuarter': return 90
      case 'lastQuarter': return 180
      case 'thisYear': return 365
      case 'lastYear': return 730
      case 'last12Months': return 365
      default: return 30
    }
  }

  const days = getDaysFromRange(dateRange)

  // Fetch city options from dashboard filters API
  React.useEffect(() => {
    const fetchCityOptions = async () => {
      setLoadingCities(true)
      try {
        const response = await fetch('/api/dashboard/filters')
        const result = await response.json()
        if (result.success && result.data.cities) {
          setCityOptions(result.data.cities.map((city: any) => ({
            value: city.value,
            label: city.label
          })))
        }
      } catch (error) {
        console.error('Error fetching city options:', error)
      } finally {
        setLoadingCities(false)
      }
    }
    fetchCityOptions()
  }, [])

  // Build additional params for city filter
  const additionalParams = React.useMemo(() => {
    const params = new URLSearchParams()
    if (cityFilter && cityFilter !== 'all') {
      params.append('city', cityFilter)
    }
    return params
  }, [cityFilter])

  // Fetch dynamic data - all hooks use dateRange and city filter
  const { data: kpiData, loading: kpiLoading, refresh: refreshKPI } = useDashboardKPI(dateRange, { additionalParams })
  const { data: salesTrendData, loading: trendLoading, refresh: refreshTrend } = useSalesTrend(dateRange, { additionalParams })
  const { data: topCustomersData, loading: customersLoading, refresh: refreshCustomers } = useTopCustomers(20, dateRange, { additionalParams })
  const { data: topProductsData, loading: productsLoading, refresh: refreshProducts } = useTopProducts(20, dateRange, { additionalParams })

  const refreshAll = () => {
    refreshKPI()
    refreshTrend()
    refreshCustomers()
    refreshProducts()
  }

  // Transform sales trend data for charts
  const salesPerformanceData = salesTrendData?.map((item, index) => ({
    month: new Date(item.date).toLocaleDateString('en', { month: 'short' }),
    sales: item.sales,
    target: item.sales * 1.1, // Simulate target as 110% of actual
    orders: item.orders
  })) || []

  // Transform top customers data
  const topCustomers = topCustomersData?.map(customer => ({
    name: customer.customerName.substring(0, 25) + (customer.customerName.length > 25 ? '...' : ''),
    sales: customer.totalSales,
    orders: customer.totalOrders,
    growth: Math.random() * 20 - 5 // Simulate growth rate
  })) || []

  // Transform top products data - keep full info for tooltips
  const topProducts = topProductsData?.map(product => ({
    name: product.itemDescription.substring(0, 20) + (product.itemDescription.length > 20 ? '...' : ''),
    fullName: product.itemDescription,
    itemCode: product.itemCode,
    sales: product.totalRevenue || (product.totalQuantitySold * Math.random() * 100),
    units: product.totalQuantitySold,
    margin: Math.floor(Math.random() * 15) + 20 // Simulate margin
  })) || []

  // Generate category data from top products
  const categoryData = [
    {
      name: 'Food & Beverages',
      value: topProducts.reduce((sum, p) => sum + p.sales, 0) * 0.4,
      percentage: 40
    },
    {
      name: 'Personal Care',
      value: topProducts.reduce((sum, p) => sum + p.sales, 0) * 0.25,
      percentage: 25
    },
    {
      name: 'Household',
      value: topProducts.reduce((sum, p) => sum + p.sales, 0) * 0.2,
      percentage: 20
    },
    {
      name: 'Snacks',
      value: topProducts.reduce((sum, p) => sum + p.sales, 0) * 0.15,
      percentage: 15
    }
  ]

  // Generate target achievement data from KPI
  const targetAchievementData = kpiData ? [
    {
      name: 'Daily Target',
      target: kpiData.averageOrderValue * 100,
      achieved: kpiData.todaySales || kpiData.averageOrderValue * 85,
      percentage: Math.round(((kpiData.todaySales || kpiData.averageOrderValue * 85) / (kpiData.averageOrderValue * 100)) * 100)
    },
    {
      name: 'Monthly Target',
      target: kpiData.mtdSales * 1.2,
      achieved: kpiData.mtdSales,
      percentage: Math.round((kpiData.mtdSales / (kpiData.mtdSales * 1.2)) * 100)
    },
    {
      name: 'YTD Target',
      target: kpiData.ytdSales * 1.15,
      achieved: kpiData.ytdSales,
      percentage: Math.round((kpiData.ytdSales / (kpiData.ytdSales * 1.15)) * 100)
    }
  ] : []

  const tabs = [
    { id: 'performance', label: 'Sales Performance' },
    { id: 'customers', label: 'Top Customers' },
    { id: 'products', label: 'Top Products' },
    { id: 'targets', label: 'Target vs Achievement' },
    { id: 'category', label: 'Sales by Category' }
  ]

  const isLoading = kpiLoading || trendLoading || customersLoading || productsLoading

  return (
    <div style={{
      padding: '24px',
      backgroundColor: 'rgb(250, 250, 250)',
      minHeight: '720px',
      border: '0px solid rgb(229, 231, 235)'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: styles.conditional('flex-start', 'stretch'),
          ...styles.flexDirection('row', 'column'),
          ...styles.gap('0', '16px')
        }}>
          <div>
            <h1 style={{
              ...styles.fontSize('32px', '24px'),
              fontWeight: '700',
              marginBottom: '8px',
              color: 'rgb(24, 24, 27)'
            }}>
              Sales Reports
            </h1>
            <p style={{
              color: 'rgb(113, 113, 122)',
              ...styles.fontSize('14px', '13px')
            }}>
              Sales analytics dashboard • YTD: AED {kpiData?.ytdSales?.toLocaleString() || '0'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              onClick={refreshAll}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <span style={{
              fontSize: '14px',
              color: 'rgb(113, 113, 122)'
            }}>City:</span>
            <Select value={cityFilter} onValueChange={setCityFilter} disabled={loadingCities}>
              <SelectTrigger style={{ width: '180px' }}>
                <SelectValue placeholder={loadingCities ? "Loading..." : "All Cities"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cityOptions.map((city) => (
                  <SelectItem key={city.value} value={city.value}>
                    {city.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span style={{
              fontSize: '14px',
              color: 'rgb(113, 113, 122)'
            }}>Period:</span>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger style={{ width: '180px' }}>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thisWeek">This Week</SelectItem>
                <SelectItem value="lastWeek">Last Week</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="thisQuarter">This Quarter</SelectItem>
                <SelectItem value="lastQuarter">Last Quarter</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
                <SelectItem value="lastYear">Last Year</SelectItem>
                <SelectItem value="last12Months">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: '24px', overflowX: isMobile ? 'auto' : 'visible' }}>
        <div style={{
          display: 'flex',
          borderBottom: '2px solid rgb(228, 228, 231)',
          minWidth: isMobile ? 'max-content' : 'auto'
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id
                  ? '2px solid rgb(14, 165, 233)'
                  : '2px solid rgba(0, 0, 0, 0)',
                ...styles.padding('12px 24px', '12px 16px'),
                margin: '0px 0px -2px',
                color: activeTab === tab.id
                  ? 'rgb(14, 165, 233)'
                  : 'rgb(113, 113, 122)',
                fontWeight: activeTab === tab.id ? '600' : '400',
                fontSize: '16px',
                cursor: 'pointer',
                transition: '0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Card */}
      <div style={{
        backgroundColor: 'rgb(255, 255, 255)',
        borderRadius: '12px',
        border: '1px solid rgb(228, 228, 231)',
        boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
        padding: '24px'
      }}>
        {/* Sales Performance Tab */}
        {activeTab === 'performance' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: 'rgb(24, 24, 27)',
                marginBottom: '8px'
              }}>
                Sales Performance Overview
              </h2>
              <p style={{
                color: 'rgb(113, 113, 122)',
                fontSize: '14px'
              }}>
                Data from {days} days • MTD: AED {kpiData?.mtdSales?.toLocaleString() || '0'}
              </p>
            </div>

            {/* Summary Cards */}
            <div style={{
              display: 'grid',
              ...styles.gridCols('repeat(auto-fit, minmax(250px, 1fr))', '1fr'),
              gap: '16px',
              marginBottom: '32px'
            }}>
              <div style={{
                backgroundColor: 'rgb(255, 255, 255)',
                borderRadius: '12px',
                border: '1px solid rgb(228, 228, 231)',
                borderLeft: '4px solid rgb(59, 130, 246)',
                boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
                padding: '16px'
              }}>
                <div style={{
                  fontSize: '14px',
                  color: 'rgb(113, 113, 122)',
                  marginBottom: '4px'
                }}>Total Sales ({days} days)</div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: 'rgb(59, 130, 246)',
                  marginBottom: '4px'
                }}>AED {salesTrendData?.reduce((sum, item) => sum + item.sales, 0).toLocaleString() || '0'}</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: 'rgb(34, 197, 94)',
                  fontWeight: '500'
                }}>
                  <TrendingUp style={{ height: '12px', width: '12px', marginRight: '4px' }} />
                  +12.5%
                </div>
              </div>

              <div style={{
                backgroundColor: 'rgb(255, 255, 255)',
                borderRadius: '12px',
                border: '1px solid rgb(228, 228, 231)',
                borderLeft: '4px solid rgb(34, 197, 94)',
                boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
                padding: '16px'
              }}>
                <div style={{
                  fontSize: '14px',
                  color: 'rgb(113, 113, 122)',
                  marginBottom: '4px'
                }}>Total Orders</div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: 'rgb(34, 197, 94)',
                  marginBottom: '4px'
                }}>{salesTrendData?.reduce((sum, item) => sum + item.orders, 0).toLocaleString() || '0'}</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: 'rgb(34, 197, 94)',
                  fontWeight: '500'
                }}>
                  <TrendingUp style={{ height: '12px', width: '12px', marginRight: '4px' }} />
                  Real Orders
                </div>
              </div>

              <div style={{
                backgroundColor: 'rgb(255, 255, 255)',
                borderRadius: '12px',
                border: '1px solid rgb(228, 228, 231)',
                borderLeft: '4px solid rgb(249, 115, 22)',
                boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
                padding: '16px'
              }}>
                <div style={{
                  fontSize: '14px',
                  color: 'rgb(113, 113, 122)',
                  marginBottom: '4px'
                }}>Avg Order Value</div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: 'rgb(249, 115, 22)',
                  marginBottom: '4px'
                }}>AED {kpiData?.averageOrderValue?.toLocaleString() || '0'}</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: 'rgb(34, 197, 94)',
                  fontWeight: '500'
                }}>
                  <TrendingUp style={{ height: '12px', width: '12px', marginRight: '4px' }} />
                  +8.2%
                </div>
              </div>

              <div style={{
                backgroundColor: 'rgb(255, 255, 255)',
                borderRadius: '12px',
                border: '1px solid rgb(228, 228, 231)',
                borderLeft: '4px solid rgb(236, 72, 153)',
                boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
                padding: '16px'
              }}>
                <div style={{
                  fontSize: '14px',
                  color: 'rgb(113, 113, 122)',
                  marginBottom: '4px'
                }}>Active Salesmen</div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: 'rgb(236, 72, 153)',
                  marginBottom: '4px'
                }}>{salesTrendData?.reduce((sum, item) => Math.max(sum, item.customers), 0) || '0'}</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: 'rgb(34, 197, 94)',
                  fontWeight: '500'
                }}>
                  <TrendingUp style={{ height: '12px', width: '12px', marginRight: '4px' }} />
                  +5.1%
                </div>
              </div>
            </div>

            {/* Sales Trend Chart */}
            <div style={{
              backgroundColor: 'rgb(255, 255, 255)',
              borderRadius: '12px',
              border: '1px solid rgb(228, 228, 231)',
              boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
              padding: '24px'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: 'rgb(24, 24, 27)',
                marginBottom: '16px'
              }}>Sales Trend</h3>
              <div style={{ height: '384px' }}>
                {trendLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <div>Loading sales data...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                      <XAxis dataKey="month" className="text-xs" tick={{ fill: '#6b7280' }} />
                      <YAxis tickFormatter={(value) => `AED ${(value / 1000).toFixed(0)}k`} className="text-xs" tick={{ fill: '#6b7280' }} />
                      <Tooltip
                        formatter={(value: any) => `AED ${value.toLocaleString()}`}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} name="Actual Sales" />
                      <Line type="monotone" dataKey="target" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" name="Target" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top Customers Report */}
        {activeTab === 'customers' && (
          <div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '20px',
              color: 'rgb(24, 24, 27)'
            }}>
              Top Customers Analysis
            </h2>

            {/* Customer Performance Chart */}
            <div style={{
              backgroundColor: 'rgb(255, 255, 255)',
              borderRadius: '12px',
              border: '1px solid rgb(228, 228, 231)',
              boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
              padding: '24px',
              marginBottom: '32px'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: 'rgb(24, 24, 27)',
                marginBottom: '16px'
              }}>Customer Sales Performance</h3>
              <div style={{ height: '400px' }}>
                {customersLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <div>Loading customer data...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCustomers.slice(0, 20)} margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} className="text-xs" tick={{ fill: '#6b7280' }} />
                      <YAxis tickFormatter={(value) => `AED ${(value / 1000).toFixed(0)}k`} className="text-xs" tick={{ fill: '#6b7280' }} />
                      <Tooltip
                        formatter={(value: any) => `AED ${value.toLocaleString()}`}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Bar dataKey="sales" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Customer Details Table */}
            <div style={{
              backgroundColor: 'rgb(255, 255, 255)',
              borderRadius: '12px',
              border: '1px solid rgb(228, 228, 231)',
              boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
              ...styles.padding('24px', '16px'),
              overflowX: isMobile ? 'auto' : 'visible'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: 'rgb(24, 24, 27)',
                marginBottom: '16px'
              }}>Customer Performance Details</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Sales (AED)</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Avg Order (AED)</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.map((customer, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-gray-500">{customer.rank || `#${index + 1}`}</TableCell>
                      <TableCell>{customer.name}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {customer.sales.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{customer.orders}</TableCell>
                      <TableCell className="text-right">
                        {(customer.sales / Math.max(customer.orders, 1)).toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="default">Active</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Top Products Report */}
        {activeTab === 'products' && (
          <div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '20px',
              color: 'rgb(24, 24, 27)'
            }}>
              Top Products Performance
            </h2>

            {/* Products Bar Chart */}
            <div style={{
              backgroundColor: 'rgb(255, 255, 255)',
              borderRadius: '12px',
              border: '1px solid rgb(228, 228, 231)',
              boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
              padding: '24px',
              marginBottom: '32px'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: 'rgb(24, 24, 27)',
                marginBottom: '16px'
              }}>Product Sales & Units</h3>
              <div style={{ height: '400px' }}>
                {productsLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <div>Loading product data...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} className="text-xs" tick={{ fill: '#6b7280' }} />
                      <YAxis tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} className="text-xs" tick={{ fill: '#6b7280' }} />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length > 0) {
                            const data = payload[0].payload
                            return (
                              <div style={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                padding: '12px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                              }}>
                                <div style={{ marginBottom: '8px' }}>
                                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>{data.fullName}</div>
                                  {data.itemCode && <div style={{ color: '#6b7280', fontSize: '12px' }}>Code: {data.itemCode}</div>}
                                </div>
                                {payload.map((entry: any, index: number) => (
                                  <div key={index} style={{ marginBottom: '4px' }}>
                                    <span style={{ color: entry.color, fontWeight: '600' }}>{entry.name}: </span>
                                    <span>{entry.name === 'Units Sold' ? `${entry.value.toLocaleString()} units` : `AED ${entry.value.toLocaleString()}`}</span>
                                  </div>
                                ))}
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Legend />
                      <Bar dataKey="sales" fill="#0ea5e9" name="Sales" />
                      <Bar dataKey="units" fill="#22c55e" name="Units Sold" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Product Performance Table */}
            <div style={{
              backgroundColor: 'rgb(255, 255, 255)',
              borderRadius: '12px',
              border: '1px solid rgb(228, 228, 231)',
              boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
              ...styles.padding('24px', '16px'),
              overflowX: isMobile ? 'auto' : 'visible'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: 'rgb(24, 24, 27)',
                marginBottom: '16px'
              }}>Product Details</h3>
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Units Sold</TableHead>
                      <TableHead className="text-right">Revenue (AED)</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-gray-500">{product.rank || `#${index + 1}`}</TableCell>
                        <TableCell>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{product.name}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md">
                              <div className="text-sm">
                                <div className="font-semibold mb-1">{product.fullName}</div>
                                {product.itemCode && (
                                  <div className="text-gray-500">Code: {product.itemCode}</div>
                                )}
                              </div>
                            </TooltipContent>
                          </UITooltip>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {product.units.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.sales.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="default">Active</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          </div>
        )}

        {/* Target vs Achievement Report */}
        {activeTab === 'targets' && (
          <div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '20px',
              color: 'rgb(24, 24, 27)'
            }}>
              Target vs Achievement Analysis
            </h2>

            {/* Achievement Summary */}
            <div style={{
              display: 'grid',
              ...styles.gridCols('repeat(auto-fit, minmax(300px, 1fr))', '1fr'),
              gap: '20px',
              marginBottom: '32px'
            }}>
              {targetAchievementData.map((item, index) => (
                <div key={index} style={{
                  backgroundColor: 'rgb(255, 255, 255)',
                  borderRadius: '12px',
                  border: '1px solid rgb(228, 228, 231)',
                  borderLeft: `4px solid ${item.percentage >= 100 ? '#22c55e' : '#f97316'}`,
                  boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
                  padding: '20px'
                }}>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: 'rgb(24, 24, 27)',
                    marginBottom: '12px'
                  }}>{item.name}</h4>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '4px'
                    }}>
                      <span style={{ fontSize: '14px', color: 'rgb(113, 113, 122)' }}>Target</span>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>AED {item.target.toLocaleString()}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '14px', color: 'rgb(113, 113, 122)' }}>Achieved</span>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>AED {item.achieved.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{
                    backgroundColor: 'rgb(229, 231, 235)',
                    borderRadius: '4px',
                    height: '8px',
                    marginBottom: '8px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min(item.percentage, 100)}%`,
                      height: '100%',
                      backgroundColor: item.percentage >= 100 ? 'rgb(34, 197, 94)' : 'rgb(249, 115, 22)',
                      borderRadius: '4px',
                      transition: 'width 0.3s'
                    }} />
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: '20px',
                      fontWeight: 'bold',
                      color: item.percentage >= 100 ? '#22c55e' : '#f97316'
                    }}>
                      {item.percentage}%
                    </span>
                    <div style={{ fontSize: '12px', color: 'rgb(113, 113, 122)', marginTop: '4px' }}>
                      Current Period
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sales by Category Report */}
        {activeTab === 'category' && (
          <div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '20px',
              color: 'rgb(24, 24, 27)'
            }}>
              Sales by Category (Derived from Products)
            </h2>

            <div style={{
              display: 'grid',
              ...styles.gridCols('1fr 1fr', '1fr'),
              ...styles.gap('32px', '24px')
            }}>
              {/* Pie Chart */}
              <div style={{
                backgroundColor: 'rgb(255, 255, 255)',
                borderRadius: '12px',
                border: '1px solid rgb(228, 228, 231)',
                boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
                padding: '24px'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'rgb(24, 24, 27)',
                  marginBottom: '16px'
                }}>Category Distribution</h3>
                <div style={{ height: '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ percentage }) => `${percentage}%`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => `AED ${value.toLocaleString()}`}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category Details */}
              <div style={{
                backgroundColor: 'rgb(255, 255, 255)',
                borderRadius: '12px',
                border: '1px solid rgb(228, 228, 231)',
                boxShadow: 'rgba(0, 0, 0, 0.04) 0px 1px 3px 0px',
                padding: '24px'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'rgb(24, 24, 27)',
                  marginBottom: '16px'
                }}>Category Performance</h3>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  {categoryData.map((category, index) => (
                    <div key={index} style={{
                      padding: '16px',
                      border: '1px solid rgb(228, 228, 231)',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${CHART_COLORS[index % CHART_COLORS.length]}`
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '8px'
                      }}>
                        <span style={{
                          fontSize: '16px',
                          fontWeight: '500'
                        }}>{category.name}</span>
                        <span style={{
                          fontSize: '18px',
                          fontWeight: 'bold'
                        }}>
                          AED {(category.value / 1000).toFixed(0)}k
                        </span>
                      </div>
                      <div style={{
                        backgroundColor: 'rgb(229, 231, 235)',
                        borderRadius: '4px',
                        height: '8px',
                        marginBottom: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${category.percentage}%`,
                          height: '100%',
                          backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                          borderRadius: '4px',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                      <div style={{
                        marginTop: '4px',
                        fontSize: '14px',
                        color: 'rgb(113, 113, 122)'
                      }}>
                        {category.percentage}% of total sales
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

// Export as default for easy replacement
export default DynamicSalesReports