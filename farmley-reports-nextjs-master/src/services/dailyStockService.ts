// Daily Stock Service - Database version
// Provides data access functions for flat_stock_checks table

import { query } from '../lib/database'

// Helper function to parse date range string
const getDateRangeFromString = (dateRange: string, currentDate: string = new Date().toISOString().split('T')[0]) => {
  const current = new Date(currentDate)
  let startDate: Date
  let endDate: Date = new Date(current)

  switch(dateRange) {
    case 'today':
      startDate = new Date(current)
      endDate = new Date(current)
      break
    case 'yesterday':
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 1)
      endDate = new Date(startDate)
      break
    case 'last7days':
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 6)
      break
    case 'last30days':
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 29)
      break
    case 'thisWeek':
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - current.getDay())
      break
    case 'lastWeek':
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - current.getDay() - 7)
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 6)
      break
    case 'thisMonth':
      startDate = new Date(current.getFullYear(), current.getMonth(), 1)
      break
    case 'lastMonth':
      startDate = new Date(current.getFullYear(), current.getMonth() - 1, 1)
      endDate = new Date(current.getFullYear(), current.getMonth(), 0)
      break
    case 'thisYear':
      startDate = new Date(current.getFullYear(), 0, 1)
      break
    default:
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 6)
  }

  return { startDate, endDate }
}

/**
 * Get stock check summary with filters using 35-day coverage calculation
 */
