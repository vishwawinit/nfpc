import React, { useEffect, useState } from 'react'
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useResponsive } from '@/hooks/useResponsive'

interface CustomerDetailsModalProps {
  customer: any
  isOpen: boolean
  onClose: () => void
  dateRange?: string
}

const CHART_COLORS = {
  primary: '#00b4d8',
  secondary: '#0077b6',
  accent: '#90e0ef',
  warning: '#ffd60a',
  danger: '#ef476f',
  success: '#06ffa5',
  info: '#118ab2'
}

const CATEGORY_COLORS = ['#00b4d8', '#ef476f', '#06ffa5', '#ffd60a', '#9b5de5']

// Smart route assignment based on customer name patterns
const getRouteFromName = (customerName: string): string => {
  if (!customerName) return 'General Route'

  const name = customerName.toUpperCase()

  if (name.includes('AL AIN')) return 'Al Ain Route'
  if (name.includes('DUBAI')) return 'Dubai Route'
  if (name.includes('SHARJAH')) return 'Sharjah Route'
  if (name.includes('AJMAN')) return 'Ajman Route'
  if (name.includes('FUJAIRAH')) return 'Fujairah Route'
  if (name.includes('RAS AL KHAIMAH')) return 'Ras Al Khaimah Route'
  if (name.includes('UMM AL QUWAIN')) return 'Umm Al Quwain Route'
  if (name.includes('ABU DHABI')) return 'Abu Dhabi Route'
  if (name.includes('AWEER')) return 'Aweer Route'
  if (name.includes('KARAMA')) return 'Karama Route'
  if (name.includes('QUSAIS')) return 'Qusais Route'
  if (name.includes('INDUSTRIAL')) return 'Industrial Route'
  if (name.includes('AL QOUZ')) return 'Al Qouz Route'
  if (name.includes('BARSHA')) return 'Barsha Route'
  if (name.includes('MUWAILAH')) return 'Muwailah Route'
  if (name.includes('LISAILI')) return 'Lisaili Route'
  if (name.includes('GHUBB')) return 'Ghubb Route'
  if (name.includes('QASMIYA')) return 'Qasmiya Route'

  return 'General Route'
}

// Helper functions outside component
const getChannel = (customerName: string | undefined) => {
  if (!customerName) return 'Traditional Trade'
  if (customerName?.includes('TRADING')) return 'Wholesale'
  if (customerName?.includes('SUPERMARKET')) return 'Modern Trade'
  if (customerName?.includes('HOTEL') || customerName?.includes('RESTAURANT')) return 'HORECA'
  if (customerName?.includes('ONLINE') || customerName?.includes('E-COM')) return 'E-Commerce'
  return 'Traditional Trade'
}

const getClassification = (totalSales: number | undefined) => {
  if (!totalSales) return 'New Customer'
  const sales = totalSales || 0
  if (sales > 50000) return 'Key Account'
  if (sales > 20000) return 'A Class'
  if (sales > 10000) return 'B Class'
  if (sales > 5000) return 'C Class'
  return 'New Customer'
}

