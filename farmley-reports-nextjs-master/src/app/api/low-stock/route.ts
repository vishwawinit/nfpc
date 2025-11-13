import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getCacheControlHeader } from '@/lib/cache-utils'
import { getChildUsers, isAdmin } from '@/lib/mssql'
import { validateApiUser } from '@/lib/apiUserValidation'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

// Low stock data cache for 30 minutes (updates daily)
const CACHE_DURATION = 1800

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const loginUserCode = searchParams.get('loginUserCode')
    
    // Validate user access
    const validation = await validateApiUser(loginUserCode)
    if (!validation.isValid) {
      return validation.response!
    }

    // Get date range for filtering - default to THIS MONTH
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    const startDate = searchParams.get('startDate') || (() => {
      const date = new Date()
      return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
    })()
    
    // Get hierarchy-based allowed users
    let allowedUserCodes: string[] = []
    if (loginUserCode && !isAdmin(loginUserCode)) {
      allowedUserCodes = await getChildUsers(loginUserCode)
    }

    // Calculate 35-day coverage requirement based on last 7 days average sales
    // Sales are inferred from stock quantity differences between consecutive days
    const coverageQuery = `
      WITH actual_date_range AS (
        -- Find the actual latest date with data in the selected range
        SELECT 
          MAX(check_date) as latest_check_date,
          MIN(check_date) as earliest_check_date
        FROM flat_stock_checks
        WHERE check_date >= $2::date AND check_date <= $1::date
          {{FILTER_PLACEHOLDER}}
      ),
      daily_stock AS (
        -- Get daily stock checks for each store-product combination using actual latest date
        SELECT DISTINCT ON (check_date, store_code, product_code)
          ds.check_date,
          ds.store_code,
          ds.store_name,
          ds.chain_name,
          ds.city_code,
          ds.city_name,
          ds.region_code,
          ds.field_user_code,
          ds.field_user_name,
          ds.user_role,
          ds.tl_code,
          ds.tl_name,
          ds.product_code,
          ds.product_name,
          ds.product_group,
          ds.product_category,
          ds.product_brand,
          ds.product_image_path,
          ds.store_quantity,
          ds.warehouse_quantity,
          ds.minimum_stock_level,
          ds.maximum_stock_level,
          ds.reorder_level,
          ds.check_status,
          ds.store_check_id,
          ds.check_datetime,
          ds.created_on
        FROM flat_stock_checks ds, actual_date_range adr
        WHERE ds.check_date >= adr.latest_check_date - INTERVAL '7 days'
          AND ds.check_date <= adr.latest_check_date
          {{FILTER_PLACEHOLDER}}
        ORDER BY ds.check_date DESC, ds.store_code, ds.product_code, ds.check_datetime DESC
      ),
      sales_calc AS (
        -- Calculate daily sales by comparing consecutive days
        SELECT
          ds.store_code,
          ds.store_name,
          ds.product_code,
          ds.product_name,
          ds.check_date,
          ds.store_quantity as current_qty,
          LAG(ds.store_quantity) OVER (
            PARTITION BY ds.store_code, ds.product_code 
            ORDER BY ds.check_date
          ) as prev_qty,
          CASE 
            WHEN LAG(ds.store_quantity) OVER (
              PARTITION BY ds.store_code, ds.product_code 
              ORDER BY ds.check_date
            ) > ds.store_quantity
            THEN LAG(ds.store_quantity) OVER (
              PARTITION BY ds.store_code, ds.product_code 
              ORDER BY ds.check_date
            ) - ds.store_quantity
            ELSE 0
          END as daily_sales
        FROM daily_stock ds, actual_date_range adr
        WHERE ds.check_date >= adr.latest_check_date - INTERVAL '7 days'
          AND ds.check_date < adr.latest_check_date  -- Exclude latest date
      ),
      avg_sales AS (
        -- Calculate 7-day average sales per store-product
        SELECT
          store_code,
          product_code,
          AVG(daily_sales) as avg_daily_sales,
          COUNT(DISTINCT check_date) as days_counted
        FROM sales_calc
        WHERE prev_qty IS NOT NULL  -- Only count days where we have previous data
        GROUP BY store_code, product_code
        HAVING COUNT(DISTINCT check_date) >= 2  -- Need at least 2 days of data
      ),
      current_stock AS (
        -- Get latest stock check for each store-product within the date range
        SELECT DISTINCT ON (store_code, product_code)
          store_code,
          store_name,
          chain_name,
          city_code,
          city_name,
          region_code,
          field_user_code,
          field_user_name,
          user_role,
          tl_code,
          tl_name,
          product_code,
          product_name,
          product_group,
          product_category,
          product_brand,
          product_image_path,
          store_quantity,
          warehouse_quantity,
          minimum_stock_level,
          maximum_stock_level,
          reorder_level,
          check_status,
          check_date,
          store_check_id,
          check_datetime,
          created_on
        FROM flat_stock_checks
        WHERE check_date >= $2::date AND check_date <= $1::date
          {{FILTER_PLACEHOLDER}}
        ORDER BY store_code, product_code, check_date DESC, check_datetime DESC
      ),
      coverage_analysis AS (
        -- Calculate 35-day coverage requirement
        SELECT
          cs.*,
          COALESCE(av.avg_daily_sales, 0) as avg_daily_sales,
          COALESCE(av.avg_daily_sales * 35, 0) as required_stock_35_days,
          COALESCE(cs.store_quantity, 0) as current_stock,
          CASE
            WHEN COALESCE(av.avg_daily_sales * 35, 0) > COALESCE(cs.store_quantity, 0)
            THEN COALESCE(av.avg_daily_sales * 35, 0) - COALESCE(cs.store_quantity, 0)
            ELSE 0
          END as stock_shortage,
          CASE
            WHEN COALESCE(av.avg_daily_sales, 0) = 0 THEN 'No Sales Data'
            WHEN COALESCE(av.avg_daily_sales * 35, 0) <= COALESCE(cs.store_quantity, 0) THEN 'Healthy Stock'
            ELSE 'Low Stock'
          END as stock_status_35day
        FROM current_stock cs
        LEFT JOIN avg_sales av ON cs.store_code = av.store_code AND cs.product_code = av.product_code
      )
      SELECT
        store_check_id as "storeCheckId",
        check_date as "checkDate",
        check_datetime as "checkDateTime",
        created_on as "createdOn",
        store_code as "storeCode",
        store_name as "storeName",
        chain_name as "chainName",
        city_code as "cityCode",
        city_name as "cityName",
        region_code as "regionCode",
        field_user_code as "userCode",
        field_user_name as "userName",
        user_role as "userType",
        tl_code as "teamLeaderCode",
        tl_name as "teamLeaderName",
        product_code as "productCode",
        product_name as "productName",
        product_group as "productGroup",
        product_category as "productCategory",
        product_brand as "productBrand",
        product_image_path as "productImagePath",
        current_stock as "onHandQty",
        warehouse_quantity as "onOrderQty",
        minimum_stock_level as "minStockLevel",
        maximum_stock_level as "maxStockLevel",
        reorder_level as "reorderLevel",
        check_status as "shelfPresence",
        stock_status_35day as "stockStatus",
        avg_daily_sales as "avgDailySales",
        required_stock_35_days as "requiredStock35Days",
        stock_shortage as "stockShortage"
      FROM coverage_analysis
    `

    console.log('Low Stock API - Date Range:', { startDate, endDate })
    console.log('Low Stock API - Filter Params Order:', { 
      param1_endDate: endDate, 
      param2_startDate: startDate 
    })

    const filterParams: any[] = [endDate, startDate]
    let filterParamIndex = 3
    const filterConditions: string[] = []

    // Add hierarchy filter if not admin
    if (allowedUserCodes.length > 0) {
      filterConditions.push(`field_user_code = ANY($${filterParamIndex}::text[])`)
      filterParams.push(allowedUserCodes)
      filterParamIndex++
    }

    // Build additional filters (applied to CTE queries)
    if (searchParams.has('userCode')) {
      filterConditions.push(`field_user_code = $${filterParamIndex}`)
      filterParams.push(searchParams.get('userCode'))
      filterParamIndex++
    }

    if (searchParams.has('storeCode')) {
      filterConditions.push(`store_code = $${filterParamIndex}`)
      filterParams.push(searchParams.get('storeCode'))
      filterParamIndex++
    }

    // Handle team leader filter - get field users from hierarchy
    if (searchParams.has('teamLeaderCode')) {
      try {
        const hierarchyResponse = await fetch(`${request.nextUrl.origin}/api/users/hierarchy`)
        if (hierarchyResponse.ok) {
          const hierarchyData = await hierarchyResponse.json()
          const selectedTL = searchParams.get('teamLeaderCode')
          
          // Find field users under this TL
          const tlData = hierarchyData.data.teamLeaders.find((tl: any) => tl.code === selectedTL)
          if (tlData && tlData.fieldUsers && tlData.fieldUsers.length > 0) {
            const fieldUserCodes = tlData.fieldUsers.map((fu: any) => fu.code)
            filterConditions.push(`field_user_code = ANY($${filterParamIndex}::text[])`)
            filterParams.push(fieldUserCodes)
            filterParamIndex++
          } else {
            // Fallback to tl_code if no field users found
            filterConditions.push(`tl_code = $${filterParamIndex}`)
            filterParams.push(selectedTL)
            filterParamIndex++
          }
        }
      } catch (error) {
        console.warn('Failed to fetch hierarchy for team leader filter:', error)
        // Fallback to tl_code
        filterConditions.push(`tl_code = $${filterParamIndex}`)
        filterParams.push(searchParams.get('teamLeaderCode'))
        filterParamIndex++
      }
    }

    if (searchParams.has('userRole')) {
      filterConditions.push(`user_role = $${filterParamIndex}`)
      filterParams.push(searchParams.get('userRole'))
      filterParamIndex++
    }

    if (searchParams.has('productCode')) {
      filterConditions.push(`product_code = $${filterParamIndex}`)
      filterParams.push(searchParams.get('productCode'))
      filterParamIndex++
    }

    if (searchParams.has('productGroup')) {
      filterConditions.push(`product_group = $${filterParamIndex}`)
      filterParams.push(searchParams.get('productGroup'))
      filterParamIndex++
    }

    if (searchParams.has('productCategory')) {
      filterConditions.push(`product_category = $${filterParamIndex}`)
      filterParams.push(searchParams.get('productCategory'))
      filterParamIndex++
    }

    if (searchParams.has('chainName')) {
      filterConditions.push(`chain_name = $${filterParamIndex}`)
      filterParams.push(searchParams.get('chainName'))
      filterParamIndex++
    }

    if (searchParams.has('cityCode')) {
      filterConditions.push(`city_code = $${filterParamIndex}`)
      filterParams.push(searchParams.get('cityCode'))
      filterParamIndex++
    }

    if (searchParams.has('regionCode')) {
      filterConditions.push(`region_code = $${filterParamIndex}`)
      filterParams.push(searchParams.get('regionCode'))
      filterParamIndex++
    }

    // Apply filters to the CTEs (replace all placeholders)
    let finalQuery = coverageQuery
    const filterSQL = filterConditions.length > 0 ? `AND ${filterConditions.join(' AND ')}` : ''
    
    // Replace filter placeholder in both daily_stock and current_stock CTEs
    finalQuery = finalQuery.replace(/\{\{FILTER_PLACEHOLDER\}\}/g, filterSQL)

    finalQuery += ' ORDER BY stock_shortage DESC, store_code, product_code'

    console.log('Low Stock API - SQL Parameters:', filterParams)
    console.log('Low Stock API - Filter SQL:', filterSQL || 'No filters')

    // Debug: Check what dates actually have data in the table
    try {
      const dateCheckQuery = `
        SELECT 
          MIN(check_date) as min_date,
          MAX(check_date) as max_date,
          COUNT(DISTINCT check_date) as distinct_dates,
          COUNT(*) as total_records
        FROM flat_stock_checks
        WHERE check_date >= $1::date AND check_date <= $2::date
      `
      const dateCheckResult = await query(dateCheckQuery, [startDate, endDate])
      console.log('Low Stock API - Database Date Check:', {
        requestedRange: { startDate, endDate },
        actualRange: dateCheckResult.rows[0],
        message: 'If max_date < endDate, query will use max_date for 7-day sales calculation'
      })
    } catch (err) {
      console.warn('Failed to check database dates:', err)
    }

    const result = await query(finalQuery, filterParams)

    console.log('Low Stock API - Query Results:', {
      totalRows: result.rows.length,
      uniqueProducts: new Set(result.rows.map((r: any) => r.productCode)).size,
      uniqueStores: new Set(result.rows.map((r: any) => r.storeCode)).size,
      dateRange: { startDate, endDate },
      sampleDates: result.rows.slice(0, 5).map((r: any) => r.checkDate)
    })

    const allItems = result.rows.map(row => ({
      storeCheckId: row.storeCheckId,
      checkDate: row.checkDate,
      checkDateTime: row.checkDateTime,
      createdOn: row.createdOn,
      storeCode: row.storeCode,
      storeName: row.storeName,
      chainName: row.chainName,
      cityCode: row.cityCode,
      cityName: row.cityName,
      regionCode: row.regionCode,
      userCode: row.userCode,
      userName: row.userName,
      userType: row.userType,
      teamLeaderCode: row.teamLeaderCode || '',
      teamLeaderName: row.teamLeaderName || '',
      productCode: row.productCode,
      productName: row.productName,
      productGroup: row.productGroup,
      productCategory: row.productCategory,
      productBrand: row.productBrand,
      productImagePath: row.productImagePath,
      onHandQty: parseFloat(row.onHandQty || '0'),
      onOrderQty: parseFloat(row.onOrderQty || '0'),
      minStockLevel: row.minStockLevel ? parseFloat(row.minStockLevel) : null,
      maxStockLevel: row.maxStockLevel ? parseFloat(row.maxStockLevel) : null,
      reorderLevel: row.reorderLevel ? parseFloat(row.reorderLevel) : null,
      shelfPresence: row.shelfPresence,
      stockStatus: row.stockStatus,
      avgDailySales: parseFloat(row.avgDailySales || '0'),
      requiredStock35Days: parseFloat(row.requiredStock35Days || '0'),
      stockShortage: parseFloat(row.stockShortage || '0')
    }))

    // Calculate breakdown by stock status
    const outOfStockCount = allItems.filter(item => item.onHandQty === 0).length
    const healthyCount = allItems.filter(item => item.stockStatus === 'Healthy Stock' && item.onHandQty > 0).length
    const lowStockCount = allItems.filter(item => item.stockStatus === 'Low Stock' && item.onHandQty > 0).length
    const noSalesDataCount = allItems.filter(item => item.stockStatus === 'No Sales Data' && item.onHandQty > 0).length

    return NextResponse.json({
      success: true,
      data: allItems,
      count: allItems.length,
      breakdown: {
        totalItems: allItems.length,
        healthyStock: healthyCount,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        noSalesData: noSalesDataCount
      },
      timestamp: new Date().toISOString(),
      source: 'postgresql-flat-table-35day-coverage',
      calculation: '35-day coverage based on 7-day average sales (last 7 days avg * 35 - current stock)',
      dateRange: { startDate, endDate },
      cached: true,
      cacheInfo: { duration: CACHE_DURATION }
    }, {
      headers: {
        'Cache-Control': getCacheControlHeader(CACHE_DURATION)
      }
    })

  } catch (error) {
    console.error('Low Stock API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch low stock data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

