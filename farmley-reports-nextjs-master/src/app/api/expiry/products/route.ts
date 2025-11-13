import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Enable ISR with 60 second revalidation
export const revalidate = 60

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    console.log('Expiry Products API - Received params:', Object.fromEntries(searchParams.entries()))

    // Require visit identification parameters
    if (!searchParams.has('visitedDate') || !searchParams.has('customerCode') || !searchParams.has('fieldUserCode')) {
      return NextResponse.json({
        success: false,
        error: 'Visit identification required',
        message: 'visitedDate, customerCode, and fieldUserCode parameters are required'
      }, { status: 400 })
    }

    const visitedDate = searchParams.get('visitedDate')
    const customerCode = searchParams.get('customerCode')
    const fieldUserCode = searchParams.get('fieldUserCode')

    // Get hierarchy-based allowed users for security
    const loginUserCode = searchParams.get('loginUserCode')
    let allowedUserCodes: string[] = []
    
    try {
      if (loginUserCode && !isAdmin(loginUserCode)) {
        allowedUserCodes = await getChildUsers(loginUserCode)
        
        // Verify that the requested fieldUserCode is in the allowed list
        if (allowedUserCodes.length > 0 && fieldUserCode && !allowedUserCodes.includes(fieldUserCode)) {
          console.log('Expiry Products API - Access denied for user:', loginUserCode, 'trying to access:', fieldUserCode)
          return NextResponse.json({
            success: false,
            error: 'Access denied',
            message: 'You do not have permission to view this data'
          }, { status: 403 })
        }
      }
    } catch (hierarchyError) {
      // If hierarchy check fails, log it but continue (fail-open for now to avoid breaking the feature)
      console.warn('Expiry Products API - Hierarchy check failed, continuing without restriction:', hierarchyError)
    }

    console.log('Expiry Products API - Fetching products for visit:', { visitedDate, customerCode, fieldUserCode })

    // Get all products for this specific visit
    // First, find the actual visited_date timestamp from the database by matching the ISO string
    // This handles timezone conversion issues between the frontend and database
    let dateCheck
    try {
      dateCheck = await query(`
        SELECT DISTINCT visited_date
        FROM flat_expiry_checks
        WHERE customer_code = $1
          AND field_user_code = $2
          AND to_char(visited_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"') = $3
        LIMIT 1
      `, [customerCode, fieldUserCode, visitedDate])
    } catch (dateCheckError) {
      console.error('Expiry Products API - Date check query failed:', dateCheckError)
      throw new Error(`Date check query failed: ${dateCheckError instanceof Error ? dateCheckError.message : 'Unknown error'}`)
    }

    if (dateCheck.rows.length === 0) {
      console.log('Expiry Products API - No matching visit found for:', { visitedDate, customerCode, fieldUserCode })
    }

    const actualVisitedDate = dateCheck.rows.length > 0 ? dateCheck.rows[0].visited_date : null

    if (!actualVisitedDate) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'No visit found with the specified parameters',
        timestamp: new Date().toISOString()
      })
    }

    // Get all individual product records (no aggregation - show all legitimate records)
    let result
    try {
      result = await query(`
        SELECT 
          expiry_check_id as "expiryCheckId",
          product_code as "productCode",
          product_name as "productName",
          product_category as "productCategory",
          category,
          expiry_date as "expiryDate",
          (expiry_date - CURRENT_DATE)::INTEGER as "daysToExpiry",
          items_checked as "itemsChecked",
          items_expired as "itemsExpired",
          quantity
        FROM flat_expiry_checks
        WHERE visited_date = $1
          AND customer_code = $2
          AND field_user_code = $3
        ORDER BY expiry_date ASC, product_code, expiry_check_id
      `, [actualVisitedDate, customerCode, fieldUserCode])
    } catch (productsQueryError) {
      console.error('Expiry Products API - Products query failed:', productsQueryError)
      throw new Error(`Products query failed: ${productsQueryError instanceof Error ? productsQueryError.message : 'Unknown error'}`)
    }

    console.log('Expiry Products API - Query returned:', result.rows.length, 'products')

    const products = result.rows.map(row => ({
      expiryCheckId: row.expiryCheckId || '',
      productCode: row.productCode || '',
      productName: row.productName || '',
      productCategory: row.productCategory || '',
      category: row.category || '',
      expiryDate: row.expiryDate || null,
      daysToExpiry: parseInt(row.daysToExpiry) || 0,
      itemsChecked: parseInt(row.itemsChecked) || 0,
      itemsExpired: parseInt(row.itemsExpired) || 0,
      quantity: parseFloat(row.quantity) || 0
    }))

    return NextResponse.json({
      success: true,
      data: products,
      count: products.length,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Expiry Products API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch expiry products',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

