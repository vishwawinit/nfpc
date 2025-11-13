import { NextRequest, NextResponse } from 'next/server'
import { fetchFromJsonServer } from '@/lib/jsonServerClient'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId') || searchParams.get('id')

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Order ID is required'
      }, { status: 400 })
    }

    // Fetch data from json-server
    const transactions = await fetchFromJsonServer<any[]>('transactions')

    // Find the specific order
    const order = transactions.find((t: any) => t.trxCode === orderId || t.id === orderId)

    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Order not found'
      }, { status: 404 })
    }

    // Mock order details with items
    const orderDetails = {
      order: {
        orderId: order.trxCode,
        orderDate: order.trxDate,
        customerCode: order.customerCode,
        customerName: order.customerName,
        salesmanCode: order.salesmanCode,
        salesmanName: order.salesmanName,
        currencyCode: 'AED',
        summary: {
          totalAmount: order.totalAmount,
          totalQuantity: order.quantity,
          uniqueProducts: 1,
          totalItems: order.quantity,
          avgItemPrice: order.totalAmount,
          currencyCode: 'AED'
        }
      },
      items: [{
        lineNo: 1,
        productCode: order.productCode,
        productName: order.productName,
        categoryName: order.categoryName,
        brand: order.brand,
        quantity: order.quantity,
        unitPrice: order.unitPrice,
        lineTotal: order.totalAmount
      }],
      categoryBreakdown: []
    }

    return NextResponse.json({
      success: true,
      data: orderDetails,
      timestamp: new Date().toISOString(),
      source: 'json-server'
    })

  } catch (error) {
    console.error('Order details API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch order details',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
