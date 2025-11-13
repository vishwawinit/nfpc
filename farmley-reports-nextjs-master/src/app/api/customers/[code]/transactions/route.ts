import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Date range helper
function getDateRange(rangeStr: string) {
  const now = new Date()
  let startDate: Date, endDate: Date
  
  switch (rangeStr) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0))
      endDate = new Date(now.setHours(23, 59, 59, 999))
      break
    case 'yesterday':
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      startDate = new Date(yesterday.setHours(0, 0, 0, 0))
      endDate = new Date(yesterday.setHours(23, 59, 59, 999))
      break
    case 'thisWeek':
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      startDate = new Date(weekStart.setHours(0, 0, 0, 0))
      endDate = new Date(now)
      break
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now)
      break
    case 'lastMonth':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      endDate = new Date(now.getFullYear(), now.getMonth(), 0)
      break
    case 'thisQuarter':
      const quarter = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), quarter * 3, 1)
      endDate = new Date(now)
      break
    case 'lastQuarter':
      const lastQuarter = Math.floor(now.getMonth() / 3) - 1
      startDate = new Date(now.getFullYear(), lastQuarter * 3, 1)
      endDate = new Date(now.getFullYear(), lastQuarter * 3 + 3, 0)
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now)
  }
  
  return {
    startStr: startDate.toISOString().split('T')[0],
    endStr: endDate.toISOString().split('T')[0]
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    await db.initialize()
    
    const customerCode = params.code
    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || 'thisMonth'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    
    let startDate: string
    let endDate: string
    
    if (startDateParam && endDateParam) {
      // Custom date range
      startDate = startDateParam
      endDate = endDateParam
    } else {
      // Preset date range
      const dateResult = getDateRange(range)
      startDate = dateResult.startStr
      endDate = dateResult.endStr
    }
    
    // Get transactions for the customer
    const transactionsQuery = `
      SELECT 
        trx_code as "transactionId",
        trx_date_only as "transactionDate",
        product_code as "productCode",
        product_name as "productName",
        quantity,
        unit_price as "unitPrice",
        (quantity * unit_price) as "totalAmount",
        COALESCE(discount_amount, 0) as "discount",
        net_amount as "netAmount",
        trx_type_name as "orderType"
      FROM flat_sales_transactions
      WHERE store_code = $1
        AND trx_type = 5
        AND trx_date_only >= $2
        AND trx_date_only <= $3
      ORDER BY trx_date_only DESC, trx_created_on DESC
    `
    
    const transactionsResult = await query(transactionsQuery, [customerCode, startDate, endDate])
    
    // Get summary statistics
    const summaryQuery = `
      SELECT 
        SUM(net_amount) as "totalSales",
        COUNT(DISTINCT trx_code) as "totalOrders",
        AVG(net_amount) as "avgOrderValue",
        COUNT(DISTINCT product_code) as "uniqueProducts",
        MAX(trx_date_only) as "lastOrderDate",
        MIN(trx_date_only) as "firstOrderDate"
      FROM flat_sales_transactions
      WHERE store_code = $1
        AND trx_type = 5
        AND trx_date_only >= $2
        AND trx_date_only <= $3
    `
    
    const summaryResult = await query(summaryQuery, [customerCode, startDate, endDate])
    
    const summary = summaryResult.rows[0] || {
      totalSales: 0,
      totalOrders: 0,
      avgOrderValue: 0,
      uniqueProducts: 0,
      lastOrderDate: null,
      firstOrderDate: null
    }
    
    return NextResponse.json({
      success: true,
      data: {
        transactions: transactionsResult.rows,
        summary: {
          totalSales: parseFloat(summary.totalSales || '0'),
          totalOrders: parseInt(summary.totalOrders || '0'),
          avgOrderValue: parseFloat(summary.avgOrderValue || '0'),
          uniqueProducts: parseInt(summary.uniqueProducts || '0'),
          lastOrderDate: summary.lastOrderDate,
          firstOrderDate: summary.firstOrderDate
        }
      },
      dateRange: {
        start: startDate,
        end: endDate,
        label: range
      }
    })
    
  } catch (error) {
    console.error('Customer transactions API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
