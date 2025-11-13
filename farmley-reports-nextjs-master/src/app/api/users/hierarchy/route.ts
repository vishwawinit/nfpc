import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { withReferrerCheck } from '@/lib/apiSecurity'

// Enable ISR with 60 second revalidation
export const revalidate = 60

async function handler(request: NextRequest) {
  try {
    // Fetch user hierarchy from flat_stock_checks table (has more complete data)
    // Also check flat_purchase_orders for any additional users
    const [stockChecksResult, purchaseOrdersResult] = await Promise.all([
      query(`
        SELECT 
          tl_code as "userCode",
          tl_name as "userName",
          'Team Leader' as "role",
          1 as role_order
        FROM flat_stock_checks
        WHERE tl_code IS NOT NULL
          AND tl_name IS NOT NULL
        GROUP BY tl_code, tl_name
        
        UNION
        
        SELECT 
          field_user_code as "userCode",
          field_user_name as "userName",
          user_role as "role",
          CASE user_role
            WHEN 'Team Leader' THEN 1
            WHEN 'ATL' THEN 2
            WHEN 'Promoter' THEN 3
            ELSE 4
          END as role_order
        FROM flat_stock_checks
        WHERE user_role IS NOT NULL
          AND field_user_code IS NOT NULL
          AND field_user_name IS NOT NULL
        GROUP BY field_user_code, field_user_name, user_role
        ORDER BY role_order, "userName"
      `),
      query(`
        SELECT 
          field_user_code as "userCode",
          field_user_name as "userName",
          user_role as "role",
          CASE user_role
            WHEN 'Team Leader' THEN 1
            WHEN 'ATL' THEN 2
            WHEN 'Promoter' THEN 3
            ELSE 4
          END as role_order
        FROM flat_purchase_orders
        WHERE user_role IS NOT NULL
          AND field_user_code IS NOT NULL
          AND field_user_name IS NOT NULL
        GROUP BY field_user_code, field_user_name, user_role
      `)
    ])

    // Combine and deduplicate results
    const allUsers = new Map()
    
    // Add stock checks users first (priority)
    stockChecksResult.rows.forEach(row => {
      allUsers.set(row.userCode, row)
    })
    
    // Add purchase orders users (if not already present)
    purchaseOrdersResult.rows.forEach(row => {
      if (!allUsers.has(row.userCode)) {
        allUsers.set(row.userCode, row)
      }
    })
    
    const result = { rows: Array.from(allUsers.values()).sort((a, b) => {
      if (a.role_order !== b.role_order) return a.role_order - b.role_order
      return a.userName.localeCompare(b.userName)
    }) }

    // Group users by role
    const teamLeaders = result.rows
      .filter(row => row.role === 'Team Leader')
      .map(row => ({
        code: row.userCode,
        name: row.userName,
        role: row.role
      }))

    const assistantLeaders = result.rows
      .filter(row => row.role === 'ATL')
      .map(row => ({
        code: row.userCode,
        name: row.userName,
        role: row.role,
        reportingTo: null // Will be populated once we have reporting relationships
      }))

    const fieldUsers = result.rows
      .filter(row => row.role === 'Promoter')
      .map(row => ({
        code: row.userCode,
        name: row.userName,
        role: row.role,
        reportingTo: null // Will be populated once we have reporting relationships
      }))

    return NextResponse.json({
      success: true,
      data: {
        teamLeaders,
        assistantLeaders,
        fieldUsers
      },
      count: {
        teamLeaders: teamLeaders.length,
        assistantLeaders: assistantLeaders.length,
        fieldUsers: fieldUsers.length,
        total: result.rows.length
      },
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat_purchase_orders'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    })

  } catch (error) {
    console.error('User Hierarchy API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user hierarchy',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Export the GET method with referrer check security
export const GET = withReferrerCheck(handler)