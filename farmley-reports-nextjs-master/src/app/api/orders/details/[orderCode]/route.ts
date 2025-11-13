import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'

export async function GET(
  request: NextRequest,
  { params }: { params: { orderCode: string } }
) {
  try {
    await db.initialize()
    
    const orderCode = params.orderCode
    const { searchParams } = new URL(request.url)
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Get hierarchy-based allowed users
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }
    
    // Get order header information with hierarchy check
    let orderHeaderQuery = `
      SELECT 
        trx_code as "orderCode",
        trx_date_only as "orderDate",
        store_code as "customerCode",
        store_name as "customerName",
        COALESCE(region_name, 'Unknown') as "region",
        COALESCE(city_name, 'Unknown') as "city",
        COALESCE(chain_name, 'Unknown') as "chain",
        COALESCE(field_user_name, 'Unknown') as "salesman",
        field_user_code as "salesmanCode",
        COALESCE(tl_name, 'Unknown') as "teamLeader",
        tl_code as "teamLeaderCode"
      FROM flat_sales_transactions
      WHERE trx_code = $1
    `
    
    // Add hierarchy filter if not admin
    if (allowedUserCodes.length > 0) {
      const userCodesStr = allowedUserCodes.map(code => `'${code}'`).join(', ')
      orderHeaderQuery += ` AND field_user_code IN (${userCodesStr})`
    }
    
    orderHeaderQuery += ` LIMIT 1`
    
    const orderHeaderResult = await query(orderHeaderQuery, [orderCode])
    
    if (orderHeaderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: loginUserCode && !isAdmin(loginUserCode) 
          ? 'Order not found or access denied'
          : 'Order not found'
      }, { status: 404 })
    }
    
    const orderHeader = orderHeaderResult.rows[0]
    
    // Get order line items
    const orderItemsQuery = `
      SELECT 
        product_code as "productCode",
        product_name as "productName",
        COALESCE(product_group, 'Others') as "category",
        quantity,
        unit_price as "unitPrice",
        (quantity * unit_price) as "grossAmount",
        COALESCE(discount_amount, 0) as "discount",
        net_amount as "netAmount",
        COALESCE(tax_amount, 0) as "tax"
      FROM flat_sales_transactions
      WHERE trx_code = $1
      ORDER BY product_name
    `
    
    const orderItemsResult = await query(orderItemsQuery, [orderCode])
    
    // Calculate order summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as "itemCount",
        SUM(quantity) as "totalQuantity",
        SUM(quantity * unit_price) as "grossAmount",
        SUM(COALESCE(discount_amount, 0)) as "totalDiscount",
        SUM(COALESCE(tax_amount, 0)) as "totalTax",
        SUM(net_amount) as "orderTotal"
      FROM flat_sales_transactions
      WHERE trx_code = $1
    `
    
    const summaryResult = await query(summaryQuery, [orderCode])
    const summary = summaryResult.rows[0]
    
    return NextResponse.json({
      success: true,
      data: {
        header: orderHeader,
        items: orderItemsResult.rows,
        summary: {
          itemCount: parseInt(summary.itemCount || '0'),
          totalQuantity: parseInt(summary.totalQuantity || '0'),
          grossAmount: parseFloat(summary.grossAmount || '0'),
          totalDiscount: parseFloat(summary.totalDiscount || '0'),
          totalTax: parseFloat(summary.totalTax || '0'),
          orderTotal: parseFloat(summary.orderTotal || '0')
        }
      }
    })
    
  } catch (error) {
    console.error('Order details API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
