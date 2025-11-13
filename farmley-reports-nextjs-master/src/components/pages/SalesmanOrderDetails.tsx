'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft } from 'lucide-react'

interface SalesmanOrderDetailsProps {
  salesmanId: string
  salesmanName: string
  onBack: () => void
}

// Mock order data
const mockOrders = [
  {
    orderNo: 'ORD-2024-001',
    customerName: 'Al Maya Supermarket',
    orderDate: new Date('2024-01-15'),
    amount: 2450.50,
    status: 'Delivered',
    items: 12
  },
  {
    orderNo: 'ORD-2024-002',
    customerName: 'Carrefour',
    orderDate: new Date('2024-01-14'),
    amount: 3200.00,
    status: 'Pending',
    items: 8
  },
  {
    orderNo: 'ORD-2024-003',
    customerName: 'Lulu Hypermarket',
    orderDate: new Date('2024-01-13'),
    amount: 1850.75,
    status: 'Delivered',
    items: 15
  },
]

export const SalesmanOrderDetails: React.FC<SalesmanOrderDetailsProps> = ({
  salesmanId,
  salesmanName,
  onBack
}) => {
  const [dateRange, setDateRange] = useState('thisMonth')

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {salesmanName} - Order Details
            </h1>
            <p className="text-sm text-muted-foreground">
              Detailed order analysis for salesman ID: {salesmanId}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">AED 124,500</div>
            <p className="text-xs text-muted-foreground">
              +8.5% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Order Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">AED 798</div>
            <p className="text-xs text-muted-foreground">
              -2.1% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground">
              +3.2% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockOrders.map((order) => (
                <TableRow key={order.orderNo}>
                  <TableCell className="font-medium">{order.orderNo}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.orderDate.toLocaleDateString()}</TableCell>
                  <TableCell>{order.items}</TableCell>
                  <TableCell className="text-right font-semibold">
                    AED {order.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={order.status === 'Delivered' ? 'default' : 'secondary'}
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}