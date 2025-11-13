import { NextRequest, NextResponse } from 'next/server'
import { query, db } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    await db.initialize()
    
    const customerCode = params.code
    
    // First check if customer exists in master table
    const customerQuery = `
      SELECT 
        customer_code as "customerCode",
        customer_name as "customerName",
        address1 as "address",
        city_name as "city",
        region_name as "region",
        contact_no1 as "phone",
        '' as "email",
        chain_name as "chain",
        classification,
        is_active as "isActive"
      FROM flat_customers_master
      WHERE customer_code = $1
      LIMIT 1
    `
    
    const customerResult = await query(customerQuery, [customerCode])
    
    if (customerResult.rows.length === 0) {
      // If not in master, try to get from transactions
      const transCustomerQuery = `
        SELECT 
          store_code as "customerCode",
          MAX(store_name) as "customerName",
          '' as "address",
          MAX(city_name) as "city",
          MAX(region_name) as "region",
          '' as "phone",
          '' as "email",
          MAX(chain_name) as "chain",
          'N/A' as "classification",
          true as "isActive"
        FROM flat_sales_transactions
        WHERE store_code = $1
        GROUP BY store_code
        LIMIT 1
      `
      
      const transResult = await query(transCustomerQuery, [customerCode])
      
      if (transResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Customer not found'
        }, { status: 404 })
      }
      
      return NextResponse.json({
        success: true,
        data: transResult.rows[0]
      })
    }
    
    return NextResponse.json({
      success: true,
      data: customerResult.rows[0]
    })
    
  } catch (error) {
    console.error('Customer details API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
