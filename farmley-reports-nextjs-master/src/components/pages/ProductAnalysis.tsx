'use client'

import React, { useState, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { businessColors } from '@/styles/businessColors'
import { ProductScorecard } from '../ProductScorecard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useTopProducts } from '@/hooks/useDataService'
import { RefreshCw, Package, TrendingUp, DollarSign, BarChart3 } from 'lucide-react'

export const ProductAnalysis: React.FC = () => {
  const [sortBy, setSortBy] = useState('revenue')
  const [filterCategory, setFilterCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [timeRange, setTimeRange] = useState('30days')

  // Fetch real product data from database
  const { data: topProductsData, loading, refresh } = useTopProducts(200) // Get more products for analysis

  // Process product data for analysis
  const processedData = useMemo(() => {
    if (!topProductsData) return {
      products: [],
      categoryAnalysis: [],
      brandAnalysis: [],
      performanceData: [],
      metrics: { total: 0, active: 0, avgPrice: 0, totalRevenue: 0, totalQuantity: 0 }
    }

    // Filter products based on search and filters
    let filtered = topProductsData
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.itemDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.itemCode?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(p => p.category === filterCategory)
    }

    // Sort products
    const sorted = [...filtered].sort((a, b) => {
      switch(sortBy) {
        case 'revenue':
          return (b.totalRevenue || 0) - (a.totalRevenue || 0)
        case 'quantity':
          return (b.totalQuantitySold || 0) - (a.totalQuantitySold || 0)
        case 'name':
          return (a.itemDescription || '').localeCompare(b.itemDescription || '')
        case 'price':
          return (b.price || 0) - (a.price || 0)
        default:
          return 0
      }
    })

    // Analyze by category
    const categoryAnalysis: { [key: string]: { count: number, revenue: number, quantity: number } } = {}
    filtered.forEach(product => {
      const category = product.category || 'Uncategorized'
      if (!categoryAnalysis[category]) {
        categoryAnalysis[category] = { count: 0, revenue: 0, quantity: 0 }
      }
      categoryAnalysis[category].count++
      categoryAnalysis[category].revenue += product.totalRevenue || 0
      categoryAnalysis[category].quantity += product.totalQuantitySold || 0
    })

    const categoryData = Object.entries(categoryAnalysis)
      .slice(0, 8)
      .map(([name, data]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        revenue: data.revenue,
        quantity: data.quantity,
        count: data.count
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // Analyze by brand
    const brandAnalysis: { [key: string]: number } = {}
    filtered.forEach(product => {
      const brand = product.brandCode || 'Unknown'
      brandAnalysis[brand] = (brandAnalysis[brand] || 0) + (product.totalRevenue || 0)
    })

    const brandData = Object.entries(brandAnalysis)
      .slice(0, 5)
      .map(([name, revenue]) => ({
        name,
        value: revenue
      }))
      .sort((a, b) => b.value - a.value)

    // Performance classification
    const performanceData = [
      {
        name: 'Top Performers',
        value: filtered.filter(p => (p.totalRevenue || 0) > 10000).length,
        revenue: filtered.filter(p => (p.totalRevenue || 0) > 10000).reduce((sum, p) => sum + (p.totalRevenue || 0), 0)
      },
      {
        name: 'Good Sellers',
        value: filtered.filter(p => (p.totalRevenue || 0) > 5000 && (p.totalRevenue || 0) <= 10000).length,
        revenue: filtered.filter(p => (p.totalRevenue || 0) > 5000 && (p.totalRevenue || 0) <= 10000).reduce((sum, p) => sum + (p.totalRevenue || 0), 0)
      },
      {
        name: 'Average',
        value: filtered.filter(p => (p.totalRevenue || 0) > 1000 && (p.totalRevenue || 0) <= 5000).length,
        revenue: filtered.filter(p => (p.totalRevenue || 0) > 1000 && (p.totalRevenue || 0) <= 5000).reduce((sum, p) => sum + (p.totalRevenue || 0), 0)
      },
      {
        name: 'Slow Moving',
        value: filtered.filter(p => (p.totalRevenue || 0) <= 1000).length,
        revenue: filtered.filter(p => (p.totalRevenue || 0) <= 1000).reduce((sum, p) => sum + (p.totalRevenue || 0), 0)
      }
    ]

    // Calculate metrics
    const totalRevenue = filtered.reduce((sum, p) => sum + (p.totalRevenue || 0), 0)
    const totalQuantity = filtered.reduce((sum, p) => sum + (p.totalQuantitySold || 0), 0)
    const avgPrice = filtered.reduce((sum, p) => sum + (p.price || 0), 0) / Math.max(filtered.length, 1)
    const activeProducts = filtered.filter(p => p.isActive).length

    return {
      products: sorted,
      categoryAnalysis: categoryData,
      brandAnalysis: brandData,
      performanceData,
      metrics: {
        total: filtered.length,
        active: activeProducts,
        avgPrice,
        totalRevenue,
        totalQuantity
      }
    }
  }, [topProductsData, searchQuery, sortBy, filterCategory])

  // Get unique categories for filter
  const categories = useMemo(() => {
    if (!topProductsData) return []
    const cats = new Set(topProductsData.map(p => p.category || 'Uncategorized'))
    return Array.from(cats)
  }, [topProductsData])

  // Pagination
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return processedData.products.slice(start, start + pageSize)
  }, [processedData.products, currentPage, pageSize])

  const totalPages = Math.ceil(processedData.products.length / pageSize)

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#1f2937' }}>
            Product Performance Analytics
          </h1>
          <Button onClick={refresh} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processedData.metrics.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {processedData.metrics.active} active products
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(processedData.metrics.totalRevenue / 1000).toFixed(1)}K
            </div>
            <p className="text-xs text-muted-foreground">
              From last 90 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Units Sold</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(processedData.metrics.totalQuantity / 1000).toFixed(1)}K
            </div>
            <p className="text-xs text-muted-foreground">
              Total quantity sold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Price</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${processedData.metrics.avgPrice.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Average product price
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Revenue by product category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={processedData.categoryAnalysis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value: number) => `AED ${(value / 1000).toFixed(1)}K`} />
                <Bar dataKey="revenue" fill={businessColors.primary[600]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Classification</CardTitle>
            <CardDescription>Distribution by performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={processedData.performanceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {processedData.performanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card style={{ marginBottom: '24px' }}>
        <CardContent style={{ paddingTop: '24px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <Label>Search Products</Label>
              <Input
                placeholder="Search by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <Label>Category Filter</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger style={{ width: '180px' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger style={{ width: '180px' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="quantity">Quantity Sold</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="name">Product Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Page Size</Label>
              <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(parseInt(v))}>
                <SelectTrigger style={{ width: '100px' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>
            Showing {paginatedProducts.length} of {processedData.products.length} products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ overflowX: 'auto' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Quantity Sold</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.map((product) => (
                  <TableRow key={product.itemCode}>
                    <TableCell className="font-mono text-sm">{product.itemCode}</TableCell>
                    <TableCell>{product.itemDescription || 'Unknown Product'}</TableCell>
                    <TableCell>{product.category || 'Uncategorized'}</TableCell>
                    <TableCell>{product.brandCode || '-'}</TableCell>
                    <TableCell>AED {(product.price || 0).toFixed(2)}</TableCell>
                    <TableCell>{Math.round(product.totalQuantitySold || 0).toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">
                      AED {(product.totalRevenue || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? 'default' : 'secondary'}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProduct(product)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500">
                      No products found matching your criteria
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <div style={{ color: '#6b7280' }}>
                Page {currentPage} of {totalPages}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Scorecard Modal */}
      {selectedProduct && (
        <ProductScorecard
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  )
}