export const getStockCheckSummary = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : filters.dateRange
    ? getDateRangeFromString(filters.dateRange)
    : getDateRangeFromString('last7days')

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  let sql = `
    WITH daily_stock AS (
      SELECT DISTINCT ON (check_date, store_code, product_code)
        check_date,
        store_code,
        product_code,
        store_quantity,
        warehouse_quantity,
        field_user_code,
        region_code,
        tl_code,
        user_role,
        chain_name,
        city_code,
        product_group,
        product_category
      FROM flat_stock_checks
      WHERE check_date >= $1::date - INTERVAL '7 days'
        AND check_date <= $2::date
        {{FILTER_PLACEHOLDER}}
      ORDER BY check_date DESC, store_code, product_code, check_datetime DESC
    ),
    sales_calc AS (
      SELECT
        store_code,
        product_code,
        check_date,
        store_quantity as current_qty,
        LAG(store_quantity) OVER (PARTITION BY store_code, product_code ORDER BY check_date) as prev_qty,
        CASE 
          WHEN LAG(store_quantity) OVER (PARTITION BY store_code, product_code ORDER BY check_date) > store_quantity
          THEN LAG(store_quantity) OVER (PARTITION BY store_code, product_code ORDER BY check_date) - store_quantity
          ELSE 0
        END as daily_sales
      FROM daily_stock
      WHERE check_date >= $1::date - INTERVAL '7 days'
        AND check_date < $2::date
    ),
    avg_sales AS (
      SELECT
        store_code,
        product_code,
        AVG(daily_sales) as avg_daily_sales
      FROM sales_calc
      WHERE prev_qty IS NOT NULL
      GROUP BY store_code, product_code
      HAVING COUNT(DISTINCT check_date) >= 2
    ),
    current_stock AS (
      SELECT DISTINCT ON (store_code, product_code)
        store_code,
        product_code,
        store_quantity,
        warehouse_quantity,
        field_user_code,
        check_date,
        region_code,
        tl_code,
        user_role,
        chain_name,
        city_code,
        product_group,
        product_category
      FROM flat_stock_checks
      WHERE check_date = $2::date
        {{FILTER_PLACEHOLDER}}
      ORDER BY store_code, product_code, check_datetime DESC
    ),
    coverage_analysis AS (
      SELECT
        cs.*,
        COALESCE(av.avg_daily_sales, 0) as avg_daily_sales,
        CASE
          WHEN COALESCE(av.avg_daily_sales, 0) = 0 THEN 'No Sales Data'
          WHEN COALESCE(av.avg_daily_sales * 35, 0) <= COALESCE(cs.store_quantity, 0) THEN 'Healthy Stock'
          ELSE 'Low Stock'
        END as stock_status
      FROM current_stock cs
      LEFT JOIN avg_sales av ON cs.store_code = av.store_code AND cs.product_code = av.product_code
    )
    SELECT
      COUNT(DISTINCT CONCAT(check_date::text, store_code, product_code)) as total_checks,
      COUNT(DISTINCT store_code) as total_stores_checked,
      COUNT(DISTINCT product_code) as total_products_checked,
      COUNT(DISTINCT field_user_code) as total_users,
      COALESCE(SUM(store_quantity), 0) as total_stock_on_hand,
      COALESCE(SUM(warehouse_quantity), 0) as total_warehouse_stock,
      COALESCE(AVG(store_quantity), 0) as avg_stock_per_store,
      COUNT(*) FILTER (WHERE store_quantity = 0) as out_of_stock_count,
      COUNT(*) FILTER (WHERE stock_status = 'Low Stock') as low_stock_count,
      COUNT(*) FILTER (WHERE stock_status = 'Healthy Stock') as healthy_stock_count
    FROM coverage_analysis
  `

  const params: any[] = [startDateStr, endDateStr]
  let paramCount = 3
  const filterConditions: string[] = []

  // Build filter conditions
  if (filters.regionCode) {
    filterConditions.push(`region_code = $${paramCount}`)
    params.push(filters.regionCode)
    paramCount++
  }

  // Team leader filter - if fieldUserCodes array is provided (from API route),
  // use those instead of tl_code
  if (filters.fieldUserCodes && Array.isArray(filters.fieldUserCodes) && filters.fieldUserCodes.length > 0) {
    filterConditions.push(`field_user_code = ANY($${paramCount}::text[])`)
    params.push(filters.fieldUserCodes)
    paramCount++
  } else if (filters.teamLeaderCode) {
    filterConditions.push(`tl_code = $${paramCount}`)
    params.push(filters.teamLeaderCode)
    paramCount++
  }

  if (filters.fieldUserRole) {
    filterConditions.push(`COALESCE(user_role, 'Promoter') = $${paramCount}`)
    params.push(filters.fieldUserRole)
    paramCount++
  }

  if (filters.userCode) {
    filterConditions.push(`field_user_code = $${paramCount}`)
    params.push(filters.userCode)
    paramCount++
  }

  if (filters.chainName) {
    filterConditions.push(`chain_name = $${paramCount}`)
    params.push(filters.chainName)
    paramCount++
  }

  if (filters.storeCode) {
    filterConditions.push(`store_code = $${paramCount}`)
    params.push(filters.storeCode)
    paramCount++
  }

  if (filters.productCode) {
    filterConditions.push(`product_code = $${paramCount}`)
    params.push(filters.productCode)
    paramCount++
  }

  if (filters.productCategory) {
    filterConditions.push(`product_category = $${paramCount}`)
    params.push(filters.productCategory)
    paramCount++
  }

  if (filters.productGroup) {
    filterConditions.push(`product_group = $${paramCount}`)
    params.push(filters.productGroup)
    paramCount++
  }

  // Apply filters to the CTEs
  const filterSQL = filterConditions.length > 0 ? `AND ${filterConditions.join(' AND ')}` : ''
  sql = sql.replace(/\{\{FILTER_PLACEHOLDER\}\}/g, filterSQL)

  const result = await query(sql, params)
  const stats = result.rows[0]

  return {
    totalChecks: parseInt(stats.total_checks) || 0,
    totalStoresChecked: parseInt(stats.total_stores_checked) || 0,
    totalProductsChecked: parseInt(stats.total_products_checked) || 0,
    totalUsers: parseInt(stats.total_users) || 0,
    totalStockOnHand: parseFloat(stats.total_stock_on_hand) || 0,
    totalWarehouseStock: parseFloat(stats.total_warehouse_stock) || 0,
    avgStockPerStore: parseFloat(stats.avg_stock_per_store) || 0,
    outOfStockCount: parseInt(stats.out_of_stock_count) || 0,
    lowStockCount: parseInt(stats.low_stock_count) || 0,
    healthyStockCount: parseInt(stats.healthy_stock_count) || 0
  }
}

/**
 * Get stock check trend by date
 */
