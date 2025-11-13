'use client'

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { X } from 'lucide-react'
import { useResponsive } from '@/hooks/useResponsive'

interface Customer {
  customerCode: string
  customerName: string
  channel: string
  classification: string
  customerType: string
  region: string
  routeCode: string
  creditLimit: number
  outstandingAmount: number
  paymentTerms: string
  totalSales: number
  totalOrders: number
  avgOrderValue: number
  lastOrderDate: Date
  visitFrequency: number
  isActive: boolean
}

interface CustomerScorecardProps {
  customer: Customer
  onClose: () => void
}

export const CustomerScorecard: React.FC<CustomerScorecardProps> = ({ customer, onClose }) => {
  const { isMobile } = useResponsive()

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className={isMobile ? "w-full h-full max-w-full p-4" : "max-w-2xl"}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-base sm:text-lg">
            <span>Customer Scorecard</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-sm sm:text-lg">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer Code</p>
                  <p className="text-sm font-semibold">{customer.customerCode}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer Name</p>
                  <p className="text-sm font-semibold">{customer.customerName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Channel</p>
                  <Badge variant="secondary">{customer.channel}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Classification</p>
                  <Badge variant="outline">{customer.classification}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Region</p>
                  <p className="text-sm">{customer.region}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Route Code</p>
                  <p className="text-sm">{customer.routeCode}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold text-green-600">AED {customer.totalSales.toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold text-blue-600">{customer.totalOrders}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Average Order Value</p>
                  <p className="text-xl font-bold">AED {customer.avgOrderValue}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Visit Frequency</p>
                  <p className="text-xl font-bold">{customer.visitFrequency}/week</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Financial Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Credit Limit</p>
                  <p className="text-lg font-semibold">AED {customer.creditLimit.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Outstanding Amount</p>
                  <p className={`text-lg font-semibold ${customer.outstandingAmount > customer.creditLimit * 0.8 ? 'text-red-600' : 'text-green-600'}`}>
                    AED {customer.outstandingAmount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Payment Terms</p>
                  <p className="text-sm">{customer.paymentTerms}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer Type</p>
                  <Badge variant="outline">{customer.customerType}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}