export const CustomerDetailsModal: React.FC<CustomerDetailsModalProps> = ({ customer, isOpen, onClose, dateRange = 'thisMonth' }) => {
  const { isMobile, styles } = useResponsive()
  const [loading, setLoading] = useState(false)
  const [detailsData, setDetailsData] = useState<any>(null)
  const [categoryData, setCategoryData] = useState<any[]>([])
  const [categoryLoading, setCategoryLoading] = useState(false)

  const fetchCustomerDetails = React.useCallback(async () => {
    if (!customer?.customerCode) return

    setLoading(true)
    try {
      const response = await fetch(`/api/customers/details?customerCode=${customer.customerCode}`)
      const result = await response.json()

      if (result.success) {
        setDetailsData(result.data)
      }
    } catch (error) {
      console.error('Error fetching customer details:', error)
    } finally {
      setLoading(false)
    }
  }, [customer?.customerCode])

  const fetchCategoryData = React.useCallback(async () => {
    if (!customer?.customerCode) return

    setCategoryLoading(true)
    try {
      const response = await fetch(`/api/categories/performance?customerCode=${customer.customerCode}&range=${dateRange}&limit=20`)
      const result = await response.json()

      if (result.success && result.data) {
        const transformedData = result.data.map((cat: any, index: number) => ({
          name: cat.name || cat.category,
          value: parseFloat(cat.marketShare || cat.percentage || 0),
          revenue: parseFloat(cat.revenue || 0),
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
        }))
        setCategoryData(transformedData)
      } else {
        setCategoryData([])
      }
    } catch (error) {
      console.error('Error fetching category data:', error)
      setCategoryData([])
    } finally {
      setCategoryLoading(false)
    }
  }, [customer?.customerCode, dateRange])

  useEffect(() => {
    if (isOpen && customer?.customerCode) {
      fetchCustomerDetails()
      fetchCategoryData()
    }
  }, [isOpen, customer?.customerCode, fetchCustomerDetails, fetchCategoryData])

  if (!customer) {
    return null
  }

  const salesTrendData = detailsData?.salesTrend || []
  const topProducts = detailsData?.topProducts || []
  const classification = getClassification(customer.totalSales)
  const channel = getChannel(customer.customerName)

  return (
    <>
      <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className={cn(
          "fixed z-50 grid overflow-y-auto border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 bg-white",
          isMobile
            ? "inset-0 w-full h-full rounded-none p-4"
            : "left-[50%] top-[50%] w-full max-w-6xl max-h-[90vh] translate-x-[-50%] translate-y-[-50%] p-6 rounded-lg data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
        )}>
          <DialogPrimitive.Title className="sr-only">Customer Details</DialogPrimitive.Title>
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <h2 className={cn("font-bold", isMobile ? "text-lg" : "text-2xl")}>{customer.customerName}</h2>
              <div className={cn("flex flex-wrap gap-2 mt-2", isMobile && "text-xs")}>
                <span className="text-gray-600">Code: <strong>{customer.customerCode}</strong></span>
                <Badge className={cn("bg-green-100 text-green-800", isMobile && "text-xs")}>{classification}</Badge>
                <Badge className={cn("bg-blue-100 text-blue-800", isMobile && "text-xs")}>{channel}</Badge>
                <Badge className={cn(
                  customer.status === 'Active' ? 'bg-green-100 text-green-800' :
                  customer.status === 'Blocked' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800',
                  isMobile && "text-xs"
                )}>
                  {customer.status || 'Active'}
                </Badge>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md transition-colors flex-shrink-0">
              <X className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
            </button>
          </div>

        <div className={cn("space-y-6", isMobile ? "mt-4" : "mt-6")}>
          {/* Key Metrics */}
          <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-4")}>
            <Card>
              <CardContent className={cn(isMobile ? "p-3" : "p-4")}>
                <div className={cn("text-gray-600", isMobile ? "text-xs" : "text-sm")}>Total Revenue</div>
                <div className={cn("font-bold", isMobile ? "text-lg" : "text-2xl")}>{formatCurrency(customer.totalSales)}</div>
                <div className="text-xs text-green-600 mt-1">↑ 12.5% vs last period</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className={cn(isMobile ? "p-3" : "p-4")}>
                <div className={cn("text-gray-600", isMobile ? "text-xs" : "text-sm")}>Total Orders</div>
                <div className={cn("font-bold", isMobile ? "text-lg" : "text-2xl")}>{customer.orderCount || 0}</div>
                <div className="text-xs text-gray-500 mt-1">Avg {Math.ceil((customer.orderCount || 0) / 30)}/month</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className={cn(isMobile ? "p-3" : "p-4")}>
                <div className={cn("text-gray-600", isMobile ? "text-xs" : "text-sm")}>Avg Order Value</div>
                <div className={cn("font-bold", isMobile ? "text-lg" : "text-2xl")}>{detailsData?.financial?.currencyCode || 'AED'} {customer.avgOrderValue?.toFixed(0) || 0}</div>
                <div className="text-xs text-orange-600 mt-1">↓ 3.2% vs last period</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className={cn(isMobile ? "p-3" : "p-4")}>
                <div className={cn("text-gray-600", isMobile ? "text-xs" : "text-sm")}>Visit Frequency</div>
                <div className={cn("font-bold", isMobile ? "text-lg" : "text-2xl")}>
                  {detailsData?.financial?.visitsPerWeek ?
                    `${detailsData.financial.visitsPerWeek}/week` : '0/week'}
                </div>
                <div className="text-xs text-gray-500 mt-1">Route: {customer.routeName || `Route ${customer.routeCode}` || 'General Route'}</div>
              </CardContent>
            </Card>
          </div>

          {/* Sales Trend and Category Mix */}
          <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            <Card>
              <CardContent className={cn(isMobile ? "p-3" : "p-4")}>
                <h3 className={cn("font-semibold mb-4", isMobile ? "text-base" : "text-lg")}>12-Month Sales Trend</h3>
                {loading ? (
                  <div className="flex items-center justify-center h-[200px]">
                    <span className="text-gray-500">Loading sales data...</span>
                  </div>
                ) : salesTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={salesTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="sales" stroke={CHART_COLORS.primary} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px]">
                    <span className="text-gray-500">No sales data available</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className={cn(isMobile ? "p-3" : "p-4")}>
                <h3 className={cn("font-semibold mb-4", isMobile ? "text-base" : "text-lg")}>Category Mix</h3>
                {categoryLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <span className="text-gray-500">Loading category data...</span>
                  </div>
                ) : categoryData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ value }) => {
                            // Show 3 decimal places for values < 1%, otherwise 1 decimal place
                            if (value < 1) {
                              return `${value.toFixed(3)}%`
                            }
                            return `${value.toFixed(1)}%`
                          }}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          paddingAngle={2}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => {
                            // Show 3 decimal places for values < 1%, otherwise 1 decimal place
                            if (value < 1) {
                              return [`${value.toFixed(3)}%`, 'Percentage']
                            }
                            return [`${value.toFixed(1)}%`, 'Percentage']
                          }}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                            fontSize: '12px'
                          }}
                        />
                        <Legend
                          wrapperStyle={{
                            paddingTop: '16px',
                            fontSize: '12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[300px]">
                    <span className="text-gray-500">No category data available</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Products */}
          <Card>
            <CardContent className={cn(isMobile ? "p-3" : "p-4")}>
              <h3 className={cn("font-semibold mb-4", isMobile ? "text-base" : "text-lg")}>Top 10 Products</h3>
              {loading ? (
                <div className="flex items-center justify-center h-[200px]">
                  <span className="text-gray-500">Loading product data...</span>
                </div>
              ) : topProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={cn("text-left text-gray-600 border-b", isMobile ? "text-xs" : "text-sm")}>
                        <th className="pb-2">Rank</th>
                        <th className="pb-2">Product</th>
                        <th className="pb-2 text-right">Quantity</th>
                        <th className="pb-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((product: any) => (
                        <tr key={product.rank} className="border-b">
                          <td className={cn("py-2", isMobile && "text-xs")}>#{product.rank}</td>
                          <td className={cn("py-2", isMobile && "text-xs")}>{product.product}</td>
                          <td className={cn("py-2 text-right", isMobile && "text-xs")}>{formatNumber(product.quantity)}</td>
                          <td className={cn("py-2 text-right font-medium", isMobile && "text-xs")}>{formatCurrency(product.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[100px]">
                  <span className="text-gray-500">No product data available</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
    </>
  )
}