export const getStockCheckTrend = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : filters.dateRange
    ? getDateRangeFromString(filters.dateRange)
    : getDateRangeFromString('last7days')

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  let sql = `
    SELECT
      check_date::date as date,
      COUNT(DISTINCT CONCAT(check_date::text, store_code, product_code)) as checks,
      COUNT(DISTINCT store_code) as stores,
      COALESCE(SUM(store_quantity), 0) as total_stock,
      COALESCE(AVG(store_quantity), 0) as avg_stock,
      COUNT(*) FILTER (WHERE store_quantity = 0) as out_of_stock,
      COUNT(*) FILTER (WHERE store_quantity > 0 AND store_quantity < 5) as low_stock,
      COUNT(*) FILTER (WHERE store_quantity >= 5) as healthy_stock
    FROM flat_stock_checks
    WHERE check_date >= $1 AND check_date <= $2
  `

  const params: any[] = [startDateStr, endDateStr]
  let paramCount = 3

  if (filters.regionCode) {
    sql += ` AND region_code = $${paramCount}`
    params.push(filters.regionCode)
    paramCount++
  }

  if (filters.teamLeaderCode) {
    sql += ` AND tl_code = $${paramCount}`
    params.push(filters.teamLeaderCode)
    paramCount++
  }

  if (filters.fieldUserRole) {
    sql += ` AND COALESCE(user_role, 'Promoter') = $${paramCount}`
    params.push(filters.fieldUserRole)
    paramCount++
  }

  if (filters.userCode) {
    sql += ` AND field_user_code = $${paramCount}`
    params.push(filters.userCode)
    paramCount++
  }

  if (filters.chainName) {
    sql += ` AND chain_name = $${paramCount}`
    params.push(filters.chainName)
    paramCount++
  }

  if (filters.storeCode) {
    sql += ` AND store_code = $${paramCount}`
    params.push(filters.storeCode)
    paramCount++
  }

  if (filters.productCode) {
    sql += ` AND product_code = $${paramCount}`
    params.push(filters.productCode)
    paramCount++
  }

  if (filters.productCategory) {
    sql += ` AND product_category = $${paramCount}`
    params.push(filters.productCategory)
    paramCount++
  }

  sql += ` GROUP BY check_date::date ORDER BY check_date::date`

  const result = await query(sql, params)

  return result.rows.map((row: any) => ({
    date: row.date,
    checks: parseInt(row.checks),
    stores: parseInt(row.stores),
    totalStock: parseFloat(row.total_stock),
    avgStock: parseFloat(row.avg_stock),
    outOfStock: parseInt(row.out_of_stock),
    lowStock: parseInt(row.low_stock),
    healthyStock: parseInt(row.healthy_stock)
  }))
}

/**
 * Get product stock levels
 */
export const getProductStockLevels = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : filters.dateRange
    ? getDateRangeFromString(filters.dateRange)
    : getDateRangeFromString('last7days')

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  let sql = `
    SELECT
      product_code as "productCode",
      product_name as "productName",
      product_category as "productCategory",
      product_group as "productGroup",
      COUNT(DISTINCT store_code) as stores_checked,
      COALESCE(SUM(store_quantity), 0) as total_stock,
      COALESCE(AVG(store_quantity), 0) as avg_stock,
      COUNT(*) FILTER (WHERE store_quantity = 0) as out_of_stock_stores,
      COUNT(*) FILTER (WHERE store_quantity > 0 AND store_quantity < 5) as low_stock_stores,
      COUNT(*) FILTER (WHERE store_quantity >= 5) as healthy_stock_stores
    FROM flat_stock_checks
    WHERE check_date >= $1 AND check_date <= $2
  `

  const params: any[] = [startDateStr, endDateStr]
  let paramCount = 3

  if (filters.regionCode) {
    sql += ` AND region_code = $${paramCount}`
    params.push(filters.regionCode)
    paramCount++
  }

  if (filters.teamLeaderCode) {
    sql += ` AND tl_code = $${paramCount}`
    params.push(filters.teamLeaderCode)
    paramCount++
  }

  if (filters.fieldUserRole) {
    sql += ` AND COALESCE(user_role, 'Promoter') = $${paramCount}`
    params.push(filters.fieldUserRole)
    paramCount++
  }

  if (filters.userCode) {
    sql += ` AND field_user_code = $${paramCount}`
    params.push(filters.userCode)
    paramCount++
  }

  if (filters.chainName) {
    sql += ` AND chain_name = $${paramCount}`
    params.push(filters.chainName)
    paramCount++
  }

  if (filters.storeCode) {
    sql += ` AND store_code = $${paramCount}`
    params.push(filters.storeCode)
    paramCount++
  }

  if (filters.productCategory) {
    sql += ` AND product_category = $${paramCount}`
    params.push(filters.productCategory)
    paramCount++
  }

  sql += `
    GROUP BY product_code, product_name, product_category, product_group
    ORDER BY total_stock DESC
    LIMIT 100
  `

  const result = await query(sql, params)

  return result.rows.map((row: any) => ({
    productCode: row.productCode,
    productName: row.productName,
    productCategory: row.productCategory,
    productGroup: row.productGroup,
    storesChecked: parseInt(row.stores_checked),
    totalStock: parseFloat(row.total_stock),
    avgStock: parseFloat(row.avg_stock),
    outOfStockStores: parseInt(row.out_of_stock_stores),
    lowStockStores: parseInt(row.low_stock_stores),
    healthyStockStores: parseInt(row.healthy_stock_stores)
  }))
}

