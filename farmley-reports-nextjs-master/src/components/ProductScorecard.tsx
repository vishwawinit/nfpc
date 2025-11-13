'use client'

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { useResponsive } from '@/hooks/useResponsive'

interface Product {
  itemCode: string
  itemDescription: string
  category: string
  brand: string
  totalQuantitySold: number
  totalRevenue: number
  avgUnitPrice: number
  isActive: boolean
}

interface ProductScorecardProps {
  product: Product
  onClose: () => void
}

export const ProductScorecard: React.FC<ProductScorecardProps> = ({ product, onClose }) => {
  const { isMobile } = useResponsive()

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className={isMobile ? "w-full h-full max-w-full p-4" : "max-w-2xl"}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-base sm:text-lg">
            <span>Product Scorecard</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-sm sm:text-lg">Product Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Item Code</p>
                  <p className="text-sm font-semibold">{product.itemCode}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-sm font-semibold">{product.itemDescription}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Category</p>
                  <Badge variant="secondary">{product.category}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Brand</p>
                  <Badge variant="outline">{product.brand}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Quantity Sold</p>
                  <p className="text-2xl font-bold text-blue-600">{product.totalQuantitySold.toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">AED {product.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Average Unit Price</p>
                  <p className="text-xl font-bold">AED {product.avgUnitPrice.toFixed(2)}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant={product.isActive ? 'default' : 'secondary'}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}