'use client'
import React, { useState, useMemo } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { businessColors } from '@/styles/businessColors'
import { CustomerScorecard } from '../CustomerScorecard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useTopCustomers } from '@/hooks/useDataService'
import { RefreshCw } from 'lucide-react'

export const DynamicScalableCustomersReport: React.FC = () => {
  const [sortBy, setSortBy] = useState('totalSales')
  const [filterType, setFilterType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)

  // Fetch real customer data from database
  const { data: topCustomersData, loading, refresh } = useTopCustomers(100) // Get more customers for analysis
  // const { data: customerAnalytics } = useApiData('/api/customers/analytics') // Disabled API call

  // Process customer data for analysis
  const processedData = useMemo(() => {
    if (!topCustomersData) return {
      customers: [],
      channelAnalysis: [],
      classificationAnalysis: [],
      metrics: { total: 0, active: 0, avgSales: 0, totalRevenue: 0 }
    }

    // Filter customers based on search and filters
    let filtered = topCustomersData
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customerCode?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Sort customers
    const sorted = [...filtered].sort((a, b) => {
      switch(sortBy) {
        case 'totalSales':
          return (b.totalSales || 0) - (a.totalSales || 0)
        case 'orders':
          return (b.totalOrders || 0) - (a.totalOrders || 0)
        case 'name':
          return (a.customerName || '').localeCompare(b.customerName || '')
        case 'avgOrderValue':
          return (b.averageOrderValue || 0) - (a.averageOrderValue || 0)
        default:
          return 0
      }
    })

    // Analyze by route (using route as proxy for channel)
    const routeAnalysis: { [key: string]: { count: number, sales: number } } = {}
    filtered.forEach(customer => {
      const route = customer.routeName || 'Unknown'
      if (!routeAnalysis[route]) {
        routeAnalysis[route] = { count: 0, sales: 0 }
      }
      routeAnalysis[route].count++
      routeAnalysis[route].sales += customer.totalSales || 0
    })

    const channelData = Object.entries(routeAnalysis)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        value: data.sales,
        count: data.count
      }))

    // Customer classification by sales volume
    const classificationData = [
      {
        name: 'Key Accounts',
        value: filtered.filter(c => (c.totalSales || 0) > 100000).length,
        sales: filtered.filter(c => (c.totalSales || 0) > 100000).reduce((sum, c) => sum + (c.totalSales || 0), 0)
      },
      {
        name: 'A Class',
        value: filtered.filter(c => (c.totalSales || 0) > 50000 && (c.totalSales || 0) <= 100000).length,
        sales: filtered.filter(c => (c.totalSales || 0) > 50000 && (c.totalSales || 0) <= 100000).reduce((sum, c) => sum + (c.totalSales || 0), 0)
      },
      {
        name: 'B Class',
        value: filtered.filter(c => (c.totalSales || 0) > 20000 && (c.totalSales || 0) <= 50000).length,
        sales: filtered.filter(c => (c.totalSales || 0) > 20000 && (c.totalSales || 0) <= 50000).reduce((sum, c) => sum + (c.totalSales || 0), 0)
      },
      {
        name: 'C Class',
        value: filtered.filter(c => (c.totalSales || 0) <= 20000).length,
        sales: filtered.filter(c => (c.totalSales || 0) <= 20000).reduce((sum, c) => sum + (c.totalSales || 0), 0)
      }
    ]

    // Calculate metrics
    const totalRevenue = filtered.reduce((sum, c) => sum + (c.totalSales || 0), 0)
    const avgSales = filtered.length > 0 ? totalRevenue / filtered.length : 0
    const activeCustomers = filtered.filter(c => c.status === 'Active').length

    return {
      customers: sorted,
      channelAnalysis: channelData,
      classificationAnalysis: classificationData,
      metrics: {
        total: filtered.length,
        active: activeCustomers,
        avgSales,
        totalRevenue
      }
    }
  }, [topCustomersData, searchQuery, sortBy, filterType])

  // Pagination
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return processedData.customers.slice(start, start + pageSize)
  }, [processedData.customers, currentPage, pageSize])

  const totalPages = Math.ceil(processedData.customers.length / pageSize)

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#1f2937' }}>
            Customer Analytics Dashboard
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
          <CardHeader>
            <CardTitle>Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ fontSize: '36px', fontWeight: '700', color: businessColors.primary[600] }}>
              {processedData.metrics.total.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ fontSize: '36px', fontWeight: '700', color: businessColors.success.main }}>
              {processedData.metrics.active.toLocaleString()}
            </div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              {((processedData.metrics.active / processedData.metrics.total) * 100).toFixed(1)}% of total
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ fontSize: '36px', fontWeight: '700', color: businessColors.warning.main }}>
              AED {(processedData.metrics.totalRevenue / 1000).toFixed(0)}K
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avg Customer Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ fontSize: '36px', fontWeight: '700', color: businessColors.primary[400] }}>
              AED {processedData.metrics.avgSales.toFixed(0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        <Card>
          <CardHeader>
            <CardTitle>Customer Classification</CardTitle>
            <CardDescription>Distribution by sales volume</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={processedData.classificationAnalysis}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {processedData.classificationAnalysis.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Routes by Revenue</CardTitle>
            <CardDescription>Sales performance by route</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={processedData.channelAnalysis}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value: number) => `AED ${value.toLocaleString()}`} />
                <Bar dataKey="value" fill={businessColors.primary[600]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card style={{ marginBottom: '24px' }}>
        <CardContent style={{ paddingTop: '24px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <Label>Search Customers</Label>
              <Input
                placeholder="Search by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger style={{ width: '180px' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="totalSales">Total Sales</SelectItem>
                  <SelectItem value="orders">Order Count</SelectItem>
                  <SelectItem value="avgOrderValue">Avg Order Value</SelectItem>
                  <SelectItem value="name">Customer Name</SelectItem>
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

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
          <CardDescription>
            Showing {paginatedCustomers.length} of {processedData.customers.length} customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ overflowX: 'auto' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Sales</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Avg Order</TableHead>
                  <TableHead>Last Order</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.map((customer) => (
                  <TableRow key={customer.customerCode}>
                    <TableCell>{customer.customerCode}</TableCell>
                    <TableCell>{customer.customerName || 'Unknown'}</TableCell>
                    <TableCell>{customer.routeName || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={customer.status === 'Active' ? 'default' : 'secondary'}>
                        {customer.status || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>AED {(customer.totalSales || 0).toLocaleString()}</TableCell>
                    <TableCell>{customer.totalOrders || 0}</TableCell>
                    <TableCell>AED {(customer.averageOrderValue || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      {customer.lastOrderDate
                        ? new Date(customer.lastOrderDate).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
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
        </CardContent>
      </Card>

      {/* Customer Scorecard Modal */}
      {selectedCustomer && (
        <CustomerScorecard
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  )
}