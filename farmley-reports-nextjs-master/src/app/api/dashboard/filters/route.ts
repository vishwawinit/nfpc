import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Enhanced dashboard filters API that fetches comprehensive filter options
export async function GET(request: NextRequest) {
  try {
    console.log('Dashboard filters API called - fetching comprehensive filter data')
    
    // Initialize arrays for filter options
    let regions: any[] = []
    let cities: any[] = []
    let salesPersons: any[] = []
    let customerTypes: any[] = []
    let productCategories: any[] = []
    let stores: any[] = []

    // Fetch regions (states) from customers master
    try {
      const regionsQuery = `
        SELECT DISTINCT 
          state as value, 
          state as label,
          COUNT(DISTINCT customer_code) as available
        FROM flat_customers_master
        WHERE state IS NOT NULL AND state != ''
        GROUP BY state
        ORDER BY state
      `
      const regionsResult = await query(regionsQuery)
      regions = regionsResult.rows || []
      console.log(`Fetched ${regions.length} regions`)
    } catch (err) {
      console.error('Error fetching regions:', err)
    }

    // Fetch cities from customers master
    try {
      const citiesQuery = `
        SELECT DISTINCT 
          city as value, 
          city as label,
          COUNT(DISTINCT customer_code) as available
        FROM flat_customers_master
        WHERE city IS NOT NULL AND city != ''
        GROUP BY city
        ORDER BY city
      `
      const citiesResult = await query(citiesQuery)
      cities = citiesResult.rows || []
      console.log(`Fetched ${cities.length} cities`)
    } catch (err) {
      console.error('Error fetching cities:', err)
    }

    // Fetch sales persons from customers master
    try {
      const salesPersonsQuery = `
        SELECT DISTINCT 
          sales_person_code as value,
          sales_person_name as label,
          COUNT(DISTINCT customer_code) as available
        FROM flat_customers_master
        WHERE sales_person_code IS NOT NULL 
          AND sales_person_code != ''
          AND sales_person_name IS NOT NULL
        GROUP BY sales_person_code, sales_person_name
        ORDER BY sales_person_name
      `
      const salesPersonsResult = await query(salesPersonsQuery)
      salesPersons = salesPersonsResult.rows || []
      console.log(`Fetched ${salesPersons.length} sales persons`)
    } catch (err) {
      console.error('Error fetching sales persons:', err)
    }

    // Fetch customer types
    try {
      const customerTypesQuery = `
        SELECT DISTINCT 
          customer_type as value,
          customer_type as label,
          COUNT(DISTINCT customer_code) as available
        FROM flat_customers_master
        WHERE customer_type IS NOT NULL AND customer_type != ''
        GROUP BY customer_type
        ORDER BY customer_type
      `
      const customerTypesResult = await query(customerTypesQuery)
      customerTypes = customerTypesResult.rows || []
      console.log(`Fetched ${customerTypes.length} customer types`)
    } catch (err) {
      console.error('Error fetching customer types:', err)
    }

    // Fetch product categories from products master
    try {
      const categoriesQuery = `
        SELECT DISTINCT 
          category_name as value,
          category_name as label,
          COUNT(DISTINCT product_code) as available
        FROM flat_products_master
        WHERE category_name IS NOT NULL AND category_name != ''
        GROUP BY category_name
        ORDER BY category_name
      `
      const categoriesResult = await query(categoriesQuery)
      productCategories = categoriesResult.rows || []
      console.log(`Fetched ${productCategories.length} product categories`)
    } catch (err) {
      console.error('Error fetching product categories:', err)
    }

    // Fetch top stores/customers
    try {
      const storesQuery = `
        SELECT DISTINCT 
          customer_code as value,
          customer_name as label,
          city,
          state
        FROM flat_customers_master
        WHERE customer_code IS NOT NULL 
          AND customer_name IS NOT NULL
        ORDER BY customer_name
        LIMIT 100
      `
      const storesResult = await query(storesQuery)
      stores = storesResult.rows || []
      console.log(`Fetched ${stores.length} stores`)
    } catch (err) {
      console.error('Error fetching stores:', err)
    }

    // Return comprehensive filter options
    return NextResponse.json({
      success: true,
      data: {
        regions,
        cities,
        fieldUserRoles: salesPersons, // Using sales persons as field user roles
        teamLeaders: salesPersons, // Sales persons can act as team leaders
        fieldUsers: salesPersons, // Sales persons as field users
        chains: customerTypes, // Customer types as chains
        stores,
        summary: {
          totalRegions: regions.length,
          totalRoutes: 0,
          totalUsers: 0,
          totalTeamLeaders: 0,
          totalChains: 0,
          totalStores: 0,
          dateRange: {
            min: '',
            max: '',
            daysWithData: 0
          }
        }
      },
      hierarchy: {
        loginUserCode: null,
        isTeamLeader: false,
        allowedUserCount: 0,
        allowedTeamLeaderCount: 0,
        allowedFieldUserCount: 0
      },
      timestamp: new Date().toISOString(),
      cached: false
    })
  } catch (error) {
    console.error('Dashboard Filters API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}