/**
 * Get store stock levels
 */
export const getStoreStockLevels = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : filters.dateRange
    ? getDateRangeFromString(filters.dateRange)
    : getDateRangeFromString('last7days')

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  let sql = `
    SELECT
      store_code as "storeCode",
      store_name as "storeName",
      chain_name as "storeClass",
      city_code as "cityCode",
      region_code as "regionCode",
      COUNT(DISTINCT product_code) as products_checked,
      COALESCE(SUM(store_quantity), 0) as total_stock,
      COALESCE(AVG(store_quantity), 0) as avg_stock,
      COUNT(*) FILTER (WHERE store_quantity = 0) as out_of_stock_items,
      COUNT(*) FILTER (WHERE store_quantity > 0 AND store_quantity < 5) as low_stock_items,
      COUNT(*) FILTER (WHERE store_quantity >= 5) as healthy_stock_items
    FROM flat_stock_checks
    WHERE check_date >= $1 AND check_date <= $2
  `

  const params: any[] = [startDateStr, endDateStr]
  let paramCount = 3

  if (filters.regionCode) {
    sql += ` AND region_code = $${paramCount}`
    params.push(filters.regionCode)
    paramCount++
  }

  if (filters.teamLeaderCode) {
    sql += ` AND tl_code = $${paramCount}`
    params.push(filters.teamLeaderCode)
    paramCount++
  }

  if (filters.fieldUserRole) {
    sql += ` AND COALESCE(user_role, 'Promoter') = $${paramCount}`
    params.push(filters.fieldUserRole)
    paramCount++
  }

  if (filters.userCode) {
    sql += ` AND field_user_code = $${paramCount}`
    params.push(filters.userCode)
    paramCount++
  }

  if (filters.chainName) {
    sql += ` AND chain_name = $${paramCount}`
    params.push(filters.chainName)
    paramCount++
  }

  if (filters.productCode) {
    sql += ` AND product_code = $${paramCount}`
    params.push(filters.productCode)
    paramCount++
  }

  if (filters.productCategory) {
    sql += ` AND product_category = $${paramCount}`
    params.push(filters.productCategory)
    paramCount++
  }

  sql += `
    GROUP BY store_code, store_name, chain_name, city_code, region_code
    ORDER BY total_stock DESC
    LIMIT 100
  `

  const result = await query(sql, params)

  return result.rows.map((row: any) => ({
    storeCode: row.storeCode,
    storeName: row.storeName,
    storeClass: row.storeClass,
    cityCode: row.cityCode,
    regionCode: row.regionCode,
    productsChecked: parseInt(row.products_checked),
    totalStock: parseFloat(row.total_stock),
    avgStock: parseFloat(row.avg_stock),
    outOfStockItems: parseInt(row.out_of_stock_items),
    lowStockItems: parseInt(row.low_stock_items),
    healthyStockItems: parseInt(row.healthy_stock_items)
  }))
}

export const dailyStockService = {
  getStockCheckSummary,
  getStockCheckTrend,
  getProductStockLevels,
  getStoreStockLevels
}

export default dailyStockService
