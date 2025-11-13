'use client'

import { businessColors } from '@/styles/businessColors'
import React, { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { X, ChevronRight, Loader2, Download } from 'lucide-react'
import { useResponsive } from '@/hooks/useResponsive'
import ExcelJS from 'exceljs'

// Chart colors matching the screenshots
const CHART_COLORS = {
  primary: '#00b4d8',
  secondary: '#0077b6',
  accent: '#90e0ef',
  warning: '#ffd60a',
  danger: '#ef476f',
  success: '#06ffa5',
  info: '#118ab2'
}

// Product Details Modal Component
const ProductDetailsModal: React.FC<{ product: any; onClose: () => void }> = ({ product, onClose }) => {
  if (!product) return null

  const [productDetails, setProductDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch detailed product data when modal opens
  useEffect(() => {
    const fetchProductDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/products/details?itemCode=${product.itemCode}`)
        const result = await response.json()

        if (result.success) {
          setProductDetails(result.data)
        } else {
          setError(result.error || 'Failed to load product details')
        }
      } catch (err) {
        console.error('Error fetching product details:', err)
        setError('Failed to load product details')
      } finally {
        setLoading(false)
      }
    }

    if (product.itemCode) {
      fetchProductDetails()
    }
  }, [product.itemCode])

  // Transform API data for charts
  const salesTrendData = productDetails?.salesTrend?.map((item: any) => ({
    month: new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    sales: item.salesAmount,
    units: item.unitsSold
  })) || []

  const channelData = productDetails?.channelDistribution?.map((item: any, index: number) => ({
    name: item.channel,
    value: item.unitsSold,
    revenue: item.revenue,
    color: Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length]
  })) || []

  const stockMovementData = productDetails?.stockMovements?.map((item: any) => ({
    day: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
    inbound: item.inbound,
    outbound: item.outbound
  })) || []

  const topCustomers = productDetails?.customerHistory?.map((item: any, index: number) => ({
    rank: index + 1,
    customer: item.customerName,
    quantity: item.totalQuantity,
    revenue: item.totalRevenue
  })) || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-start z-50">
          <div>
            <h2 className="text-2xl font-bold">{product.itemDescription || 'Product Name'}</h2>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-gray-600">SKU: <strong>{product.itemCode}</strong></span>
              <span className="text-gray-600">Barcode: <strong>{product.barcode || 'Not available'}</strong></span>
              <Badge className={`${
                product.movement === 'Fast' ? "bg-green-100 text-green-800" :
                product.movement === 'Slow' ? "bg-yellow-100 text-yellow-800" :
                product.movement === 'Medium' ? "bg-blue-100 text-blue-800" :
                "bg-gray-100 text-gray-800"
              }`}>{product.movement || 'Unknown'} Moving</Badge>
              <Badge className="bg-blue-100 text-blue-800">Active</Badge>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Brand: <strong>{product.brandCode || 'Not available'}</strong> |
              Category: <strong>{product.category || 'Not available'}</strong> |
              UOM: <strong>{product.baseUOM || 'PCS'}</strong>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-600">Total Sales (30d)</div>
                <div className="text-2xl font-bold">
                  AED {loading ? '...' : (productDetails?.product?.metrics?.salesAmount30d || 0).toLocaleString()}
                </div>
                <div className="text-xs text-green-600">
                  {loading ? 'Loading...' : `${productDetails?.product?.metrics?.quantitySold30d || 0} units sold`}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-600">Units Sold (30d)</div>
                <div className="text-2xl font-bold">
                  {loading ? '...' : (productDetails?.product?.metrics?.quantitySold30d || 0).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  {loading ? 'Loading...' : `${productDetails?.product?.metrics?.ordersCount30d || 0} orders`}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-600">Avg Selling Price</div>
                <div className="text-2xl font-bold">
                  AED {loading ? '...' : (productDetails?.product?.metrics?.avgSellingPrice || 0).toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">Per unit</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-gray-600">Performance</div>
                <div className="text-2xl font-bold">
                  {loading ? '...' : (productDetails?.product?.performance || 'Unknown')}
                </div>
                <div className="text-xs text-gray-500">Category</div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">12-Month Sales Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-[250px] text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : salesTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={salesTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" orientation="left" tickFormatter={(v) => `AED ${(v/1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v} units`} />
                      <Tooltip
                        formatter={(value: any, name: string) => [
                          name === 'sales' ? `AED ${value.toLocaleString()}` : `${value} units`,
                          name === 'sales' ? 'Sales' : 'Units'
                        ]}
                      />
                      <Line yAxisId="left" type="monotone" dataKey="sales" stroke={businessColors.primary[600]} strokeWidth={2} />
                      <Line yAxisId="right" type="monotone" dataKey="units" stroke={businessColors.success.main} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-gray-500">
                    <div className="text-center">
                      <div className="text-lg font-medium">No Sales Trend Data</div>
                      <div className="text-sm">No historical sales data found for this product</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sales by Channel</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-[250px] text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : channelData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={channelData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {channelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [`${value} units`, 'Units Sold']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {channelData.map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                            <span>{item.name}</span>
                          </div>
                          <span className="font-medium">AED {item.revenue.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-gray-500">
                    <div className="text-center">
                      <div className="text-lg font-medium">No Channel Data</div>
                      <div className="text-sm">No channel distribution data found for this product</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>


          {/* Top Customers Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top 10 Customers</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[200px] text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : topCustomers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCustomers.map((customer) => (
                      <TableRow key={customer.rank}>
                        <TableCell>#{customer.rank}</TableCell>
                        <TableCell>{customer.customer}</TableCell>
                        <TableCell className="text-right">{customer.quantity.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">AED {customer.revenue.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-gray-500">
                  <div className="text-center">
                    <div className="text-lg font-medium">No Customer Data</div>
                    <div className="text-sm">No customer purchase data found for this product</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Main ProductAnalysis Component
export const ProductAnalysisNew: React.FC = () => {
  const { isMobile, styles } = useResponsive()
  const [activeView, setActiveView] = useState<'summary' | 'hierarchy' | 'detailed'>('summary')
  const [selectedPeriod, setSelectedPeriod] = useState('lastMonth')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [selectedMovement, setSelectedMovement] = useState('all')
  const [sortBy, setSortBy] = useState('sales')
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  

  // Real data from API calls
  const [productsData, setProductsData] = useState<any[]>([])
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Extract unique filter options from API data
  const availableCategories = useMemo(() => {
    if (!analyticsData?.salesByCategory) return []
    return analyticsData.salesByCategory.map((item: any) => item.category).filter(Boolean)
  }, [analyticsData])

  const availableBrands = useMemo(() => {
    if (!analyticsData?.topBrands) return []
    return analyticsData.topBrands.map((item: any) => item.name).filter(Boolean)
  }, [analyticsData])

  const availableMovements = useMemo(() => {
    if (!analyticsData?.productHierarchy) return []
    return analyticsData.productHierarchy.map((item: any) => item.movement).filter(Boolean)
  }, [analyticsData])

  // Fetch product analytics data from API
  useEffect(() => {
    const fetchProductData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch product analytics data with unique timestamp to prevent caching
        const timestamp = Date.now()
        const apiUrl = `/api/products/analytics?dateRange=${selectedPeriod}&category=${selectedCategory}&brand=${selectedBrand}&movement=${selectedMovement}&sortBy=${sortBy}&search=${searchQuery}&_t=${timestamp}`
        console.log('🔄 Fetching products with URL:', apiUrl)
        const analyticsResponse = await fetch(apiUrl)

        if (!analyticsResponse.ok) {
          throw new Error('Failed to fetch product analytics')
        }

        const analyticsResult = await analyticsResponse.json()

        if (analyticsResult.success) {
          console.log('✅ API Response:', {
            totalProducts: analyticsResult.data.metrics?.totalProducts,
            timestamp: analyticsResult.timestamp,
            filters: { selectedCategory, selectedBrand, selectedMovement }
          })
          setAnalyticsData(analyticsResult.data)
          setProductsData(analyticsResult.data.products || [])
        } else {
          throw new Error(analyticsResult.message || 'Failed to load product data')
        }
      } catch (err) {
        console.error('Error fetching product data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load product data')
        // Set empty data when API fails
        setAnalyticsData(null)
        setProductsData([])
      } finally {
        setLoading(false)
      }
    }

    fetchProductData()
  }, [selectedPeriod, selectedCategory, selectedBrand, selectedMovement, sortBy, searchQuery])

  // Calculate metrics from real API data
  const metrics = useMemo(() => {
    if (!analyticsData || !analyticsData.metrics) {
      return {
        totalProducts: 0,
        activeProducts: 0,
        totalSales: 0,
        totalUnits: 0,
        fastMoving: 0,
        slowMoving: 0,
        outOfStock: 0
      }
    }

    // Use real metrics from API
    const apiMetrics = analyticsData.metrics
    const hierarchy = analyticsData.productHierarchy || []

    const fastMoving = hierarchy.find(h => h.movement === 'Fast')?.count || 0
    const slowMoving = hierarchy.find(h => h.movement === 'Slow')?.count || 0

    return {
      totalProducts: apiMetrics.totalProducts || 0,
      activeProducts: apiMetrics.activeProducts || 0,
      totalSales: apiMetrics.totalSales || 0,
      totalUnits: apiMetrics.totalQuantity || 0,
      fastMoving: fastMoving,
      slowMoving: slowMoving,
      outOfStock: 0 // Not available in current API
    }
  }, [analyticsData])

  // Sales by Category data from API
  const salesByCategoryData = useMemo(() => {
    if (!analyticsData || !analyticsData.salesByCategory) {
      return [{ name: 'No data available', value: 0 }]
    }
    return analyticsData.salesByCategory.map((item: any) => ({
      name: item.category || 'Unknown',
      value: parseFloat(item.sales) || 0
    }))
  }, [analyticsData])

  // Top 10 Brands data from API
  const topBrandsData = useMemo(() => {
    if (!analyticsData || !analyticsData.topBrands) {
      return [{ name: 'No data available', revenue: 0, products: 0, units: 0 }]
    }
    return analyticsData.topBrands.map((item: any) => ({
      name: item.name || 'Unknown',
      revenue: parseFloat(item.sales) || 0,
      products: parseInt(item.products) || 0,
      units: parseInt(item.quantity) || 0
    }))
  }, [analyticsData])

  // Real product data for table - filtering handled by API
  const filteredProducts = useMemo(() => {
    if (!productsData || productsData.length === 0) {
      return []
    }

    // Return ALL products from API (filtering is done server-side)
    return productsData.map((product: any, index: number) => ({
      itemCode: product.code || product.itemCode || '',
      itemDescription: product.name || product.itemDescription || 'Unknown Product',
      itemArabicDescription: product.arabicDescription || product.description || '',
      category: product.category || 'Unknown',
      brandCode: product.brand || product.brandCode || 'Unknown',
      totalRevenue: parseFloat(product.sales) || parseFloat(product.totalRevenue) || 0,
      totalQuantitySold: parseFloat(product.quantity) || parseFloat(product.totalQuantitySold) || 0,
      price: parseFloat(product.avgPrice) || parseFloat(product.price) || 0,
      stock: 0, // Not available in current API
      movement: product.movement || 'Unknown',
      status: product.isActive ? 'Active' : 'Inactive',
      barcode: product.barcode || product.itemCode || '',
      baseUOM: product.baseUOM || 'PCS',
      uniqueKey: `${product.code || product.itemCode}-${index}` // Create unique key for React
    }))
  }, [productsData])

  // Hierarchy data from API - using salesByCategory data
  const hierarchyData = useMemo(() => {
    if (!analyticsData || !analyticsData.salesByCategory) {
      return [{ level: 'No data available', value: 0, percentage: 0, sales: 0 }]
    }

    const totalCount = analyticsData.salesByCategory.reduce((sum: number, item: any) => sum + (parseInt(item.product_count) || 0), 0)

    return analyticsData.salesByCategory.map((item: any) => {
      const count = parseInt(item.product_count) || 0
      return {
        level: item.category || 'Unknown',
        value: count,
        percentage: totalCount > 0 ? parseFloat(((count / totalCount) * 100).toFixed(2)) : 0.00,
        sales: parseFloat(item.sales) || 0
      }
    }).sort((a, b) => b.sales - a.sales) // Sort by sales descending
  }, [analyticsData])

  // Export Top 10 Brands to Excel
  const exportTopBrandsToExcel = async () => {
    if (!topBrandsData || topBrandsData.length === 0 || topBrandsData[0].name === 'No data available') {
      alert('No brand data available to export')
      return
    }

    try {
      // Create workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Top Brands')

      // Set column widths
      worksheet.columns = [
        { width: 8 },  // Rank
        { width: 30 }, // Brand Name
        { width: 18 }, // Revenue
        { width: 15 }, // Products
        { width: 15 }  // Units Sold
      ]

      let currentRow = 1

      // Title
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`)
      const titleCell = worksheet.getCell(`A${currentRow}`)
      titleCell.value = 'Top Brands Report'
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF1E40AF' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7FF' }
      }
      worksheet.getRow(currentRow).height = 30
      currentRow++

      // Period Info
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`)
      const periodCell = worksheet.getCell(`A${currentRow}`)
      const periodLabel = selectedPeriod === 'lastMonth' ? 'Last Month' :
                         selectedPeriod === 'lastQuarter' ? 'Last Quarter' :
                         selectedPeriod.replace(/([A-Z])/g, ' $1').trim()
      periodCell.value = `Period: ${periodLabel}`
      periodCell.font = { size: 12, bold: true }
      periodCell.alignment = { horizontal: 'center', vertical: 'middle' }
      periodCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Empty row
      currentRow++

      // Summary Section
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`)
      const summaryTitleCell = worksheet.getCell(`A${currentRow}`)
      summaryTitleCell.value = 'Summary Statistics'
      summaryTitleCell.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } }
      summaryTitleCell.alignment = { horizontal: 'left', vertical: 'middle' }
      summaryTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Summary stats
      const totalRevenue = topBrandsData.reduce((sum, brand) => sum + brand.revenue, 0)
      const totalProducts = topBrandsData.reduce((sum, brand) => sum + brand.products, 0)
      const totalUnits = topBrandsData.reduce((sum, brand) => sum + brand.units, 0)
      const totalBrands = topBrandsData.length

      worksheet.getCell(`A${currentRow}`).value = 'Total Brands'
      worksheet.getCell(`A${currentRow}`).font = { bold: true }
      worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`B${currentRow}`).value = totalBrands
      worksheet.getCell(`B${currentRow}`).font = { bold: true, size: 12 }
      worksheet.getCell(`B${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`C${currentRow}`).value = 'Total Revenue'
      worksheet.getCell(`C${currentRow}`).font = { bold: true }
      worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`D${currentRow}`).value = `AED ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      worksheet.getCell(`D${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF2563EB' } }
      worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getRow(currentRow).height = 20
      currentRow++

      // Second row of summary
      worksheet.getCell(`A${currentRow}`).value = 'Total Products'
      worksheet.getCell(`A${currentRow}`).font = { bold: true }
      worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`B${currentRow}`).value = totalProducts
      worksheet.getCell(`B${currentRow}`).font = { bold: true, size: 12 }
      worksheet.getCell(`B${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`C${currentRow}`).value = 'Total Units Sold'
      worksheet.getCell(`C${currentRow}`).font = { bold: true }
      worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`D${currentRow}`).value = totalUnits.toLocaleString()
      worksheet.getCell(`D${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF059669' } }
      worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getRow(currentRow).height = 20
      currentRow++

      // Empty rows
      currentRow++
      currentRow++

      // Table Header
      const headerRow = worksheet.getRow(currentRow)
      headerRow.values = [
        'Rank',
        'Brand Name',
        'Revenue (AED)',
        'Products',
        'Units Sold'
      ]
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25

      // Add borders to header
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
        }
      })
      currentRow++

      // Data rows
      topBrandsData.forEach((brand, index) => {
        const row = worksheet.getRow(currentRow)
        row.values = [
          index + 1,
          brand.name,
          brand.revenue.toFixed(2),
          brand.products,
          brand.units
        ]

        // Alternating row colors
        const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB'
        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          }
          cell.alignment = { vertical: 'middle' }

          // Center align numeric columns
          if (colNumber === 1 || colNumber >= 3) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          }

          // Special formatting for revenue
          if (colNumber === 3) {
            cell.font = { color: { argb: 'FF2563EB' }, bold: true }
          }

          // Special formatting for top 3
          if (index < 3) {
            cell.font = { ...cell.font, bold: true }
          }
        })

        row.height = 20
        currentRow++
      })

      // Add footer with totals
      currentRow++
      const footerRow = worksheet.getRow(currentRow)
      footerRow.values = [
        '',
        'TOTAL',
        totalRevenue.toFixed(2),
        totalProducts,
        totalUnits
      ]
      footerRow.font = { bold: true, size: 11 }
      footerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      footerRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF6B7280' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'medium', color: { argb: 'FF6B7280' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
        }
        if (colNumber >= 2) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      })
      footerRow.height = 25

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Top_Brands_${periodLabel.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  // Export Product Distribution by Category to Excel
  const exportCategoryDistributionToExcel = async () => {
    if (!hierarchyData || hierarchyData.length === 0 || hierarchyData[0].level === 'No data available') {
      alert('No category data available to export')
      return
    }

    try {
      // Create workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Product Distribution by Category')

      // Set column widths
      worksheet.columns = [
        { width: 8 },  // Rank
        { width: 35 }, // Category Name
        { width: 15 }, // Products Count
        { width: 15 }, // Percentage
        { width: 18 }  // Sales
      ]

      let currentRow = 1

      // Title
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`)
      const titleCell = worksheet.getCell(`A${currentRow}`)
      titleCell.value = 'Product Distribution by Category'
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF1E40AF' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7FF' }
      }
      worksheet.getRow(currentRow).height = 30
      currentRow++

      // Period Info
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`)
      const periodCell = worksheet.getCell(`A${currentRow}`)
      const periodLabel = selectedPeriod === 'lastMonth' ? 'Last Month' :
                         selectedPeriod === 'lastQuarter' ? 'Last Quarter' :
                         selectedPeriod.replace(/([A-Z])/g, ' $1').trim()
      periodCell.value = `Period: ${periodLabel}`
      periodCell.font = { size: 12, bold: true }
      periodCell.alignment = { horizontal: 'center', vertical: 'middle' }
      periodCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Empty row
      currentRow++

      // Summary Section
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`)
      const summaryTitleCell = worksheet.getCell(`A${currentRow}`)
      summaryTitleCell.value = 'Summary Statistics'
      summaryTitleCell.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } }
      summaryTitleCell.alignment = { horizontal: 'left', vertical: 'middle' }
      summaryTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Summary stats
      const totalProducts = hierarchyData.reduce((sum, item) => sum + item.value, 0)
      const totalSales = hierarchyData.reduce((sum, item) => sum + item.sales, 0)
      const totalCategories = hierarchyData.length

      worksheet.getCell(`A${currentRow}`).value = 'Total Categories'
      worksheet.getCell(`A${currentRow}`).font = { bold: true }
      worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`B${currentRow}`).value = totalCategories
      worksheet.getCell(`B${currentRow}`).font = { bold: true, size: 12 }
      worksheet.getCell(`B${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`C${currentRow}`).value = 'Total Products'
      worksheet.getCell(`C${currentRow}`).font = { bold: true }
      worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`D${currentRow}`).value = totalProducts
      worksheet.getCell(`D${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF059669' } }
      worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getRow(currentRow).height = 20
      currentRow++

      // Second row of summary
      worksheet.getCell(`A${currentRow}`).value = 'Total Sales'
      worksheet.getCell(`A${currentRow}`).font = { bold: true }
      worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`B${currentRow}`).value = `AED ${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      worksheet.getCell(`B${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF2563EB' } }
      worksheet.getCell(`B${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getCell(`C${currentRow}`).value = 'Avg Products/Category'
      worksheet.getCell(`C${currentRow}`).font = { bold: true }
      worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      worksheet.getCell(`D${currentRow}`).value = Math.round(totalProducts / totalCategories)
      worksheet.getCell(`D${currentRow}`).font = { bold: true, size: 12 }
      worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

      worksheet.getRow(currentRow).height = 20
      currentRow++

      // Empty rows
      currentRow++
      currentRow++

      // Table Header
      const headerRow = worksheet.getRow(currentRow)
      headerRow.values = [
        'Rank',
        'Category',
        'Products',
        'Percentage (%)',
        'Sales (AED)'
      ]
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25

      // Add borders to header
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
        }
      })
      currentRow++

      // Data rows
      hierarchyData.forEach((item, index) => {
        const row = worksheet.getRow(currentRow)
        row.values = [
          index + 1,
          item.level,
          item.value,
          item.percentage.toFixed(2),
          item.sales.toFixed(2)
        ]

        // Alternating row colors
        const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB'
        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          }
          cell.alignment = { vertical: 'middle' }

          // Center align numeric columns
          if (colNumber === 1 || colNumber >= 3) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          }

          // Special formatting for sales
          if (colNumber === 5) {
            cell.font = { color: { argb: 'FF2563EB' }, bold: true }
          }

          // Special formatting for top 3
          if (index < 3) {
            cell.font = { ...cell.font, bold: true }
          }
        })

        row.height = 20
        currentRow++
      })

      // Add footer with totals
      currentRow++
      const footerRow = worksheet.getRow(currentRow)
      footerRow.values = [
        '',
        'TOTAL',
        totalProducts,
        '100.00',
        totalSales.toFixed(2)
      ]
      footerRow.font = { bold: true, size: 11 }
      footerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      footerRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF6B7280' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'medium', color: { argb: 'FF6B7280' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
        }
        if (colNumber >= 2) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      })
      footerRow.height = 25

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Product_Distribution_by_Category_${periodLabel.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  // Export Detailed Products List to Excel
  const exportDetailedProductsToExcel = async () => {
    try {
      // Fetch ALL products with current filters (bypass pagination)
      const timestamp = Date.now()
      const apiUrl = `/api/products/analytics?dateRange=${selectedPeriod}&category=${selectedCategory}&brand=${selectedBrand}&movement=${selectedMovement}&sortBy=${sortBy}&search=${searchQuery}&limit=100000&_t=${timestamp}`

      const response = await fetch(apiUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch products data')
      }

      const result = await response.json()
      if (!result.success || !result.data.products) {
        throw new Error('No products data available')
      }

      const allProducts = result.data.products
      const metricsData = result.data.metrics

      // Create workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Detailed Products List')

      // Set column widths
      worksheet.columns = [
        { width: 15 },  // Item Code
        { width: 35 },  // Description
        { width: 20 },  // Category
        { width: 15 },  // Brand
        { width: 15 },  // Sales
        { width: 12 },  // Qty Sold
        { width: 12 },  // Price
        { width: 12 },  // Movement
        { width: 12 }   // Status
      ]

      let currentRow = 1

      // Title
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`)
      const titleCell = worksheet.getCell(`A${currentRow}`)
      titleCell.value = 'Detailed Products List'
      titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4788' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      currentRow++

      // Period Info
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`)
      const periodCell = worksheet.getCell(`A${currentRow}`)
      const periodLabel = selectedPeriod === 'lastMonth' ? 'Last Month' : selectedPeriod === 'lastQuarter' ? 'Last Quarter' : selectedPeriod
      periodCell.value = `Period: ${periodLabel}`
      periodCell.font = { size: 12, bold: true }
      periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      periodCell.alignment = { horizontal: 'center', vertical: 'middle' }
      currentRow++

      // Active Filters Section
      const activeFilters = []
      if (searchQuery) activeFilters.push(`Search: "${searchQuery}"`)
      if (selectedCategory !== 'all') activeFilters.push(`Category: ${selectedCategory}`)
      if (selectedBrand !== 'all') activeFilters.push(`Brand: ${selectedBrand}`)
      if (selectedMovement !== 'all') activeFilters.push(`Movement: ${selectedMovement} Moving`)
      if (sortBy !== 'sales') activeFilters.push(`Sort By: ${sortBy}`)

      if (activeFilters.length > 0) {
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`)
        const filtersCell = worksheet.getCell(`A${currentRow}`)
        filtersCell.value = 'Active Filters: ' + activeFilters.join(' | ')
        filtersCell.font = { size: 10, italic: true, color: { argb: 'FF0066CC' } }
        filtersCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBE5F1' } }
        filtersCell.alignment = { horizontal: 'left', vertical: 'middle' }
        currentRow++
      }

      currentRow++

      // Summary Statistics
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`)
      const summaryTitleCell = worksheet.getCell(`A${currentRow}`)
      summaryTitleCell.value = 'Summary Statistics'
      summaryTitleCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
      summaryTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7030A0' } }
      summaryTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      currentRow++

      // Summary Stats Row 1
      const summaryStats = [
        ['Total Products:', allProducts.length.toLocaleString(), 'Total Sales:', `AED ${(metricsData.totalSales / 1000).toFixed(2)}k`],
        ['Total Quantity:', metricsData.totalQuantity.toLocaleString(), 'Average Price:', `AED ${parseFloat(metricsData.avgPrice).toFixed(2)}`]
      ]

      summaryStats.forEach(stats => {
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`)
        worksheet.getCell(`A${currentRow}`).value = stats[0]
        worksheet.getCell(`A${currentRow}`).font = { bold: true }
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        worksheet.mergeCells(`C${currentRow}:D${currentRow}`)
        worksheet.getCell(`C${currentRow}`).value = stats[1]
        worksheet.getCell(`C${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
        worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        worksheet.mergeCells(`E${currentRow}:F${currentRow}`)
        worksheet.getCell(`E${currentRow}`).value = stats[2]
        worksheet.getCell(`E${currentRow}`).font = { bold: true }
        worksheet.getCell(`E${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        worksheet.mergeCells(`G${currentRow}:I${currentRow}`)
        worksheet.getCell(`G${currentRow}`).value = stats[3]
        worksheet.getCell(`G${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
        worksheet.getCell(`G${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }

        currentRow++
      })

      currentRow++

      // Table Header
      const headers = ['Item Code', 'Description', 'Category', 'Brand', 'Sales (AED)', 'Qty Sold', 'Price (AED)', 'Movement', 'Status']
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1)
        cell.value = header
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4788' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
      currentRow++

      // Data Rows
      allProducts.forEach((product, index) => {
        const row = worksheet.getRow(currentRow)

        row.getCell(1).value = product.itemCode || ''
        row.getCell(2).value = product.itemDescription || ''
        row.getCell(3).value = product.category || ''
        row.getCell(4).value = product.brandCode || ''
        row.getCell(5).value = parseFloat(product.totalRevenue || 0)
        row.getCell(5).numFmt = '#,##0.00'
        row.getCell(6).value = parseInt(product.totalQuantitySold || 0)
        row.getCell(6).numFmt = '#,##0'
        row.getCell(7).value = parseFloat(product.price || 0)
        row.getCell(7).numFmt = '#,##0.00'
        row.getCell(8).value = product.movement || ''
        row.getCell(9).value = product.status || 'Active'

        // Alternating row colors
        const fillColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8F9FA'
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
          cell.alignment = { vertical: 'middle' }
        })

        // Color coding for movement
        if (product.movement === 'Fast') {
          row.getCell(8).font = { bold: true, color: { argb: 'FF008000' } }
        } else if (product.movement === 'Slow') {
          row.getCell(8).font = { bold: true, color: { argb: 'FFF59E0B' } }
        } else if (product.movement === 'Medium') {
          row.getCell(8).font = { bold: true, color: { argb: 'FF3B82F6' } }
        }

        currentRow++
      })

      // Footer with totals
      currentRow++
      worksheet.mergeCells(`A${currentRow}:D${currentRow}`)
      const footerCell = worksheet.getCell(`A${currentRow}`)
      footerCell.value = `Total: ${allProducts.length} products`
      footerCell.font = { bold: true, size: 12 }
      footerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      footerCell.alignment = { horizontal: 'center', vertical: 'middle' }

      const totalSales = allProducts.reduce((sum, p) => sum + parseFloat(p.totalRevenue || 0), 0)
      const totalQty = allProducts.reduce((sum, p) => sum + parseInt(p.totalQuantitySold || 0), 0)

      worksheet.getCell(`E${currentRow}`).value = totalSales
      worksheet.getCell(`E${currentRow}`).numFmt = '#,##0.00'
      worksheet.getCell(`E${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
      worksheet.getCell(`E${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      worksheet.getCell(`E${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' }

      worksheet.getCell(`F${currentRow}`).value = totalQty
      worksheet.getCell(`F${currentRow}`).numFmt = '#,##0'
      worksheet.getCell(`F${currentRow}`).font = { bold: true, color: { argb: 'FF0066CC' } }
      worksheet.getCell(`F${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } }
      worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' }

      // Generate and download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Detailed_Products_List_${periodLabel.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting products to Excel:', error)
      alert('Failed to export products. Please try again.')
    }
  }

  // Loading and error states
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading product data...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Product Data</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Empty state if no data
  if (!analyticsData && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Product Data Available</h2>
              <p className="text-gray-600">No product data found for the selected period. Try selecting a different time range.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Create unique key based on filters to force re-render when filters change
  const componentKey = `${selectedPeriod}-${selectedCategory}-${selectedBrand}-${selectedMovement}-${sortBy}-${searchQuery}`

  return (
    <div key={componentKey} className={`${isMobile ? 'p-4' : 'p-6'} space-y-6 bg-gray-50 min-h-screen`}>
      {/* Header */}
      <div>
        <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold`}>Product Analysis</h1>
        <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''} mt-1`}>
          Analyzing {metrics.totalProducts.toLocaleString()} products across all categories and brands
        </p>
      </div>

      {/* Period Selector */}
      <div className={`flex ${isMobile ? 'flex-col gap-2' : 'justify-end'}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Period:</span>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className={isMobile ? 'w-full' : 'w-40'}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" disabled>Today</SelectItem>
              <SelectItem value="yesterday" disabled>Yesterday</SelectItem>
              <SelectItem value="last7Days" disabled>Last 7 Days</SelectItem>
              <SelectItem value="thisMonth" disabled>This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="lastQuarter">Last Quarter</SelectItem>
              <SelectItem value="thisYear" disabled>This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-6'} gap-4`}>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Total Products</div>
            <div className="text-2xl font-bold">{metrics.totalProducts.toLocaleString()}</div>
            <div className="text-xs text-green-600">{metrics.activeProducts.toLocaleString()} active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Total Sales</div>
            <div className="text-2xl font-bold">
              AED {(metrics.totalSales / 1000000).toFixed(1)}M
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Units Sold</div>
            <div className="text-2xl font-bold">
              {(metrics.totalUnits / 1000).toFixed(0)}K
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Fast Moving</div>
            <div className="text-2xl font-bold text-green-600">{metrics.fastMoving.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Slow Moving</div>
            <div className="text-2xl font-bold text-yellow-600">{metrics.slowMoving.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-gray-600">Out of Stock</div>
            <div className="text-2xl font-bold text-red-600">{metrics.outOfStock}</div>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy View</TabsTrigger>
          <TabsTrigger value="detailed">Detailed List</TabsTrigger>
        </TabsList>

        {/* Summary View */}
        <TabsContent value="summary" className="space-y-6 mt-6">
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-6`}>
            {/* Sales by Brand Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Sales by Brand</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topBrandsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(v) => `AED ${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                              <p className="font-semibold text-gray-800">{data.name}</p>
                              <p className="text-sm text-blue-600">Sales: AED {(data.revenue/1000).toFixed(1)}k</p>
                              <p className="text-sm text-green-600">Units: {data.units.toLocaleString()}</p>
                              <p className="text-sm text-gray-600">Products: {data.products}</p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="revenue" fill={businessColors.primary[600]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top 10 Brands */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Top 10 Brands</CardTitle>
                  <Button
                    onClick={exportTopBrandsToExcel}
                    disabled={!topBrandsData || topBrandsData.length === 0 || topBrandsData[0].name === 'No data available'}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topBrandsData.map((brand, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border-l-4 hover:bg-gray-50"
                         style={{ borderColor: Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length] }}>
                      <div>
                        <div className="font-medium">{brand.name}</div>
                        <div className="text-sm text-gray-600">
                          {brand.products} products • {(brand.units / 1000).toFixed(0)}k units
                        </div>
                      </div>
                      <div className="text-lg font-bold">
                        AED {(brand.revenue / 1000).toFixed(0)}k
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Hierarchy View */}
        <TabsContent value="hierarchy" className="space-y-6 mt-6">
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-6`}>
            {/* Category Sales Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Category Sales Distribution</CardTitle>
                <CardDescription>Revenue contribution by product category</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={salesByCategoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${((value / metrics.totalSales) * 100).toFixed(1)}%`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {salesByCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => `AED ${(value/1000).toFixed(1)}k`}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {salesByCategoryData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm p-2 rounded hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length] }} />
                        <span className="truncate">{item.name}</span>
                      </div>
                      <span className="font-medium">AED {(item.value/1000).toFixed(1)}k</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Product Distribution by Category */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Product Distribution by Category</CardTitle>
                    <CardDescription>Number of products and their sales performance</CardDescription>
                  </div>
                  <Button
                    onClick={exportCategoryDistributionToExcel}
                    disabled={!hierarchyData || hierarchyData.length === 0 || hierarchyData[0].level === 'No data available'}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {hierarchyData.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length] }} />
                          <span className="font-medium">{item.level}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{item.value.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">products</div>
                        </div>
                      </div>
                      <div className="relative h-6 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="absolute left-0 top-0 h-full transition-all duration-500"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length]
                          }}
                        />
                        <div className="absolute inset-0 flex items-center px-2">
                          <span className="text-xs font-medium text-gray-700">{item.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                      {item.sales && (
                        <div className="text-sm text-gray-600">
                          Sales: AED {(item.sales/1000).toFixed(1)}k
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Product Movement Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Product Movement Analysis</CardTitle>
              <CardDescription>Distribution of products by sales velocity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {analyticsData?.productHierarchy?.map((item: any, index: number) => {
                  const colors = {
                    'Fast': 'bg-green-100 border-green-500 text-green-700',
                    'Medium': 'bg-blue-100 border-blue-500 text-blue-700',
                    'Slow': 'bg-yellow-100 border-yellow-500 text-yellow-700',
                    'Non': 'bg-gray-100 border-gray-500 text-gray-700'
                  }
                  const colorClass = colors[item.movement] || colors['Non']

                  return (
                    <div key={index} className={`p-4 rounded-lg border-2 ${colorClass}`}>
                      <div className="text-2xl font-bold">{item.count}</div>
                      <div className="font-medium">{item.movement} Moving</div>
                      <div className="text-sm mt-2">
                        Sales: AED {(item.sales/1000).toFixed(1)}k
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detailed List View */}
        <TabsContent value="detailed" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-4">
                <Input
                  placeholder="Name, code, barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                />
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {availableCategories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {availableBrands.map((brand) => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedMovement} onValueChange={setSelectedMovement}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {availableMovements.map((movement) => (
                      <SelectItem key={movement} value={movement}>{movement} Moving</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="quantity">Quantity</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={exportDetailedProductsToExcel}
                  disabled={!productsData || productsData.length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                Showing {filteredProducts.length.toLocaleString()} of {metrics.totalProducts.toLocaleString()} products
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Qty Sold</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.uniqueKey || product.itemCode}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => setSelectedProduct(product)}>
                      <TableCell className="font-medium text-blue-600">
                        {product.itemCode}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{product.itemDescription}</div>
                          <div className="text-xs text-gray-500">{product.barcode}</div>
                        </div>
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>{product.brandCode}</TableCell>
                      <TableCell className="text-right font-medium">
                        AED {(product.totalRevenue / 1000).toFixed(1)}k
                      </TableCell>
                      <TableCell className="text-right">
                        {product.totalQuantitySold.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">AED {product.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{product.stock}</TableCell>
                      <TableCell>
                        <Badge className={`${
                          product.movement === 'Fast' ? "bg-green-100 text-green-800" :
                          product.movement === 'Slow' ? "bg-yellow-100 text-yellow-800" :
                          "bg-blue-100 text-blue-800"
                        }`}>
                          {product.movement}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Product Details Modal */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  )
}